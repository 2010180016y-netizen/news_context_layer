import { createHash } from 'node:crypto';

import type {
  CanonicalArticleRepositoryPort,
  FeedRepositoryPort,
  RawEntryRepositoryPort,
  RawEntryUpsertInput,
  SitemapIngestSummary
} from '@news-context/shared-types';

import { buildNormalizedArticleInput } from './normalizer.js';
import { collectBlocks, getFirstTagValue } from './xml.js';
import type { TextFetcher } from './fetch-rss.js';

interface ParsedSitemapUrl {
  loc: string;
  lastmod: string | undefined;
}

function toIsoDate(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function parseUrlSet(xml: string): ParsedSitemapUrl[] {
  return collectBlocks(xml, 'url')
    .map((urlBlock) => {
      const loc = getFirstTagValue(urlBlock, 'loc');

      if (loc === null) {
        return null;
      }

      return {
        loc,
        lastmod: toIsoDate(getFirstTagValue(urlBlock, 'lastmod'))
      } satisfies ParsedSitemapUrl;
    })
    .filter((entry): entry is ParsedSitemapUrl => entry !== null);
}

async function parseSitemapDocument(fetcher: TextFetcher, xml: string): Promise<ParsedSitemapUrl[]> {
  if (xml.includes('<sitemapindex')) {
    const sitemapBlocks = collectBlocks(xml, 'sitemap');
    const nestedEntries: ParsedSitemapUrl[] = [];

    for (const sitemapBlock of sitemapBlocks) {
      const loc = getFirstTagValue(sitemapBlock, 'loc');

      if (loc === null) {
        continue;
      }

      const nestedXml = await fetcher.fetchText(loc);
      nestedEntries.push(...(await parseSitemapDocument(fetcher, nestedXml)));
    }

    return nestedEntries;
  }

  return parseUrlSet(xml);
}

function createSitemapGuid(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

export async function runSitemapIngestWorker(deps: {
  feedRepository: FeedRepositoryPort;
  rawEntryRepository: RawEntryRepositoryPort;
  articleRepository: CanonicalArticleRepositoryPort;
  fetcher: TextFetcher;
}): Promise<SitemapIngestSummary> {
  const feeds = await deps.feedRepository.listFeedsByType('sitemap');
  let rawEntriesInserted = 0;
  let rawEntriesUpdated = 0;
  let canonicalArticlesInserted = 0;
  let canonicalArticlesUpdated = 0;
  let normalizedEntries = 0;

  for (const feed of feeds) {
    const fetchedAt = new Date().toISOString();

    try {
      const xml = await deps.fetcher.fetchText(feed.url);
      const parsedUrls = await parseSitemapDocument(deps.fetcher, xml);

      const upsertInputs: RawEntryUpsertInput[] = parsedUrls.map((entry) => ({
        feed_id: feed.id,
        source_guid: createSitemapGuid(entry.loc),
        source_url: entry.loc,
        raw_payload: {
          entry_type: 'sitemap',
          canonical_url_hint: entry.loc,
          published_at: entry.lastmod,
          modified_at: entry.lastmod,
          section: feed.section ?? undefined,
          language_code: 'ko'
        },
        fetched_at: fetchedAt
      }));

      const rawResult = await deps.rawEntryRepository.upsertEntries(upsertInputs);
      rawEntriesInserted += rawResult.inserted;
      rawEntriesUpdated += rawResult.updated;

      for (const entry of rawResult.entries) {
        const articleResult = await deps.articleRepository.upsertArticle(
          buildNormalizedArticleInput(entry, feed),
          'sitemap_ingest'
        );

        if (articleResult.inserted) {
          canonicalArticlesInserted += 1;
        } else if (articleResult.version_created) {
          canonicalArticlesUpdated += 1;
        }

        normalizedEntries += 1;
      }

      await deps.rawEntryRepository.markNormalized(
        rawResult.entries.map((entry) => entry.id),
        fetchedAt
      );
      await deps.feedRepository.markFetchResult(feed.id, fetchedAt, null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown sitemap ingest error';
      await deps.feedRepository.markFetchResult(feed.id, fetchedAt, message);
    }
  }

  return {
    feed_count: feeds.length,
    raw_entries_inserted: rawEntriesInserted,
    raw_entries_updated: rawEntriesUpdated,
    canonical_articles_inserted: canonicalArticlesInserted,
    canonical_articles_updated: canonicalArticlesUpdated,
    normalized_entries: normalizedEntries
  } satisfies SitemapIngestSummary;
}
