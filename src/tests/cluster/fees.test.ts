import { describe, it, expect } from 'vitest';
import { combineSignedMessages, formatSignedMessage } from '../../main/cluster/fees.js';
import { LayerStartError } from '../../main/shared/errors.js';
import type { SignedMessage } from '../../main/cluster/fees.js';

// ─── combineSignedMessages ──────────────────────────────────────────────────

describe('combineSignedMessages', () => {
  const makeSignedMessage = (
    value: Record<string, unknown>,
    proofs: Array<{ id: string; signature: string }>,
  ) => JSON.stringify({ value, proofs });

  it('combines a single signed message', () => {
    const msg = makeSignedMessage({ amount: 100 }, [{ id: 'peer1', signature: 'sig1' }]);
    const result = combineSignedMessages([msg]);
    expect(result.value).toEqual({ amount: 100 });
    expect(result.proofs).toHaveLength(1);
    expect(result.proofs[0].id).toBe('peer1');
  });

  it('combines multiple signed messages with same value', () => {
    const value = { amount: 100, recipient: 'DAG123' };
    const msg1 = makeSignedMessage(value, [{ id: 'peer1', signature: 'sig1' }]);
    const msg2 = makeSignedMessage(value, [{ id: 'peer2', signature: 'sig2' }]);
    const msg3 = makeSignedMessage(value, [{ id: 'peer3', signature: 'sig3' }]);

    const result = combineSignedMessages([msg1, msg2, msg3]);
    expect(result.value).toEqual(value);
    expect(result.proofs).toHaveLength(3);
    expect(result.proofs.map((p) => p.id)).toEqual(['peer1', 'peer2', 'peer3']);
  });

  it('flattens multiple proofs from same message', () => {
    const value = { amount: 50 };
    const msg1 = makeSignedMessage(value, [
      { id: 'peer1', signature: 'sig1a' },
      { id: 'peer1', signature: 'sig1b' },
    ]);
    const msg2 = makeSignedMessage(value, [{ id: 'peer2', signature: 'sig2' }]);

    const result = combineSignedMessages([msg1, msg2]);
    expect(result.proofs).toHaveLength(3);
  });

  it('throws LayerStartError for empty input', () => {
    expect(() => combineSignedMessages([])).toThrow(LayerStartError);
  });

  it('throws LayerStartError for invalid JSON', () => {
    expect(() => combineSignedMessages(['not json'])).toThrow(LayerStartError);
  });

  it('throws LayerStartError for malformed JSON with node index', () => {
    try {
      combineSignedMessages(['valid', 'not json']);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LayerStartError);
      expect((err as LayerStartError).message).toContain('node 0');
    }
  });

  it('throws LayerStartError when values do not match', () => {
    const msg1 = makeSignedMessage({ amount: 100 }, [{ id: 'peer1', signature: 'sig1' }]);
    const msg2 = makeSignedMessage({ amount: 200 }, [{ id: 'peer2', signature: 'sig2' }]);

    expect(() => combineSignedMessages([msg1, msg2])).toThrow(LayerStartError);
  });

  it('value mismatch error includes node indices', () => {
    const msg1 = makeSignedMessage({ a: 1 }, [{ id: 'p1', signature: 's1' }]);
    const msg2 = makeSignedMessage({ a: 2 }, [{ id: 'p2', signature: 's2' }]);

    try {
      combineSignedMessages([msg1, msg2]);
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as LayerStartError).message).toContain('node 0');
      expect((err as LayerStartError).message).toContain('node 1');
    }
  });

  it('handles whitespace around JSON inputs', () => {
    const value = { amount: 100 };
    const msg = `  ${makeSignedMessage(value, [{ id: 'peer1', signature: 'sig1' }])}  \n`;
    const result = combineSignedMessages([msg]);
    expect(result.value).toEqual(value);
  });

  it('preserves complex nested values', () => {
    const value = {
      transaction: {
        source: 'DAG123',
        destination: 'DAG456',
        amount: 1000,
        fee: 0,
      },
    };
    const msg1 = makeSignedMessage(value, [{ id: 'p1', signature: 's1' }]);
    const msg2 = makeSignedMessage(value, [{ id: 'p2', signature: 's2' }]);

    const result = combineSignedMessages([msg1, msg2]);
    expect(result.value).toEqual(value);
  });
});

// ─── formatSignedMessage ────────────────────────────────────────────────────

describe('formatSignedMessage', () => {
  it('returns pretty-printed JSON', () => {
    const message: SignedMessage = {
      value: { amount: 100 },
      proofs: [{ id: 'peer1', signature: 'sig1' }],
    };
    const formatted = formatSignedMessage(message);
    expect(formatted).toBe(JSON.stringify(message, null, 2));
  });

  it('output is valid JSON', () => {
    const message: SignedMessage = {
      value: { complex: { nested: true } },
      proofs: [
        { id: 'p1', signature: 's1' },
        { id: 'p2', signature: 's2' },
      ],
    };
    const formatted = formatSignedMessage(message);
    const parsed = JSON.parse(formatted);
    expect(parsed.value.complex.nested).toBe(true);
    expect(parsed.proofs).toHaveLength(2);
  });

  it('includes all proofs in output', () => {
    const message: SignedMessage = {
      value: {},
      proofs: [
        { id: 'a', signature: 'x' },
        { id: 'b', signature: 'y' },
        { id: 'c', signature: 'z' },
      ],
    };
    const formatted = formatSignedMessage(message);
    expect(formatted).toContain('"a"');
    expect(formatted).toContain('"b"');
    expect(formatted).toContain('"c"');
  });
});
