import chalk from 'chalk';

const errorRed = chalk.hex('#F87171');
const hintDim = chalk.hex('#6B7280');

/**
 * Base error class for all Hydra errors.
 * Provides structured error information with suggestions for resolution.
 */
export class HydraError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;

  constructor(message: string, options?: { code?: string; suggestion?: string; cause?: Error }) {
    super(message, { cause: options?.cause });
    this.name = 'HydraError';
    this.code = options?.code ?? 'HYDRA_ERROR';
    this.suggestion = options?.suggestion;
  }

  /**
   * Format the error for CLI display with context and suggestions.
   */
  format(): string {
    const lines: string[] = [];
    lines.push(`${errorRed('Error:')} ${this.message}`);
    if (this.suggestion) {
      lines.push('');
      lines.push(`  ${hintDim(this.suggestion)}`);
    }
    if (this.cause instanceof Error) {
      lines.push('');
      lines.push(`  ${hintDim('Caused by:')} ${this.cause.message}`);
    }
    return lines.join('\n');
  }
}

export class ConfigError extends HydraError {
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, { code: 'CONFIG_ERROR', ...options });
    this.name = 'ConfigError';
  }
}

export class ConfigNotFoundError extends ConfigError {
  constructor(path: string) {
    super(`Configuration file not found: ${path}`, {
      suggestion:
        "Run 'hydra init' to create a new project, or ensure you're in the project root directory.",
    });
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigValidationError extends ConfigError {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    const summary =
      issues.length === 1
        ? `Invalid configuration: ${issues[0].message} (at ${issues[0].path})`
        : `Invalid configuration: ${issues.length} issues found`;
    super(summary, {
      suggestion:
        "Run 'hydra config validate' to see all issues, or 'hydra config show' to inspect your config.",
    });
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }

  format(): string {
    const lines: string[] = [super.format()];
    if (this.issues.length > 1) {
      lines.push('');
      for (const issue of this.issues) {
        lines.push(`  - ${issue.path}: ${issue.message}`);
      }
    }
    return lines.join('\n');
  }
}

export class DockerError extends HydraError {
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, { code: 'DOCKER_ERROR', ...options });
    this.name = 'DockerError';
  }

  /**
   * Override: skip the verbose `cause` for Docker errors.
   * The cause contains the raw Docker stderr wall-of-text — the summary
   * in `this.message` (from cleanDockerError) already covers it.
   */
  format(): string {
    const lines: string[] = [];
    lines.push(`${errorRed('Error:')} ${this.message}`);
    if (this.suggestion) {
      lines.push('');
      lines.push(`  ${hintDim(this.suggestion)}`);
    }
    return lines.join('\n');
  }
}

export class DockerNotRunningError extends DockerError {
  constructor() {
    super('Docker is not running', {
      suggestion: [
        'Docker Desktop does not appear to be started.',
        '  macOS: Open Docker Desktop from Applications',
        '  Linux: sudo systemctl start docker',
        '',
        "  Run 'hydra doctor' to verify your environment.",
      ].join('\n'),
    });
    this.name = 'DockerNotRunningError';
  }
}

export class DockerVersionError extends DockerError {
  constructor(found: string, required: string) {
    super(`Docker version ${found} is too old (required: >= ${required})`, {
      suggestion:
        'Update Docker Desktop to the latest version: https://docs.docker.com/get-docker/',
    });
    this.name = 'DockerVersionError';
  }
}

export class ClusterError extends HydraError {
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, { code: 'CLUSTER_ERROR', ...options });
    this.name = 'ClusterError';
  }
}

export class LayerStartError extends ClusterError {
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, options);
    this.name = 'LayerStartError';
  }
}

export class RemoteError extends HydraError {
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, { code: 'REMOTE_ERROR', ...options });
    this.name = 'RemoteError';
  }
}

export class SSHConnectionError extends RemoteError {
  constructor(host: string, options?: { cause?: Error }) {
    super(`Cannot connect to ${host}`, {
      suggestion: [
        'Verify the host is reachable and SSH is configured:',
        `  ssh <user>@${host}`,
        '',
        '  Check your deploy.hosts configuration in euclid.json.',
      ].join('\n'),
      ...options,
    });
    this.name = 'SSHConnectionError';
  }
}

export class RemoteDeployError extends RemoteError {
  constructor(host: string, detail: string, options?: { cause?: Error }) {
    super(`Deploy failed on ${host}: ${detail}`, {
      suggestion: [
        'Check that the remote host is accessible and has enough disk space.',
        `  ssh <user>@${host}`,
        '',
        "  Run 'hydra remote status' to check host connectivity.",
      ].join('\n'),
      ...options,
    });
    this.name = 'RemoteDeployError';
  }
}

export class RemoteStartError extends RemoteError {
  constructor(host: string, layer: string, options?: { cause?: Error }) {
    super(`Failed to start ${layer} on ${host}`, {
      suggestion: [
        `Check logs on the remote host:`,
        `  hydra remote logs ${host} ${layer}`,
        '',
        '  Verify the node has enough memory and the JARs are deployed.',
      ].join('\n'),
      ...options,
    });
    this.name = 'RemoteStartError';
  }
}

export class PortInUseError extends HydraError {
  constructor(port: number, layer?: string) {
    const context = layer ? ` (needed for ${layer})` : '';
    super(`Port ${port} is already in use${context}`, {
      code: 'PORT_IN_USE',
      suggestion: `Find the process using port ${port}: lsof -i :${port}`,
    });
    this.name = 'PortInUseError';
  }
}

export class BinaryNotFoundError extends HydraError {
  constructor(binary: string, installHint?: string) {
    super(`Required binary not found: ${binary}`, {
      code: 'BINARY_NOT_FOUND',
      suggestion: installHint ?? `Install ${binary} and ensure it is on your PATH.`,
    });
    this.name = 'BinaryNotFoundError';
  }
}
