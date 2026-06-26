# Phase 24E Review Prompt: Concatenate selected paths

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

Phase 23 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- paths, arrows, braiding crossings, grids/lattices, sheets, ruled surfaces, Coons patches, filled regions/sheets, curved surfaces;
- symbolic variables and coordinate expressions;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 24 improves editing fundamentals:

1. Cursor snapping / coordinate quantization.
2. Multi-selection.
3. Bulk style/layer/delete/duplicate editing.
4. Bulk translation, including symbolic coordinates.
5. Path concatenation.
6. Layer merge and layer translation hardening.
7. Editing polish/docs/regression hardening.

Important phase decision:

- General affine transformations are **deferred to a later phase**.
- In Phase 24, the only geometric transform is translation.
- Translation must work for objects containing symbolic coordinates.
- Path concatenation does **not** need to preserve original per-path styles. The concatenated path can use a simple style policy, preferably the first selected path's style or current default curve style.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Direct/symbolic input should not be silently snapped.
- UI-only selection/draft/palette state should not be stored in `Diagram`.
- Multi-selection and operation data that affects geometry should be undoable.
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

Phase 24E should concatenate selected paths with endpoint matching and optional source removal.

## Review checklist

Check:

- UI/action exists for selected paths;
- eligible path kinds clear;
- selection order used/deterministic;
- endpoint matching works;
- next-path auto-reverse works;
- disconnected paths rejected;
- source paths unchanged when keep originals on;
- source paths removed when off;
- new path selected;
- style policy simple and documented;
- original later-path styles not unnecessarily preserved;
- symbolic coordinates preserved;
- crossings cleaned when originals removed;
- undo/redo works;
- TikZ output valid.

Medium issues include:

- source paths mutated;
- disconnected paths concatenated;
- symbolic coordinates lost;
- style overrides accidentally bloated;
- crossing states stale after removal.

Run verification commands and report results.
