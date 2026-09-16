import { z } from 'zod';

// ─── Shared Schemas ──────────────────────────────────────────────────────────

/** Zod schema for P12 key file configuration (name, alias, password). */
export const KeyFileSchema = z.object({
  name: z.string().min(1, 'Key file name is required'),
  alias: z.string().min(1, 'Key alias is required'),
  password: z.string().min(1, 'Key password is required'),
});
/** Validated P12 key file configuration. */
export type KeyFileConfig = z.infer<typeof KeyFileSchema>;

/** Zod schema for a cluster node definition (name + key file). */
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
/** Validated cluster node configuration. */
export type NodeConfig = z.infer<typeof NodeSchema>;

/** Zod schema for the metagraph framework configuration (name, modules, version). */
export const FrameworkSchema = z.object({
  name: z.enum(['currency'], {
    errorMap: () => ({ message: "Framework must be 'currency'" }),
  }),
  modules: z.array(z.enum(['data'])).default([]),
  version: z.string().min(1, 'Framework version is required'),
  ref_type: z.enum(['tag', 'branch']).default('tag'),
});
/** Validated metagraph framework configuration. */
export type FrameworkConfig = z.infer<typeof FrameworkSchema>;

/** All supported Constellation Network layer types. */
export const LAYER_TYPES = [
  'global-l0',
  'dag-l1',
  'metagraph-l0',
  'currency-l1',
  'data-l1',
] as const;

/** Zod schema for validating layer type enum values. */
export const LayerTypeSchema = z.enum(LAYER_TYPES);
/** Union type of all supported layer type strings. */
export type LayerType = z.infer<typeof LayerTypeSchema>;

// ─── Port Schemas ────────────────────────────────────────────────────────────

/** Zod schema for a set of three ports (public, p2p, cli). */
export const PortTripleSchema = z.object({
  public: z.number().int().min(1).max(65535),
  p2p: z.number().int().min(1).max(65535),
  cli: z.number().int().min(1).max(65535),
});
/** Validated set of three ports (public, p2p, cli). */
export type PortTriple = z.infer<typeof PortTripleSchema>;

/** Zod schema for all layer port assignments with sensible defaults. */
export const PortsSchema = z
  .object({
    global_l0: PortTripleSchema.default({ public: 9000, p2p: 9001, cli: 9002 }),
    dag_l1: PortTripleSchema.default({ public: 9100, p2p: 9101, cli: 9102 }),
    metagraph_l0: PortTripleSchema.default({ public: 9200, p2p: 9201, cli: 9202 }),
    currency_l1: PortTripleSchema.default({ public: 9300, p2p: 9301, cli: 9302 }),
    data_l1: PortTripleSchema.default({ public: 9400, p2p: 9401, cli: 9402 }),
  })
  .default({});
/** Validated port assignments for all layers. */
export type PortsConfig = z.infer<typeof PortsSchema>;

// ─── Docker Schema ───────────────────────────────────────────────────────────

/** Zod schema for Docker infrastructure settings (Grafana, network subnet, IPs). */
export const DockerConfigSchema = z
  .object({
    start_grafana_container: z.boolean().default(false),
    network_subnet: z.string().default('172.50.0.0/24'),
    base_ip_prefix: z.string().default('172.50.0.'),
    ip_offset: z.number().int().positive().default(10),
  })
  .default({});
/** Validated Docker infrastructure settings. */
export type DockerConfig = z.infer<typeof DockerConfigSchema>;

// ─── JVM Schema ──────────────────────────────────────────────────────────────

const jvmHeapRegex = /^\d+[gm]$/;

/** Helper: create a per-layer JVM schema with the given defaults. */
function jvmLayerSchema(defaultXms: string, defaultXmx: string) {
  return z
    .object({
      xms: z
        .string()
        .regex(jvmHeapRegex, 'Must be a JVM heap size like "4g" or "512m"')
        .default(defaultXms),
      xmx: z
        .string()
        .regex(jvmHeapRegex, 'Must be a JVM heap size like "8g" or "1024m"')
        .default(defaultXmx),
    })
    .default({});
}

/** JVM config for a single layer (xms + xmx). */
export type JvmLayerConfig = { xms: string; xmx: string };

