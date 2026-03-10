import { resolve } from 'node:path';
import { writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadConfig, findProjectRoot, logger, LogLevel } from '../../../index.js';
import { formatError, formatSuccess } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';
import { GITIGNORE_CONTENT } from '../../../shared/gitignore.js';

export async function installCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const projectRoot = findProjectRoot();

    process.stdout.write('\n  Installing Hydra project...\n\n');

    // Validate project exists
    const projectDir = resolve(projectRoot, 'data', 'project', config.project_name);
    if (!existsSync(projectDir)) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error(`Project directory not found: ${projectDir}`)}\n` +
          `  ${t.muted('Run')} ${t.cyan("'hydra install-template'")} ${t.muted('first to set up a project template.')}\n\n`,
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
      await rm(gitDir, { recursive: true, force: true });
    }

    // Initialize new git repo
    execFileSync('git', ['init'], { cwd: projectRoot, stdio: 'pipe' });
    process.stdout.write(`  ${formatSuccess('Git repository initialized')}\n`);

    // Create initial commit
    process.stdout.write(`  [3/3] Creating initial commit...\n`);
    execFileSync('git', ['add', '-A'], { cwd: projectRoot, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'Initial commit after hydra install'], {
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
