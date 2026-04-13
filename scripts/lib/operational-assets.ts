import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

import type {
  B2BStarterPackDraft,
  DailyBriefingScaffold,
  ReportExportPath,
  ResolveBenchmarkDataset,
  SampleIssueReport
} from '../../packages/shared-types/src/index.js';
import { parseResolveBenchmarkDataset } from '../../packages/shared-types/src/index.js';
import { buildB2BStarterPackDraft, buildDailyBriefingScaffold, buildSampleIssueReport } from '../../apps/jobs/src/index.js';
import { FileNewsContextStore } from '../../apps/api/src/repositories/file-store.js';
import { appendResolveBenchmarkCaseCandidates } from '../../apps/api/src/services/resolve-benchmark-support.js';
import { ResolveService } from '../../apps/api/src/services/resolve-service.js';

const REPO_ROOT = resolve(process.cwd());
// Keep the operational export corpus separate from the resolve benchmark so we can improve
// meeting realism and operator readability without silently moving ranking or latency budgets.
const DEMO_REPORT_DATASET_RELATIVE_PATH = ['sample-fixtures', 'demo-report-dataset.json'] as const;

export interface OperationalArtifactBundle {
  readonly issue_report: SampleIssueReport;
  readonly daily_briefing: DailyBriefingScaffold;
  readonly starter_pack: B2BStarterPackDraft;
  readonly recurring_report_cycle: RecurringReportCycleSummary;
  readonly paths: {
    readonly issue_report_json: string;
    readonly issue_report_csv: string;
    readonly daily_briefing_json: string;
    readonly starter_pack_json: string;
    readonly starter_pack_csv: string;
    readonly recurring_report_cycle_json: string;
    readonly manifest_json: string;
  };
}

export type RecurringReportCadence = 'weekly' | 'twice_weekly';
export type RecurringReportReviewProfile = 'standard' | 'executive_handoff';
export type RecurringReportOperatingMode =
  | 'low_volume_pilot'
  | 'steady_pilot'
  | 'higher_touch_executive_handoff';
export type RecurringReportCheckStatus = 'pass' | 'warn' | 'fail';
export type RecurringReportCycleStatus = 'ready' | 'ready_with_follow_up' | 'needs_review';

export interface RecurringReportQualityCheck {
  readonly id: string;
  readonly label: string;
  readonly status: RecurringReportCheckStatus;
  readonly detail: string;
}

export interface RecurringReportCycleSummary {
  readonly generated_at: string;
  readonly cadence: RecurringReportCadence;
  readonly review_profile: RecurringReportReviewProfile;
  readonly operating_mode: RecurringReportOperatingMode;
  readonly status: RecurringReportCycleStatus;
  readonly source: 'starter_pack_export_bundle';
  readonly cadence_guidance: {
    readonly ingest_cutoff_hours: number;
    readonly rerun_window_hours: number;
    readonly operator_review_window_hours: number;
    readonly skip_ingest_rule: string;
    readonly warn_handling: string;
  };
  readonly artifact_paths: {
    readonly sample_issue_report_json: string;
    readonly daily_briefing_json: string;
    readonly starter_pack_json: string;
  };
  readonly checks: readonly RecurringReportQualityCheck[];
  readonly next_actions: readonly string[];
}

export interface BuildOperationalArtifactBundleOptions {
  readonly recurring_report_cadence?: RecurringReportCadence | undefined;
  readonly recurring_report_review_profile?: RecurringReportReviewProfile | undefined;
}

function toPosixRelative(fullPath: string): string {
  return relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
}

function createStableClusterId(signature: string): string {
  return `demo-cluster-${createHash('sha256').update(signature).digest('hex').slice(0, 16)}`;
}

function createClusterSignature(params: {
  label: string;
  entities: readonly string[];
  numbers: readonly string[];
}): string {
  return JSON.stringify({
    label: params.label,
    entities: [...params.entities],
    numbers: [...params.numbers]
  });
}

