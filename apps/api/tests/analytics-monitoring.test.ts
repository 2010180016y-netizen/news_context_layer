import { describe, expect, it } from 'vitest';

import type { EventRecord } from '@news-context/shared-types';

import { summarizeParseFailures } from '../src/services/analytics-monitoring.js';

function createEvent(event: Partial<EventRecord> & Pick<EventRecord, 'event_name'>): EventRecord {
  return {
    id: event.id ?? `event_${event.event_name}`,
    anon_id: event.anon_id ?? 'anon-1',
    user_id: event.user_id ?? null,
    device_id: event.device_id ?? 'device-1',
    event_name: event.event_name,
    event_props: event.event_props ?? {},
    occurred_at: event.occurred_at ?? '2026-04-11T00:00:00.000Z',
    created_at: event.created_at ?? '2026-04-11T00:00:00.000Z'
  };
}

describe('summarizeParseFailures', () => {
  it('summarizes parse failure rate and recommended actions from tracked events', () => {
    const summary = summarizeParseFailures(
      [
        createEvent({
          event_name: 'article_parsed',
          event_props: { parse_success: true }
        }),
        createEvent({
          event_name: 'article_parsed',
          event_props: { parse_success: false }
        }),
        createEvent({
          event_name: 'parse_failure',
          event_props: {
            failure_reason: 'missing_title',
            failure_stage: 'content_parse'
          }
        }),
        createEvent({
          event_name: 'article_parsed',
          event_props: { parse_success: true }
        })
      ],
      0.1
    );

    expect(summary).toMatchObject({
      article_parsed_count: 3,
      article_parsed_failure_count: 1,
      parse_failure_event_count: 1,
      parse_failure_count: 1,
      parse_failure_rate: 0.3333,
      threshold: 0.1,
      exceeds_threshold: true,
      top_reasons: [{ reason: 'missing_title', count: 1 }],
      top_stages: [{ stage: 'content_parse', count: 1 }]
    });
    expect(summary.recommended_actions.some((action) => action.includes('Re-run parser fixtures'))).toBe(true);
  });

  it('falls back to article_parsed failure counts when legacy parse_failure events are absent', () => {
    const summary = summarizeParseFailures([
      createEvent({
        event_name: 'article_parsed',
        event_props: { parse_success: false }
      }),
      createEvent({
        event_name: 'article_parsed',
        event_props: { parse_success: true }
      })
    ]);

    expect(summary).toMatchObject({
      article_parsed_count: 2,
      article_parsed_failure_count: 1,
      parse_failure_event_count: 0,
      parse_failure_count: 1,
      top_reasons: [{ reason: 'legacy_parse_failure', count: 1 }]
    });
  });
});
