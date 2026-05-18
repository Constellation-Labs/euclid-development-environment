import { LayerStartError } from '../../shared/errors.js';
import type { LayerContext } from './helpers.js';
import {
  LAYER_DIRS,
  LAYER_JARS,
  nodeIp,
  nodePorts,
  baseEnv,
  customEnv,
  globalL0PeerEnv,
  metagraphL0PeerEnv,
  copyP12,
  startJavaProcess,
  waitForReady,
  joinCluster,
} from './helpers.js';

/**
 * Shared startup logic for Currency L1 and Data L1 layers.
 * Both follow the same pattern: initial validator + N validators joining.
 */
export async function startL1Layer(
  ctx: LayerContext,
  layer: 'currency-l1' | 'data-l1',
): Promise<void> {
  const { docker, config, projectRoot } = ctx;
  const leadNode = config.nodes[0];
  const leadIp = nodeIp(config, 0);
  const leadPorts = nodePorts(config, layer, 0);
  const layerDir = LAYER_DIRS[layer];
  const jar = LAYER_JARS[layer];

  if (!ctx.metagraphId) {
    throw new LayerStartError(
      `Cannot start ${layer} — metagraph ID not available. Start metagraph-l0 first.`,
    );
  }

  // ── Initial validator ──────────────────────────────────────────────
  ctx.onProgress?.('Copying keystore...');
  await copyP12(docker, projectRoot, leadNode, leadNode.name, layerDir);

  const env = {
    ...baseEnv(leadNode, leadPorts),
    ...globalL0PeerEnv(config, ctx.leadNodeId),
    ...metagraphL0PeerEnv(config, ctx.leadNodeId),
    ...customEnv(config),
    CL_L0_TOKEN_IDENTIFIER: ctx.metagraphId,
  };

  ctx.onProgress?.(`Starting ${layer} initial validator...`);
  await startJavaProcess(
    docker,
    leadNode.name,
    layerDir,
    jar,
    `run-initial-validator --ip ${leadIp}`,
    env,
    `${layerDir}.log`,
  );

  const logFile = `${layerDir}.log`;

  ctx.onProgress?.(`Waiting for ${layer} lead node...`);
  await waitForReady(
    docker,
    leadNode.name,
    layerDir,
    logFile,
    leadPorts.public,
    'Ready',
    ctx.onProgress,
  );

  // ── Validators ─────────────────────────────────────────────────────
  for (let i = 1; i < config.nodes.length; i++) {
    const valNode = config.nodes[i];
    const valIp = nodeIp(config, i);
    const valPorts = nodePorts(config, layer, i);

    ctx.onProgress?.(`Starting validator ${valNode.name}...`);
    await copyP12(docker, projectRoot, valNode, valNode.name, layerDir);

    const valEnv = {
      ...baseEnv(valNode, valPorts),
      ...globalL0PeerEnv(config, ctx.leadNodeId),
      ...metagraphL0PeerEnv(config, ctx.leadNodeId),
      ...customEnv(config),
      CL_L0_TOKEN_IDENTIFIER: ctx.metagraphId,
    };

    await startJavaProcess(
      docker,
      valNode.name,
      layerDir,
      jar,
      `run-validator --ip ${valIp}`,
      valEnv,
      logFile,
    );

    ctx.onProgress?.(`Waiting for ${valNode.name} to be ready to join...`);
    await waitForReady(
      docker,
      valNode.name,
      layerDir,
      logFile,
      valPorts.public,
      'ReadyToJoin',
      ctx.onProgress,
    );

    ctx.onProgress?.(`Joining ${valNode.name} to cluster...`);
    await joinCluster(docker, valNode.name, valPorts.cli, ctx.leadNodeId, leadIp, leadPorts.p2p);
  }
}
