import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BriefingResponse, DeviceIdentity } from '@news-context/shared-types';

import type { NewsContextApiClient } from '../src/sidepanel/api-client.js';
import {
  buildArticleParseEventBundle,
  buildPanelOpenedEventProps,
  loadBriefing,
  readCheckoutReturnFromUrl,
  readCheckoutReturnFromWindowMessage,
  resolvePanelApiBaseUrl,
  resolvePanelApiOrigin,
  trackAnalyticsEvent
} from '../src/sidepanel/hooks.js';
import type { SidePanelPreferences } from '../src/sidepanel/state.js';

const identity: DeviceIdentity = {
  anon_id: 'anon-analytics',
  device_id: 'device-analytics'
};

type GlobalWithBrowserStubs = typeof globalThis & {
  chrome?: {
    runtime: {
      getManifest: () => {
        version: string;
      };
    };
  };
  navigator?: {
    language: string;
  };
  __NEWS_CONTEXT_CONFIG__?: {
    apiBaseUrl?: string;
    releaseChannel?: string;
  };
};

const browserGlobals = globalThis as GlobalWithBrowserStubs;
const originalChrome = browserGlobals.chrome;
const originalNavigator = browserGlobals.navigator;
const originalRuntimeConfig = browserGlobals.__NEWS_CONTEXT_CONFIG__;

function createClientSpy(): {
  readonly client: NewsContextApiClient;
  readonly getBriefing: ReturnType<typeof vi.fn>;
  readonly ingestEvent: ReturnType<typeof vi.fn>;
} {
  const getBriefing = vi.fn<NewsContextApiClient['getBriefing']>().mockResolvedValue({
    date: '2026-04-10',
    items: []
  } satisfies BriefingResponse);
  const ingestEvent = vi.fn<NewsContextApiClient['ingestEvent']>().mockResolvedValue(undefined);

  return {
    client: {
      resolvePageContext: vi.fn(),
      getProfile: vi.fn(),
      getBriefing,
      createCheckoutSession: vi.fn(),
      listWatchlists: vi.fn(),
      createWatchlist: vi.fn(),
      updateWatchlist: vi.fn(),
      deleteWatchlist: vi.fn(),
      ingestEvent
    },
    getBriefing,
    ingestEvent
  };
}

function createPreferences(analyticsOptIn: boolean): SidePanelPreferences {
  return {
    analyticsOptIn,
    onboardingCompleted: true
  };
}

function installBrowserStubs(): void {
  Object.defineProperty(browserGlobals, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        getManifest: () => ({
          version: '0.1.0'
        })
      }
    }
  });

  Object.defineProperty(browserGlobals, 'navigator', {
    configurable: true,
    value: {
      language: 'ko-KR'
    }
  });
}

afterEach(() => {
  vi.restoreAllMocks();

  Object.defineProperty(browserGlobals, 'chrome', {
    configurable: true,
    value: originalChrome
  });

  Object.defineProperty(browserGlobals, 'navigator', {
    configurable: true,
    value: originalNavigator
  });

  if (originalRuntimeConfig === undefined) {
    delete browserGlobals.__NEWS_CONTEXT_CONFIG__;
    return;
  }

  Object.defineProperty(browserGlobals, '__NEWS_CONTEXT_CONFIG__', {
    configurable: true,
    value: originalRuntimeConfig
  });
});

