# Phase 20F Fix Prompt: Subdivide straight line/polyline segments for curve occlusion

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

## Context

You are working on the StratifiedTikZ project.

Phase 20F implemented approximate curve occlusion and hidden segment styling.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Straight polyline and line path segments are not subdivided before occlusion classification.

Current behavior:

- `src/rendering/curveOcclusion.ts` samples polylines only by existing point pairs.
- Line path segments return only start/end.
- The midpoint classifier then marks the entire straight segment as either hidden or visible.
- A simple straight line crossing behind a surface cannot split into:

```text
visible -> hidden -> visible
```

unless the user manually inserted vertices around the occlusion interval.

This affects both:

- SVG preview, because it consumes the same occlusion result;
- TikZ export, because hidden/visible segment output consumes the same occlusion result.

The review spot-check found a straight line crossing behind a test sheet returned:

```text
hidden 1
```

instead of split visible/hidden/visible segments.

## Goal

Fix Phase 20F line/polyline occlusion sampling.

Straight polyline and line path segments should be subdivided using the bounded `curveSegmentSamples` setting before midpoint occlusion classification.

A single straight segment crossing behind a surface should be able to split into visible/hidden/visible runs.

## Scope

This is a targeted Phase 20F fix.

Implement:

- subdivision of straight polyline segments;
- subdivision of line path segments;
- preservation of existing bounded sampling and caps;
- preservation of style overrides;
- preservation of `maxCurveSegmentsPerCurve`;
- tests for a single straight segment crossing behind a surface and splitting into visible/hidden/visible;
- SVG/TikZ hidden output regression tests.

Do not implement:

- exact analytic line/surface intersection;
- exact clipping at the true occlusion boundary;
- BSP splitting;
- new visibility UI;
- new curve kinds;
- new dependencies;
- broad rendering/export refactors.

Do not change:

- curve occlusion enable/disable semantics;
- surface point-in-projected-face logic;
- depth comparison convention;
- hidden style semantics;
- layer/depth mode behavior;
- original curve geometry;
- save/load format;
- non-occluded curve output when visibility is disabled.

## 1. Inspect current curve occlusion sampling

Inspect:

- `src/rendering/curveOcclusion.ts`;
- polyline sampling around the current point-pair logic;
- line path segment sampling;
- cubic/arc/template sampling;
- `curveSegmentSamples` option;
- `maxCurveSegmentsPerCurve` handling;
- SVG occlusion rendering path in `SvgDiagram.tsx`;
- TikZ hidden/visible export path in `generateTikz.ts`.

Identify where:

- polylines are converted to occlusion segments;
- line path segments are converted to occlusion segments;
- midpoint classification is applied;
- visible/hidden adjacent sampled segments are grouped into runs.

## 2. Subdivide straight polyline segments

For each polyline edge:

```text
P0 -> P1
```

generate multiple subsegments using `curveSegmentSamples`.

For example, if `curveSegmentSamples = n`, generate points:

```text
P(t_i) = (1 - t_i) P0 + t_i P1
```

for:

```text
t_i = i / n, i = 0..n
```

and subsegments:

```text
P(t_0) -> P(t_1)
P(t_1) -> P(t_2)
...
P(t_{n-1}) -> P(t_n)
```

Requirements:

- `n` must be finite positive integer after validation/clamping;
- no NaN/Infinity generated;
- original polyline geometry is not mutated;
- subsegments preserve source curve ID and style context;
- subsegments are in path order;
- zero-length edges are skipped or handled safely according to existing policy.

## 3. Subdivide straight line path segments

For each concatenated path line segment:

```text
start -> end
```

generate the same kind of bounded subsegments.

Requirements:

- line segment style override, if present, is preserved on all generated subsegments;
- segment order is preserved;
- start/end exactly preserved at the boundary of sampled points;
- no generated non-finite points.

## 4. Preserve cubic/arc/template sampling behavior

Do not regress existing sampling for:

- cubic Bézier segments;
- arc segments;
- circle/ellipse templates;
- grid curves if they participate;
- other sampled curve types.

If these already use `curveSegmentSamples`, keep behavior.

If they use a different bounded setting, do not change it unless necessary.

## 5. Preserve maxCurveSegmentsPerCurve

The subdivision fix must respect the existing cap:

```text
maxCurveSegmentsPerCurve
```

or equivalent.

Requirements:

- generated subsegments per curve must be bounded;
- if a curve has many polyline edges, total emitted occlusion segments must not exceed the cap;
- when the cap is reached, fail safely or coarsen sampling according to existing policy;
- do not freeze the editor/export for large polylines.

Preferred behavior:

- calculate an effective samples-per-edge based on both `curveSegmentSamples` and `maxCurveSegmentsPerCurve`;
- or generate until cap and report/truncate consistently.

Document chosen behavior in code/report.

## 6. Preserve style overrides

If a path segment has a style override:

- every sampled subsegment from that original segment should carry the same style override;
- visible/hidden output should use:
  - original style for visible subsegments;
  - hidden style merged/overlaid according to existing hidden style policy for hidden subsegments.

Do not lose segment-level style information during subdivision.

