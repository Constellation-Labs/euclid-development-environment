import { z } from 'zod';

// ─── Shared Schemas ──────────────────────────────────────────────────────────

export const KeyFileSchema = z.object({
  name: z.string().min(1, 'Key file name is required'),
  alias: z.string().min(1, 'Key alias is required'),
  password: z.string().min(1, 'Key password is required'),
});
export type KeyFileConfig = z.infer<typeof KeyFileSchema>;

export const NodeSchema = z.object({
  name: z
    .string()
    .min(1, 'Node name is required')
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'Node name must start with a letter or digit and contain only lowercase alphanumeric characters and hyphens',
    ),
  key_file: KeyFileSchema,
});
export type NodeConfig = z.infer<typeof NodeSchema>;

export const FrameworkSchema = z.object({
  name: z.enum(['currency'], {
    errorMap: () => ({ message: "Framework must be 'currency'" }),
  }),
  modules: z.array(z.enum(['data'])).default([]),
  version: z.string().min(1, 'Framework version is required'),
  ref_type: z.enum(['tag', 'branch']).default('tag'),
});
export type FrameworkConfig = z.infer<typeof FrameworkSchema>;

export const LAYER_TYPES = [
  'global-l0',
  'dag-l1',
  'metagraph-l0',
  'currency-l1',
  'data-l1',
] as const;

export const LayerTypeSchema = z.enum(LAYER_TYPES);
export type LayerType = z.infer<typeof LayerTypeSchema>;

// ─── Port Schemas ────────────────────────────────────────────────────────────

export const PortTripleSchema = z.object({
  public: z.number().int().min(1).max(65535),
  p2p: z.number().int().min(1).max(65535),
  cli: z.number().int().min(1).max(65535),
});
export type PortTriple = z.infer<typeof PortTripleSchema>;

export const PortsSchema = z
  .object({
    global_l0: PortTripleSchema.default({ public: 9000, p2p: 9001, cli: 9002 }),
    dag_l1: PortTripleSchema.default({ public: 9100, p2p: 9101, cli: 9102 }),
    metagraph_l0: PortTripleSchema.default({ public: 9200, p2p: 9201, cli: 9202 }),
    currency_l1: PortTripleSchema.default({ public: 9300, p2p: 9301, cli: 9302 }),
    data_l1: PortTripleSchema.default({ public: 9400, p2p: 9401, cli: 9402 }),
  })
  .default({});
export type PortsConfig = z.infer<typeof PortsSchema>;

// ─── Docker Schema ───────────────────────────────────────────────────────────

export const DockerConfigSchema = z
  .object({
    start_grafana_container: z.boolean().default(false),
    network_subnet: z.string().default('172.50.0.0/24'),
    base_ip_prefix: z.string().default('172.50.0.'),
    ip_offset: z.number().int().positive().default(10),
  })
  .default({});
export type DockerConfig = z.infer<typeof DockerConfigSchema>;

// ─── JVM Schema ──────────────────────────────────────────────────────────────

export const JvmConfigSchema = z
  .object({
    min_heap: z
      .string()
      .regex(/^\d+[gm]$/, 'Must be a JVM heap size like "1g" or "256m"')
      .default('1g'),
    max_heap: z
      .string()
      .regex(/^\d+[gm]$/, 'Must be a JVM heap size like "2g" or "512m"')
      .default('2g'),
    metaspace_size: z
      .string()
      .regex(/^\d+[gm]$/, 'Must be a JVM size like "256m"')
      .default('256m'),
    max_metaspace_size: z
      .string()
      .regex(/^\d+[gm]$/, 'Must be a JVM size like "512m"')
      .default('512m'),
    additional_opts: z.string().default(''),
  })
  .default({});
export type JvmConfig = z.infer<typeof JvmConfigSchema>;

// ─── Deploy Schema ───────────────────────────────────────────────────────────

export const Gl0NodeSchema = z.object({
  ip: z.string().min(1, 'GL0 node IP is required'),
  id: z.string().min(1, 'GL0 node ID is required'),
  public_port: z.union([z.string(), z.number()]),
});

export const DeployNetworkSchema = z.object({
  name: z.string().min(1, 'Network name is required'),
  gl0_node: Gl0NodeSchema,
});

