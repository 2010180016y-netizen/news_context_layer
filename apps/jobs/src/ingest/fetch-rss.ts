import type {
  CanonicalArticleRepositoryPort,
  FeedRepositoryPort,
  RawEntryRepositoryPort,
  RawEntryUpsertInput,
  RssIngestSummary
} from '@news-context/shared-types';

import { buildNormalizedArticleInput } from './normalizer.js';
import { collectBlocks, collectTagValues, getFirstTagValue } from './xml.js';

export interface TextFetcher {
  fetchText(url: string): Promise<string>;
}

interface ParsedRssItem {
  guid: string | null;
  link: string;
  title: string;
  description: string | undefined;
  published_at: string | undefined;
  modified_at: string | undefined;
  author_names: string[];
  keywords: string[];
}

function toIsoDate(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

export function parseRssFeed(xml: string): ParsedRssItem[] {
  const items = collectBlocks(xml, 'item');

  return items
    .map((itemXml) => {
      const link = getFirstTagValue(itemXml, 'link');
      const title = getFirstTagValue(itemXml, 'title');

      if (link === null || title === null) {
        return null;
      }

      const authorNames = [
        ...collectTagValues(itemXml, 'author'),
        ...collectTagValues(itemXml, 'dc:creator')
      ];

      return {
        guid: getFirstTagValue(itemXml, 'guid'),
        link,
        title,
        description: getFirstTagValue(itemXml, 'description') ?? undefined,
        published_at: toIsoDate(getFirstTagValue(itemXml, 'pubDate')),
        modified_at: toIsoDate(getFirstTagValue(itemXml, 'lastBuildDate') ?? getFirstTagValue(itemXml, 'updated')),
        author_names: Array.from(new Set(authorNames)),
        keywords: collectTagValues(itemXml, 'category')
      } satisfies ParsedRssItem;
    })
    .filter((item): item is ParsedRssItem => item !== null);
}

export async function runRssFetchWorker(deps: {
  feedRepository: FeedRepositoryPort;
  rawEntryRepository: RawEntryRepositoryPort;
  articleRepository: CanonicalArticleRepositoryPort;
  fetcher: TextFetcher;
}): Promise<RssIngestSummary> {
  const feeds = await deps.feedRepository.listFeedsByType('rss');
  let rawEntriesInserted = 0;
  let rawEntriesUpdated = 0;
  let canonicalArticlesInserted = 0;
  let canonicalArticlesUpdated = 0;
  let normalizedEntries = 0;

  for (const feed of feeds) {
    const fetchedAt = new Date().toISOString();

    try {
      const xml = await deps.fetcher.fetchText(feed.url);
      const parsedItems = parseRssFeed(xml);

      const upsertInputs: RawEntryUpsertInput[] = parsedItems.map((item) => ({
        feed_id: feed.id,
        source_guid: item.guid,
        source_url: item.link,
        raw_payload: {
          entry_type: 'rss',
          title: item.title,
          description: item.description,
          excerpt: item.description,
          canonical_url_hint: item.link,
          published_at: item.published_at,
          modified_at: item.modified_at,
          author_names: item.author_names,
          keywords: item.keywords,
          section: feed.section ?? undefined,
          language_code: 'ko',
          raw_guid: item.guid ?? undefined
        },
        fetched_at: fetchedAt
      }));

      const rawResult = await deps.rawEntryRepository.upsertEntries(upsertInputs);
      rawEntriesInserted += rawResult.inserted;
      rawEntriesUpdated += rawResult.updated;

      for (const entry of rawResult.entries) {
        const articleResult = await deps.articleRepository.upsertArticle(
          buildNormalizedArticleInput(entry, feed),
          'rss_ingest'
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
      const message = error instanceof Error ? error.message : 'Unknown RSS ingest error';
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
  } satisfies RssIngestSummary;
}
