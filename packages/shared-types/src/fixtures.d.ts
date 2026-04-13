export declare const ARTICLE_TYPES: readonly ["news", "opinion", "analysis", "editorial", "unknown"];
export declare const PARSER_PATHS: readonly ["jsonld", "meta", "dom"];
export declare const PARSE_STATUSES: readonly ["success", "partial", "unsupported"];
export declare const FEED_TYPES: readonly ["rss", "sitemap", "search_fallback"];
export declare const PUBLISHER_STATUSES: readonly ["active", "partial", "paused", "blocked"];
export declare const FEED_STATUSES: readonly ["active", "paused", "error"];
export declare const RESOLVE_STATES: readonly ["success_full", "success_partial", "low_confidence", "insufficient_results"];
export declare const FRESHNESS_STATES: readonly ["fresh", "watch_newer", "updated", "older_context", "unknown"];
export declare const CANDIDATE_RELEVANCE: readonly ["relevant", "distractor"];
export type ArticleType = (typeof ARTICLE_TYPES)[number];
export type ParserPath = (typeof PARSER_PATHS)[number];
export type ParseStatus = (typeof PARSE_STATUSES)[number];
export type FeedType = (typeof FEED_TYPES)[number];
export type PublisherStatus = (typeof PUBLISHER_STATUSES)[number];
export type FeedStatus = (typeof FEED_STATUSES)[number];
export type ResolveState = (typeof RESOLVE_STATES)[number];
export type FreshnessState = (typeof FRESHNESS_STATES)[number];
export type CandidateRelevance = (typeof CANDIDATE_RELEVANCE)[number];
export interface FeedDefinition {
    readonly feed_type: FeedType;
    readonly url: string;
    readonly section: string;
    readonly status: FeedStatus;
}
export interface FeedSourceSeed {
    readonly publisher_name: string;
    readonly domain: string;
    readonly primary_source: FeedType;
    readonly parser_order: readonly ParserPath[];
    readonly article_type_detection: string;
    readonly status: PublisherStatus;
    readonly notes: string;
    readonly feeds: readonly FeedDefinition[];
}
export interface ExpectedArticleMetadata {
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
}
export interface ParserFixtureAssertions {
    readonly parse_confidence_min: number;
    readonly required_fields: readonly string[];
}
export interface NaverArticleFixture {
    readonly case_id: string;
    readonly url: string;
    readonly expected_status: ParseStatus;
    readonly expected_parser_path: ParserPath;
    readonly tags: readonly string[];
    readonly notes: string;
    readonly assertions: ParserFixtureAssertions;
    readonly expected_metadata: ExpectedArticleMetadata | null;
}
export interface NaverArticleFixtureDataset {
    readonly schema_version: 1;
    readonly dataset_name: string;
    readonly description: string;
    readonly generated_at: string;
    readonly capacity_target: number;
    readonly fixtures: readonly NaverArticleFixture[];
}
export interface ResolveRequestFixture {
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
export interface ResolveBenchmarkCandidate {
    readonly article_id: string;
    readonly url: string;
    readonly publisher_name: string;
    readonly title: string;
    readonly published_at?: string | undefined;
    readonly summary_line?: string | undefined;
    readonly expected_relevance: CandidateRelevance;
    readonly expected_rank?: number | undefined;
}
export interface ResolveBenchmarkExpectation {
    readonly state: ResolveState;
    readonly freshness_state: FreshnessState;
    readonly context_confidence_min: number;
    readonly min_related_count: number;
    readonly max_related_count: number;
    readonly relevant_article_ids: readonly string[];
    readonly expected_top_article_ids: readonly string[];
}
export interface ResolveBenchmarkCase {
    readonly case_id: string;
    readonly source_fixture_case_id: string;
    readonly description: string;
    readonly request: ResolveRequestFixture;
    readonly candidate_pool: readonly ResolveBenchmarkCandidate[];
    readonly expected: ResolveBenchmarkExpectation;
}
export interface ResolveBenchmarkBudgets {
    readonly target_p95_latency_ms: number;
    readonly min_precision_at_5: number;
    readonly candidate_time_window_hours: number;
    readonly min_related_articles: number;
    readonly max_related_articles: number;
}
export interface ResolveBenchmarkDataset {
    readonly schema_version: 1;
    readonly dataset_name: string;
    readonly description: string;
    readonly generated_at: string;
    readonly budgets: ResolveBenchmarkBudgets;
    readonly cases: readonly ResolveBenchmarkCase[];
}
export interface FixtureImportSummary {
    readonly publisher_count: number;
    readonly feed_count: number;
    readonly parser_fixture_count: number;
    readonly parser_capacity_target: number;
    readonly parser_path_coverage: readonly ParserPath[];
    readonly parser_status_coverage: readonly ParseStatus[];
    readonly benchmark_case_count: number;
    readonly benchmark_candidate_count: number;
}
export interface ResolveBenchmarkCaseSummary {
    readonly case_id: string;
    readonly returned_count: number;
    readonly precision_at_k: number;
    readonly state: ResolveState;
    readonly freshness_state: FreshnessState;
}
export interface ResolveBenchmarkSummary {
    readonly case_count: number;
    readonly average_precision_at_k: number;
    readonly case_summaries: readonly ResolveBenchmarkCaseSummary[];
}
export declare function parseFeedSourceSeedFile(value: unknown): readonly FeedSourceSeed[];
export declare function parseNaverArticleFixtureDataset(value: unknown): NaverArticleFixtureDataset;
export declare function parseResolveBenchmarkDataset(value: unknown): ResolveBenchmarkDataset;
export declare function buildFixtureImportSummary(seeds: readonly FeedSourceSeed[], parserDataset: NaverArticleFixtureDataset, benchmarkDataset: ResolveBenchmarkDataset): FixtureImportSummary;
export declare function evaluateResolveBenchmark(dataset: ResolveBenchmarkDataset): ResolveBenchmarkSummary;
//# sourceMappingURL=fixtures.d.ts.map