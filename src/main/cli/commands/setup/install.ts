import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadConfig, logger, LogLevel } from '../../../index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

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

export async function installCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const projectRoot = process.cwd();

    process.stdout.write('\n  Installing Hydra project...\n\n');

    // Validate project exists
    const projectDir = resolve(projectRoot, 'data', 'project', config.project_name);
    if (!existsSync(projectDir)) {
      process.stderr.write(`\nError: Project directory not found: ${projectDir}\n`);
      process.stderr.write(
        `  Run 'hydra install-template' first to set up a project template.\n\n`,
      );
      process.exit(1);
    }

    // Create .gitignore
    process.stdout.write(`  [1/3] Creating .gitignore...\n`);
    await writeFile(resolve(projectRoot, '.gitignore'), GITIGNORE_CONTENT);
    process.stdout.write(`  ${formatSuccess('.gitignore created')}\n`);

    // Remove existing git repo if present
    process.stdout.write(`  [2/3] Initializing git repository...\n`);
    const gitDir = resolve(projectRoot, '.git');
    if (existsSync(gitDir)) {
      execSync(`chmod -R +w "${gitDir}" && rm -rf "${gitDir}"`, { stdio: 'pipe' });
    }

    // Initialize new git repo
    execSync('git init', { cwd: projectRoot, stdio: 'pipe' });
    process.stdout.write(`  ${formatSuccess('Git repository initialized')}\n`);

    // Create initial commit
    process.stdout.write(`  [3/3] Creating initial commit...\n`);
    execSync('git add -A', { cwd: projectRoot, stdio: 'pipe' });
    execSync('git commit -m "Initial commit after hydra install"', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    process.stdout.write(`  ${formatSuccess('Initial commit created')}\n`);

    process.stdout.write('\n  Install complete!\n\n');
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
