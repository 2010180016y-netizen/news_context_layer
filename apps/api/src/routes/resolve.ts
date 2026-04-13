import type { IncomingMessage } from 'node:http';

import { ARTICLE_TYPES, type ResolveRequest, type ResolveResponse } from '@news-context/shared-types';

import type { ResolveService } from '../services/resolve-service.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertHttpUrl(value: string, fieldName: string): string {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${fieldName} must be an http(s) url.`);
    }

    return value;
  } catch {
    throw new Error(`${fieldName} must be an http(s) url.`);
  }
}

function asOptionalIsoDateTime(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be an ISO date-time string.`);
  }

  return value;
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function asOptionalArticleType(value: unknown): ResolveRequest['article_type'] {
  return typeof value === 'string' && ARTICLE_TYPES.includes(value as (typeof ARTICLE_TYPES)[number])
    ? (value as ResolveRequest['article_type'])
    : undefined;
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    }
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function parseResolveRequest(value: unknown): ResolveRequest {
  if (!isRecord(value)) {
    throw new Error('Resolve request body must be an object.');
  }

  const url = value['url'];
  const title = value['title'];
  const parseConfidence = value['parse_confidence'];

  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('url is required.');
  }

  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('title is required.');
  }

  if (typeof parseConfidence !== 'number' || !Number.isFinite(parseConfidence)) {
    throw new Error('parse_confidence must be a number.');
  }

  if (parseConfidence < 0 || parseConfidence > 1) {
    throw new Error('parse_confidence must be between 0 and 1.');
  }

  return {
    url: assertHttpUrl(url, 'url'),
    canonical_url:
      typeof value['canonical_url'] === 'string'
        ? assertHttpUrl(value['canonical_url'], 'canonical_url')
        : undefined,
    title,
    publisher_name: typeof value['publisher_name'] === 'string' ? value['publisher_name'] : undefined,
    author_names: asOptionalStringArray(value['author_names']),
    published_at: asOptionalIsoDateTime(value['published_at'], 'published_at'),
    modified_at: asOptionalIsoDateTime(value['modified_at'], 'modified_at'),
    article_type: asOptionalArticleType(value['article_type']),
    section: typeof value['section'] === 'string' ? value['section'] : undefined,
    keywords: asOptionalStringArray(value['keywords']),
    body_excerpt: typeof value['body_excerpt'] === 'string' ? value['body_excerpt'] : undefined,
    correction_note_detected:
      typeof value['correction_note_detected'] === 'boolean' ? value['correction_note_detected'] : undefined,
    parse_confidence: parseConfidence,
    anon_id: typeof value['anon_id'] === 'string' ? value['anon_id'] : undefined,
    page_lang: typeof value['page_lang'] === 'string' ? value['page_lang'] : undefined
  };
}

export async function resolvePageContext(
  request: ResolveRequest,
  resolveService: Pick<ResolveService, 'resolve'>
): Promise<ResolveResponse> {
  return resolveService.resolve(request);
}
