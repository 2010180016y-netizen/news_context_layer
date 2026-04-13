import type {
  CheckoutPlanCode,
  CheckoutSessionResponse
} from '@news-context/shared-types';

export interface BillingCheckoutSessionInput {
  readonly session_id: string;
  readonly plan_code: CheckoutPlanCode;
  readonly success_url: string;
  readonly cancel_url: string;
  readonly device_id: string;
  readonly anon_id: string;
  readonly api_origin: string;
}

export interface BillingCheckoutSessionToken {
  readonly session_id: string;
  readonly plan_code: CheckoutPlanCode;
  readonly success_url: string;
  readonly cancel_url: string;
  readonly device_id: string;
  readonly anon_id: string;
  readonly provider: string;
  readonly created_at: string;
}

export interface BillingProviderAdapter {
  readonly provider: string;
  createCheckoutSession(input: BillingCheckoutSessionInput): CheckoutSessionResponse;
  decodeToken(token: string): BillingCheckoutSessionToken;
  renderCheckoutPage(token: string): string;
  buildOutcomeRedirectUrl(token: string, outcome: 'success' | 'cancel'): string;
}

export class BillingTokenError extends Error {}

export function encodeBillingToken(payload: BillingCheckoutSessionToken): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeBillingToken(token: string): BillingCheckoutSessionToken {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new BillingTokenError('Checkout token payload must be an object.');
    }

    const record = parsed as Record<string, unknown>;

    if (
      typeof record['session_id'] !== 'string' ||
      record['plan_code'] !== 'founder_pass' ||
      typeof record['success_url'] !== 'string' ||
      typeof record['cancel_url'] !== 'string' ||
      typeof record['device_id'] !== 'string' ||
      typeof record['anon_id'] !== 'string' ||
      typeof record['provider'] !== 'string' ||
      typeof record['created_at'] !== 'string'
    ) {
      throw new BillingTokenError('Checkout token is missing required fields.');
    }

    return {
      session_id: record['session_id'],
      plan_code: record['plan_code'],
      success_url: record['success_url'],
      cancel_url: record['cancel_url'],
      device_id: record['device_id'],
      anon_id: record['anon_id'],
      provider: record['provider'],
      created_at: record['created_at']
    };
  } catch (error: unknown) {
    if (error instanceof BillingTokenError) {
      throw error;
    }

    throw new BillingTokenError('Checkout token is invalid.');
  }
}

export function escapeBillingHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function appendBillingOutcomeParams(
  rawUrl: string,
  payload: BillingCheckoutSessionToken,
  outcome: 'success' | 'cancel'
): string {
  const targetUrl = new URL(rawUrl);
  targetUrl.searchParams.set('checkout_result', outcome);
  targetUrl.searchParams.set('checkout_session_id', payload.session_id);
  targetUrl.searchParams.set('checkout_plan_code', payload.plan_code);
  targetUrl.searchParams.set('checkout_provider', payload.provider);
  return targetUrl.toString();
}
