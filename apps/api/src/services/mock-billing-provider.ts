import type {
  BillingCheckoutSessionInput,
  BillingCheckoutSessionToken,
  BillingProviderAdapter
} from './billing-provider.js';
import {
  appendBillingOutcomeParams,
  decodeBillingToken,
  encodeBillingToken,
  escapeBillingHtml
} from './billing-provider.js';

export class MockFounderPassBillingProvider implements BillingProviderAdapter {
  public readonly provider = 'mock_founder_pass';

  public createCheckoutSession(input: BillingCheckoutSessionInput) {
    const token = encodeBillingToken({
      session_id: input.session_id,
      plan_code: input.plan_code,
      success_url: input.success_url,
      cancel_url: input.cancel_url,
      device_id: input.device_id,
      anon_id: input.anon_id,
      provider: this.provider,
      created_at: new Date().toISOString()
    });

    return {
      provider: this.provider,
      session_id: input.session_id,
      checkout_url: `${input.api_origin}/billing/mock/checkout?token=${encodeURIComponent(token)}`
    };
  }

  public decodeToken(token: string): BillingCheckoutSessionToken {
    return decodeBillingToken(token);
  }

  public renderCheckoutPage(token: string): string {
    const payload = this.decodeToken(token);
    const encodedToken = encodeURIComponent(token);

    return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>News Context Founder Pass</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        --bg: #f6f2e8;
        --surface: rgba(255, 251, 244, 0.94);
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
        width: min(460px, 100%);
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
      h1 { margin: 0; font-size: 30px; line-height: 1.1; }
      p, li { color: var(--muted); line-height: 1.6; }
      ul {
        margin: 18px 0;
        padding-left: 18px;
        display: grid;
        gap: 8px;
      }
      .actions {
        display: grid;
        gap: 10px;
        margin-top: 20px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 16px;
        border-radius: 14px;
        text-decoration: none;
        font-weight: 700;
      }
      .button-primary {
        background: linear-gradient(135deg, var(--accent), #145673);
        color: #fff;
      }
      .button-secondary {
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.82);
        color: var(--ink);
      }
      .meta {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid var(--border);
      }
      .meta strong { display: block; margin-bottom: 4px; }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">Mock Checkout</p>
      <h1>Founder Pass를 활성화할까요?</h1>
      <p>이번 베타에서는 1회 결제 Founder Pass만 제공합니다. 월 정기구독과 팀 플랜은 아직 열지 않습니다.</p>
      <ul>
        <li>저장 가능한 이슈 수 확장</li>
        <li>브리핑 접근 잠금 해제</li>
        <li>Free 저장 한도 paywall 해제</li>
      </ul>
      <div class="meta">
        <strong>세션</strong>
        <span>${escapeBillingHtml(payload.session_id)}</span>
      </div>
      <div class="actions">
        <a class="button button-primary" href="/billing/mock/complete?token=${encodedToken}">Founder Pass 활성화</a>
        <a class="button button-secondary" href="/billing/mock/cancel?token=${encodedToken}">취소하고 Free 유지</a>
      </div>
    </main>
  </body>
</html>
`;
  }

  public buildOutcomeRedirectUrl(token: string, outcome: 'success' | 'cancel'): string {
    const payload = this.decodeToken(token);
    return appendBillingOutcomeParams(
      outcome === 'success' ? payload.success_url : payload.cancel_url,
      payload,
      outcome
    );
  }
}
