import { describe, it, expect } from 'vitest';
import { hashConfig } from '../../main/cluster/state.js';

describe('hashConfig', () => {
  it('returns a 16-character hex string', () => {
    const hash = hashConfig({ project_name: 'test' });
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns same hash for same input', () => {
    const config = { a: 1, b: 'hello', c: [1, 2, 3] };
    const hash1 = hashConfig(config);
    const hash2 = hashConfig(config);
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different input', () => {
    const hash1 = hashConfig({ a: 1 });
    const hash2 = hashConfig({ a: 2 });
    expect(hash1).not.toBe(hash2);
  });

  it('is sensitive to key names', () => {
    const hash1 = hashConfig({ foo: 'bar' });
    const hash2 = hashConfig({ baz: 'bar' });
    expect(hash1).not.toBe(hash2);
  });

  it('is sensitive to value types', () => {
    const hash1 = hashConfig({ count: 1 });
    const hash2 = hashConfig({ count: '1' });
    expect(hash1).not.toBe(hash2);
  });

  it('handles nested objects consistently', () => {
    const config = {
      project_name: 'test',
      framework: { name: 'currency', version: 'v3.6.0' },
      nodes: [{ name: 'node-1' }],
    };
    const hash1 = hashConfig(config);
    const hash2 = hashConfig(config);
    expect(hash1).toBe(hash2);
  });

  it('handles empty object', () => {
    const hash = hashConfig({});
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles null and undefined values', () => {
    const hash1 = hashConfig({ a: null });
    const hash2 = hashConfig({ a: undefined });
    // null and undefined serialize differently in JSON
    expect(hash1).not.toBe(hash2);
  });

  it('handles arrays', () => {
    const hash1 = hashConfig([1, 2, 3]);
    const hash2 = hashConfig([3, 2, 1]);
    expect(hash1).not.toBe(hash2);
  });

  it('handles strings', () => {
    const hash = hashConfig('just a string');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces deterministic output for realistic config', () => {
    const config = {
      config_version: 2,
      project_name: 'custom-project',
      tessellation_version: '4.0.0-rc.0',
      framework: { name: 'currency', modules: ['data'], version: 'v3.6.0' },
      layers: ['global-l0', 'metagraph-l0', 'currency-l1', 'data-l1'],
      nodes: [{ name: 'node-1', key_file: { name: 'key.p12', alias: 'key', password: 'pass' } }],
    };
    const hash1 = hashConfig(config);
    const hash2 = hashConfig(JSON.parse(JSON.stringify(config)));
    expect(hash1).toBe(hash2);
  });
});
