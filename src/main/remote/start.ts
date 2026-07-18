import { SSHManager } from './ssh.js';
import { remoteCodeDir } from './paths.js';
import { DEFAULT_REMOTE_PORTS } from './defaults.js';
import { RemoteStartError, errorMessage, shellEscape } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { fetchNodeInfo } from '../cluster/health.js';
import { combineSignedMessages, type SignedMessage } from '../cluster/fees.js';
import type { EuclidConfig, RemoteHostConfig, DeployConfig } from '../config/schema.js';
import { resolveJvmConfig } from '../config/schema.js';

export interface RemoteStartOptions {
  config: EuclidConfig;
  genesis?: boolean;
  resendMessages?: boolean;
  onProgress?: (step: string) => void;
}

interface LayerPorts {
  public: number;
  p2p: number;
  cli: number;
}

/**
 * Start the metagraph cluster on remote hosts.
 * Follows strict ordering: metagraph-l0 → currency-l1 → data-l1
 */
export async function remoteStart(options: RemoteStartOptions): Promise<void> {
  const { config, genesis } = options;
  const deploy = config.deploy;

  if (!deploy) {
    throw new RemoteStartError('(config)', 'metagraph', {
      cause: new Error('No deploy configuration found'),
    });
  }

  const ssh = new SSHManager();
  const progress = (step: string) => options.onProgress?.(step);

  // Register signal handlers for graceful cleanup
  const cleanup = async (signal: string, exitCode: number) => {
    process.stdout.write(`\n  Cleaning up SSH connections (${signal})...\n`);
    await ssh.disconnectAll(5000);
    process.exit(exitCode);
  };

  const sigintHandler = () => {
    void cleanup('SIGINT', 130);
  };
  const sigtermHandler = () => {
    void cleanup('SIGTERM', 143);
  };
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  try {
    // Connect to all hosts
    progress('Connecting to all hosts...');
    for (const host of deploy.hosts) {
      await ssh.connect(host);
    }
    progress('done:Connected to all hosts');

    // Pre-start cleanup on all hosts
    progress('Cleaning up existing processes...');
    await cleanupAllHosts(ssh, deploy, config);
    progress('done:Cleanup complete');

    // Get metagraph ID from genesis.address on first host
    const firstHost = deploy.hosts[0];
    const ml0Dir = remoteCodeDir(firstHost, 'metagraph-l0');
    const metagraphIdResult = await ssh.exec(
      firstHost,
      `cat "${ml0Dir}/genesis.address" 2>/dev/null || echo ""`,
    );
    const metagraphId = metagraphIdResult.stdout.trim();

    if (!metagraphId) {
      logger.warn('No genesis.address found — metagraph ID will be empty');
    }

    const remotePorts = deploy.remote_ports ?? DEFAULT_REMOTE_PORTS;

    // ─── Metagraph L0 ───────────────────────────────────────────
    if (config.layers.includes('metagraph-l0')) {
      progress('phase:Metagraph L0');
      const ml0Ports = remotePorts.metagraph_l0;

      // ── Rollback-only: silently spam owner/staking messages while
      // metagraph-l0 is starting, then stop when it reaches Ready.
      // Defends the mainnet consensus-round-2 race window.
      const resendMessages = !genesis && options.resendMessages === true;
      let ownerSpammer: SpammerHandle | undefined;
      let stakingSpammer: SpammerHandle | undefined;

      if (resendMessages && deploy.network.name !== 'dev') {
        progress('Preparing resend-messages spammers...');
        const messageUrl = `http://${firstHost.host}:${ml0Ports.public}/currency/message`;
        const msgOpts = {
          hosts: deploy.hosts,
          config,
          metagraphId,
          codeDir: remoteCodeDir(firstHost, 'metagraph-l0'),
        };
        try {
          const ownerMessage = await prepareOwnerMessage(ssh, msgOpts);
          ownerSpammer = startMessageSpammer(messageUrl, ownerMessage, { label: 'owner' });
        } catch (err) {
          logger.warn(`Could not prepare owner message for spammer: ${errorMessage(err)}`);
        }
        if (config.snapshot_fees?.staking) {
          try {
            const stakingMessage = await prepareStakingMessage(ssh, msgOpts);
            stakingSpammer = startMessageSpammer(messageUrl, stakingMessage, { label: 'staking' });
          } catch (err) {
            logger.warn(`Could not prepare staking message for spammer: ${errorMessage(err)}`);
          }
        }
      }

      let ml0NodeId: string;
      try {
        ml0NodeId = await startLayer(ssh, {
          deploy,
          config,
          layer: 'metagraph-l0',
          ports: ml0Ports,
          genesis: genesis ?? false,
          metagraphId,
          onProgress: progress,
        });
      } finally {
        if (ownerSpammer || stakingSpammer) {
          ownerSpammer?.stop();
          stakingSpammer?.stop();
          progress('done:Resend-messages spammers stopped');
        }
      }

      // ─── Currency L1 ───────────────────────────────────────────
      if (config.layers.includes('currency-l1')) {
        progress('phase:Currency L1');
        const cl1Ports = remotePorts.currency_l1;
        await startLayer(ssh, {
          deploy,
          config,
          layer: 'currency-l1',
          ports: cl1Ports,
          genesis: false, // L1 layers use initial-validator, not genesis
          metagraphId,
          ml0NodeId,
          ml0Host: firstHost.host,
          ml0Port: ml0Ports.public,
          onProgress: progress,
        });
      }

      // ─── Data L1 ──────────────────────────────────────────────
      if (config.layers.includes('data-l1')) {
        progress('phase:Data L1');
        const dl1Ports = remotePorts.data_l1;
        await startLayer(ssh, {
          deploy,
          config,
          layer: 'data-l1',
          ports: dl1Ports,
          genesis: false,
          metagraphId,
          ml0NodeId,
          ml0Host: firstHost.host,
          ml0Port: ml0Ports.public,
          onProgress: progress,
        });
      }

      // ─── Staking message (submitted after all layers are running) ──
      if (genesis && config.snapshot_fees?.staking && deploy.network.name !== 'dev') {
        progress('phase:Staking Message');
        progress('Submitting staking signing message...');
        try {
          await submitRemoteStakingMessage(ssh, {
            hosts: deploy.hosts,
            config,
            metagraphId,
            codeDir: remoteCodeDir(firstHost, 'metagraph-l0'),
            ml0Port: ml0Ports.public,
            onProgress: progress,
          });
          progress('done:Staking message submitted');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Staking message failed (non-fatal): ${msg}`);
          progress('warn:Staking message failed — submit later with: hydra update-owner');
        }
      }
    }

    progress('done:All layers started successfully');
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigtermHandler);
    await ssh.disconnectAll(5000);
  }
}

interface StartLayerOptions {
  deploy: DeployConfig;
  config: EuclidConfig;
  layer: string;
  ports: LayerPorts;
  genesis: boolean;
  metagraphId: string;
  ml0NodeId?: string;
  ml0Host?: string;
  ml0Port?: number;
  onProgress?: (step: string) => void;
}

/**
 * Start a single layer across all hosts.
 * Returns the node ID of the first (genesis/initial-validator) node.
 */
async function startLayer(ssh: SSHManager, options: StartLayerOptions): Promise<string> {
  const { deploy, config, layer, ports, genesis, metagraphId } = options;
  const progress = (step: string) => options.onProgress?.(step);

  const hosts = deploy.hosts;
  const firstHost = hosts[0];

  // Build base environment variables
  const baseEnv: Record<string, string> = {
    CL_PUBLIC_HTTP_PORT: String(ports.public),
    CL_P2P_HTTP_PORT: String(ports.p2p),
    CL_CLI_HTTP_PORT: String(ports.cli),
    CL_GLOBAL_L0_PEER_HTTP_HOST: deploy.network.gl0_node.ip,
    CL_GLOBAL_L0_PEER_HTTP_PORT: String(deploy.network.gl0_node.public_port),
    CL_GLOBAL_L0_PEER_ID: deploy.network.gl0_node.id,
    CL_APP_ENV: deploy.network.name,
    CL_COLLATERAL: '0',
  };

  // Metagraph L0 needs the token identifier (rollback lead + all validators)
  if (layer === 'metagraph-l0' && metagraphId) {
    baseEnv.CL_L0_TOKEN_IDENTIFIER = metagraphId;
  }

  // L1 layers need metagraph L0 peer info
  if (layer !== 'metagraph-l0' && options.ml0NodeId) {
    baseEnv.CL_L0_PEER_ID = options.ml0NodeId;
    baseEnv.CL_L0_PEER_HTTP_HOST = options.ml0Host ?? firstHost.host;
    baseEnv.CL_L0_PEER_HTTP_PORT = String(options.ml0Port ?? 9100);
    baseEnv.CL_L0_TOKEN_IDENTIFIER = metagraphId;
  }

  // JVM options — resolve per-layer config
  const jvmLayerKey = layer.replace('-', '_') as 'metagraph_l0' | 'currency_l1' | 'data_l1';
  const jvm = resolveJvmConfig(deploy.jvm, jvmLayerKey);
  const jvmOpts = `-Xms${jvm.xms} -Xmx${jvm.xmx}`;

  // ─── Start genesis/initial-validator node (host-1) ─────────
  const node1 = config.nodes[0];
  const node1Env = {
    ...baseEnv,
    CL_KEYSTORE: node1.key_file.name,
    CL_KEYALIAS: node1.key_file.alias,
    CL_PASSWORD: node1.key_file.password,
  };

  let startCmd: string;
  if (layer === 'metagraph-l0') {
    if (genesis) {
      // For non-dev environments, create owner signing message before genesis
      const isNonDev = deploy.network.name !== 'dev';
      let ownerMessageFlag = '';

      if (isNonDev) {
        progress('Creating owner signing message...');
        await createRemoteOwnerMessage(ssh, {
          hosts,
          config,
          metagraphId,
          codeDir: remoteCodeDir(firstHost, layer),
          onProgress: progress,
        });
        ownerMessageFlag = ' --metagraph-owner-message owner_message.json';
      }

      const genesisArgs = `run-genesis genesis.snapshot --ip ${firstHost.host}${ownerMessageFlag}`;
      startCmd = buildBackgroundJavaCmd(jvmOpts, layer, genesisArgs, node1Env);
    } else {
      startCmd = buildBackgroundJavaCmd(
        jvmOpts,
        layer,
        `run-rollback --ip ${firstHost.host}`,
        node1Env,
      );
    }
  } else {
    startCmd = buildBackgroundJavaCmd(
      jvmOpts,
      layer,
      `run-initial-validator --ip ${firstHost.host}`,
      node1Env,
    );
  }

  progress(`Starting node-1 on ${firstHost.host}...`);
  await ssh.execDetached(firstHost, startCmd, {
    cwd: remoteCodeDir(firstHost, layer),
  });

  // Brief pause then verify the process is actually running
  await new Promise((r) => setTimeout(r, 3000));
  await verifyProcessRunning(ssh, firstHost, layer, remoteCodeDir(firstHost, layer));

  // Wait for node-1 to be ready (with log checking on failure)
  progress(`Waiting for node-1 to reach Ready...`);
  await waitForRemoteNodeReady(ssh, firstHost, layer, ports.public, {
    maxRetries: 120,
    intervalMs: 2000,
    onRetry: (attempt) => {
      if (attempt % 15 === 0) {
        progress(`wait:node-1 still starting (attempt ${attempt})...`);
      }
    },
  });

  // Extract node-1 ID
  const nodeIdResult = await ssh.exec(firstHost, `java -jar cl-wallet.jar show-id`, {
    cwd: remoteCodeDir(firstHost, layer),
    env: node1Env,
  });
  const node1Id = nodeIdResult.stdout.trim();
  progress(`done:Node-1 ready — ${firstHost.host} (${node1Id.slice(0, 12)}…)`);

  // ─── Start validator nodes (host-2, host-3, ...) ───────────
  for (let i = 1; i < hosts.length; i++) {
    const host = hosts[i];
    const node = config.nodes[i];
    if (!node) break;

    const nodeEnv = {
      ...baseEnv,
      CL_KEYSTORE: node.key_file.name,
      CL_KEYALIAS: node.key_file.alias,
      CL_PASSWORD: node.key_file.password,
    };

    const validatorCmd = buildBackgroundJavaCmd(
      jvmOpts,
      layer,
      `run-validator --ip ${host.host}`,
      nodeEnv,
    );

    progress(`Starting node-${i + 1} on ${host.host}...`);
    await ssh.execDetached(host, validatorCmd, {
      cwd: remoteCodeDir(host, layer),
    });

    // Brief pause then verify the process is actually running
    await new Promise((r) => setTimeout(r, 3000));
    await verifyProcessRunning(ssh, host, layer, remoteCodeDir(host, layer));

    // Wait for ReadyToJoin (with log checking on failure)
    progress(`Waiting for node-${i + 1} to reach ReadyToJoin...`);
    await waitForRemoteNodeState(ssh, host, layer, ports.public, 'ReadyToJoin', 120, 1000);

    // Join cluster
    progress(`Joining node-${i + 1} to cluster...`);
    await joinCluster(ssh, host, ports.cli, firstHost.host, ports.p2p, node1Id);
    progress(`done:Node-${i + 1} joined — ${host.host}`);
  }

  return node1Id;
}

// ─── Owner / Staking Message Helpers ──────────────────────────────────────

interface OwnerMessageOptions {
  hosts: RemoteHostConfig[];
  config: EuclidConfig;
  metagraphId: string;
  codeDir: string;
  onProgress?: (step: string) => void;
}

/**
 * Run a cl-wallet.jar signing command on a remote host and return the JSON output.
 * Handles both stdout output and file-based fallback.
 */
async function remoteSign(
  ssh: SSHManager,
  host: RemoteHostConfig,
  command: string,
  keyEnv: Record<string, string>,
  cwd: string,
  fallbackFiles: string[],
): Promise<string> {
  const result = await ssh.exec(host, command, { cwd, env: keyEnv });
  const output = result.stdout.trim();

  if (output.startsWith('{')) return output;

  // Check if the tool wrote to a file instead of stdout
  const fileList = fallbackFiles.map((f) => `if [ -f "${f}" ]; then cat "${f}"; exit 0; fi`);
  const fileCheck = await ssh.exec(host, `${fileList.join('; ')}; echo ""`, { cwd });
  const fileContent = fileCheck.stdout.trim();
  if (fileContent.startsWith('{')) {
    logger.debug(`Found signed message in file on ${host.host}`);
    return fileContent;
  }

  throw new RemoteStartError(host.host, 'metagraph-l0', {
    cause: new Error(
      `cl-wallet.jar signing command did not output valid JSON.\n  Output: ${output.slice(0, 300)}`,
    ),
  });
}

/**
 * Sign and combine the owner signing message — does NOT write to file or POST.
 * Returns the combined SignedMessage object ready to be embedded into genesis
 * or POSTed via HTTP.
 */
async function prepareOwnerMessage(
  ssh: SSHManager,
  opts: OwnerMessageOptions,
): Promise<SignedMessage> {
  const { hosts, config, metagraphId } = opts;
  const firstHost = hosts[0];
  const codeDir = opts.codeDir;

  const ownerKey = config.snapshot_fees?.owner?.key_file ?? config.nodes[0].key_file;

  opts.onProgress?.('Getting owner address...');
  const addrResult = await ssh.exec(firstHost, `java -jar cl-wallet.jar show-address`, {
    cwd: codeDir,
    env: {
      CL_KEYSTORE: ownerKey.name,
      CL_KEYALIAS: ownerKey.alias,
      CL_PASSWORD: ownerKey.password,
    },
  });
  const ownerAddress = addrResult.stdout.trim();
  logger.debug(`Owner address: ${ownerAddress}`);

  if (!ownerAddress || ownerAddress.length < 10) {
    throw new RemoteStartError(firstHost.host, 'metagraph-l0', {
      cause: new Error(`Failed to get owner address. Output: ${addrResult.stdout}`),
    });
  }

  const signCmd =
    `java -jar cl-wallet.jar create-owner-signing-message ` +
    `--address "${ownerAddress}" ` +
    `--metagraphId "${metagraphId}" ` +
    `--parentOrdinal 0`;
  const fallbackFiles = ['owner_message.txt', 'signed_message.json', 'owner-message'];

  const signedOutputs: string[] = [];

  opts.onProgress?.('Signing owner message with owner key...');
  const ownerSigned = await remoteSign(
    ssh,
    firstHost,
    signCmd,
    { CL_KEYSTORE: ownerKey.name, CL_KEYALIAS: ownerKey.alias, CL_PASSWORD: ownerKey.password },
    codeDir,
    fallbackFiles,
  );
  signedOutputs.push(ownerSigned);
  logger.debug(`Owner key signed (${ownerSigned.length} chars)`);

  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    const node = config.nodes[i];
    if (!node) break;

    opts.onProgress?.(`Signing owner message with node-${i + 1}...`);
    const hostCodeDir = remoteCodeDir(host, 'metagraph-l0');
    const nodeSigned = await remoteSign(
      ssh,
      host,
      signCmd,
      {
        CL_KEYSTORE: node.key_file.name,
        CL_KEYALIAS: node.key_file.alias,
        CL_PASSWORD: node.key_file.password,
      },
      hostCodeDir,
      fallbackFiles,
    );
    signedOutputs.push(nodeSigned);
    logger.debug(`Node-${i + 1} signed (${nodeSigned.length} chars)`);
  }

  const combined = combineSignedMessages(signedOutputs);
  logger.debug(`Owner message prepared (${combined.proofs.length} proofs)`);
  return combined;
}

/**
 * Create the owner signing message file on the genesis host (host-1).
 * The message is signed by BOTH the owner keystore AND all node keystores,
 * then proofs are combined and written to a JSON file for the genesis startup.
 */
async function createRemoteOwnerMessage(ssh: SSHManager, opts: OwnerMessageOptions): Promise<void> {
  const firstHost = opts.hosts[0];
  const combined = await prepareOwnerMessage(ssh, opts);
  const messageJson = JSON.stringify(combined);

  opts.onProgress?.('Writing owner message file...');
  await ssh.exec(firstHost, `cat > owner_message.json << 'EOFMSG'\n${messageJson}\nEOFMSG`, {
    cwd: opts.codeDir,
  });
  logger.debug(
    `Owner message written to ${opts.codeDir}/owner_message.json (${combined.proofs.length} proofs)`,
  );
}

/**
 * Sign and combine the staking signing message — does NOT POST.
 * Returns the combined SignedMessage object.
 */
async function prepareStakingMessage(
  ssh: SSHManager,
  opts: OwnerMessageOptions,
): Promise<SignedMessage> {
  const { hosts, config, metagraphId } = opts;
  const firstHost = hosts[0];
  const codeDir = opts.codeDir;

  const stakingKey = config.snapshot_fees?.staking?.key_file ?? config.nodes[0].key_file;

  opts.onProgress?.('Getting staking address...');
  const addrResult = await ssh.exec(firstHost, `java -jar cl-wallet.jar show-address`, {
    cwd: codeDir,
    env: {
      CL_KEYSTORE: stakingKey.name,
      CL_KEYALIAS: stakingKey.alias,
      CL_PASSWORD: stakingKey.password,
    },
  });
  const stakingAddress = addrResult.stdout.trim();
  logger.debug(`Staking address: ${stakingAddress}`);

  const signCmd =
    `java -jar cl-wallet.jar create-staking-signing-message ` +
    `--address "${stakingAddress}" ` +
    `--metagraphId "${metagraphId}" ` +
    `--parentOrdinal 0`;
  const fallbackFiles = ['staking_message.txt', 'signed_message.json', 'staking-message'];

  const signedOutputs: string[] = [];

  opts.onProgress?.('Signing staking message with staking key...');
  const stakingSigned = await remoteSign(
    ssh,
    firstHost,
    signCmd,
    {
      CL_KEYSTORE: stakingKey.name,
      CL_KEYALIAS: stakingKey.alias,
      CL_PASSWORD: stakingKey.password,
    },
    codeDir,
    fallbackFiles,
  );
  signedOutputs.push(stakingSigned);
  logger.debug(`Staking key signed (${stakingSigned.length} chars)`);

  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    const node = config.nodes[i];
    if (!node) break;

    opts.onProgress?.(`Signing staking message with node-${i + 1}...`);
    const hostCodeDir = remoteCodeDir(host, 'metagraph-l0');
    const nodeSigned = await remoteSign(
      ssh,
      host,
      signCmd,
      {
        CL_KEYSTORE: node.key_file.name,
        CL_KEYALIAS: node.key_file.alias,
        CL_PASSWORD: node.key_file.password,
      },
      hostCodeDir,
      fallbackFiles,
    );
    signedOutputs.push(nodeSigned);
    logger.debug(`Node-${i + 1} signed (${nodeSigned.length} chars)`);
  }

  const combined = combineSignedMessages(signedOutputs);
  logger.debug(`Staking message prepared (${combined.proofs.length} proofs)`);
  return combined;
}

/**
 * Submit the staking signing message via HTTP after the metagraph L0 cluster is running.
 */
async function submitRemoteStakingMessage(
  ssh: SSHManager,
  opts: OwnerMessageOptions & { ml0Port: number },
): Promise<void> {
  const combined = await prepareStakingMessage(ssh, opts);
  opts.onProgress?.('Submitting staking message...');

  const messageUrl = `http://${opts.hosts[0].host}:${opts.ml0Port}/currency/message`;
  const result = await postMessageTolerant(messageUrl, combined, { timeoutMs: 15000 });

  if (!result.ok) {
    logger.warn(`Staking message submission returned HTTP ${result.status}: ${result.body.slice(0, 300)}`);
  } else {
    logger.debug(`Staking signing message submitted successfully (${combined.proofs.length} proofs)`);
  }
}

// ─── Spammer + tolerant POST helpers ─────────────────────────────────────────

interface PostResult {
  ok: boolean;
  status: number;
  body: string;
  alreadySubmitted: boolean;
}

/**
 * Single-shot POST that classifies "already submitted" responses as success.
 * Mainnet may return non-200 if the message was already accepted in an earlier
 * spammer attempt — that's a feature, not a failure.
 */
async function postMessageTolerant(
  url: string,
  body: SignedMessage,
  options: { timeoutMs?: number } = {},
): Promise<PostResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text().catch(() => '');
    const alreadySubmitted = /already.*submit|duplicate|exists/i.test(text);
    return {
      ok: response.ok || alreadySubmitted,
      status: response.status,
      body: text,
      alreadySubmitted,
    };
  } catch (err) {
    return { ok: false, status: 0, body: errorMessage(err), alreadySubmitted: false };
  }
}

interface SpammerHandle {
  /** Signal the loop to stop on its next iteration. */
  stop(): void;
}

/**
 * Fire-and-forget background loop that POSTs `body` to `url` repeatedly until
 * the caller calls stop() or `maxAttempts` is reached.
 *
 * Intentionally KEEPS POSTING even after the server returns 200, mirroring the
 * v1 ansible curl-spammer behavior. A 200 only means the endpoint accepted the
 * request — it doesn't guarantee the message lands in the next snapshot. Keep
 * spamming to maximize the chance the message is fresh in the mempool when
 * consensus builds the snapshot.
 */
function startMessageSpammer(
  url: string,
  body: SignedMessage,
  options: {
    label: string;
    maxAttempts?: number;
    sleepMs?: number;
    fetchTimeoutMs?: number;
    onProgress?: (step: string) => void;
  },
): SpammerHandle {
  const maxAttempts = options.maxAttempts ?? 600;
  const sleepMs = options.sleepMs ?? 200;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 4000;
  let stopRequested = false;

  const run = async (): Promise<void> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (stopRequested) {
        logger.debug(`Spammer ${options.label} stopped after ${attempt - 1} attempts`);
        return;
      }
      const result = await postMessageTolerant(url, body, { timeoutMs: fetchTimeoutMs });
      logger.debug(
        `Spammer ${options.label} attempt ${attempt} → ${result.ok ? 'ok' : 'fail'} (status ${result.status})`,
      );
      await new Promise((r) => setTimeout(r, sleepMs));
    }
    logger.debug(`Spammer ${options.label} exhausted ${maxAttempts} attempts`);
  };

  options.onProgress?.(
    `${options.label} spammer started (up to ${maxAttempts} attempts, ${sleepMs}ms apart)`,
  );

  void run().catch((err) => {
    logger.warn(`Spammer ${options.label} crashed: ${errorMessage(err)}`);
  });

  return {
    stop: () => {
      stopRequested = true;
    },
  };
}

