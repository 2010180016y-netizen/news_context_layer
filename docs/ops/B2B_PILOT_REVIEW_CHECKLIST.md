# B2B Pilot Review Checklist

## Purpose

Use this checklist before any recurring pilot handoff.

The goal is to keep the recurring B2B loop grounded in the current report-first scope:

- no new UI promise
- no dashboard/API promise
- use only the generated starter-pack/report/briefing assets

This checklist is the human decision surface. `infra/exports/b2b/recurring-report-cycle-summary.json` is its machine-readable companion, and both should be read with the same review domains:

- `scope_lock`
- `artifact_consistency`
- `anchor_clarity`
- `repeat_use_narrative`
- `guardrail`
- `operator_follow_up`

## Review Order

1. Re-lock scope with `docs/ops/B2B_PRODUCT_ROADMAP.md`.
2. Review these artifacts together:
   - `infra/exports/b2b/starter-pack-sample.json`
   - `docs/ops/B2B_TALK_TRACK.md`
   - `infra/exports/b2b/recurring-report-cycle-summary.json`
   - `infra/exports/reports/sample-issue-report.json`
   - `infra/exports/briefings/daily-briefing-sample.json`
3. If the corpus changed, run:
   1. `npm.cmd run ops:ingest`
   2. `npm.cmd run ops:recurring-report`
4. Perform the domain review below before any external pilot handoff.

## Cadence Declaration

Before scoring any domain, write down the intended operating mode for this handoff:

- `low_volume_pilot`
- `steady_pilot`
- `higher_touch_executive_handoff`

And confirm it matches the current cycle summary:

- `cadence`
- `review_profile`
- `operating_mode`
- `cadence_guidance`

If those fields do not match the intended conversation, rerun the recurring cycle with the correct options before proceeding.

## Domain Review

### 1. `scope_lock`

Primary sources:

- `docs/ops/B2B_PRODUCT_ROADMAP.md`
- `docs/ops/B2B_TALK_TRACK.md`

Machine companion:

- none; this remains manual on purpose

Pass:

- the conversation is still report-first
- the next delivery is a file/report handoff
- dashboard/API language remains `Gate after`

Warn:

- copy is still inside scope, but one operator note would be needed to keep the conversation from drifting into dashboard/API requests

Fail:

- the deck or spoken narrative implies dashboard delivery, API delivery, or team workflow that the roadmap has not unlocked

Operator action:

- if `warn`, add an explicit scope reminder before handoff
- if `fail`, stop and rework the deck/talk track before sending anything
- warn note must state who will steer the conversation back inside report-first scope

### 2. `artifact_consistency`

Primary sources:

- `infra/exports/b2b/starter-pack-sample.json`
- `infra/exports/reports/sample-issue-report.json`
- `infra/exports/briefings/daily-briefing-sample.json`
- `infra/exports/b2b/recurring-report-cycle-summary.json`

Machine companion:

- `artifact_bundle_consistent`

Pass:

- the starter pack embeds the same sample issue report id and anchor cluster as the standalone issue report
- the starter pack briefing payload still reflects the same generated briefing bundle
- the cycle summary still describes the same export bundle the operator is reviewing

Warn:

- the bundle is still materially the same, but the operator needs to note a small presentation mismatch before handoff

Fail:

- report ids, anchor clusters, or briefing depth drift between files
- the operator cannot confidently say the reviewed files describe one coherent recurring bundle

Operator action:

- if `warn`, document the mismatch and decide whether a quick regeneration is enough
- if `fail`, rerun the export path before handoff
- warn note must say whether the mismatch is presentational only or regeneration-worthy

### 3. `anchor_clarity`

Primary sources:

- `infra/exports/reports/sample-issue-report.json`
- `infra/exports/b2b/recurring-report-cycle-summary.json`

Machine companion:

- `anchor_cluster_ready`
- `selection_reasons_present`

Pass:

- the anchor story still reads as the right lead issue
- cross-source clarity remains obvious
- selection reasons explain why this issue is the demo anchor

Warn:

- the anchor is still usable, but an operator would need to verbally reinforce why this cluster was chosen

Fail:

- the anchor loses multi-publisher legibility
- the selection rationale becomes too thin to justify the choice

Operator action:

- if `warn`, add a short anchor explanation in the handoff note
- if `fail`, stop and rotate/regenerate before external use
- warn note must explain why the current anchor still beats the nearest weaker alternative

### 4. `repeat_use_narrative`

Primary sources:

- `infra/exports/briefings/daily-briefing-sample.json`
- `infra/exports/b2b/starter-pack-sample.json`
- `infra/exports/b2b/recurring-report-cycle-summary.json`

