import type { LayerContext } from './helpers.js';
import {
  LAYER_DIRS,
  LAYER_JARS,
  nodeIp,
  nodePorts,
  baseEnv,
  copyP12,
  startJavaProcess,
  waitForReady,
  joinCluster,
} from './helpers.js';

/**
 * Start the DAG L1 layer with initial validator and all validators.
 */
export async function startDagL1(ctx: LayerContext): Promise<void> {
  const { docker, config, projectRoot } = ctx;
  const leadNode = config.nodes[0];
  const leadIp = nodeIp(config, 0);
  const leadPorts = nodePorts(config, 'dag-l1', 0);
  const layerDir = LAYER_DIRS['dag-l1'];
  const jar = LAYER_JARS['dag-l1'];

  // ── Initial validator ──────────────────────────────────────────────
  ctx.onProgress?.('Copying keystore...');
  await copyP12(docker, projectRoot, leadNode, leadNode.name, layerDir);

  const env = {
    ...baseEnv(leadNode, leadPorts),
    // DAG L1 peers with global-l0 only (no metagraph-l0)
    CL_L0_PEER_HTTP_HOST: leadIp,
    CL_L0_PEER_HTTP_PORT: String(config.ports.global_l0.public),
    CL_L0_PEER_ID: ctx.leadNodeId,
  };

  ctx.onProgress?.('Starting DAG L1 initial validator...');
  await startJavaProcess(
    docker,
    leadNode.name,
    layerDir,
    jar,
    `run-initial-validator --ip ${leadIp}`,
    env,
    'dag-l1.log',
  );

  ctx.onProgress?.('Waiting for DAG L1 lead node...');
  await waitForReady(
    docker,
    leadNode.name,
    layerDir,
    'dag-l1.log',
    leadPorts.public,
    'Ready',
    ctx.onProgress,
  );

  // ── Validators ─────────────────────────────────────────────────────
  for (let i = 1; i < config.nodes.length; i++) {
    const valNode = config.nodes[i];
    const valIp = nodeIp(config, i);
    const valPorts = nodePorts(config, 'dag-l1', i);

    ctx.onProgress?.(`Starting validator ${valNode.name}...`);
    await copyP12(docker, projectRoot, valNode, valNode.name, layerDir);

    const valEnv = {
      ...baseEnv(valNode, valPorts),
      CL_L0_PEER_HTTP_HOST: leadIp,
      CL_L0_PEER_HTTP_PORT: String(config.ports.global_l0.public),
      CL_L0_PEER_ID: ctx.leadNodeId,
    };

    await startJavaProcess(
      docker,
      valNode.name,
      layerDir,
      jar,
      `run-validator --ip ${valIp}`,
      valEnv,
      'dag-l1.log',
    );

    ctx.onProgress?.(`Waiting for ${valNode.name} to be ready to join...`);
    await waitForReady(
      docker,
      valNode.name,
      layerDir,
      'dag-l1.log',
      valPorts.public,
      'ReadyToJoin',
      ctx.onProgress,
    );

    ctx.onProgress?.(`Joining ${valNode.name} to cluster...`);
    await joinCluster(docker, valNode.name, valPorts.cli, ctx.leadNodeId, leadIp, leadPorts.p2p);
  }
}
