# 13. QA Checklist

## Purpose
Track the checks that matter for the current operations-assets scope:

- briefing persistence / retrieval
- closer-to-live sample issue report / starter pack export
- support / contact runtime injection and safe fallback
- landing copy / B2B talk track consistency
- regenerated export handoff state

---

## Automatic Validation

### Core Validation
- [x] `tsc --noEmit -p tsconfig.json`
- [x] `eslint --max-warnings=0 .`
- [x] `npm run test`
- [x] `npm run benchmark:resolve -- --iterations=50`
- [x] `npm run ops:starter-pack`
- [x] `npm run ops:recurring-report`
- [x] `npm run ops:validate-exports`
- [x] `npm run build`
- [x] `npm run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com`
- [x] `npm run release:archive-alpha`
- [x] `npx playwright test --config playwright.config.ts --reporter=line`
- [x] `npm run release:preflight` after real `STORE_*` injection

### Briefing / Report Builders
- [x] Founder Pass users can retrieve `/v1/briefings`
- [x] Free users are blocked from `/v1/briefings`
- [x] Daily briefing scaffold generates 3 items from the closer-to-live demo dataset
- [x] Sample issue report selects a stable anchor issue with `article_count >= 6`, `publisher_count >= 6`, and a non-empty `selection_reason`
- [x] Sample issue report visible related articles exclude the synthetic `demo.news` seed article
- [x] Daily briefing lead item surfaces watchlist linkage, freshness, and repeated common signals
- [x] Starter pack JSON/CSV regenerate successfully
- [x] Recurring report cycle summary regenerates successfully and does not return `needs_review`

### Support / Contact
- [x] Empty runtime config keeps every support channel in `placeholder`
- [x] Unsafe support URLs are downgraded to `placeholder` at runtime
- [x] Support fallback notice includes the intake fields and next-step guidance
- [x] Blocked-state entry points map to the expected support channels
- [x] Settings surface keeps support readiness user-facing instead of exposing internal config-key wording
- [x] Paywall, unsupported, error, and low-confidence surfaces expose support deep links without bypassing placeholder safety
- [x] Alpha build helper preserves the support block in generated runtime config
- [x] Alpha build helper rejects invalid non-empty support links

### Release Packaging
- [x] Public manifest declares `icons` and `action.default_icon`
- [x] Committed icon files exist for `16`, `32`, `48`, `128`
- [x] Alpha manifest preserves the icon declarations
- [x] Alpha release metadata preserves placeholder-safe store-listing metadata
- [x] Root recursive build no longer fails on package import resolution
- [x] Hosted checkout return bridge keeps the Founder Pass upgrade flow inside a browser-safe API-origin return path
- [x] Browser-backed unpacked extension smoke covers unsupported, error, main resolve, watchlist, paywall, checkout return, briefing unlock, and low-confidence flows

### Copy / Export Consistency
- [x] Committed `infra/exports/*` artifacts stay source-controlled and match a fresh deterministic regeneration
- [x] Starter pack export contains `immediate_value`, `repeat_use_value`, `founder_pass_reason`, `b2b_demo_value`, `scope_guardrail`
- [x] Starter pack export keeps `external API`, `team dashboard`, and `monthly subscription` as out-of-scope guardrails
- [x] Sample issue report copy explains immediate value and repeat-use value
- [x] Export manifest points at the latest regenerated assets

---

## Manual Validation

### Docs / Messaging Review
- [ ] Re-read `docs/ops/PREDEPLOY_EXPERT_REVIEW.md` before final upload and confirm every blocker there is either closed or explicitly accepted
- [ ] Re-read `docs/12_CopyDeck.md`, `docs/ops/LANDING_COPY_ASSETS.md`, and `docs/ops/B2B_TALK_TRACK.md` together and confirm they use the same message pillars
- [ ] Confirm Founder Pass is positioned only as an individual repeat-use upgrade, not as a team plan
- [ ] Confirm Starter Report is positioned only as a lightweight meeting asset, not as an API or dashboard product

### Support / Contact Operations
- [ ] Confirm the settings `Support / Contact` section stays user-facing and does not expose internal config-key or runtime-source wording
- [ ] Confirm paywall, unsupported, error, and low-confidence states point to the expected support channel before release
- [ ] Confirm operator-only runtime injection steps are documented in `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md`, not in the product UI
- [ ] When real support values are ready, verify that `.env`, runtime config, and release process all use the same keys

