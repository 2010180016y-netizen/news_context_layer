import { randomUUID } from 'node:crypto';

import type {
  CheckoutSessionRequest,
  CheckoutSessionResponse
} from '@news-context/shared-types';

import {
  type DeviceIdentityInput,
  FileNewsContextStore
} from '../repositories/file-store.js';
import type { BillingProviderAdapter } from './billing-provider.js';
import { MockFounderPassBillingProvider } from './mock-billing-provider.js';

export class BillingRequestError extends Error {}

export class BillingConflictError extends Error {}

type CheckoutOutcome = 'success' | 'cancel';

export class BillingService {
  private readonly store: FileNewsContextStore;
  private readonly provider: BillingProviderAdapter;

  public constructor(
    store: FileNewsContextStore = new FileNewsContextStore(),
    provider: BillingProviderAdapter = new MockFounderPassBillingProvider()
  ) {
    this.store = store;
    this.provider = provider;
  }

  public async createCheckoutSession(
    identity: DeviceIdentityInput,
    request: CheckoutSessionRequest,
    apiOrigin: string
  ): Promise<CheckoutSessionResponse> {
    if (request.plan_code !== 'founder_pass') {
      throw new BillingRequestError('Only founder_pass is supported in the beta billing stage.');
    }

    const profile = await this.store.getProfile(identity);

    if (profile.plan.code === 'founder_pass' && profile.plan.status === 'active') {
      throw new BillingConflictError('Founder Pass is already active for this device.');
    }

    const successUrl = this.resolveReturnUrl(request.success_url, apiOrigin);
    const cancelUrl = this.resolveReturnUrl(request.cancel_url, apiOrigin);

    return this.provider.createCheckoutSession({
      session_id: `checkout_${randomUUID()}`,
      plan_code: request.plan_code,
      success_url: successUrl,
      cancel_url: cancelUrl,
      device_id: identity.device_id,
      anon_id: identity.anon_id,
      api_origin: apiOrigin
    });
  }

  public renderMockCheckoutPage(token: string): string {
    return this.provider.renderCheckoutPage(token);
  }

  public async completeMockCheckout(token: string): Promise<string> {
    const payload = this.provider.decodeToken(token);

    await this.store.activateSubscription(
      {
        device_id: payload.device_id,
        anon_id: payload.anon_id
      },
      {
        plan_code: payload.plan_code,
        provider: payload.provider,
        provider_ref: payload.session_id
      }
    );

    return this.provider.buildOutcomeRedirectUrl(token, 'success');
  }

  public cancelMockCheckout(token: string): string {
    this.provider.decodeToken(token);
    return this.provider.buildOutcomeRedirectUrl(token, 'cancel');
  }

  public renderMockReturnPage(returnUrl: string): string {
    const signal = this.readCheckoutReturnSignal(returnUrl);
    const payloadJson = JSON.stringify({
      type: 'news-context-checkout-return',
      signal
    }).replace(/</g, '\\u003c');
    const title =
      signal.result === 'success' ? 'Founder Pass activated' : 'Checkout cancelled';
    const message =
      signal.result === 'success'
        ? 'Founder Pass is now active in News Context. You can return to the side panel.'
        : 'Checkout was cancelled. News Context will keep the current free plan.';
    const eyebrow = signal.result === 'success' ? 'Checkout complete' : 'Checkout cancelled';

    // Render the billing outcome on the API origin so external/provider-style checkout
    // flows never need to navigate a popup directly back to chrome-extension://.
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        --bg: #f6f2e8;
        --surface: rgba(255, 251, 244, 0.96);
        --ink: #182335;
        --muted: #667085;
        --accent: #0d6b66;
        --border: rgba(24, 35, 53, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(13, 107, 102, 0.12), transparent 42%),
          linear-gradient(180deg, #faf7f0 0%, var(--bg) 100%);
        color: var(--ink);
      }
      .card {
        width: min(420px, 100%);
        padding: 28px;
        border-radius: 24px;
        background: var(--surface);
        border: 1px solid var(--border);
        box-shadow: 0 24px 48px rgba(24, 35, 53, 0.1);
      }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.1; }
      p { color: var(--muted); line-height: 1.6; }
      .meta {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid var(--border);
      }
      .meta strong { display: block; margin-bottom: 4px; color: var(--ink); }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">${this.escapeHtml(eyebrow)}</p>
      <h1>${this.escapeHtml(title)}</h1>
      <p>${this.escapeHtml(message)}</p>
      <div class="meta">
        <strong>Session</strong>
        <span>${this.escapeHtml(signal.session_id)}</span>
      </div>
    </main>
    <script>
      const payload = ${payloadJson};
      if (window.opener !== null) {
        window.opener.postMessage(payload, '*');
      }
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          // Keep the page visible when the browser blocks window.close().
        }
      }, 300);
    </script>
  </body>
</html>`;
  }

  private resolveReturnUrl(rawUrl: string | undefined, apiOrigin: string): string {
    if (rawUrl === undefined) {
      return `${apiOrigin}/billing/mock/return`;
    }

    try {
      const parsed = new URL(rawUrl);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BillingRequestError('Return URLs must use http or https so the hosted return bridge can complete checkout.');
      }

      return parsed.toString();
    } catch (error: unknown) {
      if (error instanceof BillingRequestError) {
        throw error;
      }

      throw new BillingRequestError('Return URLs must be valid absolute URLs.');
    }
  }

  private readCheckoutReturnSignal(returnUrl: string): {
    readonly result: CheckoutOutcome;
    readonly session_id: string;
    readonly plan_code: 'founder_pass';
    readonly provider: string | null;
  } {
    const parsed = new URL(returnUrl);
    const result = parsed.searchParams.get('checkout_result');
    const sessionId = parsed.searchParams.get('checkout_session_id');
    const planCode = parsed.searchParams.get('checkout_plan_code');
    const provider = parsed.searchParams.get('checkout_provider');

    if (
      (result !== 'success' && result !== 'cancel') ||
      sessionId === null ||
      sessionId.trim() === '' ||
      planCode !== 'founder_pass'
    ) {
      throw new BillingRequestError('Checkout return URL is missing required billing outcome fields.');
    }

    return {
      result,
      session_id: sessionId,
      plan_code: 'founder_pass',
      provider: provider === null || provider.trim() === '' ? null : provider
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
