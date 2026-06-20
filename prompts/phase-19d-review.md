# Phase 19D Review Prompt: Symbolic TikZ export integration and mode compatibility

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

Phase 18 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, paths, path templates, sheets, filled regions/sheets, curved surfaces;
- custom work planes;
- camera controls;
- layer manager;
- style manager and external TikZ style references;
- standalone and inline math TikZ export modes;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

Phase 19 adds symbolic input and grid generation.

Core requirements:

1. Users can define variables in the toolbar.
   - TikZ output corresponds to `\pgfmathsetmacro`.
   - Invalid/dangerous inputs should be rejected before they can generate broken TikZ.

2. Coordinate inputs can accept expressions using variables and elementary functions.
   - Example:
     - variables: `R`, `q`
     - coordinate input: `(R*cos(q), R*sin(q))`
     - generated TikZ coordinate: `({\R * cos(\q)}, {\R * sin(\q)})`
   - SVG preview still needs numeric values, so expressions must be evaluated using variable preview values.

3. Add a grid-generation mode.
   - The grid should be represented compactly in TikZ using `\foreach`.
   - Range/clip controls should make grid boundaries concise.
   - In 3D, grids should be generated in a work-plane-local 2D frame when applicable.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all numeric preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Symbolic data that affects generated TikZ should be persisted in diagram/export data, not only UI state.
- UI-only draft state should not be stored in `Diagram`.
- TikZ export must remain readable and must respect standalone vs inline math export mode.
- Inline math export must still contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve camera, work-plane, layer manager, style manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.
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

Phase 19D should harden symbolic TikZ export across variables, coordinates, and export modes.

## Review checklist

Check:

- variables emitted before use;
- inline variables inside tikzpicture;
- inline no-blank-lines preserved;
- symbolic coordinates use macro expressions;
- preview values not exported for symbolic components;
- element kind coverage clear;
- unsupported symbolic cases rejected or documented;
- duplicate variable definitions avoided;
- numeric output unchanged;
- layer/style/camera output preserved.

Medium issues include:

- variables emitted after use;
- inline mode blank lines return;
- symbolic intent silently lost;
- unsupported geometry accepts symbolic input but exports numeric preview;
- numeric export regressed.

Run verification commands and report results.
