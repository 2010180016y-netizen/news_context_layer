# QA Execution Notes

## Purpose
Capture the latest verified state for the current operations-assets scope and record what is still blocked.

## Commands Run
- `.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`
- `.\node_modules\.bin\eslint.cmd --max-warnings=0 .`
- `npm.cmd run test`
- `npm.cmd run benchmark:resolve -- --iterations=50`
- `npm.cmd run ops:starter-pack`
- `npm.cmd run ops:recurring-report`
- `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=low_volume_pilot`
- `npm.cmd run ops:recurring-report -- --cadence=twice_weekly`
- `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=steady_pilot`
- `npm.cmd run ops:recurring-report -- --cadence=twice_weekly --review-profile=executive_handoff`
- `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=higher_touch_executive_handoff`
- `npm.cmd run ops:recurring-report`
- `npm.cmd run ops:validate-exports`
- `npm.cmd run release:archive-alpha`
- `$env:STORE_PRIVACY_POLICY_URL='https://2010180016y-netizen.github.io/news_context_layer/public/privacy-policy.html'; $env:STORE_PUBLIC_CONTACT_URL='https://2010180016y-netizen.github.io/news_context_layer/public/public-contact.html'; npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com; npm.cmd run release:preflight; npm.cmd run release:archive-alpha`
- live GitHub Pages verification for:
  - `https://2010180016y-netizen.github.io/news_context_layer/public/privacy-policy.html`
  - `https://2010180016y-netizen.github.io/news_context_layer/public/public-contact.html`
- `npm.cmd run build`
- `npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com`
- `npx.cmd playwright test --config playwright.config.ts --reporter=line`
- `npm.cmd run release:preflight`
- `2026-04-13 final pre-deploy rerun: .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json`
- `2026-04-13 final pre-deploy rerun: npm.cmd run lint`
- `2026-04-13 final pre-deploy rerun: npm.cmd run test`
- `2026-04-13 final pre-deploy rerun: $env:STORE_PRIVACY_POLICY_URL='https://2010180016y-netizen.github.io/news_context_layer/public/privacy-policy.html'; $env:STORE_PUBLIC_CONTACT_URL='https://2010180016y-netizen.github.io/news_context_layer/public/public-contact.html'; npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com`
- `2026-04-13 final pre-deploy rerun: npx.cmd playwright test --config playwright.config.ts --reporter=line`
- `2026-04-13 final pre-deploy rerun: npm.cmd run release:preflight`
- `2026-04-13 final pre-deploy rerun: npm.cmd run release:archive-alpha`
- `2026-04-13 final pre-deploy rerun: consumer side-panel cleanup removed stale internal/B2B copy from src main.ts and rebuilt dist-alpha/sidepanel/main.js`

## Result Summary
- typecheck: passed
- lint: passed
- test: `26 files passed / 77 tests passed`
- resolve benchmark precision@5: `1.0`
- resolve benchmark p50 latency: `11.722ms`
- resolve benchmark p95 latency: `16.993ms`
- root build: passed
- root alpha build: passed
- operational export regeneration: passed
- recurring report cycle generation: passed
- recurring handoff verification: passed for low-volume baseline, steady pilot, and executive handoff examples
- operational export validation: passed
- browser-backed extension smoke: passed
- release preflight: passed with GitHub Pages-backed store listing URLs
- side-panel launch-trust pass: passed
- Stitch/Figma-derived editorial side-panel translation: passed in the current launch candidate
- fresh reviewed alpha candidate: rebuilt, preflighted, and archived on the same run
- final pre-deploy rerun on `2026-04-13`: passed again after doc alignment and release-surface cleanup
- consumer-facing side-panel bundle strings: cleaned in `dist-alpha/sidepanel/main.js`

## What Was Verified

### Briefing
- `/v1/briefings` access control still holds.
- Founder Pass users can retrieve a persisted briefing.
- Free users are still blocked.

