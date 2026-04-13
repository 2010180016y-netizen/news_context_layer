import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildOperationalArtifactBundle } from '../../../scripts/lib/operational-assets.js';

const tempDirs: string[] = [];

async function createOutputRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-recurring-report-'));
  tempDirs.push(dir);
  return dir;
}

describe('recurring report cycle summary', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('builds a recurring-report-ready summary from the starter pack bundle', async () => {
    const outputRoot = await createOutputRoot();
    const bundle = await buildOperationalArtifactBundle(outputRoot, {
      recurring_report_cadence: 'twice_weekly',
      recurring_report_review_profile: 'executive_handoff'
    });

    expect(bundle.recurring_report_cycle.cadence).toBe('twice_weekly');
    expect(bundle.recurring_report_cycle.review_profile).toBe('executive_handoff');
    expect(bundle.recurring_report_cycle.operating_mode).toBe('higher_touch_executive_handoff');
    expect(bundle.recurring_report_cycle.status).toBe('ready_with_follow_up');
    expect(bundle.recurring_report_cycle.source).toBe('starter_pack_export_bundle');
    expect(bundle.recurring_report_cycle.cadence_guidance.ingest_cutoff_hours).toBe(6);
    expect(bundle.recurring_report_cycle.cadence_guidance.rerun_window_hours).toBe(3);
    expect(bundle.recurring_report_cycle.cadence_guidance.operator_review_window_hours).toBe(6);
    expect(bundle.recurring_report_cycle.cadence_guidance.warn_handling.includes('owner-signed')).toBe(true);
    expect(bundle.recurring_report_cycle.artifact_paths.starter_pack_json.endsWith('/b2b/starter-pack-sample.json')).toBe(
      true
    );
    expect(
      bundle.recurring_report_cycle.checks.some(
        (check) => check.id === 'artifact_bundle_consistent' && check.status === 'pass'
      )
    ).toBe(true);
    expect(bundle.recurring_report_cycle.checks.some((check) => check.id === 'anchor_cluster_ready')).toBe(true);
    expect(
      bundle.recurring_report_cycle.checks.some(
        (check) => check.id === 'briefing_lead_watchlist' && check.status === 'pass'
      )
    ).toBe(true);
    expect(
      bundle.recurring_report_cycle.checks.some(
        (check) => check.id === 'operator_follow_up_path' && check.status === 'warn'
      )
    ).toBe(true);
    expect(
      bundle.recurring_report_cycle.next_actions[0]?.includes('operator follow-up') ?? false
    ).toBe(true);
  });
});
