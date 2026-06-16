# Phase 12F Implementation Prompt: Camera-ready projection/export separation

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

- An n-stratum means codimension n, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Generated TikZ should not depend on transient active UI state.
- Existing axis-aligned 3D work planes (`xy`, `xz`, `yz`) must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.


## Goal

Harden the separation between model-space work planes, projection/camera, diagram data, save/load, undo/redo, and TikZ export.

## Prerequisite

Phases 12A-12E are complete.

## Scope

This is a hardening/refactor subphase.

Do not implement:

- full 3D camera orbit/pan/zoom UI;
- perspective projection;
- TikZ `3d` scope export for Béziers.

## Required implementation

Improve structure/comments/helpers so future camera work remains feasible.

Expected conceptual separation:

```ts
projectModelToScreen(point, cameraOrProjection)
screenToModelOnWorkPlane(screenPoint, workPlane, cameraOrProjection)
```

The current projection can remain simple, but avoid entangling work-plane geometry with camera assumptions.

Requirements:

- work plane is model-space geometry;
- projection/camera is a separate mapping;
- custom work-plane data should not encode camera assumptions;
- transient active work-plane UI state should not enter TikZ export;
- active work-plane UI state should not be saved in diagram JSON;
- loading a diagram resets or validates active work-plane state;
- no stale active custom plane should refer to point IDs that no longer exist.

Undo/redo, if present:

- setting active work plane should not create a diagram history entry;
- geometry created on a custom plane should be undoable like ordinary creation;
- work-plane picking state should be cleared or validated after undo/redo.

## Tests

Add tests for:

- save/export JSON excludes active custom work-plane state;
- TikZ export excludes active work-plane guide/state;
- loading resets/validates active work-plane state if testable;
- changing active work plane does not create undo history if undo/redo exists;
- geometry created on custom plane remains undoable if undo/redo exists.

## Documentation

Document camera-ready separation and save/load/undo policies.

## Report

Report files modified, separation/refactor choices, save/load behavior, undo/redo behavior, tests, test results, build results, and limitations.
