# Phase 13H Implementation Prompt: Camera presets, persistence, and reset policy

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

Define and implement camera persistence and reset policy.

Camera state should be save/load friendly as diagram view metadata, while camera operations should not pollute diagram geometry undo history.

The user must always be able to reset the camera to the initial/default display.

## Prerequisites

Phases 13E-13G are complete.

## Scope

Implement:

- camera presets and naming;
- save/load persistence policy;
- reset-to-initial behavior;
- optional reset-to-saved behavior if helpful;
- validation on import.

Do not implement:

- TikZ camera export; that is Phase 13I;
- perspective projection; that is Phase 13J or later;
- camera animation;
- broad view manager UI.

## Persistence policy

Preferred:

- save camera as diagram-level view metadata, not as a stratum;
- do not store camera in geometry strata;
- validate camera on load;
- if missing, use initial camera;
- if invalid, fall back to initial camera with a warning/status if UI path supports it.

Suggested shape:

```ts
type DiagramViewOptions = {
  camera3d?: Camera3D;
  showCoordinateAxesInTikz?: boolean;
};
```

Adapt to existing data model.

## Undo/redo policy

Camera changes should not create diagram undo entries.

Rationale:

- camera is view state;
- geometry undo should not be polluted by orbit/zoom/pan.

However, geometry edits performed under a camera remain undoable as before.

Required:

- orbit/pan/zoom does not add history entries;
- creating/editing geometry under current camera does add history entries;
- loading a diagram follows existing load undo policy, but camera state is validated.

## Reset behavior

Required controls:

- Reset to initial/default display.

Preferred additional controls:

- Reset to saved camera, if camera is persisted and different from initial;
- Fit to diagram, if existing fit behavior can be camera-compatible.

Reset to initial must always be available regardless of saved camera.

## Tests

Add tests:

1. Camera view metadata serializes if persisted.
2. Missing camera on load defaults to initial.
3. Invalid camera on load rejected/falls back safely.
4. Camera changes do not create undo history entries.
5. Geometry creation under camera does create undo history entries.
6. Reset to initial returns the initial camera.
7. Presets validate.

## Documentation

Update docs:

- camera notation uses tikz-3dplot theta/phi;
- camera is view metadata, not geometry;
- reset-to-initial is always available;
- camera changes do not pollute diagram undo history;
- TikZ export alignment comes in Phase 13I.

## Preserve existing behavior

Do not regress:

- save/load diagrams without camera;
- undo/redo geometry;
- camera controls;
- camera-aware creation;
- SVG preview;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- persistence policy;
- data shape if added;
- load validation behavior;
- undo/redo policy;
- reset behavior;
- presets;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