Machine companion:

- `briefing_lead_watchlist`
- `briefing_depth`

Pass:

- the lead briefing item still feels like a reason to come back
- the bundle still shows immediate value plus repeated-delivery value
- the briefing has enough depth to imply a recurring cadence, not a one-off deck

Warn:

- the repeat-use angle is present but needs operator framing during delivery

Fail:

- the lead item reads like a one-off story only
- the briefing no longer supports a recurring narrative

Operator action:

- if `warn`, state the repeat-use angle explicitly in the delivery note
- if `fail`, stop and review the corpus or briefing builder output
- warn note must say what return behavior or follow-up cadence the operator is asking the recipient to imagine

### 5. `guardrail`

Primary sources:

- `infra/exports/b2b/starter-pack-sample.json`
- `docs/ops/B2B_TALK_TRACK.md`
- `infra/exports/b2b/recurring-report-cycle-summary.json`

Machine companion:

- `starter_pack_guardrail`

Pass:

- starter pack and talk track remain inside beta-safe scope
- dashboard/API/monthly subscription claims are still excluded

Warn:

- the wording is technically safe, but it could invite follow-up questions that need active operator steering

Fail:

- the bundle starts implying product surfaces or commercial commitments that remain `Gate after`

Operator action:

- if `warn`, add an explicit scope guardrail sentence before delivery
- if `fail`, remove the language before handoff
- warn note must say which out-of-scope request is most likely to come up and how it will be deflected

### 6. `operator_follow_up`

Primary sources:

- `infra/exports/b2b/recurring-report-cycle-summary.json`
- `docs/ops/B2B_RECURRING_REPORT_OPERATIONS.md`

Machine companion:

- `operator_follow_up_path`

Pass:

- follow-up path is already configured and no extra operator action is needed
- a named owner can describe the next step after the pilot conversation without improvising

Warn:

- the bundle is usable, but support/contact or response ownership still needs operator confirmation
- the next step is known, but ownership or response timing still needs to be written down

Fail:

- the operator cannot describe who owns follow-up or how the next step would be handled after the pilot conversation
- an executive handoff profile is being used and unresolved `warn` items still have no named owner

Operator action:

- if `warn`, send only with an explicit owner and follow-up note
- if `fail`, stop until the follow-up path is clear enough for a live conversation
- for `higher_touch_executive_handoff`, treat unresolved follow-up ownership as a stop condition

## Overall Decision Rule

Approve the recurring pilot handoff only when:

- no review domain is `fail`
- every `warn` has an explicit operator note or follow-up owner
- the cycle summary status is `ready` or `ready_with_follow_up`
- the chosen cadence window is still valid for the actual send time

Do not send the pilot bundle if:

- the cycle summary reports `needs_review`
- any domain above is marked `fail`
- the reviewed files no longer read like one coherent report-first handoff pack
- the cycle summary cadence/review profile does not match the actual handoff mode
- broader circulation is being attempted without going through vetted fixture rotation

## Operator Note Template

If any domain is `warn`, record a short note with:

1. `domain`
2. `why still sendable`
3. `owner`
4. `follow_up_by`
5. `scope reminder` if relevant

For steady-pilot handoffs, start from the committed copy-ready examples in `docs/ops/B2B_OPERATOR_NOTE_SAMPLES.md` before customizing the note.

### Example Warn Note For Steady Pilot

Use when the summary says:

- `cadence = twice_weekly`
- `review_profile = standard`
- `operating_mode = steady_pilot`
- `status = ready_with_follow_up`

Example:

```text
domain: operator_follow_up
why still sendable: The recurring bundle is coherent and the only open item is support/contact ownership, not report quality.
owner: founding team
follow_up_by: before next twice-weekly send window
scope reminder: This remains a report-first pilot; no dashboard or API follow-up is implied.
```

### Example Warn Note For Executive Handoff

Use when the summary says:

- `review_profile = executive_handoff`
- `operating_mode = higher_touch_executive_handoff`
- `status = ready_with_follow_up`

Example:

```text
domain: operator_follow_up
why still sendable: All report-quality checks passed and the only remaining warn is already owned by a named operator.
owner: founding team lead
follow_up_by: same-day, before executive recap is sent
scope reminder: The handoff remains a file/report delivery only; any dashboard or API request is deferred behind the roadmap gate.
```

If an executive handoff note cannot name the owner and follow-up timing concretely, treat that as `fail`.

## Next Improvement Priorities

The next stage should focus on:

1. scheduling cadence refinement
2. closer-to-live corpus quality
3. pilot review checklist hardening

The next stage should not focus on:

- extension UI redesign
- new dashboard concepts
- external API packaging
