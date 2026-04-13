import { readFile } from 'node:fs/promises';

import {
  parseFeedSourceSeedFile,
  type FeedSeedLoadSummary,
  type FeedSourceSeed,
  type FeedType,
  type RssIngestSummary,
  type SitemapIngestSummary
} from '@news-context/shared-types';
import {
  createTextFetcher,
  type IngestFetchMode,
  type TextFetcher
} from '../../../jobs/src/ingest/fetchers.js';
import { runRssFetchWorker } from '../../../jobs/src/ingest/fetch-rss.js';
import { runSitemapIngestWorker } from '../../../jobs/src/ingest/fetch-sitemap.js';

import {
  ArticleRepository,
  FeedRepository,
  FileNewsContextStore,
  MigrationRepository,
  RawEntryRepository
} from '../repositories/index.js';

export const INGEST_SEED_MODES = ['always', 'if-empty', 'skip'] as const;
export const INGEST_STAGE_STATUSES = ['success', 'partial', 'empty', 'failed'] as const;

export type IngestSeedMode = (typeof INGEST_SEED_MODES)[number];
export type IngestStageStatus = (typeof INGEST_STAGE_STATUSES)[number];

export interface IngestStageObservation {
  readonly stage: 'seed_feeds' | 'rss' | 'sitemap';
  readonly status: IngestStageStatus;
  readonly observed_at: string;
  readonly feed_type: FeedType | null;
  readonly feed_count: number;
  readonly error_count: number;
  readonly inserted_count: number;
  readonly updated_count: number;
  readonly normalized_count: number;
  readonly notes: readonly string[];
}

export interface IngestCycleSummary {
  readonly started_at: string;
  readonly completed_at: string;
  readonly store_path: string;
  readonly fetch_mode: IngestFetchMode;
  readonly seed_mode: IngestSeedMode;
  readonly migrations_applied: readonly string[];
  readonly seed_summary: FeedSeedLoadSummary | null;
  readonly rss_summary: RssIngestSummary;
  readonly sitemap_summary: SitemapIngestSummary;
  readonly observations: readonly IngestStageObservation[];
  readonly success: boolean;
}

export interface IngestCycleLogger {
  info(message: string): void;
  warn(message: string): void;
}

const EMPTY_INGEST_SUMMARY = {
  feed_count: 0,
  raw_entries_inserted: 0,
  raw_entries_updated: 0,
  canonical_articles_inserted: 0,
  canonical_articles_updated: 0,
  normalized_entries: 0
} as const;

function stageStatus(params: {
  readonly feedCount: number;
  readonly errorCount: number;
  readonly touchedCount: number;
}): IngestStageStatus {
  if (params.feedCount === 0 || params.touchedCount === 0) {
    return 'empty';
  }

  if (params.errorCount === 0) {
    return 'success';
  }

  if (params.errorCount >= params.feedCount) {
    return 'failed';
  }

  return 'partial';
}

function createObservation(
  stage: IngestStageObservation['stage'],
  params: {
    readonly feedType: FeedType | null;
    readonly feedCount: number;
    readonly errorCount: number;
    readonly insertedCount: number;
    readonly updatedCount: number;
    readonly normalizedCount: number;
    readonly notes: readonly string[];
    readonly observedAt: string;
  }
): IngestStageObservation {
  const touchedCount = params.insertedCount + params.updatedCount + params.normalizedCount;

  return {
    stage,
    status: stageStatus({
      feedCount: params.feedCount,
      errorCount: params.errorCount,
      touchedCount
    }),
    observed_at: params.observedAt,
    feed_type: params.feedType,
    feed_count: params.feedCount,
    error_count: params.errorCount,
    inserted_count: params.insertedCount,
    updated_count: params.updatedCount,
    normalized_count: params.normalizedCount,
    notes: params.notes
  };
}

function emitObservation(logger: IngestCycleLogger, observation: IngestStageObservation): void {
  const payload = JSON.stringify(
    {
      kind: 'ingest_stage',
      ...observation
    },
    null,
    2
  );

  if (observation.status === 'failed' || observation.status === 'partial') {
    logger.warn(payload);
    return;
  }

  logger.info(payload);
}

async function readSeedFile(): Promise<readonly FeedSourceSeed[]> {
  const seedFileUrl = new URL('../../../../infra/seeds/feed_sources.seed.json', import.meta.url);
  const contents = await readFile(seedFileUrl, 'utf8');
  return parseFeedSourceSeedFile(JSON.parse(contents) as unknown);
}

function buildSeedObservation(
  seedMode: IngestSeedMode,
  observedAt: string,
  summary: FeedSeedLoadSummary | null,
  skippedReason: string | null
): IngestStageObservation {
  const feedCount = summary === null ? 0 : summary.inserted_feeds + summary.updated_feeds;

  return createObservation('seed_feeds', {
    feedType: null,
    feedCount,
    errorCount: 0,
    insertedCount: summary?.inserted_feeds ?? 0,
    updatedCount: summary?.updated_feeds ?? 0,
    normalizedCount: 0,
    notes:
      skippedReason === null
        ? [`seed_mode=${seedMode}`]
        : [`seed_mode=${seedMode}`, skippedReason],
    observedAt
  });
}

