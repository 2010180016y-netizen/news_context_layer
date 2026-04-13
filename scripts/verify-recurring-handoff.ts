import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RecurringReportCycleSummary } from './lib/operational-assets.js';
import { verifyRecurringHandoff, type RecurringHandoffMode } from './lib/recurring-handoff.js';

function resolveHandoffMode(argv: readonly string[]): RecurringHandoffMode {
  const rawMode = argv
    .find((argument) => argument.startsWith('--handoff-mode='))
    ?.slice('--handoff-mode='.length)
    ?.trim();

  if (rawMode === undefined || rawMode === '') {
    return 'low_volume_pilot';
  }

  if (
    rawMode === 'low_volume_pilot' ||
    rawMode === 'steady_pilot' ||
    rawMode === 'higher_touch_executive_handoff'
  ) {
    return rawMode;
  }

  throw new Error(`Unsupported recurring handoff mode: ${rawMode}`);
}

function resolveSummaryPath(argv: readonly string[]): string {
  const rawPath = argv
    .find((argument) => argument.startsWith('--summary='))
    ?.slice('--summary='.length)
    ?.trim();

  if (rawPath === undefined || rawPath === '') {
    return join(process.cwd(), 'infra', 'exports', 'b2b', 'recurring-report-cycle-summary.json');
  }

  return join(process.cwd(), rawPath);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const handoffMode = resolveHandoffMode(argv);
  const summaryPath = resolveSummaryPath(argv);
  const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as RecurringReportCycleSummary;
  // This command exists to harden the recurring pilot flow before operator review:
  // compare the live summary to the intended handoff example, then decide whether
  // checklist review and warn-note writing can proceed.
  const verification = verifyRecurringHandoff(summary, handoffMode);

  console.log(
    JSON.stringify(
      {
        mode: 'verify_recurring_handoff',
        handoff_mode: handoffMode,
        summary_path: summaryPath,
        summary_status: summary.status,
        matched_example_block: verification.matched_example_block,
        requires_operator_review: verification.requires_operator_review,
        requires_operator_note: verification.requires_operator_note,
        warning_checks: verification.warning_checks,
        failing_checks: verification.failing_checks,
        field_checks: verification.field_checks,
        note_sample_set_path: verification.note_sample_set_path,
        recommended_note_samples: verification.recommended_note_samples,
        next_actions: verification.next_actions
      },
      null,
      2
    )
  );

  if (!verification.matched_example_block || summary.status === 'needs_review') {
    throw new Error('Recurring handoff verification failed.');
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Recurring handoff verification failed: ${message}`);
  process.exitCode = 1;
});
