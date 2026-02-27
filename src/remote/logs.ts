import { SSHManager } from './ssh.js';
import type { RemoteHostConfig } from '../core/config/schema.js';

export interface RemoteLogsOptions {
  host: RemoteHostConfig;
  layer: string;
  lines?: number;
  follow?: boolean;
}

/**
 * Stream logs from a remote host's layer.
 * Outputs to stdout and blocks until the process exits or is interrupted.
 */
export async function remoteLogs(options: RemoteLogsOptions): Promise<void> {
  const { host, layer, lines = 50, follow = true } = options;
  const ssh = new SSHManager();

  const cleanup = async () => {
    await ssh.disconnectAll();
  };
  process.on('SIGINT', () => {
    cleanup().then(() => process.exit(130));
  });

  try {
    await ssh.connect(host);

    const codeDir = `/home/${host.user}/code/${layer}`;
    const followFlag = follow ? '-f' : '';
    const logPath = `${codeDir}/logs/app.log`;

    // Check if log file exists; fallback to <layer>.log
    const checkResult = await ssh.exec(host, `test -f "${logPath}" && echo "yes" || echo "no"`);
    const actualPath = checkResult.stdout.trim() === 'yes'
      ? logPath
      : `${codeDir}/${layer}.log`;

    const command = `tail ${followFlag} -n ${lines} "${actualPath}"`;

    // For follow mode, we need to stream the output
    const conn = await ssh.connect(host);
    await new Promise<void>((resolve, reject) => {
      conn.execCommand(command, {
        onStdout: (chunk: Buffer) => process.stdout.write(chunk),
        onStderr: (chunk: Buffer) => process.stderr.write(chunk),
      } as Parameters<typeof conn.execCommand>[1]).then(() => resolve()).catch(reject);
    });
  } finally {
    process.removeAllListeners('SIGINT');
    await ssh.disconnectAll();
  }
}
