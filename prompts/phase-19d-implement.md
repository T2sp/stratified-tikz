# Phase 19D Implementation Prompt: Symbolic TikZ export integration and mode compatibility

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

Phase 18 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, paths, path templates, sheets, filled regions/sheets, curved surfaces;
- custom work planes;
- camera controls;
- layer manager;
- style manager and external TikZ style references;
- standalone and inline math TikZ export modes;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

Phase 19 adds symbolic input and grid generation.

Core requirements:

1. Users can define variables in the toolbar.
   - TikZ output corresponds to `\pgfmathsetmacro`.
   - Invalid/dangerous inputs should be rejected before they can generate broken TikZ.

2. Coordinate inputs can accept expressions using variables and elementary functions.
   - Example:
     - variables: `R`, `q`
     - coordinate input: `(R*cos(q), R*sin(q))`
     - generated TikZ coordinate: `({\R * cos(\q)}, {\R * sin(\q)})`
   - SVG preview still needs numeric values, so expressions must be evaluated using variable preview values.

3. Add a grid-generation mode.
   - The grid should be represented compactly in TikZ using `\foreach`.
   - Range/clip controls should make grid boundaries concise.
   - In 3D, grids should be generated in a work-plane-local 2D frame when applicable.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all numeric preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Symbolic data that affects generated TikZ should be persisted in diagram/export data, not only UI state.
- UI-only draft state should not be stored in `Diagram`.
- TikZ export must remain readable and must respect standalone vs inline math export mode.
- Inline math export must still contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve camera, work-plane, layer manager, style manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.


## Goal

Harden TikZ export for variables and symbolic coordinates across all relevant geometry, and ensure compatibility with standalone and inline math modes.

This phase should ensure symbolic output is readable and does not break existing export features.

## Prerequisites

Phases 19A-19C are complete.

## Scope

Implement/export hardening for:

- variables;
- symbolic coordinates;
- path coordinates;
- sheet/fill boundaries;
- path templates where feasible;
- camera/layer/style/export mode interactions.

Do not implement:

- grid generation;
- `\foreach` grids;
- arbitrary raw TikZ snippets.

## Export requirements

Variables:

```tex
\pgfmathsetmacro{\R}{2}
\pgfmathsetmacro{\q}{30}
```

Symbolic coordinate:

```tex
({\R * cos(\q)}, {\R * sin(\q)})
```

Requirements:

- variables emitted before coordinates/drawing commands that use them;
- standalone mode placement follows setup convention;
- inline mode placement is inside `tikzpicture`;
- inline mode has no blank lines;
- no duplicate variable definitions;
- variables unused by output may be omitted or emitted; choose and document policy;
- user ordering deterministic.

## Coverage

Ensure symbolic coordinate export works for:

- point coordinates;
- label positions;
- ordinary curve/path vertices;
- cubic controls;
- arc/circle/ellipse template parameters where implemented;
- filled region boundaries;
- work-plane-filled sheets where feasible;
- sheet vertices.

If some geometry kind cannot support symbolic output yet, use preview numeric fallback only with a warning/report, or reject symbolic input for that kind earlier. Do not silently lose symbolic intent where it was accepted.

## Formatting

Generated symbolic expressions should be readable:

- include spaces around binary operators if formatter supports them;
- brace symbolic components;
- avoid unnecessary `\definecolor`/style duplication;
- preserve no-blank-lines in inline mode.

## Tests

Add tests:

1. Variables emitted before symbolic coordinates in standalone.
2. Variables emitted inside `tikzpicture` before symbolic coordinates in inline.
3. Inline symbolic output has no blank lines.
4. Point symbolic coordinate export.
5. Label symbolic coordinate export.
6. Path symbolic vertex export.
7. Cubic control symbolic export if supported.
8. Filled boundary symbolic export if supported.
9. Template path symbolic radius/center export if supported.
10. Unused variable policy tested.
11. Duplicate variables not emitted.
12. Existing numeric TikZ output unchanged.
13. External imported styles and local user styles still work with symbolic coordinates.

## Documentation

Update TikZ output docs with examples.

## Preserve existing behavior

Do not regress:

- numeric export;
- layer output;
- style output;
- camera export;
- inline/standalone modes;
- save/load.

## Report after implementation

Please report:

- files modified;
- coverage by element kind;
- variable emission policy;
- unsupported cases;
- tests added/updated;
- test results;
- build results;
- limitations.
