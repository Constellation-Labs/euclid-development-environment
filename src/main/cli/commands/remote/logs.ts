import { loadConfig, logger, LogLevel } from '../../../index.js';
import { remoteLogs } from '../../../remote/index.js';
import { formatError } from '../../ui/format.js';

export async function remoteLogsCommand(
  host: string,
  layer: string,
  options: {
    lines?: number;
    follow?: boolean;
    verbose?: boolean;
  },
): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    if (!config.deploy) {
      process.stderr.write('\nError: No deploy configuration found in euclid.json.\n');
      process.stderr.write(
        '  Add a "deploy" section with "hosts" to enable remote operations.\n\n',
      );
      process.exit(1);
    }

    // Find the host config
    const hostConfig = config.deploy.hosts.find((h) => h.host === host);
    if (!hostConfig) {
      process.stderr.write(`\nError: Host '${host}' not found in deploy.hosts.\n`);
      process.stderr.write(
        `Available hosts: ${config.deploy.hosts.map((h) => h.host).join(', ')}\n\n`,
      );
      process.exit(1);
    }

    // Validate layer
    const validLayers = ['metagraph-l0', 'currency-l1', 'data-l1'];
    if (!validLayers.includes(layer)) {
      process.stderr.write(`\nError: Unknown layer '${layer}'.\n`);
      process.stderr.write(`Valid layers: ${validLayers.join(', ')}\n\n`);
      process.exit(1);
    }

    process.stdout.write(
      `\n  Tailing ${layer} logs on ${host} (last ${options.lines ?? 50} lines)\n\n`,
    );

    await remoteLogs({
      host: hostConfig,
      layer,
      lines: options.lines,
      follow: options.follow ?? true,
    });
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
