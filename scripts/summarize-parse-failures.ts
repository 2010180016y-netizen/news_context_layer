import { FileNewsContextStore, resolveDefaultStorePath } from '../apps/api/src/repositories/file-store.js';
import { summarizeParseFailures } from '../apps/api/src/services/analytics-monitoring.js';

function parseOption(argv: readonly string[], flag: string): string | undefined {
  const inline = argv.find((entry) => entry.startsWith(`${flag}=`));

  if (inline !== undefined) {
    return inline.slice(flag.length + 1);
  }

  const optionIndex = argv.findIndex((entry) => entry === flag);
  return optionIndex >= 0 && optionIndex + 1 < argv.length ? argv[optionIndex + 1] : undefined;
}

function parseThreshold(argv: readonly string[]): number {
  const rawThreshold = parseOption(argv, '--threshold') ?? '0.1';
  const threshold = Number.parseFloat(rawThreshold);

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    throw new Error('threshold must be a number between 0 and 1.');
  }

  return threshold;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const storePath = parseOption(argv, '--store-path') ?? resolveDefaultStorePath();
  const threshold = parseThreshold(argv);
  const store = new FileNewsContextStore(storePath);
  const state = await store.readState();
  const summary = summarizeParseFailures(state.events, threshold);

  console.log(
    JSON.stringify(
      {
        kind: 'parse_failure_summary',
        store_path: storePath,
        ...summary
      },
      null,
      2
    )
  );

  if (summary.exceeds_threshold) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown parse failure summary error';
  console.error(`parse-failure-summary failed: ${message}`);
  process.exitCode = 1;
});
