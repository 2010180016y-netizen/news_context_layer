# B2B Recurring Report Operations

## Purpose

Turn the existing starter-pack export path into a repeatable recurring-report operating loop without adding a new UI surface.

This document stays inside the current beta-safe boundary:

- reuse sample issue report
- reuse daily briefing scaffold
- reuse starter pack export
- add scheduler-friendly execution and operator review

It does not create a dashboard, self-serve portal, or external API.

## Current Source Of Truth

- roadmap boundary: `docs/ops/B2B_PRODUCT_ROADMAP.md`
- meeting narrative: `docs/ops/B2B_TALK_TRACK.md`
- pilot review checklist: `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
- vetted fixture rotation: `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`
- starter-pack export builder: `apps/jobs/src/briefing/build-b2b-starter-pack.ts`
- export generator: `scripts/export-starter-report.ts`
- recurring cycle runner: `scripts/ops-recurring-report.ts`
- generated starter-pack sample: `infra/exports/b2b/starter-pack-sample.json`
- generated recurring cycle summary: `infra/exports/b2b/recurring-report-cycle-summary.json`

## What The Recurring Cycle Does

`npm run ops:recurring-report` performs one repeatable operating cycle:

1. regenerate the sample issue report
2. regenerate the daily briefing scaffold
3. regenerate the starter pack JSON/CSV
4. write a recurring-report cycle summary
5. evaluate a small quality gate set for operator review

The cycle summary is intentionally simple. It answers:

- is the anchor cluster still meeting-ready
- does the sample issue report still explain why this issue was chosen
- is the briefing lead still useful for repeat-use narrative
- are dashboard/API claims still kept out of the pack
- does pilot delivery still need operator follow-up

## Execution Unit

Default command:

```powershell
npm.cmd run ops:recurring-report
```

Optional cadence flag:

```powershell
npm.cmd run ops:recurring-report -- --cadence=twice_weekly
```

Optional review profile flag:

```powershell
npm.cmd run ops:recurring-report -- --review-profile=executive_handoff
```

Supported cadence values:

- `weekly`
- `twice_weekly`

Supported review profiles:

- `standard`
- `executive_handoff`

This command is scheduler-ready because it is:

- single-entry
- idempotent over the current deterministic export baseline
- machine-readable in its JSON output
- non-zero exit on failed quality checks

Field-by-field comparison helper:

```powershell
npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=low_volume_pilot
```

Use that helper after `ops:recurring-report` and before operator review so the live summary is compared against the intended operating-mode example, not against memory.

## Generated Outputs

- `infra/exports/reports/sample-issue-report.json`
- `infra/exports/reports/sample-issue-report.csv`
- `infra/exports/briefings/daily-briefing-sample.json`
- `infra/exports/b2b/starter-pack-sample.json`
- `infra/exports/b2b/starter-pack-sample.csv`
- `infra/exports/b2b/recurring-report-cycle-summary.json`
- `infra/exports/manifest/operational-assets.manifest.json`

## Quality Review Loop

The recurring cycle currently checks:

- `artifact_bundle_consistent`
- `anchor_cluster_ready`
- `selection_reasons_present`
- `briefing_lead_watchlist`
- `briefing_depth`
- `starter_pack_guardrail`
- `operator_follow_up_path`

Those machine checks are meant to mirror the same review domains used in the human pilot checklist:

| Review domain | Primary machine check(s) | Notes |
| --- | --- | --- |
| `scope_lock` | manual review only | roadmap/talk-track guardrail, not a generated check |
| `artifact_consistency` | `artifact_bundle_consistent` | starter pack, issue report, and briefing should still describe the same bundle |
| `anchor_clarity` | `anchor_cluster_ready`, `selection_reasons_present` | enough multi-publisher depth plus explicit why-this-issue rationale |
| `repeat_use_narrative` | `briefing_lead_watchlist`, `briefing_depth` | repeated-delivery angle must stay visible in the briefing |
| `guardrail` | `starter_pack_guardrail` | dashboard/API language remains out of scope |
| `operator_follow_up` | `operator_follow_up_path` | warning means the bundle is usable but a human should confirm the path |

Status meanings:

- `pass`: ready for the next operating step
- `warn`: usable, but operator follow-up is recommended
- `fail`: do not hand off externally yet

Current expected status is typically `ready_with_follow_up`, because support/contact still uses placeholder-safe fallback in early alpha.

## Suggested Operating Cadence

Recommended cadence profiles:

| Operating mode | Command posture | Ingest cutoff before handoff | Rerun window | Operator review window | Delivery rule |
| --- | --- | --- | --- | --- | --- |
| low-volume pilot | `--cadence=weekly --review-profile=standard` | within 24h | rerun within 12h if corpus or bundle changes | 24h | `warn` can ship only with an explicit operator note |
| steady pilot | `--cadence=twice_weekly --review-profile=standard` | within 12h | rerun within 6h if corpus or bundle changes | 12h | `warn` can ship only with an explicit operator note |
| higher-touch executive handoff | either cadence + `--review-profile=executive_handoff` | within 6h | rerun within 3h on any material change | 6h | do not hand off until every `warn` is cleared or explicitly owner-signed |

### Steady Pilot Example

Use this when the recurring pilot is active enough that waiting a full week would make the bundle feel stale, but the conversation is still a normal report-first delivery rather than an executive review.

Command posture:

```powershell
npm.cmd run ops:ingest
npm.cmd run ops:recurring-report -- --cadence=twice_weekly
```

What the summary should say:

- `cadence = twice_weekly`
- `review_profile = standard`
- `operating_mode = steady_pilot`
- `cadence_guidance.ingest_cutoff_hours = 12`
- `cadence_guidance.rerun_window_hours = 6`
- `cadence_guidance.operator_review_window_hours = 12`

Verified example from the current runner:

```json
{
  "cadence": "twice_weekly",
  "review_profile": "standard",
  "operating_mode": "steady_pilot",
  "status": "ready_with_follow_up",
  "warning_checks": ["operator_follow_up_path"]
}
```

What that means operationally:

- ingest should be fresh within the same half-day handoff window
- if the corpus or the bundle changes materially, rerun within 6 hours
- `warn` is still sendable, but only if the operator note explains why the bundle is still coherent and who owns follow-up

Typical send decision:

- `status = ready` -> send after normal operator review
- `status = ready_with_follow_up` -> send only if every warn has a written note
- `status = needs_review` -> stop

### Executive Handoff Example

Use this when the receiving audience is higher-touch and the operator wants tighter review discipline, even if the underlying bundle is the same report-first export set.

Command posture:

```powershell
npm.cmd run ops:ingest
npm.cmd run ops:recurring-report -- --cadence=twice_weekly --review-profile=executive_handoff
```

What the summary should say:

- `review_profile = executive_handoff`
- `operating_mode = higher_touch_executive_handoff`
- `cadence_guidance.ingest_cutoff_hours = 6`
- `cadence_guidance.rerun_window_hours = 3`
- `cadence_guidance.operator_review_window_hours = 6`
- `cadence_guidance.warn_handling` should explicitly say that warns must be cleared or owner-signed

Verified example from the current runner:

```json
{
  "cadence": "twice_weekly",
  "review_profile": "executive_handoff",
  "operating_mode": "higher_touch_executive_handoff",
  "status": "ready_with_follow_up",
  "warning_checks": ["operator_follow_up_path"]
}
```

What that means operationally:

- the bundle should be treated as same-day and tightly reviewed
- any same-day corpus change is a rerun trigger
- unresolved `warn` is not casually acceptable; it must either be cleared or tied to a named owner and follow-up time before delivery

Typical send decision:

- `status = ready` -> send after operator review
- `status = ready_with_follow_up` -> send only if each warn is explicitly owner-signed
- `status = needs_review` -> stop

Required recurring pilot loop:

1. re-lock scope in `docs/ops/B2B_PRODUCT_ROADMAP.md`
2. review `starter-pack-sample.json`, `B2B_TALK_TRACK.md`, and `recurring-report-cycle-summary.json` together
3. run `ops:ingest` first if the corpus has changed
4. run `ops:recurring-report`
5. run `ops:verify-recurring-handoff -- --handoff-mode=<intended_mode>`
6. perform operator review using `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
7. if `warn` remains for a steady-pilot handoff, start the written note from `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md`
8. only then hand off the bundle for a pilot conversation

