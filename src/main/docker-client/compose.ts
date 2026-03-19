import { execFile } from 'node:child_process';
import { logger } from '../shared/logger.js';
import { DockerError } from '../shared/errors.js';

/** Options for running docker compose commands. */
export interface ComposeRunOptions {
  cwd: string;
  file?: string;
  env?: Record<string, string>;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
  /** Called with each line of Docker output (stdout + stderr). */
  onOutput?: (line: string) => void;
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

  await runDocker(args, options.cwd, options.env, options.onOutput);
}

/** Run `docker compose up -d` to start services in detached mode. */
export async function composeUp(options: ComposeRunOptions): Promise<void> {
  const args = ['compose'];

  if (options.file) {
    args.push('-f', options.file);
  }

  args.push('up', '-d');

  await runDocker(args, options.cwd, options.env, options.onOutput);
}

/** Run `docker compose down` to stop and remove services. */
export async function composeDown(options: ComposeRunOptions): Promise<void> {
  const args = ['compose'];

  if (options.file) {
    args.push('-f', options.file);
  }

  args.push('down');

  await runDocker(args, options.cwd, options.env, options.onOutput);
}

function runDocker(
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
  onOutput?: (line: string) => void,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...extraEnv };

    logger.debug(`Running: docker ${args.join(' ')}`, { cwd });

    const proc = execFile(
      'docker',
      args,
      { cwd, env, maxBuffer: 50 * 1024 * 1024, shell: true },
      (error, stdout, stderr) => {
        if (error) {
          const raw = stderr.trim() || stdout.trim() || error.message;
          const summary = cleanDockerError(raw, args);
          reject(
            new DockerError(summary, {
              suggestion: dockerSuggestion(raw),
              cause: error,
            }),
          );
          return;
        }
        resolve({ stdout, stderr });
      },
    );

    // Stream output — to callback if provided, otherwise to debug logger
    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      if (onOutput) {
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) onOutput(trimmed);
        }
      }
      logger.debug(text.trimEnd());
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);
  });
}

/**
 * Extract a short, readable error from Docker's verbose output.
 * Docker dumps the entire Dockerfile RUN command on failure — we trim it
 * to just the meaningful bits: "failed to solve", "exit code", etc.
 */
function cleanDockerError(raw: string, args: string[]): string {
  const command = `docker ${args.slice(0, 2).join(' ')}`;

  // Look for "failed to solve: ..." — grab just the tail reason
  const failedMatch = raw.match(/failed to solve/);
  if (failedMatch) {
    // Extract "exit code: N" if present
    const exitCode = raw.match(/exit code:\s*(\d+)/);
    const codeStr = exitCode ? ` (exit code ${exitCode[1]})` : '';

    // Look for recognizable tool names in the failing command
    const toolMatch = raw.match(
      /\b(curl|wget|sbt|apt-get|apt|npm|pip|git clone|make|javac|scalac)\b/,
    );
    const hint = toolMatch ? `'${toolMatch[1]}' failed` : 'build step failed';

    return `${command}: ${hint}${codeStr}`;
  }

  // Fallback: just truncate
  const first150 = raw.slice(0, 150).replace(/\n/g, ' ');
  return `${command} failed: ${first150}${raw.length > 150 ? '...' : ''}`;
}

/**
 * Build a helpful suggestion based on the error content.
 */
function dockerSuggestion(raw: string): string {
  // curl failure inside Docker — almost always networking
  if (
    raw.includes('curl') &&
    (raw.includes('exit code: 2') || raw.includes('exit code: 6') || raw.includes('exit code: 7'))
  ) {
    return [
      'curl failed inside the Docker build — this is usually a networking issue.',
      '  Try: restart Docker Desktop, then run the build again.',
      "  If behind a proxy, configure Docker's DNS/proxy settings.",
      '  You can also test manually: docker run --rm ubuntu curl -sI https://github.com',
    ].join('\n');
  }

  return 'Run with --verbose to see full Docker output, or run docker compose build manually to debug.';
}
