# Phase 15B Fix Prompt: Render and export filledRegion / workPlaneFilledSheet

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

## Context

You are working on the StratifiedTikZ project.

Phase 15B implemented creation of filled objects from selected closed paths.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

Medium issues:

1. Filled objects are created in the model but are not visible in the editor canvas.

   Current behavior:
   - `filledRegion` / `region` strata render as an empty `<g>`.
   - `workPlaneFilledSheet` also renders as an empty `<g>`.
   - Therefore, a created fill cannot be visually inspected.
   - After selection changes, it cannot be reselected from the canvas.

2. Generated TikZ does not export the new filled objects.

   Current behavior:
   - 2D `filledRegion` strata are omitted from `generateTikz2D`.
   - 3D `workPlaneFilledSheet` emits only a deferred-output comment instead of a styled filled path.
   - Therefore, created filled objects are not represented in generated TikZ.

What already looks correct:

- UI workflow exists for picking selected concatenated paths.
- Fill rule can be chosen:
  - `nonzero`;
  - `evenOdd`.
- Pure creation helper creates:
  - 2D codim-0 `filledRegion`;
  - 3D codim-1 `workPlaneFilledSheet`.
- Multiple boundaries and `evenOdd` are stored.
- Open paths, non-finite paths, duplicate sources, wrong source types/codims, and non-coplanar 3D boundaries are rejected.
- Boundaries are copied from source paths.
- Source paths remain unchanged.
- Commit wiring selects the created object and uses undo/redo history.

## Goal

Implement SVG rendering and TikZ export for:

- 2D `filledRegion`;
- 3D `workPlaneFilledSheet`.

Created filled objects should be:

- visible in the SVG preview;
- selectable/reselectable from the canvas;
- rendered with correct style;
- exported to TikZ as filled closed paths;
- compatible with multiple boundaries and `evenOdd` fill rule;
- compatible with Phase 9B layer-aware output.

This is a targeted Phase 15B fix.

## Scope

Implement:

- SVG rendering for `filledRegion`;
- SVG rendering for `workPlaneFilledSheet`;
- TikZ export for `filledRegion`;
- TikZ export for `workPlaneFilledSheet`;
- tests covering one-boundary and multi-boundary fills.

Do not implement:

- new fill creation workflows;
- new boundary editing UI;
- live linked boundaries;
- boolean operations;
- non-planar 3D filling;
- curved surface primitives;
- hemisphere/saddle features;
- broad rendering refactors;
- new dependencies.

Do not change:

- existing fill creation semantics;
- copy-on-create boundary behavior;
- validation policy for open/non-coplanar paths;
- source path data;
- existing concatenated path behavior;
- existing polygon sheet behavior;
- layer-aware TikZ semantics;
- coordinate naming semantics;
- save/load format unless absolutely necessary.

## 1. SVG rendering for 2D filledRegion

Inspect:

- `src/rendering/SvgDiagram.tsx`;
- any SVG helper modules;
- existing sheet/curve rendering helpers;
- selection/highlight logic.

Implement visible SVG rendering for 2D `filledRegion`.

Requirements:

- render all boundary components;
- support line and cubic Bézier segments;
- render as one SVG `<path>` where possible;
- use `fillRule="evenodd"` when `fillRule === "evenOdd"`;
- use nonzero/default fill rule when `fillRule === "nonzero"`;
- preserve fill color;
- preserve fill opacity;
- preserve stroke color;
- preserve stroke opacity;
- preserve stroke width;
- preserve line style if region style supports it;
- respect layer ordering/filtering;
- selectable/reselectable from the canvas;
- selected highlight works or at least selection visibly indicates the region;
- no preview-only state is stored in `Diagram`.

Expected SVG path behavior:

- each boundary is closed;
- multiple boundaries are included in the same path data if practical;
- if using multiple path elements, `evenOdd` semantics must still be correct.

## 2. SVG rendering for 3D workPlaneFilledSheet

Implement visible SVG rendering for 3D `workPlaneFilledSheet`.

Requirements:

