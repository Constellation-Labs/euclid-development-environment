import { resolve } from 'node:path';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadConfig, writeConfigAtomic, logger, LogLevel } from '../../../index.js';
import { formatError, formatSuccess, formatHeader } from '../../ui/format.js';

const DEFAULT_REPO = 'https://github.com/Constellation-Labs/metagraph-examples.git';
const DEFAULT_PATH = 'examples';

const GITIGNORE_CONTENT = `# IDE and editor files
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store

# Scala build artifacts
.metals/
.bloop/
.bsp/
.scala-build/
target/
metals.sbt
**/metals.sbt
project/metals.sbt
project/project/metals.sbt
.scalafmt-cache
.scalafix-cache

# Node
node_modules/
dist/

# Jars (downloaded during build)
docker/artifacts/jars/*.jar

# Genesis files (generated)
data/metagraph-l0/genesis/genesis.address
data/metagraph-l0/genesis/genesis.snapshot
docker/artifacts/genesis/*

# Grafana data
docker/grafana/grafana/config/
docker/grafana/prometheus/data/
docker/grafana/prometheus/monitoring/

# Monitoring service
data/*-monitoring-service/node_modules
data/*-monitoring-service/config/config.json
data/*-monitoring-service/config/id_monitoring

# Project config (contains p12 passwords)
euclid.json

# Private key files
data/p12-files/*
!data/p12-files/.gitkeep
`;

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
    const projectRoot = process.cwd();
    const tmpDir = resolve(projectRoot, '.hydra-tmp');

    // Clean up any previous temp directory
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }

    // Clone the repository
    process.stdout.write('\n  Cloning template repository...\n');
    execSync(`git clone --quiet "${repo}" "${tmpDir}"`, { stdio: 'pipe' });

    // Checkout branch if specified
    if (options.branch) {
      execSync(`git checkout --quiet "${options.branch}"`, {
        cwd: tmpDir,
        stdio: 'pipe',
      });
    }

    // List mode
    if (options.list) {
      const templatesDir = resolve(tmpDir, templatePath);
      if (!existsSync(templatesDir)) {
        process.stderr.write(
          `\nError: Template path '${templatePath}' not found in repository.\n\n`,
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
      process.stderr.write('\nError: You must provide a template name with --name.\n');
      process.stderr.write(`  Use 'hydra install-template --list' to see available templates.\n\n`);
      await rm(tmpDir, { recursive: true, force: true });
      process.exit(1);
    }

    const templateDir = resolve(tmpDir, templatePath, options.name);
    if (!existsSync(templateDir)) {
      process.stderr.write(
        `\nError: Template '${options.name}' not found at ${templatePath}/${options.name}\n`,
      );
      process.stderr.write(`  Use 'hydra install-template --list' to see available templates.\n\n`);
      await rm(tmpDir, { recursive: true, force: true });
      process.exit(1);
    }

    // Ensure data/project directory exists
    const projectsDir = resolve(projectRoot, 'data', 'project');
    execSync(`mkdir -p "${projectsDir}"`, { stdio: 'pipe' });

    // Remove old project directory if exists
    const destDir = resolve(projectsDir, options.name);
    if (existsSync(destDir)) {
      await rm(destDir, { recursive: true, force: true });
    }

    // Move template to projects directory
    process.stdout.write(`  Moving template to data/project/${options.name}...\n`);
    execSync(`mv "${templateDir}" "${destDir}"`, { stdio: 'pipe' });

    // Update euclid.json with project name
    process.stdout.write(`  Updating euclid.json...\n`);
    const _config = await loadConfig();

    const configPath = resolve(projectRoot, 'euclid.json');
    const rawConfig = JSON.parse(await readFile(configPath, 'utf-8'));
    rawConfig.project_name = options.name;

    // Try to extract tessellation version from the template's Dependencies.scala
    const depsFile = resolve(destDir, 'project', 'Dependencies.scala');
    if (existsSync(depsFile)) {
      const depsContent = await readFile(depsFile, 'utf-8');
      const match = depsContent.match(/val tessellation\s*=\s*"([^"]+)"/);
      if (match) {
        rawConfig.tessellation_version = match[1];
        process.stdout.write(`  ${formatSuccess(`Tessellation version set to ${match[1]}`)}\n`);
      }
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
      execSync(`chmod -R +w "${gitDir}" && rm -rf "${gitDir}"`, { stdio: 'pipe' });
    }

    execSync('git init', { cwd: projectRoot, stdio: 'pipe' });
    execSync('git add -A', { cwd: projectRoot, stdio: 'pipe' });
    execSync(`git commit -m "Initial commit after hydra install-template (${options.name})"`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    process.stdout.write(`  ${formatSuccess('Git repository initialized with initial commit')}\n`);

    process.stdout.write(`\n  Template '${options.name}' installed successfully!\n\n`);
  } catch (err) {
    // Cleanup on error
    const tmpDir = resolve(process.cwd(), '.hydra-tmp');
    if (existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
