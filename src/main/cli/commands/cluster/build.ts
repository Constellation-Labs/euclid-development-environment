import { resolve } from 'node:path';
import {
  loadConfig,
  findProjectRoot,
  logger,
  LogLevel,
  DockerClient,
  composeBuild,
} from '../../../index.js';
import { formatError, formatStep } from '../../ui/format.js';
import { createSpinner, spinnerSuccess, spinnerFail } from '../../ui/spinner.js';
import { t } from '../../ui/theme.js';
import type { Ora } from 'ora';

/**
 * Extract a short, meaningful status from Docker build output.
 * Docker emits lines like:
 *   "#6 [3/10] RUN apt-get update"
 *   "Step 5/12 : RUN sbt assembly"
 *   "#8 sha256:abc123... 42.5MB / 128.0MB"
 *   "Downloading https://..."
 *   "[info] compiling 42 Scala sources..."
 * We condense these into one-line spinner updates.
 */
function extractProgress(line: string): string | null {
  // BuildKit step: "#6 [3/10] RUN apt-get update" → "[3/10] RUN apt-get update"
  const buildKit = line.match(/#\d+\s+\[(\d+\/\d+)\]\s+(.+)/);
  if (buildKit) return `[${buildKit[1]}] ${buildKit[2].slice(0, 60)}`;

  // Legacy step: "Step 5/12 : RUN ..." → "Step 5/12: RUN ..."
  const legacy = line.match(/^Step\s+(\d+\/\d+)\s*:\s*(.+)/i);
  if (legacy) return `Step ${legacy[1]}: ${legacy[2].slice(0, 60)}`;

  // SBT / Scala compile progress
  if (line.includes('[info] compiling') || line.includes('[info] Compiling')) {
    return line.trim().slice(0, 70);
  }

  // Download progress
  const dl = line.match(/(?:Downloading|Fetching)\s+(.{10,60})/i);
  if (dl) return `Downloading ${dl[1].slice(0, 50)}`;

  return null;
}

export async function buildCommand(options: {
  noCache?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  let activeSpinner: Ora | null = null;

  try {
    const config = await loadConfig();
    const docker = new DockerClient();

    // Verify Docker
    const { version } = await docker.checkConnection();
    logger.debug(`Docker ${version} connected`);

    const projectRoot = findProjectRoot();
    const dockerPath = resolve(projectRoot, 'docker');

    const tessVersionName = config.tessellation_version.replace(/\./g, '_');
    const checkoutVersion =
      config.tessellation_ref_type === 'tag'
        ? `v${config.tessellation_version}`
        : config.tessellation_version;

    // Helper: update spinner text with Docker build output
    const streamTo =
      (spinner: ReturnType<typeof createSpinner>, prefix: string) => (line: string) => {
        const progress = extractProgress(line);
        if (progress) {
          spinner.text = `  ${prefix} ${t.dim(progress)}`;
        }
      };

    // Step 1: Build metagraph-ubuntu base image
    process.stdout.write(`\n  ${formatStep(1, 3, 'Building metagraph-ubuntu base image')}\n`);
    const spinner1 = createSpinner(`  Building metagraph-ubuntu-${tessVersionName}...`);
    activeSpinner = spinner1;
    spinner1.start();

    await composeBuild({
      cwd: resolve(dockerPath, 'metagraph-ubuntu'),
      env: {
        TESSELLATION_VERSION_NAME: tessVersionName,
        CHECKOUT_TESSELLATION_VERSION: checkoutVersion,
        TESSELLATION_VERSION_IS_TAG_OR_BRANCH: config.tessellation_ref_type,
      },
      noCache: options.noCache,
      onOutput: streamTo(spinner1, 'metagraph-ubuntu:'),
    });

    spinnerSuccess(spinner1, `metagraph-ubuntu-${tessVersionName} built`);

    // Step 2: Build metagraph-base-image (compiling JARs — the long one)
    process.stdout.write(
      `\n  ${formatStep(2, 3, 'Building metagraph-base-image (compiling JARs)')}\n`,
    );
    const spinner2 = createSpinner('  Compiling metagraph project...');
    activeSpinner = spinner2;
    spinner2.start();

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
      onOutput: streamTo(spinner2, 'metagraph-base:'),
    });

    spinnerSuccess(spinner2, 'metagraph-base-image built');

    // Step 3: Extract compiled JARs from the built image
    process.stdout.write(`\n  ${formatStep(3, 3, 'Extracting JARs from image')}\n`);
    const spinner3 = createSpinner('  Copying JARs to docker/artifacts/jars/...');
    activeSpinner = spinner3;
    spinner3.start();

    const jarsDir = resolve(dockerPath, 'artifacts', 'jars');
    const { execSync } = await import('node:child_process');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(jarsDir, { recursive: true });

    // Create temp container, copy per-layer JARs, remove container
    const containerId = execSync('docker create metagraph-base-image', {
      encoding: 'utf-8',
    }).trim();
    try {
      // Each layer has its own directory in /code/ with the compiled JAR
      const layerJars: Record<string, string> = {
        'global-l0': 'global-l0.jar',
        'dag-l1': 'dag-l1.jar',
        'metagraph-l0': 'metagraph-l0.jar',
        'currency-l1': 'currency-l1.jar',
        'data-l1': 'data-l1.jar',
      };

      let extracted = 0;
      for (const [dir, jar] of Object.entries(layerJars)) {
        if (!layers.includes(dir as (typeof layers)[number])) continue;
        try {
          execSync(`docker cp ${containerId}:/code/${dir}/${jar} "${jarsDir}/${jar}"`, {
            stdio: 'pipe',
          });
          extracted++;
        } catch {
          // Layer may not have been built (e.g. global-l0 jar comes from tessellation, not sbt)
          logger.debug(`Skipping ${dir}/${jar} — not found in image`);
        }
      }

      // Extract utility JARs (cl-keytool, cl-wallet) — needed for remote deploy
      for (const utilJar of ['cl-keytool.jar', 'cl-wallet.jar']) {
        try {
          execSync(
            `docker cp ${containerId}:/code/metagraph-l0/${utilJar} "${jarsDir}/${utilJar}"`,
            { stdio: 'pipe' },
          );
          extracted++;
        } catch {
          logger.debug(`Utility JAR ${utilJar} not found in image`);
        }
      }

      spinnerSuccess(spinner3, `${extracted} JARs extracted to docker/artifacts/jars/`);
    } finally {
      execSync(`docker rm ${containerId}`, { stdio: 'pipe' });
    }

    process.stdout.write(`\n  ${t.accent('Build complete!')}\n\n`);
  } catch (err) {
    if (activeSpinner?.isSpinning) {
      spinnerFail(activeSpinner, 'Build failed');
    }
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
