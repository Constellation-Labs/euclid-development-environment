import chalk from 'chalk';

// ─── Theme Colors ───────────────────────────────────────────────────────────

/** Theme color palette for CLI output (chalk hex colors). */
export const t = {
  primary: chalk.hex('#818CF8'), // Indigo-400
  accent: chalk.hex('#34D399'), // Emerald-400
  warn: chalk.hex('#FBBF24'), // Amber-400
  error: chalk.hex('#F87171'), // Red-400
  muted: chalk.hex('#6B7280'), // Gray-500
  dim: chalk.hex('#4B5563'), // Gray-600
  brand: chalk.hex('#A78BFA'), // Violet-400
  white: chalk.hex('#F9FAFB'), // Gray-50
  cyan: chalk.hex('#22D3EE'), // Cyan-400
};

// ─── Status Icons ───────────────────────────────────────────────────────────

/** Colored status icons for CLI output (checkmark, warning, error, info). */
export const icon = {
  pass: t.accent('✓'),
  warn: t.warn('!'),
  error: t.error('✗'),
  info: t.cyan('ℹ'),
  arrow: t.primary('›'),
  dot: t.dim('·'),
};
