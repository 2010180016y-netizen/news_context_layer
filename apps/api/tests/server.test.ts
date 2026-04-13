import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { parseResolveBenchmarkDataset } from '../../../packages/shared-types/src/fixtures.js';

import { FileNewsContextStore } from '../src/repositories/file-store.js';
import { seedResolveBenchmarkCase } from '../src/services/resolve-benchmark-support.js';
import { createServer } from '../src/server.js';

let serverUnderTest: Server | undefined;
const tempDirs: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

describe('api server', () => {
  afterEach(async () => {
    if (serverUnderTest === undefined) {
      await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
      return;
    }

    await closeServer(serverUnderTest);
    serverUnderTest = undefined;
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function createTempStore(): Promise<FileNewsContextStore> {
    const dir = await mkdtemp(join(tmpdir(), 'news-context-server-'));
    tempDirs.push(dir);
    return new FileNewsContextStore(join(dir, 'store.json'));
  }

  async function readDataset() {
    const fileUrl = new URL('../../../sample-fixtures/resolve-benchmark.json', import.meta.url);
    const contents = await readFile(fileUrl, 'utf8');
    return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
  }

  it('serves a health response', async () => {
    serverUnderTest = createServer();

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const payload: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ok',
      service: 'api',
      stage: 'skeleton',
      version: '0.1.0',
    });
  });

  it('serves the resolve API response contract', async () => {
    const dataset = await readDataset();
    const firstCase = dataset.cases[0];

    if (firstCase === undefined) {
      throw new Error('Expected at least one resolve benchmark case.');
    }

    const store = await createTempStore();
    await seedResolveBenchmarkCase(store, firstCase);

    serverUnderTest = createServer({ store });

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/page/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(firstCase.request)
    });
    const payload: unknown = await response.json();

    if (!isRecord(payload)) {
      throw new Error('Expected resolve payload to be an object.');
    }

    const sourceCard = payload['source_card'];
    const relatedArticles = payload['related_articles'];
    const freshness = payload['freshness'];
    const commonSignals = payload['common_signals'];

    if (!isRecord(sourceCard) || !isRecord(freshness) || !isRecord(commonSignals) || !Array.isArray(relatedArticles)) {
      throw new Error('Expected resolve payload to include source_card, freshness, common_signals, and related_articles.');
    }

    expect(response.status).toBe(200);
    expect(payload['state']).toBe('success_full');
    expect(sourceCard['title']).toBe(firstCase.request.title);
    expect(Array.isArray(commonSignals['entities'])).toBe(true);
    expect(Array.isArray(commonSignals['numbers'])).toBe(true);
    expect(typeof commonSignals['confidence']).toBe('number');
    expect(typeof freshness['state']).toBe('string');
    expect(relatedArticles.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid resolve requests', async () => {
    serverUnderTest = createServer();

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/page/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        url: 'not-a-valid-url',
        title: 'Invalid request',
        parse_confidence: 1.2
      })
    });
    const payload: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Bad Request'
    });
  });

  it('returns 500 for internal resolve failures', async () => {
    serverUnderTest = createServer({
      resolveService: {
        resolve: () => Promise.reject(new Error('Synthetic resolve failure'))
      }
    });

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/page/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://n.news.naver.com/article/001/0015324001',
        title: 'Synthetic failure request',
        parse_confidence: 0.9
      })
    });
    const payload: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: 'Internal Server Error',
      message: 'Synthetic resolve failure'
    });
  });

  it('rejects unsupported beta billing plans', async () => {
    serverUnderTest = createServer();

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/checkout/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'device-checkout',
        'x-anon-id': 'anon-checkout',
        'x-app-version': '0.1.0'
      },
      body: JSON.stringify({
        plan_code: 'pro_monthly'
      })
    });
    const payload: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Bad Request'
    });
  });

  it('rejects chrome-extension checkout return urls because billing now requires a hosted return bridge', async () => {
    serverUnderTest = createServer();

    await new Promise<void>((resolve, reject) => {
      serverUnderTest?.once('error', reject);
      serverUnderTest?.listen(0, () => {
        serverUnderTest?.off('error', reject);
        resolve();
      });
    });

    const address = serverUnderTest.address();

    if (address === null || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/v1/checkout/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': 'device-checkout',
        'x-anon-id': 'anon-checkout',
        'x-app-version': '0.1.0'
      },
      body: JSON.stringify({
        plan_code: 'founder_pass',
        success_url: 'chrome-extension://test-extension/sidepanel/index.html'
      })
    });
    const payload: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Bad Request',
      message: 'Return URLs must use http or https so the hosted return bridge can complete checkout.'
    });
  });
});
