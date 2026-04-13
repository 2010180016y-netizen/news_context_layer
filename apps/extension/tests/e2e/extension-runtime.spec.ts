import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

import { createServer } from '../../../api/src/server.js';
import { FileNewsContextStore } from '../../../api/src/repositories/file-store.js';
import {
  appendResolveBenchmarkCaseCandidates,
  seedResolveBenchmarkCase
} from '../../../api/src/services/resolve-benchmark-support.js';

interface BenchmarkDataset {
  readonly cases: readonly ResolveBenchmarkCase[];
}

interface ResolveBenchmarkCase {
  readonly case_id: string;
  readonly request: {
    readonly url: string;
    readonly canonical_url?: string | undefined;
    readonly title: string;
    readonly publisher_name?: string | undefined;
    readonly author_names?: readonly string[] | undefined;
    readonly published_at?: string | undefined;
    readonly modified_at?: string | undefined;
    readonly article_type?: string | undefined;
    readonly section?: string | undefined;
    readonly body_excerpt?: string | undefined;
    readonly keywords?: readonly string[] | undefined;
    readonly page_lang?: string | undefined;
  };
}

interface RuntimeHarness {
  readonly apiBaseUrl: string;
  readonly articleBaseUrl: string;
  readonly cleanup: () => Promise<void>;
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const extensionDistPath = resolve(workspaceRoot, 'apps', 'extension', 'dist');
const benchmarkFixturePath = resolve(workspaceRoot, 'sample-fixtures', 'resolve-benchmark.json');
const FileNewsContextStoreCtor = FileNewsContextStore as unknown as new (filePath: string) => FileNewsContextStore;
const createApiServer = createServer as unknown as (options: {
  readonly store: FileNewsContextStore;
}) => HttpServer;
const seedResolveBenchmarkCaseFixture = seedResolveBenchmarkCase as unknown as (
  store: FileNewsContextStore,
  benchmarkCase: ResolveBenchmarkCase
) => Promise<void>;
const appendResolveBenchmarkCaseFixtureCandidates = appendResolveBenchmarkCaseCandidates as unknown as (
  store: FileNewsContextStore,
  benchmarkCase: ResolveBenchmarkCase
) => Promise<void>;

function renderMockArticle(caseData: ResolveBenchmarkCase): string {
  const request = caseData.request;
  const canonicalUrl = request.canonical_url ?? request.url;
  const keywords = request.keywords ?? [];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': request.article_type === 'analysis' ? 'AnalysisNewsArticle' : 'NewsArticle',
    headline: request.title,
    name: request.title,
    url: canonicalUrl,
    articleSection: request.section ?? 'news',
    datePublished: request.published_at ?? new Date().toISOString(),
    dateModified: request.modified_at ?? request.published_at ?? new Date().toISOString(),
    author: (request.author_names ?? []).map((name) => ({
      '@type': 'Person',
      name
    })),
    publisher: {
      '@type': 'Organization',
      name: request.publisher_name ?? 'Benchmark Publisher'
    },
    keywords,
    description: request.body_excerpt ?? request.title,
    articleBody: `${request.body_excerpt ?? request.title} ${keywords.join(' ')}`
  };

  return `<!doctype html>
<html lang="${request.page_lang ?? 'ko'}">
  <head>
    <meta charset="utf-8" />
    <title>${request.title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${request.title}" />
    <meta property="og:description" content="${request.body_excerpt ?? request.title}" />
    <meta property="og:site_name" content="${request.publisher_name ?? 'Benchmark Publisher'}" />
    <meta property="article:section" content="${request.section ?? 'news'}" />
    <meta property="article:published_time" content="${request.published_at ?? new Date().toISOString()}" />
    <meta property="article:modified_time" content="${request.modified_at ?? request.published_at ?? new Date().toISOString()}" />
    <meta name="keywords" content="${keywords.join(', ')}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <header class="media_end_head_top">
      <div class="media_end_head_top_logo">
        <img alt="${request.publisher_name ?? 'Benchmark Publisher'}" src="/logo.png" />
      </div>
      <div id="title_area"><span>${request.title}</span></div>
      <div class="media_end_head_info_datestamp">
        <time datetime="${request.published_at ?? new Date().toISOString()}">${request.published_at ?? ''}</time>
      </div>
      <div class="media_end_categorize_item">${request.section ?? 'news'}</div>
      <div class="media_end_head_byline">${(request.author_names ?? []).join(', ')}</div>
    </header>
    <article id="dic_area">
      <p>${request.body_excerpt ?? request.title}</p>
      <p>${keywords.join(' ')}</p>
    </article>
  </body>
</html>`;
}

