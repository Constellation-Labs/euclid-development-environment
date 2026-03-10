import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface PreflightIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Check that required P12 key files exist.
 */
export function checkKeyFiles(dataPath: string, keyFileNames: string[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  for (const name of keyFileNames) {
    const p12Path = resolve(dataPath, 'p12-files', name);
    if (!existsSync(p12Path)) {
      issues.push({
        level: 'error',
        message: `Key file not found: ${name} (expected at ${p12Path})`,
      });
    }
  }
  return issues;
}

/**
 * Check that required JAR files exist.
 */
export function checkJarFiles(jarsDir: string, requiredJars: string[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  for (const jar of requiredJars) {
    if (!existsSync(resolve(jarsDir, jar))) {
      issues.push({
        level: 'error',
        message: `Missing JAR: ${jar}. Run 'hydra build' first.`,
      });
    }
  }
  return issues;
}

/**
 * Check that the deploy section is properly configured.
 */
export function checkDeployConfig(deploy: {
  hosts: Array<{ host: string; user: string; ssh_key: string }>;
  network: { name: string; gl0_node: { ip: string; id: string; public_port: string | number } };
}): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  if (!deploy.hosts || deploy.hosts.length === 0) {
    issues.push({ level: 'error', message: 'No hosts configured in deploy section.' });
  }

  for (const host of deploy.hosts) {
    if (!host.host || host.host.includes(':')) {
      issues.push({ level: 'error', message: `Invalid host address: '${host.host}'` });
    }
    if (!host.ssh_key) {
      issues.push({ level: 'error', message: `No ssh_key configured for host ${host.host}` });
    }
    // Check SSH key exists (expand ~)
    const keyPath = host.ssh_key.startsWith('~')
      ? resolve(homedir(), host.ssh_key.slice(2))
      : resolve(host.ssh_key);
    if (!existsSync(keyPath)) {
      issues.push({
        level: 'warn',
        message: `SSH key not found: ${host.ssh_key} (for host ${host.host})`,
      });
    }
  }

  const gl0 = deploy.network?.gl0_node;
  if (gl0) {
    if (!gl0.ip || gl0.ip.startsWith(':')) {
      issues.push({
        level: 'warn',
        message: 'Global L0 node IP is not configured (placeholder value).',
      });
    }
    if (!gl0.id || gl0.id.startsWith(':')) {
      issues.push({
        level: 'warn',
        message: 'Global L0 node ID is not configured (placeholder value).',
      });
    }
  }

  return issues;
}

/**
 * Check that a TCP port is available on localhost.
 */
export async function checkPortAvailable(port: number): Promise<boolean> {
  const { createServer } = await import('node:net');
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Check multiple local ports are available.
 */
export async function checkPortsAvailable(
  ports: Array<{ port: number; label: string }>,
): Promise<PreflightIssue[]> {
  const issues: PreflightIssue[] = [];
  for (const { port, label } of ports) {
    const available = await checkPortAvailable(port);
    if (!available) {
      issues.push({
        level: 'error',
        message: `Port ${port} (${label}) is already in use.`,
      });
    }
  }
  return issues;
}
