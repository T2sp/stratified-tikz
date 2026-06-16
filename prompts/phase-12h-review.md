# Phase 12H Review Prompt: Existing coordinate sources for direct creation

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
- Work-plane state is editor/UI state, not `Diagram`.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Preserve save/load, undo/redo, SVG preview, and TikZ export behavior.

## Review instructions

Review Phase 12H only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.

If only Low-priority issues remain, set `"ready_to_commit": true`.

## Goal under review

Phase 12H should let direct creation forms use existing diagram coordinates as coordinate sources, with copy-on-create semantics.

Required coordinate sources:

- point stratum positions;
- existing polyline vertices, in both 2D and 3D;
- existing polygon sheet vertices, in 3D.

Optional coordinate sources:

- cubic Bézier start/control/end points.

This phase should not implement live linked/anchored vertices.

## Review checklist

Check:

- direct creation forms allow point-like fields to choose either coordinates or existing coordinate sources;
- supported coordinate sources include point strata;
- supported coordinate sources include 2D polyline vertices;
- supported coordinate sources include 3D polyline vertices;
- supported coordinate sources include 3D polygon sheet vertices;
- supported direct creation targets include polyline vertices;
- supported direct creation targets include cubic Bézier start/end points;
- supported direct creation targets include sheet vertices in 3D;
- Bézier control point support is present if direct UI treats controls as absolute point-like fields, or limitation is documented.

## Source resolution

Check that source resolution is safe.

Expected:

- point stratum source resolves to point position;
- polyline vertex source resolves to the selected vertex;
- sheet vertex source resolves to the selected polygon vertex;
- optional cubic Bézier point source resolves to start/control/end as appropriate;
- missing source IDs are rejected;
- invalid vertex indices are rejected;
- non-finite coordinates are rejected;
- non-point strata cannot be used as point sources;
- non-polyline curves cannot be used as polyline vertex sources;
- non-sheet strata cannot be used as sheet vertex sources.

If malformed source references can create invalid geometry, classify as Medium or Critical depending on impact.

## Copy-on-create behavior

Check that this phase uses copy-on-create semantics.

Expected:

- created geometry stores copied `Vec3` coordinates;
- created geometry does not store live references to point IDs, curve IDs, sheet IDs, or vertex indices;
- moving the source point later does not move the created geometry;
- editing the source polyline vertex later does not move the created geometry;
- editing the source sheet vertex later does not move the created geometry;
- deleting the source object later does not invalidate the created geometry.

If live references are stored despite the copy-on-create requirement, classify as Medium.

If source deletion breaks created geometry, classify as Medium.

## Coordinate mode behavior

Check global coordinate mode.

Expected:

- choosing an existing point copies its model-space `Vec3`;
- choosing an existing polyline vertex copies its model-space `Vec3`;
- choosing an existing sheet vertex copies its model-space `Vec3`.

Check active work-plane local coordinate mode.

Expected:

- source coordinate must lie on the active work plane within tolerance, unless explicit projection UI is implemented;
- local `(a,b)` coordinates are computed correctly;
- off-plane sources are rejected with a clear message;
- off-plane sources are not silently projected.

If off-plane sources are silently projected, classify as Medium.

## 2D behavior

Check that existing coordinate sources work in 2D.

Expected:

- 2D point sources work;
- 2D polyline vertex sources work;
- copied coordinates preserve `x` and `y`;
- internal `z` remains `0`;
- created 2D curves have codim 1;
- no 3D sheet creation is exposed in 2D.

If existing coordinate sources work only in 3D but not in 2D for polyline/Bézier direct creation, classify as Medium.

## 3D behavior

Check that existing coordinate sources work in 3D.

Expected:

- 3D point sources work;
- 3D polyline vertex sources work;
- 3D polygon sheet vertex sources work;
- copied coordinates preserve full `Vec3`;
- plane-local mode validates on-plane condition.

## Layer, selection, undo/redo

Check:

- created geometry uses selected creation layer;
- created geometry remains visible under layer filter policy;
- created geometry is selected according to existing behavior;
- creation is undoable if undo/redo exists;
- changing coordinate source form fields does not create undo history entries;
- source selection state is UI/editor state only.

## TikZ and SVG behavior

Check:

- created geometry appears in SVG;
- created geometry appears in TikZ;
- TikZ output contains copied coordinates as ordinary geometry;
- TikZ output does not contain source references;
- source coordinate UI state is not exported;
- save/load stores created geometry normally, not source references.

## Tests

Check tests cover:

- point source copy;
- 2D polyline vertex source copy;
- 3D polyline vertex source copy;
- 3D sheet vertex source copy;
- copy-on-create behavior after source mutation;
- global coordinate mode;
- plane-local mode with on-plane source;
- plane-local mode rejecting off-plane source;
- missing source ID rejection;
- invalid vertex index rejection;
- non-finite source coordinate rejection;
- no live source references stored.

If these tests are missing, classify based on risk:

- missing copy-on-create test: Medium;
- missing plane-local off-plane rejection test: Medium;
- missing polyline/sheet source tests: Medium;
- missing optional cubic Bézier point source tests: Low if unsupported and documented.

## Scope control

Confirm Phase 12H did not implement:

- live linked vertices;
- anchored vertices;
- automatic dependency updates;
- TikZ reference-based vertex export;
- general multi-selection;
- new curve types;
- unrelated geometry features.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Output format

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
