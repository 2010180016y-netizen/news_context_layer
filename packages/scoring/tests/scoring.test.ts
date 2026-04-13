import { describe, expect, it } from 'vitest';

import type { ResolveRequest, ResolvedArticleFeatureView } from '@news-context/shared-types';

import { buildArticleFeatures, buildRequestFeatures, scoreCandidate } from '../src/index.js';

function createCandidate(
  overrides: Partial<ResolvedArticleFeatureView>
): ResolvedArticleFeatureView {
  const article = {
    id: 'article-1',
    publisher_id: 'publisher-1',
    canonical_url: 'https://example.com/articles/1',
    source_url: 'https://example.com/articles/1',
    title: 'Government expands semiconductor supply chain review',
    subtitle: null,
    author_json: ['Minji Kim'],
    published_at: '2026-04-01T01:40:00.000Z',
    modified_at: null,
    article_type: 'news' as const,
    section: 'politics',
    excerpt: 'Officials expanded the semiconductor supply chain review after a cabinet meeting.',
    thumbnail_url: null,
    language_code: 'ko',
    hash_title: 'hash-1',
    status: 'active' as const,
    parse_confidence: 0.92,
    created_at: '2026-04-01T01:40:00.000Z',
    updated_at: '2026-04-01T01:40:00.000Z'
  };
  const feature = {
    ...buildArticleFeatures({
      title: article.title,
      publisher_name: 'Yonhap News',
      author_names: article.author_json,
      published_at: article.published_at,
      modified_at: article.modified_at,
      article_type: article.article_type,
      section: article.section,
      keywords: ['semiconductor', 'supply chain', 'government'],
      excerpt: article.excerpt
    }),
    article_id: article.id
  };

  return {
    article,
    feature,
    publisher_name: 'Yonhap News',
    ...overrides
  };
}

describe('scoring package', () => {
  it('builds stable article features from title, keywords, and excerpt', () => {
    const feature = buildArticleFeatures({
      title: 'Government reviews semiconductor supply chain',
      publisher_name: 'Yonhap News',
      author_names: ['Minji Kim'],
      published_at: '2026-04-01T01:30:00.000Z',
      modified_at: null,
      article_type: 'news',
      section: 'politics',
      keywords: ['semiconductor', 'supply chain'],
      excerpt: 'Government opened a review meeting and discussed supply chain risk.'
    });

    expect(feature.title_tokens).toEqual(
      expect.arrayContaining(['government', 'reviews', 'semiconductor', 'supply', 'chain'])
    );
    expect(feature.keywords_json).toEqual(expect.arrayContaining(['semiconductor', 'supply', 'chain']));
    expect(feature.embedding).not.toBeNull();
  });

  it('scores a relevant candidate above a distractor', () => {
    const request: ResolveRequest = {
      url: 'https://n.news.naver.com/article/001/0015324001',
      canonical_url: 'https://n.news.naver.com/article/001/0015324001',
      title: 'Government reviews semiconductor supply chain',
      publisher_name: 'Yonhap News',
      author_names: ['Minji Kim'],
      published_at: '2026-04-01T01:30:00.000Z',
      article_type: 'news',
      section: 'politics',
      keywords: ['semiconductor', 'supply chain', 'government'],
      body_excerpt: 'Government opened a supply chain review meeting.',
      correction_note_detected: false,
      parse_confidence: 0.97,
      page_lang: 'ko'
    };
    const sourceFeature = buildRequestFeatures(request);
    const relevantCandidate = createCandidate({});
    const distractorCandidate = createCandidate({
      article: {
        ...createCandidate({}).article,
        id: 'article-2',
        canonical_url: 'https://example.com/articles/2',
        source_url: 'https://example.com/articles/2',
        title: 'Automakers prepare for electric vehicle subsidy revision',
        section: 'economy',
        excerpt: 'Car makers are watching the new electric vehicle subsidy plan.',
        hash_title: 'hash-2'
      },
      feature: {
        ...buildArticleFeatures({
          title: 'Automakers prepare for electric vehicle subsidy revision',
          publisher_name: 'Chosun Ilbo',
          author_names: ['Reporter Lee'],
          published_at: '2026-04-01T01:30:00.000Z',
          modified_at: null,
          article_type: 'news',
          section: 'economy',
          keywords: ['automakers', 'electric vehicle', 'subsidy'],
          excerpt: 'Car makers are watching the new subsidy plan.'
        }),
        article_id: 'article-2'
      },
      publisher_name: 'Chosun Ilbo'
    });

    const relevantScore = scoreCandidate(request, sourceFeature, relevantCandidate);
    const distractorScore = scoreCandidate(request, sourceFeature, distractorCandidate);

    expect(relevantScore.final_score).toBeGreaterThan(distractorScore.final_score);
    expect(relevantScore.lexical_title_similarity).toBeGreaterThan(0);
  });
});
