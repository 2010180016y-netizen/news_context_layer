import { createHash } from 'node:crypto';

import {
  buildArticleFeatures,
  buildRequestFeatures,
  getFeatureVersion,
  isFeatureVersionCurrent,
  scoreCandidate
} from '@news-context/scoring';
import type {
  ArticleFeatureRecord,
  CanonicalArticleRecord,
  NormalizedArticleInput,
  PersistedArticleFeature,
  ResolveCommonSignals,
  ResolveFreshness,
  ResolveRelatedArticle,
  ResolveRequest,
  ResolveResponse,
  ResolveState,
  ResolvedArticleFeatureView,
  ScoredRelatedArticle
} from '@news-context/shared-types';

import { ArticleRepository } from '../repositories/article-repository.js';
import { FileNewsContextStore } from '../repositories/file-store.js';
import { ClusterService } from './cluster-service.js';

const CANDIDATE_WINDOW_HOURS = 72;
const MAX_RELATED_ARTICLES = 5;
const UI_THRESHOLD = 0.65;
const INSUFFICIENT_BACKFILL_THRESHOLD = 0.55;

export interface ResolveMonitoringEvent {
  readonly kind: 'resolve_low_confidence' | 'resolve_empty_result' | 'resolve_exception';
  readonly url: string;
  readonly article_id?: string | undefined;
  readonly cluster_id?: string | undefined;
  readonly related_count?: number | undefined;
  readonly context_confidence?: number | undefined;
  readonly message?: string | undefined;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function normalizeCanonicalUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';