### Final Stable Chrome Confirmation
- [ ] Load `apps/extension/dist-alpha` as an unpacked extension in Chrome
- [ ] Confirm toolbar icon renders at 16/32 scale and the side panel opens from the action click
- [ ] Confirm a supported Naver article shows loading -> main -> related articles
- [ ] Confirm the shipped UI still says `News Context` and does not leak external brand language such as `The Broadside`
- [ ] Confirm an unsupported page shows the unsupported state and support CTA
- [ ] Confirm an API failure shows retryable error UI and support CTA
- [ ] Confirm a low-confidence article shows the quality support CTA
- [ ] If `SUPPORT_*` is still unset, confirm those CTAs stay on placeholder-safe fallback notices instead of opening broken external links
- [ ] Confirm the checkout popup returns through the hosted bridge and unlocks Founder Pass without a blocked `chrome-extension://` redirect
- [ ] Confirm paywall and B2B surfaces show the correct deep links
- [ ] Confirm watchlist save/delete still works in the packaged build
- [ ] Confirm the editorial styling still runs entirely from bundled/local assets and does not depend on remote fonts, remote imagery, or scope-expanding navigation

### Store Submission Metadata
- [ ] Follow `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md`
- [ ] Confirm the live privacy/contact pages no longer contain draft/placeholder tokens and actually match the repo's intended legal launch bar
- [x] Provide `STORE_PRIVACY_POLICY_URL` as a real HTTPS URL before submission
- [x] Provide `STORE_PUBLIC_CONTACT_URL` as a real HTTPS or `mailto:` route before submission
- [ ] Decide whether `STORE_TERMS_OF_SERVICE_URL` is populated for this release
- [x] Confirm `dist-alpha/alpha-release.json` reflects the intended store-listing values before upload
- [x] Confirm `npm run release:preflight` passes with no store-listing blocker
- [x] Confirm `release:preflight` reports no legal-page draft markers

### Export Review
- [ ] Review `infra/exports/reports/sample-issue-report.json` for anchor clarity, selection rationale, and closer-to-live source diversity
- [ ] Confirm the sample issue report explains why the chosen anchor beats weaker alternatives without requiring extra operator interpretation
- [ ] Review `infra/exports/b2b/starter-pack-sample.json` and CSV for meeting handoff usefulness
- [ ] Review `infra/exports/b2b/recurring-report-cycle-summary.json` before any repeated pilot delivery
- [ ] Re-read `docs/ops/B2B_PRODUCT_ROADMAP.md` before recurring pilot handoff and confirm the scope is still report-first
- [ ] Review `docs/ops/B2B_TALK_TRACK.md`, `infra/exports/b2b/starter-pack-sample.json`, and `infra/exports/b2b/recurring-report-cycle-summary.json` together before recurring pilot handoff
- [ ] Run `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=<intended_mode>` and confirm the summary matches the documented example block for that mode
- [ ] Follow `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md` before recurring pilot handoff
- [ ] Use the same review domains in both the checklist and the recurring cycle summary: `scope_lock`, `artifact_consistency`, `anchor_clarity`, `repeat_use_narrative`, `guardrail`, `operator_follow_up`
- [ ] Confirm the chosen recurring cadence matches the cycle summary guidance for ingest cutoff, rerun window, and operator review window
- [ ] Treat `warn` as operator follow-up required, not automatic stop; treat `fail` as no external pilot handoff
- [ ] If `warn` remains, record the note using the checklist template and start from `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` for steady-pilot handoffs
- [ ] If an executive handoff profile is used, record whether every `warn` was cleared or explicitly owner-signed before delivery
- [ ] If a steady pilot run is used, confirm the summary shows `cadence = twice_weekly`, `review_profile = standard`, and `operating_mode = steady_pilot`
- [ ] If an executive handoff run is used, confirm the summary shows `review_profile = executive_handoff` and the operator note includes owner plus follow-up timing
- [ ] Review `infra/exports/briefings/daily-briefing-sample.json` for repeat-use narrative quality and watchlist linkage
- [ ] Confirm CI `Operational Export Smoke` step is green on the next PR run
- [ ] Confirm the remaining release-critical checks that CI does not run (`build:alpha`, `release:preflight`, stable Chrome sign-off, legal-page substance) were completed manually
- [ ] Follow the file-based handoff order in `docs/ops/OPERATIONS_HANDOFF.md` and confirm the next operator can resume without re-discovery
- [ ] If broader circulation is requested, stop the normal pilot loop and move to `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md` before changing any fixture or export data

---

## Gate After Manual Checks
These stay out of the current stage and must not be treated as release-ready now.

- [ ] Real support alias / real form wiring if this alpha needs live operator follow-up
- [ ] Email briefing delivery
- [ ] Rotate the closer-to-live fixture from vetted ingest snapshots using `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md` if broader circulation needs a fresher corpus
- [ ] External API sales motion
- [ ] Team dashboard / analyst workflow
- [ ] Monthly subscription / seat-based plan messaging
