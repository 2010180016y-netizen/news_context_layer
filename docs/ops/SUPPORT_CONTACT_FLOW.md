# Support Contact Flow

## Goal
- Make it obvious where a beta user, billing question, quality issue, or B2B inquiry should go.
- Keep the product safe when real support routes are still missing.
- Use one runtime contract across `.env.example`, `apps/extension/public/sidepanel/config.js`, `apps/extension/scripts/build-alpha.mjs`, and the side panel settings surface.

## Source Inputs
- `docs/08_Security_Privacy_Legal.md`
- `docs/10_Repo_Structure_and_Handoff.md`
- `docs/12_CopyDeck.md`
- `.env.example`
- `apps/extension/public/sidepanel/config.js`
- `apps/extension/scripts/build-alpha.mjs`
- `apps/extension/src/lib/support.ts`
- `apps/extension/src/sidepanel/main.ts`

## Runtime Config Contract
These keys are the source of truth for operational support routing:

- `SUPPORT_CHANNEL_STATUS`
- `SUPPORT_RESPONSE_SLA`
- `SUPPORT_BETA_URL`
- `SUPPORT_BILLING_URL`
- `SUPPORT_QUALITY_URL`
- `SUPPORT_B2B_URL`

Runtime mirror inside the extension:

```js
window.__NEWS_CONTEXT_CONFIG__ = {
  support: {
    channelStatus: 'draft',
    responseSla: null,
    betaSupportUrl: null,
    billingUrl: null,
    qualityIssueUrl: null,
    b2bInquiryUrl: null
  }
};
```

Rules:
- Blank values keep the channel in `placeholder`.
- Only `https:` and `mailto:` are accepted for support links.
- Local runtime falls back to `placeholder` for unsafe values.
- Alpha build input rejects invalid non-empty support links so release builds fail fast.

## Injection Procedure
### Local Preview
Use `apps/extension/public/sidepanel/config.js` for local preview values.

- Keep `support.*` aligned with the keys above.
- If no real route is ready yet, leave the link as `null`.
- Settings will show the channel as `placeholder` and will not open an external link.

### Alpha / Unlisted Build
`apps/extension/scripts/build-alpha.mjs` now carries the support block into `dist-alpha/sidepanel/config.js`.

Supported overrides:
- Environment variables from `.env.example`
- CLI flags:
  - `--support-channel-status=`
  - `--support-response-sla=`
  - `--support-beta-url=`
  - `--support-billing-url=`
  - `--support-quality-url=`
  - `--support-b2b-url=`

Example with placeholders only:

```powershell
$env:SUPPORT_CHANNEL_STATUS='partial'
$env:SUPPORT_RESPONSE_SLA='Same business day acknowledgement, next-step response within 2 business days.'
$env:SUPPORT_BETA_URL='<real-https-or-mailto-value>'
$env:SUPPORT_BILLING_URL='<real-https-or-mailto-value>'
$env:SUPPORT_QUALITY_URL='<real-https-or-mailto-value>'
$env:SUPPORT_B2B_URL='<real-https-or-mailto-value>'
node apps/extension/scripts/build-alpha.mjs --api-base-url=https://staging-api.newscontext.example.com
```

Do not commit real operational endpoints into the repo.
`npm.cmd run release:preflight` now treats missing `SUPPORT_*` values as warnings, not store-submission blockers. Inject real support routes before external sharing only if this alpha needs live operator follow-up.

## Product Surface
Current product entry points:
- Extension side panel
- Route: `settings`
- Section: `Support / Contact`
- Route: `plan`
  - paywall / checkout / Founder Pass state mismatch => billing support deep link
  - starter report / pilot discussion => B2B inquiry deep link
- Route: `main`
  - low-confidence / insufficient-results / weak common signals => quality support deep link
- Route: `unsupported`
  - unsupported URL / side panel support mismatch => beta user support deep link
- Route: `error`
  - network / timeout / runtime error => beta user support deep link

