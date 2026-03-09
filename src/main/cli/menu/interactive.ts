import { select, confirm, input, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import { t } from '../ui/theme.js';

// ─── Import command functions ───────────────────────────────────────────────

import { doctorCommand } from '../commands/setup/doctor.js';
import { configShowCommand } from '../commands/config/show.js';
import { configValidateCommand } from '../commands/config/validate.js';
import { configMigrateCommand } from '../commands/config/migrate.js';
import { installCommand } from '../commands/setup/install.js';
import { installTemplateCommand } from '../commands/setup/install-template.js';
import { installMonitoringServiceCommand } from '../commands/setup/install-monitoring-service.js';
import { buildCommand } from '../commands/cluster/build.js';
import { startCommand } from '../commands/cluster/start.js';
import { stopCommand } from '../commands/cluster/stop.js';
import { statusCommand } from '../commands/cluster/status.js';
import { logsCommand } from '../commands/cluster/logs.js';
import { destroyCommand } from '../commands/cluster/destroy.js';
import { purgeCommand } from '../commands/cluster/purge.js';
import { createRemoteGenesisCommand } from '../commands/remote/create-genesis.js';
import { updateCommand } from '../commands/setup/update.js';
import { checkSeedlistCommand } from '../commands/setup/check-seedlist.js';
import { keygenCommand } from '../commands/setup/keygen.js';
import { remoteDeployCommand } from '../commands/remote/deploy.js';
import { remoteStartCommand } from '../commands/remote/start.js';
import { remoteStatusCommand } from '../commands/remote/status.js';
import { remoteLogsCommand } from '../commands/remote/logs.js';
import { remoteDeployMonitoringCommand } from '../commands/remote/deploy-monitoring.js';
import { remoteStartMonitoringCommand } from '../commands/remote/start-monitoring.js';
import { remoteSnapshotFeeConfigCommand } from '../commands/remote/snapshot-fee-config.js';
import { loadClusterState } from '../../cluster/state.js';
import { findConfigPath, loadConfig } from '../../config/loader.js';
import { checkPrerequisites } from './prerequisites.js';

// ─── process.exit() Interception ────────────────────────────────────────────

class CommandExitError extends Error {
  constructor(public readonly exitCode: number) {
    super(`Command exited with code ${exitCode}`);
    this.name = 'CommandExitError';
  }
}

// ─── Version ────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '2.0.0';
  }
}

// ─── Banner ─────────────────────────────────────────────────────────────────

const BANNER_LINES = [' ╦ ╦ ╦ ╦ ╔╦╗ ╦═╗ ╔═╗', ' ╠═╣ ╚╦╝  ║║ ╠╦╝ ╠═╣', ' ╩ ╩  ╩  ═╩╝ ╩╚═ ╩ ╩'];

const GRADIENT = [
  chalk.hex('#818CF8'), // Indigo
  chalk.hex('#A78BFA'), // Violet
  chalk.hex('#C084FC'), // Purple
];

function printBanner(): void {
  const version = getVersion();
  const o = process.stdout;

  o.write('\n');
  for (let i = 0; i < BANNER_LINES.length; i++) {
    o.write(`   ${GRADIENT[i](BANNER_LINES[i])}\n`);
  }
  o.write(`   ${t.dim('─'.repeat(23))}\n`);
  o.write(
    `   ${t.dim('v' + version)}  ${t.dim('│')}  ${t.muted('Constellation Metagraph Toolkit')}\n`,
  );
  o.write('\n');
}

// ─── Context Info ───────────────────────────────────────────────────────────

