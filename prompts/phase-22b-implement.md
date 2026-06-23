# Phase 22B Implementation Prompt: Arrow UI, SVG preview, and path direction reversal

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

Add user-facing arrow controls for 2D and 3D paths, render arrowheads in SVG preview, and allow paths to be reversed at any time.

## Prerequisites

Phase 22A is complete.

## Scope

Implement:

- Inspector/UI controls for path arrow options;
- SVG preview of endpoint and mid arrows;
- path direction reversal command;
- immutable path reversal helpers for supported path kinds;
- tests.

Do not implement:

- braiding/intersection detection;
- crossing toggles;
- exact arrow shape rendering for every TikZ head if too large;
- new geometry types.

## UI controls

For selected path-like curve objects, show controls:

```text
Arrows
  Endpoint: none / forward / backward / both
  Mid arrow: off / on
  Position: 0.5
  Direction: forward / backward
  Head: > / Stealth / Latex / Stealth[harpoon] / Stealth[harpoon,swap]
  [Reverse path direction]
```

Requirements:

- only shown for path-like curve objects;
- works for 2D and 3D paths;
- updates SVG preview and TikZ;
- undo/redo works;
- invalid position rejected;
- no effect on non-path objects.

## SVG arrow preview

Render approximate arrowheads for:

- endpoint arrows;
- mid arrows.

Requirements:

- follow projected path direction;
- work in 2D and projected 3D;
- mid-arrow position default 0.5;
- arrowheads do not affect hit testing unexpectedly;
- no NaN/Infinity;
- if exact `Stealth`/`Latex` shape preview is not implemented, use reasonable approximations and report limitation.

SVG arrowheads are preview-only; persisted data is arrow options.

## Path direction reversal

Implement a command:

```text
Reverse path direction
```

It should reverse geometry direction and update arrow semantics consistently.

Supported objects:

- polyline;
- cubic Bézier;
- concatenated path with line/cubic/arc segments;
- arc segments;
- circle/ellipse templates if they have orientation metadata;
- grid not required;
- surfaces not required.

Reversal rules:

- polyline points reversed;
- cubic Bézier start/end and controls swapped;
- concatenated path segment order reversed and each segment reversed;
- arc direction reversed;
- arrow decorations follow new path direction;
- source object ID, layer, style, name preserved;
- path labels/presets preserved;
- undo/redo works.

If a path kind cannot be reversed, disable button or report clear status.

## Tests

Add tests:

1. UI/helper applies endpoint arrow option.
2. UI/helper applies mid-arrow option and position.
3. SVG arrow preview finite for 2D path.
4. SVG arrow preview finite for 3D path.
5. Reverse polyline reverses point order.
6. Reverse cubic swaps controls correctly.
7. Reverse concatenated path preserves geometry in reverse order.
8. Reverse arc swaps direction correctly.
9. Reversal preserves style/layer/name/id.
10. Reversal undo/redo if testable.
11. TikZ output updates after arrow edits.
12. Invalid mid-arrow position rejected.

## Documentation

Document arrow controls and reverse direction behavior.

## Report after implementation

Please report:

- files modified;
- UI behavior;
- SVG preview approach;
- supported path kinds for reversal;
- unsupported kinds;
- tests added/updated;
- test results;
- build results;
- limitations.
