# Phase 19H Implementation Prompt: Triangular and honeycomb lattice grid patterns

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

Phase 19G is complete.

The editor now supports:

- symbolic variables and coordinate expressions;
- grid generation;
- grid SVG preview;
- compact grid TikZ export using `\foreach` and `\clip`;
- 2D grids and 3D work-plane-local grids;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- layer-aware TikZ output;
- camera/work-plane/layer/style managers;
- save/load and undo/redo.

Current limitation:

- grid generation currently supports only the existing rectangular/cubic-style lattice.
- Users also need triangular lattice and honeycomb lattice patterns.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- In 3D, lattice grids should lie in a stable work-plane-local 2D frame.
- Work planes are model-space editing aids.
- Grid data that affects output should be persisted.
- UI-only draft state should not be stored in `Diagram`.
- TikZ output must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve symbolic variables, grid export, save/load, undo/redo, camera, work-plane, layer/style managers, SVG preview, and existing geometry behavior.


## Goal

Extend the existing grid generator so users can create three lattice patterns:

1. rectangular/cubic lattice, i.e. the existing grid behavior;
2. triangular lattice;
3. honeycomb lattice.

The new lattice patterns should work in:

- 2D diagrams;
- 3D diagrams as work-plane-local 2D lattices embedded in the active/stored work-plane frame.

SVG preview and TikZ export should remain compact, safe, and readable.

## Scope

Implement:

- lattice pattern model extension;
- triangular lattice generation;
- honeycomb lattice generation;
- UI controls for selecting lattice pattern;
- SVG preview for all lattice patterns;
- TikZ export for triangular and honeycomb lattices using `\foreach` / compact loops where practical;
- clip/range support;
- symbolic variable compatibility where current grid supports it;
- save/load validation;
- tests.

Do not implement:

- arbitrary wallpaper groups;
- hex/triangle cell filling as regions;
- graph editing of individual lattice edges;
- curved lattice on non-planar surfaces;
- snapping to lattice points;
- new dependencies;
- broad grid UI redesign.

## Data model

Extend the existing grid model.

Suggested:

```ts
type LatticePattern =
  | "rectangular"
  | "triangular"
  | "honeycomb";
```

or, if existing terminology uses `cubic`, use:

```ts
type LatticePattern =
  | "cubic"
  | "triangular"
  | "honeycomb";
```

Keep existing data compatible.

Requirements:

- old diagrams without `latticePattern` default to existing rectangular/cubic behavior;
- save/load round-trip preserves the selected pattern;
- invalid pattern values rejected;
- all patterns keep existing style/layer/name behavior;
- all patterns use the existing frame/range/clip model where possible.

## Geometry conventions

All lattice patterns are 2D patterns in local `(u,v)` coordinates, then embedded into model space.

### 2D

Use the diagram plane:

```text
P(a,b) = (a,b,0)
```

or the existing 2D grid convention.

### 3D

Use the stored work-plane frame:

```text
P(a,b) = origin + a * u + b * v
```

Do not rely on the current active work plane at export time.

## Triangular lattice

A triangular lattice should be rendered as three families of parallel lines:

1. family A: horizontal / local `u` direction;
2. family B: direction at +60 degrees;
3. family C: direction at -60 degrees.

Equivalent finite segment generation is acceptable.

Use local basis:

```text
e1 = (spacing, 0)
e2 = (spacing/2, sqrt(3)/2 * spacing)
```

or an equivalent convention.

Required user inputs:

- spacing;
- u/v range or existing grid range;
- clip rectangle;
- optional origin offset if current grid supports it;
- style/layer.

Validation:

- spacing finite and positive;
- range finite or safely symbolic according to existing grid policy;
- line count bounded;
- generated preview segments finite.

## Honeycomb lattice

A honeycomb lattice should be rendered as a hexagonal edge graph.

Use a consistent local coordinate convention.

Recommended construction:

- generate hexagon centers on a triangular/offset lattice;
- for each center, generate six vertices;
- add hexagon edges while de-duplicating shared edges; or
- generate three edge families with periodic omissions.

MVP may generate hexagons and de-duplicate edges in TypeScript for SVG preview.

For TikZ export, prefer compact loops if practical.

Required user inputs:

- cell radius or edge length;
- u/v range or existing grid range;
- clip rectangle;
- style/layer.

Validation:

- cell size finite and positive;
- line/edge count bounded;
- generated preview segments finite.

Important:

- Honeycomb should not render duplicate overlapping edges excessively.
- If de-duplication is not exact in TikZ loop export, use a compact but correct enough approach and document limitation.

## Clip/range behavior

The existing grid range/clip behavior should apply to all lattice patterns.

Requirements:

- SVG preview clips or restricts generated segments to the rectangular local domain;
- TikZ export uses `\clip` when current grid export does;
- triangular/honeycomb lattices should not draw unbounded lines;
- no line/edge outside a reasonable padded domain should be generated.

MVP clipping policy:

- Generate segments over a padded bounding domain;
- clip them to local rectangular clip in SVG/TikZ.
- For SVG preview, either actually clip line segments or render them inside an SVG clip path if existing infrastructure supports it.

## TikZ export

### Rectangular/cubic

Preserve existing behavior.

### Triangular

Export compactly using loops.

Acceptable approaches:

1. Use three `\foreach` loops for three line families inside a `\clip` scope.
2. Generate finite line segments explicitly if loop export becomes too complex, but this is less preferred.

