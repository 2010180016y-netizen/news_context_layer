import type { ArticleType, FreshnessState, ResolveState } from './fixtures.js';
import type {
  ArticleFeatureRecord,
  CanonicalArticleRecord,
  SubscriptionPlanCode,
  SubscriptionStatus
} from './store.js';

export interface ResolveRequest {
  readonly url: string;
  readonly canonical_url?: string | undefined;
  readonly title: string;
  readonly publisher_name?: string | undefined;
  readonly author_names?: readonly string[] | undefined;
  readonly published_at?: string | undefined;
  readonly modified_at?: string | undefined;
  readonly article_type?: ArticleType | undefined;
  readonly section?: string | undefined;
  readonly keywords?: readonly string[] | undefined;
  readonly body_excerpt?: string | undefined;
  readonly correction_note_detected?: boolean | undefined;
  readonly parse_confidence: number;
  readonly anon_id?: string | undefined;
  readonly page_lang?: string | undefined;
}

export interface ResolveSourceCard {
  readonly title: string;
  readonly publisher_name: string | null;
  readonly author_names: readonly string[];
  readonly published_at: string | null;
  readonly modified_at: string | null;
  readonly article_type: ArticleType;
  readonly section: string | null;
}

export interface ResolveFreshness {
  readonly state: FreshnessState;
  readonly message: string;
  readonly newer_article_count: number | null;
  readonly latest_article_ts: string | null;
}

export interface ResolveCommonSignals {
  readonly entities: readonly string[];
  readonly numbers: readonly string[];
  readonly confidence: number;
}

export interface ResolveRelatedArticle {
  readonly article_id: string;
  readonly url: string;
  readonly publisher_name: string;
  readonly title: string;
  readonly published_at: string | null;
  readonly summary_line: string | null;
  readonly score: number | null;
}

export interface ResolveUiHints {
  readonly show_upgrade_cta: boolean;
  readonly show_feedback_prompt: boolean;
}

export interface ResolveResponse {
  readonly article_id: string;
  readonly cluster_id: string;
  readonly context_confidence: number;
  readonly state: ResolveState;
  readonly source_card: ResolveSourceCard;
  readonly freshness: ResolveFreshness;
  readonly common_signals: ResolveCommonSignals;
  readonly related_articles: readonly ResolveRelatedArticle[];
  readonly ui_hints: ResolveUiHints;
  readonly disclaimer: string;
}

export const CHECKOUT_PLAN_CODES = ['founder_pass'] as const;
export const PAYWALL_TRIGGER_TYPES = ['watchlist_limit', 'briefing', 'upgrade_cta', 'history'] as const;

export type CheckoutPlanCode = (typeof CHECKOUT_PLAN_CODES)[number];
export type PaywallTriggerType = (typeof PAYWALL_TRIGGER_TYPES)[number];

export const TRACKED_EVENT_NAMES = [
  'panel_opened',
  'article_parsed',
  'parse_failure',
  'context_loaded',
  'related_article_clicked',
  'watchlist_saved',
  'paywall_viewed',
  'checkout_started',
  'purchase_completed',
  'feedback_submitted'
] as const;

export type TrackedEventName = (typeof TRACKED_EVENT_NAMES)[number];

export interface DeviceIdentity {
  readonly anon_id: string;
  readonly device_id: string;
}

export interface WatchlistItem {
  readonly id: string;
  readonly cluster_id: string;
  readonly label: string;
  readonly notifications_enabled: boolean;
  readonly last_seen_at: string | null;
  readonly new_article_count: number;
  readonly plan_limit_reached: boolean;
}

export interface WatchlistListResponse {
  readonly items: readonly WatchlistItem[];
}

export interface CreateWatchlistRequest {
  readonly cluster_id: string;
  readonly label?: string | undefined;
  readonly notifications_enabled?: boolean | undefined;
}

export interface UpdateWatchlistRequest {
  readonly label?: string | undefined;
  readonly notifications_enabled?: boolean | undefined;
}

export interface WatchlistLimitErrorResponse {
  readonly error: 'plan_limit_reached';
  readonly message: string;
  readonly plan_code: SubscriptionPlanCode;
  readonly used_count: number;
  readonly limit_count: number;
  readonly trigger_type: 'watchlist_limit';
}

export interface CheckoutSessionRequest {
  readonly plan_code: CheckoutPlanCode;
  readonly success_url?: string | undefined;
  readonly cancel_url?: string | undefined;
}

export interface CheckoutSessionResponse {
  readonly provider: string;
  readonly session_id: string;
  readonly checkout_url: string;
}

export interface ProfileResponse {
  readonly anon_id: string;
  readonly user_id: string | null;
  readonly plan: {
    readonly code: SubscriptionPlanCode;
    readonly status: SubscriptionStatus;
    readonly expires_at: string | null;
  };
  readonly limits: {
    readonly watchlists_max: number;
    readonly watchlists_used: number;
    readonly briefing_enabled: boolean;
  };
}

export interface EventRequest {
  readonly anon_id: string;
  readonly user_id?: string | undefined;
  readonly event_name: TrackedEventName;
  readonly event_props?: Readonly<Record<string, unknown>> | undefined;
  readonly ts: string;
}

export interface EventAcceptedResponse {
  readonly accepted: true;
  readonly event_name: TrackedEventName;
}

export interface BuildArticleFeatureInput {
  readonly title: string;
  readonly publisher_name: string | null;
  readonly author_names: readonly string[];
  readonly published_at: string | null;
  readonly modified_at: string | null;
  readonly article_type: ArticleType;
  readonly section: string | null;
  readonly keywords: readonly string[];
  readonly excerpt: string | null;
}

export interface PersistedArticleFeature extends ArticleFeatureRecord {
  readonly article_id: string;
}

export interface ResolvedArticleFeatureView {
  readonly article: CanonicalArticleRecord;
  readonly feature: PersistedArticleFeature;
  readonly publisher_name: string | null;
}

export interface CandidateScoreBreakdown {
  readonly lexical_title_similarity: number;
  readonly semantic_title_similarity: number;
  readonly entity_overlap: number;
  readonly numeric_overlap: number;
  readonly time_proximity: number;
  readonly publisher_diversity_bonus: number;
  readonly duplicate_penalty: number;
  readonly final_score: number;
}

export interface ScoredRelatedArticle {
  readonly article: CanonicalArticleRecord;
  readonly feature: PersistedArticleFeature;
  readonly publisher_name: string;
  readonly score: number;
  readonly breakdown: CandidateScoreBreakdown;
}
