# Phase 13F Implementation Prompt: Camera controls UI and reset

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

Add user-facing 3D camera controls.

The controls should use `tikz-3dplot`-aligned notation:

- `theta`;
- `phi`.

The user must always be able to reset the camera to the initial/default display, which should match the pre-camera display from earlier phases.

## Prerequisites

Phase 13E is complete.

## Scope

Implement:

- camera controls UI;
- reset-to-initial camera button;
- fit/reset helpers if already available;
- camera presets.

Do not implement yet:

- camera-aware cursor creation; that is Phase 13G;
- camera save/load persistence; that is Phase 13H;
- TikZ camera export; that is Phase 13I;
- perspective projection; that is Phase 13J or later;
- broad UI redesign.

## Required UI controls

Add a camera section in the UI, preferably compact/collapsible.

Suggested UI:

```text
Camera ▸
  theta: [70]
  phi:   [110]
  zoom:  [1.0]
  pan x: [0]
  pan y: [0]
  [Reset to initial]
  [Fit]
  Preset: [initial / top / front / side / isometric]
```

Requirements:

- 3D diagrams show camera controls;
- 2D diagrams hide or disable camera controls;
- numeric inputs validate finite values;
- zoom must be positive;
- reset-to-initial is always available;
- changing camera updates SVG preview;
- camera changes do not modify committed geometry;
- camera changes do not affect TikZ output yet;
- camera changes do not create diagram undo history entries unless an editor-view history already exists.

## Presets

Add simple presets:

- initial/default;
- top;
- front;
- side;
- isometric.

Presets should be expressed in `thetaDeg` / `phiDeg` notation.

The initial preset must be the old/default display.

## Mouse or keyboard controls

Optional in this subphase.

If implemented, keep them simple:

- drag with modifier to orbit;
- wheel to zoom;
- reset button still available.

Do not break existing creation/selection clicks.

If mouse controls are not implemented, report the limitation.

## Tests

Add tests where practical:

1. Camera UI state updates camera values.
2. Invalid theta/phi/zoom/pan input rejected.
3. Zoom cannot become zero or negative.
4. Reset returns initial camera.
5. Presets produce valid camera states.
6. Camera changes do not mutate diagram data.
7. Camera changes do not create diagram undo entries if testable.
8. 2D mode hides/disables camera controls if helper-testable.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open 3D example.
2. Change theta.
3. Preview changes.
4. Change phi.
5. Preview changes.
6. Zoom in/out.
7. Pan.
8. Click Reset to initial.
9. Display returns to previous/default arrangement.
10. Switch presets.
11. Switch to 2D.
12. Camera controls hidden/disabled.
13. Creation/selection still works.

## Preserve existing behavior

Do not regress:

- inspector layout;
- work-plane toolbar;
- axes guide;
- cursor/direct creation;
- selection;
- layer filtering;
- save/load;
- undo/redo;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- camera UI location;
- theta/phi notation used;
- reset behavior;
- presets added;
- validation behavior;
- whether mouse controls were implemented;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
