import { describe, it, expect } from 'vitest';
import {
  resolveJvmConfig,
  JvmOverrideSchema,
  LayerJvmConfigSchema,
  PortTripleSchema,
  PortsSchema,
  DockerConfigSchema,
  FrameworkSchema,
  RemoteHostSchema,
  RemotePortsSchema,
  DeployNetworkSchema,
} from '../../main/config/schema.js';

// ─── resolveJvmConfig ────────────────────────────────────────────────────────

describe('resolveJvmConfig', () => {
  const defaultJvm = {
    min_heap: '2g',
    max_heap: '4g',
    metaspace_size: '256m',
    max_metaspace_size: '512m',
    additional_opts: '-XX:+UseG1GC',
  };

  it('returns default config when no layer override exists', () => {
    const layerJvm = { default: defaultJvm };
    const result = resolveJvmConfig(layerJvm, 'metagraph_l0');
    expect(result).toEqual(defaultJvm);
  });

  it('overrides only max_heap when only max_heap is provided', () => {
    const layerJvm = {
      default: defaultJvm,
      metagraph_l0: { max_heap: '8g' },
    };
    const result = resolveJvmConfig(layerJvm, 'metagraph_l0');
    expect(result).toEqual({
      min_heap: '2g',
      max_heap: '8g',
      metaspace_size: '256m',
      max_metaspace_size: '512m',
      additional_opts: '-XX:+UseG1GC',
    });
  });

  it('overrides multiple fields at once', () => {
    const layerJvm = {
      default: defaultJvm,
      currency_l1: { min_heap: '4g', max_heap: '16g', metaspace_size: '512m' },
    };
    const result = resolveJvmConfig(layerJvm, 'currency_l1');
    expect(result).toEqual({
      min_heap: '4g',
      max_heap: '16g',
      metaspace_size: '512m',
      max_metaspace_size: '512m',
      additional_opts: '-XX:+UseG1GC',
    });
  });

  it('returns default for a layer that has no override', () => {
    const layerJvm = {
      default: defaultJvm,
      metagraph_l0: { max_heap: '8g' },
    };
    // currency_l1 has no override
    const result = resolveJvmConfig(layerJvm, 'currency_l1');
    expect(result).toEqual(defaultJvm);
  });

  it('handles empty override object (all fields inherit)', () => {
    const layerJvm = {
      default: defaultJvm,
      data_l1: {},
    };
    const result = resolveJvmConfig(layerJvm, 'data_l1');
    expect(result).toEqual(defaultJvm);
  });

  it('allows overriding additional_opts to a non-empty value', () => {
    const layerJvm = {
      default: defaultJvm,
      metagraph_l0: { additional_opts: '-Dfoo=bar' },
    };
    const result = resolveJvmConfig(layerJvm, 'metagraph_l0');
    expect(result.additional_opts).toBe('-Dfoo=bar');
  });

  it('allows overriding additional_opts to empty string', () => {
    const layerJvm = {
      default: defaultJvm,
      metagraph_l0: { additional_opts: '' },
    };
    const result = resolveJvmConfig(layerJvm, 'metagraph_l0');
    // '' is not undefined/null, so ?? returns ''
    expect(result.additional_opts).toBe('');
  });

  it('works with all three layers independently', () => {
    const layerJvm = {
      default: defaultJvm,
      metagraph_l0: { max_heap: '8g' },
      currency_l1: { min_heap: '512m' },
      data_l1: { metaspace_size: '1g' },
    };
    expect(resolveJvmConfig(layerJvm, 'metagraph_l0').max_heap).toBe('8g');
    expect(resolveJvmConfig(layerJvm, 'currency_l1').min_heap).toBe('512m');
    expect(resolveJvmConfig(layerJvm, 'data_l1').metaspace_size).toBe('1g');
  });
});

// ─── JvmOverrideSchema ───────────────────────────────────────────────────────

describe('JvmOverrideSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(JvmOverrideSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial override', () => {
    const result = JvmOverrideSchema.safeParse({ max_heap: '8g' });
    expect(result.success).toBe(true);
    expect(result.data?.max_heap).toBe('8g');
    expect(result.data?.min_heap).toBeUndefined();
  });

  it('rejects invalid heap format', () => {
    expect(JvmOverrideSchema.safeParse({ max_heap: '8gb' }).success).toBe(false);
    expect(JvmOverrideSchema.safeParse({ max_heap: 'big' }).success).toBe(false);
  });

  it('accepts valid heap formats', () => {
    expect(JvmOverrideSchema.safeParse({ min_heap: '512m' }).success).toBe(true);
    expect(JvmOverrideSchema.safeParse({ max_heap: '1g' }).success).toBe(true);
    expect(JvmOverrideSchema.safeParse({ metaspace_size: '256m' }).success).toBe(true);
  });
});

