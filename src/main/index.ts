// ─── Config ─────────────────────────────────────────────────────────────────
export {
  EuclidConfigSchema,
  LAYER_TYPES,
  isLegacyConfig,
  loadConfig,
  validateConfig,
  checkConfig,
  findConfigPath,
  findProjectRoot,
  migrateV1toV2,
  writeConfigAtomic,
  resolveJvmConfig,
} from './config/index.js';

export type {
  EuclidConfig,
  KeyFileConfig,
  NodeConfig,
  FrameworkConfig,
  LayerType,
  PortTriple,
  PortsConfig,
  DockerConfig,
  JvmLayerConfig,
  LayerJvmConfig,
  DeployConfig,
  SnapshotFeesConfig,
  RemoteHostConfig,
  RemotePortsConfig,
  LegacyEuclidConfig,
} from './config/index.js';

// ─── Docker ─────────────────────────────────────────────────────────────────
export { DockerClient, composeBuild, composeUp, composeDown } from './docker-client/index.js';
export type { ComposeRunOptions } from './docker-client/index.js';

// ─── Cluster ────────────────────────────────────────────────────────────────
export {
  LAYER_DISPLAY_NAMES,
  LAYER_START_ORDER,
  LAYER_STOP_ORDER,
  computeNodePorts,
  computeNodeIp,
  getAllPortsForLayer,
  fetchNodeInfo,
  fetchClusterInfo,
  waitForNodeReady,
  loadClusterState,
  saveClusterState,
  updateClusterState,
  hashConfig,
  LAYER_STARTERS,
  LAYER_PORT_KEYS,
  getLeadNodeId,
  createMultiNodeSignedMessage,
  formatSignedMessage,
} from './cluster/index.js';

export type {
  NodeInfo,
  ClusterInfo,
  ClusterState,
  ClusterStatus,
  LayerState,
  LayerStatus,
  LayerContext,
  SignedMessage,
  SignedProof,
} from './cluster/index.js';

// ─── Errors ─────────────────────────────────────────────────────────────────
export {
  HydraError,
  ConfigError,
  ConfigNotFoundError,
  ConfigValidationError,
  DockerError,
  DockerNotRunningError,
  DockerVersionError,
  ClusterError,
  LayerStartError,
  RemoteError,
  SSHConnectionError,
  RemoteDeployError,
  RemoteStartError,
  PortInUseError,
  BinaryNotFoundError,
  errorMessage,
  shellEscape,
} from './shared/errors.js';

// ─── Scaffold ──────────────────────────────────────────────────────────────
export { scaffoldProject } from './shared/scaffold.js';

// ─── Logger ─────────────────────────────────────────────────────────────────
export { Logger, LogLevel, logger } from './shared/logger.js';

// ─── Preflight checks ──────────────────────────────────────────────────────
export {
  checkKeyFiles,
  checkJarFiles,
  checkDeployConfig,
  checkPortAvailable,
  checkPortsAvailable,
} from './shared/preflight.js';
export type { PreflightIssue } from './shared/preflight.js';
