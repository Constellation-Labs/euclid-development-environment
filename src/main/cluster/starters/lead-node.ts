import { LayerStartError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import type { LayerContext } from './helpers.js';
import { copyP12, dockerExec } from './helpers.js';

/**
 * Get the lead node's peer ID by reading it from cl-wallet.jar show-id.
 */
export async function getLeadNodeId(ctx: LayerContext): Promise<string> {
  const node = ctx.config.nodes[0];

  // Copy p12 keystore into the container so cl-wallet.jar can read it
  await copyP12(ctx.docker, ctx.projectRoot, node, node.name, 'global-l0');

  const result = await dockerExec(
    ctx.docker,
    node.name,
    ['bash', '-c', 'cd global-l0 && java -jar cl-wallet.jar show-id'],
    {
      CL_KEYSTORE: node.key_file.name,
      CL_KEYALIAS: node.key_file.alias,
      CL_PASSWORD: node.key_file.password,
    },
  );

  const id = result.trim();
  if (!id || id.length < 10) {
    throw new LayerStartError(`Failed to extract lead node ID, got: "${id}"`);
  }
  logger.debug(`Lead node ID: ${id.slice(0, 16)}...`);
  return id;
}
