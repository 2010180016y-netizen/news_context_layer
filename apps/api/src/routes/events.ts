import type { IncomingMessage } from 'node:http';

import type { EventRequest, TrackedEventName } from '@news-context/shared-types';

import type { FileNewsContextStore } from '../repositories/file-store.js';
import { readJsonBody } from './resolve.js';
import { parseDeviceIdentity } from './watchlists.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const TRACKED_EVENT_NAMES: readonly TrackedEventName[] = [
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
];

export function parseEventRequest(value: unknown): EventRequest {
  if (!isRecord(value)) {
    throw new Error('Event payload must be an object.');
  }

  const anonId = value['anon_id'];
  const eventName = value['event_name'];
  const timestamp = value['ts'];
  const eventProps = value['event_props'];

  if (typeof anonId !== 'string' || anonId.trim() === '') {
    throw new Error('anon_id is required.');
  }

  if (typeof eventName !== 'string' || !TRACKED_EVENT_NAMES.includes(eventName as (typeof TRACKED_EVENT_NAMES)[number])) {
    throw new Error('event_name is invalid.');
  }

  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('ts must be an ISO date-time string.');
  }

  // The route currently enforces object shape only. Payload minimization is
  // still expected to come from the client contract and docs until a stricter
  // server-side event_props allowlist is introduced.
  if (eventProps !== undefined && !isRecord(eventProps)) {
    throw new Error('event_props must be an object when provided.');
  }

  const userId = value['user_id'];

  if (userId !== undefined && typeof userId !== 'string') {
    throw new Error('user_id must be a string when provided.');
  }

  return {
    anon_id: anonId,
    ...(typeof userId === 'string' ? { user_id: userId } : {}),
    event_name: eventName as EventRequest['event_name'],
    ...(isRecord(eventProps) ? { event_props: eventProps } : {}),
    ts: timestamp
  };
}

export async function ingestEventForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore
) {
  const payload = parseEventRequest(await readJsonBody(request));
  const identity = parseDeviceIdentity(request, payload.anon_id);
  return store.createEvent(identity, payload);
}
