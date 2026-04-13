import { createHash } from 'node:crypto';

import type {
  ArticleType,
  FeedWithPublisher,
  NormalizedArticleInput,
  RawEntryRecord
} from '@news-context/shared-types';

function normalizeUrlSearchParams(url: URL): void {
  const removableParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];

  for (const param of removableParams) {
    url.searchParams.delete(param);
  }
}

export function normalizeCanonicalUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  normalizeUrlSearchParams(url);
  url.hash = '';

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function createTitleHash(title: string): string {
  return createHash('sha256')
    .update(title.trim().toLowerCase().replace(/\s+/g, ' '))
    .digest('hex');
}

export function deriveTitleFromUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  const lastSegment = url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .at(-1);

  if (lastSegment === undefined) {
    return url.hostname;
  }

  const cleaned = lastSegment.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return cleaned === '' ? url.hostname : cleaned;
}

export function inferArticleType(section: string | null, title: string): ArticleType {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('사설') || normalizedTitle.includes('opinion')) {
    return 'editorial';
  }

  if (normalizedTitle.includes('분석') || normalizedTitle.includes('analysis')) {
    return 'analysis';
  }

  if (section === 'opinion') {
    return 'opinion';
  }

  return 'news';
}

function normalizeAuthors(authorNames: readonly string[] | undefined): string[] {
  return (authorNames ?? []).map((author) => author.trim()).filter((author) => author !== '');
}

function toNullable(value: string | undefined): string | null {
  return value === undefined || value.trim() === '' ? null : value;
}

export function buildNormalizedArticleInput(
  rawEntry: RawEntryRecord,
  feed: FeedWithPublisher
): NormalizedArticleInput {
  const payload = rawEntry.raw_payload;
  const canonicalUrl = normalizeCanonicalUrl(payload.canonical_url_hint ?? rawEntry.source_url);
  const title = (payload.title ?? deriveTitleFromUrl(rawEntry.source_url)).trim();
  const section = toNullable(payload.section ?? feed.section ?? undefined);
  const articleType = payload.article_type ?? inferArticleType(section, title);
  const excerptSource = payload.excerpt ?? payload.description;
  const parseConfidence = payload.entry_type === 'rss' ? 0.72 : 0.44;

  return {
    publisher_id: feed.publisher_id,
    canonical_url: canonicalUrl,
    source_url: rawEntry.source_url,
    title,
    subtitle: null,
    author_json: normalizeAuthors(payload.author_names),
    published_at: toNullable(payload.published_at),
    modified_at: toNullable(payload.modified_at),
    article_type: articleType,
    section,
    excerpt: toNullable(excerptSource),
    thumbnail_url: toNullable(payload.thumbnail_url),
    language_code: payload.language_code ?? 'ko',
    hash_title: title === '' ? null : createTitleHash(title),
    status: 'active',
    parse_confidence: parseConfidence
  };
}
