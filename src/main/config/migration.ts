import type { EuclidConfig, DeployConfig } from './schema.js';
import type { LegacyEuclidConfig } from './schema.js';

/**
 * Migrate a legacy v1 (Hydra) config to the v2 (Hydra TS CLI) format.
 *
 * Changes:
 * - `version` (Euclid version string) → `config_version: 2` (schema version number)
 * - `ref_type` → `tessellation_ref_type`
 * - `deploy.ansible` is stripped (no longer needed in v2)
 * - `docker` gets new optional fields with defaults
 * - `ports` section added with defaults
 */
export function migrateV1toV2(raw: Record<string, unknown>): EuclidConfig {
  const old = raw as unknown as LegacyEuclidConfig;

  const deploy = migrateDeployConfig(old.deploy);

  return {
    config_version: 2,

    project_name: old.project_name,
    tessellation_version: old.tessellation_version,
    tessellation_ref_type: (old.ref_type as 'tag' | 'branch') ?? 'tag',

    framework: {
      name: old.framework.name as 'currency',
      modules: (old.framework.modules as Array<'data'>) ?? [],
      version: old.framework.version,
      ref_type: (old.framework.ref_type as 'tag' | 'branch') ?? 'tag',
    },

    layers: old.layers as EuclidConfig['layers'],

    nodes: old.nodes.map((n) => ({
      name: n.name,
      key_file: {
        name: n.key_file.name,
        alias: n.key_file.alias,
        password: n.key_file.password,
      },
    })),

    docker: {
      start_grafana_container: old.docker?.start_grafana_container ?? false,
      network_subnet: '172.50.0.0/24',
      base_ip_prefix: '172.50.0.',
      ip_offset: 10,
    },

    ports: {
      global_l0: { public: 9000, p2p: 9001, cli: 9002 },
      dag_l1: { public: 9100, p2p: 9101, cli: 9102 },
      metagraph_l0: { public: 9200, p2p: 9201, cli: 9202 },
      currency_l1: { public: 9300, p2p: 9301, cli: 9302 },
      data_l1: { public: 9400, p2p: 9401, cli: 9402 },
    },

    snapshot_fees: old.snapshot_fees
      ? {
          owner: { key_file: old.snapshot_fees.owner.key_file },
          staking: { key_file: old.snapshot_fees.staking.key_file },
        }
      : undefined,

    deploy,
  };
}

function migrateDeployConfig(oldDeploy: LegacyEuclidConfig['deploy']): DeployConfig | undefined {
  if (!oldDeploy) return undefined;

  const network = oldDeploy.network;

  return {
    network: {
      name: network.name,
      gl0_node: {
        ip: network.gl0_node.ip,
        id: network.gl0_node.id,
        public_port: network.gl0_node.public_port,
      },
    },
    jvm: {
      metagraph_l0: {
        xms: oldDeploy.jvm?.min_heap ?? '1g',
        xmx: oldDeploy.jvm?.max_heap ?? '4g',
      },
      currency_l1: {
        xms: oldDeploy.jvm?.min_heap ?? '1g',
        xmx: oldDeploy.jvm?.max_heap ?? '2g',
      },
      data_l1: {
        xms: oldDeploy.jvm?.min_heap ?? '1g',
        xmx: oldDeploy.jvm?.max_heap ?? '2g',
      },
    },
    // ansible is stripped — v2 uses native SSH via deploy.hosts
    hosts: [],
    remote_ports: {
      metagraph_l0: { public: 9100, p2p: 9101, cli: 9102 },
      currency_l1: { public: 9200, p2p: 9201, cli: 9202 },
      data_l1: { public: 9300, p2p: 9301, cli: 9302 },
    },
  };
}