function toCsvValue(value: string | number | null): string {
  if (value === null) {
    return '';
  }

  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '""');

  if (/[",\n]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}

function createIssueReportCsv(report: SampleIssueReport): string {
  const header = [
    'report_id',
    'cluster_id',
    'cluster_label',
    'article_id',
    'publisher_name',
    'title',
    'published_at',
    'score'
  ].join(',');
  const rows = report.related_articles.map((article) =>
    [
      report.report_id,
      report.cluster.cluster_id,
      report.cluster.label,
      article.article_id,
      article.publisher_name,
      article.title,
      article.published_at,
      article.score
    ]
      .map((value) => toCsvValue(value))
      .join(',')
  );

  return [header, ...rows].join('\n');
}

function createStarterPackCsv(starterPack: B2BStarterPackDraft): string {
  const rows = [
    ['section', 'value'],
    ['package_name', starterPack.package_name],
    ['headline', starterPack.positioning.headline],
    ['subheadline', starterPack.positioning.subheadline],
    ['immediate_value', starterPack.positioning.immediate_value],
    ['repeat_use_value', starterPack.positioning.repeat_use_value],
    ['founder_pass_reason', starterPack.positioning.founder_pass_reason],
    ['b2b_demo_value', starterPack.positioning.b2b_demo_value],
    ['scope_guardrail', starterPack.positioning.scope_guardrail],
    ['sample_issue_report_id', starterPack.delivery_assets.sample_issue_report.report_id],
    ['anchor_cluster_label', starterPack.delivery_assets.sample_issue_report.cluster.label],
    [
      'anchor_readiness_score',
      String(starterPack.delivery_assets.sample_issue_report.summary.selection_reason.readiness_score)
    ],
    [
      'anchor_reason_1',
      starterPack.delivery_assets.sample_issue_report.summary.selection_reason.reasons[0] ?? ''
    ],
    [
      'briefing_lead_angle',
      starterPack.delivery_assets.daily_briefing.items[0]?.briefing_angle ?? ''
    ],
    ['briefing_item_count', String(starterPack.delivery_assets.daily_briefing.items.length)],
    ['support_owner', starterPack.support_flow.owner],
    ['support_sla', starterPack.support_flow.response_sla]
  ];

  return rows.map((row) => row.map((value) => toCsvValue(value)).join(',')).join('\n');
}

function createCheck(
  id: string,
  label: string,
  status: RecurringReportCheckStatus,
  detail: string
): RecurringReportQualityCheck {
  return {
    id,
    label,
    status,
    detail
  };
}

function buildRecurringReportCycleSummary(params: {
  generatedAt: string;
  cadence: RecurringReportCadence;
  reviewProfile: RecurringReportReviewProfile;
  issueReport: SampleIssueReport;
  dailyBriefing: DailyBriefingScaffold;
  starterPack: B2BStarterPackDraft;
  paths: OperationalArtifactBundle['paths'];
}): RecurringReportCycleSummary {
  const cadenceGuidance = resolveRecurringCadenceGuidance(params.cadence, params.reviewProfile);
  const leadItem = params.dailyBriefing.items[0];
  const artifactBundleConsistent =
    params.starterPack.delivery_assets.sample_issue_report.report_id === params.issueReport.report_id &&
    params.starterPack.delivery_assets.sample_issue_report.cluster.cluster_id === params.issueReport.cluster.cluster_id &&
    params.starterPack.delivery_assets.daily_briefing.items.length === params.dailyBriefing.items.length &&
    params.starterPack.delivery_assets.daily_briefing.items[0]?.label === leadItem?.label;
  // These check IDs intentionally mirror the operator-facing pilot review domains so the
  // recurring JSON summary can act as a machine-readable companion to the human checklist.
  const checks: RecurringReportQualityCheck[] = [
    createCheck(
      'artifact_bundle_consistent',
      'Starter pack, issue report, and daily briefing still describe the same bundle.',
      artifactBundleConsistent ? 'pass' : 'fail',
      `report_id=${params.issueReport.report_id}, embedded_report_id=${params.starterPack.delivery_assets.sample_issue_report.report_id}, briefing_items=${params.dailyBriefing.items.length}, embedded_briefing_items=${params.starterPack.delivery_assets.daily_briefing.items.length}, lead_label=${leadItem?.label ?? 'missing'}`
    ),
    createCheck(
      'anchor_cluster_ready',
      'Anchor cluster remains meeting-ready.',
      params.issueReport.cluster.article_count >= 6 && params.issueReport.cluster.publisher_count >= 6
        ? 'pass'
        : 'fail',
      `article_count=${params.issueReport.cluster.article_count}, publisher_count=${params.issueReport.cluster.publisher_count}, coverage_window_hours=${params.issueReport.cluster.coverage_window_hours}`
    ),
    createCheck(
      'selection_reasons_present',
      'Sample issue report keeps explicit anchor rationale.',
      params.issueReport.summary.selection_reason.reasons.length >= 3 ? 'pass' : 'fail',
      `selection_reasons=${params.issueReport.summary.selection_reason.reasons.length}, readiness_score=${params.issueReport.summary.selection_reason.readiness_score}`
    ),
    createCheck(
      'briefing_lead_watchlist',
      'Daily briefing lead item remains watchlist-linked.',
      leadItem?.watchlist_match === true ? 'pass' : 'fail',
      leadItem === undefined
        ? 'No lead briefing item was generated.'
        : `lead_label=${leadItem.label}, watchlist_match=${String(leadItem.watchlist_match)}, new_article_count=${leadItem.new_article_count}`
    ),
    createCheck(
      'briefing_depth',
      'Recurring report bundle keeps enough briefing depth for repeated delivery.',
      params.dailyBriefing.items.length >= 3 ? 'pass' : 'fail',
      `briefing_items=${params.dailyBriefing.items.length}`
    ),
    createCheck(
      'starter_pack_guardrail',
      'Starter pack still keeps dashboard/API claims out of scope.',
      params.starterPack.positioning.scope_guardrail.includes('external API') &&
      params.starterPack.positioning.scope_guardrail.includes('team dashboard')
        ? 'pass'
        : 'fail',
      params.starterPack.positioning.scope_guardrail
    ),
    createCheck(
      'operator_follow_up_path',
      'Support flow can be reviewed before pilot delivery.',
      params.starterPack.support_flow.beta_channel_status === 'draft' ? 'warn' : 'pass',
      `support_owner=${params.starterPack.support_flow.owner}, beta_channel_status=${params.starterPack.support_flow.beta_channel_status}`
    )
  ];
  const hasFailure = checks.some((check) => check.status === 'fail');
  const hasWarning = checks.some((check) => check.status === 'warn');
  const nextActions = [
    `For this ${cadenceGuidance.operatingMode} run, finish ingest within ${cadenceGuidance.ingestCutoffHours}h of handoff and keep reruns inside ${cadenceGuidance.rerunWindowHours}h when the corpus changes.`,
    'Review the generated sample issue report before any recurring client handoff.',
    'Confirm the lead daily briefing item still reads clearly as a repeat-use angle.',
    'Keep dashboard/API language out of the delivery deck unless a later gate explicitly unlocks it.'
  ];

  if (hasFailure) {
    nextActions.unshift(
      'Do not send the recurring report bundle until the failing quality checks are resolved.'
    );
  } else if (hasWarning) {
    nextActions.unshift(
      'Recurring report bundle is usable, but operator follow-up should confirm the support/contact path for this pilot.'
    );
  }

  return {
    generated_at: params.generatedAt,
    cadence: params.cadence,
    review_profile: params.reviewProfile,
    operating_mode: cadenceGuidance.operatingMode,
    status: hasFailure ? 'needs_review' : hasWarning ? 'ready_with_follow_up' : 'ready',
    source: 'starter_pack_export_bundle',
    cadence_guidance: {
      ingest_cutoff_hours: cadenceGuidance.ingestCutoffHours,
      rerun_window_hours: cadenceGuidance.rerunWindowHours,
      operator_review_window_hours: cadenceGuidance.operatorReviewWindowHours,
      skip_ingest_rule: cadenceGuidance.skipIngestRule,
      warn_handling: cadenceGuidance.warnHandling
    },
    artifact_paths: {
      sample_issue_report_json: toPosixRelative(params.paths.issue_report_json),
      daily_briefing_json: toPosixRelative(params.paths.daily_briefing_json),
      starter_pack_json: toPosixRelative(params.paths.starter_pack_json)
    },
    checks,
    next_actions: nextActions
  };
}

function resolveRecurringCadenceGuidance(
  cadence: RecurringReportCadence,
  reviewProfile: RecurringReportReviewProfile
): {
  readonly operatingMode: RecurringReportOperatingMode;
  readonly ingestCutoffHours: number;
  readonly rerunWindowHours: number;
  readonly operatorReviewWindowHours: number;
  readonly skipIngestRule: string;
  readonly warnHandling: string;
} {
  if (reviewProfile === 'executive_handoff') {
    return {
      operatingMode: 'higher_touch_executive_handoff',
      ingestCutoffHours: 6,
      rerunWindowHours: 3,
      operatorReviewWindowHours: 6,
      skipIngestRule:
        'Skip ingest only when reusing the same vetted snapshot inside the same executive handoff window.',
      warnHandling:
        'Do not hand off until every warn is cleared or explicitly owner-signed for executive delivery.'
    };
  }

  if (cadence === 'twice_weekly') {
    return {
      operatingMode: 'steady_pilot',
      ingestCutoffHours: 12,
      rerunWindowHours: 6,
      operatorReviewWindowHours: 12,
      skipIngestRule:
        'Skip ingest only when the vetted corpus has not changed since the prior steady-pilot run.',
      warnHandling: 'Warns may ship only with an explicit operator note and follow-up owner.'
    };
  }

  return {
    operatingMode: 'low_volume_pilot',
    ingestCutoffHours: 24,
    rerunWindowHours: 12,
    operatorReviewWindowHours: 24,
    skipIngestRule:
      'Skip ingest only when the vetted corpus is unchanged for the current low-volume pilot window.',
    warnHandling: 'Warns may ship only with an explicit operator note and follow-up owner.'
  };
}

function buildStableClusterIdMap(params: {
  issue_report: SampleIssueReport;
  daily_briefing: DailyBriefingScaffold;
}): Map<string, string> {
  const clusterIdMap = new Map<string, string>();
  const registerCluster = (clusterId: string, label: string, entities: readonly string[], numbers: readonly string[]) => {
    const stableId = createStableClusterId(
      createClusterSignature({
        label,
        entities,
        numbers
      })
    );
    clusterIdMap.set(clusterId, stableId);
  };

  registerCluster(
    params.issue_report.cluster.cluster_id,
    params.issue_report.cluster.label,
    params.issue_report.cluster.top_entities,
    params.issue_report.cluster.top_numbers
  );

  for (const item of params.daily_briefing.items) {
    registerCluster(item.cluster_id, item.label, item.common_entities, item.common_numbers);
  }

  return clusterIdMap;
}

function stabilizeIssueReport(
  issueReport: SampleIssueReport,
  clusterIdMap: ReadonlyMap<string, string>
): SampleIssueReport {
  const stableClusterId = clusterIdMap.get(issueReport.cluster.cluster_id) ?? issueReport.cluster.cluster_id;

  return {
    ...issueReport,
    report_id: `sample-issue-report-${stableClusterId}`,
    cluster: {
      ...issueReport.cluster,
      cluster_id: stableClusterId
    }
  };
}

function stabilizeDailyBriefing(
  dailyBriefing: DailyBriefingScaffold,
  clusterIdMap: ReadonlyMap<string, string>
): DailyBriefingScaffold {
  return {
    ...dailyBriefing,
    items: dailyBriefing.items.map((item) => ({
      ...item,
      cluster_id: clusterIdMap.get(item.cluster_id) ?? item.cluster_id
    }))
  };
}

async function readResolveDataset(relativePathParts: readonly string[]): Promise<ResolveBenchmarkDataset> {
  const contents = await readFile(join(REPO_ROOT, ...relativePathParts), 'utf8');
  return parseResolveBenchmarkDataset(JSON.parse(contents) as unknown);
}

async function buildDemoStoreState(): Promise<{
  readonly state: Awaited<ReturnType<FileNewsContextStore['readState']>>;
}> {
  const tempDir = await mkdtemp(join(tmpdir(), 'news-context-ops-'));

  try {
    const store = new FileNewsContextStore(join(tempDir, 'store.json'));
    const dataset = await readResolveDataset(DEMO_REPORT_DATASET_RELATIVE_PATH);

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
      anon_id: 'anon-ops-demo-001',
      device_id: 'device-ops-demo-001',
      app_version: 'ops-demo'
    });
    const primaryClusterId = clusterIds[0];

    if (primaryClusterId === undefined) {
      throw new Error('Could not determine a primary cluster from the benchmark dataset.');
    }

    await store.createWatchlist(
      {
        anon_id: 'anon-ops-demo-001',
        device_id: 'device-ops-demo-001',
        app_version: 'ops-demo'
      },
      {
        cluster_id: primaryClusterId,
        label: 'Ops demo watchlist',
        notifications_enabled: true
      }
    );

    const state = await store.readState();

    return {
      state
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, 'utf8');
}

function buildExportPaths(outputRoot: string): OperationalArtifactBundle['paths'] {
  return {
    issue_report_json: join(outputRoot, 'reports', 'sample-issue-report.json'),
    issue_report_csv: join(outputRoot, 'reports', 'sample-issue-report.csv'),
    daily_briefing_json: join(outputRoot, 'briefings', 'daily-briefing-sample.json'),
    starter_pack_json: join(outputRoot, 'b2b', 'starter-pack-sample.json'),
    starter_pack_csv: join(outputRoot, 'b2b', 'starter-pack-sample.csv'),
    recurring_report_cycle_json: join(outputRoot, 'b2b', 'recurring-report-cycle-summary.json'),
    manifest_json: join(outputRoot, 'manifest', 'operational-assets.manifest.json')
  };
}

export async function buildOperationalArtifactBundle(
  outputRoot: string,
  options: BuildOperationalArtifactBundleOptions = {}
): Promise<OperationalArtifactBundle> {
  const { state } = await buildDemoStoreState();
  const paths = buildExportPaths(outputRoot);
  const issueReportPaths: ReportExportPath[] = [
    {
      purpose: 'issue_report',
      format: 'json',
      path: toPosixRelative(paths.issue_report_json),
      description: '내부 데모와 B2B 미팅용 sample issue report JSON.'
    },
    {
      purpose: 'issue_report',
      format: 'csv',
      path: toPosixRelative(paths.issue_report_csv),
      description: '분석/공유용 handoff에 쓰는 sample issue report CSV.'
    }
  ];
  const dailyBriefingPaths: ReportExportPath[] = [
    {
      purpose: 'daily_briefing',
      format: 'json',
      path: toPosixRelative(paths.daily_briefing_json),
      description: 'story cluster 기반 daily briefing scaffold JSON.'
    }
  ];
  const starterPackPaths: ReportExportPath[] = [
    {
      purpose: 'starter_pack',
      format: 'json',
      path: toPosixRelative(paths.starter_pack_json),
      description: '내부 세일즈와 고객 탐색용 B2B starter pack draft JSON.'
    },
    {
      purpose: 'starter_pack',
      format: 'csv',
      path: toPosixRelative(paths.starter_pack_csv),
      description: 'starter pack 핵심 문구를 빠르게 공유하는 compact CSV.'
    }
  ];
  const issueReport = buildSampleIssueReport(state, {
    generated_at: '2026-04-10T23:30:00.000+09:00',
    resolve_state: 'success_full',
    export_paths: issueReportPaths
  });
  const dailyBriefing = buildDailyBriefingScaffold(state, {
    briefing_date: '2026-04-10',
    timezone: 'Asia/Seoul',
    generated_at: '2026-04-10T23:00:00.000+09:00',
    max_items: 3,
    watchlist_device_id: 'device-ops-demo-001',
    export_paths: dailyBriefingPaths
  });
  const clusterIdMap = buildStableClusterIdMap({
    issue_report: issueReport,
    daily_briefing: dailyBriefing
  });
  const stableIssueReport = stabilizeIssueReport(issueReport, clusterIdMap);
  const stableDailyBriefing = stabilizeDailyBriefing(dailyBriefing, clusterIdMap);
  const starterPack = buildB2BStarterPackDraft({
    sample_issue_report: stableIssueReport,
    daily_briefing: stableDailyBriefing,
    options: {
      generated_at: '2026-04-10T23:35:00.000+09:00',
      export_paths: starterPackPaths
    }
  });
  const recurringReportCycle = buildRecurringReportCycleSummary({
    generatedAt: starterPack.generated_at,
    cadence: options.recurring_report_cadence ?? 'weekly',
    reviewProfile: options.recurring_report_review_profile ?? 'standard',
    issueReport: stableIssueReport,
    dailyBriefing: stableDailyBriefing,
    starterPack,
    paths
  });

  return {
    issue_report: stableIssueReport,
    daily_briefing: stableDailyBriefing,
    starter_pack: starterPack,
    recurring_report_cycle: recurringReportCycle,
    paths
  };
}

export async function writeIssueReportArtifacts(bundle: OperationalArtifactBundle): Promise<void> {
  await writeJson(bundle.paths.issue_report_json, bundle.issue_report);
  await writeText(bundle.paths.issue_report_csv, `${createIssueReportCsv(bundle.issue_report)}\n`);
  await writeJson(bundle.paths.daily_briefing_json, bundle.daily_briefing);
}

export async function writeStarterPackArtifacts(bundle: OperationalArtifactBundle): Promise<void> {
  await writeIssueReportArtifacts(bundle);
  await writeJson(bundle.paths.starter_pack_json, bundle.starter_pack);
  await writeText(bundle.paths.starter_pack_csv, `${createStarterPackCsv(bundle.starter_pack)}\n`);
  await writeJson(bundle.paths.recurring_report_cycle_json, bundle.recurring_report_cycle);
  await writeJson(bundle.paths.manifest_json, {
    generated_at: bundle.starter_pack.generated_at,
    outputs: {
      issue_report_json: toPosixRelative(bundle.paths.issue_report_json),
      issue_report_csv: toPosixRelative(bundle.paths.issue_report_csv),
      daily_briefing_json: toPosixRelative(bundle.paths.daily_briefing_json),
      starter_pack_json: toPosixRelative(bundle.paths.starter_pack_json),
      starter_pack_csv: toPosixRelative(bundle.paths.starter_pack_csv),
      recurring_report_cycle_json: toPosixRelative(bundle.paths.recurring_report_cycle_json)
    },
    note: '이 export 경로는 결정론적 meeting-ready demo corpus를 기반으로 한 내부 데모와 파일럿 handoff용 자산이며, beta에서 external API, team dashboard, 최종 Analyst entitlement를 약속하지 않는다.'
  });
}
