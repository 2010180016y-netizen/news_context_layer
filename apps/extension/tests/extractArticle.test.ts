import { describe, expect, it } from 'vitest';

import { createEmptyArticleSnapshot, parseArticleSnapshot } from '../src/content/extractArticle.js';
import { parserFixtures } from './parser-fixtures.js';
import { runParserQa } from './parser-qa-helper.js';

describe('extractArticle parser', () => {
  for (const fixture of parserFixtures) {
    it(`matches fixture ${fixture.case_id}`, () => {
      const actual = parseArticleSnapshot(fixture.snapshot);

      expect(actual.status).toBe(fixture.expectation.status);
      expect(actual.parser_path).toBe(fixture.expectation.parser_path);
      expect(actual.parse_confidence).toBeGreaterThanOrEqual(fixture.expectation.min_confidence);

      if (fixture.expectation.low_confidence !== undefined) {
        expect(actual.low_confidence).toBe(fixture.expectation.low_confidence);
      }

      if (actual.status === 'unsupported') {
        expect(fixture.expectation.status).toBe('unsupported');
        expect(actual.parse_confidence).toBe(0);
        expect(actual.failure_reason).toBe('missing_title');
        return;
      }

      expect(actual.title).toBe(fixture.expectation.title);

      if (fixture.expectation.publisher_name !== undefined) {
        expect(actual.publisher_name).toBe(fixture.expectation.publisher_name);
      }

      if (fixture.expectation.published_at !== undefined) {
        expect(actual.published_at).toBe(fixture.expectation.published_at);
      }

      if (fixture.expectation.modified_at !== undefined) {
        expect(actual.modified_at).toBe(fixture.expectation.modified_at);
      }

      if (fixture.expectation.article_type !== undefined) {
        expect(actual.article_type).toBe(fixture.expectation.article_type);
      }

      if (fixture.expectation.section !== undefined) {
        expect(actual.section).toBe(fixture.expectation.section);
      }
    });
  }

  it('meets parser qa thresholds from fixtures', () => {
    const report = runParserQa(parserFixtures);

    expect(report.supported_success_rate).toBeGreaterThanOrEqual(0.9);
    expect(report.required_field_coverage).toBeGreaterThanOrEqual(0.85);
    expect(report.issue_counts['missing_title']).toBe(1);
    expect(report.issue_counts['dom_fallback']).toBe(1);
    expect(report.issue_counts['modified_before_published']).toBe(1);
    expect(report.failure_reason_counts['missing_title']).toBe(1);
    expect(report.low_confidence_case_ids).toEqual(
      expect.arrayContaining([
        'naver-003-dom-fallback-partial',
        'naver-005-unsupported-title-missing',
        'naver-006-modified-before-published'
      ])
    );
  });

  it('treats an empty supported snapshot as an empty-document failure', () => {
    const actual = parseArticleSnapshot(
      createEmptyArticleSnapshot('https://n.news.naver.com/article/001/0019999999')
    );

    expect(actual).toMatchObject({
      status: 'unsupported',
      failure_reason: 'empty_document',
      issues: ['empty_snapshot']
    });
  });
});
