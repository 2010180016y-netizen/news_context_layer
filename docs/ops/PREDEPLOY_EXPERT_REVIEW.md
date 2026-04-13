# Pre-Deploy Expert Review

## Purpose

Capture the current launch-priority feedback in one place so deployment readiness does not depend on re-reading the entire repo.

This review is intentionally biased toward the original goal:

- ship a credible unlisted alpha
- reduce avoidable launch risk
- keep future roadmap ideas behind that goal

Six perspectives were gathered in parallel from specialized codebase reviewers, and four additional perspectives were synthesized locally from the same repo state. Together they form the current ten-expert launch review.

## Scope Reviewed

- extension runtime and side-panel states
- API/store reliability
- operational asset generation
- release/build/preflight path
- public legal/contact pages
- CI and QA coverage
- billing/paywall launch posture
- recurring pilot handoff readiness

## Launch-Priority Summary

### Must Fix Before Upload

1. Final stable Chrome confirmation is still a manual gate.
   Browser-backed smoke in Chromium is green, but the repo does not yet carry a stable-Chrome completion artifact for the final upload candidate.

### High-Priority Fixes Before Broader External Alpha

3. File-backed API persistence still has overlapping-request risk.
   The JSON store currently uses unlocked read-modify-write cycles and a shared temp-file pattern, so concurrent writes can race.

4. Release and resolve quality gates are still too permissive for launch confidence.
   Current checks do not yet enforce a closed host-permission allowlist, stronger per-fixture resolve assertions, or stricter regression thresholds in CI.

5. Events/privacy enforcement is still stronger in docs than on the server.
   `/v1/events` validates payload shape, but `event_props` minimization still depends on client discipline and documentation rather than a strict server-side allowlist.

6. Public privacy/deletion intake quality is still weaker than the ideal legal bar.
   The current public pages are release-grade for this alpha, but the operator identity remains generic, privacy/deletion requests still route through a public issue tracker, and `STORE_TERMS_OF_SERVICE_URL` is still an explicit optional-warning decision rather than a closed route.

## Recently Closed In Repo

- Public legal/contact source pages no longer contain draft placeholders.
- The live GitHub Pages privacy/contact routes now serve the updated release-grade content as well.
- `release:preflight` now blocks if those draft markers return.
- `release:archive-alpha` now creates a canonical upload zip plus a manifest for the exact reviewed candidate.
- The current alpha upload candidate was rebuilt, preflighted, and archived together on 2026-04-12 with the live public legal URLs injected.
- The side-panel launch-trust pass is now closed:
  - onboarding defer semantics are fixed
  - unsupported recovery now points honestly at Naver News home
  - settings/support copy is user-facing in-product
  - briefing failures now end with retry + support guidance
- The newer Stitch/Figma editorial concept is now translated into the shipped side-panel baseline without importing external brand language, remote assets, or scope-expanding UI structure.
- A final pre-deploy rerun on 2026-04-13 rechecked lint, tests, alpha build, Playwright smoke, release preflight, and archive generation after the latest release-surface cleanup.
- The same cleanup removed stale internal/B2B wording from the public side-panel bundle in `dist-alpha/sidepanel/main.js`; remaining operator/B2B support metadata now lives only in shared support config code.

## Ten Expert Perspectives

### 1. Chrome MV3 / Chrome Web Store Reviewer

- Priority: blocker
- Main finding:
  - host-permission checking is minimum-safe, not exact-allowlist-safe
  - final stable Chrome sign-off remains manual

### 2. Release Engineer

- Priority: resolved for the current reviewed candidate
- Main finding:
  - `release:preflight` can still green-light a stale `dist-alpha` tree if a human rebuilds and uploads later without repeating the archive flow
  - the canonical archive step now exists, so the remaining risk is release discipline rather than missing tooling

### 3. Extension UX / First-Run Trust Reviewer

- Priority: resolved in repo
- Main finding:
  - the previously identified onboarding/fallback/briefing trust gaps are now fixed in code and verified in browser-backed smoke
  - the newer editorial hierarchy is now implemented in the side panel without weakening those trust fixes or changing product scope

### 4. Backend / Reliability Reviewer

- Priority: high
- Main finding:
  - file-store concurrency is still fragile under overlapping requests
  - some backend/storage faults still look like client errors instead of retryable server faults

### 5. Resolve / Relevance QA Reviewer

- Priority: high
- Main finding:
  - benchmark coverage still leans too much on average precision
  - fixture-level rank expectations and confidence semantics can be stricter

### 6. Security / Privacy / Legal Reviewer

- Priority: medium
- Main finding:
  - Terms/deletion posture is not fully closed to the stricter internal legal bar
  - event ingestion still needs stronger server-side minimization

### 7. Billing / Checkout Reviewer

- Priority: medium
- Main finding:
  - no new blocking defect was found in the hosted checkout return bridge
  - launch copy should still avoid implying a mature multi-plan or team billing surface

### 8. QA / CI Reviewer

- Priority: high
- Main finding:
  - `.github/workflows/ci.yml` currently runs `lint`, `typecheck`, `test`, and `ops:validate-exports`
  - it does not yet run `benchmark:resolve`, `build`, `build:alpha`, `release:preflight`, or `ops:verify-recurring-handoff`

### 9. Support / Operations Readiness Reviewer

- Priority: medium
- Main finding:
  - placeholder-safe fallback is working as designed
  - real support routes are still optional for early alpha, but operator follow-up becomes stronger once actual `SUPPORT_*` routes exist
  - shared support metadata still carries B2B/operator definitions in `dist-alpha/lib/support.js`, but those strings are not surfaced in the public side panel UI

### 10. Product / Launch Strategist

- Priority: medium
- Main finding:
  - the strongest alpha story remains narrow:
    - Naver desktop article comparison
    - same-issue context
    - watchlist and Founder Pass repeat-use path
  - anything that implies broader publisher support, mature dashboard workflow, or complete support/legal operations weakens launch credibility

## CI Reality Check

Current CI protects:

- lint
- typecheck
- tests
- deterministic export drift

Current CI does not yet protect:

- `benchmark:resolve`
- `build`
- `build:alpha`
- `release:preflight`
- `ops:verify-recurring-handoff`
- stable Chrome sign-off
- legal-page substance

That means deployment still requires deliberate human release discipline even when CI is green.

## Recommended Sequence Before Upload

1. Complete stable Chrome confirmation against the current reviewed candidate.
2. If the candidate changes, rebuild `dist-alpha` and rerun `release:preflight` plus `release:archive-alpha` before upload.
3. Harden the local JSON-store path and error classification if external alpha traffic is expected to be more than trivial.
4. Tighten release and resolve gates in CI so launch confidence relies less on operator memory.

## Explicit Non-Goals For This Review

- expanding support to a full helpdesk product
- promising dashboard/API capability
- broadening the product beyond the current launch scope
- replacing the deterministic demo corpus with live fetch during export generation

## How To Use This Document

- Use this as the short-form launch gap list.
- Use `plan.md` for the ordered execution sequence.
- Use `docs/ALPHA_RELEASE_CHECKLIST.md` for the final manual release gate.
- Use `docs/ops/RELEASE_VALUE_INJECTION_CHECKLIST.md` for `STORE_*` / `SUPPORT_*` injection.
- Use `docs/ops/B2B_*` documents only after the core deployment blockers above are no longer the limiting factor.
