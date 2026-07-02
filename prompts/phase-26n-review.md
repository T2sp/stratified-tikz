# Phase 26N Review Prompt: Coordinate multi-translation UI and undo/redo

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```
## Project context

You are working on the StratifiedTikZ project.

Phase 26 adds global TikZ coordinate anchors, distinct from visible point strata.

Coordinate anchors are global, not layer-bound, exported as `\coordinate`, and can be referenced by paths/sheets/labels/points through `coordinateRef` sources.

Current expected coordinate-anchor behavior after Phase 26A-26K:

- coordinate anchors are stored separately from strata/labels;
- coordinate anchors have no layer, codimension, or style;
- coordinate anchors can be created by cursor/direct input;
- coordinate anchors can be referenced by supported geometry fields;
- supported coordinate refs export as `(tikzName)`;
- unsupported coordinate refs are rejected instead of silently numericized;
- coordinate anchor deletion detaches references;
- layer translation detaches coordinate refs in layer-bound objects before moving them;
- coordinate markers can be shown/hidden;
- coordinate markers are preview-only;
- coordinate anchors are not affected by layer View filter or New layer;
- save/load, undo/redo, TikZ export, inline no-blank-line behavior, and 4-space indentation must be preserved.

Phase 26 follow-up adds coordinate-anchor multi-selection and coordinate-anchor translation.

Important design decisions:

- Coordinate anchors support coordinate-only multi-selection.
- Mixed multi-selection of coordinate anchors and layer-bound objects is not supported in the MVP.
- Coordinate translation moves the coordinate anchors themselves.
- Geometry referencing translated coordinate anchors remains live and therefore follows the moved anchors.
- Unlike layer translation, coordinate translation does not detach references in layer-bound objects.
- If a selected coordinate anchor's own position contains `coordinateRef` sources, detach those internal refs before translating that coordinate anchor.
- Global coordinate positions translate by adding the delta to components, preserving symbolic expressions when possible.
- Work-plane-local coordinate positions translate by moving their stored frame origin; local `a,b` expressions and frame basis vectors remain unchanged.
- Drag-based coordinate translation uses cursor snap.
- Numeric/direct translation does not use cursor snap.
- Translation is atomic and undoable.
- Selection state is UI/editor state and is not stored in `Diagram`.
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

Phase 26N should add Inspector coordinate multi-translation with undo/redo.

## Review checklist

Check:

- multi-coordinate Inspector translation panel appears;
- dx/dy/dz behavior correct;
- 2D z policy preserved;
- symbolic/local coordinate positions translated correctly;
- references remain live and are not detached;
- TikZ coordinate definitions update;
- draw commands still use `(A)` references;
- undo/redo works;
- failures atomic.

Medium issues include:

- references detached during coordinate translation;
- path geometry mutated unnecessarily;
- TikZ refs lost;
- undo/redo broken;
- work-plane-local preview stale.

Run verification commands and report results.
