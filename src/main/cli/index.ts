#!/usr/bin/env node

// ─── Node.js version gate ────────────────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  process.stderr.write(
    `\n  Hydra requires Node.js >= 22 (you have ${process.versions.node}).\n` +
      `  Run: nvm install 22 && nvm use 22\n\n`,
  );
  process.exit(1);
}

import { Command } from 'commander';
import { logger, LogLevel } from '../index.js';
import { doctorCommand } from './commands/setup/doctor.js';
import { configShowCommand } from './commands/config/show.js';
import { configValidateCommand } from './commands/config/validate.js';
import { configMigrateCommand } from './commands/config/migrate.js';
import { statusCommand } from './commands/cluster/status.js';
import { buildCommand } from './commands/cluster/build.js';
import { startCommand } from './commands/cluster/start.js';
import { stopCommand } from './commands/cluster/stop.js';
import { destroyCommand } from './commands/cluster/destroy.js';
import { purgeCommand } from './commands/cluster/purge.js';
import { logsCommand } from './commands/cluster/logs.js';
import { installCommand } from './commands/setup/install.js';
import { installTemplateCommand } from './commands/setup/install-template.js';
import { installMonitoringServiceCommand } from './commands/setup/install-monitoring-service.js';
import { createRemoteGenesisCommand } from './commands/remote/create-genesis.js';
import { updateCommand } from './commands/setup/update.js';
import { checkSeedlistCommand } from './commands/setup/check-seedlist.js';
import { keygenCommand } from './commands/setup/keygen.js';
import { remoteDeployCommand } from './commands/remote/deploy.js';
import { remoteStartCommand } from './commands/remote/start.js';
import { remoteStatusCommand } from './commands/remote/status.js';
import { remoteLogsCommand } from './commands/remote/logs.js';
import { remoteDeployMonitoringCommand } from './commands/remote/deploy-monitoring.js';
import { remoteStartMonitoringCommand } from './commands/remote/start-monitoring.js';
import { remoteSnapshotFeeConfigCommand } from './commands/remote/snapshot-fee-config.js';

const program = new Command();

program
  .name('hydra')
  .description('Hydra CLI — build, run, and deploy Constellation metagraphs')
  .version('2.0.0')
  .option('-v, --verbose', 'Show detailed output')
  .option('--json', 'Output as JSON (where supported)')
  .option('--quiet', 'Suppress non-essential output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) logger.setLevel(LogLevel.DEBUG);
    if (opts.quiet) logger.setLevel(LogLevel.ERROR);
    if (opts.json) logger.setFormat('json');
  });

// ─── doctor ──────────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Verify your development environment is properly configured')
  .action(async () => {
    const opts = program.opts();
    await doctorCommand({ verbose: opts.verbose, json: opts.json });
  });

// ─── config ──────────────────────────────────────────────────────────────────

const configCmd = program.command('config').description('Manage euclid.json configuration');

configCmd
  .command('show')
  .description('Display the current configuration')
  .action(async () => {
    const opts = program.opts();
    await configShowCommand({ verbose: opts.verbose, json: opts.json });
  });

configCmd
  .command('validate')
  .description('Validate euclid.json and report any issues')
  .action(async () => {
    const opts = program.opts();
    await configValidateCommand({ verbose: opts.verbose, json: opts.json });
  });

configCmd
  .command('migrate')
  .description('Migrate a legacy (v1) euclid.json to v2 format')
  .action(async () => {
    const opts = program.opts();
    await configMigrateCommand({ verbose: opts.verbose });
  });

// ─── install ────────────────────────────────────────────────────────────────

program
  .command('install')
  .description('Initialize project: create .gitignore and git repository')
  .action(async () => {
    const opts = program.opts();
    await installCommand({ verbose: opts.verbose });
  });

// ─── install-template ───────────────────────────────────────────────────────

program
  .command('install-template')
  .description('Install a project from a Git repository template')
  .option('--name <name>', 'Template name to install')
  .option('--repo <url>', 'Git repository URL (default: metagraph-examples)')
  .option('--path <path>', 'Path within repository (default: examples)')
  .option('--branch <branch>', 'Branch to checkout')
  .option('--list', 'List available templates')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await installTemplateCommand({
      name: cmdOpts.name,
      repo: cmdOpts.repo,
      path: cmdOpts.path,
      branch: cmdOpts.branch,
      list: cmdOpts.list,
      verbose: opts.verbose,
    });
  });