/**
 * Clean up existing processes and archive logs/data on all hosts.
 */
async function cleanupAllHosts(
  ssh: SSHManager,
  deploy: DeployConfig,
  config: EuclidConfig,
): Promise<void> {
  const remotePorts = deploy.remote_ports ?? DEFAULT_REMOTE_PORTS;

  const layers = ['metagraph-l0'];
  if (config.layers.includes('currency-l1')) layers.push('currency-l1');
  if (config.layers.includes('data-l1')) layers.push('data-l1');

  // Only kill ports for configured layers
  const allPorts: number[] = [];
  const portSets: Record<string, LayerPorts> = {
    'metagraph-l0': remotePorts.metagraph_l0,
    'currency-l1': remotePorts.currency_l1,
    'data-l1': remotePorts.data_l1,
  };
  for (const layer of layers) {
    const ps = portSets[layer];
    if (ps) allPorts.push(ps.public, ps.p2p, ps.cli);
  }

  for (const host of deploy.hosts) {
    // Kill Java processes by JAR name (catches processes that haven't bound ports yet)
    for (const layer of layers) {
      await ssh.exec(host, `pkill -f "${layer}.jar" 2>/dev/null || true`);
    }

    // Also kill by port (catches any non-Java processes holding the ports)
    for (const port of allPorts) {
      await ssh.exec(host, `fuser -k ${port}/tcp 2>/dev/null || true`);
    }

    // Brief pause to let processes die
    await ssh.exec(host, `sleep 1`);

    // Archive old logs
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const layer of layers) {
      const dir = remoteCodeDir(host, layer);
      await ssh.exec(
        host,
        [
          `[ -d "${dir}/logs" ] && mkdir -p "${dir}/archived-logs" && mv "${dir}/logs" "${dir}/archived-logs/logs_${timestamp}" || true`,
          `mkdir -p "${dir}/logs"`,
        ].join(' && '),
      );
    }
  }
}

