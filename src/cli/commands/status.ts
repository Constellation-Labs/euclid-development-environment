import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  fetchNodeInfo,
  fetchClusterInfo,
  computeNodePorts,
  LAYER_DISPLAY_NAMES,
} from '../../core/index.js';
import type { EuclidConfig, LayerType } from '../../core/index.js';
import { formatError, formatHeader, formatTable } from '../ui/format.js';

const LAYER_PORT_KEYS: Record<LayerType, keyof EuclidConfig['ports']> = {
  'global-l0': 'global_l0',
  'dag-l1': 'dag_l1',
  'metagraph-l0': 'metagraph_l0',
  'currency-l1': 'currency_l1',
  'data-l1': 'data_l1',
};

export async function statusCommand(options: {
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const docker = new DockerClient();

    // Check Docker connectivity
    try {
      await docker.checkConnection();
    } catch (err) {
      process.stderr.write(formatError(err) + '\n');
      process.exit(1);
    }

    const statusData: Record<string, unknown> = {};
    const rows: string[][] = [];

    // Container status
    process.stdout.write(formatHeader('Cluster Status'));

    for (const node of config.nodes) {
      const running = await docker.isContainerRunning(node.name);
      const state = running ? '\x1b[32mrunning\x1b[0m' : '\x1b[31mstopped\x1b[0m';
      rows.push([node.name, state]);
    }

    process.stdout.write(formatTable(['Container', 'State'], rows, { indent: 4 }) + '\n');

    // Layer status
    const layerRows: string[][] = [];
    for (const layer of config.layers) {
      const portKey = LAYER_PORT_KEYS[layer];
      const basePorts = config.ports[portKey];
      const nodePorts = computeNodePorts(basePorts, 0, config.docker.ip_offset);
      const info = await fetchNodeInfo('localhost', nodePorts.public);

      const displayName = LAYER_DISPLAY_NAMES[layer];
      const state = info?.state ?? 'unavailable';
      const port = String(nodePorts.public);
      const colorState =
        state === 'Ready'
          ? `\x1b[32m${state}\x1b[0m`
          : state === 'unavailable'
            ? `\x1b[31m${state}\x1b[0m`
            : `\x1b[33m${state}\x1b[0m`;

      layerRows.push([displayName, colorState, port]);

      statusData[layer] = { state, port: nodePorts.public };
    }

    process.stdout.write('\n');
    process.stdout.write(formatTable(['Layer', 'State', 'Port'], layerRows, { indent: 4 }) + '\n');

    // Cluster info for metagraph-l0
    if (config.layers.includes('metagraph-l0')) {
      const ml0Ports = computeNodePorts(config.ports.metagraph_l0, 0, config.docker.ip_offset);
      const clusterInfo = await fetchClusterInfo('localhost', ml0Ports.public);

      if (clusterInfo && clusterInfo.peers.length > 0) {
        process.stdout.write('\n');
        process.stdout.write('    Metagraph L0 Cluster:\n');
        const peerRows = clusterInfo.peers.map((p) => [
          p.id.slice(0, 16) + '...',
          p.ip,
          String(p.publicPort),
          p.state,
        ]);
        process.stdout.write(formatTable(['Peer ID', 'IP', 'Port', 'State'], peerRows, { indent: 6 }) + '\n');
      }
    }

    process.stdout.write('\n');

    if (options.json) {
      process.stdout.write(JSON.stringify(statusData, null, 2) + '\n');
    }
  } catch (err) {
    process.stderr.write(formatError(err) + '\n');
    process.exit(1);
  }
}
