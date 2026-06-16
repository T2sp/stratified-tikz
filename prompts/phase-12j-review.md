# Phase 12J Review Prompt: TikZ 3d-library scope export for work-plane-local Béziers

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

Phase 12J should export eligible 3D work-plane-local relative Bézier curves using TikZ's `3d` library `canvas is plane` scope, with 2D-style relative controls inside the scope.

## Review checklist

For relative polar export, check:

- generated TikZ includes `\usetikzlibrary{3d}` when needed;
- generated TikZ contains a scope with:
  - `plane origin`;
  - `plane x`;
  - `plane y`;
  - `canvas is plane`;
- inside the scope, the path uses `.. controls +(q1:r1) and +(q2:r2) ..`;
- independent `\coordinate` declarations for relative control points are not emitted;
- start/end coordinates are valid local 2D coordinates;
- no dangling references.

For relative Cartesian export, check:

- generated TikZ contains a `canvas is plane` scope;
- path uses `.. controls +(dx1,dy1) and +(dx2,dy2) ..`;
- independent control coordinate declarations are not emitted.

Fallback behavior:

- 3D absolute Béziers without work-plane-local metadata still use existing absolute 3D syntax;
- arbitrary 3D curves not representable in one work-plane frame do not get misleading scoped relative export;
- no plain `+(q:r)` outside `canvas is plane` for arbitrary 3D work-plane-local polar controls;
- 2D relative export unchanged;
- non-Bézier export unchanged.

Layer/style behavior:

- layer-aware output preserved;
- styles preserved;
- Phase 9A coordinate names preserved where applicable;
- no dangling coordinate comments/sections.

Library inclusion:

- `\usetikzlibrary{3d}` emitted when needed;
- always emitting it is Low unless it breaks existing output;
- missing it when `canvas is plane` is used is Medium or Critical depending on generated TikZ validity.

Tests should cover scoped relative export, omission of control-point coordinates, fallback, 2D regression, and layer-aware output.

Invalid TikZ scope syntax is Critical or Medium depending on severity.

Run verification commands and report results.
