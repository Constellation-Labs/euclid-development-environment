import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  LAYER_STOP_ORDER,
  LAYER_DISPLAY_NAMES,
  updateClusterState,
} from '../../core/index.js';
import { formatError, formatSuccess } from '../ui/format.js';

export async function stopCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    await updateClusterState((s) => ({ ...s, status: 'stopping' }));

    process.stdout.write('\n  Stopping metagraph cluster\n\n');

    // Stop layers in reverse order
    const activeLayers = LAYER_STOP_ORDER.filter((l) => config.layers.includes(l));

    for (const layer of activeLayers) {
      process.stdout.write(`  Stopping ${LAYER_DISPLAY_NAMES[layer]}...\n`);
      // Kill processes inside containers by executing kill commands
      for (const node of config.nodes) {
        const running = await docker.isContainerRunning(node.name);
        if (!running) continue;

        // Kill the java process for this layer inside the container
        try {
          await docker.exec(node.name, [
            'bash', '-c',
            `pkill -f "${layer}.jar" 2>/dev/null || true`,
          ]);
        } catch {
          // Process may not exist
        }
      }
      process.stdout.write(`  ${formatSuccess(`${LAYER_DISPLAY_NAMES[layer]} stopped`)}\n`);
    }

    // Stop containers
    process.stdout.write('\n  Stopping containers...\n');
    for (const node of config.nodes) {
      await docker.stopContainer(node.name);
      process.stdout.write(`  ${formatSuccess(`${node.name} stopped`)}\n`);
    }

    // Stop Grafana if running
    if (config.docker.start_grafana_container) {
      await docker.stopContainer('grafana');
      await docker.stopContainer('prometheus');
      process.stdout.write(`  ${formatSuccess('Grafana/Prometheus stopped')}\n`);
    }

    await updateClusterState((s) => ({
      ...s,
      status: 'stopped',
      startedAt: null,
    }));

    process.stdout.write('\n  Cluster stopped.\n\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
