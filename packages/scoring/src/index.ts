import type {
  BuildArticleFeatureInput,
  CandidateScoreBreakdown,
  PersistedArticleFeature,
  ResolveRequest,
  ResolvedArticleFeatureView
} from '@news-context/shared-types';

const FEATURE_VERSION = 'resolve-v1';
const TITLE_TOKEN_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'after',
  'from',
  'into',
  'amid',
  'over',
  'news',
  'article',
  '정부',
  '기자',
  '뉴스'
]);

function round(value: number): number {
  return Number(value.toFixed(3));
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);

  if (normalized === '') {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(/[^\p{L}\p{N}]+/u)
        .map((token) => token.trim())
        .filter((token) => {
          if (token === '' || TITLE_TOKEN_STOPWORDS.has(token)) {
            return false;
          }

          if (/^\d+$/.test(token)) {
            return false;
          }

          return token.length >= 2 || /[\p{Script=Hangul}]/u.test(token);
        })
    )
  );
}

function extractNumbers(value: string): string[] {
  const matches = value.match(/\b\d[\d,.:/%-]*\b/gu) ?? [];
  return Array.from(new Set(matches.map((entry) => entry.trim()).filter((entry) => entry !== '')));
}

function buildEmbedding(tokens: readonly string[]): Record<string, number> | null {
  if (tokens.length === 0) {
    return null;
  }

  const embedding: Record<string, number> = {};

  for (const token of tokens) {
    embedding[token] = (embedding[token] ?? 0) + 1;
  }

  return embedding;
}

function setOverlap(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = left.filter((entry) => rightSet.has(entry)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return union === 0 ? 0 : intersection / union;
}

function cosineSimilarity(
  left: Record<string, number> | null,
  right: Record<string, number> | null
): number {
  if (left === null || right === null) {
    return 0;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const key of keys) {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function timeProximityScore(
  sourcePublishedAt: string | null | undefined,
  candidatePublishedAt: string | null
): number {
  if (sourcePublishedAt === undefined || sourcePublishedAt === null || candidatePublishedAt === null) {
    return 0.4;
  }

  const sourceMillis = Date.parse(sourcePublishedAt);
  const candidateMillis = Date.parse(candidatePublishedAt);

  if (Number.isNaN(sourceMillis) || Number.isNaN(candidateMillis)) {
    return 0.4;
  }

  const deltaHours = Math.abs(candidateMillis - sourceMillis) / (1000 * 60 * 60);
  return Math.max(0, 1 - Math.min(deltaHours / 72, 1));
}

export function buildArticleFeatures(
  input: BuildArticleFeatureInput,
  computedAt: string = new Date().toISOString()
): PersistedArticleFeature {
  const titleTokens = tokenize(input.title);
  const keywordTokens = Array.from(
    new Set(input.keywords.flatMap((keyword) => tokenize(keyword)))
  );
  const entityTokens = Array.from(
    new Set([
      ...keywordTokens,
      ...tokenize(input.section ?? ''),
      ...titleTokens.filter((token) => token.length >= 3 || /[\p{Script=Hangul}]/u.test(token))
    ])
  ).slice(0, 12);
  const numberTokens = Array.from(
    new Set([
      ...extractNumbers(input.title),
      ...extractNumbers(input.excerpt ?? '')
    ])
  );

  return {
    article_id: '',
    title_tokens: titleTokens,
    entities_json: entityTokens,
    numbers_json: numberTokens,
    keywords_json: keywordTokens,
    embedding: buildEmbedding([...titleTokens, ...keywordTokens]),
    feature_version: FEATURE_VERSION,
    computed_at: computedAt
  };
}

export function buildRequestFeatures(
  request: ResolveRequest,
  computedAt: string = new Date().toISOString()
): PersistedArticleFeature {
  return buildArticleFeatures(
    {
      title: request.title,
      publisher_name: request.publisher_name ?? null,
      author_names: request.author_names ?? [],
      published_at: request.published_at ?? null,
      modified_at: request.modified_at ?? null,
      article_type: request.article_type ?? 'unknown',
      section: request.section ?? null,
      keywords: request.keywords ?? [],
      excerpt: request.body_excerpt ?? null
    },
    computedAt
  );
}

export function scoreCandidate(
  source: ResolveRequest,
  sourceFeature: PersistedArticleFeature,
  candidate: ResolvedArticleFeatureView
): CandidateScoreBreakdown {
  const lexicalTitleSimilarity = setOverlap(sourceFeature.title_tokens, candidate.feature.title_tokens);
  const semanticTitleSimilarity = cosineSimilarity(sourceFeature.embedding, candidate.feature.embedding);
  const entityOverlap = setOverlap(sourceFeature.entities_json, candidate.feature.entities_json);
  const numericOverlap = setOverlap(sourceFeature.numbers_json, candidate.feature.numbers_json);
  const timeProximity = timeProximityScore(source.published_at, candidate.article.published_at);
  const publisherDiversityBonus =
    source.publisher_name === undefined || source.publisher_name === null
      ? 0.03
      : candidate.publisher_name === null
        ? 0.02
        : candidate.publisher_name === source.publisher_name
          ? 0.01
          : 0.05;
  const duplicatePenalty =
    source.canonical_url !== undefined && source.canonical_url === candidate.article.canonical_url
      ? 1
      : source.url === candidate.article.source_url
        ? 1
        : 0;
  const hasMeaningfulMatch =
    lexicalTitleSimilarity >= 0.12 ||
    semanticTitleSimilarity >= 0.2 ||
    entityOverlap > 0 ||
    numericOverlap > 0;

  const rawScore =
    0.32 * lexicalTitleSimilarity +
    0.23 * semanticTitleSimilarity +
    0.2 * entityOverlap +
    0.1 * numericOverlap +
    0.1 * timeProximity +
    0.05 * publisherDiversityBonus -
    duplicatePenalty;
  const finalScore = hasMeaningfulMatch ? Math.min(1, Math.max(0, rawScore * 1.7)) : 0;

  return {
    lexical_title_similarity: round(lexicalTitleSimilarity),
    semantic_title_similarity: round(semanticTitleSimilarity),
    entity_overlap: round(entityOverlap),
    numeric_overlap: round(numericOverlap),
    time_proximity: round(timeProximity),
    publisher_diversity_bonus: round(publisherDiversityBonus),
    duplicate_penalty: round(duplicatePenalty),
    final_score: round(finalScore)
  };
}

export function isFeatureVersionCurrent(feature: PersistedArticleFeature): boolean {
  return feature.feature_version === FEATURE_VERSION;
}

export function getFeatureVersion(): string {
  return FEATURE_VERSION;
}
