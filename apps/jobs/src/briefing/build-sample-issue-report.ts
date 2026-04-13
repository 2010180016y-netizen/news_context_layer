import type {
  NewsContextStoreState,
  ReportExportPath,
  ResolveState,
  SampleIssueReport
} from '@news-context/shared-types';

import type { ClusterArticleSnapshot } from './shared.js';

import {
  findClusterSnapshot,
  isVisibleOperationalArticle,
  listClusterSnapshots,
  sortArticlesByRecency
} from './shared.js';

export interface BuildSampleIssueReportOptions {
  readonly cluster_id?: string | undefined;
  readonly generated_at?: string | undefined;
  readonly resolve_state?: ResolveState | undefined;
  readonly export_paths?: readonly ReportExportPath[] | undefined;
}

interface ReportReadinessSnapshot {
  readonly readiness_score: number;
  readonly coverage_window_hours: number;
  readonly strongest_match_count: number;
}

interface AlternativeClusterSnapshot {
  readonly snapshot: ClusterArticleSnapshot;
  readonly readiness: ReportReadinessSnapshot;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function estimateTitleTokenCount(title: string): number {
  return title
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/i)
    .filter((token) => token.length >= 2).length;
}

function resolveRecencyScore(lastSeenAt: string, generatedAt: string): number {
  const hoursSinceLastSeen =
    Math.max(0, Date.parse(generatedAt) - Date.parse(lastSeenAt)) / (1000 * 60 * 60);
  return Math.max(0, 1 - Math.min(hoursSinceLastSeen / 96, 1));
}

function resolveCoverageWindowHours(snapshot: ClusterArticleSnapshot): number {
  if (snapshot.articles.length <= 1) {
    return 0;
  }

  const timestamps = snapshot.articles
    .map((article) => article.published_at ?? article.updated_at ?? article.created_at)
    .filter((timestamp): timestamp is string => timestamp !== null)
    .map((timestamp) => Date.parse(timestamp))
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => left - right);

  if (timestamps.length <= 1) {
    return 0;
  }

  return round((timestamps.at(-1)! - timestamps[0]!) / (1000 * 60 * 60));
}

function buildReportReadinessSnapshot(
  snapshot: ClusterArticleSnapshot,
  generatedAt: string
): ReportReadinessSnapshot {
  const coverageScore = Math.min(1, snapshot.cluster.article_count / 8);
  const diversityScore = Math.min(1, snapshot.publisher_names.length / 6);
  const entitySignalScore = Math.min(1, snapshot.cluster.top_entities_json.length / 3);
  const numberSignalScore = Math.min(1, snapshot.cluster.top_numbers_json.length / 2);
  const recencyScore = resolveRecencyScore(snapshot.cluster.last_seen_at, generatedAt);
  const strongestMatchCount = snapshot.members.filter((member) => {
    const article = snapshot.articles.find((entry) => entry.id === member.article_id);

    if (article === undefined) {
      return false;
    }

    return member.score >= 0.72 && estimateTitleTokenCount(article.title) >= 4;
  }).length;
  const matchDensityScore = Math.min(1, strongestMatchCount / 5);
  const concentrationPenalty =
    snapshot.cluster.article_count >= 6 && snapshot.publisher_names.length <= 2 ? 0.12 : 0;

  return {
    readiness_score: round(
      Math.max(
        0,
        0.28 * coverageScore +
          0.24 * diversityScore +
          0.14 * entitySignalScore +
          0.08 * numberSignalScore +
          0.18 * matchDensityScore +
          0.08 * recencyScore -
          concentrationPenalty
      )
    ),
    coverage_window_hours: resolveCoverageWindowHours(snapshot),
    strongest_match_count: strongestMatchCount
  };
}

