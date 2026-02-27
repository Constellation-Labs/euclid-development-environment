import { resolve } from 'node:path';
import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  computeNodePorts,
  computeNodeIp,
  LAYER_START_ORDER,
  LAYER_DISPLAY_NAMES,
  waitForNodeReady,
  updateClusterState,
  hashConfig,
} from '../../core/index.js';
import type { EuclidConfig, LayerType } from '../../core/index.js';
import { formatError, formatSuccess } from '../ui/format.js';

const LAYER_PORT_KEYS: Record<LayerType, keyof EuclidConfig['ports']> = {
  'global-l0': 'global_l0',
  'dag-l1': 'dag_l1',
  'metagraph-l0': 'metagraph_l0',
  'currency-l1': 'currency_l1',
  'data-l1': 'data_l1',
};

export async function startCommand(options: {
  genesis?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    const mode = options.genesis ? 'genesis' : 'rollback';
    const projectRoot = process.cwd();
    const dockerPath = resolve(projectRoot, 'docker');

    process.stdout.write(`\n  Starting metagraph cluster (${mode} mode)\n`);

    // Update state
    await updateClusterState((s) => ({
      ...s,
      status: 'starting',
      mode,
      configHash: hashConfig(config),
    }));

    // Step 1: Start Docker containers
    const activeLayers = LAYER_START_ORDER.filter((l) => config.layers.includes(l));
    const totalSteps = activeLayers.length + 1 + (config.docker.start_grafana_container ? 1 : 0);
    let step = 1;

    process.stdout.write(`\n  [${step}/${totalSteps}] Starting Docker containers...\n`);

    // Ensure network
    await docker.ensureNetwork('custom-network', config.docker.network_subnet);

    // Start containers for each node
    for (let i = 0; i < config.nodes.length; i++) {
      const node = config.nodes[i];
      const ip = computeNodeIp(config.docker.base_ip_prefix, i, config.docker.ip_offset);

      // Collect all port mappings for this node
      const ports: Array<{ host: number; container: number }> = [];
      for (const layer of config.layers) {
        const portKey = LAYER_PORT_KEYS[layer];
        const basePorts = config.ports[portKey];
        const nodePorts = computeNodePorts(basePorts, i, config.docker.ip_offset);
        ports.push(
          { host: nodePorts.public, container: nodePorts.public },
          { host: nodePorts.p2p, container: nodePorts.p2p },
          { host: nodePorts.cli, container: nodePorts.cli },
        );
      }

      await docker.startContainer({
        name: node.name,
        image: 'metagraph-base-image:latest',
        networkName: 'custom-network',
        ipAddress: ip,
        ports,
        volumes: [
          {
            host: resolve(dockerPath, 'artifacts', 'genesis'),
            container: '/code/shared_genesis',
          },
          {
            host: resolve(dockerPath, 'artifacts', 'jars'),
            container: '/code/shared_jars',
          },
        ],
      });

      process.stdout.write(`    ${formatSuccess(`${node.name}  ${ip}`)}\n`);
    }

    step++;

    // Step 2+: Start each layer in order
    for (const layer of activeLayers) {
      process.stdout.write(
        `\n  [${step}/${totalSteps}] Starting ${LAYER_DISPLAY_NAMES[layer]}${mode === 'genesis' && (layer === 'global-l0' || layer === 'metagraph-l0') ? ' (genesis)' : ''}...\n`,
      );

      const portKey = LAYER_PORT_KEYS[layer];
      const basePorts = config.ports[portKey];
      const firstNodePorts = computeNodePorts(basePorts, 0, config.docker.ip_offset);

      // For now, delegate to the existing Ansible playbooks via subprocess.
      // This will be replaced with direct Docker exec calls in Phase 2.
      const { execSync } = await import('node:child_process');

      const playbookPath = resolve(dockerPath, '..', 'legacy', 'ansible', 'local', 'playbooks', 'start', getLayerDir(layer), 'cluster.ansible.yml');

      try {
        const forceGenesis = mode === 'genesis' ? 'true' : 'false';

        // Export environment variables that Ansible playbooks need
        const env = {
          ...process.env,
          NODES: JSON.stringify(config.nodes),
          INFRA_PATH: dockerPath,
          SOURCE_PATH: resolve(projectRoot, 'data'),
          FORCE_ROLLBACK: mode === 'rollback' ? 'true' : 'false',
        };

        execSync(
          `ansible-playbook "${playbookPath}" -e "force_genesis=${forceGenesis}"`,
          {
            env,
            stdio: options.verbose ? 'inherit' : 'pipe',
            timeout: 300000,
          },
        );

        // Wait for the first node to become ready
        process.stdout.write(`    Waiting for ${LAYER_DISPLAY_NAMES[layer]} to be ready...\n`);
        await waitForNodeReady('localhost', firstNodePorts.public, {
          maxRetries: 120,
          intervalMs: 1000,
          onRetry: (attempt, elapsed) => {
            if (attempt % 10 === 0) {
              process.stdout.write(`    ... still waiting (${Math.round(elapsed / 1000)}s)\n`);
            }
          },
        });

        process.stdout.write(`    ${formatSuccess(`${LAYER_DISPLAY_NAMES[layer]} ready on port ${firstNodePorts.public}`)}\n`);
      } catch (err) {
        process.stderr.write(`    Failed to start ${LAYER_DISPLAY_NAMES[layer]}\n`);
        if (options.verbose) {
          process.stderr.write(`    ${(err as Error).message}\n`);
        }
        process.exit(1);
      }

      step++;
    }

    // Update state to running
    await updateClusterState((s) => ({
      ...s,
      status: 'running',
      startedAt: new Date().toISOString(),
    }));

    // Print endpoints
    process.stdout.write('\n  Cluster is ready!\n\n');
    process.stdout.write('  Endpoints:\n');

    for (const layer of activeLayers) {
      const portKey = LAYER_PORT_KEYS[layer];
      const basePorts = config.ports[portKey];
      const firstNodePorts = computeNodePorts(basePorts, 0, config.docker.ip_offset);
      process.stdout.write(`    ${LAYER_DISPLAY_NAMES[layer].padEnd(16)}http://localhost:${firstNodePorts.public}\n`);
    }

    if (config.docker.start_grafana_container) {
      process.stdout.write(`    ${'Grafana'.padEnd(16)}http://localhost:3000\n`);
    }

    process.stdout.write('\n');
  } catch (err) {
    await updateClusterState((s) => ({ ...s, status: 'stopped' }));
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}

function getLayerDir(layer: LayerType): string {
  const dirMap: Record<LayerType, string> = {
    'global-l0': 'global-l0',
    'dag-l1': 'dag-l1',
    'metagraph-l0': 'metagraph-l0',
    'currency-l1': 'currency-l1',
    'data-l1': 'data-l1',
  };
  return dirMap[layer];
}
