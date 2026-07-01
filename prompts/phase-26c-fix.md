# Phase 26C Fix Prompt: Preserve or reject coordinateRef on relative Bézier control points

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

Also run:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 26C introduced coordinate-anchor references (`coordinateRef`) so supported geometry fields can reference global TikZ coordinate anchors and export readable TikZ such as:

```tex
\coordinate (A) at (...);
\draw (A) .. controls (C1) and (C2) .. (B);
```

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`coordinateRef` is accepted on all four top-level `cubicBezier.points`, but relative Bézier TikZ export can drop refs on control points.

Current behavior:

- `src/model/coordinateReferences.ts` accepts `coordinateRef` on all four `cubicBezier.points`.
- However, `src/tikz/generateTikz.ts` exports relative-control cubic Béziers using only:
  - `points[0]` as the start;
  - `points[3]` as the end;
  - relative offset expressions for controls.
- Therefore refs on:
  - `points[1]` / first control;
  - `points[2]` / second control;
  can validate, save, load, and preview, but are not preserved as `(A)` in TikZ output.

This violates Phase 26C’s rule:

```text
A coordinateRef location is supported only if TikZ output preserves the anchor reference.
```

Review’s targeted suggestion:

> Fix Phase 26C relative Bézier coordinate refs: reject `coordinateRef` on unused top-level `cubicBezier.points[1]`/`points[2]` when relative control export is active, or fall back to absolute Bézier export when those controls contain refs. Update validation, unsupported-source detection, and tests.

## Goal

Fix the coordinateRef support gap for cubic Bézier control points.

Required behavior:

1. No accepted `coordinateRef` should be silently dropped from TikZ output.
2. A `coordinateRef` on a cubic Bézier control point must either:
   - be preserved in TikZ output; or
   - be rejected clearly before export.
3. Existing relative Bézier output without coordinateRef control points should remain unchanged.
4. Add regression tests covering `coordinateRef` on `points[1]` and `points[2]`.

Preferred implementation:

```text
When a cubic Bézier segment/control has coordinateRef controls and the normal export would use relative controls, fall back for that segment to absolute-control TikZ syntax so the refs are preserved.
```

Example preferred output:

```tex
\draw (Start) .. controls (C1) and (C2) .. (End);
```

where `(C1)` and `(C2)` are coordinate anchor references.

Acceptable alternative:

```text
Reject coordinateRef on cubic Bézier control points for relative-control Bézier export, with a clear validation error.
```

Preserving references through absolute-control fallback is preferred because it is more useful.

## Scope

This is a targeted Phase 26C fix.

Implement:

- coordinateRef-aware cubic Bézier export;
- or coordinateRef validation rejection for unsupported relative-control cases;
- support-boundary update;
- tests.

Do not implement:

- new Bézier geometry features;
- new coordinate anchor model fields;
- new UI features;
- broad path exporter rewrite;
- broad coordinateRef support expansion;
- new dependencies.

Do not change:

- ordinary relative Bézier export when no coordinateRef controls are present;
- endpoint coordinateRef export;
- coordinate anchor definitions;
- coordinateRef validation for unrelated fields;
- save/load format;
- SVG preview resolution;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect cubic Bézier model and export paths

Inspect:

- `src/model/coordinateReferences.ts`;
- cubic Bézier coordinateRef validation/traversal;
- `src/tikz/generateTikz.ts`;
- relative-control cubic Bézier export;
- absolute-control cubic Bézier export helpers, if any;
- path segment export helpers;
- top-level `cubicBezier` stratum export;
- concatenated path cubic segment export;
- direct path/Bézier model helpers;
- tests for relative Cartesian/polar Bézier export.

The review points to these important paths:

```text
coordinateReferences.ts accepts all cubicBezier.points
generateTikz.ts relative-control export uses only points[0] and points[3]
generateTikz.ts emits relative offset controls
```

Find all export paths where cubic controls can be represented as relative offsets and therefore might not output `(tikzName)` for control refs.

## 2. Define support policy

Choose one policy and implement it consistently.

### Preferred policy: absolute-control fallback when controls contain coordinateRef

If either control point contains a `coordinateRef`:

```text
points[1] has coordinateRef
or
points[2] has coordinateRef
```

then the exporter should not use relative-control syntax for that cubic segment.

Instead, emit absolute controls:

```tex
.. controls (C1) and (C2) .. (End)
```

or equivalent existing absolute syntax.

Requirements:

- `(C1)` and `(C2)` appear in TikZ output when control points are coordinate refs;
- endpoint refs remain preserved;
- coordinate definitions appear before references;
- style/arrow/layer behavior preserved;
- relative-control export remains unchanged for cubic segments without coordinateRef controls.

### Acceptable policy: reject control refs for relative-control export

If absolute fallback is impractical, reject such refs during validation.

Validation error example:

```text
Coordinate references are not supported on cubic Bézier control points when relative-control export is active.
```

Requirements:

- rejected at validation/load time;
- not accepted and silently numericized;
- endpoint refs may remain supported if exported.

Preferred policy remains absolute-control fallback.

## 3. Apply policy across all cubic Bézier export paths

Do not fix only one branch.

Check and update:

- top-level cubic Bézier strata;
- concatenated path cubic segments;
- split style-run export;
- arrow-decorated paths;
- auto-visibility fallback paths;
- any direct cubic path export.

