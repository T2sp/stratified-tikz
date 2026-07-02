# Phase 27 Fix Prompt: Enable coordinate-anchor picking in Add point, Add label, and arc-segment cursor input

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

Phase 27F is complete.

Coordinate anchors are already implemented as global TikZ `\coordinate` anchors, distinct from visible point strata.

Expected behavior:

- Coordinate anchors are visible in the Preview when `Coordinates: Show` is enabled.
- Coordinate anchors are shown as preview-only markers.
- Coordinate anchors have high hit-test priority over layer-bound geometry.
- Coordinate anchors can be used by direct input to create anchored paths/points/labels where supported.
- Coordinate references export as readable TikZ `(tikzName)` references where supported.
- Unsupported coordinate-ref locations should be rejected explicitly, not silently numericized.

Current bug:

- During cursor input, coordinate anchors cannot be selected as input targets for:
  - `Add point`;
  - `Add label`;
  - `Add path` arc segment cursor input.
- As a result, users cannot create:
  - a visible point anchored to an existing coordinate anchor;
  - a label anchored to an existing coordinate anchor;
  - an arc segment whose supported cursor-picked endpoint/control field is anchored to an existing coordinate anchor.
- Direct input works, so the missing piece is cursor-input target propagation.

This is similar to the earlier Add path cursor-anchor issue: Preview hit testing may resolve a coordinate marker to a numeric `Vec3` but fail to pass through the coordinate anchor identity.

## Goal

Fix cursor input so clicking a coordinate anchor marker creates a `coordinateRef` source for supported fields in:

1. `Add point`;
2. `Add label`;
3. `Add path` arc segment cursor workflow.

Required behavior:

- If `Coordinates: Show` is enabled and the user clicks a coordinate marker during one of these cursor workflows, the created field should use a `coordinateRef` to that coordinate anchor when the field supports coordinate refs.
- Moving the coordinate anchor later should move the anchored visible point / label / supported arc endpoint in Preview.
- TikZ output should preserve `(tikzName)` references where the exporter supports them.
- If the cursor workflow step corresponds to a field where coordinate refs are not supported, show a clear status/error and do not silently create a numeric copy.
- Existing background-click cursor creation should continue to create ordinary numeric/global/work-plane-local coordinates.
- Existing direct input behavior must remain unchanged.

## Scope

This is a targeted cursor-input coordinate-anchor picking fix.

Implement:

- target-aware Preview click payloads for Add point, Add label, and arc segment cursor input;
- coordinateRef creation for supported point/label/arc cursor fields;
- UI/status behavior for unsupported arc fields;
- tests.

Do not implement:

- new coordinateRef-supported fields unless TikZ export preserves them;
- new coordinate anchor model features;
- broad path editor rewrite;
- new arc geometry/export semantics unless necessary;
- new UI palettes;
- new dependencies.

Do not change:

- direct input coordinateRef behavior;
- Add path arbitrary/line/polyline coordinateRef behavior that already works;
- coordinate anchor show/hide behavior;
- coordinate deletion/detach behavior;
- layer translation detach behavior;
- coordinate multi-selection/translation behavior;
- unsupported coordinateRef validation policy;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect cursor click flow and coordinate-anchor hit testing

Inspect:

- `src/rendering/SvgDiagram.tsx`;
- `src/rendering/svgHitTesting.ts`;
- `src/App.tsx`;
- `src/ui/diagramUpdates.ts`;
- Add point cursor creation handlers;
- Add label cursor creation handlers;
- Add path / arbitrary path / arc segment cursor workflow handlers;
- coordinate anchor marker click/hit-test code;
- direct input coordinateRef creation helpers;
- existing Add path cursor coordinate-anchor fix if already implemented.

Find where Add point/Add label/arc cursor creation currently receives only a resolved `Vec3` rather than a hit target such as:

```ts
{ kind: "coordinateAnchor"; id: string }
```

The likely bug pattern is:

```text
coordinate marker click
    -> resolved preview point
    -> ordinary numeric point/label/arc coordinate
```

It should become:

```text
coordinate marker click
    -> coordinate anchor id + current preview
    -> coordinateRef source where supported
```

## 2. Preserve clicked target identity in cursor creation

The cursor creation handlers need to know when the click target was a coordinate anchor.

Suggested payload:

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
  | ...