async function printContext(): Promise<void> {
  const parts: string[] = [];
  const o = process.stdout;

  // Project detection
  try {
    const configPath = findConfigPath();
    if (configPath) {
      parts.push(`${t.dim('project')} ${t.white('euclid.json')}`);
    }
  } catch {
    /* no config found — that's fine */
  }

  // Cluster state
  try {
    const state = await loadClusterState();
    const dot =
      state.status === 'running'
        ? t.accent('●')
        : state.status === 'degraded'
          ? t.warn('●')
          : state.status === 'starting'
            ? t.cyan('●')
            : state.status === 'stopping'
              ? t.warn('●')
              : t.dim('●');
    parts.push(`${t.dim('cluster')} ${dot} ${t.white(state.status)}`);

    const layerCount = Object.keys(state.layers).length;
    if (layerCount > 0) {
      const nodeCount = Object.values(state.layers).reduce(
        (sum, l) => sum + Object.keys(l?.nodes ?? {}).length,
        0,
      );
      parts.push(
        `${t.muted(String(nodeCount))} ${t.dim('nodes')}  ${t.muted(String(layerCount))} ${t.dim('layers')}`,
      );
    }
  } catch {
    /* no state — that's fine */
  }

  if (parts.length > 0) {
    o.write(`   ${parts.join(t.dim('  │  '))}\n\n`);
  }
}

// ─── Menu ───────────────────────────────────────────────────────────────────

/** Build a decorated section header with ruled lines and spacing */
function section(emoji: string, label: string): Separator[] {
  const header = `${emoji} ${label}`;
  const lineLen = 38 - label.length;
  const rule = lineLen > 0 ? ' ' + t.dim('─'.repeat(lineLen)) : '';
  return [
    new Separator(''), // blank line above
    new Separator(`  ${t.dim('─── ')}${t.primary.bold(header)}${rule}`),
  ];
}

const MENU_CHOICES = [
  ...section('🔍', 'Environment'),
  {
    name: `doctor                   ${t.dim('Verify your development environment')}`,
    value: 'doctor',
  },
  {
    name: `config show              ${t.dim('Display the current configuration')}`,
    value: 'config:show',
  },
  { name: `config validate          ${t.dim('Validate euclid.json')}`, value: 'config:validate' },
  { name: `config migrate           ${t.dim('Migrate v1 config to v2')}`, value: 'config:migrate' },

  ...section('📦', 'Project Setup'),
  { name: `install                  ${t.dim('Create .gitignore and git repo')}`, value: 'install' },
  {
    name: `install-template         ${t.dim('Install from a Git template')}`,
    value: 'install-template',
  },

  ...section('🖥️ ', 'Local Cluster'),
  {
    name: `build                    ${t.dim('Build Docker images and compile JARs')}`,
    value: 'build',
  },
  { name: `start                    ${t.dim('Start the local cluster')}`, value: 'start' },
  { name: `stop                     ${t.dim('Stop the local cluster')}`, value: 'stop' },
  { name: `status                   ${t.dim('Show cluster health')}`, value: 'status' },
  { name: `logs                     ${t.dim('Tail logs for a layer')}`, value: 'logs' },
  { name: `destroy                  ${t.dim('Remove containers and network')}`, value: 'destroy' },
  { name: `purge                    ${t.dim('Destroy + remove Docker images')}`, value: 'purge' },

  ...section('🌐', 'Remote Deploy'),
  {
    name: `create-remote-genesis    ${t.dim('Generate genesis files for remote')}`,
    value: 'create-remote-genesis',
  },
  { name: `remote deploy            ${t.dim('Deploy to remote hosts')}`, value: 'remote:deploy' },
  { name: `remote start             ${t.dim('Start remote cluster')}`, value: 'remote:start' },
  { name: `remote status            ${t.dim('Check remote node health')}`, value: 'remote:status' },
  { name: `remote logs              ${t.dim('Tail remote logs')}`, value: 'remote:logs' },
  {
    name: `remote snapshot-fee      ${t.dim('Fetch snapshot fee config')}`,
    value: 'remote:snapshot-fee-config',
  },

  ...section('📊', 'Monitoring'),
  {
    name: `install-monitoring       ${t.dim('Download monitoring service')}`,
    value: 'install-monitoring-service',
  },
  {
    name: `remote deploy-monitoring ${t.dim('Deploy monitoring to remote')}`,
    value: 'remote:deploy-monitoring',
  },
  {
    name: `remote start-monitoring  ${t.dim('Start remote monitoring')}`,
    value: 'remote:start-monitoring',
  },

  ...section('🛠️ ', 'Utilities'),
  { name: `keygen                   ${t.dim('Generate p12 keystore files')}`, value: 'keygen' },
  { name: `update                   ${t.dim('Update Hydra version')}`, value: 'update' },
  {
    name: `check-seedlist           ${t.dim('Verify seedlist registration')}`,
    value: 'check-seedlist',
  },

  new Separator(''),
  new Separator(`  ${t.dim('─'.repeat(44))}`),
  { name: t.error('  ✕ Exit'), value: 'exit' },
];

