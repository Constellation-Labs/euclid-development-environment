import { NodeSSH } from 'node-ssh';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { SSHConnectionError, errorMessage, shellEscape } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { RemoteHostConfig } from '../config/schema.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Default retry options for SSH operations. */
const DEFAULT_RETRY = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000 };

/**
 * Sleep with exponential backoff + jitter.
 * delay = min(baseDelay * 2^attempt + jitter, maxDelay)
 */
function backoffDelay(attempt: number, baseMs: number, maxMs: number): Promise<void> {
  const jitter = Math.random() * baseMs * 0.3;
  const delay = Math.min(baseMs * Math.pow(2, attempt) + jitter, maxMs);
  return new Promise((r) => setTimeout(r, delay));
}

/**
 * Manages SSH connections to remote hosts with connection reuse, retry, and cleanup.
 */
export class SSHManager {
  private connections = new Map<string, NodeSSH>();

  /**
   * Get or create an SSH connection to a host.
   * Retries with exponential backoff on transient failures.
   */
  async connect(host: RemoteHostConfig): Promise<NodeSSH> {
    const key = `${host.user}@${host.host}`;
    const existing = this.connections.get(key);

    if (existing?.isConnected()) {
      return existing;
    }

    const sshKeyPath = this.resolveKeyPath(host);
    const { maxAttempts, baseDelayMs, maxDelayMs } = DEFAULT_RETRY;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const ssh = new NodeSSH();
      logger.debug(`Connecting to ${key} (attempt ${attempt + 1}/${maxAttempts})`, {
        keyPath: sshKeyPath,
      });

      try {
        await ssh.connect({
          host: host.host,
          username: host.user,
          privateKeyPath: sshKeyPath,
          readyTimeout: 30000,
          strictHostKeyChecking: false,
        } as Parameters<NodeSSH['connect']>[0]);

        // Suppress connection-level errors that occur during/after disconnect
        // (e.g. ECONNRESET from detached background channels)
        ssh.connection?.on('error', (err: Error) => {
          logger.debug(`SSH connection error on ${key}: ${err.message}`);
        });

        this.connections.set(key, ssh);
        logger.debug(`Connected to ${key}`);
        return ssh;
      } catch (err) {
        const isLast = attempt === maxAttempts - 1;
        if (isLast) {
          throw new SSHConnectionError(host.host, {
            cause: err instanceof Error ? err : new Error(errorMessage(err)),
          });
        }
        logger.debug(
          `Connection to ${key} failed (attempt ${attempt + 1}): ${errorMessage(err)}. Retrying...`,
        );
        await backoffDelay(attempt, baseDelayMs, maxDelayMs);
      }
    }