Preferred shape:

```tex
\begin{scope}
    \clip (uMin,vMin) rectangle (uMax,vMax);
    \foreach \k in {...} {
        \draw[<style>] (...) -- (...);
    }
    \foreach \k in {...} {
        \draw[<style>] (...) -- (...);
    }
    \foreach \k in {...} {
        \draw[<style>] (...) -- (...);
    }
\end{scope}
```

### Honeycomb

Prefer compact loops.

Acceptable MVP options:

1. Nested `\foreach` loops over hexagon centers, drawing a hexagon path for each center.
2. Nested loops with de-duplicated edge families if implemented.

If using hexagon paths per cell, duplicate shared edges may occur. This can make output darker. Prefer de-duplication if feasible.

If duplicate edges remain in MVP, document limitation and keep default opacity/line width sane.

### 3D work-plane-local export

For triangular and honeycomb lattice in 3D, use `canvas is plane` scope if existing 3D grid export does.

Shape:

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

Do not depend on transient active work plane.

Use stored frame.

## Symbolic compatibility

If existing grid supports symbolic ranges/steps:

- preserve that behavior for rectangular/cubic;
- support symbolic spacing/ranges for triangular/honeycomb only if safe;
- otherwise reject symbolic triangular/honeycomb ranges with a clear message.

Do not output broken `\foreach`.

Preferred MVP:

- numeric spacing/ranges required for triangular/honeycomb loops;
- symbolic variables can be used later if complex.

However, if existing `ScalarInputValue` helpers already support symbolic grid ranges safely, reuse them.

## UI

Add lattice pattern selector:

```text
Grid pattern:
  Rectangular
  Triangular
  Honeycomb
```

or:

```text
Lattice:
  Cubic
  Triangle
  Honeycomb
```

Inputs should adapt:

- rectangular/cubic:
  - existing u/v step controls;
- triangular:
  - spacing;
- honeycomb:
  - edge length or radius.

Keep the UI compact.

Do not bloat the toolbar.

Use collapsible/scrollable layout if needed.

## SVG preview

Requirements:

- selected pattern is visible;
- style applied;
- layer applied;
- selection highlight works if grid objects are selectable;
- line count bounded;
- no NaN/Infinity;
- 2D and 3D preview supported;
- camera projection respected for 3D.

## Tests

Add focused tests.

### Model / validation

1. Existing grids without pattern default to rectangular/cubic.
2. Invalid pattern rejected.
3. Triangular lattice with positive spacing validates.
4. Triangular lattice with zero/negative spacing rejected.
5. Honeycomb lattice with positive cell size validates.
6. Honeycomb lattice with zero/negative cell size rejected.
7. Excessive triangular line count rejected/capped.
8. Excessive honeycomb edge count rejected/capped.
9. Save/load preserves lattice pattern.

### SVG / geometry helpers

10. Triangular lattice preview segments are finite.
11. Triangular lattice has three direction families.
12. Honeycomb lattice preview edges are finite.
13. Honeycomb lattice has hexagonal local geometry.
14. 2D preview has z=0.
15. 3D preview lies in stored work-plane frame.

### TikZ export

16. Existing rectangular/cubic TikZ export unchanged.
17. Triangular lattice exports `\foreach` or documented compact loop.
18. Triangular lattice export includes `\clip`.
19. Honeycomb lattice exports `\foreach` or documented compact loop.
20. Honeycomb lattice export includes `\clip`.
21. 3D triangular lattice export uses `canvas is plane`.
22. 3D honeycomb lattice export uses `canvas is plane`.
23. Style/layer preserved.
24. Inline math output has no blank lines.
25. TikZ indentation remains 4 spaces.
26. No NaN/Infinity appears in generated TikZ.

### Regression

27. Existing grid tests still pass.
28. Symbolic variable/grid tests still pass.
29. Save/load old diagrams still pass.

## Documentation

Update docs:

- grid supports rectangular/cubic, triangular, and honeycomb patterns;
- explain local work-plane behavior in 3D;
- explain spacing/cell size convention;
- explain clipping/range behavior;
- explain TikZ `\foreach` export limitations.

## Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Create a 2D rectangular/cubic grid and confirm existing behavior.
2. Create a 2D triangular lattice.
3. Confirm triangular directions look correct.
4. Create a 2D honeycomb lattice.
5. Confirm hexagonal cells look correct.
6. Create a 3D triangular lattice on `xy`, `xz`, or custom work plane.
7. Confirm it lies in the active/stored work plane.
8. Create a 3D honeycomb lattice.
9. Confirm it lies in the work plane.
10. Generate standalone TikZ and confirm `\foreach` / `\clip`.
11. Generate inline math TikZ and confirm no blank lines.
12. Confirm layer/style controls still work.

## Preserve existing behavior

Do not regress:

- existing rectangular/cubic grid;
- symbolic variables;
- symbolic coordinate expressions;
- grid `\foreach` export;
- inline math no-blank-lines;
- 4-space indentation;
- layer-aware output;
- SVG preview;
- save/load;
- undo/redo;
- camera/work-plane behavior.

## Report after implementation

Please report:

- files modified;
- data model changes;
- triangular lattice convention;
- honeycomb lattice convention;
- UI changes;
- SVG preview strategy;
- TikZ export strategy;
- symbolic support policy;
- clipping behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
