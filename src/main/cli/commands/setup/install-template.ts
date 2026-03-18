import { resolve } from 'node:path';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';
import {
  loadConfig,
  writeConfigAtomic,
  findProjectRoot,
  findConfigPath,
  logger,
  LogLevel,
} from '../../../index.js';
import { formatError, formatSuccess, formatHeader } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';
import { GITIGNORE_CONTENT } from '../../../shared/gitignore.js';

/** Default euclid.json for new projects (created by install-template). */
function createDefaultConfig(projectName: string, tessellationVersion?: string) {
  return {
    config_version: 2,
    project_name: projectName,
    tessellation_version: tessellationVersion ?? '2.0.0',
    tessellation_ref_type: 'tag',
    framework: {
      name: 'currency',
      modules: ['data'],
      version: 'v3.6.0',
      ref_type: 'tag',
    },
    layers: ['global-l0', 'metagraph-l0', 'currency-l1', 'data-l1'],
    nodes: [
      {
        name: 'metagraph-node-1',
        key_file: { name: 'token-key.p12', alias: 'token-key', password: 'password' },
      },
      {
        name: 'metagraph-node-2',
        key_file: { name: 'token-key-1.p12', alias: 'token-key-1', password: 'password' },
      },
      {
        name: 'metagraph-node-3',
        key_file: { name: 'token-key-2.p12', alias: 'token-key-2', password: 'password' },
      },
    ],
    docker: {
      start_grafana_container: false,
      network_subnet: '172.50.0.0/24',
      base_ip_prefix: '172.50.0.',
      ip_offset: 10,
    },
    ports: {
      global_l0: { public: 9000, p2p: 9001, cli: 9002 },
      dag_l1: { public: 9100, p2p: 9101, cli: 9102 },
      metagraph_l0: { public: 9200, p2p: 9201, cli: 9202 },
      currency_l1: { public: 9300, p2p: 9301, cli: 9302 },
      data_l1: { public: 9400, p2p: 9401, cli: 9402 },
    },
  };
}

const DEFAULT_REPO = 'https://github.com/Constellation-Labs/metagraph-examples.git';
const DEFAULT_PATH = 'examples';