/**
 * Verify a Java process is actually running on the remote host.
 * Throws immediately with log context if the process crashed.
 */
async function verifyProcessRunning(
  ssh: SSHManager,
  host: RemoteHostConfig,
  layer: string,
  cwd: string,
): Promise<void> {
  const result = await ssh.exec(host, `pgrep -f "${layer}.jar" || echo "NOT_RUNNING"`, { cwd });
  if (result.stdout.includes('NOT_RUNNING')) {
    const logTail = await getRemoteLogTail(ssh, host, layer, cwd, 30);
    throw new RemoteStartError(host.host, layer, {
      cause: new Error(
        `Java process for ${layer} is not running — it may have crashed on startup.\n` +
          `  Last log lines:\n${logTail}`,
      ),
    });
  }
  logger.debug(`[${host.host}] Process for ${layer} is running (PID: ${result.stdout.trim()})`);
}

/**
 * Get the tail of a remote log file for diagnostics.
 */
async function getRemoteLogTail(
  ssh: SSHManager,
  host: RemoteHostConfig,
  layer: string,
  cwd: string,
  lines: number,
): Promise<string> {
  try {
    const result = await ssh.exec(
      host,
      `tail -${lines} ${layer}.log 2>/dev/null || echo "(no log file)"`,
      {
        cwd,
      },
    );
    return result.stdout.trim();
  } catch (err) {
    logger.debug(`Failed to read remote log for ${layer} on ${host.host}: ${errorMessage(err)}`);
    return '(failed to read log)';
  }
}

