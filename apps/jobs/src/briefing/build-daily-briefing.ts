import type {
  DailyBriefingItem,
  DailyBriefingScaffold,
  NewsContextStoreState,
  ReportArticleDigest,
  ReportExportPath
} from '@news-context/shared-types';

import {
  findClusterSnapshot,
  getArticleTimestamp,
  isVisibleOperationalArticle,
  listClusterSnapshots,
  sortArticlesByRecency
} from './shared.js';

export interface BuildDailyBriefingOptions {
  readonly briefing_date: string;
  readonly timezone: string;
  readonly generated_at?: string | undefined;
  readonly max_items?: number | undefined;
  readonly watchlist_device_id?: string | undefined;
  readonly export_paths?: readonly ReportExportPath[] | undefined;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function isSameDate(isoDateTime: string | null, date: string): boolean {
  return isoDateTime !== null && isoDateTime.slice(0, 10) === date;
}

function toDigest(
  state: NewsContextStoreState,
  article: Parameters<typeof sortArticlesByRecency>[0],
  score: number | null
): ReportArticleDigest {
  const publisherName =
    article.publisher_id === null
      ? new URL(article.canonical_url).hostname
      : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ??
        new URL(article.canonical_url).hostname;

  return {
    article_id: article.id,
    url: article.canonical_url,
    publisher_name: publisherName,
    title: article.title,
    published_at: article.published_at,
    summary_line: article.excerpt,
    score
  };
}

function buildPriorityScore(params: {
  articleCount: number;
  publisherCount: number;
  signalCount: number;
  latestTimestamp: string | null;
  generatedAt: string;
  watchlistMatch: boolean;
}): number {
  const recencyHours =
    params.latestTimestamp === null
      ? 72
      : Math.max(0, Date.parse(params.generatedAt) - Date.parse(params.latestTimestamp)) /
        (1000 * 60 * 60);
  const recencyScore = Math.max(0, 1 - Math.min(recencyHours / 72, 1));
  const articleScore = Math.min(1, params.articleCount / 8);
  const publisherScore = Math.min(1, params.publisherCount / 6);
  const signalScore = Math.min(1, params.signalCount / 4);
  const watchlistBoost = params.watchlistMatch ? 0.14 : 0;

  return round(
    Math.min(
      1,
      0.34 * articleScore +
        0.28 * publisherScore +
        0.18 * recencyScore +
        0.12 * signalScore +
        watchlistBoost
    )
  );
}

function buildBriefingAngle(params: {
  label: string;
  publisherCount: number;
  newArticleCount: number;
  entities: readonly string[];
  numbers: readonly string[];
  watchlistMatch: boolean;
}): string {
  const entityFragment =
    params.entities.length === 0 ? '공통 신호가 잡힌 이슈' : `${params.entities.slice(0, 2).join(', ')} 신호가 반복되는 이슈`;
  const numberFragment =
    params.numbers.length === 0 ? '' : `, 수치 ${params.numbers.join(', ')}가 반복됩니다`;
  const watchlistFragment = params.watchlistMatch ? ' watchlist와 직접 연결된 우선 추적 항목입니다.' : ' briefing용 보조 맥락 항목입니다.';

  return `${params.label}: ${params.publisherCount}개 출처에서 오늘 새 기사 ${params.newArticleCount}건이 추가됐고, ${entityFragment}${numberFragment}.${watchlistFragment}`;
}

function buildFreshnessNote(latestArticle: ReportArticleDigest | undefined, generatedAt: string): string {
  if (latestArticle?.published_at === null || latestArticle?.published_at === undefined) {
    return '최신 기사 시각이 부족해 freshness 설명은 보조 수준으로 유지합니다.';
  }

  const hoursAgo =
    Math.max(0, Date.parse(generatedAt) - Date.parse(latestArticle.published_at)) /
    (1000 * 60 * 60);

  return `${latestArticle.publisher_name}가 ${round(hoursAgo)}시간 전 최신 업데이트를 냈습니다.`;
}

function buildItem(
  state: NewsContextStoreState,
  clusterId: string,
  options: BuildDailyBriefingOptions,
  generatedAt: string
): DailyBriefingItem | null {
  const snapshot = findClusterSnapshot(state, clusterId);

  if (snapshot === null) {
    return null;
  }

  const visibleArticles = snapshot.articles.filter(isVisibleOperationalArticle);
  const latestArticles = [...(visibleArticles.length > 0 ? visibleArticles : snapshot.articles)]
    .sort(sortArticlesByRecency)
    .slice(0, 3)
    .map((article) => {
      const member = snapshot.members.find((entry) => entry.article_id === article.id);
      return toDigest(state, article, member?.score ?? null);
    });
  const newArticleCount = snapshot.articles.filter((article) =>
    isSameDate(getArticleTimestamp(article), options.briefing_date)
  ).length;
  const watchlistMatch =
    options.watchlist_device_id !== undefined &&
    state.watchlists.some(
      (watchlist) =>
        watchlist.device_id === options.watchlist_device_id &&
        watchlist.cluster_id === snapshot.cluster.id
    );

  return {
    cluster_id: snapshot.cluster.id,
    label: snapshot.cluster.label,
    priority_score: buildPriorityScore({
      articleCount: snapshot.cluster.article_count,
      publisherCount: snapshot.publisher_names.length,
      signalCount:
        snapshot.cluster.top_entities_json.length + snapshot.cluster.top_numbers_json.length,
      latestTimestamp: latestArticles[0]?.published_at ?? snapshot.cluster.last_seen_at,
      generatedAt,
      watchlistMatch
    }),
    new_article_count: newArticleCount,
    publisher_count: snapshot.publisher_names.length,
    latest_articles: latestArticles,
    common_entities: snapshot.cluster.top_entities_json,
    common_numbers: snapshot.cluster.top_numbers_json,
    briefing_angle: buildBriefingAngle({
      label: snapshot.cluster.label,
      publisherCount: snapshot.publisher_names.length,
      newArticleCount,
      entities: snapshot.cluster.top_entities_json,
      numbers: snapshot.cluster.top_numbers_json,
      watchlistMatch
    }),
    freshness_note: buildFreshnessNote(latestArticles[0], generatedAt),
    watchlist_match: watchlistMatch
  };
}

export function buildDailyBriefingScaffold(
  state: NewsContextStoreState,
  options: BuildDailyBriefingOptions
): DailyBriefingScaffold {
  const generatedAt = options.generated_at ?? new Date().toISOString();
  const maxItems = options.max_items ?? 3;
  const orderedClusters = listClusterSnapshots(state).sort((left, right) => {
    const leftWatchlisted =
      options.watchlist_device_id !== undefined &&
      state.watchlists.some(
        (watchlist) =>
          watchlist.device_id === options.watchlist_device_id &&
          watchlist.cluster_id === left.cluster.id
      );
    const rightWatchlisted =
      options.watchlist_device_id !== undefined &&
      state.watchlists.some(
        (watchlist) =>
          watchlist.device_id === options.watchlist_device_id &&
          watchlist.cluster_id === right.cluster.id
      );

    if (leftWatchlisted !== rightWatchlisted) {
      return leftWatchlisted ? -1 : 1;
    }

    if (left.cluster.article_count !== right.cluster.article_count) {
      return right.cluster.article_count - left.cluster.article_count;
    }

    return right.cluster.last_seen_at.localeCompare(left.cluster.last_seen_at);
  });
  const items = orderedClusters
    .map((snapshot) => buildItem(state, snapshot.cluster.id, options, generatedAt))
    .filter((entry): entry is DailyBriefingItem => entry !== null)
    .sort((left, right) => right.priority_score - left.priority_score)
    .slice(0, maxItems);

  return {
    date: options.briefing_date,
    timezone: options.timezone,
    generated_at: generatedAt,
    source:
      options.watchlist_device_id === undefined ? 'cluster_priority' : 'watchlist_priority',
    items,
    export_paths: options.export_paths ?? []
  };
}
