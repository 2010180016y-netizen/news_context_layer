import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseFeedSourceSeedFile } from '../../../packages/shared-types/src/fixtures.js';

import {
  ArticleRepository,
  FeedRepository,
  FileNewsContextStore,
  MigrationRepository,
  RawEntryRepository
} from '../../api/src/repositories/index.js';
import { createTextFetcher } from '../src/index.js';
import { runRssFetchWorker } from '../src/ingest/fetch-rss.js';
import { runSitemapIngestWorker } from '../src/ingest/fetch-sitemap.js';

const tempDirs: string[] = [];

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-jobs-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

async function readSeeds(): Promise<ReturnType<typeof parseFeedSourceSeedFile>> {
  const fileUrl = new URL('../../../infra/seeds/feed_sources.seed.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseFeedSourceSeedFile(JSON.parse(contents) as unknown);
}

describe('ingest workers', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('loads seeded feeds, ingests rss and sitemaps, and minimizes duplicate canonical articles', async () => {
    const store = await createTempStore();
    const migrationRepository = new MigrationRepository(store);
    const feedRepository = new FeedRepository(store);
    const rawEntryRepository = new RawEntryRepository(store);
    const articleRepository = new ArticleRepository(store);
    const seeds = await readSeeds();

    await migrationRepository.applyMigrations();
    await feedRepository.upsertFromSeed(seeds);

    const rssResult = await runRssFetchWorker({
      feedRepository,
      rawEntryRepository,
      articleRepository,
      fetcher: createTextFetcher('fixture-backed')
    });
    const sitemapResult = await runSitemapIngestWorker({
      feedRepository,
      rawEntryRepository,
      articleRepository,
      fetcher: createTextFetcher('fixture-backed')
    });
    const rerunSitemapResult = await runSitemapIngestWorker({
      feedRepository,
      rawEntryRepository,
      articleRepository,
      fetcher: createTextFetcher('fixture-backed')
    });

    const state = await store.readState();

    expect(rssResult).toMatchObject({
      feed_count: 10,
      raw_entries_inserted: 20,
      raw_entries_updated: 0,
      canonical_articles_inserted: 20,
      normalized_entries: 20
    });

    expect(sitemapResult).toMatchObject({
      feed_count: 10,
      raw_entries_inserted: 20,
      raw_entries_updated: 0,
      canonical_articles_inserted: 10,
      canonical_articles_updated: 10,
      normalized_entries: 20
    });

    expect(rerunSitemapResult).toMatchObject({
      feed_count: 10,
      raw_entries_inserted: 0,
      raw_entries_updated: 20,
      canonical_articles_inserted: 0,
      canonical_articles_updated: 0,
      normalized_entries: 20
    });

    expect(state.raw_entries).toHaveLength(40);
    expect(state.canonical_articles).toHaveLength(30);
    expect(state.article_versions).toHaveLength(40);
    expect(state.raw_entries.every((entry) => entry.normalized)).toBe(true);
    expect(state.feeds.filter((feed) => feed.last_fetched_at !== null)).toHaveLength(20);
  });
});
