# B2B Product Roadmap

## Purpose

Keep the B2B discussion grounded in what the repository already ships today, while separating:

- current beta-safe assets
- near-term delivery steps that can grow from those assets
- later dashboard/API directions that remain `Gate after`

This is a roadmap document, not a pricing commitment and not a release promise.

## Current Baseline

The repository already contains four B2B-adjacent assets:

- `sample issue report`
- `daily briefing scaffold`
- `starter pack draft`
- `JSON / CSV export handoff paths`

Current source files and outputs:

- `apps/jobs/src/briefing/build-sample-issue-report.ts`
- `apps/jobs/src/briefing/build-daily-briefing.ts`
- `apps/jobs/src/briefing/build-b2b-starter-pack.ts`
- `infra/exports/reports/sample-issue-report.json`
- `infra/exports/briefings/daily-briefing-sample.json`
- `infra/exports/b2b/starter-pack-sample.json`

Current product boundary remains unchanged:

- the extension is still a comparison-first consumer product surface
- Founder Pass is still the only implemented paid product path
- B2B is still expressed as report-style delivery, not a dashboard or API

## Current Starter Pack Surface

The current generated starter pack is not just a slide idea. It already has a concrete payload shape and delivery boundary.

Current builder and export output include:

- `positioning`
  - headline
  - subheadline
  - proof points
  - immediate value
  - repeat-use value
  - Founder Pass reason
  - B2B demo value
  - scope guardrail
- `delivery_assets`
  - sample issue report
  - daily briefing scaffold
- `support_flow`
  - owner
  - beta channel status
  - intake steps
  - response SLA
- `sales_notes`
- `export_paths`

This matters because the current B2B story is already tied to real generated assets, not a speculative dashboard concept.

## Roadmap Principles

1. Reuse the existing report/briefing/export pipeline before inventing a new product surface.
2. Keep the B2B path file-delivery-first until repeated demand proves a stronger workflow is needed.
3. Do not promise dashboard/API capability before the operational asset pipeline is stable.
4. Keep commercial packaging, pricing, and entitlement decisions outside the current engineering baseline unless explicitly unlocked.

## Phase 0: Current Beta-Safe Baseline

Status: implemented

What exists now:

- the extension can demonstrate immediate same-issue comparison value
- watchlist and briefing scaffold show repeat-use value
- starter pack export can be regenerated deterministically
- B2B talk track and copy assets are aligned with the exported sample materials

What this phase is for:

- founder or operator-led demo meetings
- lightweight proof of problem/value
- internal and early partner conversations

What this phase is not:

- a self-serve B2B product
- a multi-seat dashboard
- an external API

## Phase 1: Starter Report Delivery

Status: next B2B-ready layer, still inside current architecture

Product shape:

- one-off or pilot-style report delivery
- curated issue selection
- operator review plus exported JSON/CSV/briefing artifacts
- handoff by file or email, not by dashboard login
- reuse of the existing starter pack payload rather than a parallel B2B-only pipeline

Needed operational capabilities:

- repeatable report generation checklist
- closer-to-live corpus when broader external circulation is needed
- documented support/contact path for pilot conversations
- clear quality review process for report anchor selection

Engineering dependency:

- no new product surface is required
- the current export pipeline remains the source of truth
- meeting quality still depends on the current sample issue report anchor selection and export regeneration discipline

## Phase 2: Recurring Report Program

Status: plausible next step, not yet implemented

Product shape:

- recurring delivery for a small set of tracked issues
- repeated watchlist/briefing/report generation on a schedule
- operator-managed distribution cadence

Candidate delivery modes:

- scheduled email handoff
- recurring exported files
- operator-run weekly or twice-weekly report cycle

What changes here compared with Phase 1:

- the report stops being a one-off demo artifact
- the operating loop becomes the product surface
- scheduler-ready ingest and recurring quality review matter more than UI changes

Engineering dependency:

- scheduler-ready ingest
- stable operational review loop
- clearer analytics on repeated issue quality and report usefulness
- recurring report operations doc and cycle runner:
  - `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`
  - `scripts/ops-recurring-report.ts`

