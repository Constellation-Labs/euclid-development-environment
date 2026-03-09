import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EuclidConfigSchema, isLegacyConfig } from './schema.js';
import type { EuclidConfig } from './schema.js';
import { migrateV1toV2 } from './migration.js';
import { writeConfigAtomic } from './writer.js';
import { ConfigNotFoundError, ConfigValidationError, ConfigError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

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
    throw new ConfigError(`Failed to parse ${resolvedPath}: ${(err as Error).message}`, {
      suggestion: 'Ensure euclid.json contains valid JSON.',
      cause: err as Error,
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
