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
  UpdateWatchlistRequest,
  WatchlistItem,
  WatchlistLimitErrorResponse,
  WatchlistListResponse
} from '@news-context/shared-types';

export class NewsContextApiError extends Error {
  public readonly statusCode: number;
  public readonly payload: unknown;

  public constructor(statusCode: number, message: string, payload: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

class InvalidJsonPayloadError extends Error {}

export interface NewsContextApiClient {
  resolvePageContext(request: ResolveRequest): Promise<ResolveResponse>;
  getProfile(identity: DeviceIdentity): Promise<ProfileResponse>;
  getBriefing(identity: DeviceIdentity, request?: GetBriefingRequest): Promise<BriefingResponse>;
  createCheckoutSession(
    identity: DeviceIdentity,
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResponse>;
  listWatchlists(identity: DeviceIdentity): Promise<WatchlistListResponse>;
  createWatchlist(identity: DeviceIdentity, request: CreateWatchlistRequest): Promise<WatchlistItem>;
  updateWatchlist(
    identity: DeviceIdentity,
    watchlistId: string,
    request: UpdateWatchlistRequest
  ): Promise<WatchlistItem>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(statusCode: number, payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload['message'] === 'string') {
    return payload['message'];
  }

  if (statusCode >= 500) {
    return 'Server unavailable. Please retry in a moment.';
  }

  if (statusCode === 429) {
    return 'Too many requests. Please retry shortly.';
  }

  return `${fallback} (${statusCode})`;
}

function buildIdentityHeaders(identity: DeviceIdentity): HeadersInit {
  return {
    'x-anon-id': identity.anon_id,
    'x-device-id': identity.device_id,
    'x-app-version': chrome.runtime.getManifest().version
  };
}

export function isWatchlistLimitPayload(value: unknown): value is WatchlistLimitErrorResponse {
  return (
    isRecord(value) &&
    value['error'] === 'plan_limit_reached' &&
    typeof value['limit_count'] === 'number' &&
    typeof value['used_count'] === 'number'
  );
}

export function createResolveApiClient(options: ResolveApiClientOptions): NewsContextApiClient {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2500;
  const normalizedBaseUrl = options.baseUrl.replace(/\/$/, '');
  const releaseChannel = options.releaseChannel ?? 'local';

  function emitMonitoringEvent(event: Omit<ApiMonitoringEvent, 'release_channel'>): void {
    options.onMonitoringEvent?.({
      ...event,
      release_channel: releaseChannel
    });
  }

  function parseJsonPayload(text: string, path: string): unknown {
    if (text === '') {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      emitMonitoringEvent({
        kind: 'invalid_json',
        path,
        message: 'The API returned an invalid JSON payload.'
      });
      throw new InvalidJsonPayloadError('The server returned an unexpected response.');
    }
  }

  async function request<T>(
    path: string,
    init: RequestInit,
    fallbackErrorMessage: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutHandle = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(`${normalizedBaseUrl}${path}`, {
        ...init,
        signal: controller.signal
      });
      const payload = parseJsonPayload(await response.text(), path);

      if (!response.ok) {
        const message = getErrorMessage(response.status, payload, fallbackErrorMessage);
        emitMonitoringEvent({
          kind: 'http_error',
          path,
          status_code: response.status,
          message
        });
        throw new NewsContextApiError(response.status, message, payload);
      }

      return payload as T;
    } catch (error: unknown) {
      if ((error as DOMException).name === 'AbortError') {
        emitMonitoringEvent({
          kind: 'timeout',
          path,
          message: 'The request timed out before the API returned.'
        });
        throw new Error('요청 시간이 길어져 비교를 잠시 멈췄습니다.');
      }

      if (error instanceof NewsContextApiError) {
        throw error;
      }

      if (error instanceof InvalidJsonPayloadError) {
        throw error;
      }

      if (error instanceof Error) {
        emitMonitoringEvent({
          kind: 'network_failure',
          path,
          message: error.message
        });
        throw new Error('Network request failed. Please retry.');
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutHandle);
    }
  }

  return {
    async resolvePageContext(requestPayload: ResolveRequest): Promise<ResolveResponse> {
      return request<ResolveResponse>(
        '/v1/page/resolve',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        },
        'Resolve API failed'
      );
    },

    async getProfile(identity: DeviceIdentity): Promise<ProfileResponse> {
      return request<ProfileResponse>(
        '/v1/me',
        {
          method: 'GET',
          headers: buildIdentityHeaders(identity)
        },
        'Profile API failed'
      );
    },

    async getBriefing(
      identity: DeviceIdentity,
      requestPayload: GetBriefingRequest = {}
    ): Promise<BriefingResponse> {
      const searchParams = new URLSearchParams();

      if (requestPayload.date !== undefined) {
        searchParams.set('date', requestPayload.date);
      }

      const query = searchParams.size === 0 ? '' : `?${searchParams.toString()}`;

      return request<BriefingResponse>(
        `/v1/briefings${query}`,
        {
          method: 'GET',
          headers: buildIdentityHeaders(identity)
        },
        'Briefing API failed'
      );
    },

    async createCheckoutSession(
      identity: DeviceIdentity,
      requestPayload: CheckoutSessionRequest
    ): Promise<CheckoutSessionResponse> {
      return request<CheckoutSessionResponse>(
        '/v1/checkout/session',
        {
          method: 'POST',
          headers: {
            ...buildIdentityHeaders(identity),
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        },
        'Checkout session failed'
      );
    },

    async listWatchlists(identity: DeviceIdentity): Promise<WatchlistListResponse> {
      return request<WatchlistListResponse>(
        '/v1/watchlists',
        {
          method: 'GET',
          headers: buildIdentityHeaders(identity)
        },
        'Watchlist API failed'
      );
    },

    async createWatchlist(
      identity: DeviceIdentity,
      requestPayload: CreateWatchlistRequest
    ): Promise<WatchlistItem> {
      return request<WatchlistItem>(
        '/v1/watchlists',
        {
          method: 'POST',
          headers: {
            ...buildIdentityHeaders(identity),
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        },
        'Create watchlist failed'
      );
    },

    async updateWatchlist(
      identity: DeviceIdentity,
      watchlistId: string,
      requestPayload: UpdateWatchlistRequest
    ): Promise<WatchlistItem> {
      return request<WatchlistItem>(
        `/v1/watchlists/${encodeURIComponent(watchlistId)}`,
        {
          method: 'PATCH',
          headers: {
            ...buildIdentityHeaders(identity),
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        },
        'Update watchlist failed'
      );
    },

    async deleteWatchlist(identity: DeviceIdentity, watchlistId: string): Promise<void> {
      await request<null>(
        `/v1/watchlists/${encodeURIComponent(watchlistId)}`,
        {
          method: 'DELETE',
          headers: buildIdentityHeaders(identity)
        },
        'Delete watchlist failed'
      );
    },

    async ingestEvent(identity: DeviceIdentity, requestPayload: EventRequest): Promise<void> {
      await request<null>(
        '/v1/events',
        {
          method: 'POST',
          headers: {
            ...buildIdentityHeaders(identity),
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        },
        'Event ingest failed'
      );
    }
  };
}
