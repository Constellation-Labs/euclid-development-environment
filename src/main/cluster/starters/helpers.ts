import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { DockerClient } from '../../docker-client/client.js';
import type { EuclidConfig, LayerType, NodeConfig, PortTriple } from '../../config/schema.js';
import { computeNodePorts, computeNodeIp } from '../layer.js';
import { fetchNodeInfo } from '../health.js';
import { LayerStartError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shared context passed to all layer starter functions. */
export interface LayerContext {
  docker: DockerClient;
  config: EuclidConfig;
  projectRoot: string;
  mode: 'genesis' | 'rollback';
  leadNodeId: string;
  metagraphId?: string;
  onProgress?: (msg: string) => void;
}

type LayerPortKey = keyof EuclidConfig['ports'];

/** Maps each LayerType to its key in the ports config object. */
export const LAYER_PORT_KEYS: Record<LayerType, LayerPortKey> = {
  'global-l0': 'global_l0',
  'dag-l1': 'dag_l1',
  'metagraph-l0': 'metagraph_l0',
  'currency-l1': 'currency_l1',
  'data-l1': 'data_l1',
};

/** Maps each LayerType to its directory name inside the Docker container. */
export const LAYER_DIRS: Record<LayerType, string> = {
  'global-l0': 'global-l0',
  'dag-l1': 'dag-l1',
  'metagraph-l0': 'metagraph-l0',
  'currency-l1': 'currency-l1',
  'data-l1': 'data-l1',
};

/** Maps each LayerType to its compiled JAR filename. */
export const LAYER_JARS: Record<LayerType, string> = {
  'global-l0': 'global-l0.jar',
  'dag-l1': 'dag-l1.jar',
  'metagraph-l0': 'metagraph-l0.jar',
  'currency-l1': 'currency-l1.jar',
  'data-l1': 'data-l1.jar',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute the Docker network IP address for a node by index. */
export function nodeIp(config: EuclidConfig, nodeIndex: number): string {
  return computeNodeIp(config.docker.base_ip_prefix, nodeIndex, config.docker.ip_offset);
}

/** Compute the port triple for a layer and node index. */
export function nodePorts(config: EuclidConfig, layer: LayerType, nodeIndex: number): PortTriple {
  const portKey = LAYER_PORT_KEYS[layer];
  return computeNodePorts(config.ports[portKey], nodeIndex, config.docker.ip_offset);
}

/** Build the base environment variables for a Java node process. */
export function baseEnv(node: NodeConfig, ports: PortTriple): Record<string, string> {
  return {
    CL_PUBLIC_HTTP_PORT: String(ports.public),
    CL_P2P_HTTP_PORT: String(ports.p2p),
    CL_CLI_HTTP_PORT: String(ports.cli),
    CL_KEYSTORE: node.key_file.name,
    CL_KEYALIAS: node.key_file.alias,
    CL_PASSWORD: node.key_file.password,
    CL_APP_ENV: 'dev',
    CL_COLLATERAL: '0',
  };
}

/** Build environment variables for connecting to the Global L0 lead node. */
export function globalL0PeerEnv(config: EuclidConfig, leadNodeId: string): Record<string, string> {
  return {
    CL_GLOBAL_L0_PEER_HTTP_HOST: nodeIp(config, 0),
    CL_GLOBAL_L0_PEER_HTTP_PORT: String(config.ports.global_l0.public),
    CL_GLOBAL_L0_PEER_ID: leadNodeId,
  };
}

/** Build environment variables for connecting to the Metagraph L0 lead node. */
export function metagraphL0PeerEnv(
  config: EuclidConfig,
  leadNodeId: string,
): Record<string, string> {
  return {
    CL_L0_PEER_HTTP_HOST: nodeIp(config, 0),
    CL_L0_PEER_HTTP_PORT: String(config.ports.metagraph_l0.public),
    CL_L0_PEER_ID: leadNodeId,
  };
}

/**
 * Resolve user-defined env vars from `config.env_vars`, applied to every
 * metagraph layer. Returns `{}` when `env_vars` is unset.
 */
export function customEnv(config: EuclidConfig): Record<string, string> {
  return config.env_vars ?? {};
}

/** Execute a command in a Docker container, throwing on non-zero exit. */
export async function dockerExec(
  docker: DockerClient,
  container: string,
  cmd: string[],
  env?: Record<string, string>,
): Promise<string> {
  // Route logback's init/status output to stderr via a clean config so it never
  // contaminates parsed stdout (e.g. `show-id` -> CL_GLOBAL_L0_PEER_ID). The clean
  // logback.xml is baked into the image at /code/clean-logback.xml.
  const envWithLogback = {
    JAVA_TOOL_OPTIONS: '-Dlogback.configurationFile=/code/clean-logback.xml',
    ...env,
  };
  const result = await docker.exec(container, cmd, { env: envWithLogback });
  if (result.exitCode !== 0) {
    const errMsg = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
    throw new LayerStartError(`Command failed in ${container}: ${errMsg}`);
  }
  // Strip the JVM's "Picked up JAVA_TOOL_OPTIONS" banner if it lands on stdout.
  return result.stdout
    .split('\n')
    .filter((l) => !l.startsWith('Picked up JAVA_TOOL_OPTIONS'))
    .join('\n')
    .trim();
}

/** Copy a P12 keystore file from the host into a container. */
export async function copyP12(
  docker: DockerClient,
  projectRoot: string,
  node: NodeConfig,
  containerName: string,
  layerDir: string,
): Promise<void> {
  const p12Path = resolve(projectRoot, 'data', 'p12-files', node.key_file.name);
  if (!existsSync(p12Path)) {
    throw new LayerStartError(`P12 keystore not found: ${p12Path}`);
  }
  await docker.copyToContainer(containerName, p12Path, `code/${layerDir}/${node.key_file.name}`);
}

/** Remove data and log directories inside a container's layer directory. */
export async function cleanLayerDirs(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
): Promise<void> {
  await dockerExec(docker, containerName, [
    'bash',
    '-c',
    `cd "${layerDir}" && rm -rf data logs 2>/dev/null; true`,
  ]);
}

/**
 * Ensure genesis.csv is present in the layer directory inside the container.
 * If missing (stale Docker image cache), copy from the host's data/ directory.
 */
export async function ensureGenesisCsv(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
  projectRoot: string,
): Promise<void> {
  const result = await docker.exec(containerName, [
    'bash',
    '-c',
    `test -f "${layerDir}/genesis.csv" && echo "ok" || echo "missing"`,
  ]);
  if (result.stdout.trim() === 'ok') return;

  const hostGenesisCsv = resolve(projectRoot, 'data', layerDir, 'genesis', 'genesis.csv');
  if (!existsSync(hostGenesisCsv)) {
    throw new LayerStartError(
      `Missing genesis.csv for ${layerDir}.\n` +
        `     Expected at: ${hostGenesisCsv}\n` +
        `     Create one or run 'hydra build' to rebuild the Docker image.`,
    );
  }

  logger.debug(`genesis.csv missing in ${layerDir}/, copying from host...`);
  await docker.copyToContainer(containerName, hostGenesisCsv, `code/${layerDir}/genesis.csv`);
}

/** Start a Java JAR as a background process inside a container. */
export async function startJavaProcess(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
  jar: string,
  javaArgs: string,
  env: Record<string, string>,
  logFile: string,
): Promise<void> {
  await dockerExec(
    docker,
    containerName,
    [
      'bash',
      '-c',
      `cd "${layerDir}" && nohup java -jar "${jar}" ${javaArgs} > "${logFile}" 2>&1 & echo $! > "${logFile}.pid"`,
    ],
    env,
  );

  // Give the process a moment to start (or fail immediately)
  await new Promise((r) => setTimeout(r, 2000));

  // Check for early crash
  await checkProcessHealth(docker, containerName, layerDir, logFile);
}

/**
 * Check if a Java process is still alive and surface errors from its log file.
 */
export async function checkProcessHealth(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
  logFile: string,
): Promise<void> {
  const pidCheck = await docker.exec(containerName, [
    'bash',
    '-c',
    `cd "${layerDir}" && ` +
      `PID=$(cat "${logFile}.pid" 2>/dev/null) && ` +
      `if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "alive"; else echo "dead"; fi`,
  ]);

  if (pidCheck.stdout.trim() === 'dead') {
    const logTail = await docker.exec(containerName, [
      'bash',
      '-c',
      `cd "${layerDir}" && tail -40 "${logFile}" 2>/dev/null || echo "(no log output)"`,
    ]);

    const logContent = logTail.stdout.trim();
    const errorLines = extractErrorFromLog(logContent);

    throw new LayerStartError(
      `Java process crashed shortly after starting.\n` + `     ${errorLines}`,
    );
  }
}

/**
 * Extract a human-readable error message from Java log output.
 */
export function extractErrorFromLog(logContent: string): string {
  const lines = logContent.split('\n');

  const errorPatterns = [
    /io\.circe\.\w+:\s*.+/,
    /Exception.*:\s*.+/,
    /Error.*:\s*.+/,
    /Caused by:\s*.+/,
    /FATAL/i,
  ];

  for (const pattern of errorPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const idx = lines.indexOf(line);
        const context = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 5));
        return context.join('\n     ');
      }
    }
  }

  return lines.slice(-10).join('\n     ') || '(no output captured)';
}