function summarizeFeedErrors(
  state: Awaited<ReturnType<FileNewsContextStore['readState']>>,
  feedType: FeedType
): {
  readonly feedCount: number;
  readonly errorCount: number;
  readonly notes: readonly string[];
} {
  const feeds = state.feeds.filter((feed) => feed.feed_type === feedType);
  const failedFeeds = feeds.filter((feed) => feed.last_error !== null);

  return {
    feedCount: feeds.length,
    errorCount: failedFeeds.length,
    notes: failedFeeds
      .slice(0, 3)
      .map((feed) => `${feed.url} -> ${feed.last_error ?? 'unknown ingest error'}`)
  };
}

export async function runIngestCycle(options?: {
  readonly store?: FileNewsContextStore;
  readonly fetchMode?: IngestFetchMode;
  readonly fetcher?: TextFetcher;
  readonly seedMode?: IngestSeedMode;
  readonly logger?: IngestCycleLogger;
}): Promise<IngestCycleSummary> {
  const store = options?.store ?? new FileNewsContextStore();
  const fetchMode = options?.fetchMode ?? 'fixture-backed';
  const fetcher: TextFetcher = options?.fetcher ?? createTextFetcher(fetchMode);
  const seedMode = options?.seedMode ?? 'if-empty';
  const logger: IngestCycleLogger =
    options?.logger ??
    ({
      info(message: string) {
        console.info(message);
      },
      warn(message: string) {
        console.warn(message);
      }
    } satisfies IngestCycleLogger);
  const startedAt = new Date().toISOString();

  const migrationRepository = new MigrationRepository(store);
  const feedRepository = new FeedRepository(store);
  const rawEntryRepository = new RawEntryRepository(store);
  const articleRepository = new ArticleRepository(store);
  const migrationResult = await migrationRepository.applyMigrations();

  const initialState = await store.readState();
  const shouldSeed =
    seedMode === 'always' || (seedMode === 'if-empty' && initialState.feeds.length === 0);
  const observedSeedAt = new Date().toISOString();
  const seedSummary: FeedSeedLoadSummary | null = shouldSeed
    ? await feedRepository.upsertFromSeed(await readSeedFile())
    : null;
  const seedObservation = buildSeedObservation(
    seedMode,
    observedSeedAt,
    seedSummary,
    shouldSeed ? null : 'seed skipped because feeds already exist'
  );
  emitObservation(logger, seedObservation);

  const rssSummary = await runRssFetchWorker({
    feedRepository,
    rawEntryRepository,
    articleRepository,
    fetcher
  });
  const rssState = await store.readState();
  const rssFeedSummary = summarizeFeedErrors(rssState, 'rss');
  const rssObservation = createObservation('rss', {
    feedType: 'rss',
    feedCount: rssFeedSummary.feedCount,
    errorCount: rssFeedSummary.errorCount,
    insertedCount: rssSummary.raw_entries_inserted + rssSummary.canonical_articles_inserted,
    updatedCount: rssSummary.raw_entries_updated + rssSummary.canonical_articles_updated,
    normalizedCount: rssSummary.normalized_entries,
    notes: rssFeedSummary.notes,
    observedAt: new Date().toISOString()
  });
  emitObservation(logger, rssObservation);

  const sitemapSummary = await runSitemapIngestWorker({
    feedRepository,
    rawEntryRepository,
    articleRepository,
    fetcher
  });
  const sitemapState = await store.readState();
  const sitemapFeedSummary = summarizeFeedErrors(sitemapState, 'sitemap');
  const sitemapObservation = createObservation('sitemap', {
    feedType: 'sitemap',
    feedCount: sitemapFeedSummary.feedCount,
    errorCount: sitemapFeedSummary.errorCount,
    insertedCount: sitemapSummary.raw_entries_inserted + sitemapSummary.canonical_articles_inserted,
    updatedCount: sitemapSummary.raw_entries_updated + sitemapSummary.canonical_articles_updated,
    normalizedCount: sitemapSummary.normalized_entries,
    notes: sitemapFeedSummary.notes,
    observedAt: new Date().toISOString()
  });
  emitObservation(logger, sitemapObservation);

  const completedAt = new Date().toISOString();

  return {
    started_at: startedAt,
    completed_at: completedAt,
    store_path: store.filePath,
    fetch_mode: fetchMode,
    seed_mode: seedMode,
    migrations_applied: migrationResult.applied_migrations,
    seed_summary: seedSummary,
    rss_summary: rssSummary,
    sitemap_summary: sitemapSummary,
    observations: [seedObservation, rssObservation, sitemapObservation],
    success: [seedObservation, rssObservation, sitemapObservation].every(
      (observation) => observation.status !== 'failed'
    )
  };
}

export function createEmptyIngestCycleSummary(params: {
  readonly storePath: string;
  readonly fetchMode: IngestFetchMode;
  readonly seedMode: IngestSeedMode;
}): IngestCycleSummary {
  const nowIso = new Date().toISOString();

  return {
    started_at: nowIso,
    completed_at: nowIso,
    store_path: params.storePath,
    fetch_mode: params.fetchMode,
    seed_mode: params.seedMode,
    migrations_applied: [],
    seed_summary: null,
    rss_summary: { ...EMPTY_INGEST_SUMMARY },
    sitemap_summary: { ...EMPTY_INGEST_SUMMARY },
    observations: [],
    success: true
  };
}
