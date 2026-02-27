import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  loadConfig,
  DockerClient,
  composeBuild,
  composeUp,
  composeDown,
  logger,
  LogLevel,
} from '../../core/index.js';
import { formatError, formatSuccess, formatHeader } from '../ui/format.js';

export async function createRemoteGenesisCommand(options: {
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const projectRoot = process.cwd();
    const dataPath = resolve(projectRoot, 'data');

    // Validate deploy config exists
    if (!config.deploy) {
      process.stderr.write('\nError: No deploy configuration found in euclid.json.\n');
      process.stderr.write('  Add a "deploy" section to enable remote genesis creation.\n\n');
      process.exit(1);
    }

    // Validate at least 3 nodes
    if (config.nodes.length < 3) {
      process.stderr.write('\nError: At least 3 nodes are required for remote genesis.\n');
      process.stderr.write(`  Currently configured: ${config.nodes.length} node(s)\n\n`);
      process.exit(1);
    }

    // Validate p12 files exist
    for (const node of config.nodes) {
      const p12Path = resolve(dataPath, 'p12-files', node.key_file.name);
      if (!existsSync(p12Path)) {
        process.stderr.write(`\nError: P12 file not found for ${node.name}: ${p12Path}\n\n`);
        process.exit(1);
      }
    }

    // Validate network configuration isn't using placeholders
    const net = config.deploy.network;
    if (
      net.gl0_node.ip === ':gl0_node_ip' ||
      net.gl0_node.id === ':gl0_node_id' ||
      String(net.gl0_node.public_port) === ':gl0_node_public_port'
    ) {
      process.stderr.write('\nError: euclid.json contains default placeholder values.\n');
      process.stderr.write('  Update the deploy.network section with real network configuration.\n\n');
      process.exit(1);
    }

    const docker = new DockerClient();
    const { version } = await docker.checkConnection();
    logger.debug(`Docker ${version} connected`);

    process.stdout.write(formatHeader('Create Remote Genesis'));
    process.stdout.write(`  Network: ${net.name}\n`);
    process.stdout.write(`  GL0 Node: ${net.gl0_node.ip}:${net.gl0_node.public_port}\n\n`);

    const dockerPath = resolve(projectRoot, 'docker');

    // Set environment variables for the build
    const env: Record<string, string> = {
      NETWORK_HOST_IP: net.gl0_node.ip,
      NETWORK_HOST_ID: net.gl0_node.id,
      NETWORK_HOST_PUBLIC_PORT: String(net.gl0_node.public_port),
    };

    process.stdout.write('  [1/4] Starting Docker containers...\n');
    await composeUp({
      cwd: resolve(dockerPath, 'metagraph-ubuntu'),
      env,
    });
    process.stdout.write(`  ${formatSuccess('Containers started')}\n`);

    process.stdout.write('  [2/4] Starting Global L0...\n');
    // The genesis process runs inside docker-compose, which handles
    // starting the cluster layers. The compose files are configured
    // to start from genesis with the network env vars.
    await composeUp({
      cwd: resolve(dockerPath, 'metagraph-base-image'),
      env: {
        ...env,
        FORCE_GENESIS: 'true',
      },
    });
    process.stdout.write(`  ${formatSuccess('Global L0 started')}\n`);

    process.stdout.write('  [3/4] Starting Metagraph L0 (genesis)...\n');
    // Wait for genesis files to be generated
    // The compose setup generates genesis.snapshot and genesis.address
    await new Promise((r) => setTimeout(r, 30000)); // Allow time for genesis

    process.stdout.write(`  ${formatSuccess('Metagraph L0 genesis created')}\n`);

    // Stop all containers
    process.stdout.write('  [4/4] Stopping containers...\n');
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
      process.stdout.write('\n  Genesis files created successfully:\n');
      process.stdout.write('    docker/artifacts/genesis/genesis.snapshot\n');
      process.stdout.write('    docker/artifacts/genesis/genesis.address\n');
      process.stdout.write("\n  You can now run 'hydra remote deploy' to upload them.\n\n");
    } else {
      process.stderr.write('\n  Warning: Genesis files may not have been fully generated.\n');
      process.stderr.write('  Check docker/artifacts/genesis/ for outputs.\n\n');
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
