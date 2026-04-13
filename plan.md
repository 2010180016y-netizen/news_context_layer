# News Context Working Plan

## Purpose
- Keep the current engineering snapshot, blockers, and next execution order in one place.
- Help the next contributor resume work without re-reading the entire repo history.
- Scope and product guardrails still come from `docs/DECISION_LOCK.md`.

## Current Product Snapshot
- Chrome MV3 extension + side panel flow is wired for Naver News desktop pages.
- Parser, resolve, freshness, common signals, watchlist, settings/consent, paywall shell, briefing retrieval, and starter pack exports exist in the repo.
- Support/contact now has a stable runtime contract, placeholder-safe settings surface, alpha build injection path, and blocked-state deep links from plan/main/unsupported/error surfaces.
- Deterministic operational exports now use a closer-to-live fixture-backed corpus that keeps a stable `economy / export` anchor while presenting more natural multi-publisher timing, beat mix, and repeat-use narrative.
- The next corpus-quality step is not live fetch; it is making the deterministic anchor bundle read more like a real operator handoff by tightening cross-source texture and making the anchor-vs-alternative selection story easier to explain in meetings.
- Alpha packaging now declares committed icon assets, carries store-listing placeholder metadata, and builds through a direct extension build path that does not depend on nested `corepack` calls.
- Stitch-ready UI handoff assets now exist in `docs/design/*`, and the upload-time legal/contact source of truth now lives in:
  - `docs/public/privacy-policy.html`
  - `docs/public/public-contact.html`
  - the older `*_DRAFT.md` files are now reference history, not upload-time source of truth
- The side panel shell now has a launch-ready UI baseline with a branded masthead, stronger information hierarchy, and a context metrics rail in the main article view.
- The newer Stitch/Figma editorial concept has now been translated into the shipped side-panel baseline as a launch-safe editorial skin:
  - `News Context` branding remains in the shipped UI instead of importing external brand language like `The Broadside`
  - the Chrome side panel information architecture remains intact instead of turning the surface into a dashboard or magazine site
  - the implementation uses local CSS/layout/tokens only, not remote imagery, remote fonts, or network-dependent decoration
  - the earlier launch-trust fixes for onboarding, unsupported recovery, support copy, and briefing recovery were preserved while hierarchy and polish were improved
- B2B discussion is now split from core engineering execution through `docs/ops/B2B_PRODUCT_ROADMAP.md`, which keeps starter-report delivery in scope and dashboard/API ideas in `Gate after`.
- Recurring report operations now have a dedicated scheduler-ready command and review summary through `npm run ops:recurring-report` and `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`.
- Recurring report cadence is now treated as an explicit operating choice, not an informal habit: `weekly` maps to low-volume pilot, `twice_weekly` maps to steady pilot, and higher-touch executive handoff stays a stricter review overlay on top of those cadences.
- Steady pilot and executive handoff now need concrete operator examples, not just cadence labels, so the recurring docs should show the actual command posture, summary interpretation, and warn-note expectations for each mode.
- Real recurring pilot handoff should now be treated as a four-step gate, not an informal review habit: re-lock scope in the roadmap, verify the cycle summary against the documented mode example, complete operator review with warn notes when needed, and use vetted fixture rotation for any broader-circulation refresh.
- The next operator-enablement step is now explicit note-sample coverage for real steady-pilot handoffs, so operators can start from committed examples instead of improvising owner/follow-up language under time pressure.
- The side panel launch-trust pass is now closed in repo:
  - onboarding secondary CTA now defers compare instead of behaving like immediate start
  - unsupported-page recovery now names the Naver News home destination honestly
  - settings/support copy now stays user-facing inside the product surface
  - briefing load failures now recover with retry plus support guidance

