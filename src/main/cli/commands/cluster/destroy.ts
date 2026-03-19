import { resolve } from 'node:path';
import {
  loadConfig,
  findProjectRoot,
  logger,
  LogLevel,
  DockerClient,
  updateClusterState,
} from '../../../index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function destroyCommand(options: { yes?: boolean; verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    // Confirmation prompt (unless --yes)
    if (!options.yes) {
      const containerNames = config.nodes.map((n) => n.name).join(', ');
      process.stdout.write('\n  This will destroy:\n');
      process.stdout.write(`    - ${config.nodes.length} Docker containers (${containerNames})\n`);
      process.stdout.write("    - Docker network 'custom-network'\n");
      process.stdout.write('    - Genesis files in docker/artifacts/genesis/\n\n');

      const { confirm } = await import('@inquirer/prompts');
      const confirmed = await confirm({ message: 'Are you sure?', default: false });

      if (!confirmed) {
        process.stdout.write('\n  Cancelled.\n\n');
        return;
      }
    }

    process.stdout.write('\n  Destroying cluster resources...\n\n');

    // Remove containers
    for (const node of config.nodes) {
      await docker.removeContainer(node.name);
      process.stdout.write(`  ${formatSuccess(`Removed container ${node.name}`)}\n`);
    }

    // Remove Grafana/Prometheus
    await docker.removeContainer('grafana');
    await docker.removeContainer('prometheus');

    // Remove network
    await docker.removeNetwork('custom-network');
    process.stdout.write(`  ${formatSuccess("Removed network 'custom-network'")}\n`);

    // Clean genesis files
    const { rmSync, existsSync } = await import('node:fs');
    const genesisDir = resolve(findProjectRoot(), 'docker', 'artifacts', 'genesis');
    for (const file of ['genesis.address', 'genesis.snapshot']) {
      const filePath = resolve(genesisDir, file);
      if (existsSync(filePath)) {
        rmSync(filePath);
        process.stdout.write(`  ${formatSuccess(`Removed ${file}`)}\n`);
      }
    }

    await updateClusterState((s) => ({
      ...s,
      status: 'stopped',
      mode: null,
      startedAt: null,
      layers: {},
      genesis: { address: null, snapshotPath: null },
    }));

    process.stdout.write('\n  Cluster destroyed.\n\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