The operator checklist should use the same vocabulary as the machine checks. If the JSON summary reports `warn`, the operator review should explicitly record the follow-up decision; if it reports `fail`, the bundle should stop before handoff.

In practical terms:

- `weekly` is the default low-volume pilot rhythm
- `twice_weekly` is the default steady pilot rhythm
- `executive_handoff` is not a new cadence; it is a stricter review overlay on the same export bundle

Minimal command order:

1. `npm.cmd run ops:ingest`
2. `npm.cmd run ops:recurring-report`
3. `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=<mode>`
4. operator review

If the corpus has not changed since the previous cycle, the ingest step can be skipped. The review order should still stay the same.

Skip / rerun rules:

- skip `ops:ingest` only when the vetted corpus is unchanged for the current handoff window
- rerun `ops:recurring-report` whenever the export bundle changes or the cycle summary regresses
- rerun both `ops:ingest` and `ops:recurring-report` if a broader-circulation fixture rotation has just landed
- for executive handoff, treat any same-day corpus change as a rerun trigger

Example rerun calls:

```powershell
npm.cmd run ops:recurring-report -- --cadence=twice_weekly
npm.cmd run ops:recurring-report -- --cadence=twice_weekly --review-profile=executive_handoff
```

### Field-By-Field Summary Comparison

