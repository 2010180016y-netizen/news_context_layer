import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileNewsContextStore } from '../src/repositories/file-store.js';
import {
  createEmptyIngestCycleSummary,
  runIngestCycle,
  type IngestStageObservation
} from '../src/services/ingest-operations.js';

const tempDirs: string[] = [];

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-ingest-cycle-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

function collectStage(summary: { observations: readonly IngestStageObservation[] }, stage: string) {
  return summary.observations.find((entry) => entry.stage === stage);
}

describe('runIngestCycle', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('runs migrations, seeds feeds once, and ingests rss plus sitemap in a cron-ready summary', async () => {
    const store = await createTempStore();
    const summary = await runIngestCycle({
      store,
      fetchMode: 'fixture-backed',
      seedMode: 'if-empty',
      logger: {
        info() {},
        warn() {}
      }
    });
    const state = await store.readState();

    expect(summary.success).toBe(true);
    expect(summary.fetch_mode).toBe('fixture-backed');
    expect(summary.seed_mode).toBe('if-empty');
    expect(summary.seed_summary).toMatchObject({
      inserted_publishers: 5,
      inserted_feeds: 20
    });
    expect(summary.rss_summary).toMatchObject({
      feed_count: 10,
      raw_entries_inserted: 20,
      canonical_articles_inserted: 20,
      normalized_entries: 20
    });
    expect(summary.sitemap_summary).toMatchObject({
      feed_count: 10,
      raw_entries_inserted: 20,
      canonical_articles_inserted: 10,
      canonical_articles_updated: 10,
      normalized_entries: 20
    });
    expect(collectStage(summary, 'seed_feeds')).toMatchObject({
      status: 'success',
      feed_count: 20,
      error_count: 0
    });
    expect(collectStage(summary, 'rss')).toMatchObject({
      status: 'success',
      feed_count: 10,
      error_count: 0
    });
    expect(collectStage(summary, 'sitemap')).toMatchObject({
      status: 'success',
      feed_count: 10,
      error_count: 0
    });
    expect(state.feeds).toHaveLength(20);
    expect(state.raw_entries).toHaveLength(40);
    expect(state.canonical_articles).toHaveLength(30);
  });

  it('skips reseeding when feeds already exist and still reports structured observations', async () => {
    const store = await createTempStore();

    await runIngestCycle({
      store,
      fetchMode: 'fixture-backed',
      seedMode: 'if-empty',
      logger: {
        info() {},
        warn() {}
      }
    });

    const summary = await runIngestCycle({
      store,
      fetchMode: 'fixture-backed',
      seedMode: 'if-empty',
      logger: {
        info() {},
        warn() {}
      }
    });

    expect(summary.success).toBe(true);
    expect(summary.seed_summary).toBeNull();
    expect(collectStage(summary, 'seed_feeds')).toMatchObject({
      status: 'empty',
      notes: ['seed_mode=if-empty', 'seed skipped because feeds already exist']
    });
    expect(summary.rss_summary.raw_entries_inserted).toBe(0);
    expect(summary.rss_summary.raw_entries_updated).toBe(20);
    expect(summary.sitemap_summary.raw_entries_inserted).toBe(0);
    expect(summary.sitemap_summary.raw_entries_updated).toBe(20);
  });

  it('creates an empty summary contract for failed orchestration wrappers', () => {
    const summary = createEmptyIngestCycleSummary({
      storePath: 'C:/tmp/store.json',
      fetchMode: 'fixture-backed',
      seedMode: 'skip'
    });

    expect(summary).toMatchObject({
      store_path: 'C:/tmp/store.json',
      fetch_mode: 'fixture-backed',
      seed_mode: 'skip',
      success: true,
      observations: []
    });
  });
});