function buildSignalNarrative(snapshot: ClusterArticleSnapshot): string {
  const entities = snapshot.cluster.top_entities_json.slice(0, 3);
  const numbers = snapshot.cluster.top_numbers_json.slice(0, 2);

  if (entities.length > 0 && numbers.length > 0) {
    return `공통 신호는 ${entities.join(', ')}에 모이고, 반복 수치는 ${numbers.join(', ')}로 정리됩니다.`;
  }

  if (entities.length > 0) {
    return `공통 신호는 ${entities.join(', ')}에 모입니다.`;
  }

  if (numbers.length > 0) {
    return `반복 수치는 ${numbers.join(', ')}로 정리됩니다.`;
  }

  return '그래도 출처 간 겹침이 충분해 같은 이슈라는 점을 설명할 수 있습니다.';
}

function resolvePublisherName(
  state: NewsContextStoreState,
  article: ClusterArticleSnapshot['articles'][number]
): string {
  return article.publisher_id === null
    ? new URL(article.canonical_url).hostname
    : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ??
        new URL(article.canonical_url).hostname;
}

function resolveTargetClusterId(
  state: NewsContextStoreState,
  clusterId: string | undefined,
  generatedAt: string
): string {
  if (clusterId !== undefined) {
    return clusterId;
  }

  const topCluster = listClusterSnapshots(state).sort((left, right) => {
    const leftScore = buildReportReadinessSnapshot(left, generatedAt).readiness_score;
    const rightScore = buildReportReadinessSnapshot(right, generatedAt).readiness_score;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    if (left.publisher_names.length !== right.publisher_names.length) {
      return right.publisher_names.length - left.publisher_names.length;
    }

    if (left.cluster.article_count !== right.cluster.article_count) {
      return right.cluster.article_count - left.cluster.article_count;
    }

    return right.cluster.last_seen_at.localeCompare(left.cluster.last_seen_at);
  })[0];

  if (topCluster === undefined) {
    throw new Error('No story clusters are available to build a sample issue report.');
  }

  return topCluster.cluster.id;
}

function findComparativeAlternativeCluster(
  state: NewsContextStoreState,
  selectedSnapshot: ClusterArticleSnapshot,
  generatedAt: string
): AlternativeClusterSnapshot | null {
  const alternatives = listClusterSnapshots(state)
    .filter((snapshot) => snapshot.cluster.id !== selectedSnapshot.cluster.id)
    .map((snapshot) => ({
      snapshot,
      readiness: buildReportReadinessSnapshot(snapshot, generatedAt)
    }))
    .sort((left, right) => {
      if (left.snapshot.cluster.article_count !== right.snapshot.cluster.article_count) {
        return right.snapshot.cluster.article_count - left.snapshot.cluster.article_count;
      }

      if (left.snapshot.publisher_names.length !== right.snapshot.publisher_names.length) {
        return left.snapshot.publisher_names.length - right.snapshot.publisher_names.length;
      }

      return left.readiness.readiness_score - right.readiness.readiness_score;
    });

  const comparableAlternative =
    alternatives.find(
      (entry) =>
        entry.snapshot.cluster.article_count >= selectedSnapshot.cluster.article_count &&
        entry.snapshot.publisher_names.length <= selectedSnapshot.publisher_names.length
    ) ?? alternatives[0];

  return comparableAlternative ?? null;
}

