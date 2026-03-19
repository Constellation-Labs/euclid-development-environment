import { execFile } from 'node:child_process';
import type { CheckResult } from '../index.js';

/**
 * Check if Docker is installed, running, and meets version requirements.
 */
export async function checkDocker(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check Docker installation
  const version = await getCommandVersion('docker', ['--version'], /Docker version (\S+)/);
  if (!version) {
    results.push({
      name: 'Docker',
      status: 'error',
      message: 'Docker is not installed',
      fix: 'Install Docker Desktop: https://docs.docker.com/get-docker/',
    });
    return results;
  }

  const minVersion = '26.0.0';
  if (compareVersions(version, minVersion) < 0) {
    results.push({
      name: 'Docker',
      status: 'error',
      message: `Docker ${version} is too old (required: >= ${minVersion})`,
      fix: 'Update Docker Desktop to the latest version.',
    });
  } else {
    results.push({
      name: 'Docker',
      status: 'pass',
      message: `${version} (required: >= ${minVersion})`,
    });
  }

  // Check Docker Compose
  const composeVersion = await getCommandVersion(
    'docker',
    ['compose', 'version', '--short'],
    /^v?(\S+)/m,
  );
  if (composeVersion) {
    results.push({
      name: 'Docker Compose',
      status: 'pass',
      message: composeVersion,
    });
  } else {
    results.push({
      name: 'Docker Compose',
      status: 'error',
      message: 'Docker Compose v2 not found',
      fix: 'Docker Compose v2 should be bundled with Docker Desktop >= 26.',
    });
  }

  // Check Docker is running
  const running = await isDockerRunning();
  results.push({
    name: 'Docker running',
    status: running ? 'pass' : 'error',
    message: running ? 'daemon is responsive' : 'daemon is not running',
    fix: running
      ? undefined
      : 'Start Docker Desktop (macOS) or run: sudo systemctl start docker (Linux)',
  });

  return results;
}

/**
 * Check Docker memory allocation.
 */
export async function checkDockerMemory(): Promise<CheckResult> {
  try {
    const info = await execCommand('docker', ['info', '--format', '{{.MemTotal}}']);
    const bytes = parseInt(info.trim(), 10);

    if (Number.isNaN(bytes) || bytes <= 0) {
      return {
        name: 'Docker memory',
        status: 'warn',
        message: 'Could not parse Docker memory allocation',
      };
    }

    const gb = bytes / (1024 * 1024 * 1024);
    const minGb = 4;

    if (gb < minGb) {
      return {
        name: 'Docker memory',
        status: 'warn',
        message: `${gb.toFixed(1)} GB allocated (recommended: >= ${minGb} GB)`,
        fix: 'Increase Docker memory allocation in Docker Desktop Settings > Resources.',
      };
    }

    return {
      name: 'Docker memory',
      status: 'pass',
      message: `${gb.toFixed(1)} GB allocated (recommended: >= ${minGb} GB)`,
    };
  } catch {
    return {
      name: 'Docker memory',
      status: 'warn',
      message: 'Could not determine Docker memory allocation',
    };
  }
}

async function isDockerRunning(): Promise<boolean> {
  try {
    await execCommand('docker', ['info']);
    return true;
  } catch {
    return false;
  }
}

async function getCommandVersion(
  cmd: string,
  args: string[],
  regex: RegExp,
): Promise<string | null> {
  try {
    const output = await execCommand(cmd, args);
    const match = output.match(regex);
    return match?.[1]?.replace(/,$/, '') ?? null;
  } catch {
    return null;
  }
}

function execCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}
