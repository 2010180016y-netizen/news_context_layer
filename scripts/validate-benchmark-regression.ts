import { readFile } from 'node:fs/promises';

import { parseIterations, runResolveBenchmark } from './lib/resolve-benchmark.js';

interface ResolveBenchmarkBaseline {
  readonly schema_version: number;
  readonly source_dataset: string;
  readonly reference_generated_at: string;
  readonly reference_metrics: {
    readonly average_precision_at_k: number;
    readonly p50_latency_ms: number;
    readonly p95_latency_ms: number;
  };
  readonly fail_policy: {
    readonly max_precision_drop: number;
    readonly max_p50_latency_ms: number;
    readonly max_p95_latency_ms: number;
  };
  readonly note: string;
}

async function readBaseline(): Promise<ResolveBenchmarkBaseline> {
  const fileUrl = new URL('../sample-fixtures/resolve-benchmark.baseline.json', import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return JSON.parse(contents) as ResolveBenchmarkBaseline;
}

async function main(): Promise<void> {
  const iterations = parseIterations(process.argv.slice(2));
  const [baseline, measured] = await Promise.all([
    readBaseline(),
    runResolveBenchmark({ iterations })
  ]);
  const minimumAllowedPrecision =
    baseline.reference_metrics.average_precision_at_k - baseline.fail_policy.max_precision_drop;
  const blockers = [
    ...(measured.measured.average_precision_at_k >= minimumAllowedPrecision
      ? []
      : [
          `average_precision_at_k dropped below ${minimumAllowedPrecision.toFixed(3)} (measured ${measured.measured.average_precision_at_k.toFixed(3)})`
        ]),
    ...(measured.measured.p50_latency_ms <= baseline.fail_policy.max_p50_latency_ms
      ? []
      : [
          `p50 latency ${measured.measured.p50_latency_ms.toFixed(3)}ms exceeded ${baseline.fail_policy.max_p50_latency_ms.toFixed(3)}ms`
        ]),
    ...(measured.measured.p95_latency_ms <= baseline.fail_policy.max_p95_latency_ms
      ? []
      : [
          `p95 latency ${measured.measured.p95_latency_ms.toFixed(3)}ms exceeded ${baseline.fail_policy.max_p95_latency_ms.toFixed(3)}ms`
        ])
  ];

  console.log(
    JSON.stringify(
      {
        kind: 'resolve_benchmark_regression',
        iterations,
        baseline,
        measured,
        pass: blockers.length === 0,
        blockers
      },
      null,
      2
    )
  );

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown benchmark regression error';
  console.error(`benchmark-regression failed: ${message}`);
  process.exitCode = 1;
});
