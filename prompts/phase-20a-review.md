# Phase 20A Review Prompt: Ruled surface and Coons patch model/sampling utilities

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

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 19 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- custom work planes;
- camera controls and tikz-3dplot-compatible export;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- symbolic variables and coordinate expressions;
- grids;
- paths, filled regions/sheets, curved surfaces, and path templates.

Phase 20 adds two related capabilities:

1. More flexible 3D surface construction:
   - ruled surfaces from two boundary paths;
   - Coons patches from four boundary paths.

2. Approximate automatic 3D visibility:
   - projected render primitives;
   - surface face depth sorting;
   - curve hidden/visible segmentation behind surfaces;
   - optional point/label visibility behavior;
   - TikZ export matching the SVG preview as much as practical.

This phase is inspired by ideas such as screen depth / z-sorting / occlusion found in TikZ/PGF 3D tooling. However, do not make StratifiedTikZ depend on `tikz-3dtools` or LuaLaTeX packages in the MVP. The editor should compute visibility in TypeScript so SVG preview and generated TikZ stay aligned.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- In 3D:
  - sheets are codim 1;
  - curves are codim 2;
  - points are codim 3.
- Internally all coordinates are `Vec3`.
- Work planes are model-space editing aids.
- Camera/projection and work planes are separate concerns.
- Automatic visibility should be approximate and optional.
- Manual layer order must remain available.
- Generated TikZ must remain readable.
- Inline math export must still have no blank lines.
- Indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, and all existing geometry behavior.
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

Phase 20A should introduce robust model and sampling utilities for ruled surfaces and Coons patches.

## Review checklist

Check:

- ruled surface primitive/model exists;
- Coons patch primitive/model exists;
- objects have `geometricKind: "sheet"` and codim 1;
- boundary geometry is copied, not live references;
- ruled surface sampling finite;
- Coons patch sampling finite;
- Coons corner compatibility checked;
- sampling resolution bounded;
- invalid/non-finite boundaries rejected;
- save/load compatible if model persisted;
- existing path/sheet/surface behavior not regressed.

Medium issues include:

- sampled vertices can be NaN/infinite;
- unbounded sampling;
- Coons patch accepts inconsistent corners;
- live boundary references stored unexpectedly;
- wrong codim/geometric kind.

Run verification commands and report results.
