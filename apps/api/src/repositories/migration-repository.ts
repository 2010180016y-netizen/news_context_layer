import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATABASE_TABLES } from '@news-context/shared-types';

import type { FileNewsContextStore } from './file-store.js';

export interface MigrationApplyResult {
  applied_migrations: string[];
  pending_migrations: string[];
  table_count: number;
}

export function resolveDefaultMigrationDir(): string {
  return fileURLToPath(new URL('../../../../infra/migrations', import.meta.url));
}

export class MigrationRepository {
  public constructor(private readonly store: FileNewsContextStore) {}

  public async applyMigrations(migrationDir: string = resolveDefaultMigrationDir()): Promise<MigrationApplyResult> {
    const migrationFiles = (await readdir(migrationDir))
      .filter((entry) => entry.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    for (const migrationFile of migrationFiles) {
      const contents = await readFile(join(migrationDir, migrationFile), 'utf8');

      if (!contents.includes('create table if not exists')) {
        throw new Error(`Migration ${migrationFile} does not look like a schema migration.`);
      }
    }

    return this.store.writeState((state) => {
      const alreadyApplied = new Set(state.meta.applied_migrations);
      const pendingMigrations = migrationFiles.filter((migrationFile) => !alreadyApplied.has(migrationFile));

      if (pendingMigrations.length > 0) {
        state.meta.schema_source = 'docs/06_DB_Schema.sql';
        state.meta.last_migrated_at = new Date().toISOString();
        state.meta.applied_migrations.push(...pendingMigrations);
      }

      return {
        applied_migrations: [...state.meta.applied_migrations],
        pending_migrations: pendingMigrations,
        table_count: DATABASE_TABLES.length
      } satisfies MigrationApplyResult;
    });
  }
}