function buildComparativeSelectionReason(params: {
  state: NewsContextStoreState;
  snapshot: ClusterArticleSnapshot;
  readiness: ReportReadinessSnapshot;
  generatedAt: string;
}): string | null {
  const alternative = findComparativeAlternativeCluster(
    params.state,
    params.snapshot,
    params.generatedAt
  );

  if (alternative === null) {
    return null;
  }

  const diversityGap =
    params.snapshot.publisher_names.length - alternative.snapshot.publisher_names.length;
  const readinessGap = round(
    params.readiness.readiness_score - alternative.readiness.readiness_score
  );
  const recencyGapHours = round(
    (Date.parse(params.snapshot.cluster.last_seen_at) -
      Date.parse(alternative.snapshot.cluster.last_seen_at)) /
      (1000 * 60 * 60)
  );

  if (
    alternative.snapshot.cluster.article_count > params.snapshot.cluster.article_count &&
    diversityGap >= 2
  ) {
    return `기사 수만 보면 ${alternative.snapshot.cluster.label} 묶음이 더 커 보이지만, ${params.snapshot.cluster.label} 이슈는 ${params.snapshot.publisher_names.length}개 출처와 더 선명한 최근 업데이트 흐름 덕분에 대표 데모로 설명하기 더 쉽습니다.`;
  }

  if (diversityGap >= 2 && readinessGap >= 0.08) {
    return `${alternative.snapshot.cluster.label} 묶음보다 출처 다양성과 readiness가 더 좋아, operator가 왜 이 이슈를 먼저 보여주는지 한 문장으로 설명하기 쉬운 anchor입니다.`;
  }

  if (recencyGapHours >= 12 && readinessGap > 0) {
    return `${alternative.snapshot.cluster.label} 묶음보다 최근 업데이트가 더 이어져 있어, 한 번의 데모 뒤에 반복 briefing으로 이어지는 흐름까지 함께 설명하기 좋습니다.`;
  }

  return null;
}

function buildSelectionReasons(
  state: NewsContextStoreState,
  snapshot: ClusterArticleSnapshot,
  readiness: ReportReadinessSnapshot
): readonly string[] {
  const freshestArticle = [...snapshot.articles].sort(sortArticlesByRecency)[0] ?? null;
  const freshestPublisher =
    freshestArticle === null ? null : resolvePublisherName(state, freshestArticle);
  const entities = snapshot.cluster.top_entities_json.slice(0, 2);
  const numbers = snapshot.cluster.top_numbers_json.slice(0, 2);
  const signalLine =
    entities.length > 0 && numbers.length > 0
      ? `${entities.join(', ')} 신호와 ${numbers.join(', ')} 수치가 여러 출처에서 반복됩니다.`
      : entities.length > 0
        ? `${entities.join(', ')} 신호가 여러 출처에서 반복됩니다.`
        : numbers.length > 0
          ? `${numbers.join(', ')} 수치가 여러 출처에서 반복됩니다.`
          : '같은 사건을 가리키는 제목·설명 겹침이 충분합니다.';

  return [
    `${snapshot.publisher_names.length}개 출처가 ${readiness.coverage_window_hours}시간 안에 같은 이슈를 이어 받아, 첫 데모에서 cross-source comparison 가치를 바로 보여주기에 가장 좋습니다.`,
    signalLine,
    freshestPublisher === null
      ? `강한 매치가 ${readiness.strongest_match_count}건이라 관련 기사 묶음이 안정적입니다.`
      : `${freshestPublisher}가 가장 최근 업데이트를 내면서 freshness 흐름도 함께 설명할 수 있습니다.`
  ];
}

function finalizeSelectionReasons(params: {
  state: NewsContextStoreState;
  snapshot: ClusterArticleSnapshot;
  readiness: ReportReadinessSnapshot;
  generatedAt: string;
}): readonly string[] {
  const baseReasons = buildSelectionReasons(params.state, params.snapshot, params.readiness);
  const comparativeReason = buildComparativeSelectionReason(params);

  if (comparativeReason === null) {
    return baseReasons;
  }

  return [baseReasons[0] ?? '', baseReasons[1] ?? '', comparativeReason];
}