Requirements:

- any exported cubic segment with coordinateRef controls either preserves them or is rejected;
- no path where coordinateRef controls validate but are dropped.

If some specialized sampled export path cannot preserve coordinateRef controls, use existing coordinateRef fallback policy:
- emit ordinary reference-preserving export with a comment; or
- reject before export if ordinary export cannot preserve.

## 4. Update support-boundary validation

If implementing absolute fallback:

- keep coordinateRef support for cubic control points;
- add validation/tests proving TikZ preservation.

If rejecting:

- update `coordinateReferences.ts` support boundary so `points[1]` and `points[2]` are unsupported in the affected cubic representation;
- update save/load validation;
- update UI/direct input options so unsupported control refs are not offered.

Either way, the support boundary must match exporter behavior.

## 5. TikZ syntax requirements for absolute fallback

For a cubic Bézier:

```text
P0 = start
P1 = control1
P2 = control2
P3 = end
```

Expected absolute TikZ syntax:

```tex
(P0) .. controls (P1) and (P2) .. (P3)
```

If this appears inside a longer path, use the current path-construction style.

For coordinateRef controls:

```tex
.. controls (C1) and (C2) ..
```

For mixed numeric/ref controls:

```tex
.. controls (C1) and (1,2) ..
```

or existing coordinate formatting equivalent.

Do not emit relative `+()` controls for a control point that is a coordinateRef unless that syntax still preserves the reference explicitly and correctly.

## 6. Relative Cartesian/polar behavior

Existing Phase 11/Bezier improvements likely preserve relative controls in TikZ for readability.

Do not regress that for non-ref controls.

Required:

- cubic with relative Cartesian controls and no coordinate refs still exports relative Cartesian controls;
- cubic with relative polar controls and no coordinate refs still exports relative polar controls;
- cubic with coordinateRef control falls back to absolute syntax for that segment only, with optional comment if desired.

If a coordinateRef control is explicitly incompatible with "relative" mode, absolute fallback is a safe and readable exception.

## 7. Comments / user visibility

A comment is optional if absolute fallback is obvious and preserves refs.

Acceptable comment:

```tex
% Cubic Bézier controls exported absolutely to preserve coordinate references.
```

Keep comments concise and avoid inline-mode blank lines.

Do not add excessive comments for every segment unless the project already does so.

## 8. Tests

Add focused tests.

### CoordinateRef control preservation tests

1. Top-level cubic Bézier with `points[1] = coordinateRef(C1)` exports `(C1)` in TikZ.

2. Top-level cubic Bézier with `points[2] = coordinateRef(C2)` exports `(C2)` in TikZ.

3. Top-level cubic Bézier with both controls as refs exports both `(C1)` and `(C2)`.

4. Mixed case:
   - control1 ref;
   - control2 numeric;
   exports `(C1)` and numeric control2.

5. Endpoint refs `points[0]` and `points[3]` remain preserved.

6. Coordinate definitions for all referenced anchors appear before the cubic path.

### Relative-export regression tests

7. Cubic Bézier with no coordinateRef controls still exports relative Cartesian controls as before.

8. Cubic Bézier with no coordinateRef controls still exports relative polar controls as before, if supported.

9. Absolute fallback occurs only for the segment/control set that needs it.

10. No coordinateRef controls are silently omitted.

### Concatenated path tests

11. Concatenated path cubic segment with coordinateRef control exports the ref.

12. Split style-run cubic segment with coordinateRef control exports the ref or ordinary fallback preserves it.

13. Arrow-decorated cubic path with coordinateRef controls preserves arrows and refs.

### Validation/support-boundary tests

If preserving refs:

14. `validateDiagram` accepts coordinateRef on cubic control points and TikZ preserves them.

If rejecting refs:

14. `validateDiagram` rejects coordinateRef on unsupported cubic control points with clear error.

For either policy:

15. Missing coordinateRef on cubic control point is rejected if the field is supported.

16. Save/load round-trip preserves supported control refs.

17. Unsupported-source detection matches the chosen policy.

### Formatting tests

18. Inline math output has no blank lines.

19. 4-space indentation preserved.

20. No NaN/Infinity in output.

21. Numeric/global diagrams unaffected.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual checks if practical:

1. Create coordinate anchors `C1` and `C2`.
2. Create a cubic Bézier whose control points reference `C1` and `C2`.
3. Generate TikZ.
4. Confirm output contains:

```tex
controls (C1) and (C2)
```

or the chosen valid equivalent.

5. Confirm no relative-control syntax silently drops the refs.
6. Create a normal relative-control cubic without refs.
7. Confirm it still exports relatively.

## 10. Preserve existing behavior

Do not regress:

- coordinateRef model;
- coordinate anchor definitions;
- endpoint coordinateRef export;
- path/label/point/simple sheet ref export;
- unsupported template/arc center rejection from prior fix;
- relative Bézier export for non-ref controls;
- arrow export;
- braiding export;
- auto-visibility fallback behavior;
- inline no-blank-lines;
- 4-space indentation;
- save/load;
- undo/redo.

## 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 12. Report after implementation

Please report:

- files modified;
- root cause of dropped cubic control refs;
- chosen policy:
  - absolute-control fallback; or
  - validation rejection;
- export behavior for top-level cubic Béziers;
- export behavior for concatenated path cubic segments;
- relative-export regression results;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
