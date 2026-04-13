import type {
  B2BStarterPackDraft,
  DailyBriefingScaffold,
  ReportExportPath,
  SampleIssueReport
} from '@news-context/shared-types';

export interface BuildB2BStarterPackOptions {
  readonly generated_at?: string | undefined;
  readonly headline?: string | undefined;
  readonly subheadline?: string | undefined;
  readonly export_paths?: readonly ReportExportPath[] | undefined;
}

function buildSubheadline(
  sampleIssueReport: SampleIssueReport,
  dailyBriefing: DailyBriefingScaffold,
  override: string | undefined
): string {
  if (override !== undefined) {
    return override;
  }

  return `대표 이슈 ${sampleIssueReport.cluster.label}에서 ${sampleIssueReport.cluster.publisher_count}개 출처와 ${sampleIssueReport.cluster.coverage_window_hours}시간 타임라인을 먼저 보여주고, ${dailyBriefing.items.length}개 briefing item으로 반복 사용 가치를 바로 연결합니다.`;
}

export function buildB2BStarterPackDraft(params: {
  readonly sample_issue_report: SampleIssueReport;
  readonly daily_briefing: DailyBriefingScaffold;
  readonly options?: BuildB2BStarterPackOptions | undefined;
}): B2BStarterPackDraft {
  const generatedAt = params.options?.generated_at ?? new Date().toISOString();
  const briefingItems = params.daily_briefing.items.length;
  const leadingBriefingItem = params.daily_briefing.items[0];
  const selectionReason = params.sample_issue_report.summary.selection_reason.reasons[0] ?? '';
  const signalReason = params.sample_issue_report.summary.selection_reason.reasons[1] ?? '';

  return {
    generated_at: generatedAt,
    package_name: 'starter-report-beta-draft',
    positioning: {
      headline:
        params.options?.headline ??
        '지금 읽는 기사에서 시작해, 다음 날 브리핑까지 이어지는 미팅용 베타 데모',
      subheadline: buildSubheadline(
        params.sample_issue_report,
        params.daily_briefing,
        params.options?.subheadline
      ),
      proof_points: [
        selectionReason,
        leadingBriefingItem === undefined
          ? `${briefingItems}개 briefing item이 반복 사용 구조를 설명합니다.`
          : `${leadingBriefingItem.briefing_angle} ${leadingBriefingItem.freshness_note}`,
        'JSON/CSV export는 파일 전달형 handoff 경로로만 설명하며, beta에서 external API나 team dashboard를 약속하지 않습니다.'
      ],
      immediate_value:
        '현재 읽는 기사 옆에서 같은 이슈의 다른 보도, 출처 카드, 최신성 신호를 바로 비교할 수 있다는 점을 먼저 보여줍니다.',
      repeat_use_value:
        'watchlist와 daily briefing scaffold가 한 번의 비교를 반복 확인 습관으로 바꾸는 구조라는 점을 이어서 설명합니다.',
      founder_pass_reason:
        'Founder Pass는 더 많은 watchlist 저장과 briefing 접근을 열어, 개인 사용자가 이슈를 계속 추적할 이유를 만드는 베타 유료 옵션입니다.',
      b2b_demo_value: `Starter Report는 ${signalReason} 파일 형태로 보여주는 초기 B2B 제안 자료입니다.`,
      scope_guardrail:
        'beta에서는 external API 판매, team dashboard, 월 정기구독을 약속하지 않습니다.'
    },
    delivery_assets: {
      sample_issue_report: params.sample_issue_report,
      daily_briefing: params.daily_briefing
    },
    support_flow: {
      owner: 'founding team',
      beta_channel_status: 'draft',
      intake_steps: [
        '요청 출처를 먼저 기록합니다: extension 사용자, 잠재 고객, 소개 유입.',
        '문의 유형을 support, 데이터 수정, starter report 문의로 분류합니다.',
        '같은 날 접수 확인을 보내고, 후속 조치는 운영 백로그로 넘깁니다.'
      ],
      response_sla: 'Same business day acknowledgement, next-step response within 2 business days.'
    },
    sales_notes: [
      `미팅은 ${params.sample_issue_report.summary.headline}으로 시작하고, 왜 이 cluster를 대표 데모로 골랐는지 ${selectionReason}로 설명합니다.`,
      `그다음 ${briefingItems}개 briefing item과 watchlist를 연결해 Founder Pass가 개인 반복 사용을 여는 업그레이드라는 점을 보여줍니다.`,
      'CSV export는 파일 전달형 파일럿 경로로만 설명하고, beta에서 external API나 team dashboard를 약속하지 않습니다.'
    ],
    export_paths: params.options?.export_paths ?? []
  };
}
