# Phase 19G Implementation Prompt: Symbolic input and grid polish, docs, and regression hardening

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

Polish and harden symbolic input and grid generation.

This subphase should improve UI usability, documentation, examples, and combined workflow tests.

## Prerequisites

Phases 19A-19F are complete.

## Scope

Implement:

- UI polish;
- error/status messages;
- docs;
- example diagrams using variables and grids;
- regression tests.

Do not implement:

- full TeX parser;
- arbitrary raw TikZ snippets;
- general symbolic geometry theorem proving;
- new grid geometry beyond rectangular/range clip.

## UI polish

Improve:

- Variable Manager compactness;
- expression input error messages;
- preview value display;
- grid form readability;
- imported variables/ranges status if applicable.

Suggested messages:

- unknown variable;
- invalid expression;
- non-finite preview value;
- unsafe TikZ token;
- grid line count too large;
- invalid grid step;
- unsupported symbolic grid range.

## Examples

Add examples if appropriate:

1. Circle/point using `R*cos(q), R*sin(q)`.
2. Simple symbolic path.
3. 2D grid generated with foreach.
4. 3D work-plane grid.

## Combined tests

Add tests:

1. Variables + symbolic coordinate + TikZ export.
2. Variables + inline math output no blank lines.
3. Variables + grid export.
4. Style/layer/camera output with symbolic coordinates.
5. Save/load round-trip for variables, symbolic coordinates, and grids.
6. Undo/redo variable edits if applicable.
7. Invalid symbolic expressions do not corrupt diagram.

## Documentation

Update docs:

- variable syntax;
- expression grammar;
- degree trig;
- TikZ macro export;
- symbolic coordinate examples;
- grid generation with foreach/clip;
- limitations and safety restrictions.

## Report after implementation

Please report:

- files modified;
- UI polish changes;
- examples added;
- docs updated;
- combined tests added;
- test results;
- build results;
- limitations.
