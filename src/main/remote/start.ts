import { SSHManager } from './ssh.js';
import { RemoteStartError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { fetchNodeInfo, waitForNodeReady } from '../cluster/health.js';
import type { EuclidConfig, RemoteHostConfig, DeployConfig } from '../config/schema.js';
import { resolveJvmConfig } from '../config/schema.js';

export interface RemoteStartOptions {
  config: EuclidConfig;
  genesis?: boolean;
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

  // Register SIGINT handler for graceful cleanup
  const cleanup = async () => {
    process.stdout.write('\n  Cleaning up SSH connections...\n');
    await ssh.disconnectAll();
  };
  process.on('SIGINT', () => {
    cleanup().then(() => process.exit(130));
  });

  try {
    // Connect to all hosts
    progress('Connecting to all hosts...');
    for (const host of deploy.hosts) {
      await ssh.connect(host);
    }

    // Pre-start cleanup on all hosts
    progress('Cleaning up existing processes...');
    await cleanupAllHosts(ssh, deploy, config);

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

    const remotePorts = deploy.remote_ports ?? {
      metagraph_l0: { public: 9100, p2p: 9101, cli: 9102 },
      currency_l1: { public: 9200, p2p: 9201, cli: 9202 },
      data_l1: { public: 9300, p2p: 9301, cli: 9302 },
    };

    // ─── Metagraph L0 ───────────────────────────────────────────
    if (config.layers.includes('metagraph-l0')) {
      progress('Starting Metagraph L0...');
      const ml0Ports = remotePorts.metagraph_l0;
      const ml0NodeId = await startLayer(ssh, {
        deploy,
        config,
        layer: 'metagraph-l0',
        ports: ml0Ports,
        genesis: genesis ?? false,
        metagraphId,
        onProgress: progress,
      });

      // ─── Currency L1 ───────────────────────────────────────────
      if (config.layers.includes('currency-l1')) {
        progress('Starting Currency L1...');
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
        progress('Starting Data L1...');
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
    }

    progress('All layers started successfully');
  } finally {
    process.removeAllListeners('SIGINT');
    await ssh.disconnectAll();
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
  const progress = (step: string) => options.onProgress?.(`  [${layer}] ${step}`);

  const hosts = deploy.hosts;
  const firstHost = hosts[0];
  const _codeDir = remoteCodeDir(firstHost, layer);

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

  // L1 layers need metagraph L0 peer info
  if (layer !== 'metagraph-l0' && options.ml0NodeId) {
    baseEnv.CL_L0_PEER_ID = options.ml0NodeId;
    baseEnv.CL_L0_PEER_HTTP_HOST = options.ml0Host ?? firstHost.host;
    baseEnv.CL_L0_PEER_HTTP_PORT = String(options.ml0Port ?? 9100);
    baseEnv.CL_L0_TOKEN_IDENTIFIER = metagraphId;
  }

  // JVM options — resolve per-layer overrides
  const jvmLayerKey = layer.replace('-', '_') as 'metagraph_l0' | 'currency_l1' | 'data_l1';
  const jvm = resolveJvmConfig(deploy.jvm, jvmLayerKey);
  const jvmOpts = [
    `-Xms${jvm.min_heap}`,
    `-Xmx${jvm.max_heap}`,
    `-XX:MetaspaceSize=${jvm.metaspace_size}`,
    `-XX:MaxMetaspaceSize=${jvm.max_metaspace_size}`,
    jvm.additional_opts,
  ]
    .filter(Boolean)
    .join(' ');

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
      startCmd = `nohup java ${jvmOpts} -jar ${layer}.jar run-genesis genesis.snapshot --ip ${firstHost.host} > ${layer}.log 2>&1 &`;
    } else {
      startCmd = `nohup java ${jvmOpts} -jar ${layer}.jar run-rollback --ip ${firstHost.host} > ${layer}.log 2>&1 &`;
    }
  } else {
    startCmd = `nohup java ${jvmOpts} -jar ${layer}.jar run-initial-validator --ip ${firstHost.host} > ${layer}.log 2>&1 &`;
  }

  progress(`Starting node-1 on ${firstHost.host}...`);
  await ssh.exec(firstHost, startCmd, {
    cwd: remoteCodeDir(firstHost, layer),
    env: node1Env,
  });

  // Wait for node-1 to be ready
  progress(`Waiting for node-1 to be ready...`);
  await waitForNodeReady(firstHost.host, ports.public, {
    maxRetries: 120,
    intervalMs: 2000,
    onRetry: (attempt) => {
      if (attempt % 15 === 0) {
        progress(`Still waiting for node-1 (attempt ${attempt})...`);
      }
    },
  });

  // Extract node-1 ID
  const nodeIdResult = await ssh.exec(firstHost, `java -jar cl-wallet.jar show-id`, {
    cwd: remoteCodeDir(firstHost, layer),
    env: node1Env,
  });
  const node1Id = nodeIdResult.stdout.trim();
  progress(`Node-1 ready (ID: ${node1Id.slice(0, 16)}...)`);

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

    const validatorCmd = `nohup java ${jvmOpts} -jar ${layer}.jar run-validator --ip ${host.host} > ${layer}.log 2>&1 &`;

    progress(`Starting node-${i + 1} on ${host.host}...`);
    await ssh.exec(host, validatorCmd, {
      cwd: remoteCodeDir(host, layer),
      env: nodeEnv,
    });

    // Wait for ReadyToJoin
    progress(`Waiting for node-${i + 1} to be ready to join...`);
    await waitForState(host.host, ports.public, 'ReadyToJoin', 120, 1000);

    // Join cluster via first node's CLI port
    progress(`Node-${i + 1} joining cluster...`);
    await joinCluster(host.host, ports.cli, firstHost.host, ports.p2p, node1Id);
  }

  return node1Id;
}

