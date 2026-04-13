import type { IncomingMessage } from 'node:http';

import type { GetBriefingRequest } from '@news-context/shared-types';

import type { BriefingFetchResult, BriefingService } from '../services/briefing-service.js';
import { BriefingAccessForbiddenError } from '../services/briefing-service.js';
import { parseDeviceIdentity } from './watchlists.js';

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseBriefingRequest(request: IncomingMessage): {
  readonly identity: ReturnType<typeof parseDeviceIdentity>;
  readonly options: GetBriefingRequest;
} {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const date = requestUrl.searchParams.get('date');

  if (date !== null && !isValidDateString(date)) {
    throw new Error('date must be a valid YYYY-MM-DD value when provided.');
  }

  return {
    identity: parseDeviceIdentity(request, undefined, { allowUserTokenAlias: true }),
    options: date === null ? {} : { date }
  };
}

export async function getBriefingForRequest(
  request: IncomingMessage,
  briefingService: BriefingService
): Promise<BriefingFetchResult> {
  const parsed = parseBriefingRequest(request);
  return briefingService.getBriefing(parsed.identity, parsed.options);
}

export function mapBriefingError(error: unknown): {
  readonly statusCode: number;
  readonly payload: unknown;
} {
  if (error instanceof BriefingAccessForbiddenError) {
    return {
      statusCode: 403,
      payload: {
        error: 'Forbidden',
        message: error.message
      }
    };
  }

  return {
    statusCode: 400,
    payload: {
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Invalid briefing request.'
    }
  };
}
