# B2B Operator Note Samples

## Purpose

Give operators copy-ready starting points for recurring pilot handoff notes, especially when a `steady_pilot` bundle is still `ready_with_follow_up`.

These samples do not replace:

- `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`
- `infra/exports/b2b/recurring-report-cycle-summary.json`
- operator judgment

They are intended to reduce wording drift and keep owner/follow-up language consistent across steady-pilot deliveries.

## How To Use

1. Run `npm.cmd run ops:verify-recurring-handoff -- --handoff-mode=steady_pilot`.
2. Confirm the summary still says:
   - `cadence = twice_weekly`
   - `review_profile = standard`
   - `operating_mode = steady_pilot`
3. If the summary is `ready_with_follow_up` or a manual review domain is `warn`, pick the closest sample below.
4. Customize only the owner, follow-up timing, and any scope reminder specific to the meeting.
5. If the handoff is broader circulation rather than a normal pilot loop, stop and move to `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md` instead.

## Sample Set

### 1. `steady_pilot.operator_follow_up.default`

Use when:

- the machine summary warns on `operator_follow_up_path`
- the bundle is otherwise coherent
- the operator knows who owns the next step after the meeting

Copy-ready note:

```text
domain: operator_follow_up
why still sendable: The recurring bundle is coherent and all report-quality checks passed. The remaining open item is follow-up ownership, not report quality.
owner: founding team
follow_up_by: before the next twice-weekly send window
scope reminder: This stays inside a report-first pilot. Questions about dashboard or API expansion are deferred behind the roadmap gate.
```

### 2. `steady_pilot.anchor_clarity.reinforcement`

Use when:

- the bundle is still sendable
- `anchor_clarity` is a manual `warn`
- the operator expects to verbally reinforce why the current anchor beats a larger but weaker alternative

Copy-ready note:

```text
domain: anchor_clarity
why still sendable: The anchor still has the strongest cross-source legibility and the clearest repeat-use value, even though a larger alternative cluster exists in the corpus.
owner: meeting operator
follow_up_by: during the live handoff and in the same-day recap if questions come up
scope reminder: The goal of this pilot is to show defensible report-first issue comparison, not to imply a broader product surface.
```

### 3. `steady_pilot.repeat_use_narrative.follow_up`

Use when:

- the machine checks pass
- the operator thinks the recipient may still read the pack as a one-off demo unless recurring value is stated clearly

Copy-ready note:

```text
domain: repeat_use_narrative
why still sendable: The briefing and report bundle already show repeated-delivery value, but the recipient may need an explicit reminder that this pilot is meant to be revisited on a twice-weekly cadence.
owner: meeting operator
follow_up_by: in the delivery note and again before the next scheduled pilot send
scope reminder: The recurring value here is operator-reviewed report cadence, not a dashboard, portal, or API workflow.
```

## Editing Rules

- Keep the five-field structure from the checklist template.
- Do not remove `owner` or `follow_up_by`.
- If the real issue is broader circulation freshness, do not write around it with a note. Move to `docs/ops/B2B_VETTED_FIXTURE_ROTATION.md`.
- If the handoff is `higher_touch_executive_handoff`, use the stricter owner-signed rule from `docs/ops/B2B_PILOT_REVIEW_CHECKLIST.md`.
