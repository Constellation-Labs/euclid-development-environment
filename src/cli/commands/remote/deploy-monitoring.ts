import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  loadConfig,
  logger,
  LogLevel,
} from '../../../core/index.js';
import { SSHManager } from '../../../remote/index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function remoteDeployMonitoringCommand(options: {
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

    const projectRoot = process.cwd();
    const monitoringDir = resolve(projectRoot, 'data', 'metagraph-monitoring-service');

    if (!existsSync(monitoringDir)) {
      process.stderr.write('\nError: Monitoring service not found.\n');
      process.stderr.write("  Run 'hydra install-monitoring-service' first.\n\n");
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
        process.stderr.write('\nError: Monitoring config.json is missing required fields:\n');
        for (const [name] of missing) {
          process.stderr.write(`  - ${name}\n`);
        }
        process.stderr.write('\n');
        process.exit(1);
      }
    }

    const host = config.deploy.monitoring_host;
    const ssh = new SSHManager();

    process.stdout.write('\n  Deploying monitoring service...\n\n');

    try {
      process.stdout.write(`  [1/3] Connecting to ${host.host}...\n`);
      await ssh.connect(host);
      process.stdout.write(`  ${formatSuccess('Connected')}\n`);

      // Create remote directory
      const remoteDir = `/home/${host.user}/monitoring-service`;
      process.stdout.write(`  [2/3] Creating remote directory...\n`);
      await ssh.mkdir(host, remoteDir);
      process.stdout.write(`  ${formatSuccess('Directory created')}\n`);

      // Upload monitoring service directory
      process.stdout.write(`  [3/3] Uploading monitoring service...\n`);
      await ssh.uploadDir(host, monitoringDir, remoteDir, {
        exclude: ['node_modules', '.git'],
      });
      process.stdout.write(`  ${formatSuccess('Monitoring service deployed')}\n`);

      // Install npm dependencies on remote
      process.stdout.write('  Installing dependencies on remote host...\n');
      await ssh.exec(host, 'cd monitoring-service && npm install --production', {
        cwd: `/home/${host.user}`,
      });
      process.stdout.write(`  ${formatSuccess('Dependencies installed')}\n`);

      process.stdout.write('\n  Monitoring service deployed successfully!\n\n');
    } finally {
      await ssh.disconnectAll();
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