async function readBenchmarkDataset(): Promise<BenchmarkDataset> {
  return JSON.parse(await readFile(benchmarkFixturePath, 'utf8')) as BenchmarkDataset;
}

async function startMockArticleServer(caseMap: Readonly<Record<string, ResolveBenchmarkCase>>): Promise<{
  readonly server: HttpServer;
  readonly baseUrl: string;
}> {
  const server = createHttpServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const caseId = requestUrl.pathname.replace(/^\//u, '');
    const caseData = caseMap[caseId];

    if (caseData === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderMockArticle(caseData));
  });

  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', () => resolvePromise()));
  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Mock article server failed to bind to a TCP port.');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function createHarness(): Promise<{
  readonly harness: RuntimeHarness;
  readonly cases: Record<string, ResolveBenchmarkCase>;
}> {
  const fixture = await readBenchmarkDataset();
  const selectedCases = fixture.cases.filter((entry) =>
    [
      'resolve-001-semiconductor-policy',
      'resolve-002-flood-response-insufficient',
      'resolve-003-market-wrap-low-confidence'
    ].includes(entry.case_id)
  );
  const caseMap = Object.fromEntries(selectedCases.map((entry) => [entry.case_id, entry])) as Record<
    string,
    ResolveBenchmarkCase
  >;
  const tempDirectory = await mkdtemp(join(tmpdir(), 'news-context-e2e-'));
  const storePath = join(tempDirectory, 'news-context.store.json');
  // The test harness imports built JS entrypoints, so we pin the expected store/server types here.
  const store = new FileNewsContextStoreCtor(storePath);

  const primaryCase = caseMap['resolve-001-semiconductor-policy'];
  const insufficientCase = caseMap['resolve-002-flood-response-insufficient'];
  const lowConfidenceCase = caseMap['resolve-003-market-wrap-low-confidence'];

  if (primaryCase === undefined || insufficientCase === undefined || lowConfidenceCase === undefined) {
    throw new Error('Expected benchmark cases for runtime smoke were not found.');
  }

  await seedResolveBenchmarkCaseFixture(store, primaryCase);
  await appendResolveBenchmarkCaseFixtureCandidates(store, insufficientCase);
  await appendResolveBenchmarkCaseFixtureCandidates(store, lowConfidenceCase);

  const apiServer = createApiServer({ store });
  await new Promise<void>((resolvePromise) => apiServer.listen(0, '127.0.0.1', () => resolvePromise()));
  const apiAddress = apiServer.address();
  const articleServer = await startMockArticleServer(caseMap);

  if (apiAddress === null || typeof apiAddress === 'string') {
    throw new Error('API server failed to bind to a TCP port.');
  }

  return {
    cases: caseMap,
    harness: {
      apiBaseUrl: `http://127.0.0.1:${apiAddress.port}`,
      articleBaseUrl: articleServer.baseUrl,
      cleanup: async () => {
        await Promise.all([
          new Promise<void>((resolvePromise, reject) =>
            apiServer.close((error) =>
              error === undefined ? resolvePromise() : reject(error instanceof Error ? error : new Error(String(error)))
            )
          ),
          new Promise<void>((resolvePromise, reject) =>
            articleServer.server.close((error) =>
              error === undefined ? resolvePromise() : reject(error instanceof Error ? error : new Error(String(error)))
            )
          )
        ]);
        await rm(tempDirectory, { recursive: true, force: true });
      }
    }
  };
}

async function launchExtensionContext(): Promise<{
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly userDataDirectory: string;
}> {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'news-context-browser-'));
  const context = await chromium.launchPersistentContext(userDataDirectory, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionDistPath}`,
      `--load-extension=${extensionDistPath}`
    ]
  });

  let [serviceWorker] = context.serviceWorkers();

  if (serviceWorker === undefined) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    userDataDirectory
  };
}

function sidepanelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/sidepanel/index.html`;
}

