import { join } from 'node:path';

import { buildOperationalArtifactBundle, writeStarterPackArtifacts } from './lib/operational-assets.js';

type RecurringReportCadence = 'weekly' | 'twice_weekly';
type RecurringReportReviewProfile = 'standard' | 'executive_handoff';

function resolveCadence(argv: readonly string[]): RecurringReportCadence {
  const rawCadence = argv
    .find((argument) => argument.startsWith('--cadence='))
    ?.slice('--cadence='.length)
    ?.trim();

  if (rawCadence === undefined || rawCadence === '') {
    return 'weekly';
  }

  if (rawCadence === 'weekly' || rawCadence === 'twice_weekly') {
    return rawCadence;
  }

  throw new Error(`Unsupported recurring report cadence: ${rawCadence}`);
}

function resolveReviewProfile(argv: readonly string[]): RecurringReportReviewProfile {
  const rawProfile = argv
    .find((argument) => argument.startsWith('--review-profile='))
    ?.slice('--review-profile='.length)
    ?.trim();

  if (rawProfile === undefined || rawProfile === '') {
    return 'standard';
  }

  if (rawProfile === 'standard' || rawProfile === 'executive_handoff') {
    return rawProfile;
  }

  throw new Error(`Unsupported recurring report review profile: ${rawProfile}`);
}

async function main(): Promise<void> {
  const cadence = resolveCadence(process.argv.slice(2));
  const reviewProfile = resolveReviewProfile(process.argv.slice(2));
  const bundle = await buildOperationalArtifactBundle(join(process.cwd(), 'infra', 'exports'), {
    recurring_report_cadence: cadence,
    recurring_report_review_profile: reviewProfile
  });
  await writeStarterPackArtifacts(bundle);

  console.log(
    JSON.stringify(
      {
        mode: 'recurring_report_cycle',
        cadence,
        review_profile: reviewProfile,
        operating_mode: bundle.recurring_report_cycle.operating_mode,
        status: bundle.recurring_report_cycle.status,
        recurring_report_cycle_json: bundle.paths.recurring_report_cycle_json,
        starter_pack_json: bundle.paths.starter_pack_json,
        sample_issue_report_json: bundle.paths.issue_report_json,
        daily_briefing_json: bundle.paths.daily_briefing_json,
        cadence_guidance: bundle.recurring_report_cycle.cadence_guidance,
        failing_checks: bundle.recurring_report_cycle.checks
          .filter((check) => check.status === 'fail')
          .map((check) => check.id),
        warning_checks: bundle.recurring_report_cycle.checks
          .filter((check) => check.status === 'warn')
          .map((check) => check.id)
      },
      null,
      2
    )
  );

  if (bundle.recurring_report_cycle.status === 'needs_review') {
    throw new Error('Recurring report cycle has failing quality checks.');
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Recurring report cycle failed: ${message}`);
  process.exitCode = 1;
});
