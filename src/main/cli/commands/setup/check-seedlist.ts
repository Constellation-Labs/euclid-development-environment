import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import type { EuclidConfig } from '../../../config/schema.js';
import { loadConfig, findProjectRoot, logger, LogLevel } from '../../../index.js';
import { formatError, formatSuccess, formatWarning, formatHeader } from '../../ui/format.js';
import { t, icon } from '../../ui/theme.js';

const SEEDLIST_URLS: Record<string, string> = {
  testnet: 'https://constellationlabs-dag.s3.us-west-1.amazonaws.com/testnet-seedlist',
  integrationnet:
    'https://constellationlabs-dag.s3.us-west-1.amazonaws.com/integrationnet-seedlist',
  mainnet:
    'https://github.com/Constellation-Labs/tessellation/releases/latest/download/mainnet-seedlist',
};

/**
 * Iterate over every configured node, extract its peer ID via cl-wallet.jar,
 * and check it against the fetched seedlist. Prints per-node status inline.
 * Returns true iff every node's peer ID was found on the seedlist.
 *
 * Shared by `checkSeedlistCommand` (standalone diagnostic) and
 * `runSeedlistPreflight` (gate before remote deploy/start) so the per-node
 * iteration logic doesn't drift between the two.
 */
function checkNodesAgainstSeedlist(
  config: EuclidConfig,
  seedlist: string,
  network: string,
  walletJar: string,
  p12Dir: string,
): boolean {
  let allFound = true;

  for (const node of config.nodes) {
    const keyFile = node.key_file;
    const p12Path = resolve(p12Dir, keyFile.name);

    if (!existsSync(p12Path)) {
      process.stdout.write(
        `  ${formatWarning(`${node.name}: P12 file not found (${keyFile.name})`)}\n`,
      );
      allFound = false;
      continue;
    }

    try {
      const peerId = execFileSync('java', ['-jar', walletJar, 'show-id'], {
        cwd: p12Dir,
        env: {
          ...process.env,
          CL_KEYSTORE: keyFile.name,
          CL_KEYALIAS: keyFile.alias,
          CL_PASSWORD: keyFile.password,
        },
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (!peerId) {
        process.stdout.write(`  ${formatWarning(`${node.name}: Failed to extract peer ID`)}\n`);
        allFound = false;
        continue;
      }

      if (seedlist.includes(peerId)) {
        process.stdout.write(
          `  ${formatSuccess(`${node.name} (${peerId.slice(0, 16)}...) found on seedlist`)}\n`,
        );
      } else {
        process.stdout.write(
          `  ${formatWarning(`${node.name} (${peerId.slice(0, 16)}...) NOT found on ${network} seedlist`)}\n`,
        );
        allFound = false;
      }
    } catch (err) {
      process.stdout.write(
        `  ${formatWarning(`${node.name}: Error extracting peer ID — ${err instanceof Error ? err.message : String(err)}`)}\n`,
      );
      allFound = false;
    }
  }

  return allFound;
}

export async function checkSeedlistCommand(options: {
  network: string;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const network = options.network;

    if (!SEEDLIST_URLS[network]) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error(`Unknown network '${network}'.`)}\n` +
          `  ${t.muted('Valid networks: testnet, integrationnet, mainnet')}\n\n`,
      );
      process.exit(1);
    }

    const projectRoot = findProjectRoot();
    const walletJar = resolve(projectRoot, 'docker', 'artifacts', 'jars', 'cl-wallet.jar');
    const p12Dir = resolve(projectRoot, 'data', 'p12-files');

    if (!existsSync(walletJar)) {
      process.stdout.write(
        `\n  ${formatWarning("cl-wallet.jar not found. Run 'hydra build' first.")}\n`,
      );
      process.stdout.write('  Skipping seedlist check.\n\n');
      return;
    }

    process.stdout.write(formatHeader(`Seedlist Check (${network})`));

    process.stdout.write('  Fetching seedlist...\n');
    const response = await fetch(SEEDLIST_URLS[network], { signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
      process.stderr.write(
        `\n  ${icon.error} ${t.error(`Failed to fetch seedlist. HTTP ${response.status}`)}\n\n`,
      );
      process.exit(1);
    }

    const seedlist = await response.text();
    if (!seedlist.trim()) {
      process.stderr.write(`\n  ${icon.error} ${t.error('Empty seedlist received.')}\n\n`);
      process.exit(1);
    }

    process.stdout.write(`  ${formatSuccess('Seedlist fetched')}\n\n`);

    const allFound = checkNodesAgainstSeedlist(config, seedlist, network, walletJar, p12Dir);

    process.stdout.write('\n');

    if (!allFound) {
      process.stdout.write(
        `  ${formatWarning('One or more node peer IDs are not on the seedlist.')}\n`,
      );
      process.stdout.write(
        `  Ensure your peer IDs are registered before proceeding on ${network}.\n\n`,
      );
      process.exit(1);
    }

    process.stdout.write(`  ${formatSuccess('All nodes found on seedlist!')}\n\n`);
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}

/**
 * Seedlist preflight gate for remote deploy/start. No-op for networks other
 * than integrationnet/mainnet. On missing peers, prompts the user (TTY) or
 * aborts (non-TTY); `--skip-seedlist` bypasses entirely.
 *
 * Restores parity with old hydra's `check_seedlist` call inside
 * `remote_deploy_metagraph` / `remote_start_metagraph`.
 */
export async function runSeedlistPreflight(
  config: EuclidConfig,
  network: string,
  projectRoot: string,
  options: { skipSeedlist?: boolean } = {},
): Promise<void> {
  if (network !== 'integrationnet' && network !== 'mainnet') return;

  if (options.skipSeedlist) {
    process.stdout.write(
      `  ${icon.warn} ${t.warn(`Skipping ${network} seedlist preflight (--skip-seedlist).`)}\n\n`,
    );
    return;
  }

  const walletJar = resolve(projectRoot, 'docker', 'artifacts', 'jars', 'cl-wallet.jar');
  if (!existsSync(walletJar)) {
    process.stdout.write(
      `  ${formatWarning("cl-wallet.jar not found. Skipping seedlist check (run 'hydra build' first).")}\n\n`,
    );
    return;
  }

  process.stdout.write(`\n  Checking ${network} seedlist registration...\n`);

  const response = await fetch(SEEDLIST_URLS[network], { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${network} seedlist (HTTP ${response.status})`);
  }
  const seedlist = (await response.text()).trim();
  if (!seedlist) throw new Error(`Empty ${network} seedlist received.`);

  const p12Dir = resolve(projectRoot, 'data', 'p12-files');
  const allFound = checkNodesAgainstSeedlist(config, seedlist, network, walletJar, p12Dir);

  process.stdout.write('\n');

  if (allFound) {
    process.stdout.write(`  ${formatSuccess('All nodes found on seedlist.')}\n\n`);
    return;
  }

  process.stdout.write(
    `  ${formatWarning('One or more node peer IDs are not on the seedlist.')}\n` +
      `  Ensure your peer IDs are registered before proceeding on ${network}.\n\n`,
  );

  if (!process.stdin.isTTY) {
    process.stderr.write(
      `  ${icon.error} ${t.error('Aborting: no TTY to confirm. Re-run with --skip-seedlist to override.')}\n\n`,
    );
    process.exit(1);
  }

  const proceed = await confirm({ message: 'Continue anyway?', default: false });
  if (!proceed) {
    process.stdout.write('\n  Aborting.\n\n');
    process.exit(1);
  }
}
