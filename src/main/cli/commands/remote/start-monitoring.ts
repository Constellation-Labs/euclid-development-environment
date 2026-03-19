import chalk from 'chalk';
import { loadConfig, logger, LogLevel } from '../../../index.js';
import { SSHManager } from '../../../remote/index.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteStartMonitoringCommand(options: {
  forceRestart?: boolean;
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

    if (!config.deploy.monitoring_host) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('No monitoring_host configured in deploy section.')}\n` +
          `  ${t.muted('Add a "monitoring_host" with host, user, and ssh_key to euclid.json.')}\n\n`,
      );
      process.exit(1);
    }

    const host = config.deploy.monitoring_host;
    const ssh = new SSHManager();
    const remoteDir = `/home/${host.user}/monitoring-service`;

    process.stdout.write(
      `\n  ${chalk.bold('Start Monitoring')} ${t.dim('—')} ${t.white(host.host)}\n\n`,
    );

    try {
      process.stdout.write(`  ${icon.arrow} ${t.muted('Connecting to')} ${host.host}${t.dim('...')}\n`);
      await ssh.connect(host);

      if (options.forceRestart) {
        process.stdout.write(`  ${icon.arrow} ${t.muted('Stopping existing service...')}\n`);
        await ssh.exec(host, `cd "${remoteDir}" && npm run stop 2>/dev/null || true`);
        await ssh.exec(host, 'pkill -f "node.*monitoring" 2>/dev/null || true');
        process.stdout.write(`  ${icon.pass} Existing service stopped\n`);
      }

      process.stdout.write(`  ${icon.arrow} ${t.muted('Starting monitoring service...')}\n`);
      await ssh.exec(host, `cd "${remoteDir}" && nohup npm start > monitoring.log 2>&1 &`);
      process.stdout.write(`  ${icon.pass} Monitoring service started\n`);

      process.stdout.write(`\n  ${icon.pass} ${chalk.bold('Monitoring service is running')}\n`);
      process.stdout.write(
        `  ${t.dim('Logs:')} ${t.cyan(`ssh ${host.user}@${host.host} "tail -f ${remoteDir}/monitoring.log"`)}\n\n`,
      );
    } finally {
      await ssh.disconnectAll();
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
