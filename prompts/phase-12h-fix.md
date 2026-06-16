# Phase 12H Fix Prompt: Improve coordinate-source labels and support existing points in cursor creation

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

## Context

You are working on the StratifiedTikZ project.

Phase 12H implemented existing coordinate sources for direct creation.

Manual check found two UX/functionality issues:

1. In direct creation, existing point source options are displayed as:

```text
Point: point
Point: point
Point: point
```

because many point strata have the default name `point`.

This makes the dropdown/select unusable when there are multiple points.

2. Existing point coordinates should also be usable during cursor creation, not only direct creation.

For example, while creating a polyline, cubic Bézier, or polygon sheet with cursor tools, the user should be able to click an existing point stratum and use its coordinate as the next vertex/control/start/end point.

## Goal

Fix and extend Phase 12H so that:

1. Existing coordinate source labels are human-readable and disambiguated.
2. Cursor creation can use existing point strata as coordinate sources.
3. Direct creation still works.
4. All source usage remains copy-on-create, not live linking.

## Scope

This is a targeted Phase 12H fix/extension.

Do not implement:

- live linked vertices;
- anchored vertices;
- automatic dependency updates when source points move;
- TikZ reference-based vertex export;
- general multi-selection;
- new curve types;
- broad UI redesign;
- new dependencies.

Do not change:

- diagram data model unless absolutely necessary;
- TikZ export semantics;
- SVG rendering semantics;
- save/load format;
- ordinary cursor creation behavior except for the new existing-point source option;
- direct coordinate creation behavior.

## 1. Improve existing coordinate source labels

Inspect the code that builds labels for existing coordinate sources in the direct creation UI.

Current bad behavior:

```text
Point: point
Point: point
Point: point
```

because all point strata use the default name `point`.

Update the display labels so users can distinguish sources.

Required behavior:

- Each source label should be human-readable.
- Labels should be unique or at least clearly disambiguated.
- Default names such as `point`, `curve`, or `sheet` should not produce ambiguous labels.
- Include enough information to identify the source.

Preferred label format:

For point strata:

```text
Point: <name> [<short-id>] @ (<x>, <y>)
Point: <name> [<short-id>] @ (<x>, <y>, <z>)
```

Examples:

```text
Point: point [pt-3] @ (1.2, 0.5)
Point: P [p-left] @ (-1, 2)
Point: point [point-7] @ (0, 1, 3)
```

For polyline vertices:

```text
Polyline: <curve-name> [<short-id>] / Vertex 1 @ (...)
Polyline: <curve-name> [<short-id>] / Vertex 2 @ (...)
```

For sheet vertices:

```text
Sheet: <sheet-name> [<short-id>] / Vertex 1 @ (...)
Sheet: <sheet-name> [<short-id>] / Vertex 2 @ (...)
```

If cubic Bézier points are supported as sources:

```text
Bézier: <curve-name> [<short-id>] / Start @ (...)
Bézier: <curve-name> [<short-id>] / Control point 1 @ (...)
Bézier: <curve-name> [<short-id>] / Control point 2 @ (...)
Bézier: <curve-name> [<short-id>] / End @ (...)
```

Use one-based labels for user-facing vertex numbers.

Internal indices may remain zero-based.

Coordinate formatting should follow existing inspector conventions:

- in 2D, show `(x, y)`;
- in 3D, show `(x, y, z)`.

If there is already a coordinate formatting helper, reuse it.

## 2. Add a pure source-label helper

If not already present, factor source label generation into a pure helper.

Suggested helper:

```ts
formatExistingCoordinateSourceLabel(diagram, source, ambientDimension): string
```

or equivalent.

This helper should:

- resolve the source safely;
- include source kind;
- include stratum name;
- include a short id or another disambiguator;
- include vertex/control role where applicable;
- include formatted coordinates;
- handle missing/deleted sources gracefully;
- not throw uncaught errors in UI paths.

For missing sources, a label such as:

```text
Missing source: <id>
```

is acceptable.

## 3. Preserve copy-on-create semantics

This phase remains copy-on-create.

When an existing coordinate source is used:

- copy the current coordinate;
- commit the copied `Vec3` into the new geometry;
- do not store the source id in the created geometry;
- moving the source later does not move the created geometry;
- deleting the source later does not invalidate the created geometry.

Do not implement live linked vertices.

## 4. Support existing point strata in cursor creation

Add support for using existing point strata during cursor creation.

Required target tools:

- Add polyline;
- Add cubic Bézier;
- Add 3D polygon sheet.

Preferred optional targets:

- Add point;
- Add label.

For path/sheet creation, the behavior should be:

- while a cursor creation tool is active, the user can click an existing point stratum;
- instead of using the raw mouse/work-plane coordinate, the app uses the clicked point stratum’s current coordinate as the next draft point;
- this is copy-on-create;
- the draft point is not linked to the source point;
- the source point is not modified.

Examples:

### Polyline

If Add polyline is active:

- clicking empty canvas adds a vertex from cursor/work-plane placement as before;
- clicking an existing point stratum adds a vertex equal to that point’s position.

### Cubic Bézier

If Add cubic Bézier is active:

- clicking existing point stratum can provide Start, Control point 1, Control point 2, or End, depending on the current draft step;
- the point coordinate is copied.

### 3D polygon sheet

If Add sheet is active:

- clicking existing point stratum adds a sheet draft vertex equal to that point’s position.

## 5. UI behavior for cursor source picking

The user should not need a large new mode if a simple behavior works.

Acceptable implementations:

### Option A: Always allow point-source clicks during creation

In creation modes, if the click target is an existing point stratum, use that point’s coordinate as the next draft point.

If the click target is empty background, use normal cursor/work-plane placement.

