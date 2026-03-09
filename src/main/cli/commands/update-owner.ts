import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  loadConfig,
  logger,
  LogLevel,
  DockerClient,
  createMultiNodeSignedMessage,
  formatSignedMessage,
} from '../../index.js';
import type { LayerContext, SignedMessage } from '../../index.js';
import {
  banner,
  section,
  info,
  formatError,
  completeBanner,
  errorBanner,
  createSpinner,
  elapsed,
  ICONS,
  chalk,
} from '../ui/format.js';

export async function updateOwnerCommand(options: {
  address?: string;
  verbose?: boolean;
}): Promise<void> {
  if (options.verbose) logger.setLevel(LogLevel.DEBUG);
  const t0 = Date.now();

  try {
    const config = await loadConfig();
    const docker = new DockerClient();
    await docker.checkConnection();

    const projectRoot = process.cwd();
    const dockerPath = resolve(projectRoot, 'docker');

    // ─── Banner ─────────────────────────────────────────────────────
    process.stdout.write(banner(ICONS.key, 'Update Owner Address', config.project_name));

    // ─── Step 1: Resolve metagraph ID ───────────────────────────────
    const totalSteps = 4;
    process.stdout.write(section(1, totalSteps, ICONS.target, 'Resolving metagraph identity'));

    const spinner = createSpinner('Reading metagraph ID...');
    spinner.start();

    let metagraphId: string | undefined;

    // Try host file first
    const genesisAddressPath = resolve(dockerPath, 'artifacts', 'genesis', 'genesis.address');
    if (existsSync(genesisAddressPath)) {
      metagraphId = (await readFile(genesisAddressPath, 'utf-8')).trim();
    }

    // Fall back to container
    if (!metagraphId) {
      const leadNode = config.nodes[0];
      const running = await docker.isContainerRunning(leadNode.name);
      if (!running) {
        spinner.fail('Cluster is not running');
        process.stderr.write(
          `\n     ${chalk.dim('Start the cluster first:')} ${chalk.cyan('hydra start')}\n\n`,
        );
        process.exit(1);
      }

      const result = await docker.exec(leadNode.name, [
        'bash',
        '-c',
        `tr -d '\\r\\n' < shared_genesis/genesis.address`,
      ]);
      metagraphId = result.stdout.trim();
    }

    if (!metagraphId) {
      spinner.fail('No metagraph ID found');
      process.stderr.write(
        `\n     ${chalk.dim('Run genesis first:')} ${chalk.cyan('hydra start')}\n\n`,
      );
      process.exit(1);
    }

    spinner.succeed(`Metagraph ID: ${chalk.cyan(metagraphId.slice(0, 20) + '...')}`);

    // ─── Step 2: Get current snapshot ordinal ───────────────────────
    process.stdout.write(section(2, totalSteps, ICONS.globe, 'Fetching latest snapshot ordinal'));

    const ordinalSpinner = createSpinner('Querying Global L0...');
    ordinalSpinner.start();

    const gl0Port = config.ports.global_l0.public;
    let parentOrdinal: number;

    try {
      const response = await fetch(`http://localhost:${gl0Port}/global-snapshots/latest`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      // The response has { value: { ordinal: N, ... }, ... }
      const value = data.value as Record<string, unknown> | undefined;
      parentOrdinal = Number(value?.ordinal ?? data.ordinal ?? 0);

      if (isNaN(parentOrdinal) || parentOrdinal < 0) {
        throw new Error(`Invalid ordinal: ${parentOrdinal}`);
      }
    } catch (err) {
      ordinalSpinner.fail('Failed to fetch snapshot ordinal');
      process.stderr.write(`\n     ${chalk.red('Error:')} ${(err as Error).message}\n`);
      process.stderr.write(
        `     ${chalk.dim('Ensure Global L0 is running on port')} ${chalk.cyan(String(gl0Port))}\n\n`,
      );
      process.exit(1);
    }

    ordinalSpinner.succeed(`Latest ordinal: ${chalk.cyan(String(parentOrdinal))}`);

    // ─── Step 3: Create signed message with all nodes ───────────────
    process.stdout.write(section(3, totalSteps, ICONS.lock, 'Creating owner signing message'));

    // Determine the new owner address
    let newOwnerAddress = options.address;

    if (!newOwnerAddress) {
      // If no address provided, prompt the user
      const { input } = await import('@inquirer/prompts');
      newOwnerAddress = await input({
        message: 'New owner address (DAG...):',
        validate: (v) => (v.startsWith('DAG') ? true : 'Address must start with DAG'),
      });
    }

    process.stdout.write(info('New Owner', newOwnerAddress));
    process.stdout.write(info('Metagraph ID', metagraphId));
    process.stdout.write(info('Parent Ordinal', String(parentOrdinal)));

    const signingSpinner = createSpinner('Signing with all nodes...');
    signingSpinner.start();

    // Build a minimal context for the signing function
    const ctx: LayerContext = {
      docker,
      config,
      projectRoot,
      mode: 'genesis', // Not relevant for signing, but required by type
      leadNodeId: '',
      metagraphId,
      onProgress: (msg) => {
        signingSpinner.text = msg;
      },
    };

    const signedMessage: SignedMessage = await createMultiNodeSignedMessage(
      ctx,
      'metagraph-l0',
      'create-owner-signing-message',
      newOwnerAddress,
      metagraphId,
      parentOrdinal,
    );

    signingSpinner.succeed(`Signed by ${chalk.cyan(String(config.nodes.length))} node(s)`);

    // Print the message for review
    const formattedMsg = formatSignedMessage(signedMessage);
    process.stdout.write(`\n     ${chalk.bold('Signed Message')}\n`);
    process.stdout.write(`     ${chalk.dim('─'.repeat(50))}\n`);
    for (const line of formattedMsg.split('\n')) {
      process.stdout.write(`     ${line}\n`);
    }
    process.stdout.write(`     ${chalk.dim('─'.repeat(50))}\n\n`);

    // Confirm before sending
    const { confirm } = await import('@inquirer/prompts');
    const confirmed = await confirm({
      message: 'Send this message to the metagraph?',
      default: true,
    });

    if (!confirmed) {
      process.stdout.write(`\n  ${chalk.dim('Cancelled.')}\n\n`);
      return;
    }

    // ─── Step 4: Submit to metagraph-l0 ─────────────────────────────
    process.stdout.write(section(4, totalSteps, ICONS.rocket, 'Submitting to metagraph'));

    const submitSpinner = createSpinner('Sending message...');
    submitSpinner.start();

    const ml0Port = config.ports.metagraph_l0.public;
    const messageUrl = `http://localhost:${ml0Port}/currency/message`;

    try {
      const response = await fetch(messageUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedMessage),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      submitSpinner.succeed(`Message sent to ${chalk.cyan(messageUrl)}`);
    } catch (err) {
      submitSpinner.fail('Failed to submit message');
      process.stderr.write(`\n     ${chalk.red('Error:')} ${(err as Error).message}\n`);
      process.stderr.write(
        `     ${chalk.dim('Ensure Metagraph L0 is running on port')} ${chalk.cyan(String(ml0Port))}\n\n`,
      );
      process.exit(1);
    }

    // ─── Done ───────────────────────────────────────────────────────
    process.stdout.write(
      completeBanner(ICONS.success, `Owner address updated! ${chalk.dim(elapsed(t0))}`),
    );
    process.stdout.write(`  ${chalk.dim('New owner:')} ${chalk.cyan(newOwnerAddress)}\n`);
    process.stdout.write(
      `  ${chalk.dim('Check status:')} ${chalk.cyan('hydra remote snapshot-fee-config')}\n\n`,
    );
  } catch (err) {
    process.stderr.write(errorBanner('Update owner failed'));
    process.stderr.write(formatError(err) + '\n\n');
    process.exit(1);
  }
}
