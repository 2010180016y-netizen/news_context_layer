import { describe, expect, it } from 'vitest';

import {
  createBriefingRecoveryCopy,
  createDefaultPreferences,
  createErrorCopy,
  createUnsupportedCopy
} from '../src/sidepanel/state.js';
import { resolveInitialRoute } from '../src/sidepanel/routes.js';

describe('sidepanel state helpers', () => {
  it('starts at onboarding until preferences are completed', () => {
    expect(resolveInitialRoute(false)).toBe('onboarding');
    expect(resolveInitialRoute(true)).toBe('loading');
    expect(createDefaultPreferences()).toEqual({
      analyticsOptIn: false,
      onboardingCompleted: false
    });
  });

  it('returns honest unsupported-page recovery actions for non-supported tabs', () => {
    expect(
      createUnsupportedCopy(
        {
          tabId: 7,
          url: 'https://example.com/article/1',
          supported: false
        },
        null
      )
    ).toEqual({
      title: '현재 페이지는 아직 바로 비교할 수 없습니다.',
      description:
        '네이버 뉴스 기사 페이지에서 다시 열면 비교 결과를 바로 보여드릴 수 있습니다.',
      primaryAction: {
        type: 'open_supported_page',
        label: '네이버 뉴스 홈 열기'
      },
      secondaryAction: {
        type: 'retry',
        label: '현재 탭 다시 확인'
      }
    });
  });

  it('distinguishes empty-document parser failures and timeout errors', () => {
    expect(
      createUnsupportedCopy(
        {
          tabId: 7,
          url: 'https://n.news.naver.com/article/001/0019999999',
          supported: true
        },
        {
          status: 'unsupported',
          parser_path: 'dom',
          url: 'https://n.news.naver.com/article/001/0019999999',
          parse_confidence: 0,
          confidence_bucket: 'low',
          low_confidence: true,
          issues: ['empty_snapshot'],
          failure_reason: 'empty_document'
        }
      )
    ).toEqual({
      title: '기사 정보가 비어 있어 비교를 만들지 못했습니다.',
      description:
        '페이지는 열렸지만 제목이나 본문 단서를 읽지 못해 이번에는 컨텍스트를 만들지 못했습니다.',
      primaryAction: {
        type: 'retry',
        label: '다시 시도'
      },
      secondaryAction: {
        type: 'open_supported_page',
        label: '네이버 뉴스 홈 열기'
      }
    });

    expect(createErrorCopy('Request timeout while waiting for resolve API.')).toEqual({
      title: '응답 시간이 길어져 비교를 잠시 멈췄습니다.',
      description: 'Request timeout while waiting for resolve API.',
      primaryAction: {
        type: 'retry',
        label: '다시 시도'
      }
    });
  });

  it('creates a retry-first briefing recovery message for failed loads', () => {
    expect(createBriefingRecoveryCopy('Network timeout while loading briefing.')).toEqual({
      title: '오늘 브리핑을 잠시 불러오지 못했습니다.',
      description: '잠시 후 다시 시도하고, 같은 문제가 반복되면 문의 경로로 이어 주세요.',
      retryLabel: '브리핑 다시 불러오기'
    });
  });
});
