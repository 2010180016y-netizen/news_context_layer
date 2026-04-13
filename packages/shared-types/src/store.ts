import type { ArticleType, FeedType, FeedStatus } from './fixtures.js';

export const CANONICAL_ARTICLE_STATUSES = ['active', 'archived', 'blocked'] as const;
export const STORY_CLUSTER_STATUSES = ['active', 'warm', 'archived'] as const;
export const USER_STATUSES = ['active', 'inactive'] as const;
export const SUBSCRIPTION_PLAN_CODES = ['free', 'founder_pass', 'pro', 'analyst', 'team'] as const;
export const SUBSCRIPTION_STATUSES = ['inactive', 'active', 'expired', 'grace_period', 'refunded'] as const;
export const BRIEFING_STATUSES = ['pending', 'sent', 'failed'] as const;
export const FEEDBACK_TYPES = ['helpful', 'unrelated', 'outdated', 'missing_coverage', 'bug', 'free_text'] as const;
export const CONSENT_TYPES = ['analytics_opt_in', 'privacy_terms', 'tos'] as const;
export const DATABASE_TABLES = [
  'publishers',
  'feeds',
  'raw_entries',
  'canonical_articles',
  'article_versions',
  'article_features',
  'story_clusters',
  'cluster_members',
  'users',
  'devices',
  'subscriptions',
  'watchlists',
  'briefings',
  'briefing_items',
  'events',
  'feedback',
  'legal_consents'
] as const;

