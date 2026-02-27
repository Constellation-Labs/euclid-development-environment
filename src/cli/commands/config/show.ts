import { loadConfig, logger, LogLevel } from '../../../core/index.js';
import { formatError } from '../../ui/format.js';

export async function configShowCommand(options: {
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();

    if (options.json) {
      process.stdout.write(JSON.stringify(config, null, 2) + '\n');
    } else {
      // Pretty-print with labels
      process.stdout.write('\n  Hydra Configuration\n\n');
      process.stdout.write(`  Project:          ${config.project_name}\n`);
      process.stdout.write(`  Tessellation:     ${config.tessellation_version} (${config.tessellation_ref_type})\n`);
      process.stdout.write(`  Framework:        ${config.framework.name} v${config.framework.version}\n`);
      process.stdout.write(`  Modules:          ${config.framework.modules.length > 0 ? config.framework.modules.join(', ') : 'none'}\n`);
      process.stdout.write(`  Layers:           ${config.layers.join(', ')}\n`);
      process.stdout.write(`  Nodes:            ${config.nodes.length}\n`);
      for (const node of config.nodes) {
        process.stdout.write(`    - ${node.name} (${node.key_file.name})\n`);
      }
      process.stdout.write(`  Grafana:          ${config.docker.start_grafana_container ? 'enabled' : 'disabled'}\n`);
      if (config.deploy) {
        process.stdout.write(`  Deploy network:   ${config.deploy.network.name}\n`);
      }
      process.stdout.write('\n');
    }
  } catch (err) {
    process.stderr.write(formatError(err) + '\n');
    process.exit(1);
  }
}
