import type {
  BriefingResponse,
  DeviceIdentity,
  PaywallTriggerType,
  ProfileResponse,
  ResolveResponse,
  WatchlistItem
} from '@news-context/shared-types';

import type { ArticleParseResult, ParsedArticle } from '../content/types.js';
import type { PanelTabContext } from '../lib/messages.js';

import type { PanelRoute } from './routes.js';

export interface SidePanelPreferences {
  readonly analyticsOptIn: boolean;
  readonly onboardingCompleted: boolean;
  readonly apiBaseUrl?: string;
}

export type BlockedViewActionType = 'retry' | 'open_supported_page';

export interface BlockedViewAction {
  readonly type: BlockedViewActionType;
  readonly label: string;
}

export interface UnsupportedViewCopy {
  readonly title: string;
  readonly description: string;
  readonly primaryAction: BlockedViewAction;
  readonly secondaryAction?: BlockedViewAction;
}

export interface ErrorViewCopy {
  readonly title: string;
  readonly description: string;
  readonly primaryAction: BlockedViewAction;
}

export interface BriefingRecoveryCopy {
  readonly title: string;
  readonly description: string;
  readonly retryLabel: string;
}

export interface SidePanelState {
  readonly route: PanelRoute;
  readonly preferences: SidePanelPreferences;
  readonly identity: DeviceIdentity | null;
  readonly context: PanelTabContext | null;
  readonly parsedArticle: ParsedArticle | null;
  readonly resolveResponse: ResolveResponse | null;
  readonly profile: ProfileResponse | null;
  readonly watchlists: readonly WatchlistItem[];
  readonly briefing: BriefingResponse | null;
  readonly briefingLoading: boolean;
  readonly briefingError: string | null;
  readonly collectionsLoading: boolean;
  readonly actionInFlight: boolean;
  readonly checkoutPending: boolean;
  readonly unsupportedCopy: UnsupportedViewCopy | null;
  readonly errorCopy: ErrorViewCopy | null;
  readonly noticeMessage: string | null;
  readonly paywallMessage: string | null;
  readonly paywallTrigger: PaywallTriggerType | null;
}

export function createDefaultPreferences(): SidePanelPreferences {
  return {
    analyticsOptIn: false,
    onboardingCompleted: false
  };
}

export function createInitialSidePanelState(
  route: PanelRoute,
  preferences: SidePanelPreferences
): SidePanelState {
  return {
    route,
    preferences,
    identity: null,
    context: null,
    parsedArticle: null,
    resolveResponse: null,
    profile: null,
    watchlists: [],
    briefing: null,
    briefingLoading: false,
    briefingError: null,
    collectionsLoading: false,
    actionInFlight: false,
    checkoutPending: false,
    unsupportedCopy: null,
    errorCopy: null,
    noticeMessage: null,
    paywallMessage: null,
    paywallTrigger: null
  };
}

export function createUnsupportedCopy(
  context: PanelTabContext | null,
  article: ArticleParseResult | null
): UnsupportedViewCopy {
  if (context === null || context.tabId === null) {
    return {
      title: '현재 기사 탭에서 다시 열어 주세요.',
      description:
        '브라우저 액션 버튼을 눌러 현재 보고 있는 기사 탭에서 다시 시작해 주세요.',
      primaryAction: {
        type: 'retry',
        label: '다시 시도'
      }
    };
  }

  if (!context.supported) {
    return {
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
    };
  }

  if (article?.status === 'unsupported') {
    if (article.failure_reason === 'empty_document') {
      return {
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
      };
    }

    return {
      title: '기사 정보를 충분히 읽지 못했습니다.',
      description:
        '페이지 구조가 달라졌거나 기사 메타데이터가 부족해 이번에는 비교를 만들지 못했습니다.',
      primaryAction: {
        type: 'retry',
        label: '다시 시도'
      },
      secondaryAction: {
        type: 'open_supported_page',
        label: '네이버 뉴스 홈 열기'
      }
    };
  }

  return {
    title: '관련 기사를 충분히 찾지 못했습니다.',
    description:
      '잠시 후 다시 시도하면 더 많은 같은 이슈 보도를 찾을 수 있을 수 있습니다.',
    primaryAction: {
      type: 'retry',
      label: '다시 시도'
    },
    secondaryAction: {
      type: 'open_supported_page',
      label: '네이버 뉴스 홈 열기'
    }
  };
}

export function createErrorCopy(message?: string): ErrorViewCopy {
  if (message !== undefined) {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('timeout') || normalizedMessage.includes('시간')) {
      return {
        title: '응답 시간이 길어져 비교를 잠시 멈췄습니다.',
        description: message,
        primaryAction: {
          type: 'retry',
          label: '다시 시도'
        }
      };
    }

    if (
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('fetch') ||
      normalizedMessage.includes('server unavailable') ||
      normalizedMessage.includes('resolve api failed') ||
      normalizedMessage.includes('profile api failed')
    ) {
      return {
        title: '서버에 연결하지 못했습니다.',
        description: message,
        primaryAction: {
          type: 'retry',
          label: '다시 시도'
        }
      };
    }
  }

  return {
    title: '잠시 후 다시 시도해 주세요.',
    description:
      message ??
      '네트워크 또는 서버 응답 문제로 현재 기사 컨텍스트를 불러오지 못했습니다.',
    primaryAction: {
      type: 'retry',
      label: '다시 시도'
    }
  };
}

export function createBriefingRecoveryCopy(message?: string): BriefingRecoveryCopy {
  if (message !== undefined) {
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('timeout') ||
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('fetch') ||
      normalizedMessage.includes('시간')
    ) {
      return {
        title: '오늘 브리핑을 잠시 불러오지 못했습니다.',
        description:
          '잠시 후 다시 시도하고, 같은 문제가 반복되면 문의 경로로 이어 주세요.',
        retryLabel: '브리핑 다시 불러오기'
      };
    }
  }

  return {
    title: '브리핑을 불러오지 못했습니다.',
    description:
      '잠시 후 다시 시도하고, 계속 어려우면 문의 경로를 통해 알려 주세요.',
    retryLabel: '브리핑 다시 불러오기'
  };
}
