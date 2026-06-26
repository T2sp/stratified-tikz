# Phase 25A Review Prompt: Work-plane-local symbolic coordinate model and validation

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

Phase 24 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- symbolic variables and symbolic global coordinate expressions;
- direct input and cursor input;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes;
- camera controls;
- grids/lattices;
- arrows and 2D braiding controls;
- paths, sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- preview-centered UI;
- layer/style/variable managers;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 25 adds symbolic work-plane-local coordinates.

Main idea:

- In 3D direct input and Inspector coordinate editing, users can enter coordinates in the active/stored work-plane-local 2D coordinate system.
- The local coordinates accept symbolic scalar expressions just like global coordinates.
- SVG preview uses finite numeric preview values.
- TikZ export should preserve local symbolic expressions where practical by emitting compatible paths/sheets inside `canvas is plane` scopes.
- Direct/symbolic input should not be snapped by cursor snapping.

Important user decision:

- During **global translation** of an object that contains work-plane-local symbolic coordinates, move that object's own frame origin by the global translation vector.
- Do **not** expand local symbolic expressions into global symbolic coordinates during global translation.
- Do **not** mutate a shared global work plane; move each object's stored frame snapshot origin.
- During **work-plane-local translation** of such coordinates, update local scalar expressions `a`, `b` by adding local deltas.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work-plane-local symbolic coordinate data affects geometry/export and must be saved.
- UI-only draft/open state should not be stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.
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

Phase 25A should introduce a robust model and validation helpers for work-plane-local symbolic coordinates.

## Review checklist

Check:

- work-plane-local coordinate model exists;
- local `a,b` symbolic expressions preserved;
- frame snapshot persisted;
- finite preview computed correctly;
- variable detection includes local scalars and frame expressions;
- invalid frames rejected;
- unknown variables rejected;
- save/load round-trip works;
- old diagrams load;
- malformed input fails cleanly;
- no geometry/export behavior regressed.

Medium issues include:

- local expressions discarded into global preview numbers;
- invalid frame accepted;
- variable detection misses `a/b` expressions;
- stale previews accepted;
- old diagrams fail to load.

Run verification commands and report results.
