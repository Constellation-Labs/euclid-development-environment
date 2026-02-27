import type { HydraError } from '../../core/index.js';
import type { CheckResult, DoctorReport } from '../../doctor/index.js';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const STATUS_ICONS: Record<string, string> = {
  pass: `${COLORS.green}\u2713${COLORS.reset}`,
  warn: `${COLORS.yellow}!${COLORS.reset}`,
  error: `${COLORS.red}\u2717${COLORS.reset}`,
};

/**
 * Format a doctor report for terminal output.
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${COLORS.bold}Hydra Environment Check${COLORS.reset}`);

  for (const section of report.sections) {
    lines.push('');
    lines.push(`  ${COLORS.dim}${section.title}:${COLORS.reset}`);
    for (const result of section.results) {
      lines.push(formatCheckResult(result));
    }
  }

  lines.push('');

  if (report.errorCount === 0 && report.warnCount === 0) {
    lines.push(`  ${COLORS.green}All checks passed.${COLORS.reset}`);
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
    .map((r) => r.fix!);

  if (fixes.length > 0) {
    lines.push('');
    lines.push(`  ${COLORS.bold}To fix:${COLORS.reset}`);
    for (const fix of fixes) {
      lines.push(`    - ${fix}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatCheckResult(result: CheckResult): string {
  const icon = STATUS_ICONS[result.status] ?? ' ';
  const name = result.name.padEnd(18);
  return `  ${icon} ${name}${result.message}`;
}

/**
 * Format a structured error for CLI output.
 */
export function formatError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'format' in error) {
    return (error as HydraError).format();
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${String(error)}`;
}

/**
 * Format a section header.
 */
export function formatHeader(title: string): string {
  return `\n  ${COLORS.bold}${title}${COLORS.reset}\n`;
}

/**
 * Format a success message.
 */
export function formatSuccess(message: string): string {
  return `${COLORS.green}\u2713${COLORS.reset} ${message}`;
}

/**
 * Format a warning message.
 */
export function formatWarning(message: string): string {
  return `${COLORS.yellow}!${COLORS.reset} ${message}`;
}

/**
 * Format a key-value pair for display.
 */
export function formatKeyValue(key: string, value: string, keyWidth = 18): string {
  return `  ${COLORS.dim}${key.padEnd(keyWidth)}${COLORS.reset}${value}`;
}

/**
 * Format a simple table of rows.
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options?: { indent?: number },
): string {
  const indent = ' '.repeat(options?.indent ?? 2);

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const lines: string[] = [];

  // Header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  lines.push(`${indent}${COLORS.bold}${headerLine}${COLORS.reset}`);

  // Separator
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  lines.push(`${indent}${COLORS.dim}${separator}${COLORS.reset}`);

  // Rows
  for (const row of rows) {
    const line = row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  ');
    lines.push(`${indent}${line}`);
  }

  return lines.join('\n');
}
