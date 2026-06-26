# Phase 24A Implementation Prompt: Cursor snap / coordinate quantization

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

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 23 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- paths, arrows, braiding crossings, grids/lattices, sheets, ruled surfaces, Coons patches, filled regions/sheets, curved surfaces;
- symbolic variables and coordinate expressions;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 24 improves editing fundamentals:

1. Cursor snapping / coordinate quantization.
2. Multi-selection.
3. Bulk style/layer/delete/duplicate editing.
4. Bulk translation, including symbolic coordinates.
5. Path concatenation.
6. Layer merge and layer translation hardening.
7. Editing polish/docs/regression hardening.

Important phase decision:

- General affine transformations are **deferred to a later phase**.
- In Phase 24, the only geometric transform is translation.
- Translation must work for objects containing symbolic coordinates.
- Path concatenation does **not** need to preserve original per-path styles. The concatenated path can use a simple style policy, preferably the first selected path's style or current default curve style.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Direct/symbolic input should not be silently snapped.
- UI-only selection/draft/palette state should not be stored in `Diagram`.
- Multi-selection and operation data that affects geometry should be undoable.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Add user-configurable cursor snapping / coordinate quantization.

The goal is to make cursor placement and drag editing easier by optionally rounding cursor-derived coordinates to a user-selected step such as:

```text
1
0.5
0.1
0.01
0.001
custom
```

This should affect cursor-based creation/editing, not direct or symbolic text input.

## Scope

Implement:

- cursor snap settings model/UI;
- snapping helpers for 2D and 3D work-plane-local coordinates;
- integration with cursor creation;
- integration with geometry handle dragging;
- tests.

Do not implement:

- snapping for direct input;
- snapping for JSON load;
- snapping for symbolic expression editing;
- grid snapping beyond coordinate quantization;
- new geometry features;
- new dependencies.

## Snap model

Suggested:

```ts
type CursorSnapSettings = {
  enabled: boolean;
  step: number;
};
```

or:

```ts
type CursorSnapMode =
  | { kind: "off" }
  | { kind: "preset"; step: number }
  | { kind: "custom"; step: number };
```

Requirements:

- default is off, preserving current behavior;
- step must be finite and positive;
- invalid custom step rejected;
- UI state may be editor preference state, not diagram geometry;
- if export/settings persistence already exists, document whether snap settings persist.

## UI

Add a compact control in the preview toolbar or nearby editing controls:

```text
Snap: Off / 1 / 0.5 / 0.1 / 0.01 / 0.001 / Custom
```

Requirements:

- easy to change while editing;
- not too tall;
- custom value input appears only when needed;
- changing snap does not mutate existing diagram geometry;
- current snap state visible.

## 2D snapping

When placing/dragging cursor-derived 2D coordinates:

```text
x' = round(x / step) * step
y' = round(y / step) * step
z' = 0
```

Requirements:

- avoid floating junk such as `0.30000000000000004` where practical;
- use sensible decimal rounding based on step;
- keep z = 0.

## 3D snapping

For cursor placement on a work plane, snap in the active work-plane local coordinates.

Given:

```text
P = origin + a*u + b*v
```

snap:

```text
a' = round(a / step) * step
b' = round(b / step) * step
P' = origin + a'*u + b'*v
```

Requirements:

- use the active/stored work plane used by cursor creation;
- preserve existing 3D work-plane behavior;
- no global xyz snapping unless the existing cursor placement is global and no work plane exists;
- finite output only.

## Apply snapping to

Apply snapping to cursor-derived operations:

- cursor-created points;
- cursor-created labels;
- cursor-created polyline/path vertices;
- cursor-created cubic/arc control points if applicable;
- cursor-created sheet vertices;
- cursor-created grid/work-plane-local points if applicable;
- geometry handle dragging.

Do not apply snapping to:

- direct input text fields;
- symbolic expression fields;
- JSON load;
- programmatic transformations;
- layer/multi-selection translation unless explicitly using cursor drag handles.

## Tests

Add tests:

1. Snap off preserves coordinate.
2. 2D snap step `0.1` rounds x/y and keeps z=0.
3. 2D snap step `0.001` works.
4. Invalid step rejected.
5. 3D work-plane-local snap rounds local `(a,b)` coordinates.
6. Cursor-created point uses snap.
7. Cursor-created path vertex uses snap.
8. Drag handle update uses snap if cursor/drag editing active.
9. Direct input ignores snap.
10. Symbolic input ignores snap.
11. Existing cursor behavior unchanged when snap off.

## Documentation

Document:

- snap applies only to cursor/drag editing;
- direct/symbolic input is not snapped;
- 3D snapping is work-plane-local.

## Report after implementation

Please report:

- files modified;
- snap model/UI;
- snap integration points;
- 2D/3D behavior;
- persistence policy;
- tests added/updated;
- test results;
- build results;
- limitations.
