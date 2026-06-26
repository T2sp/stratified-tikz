# Phase 25D Implementation Prompt: TikZ export using canvas-is-plane scopes for local symbolic coordinates

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

Phase 24 is complete or near complete.

The editor now supports:

- 2D and 3D diagrams;
- symbolic variables and symbolic global coordinate expressions;
- direct input and cursor input;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes;
- camera controls;
- grids/lattices;
- arrows and 2D braiding controls;
- paths, sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- preview-centered UI;
- layer/style/variable managers;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 25 adds symbolic work-plane-local coordinates.

Main idea:

- In 3D direct input and Inspector coordinate editing, users can enter coordinates in the active/stored work-plane-local 2D coordinate system.
- The local coordinates accept symbolic scalar expressions just like global coordinates.
- SVG preview uses finite numeric preview values.
- TikZ export should preserve local symbolic expressions where practical by emitting compatible paths/sheets inside `canvas is plane` scopes.
- Direct/symbolic input should not be snapped by cursor snapping.

Important user decision:

- During **global translation** of an object that contains work-plane-local symbolic coordinates, move that object's own frame origin by the global translation vector.
- Do **not** expand local symbolic expressions into global symbolic coordinates during global translation.
- Do **not** mutate a shared global work plane; move each object's stored frame snapshot origin.
- During **work-plane-local translation** of such coordinates, update local scalar expressions `a`, `b` by adding local deltas.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Work-plane-local symbolic coordinate data affects geometry/export and must be saved.
- UI-only draft/open state should not be stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Export work-plane-local symbolic coordinates in readable TikZ using `canvas is plane` scopes when possible.

## Prerequisites

Phases 25A-25C are complete.

## Scope

Implement:

- same-frame detection for paths/sheets;
- `canvas is plane` scope export;
- local symbolic coordinate formatter;
- fallback/reject policy for mixed frames;
- tests.

Do not implement:

- global symbolic expansion for every mixed-frame case unless explicitly chosen;
- symbolic mesh formulas for Coons/ruled sampled surfaces;
- new TikZ libraries beyond existing `3d` library usage.

## Preferred TikZ output

For compatible local coordinates:

```tex
\begin{scope}[
    plane origin={(...)},
    plane x={(...)},
    plane y={(...)},
    canvas is plane
]
    \draw ({\R * cos(\q)}, {\R * sin(\q)}) -- ...;
\end{scope}
```

Requirements:

- local `a,b` expressions preserved;
- use variable macro formatter:
  - `R -> \R`;
  - `q -> \q`;
- frame emitted with finite numeric preview values initially, unless symbolic frame export is already safe;
- required TikZ `3d` library handled according to existing conventions;
- layer-aware output preserved;
- inline output no blank lines;
- 4-space indentation.

## Same-frame detection

A path/sheet can be exported in one local scope if all local coordinates share the same frame.

Compare frames by:

- frame ID if available; otherwise
- preview numeric origin/u/v/normal within tolerance.

Requirements:

- same-frame local coordinates export in one scope;
- mixed global/local or mixed-frame path is rejected or falls back according to documented policy.

Preferred MVP:

- reject mixed-frame local export for path/sheet creation/editing before export, or export with global preview fallback only with explicit comment.
- Do not silently lose symbolic intent.

## Geometry coverage

Support local symbolic export for:

- points;
- labels;
- paths;
- path templates where feasible;
- polygon sheets;
- grids/lattices.

For sampled mesh surfaces such as Coons/Ruled:

- may continue exporting numeric preview mesh;
- preserve saved symbolic source;
- document limitation.

## Tests

Add tests:

1. Local symbolic point exports in canvas scope or valid local syntax.
2. Local symbolic path exports with local expressions.
3. `R*cos(q)` exports as `{\R * cos(\q)}` or equivalent.
4. Same-frame path emits one `canvas is plane` scope.
5. Mixed-frame path rejected or documented fallback tested.
6. Layer output preserved.
7. Inline output no blank lines.
8. 4-space indentation.
9. Required `3d` library included/commented.
10. Numeric/global output unchanged.
11. Coons/Ruled numeric mesh fallback documented/tested if applicable.

## Documentation

Document export policy, mixed-frame limitations, and mesh fallback.

## Report after implementation

Please report:

- files modified;
- local TikZ formatter;
- canvas scope structure;
- same-frame detection;
- mixed-frame policy;
- geometry coverage;
- tests added/updated;
- test results;
- build results;
- limitations.
