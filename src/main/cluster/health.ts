import { logger } from '../shared/logger.js';
import { errorMessage, LayerStartError } from '../shared/errors.js';

/** Timeout for individual HTTP requests to node info/cluster endpoints. */
const HTTP_TIMEOUT_MS = 5000;

/** Default maximum polling attempts before giving up. */
const DEFAULT_MAX_RETRIES = 120;

/** Default interval between polling attempts (milliseconds). */
const DEFAULT_POLL_INTERVAL_MS = 1000;

/** Response from a node's /node/info endpoint. */
export interface NodeInfo {
  state: string;
  id?: string;
  host?: string;
  publicPort?: number;
  p2pPort?: number;
  session?: string;
  clusterSession?: string;
  version?: string;
}

/** Response from a node's /cluster/info endpoint. */
export interface ClusterInfo {
  peers: Array<{
    id: string;
    ip: string;
    publicPort: number;
    p2pPort: number;
    session: string;
    state: string;
  }>;
}

/**
 * Query a node's /node/info endpoint.
 */
export async function fetchNodeInfo(host: string, port: number): Promise<NodeInfo | null> {
  const url = `http://${host}:${port}/node/info`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!response.ok) return null;
    return (await response.json()) as NodeInfo;
  } catch (err) {
    logger.debug(`Failed to fetch node info from ${url}`, { error: errorMessage(err) });
    return null;
  }
}

/**
 * Query a node's /cluster/info endpoint.
 */
export async function fetchClusterInfo(host: string, port: number): Promise<ClusterInfo | null> {
  const url = `http://${host}:${port}/cluster/info`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!response.ok) return null;
    const peers = (await response.json()) as ClusterInfo['peers'];
    return { peers };
  } catch (err) {
    logger.debug(`Failed to fetch cluster info from ${url}`, { error: errorMessage(err) });
    return null;
  }
}

/**
 * Wait for a node to reach a specific state, polling at intervals.
 */
export async function waitForNodeState(
  host: string,
  port: number,
  targetState: string,
  options?: {
    maxRetries?: number;
    intervalMs?: number;
    onRetry?: (attempt: number, elapsed: number) => void;
  },
): Promise<NodeInfo> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo(host, port);

    if (info?.state === targetState) {
      return info;
    }

    if (options?.onRetry) {
      options.onRetry(attempt, Date.now() - startTime);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new LayerStartError(
    `Node at ${host}:${port} did not reach '${targetState}' after ${maxRetries} attempts (${Math.round((maxRetries * intervalMs) / 1000)}s)`,
  );
}

/**
 * Wait for a node to reach the "Ready" state, polling at intervals.
 */
export async function waitForNodeReady(
  host: string,
  port: number,
  options?: {
    maxRetries?: number;
    intervalMs?: number;
    onRetry?: (attempt: number, elapsed: number) => void;
  },
): Promise<NodeInfo> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const info = await fetchNodeInfo(host, port);

    if (info?.state === 'Ready') {
      return info;
    }

    if (options?.onRetry) {
      options.onRetry(attempt, Date.now() - startTime);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new LayerStartError(
    `Node at ${host}:${port} did not become Ready after ${maxRetries} attempts (${Math.round((maxRetries * intervalMs) / 1000)}s)`,
  );
}
