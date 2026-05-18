import { describe, it, expect } from 'vitest';
import {
  EuclidConfigSchema,
  KeyFileSchema,
  NodeSchema,
  LayerTypeSchema,
  isLegacyConfig,
} from '../../main/config/schema.js';

describe('KeyFileSchema', () => {
  it('accepts valid key file config', () => {
    const result = KeyFileSchema.safeParse({
      name: 'token-key.p12',
      alias: 'token-key',
      password: 'password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = KeyFileSchema.safeParse({
      name: '',
      alias: 'token-key',
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = KeyFileSchema.safeParse({ name: 'test.p12' });
    expect(result.success).toBe(false);
  });
});

describe('NodeSchema', () => {
  it('accepts valid node config', () => {
    const result = NodeSchema.safeParse({
      name: 'metagraph-node-1',
      key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects uppercase node names', () => {
    const result = NodeSchema.safeParse({
      name: 'MyNode',
      key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects node names starting with hyphen', () => {
    const result = NodeSchema.safeParse({
      name: '-node',
      key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
    });
    expect(result.success).toBe(false);
  });
});

describe('LayerTypeSchema', () => {
  it('accepts all valid layer types', () => {
    const validLayers = ['global-l0', 'dag-l1', 'metagraph-l0', 'currency-l1', 'data-l1'];
    for (const layer of validLayers) {
      expect(LayerTypeSchema.safeParse(layer).success).toBe(true);
    }
  });

  it('rejects invalid layer types', () => {
    expect(LayerTypeSchema.safeParse('invalid-layer').success).toBe(false);
    expect(LayerTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('EuclidConfigSchema', () => {
  const validConfig = {
    config_version: 2 as const,
    project_name: 'my-metagraph',
    tessellation_version: '4.0.0-rc.0',
    tessellation_ref_type: 'tag' as const,
    framework: {
      name: 'currency' as const,
      modules: ['data' as const],
      version: 'v3.6.0',
      ref_type: 'tag' as const,
    },
    layers: ['global-l0' as const, 'metagraph-l0' as const, 'currency-l1' as const],
    nodes: [
      {
        name: 'node-1',
        key_file: { name: 'token-key.p12', alias: 'token-key', password: 'password' },
      },
      {
        name: 'node-2',
        key_file: { name: 'token-key-1.p12', alias: 'token-key-1', password: 'password' },
      },
      {
        name: 'node-3',
        key_file: { name: 'token-key-2.p12', alias: 'token-key-2', password: 'password' },
      },
    ],
  };

  it('accepts a valid complete config', () => {
    const result = EuclidConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config_version).toBe(2);
      expect(result.data.project_name).toBe('my-metagraph');
      expect(result.data.nodes).toHaveLength(3);
    }
  });

  it('applies defaults for optional fields', () => {
    const result = EuclidConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.docker.start_grafana_container).toBe(false);
      expect(result.data.docker.ip_offset).toBe(10);
      expect(result.data.ports.global_l0.public).toBe(9000);
      expect(result.data.ports.metagraph_l0.public).toBe(9200);
    }
  });

  it('rejects empty layers', () => {
    const result = EuclidConfigSchema.safeParse({ ...validConfig, layers: [] });
    expect(result.success).toBe(false);
  });

  it('rejects empty nodes', () => {
    const result = EuclidConfigSchema.safeParse({ ...validConfig, nodes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 nodes', () => {
    const tooManyNodes = Array.from({ length: 11 }, (_, i) => ({
      name: `node-${i}`,
      key_file: { name: `key-${i}.p12`, alias: `key-${i}`, password: 'pass' },
    }));
    const result = EuclidConfigSchema.safeParse({ ...validConfig, nodes: tooManyNodes });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tessellation_ref_type', () => {
    const result = EuclidConfigSchema.safeParse({
      ...validConfig,
      tessellation_ref_type: 'commit',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional deploy section', () => {
    const withDeploy = {
      ...validConfig,
      deploy: {
        network: {
          name: 'integrationnet',
          gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
        },
        jvm: {},
      },
    };
    const result = EuclidConfigSchema.safeParse(withDeploy);
    expect(result.success).toBe(true);
  });

  it('accepts optional snapshot_fees', () => {
    const withFees = {
      ...validConfig,
      snapshot_fees: {
        owner: { key_file: { name: 'owner.p12', alias: 'owner', password: 'pass' } },
        staking: { key_file: { name: 'staking.p12', alias: 'staking', password: 'pass' } },
      },
    };
    const result = EuclidConfigSchema.safeParse(withFees);
    expect(result.success).toBe(true);
  });

  it('accepts env_vars as a flat string→string map', () => {
    const withEnv = {
      ...validConfig,
      env_vars: {
        CL_LOG_LEVEL: 'INFO',
        CL_COLLATERAL: '250000',
      },
    };
    const result = EuclidConfigSchema.safeParse(withEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env_vars?.CL_LOG_LEVEL).toBe('INFO');
      expect(result.data.env_vars?.CL_COLLATERAL).toBe('250000');
    }
  });

  it('rejects env_vars with non-string values', () => {
    const result = EuclidConfigSchema.safeParse({
      ...validConfig,
      env_vars: { CL_COLLATERAL: 250000 },
    });
    expect(result.success).toBe(false);
  });

  it('treats omitted env_vars as undefined', () => {
    const result = EuclidConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env_vars).toBeUndefined();
    }
  });
});

describe('isLegacyConfig', () => {
  it('detects v1 config with "version" field', () => {
    const v1 = {
      version: '0.19.0',
      tessellation_version: '4.0.0-rc.0',
      project_name: 'test',
    };
    expect(isLegacyConfig(v1)).toBe(true);
  });

  it('does not flag v2 config', () => {
    const v2 = {
      config_version: 2,
      tessellation_version: '4.0.0-rc.0',
      project_name: 'test',
    };
    expect(isLegacyConfig(v2)).toBe(false);
  });

  it('does not flag config with both version and config_version', () => {
    const mixed = {
      version: '0.19.0',
      config_version: 2,
      tessellation_version: '4.0.0-rc.0',
    };
    expect(isLegacyConfig(mixed)).toBe(false);
  });
});
