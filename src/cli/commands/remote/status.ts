import {
  loadConfig,
  logger,
  LogLevel,
} from '../../../core/index.js';
import { remoteStatus } from '../../../remote/index.js';
import { formatError, formatHeader, formatTable } from '../../ui/format.js';

export async function remoteStatusCommand(options: {
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    if (!config.deploy) {
      process.stderr.write('\nError: No deploy configuration found in euclid.json.\n');
      process.stderr.write('  Add a "deploy" section with "hosts" to enable remote operations.\n\n');
      process.exit(1);
    }

    process.stdout.write(formatHeader('Remote Cluster Status'));

    const statuses = await remoteStatus(config);

    if (options.json) {
      process.stdout.write(JSON.stringify(statuses, null, 2) + '\n');
      return;
    }

    const rows = statuses.map((s) => {
      const state = s.info?.state ?? 'unreachable';
      const colorState =
        state === 'Ready'
          ? `\x1b[32m${state}\x1b[0m`
          : state === 'unreachable'
            ? `\x1b[31m${state}\x1b[0m`
            : `\x1b[33m${state}\x1b[0m`;

      const peerId = s.info?.id ? s.info.id.slice(0, 16) + '...' : '-';

      return [s.host, s.layer, colorState, String(s.port), peerId];
    });

    process.stdout.write(
      formatTable(
        ['Host', 'Layer', 'State', 'Port', 'Peer ID'],
        rows,
        { indent: 4 },
      ) + '\n\n',
    );
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
