export class NewsContextApiError extends Error {
    statusCode;
    payload;
    constructor(statusCode, message, payload) {
        super(message);
        this.statusCode = statusCode;
        this.payload = payload;
    }
}
class InvalidJsonPayloadError extends Error {
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function getErrorMessage(statusCode, payload, fallback) {
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
function buildIdentityHeaders(identity) {
    return {
        'x-anon-id': identity.anon_id,
        'x-device-id': identity.device_id,
        'x-app-version': chrome.runtime.getManifest().version
    };
}
export function isWatchlistLimitPayload(value) {
    return (isRecord(value) &&
        value['error'] === 'plan_limit_reached' &&
        typeof value['limit_count'] === 'number' &&
        typeof value['used_count'] === 'number');
}
export function createResolveApiClient(options) {
    const fetchFn = options.fetchFn ?? fetch;
    const timeoutMs = options.timeoutMs ?? 2500;
    const normalizedBaseUrl = options.baseUrl.replace(/\/$/, '');
    const releaseChannel = options.releaseChannel ?? 'local';
    function emitMonitoringEvent(event) {
        options.onMonitoringEvent?.({
            ...event,
            release_channel: releaseChannel
        });
    }
    function parseJsonPayload(text, path) {
        if (text === '') {
            return null;
        }
        try {
            return JSON.parse(text);
        }
        catch {
            emitMonitoringEvent({
                kind: 'invalid_json',
                path,
                message: 'The API returned an invalid JSON payload.'
            });
            throw new InvalidJsonPayloadError('The server returned an unexpected response.');
        }
    }
    async function request(path, init, fallbackErrorMessage) {
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
            return payload;
        }
        catch (error) {
            if (error.name === 'AbortError') {
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
        }
        finally {
            globalThis.clearTimeout(timeoutHandle);
        }
    }
    return {
        async resolvePageContext(requestPayload) {
            return request('/v1/page/resolve', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }, 'Resolve API failed');
        },
        async getProfile(identity) {
            return request('/v1/me', {
                method: 'GET',
                headers: buildIdentityHeaders(identity)
            }, 'Profile API failed');
        },
        async getBriefing(identity, requestPayload = {}) {
            const searchParams = new URLSearchParams();
            if (requestPayload.date !== undefined) {
                searchParams.set('date', requestPayload.date);
            }
            const query = searchParams.size === 0 ? '' : `?${searchParams.toString()}`;
            return request(`/v1/briefings${query}`, {
                method: 'GET',
                headers: buildIdentityHeaders(identity)
            }, 'Briefing API failed');
        },
        async createCheckoutSession(identity, requestPayload) {
            return request('/v1/checkout/session', {
                method: 'POST',
                headers: {
                    ...buildIdentityHeaders(identity),
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }, 'Checkout session failed');
        },
        async listWatchlists(identity) {
            return request('/v1/watchlists', {
                method: 'GET',
                headers: buildIdentityHeaders(identity)
            }, 'Watchlist API failed');
        },
        async createWatchlist(identity, requestPayload) {
            return request('/v1/watchlists', {
                method: 'POST',
                headers: {
                    ...buildIdentityHeaders(identity),
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }, 'Create watchlist failed');
        },
        async updateWatchlist(identity, watchlistId, requestPayload) {
            return request(`/v1/watchlists/${encodeURIComponent(watchlistId)}`, {
                method: 'PATCH',
                headers: {
                    ...buildIdentityHeaders(identity),
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }, 'Update watchlist failed');
        },
        async deleteWatchlist(identity, watchlistId) {
            await request(`/v1/watchlists/${encodeURIComponent(watchlistId)}`, {
                method: 'DELETE',
                headers: buildIdentityHeaders(identity)
            }, 'Delete watchlist failed');
        },
        async ingestEvent(identity, requestPayload) {
            await request('/v1/events', {
                method: 'POST',
                headers: {
                    ...buildIdentityHeaders(identity),
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }, 'Event ingest failed');
        }
    };
}
//# sourceMappingURL=api-client.js.map