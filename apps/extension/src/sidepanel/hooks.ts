import type {
  BriefingResponse,
  GetBriefingRequest,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  CreateWatchlistRequest,
  DeviceIdentity,
  EventRequest,
  ProfileResponse,
  ResolveRequest,
  ResolveResponse,
  TrackedEventName,
  UpdateWatchlistRequest,
  WatchlistItem
} from '@news-context/shared-types';

import {
  CONSENT_VERSION,
  DEFAULT_API_BASE_URL,
  STORAGE_KEY_ANALYTICS_OPT_IN,
  STORAGE_KEY_ANON_ID,
  STORAGE_KEY_API_BASE_URL,
  STORAGE_KEY_CHECKOUT_RETURN,
  STORAGE_KEY_DEVICE_ID,
  STORAGE_KEY_ONBOARDING_COMPLETED
} from '../lib/constants.js';
import type {
  ExtractCurrentArticleResponse,
  PanelTabContext,
  RuntimeErrorResponse,
  SidePanelRuntimeMessage,
  SidePanelRuntimeResponse
} from '../lib/messages.js';
import type { ArticleParseResult, ParsedArticle } from '../content/types.js';

import {
  type ApiMonitoringEvent,
  createResolveApiClient,
  NewsContextApiError,
  type NewsContextApiClient
} from './api-client.js';
import { createDefaultPreferences, type SidePanelPreferences } from './state.js';
import { buildResolveRequestFromParsedArticle } from './view-model.js';

async function sendRuntimeMessage(
  message: SidePanelRuntimeMessage
): Promise<SidePanelRuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface SidePanelRuntimeConfig {
  readonly apiBaseUrl?: string | undefined;
  readonly releaseChannel?: string | undefined;
}

interface ArticleParseEventBundle {
  readonly articleParsedProps: Readonly<Record<string, unknown>>;
  readonly parseFailureProps: Readonly<Record<string, unknown>> | null;
}

const CHECKOUT_RETURN_MESSAGE_TYPE = 'news-context-checkout-return';

function readRuntimeConfig(): SidePanelRuntimeConfig {
  const config = (globalThis as typeof globalThis & {
    __NEWS_CONTEXT_CONFIG__?: SidePanelRuntimeConfig;
  }).__NEWS_CONTEXT_CONFIG__;

  if (config === undefined || !isRecord(config)) {
    return {};
  }

  return {
    apiBaseUrl: typeof config['apiBaseUrl'] === 'string' ? config['apiBaseUrl'] : undefined,
    releaseChannel: typeof config['releaseChannel'] === 'string' ? config['releaseChannel'] : undefined
  };
}

export function reportSidePanelMonitoringEvent(event: ApiMonitoringEvent): void {
  console.warn('[news-context-monitoring]', JSON.stringify(event));
}

export interface CheckoutReturnSignal {
  readonly result: 'success' | 'cancel';
  readonly session_id: string;
  readonly plan_code: 'founder_pass';
  readonly provider: string | null;
}

function parseCheckoutReturnSignal(value: unknown): CheckoutReturnSignal | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    (value['result'] !== 'success' && value['result'] !== 'cancel') ||
    typeof value['session_id'] !== 'string' ||
    value['plan_code'] !== 'founder_pass'
  ) {
    return null;
  }

  return {
    result: value['result'],
    session_id: value['session_id'],
    plan_code: 'founder_pass',
    provider: typeof value['provider'] === 'string' ? value['provider'] : null
  };
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((entry) => entry.toString(16).padStart(2, '0')).join('');
}

function buildAnalyticsEventRequest(
  identity: DeviceIdentity,
  eventName: TrackedEventName,
  eventProps?: Readonly<Record<string, unknown>>
): EventRequest {
  return {
    anon_id: identity.anon_id,
    event_name: eventName,
    event_props: {
      ...(eventProps ?? {}),
      app_version: chrome.runtime.getManifest().version,
      consent_version: CONSENT_VERSION,
      locale: navigator.language
    },
    ts: new Date().toISOString()
  };
}

