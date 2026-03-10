import { fetchNodeInfo } from '../cluster/health.js';
import type { NodeInfo } from '../cluster/health.js';
import type { EuclidConfig } from '../config/schema.js';
import { DEFAULT_REMOTE_PORTS } from './defaults.js';

export interface RemoteNodeStatus {
  host: string;
  layer: string;
  port: number;
  info: NodeInfo | null;
}

/**
 * Query the status of all remote nodes across all layers.
 */
export async function remoteStatus(config: EuclidConfig): Promise<RemoteNodeStatus[]> {
  const deploy = config.deploy;
  if (!deploy) return [];

  const remotePorts = deploy.remote_ports ?? DEFAULT_REMOTE_PORTS;

  const layerPorts: Array<{ layer: string; port: number }> = [];

  if (config.layers.includes('metagraph-l0')) {
    layerPorts.push({ layer: 'Metagraph L0', port: remotePorts.metagraph_l0.public });
  }
  if (config.layers.includes('currency-l1')) {
    layerPorts.push({ layer: 'Currency L1', port: remotePorts.currency_l1.public });
  }
  if (config.layers.includes('data-l1')) {
    layerPorts.push({ layer: 'Data L1', port: remotePorts.data_l1.public });
  }

  // Query all hosts and layers in parallel
  const promises: Promise<RemoteNodeStatus>[] = [];

  for (const host of deploy.hosts) {
    for (const { layer, port } of layerPorts) {
      promises.push(
        fetchNodeInfo(host.host, port).then((info) => ({
          host: host.host,
          layer,
          port,
          info,
        })),
      );
    }
  }

  return Promise.all(promises);
}
