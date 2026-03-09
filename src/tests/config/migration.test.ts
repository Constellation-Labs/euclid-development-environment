import { describe, it, expect } from 'vitest';
import { migrateV1toV2 } from '../../main/config/migration.js';
import { EuclidConfigSchema } from '../../main/config/schema.js';

describe('migrateV1toV2', () => {
  const legacyConfig = {
    version: '0.19.0',
    tessellation_version: '4.0.0-rc.0',
    ref_type: 'tag',
    project_name: 'custom-project',
    framework: {
      name: 'currency',
      modules: ['data'],
      version: 'v3.6.0',
      ref_type: 'tag',
    },
    layers: ['global-l0', 'metagraph-l0', 'currency-l1', 'data-l1'],
    nodes: [
      {
        name: 'metagraph-node-1',
        key_file: { name: 'token-key.p12', alias: 'token-key', password: 'password' },
      },
      {
        name: 'metagraph-node-2',
        key_file: { name: 'token-key-1.p12', alias: 'token-key-1', password: 'password' },
      },
      {
        name: 'metagraph-node-3',
        key_file: { name: 'token-key-2.p12', alias: 'token-key-2', password: 'password' },
      },
    ],
    docker: {
      start_grafana_container: false,
    },
    snapshot_fees: {
      owner: {
        key_file: { name: 'token-key.p12', alias: 'token-key', password: 'password' },
      },
      staking: {
        key_file: { name: 'token-key-1.p12', alias: 'token-key-1', password: 'password' },
      },
    },
    deploy: {
      network: {
        name: 'integrationnet|mainnet',
        gl0_node: {
          ip: ':gl0_node_ip',
          id: ':gl0_node_id',
          public_port: ':gl0_node_public_port',
        },
      },
      jvm: {
        min_heap: '1g',
        max_heap: '2g',
        metaspace_size: '256m',
        max_metaspace_size: '512m',
        additional_opts: '',
      },
      ansible: {
        hosts: 'infra/ansible/remote/hosts.ansible.yml',
        nodes: {
          playbooks: {
            deploy: 'infra/ansible/remote/nodes/playbooks/deploy/deploy.ansible.yml',
            start: 'infra/ansible/remote/nodes/playbooks/start/start.ansible.yml',
          },
        },
        monitoring: {
          playbooks: {
            deploy: 'infra/ansible/remote/monitoring/playbooks/deploy/deploy.ansible.yml',
            start: 'infra/ansible/remote/monitoring/playbooks/start/start.ansible.yml',
          },
        },
      },
    },
  };

  it('produces a valid v2 config from a complete v1 config', () => {
    const migrated = migrateV1toV2(legacyConfig as unknown as Record<string, unknown>);

    expect(migrated.config_version).toBe(2);
    expect(migrated.project_name).toBe('custom-project');
    expect(migrated.tessellation_version).toBe('4.0.0-rc.0');
    expect(migrated.tessellation_ref_type).toBe('tag');
    expect(migrated.nodes).toHaveLength(3);
    expect(migrated.layers).toEqual(['global-l0', 'metagraph-l0', 'currency-l1', 'data-l1']);

    // Validate the result against the v2 schema
    const validation = EuclidConfigSchema.safeParse(migrated);
    expect(validation.success).toBe(true);
  });

  it('preserves framework info', () => {
    const migrated = migrateV1toV2(legacyConfig as unknown as Record<string, unknown>);
    expect(migrated.framework.name).toBe('currency');
    expect(migrated.framework.modules).toEqual(['data']);
    expect(migrated.framework.version).toBe('v3.6.0');
  });

  it('preserves snapshot fees', () => {
    const migrated = migrateV1toV2(legacyConfig as unknown as Record<string, unknown>);
    expect(migrated.snapshot_fees).toBeDefined();
    expect(migrated.snapshot_fees!.owner.key_file.name).toBe('token-key.p12');
    expect(migrated.snapshot_fees!.staking.key_file.name).toBe('token-key-1.p12');
  });

  it('preserves deploy config', () => {
    const migrated = migrateV1toV2(legacyConfig as unknown as Record<string, unknown>);
    expect(migrated.deploy).toBeDefined();
    expect(migrated.deploy!.network.name).toBe('integrationnet|mainnet');
    expect(migrated.deploy!.jvm.default.min_heap).toBe('1g');
  });

  it('adds default ports and docker config', () => {
    const migrated = migrateV1toV2(legacyConfig as unknown as Record<string, unknown>);
    expect(migrated.docker.ip_offset).toBe(10);
    expect(migrated.docker.network_subnet).toBe('172.50.0.0/24');
    expect(migrated.ports.global_l0.public).toBe(9000);
    expect(migrated.ports.metagraph_l0.public).toBe(9200);
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = {
      version: '0.18.0',
      tessellation_version: '3.0.0',
      project_name: 'test',
      framework: { name: 'currency', version: 'v3.0.0' },
      layers: ['global-l0', 'metagraph-l0'],
      nodes: [
        {
          name: 'node-1',
          key_file: { name: 'key.p12', alias: 'key', password: 'pass' },
        },
      ],
    };

    const migrated = migrateV1toV2(minimal as unknown as Record<string, unknown>);
    expect(migrated.config_version).toBe(2);
    expect(migrated.tessellation_ref_type).toBe('tag');
    expect(migrated.docker.start_grafana_container).toBe(false);
    expect(migrated.snapshot_fees).toBeUndefined();
    expect(migrated.deploy).toBeUndefined();
  });
});
