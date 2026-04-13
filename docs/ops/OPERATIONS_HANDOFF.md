# Operations Handoff

## Purpose
Give the next contributor a clean starting point for the operations-assets track without re-reading the full repo history.

## Current Fixed Outputs
- Working plan snapshot: `plan.md`
- Briefing API: `/v1/briefings`
- Sample issue report export: `infra/exports/reports/sample-issue-report.json`
- Daily briefing export: `infra/exports/briefings/daily-briefing-sample.json`
- Starter pack export: `infra/exports/b2b/starter-pack-sample.json`
- Support flow doc: `docs/ops/SUPPORT_CONTACT_FLOW.md`
- Stitch input package: `docs/design/STITCH_INPUT_PACKAGE.md`
- Stitch paste-ready prompt: `docs/design/STITCH_PROMPT.md`
- Privacy policy source of truth: `docs/public/privacy-policy.html`
- Public contact source of truth: `docs/public/public-contact.html`
- Historical draft references: `docs/public/PRIVACY_POLICY_DRAFT.md`, `docs/public/PUBLIC_CONTACT_DRAFT.md`
- Landing copy doc: `docs/ops/LANDING_COPY_ASSETS.md`
- B2B talk track: `docs/ops/B2B_TALK_TRACK.md`
- B2B roadmap boundary: `docs/ops/B2B_PRODUCT_ROADMAP.md`
- B2B recurring report operations: `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`
- B2B pilot review checklist: `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
- B2B operator note samples: `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md`
- B2B vetted fixture rotation guide: `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`
- Copy consistency check: `docs/ops/COPY_CONSISTENCY_CHECK.md`
- Latest QA notes: `docs/QA_EXECUTION_NOTES.md`
- Real value injection checklist: `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md`
- Pre-deploy expert review: `docs/ops/PREDEPLOY_EXPERT_REVIEW.md`

## What Is Verified
- Operations assets can still be regenerated from code and scripts.
- Resolve benchmark quality remains within budget.
- Support/contact placeholder flow is wired from runtime config to settings UI.
- Support/contact deep links now also exist on real blocked states:
  - paywall / checkout / Founder Pass state mismatch
  - low-confidence or insufficient-results context
  - unsupported page
  - runtime or network error
  - B2B starter-report inquiry
- Alpha build now keeps the support block in generated runtime config instead of dropping it.
- The deterministic demo corpus now produces a closer-to-live anchor cluster and regenerated exports without surfacing the synthetic `demo.news` seed article in visible report rows.
- CI now runs `Operational Export Smoke` and verifies that committed `infra/exports/*` artifacts match a fresh deterministic regeneration.
- Recurring report operations now have a dedicated command path and quality summary:
  - `npm.cmd run ops:recurring-report`
  - `infra/exports/b2b/recurring-report-cycle-summary.json`
- the summary now records `cadence`, `review_profile`, `operating_mode`, and operator-facing cadence guidance
- the recurring docs now include concrete steady-pilot and executive-handoff examples so operators can map summary fields to a real send decision
- recurring pilot handoff now also needs a field-by-field summary comparison step and committed steady-pilot note samples so `warn` handling does not depend on memory
- `ops:verify-recurring-handoff` has now been exercised against:
  - the committed `low_volume_pilot` summary
  - the `steady_pilot` example run
  - the `higher_touch_executive_handoff` example run
- Public and alpha manifests now declare committed icon assets.
- Root `npm run build` and root `npm run build:alpha` now pass again.
- Alpha release metadata now carries placeholder-safe store-listing fields for privacy policy, terms of service, and public contact.
- GitHub Pages-backed privacy-policy and public-contact pages now exist and are suitable for `STORE_*` injection.
- Public privacy/contact source pages now carry release-grade alpha copy and are checked by `release:preflight` for draft placeholder markers.
- The live GitHub Pages privacy/contact routes were also rechecked after source sync and now return the updated content.
- `npm.cmd run release:archive-alpha` now produces a canonical upload zip plus manifest for the exact reviewed candidate.
- The current reviewed upload candidate was rebuilt again on 2026-04-12 with live `STORE_PRIVACY_POLICY_URL` and `STORE_PUBLIC_CONTACT_URL`, then passed `release:preflight` and `release:archive-alpha` in one run.
- Browser-backed unpacked extension smoke now passes for unsupported, error, main resolve, watchlist, paywall, checkout return, briefing unlock, and low-confidence flows.
- The Founder Pass checkout return path now uses a hosted API-origin bridge instead of redirecting the popup back to `chrome-extension://...`.
- `npm.cmd run release:preflight` now checks whether `dist-alpha` still contains placeholder-only support or store-listing values.
- The side panel now has a launch-ready editorial UI baseline, and the newer Stitch/Figma concept has been translated into code as a launch-safe editorial skin over the existing product rules:
  - shipped UI keeps `News Context` branding instead of importing `The Broadside`
  - the implementation does not rely on remote fonts, remote imagery, or dashboard-style expansion
  - onboarding, loading, main context, watchlist, plan, and settings now share the same warmer editorial hierarchy
  - the earlier launch-trust behavior fixes were preserved while hierarchy and polish improved
- A ten-perspective pre-deploy review now exists as a separate launch-priority gap list so the next operator does not need to reconstruct deployment risk from scattered docs.
- The side-panel trust pass is now closed and implemented consistently across docs, code, and tests:
  - `skip-onboarding` now defers compare instead of behaving like `start-context`
  - unsupported recovery now names Naver News home honestly when that is the actual destination
  - settings/support copy now stays user-facing instead of surfacing runtime/config-key terminology
  - briefing failures now recover with retry + support guidance instead of raw helper text alone

## Blockers
### 1. Final stable Chrome confirmation is the last upload blocker
- Status: upload blocker until recorded
- Why it matters: browser-backed runtime smoke already passes in Chromium, but the current reviewed archive should still be clicked through once in stable Chrome before unlisted upload.
- What is already done:
  - action click / side panel flow exists
  - blocked-state support deep links exist
  - alpha build now includes real icon assets and release metadata placeholders
  - browser-backed checkout return smoke now passes through the hosted bridge
  - `release:preflight` now passes with live GitHub Pages-backed `STORE_*` routes
- Next action:
  - execute the final stable Chrome confirmation steps in `docs/ALPHA_RELEASE_CHECKLIST.md`
  - record pass/fail results before unlisted submission

### 2. Release flow discipline is now closed for the current candidate
- Status: closed for the current reviewed archive
- Why it matters: the repo now has a freshly rebuilt `dist-alpha`, a passing `release:preflight`, and a matching `release:archive-alpha` output from the same run.
- Next action:
  - upload only the current reviewed archive if no files change
  - if `dist-alpha` changes again, rerun `build:alpha -> release:preflight -> release:archive-alpha` before upload

## Non-Blockers
### 1. Real support channel values are still missing
- Status: non-blocker
- Why it matters: blocked-state support CTAs already fail safely, but they will only open fallback notices until real routes exist.
- What is already done:
  - placeholder-safe settings surface
  - runtime config contract
  - alpha build injection path
  - fallback notice with intake fields and SLA guidance
- Next action:
  - inject real values through the existing `SUPPORT_*` keys only if this alpha needs live operator follow-up
  - verify local preview and alpha build use the same routes

### 2. Demo corpus is deterministic and closer-to-live, but still not ingest-backed
- Status: non-blocker
- Why it matters: current exports read more credibly in meetings, but broader circulation will still want periodic fixture rotation from vetted ingest snapshots.
- What is already done:
  - anchor cluster now resolves to `economy / export`
  - report anchor shows `article_count = 6`, `publisher_count = 6`, `coverage_window_hours = 4`
  - visible exports exclude the synthetic `demo.news` source article
  - fixture copy and publisher texture now read closer to a real pilot handoff pack
  - secondary briefing items still preserve both the market follow-up and local public-interest follow-up
- Next action:
  - rotate the fixture from vetted ingest snapshots once broader circulation needs a fresher story mix

### 3. Starter Report / CSV entitlement is still `Gate after`
- Status: non-blocker
- Why it matters: export path exists, but commercial packaging is still intentionally undecided.

### 4. Team / analyst expansion copy remains out of scope
- Status: non-blocker
- Why it matters: current beta messaging only needs Founder Pass and Starter Report.

## Recommended Next Sequence
1. Execute the final stable Chrome confirmation in `docs/ALPHA_RELEASE_CHECKLIST.md`.
2. Upload the reviewed archive only after the stable Chrome pass is complete.
3. If `dist-alpha` changes again, rerun `build:alpha -> release:preflight -> release:archive-alpha` before treating the candidate as uploadable.
4. If this alpha needs live operator follow-up, put real support/contact URLs or aliases into the existing `SUPPORT_*` injection path.
5. If broader external circulation is needed, rotate the closer-to-live fixture from vetted ingest snapshots using `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md` and regenerate exports.
6. Fix local JSON-store concurrency and backend error classification before relying on repeated overlapping extension traffic in alpha.
7. Tighten resolve/release gates so benchmark drift and release-host drift fail automatically instead of relying on operator interpretation.
9. Before any recurring pilot handoff, re-lock scope with `docs/ops/B2B_PRODUCT_ROADMAP.md`, then review:
   - `infra/exports/b2b/starter-pack-sample.json`
   - `docs/ops/B2B_TALK_TRACK.md`
   - `infra/exports/b2b/recurring-report-cycle-summary.json`
10. Choose the cadence and review profile explicitly from `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md` before running the loop.
11. Run the recurring loop in order: `npm.cmd run ops:ingest` -> `npm.cmd run ops:recurring-report` -> `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=<mode>` -> operator review using `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`.
12. Keep `ops:validate-exports` green in CI whenever operational assets, builders, or demo corpus files change.
13. If `warn` remains for a steady pilot handoff, start the written note from `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` before customizing the owner and follow-up timing.
14. If the handoff is steady-pilot or executive-touch, compare the real summary fields to the example blocks in `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md` before sending.

## File-Based Handoff Order
1. Read [plan.md](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/plan.md) for the current execution order and blocker summary.
2. Read [docs/DECISION_LOCK.md](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/docs/DECISION_LOCK.md) for in-scope vs out-of-scope guardrails.
3. Read [docs/QA_EXECUTION_NOTES.md](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/docs/QA_EXECUTION_NOTES.md) for the latest verified metrics and known execution notes.
4. Read [docs/ops/PREDEPLOY_EXPERT_REVIEW.md](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/docs/ops/PREDEPLOY_EXPERT_REVIEW.md) before any upload decision so the current launch blockers are reviewed in priority order.
5. Read [docs/ops/SUPPORT_CONTACT_FLOW.md](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/docs/ops/SUPPORT_CONTACT_FLOW.md) before touching runtime support routing.
6. Read [infra/exports/manifest/operational-assets.manifest.json](/C:/Users/a/Downloads/news-context-layer-specs/news-context-layer-specs/infra/exports/manifest/operational-assets.manifest.json) and the export files it points to before changing any builders.
7. Run `npm.cmd run ops:validate-exports` before and after touching operational assets, builders, or demo corpus files.
8. If support/contact values are being finalized, update only the existing `SUPPORT_*` injection path and then manually verify side panel blocked-state deep links.
9. If store-listing values are being finalized, update only the existing `STORE_*` metadata path and then regenerate `dist-alpha/alpha-release.json`.
10. Run `npm.cmd run release:preflight` after store-listing value injection and clear every blocker it reports.
11. Run the final stable Chrome confirmation checklist before unlisted submission.

## Now Decided
- Support deep links are already product-visible on blocked states and should not be removed unless the support source of truth changes.
- `ops:validate-exports` is part of the regression baseline, not an optional ops step.
- The deterministic closer-to-live fixture corpus is the current approved demo baseline.
- Closer-to-live corpus work should keep improving operator-defensible anchor rationale before moving to any live or ingest-backed export path.
- Icon assets and store-listing placeholder metadata are part of the release baseline.
- B2B roadmap remains report-first; dashboard/API language stays `Gate after`.
- If B2B work resumes, start from `docs/ops/B2B_PRODUCT_ROADMAP.md` and the current starter pack export before proposing any new surface area.
- Recurring report readiness should be evaluated from the generated cycle summary, not from UI polish or one-off demo impressions.
- Recurring pilot review should use the same six domains everywhere: `scope_lock`, `artifact_consistency`, `anchor_clarity`, `repeat_use_narrative`, `guardrail`, `operator_follow_up`.
- The cycle summary is the machine-readable companion to the human checklist, not a substitute for operator judgment.
- The next improvement focus for recurring B2B work is cadence, closer-to-live corpus quality, and pilot review checklist quality before any UI expansion.
- Broader circulation should refresh the deterministic fixture from vetted ingest snapshots rather than introducing live fetch into the export path.

## Gate After
- External API sales language
- Team dashboard / analyst workflow language
- Monthly subscription / seat-based packaging
- Starter pack as a paid entitlement
