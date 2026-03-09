import { loadConfig, logger, LogLevel } from '../../../index.js';
import { remoteDeploy } from '../../../remote/index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function remoteDeployCommand(options: {
  forceGenesis?: boolean;
  verbose?: boolean;
}): Promise<void> {
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

    const hostCount = config.deploy.hosts.length;
    process.stdout.write(`\n  Deploying to ${hostCount} remote host(s)...\n\n`);

    await remoteDeploy({
      config,
      projectRoot: process.cwd(),
      forceGenesis: options.forceGenesis,
      onProgress: (host, step) => {
        process.stdout.write(`  [${host}] ${step}\n`);
      },
    });

    process.stdout.write(`\n  ${formatSuccess(`Deploy complete to ${hostCount} host(s)`)}\n\n`);
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
