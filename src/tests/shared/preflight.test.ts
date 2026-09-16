import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  checkKeyFiles,
  checkJarFiles,
  checkDeployConfig,
  checkPortAvailable,
  checkPortsAvailable,
} from '../../main/shared/preflight.js';

// ─── Temp directory for file-system tests ───────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), 'preflight-test-'));
  // Create p12-files/ and jars/ inside tmpDir
  mkdirSync(resolve(tmpDir, 'p12-files'), { recursive: true });
  mkdirSync(resolve(tmpDir, 'jars'), { recursive: true });
  // Create some test files
  writeFileSync(resolve(tmpDir, 'p12-files', 'key1.p12'), 'fake-key');
  writeFileSync(resolve(tmpDir, 'jars', 'metagraph-l0.jar'), 'fake-jar');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── checkKeyFiles ──────────────────────────────────────────────────────────

describe('checkKeyFiles', () => {
  it('returns no issues when all key files exist', () => {
    const issues = checkKeyFiles(tmpDir, ['key1.p12']);
    expect(issues).toHaveLength(0);
  });

  it('returns error for each missing key file', () => {
    const issues = checkKeyFiles(tmpDir, ['key1.p12', 'key2.p12', 'key3.p12']);
    expect(issues).toHaveLength(2);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('key2.p12');
    expect(issues[1].message).toContain('key3.p12');
  });

  it('returns empty array for empty key list', () => {
    const issues = checkKeyFiles(tmpDir, []);
    expect(issues).toHaveLength(0);
  });

  it('includes expected path in error message', () => {
    const issues = checkKeyFiles(tmpDir, ['missing.p12']);
    expect(issues[0].message).toContain(resolve(tmpDir, 'p12-files', 'missing.p12'));
  });
});

// ─── checkJarFiles ──────────────────────────────────────────────────────────

describe('checkJarFiles', () => {
  it('returns no issues when all JARs exist', () => {
    const issues = checkJarFiles(resolve(tmpDir, 'jars'), ['metagraph-l0.jar']);
    expect(issues).toHaveLength(0);
  });

  it('returns error for each missing JAR', () => {
    const issues = checkJarFiles(resolve(tmpDir, 'jars'), ['metagraph-l0.jar', 'currency-l1.jar']);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('currency-l1.jar');
    expect(issues[0].message).toContain("'hydra build'");
  });

  it('returns empty array for empty jar list', () => {
    const issues = checkJarFiles(resolve(tmpDir, 'jars'), []);
    expect(issues).toHaveLength(0);
  });
});

// ─── checkDeployConfig ──────────────────────────────────────────────────────

describe('checkDeployConfig', () => {
  // Create a real SSH key file for the tests
  let sshKeyPath: string;

  beforeAll(() => {
    const sshDir = resolve(tmpDir, '.ssh');
    mkdirSync(sshDir, { recursive: true });
    sshKeyPath = resolve(sshDir, 'test_key');
    writeFileSync(sshKeyPath, 'fake-ssh-key');
  });

  it('returns no issues for valid deploy config with existing SSH key', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1', user: 'ubuntu', ssh_key: sshKeyPath }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('returns error when hosts array is empty', () => {
    const issues = checkDeployConfig({
      hosts: [],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.message.includes('No hosts configured'))).toBe(true);
  });

  it('returns error for empty host address', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '', user: 'ubuntu', ssh_key: sshKeyPath }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.level === 'error' && i.message.includes('Invalid host'))).toBe(
      true,
    );
  });

  it('returns error for host with colon', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1:22', user: 'ubuntu', ssh_key: sshKeyPath }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.level === 'error' && i.message.includes('Invalid host'))).toBe(
      true,
    );
  });

  it('returns error when ssh_key is empty', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1', user: 'ubuntu', ssh_key: '' }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.message.includes('No ssh_key'))).toBe(true);
  });

  it('returns warn when SSH key file does not exist', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1', user: 'ubuntu', ssh_key: '/nonexistent/key' }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.level === 'warn' && i.message.includes('SSH key not found'))).toBe(
      true,
    );
  });

  it('returns warn when GL0 node IP is a placeholder', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1', user: 'ubuntu', ssh_key: sshKeyPath }],
      network: {
        name: 'testnet',
        gl0_node: { ip: ':placeholder', id: 'abc123', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.message.includes('Global L0 node IP'))).toBe(true);
  });

  it('returns warn when GL0 node ID is a placeholder', () => {
    const issues = checkDeployConfig({
      hosts: [{ host: '10.0.0.1', user: 'ubuntu', ssh_key: sshKeyPath }],
      network: {
        name: 'testnet',
        gl0_node: { ip: '1.2.3.4', id: ':placeholder', public_port: '9000' },
      },
    });
    expect(issues.some((i) => i.message.includes('Global L0 node ID'))).toBe(true);
  });
});

// ─── checkPortAvailable ─────────────────────────────────────────────────────

describe('checkPortAvailable', () => {
  it('returns true for an available port', async () => {
    // Use a high random port that's unlikely to be in use
    const port = 49152 + Math.floor(Math.random() * 16000);
    const available = await checkPortAvailable(port);
    expect(available).toBe(true);
  });

  it('returns false for a port that is in use', async () => {
    const { createServer } = await import('node:net');
    const server = createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        const result = await checkPortAvailable(address.port);
        expect(result).toBe(false);
      }
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});

// ─── checkPortsAvailable ────────────────────────────────────────────────────

describe('checkPortsAvailable', () => {
  it('returns no issues when all ports are available', async () => {
    const port1 = 49152 + Math.floor(Math.random() * 16000);
    const port2 = port1 + 1;
    const issues = await checkPortsAvailable([
      { port: port1, label: 'test-1' },
      { port: port2, label: 'test-2' },
    ]);
    expect(issues).toHaveLength(0);
  });

  it('returns error for each occupied port', async () => {
    const { createServer } = await import('node:net');
    const server = createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        const issues = await checkPortsAvailable([{ port: address.port, label: 'occupied' }]);
        expect(issues).toHaveLength(1);
        expect(issues[0].level).toBe('error');
        expect(issues[0].message).toContain('occupied');
      }
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});
