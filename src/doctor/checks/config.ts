import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findConfigPath, checkConfig } from '../../core/index.js';
import type { EuclidConfig } from '../../core/index.js';
import type { CheckResult } from '../index.js';

/**
 * Check configuration file validity and project structure.
 */
export async function checkConfiguration(
  projectRoot: string,
  config: EuclidConfig | null,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check euclid.json exists
  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    results.push({
      name: 'euclid.json',
      status: 'error',
      message: 'not found',
      fix: "Run 'hydra init' to create a new project.",
    });
    return results;
  }

  // If config was already loaded, just validate it
  if (config) {
    results.push({
      name: 'euclid.json',
      status: 'pass',
      message: `valid (v${config.config_version})`,
    });
  } else {
    // Try loading raw to get validation errors
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = JSON.parse(await readFile(configPath, 'utf-8'));
      const issues = checkConfig(raw);
      if (issues) {
        results.push({
          name: 'euclid.json',
          status: 'error',
          message: `${issues.length} validation issue(s)`,
          fix: `Run 'hydra config validate' for details.`,
        });
      } else {
        results.push({
          name: 'euclid.json',
          status: 'pass',
          message: 'valid',
        });
      }
    } catch {
      results.push({
        name: 'euclid.json',
        status: 'error',
        message: 'invalid JSON',
        fix: 'Check euclid.json for syntax errors.',
      });
    }
  }

  if (!config) return results;

  // Check p12 files exist
  const p12Dir = resolve(projectRoot, 'data', 'p12-files');
  const missingP12: string[] = [];
  for (const node of config.nodes) {
    const p12Path = resolve(p12Dir, node.key_file.name);
    if (!existsSync(p12Path)) {
      missingP12.push(node.key_file.name);
    }
  }

  if (missingP12.length === 0) {
    results.push({
      name: 'p12 files',
      status: 'pass',
      message: `${config.nodes.length} key file(s) found`,
    });
  } else {
    results.push({
      name: 'p12 files',
      status: 'error',
      message: `missing: ${missingP12.join(', ')}`,
      fix: `Place .p12 key files in data/p12-files/`,
    });
  }

  // Check project directory exists
  const projectDir = resolve(projectRoot, 'data', 'project', config.project_name);
  if (existsSync(projectDir)) {
    results.push({
      name: 'project',
      status: 'pass',
      message: `data/project/${config.project_name} exists`,
    });
  } else {
    results.push({
      name: 'project',
      status: 'warn',
      message: `data/project/${config.project_name} not found`,
      fix: "Run 'hydra init' to scaffold a project.",
    });
  }

  return results;
}
