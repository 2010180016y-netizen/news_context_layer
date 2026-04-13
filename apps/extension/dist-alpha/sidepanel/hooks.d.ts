import type { BriefingResponse, GetBriefingRequest, CheckoutSessionRequest, CheckoutSessionResponse, CreateWatchlistRequest, DeviceIdentity, ProfileResponse, ResolveResponse, TrackedEventName, UpdateWatchlistRequest, WatchlistItem } from '@news-context/shared-types';
import type { PanelTabContext } from '../lib/messages.js';
import type { ArticleParseResult, ParsedArticle } from '../content/types.js';
import { type ApiMonitoringEvent, type NewsContextApiClient } from './api-client.js';
import { type SidePanelPreferences } from './state.js';
interface ArticleParseEventBundle {
    readonly articleParsedProps: Readonly<Record<string, unknown>>;
    readonly parseFailureProps: Readonly<Record<string, unknown>> | null;
}
export declare function reportSidePanelMonitoringEvent(event: ApiMonitoringEvent): void;
export interface CheckoutReturnSignal {
    readonly result: 'success' | 'cancel';
    readonly session_id: string;
    readonly plan_code: 'founder_pass';
    readonly provider: string | null;
}
export declare function hashPageUrl(rawUrl: string): Promise<string>;
export declare function buildPanelOpenedEventProps(context: Pick<PanelTabContext, 'url' | 'supported'>): Promise<Readonly<Record<string, unknown>>>;
export declare function buildArticleParseEventBundle(context: Pick<PanelTabContext, 'url' | 'supported'>, article: ArticleParseResult | null): Promise<ArticleParseEventBundle>;
export declare function loadPreferences(): Promise<SidePanelPreferences>;
export declare function savePreferences(preferences: SidePanelPreferences): Promise<void>;
export declare function loadOrCreateIdentity(): Promise<DeviceIdentity>;
export declare function loadPanelContext(): Promise<PanelTabContext>;
export declare function loadParsedArticle(): Promise<{
    readonly context: PanelTabContext;
    readonly article: ArticleParseResult;
}>;
export declare function resolvePanelApiBaseUrl(preferences: SidePanelPreferences): string;
export declare function resolvePanelApiOrigin(preferences: SidePanelPreferences): string;
export declare function createPanelApiClient(preferences: SidePanelPreferences): NewsContextApiClient;
export declare function loadResolveResponse(client: NewsContextApiClient, article: ParsedArticle): Promise<ResolveResponse>;
export declare function loadProfile(client: NewsContextApiClient, identity: DeviceIdentity): Promise<ProfileResponse>;
export declare function loadBriefing(client: NewsContextApiClient, identity: DeviceIdentity, request?: GetBriefingRequest): Promise<BriefingResponse>;
export declare function createCheckoutSessionEntry(client: NewsContextApiClient, identity: DeviceIdentity, request: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
export declare function loadWatchlists(client: NewsContextApiClient, identity: DeviceIdentity): Promise<readonly WatchlistItem[]>;
export declare function loadAccountData(client: NewsContextApiClient, identity: DeviceIdentity): Promise<{
    readonly profile: ProfileResponse;
    readonly watchlists: readonly WatchlistItem[];
}>;
export declare function createWatchlistEntry(client: NewsContextApiClient, identity: DeviceIdentity, request: CreateWatchlistRequest): Promise<WatchlistItem>;
export declare function updateWatchlistEntry(client: NewsContextApiClient, identity: DeviceIdentity, watchlistId: string, request: UpdateWatchlistRequest): Promise<WatchlistItem>;
export declare function deleteWatchlistEntry(client: NewsContextApiClient, identity: DeviceIdentity, watchlistId: string): Promise<void>;
export declare function trackAnalyticsEvent(client: NewsContextApiClient, preferences: SidePanelPreferences, identity: DeviceIdentity, eventName: TrackedEventName, eventProps?: Readonly<Record<string, unknown>>): Promise<void>;
export declare function isPlanLimitError(error: unknown): boolean;
export declare function getPlanLimitMessage(error: unknown): string | null;
export declare function readCheckoutReturnFromUrl(rawUrl: string): CheckoutReturnSignal | null;
export declare function readCheckoutReturnFromWindowMessage(value: unknown): CheckoutReturnSignal | null;
export declare function publishCheckoutReturnSignal(signal: CheckoutReturnSignal): Promise<void>;
export declare function consumeCheckoutReturnSignal(): Promise<CheckoutReturnSignal | null>;
export {};
//# sourceMappingURL=hooks.d.ts.map