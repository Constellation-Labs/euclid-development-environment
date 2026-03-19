import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { input, select, confirm } from '@inquirer/prompts';
import {
  loadConfig,
  DockerClient,
  logger,
  LogLevel,
  writeConfigAtomic,
  findConfigPath,
  findProjectRoot,
} from '../../../index.js';
import type { EuclidConfig, DeployConfig } from '../../../index.js';
import {
  formatError,
  formatSuccess,
  formatHeader,
  formatStep,
  formatKeyValue,
} from '../../ui/format.js';
import { t } from '../../ui/theme.js';

// ─── Placeholder Detection ──────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [':gl0_node_ip', ':gl0_node_id', ':gl0_node_public_port'];

function hasPlaceholders(deploy: DeployConfig): boolean {
  const net = deploy.network;
  return (
    PLACEHOLDER_PATTERNS.includes(net.gl0_node.ip) ||
    PLACEHOLDER_PATTERNS.includes(net.gl0_node.id) ||
    PLACEHOLDER_PATTERNS.includes(String(net.gl0_node.public_port)) ||
    net.name === 'integrationnet|mainnet' ||
    net.name === 'testnet|integrationnet|mainnet'
  );
}

function hasEmptyHosts(deploy: DeployConfig): boolean {
  return !deploy.hosts || deploy.hosts.length === 0;
}

// ─── Interactive Config Prompts ─────────────────────────────────────────────

async function promptDeployConfig(config: EuclidConfig): Promise<EuclidConfig> {
  if (!config.deploy) {
    throw new Error('No deploy configuration found in euclid.json');
  }
  const deploy = config.deploy;
  const net = deploy.network;
  let changed = false;

  // ── Network name ─────────────────────────────────────────
  if (net.name === 'integrationnet|mainnet' || net.name === 'testnet|integrationnet|mainnet') {
    process.stdout.write(
      `\n  ${t.warn('⚠')}  Deploy config has placeholder values. Let's fill them in.\n\n`,
    );

    net.name = await select({
      message: 'Target network:',
      choices: [
        { name: 'TestNet', value: 'testnet' },
        { name: 'IntegrationNet', value: 'integrationnet' },
        { name: 'MainNet', value: 'mainnet' },
      ],
    });
    changed = true;
  }

  // ── GL0 Node IP ──────────────────────────────────────────
  if (net.gl0_node.ip === ':gl0_node_ip') {
    net.gl0_node.ip = await input({
      message: 'Global L0 node IP address:',
      validate: (v) => v.trim().length > 0 || 'IP address is required',
    });
    changed = true;
  }

  // ── GL0 Node ID ──────────────────────────────────────────
  if (net.gl0_node.id === ':gl0_node_id') {
    net.gl0_node.id = await input({
      message: 'Global L0 node ID:',
      validate: (v) => v.trim().length > 10 || 'Node ID must be at least 10 characters',
    });
    changed = true;
  }

  // ── GL0 Public Port ──────────────────────────────────────
  if (String(net.gl0_node.public_port) === ':gl0_node_public_port') {
    const portStr = await input({
      message: 'Global L0 public port:',
      default: '9000',
      validate: (v) => {
        const n = Number(v);
        return (Number.isInteger(n) && n >= 1 && n <= 65535) || 'Must be a valid port (1-65535)';
      },
    });
    net.gl0_node.public_port = Number(portStr);
    changed = true;
  }

  // ── Remote Hosts ─────────────────────────────────────────
  if (hasEmptyHosts(deploy)) {
    process.stdout.write(
      `\n  ${t.warn('⚠')}  No remote hosts configured. You need at least 3 hosts.\n\n`,
    );

    const hostCount = config.nodes.length;
    deploy.hosts = [];

    for (let i = 0; i < hostCount; i++) {
      process.stdout.write(
        `  ${t.primary(`Host ${i + 1} of ${hostCount}`)} (for ${t.white(config.nodes[i].name)})\n`,
      );

      const host = await input({
        message: `  IP/hostname:`,
        validate: (v) => v.trim().length > 0 || 'Host is required',
      });

      const user = await input({
        message: `  SSH user:`,
        default: 'root',
        validate: (v) => v.trim().length > 0 || 'User is required',
      });

      const sshKey = await input({
        message: `  SSH key path:`,
        default: '~/.ssh/id_rsa',
        validate: (v) => v.trim().length > 0 || 'SSH key path is required',
      });

      deploy.hosts.push({ host: host.trim(), user: user.trim(), ssh_key: sshKey.trim() });
      process.stdout.write('\n');
    }
    changed = true;
  }

  // ── Save if changed ──────────────────────────────────────
  if (changed) {
    const configPath = findConfigPath();
    if (configPath) {
      const rawContent = await readFile(configPath, 'utf-8');
      const rawConfig = JSON.parse(rawContent) as Record<string, unknown>;

      // Merge updated deploy section back into raw config
      rawConfig.deploy = deploy;
      await writeConfigAtomic(configPath, rawConfig);
      process.stdout.write(`  ${t.accent('✓')} Config saved to ${t.dim('euclid.json')}\n\n`);
    }

    // Reload config to get validated version
    return loadConfig();
  }

  return config;
}

