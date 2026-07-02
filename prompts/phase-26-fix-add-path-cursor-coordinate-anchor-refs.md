# Phase 26/27 Fix Prompt: Preserve coordinateRef when Add path cursor input clicks coordinate anchors

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

## Context

You are working on the StratifiedTikZ project.

Phase 26 introduced global TikZ coordinate anchors.

Current expected behavior:

- `Add coordinate` creates a coordinate anchor, distinct from visible point strata.
- Coordinate anchors export as global `\coordinate` definitions.
- Coordinate anchors can be referenced from supported geometry fields by `coordinateRef`.
- Direct input for path creation can select an existing coordinate anchor and correctly creates anchored path endpoints.
- Anchored path endpoints should export as `(tikzName)` references, for example:

```tex
\coordinate (A) at (...);
\coordinate (B) at (...);
\draw (A) -- (B);
```

Current bug:

- `Add coordinate` works.
- `Add path` direct input with existing coordinate anchors works and creates anchored paths.
- But `Add path` cursor input does **not** create anchored paths when the user clicks a coordinate marker in the Preview.
- Instead, clicking a coordinate marker during cursor path creation appears to use/copy the coordinate anchor's current numeric preview point.
- TikZ then exports numeric coordinates or generated helper coordinates rather than `(A)`.
- Moving the coordinate anchor later does not keep the path endpoint live-linked, or the TikZ source does not preserve the reference.

This is inconsistent with direct input and with the intended coordinate anchor workflow.

## Goal

Fix Add path cursor input so clicking a coordinate anchor marker creates a `coordinateRef` endpoint/control point whenever the clicked target is a coordinate anchor and the destination field supports coordinate references.

Required behavior:

1. In Add path cursor mode, clicking a coordinate marker should create a path coordinate source of kind `coordinateRef`.
2. The path endpoint/control should remain anchored to the coordinate anchor.
3. Moving the coordinate anchor later should move the referenced path endpoint in Preview.
4. TikZ output should use `(tikzName)` for the endpoint/control where supported.
5. Direct input behavior should remain unchanged.
6. Clicking the background should still create an ordinary numeric/symbolic preview coordinate as before.
7. Clicking ordinary point strata should preserve existing behavior.
8. Coordinate show/hide behavior should be respected:
   - when coordinates are shown, coordinate markers are clickable and should create refs;
   - when coordinates are hidden, they should not be hit-test targets.
9. Coordinate anchor hit-test priority should remain above layer-bound geometry when coordinates are shown.
10. Add tests covering cursor-created anchored paths.

## Scope

This is a targeted coordinateRef/path cursor input fix.

Implement:

- coordinate-target-aware cursor path creation;
- propagation of clicked coordinate anchor target identity from SVG hit testing into path creation logic;
- coordinateRef creation for supported path fields;
- tests for cursor-created anchored path endpoints and controls where applicable.

Do not implement:

- new coordinate anchor model behavior;
- new coordinateRef-supported fields;
- broad path editor rewrite;
- new selection-cycling behavior unless needed for this bug;
- new UI palettes;
- new dependencies.

Do not change:

- direct input coordinateRef creation;
- coordinate anchor TikZ export;
- unsupported coordinateRef field validation;
- coordinate deletion/detach behavior;
- layer translation detach behavior;
- path geometry semantics except preserving refs from cursor coordinate clicks;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect current Add path cursor creation flow

Inspect the code paths for:

- SVG/PGF Preview hit testing;
- coordinate marker rendering and click handling;
- Add path / Arbitrary path cursor creation;
- click-to-add path vertex logic;
- line/manual/arbitrary path segment creation;
- cubic Bézier cursor creation;
- arc segment cursor creation;
- coordinateRef creation helpers used by direct input;
- coordinate show/hide and hit-test priority.

Likely files may include:

- `src/App.tsx`;
- `src/rendering/SvgDiagram.tsx`;
- `src/ui/...`;
- `src/model/coordinateReferences.ts`;
- `src/ui/diagramUpdates.ts`;
- path creation helper files.

Find where cursor path creation currently receives only a resolved `Vec3`/preview point instead of the clicked target identity.

The likely bug is:

```text
coordinate marker click -> resolved preview point -> path vertex numeric coordinate
```

It should be:

```text
coordinate marker click -> coordinate anchor target id -> coordinateRef coordinate source
```

when the current path field supports coordinateRef.

## 2. Preserve hit target identity

The cursor path creation handler needs to know whether the click came from:

```ts
{ kind: "coordinateAnchor"; id: string }
```

or from blank canvas / other geometry.

If the current `onCanvasClick` only receives a projected/global point, extend or add a path for target-aware clicks.

Suggested event payload:

```ts
type PreviewCreationClick =
  | {
      kind: "canvas";
      point: Vec3;
      workPlaneLocal?: ...
    }
  | {
      kind: "coordinateAnchor";
      coordinateId: string;
      point: Vec3;
    }
  | {
      kind: "pointStratum";
      id: string;
      point: Vec3;
    }
  | ...;
```

Or minimally:

```ts
handlePreviewCreationClick(point, { coordinateAnchorId?: string })
```

Requirements:

- coordinate marker clicks carry coordinate id into creation logic;
- background clicks keep existing coordinate creation behavior;
- overlay/control clicks still stop propagation;
- existing selection/hit testing remains intact.

## 3. Create coordinateRef source for supported path fields

When Add path cursor creation consumes a clicked coordinate anchor:

- create a coordinate source/reference:

```ts
{
  kind: "coordinateRef",
  coordinateId: clickedCoordinateId,
  preview: currentAnchorPreview
}
```