function getRequiredCase(
  caseMap: Readonly<Record<string, ResolveBenchmarkCase>>,
  caseId: string
): ResolveBenchmarkCase {
  const selectedCase = caseMap[caseId];

  if (selectedCase === undefined) {
    throw new Error(`Required benchmark case ${caseId} was not found.`);
  }

  return selectedCase;
}

async function clearAndSeedStorage(
  page: Page,
  payload: {
    readonly apiBaseUrl: string;
    readonly onboardingCompleted: boolean;
    readonly analyticsOptIn: boolean;
    readonly lastPanelContext: {
      readonly tabId: number | null;
      readonly url: string | null;
      readonly supported: boolean;
    };
  }
): Promise<void> {
  await page.evaluate(async (input) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      deviceId: 'device_e2e_runtime',
      anonId: 'anon_e2e_runtime',
      apiBaseUrl: input.apiBaseUrl,
      onboardingCompleted: input.onboardingCompleted,
      analyticsOptIn: input.analyticsOptIn,
      lastPanelContext: input.lastPanelContext
    });
  }, payload);
}

async function getTabIdForUrl(page: Page, targetUrl: string): Promise<number> {
  const tabId = await page.evaluate(async (url) => {
    const matches = await chrome.tabs.query({ url });
    return matches[0]?.id ?? null;
  }, targetUrl);

  if (typeof tabId !== 'number') {
    throw new Error(`Unable to resolve Chrome tab id for ${targetUrl}.`);
  }

  return tabId;
}

async function expectNotice(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => {
      const texts = await page.locator('.notice-card, .notice-card-warning, .helper-copy, .empty-helper').allTextContents();
      return texts.some((entry) => entry.includes(text));
    })
    .toBe(true);
}

