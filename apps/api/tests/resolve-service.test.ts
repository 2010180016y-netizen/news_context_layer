import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseResolveBenchmarkDataset } from '../../../packages/shared-types/src/fixtures.js';

import { FileNewsContextStore } from '../src/repositories/file-store.js';
import { seedResolveBenchmarkCase } from '../src/services/resolve-benchmark-support.js';
import { ResolveService } from '../src/services/resolve-service.js';

const tempDirs: string[] = [];

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-resolve-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

async function readDataset() {
  const fileUrl = new URL('../../../sample-fixtures/resolve-benchmark.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
}

describe('resolve service', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('matches benchmark expectations and clears the precision budget', async () => {
    const dataset = await readDataset();
    const perCasePrecision: number[] = [];

    for (const benchmarkCase of dataset.cases) {
      const store = await createTempStore();
      await seedResolveBenchmarkCase(store, benchmarkCase);

      const resolveService = new ResolveService(store);
      const response = await resolveService.resolve(benchmarkCase.request);
      const returnedIds = response.related_articles.map((article) => article.article_id);
      const relevantIds = new Set(benchmarkCase.expected.relevant_article_ids);
      const hits = returnedIds.filter((articleId) => relevantIds.has(articleId)).length;
      const precision = returnedIds.length === 0 ? 0 : hits / returnedIds.length;

      perCasePrecision.push(precision);

      expect(response.state).toBe(benchmarkCase.expected.state);
      expect(response.freshness.state).toBe(benchmarkCase.expected.freshness_state);
      expect(response.context_confidence).toBeGreaterThanOrEqual(benchmarkCase.expected.context_confidence_min);
      expect(response.related_articles.length).toBeGreaterThanOrEqual(benchmarkCase.expected.min_related_count);
      expect(response.related_articles.length).toBeLessThanOrEqual(benchmarkCase.expected.max_related_count);
      expect(returnedIds.every((articleId) => relevantIds.has(articleId))).toBe(true);
      expect(response.source_card.title).toBe(benchmarkCase.request.title);
      expect(response.common_signals.confidence).toBeGreaterThanOrEqual(0);
    }

    const averagePrecision =
      perCasePrecision.reduce((total, value) => total + value, 0) / perCasePrecision.length;

    expect(averagePrecision).toBeGreaterThanOrEqual(0.8);
  });
});
