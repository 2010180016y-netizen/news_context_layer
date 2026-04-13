import type { ArticleType, ParseStatus, ParserPath } from '@news-context/shared-types';

import type { ArticleExtractionSnapshot, ParsedFieldName } from '../src/content/types.js';

export interface ParserFixtureExpectation {
  readonly status: ParseStatus;
  readonly parser_path: ParserPath;
  readonly min_confidence: number;
  readonly required_fields: readonly ParsedFieldName[];
  readonly title?: string | undefined;
  readonly publisher_name?: string | undefined;
  readonly published_at?: string | undefined;
  readonly modified_at?: string | undefined;
  readonly article_type?: ArticleType | undefined;
  readonly section?: string | undefined;
  readonly low_confidence?: boolean | undefined;
}

export interface ParserFixtureCase {
  readonly case_id: string;
  readonly snapshot: ArticleExtractionSnapshot;
  readonly expectation: ParserFixtureExpectation;
}

export const parserFixtures: readonly ParserFixtureCase[] = [
  {
    case_id: 'naver-001-jsonld-complete',
    snapshot: {
      url: 'https://n.news.naver.com/article/001/0015324001',
      json_ld_blocks: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: 'Government reviews semiconductor supply chain',
          url: 'https://n.news.naver.com/article/001/0015324001',
          publisher: {
            '@type': 'Organization',
            name: 'Yonhap News'
          },
          author: {
            '@type': 'Person',
            name: 'Minji Kim'
          },
          datePublished: '2026-04-01T10:30:00+09:00',
          dateModified: '2026-04-01T11:00:00+09:00',
          articleSection: 'politics',
          keywords: ['semiconductor', 'supply chain', 'government'],
          description: 'Government reviews supply chain risk mitigation steps.',
          articleBody: 'Government opened a supply chain review meeting and discussed risk mitigation and inventory readiness.'
        })
      ],
      meta: {},
      dom: {
        canonical_candidates: [],
        title_candidates: [],
        publisher_candidates: [],
        author_candidates: [],
        published_at_candidates: [],
        modified_at_candidates: [],
        section_candidates: [],
        keyword_candidates: [],
        body_candidates: [],
        correction_candidates: []
      }
    },
    expectation: {
      status: 'success',
      parser_path: 'jsonld',
      min_confidence: 0.95,
      required_fields: ['title', 'publisher_name', 'author_names', 'published_at', 'modified_at', 'article_type', 'section', 'keywords', 'body_excerpt'],
      title: 'Government reviews semiconductor supply chain',
      publisher_name: 'Yonhap News',
      published_at: '2026-04-01T01:30:00.000Z',
      modified_at: '2026-04-01T02:00:00.000Z',
      article_type: 'news',
      section: 'politics',
      low_confidence: false
    }
  },
  {
    case_id: 'naver-002-meta-fallback',
    snapshot: {
      url: 'https://n.news.naver.com/article/025/0003402002',
      json_ld_blocks: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          publisher: {
            '@type': 'Organization',
            name: 'JoongAng Ilbo'
          }
        })
      ],
      meta: {
        'og:title': 'Exporters brace for foreign-exchange swings',
        'og:url': 'https://n.news.naver.com/article/025/0003402002',
        'og:site_name': 'JoongAng Ilbo',
        'article:published_time': '2026-04-02T09:10:00+09:00',
        'article:section': 'economy',
        keywords: 'fx, export, companies',
        'og:description': 'Exporters review hedging strategies as volatility rises.',
        author: 'Suyeon Lee',
        'article:type': 'analysis'
      },
      dom: {
        canonical_candidates: [],
        title_candidates: [],
        publisher_candidates: [],
        author_candidates: [],
        published_at_candidates: [],
        modified_at_candidates: [],
        section_candidates: [],
        keyword_candidates: [],
        body_candidates: [],
        correction_candidates: []
      }
    },
    expectation: {
      status: 'success',
      parser_path: 'meta',
      min_confidence: 0.82,
      required_fields: ['title', 'publisher_name', 'published_at', 'article_type', 'section', 'body_excerpt'],
      title: 'Exporters brace for foreign-exchange swings',
      publisher_name: 'JoongAng Ilbo',
      published_at: '2026-04-02T00:10:00.000Z',
      article_type: 'analysis',
      section: 'economy',
      low_confidence: false
    }
  },
  {
    case_id: 'naver-003-dom-fallback-partial',
    snapshot: {
      url: 'https://n.news.naver.com/article/032/0003357003',
      json_ld_blocks: [],
      meta: {
        'og:description': 'Recovery crews continue work after heavy rain.'
      },
      dom: {
        canonical_candidates: ['https://n.news.naver.com/article/032/0003357003'],
        title_candidates: ['Recovery crews race after flooding'],
        publisher_candidates: ['Kyunghyang Shinmun'],
        author_candidates: [],
        published_at_candidates: ['2026-04-03T14:40:00+09:00'],
        modified_at_candidates: [],
        section_candidates: ['society'],
        keyword_candidates: [],
        body_candidates: ['Recovery crews and equipment continue working across damaged districts after the storm.'],
        correction_candidates: []
      }
    },
    expectation: {
      status: 'partial',
      parser_path: 'dom',
      min_confidence: 0.64,
      required_fields: ['title', 'publisher_name', 'published_at', 'body_excerpt'],
      title: 'Recovery crews race after flooding',
      publisher_name: 'Kyunghyang Shinmun',
      published_at: '2026-04-03T05:40:00.000Z',
      article_type: 'news',
      section: 'society',
      low_confidence: true
    }
  },
  {
    case_id: 'naver-004-multiple-authors',
    snapshot: {
      url: 'https://n.news.naver.com/article/028/0002759004',
      json_ld_blocks: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'AnalysisNewsArticle',
              headline: 'AI chip investment signals ecosystem shift',
              mainEntityOfPage: {
                '@id': 'https://n.news.naver.com/article/028/0002759004'
              },
              publisher: {
                '@type': 'Organization',
                name: 'Hankyoreh'
              },
              author: [
                { '@type': 'Person', name: 'Jungeun Park' },
                { '@type': 'Person', name: 'Yunseo Choi' },
                { '@type': 'Person', name: 'Dohyeon Jeong' }
              ],
              datePublished: '2026-04-04T08:20:00+09:00',
              dateModified: '2026-04-04T09:05:00+09:00',
              articleSection: 'technology',
              keywords: ['ai', 'chip', 'investment'],
              articleBody: 'Domestic AI chip investment is reshaping packaging, design, and materials players.'
            }
          ]
        })
      ],
      meta: {},
      dom: {
        canonical_candidates: [],
        title_candidates: [],
        publisher_candidates: [],
        author_candidates: [],
        published_at_candidates: [],
        modified_at_candidates: [],
        section_candidates: [],
        keyword_candidates: [],
        body_candidates: [],
        correction_candidates: []
      }
    },
    expectation: {
      status: 'success',
      parser_path: 'jsonld',
      min_confidence: 0.93,
      required_fields: ['title', 'publisher_name', 'author_names', 'published_at', 'article_type', 'section', 'keywords', 'body_excerpt'],
      title: 'AI chip investment signals ecosystem shift',
      publisher_name: 'Hankyoreh',
      published_at: '2026-04-03T23:20:00.000Z',
      modified_at: '2026-04-04T00:05:00.000Z',
      article_type: 'analysis',
      section: 'technology',
      low_confidence: false
    }
  },
  {
    case_id: 'naver-005-unsupported-title-missing',
    snapshot: {
      url: 'https://n.news.naver.com/article/023/0003888005',
      json_ld_blocks: [],
      meta: {
        'og:description': 'Layout regression without a title should fail safely.'
      },
      dom: {
        canonical_candidates: ['https://n.news.naver.com/article/023/0003888005'],
        title_candidates: [],
        publisher_candidates: ['Chosun Ilbo'],
        author_candidates: ['Reporter Kim'],
        published_at_candidates: ['2026-04-04T11:10:00+09:00'],
        modified_at_candidates: [],
        section_candidates: ['politics'],
        keyword_candidates: [],
        body_candidates: ['A broken layout omitted the headline and should be treated as unsupported.'],
        correction_candidates: []
      }
    },
    expectation: {
      status: 'unsupported',
      parser_path: 'dom',
      min_confidence: 0,
      required_fields: [],
      low_confidence: true
    }
  },
  {
    case_id: 'naver-006-modified-before-published',
    snapshot: {
      url: 'https://n.news.naver.com/article/421/0007489006',
      json_ld_blocks: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: 'Safe-haven demand rises after overseas market swings',
          url: 'https://n.news.naver.com/article/421/0007489006',
          publisher: {
            '@type': 'Organization',
            name: 'News1'
          },
          author: {
            '@type': 'Person',
            name: 'Jihoo Seo'
          },
          datePublished: '2026-04-04T18:00:00+09:00',
          dateModified: '2026-04-04T17:55:00+09:00',
          articleSection: 'world',
          keywords: ['market', 'safe haven', 'rates'],
          description: 'Investors return to safe-haven assets after volatile trading.'
        })
      ],
      meta: {},
      dom: {
        canonical_candidates: [],
        title_candidates: [],
        publisher_candidates: [],
        author_candidates: [],
        published_at_candidates: [],
        modified_at_candidates: [],
        section_candidates: [],
        keyword_candidates: [],
        body_candidates: [],
        correction_candidates: ['Updated 5 minutes before the published timestamp due to feed anomaly.']
      }
    },
    expectation: {
      status: 'partial',
      parser_path: 'jsonld',
      min_confidence: 0.6,
      required_fields: ['title', 'publisher_name', 'published_at', 'modified_at', 'section', 'body_excerpt'],
      title: 'Safe-haven demand rises after overseas market swings',
      publisher_name: 'News1',
      published_at: '2026-04-04T09:00:00.000Z',
      modified_at: '2026-04-04T08:55:00.000Z',
      article_type: 'news',
      section: 'world',
      low_confidence: true
    }
  }
];
