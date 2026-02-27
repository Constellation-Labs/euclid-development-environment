import { readFile } from 'node:fs/promises';
import { findConfigPath, checkConfig, isLegacyConfig, logger, LogLevel } from '../../../core/index.js';
import { formatError } from '../../ui/format.js';

export async function configValidateCommand(options: {
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  const configPath = findConfigPath();
  if (!configPath) {
    process.stderr.write('Error: euclid.json not found in current directory or parents.\n');
    process.exit(1);
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const raw = JSON.parse(content);

    // Check for legacy config
    if (isLegacyConfig(raw)) {
      if (options.json) {
        process.stdout.write(
          JSON.stringify({ status: 'legacy', message: 'Legacy v1 config detected. Run hydra config migrate.' }) + '\n',
        );
      } else {
        process.stdout.write('\n  Legacy (v1) configuration detected.\n');
        process.stdout.write("  Run 'hydra config migrate' to upgrade to v2.\n\n");
      }
      return;
    }

    const issues = checkConfig(raw);

    if (!issues) {
      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'valid', issues: [] }) + '\n');
      } else {
        process.stdout.write('\n  Configuration is valid.\n\n');
      }
    } else {
      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'invalid', issues }) + '\n');
      } else {
        process.stderr.write(`\n  Configuration has ${issues.length} issue(s):\n\n`);
        for (const issue of issues) {
          process.stderr.write(`  - ${issue.path}: ${issue.message}\n`);
        }
        process.stderr.write('\n');
      }
      process.exit(1);
    }
  } catch (err) {
    process.stderr.write(formatError(err) + '\n');
    process.exit(1);
  }
}