Still intentionally out of scope here:

- multi-tenant dashboard
- self-serve account controls
- external API access

## Phase 3: Team Workflow / Dashboard

Status: `Gate after`

This is where a real B2B application may begin, but it is not part of the current beta-safe promise.

Potential scope:

- team-facing dashboard for tracked issues
- shared watchlists or issue collections
- recurring report history
- richer export management

Do not treat this phase as committed work yet.

Open questions intentionally left for a later gate:

- whether the product needs multi-seat collaboration
- whether CSV/export becomes a paid entitlement
- whether dashboard access is a separate product or a packaging layer on top of reports

## Phase 4: External API / Productized Intelligence Feed

Status: `Gate after`

This phase exists only as a future expansion boundary.

Potential scope:

- API access to issue clusters or report outputs
- partner ingestion endpoints
- downstream integration workflows

This is explicitly outside the current beta-safe messaging and must not be implied in demos today.

## Engineering Boundary By Phase

### Allowed now

- sample issue report generation
- briefing scaffold generation
- starter pack export generation
- deterministic handoff assets
- B2B talk track and meeting support docs

### Safe next step before a new product surface

- recurring exported report cadence
- operator-reviewed issue selection
- scheduled briefing/report generation
- clearer delivery checklist and support path for pilot conversations

### Not yet allowed to be promised

- self-serve report portal
- team dashboard
- analyst workspace
- API sales motion
- finalized commercial packaging

## Phase Boundary Summary

| Phase | What exists or can be added safely | What still stays out |
| --- | --- | --- |
| Phase 0 | starter pack export, sample issue report, daily briefing scaffold, talk track | dashboard, API, pricing commitments |
| Phase 1 | one-off or pilot report delivery using generated files | self-serve portal, team workspace |
| Phase 2 | recurring exported reports with scheduler-backed operations | multi-seat dashboard, external integrations |
| Phase 3 | team workflow or dashboard exploration | API sales commitment |
| Phase 4 | external API/feed exploration | commercial commitment before explicit gate |

## Recommended File Sources Of Truth

- roadmap and phase boundary: `docs/ops/B2B_PRODUCT_ROADMAP.md`
- recurring report operating loop: `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`
- current meeting narrative: `docs/ops/B2B_TALK_TRACK.md`
- current starter pack framing: `docs/ops/B2B_STARTER_PACK_DRAFT.md`
- generated sample output: `infra/exports/b2b/starter-pack-sample.json`
- current engineering execution summary: `plan.md`
- current technical system map: `research.md`

## Recurring Pilot Scope Re-Lock Questions

Before any recurring pilot handoff, answer these questions explicitly:

1. Is the conversation still about a report/file handoff rather than a dashboard, portal, or API?
2. Is the next action still inside Phase 0-2 language, with dashboard/API left in `Gate after`?
3. Would the operator be comfortable repeating the same scope statement in the live conversation if asked about roadmap expansion?

If any answer is `no`, stop the handoff and rework the deck, talk track, or expectations before sending.

## Gate-After Decisions

Leave the following items undecided until the next explicit gate:

- pricing and packaging
- recurring report commercial terms
- dashboard entitlement
- API entitlement
- team/seat model

## Next Handoff

If B2B work continues next, the recommended order is:

1. re-lock scope in `docs/ops/B2B_PRODUCT_ROADMAP.md`
2. review `infra/exports/b2b/starter-pack-sample.json`, `docs/ops/B2B_TALK_TRACK.md`, and `infra/exports/b2b/recurring-report-cycle-summary.json` together
3. run the recurring operating loop from `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md` in the order `ops:ingest -> ops:recurring-report -> ops:verify-recurring-handoff -> operator review`
4. if `warn` remains, use `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md` and `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` before sending
5. improve scheduling cadence, closer-to-live corpus quality, and pilot review checklist quality before any UI work
6. only discuss dashboard/API after recurring report demand is proven
