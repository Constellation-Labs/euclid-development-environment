import { loadConfig, logger, LogLevel } from '../../../index.js';
import { remoteStatus } from '../../../remote/index.js';
import { formatError, formatHeader, formatTable } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function remoteStatusCommand(options: {
  verbose?: boolean;
  json?: boolean;
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
          ? t.accent(state)
          : state === 'unreachable'
            ? t.error(state)
            : t.warn(state);

      const peerId = s.info?.id ? s.info.id.slice(0, 16) + '...' : t.dim('-');

      return [s.host, s.layer, colorState, String(s.port), peerId];
    });

    process.stdout.write(
      formatTable(['Host', 'Layer', 'State', 'Port', 'Peer ID'], rows, { indent: 4 }) + '\n\n',
    );
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
