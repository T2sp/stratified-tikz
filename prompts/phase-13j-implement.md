# Phase 13J Implementation Prompt: Perspective projection placeholder and camera hardening

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

Prepare the camera system for future perspective projection while keeping the current production camera orthographic.

This subphase should not force a full perspective implementation unless it is small and safe. It should harden abstractions so a future perspective camera can be added without rewriting work-plane picking, SVG projection, or TikZ export.

## Prerequisites

Phases 13E-13I are complete.

## Scope

Implement:

- camera type abstraction for orthographic now and perspective later;
- clear unsupported/disabled state for perspective UI if exposed;
- tests ensuring orthographic behavior remains stable.

Optional:

- a hidden/internal `PerspectiveCamera3D` type scaffold without UI;
- documentation of future perspective policy.

Do not implement unless clearly safe:

- full perspective rendering;
- perspective picking;
- perspective TikZ export;
- depth sorting overhaul.

## Required behavior

If a camera kind/type is introduced:

```ts
type Camera3D =
  | OrthographicCamera3D
  | PerspectiveCamera3D;
```

then:

- orthographic remains the only fully supported kind;
- perspective, if present, is validated but not enabled in UI unless functional;
- unsupported perspective operations fail clearly, not silently;
- existing orthographic SVG/TikZ output remains unchanged.

If no perspective type is introduced, at least document and test that the camera helpers are structured so perspective can be added later.

## Work-plane picking abstraction

Ensure helpers are ready for:

```text
screen point
→ camera ray
→ work-plane intersection
```

Orthographic currently uses parallel rays.

Future perspective should be able to use rays from camera origin through screen point.

Do not implement full perspective intersection unless ready.

## TikZ export policy

TikZ export currently uses tikz-3dplot theta/phi orthographic-like view.

Perspective TikZ export is out of scope.

Document:

- current TikZ export is tikz-3dplot-compatible orientation, not perspective;
- future perspective export may require different TikZ/PGF settings or fallback.

## Tests

Add tests if code changes:

1. Orthographic camera behavior unchanged.
2. Unsupported perspective camera, if present, is rejected or disabled.
3. Camera validation differentiates supported/unsupported kinds.
4. Work-plane picking helpers remain orthographic-compatible.
5. TikZ export still uses orthographic theta/phi.

## Documentation

Update docs:

- current camera is orthographic;
- tikz-3dplot theta/phi notation is used;
- perspective projection is future work;
- reset-to-initial remains available.

## Preserve existing behavior

Do not regress:

- SVG preview;
- camera controls;
- camera-aware creation;
- TikZ camera export;
- work-plane behavior;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- whether perspective type scaffold was added;
- how unsupported perspective is handled;
- how orthographic behavior was preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
