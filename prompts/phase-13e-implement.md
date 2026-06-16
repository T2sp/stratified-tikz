# Phase 13E Implementation Prompt: TikZ-3dplot-compatible orthographic camera model

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

Introduce a 3D camera/view model for SVG preview using notation aligned with `tikz-3dplot`.

Use the `tikz-3dplot` main-coordinate notation:

```tex
\tdplotsetmaincoords{theta}{phi}
```

where the UI/model should refer to the angles as:

- `thetaDeg`, matching `tikz-3dplot`'s first argument;
- `phiDeg`, matching `tikz-3dplot`'s second argument.

Do not use ambiguous `yaw` / `pitch` labels as the primary user-facing notation. If internal helpers need other names, keep the public/UI notation clearly aligned with `theta` and `phi`.

This subphase should introduce the camera model and projection helpers, while preserving the current initial view as a resettable camera preset.

## Scope

Implement:

- an orthographic 3D camera/view model;
- projection helpers using `thetaDeg` and `phiDeg`;
- inverse projection / screen-ray helpers sufficient for later cursor creation work;
- a named initial camera equal to the current pre-camera display;
- a pure reset-to-initial helper.

Do not implement yet:

- camera UI controls; that is Phase 13F;
- camera-aware cursor creation; that is Phase 13G;
- save/load of camera state; that is Phase 13H;
- TikZ camera export; that is Phase 13I;
- perspective projection; that is Phase 13J or later;
- full 3D camera orbit UI;
- new geometry features.

## Camera model

Add a model such as:

```ts
type Camera3D = {
  kind: "orthographic";
  thetaDeg: number;
  phiDeg: number;
  zoom: number;
  pan: { x: number; y: number };
};
```

Equivalent shape is fine, but it must include:

- `thetaDeg`;
- `phiDeg`;
- `zoom`;
- 2D pan offset.

Add a constant or function for the initial camera:

```ts
const INITIAL_CAMERA_3D: Camera3D = ...
```

or:

```ts
createInitialCamera3D(): Camera3D
```

The initial camera must reproduce the current SVG 3D display as closely as possible.

Users must always be able to reset the camera to this initial/current display later.

## Projection helpers

Add pure helpers, preferably under `src/geometry/` or `src/rendering/`.

Required helpers or equivalents:

- `validateCamera3D(camera)`;
- `cameraBasisFromTikz3dplotAngles(thetaDeg, phiDeg)`;
- `projectVec3WithCamera(point, camera)`;
- `screenRayFromCameraPoint(screenPoint, camera, viewportOrProjectionInfo)`;
- `intersectCameraRayWithWorkPlane(ray, workPlane)`;
- `resetCameraToInitial()` or equivalent;
- `fitCameraToDiagram(...)` if current fit-to-view logic needs adaptation.

The implementation should preserve a clean conceptual pipeline:

```text
model-space point
→ camera projection
→ screen/SVG point
```

and for inverse operations:

```text
screen/SVG point
→ camera ray or equivalent orthographic inverse
→ intersection with active model-space work plane
→ model-space Vec3
```

Even if the current projection is simple, structure helpers so future perspective projection can replace the screen-ray computation.

## Validation

Camera values must be finite.

Required:

- reject or safely normalize non-finite `thetaDeg`;
- reject or safely normalize non-finite `phiDeg`;
- reject non-finite `zoom`;
- reject `zoom <= 0`;
- reject non-finite pan values;
- projection helpers must not emit `NaN` or infinite screen coordinates for finite valid inputs.

## Preserve existing SVG output

This subphase should not visually change diagrams, except for very small numeric differences.

Required:

- current 3D examples render as before using the initial camera;
- 2D rendering remains unchanged;
- axes/work-plane guides still render;
- selected highlights still render.

## Tests

Add focused tests:

1. Initial camera exists and validates.
2. Initial camera reproduces current 3D projection convention as closely as practical.
3. `thetaDeg` / `phiDeg` finite values produce finite basis vectors.
4. Camera basis is orthonormal or otherwise consistently validated.
5. Projection of finite Vec3 with valid camera produces finite Vec2.
6. Invalid camera values are rejected:
   - `thetaDeg = NaN`;
   - `phiDeg = Infinity`;
   - `zoom = 0`;
   - `zoom < 0`;
   - `pan.x = NaN`.
7. Reset helper returns the initial camera.
8. Axis-aligned/custom work-plane helpers still work.
9. Existing projection tests are updated but not weakened.

## Documentation

Update docs briefly:

- camera notation follows `tikz-3dplot`'s `theta` / `phi` convention;
- initial camera equals the previous/default display;
- reset-to-initial must always be possible;
- camera is separate from work-plane model geometry.

## Preserve existing behavior

Do not regress:

- 2D preview;
- 3D preview;
- work-plane preview;
- cursor/direct creation;
- drag editing;
- save/load;
- undo/redo;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- Camera3D model shape;
- initial camera values;
- how the initial camera matches previous display;
- projection helpers added;
- validation behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
