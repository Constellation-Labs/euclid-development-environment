import { resolve } from 'node:path';
import { rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import {
  DockerClient,
  logger,
  LogLevel,
} from '../../core/index.js';
import { formatError, formatSuccess, formatHeader } from '../ui/format.js';

const EUCLID_REPO = 'https://github.com/Constellation-Labs/euclid-development-environment.git';

export async function updateCommand(options: {
  version: string;
  yes?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const projectRoot = process.cwd();

    process.stdout.write(formatHeader('Update Hydra'));
    process.stdout.write(`  Target version: ${options.version}\n\n`);

    // Show what will be updated
    process.stdout.write('  This operation will update:\n');
    process.stdout.write('    - docker/ (Docker images, monitoring, artifacts config)\n');
    process.stdout.write('    - src/ (CLI source code)\n');
    process.stdout.write('    - package.json, tsconfig.json\n\n');

    // Confirm with user
    if (!options.yes) {
      const proceed = await confirm({
        message: 'Do you want to proceed?',
        default: false,
      });
      if (!proceed) {
        process.stdout.write('\n  Update cancelled.\n\n');
        return;
      }
    }

    // Check no containers are running
    process.stdout.write('\n  Checking for running containers...\n');
    try {
      const docker = new DockerClient();
      const containers = await docker.listContainers();
      const hydraContainers = containers.filter(
        (c) => c.Names.some((n) => n.includes('metagraph') || n.includes('global') || n.includes('dag') || n.includes('grafana') || n.includes('prometheus')),
      );
      if (hydraContainers.length > 0) {
        process.stderr.write('\nError: Running containers detected. Stop all containers before updating.\n');
        process.stderr.write("  Run 'hydra stop' or 'hydra destroy' first.\n\n");
        process.exit(1);
      }
    } catch {
      // Docker might not be running, which is fine for update
      logger.debug('Could not check Docker containers (Docker may not be running)');
    }

    const tmpDir = resolve(projectRoot, '.hydra-update-tmp');

    // Clean up any previous temp directory
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }

    // Clone the repository
    process.stdout.write('  [1/4] Fetching updated version...\n');
    execSync(`git clone --quiet "${EUCLID_REPO}" "${tmpDir}"`, { stdio: 'pipe' });

    // Checkout the specified version
    try {
      execSync(`git checkout --quiet "${options.version}"`, {
        cwd: tmpDir,
        stdio: 'pipe',
      });
    } catch {
      await rm(tmpDir, { recursive: true, force: true });
      process.stderr.write(`\nError: Version '${options.version}' not found.\n`);
      process.stderr.write('  Ensure the version tag or branch exists in the repository.\n\n');
      process.exit(1);
    }
    process.stdout.write(`  ${formatSuccess(`Version ${options.version} fetched`)}\n`);

    // Update docker directory
    process.stdout.write('  [2/4] Updating docker/...\n');
    const dockerDir = resolve(projectRoot, 'docker');
    const srcDockerDir = resolve(tmpDir, 'docker');

    // If the new version uses the old 'infra' layout, handle both
    const actualSrcDocker = existsSync(srcDockerDir)
      ? srcDockerDir
      : existsSync(resolve(tmpDir, 'infra'))
        ? resolve(tmpDir, 'infra')
        : null;

    if (actualSrcDocker) {
      // Update subdirectories, preserving user data
      const subDirs = ['metagraph-ubuntu', 'metagraph-base-image', 'grafana'];
      for (const sub of subDirs) {
        const srcSub = resolve(actualSrcDocker, sub) ?? resolve(actualSrcDocker, 'docker', sub);
        const destSub = resolve(dockerDir, sub);
        if (existsSync(srcSub)) {
          if (existsSync(destSub)) {
            await rm(destSub, { recursive: true, force: true });
          }
          await cp(srcSub, destSub, { recursive: true });
        }
      }
      process.stdout.write(`  ${formatSuccess('docker/ updated')}\n`);
    } else {
      process.stdout.write('  Skipped (no docker directory in update)\n');
    }

    // Update src directory
    process.stdout.write('  [3/4] Updating src/...\n');
    const srcDir = resolve(tmpDir, 'src');
    if (existsSync(srcDir)) {
      const destSrc = resolve(projectRoot, 'src');
      if (existsSync(destSrc)) {
        await rm(destSrc, { recursive: true, force: true });
      }
      await cp(srcDir, destSrc, { recursive: true });
      process.stdout.write(`  ${formatSuccess('src/ updated')}\n`);
    }

    // Update package.json and tsconfig.json
    process.stdout.write('  [4/4] Updating config files...\n');
    for (const file of ['package.json', 'tsconfig.json']) {
      const srcFile = resolve(tmpDir, file);
      const destFile = resolve(projectRoot, file);
      if (existsSync(srcFile)) {
        await cp(srcFile, destFile);
      }
    }
    process.stdout.write(`  ${formatSuccess('Config files updated')}\n`);

    // Rebuild
    process.stdout.write('\n  Rebuilding CLI...\n');
    execSync('npm install', { cwd: projectRoot, stdio: 'pipe' });
    execSync('npm run build', { cwd: projectRoot, stdio: 'pipe' });
    process.stdout.write(`  ${formatSuccess('CLI rebuilt')}\n`);

    // Cleanup
    await rm(tmpDir, { recursive: true, force: true });

    process.stdout.write('\n  Update complete!\n\n');
  } catch (err) {
    // Cleanup on error
    const tmpDir = resolve(process.cwd(), '.hydra-update-tmp');
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
