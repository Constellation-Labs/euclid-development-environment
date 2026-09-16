import { LayerStartError, errorMessage } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A cryptographic proof containing a node ID and signature. */
export interface SignedProof {
  id: string;
  signature: string;
}

/** A message with its value payload and array of signed proofs. */
export interface SignedMessage {
  value: Record<string, unknown>;
  proofs: SignedProof[];
}

// ─── Combine Signed Messages ────────────────────────────────────────────────

/**
 * Combine multiple signed messages (same value, different proofs) into one.
 * Each input is a JSON string from `cl-wallet.jar create-*-signing-message`.
 *
 * All messages must contain the same `value` — the function verifies this.
 * Proofs from all messages are concatenated into a single proofs array.
 */
export function combineSignedMessages(signedOutputs: string[]): SignedMessage {
  if (signedOutputs.length === 0) {
    throw new LayerStartError('No signed messages to combine');
  }

  const parsed: SignedMessage[] = signedOutputs.map((raw, i) => {
    try {
      return JSON.parse(raw.trim()) as SignedMessage;
    } catch (err) {
      throw new LayerStartError(
        `Failed to parse signed message from node ${i}: ${errorMessage(err)}\n` +
          `     Output (truncated): ${raw.slice(0, 200)}`,
      );
    }
  });

  // Verify all messages have the same value
  const referenceValue = JSON.stringify(parsed[0].value);
  for (let i = 1; i < parsed.length; i++) {
    if (JSON.stringify(parsed[i].value) !== referenceValue) {
      throw new LayerStartError(
        `Signed message content mismatch between node 0 and node ${i}.\n` +
          `     Node 0: ${referenceValue}\n` +
          `     Node ${i}: ${JSON.stringify(parsed[i].value)}`,
      );
    }
  }

  // Merge proofs, dropping any repeated signer id. A single distinct proof per
  // signer is what Tessellation expects.
  const seen = new Set<string>();
  const proofs: SignedProof[] = [];
  for (const message of parsed) {
    for (const proof of message.proofs) {
      if (seen.has(proof.id)) {
        logger.debug(`Skipping duplicate proof from signer ${proof.id}`);
        continue;
      }
      seen.add(proof.id);
      proofs.push(proof);
    }
  }

  const combined: SignedMessage = {
    value: parsed[0].value,
    proofs,
  };

  logger.debug(
    `Combined ${parsed.length} signed messages → ${combined.proofs.length} distinct proofs`,
  );
  return combined;
}

/**
 * Format a signed message for human-readable display.
 */
export function formatSignedMessage(message: SignedMessage): string {
  return JSON.stringify(message, null, 2);
}
