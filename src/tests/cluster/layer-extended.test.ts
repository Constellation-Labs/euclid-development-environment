import { describe, it, expect } from 'vitest';
import {
  layerToPortKey,
  LAYER_DISPLAY_NAMES,
  LAYER_START_ORDER,
  LAYER_STOP_ORDER,
} from '../../main/cluster/layer.js';

// ─── layerToPortKey ─────────────────────────────────────────────────────────

describe('layerToPortKey', () => {
  it('converts global-l0 to global_l0', () => {
    expect(layerToPortKey('global-l0')).toBe('global_l0');
  });

  it('converts dag-l1 to dag_l1', () => {
    expect(layerToPortKey('dag-l1')).toBe('dag_l1');
  });

  it('converts metagraph-l0 to metagraph_l0', () => {
    expect(layerToPortKey('metagraph-l0')).toBe('metagraph_l0');
  });

  it('converts currency-l1 to currency_l1', () => {
    expect(layerToPortKey('currency-l1')).toBe('currency_l1');
  });

  it('converts data-l1 to data_l1', () => {
    expect(layerToPortKey('data-l1')).toBe('data_l1');
  });
});

// ─── LAYER_DISPLAY_NAMES ────────────────────────────────────────────────────

describe('LAYER_DISPLAY_NAMES', () => {
  it('has an entry for each layer type', () => {
    expect(LAYER_DISPLAY_NAMES['global-l0']).toBe('Global L0');
    expect(LAYER_DISPLAY_NAMES['dag-l1']).toBe('DAG L1');
    expect(LAYER_DISPLAY_NAMES['metagraph-l0']).toBe('Metagraph L0');
    expect(LAYER_DISPLAY_NAMES['currency-l1']).toBe('Currency L1');
    expect(LAYER_DISPLAY_NAMES['data-l1']).toBe('Data L1');
  });

  it('has exactly 5 entries', () => {
    expect(Object.keys(LAYER_DISPLAY_NAMES)).toHaveLength(5);
  });
});

// ─── LAYER_START_ORDER ──────────────────────────────────────────────────────

describe('LAYER_START_ORDER', () => {
  it('has 5 layers', () => {
    expect(LAYER_START_ORDER).toHaveLength(5);
  });

  it('starts with global-l0', () => {
    expect(LAYER_START_ORDER[0]).toBe('global-l0');
  });

  it('has dag-l1 before metagraph layers', () => {
    const dagIndex = LAYER_START_ORDER.indexOf('dag-l1');
    const metaIndex = LAYER_START_ORDER.indexOf('metagraph-l0');
    expect(dagIndex).toBeLessThan(metaIndex);
  });

  it('has metagraph-l0 before l1 layers', () => {
    const metaIndex = LAYER_START_ORDER.indexOf('metagraph-l0');
    const currencyIndex = LAYER_START_ORDER.indexOf('currency-l1');
    const dataIndex = LAYER_START_ORDER.indexOf('data-l1');
    expect(metaIndex).toBeLessThan(currencyIndex);
    expect(metaIndex).toBeLessThan(dataIndex);
  });

  it('contains all 5 layer types', () => {
    expect(LAYER_START_ORDER).toContain('global-l0');
    expect(LAYER_START_ORDER).toContain('dag-l1');
    expect(LAYER_START_ORDER).toContain('metagraph-l0');
    expect(LAYER_START_ORDER).toContain('currency-l1');
    expect(LAYER_START_ORDER).toContain('data-l1');
  });
});

// ─── LAYER_STOP_ORDER ───────────────────────────────────────────────────────

describe('LAYER_STOP_ORDER', () => {
  it('is the reverse of LAYER_START_ORDER', () => {
    const reversed = [...LAYER_START_ORDER].reverse();
    expect(LAYER_STOP_ORDER).toEqual(reversed);
  });

  it('starts with data-l1 (last to start = first to stop)', () => {
    expect(LAYER_STOP_ORDER[0]).toBe('data-l1');
  });

  it('ends with global-l0 (first to start = last to stop)', () => {
    expect(LAYER_STOP_ORDER[LAYER_STOP_ORDER.length - 1]).toBe('global-l0');
  });
});