## Current Verified State
- `typecheck`, `lint`, `test`, and `benchmark:resolve` pass.
- Browser-backed Playwright Chromium smoke for unsupported, error, main resolve, watchlist, paywall, checkout return, briefing unlock, and low-confidence flows passes.
- Release preflight now exists to validate real `SUPPORT_*` and `STORE_*` injection against the built `dist-alpha` package before submission.
- GitHub Pages-backed store listing routes now respond publicly and allow `release:preflight` to pass with `storeConfigured = true`.
- Public legal/contact source pages now carry release-grade baseline copy, deletion/contact instructions, and no longer include draft placeholder markers.
- The live GitHub Pages privacy/contact routes were also rechecked after source sync and now return the updated release-grade content.
- `npm.cmd run release:archive-alpha` now creates a canonical zip plus manifest for the exact Web Store upload candidate.
- A fresh alpha candidate was rebuilt on 2026-04-12 with the live GitHub Pages legal URLs, then passed `release:preflight` and `release:archive-alpha` as one continuous candidate flow.
- A final pre-deploy rerun on 2026-04-13 rechecked `typecheck`, `lint`, `test`, `build:alpha`, Playwright smoke, `release:preflight`, and `release:archive-alpha` after the latest release-surface cleanup.
- The latest side-panel cleanup also removed stale internal/B2B copy from `apps/extension/src/sidepanel/main.ts` and the rebuilt `apps/extension/dist-alpha/sidepanel/main.js`.
- A ten-perspective pre-deploy review is now captured in `docs/ops/PREDEPLOY_EXPERT_REVIEW.md`, with launch-priority blockers separated from post-alpha advisories.
- The current alpha candidate now also includes the translated Stitch/Figma editorial hierarchy across onboarding, loading, main context, watchlist, plan, and settings while preserving the same MV3 scope and runtime behavior rules.
- Root `npm.cmd run build` passes.
- Root `npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com` passes.
- `ops:starter-pack` regeneration passes.
- `ops:validate-exports` passes with no committed artifact drift.
- `ops:recurring-report` now regenerates the recurring-report bundle and emits a machine-readable quality summary for operator review.
- `ops:verify-recurring-handoff` now confirms the committed low-volume baseline and the documented steady-pilot / executive-handoff example modes against the real JSON summary.
- Extension-specific alpha support-config and release-metadata smoke pass.
- Latest verification summary lives in `docs/QA_EXECUTION_NOTES.md`.
- Latest operations handoff lives in `docs/ops/OPERATIONS_HANDOFF.md`.

## Now Decided
- `infra/exports/*` remains committed and is treated as a checked-in generated asset set.
- `ops:validate-exports` is the CI smoke gate for operational asset drift.
- Support deep links are now product-visible on blocked states, but real routing values still come only from `SUPPORT_*`.
- B2B remains report-first: starter pack, sample issue report, and recurring report preparation are the safe scope; dashboard/API language stays `Gate after`.
- The recurring-report operating loop is command-first and review-summary-first, not UI-first.
- Recurring pilot handoff now uses a shared review vocabulary across docs and generated artifacts: `scope_lock`, `artifact_consistency`, `anchor_clarity`, `repeat_use_narrative`, `guardrail`, and `operator_follow_up`.
- Broader circulation must still rotate the fixture from vetted ingest snapshots rather than introducing live fetch into the export path, and that rotation path should stay separate from the benchmark fixture.
- Launch-safe side panel behavior now follows these product rules:
  - `start-context` completes onboarding and immediately begins resolve
  - `skip-onboarding` completes onboarding but lands on a safe non-resolve route with a reminder that compare can be started later from a news article
  - unsupported recovery should label the Naver News home destination honestly instead of implying the current unsupported tab can be resolved as-is
  - support/settings copy shown to users should avoid `config key`, `runtime source`, or `placeholder` jargon
  - briefing failure recovery should always offer retry plus a support path, not raw error text alone

## Gate After
- Real support/contact aliases or form destinations
- Starter Report / CSV commercial entitlement
- Ingest-backed corpus rotation for broader circulation
- Team dashboard / analyst workflow
- Monthly subscription / seat-based packaging
- External API productization

## Active Upload Blocker
1. Final stable Chrome manual confirmation still needs to be recorded before unlisted upload.
   Automated validation is green, including `release:preflight`, but the final packaged build should still be clicked through in stable Chrome once before upload.

## High-Priority Post-Upload Risks
1. The local JSON-store path still has pre-deploy reliability risk under overlapping requests.
   Current expert review found unlocked read-modify-write cycles, read endpoints that still write, and several backend/storage failures that can still be surfaced as `400` instead of retryable server faults.
2. Resolve and release quality gates are still more permissive than the launch goal requires.
   Current expert review found that resolve benchmark validation still over-relies on average precision and lower-bound confidence checks, while release preflight does not yet enforce the exact release host-permission allowlist.

## Non-Blockers
1. The current demo corpus is deterministic and closer-to-live, but it is still fixture-backed rather than ingest-backed for broader circulation.
2. The anchor bundle is now credible for meetings, but selection rationale should keep improving so operators can explain why `economy / export` beats larger but weaker alternatives without extra interpretation.
3. Cadence is now more explicit, but the actual pilot habit still depends on operators consistently following the documented ingest cutoff, rerun window, and review window for the chosen mode.
4. Starter Report / CSV export entitlement is still `Gate after`.
5. Team dashboard / analyst workflow messaging remains out of scope.
6. `SUPPORT_*` routes are still placeholder-only, so blocked-state CTAs stay on placeholder-safe fallback unless this alpha needs live operator follow-up.
7. `STORE_TERMS_OF_SERVICE_URL` is still optional and currently unset; keep that decision explicit at submission time.
8. Public legal/contact pages are good enough for the current unlisted alpha, but operator identity is still generic and privacy/deletion intake still routes through a public issue tracker rather than a dedicated private channel.
9. Shared support metadata still includes operator-facing config keys and B2B support definitions in `apps/extension/dist-alpha/lib/support.js`.
   Those strings are not surfaced in the public side panel UI and do not block unlisted alpha submission, but they should be reduced before any broader circulation.