export type CanonicalArticleStatus = (typeof CANONICAL_ARTICLE_STATUSES)[number];
export type StoryClusterStatus = (typeof STORY_CLUSTER_STATUSES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLAN_CODES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type BriefingStatus = (typeof BRIEFING_STATUSES)[number];
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type ConsentType = (typeof CONSENT_TYPES)[number];
export type DatabaseTableName = (typeof DATABASE_TABLES)[number];

export interface StoreMeta {
  schema_source: string;
  storage_adapter: 'file-backed-dev-store';
  applied_migrations: string[];
  last_migrated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublisherRecord {
  id: string;
  name: string;
  domain: string;
  is_active: boolean;
  rss_supported: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedRecord {
  id: string;
  publisher_id: string;
  feed_type: FeedType;
  url: string;
  section: string | null;
  status: FeedStatus;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawEntryPayload {
  entry_type: 'rss' | 'sitemap';
  title?: string | undefined;
  description?: string | undefined;
  excerpt?: string | undefined;
  canonical_url_hint?: string | undefined;
  published_at?: string | undefined;
  modified_at?: string | undefined;
  author_names?: readonly string[] | undefined;
  thumbnail_url?: string | undefined;
  keywords?: readonly string[] | undefined;
  section?: string | undefined;
  article_type?: ArticleType | undefined;
  language_code?: string | undefined;
  raw_guid?: string | undefined;
}

export interface RawEntryRecord {
  id: string;
  feed_id: string;
  source_guid: string | null;
  source_url: string;
  raw_payload: RawEntryPayload;
  fetched_at: string;
  normalized: boolean;
  normalized_at: string | null;
  created_at: string;
}

export interface CanonicalArticleRecord {
  id: string;
  publisher_id: string | null;
  canonical_url: string;
  source_url: string;
  title: string;
  subtitle: string | null;
  author_json: string[];
  published_at: string | null;
  modified_at: string | null;
  article_type: ArticleType;
  section: string | null;
  excerpt: string | null;
  thumbnail_url: string | null;
  language_code: string;
  hash_title: string | null;
  status: CanonicalArticleStatus;
  parse_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleVersionRecord {
  id: string;
  article_id: string;
  version_no: number;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  modified_at: string | null;
  change_reason: string | null;
  captured_at: string;
  created_at: string;
}

export interface ArticleFeatureRecord {
  article_id: string;
  title_tokens: string[];
  entities_json: string[];
  numbers_json: string[];
  keywords_json: string[];
  embedding: Record<string, number> | null;
  feature_version: string;
  computed_at: string;
}

export interface StoryClusterRecord {
  id: string;
  label: string;
  status: StoryClusterStatus;
  first_seen_at: string;
  last_seen_at: string;
  article_count: number;
  top_entities_json: string[];
  top_numbers_json: string[];
  created_at: string;
  updated_at: string;
}

export interface ClusterMemberRecord {
  id: string;
  cluster_id: string;
  article_id: string;
  score: number;
  rank_in_cluster: number | null;
  is_primary: boolean;
  created_at: string;
}

export interface UserRecord {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface DeviceRecord {
  id: string;
  anon_id: string;
  user_id: string | null;
  platform: string;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string | null;
  device_id: string | null;
  plan_code: SubscriptionPlanCode;
  status: SubscriptionStatus;
  provider: string | null;
  provider_ref: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistRecord {
  id: string;
  user_id: string | null;
  device_id: string | null;
  cluster_id: string;
  label: string | null;
  notifications_enabled: boolean;
  created_at: string;
  last_viewed_at: string | null;
  updated_at: string;
}

export interface BriefingRecord {
  id: string;
  user_id: string | null;
  device_id: string | null;
  briefing_date: string;
  status: BriefingStatus;
  created_at: string;
  sent_at: string | null;
}

export interface BriefingItemRecord {
  id: string;
  briefing_id: string;
  cluster_id: string;
  priority_score: number;
  new_article_count: number;
  created_at: string;
}

export interface EventRecord {
  id: string;
  anon_id: string;
  user_id: string | null;
  device_id: string | null;
  event_name: string;
  event_props: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface FeedbackRecord {
  id: string;
  anon_id: string;
  user_id: string | null;
  article_id: string | null;
  cluster_id: string | null;
  feedback_type: FeedbackType;
  free_text: string | null;
  created_at: string;
}

export interface LegalConsentRecord {
  id: string;
  user_id: string | null;
  device_id: string | null;
  consent_type: ConsentType;
  consent_version: string;
  consented: boolean;
  created_at: string;
}

export interface NewsContextStoreState {
  meta: StoreMeta;
  publishers: PublisherRecord[];
  feeds: FeedRecord[];
  raw_entries: RawEntryRecord[];
  canonical_articles: CanonicalArticleRecord[];
  article_versions: ArticleVersionRecord[];
  article_features: ArticleFeatureRecord[];
  story_clusters: StoryClusterRecord[];
  cluster_members: ClusterMemberRecord[];
  users: UserRecord[];
  devices: DeviceRecord[];
  subscriptions: SubscriptionRecord[];
  watchlists: WatchlistRecord[];
  briefings: BriefingRecord[];
  briefing_items: BriefingItemRecord[];
  events: EventRecord[];
  feedback: FeedbackRecord[];
  legal_consents: LegalConsentRecord[];
}

export interface FeedWithPublisher extends FeedRecord {
  publisher_name: string;
  publisher_domain: string;
}

export interface RawEntryUpsertInput {
  feed_id: string;
  source_guid: string | null;
  source_url: string;
  raw_payload: RawEntryPayload;
  fetched_at: string;
}

export interface NormalizedArticleInput {
  publisher_id: string | null;
  canonical_url: string;
  source_url: string;
  title: string;
  subtitle: string | null;
  author_json: string[];
  published_at: string | null;
  modified_at: string | null;
  article_type: ArticleType;
  section: string | null;
  excerpt: string | null;
  thumbnail_url: string | null;
  language_code: string;
  hash_title: string | null;
  status: CanonicalArticleStatus;
  parse_confidence: number | null;
}

export interface FeedSeedLoadSummary {
  inserted_publishers: number;
  updated_publishers: number;
  inserted_feeds: number;
  updated_feeds: number;
}

export interface RawEntryUpsertSummary {
  inserted: number;
  updated: number;
  entries: RawEntryRecord[];
}

export interface CanonicalArticleUpsertSummary {
  article: CanonicalArticleRecord;
  inserted: boolean;
  version_created: boolean;
}

export interface RssIngestSummary {
  feed_count: number;
  raw_entries_inserted: number;
  raw_entries_updated: number;
  canonical_articles_inserted: number;
  canonical_articles_updated: number;
  normalized_entries: number;
}

export interface SitemapIngestSummary {
  feed_count: number;
  raw_entries_inserted: number;
  raw_entries_updated: number;
  canonical_articles_inserted: number;
  canonical_articles_updated: number;
  normalized_entries: number;
}

export interface FeedRepositoryPort {
  listFeedsByType(feedType: FeedType): Promise<FeedWithPublisher[]>;
  markFetchResult(feedId: string, fetchedAt: string, errorMessage: string | null): Promise<void>;
}

export interface RawEntryRepositoryPort {
  upsertEntries(entries: readonly RawEntryUpsertInput[]): Promise<RawEntryUpsertSummary>;
  markNormalized(entryIds: readonly string[], normalizedAt: string): Promise<void>;
}

export interface CanonicalArticleRepositoryPort {
  upsertArticle(input: NormalizedArticleInput, changeReason: string): Promise<CanonicalArticleUpsertSummary>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function coerceMeta(value: unknown, nowIso: string): StoreMeta {
  if (!isRecord(value)) {
    return {
      schema_source: 'docs/06_DB_Schema.sql',
      storage_adapter: 'file-backed-dev-store',
      applied_migrations: [],
      last_migrated_at: null,
      created_at: nowIso,
      updated_at: nowIso
    };
  }

  return {
    schema_source: typeof value['schema_source'] === 'string' ? value['schema_source'] : 'docs/06_DB_Schema.sql',
    storage_adapter: 'file-backed-dev-store',
    applied_migrations: asStringArray(value['applied_migrations']),
    last_migrated_at: typeof value['last_migrated_at'] === 'string' ? value['last_migrated_at'] : null,
    created_at: typeof value['created_at'] === 'string' ? value['created_at'] : nowIso,
    updated_at: typeof value['updated_at'] === 'string' ? value['updated_at'] : nowIso
  };
}

export function createEmptyStoreState(nowIso: string = new Date().toISOString()): NewsContextStoreState {
  return {
    meta: {
      schema_source: 'docs/06_DB_Schema.sql',
      storage_adapter: 'file-backed-dev-store',
      applied_migrations: [],
      last_migrated_at: null,
      created_at: nowIso,
      updated_at: nowIso
    },
    publishers: [],
    feeds: [],
    raw_entries: [],
    canonical_articles: [],
    article_versions: [],
    article_features: [],
    story_clusters: [],
    cluster_members: [],
    users: [],
    devices: [],
    subscriptions: [],
    watchlists: [],
    briefings: [],
    briefing_items: [],
    events: [],
    feedback: [],
    legal_consents: []
  };
}

export function hydrateStoreState(value: unknown, nowIso: string = new Date().toISOString()): NewsContextStoreState {
  if (!isRecord(value)) {
    return createEmptyStoreState(nowIso);
  }

  const emptyState = createEmptyStoreState(nowIso);

  return {
    meta: coerceMeta(value['meta'], nowIso),
    publishers: Array.isArray(value['publishers']) ? (value['publishers'] as PublisherRecord[]) : emptyState.publishers,
    feeds: Array.isArray(value['feeds']) ? (value['feeds'] as FeedRecord[]) : emptyState.feeds,
    raw_entries: Array.isArray(value['raw_entries']) ? (value['raw_entries'] as RawEntryRecord[]) : emptyState.raw_entries,
    canonical_articles: Array.isArray(value['canonical_articles'])
      ? (value['canonical_articles'] as CanonicalArticleRecord[])
      : emptyState.canonical_articles,
    article_versions: Array.isArray(value['article_versions'])
      ? (value['article_versions'] as ArticleVersionRecord[])
      : emptyState.article_versions,
    article_features: Array.isArray(value['article_features'])
      ? (value['article_features'] as ArticleFeatureRecord[])
      : emptyState.article_features,
    story_clusters: Array.isArray(value['story_clusters'])
      ? (value['story_clusters'] as StoryClusterRecord[])
      : emptyState.story_clusters,
    cluster_members: Array.isArray(value['cluster_members'])
      ? (value['cluster_members'] as ClusterMemberRecord[])
      : emptyState.cluster_members,
    users: Array.isArray(value['users']) ? (value['users'] as UserRecord[]) : emptyState.users,
    devices: Array.isArray(value['devices']) ? (value['devices'] as DeviceRecord[]) : emptyState.devices,
    subscriptions: Array.isArray(value['subscriptions'])
      ? (value['subscriptions'] as SubscriptionRecord[])
      : emptyState.subscriptions,
    watchlists: Array.isArray(value['watchlists']) ? (value['watchlists'] as WatchlistRecord[]) : emptyState.watchlists,
    briefings: Array.isArray(value['briefings']) ? (value['briefings'] as BriefingRecord[]) : emptyState.briefings,
    briefing_items: Array.isArray(value['briefing_items'])
      ? (value['briefing_items'] as BriefingItemRecord[])
      : emptyState.briefing_items,
    events: Array.isArray(value['events']) ? (value['events'] as EventRecord[]) : emptyState.events,
    feedback: Array.isArray(value['feedback']) ? (value['feedback'] as FeedbackRecord[]) : emptyState.feedback,
    legal_consents: Array.isArray(value['legal_consents'])
      ? (value['legal_consents'] as LegalConsentRecord[])
      : emptyState.legal_consents
  };
}
