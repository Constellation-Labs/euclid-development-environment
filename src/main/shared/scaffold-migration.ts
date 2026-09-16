import { resolve } from 'node:path';
import { existsSync, renameSync } from 'node:fs';
import { ScaffoldMigrationBlockedError } from './errors.js';
import { scaffoldProject } from './scaffold.js';

/**
 * Returns true if the project looks like the v1 (Bash Hydra) scaffold —
 * filesystem-based heuristic, no marker file. After migration, infra/ is
 * renamed to infra.v1.backup/, so this naturally returns false on subsequent
 * runs. Mirrors the `isLegacyConfig` detection used for euclid.json.
 *
 * Signal: presence of `infra/metagraph-base-image/`. TS Hydra never creates
 * `infra/`, so this is unambiguous in practice.
 */
export function isLegacyScaffold(projectRoot: string): boolean {
  return existsSync(resolve(projectRoot, 'infra', 'metagraph-base-image'));
}

/**
 * Migrate a v1 (Bash Hydra) project layout to v2 (TS Hydra) in place:
 * `source/` → `data/`, scaffold bundled `docker/` assets, `infra/` →
 * `infra.v1.backup/`. Throws `ScaffoldMigrationBlockedError` if both
 * `source/` and `data/` are present (ambiguous state — needs manual
 * intervention). Mirrors `migrateV1toV2` for euclid.json.
 */
export function migrateScaffoldV1toV2(projectRoot: string): void {
  const sourceDir = resolve(projectRoot, 'source');
  const dataDir = resolve(projectRoot, 'data');
  const infraDir = resolve(projectRoot, 'infra');

  if (existsSync(sourceDir) && existsSync(dataDir)) {
    throw new ScaffoldMigrationBlockedError(
      'Both source/ (old-Hydra) and data/ (TS-Hydra) are present — cannot auto-migrate.',
      {
        suggestion:
          'Consolidate manually: move what you need from source/ into data/ and delete ' +
          'source/, OR delete an empty data/ so the migration can rename source/ → data/.',
      },
    );
  }

  if (existsSync(sourceDir)) {
    renameSync(sourceDir, dataDir);
  }

  scaffoldProject(projectRoot);

  renameSync(infraDir, `${infraDir}.v1.backup`);
}