describe('trackAnalyticsEvent', () => {
  it('loads daily briefing data through the API client wrapper', async () => {
    const { client, getBriefing } = createClientSpy();
    const briefing = await loadBriefing(client, identity, {
      date: '2026-04-10'
    });

    expect(briefing).toEqual({
      date: '2026-04-10',
      items: []
    });
    expect(getBriefing).toHaveBeenCalledWith(identity, {
      date: '2026-04-10'
    });
  });

  it('does not send analytics events when the user has not opted in', async () => {
    const { client, ingestEvent } = createClientSpy();

    await trackAnalyticsEvent(
      client,
      createPreferences(false),
      identity,
      'panel_opened',
      {
        page_domain: 'n.news.naver.com'
      }
    );

    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it('sends tracked events with consent metadata when the user opts in', async () => {
    const { client, ingestEvent } = createClientSpy();
    installBrowserStubs();

    await trackAnalyticsEvent(
      client,
      createPreferences(true),
      identity,
      'context_loaded',
      {
        cluster_id: 'cluster-1',
        related_count: 3
      }
    );

    expect(ingestEvent).toHaveBeenCalledTimes(1);
    const firstCall = ingestEvent.mock.calls[0] as Parameters<
      NewsContextApiClient['ingestEvent']
    > | undefined;

    if (firstCall === undefined) {
      throw new Error('Expected ingestEvent to be called once.');
    }

    const [receivedIdentity, payload] = firstCall;

    expect(receivedIdentity).toEqual(identity);
    expect(payload).toMatchObject({
      anon_id: 'anon-analytics',
      event_name: 'context_loaded',
      event_props: {
        cluster_id: 'cluster-1',
        related_count: 3,
        app_version: '0.1.0',
        consent_version: '2026-04-10',
        locale: 'ko-KR'
      }
    });
    expect(typeof payload.ts).toBe('string');
  });

  it('hashes the current page url for panel-open analytics instead of sending the raw url', async () => {
    const eventProps = await buildPanelOpenedEventProps({
      url: 'https://n.news.naver.com/article/001/0015324001?from=home',
      supported: true
    });

    expect(eventProps).toMatchObject({
      page_domain: 'n.news.naver.com',
      page_type_guess: 'news_article'
    });
    expect(typeof eventProps['page_url_hash']).toBe('string');
    expect(eventProps['page_url_hash']).not.toBe(
      'https://n.news.naver.com/article/001/0015324001?from=home'
    );
  });

  it('builds both article_parsed and parse_failure payloads for unsupported pages', async () => {
    const eventBundle = await buildArticleParseEventBundle(
      {
        url: 'https://www.example.com/story',
        supported: false
      },
      null
    );

    expect(eventBundle.articleParsedProps).toMatchObject({
      parse_success: false,
      parser_source: 'tab_context',
      supported_page: false,
      failure_reason: 'unsupported_host',
      failure_stage: 'tab_context'
    });
    expect(eventBundle.parseFailureProps).toMatchObject({
      failure_reason: 'unsupported_host',
      failure_stage: 'tab_context',
      issues: ['unsupported_host']
    });
  });

  it('builds parse_failure payloads for extractor-level unsupported results', async () => {
    const eventBundle = await buildArticleParseEventBundle(
      {
        url: 'https://n.news.naver.com/article/001/0015324001',
        supported: true
      },
      {
        status: 'unsupported',
        parser_path: 'dom',
        url: 'https://n.news.naver.com/article/001/0015324001',
        parse_confidence: 0,
        confidence_bucket: 'low',
        low_confidence: true,
        issues: ['missing_title'],
        failure_reason: 'missing_title'
      }
    );

    expect(eventBundle.articleParsedProps).toMatchObject({
      parse_success: false,
      parser_source: 'dom',
      supported_page: true,
      failure_reason: 'missing_title',
      failure_stage: 'content_parse'
    });
    expect(eventBundle.parseFailureProps).toMatchObject({
      parser_source: 'dom',
      supported_page: true,
      failure_reason: 'missing_title',
      failure_stage: 'content_parse',
      issues: ['missing_title']
    });
  });

  it('parses checkout return parameters from the redirected extension url', () => {
    expect(
      readCheckoutReturnFromUrl(
        'chrome-extension://test-extension/sidepanel/index.html?checkout_result=success&checkout_session_id=session-1&checkout_plan_code=founder_pass&checkout_provider=mock_founder_pass'
      )
    ).toEqual({
      result: 'success',
      session_id: 'session-1',
      plan_code: 'founder_pass',
      provider: 'mock_founder_pass'
    });
  });

  it('parses checkout return messages sent from the hosted return bridge', () => {
    expect(
      readCheckoutReturnFromWindowMessage({
        type: 'news-context-checkout-return',
        signal: {
          result: 'cancel',
          session_id: 'session-2',
          plan_code: 'founder_pass',
          provider: 'mock_founder_pass'
        }
      })
    ).toEqual({
      result: 'cancel',
      session_id: 'session-2',
      plan_code: 'founder_pass',
      provider: 'mock_founder_pass'
    });
  });

  it('resolves the API base url and origin from runtime config when preferences do not override it', () => {
    Object.defineProperty(browserGlobals, '__NEWS_CONTEXT_CONFIG__', {
      configurable: true,
      value: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com/base'
      }
    });

    expect(resolvePanelApiBaseUrl(createPreferences(true))).toBe(
      'https://staging-api.newscontext.example.com/base'
    );
    expect(resolvePanelApiOrigin(createPreferences(true))).toBe(
      'https://staging-api.newscontext.example.com'
    );
  });
});