- project boundary points using the existing camera/projection pipeline;
- render the projected boundary as a filled closed path;
- support multiple boundary components;
- use `fillRule="evenodd"` for `evenOdd`;
- preserve fill/stroke/opacity;
- respect layer ordering/filtering;
- selectable/reselectable from the canvas;
- do not render as an empty `<g>`;
- do not require non-planar triangulation.

Important:
This Phase 15B fix is for planar work-plane-local filled sheets.

Do not implement general non-planar surface filling here.

## 3. Build path data from boundary segments

Add or reuse a helper to convert closed path boundary segments to SVG/TikZ path syntax.

Supported segment kinds:

- line;
- cubic Bézier.

Required:

- preserve segment order;
- preserve boundary order;
- close each boundary;
- reject or safely ignore invalid segment data only if validation somehow missed it;
- avoid generating malformed path commands.

Suggested helpers:

```ts
svgPathDataFromClosedBoundaries(boundaries, projection)
tikzPathFromClosedBoundaries(boundaries, coordinateNamesOrInlineCoords)
```

Exact names can differ.

Keep helpers pure where possible and add tests.

## 4. TikZ export for 2D filledRegion

Implement TikZ export for 2D `filledRegion`.

Expected behavior:

- emitted in the appropriate layer block;
- exported as a filled closed path;
- supports one boundary;
- supports multiple boundaries;
- supports `evenOdd`.

For `evenOdd`, include TikZ option:

```tex
even odd rule
```

Expected shape:

```tex
\filldraw[<style>, even odd rule]
  (p0) -- (p1) .. controls (...) and (...) .. (...) -- cycle
  (q0) -- (q1) -- ... -- cycle;
```

or equivalent.

Requirements:

- preserve fill color;
- preserve fill opacity;
- preserve stroke color;
- preserve stroke opacity;
- preserve stroke width;
- preserve line style if supported;
- preserve Phase 9A coordinate-name behavior;
- preserve Phase 9B layer-aware output;
- no dangling coordinate references;
- no selection/highlight output;
- no source path references.

## 5. TikZ export for 3D workPlaneFilledSheet

Implement TikZ export for 3D `workPlaneFilledSheet`.

Preferred behavior:

If the sheet has a reliable work-plane frame:

- export inside a TikZ `3d` library canvas-plane scope;
- use `plane origin`, `plane x`, `plane y`, and `canvas is plane`;
- write local 2D boundary coordinates inside the scope;
- use `even odd rule` when needed.

Example:

```tex
\begin{scope}[
  plane origin={(Ox,Oy,Oz)},
  plane x={(Px,Py,Pz)},
  plane y={(Qx,Qy,Qz)},
  canvas is plane
]
  \filldraw[<style>, even odd rule]
    (a0,b0) -- (a1,b1) -- cycle
    (c0,d0) -- (c1,d1) -- cycle;
\end{scope}
```

Requirements for scoped export:

- add `\usetikzlibrary{3d}` only when needed, or according to existing project convention;
- compute local 2D coordinates from the stored plane frame;
- support line and cubic Bézier boundary segments;
- preserve style/layer;
- no independent source-path references;
- no editor-only state.

Fallback behavior:

If local scope export is not reliable for some valid existing object:

- export using absolute 3D coordinates;
- still emit a valid filled closed path;
- report/document the fallback.

Do not leave `workPlaneFilledSheet` as a comment-only deferred output.

## 6. Style mapping

Inspect existing style generation for:

- sheets;
- regions, if any;
- curves.

Ensure filled objects use the correct style mapping.

For 2D `filledRegion`:

- use `RegionStyle` if present;
- if `RegionStyle` mirrors sheet style, map fill/stroke/opacity accordingly.

For 3D `workPlaneFilledSheet`:

- use `SheetStyle`.

Required:

- fill color and opacity reflected in SVG and TikZ;
- stroke color and opacity reflected in SVG and TikZ;
- line width reflected;
- line style reflected if applicable;
- invalid style values still rejected by existing validation.

## 7. Selection / hit behavior

Created filled objects must be selectable from the canvas.

Ensure:

- SVG filled path has appropriate event handlers;
- click selects the filled object;
- clicking fill area, not only boundary, can select it if feasible;
- layer filter behavior works;
- background click still clears selection;
- preview-only highlights remain separate from diagram data.

If click-to-select filled area is hard, boundary-only selection is acceptable only as a temporary limitation, but report it clearly. Preferred: filled area is clickable.

## 8. Tests

Add focused tests.

Required SVG/rendering tests, pure where possible:

1. 2D `filledRegion` produces non-empty SVG path data.
2. 2D `filledRegion` with one boundary is visible/renderable.
3. 2D `filledRegion` with multiple boundaries and `evenOdd` uses even-odd fill rule.
4. 3D `workPlaneFilledSheet` produces non-empty projected SVG path data.
5. 3D `workPlaneFilledSheet` with multiple boundaries and `evenOdd` uses even-odd fill rule.
6. Filled objects are not rendered as empty `<g>` only, if testable.

Required TikZ tests:

7. 2D one-boundary `filledRegion` exports as a filled closed path.
8. 2D multi-boundary `filledRegion` with `evenOdd` exports `even odd rule`.
9. 3D one-boundary `workPlaneFilledSheet` exports a styled filled path.
10. 3D multi-boundary `workPlaneFilledSheet` with `evenOdd` exports `even odd rule`.
11. 3D local-scope export includes `canvas is plane` if that strategy is used.
12. TikZ output preserves fill/stroke opacity/color.
13. TikZ output is inside the correct layer block.
14. No deferred-output-only comments remain for valid filled objects.
15. No NaN/Infinity appears in generated TikZ.
16. Existing concatenated path and polygon sheet exports are not regressed.

Selection tests if practical:

17. filledRegion can be selected from SVG.
18. workPlaneFilledSheet can be selected from SVG.

Do not add heavy React dependencies if the project avoids them; factor pure helpers where possible.

## 9. Documentation

Update docs if appropriate:

- `docs/TIKZ_OUTPUT.md`;
- `docs/DATA_MODEL.md`;
- roadmap notes if Phase 15B status is tracked.

Document:

- 2D filled regions export as filled closed paths;
- 3D work-plane-filled sheets export as filled closed paths, preferably in `canvas is plane` scope;
- multiple boundaries use `even odd rule`;
- boundaries are copied, not live references;
- current limitations.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Create a 2D closed concatenated path.
2. Create a filled region from it.
3. Confirm the filled region is visible.
4. Click away and reselect the filled region from the canvas.
5. Confirm TikZ output contains a filled closed path.

6. Create two nested 2D closed paths.
7. Create a filled region with `evenOdd`.
8. Confirm the hole/nested region behaves as expected visually.
9. Confirm TikZ output contains `even odd rule`.

10. Create a 3D closed path on a work plane.
11. Create a `workPlaneFilledSheet`.
12. Confirm it is visible in SVG.
13. Confirm it can be reselected.
14. Confirm TikZ output contains a filled path, not only a deferred comment.

15. Create multiple 3D coplanar closed paths.
16. Create a sheet with `evenOdd`.
17. Confirm SVG and TikZ reflect multiple boundaries.

18. Confirm existing source paths remain unchanged.
19. Confirm undo/redo still works.
20. Confirm layer filter behavior still works.

## 11. Preserve existing behavior

Do not regress:

- fill creation helper;
- boundary validation;
- copy-on-create semantics;
- concatenated paths;
- polygon sheets;
- curves/points/labels;
- layer-aware TikZ output;
- coordinate naming;
- save/load;
- undo/redo;
- SVG preview for existing objects;
- TikZ output for existing objects;
- work-plane-local Bézier scoped export.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## 13. Report after implementation

Please report:

- files modified;
- SVG rendering strategy for `filledRegion`;
- SVG rendering strategy for `workPlaneFilledSheet`;
- TikZ export strategy for `filledRegion`;
- TikZ export strategy for `workPlaneFilledSheet`;
- how multiple boundaries are handled;
- how `evenOdd` is implemented in SVG and TikZ;
- how style opacity/color is preserved;
- how layer-aware output is preserved;
- how selection/reselection works;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
