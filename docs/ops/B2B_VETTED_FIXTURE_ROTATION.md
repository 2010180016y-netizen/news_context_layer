# B2B Vetted Fixture Rotation

## Purpose

Keep broader-circulation recurring bundles fresh without turning the export path into a live-fetch path.

This document defines the safe rotation rule:

- ingest may refresh candidate story material
- operators may vet a candidate snapshot
- the deterministic fixture may then be rotated from that vetted snapshot
- export generation still runs from fixture data, not live network fetch

## Why This Exists

The current B2B recurring loop is intentionally deterministic and beta-safe. That makes:

- sample issue report
- daily briefing sample
- starter pack export
- recurring cycle summary

easy to review and easy to regression-test.

Broader circulation eventually wants fresher story texture, but the safe way to get that is:

1. refresh ingest separately
2. review a candidate snapshot
3. freeze the approved snapshot
4. derive the fixture from that approved snapshot

not:

- live RSS fetch during export generation
- live sitemap fetch during export generation
- unreviewed story mix changes landing directly in the demo pack

## Approved Boundary

Allowed:

- `ops:ingest` to refresh candidate corpus state
- operator review of ingest summaries and candidate cluster mix
- fixture rotation from a reviewed ingest snapshot
- export regeneration plus normal QA/validation

Not allowed:

- wiring live fetch directly into `ops:starter-pack`
- wiring live fetch directly into `ops:recurring-report`
- skipping operator review for a broader-circulation refresh

## Rotation Trigger

Consider rotation only when one of these is true:

- the current deterministic fixture is starting to feel stale in repeated meetings
- the anchor story mix no longer fits the recurring pilot narrative
- broader external circulation needs fresher source texture than the current fixture can provide

If none of those are true, keep the current deterministic fixture.

## Rotation Workflow

### 1. Refresh candidate ingest state

Run:

```powershell
npm.cmd run ops:ingest
```

Review the ingest summary before using anything downstream.

### 2. Vet the candidate snapshot

Check:

- did ingest succeed without a failed stage
- does the candidate story mix still support report-first B2B delivery
- is there a defensible anchor that still beats the nearest weaker alternative
- do the likely secondary and tertiary follow-up clusters still support repeat-use narrative

If the answer is no, stop here.

### 3. Freeze the approved snapshot

Do not let broader circulation depend on ephemeral live state.

Freeze the approved candidate as a vetted ingest snapshot first. The exact storage format remains a later implementation choice, but the touch map should stay:

- ingest summary
- approved cluster selection notes
- approved snapshot payload
- fixture update derived from that snapshot

### 4. Rotate the deterministic fixture

Update the fixture-backed export source, not the export generator's network behavior.

That means the expected touch set is:

- `sample-fixtures/demo-report-dataset.json`
- any builder logic needed to keep anchor rationale legible
- regenerated `infra/exports/*`
- QA and handoff docs if the operator-facing explanation changes

### 5. Re-run the recurring quality loop

After fixture rotation, run:

```powershell
npm.cmd run ops:starter-pack
npm.cmd run ops:recurring-report
npm.cmd run ops:validate-exports
npm.cmd run benchmark:resolve -- --iterations=50
```

The resolve benchmark must stay green because the benchmark fixture is intentionally separate from the demo/export fixture.

## Review Criteria For A Safe Rotation

Approve a rotation only when:

- the new anchor remains easy to defend in a meeting
- secondary briefing items still show repeat-use narrative
- dashboard/API claims remain out of scope
- the recurring cycle summary still reads `ready` or `ready_with_follow_up`
- any `warn` has an explicit operator note

Reject a rotation when:

- the new anchor is fresher but less legible
- story diversity improves but operator explanation gets weaker
- the export pack starts implying a product promise outside report-first scope

## Handoff Reminder

If broader circulation is requested next:

1. re-lock scope with `docs/ops/B2B_PRODUCT_ROADMAP.md`
2. refresh ingest
3. vet the candidate snapshot
4. rotate the fixture only after approval
5. regenerate exports and rerun the recurring quality loop

Normal recurring-pilot checks still matter after rotation, but they are not enough on their own:

- `ops:verify-recurring-handoff` confirms the handoff mode matches the summary
- operator notes explain acceptable `warn` items
- neither replaces the vetted snapshot review required for broader circulation

If broader circulation is the goal, stop the normal pilot loop here and move through the vetted snapshot path first.
