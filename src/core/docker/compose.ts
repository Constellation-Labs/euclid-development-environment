import { execFile } from 'node:child_process';
import { logger } from '../logger.js';
import { DockerError } from '../errors.js';

export interface ComposeRunOptions {
  cwd: string;
  file?: string;
  env?: Record<string, string>;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
}

/**
 * Run docker compose commands as subprocesses.
 * Uses `docker compose` (v2) — Docker >= 26 always has it.
 */
export async function composeBuild(options: ComposeRunOptions): Promise<void> {
  const args = ['compose'];

  if (options.file) {
    args.push('-f', options.file);
  }

  args.push('build');

  if (options.noCache) {
    args.push('--no-cache');
  }

  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  await runDocker(args, options.cwd, options.env);
}

export async function composeUp(options: ComposeRunOptions): Promise<void> {
  const args = ['compose'];

  if (options.file) {
    args.push('-f', options.file);
  }

  args.push('up', '-d');

  await runDocker(args, options.cwd, options.env);
}

export async function composeDown(options: ComposeRunOptions): Promise<void> {
  const args = ['compose'];

  if (options.file) {
    args.push('-f', options.file);
  }

  args.push('down');

  await runDocker(args, options.cwd, options.env);
}

function runDocker(
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...extraEnv };

    logger.debug(`Running: docker ${args.join(' ')}`, { cwd });

    const proc = execFile('docker', args, { cwd, env, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr.trim() || stdout.trim() || error.message;
        reject(
          new DockerError(`docker ${args.slice(0, 2).join(' ')} failed: ${msg}`, {
            cause: error,
          }),
        );
        return;
      }
      resolve({ stdout, stderr });
    });

    // Stream output in real time for verbose mode
    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug(data.toString().trimEnd());
    });
    proc.stderr?.on('data', (data: Buffer) => {
      logger.debug(data.toString().trimEnd());
    });
  });
}