/**
 * Clean up existing processes and archive logs/data on all hosts.
 */
async function cleanupAllHosts(
  ssh: SSHManager,
  deploy: DeployConfig,
  config: EuclidConfig,
): Promise<void> {
  const remotePorts = deploy.remote_ports ?? {
    metagraph_l0: { public: 9100, p2p: 9101, cli: 9102 },
    currency_l1: { public: 9200, p2p: 9201, cli: 9202 },
    data_l1: { public: 9300, p2p: 9301, cli: 9302 },
  };

  const allPorts = [
    remotePorts.metagraph_l0.public,
    remotePorts.metagraph_l0.p2p,
    remotePorts.metagraph_l0.cli,
    remotePorts.currency_l1.public,
    remotePorts.currency_l1.p2p,
    remotePorts.currency_l1.cli,
    remotePorts.data_l1.public,
    remotePorts.data_l1.p2p,
    remotePorts.data_l1.cli,
  ];

  const layers = ['metagraph-l0'];
  if (config.layers.includes('currency-l1')) layers.push('currency-l1');
  if (config.layers.includes('data-l1')) layers.push('data-l1');

  for (const host of deploy.hosts) {
    // Kill processes by port
    for (const port of allPorts) {
      await ssh.exec(host, `fuser -k ${port}/tcp 2>/dev/null || true`);
    }

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
 * Wait for a remote node to reach a specific state.
 */
async function waitForState(
  host: string,
  port: number,
  targetState: string,
  maxRetries: number,
  intervalMs: number,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo(host, port);
    if (info?.state === targetState) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Node at ${host}:${port} did not reach ${targetState} after ${maxRetries} attempts`,
  );
}

/**
 * Join a validator node to the cluster via the genesis node's CLI endpoint.
 */
async function joinCluster(
  validatorHost: string,
  validatorCliPort: number,
  genesisHost: string,
  genesisP2pPort: number,
  genesisId: string,
): Promise<void> {
  const url = `http://${validatorHost}:${validatorCliPort}/cluster/join`;
  const body = JSON.stringify({
    id: genesisId,
    ip: genesisHost,
    p2pPort: genesisP2pPort,
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok || response.status === 404) return;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 10000));
  }

  throw new Error(`Failed to join cluster at ${url}`);
}

function remoteCodeDir(host: RemoteHostConfig, layer: string): string {
  return `/home/${host.user}/code/${layer}`;
}
