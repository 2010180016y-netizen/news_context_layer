import { describe, expect, it } from 'vitest';

import type { ProfileResponse, ResolveResponse } from '@news-context/shared-types';

import {
  buildBriefingCtaLabel,
  buildPaywallDescription,
  buildPaywallTitle,
  buildResolveRequestFromParsedArticle,
  buildResultHelperText,
  buildStatusBadge,
  buildWatchlistUsageLabel,
  formatAuthorLine,
  hasFounderPass,
  isCurrentClusterSaved
} from '../src/sidepanel/view-model.js';

const baseResponse: ResolveResponse = {
  article_id: 'article-1',
  cluster_id: 'cluster-1',
  context_confidence: 0.67,
  state: 'success_full',
  source_card: {
    title: 'Government reviews semiconductor supply chain',
    publisher_name: 'Yonhap News',
    author_names: ['Minji Kim'],
    published_at: '2026-04-01T01:30:00.000Z',
    modified_at: null,
    article_type: 'news',
    section: 'politics'
  },
  freshness: {
    state: 'fresh',
    message: '이 기사는 현재 이슈의 최신권 기사입니다.',
    newer_article_count: 0,
    latest_article_ts: '2026-04-01T01:30:00.000Z'
  },
  common_signals: {
    entities: ['반도체', '공급망'],
    numbers: ['72시간'],
    confidence: 0.8
  },
  related_articles: [
    {
      article_id: 'related-1',
      url: 'https://example.news/1',
      publisher_name: '중앙일보',
      title: '업계, 반도체 공급망 회의 결과에 촉각',
      published_at: '2026-04-01T02:20:00.000Z',
      summary_line: '회의 후속 조치를 주목하고 있다.',
      score: 0.74
    }
  ],
  ui_hints: {
    show_upgrade_cta: false,
    show_feedback_prompt: true
  },
  disclaimer: 'Context is ranked heuristically from recent related coverage.'
};

const profile: ProfileResponse = {
  anon_id: 'anon-1',
  user_id: null,
  plan: {
    code: 'free',
    status: 'active',
    expires_at: null
  },
  limits: {
    watchlists_max: 1,
    watchlists_used: 1,
    briefing_enabled: false
  }
};

describe('sidepanel view model', () => {
  it('maps parsed article fields into the resolve request payload', () => {
    const payload = buildResolveRequestFromParsedArticle({
      status: 'partial',
      parser_path: 'dom',
      url: 'https://n.news.naver.com/article/032/0003357003',
      canonical_url: 'https://n.news.naver.com/article/032/0003357003',
      title: 'Recovery crews race after flooding',
      publisher_name: 'Kyunghyang Shinmun',
      author_names: ['Reporter Kim', 'Reporter Park'],
      published_at: '2026-04-03T05:40:00.000Z',
      article_type: 'news',
      section: 'society',
      keywords: ['flooding'],
      body_excerpt: 'Recovery crews continue working across damaged districts.',
      correction_note_detected: false,
      parse_confidence: 0.66,
      confidence_bucket: 'low',
      low_confidence: true,
      issues: ['dom_fallback']
    });

    expect(payload).toMatchObject({
      title: 'Recovery crews race after flooding',
      publisher_name: 'Kyunghyang Shinmun',
      article_type: 'news',
      section: 'society',
      parse_confidence: 0.66
    });
  });

  it('builds helper text, save state, and plan usage labels', () => {
    expect(formatAuthorLine(['Minji Kim', 'Jisu Lee', 'Ara Park'])).toBe('Minji Kim 외 2명');
    expect(buildWatchlistUsageLabel(profile)).toBe('저장 1/1');
    expect(buildBriefingCtaLabel(profile)).toBe('브리핑은 Founder Pass에서 열립니다');
    expect(buildPaywallTitle('briefing')).toBe('브리핑까지 이어 보려면');
    expect(buildPaywallDescription('watchlist_limit')).toBe('저장, 브리핑, 더 많은 이슈 추적을 사용하세요.');
    expect(hasFounderPass(profile)).toBe(false);
    expect(
      isCurrentClusterSaved('cluster-1', [
        {
          id: 'watchlist-1',
          cluster_id: 'cluster-1',
          label: '반도체 공급망',
          notifications_enabled: true,
          last_seen_at: '2026-04-01T01:30:00.000Z',
          new_article_count: 1,
          plan_limit_reached: true
        }
      ])
    ).toBe(true);
    expect(
      buildStatusBadge({
        ...baseResponse,
        state: 'low_confidence'
      })
    ).toEqual({
      label: '낮은 확신',
      tone: 'warning'
    });
    expect(
      buildResultHelperText({
        ...baseResponse,
        state: 'insufficient_results'
      })
    ).toBe('관련 기사가 충분하지 않아 현재는 일부만 먼저 보여드리고 있습니다.');
  });
});