Use the helper command to compare the current JSON summary to the intended handoff example.

Expected modes:

| Handoff mode | Required fields |
| --- | --- |
| `low_volume_pilot` | `cadence=weekly`, `review_profile=standard`, `operating_mode=low_volume_pilot` |
| `steady_pilot` | `cadence=twice_weekly`, `review_profile=standard`, `operating_mode=steady_pilot` |
| `higher_touch_executive_handoff` | `cadence=twice_weekly`, `review_profile=executive_handoff`, `operating_mode=higher_touch_executive_handoff` |

If the helper reports a field mismatch:

- do not hand off yet
- rerun `ops:recurring-report` with the correct mode
- only resume operator review after the summary matches the intended example block

The sequence should not be flipped:

- do not start from UI polish
- do not start from dashboard concepts
- do not skip the roadmap re-lock step before pilot handoff

## When To Stop And Review

Pause the cycle and review before sending anything if:

- `recurring-report-cycle-summary.status = needs_review`
- the anchor cluster loses multi-publisher clarity
- the daily briefing lead stops reading as repeat-use value
- scope guardrails stop excluding dashboard/API claims
- the chosen cadence window cannot be met anymore
- the bundle is being reused outside the vetted snapshot window for broader circulation

## Broader Circulation Rule

If the bundle is going outside the normal pilot loop, do not introduce live fetch into the export path. Instead:

1. refresh ingest separately
2. vet the candidate ingest snapshot
3. rotate the deterministic fixture from that vetted snapshot
4. rerun `ops:starter-pack`, `ops:recurring-report`, and `ops:validate-exports`

The detailed procedure lives in `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`.

Do not treat `ops:verify-recurring-handoff` or an operator note as a substitute for vetted rotation. They only validate the current pilot bundle, not broader-circulation freshness.

## What This Still Does Not Mean

This operating loop does not imply:

- dashboard delivery
- team workflow
- API sales
- finalized commercial packaging

Those remain `Gate after` decisions.

## Handoff Reminder

If recurring report work continues next:

1. keep using the current export builders as the only source of truth
2. improve scheduling and operator review before adding any new product surface
3. prioritize cadence refinement, closer-to-live corpus quality, and checklist hardening before UI work
4. keep dashboard/API requests behind the roadmap gate
