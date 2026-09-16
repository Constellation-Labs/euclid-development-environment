import { SSHManager } from './ssh.js';
import { getConfiguredRemoteLayers } from './paths.js';
import type { EuclidConfig, RemoteHostConfig } from '../config/schema.js';
import { DEFAULT_REMOTE_PORTS } from './defaults.js';
import { RemoteError } from '../shared/errors.js';

export interface RemoteStopOptions {
  config: EuclidConfig;
  onProgress?: (host: string, step: string) => void;
}

/**
 * Stop all metagraph Java processes on remote hosts.
 * Kills processes by JAR name and by port, then verifies they're dead.
 */
export async function remoteStop(options: RemoteStopOptions): Promise<void> {
  const { config } = options;
  const deploy = config.deploy;

  if (!deploy) {
    throw new RemoteError('No deploy configuration found in euclid.json');
  }

  const ssh = new SSHManager();
  const progress = (host: string, step: string) => options.onProgress?.(host, step);

  const layers = getConfiguredRemoteLayers(config);
  const remotePorts = deploy.remote_ports ?? DEFAULT_REMOTE_PORTS;

  // Collect all ports for all configured layers
  const portSets: Record<string, { public: number; p2p: number; cli: number }> = {
    'metagraph-l0': remotePorts.metagraph_l0,
    'currency-l1': remotePorts.currency_l1,
    'data-l1': remotePorts.data_l1,
  };
  const allPorts: number[] = [];
  for (const layer of layers) {
    const ps = portSets[layer];
    if (ps) allPorts.push(ps.public, ps.p2p, ps.cli);
  }

  try {
    for (const host of deploy.hosts) {
      progress(host.host, 'Connecting...');
      await ssh.connect(host);

      // Kill Java processes by JAR name
      progress(host.host, 'Stopping Java processes...');
      for (const layer of layers) {
        await ssh.exec(host, `pkill -f "${layer}.jar" 2>/dev/null || true`);
      }

      // Kill by port
      for (const port of allPorts) {
        await ssh.exec(host, `fuser -k ${port}/tcp 2>/dev/null || true`);
      }

      // Verify
      await ssh.exec(host, 'sleep 1');
      const stillRunning = await checkProcessesRunning(ssh, host, layers);
      if (stillRunning.length > 0) {
        progress(host.host, `Force-killing: ${stillRunning.join(', ')}...`);
        for (const layer of stillRunning) {
          await ssh.exec(host, `pkill -9 -f "${layer}.jar" 2>/dev/null || true`);
        }
      }

      progress(host.host, 'Done ✓');
    }
  } finally {
    await ssh.disconnectAll(5000);
  }
}

async function checkProcessesRunning(
  ssh: SSHManager,
  host: RemoteHostConfig,
  layers: string[],
): Promise<string[]> {
  const running: string[] = [];
  for (const layer of layers) {
    const result = await ssh.exec(host, `pgrep -f "${layer}.jar" 2>/dev/null || true`);
    if (result.stdout.trim()) {
      running.push(layer);
    }
  }
  return running;
}
