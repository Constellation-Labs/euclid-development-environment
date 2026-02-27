import { readFile } from 'node:fs/promises';
import {
  findConfigPath,
  isLegacyConfig,
  migrateV1toV2,
  writeConfigAtomic,
  validateConfig,
  logger,
  LogLevel,
} from '../../../core/index.js';
import { formatError, formatSuccess } from '../../ui/format.js';

export async function configMigrateCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  const configPath = findConfigPath();
  if (!configPath) {
    process.stderr.write('Error: euclid.json not found in current directory or parents.\n');
    process.exit(1);
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const raw = JSON.parse(content);

    if (!isLegacyConfig(raw)) {
      process.stdout.write('\n  Configuration is already at the latest version (v2). Nothing to do.\n\n');
      return;
    }

    // Back up
    const backupPath = configPath.replace(/\.json$/, '.v1.backup.json');
    await writeConfigAtomic(backupPath, raw);
    process.stdout.write(`\n  ${formatSuccess(`Backed up original config to ${backupPath}`)}\n`);

    // Migrate
    const migrated = migrateV1toV2(raw);

    // Validate the migrated config
    validateConfig(migrated);

    // Write
    await writeConfigAtomic(configPath, migrated);
    process.stdout.write(`  ${formatSuccess('Migrated euclid.json to v2 format.')}\n\n`);
  } catch (err) {
    process.stderr.write(formatError(err) + '\n');
    process.exit(1);
  }
}