// ─── JVM Configuration Prompt ───────────────────────────────────────────────

const LAYER_JVM_KEYS = ['metagraph_l0', 'currency_l1', 'data_l1'] as const;
const LAYER_JVM_LABELS: Record<string, string> = {
  metagraph_l0: 'Metagraph L0',
  currency_l1: 'Currency L1',
  data_l1: 'Data L1',
};

async function promptJvmConfig(config: EuclidConfig): Promise<EuclidConfig> {
  if (!config.deploy) {
    throw new Error('No deploy configuration found in euclid.json');
  }
  const deploy = config.deploy;
  const jvm = deploy.jvm;

  // Show current per-layer settings
  process.stdout.write(`  ${t.dim('Current JVM heap settings:')}\n`);
  for (const layerKey of LAYER_JVM_KEYS) {
    if (!config.layers.includes(layerKey.replace('_', '-') as (typeof config.layers)[number])) {
      continue;
    }
    const label = LAYER_JVM_LABELS[layerKey];
    const layerCfg = jvm[layerKey];
    process.stdout.write(
      `    ${t.white(label.padEnd(14))} -Xms=${layerCfg.xms}  -Xmx=${layerCfg.xmx}\n`,
    );
  }
  process.stdout.write('\n');

  const customize = await confirm({
    message: 'Customize JVM heap settings?',
    default: false,
  });

  if (!customize) return config;

  let changed = false;

  // Per-layer settings
  const activeLayers = LAYER_JVM_KEYS.filter((k) =>
    config.layers.includes(k.replace('_', '-') as (typeof config.layers)[number]),
  );

  for (const layerKey of activeLayers) {
    const label = LAYER_JVM_LABELS[layerKey];
    const current = jvm[layerKey];
    const edit = await confirm({
      message: `Edit heap settings for ${label} (current: -Xms=${current.xms} -Xmx=${current.xmx})?`,
      default: false,
    });

    if (!edit) continue;

    jvm[layerKey].xms = await input({
      message: `${label} -Xms (min heap):`,
      default: current.xms,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "4g" or "512m"',
    });
    jvm[layerKey].xmx = await input({
      message: `${label} -Xmx (max heap):`,
      default: current.xmx,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "8g" or "1024m"',
    });
    changed = true;
  }

  // Save if changed
  if (changed) {
    const configPath = findConfigPath();
    if (configPath) {
      const rawContent = await readFile(configPath, 'utf-8');
      const rawConfig = JSON.parse(rawContent) as Record<string, unknown>;
      (rawConfig.deploy as Record<string, unknown>).jvm = jvm;
      await writeConfigAtomic(configPath, rawConfig);
      process.stdout.write(`\n  ${t.accent('✓')} JVM config saved to ${t.dim('euclid.json')}\n\n`);
    }
  }

  return config;
}

// ─── Main Command ───────────────────────────────────────────────────────────

