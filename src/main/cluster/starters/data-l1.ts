import type { LayerContext } from './helpers.js';
import { startL1Layer } from './l1-shared.js';

/**
 * Start the Data L1 layer.
 */
export async function startDataL1(ctx: LayerContext): Promise<void> {
  await startL1Layer(ctx, 'data-l1');
}
