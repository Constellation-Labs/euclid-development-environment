import { SSHManager } from './ssh.js';
import { remoteCodeDir, getConfiguredRemoteLayers } from './paths.js';
import { logger } from '../shared/logger.js';
import { RemoteError } from '../shared/errors.js';
import type { EuclidConfig } from '../config/schema.js';

export interface RemoteDestroyOptions {
  config: EuclidConfig;
  onProgress?: (host: string, step: string) => void;
}

/**
 * Destroy metagraph data and processes on remote hosts.
 * Stops all processes, then removes code directories (JARs, logs, data, keys).
 */
export async function remoteDestroy(options: RemoteDestroyOptions): Promise<void> {
  const { config } = options;
  const deploy = config.deploy;

  if (!deploy) {
    throw new RemoteError('No deploy configuration found in euclid.json');
  }

  const ssh = new SSHManager();
  const progress = (host: string, step: string) => options.onProgress?.(host, step);

  const layers = getConfiguredRemoteLayers(config);

  try {
    for (const host of deploy.hosts) {
      progress(host.host, 'Connecting...');
      await ssh.connect(host);

      // Kill all Java processes first
      progress(host.host, 'Stopping processes...');
      for (const layer of layers) {
        await ssh.exec(host, `pkill -9 -f "${layer}.jar" 2>/dev/null || true`);
      }
      await ssh.exec(host, 'sleep 1');

      // Remove code directories
      progress(host.host, 'Removing code directories...');
      for (const layer of layers) {
        const dir = remoteCodeDir(host, layer);
        await ssh.exec(host, `rm -rf "${dir}"`);
        logger.debug(`[${host.host}] Removed ${dir}`);
      }

      // Remove archive directory
      const archiveDir = `/home/${host.user}/code/archive`;
      await ssh.exec(host, `rm -rf "${archiveDir}"`);

      progress(host.host, 'Done ✓');
    }
  } finally {
    await ssh.disconnectAll(5000);
  }
}
