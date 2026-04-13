export const ARTICLE_TYPES = ['news', 'opinion', 'analysis', 'editorial', 'unknown'] as const;
export const PARSER_PATHS = ['jsonld', 'meta', 'dom'] as const;
export const PARSE_STATUSES = ['success', 'partial', 'unsupported'] as const;
export const FEED_TYPES = ['rss', 'sitemap', 'search_fallback'] as const;
export const PUBLISHER_STATUSES = ['active', 'partial', 'paused', 'blocked'] as const;
export const FEED_STATUSES = ['active', 'paused', 'error'] as const;
export const RESOLVE_STATES = ['success_full', 'success_partial', 'low_confidence', 'insufficient_results'] as const;
export const FRESHNESS_STATES = ['fresh', 'watch_newer', 'updated', 'older_context', 'unknown'] as const;
export const CANDIDATE_RELEVANCE = ['relevant', 'distractor'] as const;

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

const REQUIRED_FIXTURE_FIELDS = ['title', 'publisher_name', 'author_names', 'published_at', 'modified_at', 'article_type', 'section', 'keywords', 'body_excerpt'] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert(isRecord(value), `${label} must be an object.`);
  return value;
}

function asString(value: unknown, label: string): string {
  assert(typeof value === 'string' && value.trim() !== '', `${label} must be a non-empty string.`);
  return value;
}

function asUrl(value: unknown, label: string): string {
  const parsed = asString(value, label);
  const url = new URL(parsed);
  assert(url.protocol === 'https:' || url.protocol === 'http:', `${label} must be an http(s) URL.`);
  return parsed;
}

function asDateTime(value: unknown, label: string): string {
  const parsed = asString(value, label);
  assert(!Number.isNaN(Date.parse(parsed)), `${label} must be an ISO date-time string.`);
  return parsed;
}

