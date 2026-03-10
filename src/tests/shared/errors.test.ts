import { describe, it, expect } from 'vitest';
import {
  HydraError,
  ConfigError,
  ConfigNotFoundError,
  ConfigValidationError,
  DockerError,
  DockerNotRunningError,
  DockerVersionError,
  ClusterError,
  LayerStartError,
  RemoteError,
  SSHConnectionError,
  RemoteDeployError,
  RemoteStartError,
  PortInUseError,
  BinaryNotFoundError,
  errorMessage,
  shellEscape,
} from '../../main/shared/errors.js';

// ─── HydraError (base) ─────────────────────────────────────────────────────

describe('HydraError', () => {
  it('creates error with message', () => {
    const err = new HydraError('something went wrong');
    expect(err.message).toBe('something went wrong');
    expect(err.name).toBe('HydraError');
    expect(err.code).toBe('HYDRA_ERROR');
  });

  it('accepts custom code', () => {
    const err = new HydraError('fail', { code: 'CUSTOM_CODE' });
    expect(err.code).toBe('CUSTOM_CODE');
  });

  it('accepts suggestion', () => {
    const err = new HydraError('fail', { suggestion: 'Try again' });
    expect(err.suggestion).toBe('Try again');
  });

  it('accepts cause', () => {
    const cause = new Error('root cause');
    const err = new HydraError('fail', { cause });
    expect(err.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const err = new HydraError('fail');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HydraError);
  });

  it('format() includes message', () => {
    const err = new HydraError('something broke');
    const formatted = err.format();
    expect(formatted).toContain('something broke');
  });

  it('format() includes suggestion when present', () => {
    const err = new HydraError('fail', { suggestion: 'Do X instead' });
    const formatted = err.format();
    expect(formatted).toContain('Do X instead');
  });

  it('format() includes cause message when present', () => {
    const cause = new Error('underlying issue');
    const err = new HydraError('fail', { cause });
    const formatted = err.format();
    expect(formatted).toContain('underlying issue');
    expect(formatted).toContain('Caused by');
  });

  it('format() omits cause when not present', () => {
    const err = new HydraError('fail');
    const formatted = err.format();
    expect(formatted).not.toContain('Caused by');
  });

  it('format() omits suggestion when not present', () => {
    const err = new HydraError('fail');
    const formatted = err.format();
    // Should just be the error line
    const lines = formatted.split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });
});

// ─── ConfigError ────────────────────────────────────────────────────────────

describe('ConfigError', () => {
  it('has correct name and code', () => {
    const err = new ConfigError('bad config');
    expect(err.name).toBe('ConfigError');
    expect(err.code).toBe('CONFIG_ERROR');
  });

  it('extends HydraError', () => {
    const err = new ConfigError('bad config');
    expect(err).toBeInstanceOf(HydraError);
    expect(err).toBeInstanceOf(ConfigError);
  });

  it('accepts suggestion and cause', () => {
    const cause = new Error('parse error');
    const err = new ConfigError('bad', { suggestion: 'Fix JSON', cause });
    expect(err.suggestion).toBe('Fix JSON');
    expect(err.cause).toBe(cause);
  });
});

// ─── ConfigNotFoundError ────────────────────────────────────────────────────

describe('ConfigNotFoundError', () => {
  it('includes path in message', () => {
    const err = new ConfigNotFoundError('/path/to/euclid.json');
    expect(err.message).toContain('/path/to/euclid.json');
    expect(err.name).toBe('ConfigNotFoundError');
  });

  it('extends ConfigError', () => {
    const err = new ConfigNotFoundError('euclid.json');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(HydraError);
  });

  it('has suggestion about hydra init', () => {
    const err = new ConfigNotFoundError('euclid.json');
    expect(err.suggestion).toContain('hydra init');
  });
});

// ─── ConfigValidationError ──────────────────────────────────────────────────

describe('ConfigValidationError', () => {
  it('stores issues array', () => {
    const issues = [
      { path: 'project_name', message: 'Required' },
      { path: 'nodes', message: 'Too few items' },
    ];
    const err = new ConfigValidationError(issues);
    expect(err.issues).toEqual(issues);
    expect(err.name).toBe('ConfigValidationError');
  });

  it('single issue message includes path and message', () => {
    const issues = [{ path: 'project_name', message: 'Required' }];
    const err = new ConfigValidationError(issues);
    expect(err.message).toContain('project_name');
    expect(err.message).toContain('Required');
  });

  it('multiple issues message includes count', () => {
    const issues = [
      { path: 'a', message: 'err1' },
      { path: 'b', message: 'err2' },
      { path: 'c', message: 'err3' },
    ];
    const err = new ConfigValidationError(issues);
    expect(err.message).toContain('3 issues found');
  });

  it('format() lists all issues when multiple', () => {
    const issues = [
      { path: 'project_name', message: 'Required' },
      { path: 'nodes', message: 'Too few items' },
    ];
    const err = new ConfigValidationError(issues);
    const formatted = err.format();
    expect(formatted).toContain('project_name');
    expect(formatted).toContain('Required');
    expect(formatted).toContain('nodes');
    expect(formatted).toContain('Too few items');
  });

  it('extends ConfigError', () => {
    const err = new ConfigValidationError([]);
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(HydraError);
  });
});

