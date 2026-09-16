import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isLegacyScaffold, migrateScaffoldV1toV2 } from '../../main/shared/scaffold-migration.js';
import { ScaffoldMigrationBlockedError } from '../../main/shared/errors.js';

// scaffoldProject reads bundled assets from dist/assets/, which doesn't exist
// when vitest runs against the TS source tree. Stub it out — these tests only
// care about the rename + pre-flight logic that wraps it.
vi.mock('../../main/shared/scaffold.js', () => ({
  scaffoldProject: vi.fn((projectRoot: string) => {
    // Mimic the parts of scaffoldProject that influence visible state in
    // these tests: drop a sentinel docker/<image>/Dockerfile so callers can
    // observe the scaffold ran.
    mkdirSync(resolve(projectRoot, 'docker', 'metagraph-ubuntu'), { recursive: true });
    writeFileSync(resolve(projectRoot, 'docker', 'metagraph-ubuntu', 'Dockerfile'), '# bundled');
  }),
}));

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(resolve(tmpdir(), 'scaffold-migration-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function makeOldHydraLayout(root: string): void {
  // Minimal old-Hydra fixture mirroring what `current-main-euclid` looks like
  // after a vanilla `hydra install`.
  mkdirSync(resolve(root, 'infra', 'metagraph-base-image'), { recursive: true });
  mkdirSync(resolve(root, 'infra', 'metagraph-ubuntu'), { recursive: true });
  writeFileSync(resolve(root, 'infra', 'metagraph-base-image', 'Dockerfile'), '# old');
  writeFileSync(resolve(root, 'infra', 'metagraph-ubuntu', 'Dockerfile'), '# old');
  mkdirSync(resolve(root, 'source', 'project', 'custom-project'), { recursive: true });
  mkdirSync(resolve(root, 'source', 'metagraph-l0', 'genesis'), { recursive: true });
  mkdirSync(resolve(root, 'source', 'global-l0', 'genesis'), { recursive: true });
  mkdirSync(resolve(root, 'source', 'p12-files'), { recursive: true });
  writeFileSync(resolve(root, 'source', 'project', 'custom-project', 'build.sbt'), 'name := "x"');
  writeFileSync(resolve(root, 'source', 'metagraph-l0', 'genesis', 'genesis.csv'), 'DAGabc,1000');
  writeFileSync(resolve(root, 'source', 'p12-files', 'token-key.p12'), 'fake-p12');
}

describe('isLegacyScaffold', () => {
  it('returns true when infra/metagraph-base-image/ exists', () => {
    mkdirSync(resolve(tmpRoot, 'infra', 'metagraph-base-image'), { recursive: true });
    expect(isLegacyScaffold(tmpRoot)).toBe(true);
  });

  it('returns false on a fresh / TS-Hydra-only project (no infra/)', () => {
    mkdirSync(resolve(tmpRoot, 'docker', 'metagraph-ubuntu'), { recursive: true });
    writeFileSync(resolve(tmpRoot, 'docker', 'metagraph-ubuntu', 'Dockerfile'), '');
    expect(isLegacyScaffold(tmpRoot)).toBe(false);
  });

  it('returns false when infra/ exists but the metagraph-base-image/ subdir does not', () => {
    mkdirSync(resolve(tmpRoot, 'infra', 'ansible'), { recursive: true });
    expect(isLegacyScaffold(tmpRoot)).toBe(false);
  });
});

describe('migrateScaffoldV1toV2', () => {
  it('aborts when both source/ and data/ are present', () => {
    makeOldHydraLayout(tmpRoot);
    mkdirSync(resolve(tmpRoot, 'data'), { recursive: true });

    expect(() => migrateScaffoldV1toV2(tmpRoot)).toThrow(ScaffoldMigrationBlockedError);

    // No state mutation: source/, data/, infra/ all still in place
    expect(existsSync(resolve(tmpRoot, 'source'))).toBe(true);
    expect(existsSync(resolve(tmpRoot, 'data'))).toBe(true);
    expect(existsSync(resolve(tmpRoot, 'infra'))).toBe(true);
    expect(existsSync(resolve(tmpRoot, 'infra.v1.backup'))).toBe(false);
  });

  it('renames source/ → data/, scaffolds docker/, renames infra/ → infra.v1.backup/', () => {
    makeOldHydraLayout(tmpRoot);

    migrateScaffoldV1toV2(tmpRoot);

    // source/ moved to data/, contents preserved
    expect(existsSync(resolve(tmpRoot, 'source'))).toBe(false);
    expect(existsSync(resolve(tmpRoot, 'data', 'project', 'custom-project', 'build.sbt'))).toBe(
      true,
    );
    expect(existsSync(resolve(tmpRoot, 'data', 'metagraph-l0', 'genesis', 'genesis.csv'))).toBe(
      true,
    );
    expect(existsSync(resolve(tmpRoot, 'data', 'p12-files', 'token-key.p12'))).toBe(true);

    // scaffoldProject ran (mock dropped the sentinel)
    expect(existsSync(resolve(tmpRoot, 'docker', 'metagraph-ubuntu', 'Dockerfile'))).toBe(true);

    // infra/ parked as backup
    expect(existsSync(resolve(tmpRoot, 'infra'))).toBe(false);
    expect(
      existsSync(resolve(tmpRoot, 'infra.v1.backup', 'metagraph-base-image', 'Dockerfile')),
    ).toBe(true);
  });

  it('skips the source/ rename when source/ does not exist', () => {
    // infra/ exists but source/ was already migrated/removed manually
    mkdirSync(resolve(tmpRoot, 'infra', 'metagraph-base-image'), { recursive: true });
    writeFileSync(resolve(tmpRoot, 'infra', 'metagraph-base-image', 'Dockerfile'), '');

    expect(() => migrateScaffoldV1toV2(tmpRoot)).not.toThrow();

    expect(existsSync(resolve(tmpRoot, 'infra'))).toBe(false);
    expect(existsSync(resolve(tmpRoot, 'infra.v1.backup'))).toBe(true);
    expect(existsSync(resolve(tmpRoot, 'docker', 'metagraph-ubuntu', 'Dockerfile'))).toBe(true);
  });

  it('is a no-op signal after a successful run (isLegacyScaffold becomes false)', () => {
    makeOldHydraLayout(tmpRoot);
    expect(isLegacyScaffold(tmpRoot)).toBe(true);

    migrateScaffoldV1toV2(tmpRoot);

    expect(isLegacyScaffold(tmpRoot)).toBe(false);
  });
});
