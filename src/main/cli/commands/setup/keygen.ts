import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { input, confirm, select } from '@inquirer/prompts';
import { t, icon } from '../../ui/theme.js';
import { formatHeader, formatError } from '../../ui/format.js';
import { createSpinner, spinnerSuccess, spinnerFail } from '../../ui/spinner.js';
import { findConfigPath, findProjectRoot } from '../../../config/loader.js';
import { readFile, writeFile } from 'node:fs/promises';
import { logger } from '../../../shared/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface KeygenOptions {
  count?: string | number;
  aliasPrefix?: string;
  password?: string;
  updateConfig?: boolean;
  verbose?: boolean;
}

interface GeneratedKey {
  name: string;
  alias: string;
  password: string;
  path: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function keytoolAvailable(): boolean {
  try {
    execFileSync('keytool', ['-help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function resolveP12Dir(): string {
  const dir = resolve(findProjectRoot(), 'data', 'p12-files');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function generateAlias(prefix: string, index: number): string {
  return index === 0 ? prefix : `${prefix}-${index}`;
}

function generateFilename(alias: string): string {
  return `${alias}.p12`;
}

// ─── Core Generation ────────────────────────────────────────────────────────

function generateKeystore(outputPath: string, alias: string, password: string): void {
  execFileSync(
    'keytool',
    [
      '-genkeypair',
      '-alias',
      alias,
      '-keyalg',
      'EC',
      '-groupname',
      'secp256k1',
      '-keystore',
      outputPath,
      '-storetype',
      'PKCS12',
      '-storepass',
      password,
      '-dname',
      'CN=Constellation Node',
    ],
    { stdio: 'pipe' },
  );
}

// ─── Config Update ──────────────────────────────────────────────────────────

async function updateEuclidConfig(keys: GeneratedKey[]): Promise<boolean> {
  const configPath = findConfigPath();
  if (!configPath) {
    process.stdout.write(
      `  ${icon.warn} ${t.warn('No euclid.json found — skipping config update')}\n`,
    );
    return false;
  }

  try {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;

    // Build node entries from generated keys
    const nodes = keys.map((key, i) => ({
      name: `metagraph-node-${i + 1}`,
      key_file: {
        name: key.name,
        alias: key.alias,
        password: key.password,
      },
    }));

    config.nodes = nodes;

    // Also set snapshot_fees to use first two keys if at least 2 keys
    if (keys.length >= 2) {
      config.snapshot_fees = {
        owner: {
          key_file: {
            name: keys[0].name,
            alias: keys[0].alias,
            password: keys[0].password,
          },
        },
        staking: {
          key_file: {
            name: keys[1].name,
            alias: keys[1].alias,
            password: keys[1].password,
          },
        },
      };
    }

    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return true;
  } catch (err) {
    logger.error('Failed to update config', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Command ────────────────────────────────────────────────────────────────

export async function keygenCommand(options: KeygenOptions): Promise<void> {
  process.stdout.write(formatHeader('Generate P12 Keystores'));

  // Pre-check: keytool available?
  if (!keytoolAvailable()) {
    process.stdout.write(`  ${icon.error} ${t.error('keytool not found')}\n`);
    process.stdout.write(
      `  ${t.dim('Install a JDK (e.g. brew install openjdk@21) or ensure JAVA_HOME/bin is on PATH')}\n\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`  ${icon.pass} ${t.dim('keytool available')}\n\n`);

  // Determine parameters — interactive or from flags
  let count: number;
  let aliasPrefix: string;
  let password: string;
  let shouldUpdateConfig: boolean;

  if (options.count !== undefined && options.password !== undefined) {
    // Non-interactive mode
    count = typeof options.count === 'string' ? parseInt(options.count, 10) : options.count;
    aliasPrefix = options.aliasPrefix ?? 'token-key';
    password = options.password;
    shouldUpdateConfig = options.updateConfig ?? false;
  } else {
    // Interactive mode
    const countStr = await input({
      message: 'How many keystores to generate?',
      default: '3',
      validate: (v: string) => {
        const n = parseInt(v, 10);
        return (n > 0 && n <= 10) || 'Enter a number between 1 and 10';
      },
    });
    count = parseInt(countStr, 10);

    aliasPrefix = await input({
      message: 'Alias prefix (keystores will be named prefix, prefix-1, prefix-2, ...):',
      default: 'token-key',
      validate: (v: string) => v.trim().length > 0 || 'Alias prefix is required',
    });

    const passwordChoice = await select({
      message: 'Password for keystores:',
      choices: [
        { name: 'Use a single password for all', value: 'single' as const },
        { name: 'Enter password per keystore (advanced)', value: 'per-key' as const },
      ],
    });

    password =
      passwordChoice === 'single'
        ? await input({
            message: 'Password:',
            default: 'password',
            validate: (v: string) => v.length >= 1 || 'Password is required',
          })
        : ''; // will prompt per-key below

    shouldUpdateConfig = await confirm({
      message: 'Update euclid.json with generated key references?',
      default: true,
    });
  }

  // Generate keystores
  const p12Dir = resolveP12Dir();
  const generated: GeneratedKey[] = [];

  process.stdout.write('\n');

  for (let i = 0; i < count; i++) {
    const alias = generateAlias(aliasPrefix, i);
    const filename = generateFilename(alias);
    const outputPath = resolve(p12Dir, filename);

    // Per-key password if needed
    let keyPassword = password;
    if (!keyPassword) {
      keyPassword = await input({
        message: `Password for ${alias}:`,
        default: 'password',
      });
    }

    // Check for existing file
    if (existsSync(outputPath)) {
      const overwrite = await confirm({
        message: `${filename} already exists. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        process.stdout.write(`  ${icon.warn} ${t.dim('Skipped')} ${filename}\n`);
        generated.push({ name: filename, alias, password: keyPassword, path: outputPath });
        continue;
      }
    }

    const spinner = createSpinner(`Generating ${t.white(filename)}...`);
    spinner.start();

    try {
      generateKeystore(outputPath, alias, keyPassword);
      spinnerSuccess(spinner, `${t.white(filename)}  ${t.dim('alias=')}${alias}`);
      generated.push({ name: filename, alias, password: keyPassword, path: outputPath });
    } catch (err) {
      spinnerFail(spinner, `Failed to generate ${filename}`);
      process.stderr.write(`  ${formatError(err)}\n`);
      process.exit(1);
    }
  }

  // Summary
  process.stdout.write(
    `\n  ${t.accent(`${generated.length} keystore(s) generated`)} ${t.dim('in')} data/p12-files/\n`,
  );

  // Update config
  if (shouldUpdateConfig) {
    process.stdout.write('\n');
    const spinner = createSpinner('Updating euclid.json...');
    spinner.start();

    const ok = await updateEuclidConfig(generated);
    if (ok) {
      spinnerSuccess(spinner, 'euclid.json updated with key references');
    } else {
      spinnerFail(spinner, 'Could not update euclid.json');
    }
  }

  process.stdout.write('\n');

  // Show next steps
  process.stdout.write(`  ${t.dim('Next steps:')}\n`);
  process.stdout.write(
    `    ${icon.arrow} ${t.dim('Run')} hydra build  ${t.dim('to build Docker images')}\n`,
  );
  process.stdout.write(
    `    ${icon.arrow} ${t.dim('Run')} hydra start  ${t.dim('to start the cluster')}\n`,
  );
  process.stdout.write('\n');
}
