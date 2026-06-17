# Phase 15B Review Prompt: Create filled regions/sheets from selected closed paths

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

Phase 14 is complete or near complete.

The project goal includes efficiently drawing 2D and 3D stratified diagrams with:

- closed paths;
- filled regions/sheets;
- translucent colored 2-dimensional strata;
- solid and dotted 1-strata;
- point markers;
- labels;
- coordinate axes;
- readable TikZ output.

Phase 15 now prioritizes closed-path filling in both 2D and 3D before more specialized curved surface primitives.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 2D:
  - codim 0 strata are regions;
  - codim 1 strata are curves;
  - codim 2 strata are points.
- In 3D:
  - codim 1 strata are sheets;
  - codim 2 strata are curves;
  - codim 3 strata are points.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are model-space editing aids.
- A 3D closed-path filled sheet in this phase should be planar and work-plane-local.
- Preview-only UI state should not be stored in `Diagram`.
- Generated TikZ must remain readable and should preserve style/layer semantics.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, concatenated path, and existing creation/editing behavior.


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

Phase 15B should allow creating filled objects from selected closed paths in both 2D and 3D, including multiple boundaries with `evenOdd` fill rule.

## Review checklist

Check:

- UI/workflow exists to create fill from closed paths;
- 2D creates codim-0 region;
- 3D creates codim-1 planar/work-plane-local sheet;
- one boundary works;
- multiple boundaries work;
- `evenOdd` selectable and stored;
- open paths rejected;
- non-finite paths rejected;
- 3D non-coplanar paths rejected;
- boundaries copied, not live-linked;
- source paths unchanged;
- created object selected;
- undo/redo works if applicable;
- invalid selection does not modify diagram.

Medium issues include:

- live linking despite copy-on-create;
- non-coplanar 3D paths accepted;
- open paths accepted;
- evenOdd not stored;
- wrong codim/geometric kind.

Run verification commands and report results.
