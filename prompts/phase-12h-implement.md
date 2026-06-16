# Phase 12H Implementation Prompt: TikZ 3d-library scope export for work-plane-local Béziers

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

Export eligible 3D work-plane-local relative Bézier curves using TikZ's `3d` library `canvas is plane` scope, with 2D-style relative controls inside the scope.

## Prerequisite

Phases 12A-12G are complete.

## Scope

Implement TikZ export for eligible work-plane-local cubic Bézier curves.

Do not implement:

- new work-plane UI;
- full camera controls;
- TikZ import;
- new curve types.

## Required implementation

When a 3D cubic Bézier curve has relative Cartesian or relative polar metadata in a known work-plane-local frame, export it using TikZ's `3d` library canvas-plane mechanism.

Add:

```tex
\usetikzlibrary{3d}
```

only when needed.

Expected export form:

```tex
\begin{scope}[
  plane origin={(Ox,Oy,Oz)},
  plane x={(Ox+ux,Oy+uy,Oz+uz)},
  plane y={(Ox+vx,Oy+vy,Oz+vz)},
  canvas is plane
]
  \draw[<style>]
    (sx,sy) .. controls +(q1:r1) and +(q2:r2) .. (ex,ey);
\end{scope}
```

For relative Cartesian controls:

```tex
.. controls +(dx1,dy1) and +(dx2,dy2) ..
```

For relative polar controls:

```tex
.. controls +(q1:r1) and +(q2:r2) ..
```

Coordinate declaration policy:

- do not emit independent `\coordinate` declarations for relative control points in this mode;
- local start/end coordinates may be inline inside the scope;
- if start/end coordinates are named, names must be local or collision-safe;
- avoid dangling references.

Fallback rule:

- if a 3D Bézier curve lacks a known work-plane-local frame, export using existing absolute 3D Bézier control syntax;
- if the curve cannot be represented consistently in one plane, use absolute fallback;
- never export arbitrary 3D work-plane-local polar controls as plain TikZ `+(q:r)` outside a `canvas is plane` scope.

Preserve:

- absolute 3D Bézier export;
- 2D relative Cartesian/polar export;
- Phase 9A coordinate names;
- Phase 9B layer-aware output;
- style output.

## Tests

Add TikZ tests:

- work-plane-local 3D relative polar Bézier exports with `\usetikzlibrary{3d}`;
- output contains `scope`, `plane origin`, `plane x`, `plane y`, `canvas is plane`;
- path inside scope uses `.. controls +(q1:r1) and +(q2:r2) ..`;
- no independent control-point coordinate declarations for relative controls;
- work-plane-local 3D relative Cartesian Bézier uses `.. controls +(dx1,dy1) and +(dx2,dy2) ..`;
- absolute 3D Bézier fallback still works;
- 2D relative export unchanged;
- layer-aware output preserved.

## Documentation

Update `docs/TIKZ_OUTPUT.md`:

- describe TikZ `3d` scope export;
- describe fallback behavior;
- describe no independent control coordinate declarations for scoped relative controls;
- mention `\usetikzlibrary{3d}` is emitted only when needed.

## Report

Report files modified, export implementation, library inclusion policy, fallback behavior, coordinate declaration policy, tests, test results, build results, and limitations.
