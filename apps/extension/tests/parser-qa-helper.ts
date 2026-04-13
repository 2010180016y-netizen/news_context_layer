import type { ArticleParseResult, ParsedFieldName } from '../src/content/types.js';

import { parseArticleSnapshot } from '../src/content/extractArticle.js';
import type { ParserFixtureCase } from './parser-fixtures.js';

export interface ParserQaFixtureResult {
  readonly case_id: string;
  readonly actual: ArticleParseResult;
  readonly supported_fixture: boolean;
  readonly status_match: boolean;
  readonly parser_path_match: boolean;
  readonly confidence_match: boolean;
  readonly required_fields_present: readonly ParsedFieldName[];
}

export interface ParserQaReport {
  readonly total_fixtures: number;
  readonly supported_fixture_count: number;
  readonly successful_supported_parses: number;
  readonly supported_success_rate: number;
  readonly required_field_total: number;
  readonly required_field_present: number;
  readonly required_field_coverage: number;
  readonly low_confidence_case_ids: readonly string[];
  readonly issue_counts: Readonly<Record<string, number>>;
  readonly failure_reason_counts: Readonly<Record<string, number>>;
  readonly fixture_results: readonly ParserQaFixtureResult[];
}

function hasField(result: ArticleParseResult, fieldName: ParsedFieldName): boolean {
  if (result.status === 'unsupported') {
    return false;
  }

  switch (fieldName) {
    case 'canonical_url':
      return result.canonical_url !== undefined;
    case 'title':
      return result.title.trim() !== '';
    case 'publisher_name':
      return result.publisher_name !== undefined;
    case 'author_names':
      return result.author_names.length > 0;
    case 'published_at':
      return result.published_at !== undefined;
    case 'modified_at':
      return result.modified_at !== undefined;
    case 'article_type':
      return result.article_type !== undefined;
    case 'section':
      return result.section !== undefined;
    case 'keywords':
      return result.keywords.length > 0;
    case 'og_description':
      return result.og_description !== undefined;
    case 'body_excerpt':
      return result.body_excerpt !== undefined;
  }
}

export function runParserQa(fixtures: readonly ParserFixtureCase[]): ParserQaReport {
  const fixtureResults = fixtures.map((fixture) => {
    const actual = parseArticleSnapshot(fixture.snapshot);
    const requiredFieldsPresent = fixture.expectation.required_fields.filter((fieldName) =>
      hasField(actual, fieldName)
    );

    return {
      case_id: fixture.case_id,
      actual,
      supported_fixture: fixture.expectation.status !== 'unsupported',
      status_match: actual.status === fixture.expectation.status,
      parser_path_match: actual.parser_path === fixture.expectation.parser_path,
      confidence_match: actual.parse_confidence >= fixture.expectation.min_confidence,
      required_fields_present: requiredFieldsPresent
    } satisfies ParserQaFixtureResult;
  });

  const supportedResults = fixtureResults.filter((result) => result.supported_fixture);
  const successfulSupportedParses = supportedResults.filter(
    (result) => result.status_match && result.parser_path_match && result.confidence_match
  ).length;
  const requiredFieldTotal = fixtures.reduce(
    (total, fixture) => total + (fixture.expectation.status === 'unsupported' ? 0 : fixture.expectation.required_fields.length),
    0
  );
  const requiredFieldPresent = fixtureResults.reduce(
    (total, result) => total + (result.supported_fixture ? result.required_fields_present.length : 0),
    0
  );
  const issueCounts = fixtureResults.reduce<Record<string, number>>((counts, result) => {
    for (const issue of result.actual.issues) {
      counts[issue] = (counts[issue] ?? 0) + 1;
    }

    return counts;
  }, {});
  const failureReasonCounts = fixtureResults.reduce<Record<string, number>>((counts, result) => {
    if (result.actual.status !== 'unsupported') {
      return counts;
    }

    counts[result.actual.failure_reason] = (counts[result.actual.failure_reason] ?? 0) + 1;
    return counts;
  }, {});

  return {
    total_fixtures: fixtures.length,
    supported_fixture_count: supportedResults.length,
    successful_supported_parses: successfulSupportedParses,
    supported_success_rate:
      supportedResults.length === 0 ? 0 : successfulSupportedParses / supportedResults.length,
    required_field_total: requiredFieldTotal,
    required_field_present: requiredFieldPresent,
    required_field_coverage: requiredFieldTotal === 0 ? 0 : requiredFieldPresent / requiredFieldTotal,
    low_confidence_case_ids: fixtureResults
      .filter((result) => result.actual.low_confidence)
      .map((result) => result.case_id),
    issue_counts: issueCounts,
    failure_reason_counts: failureReasonCounts,
    fixture_results: fixtureResults
  };
}
