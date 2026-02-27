import { createServer } from 'node:net';
import type { CheckResult } from '../index.js';
import type { EuclidConfig, LayerType, PortTriple } from '../../core/index.js';
import { computeNodePorts, LAYER_DISPLAY_NAMES } from '../../core/index.js';

const LAYER_PORT_KEYS: Record<LayerType, keyof EuclidConfig['ports']> = {
  'global-l0': 'global_l0',
  'dag-l1': 'dag_l1',
  'metagraph-l0': 'metagraph_l0',
  'currency-l1': 'currency_l1',
  'data-l1': 'data_l1',
};

/**
 * Check port availability for all configured layers and nodes.
 */
export async function checkPorts(config: EuclidConfig): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const layer of config.layers) {
    const portKey = LAYER_PORT_KEYS[layer];
    const basePorts = config.ports[portKey];
    const portRange = getPortRange(basePorts, config.nodes.length, config.docker.ip_offset);

    const inUse = await findPortsInUse(portRange);

    if (inUse.length === 0) {
      results.push({
        name: `${portRange[0]}-${portRange[portRange.length - 1]}`,
        status: 'pass',
        message: `available (${LAYER_DISPLAY_NAMES[layer]})`,
      });
    } else {
      results.push({
        name: `${portRange[0]}-${portRange[portRange.length - 1]}`,
        status: 'error',
        message: `port(s) ${inUse.join(', ')} in use (${LAYER_DISPLAY_NAMES[layer]})`,
        fix: `Free the port(s): lsof -i :${inUse[0]}`,
      });
    }
  }

  // Check Grafana port if enabled
  if (config.docker.start_grafana_container) {
    const grafanaPort = 3000;
    const inUse = await isPortInUse(grafanaPort);
    results.push({
      name: String(grafanaPort),
      status: inUse ? 'error' : 'pass',
      message: inUse ? 'in use by another process (Grafana)' : 'available (Grafana)',
      fix: inUse ? `Free port 3000: lsof -i :${grafanaPort}` : undefined,
    });
  }

  return results;
}

function getPortRange(basePorts: PortTriple, nodeCount: number, ipOffset: number): number[] {
  const ports: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const nodePorts = computeNodePorts(basePorts, i, ipOffset);
    ports.push(nodePorts.public, nodePorts.p2p, nodePorts.cli);
  }
  return [...new Set(ports)].sort((a, b) => a - b);
}

async function findPortsInUse(ports: number[]): Promise<number[]> {
  const checks = ports.map(async (port) => ({
    port,
    inUse: await isPortInUse(port),
  }));
  const results = await Promise.all(checks);
  return results.filter((r) => r.inUse).map((r) => r.port);
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(true);
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '0.0.0.0');
  });
}
