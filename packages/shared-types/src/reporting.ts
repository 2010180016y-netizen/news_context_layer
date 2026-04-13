import type { ResolveState } from './fixtures.js';

export const REPORT_EXPORT_FORMATS = ['json', 'csv', 'markdown'] as const;
export const REPORT_EXPORT_PURPOSES = ['issue_report', 'daily_briefing', 'starter_pack'] as const;
export const BRIEFING_SOURCES = ['cluster_priority', 'watchlist_priority'] as const;

export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];
export type ReportExportPurpose = (typeof REPORT_EXPORT_PURPOSES)[number];
export type BriefingSource = (typeof BRIEFING_SOURCES)[number];

export interface ReportExportPath {
  readonly purpose: ReportExportPurpose;
  readonly format: ReportExportFormat;
  readonly path: string;
  readonly description: string;
}

export interface ReportArticleDigest {
  readonly article_id: string;
  readonly url: string;
  readonly publisher_name: string;
  readonly title: string;
  readonly published_at: string | null;
  readonly summary_line: string | null;
  readonly score: number | null;
}

export interface DailyBriefingItem {
  readonly cluster_id: string;
  readonly label: string;
  readonly priority_score: number;
  readonly new_article_count: number;
  readonly publisher_count: number;
  readonly latest_articles: readonly ReportArticleDigest[];
  readonly common_entities: readonly string[];
  readonly common_numbers: readonly string[];
  readonly briefing_angle: string;
  readonly freshness_note: string;
  readonly watchlist_match: boolean;
}

export interface DailyBriefingScaffold {
  readonly date: string;
  readonly timezone: string;
  readonly generated_at: string;
  readonly source: BriefingSource;
  readonly items: readonly DailyBriefingItem[];
  readonly export_paths: readonly ReportExportPath[];
}

export interface IssueReportClusterSnapshot {
  readonly cluster_id: string;
  readonly label: string;
  readonly status: string;
  readonly article_count: number;
  readonly publisher_count: number;
  readonly coverage_window_hours: number;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly top_entities: readonly string[];
  readonly top_numbers: readonly string[];
}

export interface IssueReportSummary {
  readonly headline: string;
  readonly angle: string;
  readonly freshness_note: string;
  readonly recommended_action: string;
  readonly common_signals: {
    readonly entities: readonly string[];
    readonly numbers: readonly string[];
  };
  readonly selection_reason: {
    readonly readiness_score: number;
    readonly reasons: readonly string[];
  };
}

export interface SampleIssueReport {
  readonly report_id: string;
  readonly generated_at: string;
  readonly report_type: 'sample_issue_report';
  readonly resolve_state: ResolveState;
  readonly cluster: IssueReportClusterSnapshot;
  readonly summary: IssueReportSummary;
  readonly related_articles: readonly ReportArticleDigest[];
  readonly export_paths: readonly ReportExportPath[];
}

export interface B2BStarterPackDraft {
  readonly generated_at: string;
  readonly package_name: string;
  readonly positioning: {
    readonly headline: string;
    readonly subheadline: string;
    readonly proof_points: readonly string[];
    readonly immediate_value: string;
    readonly repeat_use_value: string;
    readonly founder_pass_reason: string;
    readonly b2b_demo_value: string;
    readonly scope_guardrail: string;
  };
  readonly delivery_assets: {
    readonly sample_issue_report: SampleIssueReport;
    readonly daily_briefing: DailyBriefingScaffold;
  };
  readonly support_flow: {
    readonly owner: string;
    readonly beta_channel_status: 'draft';
    readonly intake_steps: readonly string[];
    readonly response_sla: string;
  };
  readonly sales_notes: readonly string[];
  readonly export_paths: readonly ReportExportPath[];
}
