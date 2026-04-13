import { readFile } from 'node:fs/promises';

import { parseFeedSourceSeedFile } from '../packages/shared-types/src/fixtures.js';
import {
  FeedRepository,
  FileNewsContextStore,
  MigrationRepository
} from '../apps/api/src/repositories/index.js';

async function main(): Promise<void> {
  const store = new FileNewsContextStore();
  const migrationRepository = new MigrationRepository(store);
  const feedRepository = new FeedRepository(store);

  await migrationRepository.applyMigrations();

  const seedFile = new URL('../infra/seeds/feed_sources.seed.json', import.meta.url);
  const seedContents = await readFile(seedFile, 'utf8');
  const seeds = parseFeedSourceSeedFile(JSON.parse(seedContents) as unknown);
  const result = await feedRepository.upsertFromSeed(seeds);

  console.log(
    JSON.stringify(
      {
        store_path: store.filePath,
        publisher_count: seeds.length,
        feed_count: seeds.reduce((total, seed) => total + seed.feeds.length, 0),
        ...result
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  console.error(`seed:feeds failed: ${message}`);
  process.exitCode = 1;
});
