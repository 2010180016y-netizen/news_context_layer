import { readFile } from 'node:fs/promises';

import {
  buildFixtureImportSummary,
  evaluateResolveBenchmark,
  parseFeedSourceSeedFile,
  parseNaverArticleFixtureDataset,
  parseResolveBenchmarkDataset
} from '../packages/shared-types/src/fixtures.js';

async function readJson(relativePath: string): Promise<unknown> {
  const fileUrl = new URL(`../${relativePath}`, import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return JSON.parse(contents) as unknown;
}

async function main(): Promise<void> {
  const seeds = parseFeedSourceSeedFile(await readJson('infra/seeds/feed_sources.seed.json'));
  const parserDataset = parseNaverArticleFixtureDataset(await readJson('sample-fixtures/naver-articles.json'));
  const benchmarkDataset = parseResolveBenchmarkDataset(await readJson('sample-fixtures/resolve-benchmark.json'));

  const importSummary = buildFixtureImportSummary(seeds, parserDataset, benchmarkDataset);
  const benchmarkSummary = evaluateResolveBenchmark(benchmarkDataset);

  const payload = {
    mode: 'validation_only',
    import_summary: importSummary,
    benchmark: {
      average_precision_at_k: benchmarkSummary.average_precision_at_k,
      meets_precision_budget:
        benchmarkSummary.average_precision_at_k >= benchmarkDataset.budgets.min_precision_at_5,
      case_count: benchmarkSummary.case_count
    },
    note: 'Fixtures validated successfully. No persistence, fetch, parser, or resolve execution was performed.'
  };

  console.log(JSON.stringify(payload, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Fixture validation failed: ${message}`);
  process.exitCode = 1;
});
