import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { writeConfigAtomic } from '../config/writer.js';
import type { LayerType } from '../config/schema.js';

/** Overall cluster lifecycle state. */
export type ClusterStatus = 'stopped' | 'starting' | 'running' | 'degraded' | 'stopping';
/** Lifecycle state of an individual layer. */
export type LayerStatus = 'stopped' | 'starting' | 'ready' | 'error';

/** Runtime state of a layer including its nodes, IPs, and ports. */
export interface LayerState {
  status: LayerStatus;
  nodes: Record<
    string,
    {
      containerId: string;
      ip: string;
      ports: { public: number; p2p: number; cli: number };
    }
  >;
}

/** Genesis address and snapshot path for the cluster. */
export interface GenesisState {
  address: string | null;
  snapshotPath: string | null;
}

/** Full persisted cluster state (status, layers, genesis, config hash). */
export interface ClusterState {
  status: ClusterStatus;
  mode: 'genesis' | 'rollback' | null;
  startedAt: string | null;
  layers: Partial<Record<LayerType, LayerState>>;
  genesis: GenesisState;
  configHash: string;
}

function getStateDir(): string {
  const xdg = process.env.XDG_STATE_HOME;
  return xdg ? resolve(xdg, 'hydra') : resolve(homedir(), '.hydra');
}

function getStatePath(): string {
  return resolve(getStateDir(), 'state.json');
}

/**
 * Create a hash of the config for drift detection.
 */
export function hashConfig(config: unknown): string {
  const content = JSON.stringify(config);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Load the persisted cluster state, or return a fresh default state.
 */
export async function loadClusterState(): Promise<ClusterState> {
  const statePath = getStatePath();

  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as ClusterState;
  } catch {
    // ENOENT = file doesn't exist yet → return fresh default
    // Other errors (corrupt JSON, permissions) → also return default gracefully
    return defaultState();
  }
}

/**
 * Persist the cluster state to disk atomically.
 */
export async function saveClusterState(state: ClusterState): Promise<void> {
  const statePath = getStatePath();
  const dir = dirname(statePath);

  // mkdir with recursive is safe to call even if dir already exists
  await mkdir(dir, { recursive: true });
  await writeConfigAtomic(statePath, state);
}

/**
 * Update specific fields in the cluster state.
 */
export async function updateClusterState(
  updater: (current: ClusterState) => ClusterState,
): Promise<ClusterState> {
  const current = await loadClusterState();
  const updated = updater(current);
  await saveClusterState(updated);
  return updated;
}

function defaultState(): ClusterState {
  return {
    status: 'stopped',
    mode: null,
    startedAt: null,
    layers: {},
    genesis: {
      address: null,
      snapshotPath: null,
    },
    configHash: '',
  };
}