This matters for:

- concatenated paths;
- mixed-style paths;
- line segments with custom style;
- future grid/path outputs.

## 7. Visible/hidden run grouping

After subdivision and midpoint classification:

- adjacent sampled subsegments with the same visibility class should be grouped into runs;
- a line crossing behind a surface should produce multiple runs when classification changes;
- run order must follow the original curve direction.

Expected for the key regression:

```text
visible run
hidden run
visible run
```

depending on geometry.

Do not output each tiny sample as an isolated draw command if adjacent classifications match. Preserve or improve existing grouping.

## 8. SVG output

SVG should use the corrected occlusion result.

Requirements:

- visible runs render with normal style;
- hidden runs render with hidden style;
- straight partially hidden curve visibly splits;
- original curve is not mutated;
- disabled visibility mode preserves normal output.

## 9. TikZ output

TikZ export should use the corrected occlusion result.

Requirements:

- visible runs emit normal draw/path commands;
- hidden runs emit hidden style draw/path commands;
- partially hidden straight segment exports both visible and hidden pieces;
- style overrides preserved;
- inline math output still has no blank lines;
- indentation remains 4 spaces;
- no NaN/Infinity output;
- disabled visibility mode preserves prior output.

It is acceptable that sampled straight pieces produce multiple shorter TikZ line segments in auto-visibility mode.

## 10. Tests

Add focused tests.

### Sampling tests

1. Polyline edge subdivision creates more than one subsegment when `curveSegmentSamples > 1`.
2. Line path segment subdivision creates more than one subsegment when `curveSegmentSamples > 1`.
3. Subdivision preserves first start and final end exactly.
4. Subdivision produces finite points.
5. Zero-length line segment is handled safely.
6. `maxCurveSegmentsPerCurve` is respected.

### Occlusion regression tests

7. A single straight polyline segment crossing behind a surface splits into visible/hidden/visible runs.

8. A single straight line path segment crossing behind a surface splits into visible/hidden/visible runs.

9. The same geometry with visibility disabled does not split into hidden runs.

10. A fully visible straight segment remains visible.

11. A fully hidden straight segment remains hidden.

### Style tests

12. A line path segment style override is preserved after subdivision.

13. Hidden style is applied to hidden subdivided line segments.

14. Visible style is applied to visible subdivided line segments.

### SVG/TikZ tests

15. SVG hidden output includes hidden style attributes for the hidden run.

16. TikZ hidden output includes hidden style for the hidden run.

17. TikZ output includes both visible and hidden draw/path commands for the partially hidden straight segment.

18. Inline TikZ output with subdivided hidden segments has no blank lines.

19. TikZ output contains no NaN/Infinity.

### Regression tests

20. Existing cubic curve occlusion tests still pass.
21. Existing arc/template occlusion tests still pass if present.
22. Existing layer-vs-depth mode tests still pass.
23. Existing disabled-mode preservation tests still pass.

## 11. Constructing the key test geometry

Use a simple deterministic geometry where a straight segment crosses behind a rectangular sheet.

Example concept:

- a surface face projects to a square in the middle of the screen;
- a straight curve crosses through that projected square;
- the curve is behind the surface inside the square;
- the curve is in front/outside or not covered at both ends.

The expected occlusion classification should have at least three runs:

```text
visible, hidden, visible
```

If the actual geometry produces:

```text
visible, hidden
```

or:

```text
hidden, visible
```

because of endpoints, adjust geometry to cross through and out of the surface projection.

The test should not depend on fragile pixel rendering; test the pure occlusion result if possible.

## 12. Documentation/comments

Add a short comment near the sampling function:

- straight segments must be subdivided for midpoint occlusion to detect partial occlusion;
- subdivision is bounded by `curveSegmentSamples` and `maxCurveSegmentsPerCurve`;
- this is still approximate, not analytic clipping.

Update docs only if Phase 20F docs mention sampling limitations.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Create or open a 3D diagram with a surface sheet.
2. Create one long straight curve crossing behind the surface.
3. Enable curve occlusion / auto visibility.
4. Confirm the curve has visible portions outside the surface and hidden/dotted portion behind it.
5. Confirm the user does not need to insert vertices around the hidden interval.
6. Generate TikZ.
7. Confirm hidden and visible segments are both emitted.
8. Switch visibility off.
9. Confirm the curve renders as a normal uninterrupted curve.

## 14. Preserve existing behavior

Do not regress:

- visibility options;
- hidden curve style persistence;
- SVG stroke mapping;
- TikZ hidden style emission;
- depth comparison;
- point-in-projected-face testing;
- mutation avoidance;
- disabled export behavior;
- inline no-blank-line behavior;
- 4-space indentation;
- curve/path style overrides;
- layer/depth mode behavior;
- save/load;
- undo/redo.

## 15. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 16. Report after implementation

Please report:

- files modified;
- root cause of the unsplit straight-segment occlusion;
- how polyline edges are subdivided;
- how line path segments are subdivided;
- how `curveSegmentSamples` is used;
- how `maxCurveSegmentsPerCurve` is preserved;
- how style overrides are preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
