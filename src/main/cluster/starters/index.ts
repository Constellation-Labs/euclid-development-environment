import type { LayerType } from '../../config/schema.js';
import type { LayerContext } from './helpers.js';
import { startGlobalL0 } from './global-l0.js';
import { startDagL1 } from './dag-l1.js';
import { startMetagraphL0 } from './metagraph-l0.js';
import { startCurrencyL1 } from './currency-l1.js';
import { startDataL1 } from './data-l1.js';

// ─── Dispatch Map ───────────────────────────────────────────────────────────

export const LAYER_STARTERS: Record<LayerType, (ctx: LayerContext) => Promise<void>> = {
  'global-l0': startGlobalL0,
  'dag-l1': startDagL1,
  'metagraph-l0': startMetagraphL0,
  'currency-l1': startCurrencyL1,
  'data-l1': startDataL1,
};

// Re-export everything consumers need
export type { LayerContext } from './helpers.js';
export { LAYER_PORT_KEYS } from './helpers.js';
export { getLeadNodeId } from './lead-node.js';
export { startGlobalL0 } from './global-l0.js';
export { startMetagraphL0, createMultiNodeSignedMessage } from './metagraph-l0.js';
export { startDagL1 } from './dag-l1.js';
export { startCurrencyL1 } from './currency-l1.js';
export { startDataL1 } from './data-l1.js';