### Option B: Add a toggle

Add a toggle such as:

```text
Use existing points when clicked
```

or:

```text
Existing point snapping/source: on/off
```

When enabled, clicking point strata uses their coordinates.

When disabled, creation uses normal cursor placement.

Preferred initial implementation: Option A, if it does not interfere with selection or ordinary creation.

Do not implement broad snapping in this phase.

This is not geometric snapping; it is explicit coordinate-source copy from clicked point strata.

## 6. Work-plane consistency in cursor creation

For 2D:

- clicked point source coordinate should have `z = 0`;
- if somehow nonzero z appears, normalize to `0` or reject consistently with existing 2D behavior.

For 3D:

The current creation tools generally place draft points on the active work plane.

When using an existing point source during cursor creation, choose a clear policy.

Preferred policy:

- Require the clicked existing point to lie on the active work plane within tolerance.
- If it lies on the active plane, copy its coordinate into the draft.
- If it is off-plane, reject it with a concise status message.
- Do not silently project it.

Alternative acceptable policy:

- provide an explicit option to project selected existing point to active work plane;
- projection must be explicit, not silent.

Do not silently project off-plane existing points.

This is especially important for sheet creation, because sheet drafts must remain planar.

## 7. Event handling and selection behavior

Inspect `SvgDiagram` click handling.

The point-source cursor behavior must not break ordinary selection.

Expected:

- In Select mode:
  - clicking a point selects it as before.

- In creation modes:
  - clicking a point may use it as a coordinate source instead of selecting it.
  - this is acceptable and should be documented in UI/report.
  - if a toggle is used, behavior follows the toggle.

Make sure point-source clicks do not get swallowed by geometry handles or selection handlers.

Creation modes should still be able to click point elements.

If geometry handles exist, ensure they do not intercept creation clicks outside Select mode, consistent with Phase 10D fixes.

## 8. Source support in direct creation remains intact

Do not regress direct creation.

Direct creation should still support existing coordinate sources:

- point stratum positions;
- 2D/3D polyline vertices;
- 3D sheet vertices;
- optional cubic Bézier points if already implemented.

The improved labels should apply to direct creation dropdowns/selectors too.

## 9. Tests

Add focused tests.

### Source label tests

Required:

1. Multiple point strata with the same default name `point` produce distinct labels.
2. Point labels include a disambiguator such as short id.
3. Point labels include formatted coordinates.
4. Polyline vertex labels include curve name/id and one-based vertex number.
5. Sheet vertex labels include sheet name/id and one-based vertex number.
6. 2D labels show `(x, y)`.
7. 3D labels show `(x, y, z)`.

If cubic Bézier source labels are implemented, add tests for:

- Start;
- Control point 1;
- Control point 2;
- End.

### Cursor source creation tests

Required:

8. Cursor polyline creation can use an existing point stratum as a vertex source.
9. Cursor cubic Bézier creation can use existing point strata for draft points.
10. Cursor polygon sheet creation can use existing point strata as vertices.
11. The created/draft geometry copies coordinates, not source references.
12. Moving the source point after creation does not change the created curve/sheet.
13. In 2D, copied source point coordinates keep or normalize `z = 0`.
14. In 3D, off-plane point source is rejected in work-plane-constrained creation unless explicit projection is implemented.
15. In Select mode, clicking points still selects them normally.

### Regression tests

Keep existing tests passing for:

- direct existing coordinate source creation;
- plane-local direct creation;
- cursor creation;
- layer filtering;
- undo/redo;
- SVG preview;
- TikZ export.

If App-level cursor tests are too heavy, extract pure helpers for deciding/using clicked coordinate sources and test those helpers. Still ensure the actual UI code calls the helpers.

## 10. Documentation

Update docs briefly.

Mention:

- existing coordinate source labels include name, id, role, and coordinates;
- cursor creation can use existing point strata as coordinate sources;
- source usage is copy-on-create;
- no live linking;
- in 3D, off-plane existing points are rejected unless explicit projection is enabled.

## 11. Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Create several points with default name `point`.
2. Open direct creation source dropdown.
3. Confirm options are distinguishable, not all `Point: point`.
4. Confirm options show id/coordinate information.
5. Create a polyline by direct creation using an existing point source.
6. Confirm created polyline uses copied coordinate.
7. Move the source point.
8. Confirm created polyline does not move.

Cursor creation:

9. Select Add polyline.
10. Click an existing point.
11. Confirm the polyline draft vertex is placed at that point.
12. Finish the polyline.
13. Move the source point.
14. Confirm the finished polyline does not move.

15. Select Add cubic Bézier.
16. Use existing points for at least Start and End.
17. Confirm the curve is created correctly.

18. In 3D, select Add sheet.
19. Click existing points on the active work plane.
20. Confirm the sheet draft uses those points.
21. Try clicking an off-plane point.
22. Confirm it is rejected or explicitly projected only if projection UI exists.

23. Switch to Select mode.
24. Click a point.
25. Confirm it selects the point normally.

## 12. Preserve existing behavior

Do not regress:

- direct coordinate creation;
- direct existing coordinate source creation;
- plane-local direct creation;
- cursor creation on empty canvas;
- layer/filter/selection behavior;
- undo/redo;
- save/load;
- SVG preview;
- TikZ export;
- Phase 9A coordinate names;
- Phase 9B layer-aware output;
- Phase 12G plane-local direct input.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Report after implementation

Please report:

- files modified;
- how coordinate source labels were improved;
- example labels before/after;
- how duplicate default names are disambiguated;
- how cursor creation uses existing point strata;
- which creation tools support point-source cursor input;
- 3D off-plane source policy;
- copy-on-create confirmation;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
