# Phase 26A Implementation Prompt: Coordinate anchor model, save/load, and global TikZ export

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

Introduce global TikZ coordinate anchors as a first-class diagram concept, distinct from visible point strata.

This subphase should implement the model, validation, save/load, naming, and basic TikZ `\coordinate` export. UI creation and coordinate references come later.

## Scope

Implement:

- `CoordinateAnchor` model;
- diagram storage for coordinate anchors;
- name / TikZ name validation and uniqueness;
- coordinate position model:
  - global symbolic coordinates;
  - work-plane-local symbolic coordinates where Phase 25 helpers exist;
- save/load normalization and validation;
- global TikZ export of `\coordinate`;
- tests.

Do not implement yet:

- cursor/direct Add coordinate UI;
- SVG preview marker;
- coordinate references in paths/sheets/labels;
- delete/detach behavior;
- show/hide toggle.

## Model

Suggested:

```ts
type CoordinateAnchor = {
  id: string;
  name: string;
  tikzName: string;
  position: CoordinateSource;
  locked?: boolean;
};
```

Where `CoordinateSource` should reuse the Phase 25 coordinate source model if available:

```ts
type CoordinateSource =
  | { kind: "global"; value: SymbolicVec3 }
  | {
      kind: "workPlaneLocal";
      frame: WorkPlaneFrameSnapshot;
      local: { a: ScalarInputValue; b: ScalarInputValue };
      preview: Vec3;
    };
```

Requirements:

- coordinate anchors are stored in `Diagram`, e.g. `diagram.coordinates` or `diagram.coordinateAnchors`;
- coordinate anchors are not `strata`;
- coordinate anchors are not labels;
- coordinate anchors have no layer;
- coordinate anchors have no codimension;
- coordinate anchors have no point style;
- old diagrams without coordinates load with an empty coordinate list.

## Naming policy

Coordinate anchors need a TikZ-safe name.

Requirements:

- `name` is user-facing;
- `tikzName` is used in `\coordinate (<tikzName>)`;
- `tikzName` must be valid for TikZ coordinate naming under current project rules;
- `tikzName` must be unique across:
  - coordinate anchors;
  - generated coordinate names;
  - named path/sheet/point coordinates if the project has a global TikZ coordinate namespace.
- duplicate/invalid names are rejected or sanitized with deterministic disambiguation.

Preferred:

- generate a safe unique `tikzName` from the user name;
- allow user editing later in Inspector.

## Validation

Validate:

- `id` exists and is unique;
- `name` non-empty after trim;
- `tikzName` valid and unique;
- position source is valid;
- preview point finite;
- work-plane-local frame valid if used;
- no layer field required or accepted as meaningful.

## TikZ export

Coordinate anchors should be exported before drawing commands and before layer-bound geometry.

Suggested ordering:

```text
1. external style comments
2. variables / \pgfmathsetmacro
3. local colors/styles/libraries
4. layer declarations / camera setup
5. coordinate anchors
6. drawing commands by layer
```

Exact placement should follow current generator architecture, but coordinates must be defined before any path/sheet/label uses them.

Example:

```tex
% Coordinates
\coordinate (A) at (0,0);
\coordinate (B) at ({\R * cos(\q)}, {\R * sin(\q)});
```

Requirements:

- 2D coordinates export as 2D;
- 3D global coordinates export consistently with existing 3D coordinate formatting;
- work-plane-local symbolic coordinate anchors export with existing Phase 25 local/canvas-scope policy where safe, or global-preview fallback with explicit comment if needed;
- coordinate anchor export is not wrapped in `pgfonlayer`;
- coordinate anchor export unaffected by View filter/New layer;
- inline output has no blank lines;
- 4-space indentation preserved.

## Tests

Add tests:

1. Old diagram loads with empty coordinate anchors.
2. Valid coordinate anchor validates.
3. Duplicate coordinate anchor ids rejected.
4. Duplicate TikZ names rejected/disambiguated according to policy.
5. Invalid TikZ name rejected/sanitized according to policy.
6. Global symbolic coordinate anchor validates.
7. Work-plane-local coordinate anchor validates if supported.
8. Save/load round-trip preserves coordinate anchors.
9. TikZ export emits `\coordinate`.
10. Coordinates emitted before drawing commands.
11. Coordinates not emitted inside layer blocks.
12. Inline output no blank lines.
13. View filter/New layer do not affect coordinate export.

## Report after implementation

Please report:

- files modified;
- coordinate anchor model;
- diagram storage field;
- naming/tikzName policy;
- validation behavior;
- TikZ export placement;
- save/load behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
