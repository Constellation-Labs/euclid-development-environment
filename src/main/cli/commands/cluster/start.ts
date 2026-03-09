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
  LAYER_STARTERS,
  getLeadNodeId,
  updateClusterState,
  hashConfig,
} from '../../../index.js';
import type { EuclidConfig, LayerType, LayerContext } from '../../../index.js';
import { formatError, formatStep } from '../../ui/format.js';
import { createSpinner, spinnerSuccess, spinnerFail } from '../../ui/spinner.js';
import { t } from '../../ui/theme.js';
import type { Ora } from 'ora';

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

  let activeSpinner: Ora | null = null;

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    const mode = options.genesis ? 'genesis' : 'rollback';
    const projectRoot = process.cwd();
    const dockerPath = resolve(projectRoot, 'docker');

    process.stdout.write(`\n  Starting metagraph cluster ${t.dim(`(${mode} mode)`)}\n`);

    // Update state
    await updateClusterState((s) => ({
      ...s,
      status: 'starting',
      mode,
      configHash: hashConfig(config),
    }));

    // Step 1: Start Docker containers
    const activeLayers = LAYER_START_ORDER.filter((l) => config.layers.includes(l));
    const totalSteps = activeLayers.length + 2; // containers + lead node ID + each layer
    let step = 1;

    process.stdout.write(`\n  ${formatStep(step, totalSteps, 'Starting Docker containers')}\n`);

    // Ensure shared genesis directory exists (used as a Docker volume mount)
    const { mkdirSync } = await import('node:fs');
    mkdirSync(resolve(dockerPath, 'artifacts', 'genesis'), { recursive: true });

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

      const spinner = createSpinner(`  Starting ${node.name}...`);
      activeSpinner = spinner;
      spinner.start();

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
        ],
      });

      spinnerSuccess(spinner, `${node.name}  ${t.dim(ip)}`);
    }

    step++;

    // Step 2: Get lead node ID
    process.stdout.write(`\n  ${formatStep(step, totalSteps, 'Resolving lead node identity')}\n`);
    const idSpinner = createSpinner('  Reading node ID from keystore...');
    activeSpinner = idSpinner;
    idSpinner.start();

    const ctx: LayerContext = {
      docker,
      config,
      projectRoot,
      mode,
      leadNodeId: '',
      onProgress: (msg: string) => {
        if (activeSpinner?.isSpinning) {
          activeSpinner.text = `  ${t.dim(msg)}`;
        }
      },
    };

    ctx.leadNodeId = await getLeadNodeId(ctx);
    spinnerSuccess(idSpinner, `Lead node ID: ${t.dim(ctx.leadNodeId.slice(0, 16))}...`);

    step++;

    // Step 3+: Start each layer using the TypeScript orchestrator
    for (const layer of activeLayers) {
      const genesisTag =
        mode === 'genesis' && (layer === 'global-l0' || layer === 'metagraph-l0')
          ? ` ${t.warn('(genesis)')}`
          : '';

      process.stdout.write(
        `\n  ${formatStep(step, totalSteps, `Starting ${LAYER_DISPLAY_NAMES[layer]}${genesisTag}`)}\n`,
      );

      const layerSpinner = createSpinner(`  Starting ${LAYER_DISPLAY_NAMES[layer]}...`);
      activeSpinner = layerSpinner;
      layerSpinner.start();

      // Update progress callback to point to this spinner
      ctx.onProgress = (msg: string) => {
        layerSpinner.text = `  ${t.dim(msg)}`;
      };

      // Run the orchestrator for this layer
      const starter = LAYER_STARTERS[layer];
      await starter(ctx);

      const portKey = LAYER_PORT_KEYS[layer];
      const basePorts = config.ports[portKey];
      const firstNodePorts = computeNodePorts(basePorts, 0, config.docker.ip_offset);

      spinnerSuccess(
        layerSpinner,
        `${LAYER_DISPLAY_NAMES[layer]} ready on port ${t.white(String(firstNodePorts.public))}`,
      );

      step++;
    }

    // Update state to running
    await updateClusterState((s) => ({
      ...s,
      status: 'running',
      startedAt: new Date().toISOString(),
    }));

    // Print endpoints
    process.stdout.write(`\n  ${t.accent('Cluster is ready!')}\n\n`);

    if (ctx.metagraphId) {
      process.stdout.write(`  ${t.dim('Metagraph ID:')} ${t.cyan(ctx.metagraphId)}\n\n`);
    }

    process.stdout.write(`  ${t.dim('Endpoints:')}\n`);

    for (const layer of activeLayers) {
      const portKey = LAYER_PORT_KEYS[layer];
      const basePorts = config.ports[portKey];
      const firstNodePorts = computeNodePorts(basePorts, 0, config.docker.ip_offset);
      process.stdout.write(
        `    ${t.dim(LAYER_DISPLAY_NAMES[layer].padEnd(16))}${t.cyan(`http://localhost:${firstNodePorts.public}`)}\n`,
      );
    }

    if (config.docker.start_grafana_container) {
      process.stdout.write(
        `    ${t.dim('Grafana'.padEnd(16))}${t.cyan('http://localhost:3000')}\n`,
      );
    }

    process.stdout.write('\n');
  } catch (err) {
    if (activeSpinner?.isSpinning) {
      spinnerFail(activeSpinner, 'Start failed');
    }
    await updateClusterState((s) => ({ ...s, status: 'stopped' })).catch(() => {});
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
