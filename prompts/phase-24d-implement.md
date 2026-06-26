# Phase 24D Implementation Prompt: Bulk translation with symbolic coordinate support

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

Implement translation for multi-selected objects, including objects whose coordinates contain symbolic expressions.

This phase also creates shared translation helpers that can later be reused by layer merge/translation hardening.

Important:

- General affine transforms are deferred to a later phase.
- Phase 24D implements translation only.

## Prerequisites

Phases 24B and 24C are complete.

## Scope

Implement:

- shared translation helpers for diagram elements;
- multi-selection translation UI;
- symbolic coordinate translation;
- undo/redo;
- tests.

Do not implement:

- rotation;
- scaling;
- shear;
- general affine matrix;
- layer affine transform;
- path concatenation.

## Translation UI

For multi-selection, provide a panel:

```text
Translate selected
  dx
  dy
  dz (3D only)
  [Apply]
```

Optional:

- allow symbolic delta expressions, e.g. `Len/2`.

Preferred:

- use existing Phase 19 scalar expression parser for translation inputs.
- If symbolic delta is too large for MVP, numeric delta is acceptable, but symbolic coordinates must still translate correctly by numeric delta.

## Translation semantics

For each selected object, apply:

```text
P' = P + d
```

where:

```text
d = (dx, dy, dz)
```

In 2D:

```text
dz = 0
z stays 0
```

In 3D:

```text
dx, dy, dz
```

## Symbolic coordinate support

If a coordinate component is numeric:

```text
x = 2
dx = 1
=> x = 3
```

If a coordinate component is symbolic:

```text
x = R*cos(q)
dx = 1
=> x = (R*cos(q)) + 1
```

If delta is symbolic and supported:

```text
x = R*cos(q)
dx = a
=> x = (R*cos(q)) + (a)
```

Requirements:

- preserve symbolic intent;
- update preview values using current variables;
- no raw string concatenation that creates invalid expressions;
- use a helper to build an addition expression safely;
- simplify trivial cases where practical:
  - `+ 0` may be omitted;
- non-finite preview values rejected;
- unknown variables in delta rejected.

For 2D `z`, do not create symbolic `z`; keep z=0.

## Geometry coverage

Translation should cover selected objects:

- points;
- labels;
- polylines;
- concatenated paths;
- line/cubic/arc segments;
- circle/ellipse templates;
- path arrow/braiding data remains consistent;
- polygon sheets;
- filled regions/sheets;
- grids/lattices;
- ruled surfaces;
- Coons patches;
- curved surfaces/hemispheres;
- work-plane/frame snapshots inside objects;
- boundary path snapshots;
- constant point boundaries.

If a kind cannot be supported yet, reject that multi-selection operation with a clear message and do not partially mutate.

Preferred: use existing layer translation helpers and extend them to symbolic coordinates.

## Frame translation

For stored frames:

- translate frame `origin` by `d`;
- do not translate basis vectors `u`, `v`, `normal`;
- do not rotate/scale frames.

This applies to:

- work-plane-filled sheets;
- arc/path template frames;
- grids;
- Coons/ruled boundary segment frames;
- curved surface frames.

## Crossings and dependent state

When translating selected paths:

- crossing state between translated paths should remain geometrically consistent if all involved paths are translated by the same delta.
- crossing state between a translated path and non-translated path may become stale and should be cleaned/recomputed according to existing crossing cleanup policy.
- MVP: after translation, run existing crossing cleanup.

## Tests

Add tests:

1. Numeric point translation.
2. Symbolic point translation adds delta to expression.
3. Symbolic preview updates after translation.
4. 2D translation keeps z=0.
5. Path line/cubic/arc symbolic coordinates translate.
6. Frame origin translates; frame basis vectors unchanged.
7. Coons/Ruled boundary snapshots translate.
8. Grid frame translates.
9. Translation rejects unsupported objects without partial mutation.
10. Bulk translation is undoable.
11. Crossing cleanup runs after translating paths.
12. TikZ output preserves translated symbolic expressions.
13. Inline output no blank lines.

## Documentation

Document symbolic translation policy and affine deferral.

## Report after implementation

Please report:

- files modified;
- translation helper coverage;
- symbolic expression update policy;
- delta input policy;
- frame handling;
- crossing cleanup behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
