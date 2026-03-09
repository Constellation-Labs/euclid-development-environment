import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { DockerClient } from '../../docker-client/client.js';
import type { EuclidConfig, LayerType, NodeConfig, PortTriple } from '../../config/schema.js';
import { computeNodePorts, computeNodeIp } from '../layer.js';
import { fetchNodeInfo } from '../health.js';
import { LayerStartError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────

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

export const LAYER_PORT_KEYS: Record<LayerType, LayerPortKey> = {
  'global-l0': 'global_l0',
  'dag-l1': 'dag_l1',
  'metagraph-l0': 'metagraph_l0',
  'currency-l1': 'currency_l1',
  'data-l1': 'data_l1',
};

export const LAYER_DIRS: Record<LayerType, string> = {
  'global-l0': 'global-l0',
  'dag-l1': 'dag-l1',
  'metagraph-l0': 'metagraph-l0',
  'currency-l1': 'currency-l1',
  'data-l1': 'data-l1',
};

export const LAYER_JARS: Record<LayerType, string> = {
  'global-l0': 'global-l0.jar',
  'dag-l1': 'dag-l1.jar',
  'metagraph-l0': 'metagraph-l0.jar',
  'currency-l1': 'currency-l1.jar',
  'data-l1': 'data-l1.jar',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function nodeIp(config: EuclidConfig, nodeIndex: number): string {
  return computeNodeIp(config.docker.base_ip_prefix, nodeIndex, config.docker.ip_offset);
}

export function nodePorts(config: EuclidConfig, layer: LayerType, nodeIndex: number): PortTriple {
  const portKey = LAYER_PORT_KEYS[layer];
  return computeNodePorts(config.ports[portKey], nodeIndex, config.docker.ip_offset);
}

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

export function globalL0PeerEnv(config: EuclidConfig, leadNodeId: string): Record<string, string> {
  return {
    CL_GLOBAL_L0_PEER_HTTP_HOST: nodeIp(config, 0),
    CL_GLOBAL_L0_PEER_HTTP_PORT: String(config.ports.global_l0.public),
    CL_GLOBAL_L0_PEER_ID: leadNodeId,
  };
}

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

export async function dockerExec(
  docker: DockerClient,
  container: string,
  cmd: string[],
  env?: Record<string, string>,
): Promise<string> {
  const result = await docker.exec(container, cmd, { env });
  if (result.exitCode !== 0) {
    const errMsg = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
    throw new LayerStartError(`Command failed in ${container}: ${errMsg}`);
  }
  return result.stdout.trim();
}

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

export async function cleanLayerDirs(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
): Promise<void> {
  await dockerExec(docker, containerName, [
    'bash',
    '-c',
    `cd ${layerDir} && rm -rf data logs 2>/dev/null; true`,
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
    `test -f ${layerDir}/genesis.csv && echo "ok" || echo "missing"`,
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
      `cd ${layerDir} && nohup java -jar ${jar} ${javaArgs} > ${logFile} 2>&1 & echo $! > ${logFile}.pid`,
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
    `cd ${layerDir} && ` +
      `PID=$(cat ${logFile}.pid 2>/dev/null) && ` +
      `if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "alive"; else echo "dead"; fi`,
  ]);

  if (pidCheck.stdout.trim() === 'dead') {
    const logTail = await docker.exec(containerName, [
      'bash',
      '-c',
      `cd ${layerDir} && tail -40 ${logFile} 2>/dev/null || echo "(no log output)"`,
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

export async function waitForReady(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
  logFile: string,
  port: number,
  targetState: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const maxRetries = 120;
  const intervalMs = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo('localhost', port);
    if (info?.state === targetState) {
      return;
    }

    if (attempt > 0 && attempt % 10 === 0) {
      await checkProcessHealth(docker, containerName, layerDir, logFile);
    }

    if (onProgress && attempt % 5 === 0 && attempt > 0) {
      onProgress(`Waiting for ${targetState}... ${Math.round(attempt)}s`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  let logHint = '';
  try {
    const logTail = await docker.exec(containerName, [
      'bash',
      '-c',
      `cd ${layerDir} && tail -20 ${logFile} 2>/dev/null || echo "(no log)"`,
    ]);
    const errorLines = extractErrorFromLog(logTail.stdout.trim());
    logHint = `\n     Last log output:\n     ${errorLines}`;
  } catch {
    // ignore — best-effort log reading
  }

  throw new LayerStartError(`Node did not reach '${targetState}' after ${maxRetries}s.${logHint}`);
}

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

  await dockerExec(docker, containerName, [
    'bash',
    '-c',
    `curl -s -X POST http://localhost:${cliPort}/cluster/join ` +
      `-H 'Content-Type: application/json' ` +
      `-d '${payload}'`,
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
 * We use the ordinal/ directory (sibling of hash/) to find the highest ordinal,
 * then read the hash value from that file.
 * Falls back to listing hash/ leaves sorted by modification time.
 * Returns null if no snapshot data exists (e.g. fresh container).
 */
export async function findLatestSnapshot(
  docker: DockerClient,
  containerName: string,
  layerDir: string,
): Promise<string | null> {
  for (const dir of ['incremental_snapshot', 'snapshot']) {
    try {
      // Strategy: find the leaf files under hash/ sorted by mtime (most recent first)
      // Uses ls -ltR to recursively list, then grep for 64-char hex filenames
      const hashDir = `${layerDir}/data/${dir}/hash`;
      const result = await docker.exec(containerName, [
        'bash',
        '-c',
        `find ${hashDir} -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1 | xargs -I{} basename {}`,
      ]);
      const hash = result.stdout.trim();
      if (hash && /^[a-f0-9]{64}$/i.test(hash)) {
        return hash;
      }
    } catch {
      // Directory doesn't exist, try next
    }
  }
  return null;
}
