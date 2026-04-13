import { randomUUID } from 'node:crypto';

import { buildDailyBriefingScaffold } from '@news-context/jobs';
import type {
  BriefingItemRecord,
  BriefingResponse,
  BriefingResponseItem,
  CanonicalArticleRecord,
  ClusterMemberRecord,
  NewsContextStoreState,
  ReportArticleDigest
} from '@news-context/shared-types';

import type { DeviceIdentityInput, FileNewsContextStore } from '../repositories/file-store.js';

const DEFAULT_BRIEFING_TIMEZONE = 'Asia/Seoul';

function resolveBriefingTimezone(): string {
  const configured = process.env['BRIEFING_TIMEZONE_DEFAULT'];
  return configured !== undefined && configured.trim() !== '' ? configured.trim() : DEFAULT_BRIEFING_TIMEZONE;
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((entry) => entry.type === 'year')?.value;
  const month = parts.find((entry) => entry.type === 'month')?.value;
  const day = parts.find((entry) => entry.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function sortIsoDescending(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right.localeCompare(left);
}

function getArticleTimestamp(article: CanonicalArticleRecord): string {
  return article.published_at ?? article.updated_at ?? article.created_at;
}

function sortArticlesByRecency(left: CanonicalArticleRecord, right: CanonicalArticleRecord): number {
  return sortIsoDescending(getArticleTimestamp(left), getArticleTimestamp(right));
}

function toDigest(
  state: NewsContextStoreState,
  article: CanonicalArticleRecord,
  member: ClusterMemberRecord | undefined
): ReportArticleDigest {
  const publisherName =
    article.publisher_id === null
      ? new URL(article.canonical_url).hostname
      : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? new URL(article.canonical_url).hostname;

  return {
    article_id: article.id,
    url: article.canonical_url,
    publisher_name: publisherName,
    title: article.title,
    published_at: article.published_at,
    summary_line: article.excerpt,
    score: member?.score ?? null
  };
}

function buildResponseItem(
  state: NewsContextStoreState,
  item: BriefingItemRecord
): BriefingResponseItem | null {
  const cluster = state.story_clusters.find((entry) => entry.id === item.cluster_id);

  if (cluster === undefined) {
    return null;
  }

  const members = state.cluster_members.filter((entry) => entry.cluster_id === item.cluster_id);
  const latestArticles = members
    .map((member) => {
      const article = state.canonical_articles.find((entry) => entry.id === member.article_id);
      return article === undefined ? null : { article, member };
    })
    .filter(
      (entry): entry is { article: CanonicalArticleRecord; member: ClusterMemberRecord } => entry !== null
    )
    .sort((left, right) => sortArticlesByRecency(left.article, right.article))
    .slice(0, 3)
    .map((entry) => toDigest(state, entry.article, entry.member));

  return {
    cluster_id: item.cluster_id,
    label: cluster.label,
    new_article_count: item.new_article_count,
    latest_articles: latestArticles
  };
}

function buildResponseFromState(
  state: NewsContextStoreState,
  briefingId: string,
  briefingDate: string
): BriefingResponse {
  return {
    date: briefingDate,
    items: state.briefing_items
      .filter((entry) => entry.briefing_id === briefingId)
      .sort((left, right) => right.priority_score - left.priority_score || right.created_at.localeCompare(left.created_at))
      .map((entry) => buildResponseItem(state, entry))
      .filter((entry): entry is BriefingResponseItem => entry !== null)
  };
}

function getStoredBriefingId(
  state: NewsContextStoreState,
  identity: DeviceIdentityInput,
  briefingDate: string
): string | null {
  const briefing = state.briefings.find(
    (entry) => entry.briefing_date === briefingDate && entry.device_id === identity.device_id
  );

  return briefing?.id ?? null;
}

export interface GetBriefingOptions {
  readonly date?: string | undefined;
}

export interface BriefingFetchResult {
  readonly created: boolean;
  readonly briefing: BriefingResponse;
}

export class BriefingAccessForbiddenError extends Error {}

export class BriefingService {
  private readonly defaultTimeZone: string;

  public constructor(
    private readonly store: FileNewsContextStore,
    options: {
      readonly defaultTimeZone?: string | undefined;
    } = {}
  ) {
    this.defaultTimeZone = options.defaultTimeZone ?? resolveBriefingTimezone();
  }

  public async getBriefing(
    identity: DeviceIdentityInput,
    options: GetBriefingOptions = {}
  ): Promise<BriefingFetchResult> {
    const profile = await this.store.getProfile(identity);

    if (!profile.limits.briefing_enabled) {
      throw new BriefingAccessForbiddenError('Founder Pass 이상에서만 브리핑을 볼 수 있습니다.');
    }

    const briefingDate = options.date ?? formatDateInTimeZone(new Date(), this.defaultTimeZone);

    return this.store.writeState((state) => {
      const existingBriefingId = getStoredBriefingId(state, identity, briefingDate);

      if (existingBriefingId !== null) {
        return {
          created: false,
          briefing: buildResponseFromState(state, existingBriefingId, briefingDate)
        } satisfies BriefingFetchResult;
      }

      const generatedAt = new Date().toISOString();
      const scaffold = buildDailyBriefingScaffold(state, {
        briefing_date: briefingDate,
        timezone: this.defaultTimeZone,
        generated_at: generatedAt,
        watchlist_device_id: identity.device_id,
        export_paths: []
      });
      const briefingId = `briefing_${randomUUID()}`;

      state.briefings.push({
        id: briefingId,
        user_id: null,
        device_id: identity.device_id,
        briefing_date: briefingDate,
        status: 'pending',
        created_at: generatedAt,
        sent_at: null
      });

      for (const item of scaffold.items) {
        state.briefing_items.push({
          id: `briefing_item_${randomUUID()}`,
          briefing_id: briefingId,
          cluster_id: item.cluster_id,
          priority_score: item.priority_score,
          new_article_count: item.new_article_count,
          created_at: generatedAt
        });
      }

      return {
        created: true,
        briefing: buildResponseFromState(state, briefingId, briefingDate)
      } satisfies BriefingFetchResult;
    });
  }
}