    // Should never reach here, but satisfy TypeScript
    throw new SSHConnectionError(host.host, { cause: new Error('Max retries exhausted') });
  }

  /**
   * Execute a command on a remote host.
   * Retries transient SSH failures (connection reset, timeout) with backoff.
   */
  async exec(
    host: RemoteHostConfig,
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; retries?: number },
  ): Promise<ExecResult> {
    // Build the full command with env vars and cwd
    let fullCommand = command;
    if (options?.env) {
      const envStr = Object.entries(options.env)
        .map(([k, v]) => `export ${k}="${shellEscape(v)}"`)
        .join(' && ');
      fullCommand = `${envStr} && ${command}`;
    }
    if (options?.cwd) {
      fullCommand = `cd "${options.cwd}" && ${fullCommand}`;
    }

    const maxAttempts = options?.retries ?? 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const ssh = await this.connect(host);

        logger.debug(`[${host.host}] exec: ${summarizeCommand(fullCommand)}`);

        const result = await ssh.execCommand(fullCommand, {
          execOptions: { timeout: 300000 },
        } as Parameters<NodeSSH['execCommand']>[1]);

        const code = result.code ?? 0;
        if (result.stdout) {
          const out = result.stdout.trim().replace(/\n/g, ' ').slice(0, 200);
          logger.debug(`[${host.host}] → ${out}`);
        }
        if (result.stderr) {
          const err = result.stderr.trim().replace(/\n/g, ' ').slice(0, 200);
          logger.debug(`[${host.host}] stderr: ${err}`);
        }

        return { stdout: result.stdout, stderr: result.stderr, code };
      } catch (err) {
        const isTransient = isTransientError(err);
        const isLast = attempt === maxAttempts - 1;

        if (!isTransient || isLast) throw err;

        logger.debug(
          `[${host.host}] exec failed (attempt ${attempt + 1}): ${errorMessage(err)}. Retrying...`,
        );
        // Force reconnect on next attempt
        this.dropConnection(host);
        await backoffDelay(attempt, 1000, 5000);
      }
    }

    // Should never reach here — satisfies TypeScript control-flow analysis
    throw new SSHConnectionError(host.host, {
      cause: new Error('Max exec retries exhausted'),
    });
  }

  /**
   * Drop a cached connection (used before retry to force reconnect).
   */
  private dropConnection(host: RemoteHostConfig): void {
    const key = `${host.user}@${host.host}`;
    const existing = this.connections.get(key);
    if (existing) {
      existing.dispose();
      this.connections.delete(key);
    }
  }

  /**
   * Resolve the SSH key path (expand ~ to homedir).
   */
  private resolveKeyPath(host: RemoteHostConfig): string {
    return host.ssh_key.startsWith('~')
      ? resolve(homedir(), host.ssh_key.slice(2))
      : resolve(host.ssh_key);
  }

  /**
   * Upload a single file to a remote host using scp.
   * Uses scp instead of SFTP (node-ssh putFile) because SFTP frequently
   * fails with "Failure" on large files (80MB+ JARs).
   */
  async upload(host: RemoteHostConfig, localPath: string, remotePath: string): Promise<void> {
    const keyPath = this.resolveKeyPath(host);
    const target = `${host.user}@${host.host}:${remotePath}`;
    logger.debug(`[${host.host}] scp: ${localPath} → ${remotePath}`);

    return new Promise((res, rej) => {
      execFile(
        'scp',
        [
          '-i',
          keyPath,
          '-o',
          'StrictHostKeyChecking=no',
          '-o',
          'UserKnownHostsFile=/dev/null',
          '-o',
          'LogLevel=ERROR',
          localPath,
          target,
        ],
        { timeout: 600000 },
        (error, _stdout, stderr) => {
          if (error) {
            const reason = stderr.trim() || error.message;
            rej(
              new SSHConnectionError(host.host, {
                cause: new Error(
                  `Upload failed: ${localPath} → ${remotePath}\n  Reason: ${reason}`,
                ),
              }),
            );
            return;
          }
          res();
        },
      );
    });
  }

  /**
   * Upload a directory to a remote host.
   */
  async uploadDir(
    host: RemoteHostConfig,
    localDir: string,
    remoteDir: string,
    options?: { exclude?: string[] },
  ): Promise<void> {
    const ssh = await this.connect(host);
    logger.debug(`[${host.host}] uploadDir: ${localDir} → ${remoteDir}`);

    const failed: string[] = [];
    await ssh.putDirectory(localDir, remoteDir, {
      recursive: true,
      concurrency: 5,
      validate: (itemPath: string) => {
        if (options?.exclude) {
          return !options.exclude.some((ex) => itemPath.includes(ex));
        }
        return true;
      },
      tick: (localFile: string, _remoteFile: string, error: Error | null) => {
        if (error) {
          failed.push(localFile);
          logger.debug(`[${host.host}] upload failed: ${localFile} — ${error.message}`);
        }
      },
    });

    if (failed.length > 0) {
      throw new SSHConnectionError(host.host, {
        cause: new Error(`Failed to upload ${failed.length} file(s)`),
      });
    }
  }

  /**
   * Execute a command on a remote host without waiting for it to complete.
   * Used for launching long-running background processes (e.g. Java daemons).
   * Sends the command, waits briefly for it to start, then resolves.
   */
  async execDetached(
    host: RemoteHostConfig,
    command: string,
    options?: { cwd?: string },
  ): Promise<void> {
    const ssh = await this.connect(host);

    let fullCommand = command;
    if (options?.cwd) {
      fullCommand = `cd "${options.cwd}" && ${fullCommand}`;
    }

    logger.debug(`[${host.host}] execDetached: ${summarizeCommand(fullCommand)}`);

    const conn = ssh.connection;
    if (!conn) {
      throw new SSHConnectionError(host.host, {
        cause: new Error('Connection not available for detached execution'),
      });
    }

    return new Promise<void>((resolve, reject) => {
      conn.exec(
        fullCommand,
        (
          err: Error | undefined,
          channel: NodeJS.ReadableStream & { stderr: NodeJS.ReadableStream },
        ) => {
          if (err) return reject(err);

          // Suppress unhandled error events on the channel (prevents ECONNRESET crashes)
          channel.on('error', () => {});
          channel.stderr?.on('error', () => {});

          // Collect any early output for debugging
          let stdout = '';
          channel.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          // Give the command time to start, then resolve without waiting for close
          setTimeout(() => {
            if (stdout.trim()) {
              logger.debug(`[${host.host}] execDetached stdout: ${stdout.slice(0, 300)}`);
            }
            resolve();
          }, 2000);
        },
      );
    });
  }

  /**
   * Create directories on a remote host.
   */
  async mkdir(host: RemoteHostConfig, remotePath: string): Promise<void> {
    await this.exec(host, `mkdir -p "${remotePath}"`);
  }

  /**
   * Disconnect all SSH connections with a safety timeout.
   * Prevents the process from hanging if a connection is unresponsive.
   */
  async disconnectAll(timeoutMs = 10000): Promise<void> {
    // Snapshot connections to iterate safely — prevents race with timeout clearing the map
    const snapshot = [...this.connections.entries()];
    this.connections.clear();

    const disconnectPromise = (async () => {
      for (const [key, ssh] of snapshot) {
        logger.debug(`Disconnecting from ${key}`);
        try {
          ssh.dispose();
        } catch (err) {
          logger.debug(`Error disposing ${key}: ${errorMessage(err)}`);
        }
      }
    })();

    // Race against a timeout to prevent hanging
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.debug(`SSH disconnectAll timed out after ${timeoutMs}ms — forcing cleanup`);
        resolve();
      }, timeoutMs);
    });

    await Promise.race([disconnectPromise, timeout]);
  }
}

/**
 * Check if an error is a transient SSH/network issue worth retrying.
 */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('connection reset') ||
    msg.includes('broken pipe') ||
    msg.includes('not connected') ||
    msg.includes('channel open failure')
  );
}

/**
 * Summarize a shell command for debug logging.
 * Strips env var exports, cd prefixes, and long arguments to keep logs readable.
 */
function summarizeCommand(cmd: string): string {
  let s = cmd;

  // Strip cd "..." && prefix
  s = s.replace(/^cd "[^"]*" && /, '');

  // Strip export VAR="val" && chains
  s = s.replace(/(export \S+="[^"]*" && )+/g, '');

  // Strip setsid env VAR="val" ... java → java
  s = s.replace(/setsid env (\S+="[^"]*" )*/, '');

  // Truncate long hex IDs (128-char node IDs) to first 12 chars
  s = s.replace(/([0-9a-f]{12})[0-9a-f]{20,}/g, '$1…');

  // Truncate remaining long strings
  if (s.length > 200) s = s.slice(0, 200) + '…';

  return s;
}