The settings surface should show to end users:
- Overall channel status
- Per-channel purpose
- Required intake fields
- Whether the route can open directly or only shows guidance
- Response SLA

Operator-only documentation may still reference runtime config keys and injection details, but that language should stay in docs and build scripts rather than the product UI.

## Routing Table
| Inquiry type | Channel type | Config key | Required intake fields |
|---|---|---|---|
| Beta user support | `beta_user_support` | `SUPPORT_BETA_URL` | `article_url`, `occurred_at`, `plan_state`, `screen_state`, `expected_vs_actual` |
| Billing issue | `billing_issue` | `SUPPORT_BILLING_URL` | `article_url`, `occurred_at`, `plan_state`, `screen_state`, `expected_vs_actual`, `checkout_session_id` |
| Parser / resolve quality | `parser_or_resolve_quality` | `SUPPORT_QUALITY_URL` | `article_url`, `occurred_at`, `plan_state`, `screen_state`, `expected_vs_actual`, `screenshot_optional` |
| B2B inquiry | `b2b_inquiry` | `SUPPORT_B2B_URL` | `organization`, `use_case`, `meeting_context`, `requested_asset` |

## Blocked-State Deep Link Map
| Blocked state | Product surface | Support entry point | Channel type |
|---|---|---|---|
| Watchlist limit / briefing paywall / checkout mismatch | `plan` | `billing_paywall` | `billing_issue` |
| Low-confidence result / insufficient results / weak common signals | `main` | `quality_review` | `parser_or_resolve_quality` |
| Unsupported page / side panel support mismatch | `unsupported` | `unsupported_or_error` | `beta_user_support` |
| Network / timeout / runtime error | `error` | `unsupported_or_error` | `beta_user_support` |
| Starter report / pilot / export discussion | `plan` | `b2b_inquiry` | `b2b_inquiry` |

## Intake Rules
- Beta user support:
  - side panel open failure
  - onboarding or loading issue
  - unsupported state confusion
  - settings or consent problem
- Billing issue:
  - Founder Pass checkout
  - success/cancel mismatch
  - plan state mismatch
  - unlock failure after purchase
- Parser / resolve quality:
  - title missing
  - low-confidence result
  - stale related result
  - freshness/common signal mismatch
- B2B inquiry:
  - starter report review
  - briefing scaffold discussion
  - JSON/CSV export request
  - pilot meeting follow-up

## Response SLA
- Default:
  - `Same business day acknowledgement, next-step response within 2 business days.`
- Override path:
  - `SUPPORT_RESPONSE_SLA`
  - mirrored into `window.__NEWS_CONTEXT_CONFIG__.support.responseSla`

## Safe Fallback
When a support link is missing:
- The product must not open an external link.
- The product should explain that the route is not ready yet in user-facing language.
- The product must remind the operator which intake fields are required.
- The product must show the current SLA target.

Fallback notice example:

```text
Beta user support channel does not have a real link yet.
Set SUPPORT_BETA_URL to a real https or mailto value and re-run runtime injection.
Collect article_url, occurred_at, plan_state, screen_state, expected_vs_actual.
Current SLA target: Same business day acknowledgement, next-step response within 2 business days.
```

## QA Hooks
Automatic checks should cover:
- missing runtime config => `placeholder`
- invalid runtime link => downgraded or rejected
- settings surface stays user-facing and avoids config-key/runtime-source language
- alpha build carries the support block into generated runtime config
- blocked-state entry points map to the intended support channels
- paywall, unsupported, error, and low-confidence surfaces expose the correct support CTA

## Non-goals
- Zendesk / Intercom / CRM integration
- Support admin dashboard
- Automatic ticket creation
- Automatic routing into sales or billing systems

## Gate After
- Real support email alias or form URL
- Legal/privacy-specific deletion request channel split
- Billing/legal escalation owner
- CRM sink for B2B inquiry routing
