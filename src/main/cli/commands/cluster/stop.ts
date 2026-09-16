import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  LAYER_STOP_ORDER,
  LAYER_DISPLAY_NAMES,
  updateClusterState,
} from '../../../index.js';
import { formatError } from '../../ui/format.js';
import { createSpinner, spinnerSuccess } from '../../ui/spinner.js';
import { t } from '../../ui/theme.js';

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
      const spinner = createSpinner(`  Stopping ${LAYER_DISPLAY_NAMES[layer]}...`);
      spinner.start();

      // Kill processes inside containers by executing kill commands
      for (const node of config.nodes) {
        const running = await docker.isContainerRunning(node.name);
        if (!running) continue;

        // Kill the java process for this layer inside the container
        try {
          await docker.exec(node.name, [
            'bash',
            '-c',
            `pkill -f "${layer}.jar" 2>/dev/null || true`,
          ]);
        } catch {
          // Process may not exist
        }
      }

      spinnerSuccess(spinner, `${LAYER_DISPLAY_NAMES[layer]} stopped`);
    }

    // Stop containers
    process.stdout.write('\n');
    for (const node of config.nodes) {
      const spinner = createSpinner(`  Stopping ${node.name}...`);
      spinner.start();
      await docker.stopContainer(node.name);
      spinnerSuccess(spinner, `${node.name} stopped`);
    }

    // Stop Grafana if running
    if (config.docker.start_grafana_container) {
      const spinner = createSpinner('  Stopping Grafana/Prometheus...');
      spinner.start();
      await docker.stopContainer('grafana');
      await docker.stopContainer('prometheus');
      spinnerSuccess(spinner, 'Grafana/Prometheus stopped');
    }

    await updateClusterState((s) => ({
      ...s,
      status: 'stopped',
      startedAt: null,
    }));

    process.stdout.write(`\n  ${t.accent('Cluster stopped.')}\n\n`);
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
