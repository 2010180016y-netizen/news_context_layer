import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  buildFixtureImportSummary,
  evaluateResolveBenchmark,
  parseFeedSourceSeedFile,
  parseNaverArticleFixtureDataset,
  parseResolveBenchmarkDataset
} from '../src/fixtures.js';

async function loadJson(relativePathFromRepoRoot: string): Promise<unknown> {
  const fileUrl = new URL(`../../../${relativePathFromRepoRoot}`, import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return JSON.parse(contents) as unknown;
}

describe('fixture validation', () => {
  it('validates seed, parser, and benchmark fixture contracts', async () => {
    const seeds = parseFeedSourceSeedFile(await loadJson('infra/seeds/feed_sources.seed.json'));
    const parserDataset = parseNaverArticleFixtureDataset(await loadJson('sample-fixtures/naver-articles.json'));
    const benchmarkDataset = parseResolveBenchmarkDataset(await loadJson('sample-fixtures/resolve-benchmark.json'));

    const summary = buildFixtureImportSummary(seeds, parserDataset, benchmarkDataset);
    const benchmarkSummary = evaluateResolveBenchmark(benchmarkDataset);
    const parserFixtureIds = new Set(parserDataset.fixtures.map((fixture) => fixture.case_id));

    expect(summary).toMatchObject({
      publisher_count: 5,
      feed_count: 20,
      parser_fixture_count: 6,
      parser_capacity_target: 300,
      benchmark_case_count: 3,
      benchmark_candidate_count: 16
    });

    expect(summary.parser_path_coverage).toEqual(['jsonld', 'meta', 'dom']);
    expect(summary.parser_status_coverage).toEqual(['success', 'partial', 'unsupported']);

    expect(benchmarkDataset.budgets).toMatchObject({
      target_p95_latency_ms: 2500,
      min_precision_at_5: 0.8,
      candidate_time_window_hours: 72,
      min_related_articles: 3,
      max_related_articles: 5
    });

    expect(benchmarkSummary.case_count).toBe(3);
    expect(benchmarkSummary.average_precision_at_k).toBeGreaterThanOrEqual(0.8);
    expect(benchmarkSummary.case_summaries.every((entry) => entry.returned_count <= 5)).toBe(true);
    expect(
      benchmarkDataset.cases.every((benchmarkCase) =>
        parserFixtureIds.has(benchmarkCase.source_fixture_case_id)
      )
    ).toBe(true);
    expect(
      benchmarkDataset.cases.some((benchmarkCase) => benchmarkCase.expected.state === 'insufficient_results')
    ).toBe(true);
  });
});