export const RemoteHostSchema = z.object({
  host: z.string().min(1),
  user: z.string().min(1),
  ssh_key: z.string().min(1),
});
export type RemoteHostConfig = z.infer<typeof RemoteHostSchema>;

export const RemotePortsSchema = z.object({
  metagraph_l0: z.object({
    public: z.number().int().default(9100),
    p2p: z.number().int().default(9101),
    cli: z.number().int().default(9102),
  }).default({}),
  currency_l1: z.object({
    public: z.number().int().default(9200),
    p2p: z.number().int().default(9201),
    cli: z.number().int().default(9202),
  }).default({}),
  data_l1: z.object({
    public: z.number().int().default(9300),
    p2p: z.number().int().default(9301),
    cli: z.number().int().default(9302),
  }).default({}),
}).default({});
export type RemotePortsConfig = z.infer<typeof RemotePortsSchema>;

export const DeploySchema = z.object({
  network: DeployNetworkSchema,
  jvm: JvmConfigSchema,
  hosts: z.array(RemoteHostSchema).default([]),
  remote_ports: RemotePortsSchema,
  monitoring_host: RemoteHostSchema.optional(),
});
export type DeployConfig = z.infer<typeof DeploySchema>;

// ─── Snapshot Fees Schema ────────────────────────────────────────────────────

export const SnapshotFeesSchema = z.object({
  owner: z.object({ key_file: KeyFileSchema }),
  staking: z.object({ key_file: KeyFileSchema }),
});
export type SnapshotFeesConfig = z.infer<typeof SnapshotFeesSchema>;

// ─── Top-Level Config (v2 — new TypeScript CLI) ─────────────────────────────

export const EuclidConfigSchema = z.object({
  // Meta
  $schema: z.string().optional(),
  config_version: z.literal(2).default(2),

  // Project
  project_name: z.string().min(1, 'Project name is required'),
  tessellation_version: z.string().min(1, 'Tessellation version is required'),
  tessellation_ref_type: z.enum(['tag', 'branch']).default('tag'),
  framework: FrameworkSchema,

  // Topology
  layers: z.array(LayerTypeSchema).min(1, 'At least one layer is required'),
  nodes: z
    .array(NodeSchema)
    .min(1, 'At least one node is required')
    .max(10, 'Maximum 10 nodes supported'),

  // Infrastructure
  docker: DockerConfigSchema,
  ports: PortsSchema,

  // Fees
  snapshot_fees: SnapshotFeesSchema.optional(),

  // Deployment (optional — only needed for remote operations)
  deploy: DeploySchema.optional(),
});

export type EuclidConfig = z.infer<typeof EuclidConfigSchema>;

// ─── Legacy Config (v1 — current Hydra CLI) ─────────────────────────────────
// Used only for migration detection; not enforced via Zod.

export interface LegacyEuclidConfig {
  version?: string;
  tessellation_version: string;
  ref_type?: string;
  project_name: string;
  framework: {
    name: string;
    modules?: string[];
    version: string;
    ref_type?: string;
  };
  layers: string[];
  nodes: Array<{
    name: string;
    key_file: {
      name: string;
      alias: string;
      password: string;
    };
  }>;
  docker?: {
    start_grafana_container?: boolean;
  };
  snapshot_fees?: {
    owner: { key_file: { name: string; alias: string; password: string } };
    staking: { key_file: { name: string; alias: string; password: string } };
  };
  deploy?: {
    network: {
      name: string;
      gl0_node: {
        ip: string;
        id: string;
        public_port: string;
      };
    };
    jvm?: {
      min_heap?: string;
      max_heap?: string;
      metaspace_size?: string;
      max_metaspace_size?: string;
      additional_opts?: string;
    };
    ansible?: {
      hosts: string;
      nodes: {
        playbooks: {
          deploy: string;
          start: string;
        };
      };
      monitoring: {
        playbooks: {
          deploy: string;
          start: string;
        };
      };
    };
  };
}

/**
 * Check if a raw JSON object looks like a legacy (v1) config
 * by looking for the `version` field (which was renamed to `config_version` in v2).
 */
export function isLegacyConfig(raw: Record<string, unknown>): boolean {
  return (
    raw.version !== undefined &&
    raw.config_version === undefined &&
    typeof raw.tessellation_version === 'string'
  );
}
