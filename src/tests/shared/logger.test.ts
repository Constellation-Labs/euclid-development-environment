import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel } from '../../main/shared/logger.js';

describe('Logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  // ─── Level Filtering ────────────────────────────────────────────────────

  describe('level filtering', () => {
    it('logs messages at or above the configured level', () => {
      const logger = new Logger({ level: LogLevel.INFO });
      logger.info('visible');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses messages below the configured level', () => {
      const logger = new Logger({ level: LogLevel.WARN });
      logger.debug('hidden');
      logger.info('also hidden');
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('DEBUG level shows all messages', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      expect(stdoutSpy).toHaveBeenCalledTimes(3);
    });

    it('ERROR level only shows errors', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.debug('hidden');
      logger.info('hidden');
      logger.warn('hidden');
      logger.error('visible');
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    it('SILENT level suppresses everything', () => {
      const logger = new Logger({ level: LogLevel.SILENT });
      logger.debug('hidden');
      logger.info('hidden');
      logger.warn('hidden');
      logger.error('hidden');
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('setLevel changes the filter dynamically', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      logger.info('hidden');
      expect(stdoutSpy).not.toHaveBeenCalled();

      logger.setLevel(LogLevel.DEBUG);
      logger.info('now visible');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Output Streams ────────────────────────────────────────────────────

  describe('output streams', () => {
    it('writes debug/info/warn to stdout', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.debug('msg');
      logger.info('msg');
      logger.warn('msg');
      expect(stdoutSpy).toHaveBeenCalledTimes(3);
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('writes error to stderr', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });
      logger.error('msg');
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Text Format ──────────────────────────────────────────────────────

  describe('text format', () => {
    it('includes level label in output', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'text' });
      logger.info('hello');
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('info');
      expect(output).toContain('hello');
    });

    it('includes context key-value pairs', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'text' });
      logger.info('operation complete', { duration: 42, layer: 'metagraph-l0' });
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('duration=42');
      expect(output).toContain('layer=metagraph-l0');
    });

    it('outputs lines ending with newline', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'text' });
      logger.info('test');
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
    });
  });

  // ─── JSON Format ──────────────────────────────────────────────────────

  describe('json format', () => {
    it('outputs valid JSON', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('test message');
      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.timestamp).toBeDefined();
    });

    it('includes context fields in JSON', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('op', { count: 5 });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.count).toBe(5);
    });

    it('writes error-level JSON to stderr', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.error('fail');
      const parsed = JSON.parse((stderrSpy.mock.calls[0][0] as string).trim());
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('fail');
    });

    it('setFormat switches from text to json', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'text' });
      logger.setFormat('json');
      logger.info('test');
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output.trim())).not.toThrow();
    });
  });

  // ─── Secret Redaction ─────────────────────────────────────────────────

  describe('secret redaction', () => {
    it('redacts password fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('login', { user: 'admin', password: 'secret123' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.password).toBe('***');
      expect(parsed.user).toBe('admin');
    });

    it('redacts p12_password fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('keystore', { p12_password: 'mysecret' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.p12_password).toBe('***');
    });

    it('redacts private_key fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('key', { private_key: 'abc123' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.private_key).toBe('***');
    });

    it('redacts secret fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('auth', { api_secret: 'tok_xyz' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.api_secret).toBe('***');
    });

    it('redacts token fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('auth', { auth_token: 'bearer_abc' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.auth_token).toBe('***');
    });

    it('redacts nested sensitive fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('deep', { config: { db_password: 'secret', host: 'localhost' } });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.config.db_password).toBe('***');
      expect(parsed.config.host).toBe('localhost');
    });

    it('does not redact non-sensitive fields', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('info', { name: 'node-1', layer: 'global-l0', port: 9000 });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.name).toBe('node-1');
      expect(parsed.layer).toBe('global-l0');
      expect(parsed.port).toBe(9000);
    });

    it('handles context with no sensitive keys', () => {
      const logger = new Logger({ level: LogLevel.DEBUG, format: 'json' });
      logger.info('clean', { a: 1, b: 'hello' });
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe('hello');
    });
  });

  // ─── Default Logger ───────────────────────────────────────────────────

  describe('defaults', () => {
    it('default level is INFO', () => {
      const logger = new Logger();
      logger.debug('hidden');
      expect(stdoutSpy).not.toHaveBeenCalled();

      logger.info('visible');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });

    it('default format is text', () => {
      const logger = new Logger();
      logger.info('test');
      const output = stdoutSpy.mock.calls[0][0] as string;
      // Text format should not be valid JSON
      expect(() => JSON.parse(output.trim())).toThrow();
    });
  });
});
