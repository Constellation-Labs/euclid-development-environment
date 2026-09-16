import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Resolve the path to the bundled assets directory shipped with the CLI.
 * Assets are copied to dist/assets/ during build.
 */
function getAssetsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // In dist: dist/shared/scaffold.js → dist/assets
  return resolve(dirname(thisFile), '..', 'assets');
}

/**
 * Scaffold the Docker files and data directory structure into a project root.
 * Copies bundled Docker assets (Dockerfiles, compose files, grafana config)
 * and creates the data/ directory scaffold (genesis CSVs, artifacts dirs).
 *
 * Skips files that already exist so it's safe to re-run.
 */
export function scaffoldProject(projectRoot: string): void {
  const assetsDir = getAssetsDir();
  const dockerAssetsDir = resolve(assetsDir, 'docker');

  if (!existsSync(dockerAssetsDir)) {
    throw new Error(
      `Bundled Docker assets not found at ${dockerAssetsDir}. ` +
        'This may indicate a broken CLI installation — try reinstalling.',
    );
  }

  // Copy docker/ directory (recursive, skip existing files)
  const dockerDest = resolve(projectRoot, 'docker');
  cpSync(dockerAssetsDir, dockerDest, { recursive: true, force: false });

  // Create artifact output directories
  mkdirSync(resolve(dockerDest, 'artifacts', 'jars'), { recursive: true });
  mkdirSync(resolve(dockerDest, 'artifacts', 'genesis'), { recursive: true });
  touchGitkeep(resolve(dockerDest, 'artifacts', 'jars'));
  touchGitkeep(resolve(dockerDest, 'artifacts', 'genesis'));
  touchGitkeep(resolve(dockerDest, 'artifacts'));

  // Create grafana storage dir
  mkdirSync(resolve(dockerDest, 'grafana', 'grafana', 'storage'), { recursive: true });
  touchGitkeep(resolve(dockerDest, 'grafana', 'grafana', 'storage'));

  // Create data/ scaffold
  const dataDir = resolve(projectRoot, 'data');
  mkdirSync(resolve(dataDir, 'global-l0', 'genesis'), { recursive: true });
  mkdirSync(resolve(dataDir, 'metagraph-l0', 'genesis'), { recursive: true });
  mkdirSync(resolve(dataDir, 'p12-files'), { recursive: true });
  mkdirSync(resolve(dataDir, 'project'), { recursive: true });
  touchGitkeep(resolve(dataDir));
  touchGitkeep(resolve(dataDir, 'metagraph-l0'));
  touchGitkeep(resolve(dataDir, 'p12-files'));
  touchGitkeep(resolve(dataDir, 'project'));

  // Create empty genesis CSVs if they don't exist (needed by Docker build)
  const globalGenesis = resolve(dataDir, 'global-l0', 'genesis', 'genesis.csv');
  if (!existsSync(globalGenesis)) {
    writeFileSync(globalGenesis, '');
  }
  const metagraphGenesis = resolve(dataDir, 'metagraph-l0', 'genesis', 'genesis.csv');
  if (!existsSync(metagraphGenesis)) {
    writeFileSync(metagraphGenesis, '');
  }
}

function touchGitkeep(dir: string): void {
  const gitkeep = resolve(dir, '.gitkeep');
  if (!existsSync(gitkeep)) {
    writeFileSync(gitkeep, '');
  }
}
