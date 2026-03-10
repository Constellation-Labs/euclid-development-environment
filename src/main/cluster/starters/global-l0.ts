import { LayerStartError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import type { LayerContext } from './helpers.js';
import {
  LAYER_DIRS,
  LAYER_JARS,
  nodeIp,
  nodePorts,
  baseEnv,
  copyP12,
  cleanLayerDirs,
  ensureGenesisCsv,
  startJavaProcess,
  waitForReady,
  findLatestSnapshot,
} from './helpers.js';

/**
 * Start the Global L0 layer (genesis or rollback).
 */
export async function startGlobalL0(ctx: LayerContext): Promise<void> {
  const { docker, config, projectRoot, mode } = ctx;
  const node = config.nodes[0];
  const ip = nodeIp(config, 0);
  const ports = nodePorts(config, 'global-l0', 0);
  const layerDir = LAYER_DIRS['global-l0'];
  const jar = LAYER_JARS['global-l0'];
  const env = baseEnv(node, ports);

  ctx.onProgress?.('Copying keystore...');
  await copyP12(docker, projectRoot, node, node.name, layerDir);

  if (mode === 'genesis') {
    ctx.onProgress?.('Cleaning previous data...');
    await cleanLayerDirs(docker, node.name, layerDir);

    // Ensure genesis.csv exists in the container (may be missing from stale image)
    await ensureGenesisCsv(docker, node.name, layerDir, projectRoot);

    ctx.onProgress?.('Starting Global L0 genesis...');
    await startJavaProcess(
      docker,
      node.name,
      layerDir,
      jar,
      `run-genesis genesis.csv --ip ${ip}`,
      env,
      'global-l0.log',
    );
  } else {
    // Rollback: find the latest snapshot hash from the container's data directory
    ctx.onProgress?.('Looking for latest snapshot...');
    const rollbackHash = await findLatestSnapshot(docker, node.name, layerDir);

    if (!rollbackHash) {
      throw new LayerStartError('No snapshot data found for Global L0 — cannot rollback.', {
        suggestion: "Run 'hydra start --genesis' first to create initial state.",
      });
    }

    logger.debug(`Rollback from snapshot: ${rollbackHash}`);
    ctx.onProgress?.('Starting Global L0 rollback...');
    await startJavaProcess(
      docker,
      node.name,
      layerDir,
      jar,
      `run-rollback --ip ${ip} ${rollbackHash}`,
      env,
      'global-l0.log',
    );
  }

  ctx.onProgress?.('Waiting for Global L0...');
  await waitForReady(
    docker,
    node.name,
    layerDir,
    'global-l0.log',
    ports.public,
    'Ready',
    ctx.onProgress,
  );
}
