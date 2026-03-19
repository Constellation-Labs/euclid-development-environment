import type { LayerContext } from './helpers.js';
import { startL1Layer } from './l1-shared.js';

/**
 * Start the Currency L1 layer.
 */
export async function startCurrencyL1(ctx: LayerContext): Promise<void> {
  await startL1Layer(ctx, 'currency-l1');
}
