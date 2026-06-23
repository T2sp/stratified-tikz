# Phase 22E Implementation Prompt: TikZ/SVG braiding rendering without knot package

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

Phase 21 is complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- paths, path templates, arc/circle/ellipse, sheets, filled regions/sheets, ruled surfaces, Coons patches, curved surfaces;
- symbolic variables and coordinate expressions;
- grid/lattice generation;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo;
- SVG preview and TikZ generation.

Phase 22 adds:

1. Arrow options for 2D and 3D paths.
2. Mid-segment arrow decorations, similar to TikZ `decorations.markings`.
3. Path direction reversal.
4. 2D-only braided monoidal category string-diagram crossing controls:
   - detect path intersections;
   - click an intersection to toggle:
     - no braiding;
     - braiding;
     - anti-braiding;
   - avoid relying on the TikZ `knot` package because it tends to conflict with decorations.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI overlay/draft state should not be stored in `Diagram`.
- Arrow/braiding data that affects TikZ output should be persisted.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, and all existing geometry behavior.


## Goal

Render and export 2D braiding/anti-braiding crossings without using the TikZ `knot` package.

The implementation should avoid knot package dependency because it can conflict with decorations/arrow markings.

Use an explicit gap/mask strategy for crossings.

## Prerequisites

Phases 22C and 22D are complete.

## Scope

Implement:

- SVG braiding rendering;
- TikZ braiding export without knot package;
- gap/mask strategy at crossings;
- interaction with arrow decorations;
- tests.

Do not implement:

- knot package output;
- exact curve splitting if mask approach is sufficient;
- 3D braiding;
- complex background-aware masking.

## Rendering convention

From Phase 22D:

- `none`: draw paths normally.
- `braiding`: pathA passes over pathB.
- `antiBraiding`: pathB passes over pathA.

To show crossing:

1. Draw normal paths.
2. Draw a short background-colored mask over the under-strand near the crossing.
3. Redraw the over-strand short segment on top if necessary.

This approximates over/under without knot package.

## SVG implementation

For each crossing:

- compute local tangent for under strand;
- compute a short under-strand mask segment around crossing;
- draw mask stroke with background color and width = under stroke width + gap;
- redraw over strand short segment with normal style;
- markers/controls remain clickable.

Requirements:

- mask is preview-only rendering, not geometry;
- works with arrows/decorations as much as practical;
- no NaN/Infinity;
- configurable or reasonable gap size.

## TikZ export

Use explicit draw commands.

Example concept:

```tex
% Braiding crossing: pathA over pathB
\draw[draw=white, line width=<underWidth+gap>] (underA) -- (underB);
\draw[<over style>] (overA) -- (overB);
```

Requirements:

- no `knot` package;
- no `spath` dependency unless already used safely;
- no decoration conflict;
- works with arrow-decorated full paths as much as practical;
- hidden/gap commands use comments;
- inline output has no blank lines;
- 4-space indentation preserved;
- generated TikZ remains readable.

If background color is configurable, use white default.

## Interaction with arrow decorations

Arrow decorations may be on full paths.

Requirements:

- do not remove arrow options from main paths;
- crossing mask should not intentionally erase mid-arrowheads unless the arrow lies exactly at crossing; document limitation;
- over-strand redraw should not duplicate arrowheads unless intentionally disabled for small crossing segments.

Preferred:

- over-strand redraw for crossing segments should be plain stroke without arrow decorations to avoid duplicate arrowheads.
- If style requires it, preserve stroke color/width but omit arrow decoration.

Document this.

## Tests

Add tests:

1. No braiding state emits no gap/mask commands.
2. Braiding emits mask for pathB and redraw for pathA.
3. Anti-braiding emits mask for pathA and redraw for pathB.
4. TikZ output does not contain `\usetikzlibrary{knot}` or knot package commands.
5. TikZ output with arrows and braiding still includes arrow decoration on main path.
6. Crossing overlay commands have finite coordinates.
7. Inline output no blank lines.
8. 4-space indentation preserved.
9. SVG helper creates mask/over segment for braiding.
10. 3D diagrams ignore braiding states or reject them.

## Documentation

Document no-knot package strategy and limitations.

## Report after implementation

Please report:

- files modified;
- SVG mask strategy;
- TikZ mask strategy;
- gap size policy;
- arrow decoration interaction;
- tests added/updated;
- test results;
- build results;
- limitations.
