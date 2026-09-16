import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { LayerStartError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { combineSignedMessages } from '../fees.js';
import type { SignedMessage } from '../fees.js';
import type { LayerContext } from './helpers.js';
import {
  LAYER_DIRS,
  LAYER_JARS,
  nodeIp,
  nodePorts,
  baseEnv,
  globalL0PeerEnv,
  copyP12,
  cleanLayerDirs,
  ensureGenesisCsv,
  dockerExec,
  startJavaProcess,
  waitForReady,
  joinCluster,
} from './helpers.js';

/**
 * Get the owner wallet address.
 * If `snapshot_fees.owner` is configured, uses that keystore.
 * Otherwise, uses node 0's keystore.
 */
export async function getOwnerAddress(ctx: LayerContext, layerDir: string): Promise<string> {
  const { docker, config, projectRoot } = ctx;
  const leadNode = config.nodes[0];

  if (config.snapshot_fees?.owner) {
    const ownerKey = config.snapshot_fees.owner.key_file;
    const ownerP12Path = resolve(projectRoot, 'data', 'p12-files', ownerKey.name);
    if (existsSync(ownerP12Path)) {
      await docker.copyToContainer(
        leadNode.name,
        ownerP12Path,
        `code/${layerDir}/${ownerKey.name}`,
      );
    }

    const result = await dockerExec(
      docker,
      leadNode.name,
      ['bash', '-c', `cd "${layerDir}" && java -jar cl-wallet.jar show-address`],
      {
        CL_KEYSTORE: ownerKey.name,
        CL_KEYALIAS: ownerKey.alias,
        CL_PASSWORD: ownerKey.password,
      },
    );
    return result.trim();
  }

  // Default: use node 0's address as owner
  const result = await dockerExec(
    docker,
    leadNode.name,
    ['bash', '-c', `cd "${layerDir}" && java -jar cl-wallet.jar show-address`],
    {
      CL_KEYSTORE: leadNode.key_file.name,
      CL_KEYALIAS: leadNode.key_file.alias,
      CL_PASSWORD: leadNode.key_file.password,
    },
  );
  return result.trim();
}

/**
 * Create a signing message signed by ALL nodes in the cluster.
 * Each node signs the same content with their own keystore.
 * Returns a combined message with all proofs concatenated.
 */
export async function createMultiNodeSignedMessage(
  ctx: LayerContext,
  layerDir: string,
  commandType: 'create-owner-signing-message' | 'create-staking-signing-message',
  address: string,
  metagraphId: string,
  parentOrdinal: number,
): Promise<SignedMessage> {
  const { docker, config, projectRoot } = ctx;
  const signedOutputs: string[] = [];

  for (let i = 0; i < config.nodes.length; i++) {
    const node = config.nodes[i];
    ctx.onProgress?.(`Signing with ${node.name} (${i + 1}/${config.nodes.length})...`);

    await copyP12(docker, projectRoot, node, node.name, layerDir);

    const output = await dockerExec(
      docker,
      node.name,
      [
        'bash',
        '-c',
        `cd "${layerDir}" && java -jar cl-wallet.jar ${commandType} ` +
          `--address "${address}" ` +
          `--metagraphId "${metagraphId}" ` +
          `--parentOrdinal ${parentOrdinal}`,
      ],
      {
        CL_KEYSTORE: node.key_file.name,
        CL_KEYALIAS: node.key_file.alias,
        CL_PASSWORD: node.key_file.password,
      },
    );

    logger.debug(
      `Signing output from ${node.name} (${output.length} chars): ${output.slice(0, 120)}...`,
    );

    const trimmed = output.trim();
    if (!trimmed.startsWith('{')) {
      // Check if the tool wrote to a file instead of stdout
      const fileCheck = await docker.exec(node.name, [
        'bash',
        '-c',
        `cd "${layerDir}" && for f in owner_message.txt signed_message.json owner-message; do ` +
          `  if [ -f "$f" ]; then cat "$f"; exit 0; fi; ` +
          `done; echo ""`,
      ]);
      const fileContent = fileCheck.stdout.trim();
      if (fileContent.startsWith('{')) {
        logger.debug(`Found signed message in file instead of stdout`);
        signedOutputs.push(fileContent);
        continue;
      }

      throw new LayerStartError(
        `cl-wallet.jar ${commandType} did not output valid JSON.\n` +
          `     Output (first 200 chars): ${trimmed.slice(0, 200)}\n` +
          `     This may indicate a Tessellation version mismatch.`,
      );
    }

    signedOutputs.push(output);
  }

  return combineSignedMessages(signedOutputs);
}

/**
 * Start the Metagraph L0 layer (genesis or rollback), including all validators.
 */
export async function startMetagraphL0(ctx: LayerContext): Promise<void> {
  const { docker, config, projectRoot, mode } = ctx;
  const leadNode = config.nodes[0];
  const leadIp = nodeIp(config, 0);
  const leadPorts = nodePorts(config, 'metagraph-l0', 0);
  const layerDir = LAYER_DIRS['metagraph-l0'];
  const jar = LAYER_JARS['metagraph-l0'];
  const dockerPath = resolve(projectRoot, 'docker');

  // ── Genesis / Initial node ─────────────────────────────────────────
  ctx.onProgress?.('Copying keystore...');
  await copyP12(docker, projectRoot, leadNode, leadNode.name, layerDir);

  const envBase = {
    ...baseEnv(leadNode, leadPorts),
    ...globalL0PeerEnv(config, ctx.leadNodeId),
  };

  if (mode === 'genesis') {
    ctx.onProgress?.('Cleaning previous data...');
    await cleanLayerDirs(docker, leadNode.name, layerDir);

    // Ensure genesis.csv exists in the container (may be missing from stale image)
    await ensureGenesisCsv(docker, leadNode.name, layerDir, projectRoot);

    // Create genesis files
    ctx.onProgress?.('Creating genesis files...');
    const genesisOutput = await dockerExec(
      docker,
      leadNode.name,
      ['bash', '-c', `cd "${layerDir}" && java -jar "${jar}" create-genesis genesis.csv`],
      envBase,
    );
    if (genesisOutput.trim()) {
      logger.debug(`create-genesis output: ${genesisOutput.trim().slice(0, 200)}`);
    }

    // Verify genesis files were created
    const genesisCheck = await dockerExec(docker, leadNode.name, [
      'bash',
      '-c',
      `ls -la "${layerDir}/genesis.address" "${layerDir}/genesis.snapshot" 2>&1`,
    ]);
    logger.debug(`Genesis files: ${genesisCheck.trim()}`);

    if (!genesisCheck.includes('genesis.snapshot') || !genesisCheck.includes('genesis.address')) {
      throw new LayerStartError(
        `create-genesis did not produce expected files.\n` +
          `     Expected: genesis.address, genesis.snapshot in ${layerDir}/\n` +
          `     Found: ${genesisCheck.trim()}`,
      );
    }

    // Persist genesis artifacts to shared volume (for rollback)
    ctx.onProgress?.('Persisting genesis artifacts...');
    await dockerExec(docker, leadNode.name, [
      'bash',
      '-c',
      `cp "${layerDir}/genesis.address" shared_genesis/genesis.address && ` +
        `cp "${layerDir}/genesis.snapshot" shared_genesis/genesis.snapshot`,
    ]);

    // Read metagraph ID for later use
    const metagraphIdOutput = await dockerExec(docker, leadNode.name, [
      'bash',
      '-c',
      `tr -d '\\r\\n' < "${layerDir}/genesis.address"`,
    ]);
    ctx.metagraphId = metagraphIdOutput.trim();
    logger.debug(`Metagraph ID: ${ctx.metagraphId}`);

    if (!ctx.metagraphId || ctx.metagraphId.length < 10) {
      throw new LayerStartError(
        `Invalid metagraph ID from genesis.address: "${ctx.metagraphId}"\n` +
          `     The file may be empty or corrupted.`,
      );
    }

    // Also write genesis.address to host for persistence
    try {
      const { execSync } = await import('node:child_process');
      execSync(`mkdir -p "${resolve(dockerPath, 'artifacts', 'genesis')}"`, { stdio: 'pipe' });
    } catch (err) {
      // Non-critical — shared volume should already have it
      logger.debug('Failed to create genesis artifacts dir on host (non-critical)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Start genesis (owner message is submitted via API after node is ready)
    ctx.onProgress?.('Starting Metagraph L0 genesis...');
    await startJavaProcess(
      docker,
      leadNode.name,
      layerDir,
      jar,
      `run-genesis genesis.snapshot --ip ${leadIp}`,
      envBase,
      'metagraph-l0.log',
    );
  } else {
    // Rollback mode
    ctx.onProgress?.('Reading metagraph ID...');
    const genesisAddressPath = resolve(dockerPath, 'artifacts', 'genesis', 'genesis.address');
    try {
      ctx.metagraphId = (await readFile(genesisAddressPath, 'utf-8')).trim();
    } catch {
      // File doesn't exist on host — try reading from container
      const result = await dockerExec(docker, leadNode.name, [
        'bash',
        '-c',
        `tr -d '\\r\\n' < shared_genesis/genesis.address`,
      ]);
      ctx.metagraphId = result.trim();
    }

    if (!ctx.metagraphId) {
      throw new LayerStartError(
        'Cannot rollback Metagraph L0 — no genesis.address found. Run with --genesis first.',
      );
    }

    const rollbackEnv = {
      ...envBase,
      CL_L0_TOKEN_IDENTIFIER: ctx.metagraphId,
    };

    ctx.onProgress?.('Starting Metagraph L0 rollback...');
    await startJavaProcess(
      docker,
      leadNode.name,
      layerDir,
      jar,
      `run-rollback --ip ${leadIp}`,
      rollbackEnv,
      'metagraph-l0.log',
    );
  }

  ctx.onProgress?.('Waiting for Metagraph L0 lead node...');
  await waitForReady(
    docker,
    leadNode.name,
    layerDir,
    'metagraph-l0.log',
    leadPorts.public,
    'Ready',
    ctx.onProgress,
  );

  // ── Submit owner message via API (if snapshot_fees configured) ─────
  if (mode === 'genesis' && config.snapshot_fees?.owner) {
    ctx.onProgress?.('Submitting owner signing message...');

    const ownerAddress = await getOwnerAddress(ctx, layerDir);
    logger.debug(`Owner address: ${ownerAddress}`);

    if (!ctx.metagraphId) {
      throw new LayerStartError(
        'Cannot submit owner message — metagraph ID is not set. This is a bug.',
      );
    }

    const ownerMessage = await createMultiNodeSignedMessage(
      ctx,
      layerDir,
      'create-owner-signing-message',
      ownerAddress,
      ctx.metagraphId,
      0,
    );
    logger.debug(`Owner message created with ${ownerMessage.proofs.length} proof(s)`);

    // Submit via HTTP API to the running metagraph L0
    const messageUrl = `http://localhost:${leadPorts.public}/currency/message`;
    const response = await fetch(messageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ownerMessage),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.debug(`Owner message response: ${response.status} ${body.slice(0, 300)}`);
      logger.warn(
        `Owner message submission returned HTTP ${response.status}. You can set the owner later with: hydra update-owner`,
      );
    } else {
      logger.debug('Owner signing message submitted successfully');
    }
  }

  // ── Validators ─────────────────────────────────────────────────────
  for (let i = 1; i < config.nodes.length; i++) {
    const valNode = config.nodes[i];
    const valIp = nodeIp(config, i);
    const valPorts = nodePorts(config, 'metagraph-l0', i);
    const leadP2pPort = leadPorts.p2p;

    ctx.onProgress?.(`Starting validator ${valNode.name}...`);

    await copyP12(docker, projectRoot, valNode, valNode.name, layerDir);

    if (!ctx.metagraphId) {
      throw new LayerStartError(
        `Cannot start validator ${valNode.name} — metagraph ID is not set. Run genesis first.`,
      );
    }

    const valEnv = {
      ...baseEnv(valNode, valPorts),
      ...globalL0PeerEnv(config, ctx.leadNodeId),
      CL_L0_TOKEN_IDENTIFIER: ctx.metagraphId,
    };

    await startJavaProcess(
      docker,
      valNode.name,
      layerDir,
      jar,
      `run-validator --ip ${valIp}`,
      valEnv,
      'metagraph-l0.log',
    );

    ctx.onProgress?.(`Waiting for ${valNode.name} to be ready to join...`);
    await waitForReady(
      docker,
      valNode.name,
      layerDir,
      'metagraph-l0.log',
      valPorts.public,
      'ReadyToJoin',
      ctx.onProgress,
    );

    ctx.onProgress?.(`Joining ${valNode.name} to cluster...`);
    await joinCluster(docker, valNode.name, valPorts.cli, ctx.leadNodeId, leadIp, leadP2pPort);
  }
}
