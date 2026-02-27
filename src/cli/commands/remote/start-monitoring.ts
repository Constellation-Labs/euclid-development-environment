import {
  loadConfig,
  logger,
  LogLevel,
} from '../../../core/index.js';
import { SSHManager } from '../../../remote/index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function remoteStartMonitoringCommand(options: {
  forceRestart?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    if (!config.deploy) {
      process.stderr.write('\nError: No deploy configuration found in euclid.json.\n');
      process.stderr.write('  Add a "deploy" section with "hosts" to enable remote operations.\n\n');
      process.exit(1);
    }

    if (!config.deploy.monitoring_host) {
      process.stderr.write('\nError: No monitoring_host configured in deploy section.\n');
      process.stderr.write('  Add a "monitoring_host" with host, user, and ssh_key to euclid.json.\n\n');
      process.exit(1);
    }

    const host = config.deploy.monitoring_host;
    const ssh = new SSHManager();
    const remoteDir = `/home/${host.user}/monitoring-service`;

    process.stdout.write('\n  Starting monitoring service...\n\n');

    try {
      process.stdout.write(`  Connecting to ${host.host}...\n`);
      await ssh.connect(host);

      if (options.forceRestart) {
        process.stdout.write('  Stopping existing monitoring service...\n');
        await ssh.exec(host, `cd "${remoteDir}" && npm run stop 2>/dev/null || true`);
        // Also kill by port or process if needed
        await ssh.exec(host, 'pkill -f "node.*monitoring" 2>/dev/null || true');
        process.stdout.write(`  ${formatSuccess('Existing service stopped')}\n`);
      }

      process.stdout.write('  Starting monitoring service...\n');
      await ssh.exec(host, `cd "${remoteDir}" && nohup npm start > monitoring.log 2>&1 &`);
      process.stdout.write(`  ${formatSuccess('Monitoring service started')}\n`);

      process.stdout.write('\n  Monitoring service is running!\n');
      process.stdout.write(`  Logs: ssh ${host.user}@${host.host} "tail -f ${remoteDir}/monitoring.log"\n\n`);
    } finally {
      await ssh.disconnectAll();
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