/** Maximum polling attempts for local container readiness (120 × 1s = 2min). */
const LOCAL_READY_MAX_RETRIES = 120;

/** Polling interval for local container readiness (milliseconds). */
const LOCAL_READY_POLL_INTERVAL_MS = 1000;

/** Check process health every N polling attempts. */
const HEALTH_CHECK_INTERVAL = 10;

/** Report progress to the user every N polling attempts. */
const PROGRESS_REPORT_INTERVAL = 5;

/** Poll a node's HTTP endpoint until it reaches the target state. */
export async function waitForReady(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
  logFile: string,
  port: number,
  targetState: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const maxRetries = LOCAL_READY_MAX_RETRIES;
  const intervalMs = LOCAL_READY_POLL_INTERVAL_MS;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo('localhost', port);
    if (info?.state === targetState) {
      return;
    }

    if (attempt > 0 && attempt % HEALTH_CHECK_INTERVAL === 0) {
      await checkProcessHealth(docker, containerName, layerDir, logFile);
    }

    if (onProgress && attempt % PROGRESS_REPORT_INTERVAL === 0 && attempt > 0) {
      onProgress(`Waiting for ${targetState}... ${Math.round(attempt)}s`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  let logHint = '';
  try {
    const logTail = await docker.exec(containerName, [
      'bash',
      '-c',
      `cd "${layerDir}" && tail -20 "${logFile}" 2>/dev/null || echo "(no log)"`,
    ]);
    const errorLines = extractErrorFromLog(logTail.stdout.trim());
    logHint = `\n     Last log output:\n     ${errorLines}`;
  } catch {
    // ignore — best-effort log reading
  }

  throw new LayerStartError(`Node did not reach '${targetState}' after ${maxRetries}s.${logHint}`);
}

/** Send a cluster join request to a node via its CLI port. */
export async function joinCluster(
  docker: DockerClient,
  containerName: string,
  cliPort: number,
  leadNodeId: string,
  leadNodeIp: string,
  leadNodeP2pPort: number,
): Promise<void> {
  const payload = JSON.stringify({
    id: leadNodeId,
    ip: leadNodeIp,
    p2pPort: leadNodeP2pPort,
  });

  // Use heredoc to pass JSON payload safely (avoids shell quoting issues with single/double quotes)
  await dockerExec(docker, containerName, [
    'bash',
    '-c',
    `curl -s -X POST "http://localhost:${cliPort}/cluster/join" ` +
      `-H 'Content-Type: application/json' ` +
      `--data-raw '${payload.replace(/'/g, "'\\''")}'`,
  ]);
}

/**
 * Find the latest snapshot hash in a layer's data directory.
 * Checks incremental_snapshot first (most recent), then snapshot.
 *
 * Tessellation stores snapshots in a nested structure:
 *   data/incremental_snapshot/hash/<prefix1>/<prefix2>/<full_hash>
 *   data/snapshot/hash/<prefix1>/<prefix2>/<full_hash>
 *
 * We find the leaf files under hash/ sorted by modification time (most recent first).
 * Returns null if no snapshot data exists (e.g. fresh container).
 */
export async function findLatestSnapshot(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
): Promise<string | null> {
  for (const dir of ['incremental_snapshot', 'snapshot']) {
    try {
      const hashDir = `${layerDir}/data/${dir}/hash`;
      const result = await docker.exec(containerName, [
        'bash',
        '-c',
        `find "${hashDir}" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1 | xargs -I{} basename {}`,
      ]);
      const hash = result.stdout.trim();
      if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
        return hash;
      }
    } catch (err) {
      // Directory doesn't exist, try next
      logger.debug(
        `Snapshot dir ${dir} not found in ${layerDir}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return null;
}
