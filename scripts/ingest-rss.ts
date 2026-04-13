import { createTextFetcher, runRssFetchWorker } from '../apps/jobs/src/index.js';
import {
  ArticleRepository,
  FeedRepository,
  FileNewsContextStore,
  MigrationRepository,
  RawEntryRepository
} from '../apps/api/src/repositories/index.js';

async function main(): Promise<void> {
  const store = new FileNewsContextStore();
  const migrationRepository = new MigrationRepository(store);

  await migrationRepository.applyMigrations();

  const result = await runRssFetchWorker({
    feedRepository: new FeedRepository(store),
    rawEntryRepository: new RawEntryRepository(store),
    articleRepository: new ArticleRepository(store),
    fetcher: createTextFetcher('fixture-backed')
  });

  console.log(
    JSON.stringify(
      {
        store_path: store.filePath,
        mode: 'fixture-backed',
        ...result
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown RSS ingest error';
  console.error(`ingest:rss failed: ${message}`);
  process.exitCode = 1;
});
