import { readFile } from 'node:fs/promises';
import { findConfigPath, checkConfig, isLegacyConfig, logger, LogLevel } from '../../../index.js';
import { formatError } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

export async function configValidateCommand(options: {
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  const configPath = findConfigPath();
  if (!configPath) {
    process.stderr.write(
      `\n  ${icon.error} ${t.error('euclid.json not found in current directory or parents.')}\n` +
        `  ${t.muted("Run 'hydra install-template' to set up a project first.")}\n\n`,
    );
    process.exit(1);
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const raw = JSON.parse(content);

    // Check for legacy config
    if (isLegacyConfig(raw)) {
      if (options.json) {
        process.stdout.write(
          JSON.stringify({
            status: 'legacy',
            message: 'Legacy v1 config detected. Run hydra config migrate.',
          }) + '\n',
        );
      } else {
        process.stdout.write(`\n  ${icon.warn} ${t.warn('Legacy (v1) configuration detected.')}\n`);
        process.stdout.write(
          `  ${t.muted('Run')} ${t.cyan("'hydra config migrate'")} ${t.muted('to upgrade to v2.')}\n\n`,
        );
      }
      return;
    }

    const issues = checkConfig(raw);

    if (!issues) {
      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'valid', issues: [] }) + '\n');
      } else {
        process.stdout.write(`\n  ${icon.pass} ${t.accent('Configuration is valid.')}\n\n`);
      }
    } else {
      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'invalid', issues }) + '\n');
      } else {
        process.stderr.write(
          `\n  ${icon.error} ${t.error(`Configuration has ${issues.length} issue(s):`)}\n\n`,
        );
        for (const issue of issues) {
          process.stderr.write(`  ${icon.dot} ${t.white(issue.path)}: ${t.muted(issue.message)}\n`);
        }
        process.stderr.write('\n');
      }
      process.exit(1);
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