function resolvePageDomain(rawUrl: string | null): string {
  if (rawUrl === null) {
    return 'unknown';
  }

  try {
    return new URL(rawUrl).hostname;
  } catch {
    return 'unknown';
  }
}

export async function hashPageUrl(rawUrl: string): Promise<string> {
  try {
    const url = new URL(rawUrl);
    return sha256Hex(`${url.origin}${url.pathname}`);
  } catch {
    return sha256Hex(rawUrl);
  }
}

export async function buildPanelOpenedEventProps(
  context: Pick<PanelTabContext, 'url' | 'supported'>
): Promise<Readonly<Record<string, unknown>>> {
  const pageUrlHash = context.url === null ? null : await hashPageUrl(context.url);

  return {
    page_domain: resolvePageDomain(context.url),
    page_url_hash: pageUrlHash,
    page_type_guess: context.supported ? 'news_article' : 'unsupported'
  };
}

export async function buildArticleParseEventBundle(
  context: Pick<PanelTabContext, 'url' | 'supported'>,
  article: ArticleParseResult | null
): Promise<ArticleParseEventBundle> {
  const pageUrlHash = context.url === null ? null : await hashPageUrl(context.url);
  const pageDomain = resolvePageDomain(context.url);

  if (!context.supported || context.url === null || article === null) {
    return {
      articleParsedProps: {
        parse_success: false,
        parse_confidence: 0,
        parser_source: 'tab_context',
        publisher_domain: pageDomain,
        article_type: 'unknown',
        page_url_hash: pageUrlHash,
        supported_page: false,
        failure_reason: 'unsupported_host',
        failure_stage: 'tab_context'
      },
      parseFailureProps: {
        parse_confidence: 0,
        parser_source: 'tab_context',
        publisher_domain: pageDomain,
        page_url_hash: pageUrlHash,
        supported_page: false,
        failure_reason: 'unsupported_host',
        failure_stage: 'tab_context',
        issues: ['unsupported_host']
      }
    };
  }

  const articleParsedProps: Readonly<Record<string, unknown>> = {
    parse_success: article.status !== 'unsupported',
    parse_confidence: article.parse_confidence,
    parser_source: article.parser_path,
    publisher_domain: pageDomain,
    article_type: article.status === 'unsupported' ? 'unknown' : (article.article_type ?? 'unknown'),
    page_url_hash: pageUrlHash,
    supported_page: true
  };

  if (article.status !== 'unsupported') {
    return {
      articleParsedProps,
      parseFailureProps: null
    };
  }

  return {
    articleParsedProps: {
      ...articleParsedProps,
      failure_reason: article.failure_reason,
      failure_stage: 'content_parse'
    },
    parseFailureProps: {
      parse_confidence: article.parse_confidence,
      parser_source: article.parser_path,
      publisher_domain: pageDomain,
      page_url_hash: pageUrlHash,
      supported_page: true,
      failure_reason: article.failure_reason,
      failure_stage: 'content_parse',
      issues: article.issues
    }
  };
}

export async function loadPreferences(): Promise<SidePanelPreferences> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEY_ANALYTICS_OPT_IN,
    STORAGE_KEY_ONBOARDING_COMPLETED,
    STORAGE_KEY_API_BASE_URL
  ]);
  const defaults = createDefaultPreferences();
  const apiBaseUrl =
    typeof stored[STORAGE_KEY_API_BASE_URL] === 'string'
      ? stored[STORAGE_KEY_API_BASE_URL]
      : undefined;

  const basePreferences = {
    analyticsOptIn:
      typeof stored[STORAGE_KEY_ANALYTICS_OPT_IN] === 'boolean'
        ? stored[STORAGE_KEY_ANALYTICS_OPT_IN]
        : defaults.analyticsOptIn,
    onboardingCompleted:
      typeof stored[STORAGE_KEY_ONBOARDING_COMPLETED] === 'boolean'
        ? stored[STORAGE_KEY_ONBOARDING_COMPLETED]
        : defaults.onboardingCompleted
  };

  return apiBaseUrl === undefined ? basePreferences : { ...basePreferences, apiBaseUrl };
}

