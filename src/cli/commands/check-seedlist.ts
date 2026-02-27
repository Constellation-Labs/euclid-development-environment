import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import {
  loadConfig,
  logger,
  LogLevel,
} from '../../core/index.js';
import { formatError, formatSuccess, formatWarning, formatHeader } from '../ui/format.js';

const SEEDLIST_URLS: Record<string, string> = {
  integrationnet: 'https://constellationlabs-dag.s3.us-west-1.amazonaws.com/integrationnet-seedlist',
  mainnet: 'https://github.com/Constellation-Labs/tessellation/releases/latest/download/mainnet-seedlist',
};

export async function checkSeedlistCommand(options: {
  network: string;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);

  try {
    const config = await loadConfig();
    const network = options.network;

    if (!SEEDLIST_URLS[network]) {
      process.stderr.write(`\nError: Unknown network '${network}'.\n`);
      process.stderr.write('  Valid networks: integrationnet, mainnet\n\n');
      process.exit(1);
    }

    const projectRoot = process.cwd();
    const walletJar = resolve(projectRoot, 'docker', 'artifacts', 'jars', 'cl-wallet.jar');
    const p12Dir = resolve(projectRoot, 'data', 'p12-files');

    if (!existsSync(walletJar)) {
      process.stdout.write(`\n  ${formatWarning('cl-wallet.jar not found. Run \'hydra build\' first.')}\n`);
      process.stdout.write('  Skipping seedlist check.\n\n');
      return;
    }

    process.stdout.write(formatHeader(`Seedlist Check (${network})`));

    // Fetch seedlist
    process.stdout.write('  Fetching seedlist...\n');
    const response = await fetch(SEEDLIST_URLS[network], {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      process.stderr.write(`\nError: Failed to fetch seedlist. HTTP ${response.status}\n\n`);
      process.exit(1);
    }

    const seedlist = await response.text();
    if (!seedlist.trim()) {
      process.stderr.write('\nError: Empty seedlist received.\n\n');
      process.exit(1);
    }

    process.stdout.write(`  ${formatSuccess('Seedlist fetched')}\n\n`);

    // Check each node
    let allFound = true;

    for (const node of config.nodes) {
      const keyFile = node.key_file;
      const p12Path = resolve(p12Dir, keyFile.name);

      if (!existsSync(p12Path)) {
        process.stdout.write(`  ${formatWarning(`${node.name}: P12 file not found (${keyFile.name})`)}\n`);
        allFound = false;
        continue;
      }

      try {
        // Extract peer ID using cl-wallet.jar
        const peerId = execSync(
          `java -jar "${walletJar}" show-id`,
          {
            cwd: p12Dir,
            env: {
              ...process.env,
              CL_KEYSTORE: keyFile.name,
              CL_KEYALIAS: keyFile.alias,
              CL_PASSWORD: keyFile.password,
            },
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        ).trim();

        if (!peerId) {
          process.stdout.write(`  ${formatWarning(`${node.name}: Failed to extract peer ID`)}\n`);
          allFound = false;
          continue;
        }

        if (seedlist.includes(peerId)) {
          process.stdout.write(`  ${formatSuccess(`${node.name} (${peerId.slice(0, 16)}...) found on seedlist`)}\n`);
        } else {
          process.stdout.write(`  ${formatWarning(`${node.name} (${peerId.slice(0, 16)}...) NOT found on ${network} seedlist`)}\n`);
          allFound = false;
        }
      } catch (err) {
        process.stdout.write(`  ${formatWarning(`${node.name}: Error extracting peer ID — ${(err as Error).message}`)}\n`);
        allFound = false;
      }
    }

    process.stdout.write('\n');

    if (!allFound) {
      process.stdout.write(`  ${formatWarning('One or more node peer IDs are not on the seedlist.')}\n`);
      process.stdout.write(`  Ensure your peer IDs are registered before proceeding on ${network}.\n\n`);

      const proceed = await confirm({
        message: 'Continue anyway?',
        default: false,
      });

      if (!proceed) {
        process.stdout.write('\n  Aborting.\n\n');
        process.exit(1);
      }
    } else {
      process.stdout.write(`  ${formatSuccess('All nodes found on seedlist!')}\n\n`);
    }
  } catch (err) {
    process.stderr.write('\n' + formatError(err) + '\n');
    process.exit(1);
  }
}
