# Phase 19F Implementation Prompt: Grid TikZ export using foreach and clip

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

Export grid objects compactly using TikZ `\foreach` loops and clip/range controls.

This phase should make generated TikZ concise.

Example desired style:

```tex
\begin{scope}
    \clip (0,0) rectangle (5,5);
    \foreach \x in {0,0.5,...,5} {
        \draw[gridStyle] (\x,0) -- (\x,5);
    }
    \foreach \y in {0,0.5,...,5} {
        \draw[gridStyle] (0,\y) -- (5,\y);
    }
\end{scope}
```

For 3D work-plane-local grids, use `canvas is plane` scope when appropriate.

## Prerequisites

Phases 19A-19E are complete.

## Scope

Implement:

- TikZ export for grid using `\foreach`;
- rectangular clip export;
- 2D grid export;
- 3D work-plane-local grid export;
- symbolic range export where safe;
- tests.

Do not implement:

- arbitrary non-rectangular clipping;
- automatic symbolic simplification;
- pgfplots;
- raw TikZ snippets.

## 2D grid TikZ export

Export:

- a scope;
- a rectangular `\clip`;
- vertical line `\foreach`;
- horizontal line `\foreach`;
- style/layer.

Requirements:

- style/layer preserved;
- finite numeric ranges exported compactly;
- symbolic scalar ranges exported if supported and safe;
- no line-by-line expansion by default;
- no NaN/Infinity.

## 3D work-plane grid TikZ export

Preferred:

```tex
\begin{scope}[
    plane origin={(...)},
    plane x={(...)},
    plane y={(...)},
    canvas is plane
]
    \clip (...) rectangle (...);
    \foreach ...
\end{scope}
```

Requirements:

- add/use TikZ 3d library according to existing convention;
- local 2D coordinates used inside scope;
- camera/layer/style behavior preserved;
- do not depend on transient active work plane;
- use stored grid frame snapshot.

## Symbolic variables and ranges

If grid ranges/steps use symbolic expressions:

- use macros/expressions in `\foreach` range only when TikZ syntax is safe;
- otherwise reject symbolic grid export or fall back to sampled explicit lines with clear limitation.

Preferred MVP:

- numeric ranges/steps required for `\foreach`;
- symbolic clip/range support allowed only when validated.

Do not output broken `\foreach`.

## Inline math mode

Inline output must still have no blank lines.

`foreach` blocks should be indented with 4 spaces per Phase 18D.

Example:

```tex
    \foreach \x in {0,1,...,5} {
        \draw[...] ...;
    }
```

## Tests

Add tests:

1. 2D grid exports `\foreach`.
2. 2D grid exports `\clip`.
3. 2D grid does not expand every line.
4. 3D grid exports `canvas is plane` scope.
5. 3D grid uses local coordinates inside scope.
6. Style/layer preserved.
7. Invalid ranges rejected before export.
8. Inline grid output has no blank lines.
9. Indentation is 4 spaces.
10. Numeric output finite.
11. Existing TikZ output not regressed.

## Documentation

Document grid export strategy, clip, foreach, and limitations.

## Report after implementation

Please report:

- files modified;
- 2D export format;
- 3D export format;
- symbolic range policy;
- clip behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
