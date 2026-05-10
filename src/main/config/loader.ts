import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { EuclidConfigSchema, isLegacyConfig } from './schema.js';
import type { EuclidConfig } from './schema.js';
import { migrateV1toV2 } from './migration.js';
import { writeConfigAtomic } from './writer.js';
import {
  ConfigNotFoundError,
  ConfigValidationError,
  ConfigError,
  errorMessage,
} from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { isLegacyScaffold, migrateScaffoldV1toV2 } from '../shared/scaffold-migration.js';

const CONFIG_FILENAME = 'euclid.json';

/**
 * Resolve the path to euclid.json by walking up from the given directory.
 * Returns the absolute path if found, or null.
 */
export function findConfigPath(startDir?: string): string | null {
  let dir = startDir ?? process.cwd();
  const root = resolve('/');

  while (true) {
    const candidate = resolve(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir || dir === root) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Find the project root directory (the directory containing euclid.json).
 * Walks up from cwd to find the config file and returns its parent directory.
 * Falls back to cwd if no config file is found.
 */
export function findProjectRoot(): string {
  const configPath = findConfigPath();
  if (configPath) {
    return dirname(configPath);
  }
  return process.cwd();
}

/**
 * Load and validate euclid.json. Automatically migrates v1 configs.
 *
 * @param configPath - Explicit path to euclid.json, or auto-detect from cwd.
 * @returns Validated EuclidConfig
 */
export async function loadConfig(configPath?: string): Promise<EuclidConfig> {
  const resolvedPath = configPath ?? findConfigPath();

  if (!resolvedPath || !existsSync(resolvedPath)) {
    throw new ConfigNotFoundError(configPath ?? CONFIG_FILENAME);
  }

  let raw: Record<string, unknown>;
  try {
    const content = await readFile(resolvedPath, 'utf-8');
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(`Failed to parse ${resolvedPath}: ${errorMessage(err)}`, {
      suggestion: 'Ensure euclid.json contains valid JSON.',
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
    });
  }

  // Auto-migrate legacy v1 configs
  if (isLegacyConfig(raw)) {
    logger.info('Detected legacy (v1) configuration — migrating to v2...');
    const migrated = migrateV1toV2(raw);

    // Back up old config
    const backupPath = resolvedPath.replace(/\.json$/, '.v1.backup.json');
    const originalContent = await readFile(resolvedPath, 'utf-8');
    await writeConfigAtomic(backupPath, JSON.parse(originalContent));
    logger.info(`Backed up original config to ${backupPath}`);

    // Write migrated config
    await writeConfigAtomic(resolvedPath, migrated);
    logger.info('Migration complete.');
    raw = migrated as unknown as Record<string, unknown>;
  }

  // Auto-migrate legacy v1 (Bash Hydra) scaffold layout to v2 (TS Hydra).
  // Detection is filesystem-based (presence of infra/<image>/Dockerfile);
  // after migration the infra/ directory is renamed so the trigger no
  // longer fires on subsequent runs.
  const projectRoot = dirname(resolvedPath);
  if (isLegacyScaffold(projectRoot)) {
    logger.info('Detected legacy (v1) scaffold layout — migrating to v2...');
    migrateScaffoldV1toV2(projectRoot);
    logger.info(
      'Project layout is now:\n' +
        '    data/             (was source/) — your code, wallets, genesis files\n' +
        '    docker/           Docker build assets\n' +
        '    infra.v1.backup/  old Docker build assets, kept for reference\n' +
        '\n' +
        '  Note: the old infra/<image>/Dockerfile and docker-compose.yml files are\n' +
        '  NOT compatible with current Hydra build orchestration. Do not copy them into\n' +
        '  docker/ directly. If you had customizations (volume mounts, port mappings,\n' +
        '  env additions, etc.), re-express them in docker/custom/<image>/<file>.\n' +
        '  Once verified, you can delete infra.v1.backup/.',
    );
  }

  return validateConfig(raw);
}

/**
 * Validate a raw object against the EuclidConfig schema.
 * Throws ConfigValidationError with detailed issues on failure.
 */
export function validateConfig(raw: unknown): EuclidConfig {
  const result = EuclidConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    throw new ConfigValidationError(issues);
  }

  return result.data;
}

/**
 * Validate config without throwing — returns issues or null.
 */
export function checkConfig(raw: unknown): Array<{ path: string; message: string }> | null {
  const result = EuclidConfigSchema.safeParse(raw);
  if (result.success) return null;

  return result.error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