export function buildSampleIssueReport(
  state: NewsContextStoreState,
  options: BuildSampleIssueReportOptions = {}
): SampleIssueReport {
  const generatedAt = options.generated_at ?? new Date().toISOString();
  const clusterId = resolveTargetClusterId(state, options.cluster_id, generatedAt);
  const snapshot = findClusterSnapshot(state, clusterId);

  if (snapshot === null) {
    throw new Error(`Cluster ${clusterId} was not found.`);
  }

  const readiness = buildReportReadinessSnapshot(snapshot, generatedAt);
  const selectionReasons = finalizeSelectionReasons({
    state,
    snapshot,
    readiness,
    generatedAt
  });
  const visibleArticles = snapshot.articles.filter(isVisibleOperationalArticle);
  const relatedArticles = [...(visibleArticles.length > 0 ? visibleArticles : snapshot.articles)]
    .sort((left, right) => {
      const leftScore =
        snapshot.members.find((entry) => entry.article_id === left.id)?.score ?? 0;
      const rightScore =
        snapshot.members.find((entry) => entry.article_id === right.id)?.score ?? 0;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return sortArticlesByRecency(left, right);
    })
    .slice(0, 5)
    .map((article) => {
      const member = snapshot.members.find((entry) => entry.article_id === article.id);

      return {
        article_id: article.id,
        url: article.canonical_url,
        publisher_name: resolvePublisherName(state, article),
        title: article.title,
        published_at: article.published_at,
        summary_line: article.excerpt,
        score: member?.score ?? null
      };
    });
  const freshestArticle = [...snapshot.articles].sort(sortArticlesByRecency)[0] ?? null;
  const latestTimestamp = freshestArticle?.published_at ?? snapshot.cluster.last_seen_at;
  const earliestTimestamp =
    [...snapshot.articles].sort(sortArticlesByRecency).at(-1)?.published_at ??
    snapshot.cluster.first_seen_at;
  const signalNarrative = buildSignalNarrative(snapshot);
  const readinessNarrative =
    snapshot.cluster.article_count >= 5 && snapshot.publisher_names.length >= 4
      ? '첫 미팅에서는 이 이슈로 기사 비교의 즉시 가치를 보여준 뒤, watchlist와 daily briefing이 반복 사용으로 이어진다는 점까지 연결하세요.'
      : '출처 다양성이나 관련 기사 커버리지가 더 늘기 전까지는 내부 데모 초안으로만 유지하세요.';

  return {
    report_id: `sample-issue-report-${snapshot.cluster.id}`,
    generated_at: generatedAt,
    report_type: 'sample_issue_report',
    resolve_state: options.resolve_state ?? 'success_full',
    cluster: {
      cluster_id: snapshot.cluster.id,
      label: snapshot.cluster.label,
      status: snapshot.cluster.status,
      article_count: snapshot.cluster.article_count,
      publisher_count: snapshot.publisher_names.length,
      coverage_window_hours: readiness.coverage_window_hours,
      first_seen_at: earliestTimestamp,
      last_seen_at: latestTimestamp,
      top_entities: snapshot.cluster.top_entities_json,
      top_numbers: snapshot.cluster.top_numbers_json
    },
    summary: {
      headline: `${snapshot.cluster.label} 이슈: ${snapshot.publisher_names.length}개 출처가 ${readiness.coverage_window_hours}시간 안에 ${snapshot.cluster.article_count}건을 이어 쓴 대표 데모`,
      angle: `이 샘플은 기사 비교의 즉시 가치를 가장 분명하게 보여주는 대표 이슈입니다. ${selectionReasons[0]} ${signalNarrative}`,
      freshness_note:
        freshestArticle === null
          ? `보도 범위는 ${earliestTimestamp}부터 ${latestTimestamp}까지입니다.`
          : `보도 범위는 ${earliestTimestamp}부터 ${latestTimestamp}까지이며, 가장 최근 추적 기사는 ${resolvePublisherName(state, freshestArticle)}에서 나왔습니다.`,
      recommended_action: `${readinessNarrative} 현재 리포트 준비도 점수는 ${readiness.readiness_score}이고, anchor 선택 이유는 ${selectionReasons[2]}`,
      common_signals: {
        entities: snapshot.cluster.top_entities_json,
        numbers: snapshot.cluster.top_numbers_json
      },
      selection_reason: {
        readiness_score: readiness.readiness_score,
        reasons: selectionReasons
      }
    },
    related_articles: relatedArticles,
    export_paths: options.export_paths ?? []
  };
}
