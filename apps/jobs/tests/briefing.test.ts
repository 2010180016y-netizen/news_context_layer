import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseResolveBenchmarkDataset } from '../../../packages/shared-types/src/fixtures.js';
import {
  buildB2BStarterPackDraft,
  buildDailyBriefingScaffold,
  buildSampleIssueReport
} from '../src/index.js';
import { FileNewsContextStore } from '../../api/src/repositories/file-store.js';
import { appendResolveBenchmarkCaseCandidates } from '../../api/src/services/resolve-benchmark-support.js';
import { ResolveService } from '../../api/src/services/resolve-service.js';

const tempDirs: string[] = [];

async function createTempStore(): Promise<FileNewsContextStore> {
  const dir = await mkdtemp(join(tmpdir(), 'news-context-briefing-'));
  tempDirs.push(dir);
  return new FileNewsContextStore(join(dir, 'store.json'));
}

async function readDataset(relativePath: string) {
  const fileUrl = new URL(`../../../${relativePath}`, import.meta.url);
  const contents = await readFile(fileUrl, 'utf8');
  return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
}

describe('briefing and report builders', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('builds a meeting-ready daily briefing scaffold and sample issue report from demo data', async () => {
    const dataset = await readDataset('sample-fixtures/demo-report-dataset.json');
    const store = await createTempStore();

    for (const benchmarkCase of dataset.cases) {
      await appendResolveBenchmarkCaseCandidates(store, benchmarkCase);
    }

    const resolveService = new ResolveService(store);
    const clusterIds: string[] = [];

    for (const benchmarkCase of dataset.cases) {
      const response = await resolveService.resolve(benchmarkCase.request);
      clusterIds.push(response.cluster_id);
    }

    await store.ensureDevice({
      anon_id: 'anon-briefing-test-001',
      device_id: 'device-briefing-test-001',
      app_version: 'test'
    });
    await store.createWatchlist(
      {
        anon_id: 'anon-briefing-test-001',
        device_id: 'device-briefing-test-001',
        app_version: 'test'
      },
      {
        cluster_id: clusterIds[0] ?? '',
        label: 'Morning test watchlist',
        notifications_enabled: true
      }
    );

    const state = await store.readState();
    const issueReport = buildSampleIssueReport(state, {
      generated_at: '2026-04-10T23:30:00.000+09:00',
      export_paths: [
        {
          purpose: 'issue_report',
          format: 'json',
          path: 'infra/exports/reports/sample-issue-report.json',
          description: 'test'
        }
      ]
    });
    const dailyBriefing = buildDailyBriefingScaffold(state, {
      briefing_date: '2026-04-10',
      timezone: 'Asia/Seoul',
      generated_at: '2026-04-10T23:00:00.000+09:00',
      watchlist_device_id: 'device-briefing-test-001',
      export_paths: [
        {
          purpose: 'daily_briefing',
          format: 'json',
          path: 'infra/exports/briefings/daily-briefing-sample.json',
          description: 'test'
        }
      ]
    });
    const starterPack = buildB2BStarterPackDraft({
      sample_issue_report: issueReport,
      daily_briefing: dailyBriefing,
      options: {
        generated_at: '2026-04-10T23:35:00.000+09:00',
        export_paths: [
          {
            purpose: 'starter_pack',
            format: 'json',
            path: 'infra/exports/b2b/starter-pack-sample.json',
            description: 'test'
          }
        ]
      }
    });

    expect(clusterIds).toContain(issueReport.cluster.cluster_id);
    expect(issueReport.cluster.article_count).toBeGreaterThanOrEqual(6);
    expect(issueReport.cluster.publisher_count).toBeGreaterThanOrEqual(6);
    expect(issueReport.cluster.coverage_window_hours).toBeGreaterThan(0);
    expect(issueReport.related_articles.length).toBeGreaterThanOrEqual(4);
    expect(issueReport.related_articles.every((article) => article.article_id.startsWith('demo-semi-'))).toBe(
      true
    );
    expect(issueReport.related_articles[0]?.article_id).toBe('demo-semi-001');
    expect(new Set(issueReport.related_articles.map((article) => article.publisher_name)).size).toBeGreaterThanOrEqual(5);
    expect(issueReport.summary.common_signals.entities.length).toBeGreaterThanOrEqual(2);
    expect(issueReport.summary.selection_reason.readiness_score).toBeGreaterThanOrEqual(0.75);
    expect(issueReport.summary.selection_reason.reasons).toHaveLength(3);
    expect(issueReport.summary.selection_reason.reasons[0]).toContain('cross-source comparison');
    expect(issueReport.summary.selection_reason.reasons[2]?.length ?? 0).toBeGreaterThan(20);
    expect(issueReport.summary.recommended_action).toContain('watchlist');
    expect(issueReport.summary.recommended_action).toContain('daily briefing');

    expect(dailyBriefing.items.length).toBe(3);
    expect(dailyBriefing.items[0]?.watchlist_match).toBe(true);
    expect(dailyBriefing.items[0]?.latest_articles[0]?.article_id.startsWith('demo-semi-')).toBe(true);
    expect(dailyBriefing.items.every((item) => item.publisher_count >= 2)).toBe(true);
    expect(dailyBriefing.items.every((item) => item.briefing_angle.length > 20)).toBe(true);
    expect(dailyBriefing.items.every((item) => item.freshness_note.length > 10)).toBe(true);
    expect(dailyBriefing.items.every((item) => item.latest_articles.length >= 1)).toBe(true);
    expect(dailyBriefing.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(['economy / dollar', 'bridge / coast'])
    );

    expect(starterPack.delivery_assets.sample_issue_report.report_id).toBe(issueReport.report_id);
    expect(starterPack.delivery_assets.daily_briefing.items.length).toBe(dailyBriefing.items.length);
    expect(starterPack.positioning.proof_points[0]).toBe(
      issueReport.summary.selection_reason.reasons[0]
    );
    expect(starterPack.positioning.proof_points[1]).toContain(dailyBriefing.items[0]?.briefing_angle ?? '');
    expect(starterPack.positioning.immediate_value).toContain('출처 카드');
    expect(starterPack.positioning.repeat_use_value).toContain('watchlist');
    expect(starterPack.positioning.founder_pass_reason).toContain('Founder Pass');
    expect(starterPack.positioning.b2b_demo_value).toContain('Starter Report');
    expect(starterPack.positioning.scope_guardrail).toContain('external API');
    expect(starterPack.sales_notes[0]).toContain(issueReport.summary.selection_reason.reasons[0]);
    expect(starterPack.sales_notes[1]).toContain('Founder Pass');
    expect(starterPack.sales_notes[2]).toContain('team dashboard');
  });
});
