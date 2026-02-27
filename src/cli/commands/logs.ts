import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  LAYER_TYPES,
  LAYER_DISPLAY_NAMES,
} from '../../core/index.js';
import type { LayerType } from '../../core/index.js';
import { formatError } from '../ui/format.js';

export async function logsCommand(
  layer: string,
  options: {
    node?: string;
    lines?: number;
    follow?: boolean;
    verbose?: boolean;
  },
): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  // Validate layer
  if (!LAYER_TYPES.includes(layer as LayerType)) {
    process.stderr.write(`\nError: Unknown layer '${layer}'.\n`);
    process.stderr.write(`Valid layers: ${LAYER_TYPES.join(', ')}\n\n`);
    process.exit(1);
  }

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    // Find target node
    const targetNode = options.node ?? config.nodes[0]?.name;
    const node = config.nodes.find((n) => n.name === targetNode);

    if (!node) {
      process.stderr.write(`\nError: Node '${targetNode}' not found.\n`);
      process.stderr.write(`Available nodes: ${config.nodes.map((n) => n.name).join(', ')}\n\n`);
      process.exit(1);
    }

    // Check container is running
    const running = await docker.isContainerRunning(node.name);
    if (!running) {
      process.stderr.write(`\nError: Container '${node.name}' is not running.\n\n`);
      process.exit(1);
    }

    // Tail log file inside container
    const lines = options.lines ?? 50;
    const followFlag = options.follow !== false ? '-f' : '';
    const logPath = `${layer}/${layer}.log`;

    const { execSync, spawn } = await import('node:child_process');

    // Check if log file exists
    try {
      execSync(
        `docker exec ${node.name} bash -c "test -f ${logPath}"`,
        { stdio: 'pipe' },
      );
    } catch {
      process.stderr.write(`\nNo logs found for ${LAYER_DISPLAY_NAMES[layer as LayerType]} on ${node.name}.\n`);
      process.stderr.write(`The layer may not have started yet.\n\n`);
      process.exit(1);
    }

    process.stdout.write(`\n  Tailing ${LAYER_DISPLAY_NAMES[layer as LayerType]} logs on ${node.name} (last ${lines} lines)\n\n`);

    // Stream logs to stdout
    const proc = spawn(
      'docker',
      ['exec', node.name, 'bash', '-c', `tail ${followFlag} -n ${lines} ${logPath}`],
      { stdio: 'inherit' },
    );

    proc.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
