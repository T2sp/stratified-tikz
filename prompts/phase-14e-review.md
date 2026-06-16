# Phase 14E Review Prompt: Cross-work-plane and free 3D concatenated paths

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

Phase 13 is complete or near complete.

The project goal includes efficiently drawing 3-dimensional stratified diagrams like the attached reference PDF: translucent colored 3D sheet-like regions, solid and dotted 1-strata, point markers, labels, coordinate axes, and readable TikZ output.

Phase 14 focuses on the 1-dimensional path infrastructure needed for those diagrams:

- concatenated paths made from line and cubic Bézier segments;
- same-plane and later cross-plane 3D paths;
- path editing and export;
- segment-level style overrides such as dotted/densely dotted portions.

Curved colored 2-dimensional surface primitives such as hemispheres and saddle patches are deferred to Phase 15.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work planes are editor/UI state unless a curve stores persistent work-plane-local metadata for faithful export.
- Selection, drafts, preview highlights, and UI-only state must not be stored in `Diagram`.
- Generated TikZ should remain readable and maintainable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load, undo/redo, camera, work-plane, source-selection, and existing creation behavior.


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

Phase 14E should allow concatenated paths whose segments are not restricted to a single work plane, while preserving same-work-plane mode.

## Review checklist

Check:

- free 3D/cross-work-plane mode exists;
- same-work-plane mode still works and rejects mixed-plane drafts;
- cross-work-plane mode allows active work plane changes between segments;
- adjacent endpoint continuity preserved;
- finite coordinates required;
- path stored as absolute `Vec3` segment data;
- export does not depend on transient active work plane;
- SVG/TikZ preserve segment order;
- segment style overrides preserved;
- undo/redo behavior sensible;
- no surface/region scope creep.

Medium issues include:

- mixed-plane path created accidentally in same-work-plane mode;
- cross-work-plane path cannot export;
- active work-plane transient state needed for export;
- endpoint continuity broken.

Run verification commands and report results.