test.describe.serial('extension runtime smoke', () => {
  let harness: RuntimeHarness;
  let cases: Record<string, ResolveBenchmarkCase>;
  let context: BrowserContext;
  let extensionId: string;
  let userDataDirectory: string;

  test.beforeAll(async () => {
    const prepared = await createHarness();
    harness = prepared.harness;
    cases = prepared.cases;
  });

  test.beforeEach(async () => {
    const launched = await launchExtensionContext();
    context = launched.context;
    extensionId = launched.extensionId;
    userDataDirectory = launched.userDataDirectory;
  });

  test.afterEach(async () => {
    await Promise.allSettled([
      context?.close() ?? Promise.resolve(),
      userDataDirectory === undefined ? Promise.resolve() : rm(userDataDirectory, { recursive: true, force: true })
    ]);
  });

  test.afterAll(async () => {
    await harness.cleanup();
  });

  test('renders unsupported and execution error states quickly', async () => {
    const supportedCase = getRequiredCase(cases, 'resolve-001-semiconductor-policy');
    const page = await context.newPage();
    await page.goto(sidepanelUrl(extensionId));

    await clearAndSeedStorage(page, {
      apiBaseUrl: harness.apiBaseUrl,
      onboardingCompleted: true,
      analyticsOptIn: false,
      lastPanelContext: {
        tabId: null,
        url: 'https://example.com/not-supported',
        supported: false
      }
    });

    let startedAt = Date.now();
    await page.reload();
    await expect(page.locator('[data-action="open-supported-page"]')).toBeVisible();
    const unsupportedMs = Date.now() - startedAt;

    await clearAndSeedStorage(page, {
      apiBaseUrl: harness.apiBaseUrl,
      onboardingCompleted: true,
      analyticsOptIn: false,
      lastPanelContext: {
        tabId: 999999,
        url: supportedCase.request.url,
        supported: true
      }
    });

    startedAt = Date.now();
    await page.reload();
    await expect(page.locator('[data-action="retry"]')).toBeVisible();
    const errorMs = Date.now() - startedAt;

    console.info(`[e2e-runtime] unsupported_ms=${unsupportedMs} error_ms=${errorMs}`);

    expect(unsupportedMs).toBeLessThan(1_500);
    expect(errorMs).toBeLessThan(2_000);
  });

  test('runs supported article -> resolve -> watchlist -> paywall -> checkout -> briefing flow', async () => {
    const articleCase = getRequiredCase(cases, 'resolve-001-semiconductor-policy');
    const secondArticleCase = getRequiredCase(cases, 'resolve-003-market-wrap-low-confidence');
    const firstArticlePath = `${harness.articleBaseUrl}/${articleCase.case_id}`;
    const secondArticlePath = `${harness.articleBaseUrl}/${secondArticleCase.case_id}`;
    const articlePage = await context.newPage();
    await articlePage.goto(firstArticlePath);

    const page = await context.newPage();
    await page.goto(sidepanelUrl(extensionId));

    const firstTabId = await getTabIdForUrl(page, firstArticlePath);
    await clearAndSeedStorage(page, {
      apiBaseUrl: harness.apiBaseUrl,
      onboardingCompleted: false,
      analyticsOptIn: true,
      lastPanelContext: {
        tabId: firstTabId,
        url: articleCase.request.url,
        supported: true
      }
    });

    await page.reload();
    await expect(page.locator('[data-action="start-context"]')).toBeVisible();

    let startedAt = Date.now();
    await page.locator('[data-action="start-context"]').click();
    await expect(page.locator('.source-card')).toBeVisible();
    await expect(page.locator('.related-card')).toHaveCount(5);
    const mainRenderMs = Date.now() - startedAt;

    startedAt = Date.now();
    await page.locator('[data-action="save-watchlist"]').click();
    await expect(page.locator('[data-action="save-watchlist"]')).toBeDisabled();
    const firstSaveMs = Date.now() - startedAt;

    await page.locator('[data-action="navigate"][data-route="watchlist"]').first().click();
    await expect(page.locator('[data-action="open-briefing"]')).toBeVisible();

    startedAt = Date.now();
    await page.locator('[data-action="open-briefing"]').click();
    await expect(page.locator('[data-action="start-checkout"]')).toBeVisible();
    await expectNotice(page, 'Founder Pass');
    const briefingPaywallMs = Date.now() - startedAt;

    const checkoutPagePromise = context.waitForEvent('page');
    await page.locator('[data-action="start-checkout"]').click();
    const checkoutPage = await checkoutPagePromise;
    await checkoutPage.waitForLoadState('domcontentloaded');
    await checkoutPage.locator('a.button-primary').click();
    await checkoutPage.waitForURL(/\/billing\/mock\/return\?/);
    await expect(checkoutPage.locator('body')).toContainText('Founder Pass');
    await expectNotice(page, 'Founder Pass');

    await page.locator('[data-action="open-briefing"]').click();
    await expect(page.locator('.watchlist-card')).toHaveCount(1);

    await articlePage.goto(secondArticlePath);
    const secondTabId = await getTabIdForUrl(page, secondArticlePath);
    await page.evaluate(
      async (lastPanelContext) => chrome.storage.local.set({ lastPanelContext }),
      {
        tabId: secondTabId,
        url: secondArticleCase.request.url,
        supported: true
      }
    );

    startedAt = Date.now();
    await page.reload();
    await expect(page.locator('.source-card')).toBeVisible();
    await expect(page.locator('[data-entry-point="quality_review"]')).toBeVisible();
    const lowConfidenceMs = Date.now() - startedAt;

    startedAt = Date.now();
    await page.locator('[data-action="save-watchlist"]').click();
    await expect(page.locator('[data-action="save-watchlist"]')).toBeDisabled();
    const secondSaveMs = Date.now() - startedAt;

    console.info(
      `[e2e-runtime] main_render_ms=${mainRenderMs} first_save_ms=${firstSaveMs} briefing_paywall_ms=${briefingPaywallMs} low_confidence_ms=${lowConfidenceMs} second_save_ms=${secondSaveMs}`
    );

    expect(mainRenderMs).toBeLessThan(3_000);
    expect(firstSaveMs).toBeLessThan(1_500);
    expect(briefingPaywallMs).toBeLessThan(1_500);
    expect(lowConfidenceMs).toBeLessThan(3_000);
    expect(secondSaveMs).toBeLessThan(1_500);
  });
});
