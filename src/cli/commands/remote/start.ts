import {
  loadConfig,
  logger,
  LogLevel,
} from '../../../core/index.js';
import { remoteStart } from '../../../remote/index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function remoteStartCommand(options: {
  genesis?: boolean;
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

    const mode = options.genesis ? 'genesis' : 'rollback';
    process.stdout.write(`\n  Starting remote metagraph cluster (${mode} mode)...\n\n`);

    await remoteStart({
      config,
      genesis: options.genesis,
      onProgress: (step) => {
        process.stdout.write(`  ${step}\n`);
      },
    });

    process.stdout.write(`\n  ${formatSuccess('Remote cluster started successfully')}\n\n`);

    // Print endpoints
    process.stdout.write('  Endpoints:\n');
    const remotePorts = config.deploy.remote_ports ?? {
      metagraph_l0: { public: 9100, p2p: 9101, cli: 9102 },
      currency_l1: { public: 9200, p2p: 9201, cli: 9202 },
      data_l1: { public: 9300, p2p: 9301, cli: 9302 },
    };

    for (const host of config.deploy.hosts) {
      process.stdout.write(`\n    ${host.host}:\n`);
      if (config.layers.includes('metagraph-l0')) {
        process.stdout.write(`      Metagraph L0    http://${host.host}:${remotePorts.metagraph_l0.public}\n`);
      }
      if (config.layers.includes('currency-l1')) {
        process.stdout.write(`      Currency L1     http://${host.host}:${remotePorts.currency_l1.public}\n`);
      }
      if (config.layers.includes('data-l1')) {
        process.stdout.write(`      Data L1         http://${host.host}:${remotePorts.data_l1.public}\n`);
      }
    }
    process.stdout.write('\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