// ─── install-monitoring-service ─────────────────────────────────────────────

program
  .command('install-monitoring-service')
  .description('Download and configure metagraph-monitoring-service')
  .action(async () => {
    const opts = program.opts();
    await installMonitoringServiceCommand({ verbose: opts.verbose });
  });

// ─── build ───────────────────────────────────────────────────────────────────

program
  .command('build')
  .description('Build Docker images and compile metagraph JARs')
  .option('--no-cache', 'Force a full rebuild without Docker cache')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await buildCommand({ noCache: cmdOpts.noCache === false, verbose: opts.verbose });
  });

// ─── start ───────────────────────────────────────────────────────────────────

program
  .command('start')
  .description('Start the local metagraph cluster')
  .option('--genesis', 'Start from genesis (erases history)')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await startCommand({ genesis: cmdOpts.genesis, verbose: opts.verbose });
  });

// ─── Backwards-compatible aliases ────────────────────────────────────────────

program
  .command('start-genesis', { hidden: true })
  .description('[deprecated] Use: hydra start --genesis')
  .action(async () => {
    process.stderr.write(
      "Warning: 'start-genesis' is deprecated. Use 'hydra start --genesis' instead.\n\n",
    );
    const opts = program.opts();
    await startCommand({ genesis: true, verbose: opts.verbose });
  });

program
  .command('start-rollback', { hidden: true })
  .description('[deprecated] Use: hydra start')
  .action(async () => {
    process.stderr.write("Warning: 'start-rollback' is deprecated. Use 'hydra start' instead.\n\n");
    const opts = program.opts();
    await startCommand({ genesis: false, verbose: opts.verbose });
  });

// ─── stop ────────────────────────────────────────────────────────────────────

program
  .command('stop')
  .description('Stop the local metagraph cluster')
  .action(async () => {
    const opts = program.opts();
    await stopCommand({ verbose: opts.verbose });
  });

// ─── destroy ─────────────────────────────────────────────────────────────────

program
  .command('destroy')
  .description('Remove all containers and the Docker network')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await destroyCommand({ yes: cmdOpts.yes, verbose: opts.verbose });
  });

// ─── purge ───────────────────────────────────────────────────────────────────

program
  .command('purge')
  .description('Destroy containers and remove all Docker images')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await purgeCommand({ yes: cmdOpts.yes, verbose: opts.verbose });
  });

// ─── status ──────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show cluster status and node health')
  .action(async () => {
    const opts = program.opts();
    await statusCommand({ verbose: opts.verbose, json: opts.json });
  });

// ─── logs ────────────────────────────────────────────────────────────────────

program
  .command('logs')
  .description('Tail logs for a specific layer')
  .argument('<layer>', 'Layer to tail logs for (e.g. metagraph-l0, currency-l1)')
  .option('--node <name>', 'Node to tail logs from (default: first node)')
  .option('-n, --lines <count>', 'Number of lines to show', '50')
  .option('--no-follow', 'Do not follow log output')
  .action(async (layer, cmdOpts) => {
    const opts = program.opts();
    await logsCommand(layer, {
      node: cmdOpts.node,
      lines: parseInt(cmdOpts.lines, 10),
      follow: cmdOpts.follow !== false,
      verbose: opts.verbose,
    });
  });

// ─── create-remote-genesis ──────────────────────────────────────────────────

program
  .command('create-remote-genesis')
  .description('Start local containers to generate genesis files for remote deployment')
  .action(async () => {
    const opts = program.opts();
    await createRemoteGenesisCommand({ verbose: opts.verbose });
  });

// ─── update ─────────────────────────────────────────────────────────────────

program
  .command('update')
  .description('Update Hydra to a specific version')
  .argument('<version>', 'Version tag or branch to update to')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (version, cmdOpts) => {
    const opts = program.opts();
    await updateCommand({ version, yes: cmdOpts.yes, verbose: opts.verbose });
  });

