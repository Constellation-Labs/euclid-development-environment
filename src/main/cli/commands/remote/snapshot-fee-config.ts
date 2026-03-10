import chalk from 'chalk';
import { loadConfig, logger, LogLevel } from '../../../index.js';
import { SSHManager } from '../../../remote/index.js';
import { formatError, formatHeader, formatKeyValue } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteSnapshotFeeConfigCommand(options: {
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

    if (config.deploy.hosts.length === 0) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('No remote hosts configured.')}\n` +
          `  ${t.muted('Add hosts to the deploy.hosts array in euclid.json.')}\n\n`,
      );
      process.exit(1);
    }

    const firstHost = config.deploy.hosts[0];
    const ssh = new SSHManager();

    process.stdout.write(formatHeader('Remote Snapshot Fee Configuration'));

    try {
      // Connect to first host and fetch metagraph ID
      process.stdout.write(`  ${icon.arrow} ${t.muted('Connecting to first host...')}\n`);
      await ssh.connect(firstHost);

      const ml0Dir = `/home/${firstHost.user}/code/metagraph-l0`;
      const result = await ssh.exec(firstHost, `cat "${ml0Dir}/genesis.address" 2>/dev/null`);
      const metagraphId = result.stdout.trim();

      if (!metagraphId) {
        process.stderr.write(
          `\n  ${icon.error} ${t.error('Could not fetch metagraph ID from remote host.')}\n` +
            `  ${t.muted(`Ensure genesis.address exists at ${ml0Dir}/genesis.address`)}\n\n`,
        );
        process.exit(1);
      }

      process.stdout.write(`  ${icon.pass} Metagraph ID: ${t.cyan(metagraphId)}\n\n`);

      // Fetch latest global snapshot
      const gl0 = config.deploy.network.gl0_node;
      const url = `http://${gl0.ip}:${gl0.public_port}/global-snapshots/latest/combined`;

      process.stdout.write(`  ${icon.arrow} ${t.muted('Fetching latest global snapshot...')}\n\n`);
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        process.stderr.write(
          `\n  ${icon.error} ${t.error(`Failed to fetch global snapshot. HTTP ${response.status}`)}\n\n`,
        );
        process.exit(1);
      }

      const data = (await response.json()) as unknown[];
      const currencySnapshots = (data[1] as Record<string, unknown>)?.lastCurrencySnapshots as
        | Record<string, unknown>
        | undefined;
      const metagraphSnapshot = currencySnapshots?.[metagraphId] as
        | { Right?: unknown[] }
        | undefined;
      const lastMessages = (metagraphSnapshot?.Right?.[1] as Record<string, unknown>)
        ?.lastMessages as Record<string, unknown> | undefined;

      if (!lastMessages) {
        process.stderr.write(
          `\n  ${icon.error} ${t.error('Could not extract fee configuration from global snapshot.')}\n` +
            `  ${t.muted('Ensure your metagraph has fee messages configured.')}\n\n`,
        );
        process.exit(1);
      }

      // Extract owner and staking info
      const owner = lastMessages.Owner as Record<string, Record<string, string>> | undefined;
      const staking = lastMessages.Staking as Record<string, Record<string, string>> | undefined;

      const ownerAddress = owner?.value?.address ?? t.dim('N/A');
      const ownerOrdinal = owner?.value?.parentOrdinal ?? t.dim('N/A');
      const stakingAddress = staking?.value?.address ?? t.dim('N/A');
      const stakingOrdinal = staking?.value?.parentOrdinal ?? t.dim('N/A');

      process.stdout.write(`  ${chalk.bold('OWNER')}\n`);
      process.stdout.write(formatKeyValue('  Address', ownerAddress) + '\n');
      process.stdout.write(formatKeyValue('  Parent Ordinal', String(ownerOrdinal)) + '\n');
      process.stdout.write('\n');
      process.stdout.write(`  ${chalk.bold('STAKING')}\n`);
      process.stdout.write(formatKeyValue('  Address', stakingAddress) + '\n');
      process.stdout.write(formatKeyValue('  Parent Ordinal', String(stakingOrdinal)) + '\n');
      process.stdout.write('\n');
    } finally {
      await ssh.disconnectAll();
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
