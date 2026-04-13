import { join } from 'node:path';

import type { RecurringReportCycleSummary } from './operational-assets.js';

export type RecurringHandoffMode =
  | 'low_volume_pilot'
  | 'steady_pilot'
  | 'higher_touch_executive_handoff';

type FieldCheckStatus = 'pass' | 'fail';

export interface RecurringHandoffFieldCheck {
  readonly field: string;
  readonly expected: string | number;
  readonly actual: string | number;
  readonly status: FieldCheckStatus;
}

export interface RecurringHandoffVerification {
  readonly handoff_mode: RecurringHandoffMode;
  readonly matched_example_block: boolean;
  readonly requires_operator_review: boolean;
  readonly requires_operator_note: boolean;
  readonly warning_checks: readonly string[];
  readonly failing_checks: readonly string[];
  readonly field_checks: readonly RecurringHandoffFieldCheck[];
  readonly note_sample_set_path: string | null;
  readonly recommended_note_samples: readonly string[];
  readonly next_actions: readonly string[];
}

interface ExpectedHandoffProfile {
  readonly cadence: RecurringReportCycleSummary['cadence'];
  readonly review_profile: RecurringReportCycleSummary['review_profile'];
  readonly operating_mode: RecurringReportCycleSummary['operating_mode'];
  readonly ingest_cutoff_hours: number;
  readonly rerun_window_hours: number;
  readonly operator_review_window_hours: number;
  readonly warn_handling: string;
}

const NOTE_SAMPLE_SET_PATH = join('docs', 'ops', 'B2B_OPERATOR_NOTE_SAMPLES.md').replace(/\\/g, '/');

// These expectations intentionally mirror the example blocks in
// docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md so a recurring pilot handoff can be
// checked against the documented operating mode rather than operator memory.
const EXPECTED_BY_MODE: Record<RecurringHandoffMode, ExpectedHandoffProfile> = {
  low_volume_pilot: {
    cadence: 'weekly',
    review_profile: 'standard',
    operating_mode: 'low_volume_pilot',
    ingest_cutoff_hours: 24,
    rerun_window_hours: 12,
    operator_review_window_hours: 24,
    warn_handling: 'Warns may ship only with an explicit operator note and follow-up owner.'
  },
  steady_pilot: {
    cadence: 'twice_weekly',
    review_profile: 'standard',
    operating_mode: 'steady_pilot',
    ingest_cutoff_hours: 12,
    rerun_window_hours: 6,
    operator_review_window_hours: 12,
    warn_handling: 'Warns may ship only with an explicit operator note and follow-up owner.'
  },
  higher_touch_executive_handoff: {
    cadence: 'twice_weekly',
    review_profile: 'executive_handoff',
    operating_mode: 'higher_touch_executive_handoff',
    ingest_cutoff_hours: 6,
    rerun_window_hours: 3,
    operator_review_window_hours: 6,
    warn_handling:
      'Do not hand off until every warn is cleared or explicitly owner-signed for executive delivery.'
  }
};

function createFieldCheck(
  field: string,
  expected: string | number,
  actual: string | number
): RecurringHandoffFieldCheck {
  return {
    field,
    expected,
    actual,
    status: expected === actual ? 'pass' : 'fail'
  };
}

function recommendedNoteSamples(handoffMode: RecurringHandoffMode, warningChecks: readonly string[]): string[] {
  if (handoffMode !== 'steady_pilot') {
    return [];
  }

  const samples = new Set<string>();

  if (warningChecks.includes('operator_follow_up_path')) {
    samples.add('steady_pilot.operator_follow_up.default');
  }

  samples.add('steady_pilot.anchor_clarity.reinforcement');
  samples.add('steady_pilot.repeat_use_narrative.follow_up');

  return [...samples];
}

export function verifyRecurringHandoff(
  summary: RecurringReportCycleSummary,
  handoffMode: RecurringHandoffMode
): RecurringHandoffVerification {
  const expected = EXPECTED_BY_MODE[handoffMode];
  const warningChecks = summary.checks.filter((check) => check.status === 'warn').map((check) => check.id);
  const failingChecks = summary.checks.filter((check) => check.status === 'fail').map((check) => check.id);

  const fieldChecks: RecurringHandoffFieldCheck[] = [
    createFieldCheck('cadence', expected.cadence, summary.cadence),
    createFieldCheck('review_profile', expected.review_profile, summary.review_profile),
    createFieldCheck('operating_mode', expected.operating_mode, summary.operating_mode),
    createFieldCheck(
      'cadence_guidance.ingest_cutoff_hours',
      expected.ingest_cutoff_hours,
      summary.cadence_guidance.ingest_cutoff_hours
    ),
    createFieldCheck(
      'cadence_guidance.rerun_window_hours',
      expected.rerun_window_hours,
      summary.cadence_guidance.rerun_window_hours
    ),
    createFieldCheck(
      'cadence_guidance.operator_review_window_hours',
      expected.operator_review_window_hours,
      summary.cadence_guidance.operator_review_window_hours
    ),
    createFieldCheck(
      'cadence_guidance.warn_handling',
      expected.warn_handling,
      summary.cadence_guidance.warn_handling
    )
  ];

  // A sendable handoff must match the documented mode example and avoid hard failures.
  const matchedExampleBlock =
    fieldChecks.every((check) => check.status === 'pass') && summary.status !== 'needs_review';
  const requiresOperatorNote = warningChecks.length > 0;
  const noteSamples = recommendedNoteSamples(handoffMode, warningChecks);
  const nextActions: string[] = [];

  if (!matchedExampleBlock) {
    nextActions.push(
      'Rerun ops:recurring-report with the intended cadence/review-profile before operator handoff.'
    );
  }

  if (summary.status === 'needs_review') {
    nextActions.push('Stop the handoff and resolve failing quality checks before any external send.');
  }

  if (requiresOperatorNote) {
    nextActions.push(
      'Complete operator review with docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md and attach an explicit warn note.'
    );
  }

  if (noteSamples.length > 0) {
    nextActions.push(
      `Start the steady-pilot note from ${NOTE_SAMPLE_SET_PATH} and then customize owner/timing fields.`
    );
  }

  if (nextActions.length === 0) {
    nextActions.push('Summary matches the intended example block; proceed to operator review.');
  }

  return {
    handoff_mode: handoffMode,
    matched_example_block: matchedExampleBlock,
    requires_operator_review: summary.status !== 'ready' || warningChecks.length > 0,
    requires_operator_note: requiresOperatorNote,
    warning_checks: warningChecks,
    failing_checks: failingChecks,
    field_checks: fieldChecks,
    note_sample_set_path: noteSamples.length > 0 ? NOTE_SAMPLE_SET_PATH : null,
    recommended_note_samples: noteSamples,
    next_actions: nextActions
  };
}
