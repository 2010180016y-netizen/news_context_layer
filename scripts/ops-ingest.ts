import {
  createEmptyIngestCycleSummary,
  INGEST_SEED_MODES,
  runIngestCycle,
  type IngestCycleLogger,
  type IngestSeedMode
} from '../apps/api/src/services/ingest-operations.js';
import { resolveDefaultStorePath } from '../apps/api/src/repositories/file-store.js';
import type { IngestFetchMode } from '../apps/jobs/src/index.js';

// Export generation stays fixture-backed. ops:ingest exists to refresh store state or vet
// candidate snapshots before a later fixture rotation, not to turn the export path live.
const INGEST_FETCH_MODE_VALUES: readonly IngestFetchMode[] = ['fixture-backed', 'live-network'];

function parseOption(argv: readonly string[], flag: string): string | undefined {
  const inline = argv.find((entry) => entry.startsWith(`${flag}=`));

  if (inline !== undefined) {
    return inline.slice(flag.length + 1);
  }

  const optionIndex = argv.findIndex((entry) => entry === flag);
  return optionIndex >= 0 && optionIndex + 1 < argv.length ? argv[optionIndex + 1] : undefined;
}

function parseFetchMode(argv: readonly string[]): IngestFetchMode {
  const rawMode = parseOption(argv, '--fetch-mode') ?? 'fixture-backed';

  if (!INGEST_FETCH_MODE_VALUES.includes(rawMode as IngestFetchMode)) {
    throw new Error(`fetch-mode must be one of: ${INGEST_FETCH_MODE_VALUES.join(', ')}`);
  }

  return rawMode as IngestFetchMode;
}

function parseSeedMode(argv: readonly string[]): IngestSeedMode {
  const rawMode = parseOption(argv, '--seed-mode') ?? 'if-empty';

  if (!INGEST_SEED_MODES.includes(rawMode as IngestSeedMode)) {
    throw new Error(`seed-mode must be one of: ${INGEST_SEED_MODES.join(', ')}`);
  }

  return rawMode as IngestSeedMode;
}

const cycleLogger: IngestCycleLogger = {
  info(message) {
    console.log(message);
  },
  warn(message) {
    console.warn(message);
  }
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fetchMode = parseFetchMode(args);
  const seedMode = parseSeedMode(args);
  const summaryOnFailure = createEmptyIngestCycleSummary({
    storePath: resolveDefaultStorePath(),
    fetchMode,
    seedMode
  });

  try {
    const summary = await runIngestCycle({
      fetchMode,
      seedMode,
      logger: cycleLogger
    });

    console.log(
      JSON.stringify(
        {
          kind: 'ingest_cycle_summary',
          ...summary
        },
        null,
        2
      )
    );

    if (!summary.success) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown ingest cycle error';

    console.error(
      JSON.stringify(
        {
          kind: 'ingest_cycle_summary',
          ...summaryOnFailure,
          success: false,
          failure_reason: message
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

void main();
