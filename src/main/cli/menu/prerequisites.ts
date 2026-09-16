import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { logger } from '../../index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Prerequisite {
  /** Short description of what's missing */
  label: string;
  /** Command value to auto-run (matches interactive menu values) */
  command: string;
  /** Human-readable command name shown in prompt */
  commandLabel: string;
  /** Returns true if this prerequisite is satisfied */
  check: (projectRoot: string) => Promise<boolean>;
}

// ─── Detection Helpers ──────────────────────────────────────────────────────

/**
 * Check if the Docker image exists using the Docker CLI directly.
 * More reliable than dockerode for edge cases (post-purge, daemon restarts).
 */
async function dockerImageExists(): Promise<boolean> {
  try {
    const result = execSync('docker images -q metagraph-base-image:latest 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    logger.debug(`Docker image check: ${result ? 'found' : 'not found'}`);
    return result.length > 0;
  } catch {
    logger.debug('Docker image check failed (Docker not available?)');
    return false;
  }
}

function jarsExist(projectRoot: string): boolean {
  const jarsDir = resolve(projectRoot, 'docker', 'artifacts', 'jars');
  return existsSync(resolve(jarsDir, 'metagraph-l0.jar'));
}

function genesisFilesExist(projectRoot: string): boolean {
  const genesisDir = resolve(projectRoot, 'docker', 'artifacts', 'genesis');
  return (
    existsSync(resolve(genesisDir, 'genesis.snapshot')) &&
    existsSync(resolve(genesisDir, 'genesis.address'))
  );
}

// ─── Prerequisite Definitions ───────────────────────────────────────────────

const PREREQUISITES: Record<string, Prerequisite[]> = {
  start: [
    {
      label: 'Docker images not found. The project needs to be built first.',
      command: 'build',
      commandLabel: 'build',
      check: async () => dockerImageExists(),
    },
  ],

  'remote:deploy': [
    {
      label: 'Compiled JARs not found. The project needs to be built first.',
      command: 'build',
      commandLabel: 'build',
      check: async (root) => jarsExist(root),
    },
    {
      label: 'Genesis files not found. Remote genesis needs to be created first.',
      command: 'create-remote-genesis',
      commandLabel: 'create-remote-genesis',
      check: async (root) => genesisFilesExist(root),
    },
  ],

  'remote:start': [
    {
      label: 'Compiled JARs or genesis files not found. Deploy needs to be run first.',
      command: 'remote:deploy',
      commandLabel: 'remote deploy',
      check: async (root) => jarsExist(root) && genesisFilesExist(root),
    },
  ],
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if a command's prerequisites are met.
 * Returns the first unmet prerequisite, or null if all are satisfied.
 * Only needs projectRoot — no config loading required (fast + robust).
 */
export async function checkPrerequisites(
  command: string,
  projectRoot: string,
): Promise<Prerequisite | null> {
  const prereqs = PREREQUISITES[command];
  if (!prereqs) return null;

  for (const prereq of prereqs) {
    const satisfied = await prereq.check(projectRoot);
    if (!satisfied) return prereq;
  }

  return null;
}