export async function installTemplateCommand(options: {
  name?: string;
  repo?: string;
  path?: string;
  branch?: string;
  list?: boolean;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  const repo = options.repo ?? DEFAULT_REPO;
  const templatePath = options.path ?? DEFAULT_PATH;
  const repoNameWithGit = repo.split('/').pop() ?? 'repo';
  const _repoName = repoNameWithGit.replace(/\.git$/, '');

  try {
    const projectRoot = findProjectRoot();
    const tmpDir = resolve(projectRoot, '.hydra-tmp');

    // Clean up any previous temp directory
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }

    // Clone the repository
    process.stdout.write('\n  Cloning template repository...\n');
    execFileSync('git', ['clone', '--quiet', repo, tmpDir], { stdio: 'pipe' });

    // Checkout branch if specified
    if (options.branch) {
      execFileSync('git', ['checkout', '--quiet', options.branch], {
        cwd: tmpDir,
        stdio: 'pipe',
      });
    }

    // List mode
    if (options.list) {
      const templatesDir = resolve(tmpDir, templatePath);
      if (!existsSync(templatesDir)) {
        process.stderr.write(
          `\n  ${icon.error} ${t.error(`Template path '${templatePath}' not found in repository.`)}\n` +
            `  ${t.muted('Check the --path option or verify the repository structure.')}\n\n`,
        );
        await rm(tmpDir, { recursive: true, force: true });
        process.exit(1);
      }

      const entries = await readdir(templatesDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      process.stdout.write(formatHeader('Available Templates'));
      for (const dir of dirs) {
        process.stdout.write(`    ${dir}\n`);
      }
      process.stdout.write('\n');

      await rm(tmpDir, { recursive: true, force: true });
      return;
    }

    // Name is required for install
    if (!options.name) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error('You must provide a template name with --name.')}\n` +
          `  ${t.muted('Use')} ${t.cyan("'hydra install-template --list'")} ${t.muted('to see available templates.')}\n\n`,
      );
      await rm(tmpDir, { recursive: true, force: true });
      process.exit(1);
    }

    const templateDir = resolve(tmpDir, templatePath, options.name);
    if (!existsSync(templateDir)) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error(`Template '${options.name}' not found at ${templatePath}/${options.name}`)}\n` +
          `  ${t.muted('Use')} ${t.cyan("'hydra install-template --list'")} ${t.muted('to see available templates.')}\n\n`,
      );
      await rm(tmpDir, { recursive: true, force: true });
      process.exit(1);
    }

    // Ensure data/project directory exists
    const projectsDir = resolve(projectRoot, 'data', 'project');
    mkdirSync(projectsDir, { recursive: true });

    // Remove old project directory if exists
    const destDir = resolve(projectsDir, options.name);
    if (existsSync(destDir)) {
      await rm(destDir, { recursive: true, force: true });
    }

    // Move template to projects directory
    process.stdout.write(`  Moving template to data/project/${options.name}...\n`);
    renameSync(templateDir, destDir);

    // Try to extract tessellation version from the template's Dependencies.scala
    let tessellationVersion: string | undefined;
    const depsFile = resolve(destDir, 'project', 'Dependencies.scala');
    if (existsSync(depsFile)) {
      const depsContent = await readFile(depsFile, 'utf-8');
      const match = depsContent.match(/val tessellation\s*=\s*"([^"]+)"/);
      if (match) {
        tessellationVersion = match[1];
      }
    }

    // Update or create euclid.json with project name
    process.stdout.write(`  Updating euclid.json...\n`);
    const configPath = resolve(projectRoot, 'euclid.json');
    const existingConfigPath = findConfigPath(projectRoot);
    let rawConfig: Record<string, unknown>;

    if (existingConfigPath) {
      rawConfig = JSON.parse(await readFile(existingConfigPath, 'utf-8'));
      rawConfig.project_name = options.name;
      if (tessellationVersion) {
        rawConfig.tessellation_version = tessellationVersion;
      }
    } else {
      rawConfig = createDefaultConfig(options.name, tessellationVersion);
      process.stdout.write(`  ${formatSuccess('Created euclid.json with default configuration')}\n`);
    }

    if (tessellationVersion) {
      process.stdout.write(`  ${formatSuccess(`Tessellation version set to ${tessellationVersion}`)}\n`);
    }

    await writeConfigAtomic(configPath, rawConfig);
    process.stdout.write(`  ${formatSuccess(`Project name set to '${options.name}'`)}\n`);

    // Cleanup temp directory
    await rm(tmpDir, { recursive: true, force: true });

    // Create .gitignore and reinit git
    process.stdout.write(`  Initializing git repository...\n`);
    await writeFile(resolve(projectRoot, '.gitignore'), GITIGNORE_CONTENT);

    const gitDir = resolve(projectRoot, '.git');
    if (existsSync(gitDir)) {
      await rm(gitDir, { recursive: true, force: true });
    }

    execFileSync('git', ['init'], { cwd: projectRoot, stdio: 'pipe' });
    execFileSync('git', ['add', '-A'], { cwd: projectRoot, stdio: 'pipe' });
    execFileSync(
      'git',
      ['commit', '-m', `Initial commit after hydra install-template (${options.name})`],
      { cwd: projectRoot, stdio: 'pipe' },
    );
    process.stdout.write(`  ${formatSuccess('Git repository initialized with initial commit')}\n`);

    process.stdout.write(`\n  Template '${options.name}' installed successfully!\n\n`);
  } catch (err) {
    // Cleanup on error
    const tmpDir = resolve(findProjectRoot(), '.hydra-tmp');
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true }).catch((e) => {
        logger.debug(
          `Failed to clean up temp directory: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
