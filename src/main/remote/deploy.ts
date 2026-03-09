import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { SSHManager } from './ssh.js';
import { RemoteDeployError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { EuclidConfig, RemoteHostConfig } from '../config/schema.js';

export interface DeployOptions {
  config: EuclidConfig;
  projectRoot: string;
  forceGenesis?: boolean;
  onProgress?: (host: string, step: string) => void;
}

/**
 * Deploy JARs, keys, and genesis files to all remote hosts.
 */
export async function remoteDeploy(options: DeployOptions): Promise<void> {
  const { config, projectRoot, forceGenesis } = options;
  const deploy = config.deploy;

  if (!deploy) {
    throw new RemoteDeployError('(config)', 'No deploy configuration found in euclid.json');
  }

  const ssh = new SSHManager();
  const dockerPath = resolve(projectRoot, 'docker');
  const dataPath = resolve(projectRoot, 'data');
  const jarsDir = resolve(dockerPath, 'artifacts', 'jars');

  // Validate local artifacts exist
  const requiredJars = ['cl-keytool.jar', 'cl-wallet.jar', 'metagraph-l0.jar'];
  if (config.layers.includes('currency-l1')) requiredJars.push('currency-l1.jar');
  if (config.layers.includes('data-l1')) requiredJars.push('data-l1.jar');

  for (const jar of requiredJars) {
    if (!existsSync(resolve(jarsDir, jar))) {
      throw new RemoteDeployError('(local)', `Missing JAR: ${jar}. Run 'hydra build' first.`);
    }
  }

  const remoteLayers = getRemoteLayers(config);

  try {
    // Deploy to each host (one host per node)
    for (let i = 0; i < deploy.hosts.length; i++) {
      const host = deploy.hosts[i];
      const node = config.nodes[i];
      if (!node) break;

      const progress = (step: string) => options.onProgress?.(host.host, step);

      progress('Connecting...');
      await ssh.connect(host);

      // Create directory structure
      progress('Creating directories...');
      for (const layer of remoteLayers) {
        await ssh.mkdir(host, remoteCodeDir(host, layer));
      }

      // Upload JARs
      progress('Uploading JARs...');
      for (const layer of remoteLayers) {
        const remoteDir = remoteCodeDir(host, layer);

        // Utility JARs go to every layer
        await ssh.upload(host, resolve(jarsDir, 'cl-keytool.jar'), `${remoteDir}/cl-keytool.jar`);
        await ssh.upload(host, resolve(jarsDir, 'cl-wallet.jar'), `${remoteDir}/cl-wallet.jar`);

        // Layer-specific JAR
        const jarName = `${layer}.jar`;
        if (existsSync(resolve(jarsDir, jarName))) {
          await ssh.upload(host, resolve(jarsDir, jarName), `${remoteDir}/${jarName}`);
        }
      }

      // Upload p12 keys
      progress('Uploading keys...');
      const p12Path = resolve(dataPath, 'p12-files', node.key_file.name);
      if (existsSync(p12Path)) {
        for (const layer of remoteLayers) {
          const remoteDir = remoteCodeDir(host, layer);
          await ssh.upload(host, p12Path, `${remoteDir}/${node.key_file.name}`);
        }
      } else {
        logger.warn(`P12 file not found: ${p12Path}`);
      }

      // Upload genesis files (only on genesis deploy for metagraph-l0)
      if (forceGenesis || !(await hasExistingData(ssh, host))) {
        progress('Uploading genesis files...');
        const ml0Dir = remoteCodeDir(host, 'metagraph-l0');

        const genesisCsv = resolve(dataPath, 'metagraph-l0', 'genesis', 'genesis.csv');
        if (existsSync(genesisCsv)) {
          await ssh.upload(host, genesisCsv, `${ml0Dir}/genesis.csv`);
        }

        const genesisSnapshot = resolve(dockerPath, 'artifacts', 'genesis', 'genesis.snapshot');
        if (existsSync(genesisSnapshot)) {
          await ssh.upload(host, genesisSnapshot, `${ml0Dir}/genesis.snapshot`);
        }

        const genesisAddress = resolve(dockerPath, 'artifacts', 'genesis', 'genesis.address');
        if (existsSync(genesisAddress)) {
          await ssh.upload(host, genesisAddress, `${ml0Dir}/genesis.address`);
        }
      }

      // Upload snapshot fee keys if configured
      if (config.snapshot_fees) {
        progress('Uploading snapshot fee keys...');
        const ml0Dir = remoteCodeDir(host, 'metagraph-l0');

        const ownerP12 = resolve(dataPath, 'p12-files', config.snapshot_fees.owner.key_file.name);
        if (existsSync(ownerP12)) {
          await ssh.upload(host, ownerP12, `${ml0Dir}/${config.snapshot_fees.owner.key_file.name}`);
        }

        const stakingP12 = resolve(
          dataPath,
          'p12-files',
          config.snapshot_fees.staking.key_file.name,
        );
        if (existsSync(stakingP12)) {
          await ssh.upload(
            host,
            stakingP12,
            `${ml0Dir}/${config.snapshot_fees.staking.key_file.name}`,
          );
        }
      }

      progress('Done');
    }
  } finally {
    await ssh.disconnectAll();
  }
}

function remoteCodeDir(host: RemoteHostConfig, layer: string): string {
  return `/home/${host.user}/code/${layer}`;
}

function getRemoteLayers(config: EuclidConfig): string[] {
  const layers: string[] = ['metagraph-l0'];
  if (config.layers.includes('currency-l1')) layers.push('currency-l1');
  if (config.layers.includes('data-l1')) layers.push('data-l1');
  return layers;
}

async function hasExistingData(ssh: SSHManager, host: RemoteHostConfig): Promise<boolean> {
  try {
    const result = await ssh.exec(
      host,
      `test -d "${remoteCodeDir(host, 'metagraph-l0')}/data/incremental_snapshot" && echo "yes" || echo "no"`,
    );
    return result.stdout.trim() === 'yes';
  } catch {
    return false;
  }
}