```

or minimally:

```ts
handlePreviewCreationClick(point, {
  coordinateAnchorId?: string;
  hitTargetKind?: "coordinateAnchor" | ...
});
```

Requirements:

- coordinate marker hit-test result includes coordinate anchor id;
- Add point/Add label/arc cursor handlers receive this identity;
- coordinate markers obey `Coordinates: Show/Hide`;
- hidden coordinate anchors do not produce target payloads;
- ordinary background clicks continue working.

## 3. Add point cursor behavior

When active tool is `Add point` in cursor mode:

### Clicking a coordinate anchor

Create a visible point stratum whose position source is a coordinateRef to the clicked coordinate anchor.

Expected model behavior:

```ts
point.position = {
  kind: "coordinateRef",
  coordinateId: "coord-a",
  preview: currentAnchorPreview
}
```

or the project’s equivalent coordinate source shape.

Expected TikZ behavior:

- coordinate anchor definition appears before drawing commands;
- visible point position uses `(A)` or equivalent coordinateRef-preserving output where point export supports it.

Expected Preview behavior:

- moving coordinate anchor moves the visible point;
- deleting coordinate anchor detaches point position through existing detach behavior.

### Clicking background

Preserve existing behavior:

- create point at cursor position;
- apply cursor snap;
- use numeric/global/work-plane-local cursor coordinate as currently implemented.

### Clicking visible point stratum

Preserve existing behavior. Do not confuse point strata with coordinate anchors.

## 4. Add label cursor behavior

When active tool is `Add label` in cursor mode:

### Clicking a coordinate anchor

Create a label whose position source is a coordinateRef to the clicked coordinate anchor.

Expected behavior:

- moving the coordinate anchor moves the label in Preview;
- TikZ output uses:

```tex
\node at (A) {...};
```

or equivalent coordinateRef-preserving label output.

### Clicking background

Preserve existing behavior.

### Clicking ordinary point/geometry

Preserve existing behavior.

## 5. Arc segment cursor behavior

The arc cursor workflow may involve several picked points, depending on the current implementation.

Examples might include:

- start point;
- end point;
- center point;
- control/through point;
- radius/angle interaction;
- frame/work-plane point.

CoordinateRef support must match TikZ preservation.

### Supported arc cursor fields

For arc fields whose TikZ export preserves coordinate refs, clicking a coordinate anchor should store a `coordinateRef`.

Likely supported:

- arc start endpoint, if exported as a coordinate;
- arc end endpoint, if exported as a coordinate.

### Unsupported arc cursor fields

Known prior Phase 26C policy may reject:

- arc center coordinateRef, because 2D arc TikZ emits start/end/radius/angles and 3D arcs may be numeric cubic approximations;
- template center coordinateRef, if not export-preserved.

If a cursor step corresponds to an unsupported arc center or derived field:

- do not silently create a numeric copy when the user clicked a coordinate anchor;
- show a clear status/error:

```text
Coordinate anchors are not supported for arc centers because TikZ export cannot preserve the reference.
```

or equivalent.

### Required

- At minimum, coordinate anchors should be usable for supported arc endpoints.
- Unsupported arc fields should be rejected explicitly.

## 6. Reuse direct input helpers

Direct input already creates anchored point/label/path fields correctly.

Where possible, reuse the same helper that converts an existing coordinate anchor selection into a coordinateRef source.

Suggested helper concept:

```ts
coordinateRefSourceFromAnchor(diagram, coordinateId): CoordinateSource
```

or:

```ts
makeCoordinateReferencePointFromAnchor(...)
```

Requirements:

- uses current anchor preview;
- validates anchor exists;
- deep-copies needed metadata;
- does not use stale stored click preview if the anchor moved;
- returns a finite preview.

## 7. Cursor snap interaction

Policy:

```text
coordinate anchor click:
  creates coordinateRef
  cursor snap does not alter the coordinateRef source

background cursor click:
  creates ordinary coordinate
  cursor snap applies as before