// ─── check-seedlist ─────────────────────────────────────────────────────────

program
  .command('check-seedlist')
  .description('Verify node peer IDs are registered on a network seedlist')
  .argument('<network>', 'Network to check (integrationnet or mainnet)')
  .action(async (network) => {
    const opts = program.opts();
    await checkSeedlistCommand({ network, verbose: opts.verbose });
  });

// ─── keygen ─────────────────────────────────────────────────────────────────

program
  .command('keygen')
  .description('Generate p12 keystore files for node identity')
  .option('--count <n>', 'Number of keystores to generate')
  .option('--alias-prefix <prefix>', 'Alias naming prefix (default: token-key)')
  .option('--password <password>', 'Keystore password (skips interactive prompt)')
  .option('--update-config', 'Update euclid.json with generated key references')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    if (opts.verbose) logger.setLevel(LogLevel.DEBUG);
    await keygenCommand({
      count: cmdOpts.count,
      aliasPrefix: cmdOpts.aliasPrefix,
      password: cmdOpts.password,
      updateConfig: cmdOpts.updateConfig,
      verbose: opts.verbose,
    });
  });

// ─── remote ─────────────────────────────────────────────────────────────────

const remoteCmd = program.command('remote').description('Manage remote metagraph deployment');

remoteCmd
  .command('deploy')
  .description('Deploy JARs and keys to remote hosts')
  .option('--force-genesis', 'Force genesis file upload even if data exists')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await remoteDeployCommand({ forceGenesis: cmdOpts.forceGenesis, verbose: opts.verbose });
  });

remoteCmd
  .command('start')
  .description('Start the remote metagraph cluster')
  .option('--genesis', 'Start from genesis (erases history)')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await remoteStartCommand({ genesis: cmdOpts.genesis, verbose: opts.verbose });
  });

remoteCmd
  .command('status')
  .description('Check remote node health')
  .action(async () => {
    const opts = program.opts();
    await remoteStatusCommand({ verbose: opts.verbose, json: opts.json });
  });

remoteCmd
  .command('logs')
  .description('Tail logs on a remote host')
  .argument('<host>', 'Remote host IP or hostname')
  .argument('<layer>', 'Layer to tail (metagraph-l0, currency-l1, data-l1)')
  .option('-n, --lines <count>', 'Number of lines to show', '50')
  .option('--no-follow', 'Do not follow log output')
  .action(async (host, layer, cmdOpts) => {
    const opts = program.opts();
    await remoteLogsCommand(host, layer, {
      lines: parseInt(cmdOpts.lines, 10),
      follow: cmdOpts.follow !== false,
      verbose: opts.verbose,
    });
  });

remoteCmd
  .command('deploy-monitoring')
  .description('Deploy monitoring service to remote host')
  .action(async () => {
    const opts = program.opts();
    await remoteDeployMonitoringCommand({ verbose: opts.verbose });
  });

remoteCmd
  .command('start-monitoring')
  .description('Start monitoring service on remote host')
  .option('--force-restart', 'Force restart the monitoring service')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    await remoteStartMonitoringCommand({
      forceRestart: cmdOpts.forceRestart,
      verbose: opts.verbose,
    });
  });

remoteCmd
  .command('snapshot-fee-config')
  .description('Fetch snapshot fee configuration from remote metagraph')
  .action(async () => {
    const opts = program.opts();
    await remoteSnapshotFeeConfigCommand({ verbose: opts.verbose });
  });

// ─── Parse and run ───────────────────────────────────────────────────────────

const userArgs = process.argv.slice(2);
const hasCommand = userArgs.length > 0 && !userArgs[0].startsWith('-');
const hasFlag = userArgs.some((a) => ['--help', '-h', '--version', '-V'].includes(a));

if (hasCommand || hasFlag) {
  // Non-interactive: standard Commander.js parsing
  program.parseAsync(process.argv).catch((err) => {
    process.stderr.write(`\nFatal error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
} else {
  // Interactive mode: no command given → show menu
  import('./menu/interactive.js')
    .then((m) => m.runInteractiveMenu())
    .catch((err) => {
      process.stderr.write(`\nFatal error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
