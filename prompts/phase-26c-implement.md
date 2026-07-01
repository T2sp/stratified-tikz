# Phase 26C Implementation Prompt: Coordinate references in path/sheet/label/point inputs and TikZ output

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

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The repository is a React/TypeScript/Vite GUI for 3-dimensional graphical calculus. It has the expected project structure including `src`, `tests`, `docs`, `prompts`, and automation scripts.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- symbolic variables and symbolic global/work-plane-local coordinate expressions;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 26 adds TikZ coordinate anchors, distinct from visible point strata.

Core distinction:

```text
Add point:
  visible diagram object
  layer-bound
  styled point
  exported as visible mark/node/drawing command

Add coordinate:
  global reference anchor
  not layer-bound
  exported as \coordinate
  usable by paths/sheets/labels/points as a coordinate reference
  preview-only marker in SVG/PGF Preview
```

Important design requirements:

- Coordinate anchors are global and not layer-bound.
- Coordinate anchors are exported before layer drawing commands.
- Coordinate anchors are not affected by layer View filter or New layer.
- Coordinate anchors can be created by cursor input and direct input.
- Direct input supports both global xyz and work-plane-local symbolic coordinates.
- Coordinate references should be preserved in TikZ when used by paths/sheets/labels/points.
- In SVG Preview, coordinate anchors should eventually appear as a small dot surrounded by a small dotted circle.
- Users need a Show/Hide Coordinates toggle.
- When shown, coordinate anchors should have high hit-test priority over layer-bound geometry.
- Deleting a referenced coordinate should detach references rather than leaving dangling refs.
- During layer translation, layer-bound elements that reference global coordinates should detach first, because coordinate anchors are global and do not move with layers.
- Detach should preserve symbolic/global/work-plane-local coordinate information where supported.
- UI-only state such as show/hide and selection is not stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Allow other diagram elements to reference coordinate anchors instead of copying their numeric positions.

This enables TikZ output like:

```tex
\coordinate (A) at (...);
\coordinate (B) at (...);
\draw (A) -- (B);
```

## Prerequisites

Phases 26A and 26B are complete.

## Scope

Implement:

- `coordinateRef` coordinate source model;
- coordinate reference selection in direct/cursor creation where already applicable;
- TikZ formatting of coordinate refs;
- preview resolution of coordinate refs;
- validation;
- tests.

Do not implement yet:

- detach/delete behavior;
- layer translation detach;
- coordinate usage count;
- advanced reference manager UI.

## Coordinate reference model

Suggested:

```ts
type CoordinateReferenceSource = {
  kind: "coordinateRef";
  coordinateId: string;
  preview: Vec3;
};
```

or integrate into existing coordinate component/source model.

Requirements:

- reference points to a coordinate anchor id;
- preview resolves from current anchor position;
- if anchor moves, referencing geometry preview updates;
- coordinateRef is saved/loaded;
- missing referenced coordinate rejected in validation/load;
- no dangling references.

## Supported fields

At minimum support coordinate refs for:

- path vertices/endpoints;
- sheet vertices;
- label positions;
- point positions.

Preferred support:

- cubic controls;
- arc center/start/end;
- filled boundaries;
- Coons/Ruled boundary snapshots;
- grid/lattice anchors where natural.

Document unsupported fields.

## UI

When creating/editing coordinates in fields that support coordinate refs, allow choosing an existing coordinate anchor.

Examples:

```text
Coordinate source:
  Direct value
  Existing coordinate
```

or in pick mode:

```text
Pick coordinate anchor
```

Requirements:

- coordinate anchors can be selected from a list or by clicking marker;
- preview shows which coordinate is referenced;
- coordinateRef does not copy numeric value;
- user can switch back to direct value if existing UI supports it.

## TikZ export

If an element field is a coordinateRef:

- emit `(tikzName)` instead of numeric coordinate;
- ensure coordinate definitions appear before use;
- preserve layer output for referencing objects;
- inline output no blank lines.

Example:

```tex
\coordinate (A) at (...);
\draw (A) -- (B);
\node at (A) {...};
```

## Tests

Add tests:

1. Path endpoint can reference coordinate anchor.
2. Label position can reference coordinate anchor.
3. Point position can reference coordinate anchor if supported.
4. Sheet vertex can reference coordinate anchor.
5. Preview resolves coordinateRef.
6. Moving coordinate anchor updates reference preview.
7. Missing coordinate id rejected.
8. Save/load coordinateRef round-trip.
9. TikZ emits `(A)` reference, not copied numeric coordinate.
10. Coordinate definition emitted before reference.
11. Inline output no blank lines.
12. Existing numeric/global/local fields unaffected.

## Report after implementation

Please report:

- files modified;
- coordinateRef model;
- supported fields;
- UI selection behavior;
- preview resolution behavior;
- TikZ output behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