export async function savePreferences(preferences: SidePanelPreferences): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_ANALYTICS_OPT_IN]: preferences.analyticsOptIn,
    [STORAGE_KEY_ONBOARDING_COMPLETED]: preferences.onboardingCompleted,
    ...(preferences.apiBaseUrl === undefined ? {} : { [STORAGE_KEY_API_BASE_URL]: preferences.apiBaseUrl })
  });
}

export async function loadOrCreateIdentity(): Promise<DeviceIdentity> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_DEVICE_ID, STORAGE_KEY_ANON_ID]);
  const storedDeviceId = stored[STORAGE_KEY_DEVICE_ID];
  const storedAnonId = stored[STORAGE_KEY_ANON_ID];

  if (typeof storedDeviceId === 'string' && typeof storedAnonId === 'string') {
    return {
      device_id: storedDeviceId,
      anon_id: storedAnonId
    };
  }

  const nextIdentity = {
    device_id: `device_${crypto.randomUUID()}`,
    anon_id: `anon_${crypto.randomUUID()}`
  } satisfies DeviceIdentity;

  await chrome.storage.local.set({
    [STORAGE_KEY_DEVICE_ID]: nextIdentity.device_id,
    [STORAGE_KEY_ANON_ID]: nextIdentity.anon_id
  });

  return nextIdentity;
}

export async function loadPanelContext(): Promise<PanelTabContext> {
  const response = await sendRuntimeMessage({
    type: 'sidepanel:get-context'
  });

  if (!response.ok) {
    throw new Error(response.message);
  }

  return response.context;
}

export async function loadParsedArticle(): Promise<{
  readonly context: PanelTabContext;
  readonly article: ArticleParseResult;
}> {
  const response = await sendRuntimeMessage({
    type: 'sidepanel:extract-current-article'
  });

  if (!response.ok) {
    const errorResponse: RuntimeErrorResponse = response;
    throw new Error(errorResponse.message);
  }

  if (!('article' in response)) {
    throw new Error('Unexpected runtime response.');
  }

  const successResponse: ExtractCurrentArticleResponse = response;

  return {
    context: successResponse.context,
    article: successResponse.article
  };
}

export function resolvePanelApiBaseUrl(preferences: SidePanelPreferences): string {
  const runtimeConfig = readRuntimeConfig();
  return preferences.apiBaseUrl ?? runtimeConfig.apiBaseUrl ?? DEFAULT_API_BASE_URL;
}

export function resolvePanelApiOrigin(preferences: SidePanelPreferences): string {
  return new URL(resolvePanelApiBaseUrl(preferences)).origin;
}

export function createPanelApiClient(preferences: SidePanelPreferences): NewsContextApiClient {
  const runtimeConfig = readRuntimeConfig();
  return createResolveApiClient({
    baseUrl: resolvePanelApiBaseUrl(preferences),
    releaseChannel: runtimeConfig.releaseChannel,
    onMonitoringEvent: reportSidePanelMonitoringEvent
  });
}

export async function loadResolveResponse(
  client: NewsContextApiClient,
  article: ParsedArticle
): Promise<ResolveResponse> {
  const request: ResolveRequest = buildResolveRequestFromParsedArticle(article);
  return client.resolvePageContext(request);
}

export async function loadProfile(
  client: NewsContextApiClient,
  identity: DeviceIdentity
): Promise<ProfileResponse> {
  return client.getProfile(identity);
}

export async function loadBriefing(
  client: NewsContextApiClient,
  identity: DeviceIdentity,
  request: GetBriefingRequest = {}
): Promise<BriefingResponse> {
  return client.getBriefing(identity, request);
}

