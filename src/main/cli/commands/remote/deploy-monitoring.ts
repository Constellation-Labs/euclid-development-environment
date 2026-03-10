import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, findProjectRoot, logger, LogLevel } from '../../../index.js';
import { SSHManager } from '../../../remote/index.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteDeployMonitoringCommand(options: { verbose?: boolean }): Promise<void> {
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

    if (!config.deploy.monitoring_host) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('No monitoring_host configured in deploy section.')}\n` +
          `  ${t.muted('Add a "monitoring_host" with host, user, and ssh_key to euclid.json.')}\n\n`,
      );
      process.exit(1);
    }

    const projectRoot = findProjectRoot();
    const monitoringDir = resolve(projectRoot, 'data', 'metagraph-monitoring-service');

    if (!existsSync(monitoringDir)) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('Monitoring service not found.')}\n` +
          `  ${t.muted("Run 'hydra install-monitoring-service' first.")}\n\n`,
      );
      process.exit(1);
    }

    // Validate config.json has required fields
    const configJsonPath = resolve(monitoringDir, 'config', 'config.json');
    if (existsSync(configJsonPath)) {
      const monitoringConfig = JSON.parse(await readFile(configJsonPath, 'utf-8'));
      const requiredFields = [
        ['metagraph.id', monitoringConfig?.metagraph?.id],
        ['metagraph.name', monitoringConfig?.metagraph?.name],
        ['metagraph.version', monitoringConfig?.metagraph?.version],
      ];

      const missing = requiredFields.filter(([, v]) => !v);
      if (missing.length > 0) {
        process.stderr.write(
          `\n  ${icon.error} ${t.error('Monitoring config.json is missing required fields:')}\n`,
        );
        for (const [name] of missing) {
          process.stderr.write(`    ${t.dim('–')} ${name}\n`);
        }
        process.stderr.write('\n');
        process.exit(1);
      }
    }

    const host = config.deploy.monitoring_host;
    const ssh = new SSHManager();

    process.stdout.write(
      `\n  ${chalk.bold('Deploy Monitoring')} ${t.dim('—')} ${t.white(host.host)}\n\n`,
    );

    try {
      process.stdout.write(`  ${icon.arrow} ${t.muted('Connecting to')} ${host.host}${t.dim('...')}\n`);
      await ssh.connect(host);
      process.stdout.write(`  ${icon.pass} Connected\n`);

      // Create remote directory
      const remoteDir = `/home/${host.user}/monitoring-service`;
      process.stdout.write(`  ${icon.arrow} ${t.muted('Creating remote directory...')}\n`);
      await ssh.mkdir(host, remoteDir);
      process.stdout.write(`  ${icon.pass} Directory created\n`);

      // Upload monitoring service directory
      process.stdout.write(`  ${icon.arrow} ${t.muted('Uploading monitoring service...')}\n`);
      await ssh.uploadDir(host, monitoringDir, remoteDir, {
        exclude: ['node_modules', '.git'],
      });
      process.stdout.write(`  ${icon.pass} Monitoring service uploaded\n`);

      // Install npm dependencies on remote
      process.stdout.write(`  ${icon.arrow} ${t.muted('Installing dependencies...')}\n`);
      await ssh.exec(host, 'cd monitoring-service && npm install --production', {
        cwd: `/home/${host.user}`,
      });
      process.stdout.write(`  ${icon.pass} Dependencies installed\n`);

      process.stdout.write(
        `\n  ${icon.pass} ${chalk.bold('Monitoring service deployed successfully')}\n\n`,
      );
    } finally {
      await ssh.disconnectAll();
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
