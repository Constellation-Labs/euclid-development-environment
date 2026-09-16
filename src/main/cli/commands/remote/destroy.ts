import chalk from 'chalk';
import { loadConfig, logger, LogLevel } from '../../../index.js';
import { remoteDestroy } from '../../../remote/index.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteDestroyCommand(options: {
  yes?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    if (!config.deploy) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('No deploy configuration found in euclid.json.')}\n` +
          `  ${t.muted('Add a "deploy" section with "hosts" to enable remote operations.')}\n\n`,
      );
      process.exit(1);
    }

    const hostCount = config.deploy.hosts.length;
    const hosts = config.deploy.hosts.map((h) => h.host).join(', ');

    process.stdout.write(
      `\n  ${chalk.bold(t.warn('Remote Destroy'))} ${t.dim('—')} ${t.white(String(hostCount))} host(s): ${t.muted(hosts)}\n\n`,
    );

    if (!options.yes) {
      const { confirm } = await import('@inquirer/prompts');
      const confirmed = await confirm({
        message: 'This will permanently delete all metagraph data on remote hosts. Continue?',
        default: false,
      });
      if (!confirmed) {
        process.stdout.write(`\n  ${t.dim('Cancelled.')}\n\n`);
        return;
      }
    }

    await remoteDestroy({
      config,
      onProgress: (host, step) => {
        if (step.startsWith('Done')) {
          process.stdout.write(`  ${icon.pass} ${t.muted(host)} ${step}\n`);
        } else {
          process.stdout.write(`  ${icon.arrow} ${t.muted(host)} ${t.dim(step)}\n`);
        }
      },
    });

    process.stdout.write(
      `\n  ${icon.pass} ${chalk.bold(`Destroyed metagraph data on ${hostCount} host(s)`)}\n\n`,
    );
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
