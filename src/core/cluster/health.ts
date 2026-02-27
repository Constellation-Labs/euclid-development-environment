import { logger } from '../logger.js';

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
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return (await response.json()) as NodeInfo;
  } catch (err) {
    logger.debug(`Failed to fetch node info from ${url}`, { error: (err as Error).message });
    return null;
  }
}

/**
 * Query a node's /cluster/info endpoint.
 */
export async function fetchClusterInfo(host: string, port: number): Promise<ClusterInfo | null> {
  const url = `http://${host}:${port}/cluster/info`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const peers = (await response.json()) as ClusterInfo['peers'];
    return { peers };
  } catch (err) {
    logger.debug(`Failed to fetch cluster info from ${url}`, { error: (err as Error).message });
    return null;
  }
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
  const maxRetries = options?.maxRetries ?? 120;
  const intervalMs = options?.intervalMs ?? 1000;
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

  throw new Error(
    `Node at ${host}:${port} did not become Ready after ${maxRetries} attempts (${Math.round((maxRetries * intervalMs) / 1000)}s)`,
  );
}
