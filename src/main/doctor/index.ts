import type { EuclidConfig } from '../index.js';
import { checkDocker, checkDockerMemory } from './checks/docker.js';
import { checkBinaries } from './checks/binaries.js';
import { checkPorts } from './checks/ports.js';
import { checkConfiguration } from './checks/config.js';

/** Result status for an individual doctor check. */
export type CheckStatus = 'pass' | 'warn' | 'error';

/** A single doctor check result with name, status, message, and optional fix. */
export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  fix?: string;
}

/** A group of related doctor check results under a title. */
export interface CheckSection {
  title: string;
  results: CheckResult[];
}

/** Complete doctor report with sections and issue counts. */
export interface DoctorReport {
  sections: CheckSection[];
  errorCount: number;
  warnCount: number;
}

/**
 * Run all environment checks and return a structured report.
 */
export async function runDoctorChecks(
  projectRoot: string,
  config: EuclidConfig | null,
): Promise<DoctorReport> {
  const sections: CheckSection[] = [];

  // System dependencies
  const dockerResults = await checkDocker();
  const memoryResult = await checkDockerMemory();
  const binaryResults = await checkBinaries();

  sections.push({
    title: 'System Dependencies',
    results: [...dockerResults, memoryResult, ...binaryResults],
  });

  // Port availability (only if config is loaded)
  if (config) {
    const portResults = await checkPorts(config);
    sections.push({
      title: 'Port Availability',
      results: portResults,
    });
  }

  // Configuration
  const configResults = await checkConfiguration(projectRoot, config);
  sections.push({
    title: 'Configuration',
    results: configResults,
  });

  // Count issues
  const allResults = sections.flatMap((s) => s.results);
  const errorCount = allResults.filter((r) => r.status === 'error').length;
  const warnCount = allResults.filter((r) => r.status === 'warn').length;

  return { sections, errorCount, warnCount };
}

export { checkDocker, checkDockerMemory } from './checks/docker.js';
export { checkBinaries } from './checks/binaries.js';
export { checkPorts } from './checks/ports.js';
export { checkConfiguration } from './checks/config.js';
