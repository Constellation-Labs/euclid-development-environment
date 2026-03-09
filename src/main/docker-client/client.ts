import Dockerode from 'dockerode';
import { DockerNotRunningError, DockerVersionError, DockerError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

const MIN_DOCKER_VERSION = '26.0.0';

export class DockerClient {
  private docker: Dockerode;

  constructor(socketPath?: string) {
    this.docker = new Dockerode({ socketPath: socketPath ?? '/var/run/docker.sock' });
  }

  /** Get the underlying dockerode instance for advanced operations. */
  get raw(): Dockerode {
    return this.docker;
  }

  /**
   * Verify Docker is running and meets minimum version requirements.
   */
  async checkConnection(): Promise<{ version: string; apiVersion: string }> {
    try {
      const info = await this.docker.version();
      const version = info.Version;

      if (compareVersions(version, MIN_DOCKER_VERSION) < 0) {
        throw new DockerVersionError(version, MIN_DOCKER_VERSION);
      }

      logger.debug('Docker connection verified', { version, apiVersion: info.ApiVersion });
      return { version, apiVersion: info.ApiVersion };
    } catch (err) {
      if (err instanceof DockerVersionError) throw err;

      throw new DockerNotRunningError();
    }
  }

  /**
   * Get Docker system info (memory, CPUs, etc.).
   */
  async getSystemInfo(): Promise<{
    memoryBytes: number;
    cpus: number;
    operatingSystem: string;
  }> {
    const info = await this.docker.info();
    return {
      memoryBytes: info.MemTotal,
      cpus: info.NCPU,
      operatingSystem: info.OperatingSystem,
    };
  }

  /**
   * Check if a Docker network exists.
   */
  async networkExists(name: string): Promise<boolean> {
    try {
      const networks = await this.docker.listNetworks({ filters: { name: [name] } });
      return networks.some((n) => n.Name === name);
    } catch {
      return false;
    }
  }

  /**
   * Create a Docker network if it doesn't exist.
   */
  async ensureNetwork(name: string, subnet: string): Promise<void> {
    if (await this.networkExists(name)) {
      logger.debug(`Network '${name}' already exists`);
      return;
    }

    await this.docker.createNetwork({
      Name: name,
      Driver: 'bridge',
      IPAM: {
        Config: [{ Subnet: subnet }],
      },
    });
    logger.debug(`Created network '${name}' with subnet ${subnet}`);
  }

  /**
   * Remove a Docker network.
   */
  async removeNetwork(name: string): Promise<void> {
    if (!(await this.networkExists(name))) return;

    const network = this.docker.getNetwork(name);
    await network.remove();
    logger.debug(`Removed network '${name}'`);
  }

  /**
   * List containers, optionally filtered by name prefix.
   */
  async listContainers(namePrefix?: string): Promise<Dockerode.ContainerInfo[]> {
    const filters = namePrefix ? { name: [namePrefix] } : undefined;
    const containers = await this.docker.listContainers({ all: true, filters });
    // Docker name filter is a prefix match — do exact filtering
    if (namePrefix) {
      return containers.filter((c) =>
        c.Names.some((n) => n === `/${namePrefix}` || n.startsWith(`/${namePrefix}`)),
      );
    }
    return containers;
  }

  /**
   * Get a specific container by exact name.
   */
  async getContainer(name: string): Promise<Dockerode.ContainerInfo | null> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { name: [name] },
    });
    // Exact match (Docker filter is prefix-based)
    return containers.find((c) => c.Names.some((n) => n === `/${name}`)) ?? null;
  }

  /**
   * Check if a container is running by exact name.
   */
  async isContainerRunning(name: string): Promise<boolean> {
    const container = await this.getContainer(name);
    return container?.State === 'running';
  }

  /**
   * Start a container from an image.
   */
  async startContainer(options: {
    name: string;
    image: string;
    networkName: string;
    ipAddress: string;
    ports: Array<{ host: number; container: number }>;
    volumes: Array<{ host: string; container: string }>;
  }): Promise<string> {
    const { name, image, networkName, ipAddress, ports, volumes } = options;

    // Check if container already exists
    const existing = await this.getContainer(name);
    if (existing) {
      if (existing.State === 'running') {
        logger.debug(`Container '${name}' already running`);
        return existing.Id;
      }
      // Remove stopped container
      const container = this.docker.getContainer(existing.Id);
      await container.remove({ force: true });
    }

    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    const exposedPorts: Record<string, Record<string, never>> = {};
    for (const p of ports) {
      const key = `${p.container}/tcp`;
      portBindings[key] = [{ HostPort: String(p.host) }];
      exposedPorts[key] = {};
    }

    const binds = volumes.map((v) => `${v.host}:${v.container}`);

    const container = await this.docker.createContainer({
      name,
      Image: image,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: networkName,
      },
      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {
            IPAMConfig: { IPv4Address: ipAddress },
          },
        },
      },
    });

    await container.start();
    logger.debug(`Started container '${name}' on ${ipAddress}`);
    return container.id;
  }

  /**
   * Execute a command inside a running container.
   */
  async exec(
    containerName: string,
    command: string[],
    options?: {
      env?: Record<string, string>;
      workdir?: string;
    },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const containerInfo = await this.getContainer(containerName);
    if (!containerInfo) {
      throw new DockerError(`Container '${containerName}' not found`);
    }

    const container = this.docker.getContainer(containerInfo.Id);
    const envArray = options?.env
      ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`)
      : undefined;

    const exec = await container.exec({
      Cmd: command,
      Env: envArray,
      WorkingDir: options?.workdir,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      // Dockerode multiplexes stdout/stderr on the same stream
      // Use demuxStream to separate them
      const stdoutStream = {
        write: (chunk: Buffer) => {
          stdoutChunks.push(chunk);
          return true;
        },
      };
      const stderrStream = {
        write: (chunk: Buffer) => {
          stderrChunks.push(chunk);
          return true;
        },
      };

      container.modem.demuxStream(stream, stdoutStream, stderrStream);

      stream.on('end', async () => {
        try {
          const inspectResult = await exec.inspect();
          resolve({
            exitCode: inspectResult.ExitCode ?? 0,
            stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
            stderr: Buffer.concat(stderrChunks).toString('utf-8'),
          });
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', reject);
    });
  }

  /**
   * Stop a container by name.
   */
  async stopContainer(name: string): Promise<void> {
    const containerInfo = await this.getContainer(name);
    if (!containerInfo) return;

    if (containerInfo.State === 'running') {
      const container = this.docker.getContainer(containerInfo.Id);
      await container.stop({ t: 10 });
      logger.debug(`Stopped container '${name}'`);
    }
  }

  /**
   * Remove a container by name (force removes if running).
   */
  async removeContainer(name: string): Promise<void> {
    const containerInfo = await this.getContainer(name);
    if (!containerInfo) return;

    const container = this.docker.getContainer(containerInfo.Id);
    await container.remove({ force: true });
    logger.debug(`Removed container '${name}'`);
  }

  /**
   * Remove a Docker image by name.
   */
  async removeImage(name: string): Promise<boolean> {
    try {
      const image = this.docker.getImage(name);
      await image.remove({ force: true });
      logger.debug(`Removed image '${name}'`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a Docker image exists locally.
   */
  async imageExists(name: string): Promise<boolean> {
    try {
      const image = this.docker.getImage(name);
      await image.inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file from the host into a container.
   */
  async copyToContainer(
    containerName: string,
    hostPath: string,
    containerPath: string,
  ): Promise<void> {
    const { execSync } = await import('node:child_process');
    execSync(`docker cp "${hostPath}" "${containerName}:${containerPath}"`, { stdio: 'pipe' });
  }

  /**
   * Copy a file from a container to the host.
   */
  async copyFromContainer(
    containerName: string,
    containerPath: string,
    hostPath: string,
  ): Promise<void> {
    const containerInfo = await this.getContainer(containerName);
    if (!containerInfo) {
      throw new DockerError(`Container '${containerName}' not found`);
    }

    const container = this.docker.getContainer(containerInfo.Id);
    const stream = await container.getArchive({ path: containerPath });

    // Use tar to extract — we rely on the `tar` binary being available
    const { execSync } = await import('node:child_process');
    const { createWriteStream } = await import('node:fs');
    const { pipeline } = await import('node:stream/promises');
    const tempTar = `${hostPath}.tar`;

    const writeStream = createWriteStream(tempTar);
    await pipeline(stream, writeStream);
    execSync(`tar -xf "${tempTar}" -C "${hostPath}" --strip-components=1`, { stdio: 'pipe' });
    execSync(`rm -f "${tempTar}"`, { stdio: 'pipe' });
  }
}

/**
 * Compare two semantic version strings.
 * Returns: negative if a < b, 0 if equal, positive if a > b.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}