### Sample Issue Report / Starter Pack
- Sample issue report, daily briefing sample, and starter pack export regenerate from a deterministic but closer-to-live fixture corpus.
- The fixture now keeps a more natural publisher mix, more newsroom-like outlet texture, and a clearer follow-up narrative without changing the separate resolve benchmark dataset.
- The selected anchor cluster is now `economy / export` with:
  - `article_count = 6`
  - `publisher_count = 6`
  - `coverage_window_hours = 4`
  - `selection_reason.readiness_score = 0.922`
- The visible anchor set now reads less like a synthetic fixture pack:
  - related article publishers show a wire / market / industry / briefing mix
  - the secondary and tertiary briefing items still preserve `economy / dollar` and `bridge / coast`
  - the recurring report cycle remains `ready_with_follow_up`
- The visible issue report no longer includes the synthetic `demo.news` request article in `related_articles`.
- Daily briefing keeps 3 items and the lead item now shows:
  - watchlist linkage
  - freshness note
  - repeated common-signal numbers (`12`, `48`)
- Starter pack JSON/CSV now carry the anchor rationale and briefing lead angle in regenerated export fields.
- Recurring report operations now also emit `infra/exports/b2b/recurring-report-cycle-summary.json`, which records:
  - cadence
  - overall status
  - pass/warn/fail checks
  - next operator actions
