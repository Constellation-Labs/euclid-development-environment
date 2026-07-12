import { resolve } from 'node:path';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadConfig, findProjectRoot, logger, LogLevel, remoteGenesisDir } from '../../../index.js';
import { formatError, formatSuccess } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

const MONITORING_REPO = 'https://github.com/Constellation-Labs/metagraph-monitoring-service';

export async function installMonitoringServiceCommand(options: {
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const projectRoot = findProjectRoot();
    const dataPath = resolve(projectRoot, 'data');

    // The monitoring service only ever targets a remote deployment
    const genesisAddressPath = resolve(remoteGenesisDir(projectRoot), 'genesis.address');
    if (!existsSync(genesisAddressPath)) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('genesis.address not found.')}\n` +
          `  ${t.muted("Run 'hydra create-remote-genesis' first to generate the remote genesis.")}\n\n`,
      );
      process.exit(1);
    }

    const metagraphId = (await readFile(genesisAddressPath, 'utf-8')).trim();

    process.stdout.write('\n  Installing metagraph-monitoring-service...\n\n');

    // Clone monitoring service
    const monitoringDir = resolve(dataPath, 'metagraph-monitoring-service');
    if (existsSync(monitoringDir)) {
      await rm(monitoringDir, { recursive: true, force: true });
    }

    process.stdout.write('  [1/3] Cloning metagraph-monitoring-service...\n');
    execFileSync('git', ['clone', '--quiet', MONITORING_REPO, monitoringDir], { stdio: 'pipe' });
    process.stdout.write(`  ${formatSuccess('Repository cloned')}\n`);

    // Update package.json with project name
    process.stdout.write('  [2/3] Updating package.json...\n');
    const pkgPath = resolve(monitoringDir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      pkg.name = `${config.project_name}-monitoring`;
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
    process.stdout.write(`  ${formatSuccess('package.json updated')}\n`);

    // Update config.json with metagraph metadata and node info
    process.stdout.write('  [3/3] Updating config.json...\n');
    const configJsonPath = resolve(monitoringDir, 'config', 'config.json');
    if (existsSync(configJsonPath)) {
      const monitoringConfig = JSON.parse(await readFile(configJsonPath, 'utf-8'));

      // Update metagraph info
      if (!monitoringConfig.metagraph) monitoringConfig.metagraph = {};
      monitoringConfig.metagraph.name = config.project_name;
      monitoringConfig.metagraph.id = metagraphId;
      monitoringConfig.metagraph.version = '1.0.0';

      // Update node key_file info for up to 3 nodes
      if (!monitoringConfig.metagraph.nodes) monitoringConfig.metagraph.nodes = [];

      for (let i = 0; i < Math.min(config.nodes.length, 3); i++) {
        const node = config.nodes[i];
        if (!monitoringConfig.metagraph.nodes[i]) {
          monitoringConfig.metagraph.nodes[i] = {};
        }
        monitoringConfig.metagraph.nodes[i].key_file = {
          name: node.key_file.name,
          alias: node.key_file.alias,
          password: node.key_file.password,
        };
      }

      await writeFile(configJsonPath, JSON.stringify(monitoringConfig, null, 2) + '\n');
    }
    process.stdout.write(`  ${formatSuccess('config.json updated')}\n`);

    // Remove .git directory
    const gitDir = resolve(monitoringDir, '.git');
    if (existsSync(gitDir)) {
      await rm(gitDir, { recursive: true, force: true });
    }

    process.stdout.write('\n  Monitoring service installed!\n');
    process.stdout.write('  You still need to update the network and node host details in:\n');
    process.stdout.write(`    ${configJsonPath}\n\n`);
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
