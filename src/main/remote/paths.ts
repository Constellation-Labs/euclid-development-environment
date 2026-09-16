import type { EuclidConfig, RemoteHostConfig } from '../config/schema.js';

/**
 * Get the remote code directory for a given layer on a remote host.
 * Convention: /home/<user>/code/<layer>
 */
export function remoteCodeDir(host: RemoteHostConfig, layer: string): string {
  return `/home/${host.user}/code/${layer}`;
}

/**
 * Get the list of metagraph layers configured in the project.
 * Always includes metagraph-l0; optionally includes currency-l1 and data-l1.
 */
export function getConfiguredRemoteLayers(config: EuclidConfig): string[] {
  const layers: string[] = ['metagraph-l0'];
  if (config.layers.includes('currency-l1')) layers.push('currency-l1');
  if (config.layers.includes('data-l1')) layers.push('data-l1');
  return layers;
}
