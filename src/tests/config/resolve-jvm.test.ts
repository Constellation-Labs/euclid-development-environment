import { describe, it, expect } from 'vitest';
import {
  resolveJvmConfig,
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
  it('returns metagraph_l0 defaults (8g)', () => {
    const jvm = LayerJvmConfigSchema.parse({});
    const result = resolveJvmConfig(jvm, 'metagraph_l0');
    expect(result).toEqual({ xms: '8g', xmx: '8g' });
  });

  it('returns currency_l1 defaults (4g)', () => {
    const jvm = LayerJvmConfigSchema.parse({});
    const result = resolveJvmConfig(jvm, 'currency_l1');
    expect(result).toEqual({ xms: '4g', xmx: '4g' });
  });

  it('returns data_l1 defaults (4g)', () => {
    const jvm = LayerJvmConfigSchema.parse({});
    const result = resolveJvmConfig(jvm, 'data_l1');
    expect(result).toEqual({ xms: '4g', xmx: '4g' });
  });

  it('uses custom values per layer', () => {
    const jvm = LayerJvmConfigSchema.parse({
      metagraph_l0: { xms: '16g', xmx: '16g' },
      currency_l1: { xms: '2g', xmx: '6g' },
    });
    expect(resolveJvmConfig(jvm, 'metagraph_l0')).toEqual({ xms: '16g', xmx: '16g' });
    expect(resolveJvmConfig(jvm, 'currency_l1')).toEqual({ xms: '2g', xmx: '6g' });
    // data_l1 untouched — keeps defaults
    expect(resolveJvmConfig(jvm, 'data_l1')).toEqual({ xms: '4g', xmx: '4g' });
  });

  it('partial override fills remaining from defaults', () => {
    const jvm = LayerJvmConfigSchema.parse({
      metagraph_l0: { xmx: '12g' },
    });
    // xms comes from metagraph_l0 default (8g), xmx from override (12g)
    expect(resolveJvmConfig(jvm, 'metagraph_l0')).toEqual({ xms: '8g', xmx: '12g' });
  });
});

// ─── LayerJvmConfigSchema ────────────────────────────────────────────────────

describe('LayerJvmConfigSchema', () => {
  it('provides full defaults when given empty object', () => {
    const result = LayerJvmConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.metagraph_l0).toEqual({ xms: '8g', xmx: '8g' });
    expect(result.data?.currency_l1).toEqual({ xms: '4g', xmx: '4g' });
    expect(result.data?.data_l1).toEqual({ xms: '4g', xmx: '4g' });
  });

  it('accepts partial layer overrides', () => {
    const result = LayerJvmConfigSchema.safeParse({
      metagraph_l0: { xmx: '12g' },
    });
    expect(result.success).toBe(true);
    expect(result.data?.metagraph_l0.xms).toBe('8g'); // default
    expect(result.data?.metagraph_l0.xmx).toBe('12g'); // overridden
  });

  it('rejects invalid heap format', () => {
    expect(
      LayerJvmConfigSchema.safeParse({ metagraph_l0: { xms: '8gb' } }).success,
    ).toBe(false);
    expect(
      LayerJvmConfigSchema.safeParse({ currency_l1: { xmx: 'big' } }).success,
    ).toBe(false);
  });

  it('accepts valid heap formats', () => {
    expect(
      LayerJvmConfigSchema.safeParse({ metagraph_l0: { xms: '512m', xmx: '1g' } }).success,
    ).toBe(true);
    expect(
      LayerJvmConfigSchema.safeParse({ data_l1: { xms: '2g', xmx: '8g' } }).success,
    ).toBe(true);
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
