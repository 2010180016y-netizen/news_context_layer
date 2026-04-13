import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { join } from 'node:path';

import { buildOperationalArtifactBundle, writeStarterPackArtifacts } from './lib/operational-assets.js';
import { verifyRecurringHandoff } from './lib/recurring-handoff.js';

interface ValidationResult {
  readonly output_path: string;
  readonly changed: boolean;
}

async function readMaybe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function validateBundle(bundle: Awaited<ReturnType<typeof buildOperationalArtifactBundle>>): void {
  const report = bundle.issue_report;
  const briefing = bundle.daily_briefing;
  const starterPack = bundle.starter_pack;

  assert(report.report_type === 'sample_issue_report', 'Issue report type must stay sample_issue_report.');
  assert(report.cluster.article_count >= 6, 'Issue report anchor must keep article_count >= 6.');
  assert(report.cluster.publisher_count >= 6, 'Issue report anchor must keep publisher_count >= 6.');
  assert(report.cluster.coverage_window_hours > 0, 'Issue report anchor must keep a positive coverage window.');
  assert(
    report.summary.selection_reason.reasons.length >= 3,
    'Issue report must keep at least three anchor selection reasons.'
  );
  assert(
    (report.summary.selection_reason.reasons[2]?.length ?? 0) > 20,
    'Issue report must keep a substantive third selection reason for operator explanation.'
  );
  assert(
    report.related_articles.every((article) => new URL(article.url).hostname !== 'demo.news'),
    'Visible related articles must exclude the synthetic demo.news seed article.'
  );
  assert(
    new Set(report.related_articles.map((article) => article.publisher_name)).size >= 5,
    'Issue report must keep a visibly multi-publisher anchor set.'
  );

  assert(briefing.items.length === 3, 'Daily briefing must keep exactly three items.');
  assert(briefing.items[0]?.watchlist_match === true, 'Daily briefing lead item must remain watchlist-linked.');
  assert(
    briefing.items[0]?.latest_articles.length !== undefined &&
      briefing.items[0].latest_articles.length >= 1,
    'Daily briefing lead item must keep at least one visible latest article.'
  );
  assert(
    briefing.items.some((item) => item.label === 'economy / dollar') &&
      briefing.items.some((item) => item.label === 'bridge / coast'),
    'Daily briefing must preserve both the market and public-interest follow-up clusters.'
  );

  assert(
    starterPack.delivery_assets.sample_issue_report.report_id === report.report_id,
    'Starter pack must embed the same sample issue report.'
  );
  assert(
    starterPack.delivery_assets.daily_briefing.items.length === briefing.items.length,
    'Starter pack must embed the same daily briefing item count.'
  );
  assert(
    starterPack.positioning.scope_guardrail.includes('external API') &&
      starterPack.positioning.scope_guardrail.includes('team dashboard'),
    'Starter pack scope guardrail must keep external API and team dashboard out of scope.'
  );
  assert(
    bundle.recurring_report_cycle.status !== 'needs_review',
    'Recurring report cycle summary must not report needs_review.'
  );
  assert(
    bundle.recurring_report_cycle.review_profile === 'standard',
    'Default recurring report cycle should keep the standard review profile.'
  );
  assert(
    bundle.recurring_report_cycle.operating_mode === 'low_volume_pilot',
    'Default recurring report cycle should map weekly cadence to low_volume_pilot.'
  );
  assert(
    bundle.recurring_report_cycle.cadence_guidance.ingest_cutoff_hours === 24 &&
      bundle.recurring_report_cycle.cadence_guidance.rerun_window_hours === 12,
    'Default recurring report cycle must keep the documented low-volume pilot cadence guidance.'
  );
  const handoffVerification = verifyRecurringHandoff(
    bundle.recurring_report_cycle,
    'low_volume_pilot'
  );
  assert(
    handoffVerification.matched_example_block,
    'Default recurring report cycle must keep matching the documented low-volume pilot handoff example.'
  );
  assert(
    bundle.recurring_report_cycle.checks.some(
      (check) => check.id === 'artifact_bundle_consistent' && check.status === 'pass'
    ),
    'Recurring report cycle must confirm the starter pack and report bundle are consistent.'
  );
  assert(
    bundle.recurring_report_cycle.checks.some(
      (check) => check.id === 'briefing_lead_watchlist' && check.status === 'pass'
    ),
    'Recurring report cycle must keep a watchlist-linked briefing lead check.'
  );
  assert(
    bundle.recurring_report_cycle.checks.some(
      (check) => check.id === 'starter_pack_guardrail' && check.status === 'pass'
    ),
    'Recurring report cycle must keep the starter pack guardrail check passing.'
  );
}

async function main(): Promise<void> {
  const outputRoot = join(process.cwd(), 'infra', 'exports');
  const bundle = await buildOperationalArtifactBundle(outputRoot);

  validateBundle(bundle);

  const previousContents = await Promise.all(
    Object.values(bundle.paths).map(async (path) => [path, await readMaybe(path)] as const)
  );
  await writeStarterPackArtifacts(bundle);
  const nextContents = await Promise.all(
    Object.values(bundle.paths).map(async (path) => [path, await readMaybe(path)] as const)
  );

  const previousMap = new Map(previousContents);
  const results: ValidationResult[] = nextContents.map(([path, contents]) => ({
    output_path: path,
    changed: previousMap.get(path) !== contents
  }));
  const changedOutputs = results.filter((entry) => entry.changed).map((entry) => entry.output_path);

  console.log(
    JSON.stringify(
      {
        mode: 'operational_export_validation',
        artifact_policy:
          'Committed infra/exports artifacts remain checked into the repo. CI regenerates them in place and fails if any generated file differs from the committed snapshot.',
        validated_outputs: results,
        anchor_cluster_label: bundle.issue_report.cluster.label,
        anchor_article_count: bundle.issue_report.cluster.article_count,
        anchor_publisher_count: bundle.issue_report.cluster.publisher_count,
        briefing_items: bundle.daily_briefing.items.length,
        recurring_report_cycle_status: bundle.recurring_report_cycle.status,
        recurring_handoff_example_match: verifyRecurringHandoff(
          bundle.recurring_report_cycle,
          'low_volume_pilot'
        ).matched_example_block
      },
      null,
      2
    )
  );

  if (changedOutputs.length > 0) {
    throw new Error(
      `Operational exports were stale. Regenerate and commit: ${changedOutputs.join(', ')}`
    );
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Operational export validation failed: ${message}`);
  process.exitCode = 1;
});
