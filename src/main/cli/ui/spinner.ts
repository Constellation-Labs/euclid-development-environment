import ora, { type Ora } from 'ora';
import { t } from './theme.js';

/**
 * Create a themed spinner for long-running operations.
 */
export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan', spinner: 'dots' });
}

/**
 * Stop spinner with a success message.
 */
export function spinnerSuccess(spinner: Ora, text: string): void {
  spinner.stopAndPersist({ symbol: t.accent('✓'), text });
}

/**
 * Stop spinner with a failure message.
 */
export function spinnerFail(spinner: Ora, text: string): void {
  spinner.stopAndPersist({ symbol: t.error('✗'), text });
}
