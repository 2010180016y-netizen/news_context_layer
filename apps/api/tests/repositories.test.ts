import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseFeedSourceSeedFile } from '../../../packages/shared-types/src/fixtures.js';

import {
  FeedRepository,
  FileNewsContextStore,
  MigrationRepository
} from '../src/repositories/index.js';

const tempDirs: string[] = [];

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-api-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

async function readSeeds(): Promise<ReturnType<typeof parseFeedSourceSeedFile>> {
  const fileUrl = new URL('../../../infra/seeds/feed_sources.seed.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseFeedSourceSeedFile(JSON.parse(contents) as unknown);
}

describe('repository foundation', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('applies migrations and upserts the 20-feed seed set without duplicates', async () => {
    const store = await createTempStore();
    const migrationRepository = new MigrationRepository(store);
    const feedRepository = new FeedRepository(store);
    const seeds = await readSeeds();

    const migrationResult = await migrationRepository.applyMigrations();
    const firstSeedResult = await feedRepository.upsertFromSeed(seeds);
    const secondSeedResult = await feedRepository.upsertFromSeed(seeds);
    const state = await store.readState();

    expect(migrationResult.pending_migrations).toEqual(['001_init.sql']);
    expect(migrationResult.table_count).toBe(17);
    expect(state.meta.applied_migrations).toEqual(['001_init.sql']);
    expect(state.publishers).toHaveLength(5);
    expect(state.feeds).toHaveLength(20);
    expect(state.raw_entries).toHaveLength(0);
    expect(state.canonical_articles).toHaveLength(0);

    expect(firstSeedResult).toEqual({
      inserted_publishers: 5,
      updated_publishers: 0,
      inserted_feeds: 20,
      updated_feeds: 0
    });

    expect(secondSeedResult).toEqual({
      inserted_publishers: 0,
      updated_publishers: 5,
      inserted_feeds: 0,
      updated_feeds: 20
    });
  });
});
