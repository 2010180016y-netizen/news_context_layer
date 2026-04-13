import type { IncomingMessage } from 'node:http';

import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse
} from '@news-context/shared-types';

import { BillingConflictError, BillingRequestError, type BillingService } from '../services/billing-service.js';
import { readJsonBody } from './resolve.js';
import { parseDeviceIdentity } from './watchlists.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCheckoutSessionRequest(value: unknown): CheckoutSessionRequest {
  if (!isRecord(value)) {
    throw new BillingRequestError('Checkout payload must be an object.');
  }

  const planCode = value['plan_code'];
  const successUrl = value['success_url'];
  const cancelUrl = value['cancel_url'];

  if (planCode !== 'founder_pass') {
    throw new BillingRequestError('plan_code must be founder_pass in the beta billing stage.');
  }

  if (successUrl !== undefined && typeof successUrl !== 'string') {
    throw new BillingRequestError('success_url must be a string when provided.');
  }

  if (cancelUrl !== undefined && typeof cancelUrl !== 'string') {
    throw new BillingRequestError('cancel_url must be a string when provided.');
  }

  return {
    plan_code: 'founder_pass',
    ...(typeof successUrl === 'string' ? { success_url: successUrl } : {}),
    ...(typeof cancelUrl === 'string' ? { cancel_url: cancelUrl } : {})
  };
}

export async function createCheckoutSessionForRequest(
  request: IncomingMessage,
  billingService: BillingService
): Promise<CheckoutSessionResponse> {
  const payload = parseCheckoutSessionRequest(await readJsonBody(request));
  const identity = parseDeviceIdentity(request);
  return billingService.createCheckoutSession(identity, payload, getRequestOrigin(request));
}

export function getRequestOrigin(request: IncomingMessage): string {
  const protoHeader = request.headers['x-forwarded-proto'];
  const hostHeader = request.headers['x-forwarded-host'] ?? request.headers['host'];
  const protocol = typeof protoHeader === 'string' && protoHeader.trim() !== '' ? protoHeader.trim() : 'http';
  const host = typeof hostHeader === 'string' && hostHeader.trim() !== '' ? hostHeader.trim() : '127.0.0.1';

  return `${protocol}://${host}`;
}

export function getCheckoutToken(request: IncomingMessage): string {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const token = requestUrl.searchParams.get('token');

  if (token === null || token.trim() === '') {
    throw new BillingRequestError('token is required.');
  }

  return token;
}

export function mapCheckoutError(error: unknown): {
  readonly statusCode: number;
  readonly payload: {
    readonly error: string;
    readonly message: string;
  };
} {
  if (error instanceof BillingConflictError) {
    return {
      statusCode: 409,
      payload: {
        error: 'Conflict',
        message: error.message
      }
    };
  }

  return {
    statusCode: 400,
    payload: {
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Invalid checkout request.'
    }
  };
}
