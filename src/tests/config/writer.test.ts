import { describe, it, expect, afterEach } from 'vitest';
import { writeConfigAtomic } from '../../main/config/writer.js';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('writeConfigAtomic', () => {
  let tempDir: string;

  // Create a fresh temp directory for each test
  const createTempDir = async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'hydra-test-'));
    return tempDir;
  };

  afterEach(async () => {
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('writes a JSON file with pretty-printed content', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'config.json');
    const data = { name: 'test', version: 2 };

    await writeConfigAtomic(filePath, data);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe(JSON.stringify(data, null, 2) + '\n');
  });

  it('file is valid JSON after write', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'config.json');
    const data = { complex: { nested: [1, 2, 3], flag: true } };

    await writeConfigAtomic(filePath, data);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toEqual(data);
  });

  it('overwrites existing file content', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'config.json');

    await writeConfigAtomic(filePath, { v: 1 });
    await writeConfigAtomic(filePath, { v: 2 });

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.v).toBe(2);
  });

  it('does not leave temp files behind on success', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'config.json');

    await writeConfigAtomic(filePath, { clean: true });

    const { readdir } = await import('node:fs/promises');
    const files = await readdir(tempDir);
    // Should only have the target file, no .hydra-tmp-* leftover
    expect(files).toEqual(['config.json']);
  });

  it('handles large objects', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'large.json');
    const data = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        tags: ['a', 'b', 'c'],
      })),
    };

    await writeConfigAtomic(filePath, data);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.items).toHaveLength(1000);
    expect(parsed.items[999].id).toBe(999);
  });

  it('preserves special characters in strings', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'special.json');
    const data = {
      message: 'Line 1\nLine 2\tTabbed',
      path: '/usr/local/bin',
      unicode: '日本語テスト',
    };

    await writeConfigAtomic(filePath, data);

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.message).toBe('Line 1\nLine 2\tTabbed');
    expect(parsed.unicode).toBe('日本語テスト');
  });

  it('content ends with trailing newline', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'newline.json');

    await writeConfigAtomic(filePath, { test: true });

    const content = await readFile(filePath, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
    // Should not end with double newline
    expect(content.endsWith('\n\n')).toBe(false);
  });

  it('works with nested directory paths', async () => {
    await createTempDir();
    const nestedDir = join(tempDir, 'sub');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(nestedDir, { recursive: true });
    const filePath = join(nestedDir, 'config.json');

    await writeConfigAtomic(filePath, { nested: true });

    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.nested).toBe(true);
  });

  it('handles empty object', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'empty.json');

    await writeConfigAtomic(filePath, {});

    const content = await readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual({});
  });

  it('handles arrays as root value', async () => {
    await createTempDir();
    const filePath = join(tempDir, 'array.json');

    await writeConfigAtomic(filePath, [1, 2, 3]);

    const content = await readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual([1, 2, 3]);
  });
});