/**
 * Per-layer JVM config. Each layer has its own -Xms and -Xmx settings.
 *
 * Defaults:
 *   metagraph_l0: xms=8g, xmx=8g
 *   currency_l1:  xms=4g, xmx=4g
 *   data_l1:      xms=4g, xmx=4g
 */
export const LayerJvmConfigSchema = z
  .object({
    metagraph_l0: jvmLayerSchema('8g', '8g'),
    currency_l1: jvmLayerSchema('4g', '4g'),
    data_l1: jvmLayerSchema('4g', '4g'),
  })
  .default({});
/** Validated per-layer JVM heap configuration. */
export type LayerJvmConfig = z.infer<typeof LayerJvmConfigSchema>;

/**
 * Get the JVM config for a specific layer.
 */
export function resolveJvmConfig(
  layerJvm: LayerJvmConfig,
  layer: 'metagraph_l0' | 'currency_l1' | 'data_l1',
): JvmLayerConfig {
  return layerJvm[layer];
}

// ─── Deploy Schema ───────────────────────────────────────────────────────────

/** Zod schema for a Global L0 node reference in deploy config. */
export const Gl0NodeSchema = z.object({
  ip: z.string().min(1, 'GL0 node IP is required'),
  id: z.string().min(1, 'GL0 node ID is required'),
  public_port: z.union([z.string(), z.number()]),
});

/** Zod schema for the deploy target network (name + GL0 node). */
export const DeployNetworkSchema = z.object({
  name: z.string().min(1, 'Network name is required'),
  gl0_node: Gl0NodeSchema,
});

/** Zod schema for an SSH-accessible remote host (host, user, ssh_key). */
export const RemoteHostSchema = z.object({
  host: z.string().min(1),
  user: z.string().min(1),
  ssh_key: z.string().min(1),
});
/** Validated remote host configuration. */
export type RemoteHostConfig = z.infer<typeof RemoteHostSchema>;

/** Zod schema for remote deployment port assignments per metagraph layer. */
export const RemotePortsSchema = z
  .object({
    metagraph_l0: z
      .object({
        public: z.number().int().default(9100),
        p2p: z.number().int().default(9101),
        cli: z.number().int().default(9102),
      })
      .default({}),
    currency_l1: z
      .object({
        public: z.number().int().default(9200),
        p2p: z.number().int().default(9201),
        cli: z.number().int().default(9202),
      })
      .default({}),
    data_l1: z
      .object({
        public: z.number().int().default(9300),
        p2p: z.number().int().default(9301),
        cli: z.number().int().default(9302),
      })
      .default({}),
  })
  .default({});
/** Validated remote deployment port assignments. */
export type RemotePortsConfig = z.infer<typeof RemotePortsSchema>;

/** Zod schema for the full remote deployment configuration. */
export const DeploySchema = z.object({
  network: DeployNetworkSchema,
  jvm: LayerJvmConfigSchema,
  hosts: z.array(RemoteHostSchema).default([]),
  remote_ports: RemotePortsSchema,
  monitoring_host: RemoteHostSchema.optional(),
});
/** Validated remote deployment configuration. */
export type DeployConfig = z.infer<typeof DeploySchema>;

// ─── Snapshot Fees Schema ────────────────────────────────────────────────────

/** Zod schema for snapshot fee key configuration (owner + staking key files). */
export const SnapshotFeesSchema = z.object({
  owner: z.object({ key_file: KeyFileSchema }),
  staking: z.object({ key_file: KeyFileSchema }),
});
/** Validated snapshot fee configuration. */
export type SnapshotFeesConfig = z.infer<typeof SnapshotFeesSchema>;

// ─── Top-Level Config (v2 — new TypeScript CLI) ─────────────────────────────

/** Zod schema for the top-level euclid.json configuration (v2). */
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

/** Validated top-level euclid.json configuration. */
export type EuclidConfig = z.infer<typeof EuclidConfigSchema>;

// ─── Legacy Config (v1 — current Hydra CLI) ─────────────────────────────────
// Used only for migration detection; not enforced via Zod.

/** Legacy v1 configuration format, used only for migration detection. */
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