// ─── DockerError ────────────────────────────────────────────────────────────

describe('DockerError', () => {
  it('has correct name and code', () => {
    const err = new DockerError('docker failed');
    expect(err.name).toBe('DockerError');
    expect(err.code).toBe('DOCKER_ERROR');
  });

  it('format() does NOT include cause (by design)', () => {
    const cause = new Error('verbose docker stderr');
    const err = new DockerError('clean message', { cause });
    const formatted = err.format();
    expect(formatted).toContain('clean message');
    expect(formatted).not.toContain('Caused by');
    expect(formatted).not.toContain('verbose docker stderr');
  });

  it('format() includes suggestion', () => {
    const err = new DockerError('fail', { suggestion: 'Restart Docker' });
    const formatted = err.format();
    expect(formatted).toContain('Restart Docker');
  });
});

// ─── DockerNotRunningError ──────────────────────────────────────────────────

describe('DockerNotRunningError', () => {
  it('has predefined message', () => {
    const err = new DockerNotRunningError();
    expect(err.message).toBe('Docker is not running');
    expect(err.name).toBe('DockerNotRunningError');
  });

  it('has platform-specific suggestions', () => {
    const err = new DockerNotRunningError();
    expect(err.suggestion).toContain('Docker Desktop');
    expect(err.suggestion).toContain('macOS');
    expect(err.suggestion).toContain('Linux');
  });

  it('extends DockerError', () => {
    const err = new DockerNotRunningError();
    expect(err).toBeInstanceOf(DockerError);
    expect(err).toBeInstanceOf(HydraError);
  });
});

// ─── DockerVersionError ─────────────────────────────────────────────────────

describe('DockerVersionError', () => {
  it('includes found and required versions in message', () => {
    const err = new DockerVersionError('20.10', '24.0');
    expect(err.message).toContain('20.10');
    expect(err.message).toContain('24.0');
    expect(err.name).toBe('DockerVersionError');
  });

  it('suggests updating Docker', () => {
    const err = new DockerVersionError('20.10', '24.0');
    expect(err.suggestion).toContain('Update Docker');
  });
});

// ─── ClusterError ───────────────────────────────────────────────────────────

describe('ClusterError', () => {
  it('has correct name and code', () => {
    const err = new ClusterError('cluster failed');
    expect(err.name).toBe('ClusterError');
    expect(err.code).toBe('CLUSTER_ERROR');
  });

  it('extends HydraError', () => {
    expect(new ClusterError('fail')).toBeInstanceOf(HydraError);
  });
});

// ─── LayerStartError ────────────────────────────────────────────────────────

describe('LayerStartError', () => {
  it('uses the message directly', () => {
    const err = new LayerStartError('Failed to start metagraph-l0');
    expect(err.message).toBe('Failed to start metagraph-l0');
    expect(err.name).toBe('LayerStartError');
  });

  it('accepts suggestion', () => {
    const err = new LayerStartError('Layer failed', {
      suggestion: 'Check Docker logs: hydra logs currency-l1',
    });
    expect(err.suggestion).toContain('hydra logs currency-l1');
  });

  it('extends ClusterError', () => {
    expect(new LayerStartError('fail')).toBeInstanceOf(ClusterError);
    expect(new LayerStartError('fail')).toBeInstanceOf(HydraError);
  });

  it('accepts cause', () => {
    const cause = new Error('container exited');
    const err = new LayerStartError('data-l1 crashed', { cause });
    expect(err.cause).toBe(cause);
  });
});

// ─── RemoteError ────────────────────────────────────────────────────────────

describe('RemoteError', () => {
  it('has correct name and code', () => {
    const err = new RemoteError('remote failed');
    expect(err.name).toBe('RemoteError');
    expect(err.code).toBe('REMOTE_ERROR');
  });

  it('extends HydraError', () => {
    expect(new RemoteError('fail')).toBeInstanceOf(HydraError);
  });
});

// ─── SSHConnectionError ─────────────────────────────────────────────────────

describe('SSHConnectionError', () => {
  it('includes host in message', () => {
    const err = new SSHConnectionError('10.0.0.1');
    expect(err.message).toContain('10.0.0.1');
    expect(err.name).toBe('SSHConnectionError');
  });

  it('suggests SSH verification', () => {
    const err = new SSHConnectionError('10.0.0.1');
    expect(err.suggestion).toContain('ssh');
    expect(err.suggestion).toContain('10.0.0.1');
  });

  it('extends RemoteError', () => {
    expect(new SSHConnectionError('host')).toBeInstanceOf(RemoteError);
    expect(new SSHConnectionError('host')).toBeInstanceOf(HydraError);
  });
});