export async function createRemoteGenesisCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    let config = await loadConfig();
    const projectRoot = findProjectRoot();
    const dataPath = resolve(projectRoot, 'data');

    // Validate deploy config exists
    if (!config.deploy) {
      process.stderr.write(`\n  ${t.error('✗')} No deploy configuration found in euclid.json.\n`);
      process.stderr.write(
        `    Add a ${t.cyan('"deploy"')} section to enable remote genesis creation.\n\n`,
      );
      process.exit(1);
    }

    // Validate at least 3 nodes
    if (config.nodes.length < 3) {
      process.stderr.write(
        `\n  ${t.error('✗')} At least 3 nodes are required for remote genesis.\n`,
      );
      process.stderr.write(
        `    Currently configured: ${t.cyan(String(config.nodes.length))} node(s)\n\n`,
      );
      process.exit(1);
    }

    // Validate p12 files exist
    for (const node of config.nodes) {
      const p12Path = resolve(dataPath, 'p12-files', node.key_file.name);
      if (!existsSync(p12Path)) {
        process.stderr.write(
          `\n  ${t.error('✗')} P12 file not found for ${t.white(node.name)}: ${t.dim(p12Path)}\n\n`,
        );
        process.exit(1);
      }
    }

    // ── Interactive config if placeholders detected ──────────
    if (hasPlaceholders(config.deploy)) {
      config = await promptDeployConfig(config);
    }

    // ── JVM configuration ────────────────────────────────────
    config = await promptJvmConfig(config);

    if (!config.deploy) {
      throw new Error('Deploy configuration was lost after JVM config step');
    }
    const net = config.deploy.network;
    const docker = new DockerClient();
    const { version } = await docker.checkConnection();
    logger.debug(`Docker ${version} connected`);

    process.stdout.write(formatHeader('Create Remote Genesis'));
    process.stdout.write(`  ${formatKeyValue('Network', net.name)}`);
    process.stdout.write(
      `  ${formatKeyValue('GL0 Node', `${net.gl0_node.ip}:${net.gl0_node.public_port}`)}`,
    );
    process.stdout.write('\n');

    const dockerPath = resolve(projectRoot, 'docker');
    const genesisDir = resolve(dockerPath, 'artifacts', 'genesis');
    mkdirSync(genesisDir, { recursive: true });

    // Validate metagraph-base-image exists (built by `hydra build`)
    const imageExists = await docker.imageExists('metagraph-base-image');
    if (!imageExists) {
      process.stderr.write(`\n  ${t.error('✗')} Docker image 'metagraph-base-image' not found.\n`);
      process.stderr.write(
        `    Run ${t.cyan("'hydra build'")} first to compile your metagraph.\n\n`,
      );
      process.exit(1);
    }

    const containerName = 'hydra-genesis-tmp';
    const totalSteps = 4;

    try {
      // ── Step 1: Start a temporary container ────────────────────────
      process.stdout.write(`  ${formatStep(1, totalSteps, 'Starting temporary container')}\n`);

      // Clean up any leftover container from a previous run
      await docker.removeContainer(containerName);

      // Ensure network exists
      await docker.ensureNetwork('custom-network', config.docker.network_subnet);

      await docker.startContainer({
        name: containerName,
        image: 'metagraph-base-image:latest',
        networkName: 'custom-network',
        ipAddress: '172.50.0.100',
        ports: [],
        volumes: [
          {
            host: genesisDir,
            container: '/code/shared_genesis',
          },
        ],
      });
      process.stdout.write(`  ${formatSuccess('Container started')}\n`);

      // ── Step 2: Copy P12 keystore + genesis.csv ──────────────────
      process.stdout.write(`  ${formatStep(2, totalSteps, 'Preparing genesis files')}\n`);

      const leadNode = config.nodes[0];
      const p12Path = resolve(dataPath, 'p12-files', leadNode.key_file.name);
      await docker.copyToContainer(
        containerName,
        p12Path,
        `code/metagraph-l0/${leadNode.key_file.name}`,
      );

      // Ensure genesis.csv exists in container
      const csvCheck = await docker.exec(containerName, [
        'bash',
        '-c',
        'test -f metagraph-l0/genesis.csv && echo "ok" || echo "missing"',
      ]);
      if (csvCheck.stdout.trim() !== 'ok') {
        const hostCsv = resolve(dataPath, 'metagraph-l0', 'genesis', 'genesis.csv');
        if (!existsSync(hostCsv)) {
          throw new Error(
            `Missing genesis.csv. Expected at: ${hostCsv}\n` +
              `  Create one in data/metagraph-l0/genesis/genesis.csv`,
          );
        }
        await docker.copyToContainer(containerName, hostCsv, 'code/metagraph-l0/genesis.csv');
      }
      process.stdout.write(`  ${formatSuccess('Files prepared')}\n`);

      // ── Step 3: Run create-genesis ───────────────────────────────
      process.stdout.write(`  ${formatStep(3, totalSteps, 'Creating genesis snapshot')}\n`);

      const genesisEnv: Record<string, string> = {
        CL_KEYSTORE: leadNode.key_file.name,
        CL_KEYALIAS: leadNode.key_file.alias,
        CL_PASSWORD: leadNode.key_file.password,
        CL_APP_ENV: 'dev',
        CL_COLLATERAL: '0',
        CL_GLOBAL_L0_PEER_HTTP_HOST: net.gl0_node.ip,
        CL_GLOBAL_L0_PEER_HTTP_PORT: String(net.gl0_node.public_port),
        CL_GLOBAL_L0_PEER_ID: net.gl0_node.id,
      };

      const result = await docker.exec(
        containerName,
        ['bash', '-c', 'cd metagraph-l0 && java -jar metagraph-l0.jar create-genesis genesis.csv'],
        { env: genesisEnv },
      );

      if (result.exitCode !== 0) {
        const errMsg = result.stderr.trim() || result.stdout.trim();
        throw new Error(`create-genesis failed (exit ${result.exitCode}): ${errMsg}`);
      }

      logger.debug(`create-genesis output: ${result.stdout.trim().slice(0, 300)}`);

      // Verify genesis files inside container
      const fileCheck = await docker.exec(containerName, [
        'bash',
        '-c',
        'ls -la metagraph-l0/genesis.address metagraph-l0/genesis.snapshot 2>&1',
      ]);
      logger.debug(`Genesis files: ${fileCheck.stdout.trim()}`);

      if (
        !fileCheck.stdout.includes('genesis.snapshot') ||
        !fileCheck.stdout.includes('genesis.address')
      ) {
        throw new Error(
          `create-genesis did not produce expected files.\n` +
            `  Output: ${result.stdout.trim().slice(0, 200)}`,
        );
      }

      // Copy genesis files to host via shared volume
      await docker.exec(containerName, [
        'bash',
        '-c',
        'cp metagraph-l0/genesis.address shared_genesis/genesis.address && ' +
          'cp metagraph-l0/genesis.snapshot shared_genesis/genesis.snapshot',
      ]);

      process.stdout.write(`  ${formatSuccess('Genesis snapshot created')}\n`);

      // ── Step 4: Clean up ─────────────────────────────────────────
      process.stdout.write(`  ${formatStep(4, totalSteps, 'Cleaning up')}\n`);
      await docker.removeContainer(containerName);
      process.stdout.write(`  ${formatSuccess('Container removed')}\n`);
    } catch (innerErr) {
      // Always clean up the temp container on failure
      await docker.removeContainer(containerName).catch((e) => {
        logger.debug(
          `Failed to clean up container ${containerName}: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
      throw innerErr;
    }

    // Verify genesis files on host
    const hasSnapshot = existsSync(resolve(genesisDir, 'genesis.snapshot'));
    const hasAddress = existsSync(resolve(genesisDir, 'genesis.address'));

    if (hasSnapshot && hasAddress) {
      // Read the metagraph ID from genesis.address
      const metagraphId = (await readFile(resolve(genesisDir, 'genesis.address'), 'utf-8')).trim();
      process.stdout.write(`\n  ${t.accent('Genesis files created successfully:')}\n`);
      process.stdout.write(`    ${t.dim('docker/artifacts/genesis/')}genesis.snapshot\n`);
      process.stdout.write(`    ${t.dim('docker/artifacts/genesis/')}genesis.address\n`);
      if (metagraphId) {
        process.stdout.write(`\n  ${formatKeyValue('Metagraph ID', metagraphId)}`);
      }
      process.stdout.write(`\n  Next step: ${t.cyan('hydra remote deploy')}\n\n`);
    } else {
      process.stderr.write(`\n  ${t.error('✗')} Genesis files were not copied to host.\n`);
      process.stderr.write(`  Check ${t.dim('docker/artifacts/genesis/')} for outputs.\n\n`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'ExitPromptError') {
      process.stdout.write(`\n  ${t.dim('Cancelled.')}\n\n`);
      return;
    }
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
