import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileNewsContextStore } from '../src/repositories/file-store.js';
import { createServer } from '../src/server.js';

const tempDirs: string[] = [];
let serverUnderTest: Server | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-watchlists-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

async function seedWatchlistFixtures(
  store: FileNewsContextStore
): Promise<{
  readonly firstClusterId: string;
  readonly secondClusterId: string;
}> {
  const firstClusterId = `cluster_${randomUUID()}`;
  const secondClusterId = `cluster_${randomUUID()}`;
  const nowIso = '2026-04-10T03:00:00.000Z';

  await store.writeState((state) => {
    state.story_clusters = [
      {
        id: firstClusterId,
        label: '반도체 공급망',
        status: 'active',
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        article_count: 2,
        top_entities_json: ['반도체', '공급망'],
        top_numbers_json: ['72시간'],
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: secondClusterId,
        label: '집중호우 대응',
        status: 'active',
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        article_count: 3,
        top_entities_json: ['집중호우'],
        top_numbers_json: ['3개 시군'],
        created_at: nowIso,
        updated_at: nowIso
      }
    ];
    state.cluster_members = [
      {
        id: `member_${randomUUID()}`,
        cluster_id: firstClusterId,
        article_id: `article_${randomUUID()}`,
        score: 0.84,
        rank_in_cluster: 1,
        is_primary: true,
        created_at: nowIso
      },
      {
        id: `member_${randomUUID()}`,
        cluster_id: secondClusterId,
        article_id: `article_${randomUUID()}`,
        score: 0.77,
        rank_in_cluster: 1,
        is_primary: true,
        created_at: nowIso
      }
    ];
  });

  return {
    firstClusterId,
    secondClusterId
  };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port.');
  }

  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe('watchlist and events APIs', () => {
  afterEach(async () => {
    if (serverUnderTest !== undefined) {
      await closeServer(serverUnderTest);
      serverUnderTest = undefined;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('supports watchlist CRUD and blocks the second save for free users', async () => {
    const store = await createTempStore();
    const { firstClusterId, secondClusterId } = await seedWatchlistFixtures(store);

    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const baseUrl = `http://127.0.0.1:${port}`;
    const headers = {
      'content-type': 'application/json',
      'x-device-id': 'device-test',
      'x-anon-id': 'anon-test',
      'x-app-version': '0.1.0'
    };

    const profileResponse = await fetch(`${baseUrl}/v1/me`, {
      headers
    });
    const profilePayload = await readJson(profileResponse);

    expect(profileResponse.status).toBe(200);
    expect(profilePayload).toMatchObject({
      plan: {
        code: 'free'
      },
      limits: {
        watchlists_max: 1,
        watchlists_used: 0
      }
    });

    const createResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cluster_id: firstClusterId
      })
    });
    const createdPayload = await readJson(createResponse);

    if (!isRecord(createdPayload) || typeof createdPayload['id'] !== 'string') {
      throw new Error('Expected created watchlist payload to include an id.');
    }

    expect(createResponse.status).toBe(201);
    expect(createdPayload).toMatchObject({
      cluster_id: firstClusterId,
      notifications_enabled: true
    });

    const listResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      headers
    });
    const listPayload = await readJson(listResponse);

    expect(listResponse.status).toBe(200);
    expect(listPayload).toMatchObject({
      items: [
        {
          id: createdPayload['id'],
          cluster_id: firstClusterId
        }
      ]
    });

    const patchResponse = await fetch(`${baseUrl}/v1/watchlists/${createdPayload['id']}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        notifications_enabled: false
      })
    });
    const patchedPayload = await readJson(patchResponse);

    expect(patchResponse.status).toBe(200);
    expect(patchedPayload).toMatchObject({
      notifications_enabled: false
    });

    const limitResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cluster_id: secondClusterId
      })
    });
    const limitPayload = await readJson(limitResponse);

    expect(limitResponse.status).toBe(402);
    expect(limitPayload).toMatchObject({
      error: 'plan_limit_reached',
      plan_code: 'free',
      limit_count: 1,
      used_count: 1
    });

    const deleteResponse = await fetch(`${baseUrl}/v1/watchlists/${createdPayload['id']}`, {
      method: 'DELETE',
      headers
    });

    expect(deleteResponse.status).toBe(204);

    const emptyListResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      headers
    });
    const emptyListPayload = await readJson(emptyListResponse);

    expect(emptyListResponse.status).toBe(200);
    expect(emptyListPayload).toMatchObject({
      items: []
    });
  });

  it('accepts tracked events and stores them in the events table', async () => {
    const store = await createTempStore();
    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const response = await fetch(`http://127.0.0.1:${port}/v1/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'device-events',
        'x-anon-id': 'anon-events',
        'x-app-version': '0.1.0'
      },
      body: JSON.stringify({
        anon_id: 'anon-events',
        event_name: 'panel_opened',
        event_props: {
          page_domain: 'n.news.naver.com'
        },
        ts: '2026-04-10T03:00:00.000Z'
      })
    });
    const payload = await readJson(response);
    const state = await store.readState();

    if (response.status !== 202) {
      throw new Error(JSON.stringify(payload));
    }

    expect(payload).toEqual({
      accepted: true,
      event_name: 'panel_opened'
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      anon_id: 'anon-events',
      device_id: 'device-events',
      event_name: 'panel_opened'
    });
  });

  it('accepts parse_failure events so unsupported and parser failures can be monitored offline', async () => {
    const store = await createTempStore();
    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const response = await fetch(`http://127.0.0.1:${port}/v1/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'device-parse-failure',
        'x-anon-id': 'anon-parse-failure',
        'x-app-version': '0.1.0'
      },
      body: JSON.stringify({
        anon_id: 'anon-parse-failure',
        event_name: 'parse_failure',
        event_props: {
          parser_source: 'dom',
          failure_reason: 'missing_title',
          failure_stage: 'content_parse',
          page_url_hash: 'hash_123'
        },
        ts: '2026-04-10T03:10:00.000Z'
      })
    });
    const payload = await readJson(response);
    const state = await store.readState();

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      accepted: true,
      event_name: 'parse_failure'
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      event_name: 'parse_failure'
    });
  });

  it('creates a founder pass checkout session and unlocks the paid limits after success', async () => {
    const store = await createTempStore();
    const { firstClusterId, secondClusterId } = await seedWatchlistFixtures(store);

    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const baseUrl = `http://127.0.0.1:${port}`;
    const headers = {
      'content-type': 'application/json',
      'x-device-id': 'device-billing',
      'x-anon-id': 'anon-billing',
      'x-app-version': '0.1.0'
    };

    await fetch(`${baseUrl}/v1/watchlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cluster_id: firstClusterId
      })
    });

    const blockedResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cluster_id: secondClusterId
      })
    });

    expect(blockedResponse.status).toBe(402);

    const checkoutResponse = await fetch(`${baseUrl}/v1/checkout/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan_code: 'founder_pass'
      })
    });
    const checkoutPayload = await readJson(checkoutResponse);

    if (!isRecord(checkoutPayload) || typeof checkoutPayload['checkout_url'] !== 'string') {
      throw new Error('Expected checkout payload to include checkout_url.');
    }

    expect(checkoutResponse.status).toBe(200);
    expect(checkoutPayload).toMatchObject({
      provider: 'mock_founder_pass'
    });

    const checkoutUrl = new URL(checkoutPayload['checkout_url']);
    const token = checkoutUrl.searchParams.get('token');

    expect(token).not.toBeNull();

    const checkoutPageResponse = await fetch(checkoutPayload['checkout_url']);
    const checkoutPageHtml = await checkoutPageResponse.text();

    expect(checkoutPageResponse.status).toBe(200);
    expect(checkoutPageHtml).toContain('Founder Pass를 활성화할까요?');

    const completeResponse = await fetch(`${baseUrl}/billing/mock/complete?token=${encodeURIComponent(token ?? '')}`, {
      redirect: 'manual'
    });
    const completeLocation = completeResponse.headers.get('location');

    expect(completeResponse.status).toBe(302);
    expect(completeLocation).toContain('/billing/mock/return');
    expect(completeLocation).toContain('checkout_result=success');

    const returnPageResponse = await fetch(completeLocation ?? '');
    const returnPageHtml = await returnPageResponse.text();

    expect(returnPageResponse.status).toBe(200);
    expect(returnPageHtml).toContain('news-context-checkout-return');
    expect(returnPageHtml).toContain('window.opener.postMessage');

    const profileResponse = await fetch(`${baseUrl}/v1/me`, {
      headers
    });
    const profilePayload = await readJson(profileResponse);

    expect(profilePayload).toMatchObject({
      plan: {
        code: 'founder_pass',
        status: 'active'
      },
      limits: {
        watchlists_max: 50,
        briefing_enabled: true
      }
    });

    const unlockedResponse = await fetch(`${baseUrl}/v1/watchlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cluster_id: secondClusterId
      })
    });

    expect(unlockedResponse.status).toBe(201);
  });

  it('keeps the free plan when checkout is cancelled', async () => {
    const store = await createTempStore();
    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const baseUrl = `http://127.0.0.1:${port}`;
    const headers = {
      'content-type': 'application/json',
      'x-device-id': 'device-cancel',
      'x-anon-id': 'anon-cancel',
      'x-app-version': '0.1.0'
    };

    const checkoutResponse = await fetch(`${baseUrl}/v1/checkout/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan_code: 'founder_pass'
      })
    });
    const checkoutPayload = await readJson(checkoutResponse);

    if (!isRecord(checkoutPayload) || typeof checkoutPayload['checkout_url'] !== 'string') {
      throw new Error('Expected checkout payload to include checkout_url.');
    }

    const token = new URL(checkoutPayload['checkout_url']).searchParams.get('token');
    const cancelResponse = await fetch(`${baseUrl}/billing/mock/cancel?token=${encodeURIComponent(token ?? '')}`, {
      redirect: 'manual'
    });
    const cancelLocation = cancelResponse.headers.get('location');

    expect(cancelResponse.status).toBe(302);
    expect(cancelLocation).toContain('/billing/mock/return');
    expect(cancelLocation).toContain('checkout_result=cancel');

    const returnPageResponse = await fetch(cancelLocation ?? '');
    const returnPageHtml = await returnPageResponse.text();

    expect(returnPageResponse.status).toBe(200);
    expect(returnPageHtml).toContain('news-context-checkout-return');
    expect(returnPageHtml).toContain('window.opener.postMessage');

    const profileResponse = await fetch(`${baseUrl}/v1/me`, {
      headers
    });
    const profilePayload = await readJson(profileResponse);

    expect(profilePayload).toMatchObject({
      plan: {
        code: 'free',
        status: 'active'
      },
      limits: {
        watchlists_max: 1,
        briefing_enabled: false
      }
    });
  });
});
