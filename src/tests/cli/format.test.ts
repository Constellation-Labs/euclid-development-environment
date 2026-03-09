import { describe, it, expect } from 'vitest';
import {
  formatError,
  formatHeader,
  formatSuccess,
  formatWarning,
  formatStep,
  formatKeyValue,
  formatTable,
} from '../../main/cli/ui/format.js';
import { HydraError, ConfigValidationError } from '../../main/shared/errors.js';

// Helper: strip ANSI codes for assertion on raw text
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

// ─── formatHeader ───────────────────────────────────────────────────────────

describe('formatHeader', () => {
  it('includes the title text', () => {
    const result = formatHeader('My Section');
    expect(stripAnsi(result)).toContain('My Section');
  });

  it('starts with a newline and has indentation', () => {
    const result = formatHeader('Title');
    expect(result.startsWith('\n')).toBe(true);
    expect(stripAnsi(result).trim()).toBe('Title');
  });
});

// ─── formatSuccess ──────────────────────────────────────────────────────────

describe('formatSuccess', () => {
  it('includes the message text', () => {
    const result = formatSuccess('Build completed');
    expect(stripAnsi(result)).toContain('Build completed');
  });

  it('includes a checkmark icon', () => {
    const result = stripAnsi(formatSuccess('done'));
    expect(result).toContain('✓');
  });
});

// ─── formatWarning ──────────────────────────────────────────────────────────

describe('formatWarning', () => {
  it('includes the message text', () => {
    const result = formatWarning('Something might be wrong');
    expect(stripAnsi(result)).toContain('Something might be wrong');
  });

  it('includes an exclamation icon', () => {
    const result = stripAnsi(formatWarning('warning'));
    expect(result).toContain('!');
  });
});

// ─── formatStep ─────────────────────────────────────────────────────────────

describe('formatStep', () => {
  it('includes step counter and message', () => {
    const result = stripAnsi(formatStep(2, 5, 'Building images'));
    expect(result).toContain('[2/5]');
    expect(result).toContain('Building images');
  });

  it('works with step 1 of 1', () => {
    const result = stripAnsi(formatStep(1, 1, 'Only step'));
    expect(result).toContain('[1/1]');
    expect(result).toContain('Only step');
  });
});

// ─── formatKeyValue ─────────────────────────────────────────────────────────

describe('formatKeyValue', () => {
  it('includes both key and value', () => {
    const result = stripAnsi(formatKeyValue('Project', 'my-project'));
    expect(result).toContain('Project');
    expect(result).toContain('my-project');
  });

  it('pads key to default width', () => {
    const result = stripAnsi(formatKeyValue('Key', 'Value'));
    // Default keyWidth is 18
    expect(result.indexOf('Value')).toBeGreaterThanOrEqual(20); // 2 indent + 18 min key width
  });

  it('accepts custom key width', () => {
    const result = stripAnsi(formatKeyValue('K', 'V', 30));
    expect(result.indexOf('V')).toBeGreaterThanOrEqual(32); // 2 indent + 30 key width
  });
});

// ─── formatTable ────────────────────────────────────────────────────────────

describe('formatTable', () => {
  it('includes headers and all rows', () => {
    const result = stripAnsi(
      formatTable(
        ['Name', 'Status'],
        [
          ['node-1', 'running'],
          ['node-2', 'stopped'],
        ],
      ),
    );
    expect(result).toContain('Name');
    expect(result).toContain('Status');
    expect(result).toContain('node-1');
    expect(result).toContain('running');
    expect(result).toContain('node-2');
    expect(result).toContain('stopped');
  });

  it('includes a separator line', () => {
    const result = stripAnsi(formatTable(['Col'], [['data']]));
    expect(result).toContain('─');
  });

  it('outputs correct number of lines (header + separator + rows)', () => {
    const result = formatTable(
      ['A', 'B'],
      [
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
      ],
    );
    const lines = result.split('\n');
    expect(lines).toHaveLength(5); // header + separator + 3 rows
  });

  it('handles custom indent', () => {
    const result = stripAnsi(formatTable(['A'], [['B']], { indent: 4 }));
    const lines = result.split('\n');
    // Each line should start with 4 spaces
    for (const line of lines) {
      expect(line.startsWith('    ')).toBe(true);
    }
  });

  it('aligns columns properly with varying widths', () => {
    const result = stripAnsi(
      formatTable(
        ['Short', 'Longer Header'],
        [
          ['a', 'b'],
          ['very long cell value', 'c'],
        ],
      ),
    );
    const lines = result.split('\n');
    // All lines should exist
    expect(lines.length).toBe(4); // header + separator + 2 rows
  });

  it('handles empty rows', () => {
    const result = formatTable(['A', 'B'], []);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // header + separator only
  });
});

// ─── formatError ────────────────────────────────────────────────────────────

describe('formatError', () => {
  it('formats HydraError using its format() method', () => {
    const err = new HydraError('hydra specific error', { suggestion: 'Fix it' });
    const result = stripAnsi(formatError(err));
    expect(result).toContain('hydra specific error');
    expect(result).toContain('Fix it');
  });

  it('formats ConfigValidationError with issues', () => {
    const err = new ConfigValidationError([
      { path: 'name', message: 'Required' },
      { path: 'nodes', message: 'Too short' },
    ]);
    const result = stripAnsi(formatError(err));
    expect(result).toContain('name');
    expect(result).toContain('Required');
    expect(result).toContain('nodes');
    expect(result).toContain('Too short');
  });

  it('formats plain Error objects', () => {
    const err = new Error('plain error');
    const result = stripAnsi(formatError(err));
    expect(result).toContain('Error:');
    expect(result).toContain('plain error');
  });

  it('formats string errors', () => {
    const result = stripAnsi(formatError('string error'));
    expect(result).toContain('Error:');
    expect(result).toContain('string error');
  });

  it('formats number errors', () => {
    const result = stripAnsi(formatError(42));
    expect(result).toContain('Error:');
    expect(result).toContain('42');
  });

  it('formats null/undefined errors', () => {
    expect(stripAnsi(formatError(null))).toContain('null');
    expect(stripAnsi(formatError(undefined))).toContain('undefined');
  });
});
