import chalk from 'chalk';
import { loadConfig, logger, LogLevel } from '../../../index.js';
import { remoteStop } from '../../../remote/index.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteStopCommand(options: { verbose?: boolean }): Promise<void> {
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
    process.stdout.write(
      `\n  ${chalk.bold('Remote Stop')} ${t.dim('—')} Stopping processes on ${t.white(String(hostCount))} host(s)\n\n`,
    );

    await remoteStop({
      config,
      onProgress: (host, step) => {
        if (step.startsWith('Done')) {
          process.stdout.write(`  ${icon.pass} ${t.muted(host)} ${step}\n`);
        } else if (step.startsWith('Force')) {
          process.stdout.write(`  ${icon.warn} ${t.muted(host)} ${t.warn(step)}\n`);
        } else {
          process.stdout.write(`  ${icon.arrow} ${t.muted(host)} ${t.dim(step)}\n`);
        }
      },
    });

    process.stdout.write(
      `\n  ${icon.pass} ${chalk.bold(`All processes stopped on ${hostCount} host(s)`)}\n\n`,
    );
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
