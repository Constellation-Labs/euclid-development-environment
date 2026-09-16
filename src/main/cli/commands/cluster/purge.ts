import { loadConfig, logger, LogLevel, DockerClient } from '../../../index.js';
import { formatError, formatSuccess } from '../../ui/format.js';
import { destroyCommand } from './destroy.js';

export async function purgeCommand(options: { yes?: boolean; verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    // Confirmation
    if (!options.yes) {
      process.stdout.write(
        '\n  This will destroy ALL cluster resources AND remove Docker images.\n',
      );
      process.stdout.write('  This cannot be undone — images will need to be rebuilt.\n\n');

      const { confirm } = await import('@inquirer/prompts');
      const confirmed = await confirm({ message: 'Are you sure?', default: false });

      if (!confirmed) {
        process.stdout.write('\n  Cancelled.\n\n');
        return;
      }
    }

    // Destroy containers and network
    await destroyCommand({ yes: true, verbose: options.verbose });

    // Remove images
    process.stdout.write('  Removing Docker images...\n\n');
    const docker = new DockerClient();

    const tessVersionName = config.tessellation_version.replace(/\./g, '_');
    const imagesToRemove = [
      'metagraph-base-image',
      `metagraph-ubuntu-${tessVersionName}`,
      'grafana/grafana-oss',
      'prom/prometheus',
    ];

    for (const image of imagesToRemove) {
      const removed = await docker.removeImage(image);
      if (removed) {
        process.stdout.write(`  ${formatSuccess(`Removed image ${image}`)}\n`);
      }
    }

    // Prune dangling images
    const { execSync } = await import('node:child_process');
    try {
      execSync('docker image prune -f', { stdio: 'pipe' });
    } catch {
      // Non-critical
    }

    process.stdout.write('\n  Purge complete.\n\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
