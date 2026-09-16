import { describe, it, expect } from 'vitest';
import { validateConfig, checkConfig } from '../../main/config/loader.js';
import { ConfigValidationError } from '../../main/shared/errors.js';

// ─── validateConfig ─────────────────────────────────────────────────────────

describe('validateConfig', () => {
  const validConfig = {
    config_version: 2,
    project_name: 'test-project',
    tessellation_version: '4.0.0',
    framework: {
      name: 'currency',
      version: 'v3.6.0',
    },
    layers: ['global-l0', 'metagraph-l0'],
    nodes: [
      {
        name: 'node-1',
        key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
      },
    ],
  };

  it('returns validated config for valid input', () => {
    const result = validateConfig(validConfig);
    expect(result.config_version).toBe(2);
    expect(result.project_name).toBe('test-project');
    expect(result.tessellation_version).toBe('4.0.0');
  });

  it('fills in defaults for optional fields', () => {
    const result = validateConfig(validConfig);
    // Docker defaults
    expect(result.docker.start_grafana_container).toBe(false);
    expect(result.docker.network_subnet).toBe('172.50.0.0/24');
    expect(result.docker.base_ip_prefix).toBe('172.50.0.');
    expect(result.docker.ip_offset).toBe(10);
    // Port defaults
    expect(result.ports.global_l0.public).toBe(9000);
    expect(result.ports.metagraph_l0.public).toBe(9200);
    // Framework defaults
    expect(result.framework.ref_type).toBe('tag');
    expect(result.framework.modules).toEqual([]);
  });

  it('throws ConfigValidationError for missing required fields', () => {
    expect(() => validateConfig({})).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError for invalid project_name', () => {
    expect(() => validateConfig({ ...validConfig, project_name: '' })).toThrow(
      ConfigValidationError,
    );
  });

  it('throws ConfigValidationError for invalid layer type', () => {
    expect(() =>
      validateConfig({ ...validConfig, layers: ['global-l0', 'invalid-layer'] }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError for empty nodes array', () => {
    expect(() => validateConfig({ ...validConfig, nodes: [] })).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError with correct issue details', () => {
    try {
      validateConfig({ config_version: 2 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const validationErr = err as ConfigValidationError;
      expect(validationErr.issues.length).toBeGreaterThan(0);
      // Should mention missing required fields
      const paths = validationErr.issues.map((i) => i.path);
      expect(paths).toContain('project_name');
    }
  });

  it('accepts config with all optional deploy fields', () => {
    const withDeploy = {
      ...validConfig,
      deploy: {
        network: {
          name: 'testnet',
          gl0_node: { ip: '1.2.3.4', id: 'abc', public_port: 9000 },
        },
        jvm: {
          metagraph_l0: { xms: '8g', xmx: '8g' },
          currency_l1: { xms: '4g', xmx: '4g' },
          data_l1: { xms: '4g', xmx: '4g' },
        },
        hosts: [{ host: '1.2.3.4', user: 'ubuntu', ssh_key: '~/.ssh/id_rsa' }],
      },
    };
    const result = validateConfig(withDeploy);
    expect(result.deploy).toBeDefined();
    expect(result.deploy!.network.name).toBe('testnet');
    expect(result.deploy!.hosts).toHaveLength(1);
  });

  it('accepts config with snapshot_fees', () => {
    const withFees = {
      ...validConfig,
      snapshot_fees: {
        owner: {
          key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
        },
        staking: {
          key_file: { name: 'key2.p12', alias: 'key2', password: 'pass2' },
        },
      },
    };
    const result = validateConfig(withFees);
    expect(result.snapshot_fees).toBeDefined();
    expect(result.snapshot_fees!.owner.key_file.name).toBe('key.p12');
  });

  it('accepts all five layer types', () => {
    const allLayers = {
      ...validConfig,
      layers: ['global-l0', 'dag-l1', 'metagraph-l0', 'currency-l1', 'data-l1'] as const,
    };
    const result = validateConfig(allLayers);
    expect(result.layers).toHaveLength(5);
  });

  it('accepts framework with data module', () => {
    const withDataModule = {
      ...validConfig,
      framework: { name: 'currency', modules: ['data'], version: 'v3.6.0' },
    };
    const result = validateConfig(withDataModule);
    expect(result.framework.modules).toEqual(['data']);
  });
});

// ─── checkConfig ────────────────────────────────────────────────────────────

describe('checkConfig', () => {
  const validConfig = {
    config_version: 2,
    project_name: 'test-project',
    tessellation_version: '4.0.0',
    framework: {
      name: 'currency',
      version: 'v3.6.0',
    },
    layers: ['global-l0', 'metagraph-l0'],
    nodes: [
      {
        name: 'node-1',
        key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
      },
    ],
  };

  it('returns null for valid config', () => {
    expect(checkConfig(validConfig)).toBeNull();
  });

  it('returns issues for invalid config', () => {
    const issues = checkConfig({});
    expect(issues).not.toBeNull();
    expect(issues!.length).toBeGreaterThan(0);
  });

  it('returns issue objects with path and message', () => {
    const issues = checkConfig({ config_version: 2 });
    expect(issues).not.toBeNull();
    for (const issue of issues!) {
      expect(issue).toHaveProperty('path');
      expect(issue).toHaveProperty('message');
      expect(typeof issue.path).toBe('string');
      expect(typeof issue.message).toBe('string');
    }
  });

  it('returns specific path for nested validation errors', () => {
    const issues = checkConfig({
      ...validConfig,
      nodes: [{ name: '', key_file: { name: 'a', alias: 'b', password: 'c' } }],
    });
    expect(issues).not.toBeNull();
    // Should have an issue pointing to nodes.0.name
    const nodePaths = issues!.filter((i) => i.path.startsWith('nodes'));
    expect(nodePaths.length).toBeGreaterThan(0);
  });

  it('returns null for config with all optional fields', () => {
    const full = {
      ...validConfig,
      docker: { start_grafana_container: true },
      snapshot_fees: {
        owner: { key_file: { name: 'k.p12', alias: 'k', password: 'p' } },
        staking: { key_file: { name: 'k2.p12', alias: 'k2', password: 'p2' } },
      },
    };
    expect(checkConfig(full)).toBeNull();
  });
});