function asNumber(value: unknown, label: string): number {
  assert(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number.`);
  return value;
}

function asInteger(value: unknown, label: string): number {
  const parsed = asNumber(value, label);
  assert(Number.isInteger(parsed), `${label} must be an integer.`);
  return parsed;
}

function asBoolean(value: unknown, label: string): boolean {
  assert(typeof value === 'boolean', `${label} must be a boolean.`);
  return value;
}

function asEnum<T extends readonly string[]>(value: unknown, label: string, allowed: T): T[number] {
  const parsed = asString(value, label);
  assert(allowed.includes(parsed), `${label} must be one of: ${allowed.join(', ')}.`);
  return parsed as T[number];
}

function asStringArray(value: unknown, label: string): readonly string[] {
  assert(
    Array.isArray(value) &&
      value.every((entry) => typeof entry === 'string' && entry.trim() !== ''),
    `${label} must be a string array.`
  );
  return value as readonly string[];
}

function asOptionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : asString(value, label);
}

function asOptionalDateTime(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : asDateTime(value, label);
}

function asOptionalStringArray(value: unknown, label: string): readonly string[] | undefined {
  return value === undefined ? undefined : asStringArray(value, label);
}

function asOptionalArticleType(value: unknown, label: string): ArticleType | undefined {
  return value === undefined ? undefined : asEnum(value, label, ARTICLE_TYPES);
}

function uniqueInInputOrder<T extends string>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function parseMetadata(value: unknown, label: string): ExpectedArticleMetadata {
  const record = asRecord(value, label);
  return {
    canonical_url: asOptionalString(record['canonical_url'], `${label}.canonical_url`),
    title: asString(record['title'], `${label}.title`),
    publisher_name: asOptionalString(record['publisher_name'], `${label}.publisher_name`),
    author_names: asOptionalStringArray(record['author_names'], `${label}.author_names`),
    published_at: asOptionalDateTime(record['published_at'], `${label}.published_at`),
    modified_at: asOptionalDateTime(record['modified_at'], `${label}.modified_at`),
    article_type: asOptionalArticleType(record['article_type'], `${label}.article_type`),
    section: asOptionalString(record['section'], `${label}.section`),
    keywords: asOptionalStringArray(record['keywords'], `${label}.keywords`),
    body_excerpt: asOptionalString(record['body_excerpt'], `${label}.body_excerpt`)
  };
}

function parseResolveRequest(value: unknown, label: string): ResolveRequestFixture {
  const record = asRecord(value, label);
  const parseConfidence = asNumber(record['parse_confidence'], `${label}.parse_confidence`);

  assert(parseConfidence >= 0 && parseConfidence <= 1, `${label}.parse_confidence must be between 0 and 1.`);

  return {
    url: asUrl(record['url'], `${label}.url`),
    canonical_url: asOptionalString(record['canonical_url'], `${label}.canonical_url`),
    title: asString(record['title'], `${label}.title`),
    publisher_name: asOptionalString(record['publisher_name'], `${label}.publisher_name`),
    author_names: asOptionalStringArray(record['author_names'], `${label}.author_names`),
    published_at: asOptionalDateTime(record['published_at'], `${label}.published_at`),
    modified_at: asOptionalDateTime(record['modified_at'], `${label}.modified_at`),
    article_type: asOptionalArticleType(record['article_type'], `${label}.article_type`),
    section: asOptionalString(record['section'], `${label}.section`),
    keywords: asOptionalStringArray(record['keywords'], `${label}.keywords`),
    body_excerpt: asOptionalString(record['body_excerpt'], `${label}.body_excerpt`),
    correction_note_detected:
      record['correction_note_detected'] === undefined
        ? undefined
        : asBoolean(record['correction_note_detected'], `${label}.correction_note_detected`),
    parse_confidence: parseConfidence,
    anon_id: asOptionalString(record['anon_id'], `${label}.anon_id`),
    page_lang: asOptionalString(record['page_lang'], `${label}.page_lang`)
  };
}

function parseBenchmarkCandidate(value: unknown, label: string): ResolveBenchmarkCandidate {
  const record = asRecord(value, label);
  const expectedRank = record['expected_rank'] === undefined ? undefined : asInteger(record['expected_rank'], `${label}.expected_rank`);

  if (expectedRank !== undefined) {
    assert(expectedRank >= 1, `${label}.expected_rank must be at least 1.`);
  }

  return {
    article_id: asString(record['article_id'], `${label}.article_id`),
    url: asUrl(record['url'], `${label}.url`),
    publisher_name: asString(record['publisher_name'], `${label}.publisher_name`),
    title: asString(record['title'], `${label}.title`),
    published_at: asOptionalDateTime(record['published_at'], `${label}.published_at`),
    summary_line: asOptionalString(record['summary_line'], `${label}.summary_line`),
    expected_relevance: asEnum(record['expected_relevance'], `${label}.expected_relevance`, CANDIDATE_RELEVANCE),
    expected_rank: expectedRank
  };
}

function parseBenchmarkExpectation(value: unknown, label: string): ResolveBenchmarkExpectation {
  const record = asRecord(value, label);
  const contextConfidence = asNumber(record['context_confidence_min'], `${label}.context_confidence_min`);
  const minRelated = asInteger(record['min_related_count'], `${label}.min_related_count`);
  const maxRelated = asInteger(record['max_related_count'], `${label}.max_related_count`);
  const relevantArticleIds = asStringArray(record['relevant_article_ids'], `${label}.relevant_article_ids`);
  const expectedTopArticleIds = asStringArray(record['expected_top_article_ids'], `${label}.expected_top_article_ids`);

  assert(contextConfidence >= 0 && contextConfidence <= 1, `${label}.context_confidence_min must be between 0 and 1.`);
  assert(minRelated >= 0, `${label}.min_related_count must be zero or greater.`);
  assert(maxRelated >= minRelated, `${label}.max_related_count must be greater than or equal to min_related_count.`);

  return {
    state: asEnum(record['state'], `${label}.state`, RESOLVE_STATES),
    freshness_state: asEnum(record['freshness_state'], `${label}.freshness_state`, FRESHNESS_STATES),
    context_confidence_min: contextConfidence,
    min_related_count: minRelated,
    max_related_count: maxRelated,
    relevant_article_ids: relevantArticleIds,
    expected_top_article_ids: expectedTopArticleIds
  };
}

export function parseFeedSourceSeedFile(value: unknown): readonly FeedSourceSeed[] {
  assert(Array.isArray(value), 'feed_sources.seed.json must be an array.');

  const seeds = value.map((entry, index) => {
    const label = `feed_sources.seed.json[${index}]`;
    const record = asRecord(entry, label);
    const feedsValue = record['feeds'];

    assert(Array.isArray(feedsValue) && feedsValue.length > 0, `${label}.feeds must be a non-empty array.`);

    const parserOrder = asStringArray(record['parser_order'], `${label}.parser_order`).map((item, itemIndex) =>
      asEnum(item, `${label}.parser_order[${itemIndex}]`, PARSER_PATHS)
    );

    assert(new Set(parserOrder).size === parserOrder.length, `${label}.parser_order must not contain duplicates.`);

    return {
      publisher_name: asString(record['publisher_name'], `${label}.publisher_name`),
      domain: asString(record['domain'], `${label}.domain`),
      primary_source: asEnum(record['primary_source'], `${label}.primary_source`, FEED_TYPES),
      parser_order: parserOrder,
      article_type_detection: asString(record['article_type_detection'], `${label}.article_type_detection`),
      status: asEnum(record['status'], `${label}.status`, PUBLISHER_STATUSES),
      notes: asString(record['notes'], `${label}.notes`),
      feeds: feedsValue.map((feedEntry, feedIndex) => {
        const feedLabel = `${label}.feeds[${feedIndex}]`;
        const feedRecord = asRecord(feedEntry, feedLabel);

        return {
          feed_type: asEnum(feedRecord['feed_type'], `${feedLabel}.feed_type`, FEED_TYPES),
          url: asUrl(feedRecord['url'], `${feedLabel}.url`),
          section: asString(feedRecord['section'], `${feedLabel}.section`),
          status: asEnum(feedRecord['status'], `${feedLabel}.status`, FEED_STATUSES)
        } satisfies FeedDefinition;
      })
    } satisfies FeedSourceSeed;
  });

  assert(new Set(seeds.map((seed) => seed.domain)).size === seeds.length, 'feed_sources.seed.json domain values must be unique.');

  return seeds;
}

export function parseNaverArticleFixtureDataset(value: unknown): NaverArticleFixtureDataset {
  const record = asRecord(value, 'naver-articles.json');
  const fixturesValue = record['fixtures'];

  assert(Array.isArray(fixturesValue) && fixturesValue.length > 0, 'naver-articles.json.fixtures must be a non-empty array.');

  const dataset: NaverArticleFixtureDataset = {
    schema_version: asInteger(record['schema_version'], 'naver-articles.json.schema_version') as 1,
    dataset_name: asString(record['dataset_name'], 'naver-articles.json.dataset_name'),
    description: asString(record['description'], 'naver-articles.json.description'),
    generated_at: asDateTime(record['generated_at'], 'naver-articles.json.generated_at'),
    capacity_target: asInteger(record['capacity_target'], 'naver-articles.json.capacity_target'),
    fixtures: fixturesValue.map((entry, index) => {
      const label = `naver-articles.json.fixtures[${index}]`;
      const fixtureRecord = asRecord(entry, label);
      const assertionsRecord = asRecord(fixtureRecord['assertions'], `${label}.assertions`);
      const expectedStatus = asEnum(fixtureRecord['expected_status'], `${label}.expected_status`, PARSE_STATUSES);

      const fixture: NaverArticleFixture = {
        case_id: asString(fixtureRecord['case_id'], `${label}.case_id`),
        url: asUrl(fixtureRecord['url'], `${label}.url`),
        expected_status: expectedStatus,
        expected_parser_path: asEnum(fixtureRecord['expected_parser_path'], `${label}.expected_parser_path`, PARSER_PATHS),
        tags: asStringArray(fixtureRecord['tags'], `${label}.tags`),
        notes: asString(fixtureRecord['notes'], `${label}.notes`),
        assertions: {
          parse_confidence_min: asNumber(assertionsRecord['parse_confidence_min'], `${label}.assertions.parse_confidence_min`),
          required_fields: asStringArray(assertionsRecord['required_fields'], `${label}.assertions.required_fields`)
        },
        expected_metadata:
          fixtureRecord['expected_metadata'] === null
            ? null
            : parseMetadata(fixtureRecord['expected_metadata'], `${label}.expected_metadata`)
      };

      assert(new URL(fixture.url).hostname === 'n.news.naver.com', `${label}.url must point to n.news.naver.com.`);
      assert(
        fixture.assertions.parse_confidence_min >= 0 && fixture.assertions.parse_confidence_min <= 1,
        `${label}.assertions.parse_confidence_min must be between 0 and 1.`
      );
      assert(
        fixture.assertions.required_fields.every((field) =>
          REQUIRED_FIXTURE_FIELDS.includes(field as (typeof REQUIRED_FIXTURE_FIELDS)[number])
        ),
        `${label}.assertions.required_fields contains an unsupported field.`
      );
      assert(new Set(fixture.tags).size === fixture.tags.length, `${label}.tags must not contain duplicates.`);

      if (fixture.expected_status === 'unsupported') {
        assert(fixture.expected_metadata === null, `${label}.expected_metadata must be null for unsupported fixtures.`);
      } else {
        assert(fixture.expected_metadata !== null, `${label}.expected_metadata must be present for supported fixtures.`);

        if (fixture.expected_status === 'success') {
          assert(
            fixture.expected_metadata.publisher_name !== undefined &&
              fixture.expected_metadata.published_at !== undefined,
            `${label} success fixtures require publisher_name and published_at.`
          );
        }
      }

      return fixture;
    })
  };

  assert(dataset.schema_version === 1, 'naver-articles.json.schema_version must be 1.');
  assert(dataset.capacity_target >= 300, 'naver-articles.json.capacity_target must be at least 300.');
  assert(new Set(dataset.fixtures.map((fixture) => fixture.case_id)).size === dataset.fixtures.length, 'naver-articles.json case_id values must be unique.');
  assert(new Set(dataset.fixtures.map((fixture) => fixture.url)).size === dataset.fixtures.length, 'naver-articles.json url values must be unique.');

  return dataset;
}

export function parseResolveBenchmarkDataset(value: unknown): ResolveBenchmarkDataset {
  const record = asRecord(value, 'resolve-benchmark.json');
  const budgetsRecord = asRecord(record['budgets'], 'resolve-benchmark.json.budgets');
  const casesValue = record['cases'];

  assert(Array.isArray(casesValue) && casesValue.length > 0, 'resolve-benchmark.json.cases must be a non-empty array.');

  const budgets: ResolveBenchmarkBudgets = {
    target_p95_latency_ms: asInteger(budgetsRecord['target_p95_latency_ms'], 'resolve-benchmark.json.budgets.target_p95_latency_ms'),
    min_precision_at_5: asNumber(budgetsRecord['min_precision_at_5'], 'resolve-benchmark.json.budgets.min_precision_at_5'),
    candidate_time_window_hours: asInteger(
      budgetsRecord['candidate_time_window_hours'],
      'resolve-benchmark.json.budgets.candidate_time_window_hours'
    ),
    min_related_articles: asInteger(budgetsRecord['min_related_articles'], 'resolve-benchmark.json.budgets.min_related_articles'),
    max_related_articles: asInteger(budgetsRecord['max_related_articles'], 'resolve-benchmark.json.budgets.max_related_articles')
  };

  assert(budgets.target_p95_latency_ms > 0, 'resolve-benchmark.json.budgets.target_p95_latency_ms must be greater than 0.');
  assert(
    budgets.min_precision_at_5 >= 0 && budgets.min_precision_at_5 <= 1,
    'resolve-benchmark.json.budgets.min_precision_at_5 must be between 0 and 1.'
  );
  assert(
    budgets.candidate_time_window_hours > 0,
    'resolve-benchmark.json.budgets.candidate_time_window_hours must be greater than 0.'
  );
  assert(
    budgets.min_related_articles >= 1,
    'resolve-benchmark.json.budgets.min_related_articles must be at least 1.'
  );
  assert(
    budgets.max_related_articles >= budgets.min_related_articles,
    'resolve-benchmark.json.budgets.max_related_articles must be greater than or equal to min_related_articles.'
  );

  const cases = casesValue.map((entry, index) => {
    const label = `resolve-benchmark.json.cases[${index}]`;
    const caseRecord = asRecord(entry, label);
    const candidatePoolValue = caseRecord['candidate_pool'];

    assert(Array.isArray(candidatePoolValue) && candidatePoolValue.length > 0, `${label}.candidate_pool must be a non-empty array.`);

    const parsedCase: ResolveBenchmarkCase = {
      case_id: asString(caseRecord['case_id'], `${label}.case_id`),
      source_fixture_case_id: asString(caseRecord['source_fixture_case_id'], `${label}.source_fixture_case_id`),
      description: asString(caseRecord['description'], `${label}.description`),
      request: parseResolveRequest(caseRecord['request'], `${label}.request`),
      candidate_pool: candidatePoolValue.map((candidateEntry, candidateIndex) =>
        parseBenchmarkCandidate(candidateEntry, `${label}.candidate_pool[${candidateIndex}]`)
      ),
      expected: parseBenchmarkExpectation(caseRecord['expected'], `${label}.expected`)
    };

    const candidateIds = parsedCase.candidate_pool.map((candidate) => candidate.article_id);
    const rankedCandidates = parsedCase.candidate_pool
      .filter((candidate) => candidate.expected_rank !== undefined)
      .map((candidate) => candidate.expected_rank as number);
    const relevantCandidates = parsedCase.candidate_pool.filter((candidate) => candidate.expected_relevance === 'relevant');
    const relevantCandidateIds = relevantCandidates.map((candidate) => candidate.article_id);

    assert(new Set(candidateIds).size === candidateIds.length, `${label}.candidate_pool article_id values must be unique.`);
    assert(new Set(rankedCandidates).size === rankedCandidates.length, `${label}.candidate_pool expected_rank values must be unique when provided.`);
    assert(new Set(parsedCase.expected.relevant_article_ids).size === parsedCase.expected.relevant_article_ids.length, `${label}.expected.relevant_article_ids must be unique.`);
    assert(new Set(parsedCase.expected.expected_top_article_ids).size === parsedCase.expected.expected_top_article_ids.length, `${label}.expected.expected_top_article_ids must be unique.`);

    assert(
      parsedCase.expected.relevant_article_ids.every((articleId) => candidateIds.includes(articleId)),
      `${label}.expected.relevant_article_ids must exist in candidate_pool.`
    );
    assert(
      parsedCase.expected.expected_top_article_ids.every((articleId) => parsedCase.expected.relevant_article_ids.includes(articleId)),
      `${label}.expected.expected_top_article_ids must be a subset of expected.relevant_article_ids.`
    );
    assert(
      parsedCase.expected.relevant_article_ids.every((articleId) => relevantCandidateIds.includes(articleId)) &&
        relevantCandidateIds.every((articleId) => parsedCase.expected.relevant_article_ids.includes(articleId)),
      `${label}.expected.relevant_article_ids must match candidate_pool expected_relevance labels.`
    );
    assert(
      parsedCase.expected.max_related_count <= budgets.max_related_articles,
      `${label}.expected.max_related_count must not exceed the global max_related_articles budget.`
    );
    assert(
      parsedCase.expected.min_related_count >= 0 &&
        parsedCase.expected.min_related_count <= parsedCase.expected.max_related_count,
      `${label}.expected.min_related_count must be between 0 and max_related_count.`
    );
    assert(
      parsedCase.expected.expected_top_article_ids.length <= parsedCase.expected.max_related_count,
      `${label}.expected.expected_top_article_ids must not exceed expected.max_related_count.`
    );
    assert(
      parsedCase.expected.context_confidence_min >= 0 && parsedCase.expected.context_confidence_min <= 1,
      `${label}.expected.context_confidence_min must be between 0 and 1.`
    );

    return parsedCase;
  });

  const dataset: ResolveBenchmarkDataset = {
    schema_version: asInteger(record['schema_version'], 'resolve-benchmark.json.schema_version') as 1,
    dataset_name: asString(record['dataset_name'], 'resolve-benchmark.json.dataset_name'),
    description: asString(record['description'], 'resolve-benchmark.json.description'),
    generated_at: asDateTime(record['generated_at'], 'resolve-benchmark.json.generated_at'),
    budgets,
    cases
  };

  assert(dataset.schema_version === 1, 'resolve-benchmark.json.schema_version must be 1.');
  assert(new Set(dataset.cases.map((entry) => entry.case_id)).size === dataset.cases.length, 'resolve-benchmark.json case_id values must be unique.');

  return dataset;
}

export function buildFixtureImportSummary(
  seeds: readonly FeedSourceSeed[],
  parserDataset: NaverArticleFixtureDataset,
  benchmarkDataset: ResolveBenchmarkDataset
): FixtureImportSummary {
  return {
    publisher_count: seeds.length,
    feed_count: seeds.reduce((total, seed) => total + seed.feeds.length, 0),
    parser_fixture_count: parserDataset.fixtures.length,
    parser_capacity_target: parserDataset.capacity_target,
    parser_path_coverage: uniqueInInputOrder(parserDataset.fixtures.map((fixture) => fixture.expected_parser_path)),
    parser_status_coverage: uniqueInInputOrder(parserDataset.fixtures.map((fixture) => fixture.expected_status)),
    benchmark_case_count: benchmarkDataset.cases.length,
    benchmark_candidate_count: benchmarkDataset.cases.reduce((total, benchmarkCase) => total + benchmarkCase.candidate_pool.length, 0)
  };
}

export function evaluateResolveBenchmark(dataset: ResolveBenchmarkDataset): ResolveBenchmarkSummary {
  const caseSummaries = dataset.cases.map((benchmarkCase) => {
    const relevantIds = new Set(benchmarkCase.expected.relevant_article_ids);
    const returnedIds = benchmarkCase.expected.expected_top_article_ids;
    const hits = returnedIds.filter((articleId) => relevantIds.has(articleId)).length;
    const precisionAtK = returnedIds.length === 0 ? 0 : hits / returnedIds.length;

    return {
      case_id: benchmarkCase.case_id,
      returned_count: returnedIds.length,
      precision_at_k: precisionAtK,
      state: benchmarkCase.expected.state,
      freshness_state: benchmarkCase.expected.freshness_state
    } satisfies ResolveBenchmarkCaseSummary;
  });

  const averagePrecisionAtK =
    caseSummaries.length === 0
      ? 0
      : caseSummaries.reduce((total, summary) => total + summary.precision_at_k, 0) / caseSummaries.length;

  return {
    case_count: dataset.cases.length,
    average_precision_at_k: averagePrecisionAtK,
    case_summaries: caseSummaries
  };
}
