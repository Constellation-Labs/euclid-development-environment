import { resolve } from 'node:path';
import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  composeBuild,
} from '../../core/index.js';
import { formatError, formatSuccess } from '../ui/format.js';

export async function buildCommand(options: {
  noCache?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const docker = new DockerClient();

    // Verify Docker
    const { version } = await docker.checkConnection();
    logger.debug(`Docker ${version} connected`);

    const projectRoot = process.cwd();
    const dockerPath = resolve(projectRoot, 'docker');

    const tessVersionName = config.tessellation_version.replace(/\./g, '_');
    const checkoutVersion =
      config.tessellation_ref_type === 'tag'
        ? `v${config.tessellation_version}`
        : config.tessellation_version;

    // Step 1: Build metagraph-ubuntu base image
    process.stdout.write('\n  [1/3] Building metagraph-ubuntu base image...\n');

    await composeBuild({
      cwd: resolve(dockerPath, 'metagraph-ubuntu'),
      env: {
        TESSELLATION_VERSION_NAME: tessVersionName,
        CHECKOUT_TESSELLATION_VERSION: checkoutVersion,
        TESSELLATION_VERSION_IS_TAG_OR_BRANCH: config.tessellation_ref_type,
      },
      noCache: options.noCache,
    });

    process.stdout.write(`  ${formatSuccess(`metagraph-ubuntu-${tessVersionName} built`)}\n`);

    // Step 2: Build metagraph-base-image
    process.stdout.write('\n  [2/3] Building metagraph-base-image (compiling JARs)...\n');

    const layers = config.layers;
    const customDockerfile = resolve(dockerPath, 'custom', 'metagraph-base-image', 'Dockerfile');
    const { existsSync } = await import('node:fs');
    const dockerfilePath = existsSync(customDockerfile)
      ? customDockerfile
      : resolve(dockerPath, 'metagraph-base-image', 'Dockerfile');

    await composeBuild({
      cwd: resolve(dockerPath, 'metagraph-base-image'),
      env: {
        TESSELLATION_VERSION_NAME: tessVersionName,
        METAGRAPH_BASE_IMAGE_DOCKERFILE: dockerfilePath,
        SHOULD_BUILD_GLOBAL_L0: String(layers.includes('global-l0')),
        SHOULD_BUILD_DAG_L1: String(layers.includes('dag-l1') || layers.includes('global-l0')),
        SHOULD_BUILD_METAGRAPH_L0: String(layers.includes('metagraph-l0')),
        SHOULD_BUILD_CURRENCY_L1: String(layers.includes('currency-l1')),
        SHOULD_BUILD_DATA_L1: String(layers.includes('data-l1')),
        TEMPLATE_NAME: config.project_name,
      },
      noCache: options.noCache,
    });

    process.stdout.write(`  ${formatSuccess('metagraph-base-image built')}\n`);

    // Step 3: Extract JARs from the built image
    process.stdout.write('\n  [3/3] Extracting JARs from image...\n');

    const jarsDir = resolve(dockerPath, 'artifacts', 'jars');
    const { execSync } = await import('node:child_process');

    // Create temp container, copy jars, remove container
    const containerId = execSync('docker create metagraph-base-image', { encoding: 'utf-8' }).trim();
    try {
      execSync(`docker cp ${containerId}:/code/shared_jars/. "${jarsDir}/"`, { stdio: 'pipe' });
      process.stdout.write(`  ${formatSuccess('JARs extracted to docker/artifacts/jars/')}\n`);
    } finally {
      execSync(`docker rm ${containerId}`, { stdio: 'pipe' });
    }

    process.stdout.write('\n  Build complete!\n\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
