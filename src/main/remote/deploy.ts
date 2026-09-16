import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { SSHManager } from './ssh.js';
import { remoteCodeDir, getConfiguredRemoteLayers } from './paths.js';
import { RemoteDeployError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { EuclidConfig, NodeConfig, RemoteHostConfig } from '../config/schema.js';

export interface DeployOptions {
  config: EuclidConfig;
  projectRoot: string;
  forceGenesis?: boolean;
  onProgress?: (host: string, step: string) => void;
}

/**
 * Deploy JARs, keys, and genesis files to all remote hosts in parallel.
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

  const remoteLayers = getConfiguredRemoteLayers(config);

  try {
    // Deploy to all hosts in parallel
    const tasks = deploy.hosts.map((host, i) => {
      const node = config.nodes[i];
      if (!node) return Promise.resolve();

      return deployToHost({
        ssh,
        host,
        node,
        config,
        jarsDir,
        dataPath,
        dockerPath,
        remoteLayers,
        forceGenesis,
        onProgress: (step) => options.onProgress?.(host.host, step),
      });
    });

    const results = await Promise.allSettled(tasks);

    // Collect failures
    const failures: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const host = deploy.hosts[i].host;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push(`  ${host}: ${msg}`);
      }
    }

    if (failures.length > 0) {
      throw new RemoteDeployError(
        `${failures.length} host(s)`,
        `Deploy failed:\n${failures.join('\n')}`,
      );
    }
  } finally {
    await ssh.disconnectAll();
  }
}

// ─── Per-host deploy ──────────────────────────────────────────────────────

interface HostDeployOptions {
  ssh: SSHManager;
  host: RemoteHostConfig;
  node: NodeConfig;
  config: EuclidConfig;
  jarsDir: string;
  dataPath: string;
  dockerPath: string;
  remoteLayers: string[];
  forceGenesis?: boolean;
  onProgress: (step: string) => void;
}

async function deployToHost(opts: HostDeployOptions): Promise<void> {
  const { ssh, host, node, config, jarsDir, dataPath, dockerPath, remoteLayers, forceGenesis } =
    opts;
  const progress = opts.onProgress;

  try {
    progress('Connecting...');
    await ssh.connect(host);

    // ── Genesis deploy: archive old data first, before any uploads ──
    if (forceGenesis) {
      if (await hasExistingData(ssh, host, remoteLayers)) {
        progress('Archiving existing data...');
        await archiveExistingData(ssh, host, remoteLayers);
      }
    }

    // Create directory structure (also recreates dirs after archive moved them)
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

    // ── Genesis deploy: upload keys + genesis + fee keys ──
    if (forceGenesis) {
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

      // Upload genesis files
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

      // Upload snapshot fee keys if configured
      if (config.snapshot_fees) {
        progress('Uploading snapshot fee keys...');

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
    }

    progress('Done ✓');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    progress(`Failed ✗`);
    throw new RemoteDeployError(host.host, msg, {
      cause: err instanceof Error ? err : new Error(msg),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Archive all existing layer directory contents before a fresh genesis deploy.
 * Moves each layer directory to a timestamped archive folder
 * so the previous state is preserved and recoverable, then recreates the empty dir.
 */
async function archiveExistingData(
  ssh: SSHManager,
  host: RemoteHostConfig,
  remoteLayers: string[],
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archiveBase = `/home/${host.user}/code/archive/${timestamp}`;

  await ssh.exec(host, `mkdir -p "${archiveBase}"`);

  for (const layer of remoteLayers) {
    const layerDir = remoteCodeDir(host, layer);
    // Move entire layer directory to archive, then recreate it empty
    await ssh.exec(
      host,
      `if [ -d "${layerDir}" ] && [ "$(ls -A "${layerDir}" 2>/dev/null)" ]; then ` +
        `mv "${layerDir}" "${archiveBase}/${layer}" && ` +
        `mkdir -p "${layerDir}"; ` +
        `fi`,
    );
  }

  logger.debug(`[${host.host}] Archived existing data to ${archiveBase}`);
}

/**
 * Check if any layer code directory has existing content (JARs, data, keys, etc.).
 */
async function hasExistingData(
  ssh: SSHManager,
  host: RemoteHostConfig,
  remoteLayers: string[],
): Promise<boolean> {
  try {
    for (const layer of remoteLayers) {
      const dir = remoteCodeDir(host, layer);
      const result = await ssh.exec(
        host,
        `if [ -d "${dir}" ] && [ "$(ls -A "${dir}" 2>/dev/null)" ]; then echo "yes"; else echo "no"; fi`,
      );
      if (result.stdout.trim() === 'yes') return true;
    }
    return false;
  } catch (err) {
    logger.debug(
      `Failed to check existing data on ${host.host}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