// ─── Layer Choices ──────────────────────────────────────────────────────────

const LAYER_CHOICES = [
  { name: 'Global L0', value: 'global-l0' },
  { name: 'DAG L1', value: 'dag-l1' },
  { name: 'Metagraph L0', value: 'metagraph-l0' },
  { name: 'Currency L1', value: 'currency-l1' },
  { name: 'Data L1', value: 'data-l1' },
];

const REMOTE_LAYER_CHOICES = [
  { name: 'Metagraph L0', value: 'metagraph-l0' },
  { name: 'Currency L1', value: 'currency-l1' },
  { name: 'Data L1', value: 'data-l1' },
];

// ─── Dynamic Choices ────────────────────────────────────────────────────────

async function getNodeChoices(): Promise<Array<{ name: string; value: string }>> {
  try {
    const config = await loadConfig();
    return config.nodes.map((n) => ({ name: n.name, value: n.name }));
  } catch {
    return [{ name: 'node-1', value: 'node-1' }];
  }
}

// ─── Prerequisite Resolution ────────────────────────────────────────────────

async function resolvePrerequisites(command: string): Promise<void> {
  const projectRoot = process.cwd();

  // Loop to handle chained prerequisites (e.g. remote:deploy → build → create-remote-genesis)

  while (true) {
    const missing = await checkPrerequisites(command, projectRoot);
    if (!missing) return;

    process.stdout.write(`\n  ${t.warn('⚠')}  ${missing.label}\n\n`);

    const runIt = await confirm({
      message: `Run '${missing.commandLabel}' first?`,
      default: true,
    });

    if (!runIt) {
      process.stdout.write(`\n  ${t.dim('Skipped. Returning to menu.')}\n`);
      throw new CommandExitError(0);
    }

    // Run the prerequisite command
    process.stdout.write('\n');
    await executeCommand(missing.command);
    process.stdout.write('\n');
  }
}

// ─── Command Dispatch ───────────────────────────────────────────────────────