## Next Recommended Sequence
1. Run the final stable Chrome confirmation in `docs/ALPHA_RELEASE_CHECKLIST.md` and record pass/fail status.
2. Upload only the current reviewed archive unless `dist-alpha` changes; if it changes, repeat `build:alpha -> release:preflight -> release:archive-alpha`.
3. Harden the local JSON-store path for overlapping requests and stop surfacing backend/storage faults as `400`.
4. Tighten quality gates so resolve regressions and release-host drift fail automatically instead of relying on operator interpretation.
7. If this alpha needs live operator follow-up, inject real support/contact channel values through the existing `SUPPORT_*` path.
8. Keep `ops:validate-exports` green in CI whenever operational assets, builders, or demo corpus files change.
9. Use `ops:recurring-report` plus the cycle summary before any repeated pilot handoff, and choose the cadence/review profile explicitly instead of treating `weekly` as a default habit.
10. Run `ops:verify-recurring-handoff` against the intended handoff mode before sending, and compare the real summary fields to the documented example block instead of relying on memory.
11. If any `warn` remains, use `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md` plus `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` to record an explicit operator note before sending.
12. If broader external circulation is needed, rotate the closer-to-live fixture from vetted ingest snapshots rather than introducing live fetches into the export path.
13. When recurring pilot guidance changes, keep the docs, note samples, and the cycle summary aligned with concrete steady-pilot and executive-handoff examples rather than abstract labels only.

## Main Reference Docs
- `docs/DECISION_LOCK.md`
- `docs/09_Backlog_Roadmap_StageGates.md`
- `docs/10_Repo_Structure_and_Handoff.md`
- `docs/13_QA_Checklist.md`
- `docs/QA_EXECUTION_NOTES.md`
- `docs/ops/OPERATIONS_HANDOFF.md`
- `docs/ops/SUPPORT_CONTACT_FLOW.md`
- `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md`
- `docs/ops/PREDEPLOY_EXPERT_REVIEW.md`
- `docs/ops/B2B_PRODUCT_ROADMAP.md`
- `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`
- `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
- `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md`
- `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`

## B2B Boundary Reminder
- Use `docs/ops/B2B_PRODUCT_ROADMAP.md` for phase boundaries.
- Use `docs/ops/B2B_TALK_TRACK.md` and `infra/exports/b2b/starter-pack-sample.json` for what can be shown today.
- Use `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md` and `infra/exports/b2b/recurring-report-cycle-summary.json` for recurring pilot delivery readiness.
- Before every recurring pilot handoff, re-lock scope with the roadmap, review the talk track + starter pack + cycle summary together, then run `ops:ingest -> ops:recurring-report -> operator review`.
- Treat the recurring cycle summary as the machine-readable companion to the pilot review checklist: it should cover the same review domains wherever a deterministic check is possible.
- Use the cadence guidance in the recurring cycle summary to decide ingest cutoff, rerun window, and operator review window before sending a bundle.
- Run `ops:verify-recurring-handoff -- --handoff-mode=<mode>` before sending so the real summary fields are compared against the intended low-volume, steady-pilot, or executive example posture.
- If the summary still carries `warn`, the operator review is incomplete until a note is written from the checklist template, using the committed examples in `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` when the handoff is steady-pilot.
- If broader circulation is needed, use `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md` to rotate from a vetted ingest snapshot rather than a live network fetch.
- Do not let dashboard/API requests bypass the roadmap gate.

## Verification Commands
```powershell
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json
.\node_modules\.bin\eslint.cmd --max-warnings=0 .
npm.cmd run test
npm.cmd run benchmark:resolve -- --iterations=50
npm.cmd run ops:starter-pack
npm.cmd run ops:recurring-report
npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=low_volume_pilot
npm.cmd run ops:validate-exports
npm.cmd run build
npm.cmd run build:alpha -- --api-base-url=https://staging-api.newscontext.example.com
npm.cmd run release:preflight
npm.cmd run release:archive-alpha
npx.cmd playwright test --config playwright.config.ts --reporter=line
.\node_modules\.bin\tsc.cmd -p packages/shared-types/tsconfig.json
.\node_modules\.bin\tsc.cmd -p apps/extension/tsconfig.build.json
node apps/extension/scripts/copy-public.mjs
node apps/extension/scripts/build-alpha.mjs --api-base-url=https://staging-api.newscontext.example.com
```
