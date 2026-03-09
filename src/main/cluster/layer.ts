import type { LayerType, PortTriple } from '../config/schema.js';

/**
 * Human-readable display names for each layer type.
 */
export const LAYER_DISPLAY_NAMES: Record<LayerType, string> = {
  'global-l0': 'Global L0',
  'dag-l1': 'DAG L1',
  'metagraph-l0': 'Metagraph L0',
  'currency-l1': 'Currency L1',
  'data-l1': 'Data L1',
};

/**
 * The order in which layers must be started (dependencies flow top-down).
 */
export const LAYER_START_ORDER: LayerType[] = [
  'global-l0',
  'dag-l1',
  'metagraph-l0',
  'currency-l1',
  'data-l1',
];

/**
 * The order in which layers must be stopped (reverse of start).
 */
export const LAYER_STOP_ORDER: LayerType[] = [...LAYER_START_ORDER].reverse();

/**
 * Maps a LayerType to its config key in the ports object.
 */
export function layerToPortKey(layer: LayerType): string {
  return layer.replace(/-/g, '_');
}

/**
 * Compute the actual ports for a given layer and node index.
 * Ports are offset by (nodeIndex * ipOffset) from the base.
 */
export function computeNodePorts(
  basePorts: PortTriple,
  nodeIndex: number,
  ipOffset: number,
): PortTriple {
  const offset = nodeIndex * ipOffset;
  return {
    public: basePorts.public + offset,
    p2p: basePorts.p2p + offset,
    cli: basePorts.cli + offset,
  };
}

/**
 * Compute the IP address for a node given its index.
 */
export function computeNodeIp(basePrefix: string, nodeIndex: number, ipOffset: number): string {
  const lastOctet = (nodeIndex + 1) * ipOffset;
  return `${basePrefix}${lastOctet}`;
}

/**
 * Get all port numbers used by a layer across all nodes.
 */
export function getAllPortsForLayer(
  basePorts: PortTriple,
  nodeCount: number,
  ipOffset: number,
): number[] {
  const ports: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const nodePorts = computeNodePorts(basePorts, i, ipOffset);
    ports.push(nodePorts.public, nodePorts.p2p, nodePorts.cli);
  }
  return ports;
}