export async function createCheckoutSessionEntry(
  client: NewsContextApiClient,
  identity: DeviceIdentity,
  request: CheckoutSessionRequest
): Promise<CheckoutSessionResponse> {
  return client.createCheckoutSession(identity, request);
}

export async function loadWatchlists(
  client: NewsContextApiClient,
  identity: DeviceIdentity
): Promise<readonly WatchlistItem[]> {
  const response = await client.listWatchlists(identity);
  return response.items;
}

export async function loadAccountData(
  client: NewsContextApiClient,
  identity: DeviceIdentity
): Promise<{
  readonly profile: ProfileResponse;
  readonly watchlists: readonly WatchlistItem[];
}> {
  const [profile, watchlists] = await Promise.all([
    loadProfile(client, identity),
    loadWatchlists(client, identity)
  ]);

  return {
    profile,
    watchlists
  };
}

export async function createWatchlistEntry(
  client: NewsContextApiClient,
  identity: DeviceIdentity,
  request: CreateWatchlistRequest
): Promise<WatchlistItem> {
  return client.createWatchlist(identity, request);
}

export async function updateWatchlistEntry(
  client: NewsContextApiClient,
  identity: DeviceIdentity,
  watchlistId: string,
  request: UpdateWatchlistRequest
): Promise<WatchlistItem> {
  return client.updateWatchlist(identity, watchlistId, request);
}

export async function deleteWatchlistEntry(
  client: NewsContextApiClient,
  identity: DeviceIdentity,
  watchlistId: string
): Promise<void> {
  await client.deleteWatchlist(identity, watchlistId);
}

export async function trackAnalyticsEvent(
  client: NewsContextApiClient,
  preferences: SidePanelPreferences,
  identity: DeviceIdentity,
  eventName: TrackedEventName,
  eventProps?: Readonly<Record<string, unknown>>
): Promise<void> {
  if (!preferences.analyticsOptIn) {
    return;
  }

  try {
    await client.ingestEvent(identity, buildAnalyticsEventRequest(identity, eventName, eventProps));
  } catch (error: unknown) {
    console.warn('Analytics event failed', error);
  }
}

export function isPlanLimitError(error: unknown): boolean {
  return error instanceof NewsContextApiError && error.statusCode === 402;
}

export function getPlanLimitMessage(error: unknown): string | null {
  if (!(error instanceof NewsContextApiError)) {
    return null;
  }

  if (isRecord(error.payload) && typeof error.payload['message'] === 'string') {
    return error.payload['message'];
  }

  return error.message;
}

export function readCheckoutReturnFromUrl(rawUrl: string): CheckoutReturnSignal | null {
  const parsed = new URL(rawUrl);
  return parseCheckoutReturnSignal({
    result: parsed.searchParams.get('checkout_result'),
    session_id: parsed.searchParams.get('checkout_session_id'),
    plan_code: parsed.searchParams.get('checkout_plan_code'),
    provider: parsed.searchParams.get('checkout_provider')
  });
}

export function readCheckoutReturnFromWindowMessage(value: unknown): CheckoutReturnSignal | null {
  if (!isRecord(value) || value['type'] !== CHECKOUT_RETURN_MESSAGE_TYPE) {
    return null;
  }

  return parseCheckoutReturnSignal(value['signal']);
}

export async function publishCheckoutReturnSignal(signal: CheckoutReturnSignal): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_CHECKOUT_RETURN]: signal
  });
}

export async function consumeCheckoutReturnSignal(): Promise<CheckoutReturnSignal | null> {
  const stored = await chrome.storage.local.get([STORAGE_KEY_CHECKOUT_RETURN]);
  const signal = parseCheckoutReturnSignal(stored[STORAGE_KEY_CHECKOUT_RETURN]);

  if (signal === null) {
    return null;
  }

  await chrome.storage.local.remove(STORAGE_KEY_CHECKOUT_RETURN);
  return signal;
}