  for (const removable of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']) {
    url.searchParams.delete(removable);
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

function createTitleHash(title: string): string {
  return createHash('sha256')
    .update(title.trim().toLowerCase().replace(/\s+/g, ' '))
    .digest('hex');
}

function toNullable(value: string | undefined): string | null {
  return value === undefined || value.trim() === '' ? null : value;
}

function resolveRequestArticleInput(
  request: ResolveRequest,
  publisherId: string | null
): NormalizedArticleInput {
  const canonicalUrl = normalizeCanonicalUrl(request.canonical_url ?? request.url);

  return {
    publisher_id: publisherId,
    canonical_url: canonicalUrl,
    source_url: request.url,
    title: request.title.trim(),
    subtitle: null,
    author_json: [...(request.author_names ?? [])],
    published_at: toNullable(request.published_at),
    modified_at: toNullable(request.modified_at),
    article_type: request.article_type ?? 'unknown',
    section: toNullable(request.section),
    excerpt: toNullable(request.body_excerpt),
    thumbnail_url: null,
    language_code: request.page_lang ?? 'ko',
    hash_title: createTitleHash(request.title),
    status: 'active',
    parse_confidence: request.parse_confidence
  };
}

function withinCandidateWindow(
  sourcePublishedAt: string | null | undefined,
  candidatePublishedAt: string | null
): boolean {
  if (sourcePublishedAt === undefined || sourcePublishedAt === null || candidatePublishedAt === null) {
    return true;
  }

  const sourceMillis = Date.parse(sourcePublishedAt);
  const candidateMillis = Date.parse(candidatePublishedAt);

  if (Number.isNaN(sourceMillis) || Number.isNaN(candidateMillis)) {
    return true;
  }

  const deltaHours = Math.abs(candidateMillis - sourceMillis) / (1000 * 60 * 60);
  return deltaHours <= CANDIDATE_WINDOW_HOURS;
}

function ratioOverlap(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  const hits = left.filter((entry) => rightSet.has(entry)).length;
  return hits / Math.max(left.length, right.length);
}

function hasCandidateSeedSignals(
  sourceFeature: PersistedArticleFeature,
  candidateFeature: PersistedArticleFeature,
  request: ResolveRequest,
  candidate: CanonicalArticleRecord
): boolean {
  const titleOverlap = ratioOverlap(sourceFeature.title_tokens, candidateFeature.title_tokens);
  const entityOverlap = ratioOverlap(sourceFeature.entities_json, candidateFeature.entities_json);
  const numericOverlap = ratioOverlap(sourceFeature.numbers_json, candidateFeature.numbers_json);
  const sectionMatch =
    request.section !== undefined &&
    request.section !== null &&
    candidate.section !== null &&
    candidate.section === request.section;
  const sameArticleType =
    request.article_type !== undefined &&
    request.article_type !== 'unknown' &&
    candidate.article_type === request.article_type;

  if (entityOverlap >= 0.2 || numericOverlap >= 0.5) {
    return true;
  }

  if (titleOverlap >= 0.25) {
    return true;
  }

  return sectionMatch && (titleOverlap >= 0.12 || sameArticleType);
}

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildCommonSignals(relatedArticles: readonly ScoredRelatedArticle[]): ResolveCommonSignals {
  const entityCounts = new Map<string, number>();
  const numberCounts = new Map<string, number>();

  for (const article of relatedArticles) {
    for (const entity of new Set(article.feature.entities_json)) {
      entityCounts.set(entity, (entityCounts.get(entity) ?? 0) + 1);
    }

    for (const number of new Set(article.feature.numbers_json)) {
      numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1);
    }
  }

  const entities = [...entityCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([entity]) => entity);
  const numbers = [...numberCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([number]) => number);
  const denominator = Math.max(1, relatedArticles.length);
  const confidence =
    entities.length === 0 && numbers.length === 0
      ? 0
      : round(
          Math.min(
            1,
            (entities.reduce((total, entity) => total + (entityCounts.get(entity) ?? 0), 0) +
              numbers.reduce((total, number) => total + (numberCounts.get(number) ?? 0), 0)) /
              (denominator * 5)
          )
        );

  return {
    entities,
    numbers,
    confidence
  };
}

function buildFreshness(
  request: ResolveRequest,
  sourceArticle: CanonicalArticleRecord,
  relatedArticles: readonly ScoredRelatedArticle[],
  latestArticleTs: string | null,
  newerArticleCount: number
): ResolveFreshness {
  const modifiedDeltaMinutes =
    request.modified_at !== undefined && sourceArticle.published_at !== null
      ? Math.abs(Date.parse(request.modified_at) - Date.parse(sourceArticle.published_at)) / (1000 * 60)
      : 0;

  if (request.correction_note_detected === true || modifiedDeltaMinutes >= 120) {
    return {
      state: 'updated',
      message: 'The current article looks updated or corrected.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  if (request.parse_confidence >= 0.9 && relatedArticles.length >= 3) {
    return {
      state: 'fresh',
      message: 'This article is strong enough to serve as the current reference point.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  if (relatedArticles.length < 3 && newerArticleCount > 0) {
    return {
      state: 'updated',
      message: 'Coverage is still evolving and only partial context is available.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  if (newerArticleCount >= 2) {
    return {
      state: 'watch_newer',
      message: 'There are newer related articles worth watching.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  const sourcePublishedAt = sourceArticle.published_at;

  if (sourcePublishedAt !== null && latestArticleTs !== null && sourcePublishedAt === latestArticleTs) {
    return {
      state: 'fresh',
      message: 'This article is among the freshest items in the cluster.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  if (newerArticleCount > 0) {
    return {
      state: 'older_context',
      message: 'Newer context exists for this story cluster.',
      newer_article_count: newerArticleCount,
      latest_article_ts: latestArticleTs
    };
  }

  return {
    state: 'unknown',
    message: 'Freshness could not be determined confidently.',
    newer_article_count: newerArticleCount,
    latest_article_ts: latestArticleTs
  };
}

function resolveContextState(
  request: ResolveRequest,
  contextConfidence: number,
  relatedCount: number
): ResolveState {
  if (relatedCount < 3) {
    return 'insufficient_results';
  }

  if (request.parse_confidence < 0.7 || contextConfidence < 0.65) {
    return 'low_confidence';
  }

  if (relatedCount < MAX_RELATED_ARTICLES) {
    return 'success_partial';
  }

  return 'success_full';
}

function selectTopRelated(scoredCandidates: readonly ScoredRelatedArticle[]): ScoredRelatedArticle[] {
  if (scoredCandidates.length === 0) {
    return [];
  }

  const bestScore = scoredCandidates[0]?.score ?? 0;
  const effectivePrimaryThreshold = Math.min(UI_THRESHOLD, round(bestScore * 0.85));
  const effectiveFallbackThreshold = Math.min(
    INSUFFICIENT_BACKFILL_THRESHOLD,
    round(bestScore * 0.5)
  );
  const primaryPool = scoredCandidates.filter((candidate) => candidate.score >= effectivePrimaryThreshold);
  const fallbackPool =
    primaryPool.length >= 3
      ? primaryPool
      : scoredCandidates.filter((candidate) => candidate.score >= effectiveFallbackThreshold);
  const remaining = [...fallbackPool];
  const selected: ScoredRelatedArticle[] = [];
  const seenPublishers = new Set<string>();
  const seenTitleKeys = new Set<string>();

  while (remaining.length > 0 && selected.length < MAX_RELATED_ARTICLES) {
    remaining.sort((left, right) => {
      const leftBonus = seenPublishers.has(left.publisher_name) ? 0 : 0.03;
      const rightBonus = seenPublishers.has(right.publisher_name) ? 0 : 0.03;
      return right.score + rightBonus - (left.score + leftBonus);
    });

    const next = remaining.shift();

    if (next === undefined) {
      break;
    }

    const titleKey = `${normalizeTitleKey(next.article.title)}::${next.publisher_name}`;

    if (seenTitleKeys.has(titleKey)) {
      continue;
    }

    selected.push(next);
    seenPublishers.add(next.publisher_name);
    seenTitleKeys.add(titleKey);
  }

  return selected;
}

function toRelatedArticle(candidate: ScoredRelatedArticle): ResolveRelatedArticle {
  return {
    article_id: candidate.article.id,
    url: candidate.article.canonical_url,
    publisher_name: candidate.publisher_name,
    title: candidate.article.title,
    published_at: candidate.article.published_at,
    summary_line: candidate.article.excerpt,
    score: round(candidate.score)
  };
}

export class ResolveService {
  private readonly articleRepository: ArticleRepository;

  private readonly clusterService: ClusterService;

  private readonly monitoringHook: (event: ResolveMonitoringEvent) => void;

  public constructor(
    private readonly store: FileNewsContextStore = new FileNewsContextStore(),
    options: {
      readonly monitoringHook?: ((event: ResolveMonitoringEvent) => void) | undefined;
    } = {}
  ) {
    this.articleRepository = new ArticleRepository(store);
    this.clusterService = new ClusterService(store);
    this.monitoringHook = options.monitoringHook ?? (() => undefined);
  }

  public async resolve(request: ResolveRequest): Promise<ResolveResponse> {
    try {
      if (request.title.trim() === '' || request.url.trim() === '') {
        throw new Error('Resolve request requires url and title.');
      }

      if (request.parse_confidence < 0 || request.parse_confidence > 1) {
        throw new Error('parse_confidence must be between 0 and 1.');
      }

      const publisherId = await this.findPublisherId(request);
      const sourceUpsert = await this.articleRepository.upsertArticle(
        resolveRequestArticleInput(request, publisherId),
        'resolve_request'
      );
      await this.ensureArticleFeatures([sourceUpsert.article.id]);

      const sourceView = await this.getResolvedArticleFeatureView(sourceUpsert.article.id);

      if (sourceView === null) {
        throw new Error(`Source article feature missing for ${sourceUpsert.article.id}.`);
      }

      const sourceFeature = sourceView.feature;
      const requestFeature = buildRequestFeatures(request, sourceFeature.computed_at);
      const candidateViews = await this.listCandidateViews(sourceUpsert.article, request);
      const scoredCandidates = candidateViews
        .map((candidate) => {
          const breakdown = scoreCandidate(request, requestFeature, candidate);

          return {
            article: candidate.article,
            feature: candidate.feature,
            publisher_name: candidate.publisher_name ?? new URL(candidate.article.canonical_url).hostname,
            score: breakdown.final_score,
            breakdown
          } satisfies ScoredRelatedArticle;
        })
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score);
      const relatedArticles = selectTopRelated(scoredCandidates);
      const clusterSnapshot = await this.clusterService.syncCluster({
        sourceArticleId: sourceUpsert.article.id,
        sourceFeature,
        sourceView,
        scoredCandidates: relatedArticles
      });
      const latestArticleTs = clusterSnapshot.members.reduce<string | null>((latest, member) => {
        const candidate = member.article.published_at ?? member.article.created_at;

        if (latest === null) {
          return candidate;
        }

        return Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
      }, null);
      const sourcePublishedAt = sourceUpsert.article.published_at;
      const newerArticleCount =
        sourcePublishedAt === null
          ? 0
          : relatedArticles.filter((candidate) => {
              const candidatePublishedAt = candidate.article.published_at;
              return (
                candidatePublishedAt !== null && Date.parse(candidatePublishedAt) > Date.parse(sourcePublishedAt)
              );
            }).length;
      const averageRelatedScore =
        relatedArticles.length === 0
          ? 0
          : relatedArticles.reduce((total, candidate) => total + candidate.score, 0) /
            relatedArticles.length;
      const coverageSupport = Math.min(1, relatedArticles.length / 3);
      const contextConfidence = round(
        Math.min(
          1,
          0.55 * request.parse_confidence +
            0.25 * coverageSupport +
            0.2 * averageRelatedScore +
            (relatedArticles.length > 0 ? 0.02 : 0)
        )
      );
      const state = resolveContextState(request, contextConfidence, relatedArticles.length);
      const freshness = buildFreshness(
        request,
        sourceUpsert.article,
        relatedArticles,
        latestArticleTs,
        newerArticleCount
      );
      const commonSignals = buildCommonSignals(relatedArticles);
      const response: ResolveResponse = {
        article_id: sourceUpsert.article.id,
        cluster_id: clusterSnapshot.cluster.id,
        context_confidence: contextConfidence,
        state,
        source_card: {
          title: sourceUpsert.article.title,
          publisher_name: request.publisher_name ?? sourceView.publisher_name,
          author_names: request.author_names ?? sourceUpsert.article.author_json,
          published_at: sourceUpsert.article.published_at,
          modified_at: sourceUpsert.article.modified_at,
          article_type: sourceUpsert.article.article_type,
          section: sourceUpsert.article.section
        },
        freshness,
        common_signals: commonSignals,
        related_articles: relatedArticles.map((candidate) => toRelatedArticle(candidate)),
        ui_hints: {
          show_upgrade_cta: false,
          show_feedback_prompt: true
        },
        disclaimer:
          state === 'low_confidence' || state === 'insufficient_results'
            ? 'Context is heuristic and may be incomplete.'
            : 'Context is ranked heuristically from recent related coverage.'
      };

      if (response.related_articles.length === 0) {
        this.monitoringHook({
          kind: 'resolve_empty_result',
          url: request.url,
          article_id: response.article_id,
          cluster_id: response.cluster_id,
          related_count: 0,
          context_confidence: response.context_confidence
        });
      } else if (response.state === 'low_confidence' || response.state === 'insufficient_results') {
        this.monitoringHook({
          kind: 'resolve_low_confidence',
          url: request.url,
          article_id: response.article_id,
          cluster_id: response.cluster_id,
          related_count: response.related_articles.length,
          context_confidence: response.context_confidence
        });
      }

      return response;
    } catch (error: unknown) {
      this.monitoringHook({
        kind: 'resolve_exception',
        url: request.url,
        message: error instanceof Error ? error.message : 'Unknown resolve exception'
      });
      throw error;
    }
  }

  private async findPublisherId(request: ResolveRequest): Promise<string | null> {
    const state = await this.store.readState();
    const hostname = new URL(request.url).hostname;

    return (
      state.publishers.find((publisher) => publisher.domain === hostname)?.id ??
      state.publishers.find((publisher) => request.publisher_name !== undefined && publisher.name === request.publisher_name)
        ?.id ??
      null
    );
  }

  private async ensureArticleFeatures(articleIds: readonly string[]): Promise<void> {
    const targetIds = new Set(articleIds);

    await this.store.writeState((state) => {
      const featureVersion = getFeatureVersion();

      for (const article of state.canonical_articles) {
        if (!targetIds.has(article.id)) {
          continue;
        }

        const publisherName =
          article.publisher_id === null
            ? null
            : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? null;
        const computedFeature = buildArticleFeatures({
          title: article.title,
          publisher_name: publisherName,
          author_names: article.author_json,
          published_at: article.published_at,
          modified_at: article.modified_at,
          article_type: article.article_type,
          section: article.section,
          keywords: [],
          excerpt: article.excerpt
        });
        const existingFeature = state.article_features.find((entry) => entry.article_id === article.id);

        if (
          existingFeature !== undefined &&
          isFeatureVersionCurrent({
            ...existingFeature,
            article_id: existingFeature.article_id
          })
        ) {
          continue;
        }

        const nextFeature: ArticleFeatureRecord = {
          article_id: article.id,
          title_tokens: computedFeature.title_tokens,
          entities_json: computedFeature.entities_json,
          numbers_json: computedFeature.numbers_json,
          keywords_json: computedFeature.keywords_json,
          embedding: computedFeature.embedding,
          feature_version: featureVersion,
          computed_at: computedFeature.computed_at
        };

        if (existingFeature === undefined) {
          state.article_features.push(nextFeature);
        } else {
          existingFeature.title_tokens = nextFeature.title_tokens;
          existingFeature.entities_json = nextFeature.entities_json;
          existingFeature.numbers_json = nextFeature.numbers_json;
          existingFeature.keywords_json = nextFeature.keywords_json;
          existingFeature.embedding = nextFeature.embedding;
          existingFeature.feature_version = nextFeature.feature_version;
          existingFeature.computed_at = nextFeature.computed_at;
        }
      }
    });
  }

  private async getResolvedArticleFeatureView(articleId: string): Promise<ResolvedArticleFeatureView | null> {
    const state = await this.store.readState();
    const article = state.canonical_articles.find((entry) => entry.id === articleId);
    const feature = state.article_features.find((entry) => entry.article_id === articleId);

    if (article === undefined || feature === undefined) {
      return null;
    }

    return {
      article,
      feature: {
        ...feature,
        article_id: feature.article_id
      },
      publisher_name:
        article.publisher_id === null
          ? null
          : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? null
    };
  }

  private async listCandidateViews(
    sourceArticle: CanonicalArticleRecord,
    request: ResolveRequest
  ): Promise<ResolvedArticleFeatureView[]> {
    const state = await this.store.readState();
    const missingFeatureIds = state.canonical_articles
      .filter((article) => article.status === 'active')
      .map((article) => article.id)
      .filter((articleId) => !state.article_features.some((feature) => feature.article_id === articleId));

    if (missingFeatureIds.length > 0) {
      await this.ensureArticleFeatures(missingFeatureIds);
      return this.listCandidateViews(sourceArticle, request);
    }

    const sourceFeature = buildRequestFeatures(request);

    return state.canonical_articles
      .filter((article) => article.status === 'active' && article.id !== sourceArticle.id)
      .filter((article) => article.canonical_url !== sourceArticle.canonical_url)
      .filter((article) => withinCandidateWindow(request.published_at, article.published_at))
      .map((article) => {
        const feature = state.article_features.find((entry) => entry.article_id === article.id);

        if (feature === undefined) {
          return undefined;
        }

        const publisherName =
          article.publisher_id === null
            ? null
            : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? null;

        return {
          article,
          feature: {
            ...feature,
            article_id: feature.article_id
          },
          publisher_name: publisherName
        } satisfies ResolvedArticleFeatureView;
      })
      .filter((candidate): candidate is ResolvedArticleFeatureView => candidate !== undefined)
      .filter((candidate) =>
        hasCandidateSeedSignals(sourceFeature, candidate.feature, request, candidate.article)
      );
  }
}
