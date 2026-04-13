import { randomUUID } from 'node:crypto';

import type {
  ArticleVersionRecord,
  CanonicalArticleRecord,
  CanonicalArticleRepositoryPort,
  CanonicalArticleUpsertSummary,
  NormalizedArticleInput
} from '@news-context/shared-types';

import type { FileNewsContextStore } from './file-store.js';

function sameTimestamp(left: string | null, right: string | null): boolean {
  return left === right;
}

function sameAuthors(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function hasArticleChanged(existing: CanonicalArticleRecord, incoming: NormalizedArticleInput): boolean {
  return !(
    existing.canonical_url === incoming.canonical_url &&
    existing.source_url === incoming.source_url &&
    existing.title === incoming.title &&
    existing.subtitle === incoming.subtitle &&
    sameAuthors(existing.author_json, incoming.author_json) &&
    sameTimestamp(existing.published_at, incoming.published_at) &&
    sameTimestamp(existing.modified_at, incoming.modified_at) &&
    existing.article_type === incoming.article_type &&
    existing.section === incoming.section &&
    existing.excerpt === incoming.excerpt &&
    existing.thumbnail_url === incoming.thumbnail_url &&
    existing.language_code === incoming.language_code &&
    existing.hash_title === incoming.hash_title &&
    existing.status === incoming.status &&
    existing.parse_confidence === incoming.parse_confidence
  );
}

function matchesFallbackIdentity(existing: CanonicalArticleRecord, incoming: NormalizedArticleInput): boolean {
  return (
    existing.publisher_id === incoming.publisher_id &&
    existing.hash_title !== null &&
    incoming.hash_title !== null &&
    existing.hash_title === incoming.hash_title &&
    existing.published_at === incoming.published_at
  );
}

function selectModifiedAt(existing: string | null, incoming: string | null): string | null {
  if (existing === null) {
    return incoming;
  }

  if (incoming === null) {
    return existing;
  }

  return Date.parse(incoming) > Date.parse(existing) ? incoming : existing;
}

function mergeIncomingArticle(
  existing: CanonicalArticleRecord,
  incoming: NormalizedArticleInput
): NormalizedArticleInput {
  return {
    publisher_id: incoming.publisher_id ?? existing.publisher_id,
    canonical_url: incoming.canonical_url,
    source_url: incoming.source_url,
    title: incoming.title === '' ? existing.title : incoming.title,
    subtitle: incoming.subtitle ?? existing.subtitle,
    author_json: incoming.author_json.length > 0 ? [...incoming.author_json] : [...existing.author_json],
    published_at: existing.published_at ?? incoming.published_at,
    modified_at: selectModifiedAt(existing.modified_at, incoming.modified_at),
    article_type: incoming.article_type === 'unknown' ? existing.article_type : incoming.article_type,
    section: incoming.section ?? existing.section,
    excerpt: incoming.excerpt ?? existing.excerpt,
    thumbnail_url: incoming.thumbnail_url ?? existing.thumbnail_url,
    language_code: incoming.language_code,
    hash_title: incoming.hash_title ?? existing.hash_title,
    status: incoming.status,
    parse_confidence:
      incoming.parse_confidence === null
        ? existing.parse_confidence
        : Math.max(existing.parse_confidence ?? 0, incoming.parse_confidence)
  };
}

export class ArticleRepository implements CanonicalArticleRepositoryPort {
  public constructor(private readonly store: FileNewsContextStore) {}

  public async upsertArticle(
    input: NormalizedArticleInput,
    changeReason: string
  ): Promise<CanonicalArticleUpsertSummary> {
    return this.store.writeState((state) => {
      const nowIso = new Date().toISOString();
      const existingArticle =
        state.canonical_articles.find((article) => article.canonical_url === input.canonical_url) ??
        state.canonical_articles.find((article) => matchesFallbackIdentity(article, input));

      if (existingArticle === undefined) {
        const createdArticle: CanonicalArticleRecord = {
          id: randomUUID(),
          publisher_id: input.publisher_id,
          canonical_url: input.canonical_url,
          source_url: input.source_url,
          title: input.title,
          subtitle: input.subtitle,
          author_json: [...input.author_json],
          published_at: input.published_at,
          modified_at: input.modified_at,
          article_type: input.article_type,
          section: input.section,
          excerpt: input.excerpt,
          thumbnail_url: input.thumbnail_url,
          language_code: input.language_code,
          hash_title: input.hash_title,
          status: input.status,
          parse_confidence: input.parse_confidence,
          created_at: nowIso,
          updated_at: nowIso
        };
        state.canonical_articles.push(createdArticle);

        state.article_versions.push({
          id: randomUUID(),
          article_id: createdArticle.id,
          version_no: 1,
          title: createdArticle.title,
          excerpt: createdArticle.excerpt,
          published_at: createdArticle.published_at,
          modified_at: createdArticle.modified_at,
          change_reason: changeReason,
          captured_at: nowIso,
          created_at: nowIso
        } satisfies ArticleVersionRecord);

        return {
          article: createdArticle,
          inserted: true,
          version_created: true
        } satisfies CanonicalArticleUpsertSummary;
      }

      const mergedInput = mergeIncomingArticle(existingArticle, input);
      const changed = hasArticleChanged(existingArticle, mergedInput);

      if (changed) {
        existingArticle.publisher_id = mergedInput.publisher_id;
        existingArticle.canonical_url = mergedInput.canonical_url;
        existingArticle.source_url = mergedInput.source_url;
        existingArticle.title = mergedInput.title;
        existingArticle.subtitle = mergedInput.subtitle;
        existingArticle.author_json = [...mergedInput.author_json];
        existingArticle.published_at = mergedInput.published_at;
        existingArticle.modified_at = mergedInput.modified_at;
        existingArticle.article_type = mergedInput.article_type;
        existingArticle.section = mergedInput.section;
        existingArticle.excerpt = mergedInput.excerpt;
        existingArticle.thumbnail_url = mergedInput.thumbnail_url;
        existingArticle.language_code = mergedInput.language_code;
        existingArticle.hash_title = mergedInput.hash_title;
        existingArticle.status = mergedInput.status;
        existingArticle.parse_confidence = mergedInput.parse_confidence;
        existingArticle.updated_at = nowIso;

        const nextVersion =
          state.article_versions
            .filter((version) => version.article_id === existingArticle.id)
            .reduce((maxVersion, version) => Math.max(maxVersion, version.version_no), 0) + 1;

        state.article_versions.push({
          id: randomUUID(),
          article_id: existingArticle.id,
          version_no: nextVersion,
          title: existingArticle.title,
          excerpt: existingArticle.excerpt,
          published_at: existingArticle.published_at,
          modified_at: existingArticle.modified_at,
          change_reason: changeReason,
          captured_at: nowIso,
          created_at: nowIso
        } satisfies ArticleVersionRecord);
      }

      return {
        article: existingArticle,
        inserted: false,
        version_created: changed
      } satisfies CanonicalArticleUpsertSummary;
    });
  }
}
