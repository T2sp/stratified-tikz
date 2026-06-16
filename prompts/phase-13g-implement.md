# Phase 13G Implementation Prompt: Camera-aware creation, picking, and drag editing

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

Phase 12 is complete. The app supports:

- 2D and 3D diagrams;
- axis-aligned and custom work planes;
- cursor creation and direct creation;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Camera/view state is editor/view state unless explicitly persisted as diagram view options.
- Camera/view state is not a stratum.
- Work planes remain model-space geometry.
- Projection/camera and work planes must remain separate concerns.
- Generated TikZ must remain readable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve Phase 12 work-plane behavior.


## Goal

Make cursor creation, point picking, and drag editing camera-aware.

After Phase 13E/F, SVG preview can be rendered with a camera. Any operation that maps a screen/SVG position back to model space must use the camera-aware inverse pipeline.

Required conceptual pipeline:

```text
screen/SVG point
→ camera ray or orthographic inverse
→ intersection with active model-space work plane
→ model-space Vec3
```

## Prerequisites

Phases 13E and 13F are complete.

## Scope

Implement camera-aware inverse mapping for editing interactions.

Do not implement:

- TikZ camera export; that is Phase 13I;
- perspective projection; that is Phase 13J or later;
- new creation tools;
- new work-plane features.

## Required update targets

Update all cursor interactions that depend on screen-to-model conversion:

- cursor-created point;
- cursor-created label;
- polyline draft vertices;
- cubic Bézier draft points;
- polygon sheet draft vertices;
- drag handles;
- Pick 3 points for work plane if it uses screen positions;
- existing point source cursor clicks if needed;
- coordinate source highlighting if projection-dependent.

## Work-plane intersection

The active work plane is model-space geometry.

When the user clicks in the SVG preview:

1. map DOM pointer to SVG/viewBox coordinate using existing corrected mapping;
2. convert SVG coordinate to a camera ray or orthographic inverse representation;
3. intersect with active work plane;
4. use the intersection `Vec3`.

If the ray is parallel to the work plane or no intersection exists:

- reject the operation safely;
- show a concise status message if appropriate;
- do not create invalid geometry.

## Drag editing

Drag editing must use the camera-aware inverse mapping.

Expected:

- 2D drag behavior remains unchanged;
- 3D drag handles use active work plane and current camera;
- dragging after camera orbit still moves the point/vertex on the intended work plane;
- no `NaN` coordinates created.

Drag grouping for undo/redo should remain as before.

## Tests

Add focused tests:

1. With initial camera, cursor placement matches previous behavior.
2. With changed theta/phi, screen-to-model on active work plane returns points on that plane.
3. Camera-aware point creation creates a point on active work plane.
4. Camera-aware polyline/cubic/sheet draft points lie on active work plane.
5. Camera-aware drag update lies on active work plane.
6. Ray parallel/no-intersection case is rejected safely if possible.
7. 2D behavior unchanged.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open 3D.
2. Change camera theta/phi.
3. Create point on xy plane.
4. Confirm point appears where clicked and lies on xy plane.
5. Create polyline after camera change.
6. Create cubic Bézier after camera change.
7. Create sheet after camera change.
8. Drag an existing vertex after camera change.
9. Confirm geometry remains finite and on intended work plane.
10. Reset camera and confirm operations still work.

## Preserve existing behavior

Do not regress:

- 2D creation/editing;
- axis-aligned and custom work planes;
- camera controls;
- undo/redo;
- selection;
- layer filtering;
- TikZ output;
- save/load.

## Report after implementation

Please report:

- files modified;
- screen-to-model pipeline used;
- how camera ray/intersection works;
- updated interaction paths;
- no-intersection behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