async function executeCommand(command: string): Promise<void> {
  // ── Prerequisite check ───────────────────────────────────────────
  await resolvePrerequisites(command);

  switch (command) {
    // ── Simple commands (no sub-prompts) ──────────────────────────────
    case 'doctor':
      return doctorCommand({});
    case 'config:show':
      return configShowCommand({});
    case 'config:validate':
      return configValidateCommand({});
    case 'config:migrate':
      return configMigrateCommand({});
    case 'install':
      return installCommand({});
    case 'install-monitoring-service':
      return installMonitoringServiceCommand({});
    case 'stop':
      return stopCommand({});
    case 'status':
      return statusCommand({});
    case 'create-remote-genesis':
      return createRemoteGenesisCommand({});
    case 'remote:status':
      return remoteStatusCommand({});
    case 'remote:deploy-monitoring':
      return remoteDeployMonitoringCommand({});
    case 'remote:snapshot-fee-config':
      return remoteSnapshotFeeConfigCommand({});

    // ── Commands with sub-prompts ─────────────────────────────────────

    case 'build': {
      const noCache = await confirm({
        message: 'Force rebuild without Docker cache?',
        default: false,
      });
      return buildCommand({ noCache });
    }

    case 'start': {
      const mode = await select({
        message: 'Start mode:',
        choices: [
          {
            name: `${t.accent('▶')} Rollback — resume from last state`,
            value: 'rollback' as const,
          },
          {
            name: `${t.warn('★')} Genesis  — start fresh (erases history)`,
            value: 'genesis' as const,
          },
        ],
      });
      return startCommand({ genesis: mode === 'genesis' });
    }

    case 'logs': {
      const layer = await select({ message: 'Which layer?', choices: LAYER_CHOICES });
      const nodeChoices = await getNodeChoices();
      const node = await select({ message: 'Which node?', choices: nodeChoices });
      return logsCommand(layer, { node, follow: true, lines: 50 });
    }

    case 'destroy':
      return destroyCommand({});

    case 'purge':
      return purgeCommand({});

    case 'install-template': {
      const action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: 'List available templates', value: 'list' as const },
          { name: 'Install a template', value: 'install' as const },
        ],
      });
      if (action === 'list') return installTemplateCommand({ list: true });
      const name = await input({
        message: 'Template name:',
        validate: (v: string) => v.trim().length > 0 || 'Template name is required',
      });
      return installTemplateCommand({ name: name.trim() });
    }

    case 'update': {
      const version = await input({
        message: 'Version tag or branch:',
        validate: (v: string) => v.trim().length > 0 || 'Version is required',
      });
      return updateCommand({ version: version.trim() });
    }

    case 'check-seedlist': {
      const network = await select({
        message: 'Which network?',
        choices: [
          { name: 'TestNet', value: 'testnet' },
          { name: 'IntegrationNet', value: 'integrationnet' },
          { name: 'MainNet', value: 'mainnet' },
        ],
      });
      return checkSeedlistCommand({ network });
    }

    case 'keygen':
      return keygenCommand({});

    // ── Remote commands ───────────────────────────────────────────────

    case 'remote:deploy': {
      const forceGenesis = await confirm({
        message: 'Force genesis file upload even if data exists?',
        default: false,
      });
      return remoteDeployCommand({ forceGenesis });
    }

    case 'remote:start': {
      const mode = await select({
        message: 'Start mode:',
        choices: [
          {
            name: `${t.accent('▶')} Rollback — resume from last state`,
            value: 'rollback' as const,
          },
          {
            name: `${t.warn('★')} Genesis  — start fresh (erases history)`,
            value: 'genesis' as const,
          },
        ],
      });
      return remoteStartCommand({ genesis: mode === 'genesis' });
    }

    case 'remote:logs': {
      const host = await input({
        message: 'Remote host IP or hostname:',
        validate: (v: string) => v.trim().length > 0 || 'Host is required',
      });
      const layer = await select({ message: 'Which layer?', choices: REMOTE_LAYER_CHOICES });
      return remoteLogsCommand(host.trim(), layer, { lines: 50, follow: true });
    }

    case 'remote:start-monitoring': {
      const forceRestart = await confirm({
        message: 'Force restart the monitoring service?',
        default: false,
      });
      return remoteStartMonitoringCommand({ forceRestart });
    }

    default:
      process.stderr.write(`\n  Unknown command: ${command}\n\n`);
  }
}

// ─── Safe Execution Wrapper ─────────────────────────────────────────────────

async function runCommandSafe(command: string): Promise<void> {
  const originalExit = process.exit;

  // Override process.exit so commands return to menu instead of killing process
  process.exit = ((code?: number) => {
    throw new CommandExitError(code ?? 0);
  }) as never;

  try {
    await executeCommand(command);
  } catch (err) {
    if (err instanceof CommandExitError) {
      // Command exited — error output was already written by the command
      return;
    }
    if (err instanceof Error && err.name === 'ExitPromptError') {
      process.stdout.write(`\n  ${t.warn('Cancelled.')}\n`);
      return;
    }
    // Unexpected error — display it
    process.stderr.write(
      `\n  ${t.error('Error:')} ${err instanceof Error ? err.message : String(err)}\n\n`,
    );
  } finally {
    process.exit = originalExit;
  }
}

// ─── Main Interactive Loop ──────────────────────────────────────────────────

export async function runInteractiveMenu(): Promise<void> {
  printBanner();
  await printContext();

  while (true) {
    let command: string;

    try {
      command = await select({
        message: t.white.bold('What would you like to do?'),
        choices: MENU_CHOICES,
        pageSize: 40,
        loop: false,
      });
    } catch (err) {
      // Ctrl+C at the main menu → exit gracefully
      if (err instanceof Error && err.name === 'ExitPromptError') {
        process.stdout.write(t.dim('\n   Goodbye! 👋\n\n'));
        return;
      }
      throw err;
    }

    if (command === 'exit') {
      process.stdout.write(t.dim('\n   Goodbye! 👋\n\n'));
      return;
    }

    process.stdout.write('\n');
    await runCommandSafe(command);
    process.stdout.write('\n');
  }
}
