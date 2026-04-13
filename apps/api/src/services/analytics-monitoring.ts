import type { EventRecord } from '@news-context/shared-types';

export interface ParseFailureReasonBreakdown {
  readonly reason: string;
  readonly count: number;
}

export interface ParseFailureStageBreakdown {
  readonly stage: string;
  readonly count: number;
}

export interface ParseFailureSummary {
  readonly article_parsed_count: number;
  readonly article_parsed_failure_count: number;
  readonly parse_failure_event_count: number;
  readonly parse_failure_count: number;
  readonly parse_failure_rate: number;
  readonly threshold: number;
  readonly exceeds_threshold: boolean;
  readonly top_reasons: readonly ParseFailureReasonBreakdown[];
  readonly top_stages: readonly ParseFailureStageBreakdown[];
  readonly recommended_actions: readonly string[];
}

function incrementCount(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function toSortedBreakdown(counter: Map<string, number>): readonly { reason: string; count: number }[] {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason, count]) => ({
      reason,
      count
    }));
}

function toStageBreakdown(counter: Map<string, number>): readonly ParseFailureStageBreakdown[] {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([stage, count]) => ({
      stage,
      count
    }));
}

function extractStringProp(event: EventRecord, key: string): string | null {
  const value = event.event_props[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function buildRecommendedActions(
  exceedsThreshold: boolean,
  reasons: readonly ParseFailureReasonBreakdown[],
  stages: readonly ParseFailureStageBreakdown[]
): readonly string[] {
  if (!exceedsThreshold) {
    return ['No immediate action. Keep parse failure tracking in the daily QA review loop.'];
  }

  const actions = ['Parse failure rate exceeded the threshold. Re-run parser fixtures and inspect recent extraction changes.'];
  const dominantReason = reasons[0]?.reason ?? null;
  const dominantStage = stages[0]?.stage ?? null;

  if (dominantReason === 'unsupported_host') {
    actions.push('Unsupported-host failures dominate. Recheck supported-host gating, launch copy, and blocked-state UX before widening scope.');
  }

  if (dominantStage === 'content_parse') {
    actions.push('Content-parse failures dominate. Review JSON-LD/meta/DOM selector coverage and update extractor fixtures before release.');
  }

  if (dominantReason === 'missing_title' || dominantReason === 'empty_document') {
    actions.push('Top failure reasons point to extraction gaps. Add regression fixtures for the failing article shape and rerun parser QA.');
  }

  return actions;
}

export function summarizeParseFailures(
  events: readonly EventRecord[],
  threshold: number = 0.1
): ParseFailureSummary {
  const articleParsedEvents = events.filter((event) => event.event_name === 'article_parsed');
  const parseFailureEvents = events.filter((event) => event.event_name === 'parse_failure');
  const articleParsedFailureCount = articleParsedEvents.filter(
    (event) => event.event_props['parse_success'] === false
  ).length;
  const parseFailureCount = Math.max(parseFailureEvents.length, articleParsedFailureCount);
  const parseFailureRate =
    articleParsedEvents.length === 0 ? 0 : Number((parseFailureCount / articleParsedEvents.length).toFixed(4));
  const exceedsThreshold = parseFailureRate > threshold;
  const reasonCounter = new Map<string, number>();
  const stageCounter = new Map<string, number>();

  for (const event of parseFailureEvents) {
    incrementCount(reasonCounter, extractStringProp(event, 'failure_reason') ?? 'unknown_reason');
    incrementCount(stageCounter, extractStringProp(event, 'failure_stage') ?? 'unknown_stage');
  }

  if (parseFailureEvents.length === 0 && articleParsedFailureCount > 0) {
    incrementCount(reasonCounter, 'legacy_parse_failure');
    incrementCount(stageCounter, 'legacy_parse_failure');
  }

  const topReasons = toSortedBreakdown(reasonCounter);
  const topStages = toStageBreakdown(stageCounter);

  return {
    article_parsed_count: articleParsedEvents.length,
    article_parsed_failure_count: articleParsedFailureCount,
    parse_failure_event_count: parseFailureEvents.length,
    parse_failure_count: parseFailureCount,
    parse_failure_rate: parseFailureRate,
    threshold,
    exceeds_threshold: exceedsThreshold,
    top_reasons: topReasons,
    top_stages: topStages,
    recommended_actions: buildRecommendedActions(exceedsThreshold, topReasons, topStages)
  };
}
