import { writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Write a JSON config file atomically using the temp-file + rename pattern.
 * This prevents data loss if the process is killed mid-write or if
 * serialization fails (the original file is never truncated).
 */
export async function writeConfigAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = dirname(resolve(filePath));
  const tempPath = resolve(dir, `.hydra-tmp-${randomUUID()}.json`);

  const content = JSON.stringify(data, null, 2) + '\n';

  // Write to temp file first — if this fails, the original is untouched
  await writeFile(tempPath, content, 'utf-8');

  // Atomic rename — on POSIX this is guaranteed atomic
  await rename(tempPath, resolve(filePath));
}
