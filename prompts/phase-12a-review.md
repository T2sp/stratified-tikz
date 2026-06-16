# Phase 12A Review Prompt: WorkPlane model and geometry utilities

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

- An n-stratum means codimension n, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Generated TikZ should not depend on transient active UI state.
- Existing axis-aligned 3D work planes (`xy`, `xz`, `yz`) must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.


## Review instructions

Review this subphase only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.
If only Low-priority issues remain, set `"ready_to_commit": true`.

Output format:

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

Then output:

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
- `ready_to_commit` must be false if Critical or Medium issues exist;
- `suggested_fix_prompt` should be targeted if fixes are needed.


## Goal under review

Add the internal WorkPlane model and pure geometry utilities needed for arbitrary custom 3D work planes.

This subphase should not add broad UI. It may add small exports/imports and tests. It should make later UI and creation subphases straightforward.

## Review checklist

Check:

- custom work planes have `origin`, `u`, `v`, `normal`;
- vectors are finite, normalized, and approximately orthogonal;
- handedness is consistent or documented;
- invalid inputs are rejected;
- helpers do not produce `NaN` or infinite coordinates;
- origin+normal construction uses a stable auxiliary axis;
- three-point construction uses `p0` as origin and rejects collinear points;
- axis-aligned work-plane behavior is not regressed;
- active work-plane state is not stored in `Diagram`;
- tests cover core geometry and invalid cases.

Medium issues include:

- only origin+normal stored without `u`/`v`;
- missing invalid-input tests;
- collinear input producing a plane;
- non-finite input producing geometry.

Run verification commands and report results.
