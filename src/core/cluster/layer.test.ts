import { describe, it, expect } from 'vitest';
import { computeNodePorts, computeNodeIp, getAllPortsForLayer } from './layer.js';

describe('computeNodePorts', () => {
  it('returns base ports for node index 0', () => {
    const result = computeNodePorts({ public: 9000, p2p: 9001, cli: 9002 }, 0, 10);
    expect(result).toEqual({ public: 9000, p2p: 9001, cli: 9002 });
  });

  it('offsets ports for node index 1', () => {
    const result = computeNodePorts({ public: 9000, p2p: 9001, cli: 9002 }, 1, 10);
    expect(result).toEqual({ public: 9010, p2p: 9011, cli: 9012 });
  });

  it('offsets ports for node index 2', () => {
    const result = computeNodePorts({ public: 9200, p2p: 9201, cli: 9202 }, 2, 10);
    expect(result).toEqual({ public: 9220, p2p: 9221, cli: 9222 });
  });

  it('works with custom offset', () => {
    const result = computeNodePorts({ public: 9000, p2p: 9001, cli: 9002 }, 1, 5);
    expect(result).toEqual({ public: 9005, p2p: 9006, cli: 9007 });
  });
});

describe('computeNodeIp', () => {
  it('computes IP for first node', () => {
    expect(computeNodeIp('172.50.0.', 0, 10)).toBe('172.50.0.10');
  });

  it('computes IP for second node', () => {
    expect(computeNodeIp('172.50.0.', 1, 10)).toBe('172.50.0.20');
  });

  it('computes IP for third node', () => {
    expect(computeNodeIp('172.50.0.', 2, 10)).toBe('172.50.0.30');
  });
});

describe('getAllPortsForLayer', () => {
  it('returns all ports for 3 nodes', () => {
    const ports = getAllPortsForLayer({ public: 9000, p2p: 9001, cli: 9002 }, 3, 10);
    expect(ports).toEqual([9000, 9001, 9002, 9010, 9011, 9012, 9020, 9021, 9022]);
  });

  it('returns all ports for 1 node', () => {
    const ports = getAllPortsForLayer({ public: 9200, p2p: 9201, cli: 9202 }, 1, 10);
    expect(ports).toEqual([9200, 9201, 9202]);
  });
});
