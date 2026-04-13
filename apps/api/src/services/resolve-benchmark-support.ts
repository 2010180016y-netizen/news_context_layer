import { createHash, randomUUID } from 'node:crypto';

import type { ResolveBenchmarkCase } from '@news-context/shared-types';

import type { FileNewsContextStore } from '../repositories/file-store.js';

function createTitleHash(title: string): string {
  return createHash('sha256')
    .update(title.trim().toLowerCase().replace(/\s+/g, ' '))
    .digest('hex');
}

export async function appendResolveBenchmarkCaseCandidates(
  store: FileNewsContextStore,
  benchmarkCase: ResolveBenchmarkCase
): Promise<void> {
  await store.writeState((state) => {
    const nowIso = new Date().toISOString();
    const publisherIds = new Map(state.publishers.map((publisher) => [publisher.name, publisher.id]));
    const requestPublisherName = benchmarkCase.request.publisher_name;

    if (requestPublisherName !== undefined && !publisherIds.has(requestPublisherName)) {
      const requestPublisherId = randomUUID();
      publisherIds.set(requestPublisherName, requestPublisherId);
      state.publishers.push({
        id: requestPublisherId,
        name: requestPublisherName,
        domain: new URL(benchmarkCase.request.url).hostname,
        is_active: true,
        rss_supported: true,
        notes: 'benchmark-request-seeded',
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    for (const candidate of benchmarkCase.candidate_pool) {
      const publisherName = candidate.publisher_name;
      const publisherId = publisherIds.get(publisherName) ?? randomUUID();

      if (!publisherIds.has(publisherName)) {
        publisherIds.set(publisherName, publisherId);
        state.publishers.push({
          id: publisherId,
          name: publisherName,
          domain: new URL(candidate.url).hostname,
          is_active: true,
          rss_supported: true,
          notes: 'benchmark-seeded',
          created_at: nowIso,
          updated_at: nowIso
        });
      }

      const existingArticle = state.canonical_articles.find((article) => article.id === candidate.article_id);

      if (existingArticle !== undefined) {
        existingArticle.publisher_id = publisherId;
        existingArticle.canonical_url = candidate.url;
        existingArticle.source_url = candidate.url;
        existingArticle.title = candidate.title;
        existingArticle.published_at = candidate.published_at ?? null;
        existingArticle.section = benchmarkCase.request.section ?? null;
        existingArticle.article_type = benchmarkCase.request.article_type ?? 'news';
        existingArticle.excerpt = candidate.summary_line ?? null;
        existingArticle.hash_title = createTitleHash(candidate.title);
        existingArticle.updated_at = nowIso;
        continue;
      }

      state.canonical_articles.push({
        id: candidate.article_id,
        publisher_id: publisherId,
        canonical_url: candidate.url,
        source_url: candidate.url,
        title: candidate.title,
        subtitle: null,
        author_json: [],
        published_at: candidate.published_at ?? null,
        modified_at: null,
        article_type: benchmarkCase.request.article_type ?? 'news',
        section: benchmarkCase.request.section ?? null,
        excerpt: candidate.summary_line ?? null,
        thumbnail_url: null,
        language_code: benchmarkCase.request.page_lang ?? 'ko',
        hash_title: createTitleHash(candidate.title),
        status: 'active',
        parse_confidence: 0.8,
        created_at: nowIso,
        updated_at: nowIso
      });
    }
  });
}

export async function seedResolveBenchmarkCase(
  store: FileNewsContextStore,
  benchmarkCase: ResolveBenchmarkCase
): Promise<void> {
  await store.writeState((state) => {
    state.publishers = [];
    state.canonical_articles = [];
    state.article_features = [];
    state.story_clusters = [];
    state.cluster_members = [];
  });

  await appendResolveBenchmarkCaseCandidates(store, benchmarkCase);
}
