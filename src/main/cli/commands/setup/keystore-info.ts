import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  loadConfig,
  findProjectRoot,
  logger,
  LogLevel,
  type KeyFileConfig,
} from '../../../index.js';
import { formatError, formatWarning } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

interface KeystoreEntry {
  label: string;
  keyFile: KeyFileConfig;
}

export async function keystoreInfoCommand(options: { verbose?: boolean }): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const projectRoot = findProjectRoot();
    const walletJar = resolve(projectRoot, 'docker', 'artifacts', 'jars', 'cl-wallet.jar');
    const p12Dir = resolve(projectRoot, 'data', 'p12-files');

    if (!existsSync(walletJar)) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error("cl-wallet.jar not found. Run 'hydra build' first.")}\n\n`,
      );
      process.exit(1);
    }

    const entries: KeystoreEntry[] = [];
    for (const node of config.nodes) {
      entries.push({ label: node.name, keyFile: node.key_file });
    }
    if (config.snapshot_fees) {
      entries.push({
        label: 'snapshot_fees.owner',
        keyFile: config.snapshot_fees.owner.key_file,
      });
      entries.push({
        label: 'snapshot_fees.staking',
        keyFile: config.snapshot_fees.staking.key_file,
      });
    }

    process.stdout.write('\n');

    for (const entry of entries) {
      const p12Path = resolve(p12Dir, entry.keyFile.name);

      process.stdout.write(`  ${t.accent(entry.label)} ${t.dim(`(${entry.keyFile.name})`)}\n`);

      if (!existsSync(p12Path)) {
        process.stdout.write(`    ${formatWarning(`P12 file not found at ${p12Path}`)}\n\n`);
        continue;
      }

      const env = {
        ...process.env,
        CL_KEYSTORE: entry.keyFile.name,
        CL_KEYALIAS: entry.keyFile.alias,
        CL_PASSWORD: entry.keyFile.password,
      };

      const address = runWallet(walletJar, p12Dir, env, 'show-address');
      const peerId = runWallet(walletJar, p12Dir, env, 'show-id');

      process.stdout.write(
        `    ${t.dim('DAG address:')} ${address.ok ? address.value : t.error(address.error)}\n`,
      );
      process.stdout.write(
        `    ${t.dim('Peer ID:')}     ${peerId.ok ? peerId.value : t.error(peerId.error)}\n\n`,
      );
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}

type WalletResult = { ok: true; value: string } | { ok: false; error: string };

function runWallet(
  walletJar: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  cmd: string,
): WalletResult {
  try {
    const out = execFileSync('java', ['-jar', walletJar, cmd], {
      cwd,
      env,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!out) return { ok: false, error: `empty output from cl-wallet.jar ${cmd}` };
    return { ok: true, value: out };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
