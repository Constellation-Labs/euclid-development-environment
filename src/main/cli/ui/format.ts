import chalk from 'chalk';
import { t, icon } from './theme.js';
import type { HydraError } from '../../index.js';
import type { CheckResult, DoctorReport } from '../../doctor/index.js';

// ─── ANSI Stripping (for width calculation with colored strings) ────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// ─── Doctor Report ──────────────────────────────────────────────────────────

/**
 * Format a doctor report for terminal output.
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${chalk.bold('Hydra Environment Check')}`);

  for (const section of report.sections) {
    lines.push('');
    lines.push(`  ${t.dim(section.title + ':')}`);
    for (const result of section.results) {
      lines.push(formatCheckResult(result));
    }
  }

  lines.push('');

  if (report.errorCount === 0 && report.warnCount === 0) {
    lines.push(`  ${t.accent('All checks passed.')}`);
  } else {
    const parts: string[] = [];
    if (report.warnCount > 0) parts.push(`${report.warnCount} warning(s)`);
    if (report.errorCount > 0) parts.push(`${report.errorCount} error(s)`);
    lines.push(`  ${parts.join(', ')} found.`);
  }

  // Collect fixes
  const fixes = report.sections
    .flatMap((s) => s.results)
    .filter((r) => r.status !== 'pass' && r.fix)
    .map((r) => r.fix as string);

  if (fixes.length > 0) {
    lines.push('');
    lines.push(`  ${chalk.bold('To fix:')}`);
    for (const fix of fixes) {
      lines.push(`    ${t.dim('–')} ${fix}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatCheckResult(result: CheckResult): string {
  const statusIcon =
    result.status === 'pass' ? icon.pass : result.status === 'warn' ? icon.warn : icon.error;
  const name = result.name.padEnd(18);
  return `  ${statusIcon} ${name}${result.message}`;
}

// ─── Error Formatting ───────────────────────────────────────────────────────

/**
 * Format a structured error for CLI output.
 */
export function formatError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'format' in error) {
    return (error as HydraError).format();
  }

  if (error instanceof Error) {
    return `${t.error('Error:')} ${error.message}`;
  }

  return `${t.error('Error:')} ${String(error)}`;
}

// ─── Headers & Messages ─────────────────────────────────────────────────────

/**
 * Format a section header.
 */
export function formatHeader(title: string): string {
  return `\n  ${chalk.bold(title)}\n`;
}

/**
 * Format a success message with a green checkmark.
 */
export function formatSuccess(message: string): string {
  return `${icon.pass} ${message}`;
}

/**
 * Format a warning message with a yellow exclamation.
 */
export function formatWarning(message: string): string {
  return `${icon.warn} ${message}`;
}

/**
 * Format a step indicator: [1/5] Message
 */
export function formatStep(current: number, total: number, message: string): string {
  return `${t.dim(`[${current}/${total}]`)} ${message}`;
}

// ─── Key-Value & Tables ─────────────────────────────────────────────────────

/**
 * Format a key-value pair for display.
 */
export function formatKeyValue(key: string, value: string, keyWidth = 18): string {
  return `  ${t.dim(key.padEnd(keyWidth))}${value}`;
}

/**
 * Format a simple table of rows with aligned columns.
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options?: { indent?: number },
): string {
  const indent = ' '.repeat(options?.indent ?? 2);

  // Calculate column widths — strip ANSI for accurate measurement
  const widths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map((r) => stripAnsi(r[i] ?? '').length)),
  );

  const lines: string[] = [];

  // Header
  const headerLine = headers
    .map((h, i) => h + ' '.repeat(Math.max(0, widths[i] - stripAnsi(h).length)))
    .join('  ');
  lines.push(`${indent}${chalk.bold(headerLine)}`);

  // Separator (using box-drawing character)
  const separator = widths.map((w) => '─'.repeat(w)).join('──');
  lines.push(`${indent}${t.dim(separator)}`);

  // Rows
  for (const row of rows) {
    const line = row
      .map((cell, i) => {
        const visible = stripAnsi(cell ?? '');
        const pad = Math.max(0, widths[i] - visible.length);
        return (cell ?? '') + ' '.repeat(pad);
      })
      .join('  ');
    lines.push(`${indent}${line}`);
  }

  return lines.join('\n');
}
