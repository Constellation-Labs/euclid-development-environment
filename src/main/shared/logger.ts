import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

const SENSITIVE_KEYS = ['password', 'p12_password', 'private_key', 'secret', 'token'];

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.SILENT]: 'silent',
};

const LEVEL_STYLES: Record<LogLevel, (s: string) => string> = {
  [LogLevel.DEBUG]: chalk.hex('#6B7280'), // Gray-500
  [LogLevel.INFO]: chalk.hex('#22D3EE'), // Cyan-400
  [LogLevel.WARN]: chalk.hex('#FBBF24'), // Amber-400
  [LogLevel.ERROR]: chalk.hex('#F87171'), // Red-400
  [LogLevel.SILENT]: (s: string) => s,
};

export class Logger {
  private level: LogLevel;
  private format: 'text' | 'json';

  constructor(options?: { level?: LogLevel; format?: 'text' | 'json' }) {
    this.level = options?.level ?? LogLevel.INFO;
    this.format = options?.format ?? 'text';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setFormat(format: 'text' | 'json'): void {
    this.format = format;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      message,
      context: context ? this.redact(context) : undefined,
      timestamp: new Date(),
    };

    if (this.format === 'json') {
      this.writeJson(entry);
    } else {
      this.writeText(entry);
    }
  }

  private writeText(entry: LogEntry): void {
    const style = LEVEL_STYLES[entry.level];
    const label = LEVEL_LABELS[entry.level];
    const prefix = style(`[${label}]`);
    let line = `${prefix} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      const ctx = Object.entries(entry.context)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ');
      line += ` (${ctx})`;
    }

    if (entry.level >= LogLevel.ERROR) {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  private writeJson(entry: LogEntry): void {
    const obj = {
      level: LEVEL_LABELS[entry.level],
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
      ...entry.context,
    };
    const target = entry.level >= LogLevel.ERROR ? process.stderr : process.stdout;
    target.write(JSON.stringify(obj) + '\n');
  }

  /**
   * Redact sensitive fields from log context to prevent accidental secret leakage.
   */
  private redact(ctx: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(ctx).map(([k, v]) => {
        if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
          return [k, '***'];
        }
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          return [k, this.redact(v as Record<string, unknown>)];
        }
        return [k, v];
      }),
    );
  }
}

/** Global logger instance. CLI configures this at startup. */
export const logger = new Logger();
