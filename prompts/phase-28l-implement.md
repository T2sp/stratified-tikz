# Phase 28L Implementation Prompt: Correct triangular lattice geometry for arbitrary spacing

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
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat lint as a required gate while the existing repository-wide lint debt remains.
## Project context

You are working on the current `main` branch of:

```text
https://github.com/T2sp/stratified-tikz
```

The current repository contains the relevant implementation areas:

- `src/ui/svgPreviewExport.ts` for SVG Preview export;
- `src/model/grids.ts` for compact grid/lattice geometry and validation;
- `src/rendering/SvgDiagram.tsx` and related rendering helpers for SVG Preview;
- `src/tikz/generateTikz.ts` for generated TikZ source;
- tests under `tests/`.

Preserve all current behavior unless this prompt explicitly changes it:

- SVG Preview remains the primary editing canvas;
- Export SVG remains a Preview edge action;
- 2D/3D camera, zoom, and pan behavior;
- layer visibility/filtering;
- coordinate anchors and coordinate refs;
- symbolic and work-plane-local coordinates;
- rectangular and honeycomb grids;
- standalone and inline-math TikZ export;
- inline-math output contains no blank lines;
- TikZ indentation remains 4 spaces;
- save/load and undo/redo.


## Goal

Fix Add grid triangular-lattice rendering/export so the lattice remains correctly aligned for every valid spacing, not only one special spacing value.

## Current contract

The project documentation defines triangular lattice spacing as:

```text
spacing = uRange.step
```

and describes three line families:

```text
horizontal
+60 degrees
-60 degrees
```

Keep that contract.

## Suspected bug class

Audit the triangular-grid code for unit-spacing assumptions such as:

```text
0.5
sqrt(3) / 2
row % 2 ? 0.5 : 0
```

that are not multiplied by the configured spacing, or for spacing being applied twice in another branch.

Also audit inconsistencies between:

- model geometry;
- SVG Preview rendering;
- 2D TikZ compact export;
- 3D work-plane TikZ compact export.

Do not patch a single observed spacing. Establish one canonical lattice geometry.

## Canonical geometry

For positive finite spacing `s`, use a single shared definition:

```text
a = (s, 0)
b = (s/2, sqrt(3)*s/2)
h = sqrt(3)*s/2
```

Every triangular lattice vertex should be representable as:

```text
origin + i*a + j*b
```

for integer `i,j`.

The three line families must pass through those same vertices.

Requirements:

- apply `s` exactly once;
- half-row offset is `s/2`, never bare `0.5`;
- vertical row separation is `sqrt(3)*s/2`;
- preserve the saved grid frame and local origin/phase;
- respect non-zero ranges and arbitrary rectangular clip bounds;
- avoid floating-point drift with a documented epsilon;
- keep generation bounded by existing grid caps.

## Shared helper

Prefer adding pure helpers in `src/model/grids.ts`, for example:

```ts
triangularLatticeMetrics(spacing)
triangularLatticeBasis(spacing)
sampleTriangularLatticeSegments(grid, limits)
```

Use the same canonical metrics in SVG Preview and TikZ export.

If compact TikZ loops cannot literally call TypeScript helpers, derive their formula from the same named constants/contract and add cross-path tests.

Avoid independent, subtly different formulas in renderer and exporter.

## Range/phase policy

Audit the meaning of:

```text
uRange.min/max/step
vRange.min/max/step
clip
```

Keep current persisted semantics.

For triangular lattices:

- `uRange.step` is the spacing;
- line/vertex indices should be derived in normalized integer lattice coordinates;
- range minima and clip minima must not create a phase shift that depends on spacing;
- do not use a raw world/local coordinate as an integer row parity without normalizing by `s`.

Document any legacy `vRange.step` behavior. Do not silently reinterpret saved JSON.

## SVG Preview

Fix the Preview so:

- equilateral cells stay equilateral for every valid spacing;
- all three line families intersect at common lattice vertices;
- changing spacing scales the lattice about the same local origin instead of translating one family;
- 3D work-plane projection uses the corrected local geometry;
- clip behavior remains exact.

## TikZ export

Fix compact triangular-lattice TikZ output so it matches Preview.

Requirements:

- all spacing-dependent offsets are scaled by `s`;
- no hard-coded unit-spacing phase remains;
- 2D and `canvas is plane` 3D output share the same lattice convention;
- generated loops stay compact;
- no expansion into persisted individual paths;
- existing comments/formatting remain readable.

## Tests

Add geometry-level tests, not only string snapshots.

For each spacing:

```text
0.25
0.5
1
1.3
2
```

test:

1. Nearest-neighbor lattice edge length equals `s` within tolerance.
2. A basic cell is equilateral.
3. Horizontal row separation equals `sqrt(3)*s/2`.
4. Odd/even row offset equals `s/2`.
5. The +60 and -60 line families intersect horizontal lines at the same lattice vertices.
6. Changing spacing does not introduce an unrelated translation/phase shift.
7. Non-zero `uRange.min` and `vRange.min` preserve the documented origin/phase.
8. Non-zero and asymmetric clip bounds work.
9. 2D Preview geometry is finite.
10. 3D work-plane projected geometry is finite.
11. TikZ compact formula uses the same scaled offsets.
12. SVG Preview and a sampled interpretation of emitted TikZ agree for representative indices.
13. Invalid zero/negative/non-finite spacing is rejected.
14. Existing grid line-count caps still terminate.
15. Rectangular lattice behavior is unchanged.
16. Honeycomb lattice behavior is unchanged.
17. Save/load round-trip is unchanged.
18. Inline TikZ output contains no blank lines.
19. TikZ indentation remains 4 spaces.

Include a direct regression fixture for the spacing value that previously looked correct and at least two values that previously shifted.

## Documentation

Update the grid documentation to state the canonical basis explicitly:

```text
(s,0), (s/2,sqrt(3)s/2)
```

and clarify that `uRange.step` is the triangular spacing.

## Report after implementation

Please report:

- files modified;
- reproduced root cause;
- canonical basis/phase policy;
- shared geometry helpers;
- SVG changes;
- TikZ loop changes;
- spacing cases tested;
- test results;
- build results;
- remaining limitations.
