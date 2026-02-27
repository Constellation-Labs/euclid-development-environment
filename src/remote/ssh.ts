import { NodeSSH } from 'node-ssh';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { SSHConnectionError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import type { RemoteHostConfig } from '../core/config/schema.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Manages SSH connections to remote hosts with connection reuse and cleanup.
 */
export class SSHManager {
  private connections = new Map<string, NodeSSH>();

  /**
   * Get or create an SSH connection to a host.
   */
  async connect(host: RemoteHostConfig): Promise<NodeSSH> {
    const key = `${host.user}@${host.host}`;
    const existing = this.connections.get(key);

    if (existing?.isConnected()) {
      return existing;
    }

    const ssh = new NodeSSH();
    const sshKeyPath = host.ssh_key.startsWith('~')
      ? resolve(homedir(), host.ssh_key.slice(2))
      : resolve(host.ssh_key);

    logger.debug(`Connecting to ${key}`, { keyPath: sshKeyPath });

    try {
      await ssh.connect({
        host: host.host,
        username: host.user,
        privateKeyPath: sshKeyPath,
        readyTimeout: 30000,
        strictHostKeyChecking: false,
      } as Parameters<NodeSSH['connect']>[0]);

      this.connections.set(key, ssh);
      logger.debug(`Connected to ${key}`);
      return ssh;
    } catch (err) {
      throw new SSHConnectionError(host.host, { cause: err as Error });
    }
  }

  /**
   * Execute a command on a remote host.
   */
  async exec(
    host: RemoteHostConfig,
    command: string,
    options?: { cwd?: string; env?: Record<string, string> },
  ): Promise<ExecResult> {
    const ssh = await this.connect(host);

    // Build the full command with env vars and cwd
    let fullCommand = command;
    if (options?.env) {
      const envStr = Object.entries(options.env)
        .map(([k, v]) => `export ${k}="${v}"`)
        .join(' && ');
      fullCommand = `${envStr} && ${command}`;
    }
    if (options?.cwd) {
      fullCommand = `cd "${options.cwd}" && ${fullCommand}`;
    }

    logger.debug(`[${host.host}] exec: ${fullCommand}`);

    const result = await ssh.execCommand(fullCommand, {
      execOptions: { timeout: 300000 },
    } as Parameters<NodeSSH['execCommand']>[1]);

    const code = result.code ?? 0;
    if (result.stdout) logger.debug(`[${host.host}] stdout: ${result.stdout.slice(0, 500)}`);
    if (result.stderr) logger.debug(`[${host.host}] stderr: ${result.stderr.slice(0, 500)}`);

    return { stdout: result.stdout, stderr: result.stderr, code };
  }

  /**
   * Upload a single file to a remote host.
   */
  async upload(host: RemoteHostConfig, localPath: string, remotePath: string): Promise<void> {
    const ssh = await this.connect(host);
    logger.debug(`[${host.host}] upload: ${localPath} → ${remotePath}`);
    await ssh.putFile(localPath, remotePath);
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
      throw new Error(`Failed to upload ${failed.length} file(s) to ${host.host}`);
    }
  }

  /**
   * Create directories on a remote host.
   */
  async mkdir(host: RemoteHostConfig, remotePath: string): Promise<void> {
    await this.exec(host, `mkdir -p "${remotePath}"`);
  }

  /**
   * Disconnect all SSH connections.
   */
  async disconnectAll(): Promise<void> {
    for (const [key, ssh] of this.connections) {
      logger.debug(`Disconnecting from ${key}`);
      ssh.dispose();
    }
    this.connections.clear();
  }
}