// ─── RemoteDeployError ──────────────────────────────────────────────────────

describe('RemoteDeployError', () => {
  it('includes host and detail in message', () => {
    const err = new RemoteDeployError('10.0.0.1', 'disk full');
    expect(err.message).toContain('10.0.0.1');
    expect(err.message).toContain('disk full');
    expect(err.name).toBe('RemoteDeployError');
  });

  it('extends RemoteError', () => {
    expect(new RemoteDeployError('host', 'fail')).toBeInstanceOf(RemoteError);
  });
});

// ─── RemoteStartError ───────────────────────────────────────────────────────

describe('RemoteStartError', () => {
  it('includes host and layer in message', () => {
    const err = new RemoteStartError('10.0.0.1', 'metagraph-l0');
    expect(err.message).toContain('10.0.0.1');
    expect(err.message).toContain('metagraph-l0');
    expect(err.name).toBe('RemoteStartError');
  });

  it('suggests checking remote logs', () => {
    const err = new RemoteStartError('10.0.0.1', 'currency-l1');
    expect(err.suggestion).toContain('hydra remote logs');
  });

  it('extends RemoteError', () => {
    expect(new RemoteStartError('host', 'layer')).toBeInstanceOf(RemoteError);
  });
});

// ─── PortInUseError ─────────────────────────────────────────────────────────

describe('PortInUseError', () => {
  it('includes port number in message', () => {
    const err = new PortInUseError(9000);
    expect(err.message).toContain('9000');
    expect(err.name).toBe('PortInUseError');
    expect(err.code).toBe('PORT_IN_USE');
  });

  it('includes layer context when provided', () => {
    const err = new PortInUseError(9200, 'metagraph-l0');
    expect(err.message).toContain('metagraph-l0');
  });

  it('omits layer context when not provided', () => {
    const err = new PortInUseError(9000);
    expect(err.message).not.toContain('needed for');
  });

  it('suggests lsof command', () => {
    const err = new PortInUseError(9000);
    expect(err.suggestion).toContain('lsof');
    expect(err.suggestion).toContain('9000');
  });

  it('extends HydraError', () => {
    expect(new PortInUseError(9000)).toBeInstanceOf(HydraError);
  });
});

// ─── BinaryNotFoundError ────────────────────────────────────────────────────

describe('BinaryNotFoundError', () => {
  it('includes binary name in message', () => {
    const err = new BinaryNotFoundError('java');
    expect(err.message).toContain('java');
    expect(err.name).toBe('BinaryNotFoundError');
    expect(err.code).toBe('BINARY_NOT_FOUND');
  });

  it('uses default suggestion when no hint provided', () => {
    const err = new BinaryNotFoundError('docker');
    expect(err.suggestion).toContain('Install docker');
  });

  it('uses custom install hint when provided', () => {
    const err = new BinaryNotFoundError('java', 'Install JDK 11+: https://jdk.java.net');
    expect(err.suggestion).toBe('Install JDK 11+: https://jdk.java.net');
  });

  it('extends HydraError', () => {
    expect(new BinaryNotFoundError('git')).toBeInstanceOf(HydraError);
  });
});

// ─── errorMessage ──────────────────────────────────────────────────────────

describe('errorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(errorMessage(new Error('oops'))).toBe('oops');
  });

  it('extracts message from HydraError', () => {
    expect(errorMessage(new HydraError('bad'))).toBe('bad');
  });

  it('converts string to string', () => {
    expect(errorMessage('raw string error')).toBe('raw string error');
  });

  it('converts number to string', () => {
    expect(errorMessage(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(errorMessage(undefined)).toBe('undefined');
  });
});

// ─── shellEscape ───────────────────────────────────────────────────────────

describe('shellEscape', () => {
  it('returns plain strings unchanged', () => {
    expect(shellEscape('hello')).toBe('hello');
  });

  it('escapes double quotes', () => {
    expect(shellEscape('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes dollar signs', () => {
    expect(shellEscape('$HOME')).toBe('\\$HOME');
  });

  it('escapes backticks', () => {
    expect(shellEscape('`cmd`')).toBe('\\`cmd\\`');
  });

  it('escapes backslashes', () => {
    expect(shellEscape('a\\b')).toBe('a\\\\b');
  });

  it('handles complex passwords with special characters', () => {
    const password = 'p@ss"w0rd$`test\\end';
    const escaped = shellEscape(password);
    expect(escaped).toBe('p@ss\\"w0rd\\$\\`test\\\\end');
  });

  it('preserves single quotes (safe in double-quoted context)', () => {
    expect(shellEscape("it's")).toBe("it's");
  });
});
