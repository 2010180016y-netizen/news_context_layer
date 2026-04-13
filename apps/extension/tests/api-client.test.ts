import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeviceIdentity, ResolveRequest } from '@news-context/shared-types';

import {
  createResolveApiClient,
  type ApiMonitoringEvent
} from '../src/sidepanel/api-client.js';

const identity: DeviceIdentity = {
  anon_id: 'anon-alpha',
  device_id: 'device-alpha'
};

const requestPayload: ResolveRequest = {
  url: 'https://n.news.naver.com/article/001/0015324001',
  title: 'Government reviews semiconductor supply chain',
  parse_confidence: 0.95
};

const originalChrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;

function installChromeStub(): void {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        getManifest: () => ({
          version: '0.1.0'
        })
      }
    }
  });
}

beforeEach(() => {
  installChromeStub();
});

afterEach(() => {
  vi.restoreAllMocks();

  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: originalChrome
  });
});

describe('resolve api client hardening', () => {
  it('maps 5xx errors into server-unavailable messages and monitoring events', async () => {
    const monitoringEvents: ApiMonitoringEvent[] = [];
    const client = createResolveApiClient({
      baseUrl: 'https://api.newscontext.example.com',
      onMonitoringEvent: (event) => monitoringEvents.push(event),
      fetchFn: vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 503,
            headers: {
              'content-type': 'application/json'
            }
          })
        )
      )
    });

    await expect(client.getProfile(identity)).rejects.toMatchObject({
      statusCode: 503,
      message: 'Server unavailable. Please retry in a moment.'
    });
    expect(monitoringEvents).toContainEqual({
      kind: 'http_error',
      path: '/v1/me',
      message: 'Server unavailable. Please retry in a moment.',
      release_channel: 'local',
      status_code: 503
    });
  });

  it('reports invalid json payloads as monitoring events', async () => {
    const monitoringEvents: ApiMonitoringEvent[] = [];
    const client = createResolveApiClient({
      baseUrl: 'https://api.newscontext.example.com',
      onMonitoringEvent: (event) => monitoringEvents.push(event),
      fetchFn: vi.fn(() =>
        Promise.resolve(
          new Response('not-json', {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          })
        )
      )
    });

    await expect(client.resolvePageContext(requestPayload)).rejects.toThrow(
      'The server returned an unexpected response.'
    );
    expect(monitoringEvents).toContainEqual({
      kind: 'invalid_json',
      path: '/v1/page/resolve',
      message: 'The API returned an invalid JSON payload.',
      release_channel: 'local'
    });
  });

  it('surfaces timeout failures with a retryable message', async () => {
    vi.useFakeTimers();

    const monitoringEvents: ApiMonitoringEvent[] = [];
    const client = createResolveApiClient({
      baseUrl: 'https://api.newscontext.example.com',
      timeoutMs: 10,
      onMonitoringEvent: (event) => monitoringEvents.push(event),
      fetchFn: vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    });

    const pending = client.resolvePageContext(requestPayload);
    const pendingAssertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(20);

    await pendingAssertion;
    expect(monitoringEvents).toContainEqual({
      kind: 'timeout',
      path: '/v1/page/resolve',
      message: 'The request timed out before the API returned.',
      release_channel: 'local'
    });
  });
});