- The recurring cycle summary now includes `artifact_bundle_consistent`, so the machine-readable bundle can confirm the starter pack, issue report, and daily briefing still describe the same recurring handoff set.
- Pilot review is now expected to use the same six review domains in both docs and JSON output: `scope_lock`, `artifact_consistency`, `anchor_clarity`, `repeat_use_narrative`, `guardrail`, `operator_follow_up`.
- The recurring cycle summary now also carries cadence guidance so operators can see the intended ingest cutoff, rerun window, operator review window, and warn-handling posture for the chosen cadence.
- `ops:verify-recurring-handoff` now compares the live JSON summary to the intended handoff example block and fails if cadence, review profile, operating mode, or cadence guidance drift from the documented mode.
- `docs/ops/PREDEPLOY_EXPERT_REVIEW.md` now holds the current launch-priority gap list, including the CI blind spots that still remain outside `.github/workflows/ci.yml`.
- Public legal/contact source pages are now placeholder-free and release-preflight will block submission if those draft markers reappear.
- `release:archive-alpha` now produces `apps/extension/release-artifacts/news-context-alpha-upload.zip` plus a manifest that records the exact reviewed upload candidate.
- The exact alpha upload candidate was regenerated again after the side-panel trust pass, using the live GitHub Pages legal URLs on the same command flow that ran `build:alpha`, `release:preflight`, and `release:archive-alpha`.
- The GitHub Pages source repo `2010180016y-netizen/news_context_layer` was updated directly, and the live Pages URLs were rechecked after propagation.
- Actual recurring pilot handoff is now expected to use a four-step gate:
  - re-lock scope in `docs/ops/B2B_PRODUCT_ROADMAP.md`
  - compare the real summary to the intended mode example in `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`
  - if `warn` remains, complete operator review with `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
  - if broader circulation is needed, move to `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`
- The current committed recurring cycle summary now records:
  - `cadence = weekly`
  - `review_profile = standard`
  - `operating_mode = low_volume_pilot`
  - `cadence_guidance.ingest_cutoff_hours = 24`
  - `cadence_guidance.rerun_window_hours = 12`
- Non-default cadence examples were also verified from the real runner:
  - `--cadence=twice_weekly` => `review_profile = standard`, `operating_mode = steady_pilot`
  - `--cadence=twice_weekly --review-profile=executive_handoff` => `operating_mode = higher_touch_executive_handoff`
- Steady-pilot operator review now also has committed note samples in `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md`:
  - `steady_pilot.operator_follow_up.default`
  - `steady_pilot.anchor_clarity.reinforcement`
  - `steady_pilot.repeat_use_narrative.follow_up`
- The next operator-enablement layer is no longer just checklist language. It should include:
  - `ops:verify-recurring-handoff` for field-by-field summary comparison
  - committed operator note samples for steady-pilot handoffs
- The next closer-to-live corpus refinement target is to make anchor selection easier to explain against weaker alternative clusters, without changing the separate resolve benchmark dataset.
- Broader circulation is still designed to refresh from vetted ingest snapshots, not from live fetch inside the export path.
- Stable operational export IDs are now derived from cluster content instead of runtime-random cluster UUIDs.
- `ops:validate-exports` regenerates `infra/exports/*` in place, validates structure, and fails if the committed snapshots drift from the generator.
- `ops:recurring-report` now provides the scheduler-ready execution unit for repeated pilot delivery, and it exits non-zero if the recurring-report quality loop reports `needs_review`.

### Support / Contact
- Empty support runtime config keeps channels in `placeholder`.
- Unsafe runtime links are downgraded to `placeholder`.
- Settings now show:
  - overall support readiness
  - per-channel purpose
  - whether each route can open directly or only shows guidance
  - intake fields that help operator follow-up
- Blocked-state deep links are now wired from:
  - `plan` => billing issue / B2B inquiry
  - `main` low-confidence / insufficient-results => parser or resolve quality
  - `unsupported` => beta user support
  - `error` => beta user support
- Deep links still reuse the same `support.ts` runtime contract and keep placeholder-safe fallback when real routes are missing.
- Product-visible support copy no longer exposes `config key`, `runtime source`, or `placeholder` jargon in the side panel UI.
- Alpha build now preserves the `support` block inside `dist-alpha/sidepanel/config.js`.
- Alpha build rejects invalid non-empty support link values.

### Release Packaging
- Public and alpha manifests now declare committed icon assets for `16`, `32`, `48`, and `128`.
- `apps/extension/public/icons/*` and `apps/extension/dist-alpha/icons/*` both contain real PNG assets instead of only `.gitkeep`.
- `dist-alpha/alpha-release.json` now keeps placeholder-safe store-listing metadata:
  - `STORE_PRIVACY_POLICY_URL`
  - `STORE_PUBLIC_CONTACT_URL`
  - `STORE_TERMS_OF_SERVICE_URL`
- Root `npm run build` no longer fails on workspace package import resolution.
- Root `npm run build:alpha` now succeeds through the direct extension build path.
- The checkout popup now returns through a hosted API-origin bridge page instead of redirecting directly to `chrome-extension://...`.
- `npm.cmd run release:preflight` now validates the built `dist-alpha` package against real-value submission requirements.
- Missing `SUPPORT_*` values now remain warnings instead of submission blockers, so an early alpha can still ship with placeholder-safe support fallback if no live operator route exists yet.
- Browser-backed unpacked extension smoke now proves:
  - unsupported page -> unsupported state
  - execution failure -> retryable error state
  - supported article -> loading -> main context
  - watchlist save
  - briefing paywall
  - checkout popup -> hosted return bridge -> Founder Pass unlock
  - briefing retrieval after purchase
  - low-confidence quality support entry point
- The side-panel launch-trust pass now also verifies:
  - `skip-onboarding` defers compare and lands on a safe non-resolve route
  - unsupported recovery opens Naver News home and labels that destination honestly
  - settings/support copy removes product-visible config-key/runtime-source language
  - briefing failures recover with retry plus support guidance instead of raw helper text alone
- The side panel visual baseline now includes:
  - branded shell masthead
  - stronger nav and card hierarchy
  - a context metrics rail in the main article view
  - warmer editorial styling that still fits a 400px MV3 side panel
- The translated Stitch/Figma editorial layer now also confirms:
  - shipped UI keeps `News Context` product language rather than importing `The Broadside`
  - onboarding, loading, main context, watchlist, plan, and settings share the same local editorial token system
  - no remote fonts, remote imagery, or scope-expanding magazine/dashboard navigation were introduced into the shipped extension

### Resolve Quality
- Resolve benchmark remains within budget after the closer-to-live corpus and export-builder changes.
- No release blockers were emitted by the benchmark run.
- Current benchmark case details:
  - `resolve-001-semiconductor-policy` => `success_full`, `fresh`, `context_confidence = 0.922`
  - `resolve-002-flood-response-insufficient` => `insufficient_results`, `updated`, `context_confidence = 0.633`
  - `resolve-003-market-wrap-low-confidence` => `low_confidence`, `watch_newer`, `context_confidence = 0.666`

### CI Regression Coverage
- `.github/workflows/ci.yml` now runs `pnpm ops:validate-exports` as `Operational Export Smoke`.
- The repository policy for operational exports is now explicit:
  - `infra/exports/*` stays committed
  - CI regenerates those artifacts deterministically
  - the job fails if regeneration changes tracked outputs

## Known Execution Notes
- `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run benchmark:resolve`, and `npm.cmd run ops:starter-pack` were run outside the sandbox because the repo's `corepack/pnpm` path needs unrestricted spawn access in this environment.
- `npm.cmd run ops:validate-exports` also needs the same unrestricted `corepack/pnpm` path in this environment.
- `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=*` can also require unrestricted `corepack/pnpm` access in this environment when the sandbox cannot read the corepack cache path.
- `npm.cmd run build:alpha` now succeeds through a direct Node-based extension build path, even though the sandbox still restricts some `corepack` spawn locations.
- `npx.cmd playwright test --config playwright.config.ts --reporter=line` requires unrestricted Chromium launch in this environment and was run with escalation.
- `npm.cmd run release:preflight` needs unrestricted `corepack/pnpm` access in this environment, but now passes once the GitHub Pages-backed `STORE_*` URLs are injected.

## Latest Release Preflight Output
- `readyForSubmission = true`
- store-listing status:
  - `storeConfigured = true`
  - `STORE_PRIVACY_POLICY_URL` injected through a live GitHub Pages route
  - `STORE_PUBLIC_CONTACT_URL` injected through a live GitHub Pages route
- warnings:
- `SUPPORT_CHANNEL_STATUS` is still not `configured`
- support routes are still placeholder-only:
  - `SUPPORT_BETA_URL`
  - `SUPPORT_BILLING_URL`
  - `SUPPORT_QUALITY_URL`
  - `SUPPORT_B2B_URL`
- warning:
  - `STORE_TERMS_OF_SERVICE_URL` is still empty and should be explicitly decided before submission

## Release Blockers
1. Final stable Chrome confirmation is the last remaining upload blocker until it is recorded for the current reviewed archive.

## Non-Blockers
1. The demo corpus is deterministic and closer-to-live, but it is still fixture-backed rather than ingest-backed for broader circulation.
2. Starter Report / CSV export entitlement is still `Gate after`.
3. Team dashboard / analyst workflow messaging remains out of scope.
4. Real support/contact runtime URLs or aliases are still placeholder-only, so support CTAs stay on placeholder-safe fallback unless the alpha needs live operator follow-up.
5. `STORE_TERMS_OF_SERVICE_URL` is still optional and currently unset.
6. Stitch is optional for further polish because the current repository now includes a launch-ready UI baseline plus a dedicated Stitch input package in `docs/design/*`.
7. Public legal/contact pages are release-grade for this alpha, but the operator identity is still generic and the privacy/deletion route still relies on a public issue tracker rather than a dedicated private intake path.
8. `dist-alpha/lib/support.js` still carries non-user-facing operator metadata such as `SUPPORT_*` config keys and B2B support definitions because the runtime support model is shared.

## Now Decided
- Support deep links on blocked states are part of the current product surface and must remain placeholder-safe until real routes exist.
- `infra/exports/*` is committed source-controlled output, and CI must fail if deterministic regeneration changes those files.
- Alpha packaging now requires committed icon assets and store-listing placeholder metadata as part of the baseline.
- The current handoff baseline is `support/contact + closer-to-live deterministic corpus + export validation + CI smoke + release packaging hardening`.
- Recurring report work now starts from the generated cycle summary, not from UI changes.
- Cadence now has an explicit ops meaning:
  - `weekly` = low-volume pilot
  - `twice_weekly` = steady pilot
  - executive handoff = stricter review overlay, not a separate product surface

## Gate After
- Real support/contact alias or form URL
- Ingest-backed corpus rotation for broader circulation
- Starter Report / CSV commercial entitlement
- Team dashboard / analyst workflow expansion
- Monthly subscription / seat-based packaging

## Final Stable Chrome Sign-Off
- Chrome version:
- tested archive path:
- tester / timestamp:
- pass/fail + note:
