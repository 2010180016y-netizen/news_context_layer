import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseResolveBenchmarkDataset } from '../../../packages/shared-types/src/fixtures.js';

import { FileNewsContextStore } from '../src/repositories/file-store.js';
import { appendResolveBenchmarkCaseCandidates } from '../src/services/resolve-benchmark-support.js';
import { ResolveService } from '../src/services/resolve-service.js';
import { createServer } from '../src/server.js';

let serverUnderTest: Server | undefined;
const tempDirs: string[] = [];

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-briefings-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
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
    throw new Error('Expected the test server to listen on a TCP port.');
  }

  return address.port;
}

async function readDataset() {
  const fileUrl = new URL('../../../sample-fixtures/resolve-benchmark.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
}

async function seedBriefingStore(store: FileNewsContextStore): Promise<{
  readonly identity: {
    readonly anon_id: string;
    readonly device_id: string;
    readonly app_version: string;
  };
}> {
  const dataset = await readDataset();

  for (const benchmarkCase of dataset.cases) {
    await appendResolveBenchmarkCaseCandidates(store, benchmarkCase);
  }

  const resolveService = new ResolveService(store);
  const identity = {
    anon_id: 'anon-briefing-route-001',
    device_id: 'device-briefing-route-001',
    app_version: 'test'
  } as const;
  const clusterIds: string[] = [];

  for (const benchmarkCase of dataset.cases) {
    const response = await resolveService.resolve(benchmarkCase.request);
    clusterIds.push(response.cluster_id);
  }

  await store.ensureDevice(identity);
  await store.createWatchlist(identity, {
    cluster_id: clusterIds[0] ?? '',
    label: 'Morning briefing watchlist',
    notifications_enabled: true
  });

  return { identity };
}

describe('briefings api', () => {
  afterEach(async () => {
    if (serverUnderTest !== undefined) {
      await closeServer(serverUnderTest);
      serverUnderTest = undefined;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('blocks free users and returns a persisted briefing for founder pass users', async () => {
    const store = await createTempStore();
    const { identity } = await seedBriefingStore(store);

    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const baseUrl = `http://127.0.0.1:${port}`;

    const blockedResponse = await fetch(`${baseUrl}/v1/briefings?date=2026-04-03`, {
      headers: {
        'x-device-id': identity.device_id,
        'x-anon-id': identity.anon_id,
        'x-app-version': identity.app_version
      }
    });
    const blockedPayload = await readJson(blockedResponse);

    expect(blockedResponse.status).toBe(403);
    expect(blockedPayload).toMatchObject({
      error: 'Forbidden'
    });

    await store.activateSubscription(identity, {
      plan_code: 'founder_pass',
      provider: 'mock_founder_pass',
      provider_ref: 'briefing-test-ref'
    });

    const founderResponse = await fetch(`${baseUrl}/v1/briefings?date=2026-04-03`, {
      headers: {
        'x-user-token': identity.device_id,
        'x-app-version': identity.app_version
      }
    });
    const founderPayload = await readJson(founderResponse);
    const secondResponse = await fetch(`${baseUrl}/v1/briefings?date=2026-04-03`, {
      headers: {
        'x-user-token': identity.device_id,
        'x-app-version': identity.app_version
      }
    });
    const secondPayload = await readJson(secondResponse);
    const state = await store.readState();

    expect(founderResponse.status).toBe(200);
    expect(founderPayload).toMatchObject({
      date: '2026-04-03'
    });
    expect(Array.isArray((founderPayload as { items?: unknown }).items)).toBe(true);
    expect((founderPayload as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(1);
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toEqual(founderPayload);
    expect(state.briefings).toHaveLength(1);
    expect(state.briefing_items.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid briefing dates', async () => {
    const store = await createTempStore();
    const { identity } = await seedBriefingStore(store);

    await store.activateSubscription(identity, {
      plan_code: 'founder_pass',
      provider: 'mock_founder_pass',
      provider_ref: 'briefing-invalid-date-ref'
    });

    serverUnderTest = createServer({ store });
    const port = await listen(serverUnderTest);
    const response = await fetch(`http://127.0.0.1:${port}/v1/briefings?date=2026-13-99`, {
      headers: {
        'x-device-id': identity.device_id,
        'x-anon-id': identity.anon_id,
        'x-app-version': identity.app_version
      }
    });
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Bad Request'
    });
  });
});