/**
 * Wait for a remote node to reach "Ready" state, checking the log on failure.
 */
async function waitForRemoteNodeReady(
  ssh: SSHManager,
  host: RemoteHostConfig,
  layer: string,
  port: number,
  options?: {
    maxRetries?: number;
    intervalMs?: number;
    onRetry?: (attempt: number, elapsed: number) => void;
  },
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 120;
  const intervalMs = options?.intervalMs ?? 2000;
  const startTime = Date.now();
  const cwd = remoteCodeDir(host, layer);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo(host.host, port);

    if (info?.state === 'Ready') {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.debug(
        `[${host.host}] ${layer} reached Ready state after ${elapsed}s (attempt ${attempt})`,
      );
      return;
    }

    // Log intermediate states (not just failures)
    if (info?.state) {
      logger.debug(`[${host.host}] ${layer} state: ${info.state} (attempt ${attempt})`);
    }

    // Every 30 attempts (~60s), check if process is still alive
    if (attempt > 0 && attempt % 30 === 0) {
      const psCheck = await ssh.exec(host, `pgrep -f "${layer}.jar" || echo "NOT_RUNNING"`, {
        cwd,
      });
      if (psCheck.stdout.includes('NOT_RUNNING')) {
        const logTail = await getRemoteLogTail(ssh, host, layer, cwd, 40);
        throw new RemoteStartError(host.host, layer, {
          cause: new Error(
            `Java process for ${layer} died while waiting for Ready state.\n` +
              `  Last log lines:\n${logTail}`,
          ),
        });
      }
    }

    if (options?.onRetry) {
      options.onRetry(attempt, Date.now() - startTime);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Timed out — show log context
  const logTail = await getRemoteLogTail(ssh, host, layer, cwd, 40);
  throw new RemoteStartError(host.host, layer, {
    cause: new Error(
      `Node did not reach Ready state after ${maxRetries} attempts (${Math.round((maxRetries * intervalMs) / 1000)}s).\n` +
        `  Last log lines:\n${logTail}`,
    ),
  });
}

/**
 * Wait for a remote node to reach a specific state, checking the log on failure.
 */
async function waitForRemoteNodeState(
  ssh: SSHManager,
  host: RemoteHostConfig,
  layer: string,
  port: number,
  targetState: string,
  maxRetries: number,
  intervalMs: number,
): Promise<void> {
  const cwd = remoteCodeDir(host, layer);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo(host.host, port);

    if (info?.state === targetState) {
      logger.debug(`[${host.host}] ${layer} reached ${targetState} (attempt ${attempt})`);
      return;
    }

    if (info?.state) {
      logger.debug(`[${host.host}] ${layer} state: ${info.state} (attempt ${attempt})`);
    }

    // Every 30 attempts, check if process is still alive
    if (attempt > 0 && attempt % 30 === 0) {
      const psCheck = await ssh.exec(host, `pgrep -f "${layer}.jar" || echo "NOT_RUNNING"`, {
        cwd,
      });
      if (psCheck.stdout.includes('NOT_RUNNING')) {
        const logTail = await getRemoteLogTail(ssh, host, layer, cwd, 40);
        throw new RemoteStartError(host.host, layer, {
          cause: new Error(
            `Java process for ${layer} died while waiting for ${targetState}.\n` +
              `  Last log lines:\n${logTail}`,
          ),
        });
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Timed out — show log context
  const logTail = await getRemoteLogTail(ssh, host, layer, cwd, 40);
  throw new RemoteStartError(host.host, layer, {
    cause: new Error(
      `Node at ${host.host}:${port} did not reach ${targetState} after ${maxRetries} attempts.\n` +
        `  Last log lines:\n${logTail}`,
    ),
  });
}

/**
 * Join a validator node to the cluster via the genesis node's CLI endpoint.
 * Executes curl from INSIDE the validator host (via SSH) since CLI ports
 * are typically not exposed externally.
 */
async function joinCluster(
  ssh: SSHManager,
  validatorHost: RemoteHostConfig,
  validatorCliPort: number,
  genesisHost: string,
  genesisP2pPort: number,
  genesisId: string,
): Promise<void> {
  const url = `http://localhost:${validatorCliPort}/cluster/join`;
  const body = JSON.stringify({
    id: genesisId,
    ip: genesisHost,
    p2pPort: genesisP2pPort,
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Escape single quotes in JSON payload to prevent shell injection
      const safeBody = body.replace(/'/g, "'\\''");
      const result = await ssh.exec(
        validatorHost,
        [
          `curl -s -o /dev/null -w '%{http_code}'`,
          `-X POST`,
          `-H 'Content-Type: application/json'`,
          `--data-raw '${safeBody}'`,
          `--max-time 10`,
          `"${url}"`,
        ].join(' '),
      );

      const httpCode = result.stdout.trim();
      logger.debug(`[${validatorHost.host}] join cluster response: HTTP ${httpCode}`);

      if (httpCode === '200' || httpCode === '404') return;
    } catch (err) {
      logger.debug(
        `[${validatorHost.host}] join cluster attempt ${attempt} failed: ${errorMessage(err)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 10000));
  }

  throw new RemoteStartError(
    validatorHost.host,
    `Failed to join cluster via localhost:${validatorCliPort} after 5 attempts`,
  );
}

/**
 * Build a command that starts a Java process fully detached from the SSH session.
 * Uses setsid to create a new session so the SSH channel can close immediately.
 * Environment variables are passed via `env` so they survive the session detach.
 */
function buildBackgroundJavaCmd(
  jvmOpts: string,
  layer: string,
  args: string,
  env: Record<string, string>,
): string {
  const envPairs = Object.entries(env)
    .map(([k, v]) => `${k}="${shellEscape(v)}"`)
    .join(' ');
  return `setsid env ${envPairs} java ${jvmOpts} -jar ${layer}.jar ${args} > ${layer}.log 2>&1 < /dev/null &`;
}
