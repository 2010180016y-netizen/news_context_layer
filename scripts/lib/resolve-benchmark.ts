import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  parseResolveBenchmarkDataset,
  type ResolveBenchmarkDataset
} from '../../packages/shared-types/src/fixtures.js';
import { FileNewsContextStore } from '../../apps/api/src/repositories/file-store.js';
import { seedResolveBenchmarkCase } from '../../apps/api/src/services/resolve-benchmark-support.js';
import { ResolveService } from '../../apps/api/src/services/resolve-service.js';

export interface ResolveBenchmarkOutput {
  readonly mode: 'resolve_service_benchmark';
  readonly iterations: number;
  readonly budgets: ResolveBenchmarkDataset['budgets'];
  readonly measured: {
    readonly average_precision_at_k: number;
    readonly meets_precision_budget: boolean;
    readonly p50_latency_ms: number;
    readonly p95_latency_ms: number;
    readonly meets_latency_budget: boolean;
  };
  readonly release_blockers: readonly string[];
  readonly case_summaries: readonly {
    readonly case_id: string;
    readonly returned_count: number;
    readonly precision_at_k: number;
    readonly state: string;
    readonly freshness_state: string;
    readonly context_confidence: number;
    readonly expected_state: string;
    readonly expected_freshness_state: string;
    readonly p95_latency_ms: number;
  }[];
  readonly note: string;
}

type ResolveBenchmarkCaseSummary = ResolveBenchmarkOutput['case_summaries'][number];

export function parseIterations(argv: readonly string[]): number {
  const optionIndex = argv.findIndex((entry) => entry === '--iterations');
  const explicitValue =
    optionIndex >= 0 && optionIndex + 1 < argv.length ? argv[optionIndex + 1] : undefined;
  const inlineValue = argv.find((entry) => entry.startsWith('--iterations='))?.split('=')[1];
  const rawValue = explicitValue ?? inlineValue ?? '200';
  const iterations = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('iterations must be a positive integer.');
  }

  return iterations;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function precisionAtK(returnedIds: readonly string[], relevantIds: readonly string[]): number {
  if (returnedIds.length === 0) {
    return 0;
  }

  const relevantSet = new Set(relevantIds);
  const hits = returnedIds.filter((articleId) => relevantSet.has(articleId)).length;

  return hits / returnedIds.length;
}

export async function readResolveBenchmarkDataset(): Promise<ResolveBenchmarkDataset> {
  const fileUrl = new URL('../../sample-fixtures/resolve-benchmark.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
}

export async function runResolveBenchmark(options?: {
  readonly iterations?: number;
  readonly dataset?: ResolveBenchmarkDataset;
}): Promise<ResolveBenchmarkOutput> {
  const iterations = options?.iterations ?? 200;
  const dataset = options?.dataset ?? (await readResolveBenchmarkDataset());
  const tempDirs: string[] = [];
  const overallTimings: number[] = [];
  const caseSummaries: ResolveBenchmarkCaseSummary[] = [];

  try {
    for (const benchmarkCase of dataset.cases) {
      const dir = await mkdtemp(join(tmpdir(), 'news-context-resolve-'));
      tempDirs.push(dir);

      const store = new FileNewsContextStore(join(dir, 'store.json'));
      await seedResolveBenchmarkCase(store, benchmarkCase);

      const resolveService = new ResolveService(store);
      const caseTimings: number[] = [];
      let lastResponse: Awaited<ReturnType<ResolveService['resolve']>> | null = null;

      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const start = performance.now();
        const response = await resolveService.resolve(benchmarkCase.request);
        const elapsed = performance.now() - start;

        overallTimings.push(elapsed);
        caseTimings.push(elapsed);
        lastResponse = response;
      }

      if (lastResponse === null) {
        throw new Error(`No response produced for benchmark case ${benchmarkCase.case_id}.`);
      }

      caseSummaries.push({
        case_id: benchmarkCase.case_id,
        returned_count: lastResponse.related_articles.length,
        precision_at_k: round(
          precisionAtK(
            lastResponse.related_articles.map((article) => article.article_id),
            benchmarkCase.expected.relevant_article_ids
          )
        ),
        state: lastResponse.state,
        freshness_state: lastResponse.freshness.state,
        context_confidence: lastResponse.context_confidence,
        expected_state: benchmarkCase.expected.state,
        expected_freshness_state: benchmarkCase.expected.freshness_state,
        p95_latency_ms: round(percentile(caseTimings, 0.95))
      });
    }
  } finally {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  }

  const averagePrecisionAtK =
    caseSummaries.length === 0
      ? 0
      : caseSummaries.reduce((total, summary) => total + summary.precision_at_k, 0) / caseSummaries.length;

  return {
    mode: 'resolve_service_benchmark',
    iterations,
    budgets: dataset.budgets,
    measured: {
      average_precision_at_k: round(averagePrecisionAtK),
      meets_precision_budget: averagePrecisionAtK >= dataset.budgets.min_precision_at_5,
      p50_latency_ms: round(percentile(overallTimings, 0.5)),
      p95_latency_ms: round(percentile(overallTimings, 0.95)),
      meets_latency_budget: percentile(overallTimings, 0.95) <= dataset.budgets.target_p95_latency_ms
    },
    release_blockers: [
      ...(averagePrecisionAtK >= dataset.budgets.min_precision_at_5
        ? []
        : ['related precision is below the alpha minimum']),
      ...(percentile(overallTimings, 0.95) <= dataset.budgets.target_p95_latency_ms
        ? []
        : ['resolve p95 latency is above the alpha target'])
    ],
    case_summaries: caseSummaries,
    note: 'Benchmark executes the real resolve service against the fixture candidate pools.'
  };
}
