import { execFile } from 'node:child_process';
import type { CheckResult } from '../index.js';

interface BinaryCheck {
  name: string;
  command: string;
  args: string[];
  versionRegex: RegExp;
  required: boolean;
  installHint: string;
}

const BINARIES: BinaryCheck[] = [
  {
    name: 'git',
    command: 'git',
    args: ['--version'],
    versionRegex: /git version (\S+)/,
    required: true,
    installHint: 'macOS: xcode-select --install | Linux: sudo apt install git',
  },
  {
    name: 'ssh',
    command: 'ssh',
    args: ['-V'],
    versionRegex: /OpenSSH[_ ](\S+)/i,
    required: false,
    installHint: 'Required only for remote operations. Usually preinstalled.',
  },
  {
    name: 'Java',
    command: 'java',
    args: ['-version'],
    versionRegex: /version "?(\S+?)"?$/m,
    required: false,
    installHint: 'Required only for seedlist check. Install: brew install openjdk@21',
  },
  {
    name: 'curl',
    command: 'curl',
    args: ['--version'],
    versionRegex: /curl (\S+)/,
    required: false,
    installHint: 'Usually preinstalled on macOS/Linux.',
  },
];

export async function checkBinaries(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const binary of BINARIES) {
    const version = await getBinaryVersion(binary);

    if (version) {
      results.push({
        name: binary.name,
        status: 'pass',
        message: version,
      });
    } else {
      results.push({
        name: binary.name,
        status: binary.required ? 'error' : 'warn',
        message: `not found${binary.required ? '' : ' (optional)'}`,
        fix: binary.installHint,
      });
    }
  }

  return results;
}

async function getBinaryVersion(binary: BinaryCheck): Promise<string | null> {
  try {
    const output = await execCommand(binary.command, binary.args);
    const match = output.match(binary.versionRegex);
    return match?.[1] ?? 'installed';
  } catch {
    return null;
  }
}

function execCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error && !stdout && !stderr) {
        reject(error);
        return;
      }
      // Some tools (ssh -V, java -version) write to stderr
      resolve(stdout + stderr);
    });
  });
}
