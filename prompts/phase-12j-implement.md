# Phase 12J Implementation Prompt: TikZ 3d-library scope export for work-plane-local Béziers

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

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Active work-plane state is editor/UI state, not `Diagram`.
- Work planes are drawing aids, not committed diagram elements.
- Geometry created on a work plane is committed as ordinary `Vec3` diagram data.
- Work-plane guides/previews must not be exported to TikZ.
- Existing axis-aligned 3D work planes `xy`, `xz`, and `yz` must keep working.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Goal

Export eligible 3D work-plane-local relative Bézier curves using TikZ's `3d` library `canvas is plane` scope, with 2D-style relative controls inside the scope.

## Prerequisites

Phases 12A-12I are complete.

In particular:

- work-plane frame helpers exist;
- plane-local coordinates can be computed;
- eligible Bézier curves store work-plane-local metadata.

## Scope

Implement TikZ export only.

Do not implement:

- new work-plane UI;
- full camera controls;
- TikZ import;
- new curve types;
- live point references.

## Required export behavior

When a 3D cubic Bézier curve has relative Cartesian or relative polar metadata in a known work-plane-local frame, export it using TikZ's `3d` library canvas-plane mechanism.

Add:

```tex
\usetikzlibrary{3d}
```

only when needed by generated output.

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

Here:

- `(Ox,Oy,Oz)` is the work-plane origin;
- `u = (ux,uy,uz)` is the work-plane local x-axis unit vector;
- `v = (vx,vy,vz)` is the work-plane local y-axis unit vector;
- `plane x` is `origin + u`;
- `plane y` is `origin + v`;
- `(sx,sy)` and `(ex,ey)` are local 2D coordinates of start/end in that frame.

For relative Cartesian controls:

```tex
.. controls +(dx1,dy1) and +(dx2,dy2) ..
```

For relative polar controls:

```tex
.. controls +(q1:r1) and +(q2:r2) ..
```

## Coordinate declaration policy

For scoped work-plane-local relative export:

- do not emit independent `\coordinate` declarations for relative control points;
- local start/end coordinates may be inline inside the scope;
- if start/end coordinates are named, names must be local or collision-safe;
- avoid dangling references to omitted control coordinates;
- formatting should be readable and avoid unnecessary decimal noise.

## Fallback behavior

If a 3D Bézier curve lacks a known work-plane-local frame, export using existing absolute 3D Bézier control syntax.

If a curve cannot be represented consistently in one work-plane frame, use absolute fallback.

Never export arbitrary 3D work-plane-local polar controls as plain TikZ `+(q:r)` outside a `canvas is plane` scope.

## Preserve existing export behavior

Preserve:

- absolute 3D Bézier export;
- 2D relative Cartesian/polar export;
- non-Bézier TikZ export;
- style output;
- layer-aware TikZ output;
- Phase 9A coordinate names.

## Tests

Add TikZ tests:

1. Work-plane-local 3D relative polar Bézier exports with `\usetikzlibrary{3d}`.
2. Output contains `scope`, `plane origin`, `plane x`, `plane y`, `canvas is plane`.
3. Path inside scope uses `.. controls +(q1:r1) and +(q2:r2) ..`.
4. No independent control-point coordinate declarations for relative controls.
5. Work-plane-local 3D relative Cartesian Bézier uses `.. controls +(dx1,dy1) and +(dx2,dy2) ..`.
6. Absolute 3D Bézier fallback still works.
7. 2D relative export unchanged.
8. Layer-aware output preserved.
9. `\usetikzlibrary{3d}` is emitted when needed and not emitted when no scoped 3D export is used, if the generator currently supports conditional libraries.

## Documentation

Update `docs/TIKZ_OUTPUT.md`:

- describe TikZ `3d` scope export;
- describe fallback behavior;
- describe no independent control coordinate declarations for scoped relative controls;
- mention `\usetikzlibrary{3d}` is emitted only when needed.

## Report after implementation

Please report:

- files modified;
- export implementation;
- library inclusion policy;
- fallback behavior;
- coordinate declaration policy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