or the project’s existing `coordinateRef` shape.

Use existing direct input helper if available.

Do not copy numeric coordinates unless coordinateRef is unsupported for the field.

For supported fields:

- line/manual/arbitrary path endpoint: coordinateRef;
- polyline vertex: coordinateRef;
- cubic Bézier start/end/control points, if supported and TikZ-preserved;
- any other path field currently accepted by validation/export as coordinateRef.

For unsupported fields:

- either ignore coordinate anchor as a coordinateRef target and use numeric point only with a clear status; or
- reject the click with a clear status.

Preferred:

- if the field is unsupported, show a status such as:

```text
Coordinate anchors cannot be used for this path parameter.
```

Do not silently create a numeric coordinate if the user clicked a coordinate anchor expecting anchoring, unless existing UX strongly prefers fallback. Silent numeric fallback is the bug pattern.

## 4. Add path / Arbitrary path behavior

The path palette item may be named:

```text
Arbitrary path
```

or still:

```text
Line/manual path
```

depending on current branch.

This fix should apply to the active Add path cursor creation mode regardless of the visible label.

Expected workflow:

1. `Coordinates: Show`.
2. User selects Add path / Arbitrary path cursor mode.
3. User clicks coordinate anchor `A`.
4. User clicks coordinate anchor `B`.
5. User finishes path.
6. The model stores endpoints as coordinateRefs to `A` and `B`.
7. TikZ exports:

```tex
\coordinate (A) at (...);
\coordinate (B) at (...);
\draw (A) -- (B);
```

## 5. Preview behavior after creation

After creating an anchored path:

- moving coordinate `A` should update the path endpoint in Preview;
- hide/show coordinates should not affect the path geometry;
- deleting coordinate `A` should detach references using existing detach behavior;
- layer translation of the path should detach refs according to existing Phase 26 policy.

Do not add special-case geometry copies that break these behaviors.

## 6. Coordinate selection vs Add path creation

When the active mode is Select:

- clicking a coordinate marker selects the coordinate anchor.

When the active mode is Add path cursor creation:

- clicking a coordinate marker should add a coordinateRef path point, not select the coordinate, unless selection cycling/modifier explicitly says otherwise.

Ensure the current mode is respected.

Modifier keys:

- Shift-click in Select may multi-select coordinates.
- In Add path mode, Shift-click should preserve existing path creation modifier behavior if any.
- Do not accidentally toggle coordinate selection while adding a path.

## 7. Existing point-stratum behavior

If the user clicks a visible point stratum during Add path cursor input, preserve existing behavior.

If existing behavior was to copy the point's coordinates or create a point reference-like source, keep it.

Do not confuse coordinate anchors with point strata.

Coordinate anchors are the only ones that should produce `coordinateRef` to TikZ `\coordinate` anchors.

## 8. Tests

Add focused regression tests.

### Model/creation helper tests

1. Add path cursor click on coordinate anchor creates a `coordinateRef` endpoint.

2. Two coordinate anchor clicks create a path with both endpoints as coordinateRefs.

3. Background click still creates a numeric/global/work-plane-local coordinate source as before.

4. Clicking a point stratum preserves existing behavior and does not create coordinate anchor ref.

5. Unsupported coordinateRef field click is rejected or clearly falls back according to chosen policy.

### SVG/interaction tests if practical

6. When `Coordinates: Show`, coordinate marker click in Add path mode passes coordinate id to path creation.

7. When `Coordinates: Hide`, coordinate marker is not hit-testable and cannot create a coordinateRef by click.

8. Coordinate marker hit-test priority over paths/sheets is preserved in Add path mode.

### TikZ tests

9. Cursor-created path from coordinate anchors exports `(A) -- (B)`.

10. Coordinate definitions appear before the path.

11. Inline output has no blank lines.

12. 4-space indentation preserved.

13. Moving coordinate anchor after path creation changes preview and TikZ coordinate definition, while the path still uses `(A)`.

### Regression tests

14. Direct input anchored path still works.

15. Normal numeric cursor-created path still exports numeric coordinates.

16. Coordinate deletion detaches cursor-created path refs.

17. Layer translation detaches cursor-created path refs.

18. Coordinate multi-selection/translation keeps cursor-created path refs live.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Add coordinate anchors `A` and `B`.
2. Turn on `Coordinates: Show`.
3. Select Add path / Arbitrary path cursor mode.
4. Click coordinate marker `A`.
5. Click coordinate marker `B`.
6. Finish the path.
7. Generate TikZ.
8. Confirm output contains:

```tex
\coordinate (A) at (...);
\coordinate (B) at (...);
\draw (A) -- (B);
```

or equivalent path command using `(A)` and `(B)`.

9. Move coordinate `A`.
10. Confirm path endpoint follows `A` in Preview.
11. Confirm TikZ path still uses `(A)`.
12. Hide coordinates and create another path by clicking background; confirm no coordinateRef is created accidentally.

## 10. Preserve existing behavior

Do not regress:

- Add coordinate creation;
- coordinate marker show/hide;
- coordinate selection/multi-selection;
- direct input coordinateRef path creation;
- numeric cursor path creation;
- point-stratum click behavior;
- coordinate deletion/detach;
- layer translation detach;
- coordinate multi-translation;
- path arrows/braiding;
- path splitting/inline nodes if implemented;
- save/load;
- undo/redo;
- TikZ export;
- inline no-blank-lines.

## 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 12. Report after implementation

Please report:

- files modified;
- root cause of cursor coordinate marker clicks becoming numeric;
- how coordinate target identity is propagated;
- coordinateRef creation helper used;
- supported path fields for cursor coordinate anchors;
- unsupported-field behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
