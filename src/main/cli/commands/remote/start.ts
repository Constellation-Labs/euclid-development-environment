import chalk from 'chalk';
import { loadConfig, findProjectRoot, logger, LogLevel } from '../../../index.js';
import { remoteStart } from '../../../remote/index.js';
import { runSeedlistPreflight } from '../setup/check-seedlist.js';
import { DEFAULT_REMOTE_PORTS } from '../../../remote/defaults.js';
import { t, icon } from '../../ui/theme.js';
import { formatError } from '../../ui/format.js';

/**
 * Render a structured progress message from the remote-start pipeline.
 *
 * Prefix conventions (set in remote/start.ts):
 *   phase:Title    — section header  (colored separator + bold title)
 *   done:Message   — success step    (✓ green icon)
 *   warn:Message   — non-fatal issue (! amber icon)
 *   wait:Message   — polling status   (dimmed, no icon)
 *   (no prefix)    — regular step    (› arrow in muted text)
 */
function renderProgress(step: string): void {
  if (step.startsWith('phase:')) {
    const title = step.slice(6);
    const line = t.dim('─'.repeat(40));
    process.stdout.write(`\n  ${line}\n  ${chalk.bold(t.primary(title))}\n  ${line}\n`);
    return;
  }

  if (step.startsWith('done:')) {
    const msg = step.slice(5);
    process.stdout.write(`  ${icon.pass} ${msg}\n`);
    return;
  }

  if (step.startsWith('warn:')) {
    const msg = step.slice(5);
    process.stdout.write(`  ${icon.warn} ${t.warn(msg)}\n`);
    return;
  }

  if (step.startsWith('wait:')) {
    const msg = step.slice(5);
    process.stdout.write(`  ${t.dim(msg)}\n`);
    return;
  }

  // Default: regular step
  process.stdout.write(`  ${icon.arrow} ${t.muted(step)}\n`);
}

export async function remoteStartCommand(options: {
  genesis?: boolean;
  skipSeedlist?: boolean;
  resendMessages?: boolean;
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

    const projectRoot = findProjectRoot();
    await runSeedlistPreflight(config, config.deploy.network.name, projectRoot, {
      skipSeedlist: options.skipSeedlist,
    });

    const modeLabel = options.genesis ? t.warn('Genesis') : t.accent('Rollback');
    process.stdout.write(`\n  ${chalk.bold('Remote Start')} ${t.dim('—')} ${modeLabel} mode\n`);

    const t0 = Date.now();

    if (options.resendMessages && options.genesis) {
      process.stdout.write(
        `  ${icon.warn} ${t.warn('--resend-messages is ignored during genesis mode.')}\n`,
      );
    }

    await remoteStart({
      config,
      genesis: options.genesis,
      resendMessages: options.resendMessages,
      onProgress: renderProgress,
    });

    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`\n  ${icon.pass} ${chalk.bold('All layers started')} ${t.dim(`(${elapsedSec}s)`)}\n`);

    // ─── Endpoints ─────────────────────────────────────────────
    const remotePorts = config.deploy.remote_ports ?? DEFAULT_REMOTE_PORTS;

    process.stdout.write(`\n  ${chalk.bold('Endpoints')}\n`);
    process.stdout.write(`  ${t.dim('─'.repeat(40))}\n`);

    for (const host of config.deploy.hosts) {
      process.stdout.write(`\n  ${t.white(host.host)}\n`);

      if (config.layers.includes('metagraph-l0')) {
        const url = t.cyan(`http://${host.host}:${remotePorts.metagraph_l0.public}`);
        process.stdout.write(`    ${t.dim('Metagraph L0')}  ${url}\n`);
      }
      if (config.layers.includes('currency-l1')) {
        const url = t.cyan(`http://${host.host}:${remotePorts.currency_l1.public}`);
        process.stdout.write(`    ${t.dim('Currency L1')}   ${url}\n`);
      }
      if (config.layers.includes('data-l1')) {
        const url = t.cyan(`http://${host.host}:${remotePorts.data_l1.public}`);
        process.stdout.write(`    ${t.dim('Data L1')}       ${url}\n`);
      }
    }
    process.stdout.write('\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
