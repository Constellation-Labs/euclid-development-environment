import chalk from 'chalk';
import { resolve } from 'node:path';
import {
  loadConfig,
  findProjectRoot,
  logger,
  LogLevel,
  checkDeployConfig,
  checkJarFiles,
} from '../../../index.js';
import type { PreflightIssue } from '../../../index.js';
import { remoteDeploy } from '../../../remote/index.js';
import { runSeedlistPreflight } from '../setup/check-seedlist.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteDeployCommand(options: {
  forceGenesis?: boolean;
  skipSeedlist?: boolean;
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

    // ── Pre-flight checks ─────────────────────────────────────
    const projectRoot = findProjectRoot();
    const jarsDir = resolve(projectRoot, 'docker', 'artifacts', 'jars');
    const requiredJars = ['cl-keytool.jar', 'cl-wallet.jar', 'metagraph-l0.jar'];
    if (config.layers.includes('currency-l1')) requiredJars.push('currency-l1.jar');
    if (config.layers.includes('data-l1')) requiredJars.push('data-l1.jar');

    const issues: PreflightIssue[] = [
      ...checkDeployConfig(config.deploy),
      ...checkJarFiles(jarsDir, requiredJars),
    ];

    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warn');

    if (warnings.length > 0) {
      for (const w of warnings) {
        process.stdout.write(`  ${icon.warn} ${t.warn(w.message)}\n`);
      }
    }

    if (errors.length > 0) {
      process.stderr.write(`\n  ${icon.error} ${t.error('Pre-flight checks failed:')}\n`);
      for (const e of errors) {
        process.stderr.write(`  ${icon.dot} ${t.muted(e.message)}\n`);
      }
      process.stderr.write('\n');
      process.exit(1);
    }

    await runSeedlistPreflight(config, config.deploy.network.name, projectRoot, {
      skipSeedlist: options.skipSeedlist,
    });

    const hostCount = config.deploy.hosts.length;
    const modeLabel = options.forceGenesis ? t.warn('Genesis') : t.accent('Update');
    process.stdout.write(
      `\n  ${chalk.bold('Remote Deploy')} ${t.dim('—')} ${modeLabel} to ${t.white(String(hostCount))} host(s)\n\n`,
    );

    await remoteDeploy({
      config,
      projectRoot,
      forceGenesis: options.forceGenesis,
      onProgress: (host, step) => {
        if (step.startsWith('Done')) {
          process.stdout.write(`  ${icon.pass} ${t.muted(host)} ${step}\n`);
        } else if (step.startsWith('Failed')) {
          process.stdout.write(`  ${icon.error} ${t.muted(host)} ${t.error(step)}\n`);
        } else {
          process.stdout.write(`  ${icon.arrow} ${t.muted(host)} ${t.dim(step)}\n`);
        }
      },
    });

    process.stdout.write(
      `\n  ${icon.pass} ${chalk.bold(`Deploy complete to ${hostCount} host(s)`)}\n\n`,
    );
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