```

Reason:

- coordinate anchor already has its own position;
- snapping should not detach or alter the reference.

Add tests.

## 8. Show/hide and selection-cycling interaction

Coordinate anchor marker picking should only occur when:

```text
Coordinates: Show
```

When hidden:

- marker not rendered;
- marker not hit-testable;
- Add point/Add label/arc cursor input should treat the click as background or underlying geometry according to normal hit testing.

If selection cycling is active:

- Alt/Option-click cycling should not interfere with Add point/Add label/arc creation unless cycling is intentionally enabled in creation modes.
- Normal creation click on a coordinate anchor should create coordinateRef.

Document any modifier conflicts.

## 9. Validation and export postconditions

After cursor creation using coordinate anchors:

- `validateDiagram(...)` should pass;
- save/load should preserve coordinateRef source;
- Preview should resolve coordinateRef from current anchor;
- TikZ should preserve `(tikzName)` for supported fields;
- inline output has no blank lines;
- no generated helper numeric coordinates should replace the ref unless explicitly unsupported and rejected.

## 10. Tests

Add focused regression tests.

### Add point cursor tests

1. With Coordinates shown, Add point cursor click on coordinate anchor creates point position as coordinateRef.

2. Moving coordinate anchor updates point Preview/resolved position.

3. TikZ point output uses `(A)` reference or existing coordinateRef-preserving point syntax.

4. Background Add point cursor click still creates ordinary numeric/work-plane-local point and uses snap.

5. Coordinate anchor click ignores snap and preserves ref.

6. With Coordinates hidden, Add point cursor click does not create coordinateRef.

### Add label cursor tests

7. With Coordinates shown, Add label cursor click on coordinate anchor creates label position as coordinateRef.

8. Moving coordinate anchor updates label Preview/resolved position.

9. TikZ label output uses `(A)` reference.

10. Background Add label cursor click still creates ordinary numeric/work-plane-local label.

11. Coordinate anchor click ignores snap and preserves ref.

12. With Coordinates hidden, Add label cursor click does not create coordinateRef.

### Arc segment cursor tests

13. Arc segment cursor start endpoint can use coordinateRef when clicking coordinate anchor, if start endpoint is supported.

14. Arc segment cursor end endpoint can use coordinateRef when clicking coordinate anchor, if end endpoint is supported.

15. TikZ output for supported arc endpoint refs preserves `(A)` / `(B)`.

16. If cursor step is an unsupported arc center and the user clicks a coordinate anchor, operation is rejected with clear status and does not silently numericize.

17. Save/load of supported arc endpoint refs round-trips.

18. Validation rejects unsupported arc coordinateRef locations.

### Integration tests

19. Direct input anchored point/label/path still works.

20. Ordinary Add path cursor coordinate-anchor behavior still works if previously fixed.

21. Coordinate deletion detaches newly cursor-created point/label/arc refs.

22. Layer translation detaches newly cursor-created refs in layer-bound elements.

23. Coordinate multi-translation moves anchors and cursor-created refs remain live.

24. Inline output has no blank lines.

25. 4-space indentation preserved.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

### Add point

1. Add coordinate anchor `A`.
2. Turn on `Coordinates: Show`.
3. Select Add point cursor mode.
4. Click coordinate marker `A`.
5. Move `A`.
6. Confirm visible point follows.
7. Generate TikZ and confirm point uses `(A)`.

### Add label

8. Select Add label cursor mode.
9. Click coordinate marker `A`.
10. Move `A`.
11. Confirm label follows.
12. Generate TikZ and confirm label uses `(A)`.

### Arc

13. Select Add path / Arbitrary path arc segment workflow.
14. Use coordinate anchor `A` as a supported arc endpoint.
15. Use coordinate anchor `B` as another supported arc endpoint.
16. Confirm model/export preserve refs where supported.
17. Try clicking coordinate anchor for unsupported arc center if UI exposes it.
18. Confirm clear rejection/status rather than silent numeric fallback.

## 12. Preserve existing behavior

Do not regress:

- Add coordinate;
- coordinate marker show/hide;
- coordinate selection/multi-selection;
- direct input coordinateRef creation;
- Add path cursor coordinateRef creation that already works;
- numeric cursor creation;
- cursor snap for background clicks;
- coordinate deletion/detach;
- layer translation detach;
- coordinate multi-translation;
- path arrows/braiding;
- path inline nodes/splitting;
- save/load;
- undo/redo;
- TikZ export;
- inline no-blank-lines.

## 13. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## 14. Report after implementation

Please report:

- files modified;
- root cause of coordinate marker clicks becoming numeric in Add point/Add label/arc cursor mode;
- how coordinate target identity is passed to cursor creation handlers;
- Add point cursor coordinateRef behavior;
- Add label cursor coordinateRef behavior;
- arc cursor coordinateRef support/rejection policy;
- snap interaction;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
