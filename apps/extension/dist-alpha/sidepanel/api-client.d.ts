import type { BriefingResponse, GetBriefingRequest, CheckoutSessionRequest, CheckoutSessionResponse, CreateWatchlistRequest, DeviceIdentity, EventRequest, ProfileResponse, ResolveRequest, ResolveResponse, UpdateWatchlistRequest, WatchlistItem, WatchlistLimitErrorResponse, WatchlistListResponse } from '@news-context/shared-types';
export declare class NewsContextApiError extends Error {
    readonly statusCode: number;
    readonly payload: unknown;
    constructor(statusCode: number, message: string, payload: unknown);
}
export interface NewsContextApiClient {
    resolvePageContext(request: ResolveRequest): Promise<ResolveResponse>;
    getProfile(identity: DeviceIdentity): Promise<ProfileResponse>;
    getBriefing(identity: DeviceIdentity, request?: GetBriefingRequest): Promise<BriefingResponse>;
    createCheckoutSession(identity: DeviceIdentity, request: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
    listWatchlists(identity: DeviceIdentity): Promise<WatchlistListResponse>;
    createWatchlist(identity: DeviceIdentity, request: CreateWatchlistRequest): Promise<WatchlistItem>;
    updateWatchlist(identity: DeviceIdentity, watchlistId: string, request: UpdateWatchlistRequest): Promise<WatchlistItem>;
    deleteWatchlist(identity: DeviceIdentity, watchlistId: string): Promise<void>;
    ingestEvent(identity: DeviceIdentity, request: EventRequest): Promise<void>;
}
export interface ApiMonitoringEvent {
    readonly kind: 'timeout' | 'network_failure' | 'invalid_json' | 'http_error';
    readonly path: string;
    readonly message: string;
    readonly release_channel: string;
    readonly status_code?: number | undefined;
}
export interface ResolveApiClientOptions {
    readonly baseUrl: string;
    readonly fetchFn?: typeof fetch | undefined;
    readonly timeoutMs?: number | undefined;
    readonly releaseChannel?: string | undefined;
    readonly onMonitoringEvent?: ((event: ApiMonitoringEvent) => void) | undefined;
}
export declare function isWatchlistLimitPayload(value: unknown): value is WatchlistLimitErrorResponse;
export declare function createResolveApiClient(options: ResolveApiClientOptions): NewsContextApiClient;
//# sourceMappingURL=api-client.d.ts.map