// ─── LayerJvmConfigSchema ────────────────────────────────────────────────────

describe('LayerJvmConfigSchema', () => {
  it('provides full defaults when given empty object', () => {
    const result = LayerJvmConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.default.min_heap).toBe('1g');
    expect(result.data?.default.max_heap).toBe('2g');
  });

  it('does NOT fill in defaults for per-layer overrides', () => {
    const result = LayerJvmConfigSchema.safeParse({
      default: {},
      metagraph_l0: { max_heap: '8g' },
    });
    expect(result.success).toBe(true);
    // The override should only have max_heap, not defaults
    expect(result.data?.metagraph_l0?.max_heap).toBe('8g');
    expect(result.data?.metagraph_l0?.min_heap).toBeUndefined();
  });
});

// ─── Additional Schema Validation Tests ──────────────────────────────────────

describe('PortTripleSchema', () => {
  it('accepts valid port triple', () => {
    expect(PortTripleSchema.safeParse({ public: 9000, p2p: 9001, cli: 9002 }).success).toBe(true);
  });

  it('rejects port 0', () => {
    expect(PortTripleSchema.safeParse({ public: 0, p2p: 9001, cli: 9002 }).success).toBe(false);
  });

  it('rejects port above 65535', () => {
    expect(PortTripleSchema.safeParse({ public: 70000, p2p: 9001, cli: 9002 }).success).toBe(false);
  });

  it('rejects non-integer ports', () => {
    expect(PortTripleSchema.safeParse({ public: 9000.5, p2p: 9001, cli: 9002 }).success).toBe(
      false,
    );
  });
});

describe('PortsSchema', () => {
  it('provides all default ports when given empty object', () => {
    const result = PortsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.global_l0.public).toBe(9000);
    expect(result.data?.dag_l1.public).toBe(9100);
    expect(result.data?.metagraph_l0.public).toBe(9200);
    expect(result.data?.currency_l1.public).toBe(9300);
    expect(result.data?.data_l1.public).toBe(9400);
  });
});

describe('DockerConfigSchema', () => {
  it('provides defaults when given empty object', () => {
    const result = DockerConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.start_grafana_container).toBe(false);
    expect(result.data?.network_subnet).toBe('172.50.0.0/24');
    expect(result.data?.base_ip_prefix).toBe('172.50.0.');
    expect(result.data?.ip_offset).toBe(10);
  });
});

describe('FrameworkSchema', () => {
  it('accepts valid framework config', () => {
    const result = FrameworkSchema.safeParse({
      name: 'currency',
      version: 'v3.6.0',
    });
    expect(result.success).toBe(true);
    expect(result.data?.modules).toEqual([]);
    expect(result.data?.ref_type).toBe('tag');
  });

  it('rejects invalid framework name', () => {
    expect(FrameworkSchema.safeParse({ name: 'invalid', version: 'v1' }).success).toBe(false);
  });

  it('accepts data module', () => {
    const result = FrameworkSchema.safeParse({
      name: 'currency',
      modules: ['data'],
      version: 'v3.6.0',
    });
    expect(result.success).toBe(true);
    expect(result.data?.modules).toEqual(['data']);
  });
});

describe('RemoteHostSchema', () => {
  it('accepts valid host config', () => {
    const result = RemoteHostSchema.safeParse({
      host: '1.2.3.4',
      user: 'ubuntu',
      ssh_key: '~/.ssh/id_rsa',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty host', () => {
    expect(
      RemoteHostSchema.safeParse({ host: '', user: 'ubuntu', ssh_key: '~/.ssh/id_rsa' }).success,
    ).toBe(false);
  });
});

describe('RemotePortsSchema', () => {
  it('provides defaults when given empty object', () => {
    const result = RemotePortsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.metagraph_l0.public).toBe(9100);
    expect(result.data?.currency_l1.public).toBe(9200);
    expect(result.data?.data_l1.public).toBe(9300);
  });
});

describe('DeployNetworkSchema', () => {
  it('accepts valid network config', () => {
    const result = DeployNetworkSchema.safeParse({
      name: 'testnet',
      gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: 9000 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty network name', () => {
    expect(
      DeployNetworkSchema.safeParse({
        name: '',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: 9000 },
      }).success,
    ).toBe(false);
  });
});
