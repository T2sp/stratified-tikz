# Phase 12I Review Prompt: Work-plane-local cubic Bézier metadata

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```


## Project context

You are working on the StratifiedTikZ project.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Existing axis-aligned 3D work planes `xy`, `xz`, and `yz` must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Review instructions

Review this subphase only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.

If only Low-priority issues remain, set `"ready_to_commit": true`.

Use this human-readable structure:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call This Subphase Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt.
```

Then output exactly:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Rules:

- counts must be numbers;
- `summary` must be `"pass"` or `"needs_changes"`;
- `ready_to_commit` must be false if Critical or Medium issues exist;
- `suggested_fix_prompt` should be targeted if fixes are needed.


## Goal under review

Phase 12I should persist enough curve-level metadata so eligible 3D relative Cartesian/polar Bézier controls can later be exported in their work-plane-local 2D frame, without relying on current active UI work-plane state.

## Review checklist

Check:

- metadata distinguishes absolute / work-plane-local relative Cartesian / work-plane-local relative polar modes;
- absolute `Vec3` controls remain available for rendering/editing;
- work-plane-local metadata includes frame snapshot: origin, `u`, `v`, normal;
- relative Cartesian offsets are stored and interpreted correctly;
- relative polar angle/radius values are stored and interpreted correctly;
- first control is relative to start;
- second control is relative to end;
- local start/end coordinates are computed or stored consistently;
- active work-plane changes do not change existing curve meaning;
- active UI work-plane state is not globally serialized as diagram state;
- old saved diagrams without metadata load as absolute;
- metadata round-trips through save/load;
- invalid metadata handled safely;
- SVG rendering and handle positions remain correct;
- handle dragging policy is implemented/documented.

Medium issues include:

- export meaning depending on current active work plane;
- missing frame snapshot for work-plane-local modes;
- second control incorrectly relative to start;
- save/load breaking old diagrams;
- metadata breaking rendering.

Run verification commands and report results.
