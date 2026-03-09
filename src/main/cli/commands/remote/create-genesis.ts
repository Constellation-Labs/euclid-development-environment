import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { input, select, confirm } from '@inquirer/prompts';
import {
  loadConfig,
  DockerClient,
  composeUp,
  composeDown,
  logger,
  LogLevel,
  writeConfigAtomic,
  findConfigPath,
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
  const deploy = config.deploy!;
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
  const deploy = config.deploy!;
  const jvm = deploy.jvm;

  // Show current defaults
  process.stdout.write(`  ${t.dim('Current JVM defaults:')}\n`);
  process.stdout.write(`    ${formatKeyValue('Min Heap', jvm.default.min_heap, 20)}`);
  process.stdout.write(`    ${formatKeyValue('Max Heap', jvm.default.max_heap, 20)}`);
  process.stdout.write(`    ${formatKeyValue('Metaspace', jvm.default.metaspace_size, 20)}`);
  process.stdout.write(
    `    ${formatKeyValue('Max Metaspace', jvm.default.max_metaspace_size, 20)}`,
  );
  if (jvm.default.additional_opts) {
    process.stdout.write(`    ${formatKeyValue('Extra opts', jvm.default.additional_opts, 20)}`);
  }
  process.stdout.write('\n');

  const customize = await confirm({
    message: 'Customize JVM settings per layer?',
    default: false,
  });

  if (!customize) return config;

  let changed = false;

  // First ask if they want to change the defaults
  const changeDefaults = await confirm({
    message: 'Change default JVM settings (applied to all layers)?',
    default: false,
  });

  if (changeDefaults) {
    jvm.default.min_heap = await input({
      message: 'Default min heap (e.g. 1g, 512m):',
      default: jvm.default.min_heap,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "1g" or "512m"',
    });
    jvm.default.max_heap = await input({
      message: 'Default max heap (e.g. 2g, 1024m):',
      default: jvm.default.max_heap,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "2g" or "1024m"',
    });
    jvm.default.metaspace_size = await input({
      message: 'Default metaspace size:',
      default: jvm.default.metaspace_size,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "256m"',
    });
    jvm.default.max_metaspace_size = await input({
      message: 'Default max metaspace size:',
      default: jvm.default.max_metaspace_size,
      validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "512m"',
    });
    changed = true;
  }

  // Per-layer overrides
  const activeLayers = LAYER_JVM_KEYS.filter((k) =>
    config.layers.includes(k.replace('_', '-') as (typeof config.layers)[number]),
  );

  for (const layerKey of activeLayers) {
    const label = LAYER_JVM_LABELS[layerKey];
    const override = await confirm({
      message: `Override JVM settings for ${label}?`,
      default: false,
    });

    if (!override) continue;

    const layerJvm = {
      min_heap: await input({
        message: `${label} min heap:`,
        default: jvm.default.min_heap,
        validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "1g" or "512m"',
      }),
      max_heap: await input({
        message: `${label} max heap:`,
        default: jvm.default.max_heap,
        validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "2g" or "1024m"',
      }),
      metaspace_size: await input({
        message: `${label} metaspace size:`,
        default: jvm.default.metaspace_size,
        validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "256m"',
      }),
      max_metaspace_size: await input({
        message: `${label} max metaspace size:`,
        default: jvm.default.max_metaspace_size,
        validate: (v) => /^\d+[gm]$/.test(v) || 'Must be like "512m"',
      }),
      additional_opts: '',
    };

    (jvm as Record<string, unknown>)[layerKey] = layerJvm;
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
    const projectRoot = process.cwd();
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

    const net = config.deploy!.network;
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

    // Set environment variables for the build
    const env: Record<string, string> = {
      NETWORK_HOST_IP: net.gl0_node.ip,
      NETWORK_HOST_ID: net.gl0_node.id,
      NETWORK_HOST_PUBLIC_PORT: String(net.gl0_node.public_port),
    };

    const totalSteps = 4;

    process.stdout.write(`  ${formatStep(1, totalSteps, 'Starting Docker containers')}\n`);
    await composeUp({
      cwd: resolve(dockerPath, 'metagraph-ubuntu'),
      env,
    });
    process.stdout.write(`  ${formatSuccess('Containers started')}\n`);

    process.stdout.write(`  ${formatStep(2, totalSteps, 'Starting Global L0')}\n`);
    await composeUp({
      cwd: resolve(dockerPath, 'metagraph-base-image'),
      env: {
        ...env,
        FORCE_GENESIS: 'true',
      },
    });
    process.stdout.write(`  ${formatSuccess('Global L0 started')}\n`);

    process.stdout.write(`  ${formatStep(3, totalSteps, 'Starting Metagraph L0 (genesis)')}\n`);
    // Wait for genesis files to be generated
    await new Promise((r) => setTimeout(r, 30000));
    process.stdout.write(`  ${formatSuccess('Metagraph L0 genesis created')}\n`);

    // Stop all containers
    process.stdout.write(`  ${formatStep(4, totalSteps, 'Stopping containers')}\n`);
    await composeDown({
      cwd: resolve(dockerPath, 'metagraph-base-image'),
    });
    await composeDown({
      cwd: resolve(dockerPath, 'metagraph-ubuntu'),
    });
    process.stdout.write(`  ${formatSuccess('Containers stopped')}\n`);

    // Verify genesis files were created
    const genesisDir = resolve(dockerPath, 'artifacts', 'genesis');
    const hasSnapshot = existsSync(resolve(genesisDir, 'genesis.snapshot'));
    const hasAddress = existsSync(resolve(genesisDir, 'genesis.address'));

    if (hasSnapshot && hasAddress) {
      process.stdout.write(`\n  ${t.accent('Genesis files created successfully:')}\n`);
      process.stdout.write(`    ${t.dim('docker/artifacts/genesis/')}genesis.snapshot\n`);
      process.stdout.write(`    ${t.dim('docker/artifacts/genesis/')}genesis.address\n`);
      process.stdout.write(`\n  Next step: ${t.cyan('hydra remote deploy')}\n\n`);
    } else {
      process.stderr.write(`\n  ${t.warn('⚠')} Genesis files may not have been fully generated.\n`);
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
