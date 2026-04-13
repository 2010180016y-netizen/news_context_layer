import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildOperationalArtifactBundle } from '../../../scripts/lib/operational-assets.js';
import { verifyRecurringHandoff } from '../../../scripts/lib/recurring-handoff.js';

const tempDirs: string[] = [];

async function createOutputRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-recurring-handoff-'));
  tempDirs.push(dir);
  return dir;
}

describe('verifyRecurringHandoff', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('matches the documented steady-pilot example block and recommends note samples', async () => {
    const outputRoot = await createOutputRoot();
    const bundle = await buildOperationalArtifactBundle(outputRoot, {
      recurring_report_cadence: 'twice_weekly',
      recurring_report_review_profile: 'standard'
    });

    const verification = verifyRecurringHandoff(bundle.recurring_report_cycle, 'steady_pilot');

    expect(verification.matched_example_block).toBe(true);
    expect(verification.requires_operator_note).toBe(true);
    expect(verification.warning_checks).toContain('operator_follow_up_path');
    expect(verification.recommended_note_samples).toContain('steady_pilot.operator_follow_up.default');
    expect(verification.recommended_note_samples).toContain('steady_pilot.anchor_clarity.reinforcement');
    expect(verification.recommended_note_samples).toContain('steady_pilot.repeat_use_narrative.follow_up');
  });

  it('matches the documented executive-handoff example block', async () => {
    const outputRoot = await createOutputRoot();
    const bundle = await buildOperationalArtifactBundle(outputRoot, {
      recurring_report_cadence: 'twice_weekly',
      recurring_report_review_profile: 'executive_handoff'
    });

    const verification = verifyRecurringHandoff(
      bundle.recurring_report_cycle,
      'higher_touch_executive_handoff'
    );

    expect(verification.matched_example_block).toBe(true);
    expect(verification.field_checks.every((check) => check.status === 'pass')).toBe(true);
    expect(verification.recommended_note_samples).toEqual([]);
  });

  it('fails the comparison when the summary fields do not match the intended mode', async () => {
    const outputRoot = await createOutputRoot();
    const bundle = await buildOperationalArtifactBundle(outputRoot);

    const verification = verifyRecurringHandoff(
      bundle.recurring_report_cycle,
      'higher_touch_executive_handoff'
    );

    expect(verification.matched_example_block).toBe(false);
    expect(verification.field_checks.some((check) => check.status === 'fail')).toBe(true);
  });
});
