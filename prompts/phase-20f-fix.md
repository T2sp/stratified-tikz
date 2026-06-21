# Phase 20F Fix Prompt: Prevent backtracking merge erasure and avoid truncating capped occlusion samples

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
- Two Medium issues remain.

## Medium issue 1: Backtracking curves can be erased by collinear merge

In `src/rendering/curveOcclusion.ts`, adjacent collinear runs are merged even when the curve reverses direction.

Example:

```text
A -> B -> A
```

If the whole curve is visible, this valid polyline can be merged into a single zero-length segment:

```text
A -> A
```

Result:

- SVG occlusion output erases the curve;
- TikZ occlusion output erases the curve.

Root cause:

- collinear merge checks geometry too weakly;
- it does not check same-direction / monotonic extension;
- it may merge runs across different source/merge keys;
- it collapses a backtracking path.

Required fix:

- prevent cross-key collinear merges when the next segment reverses direction;
- do not merge if the merged result would collapse the run;
- do not merge across incompatible `mergeKey`s;
- preserve valid backtracking geometry.

## Medium issue 2: Capped sampling truncates long curves

In `src/rendering/curveOcclusion.ts`, capped sampling currently returns only the sampled prefix.

Callers render/export that prefix when non-empty.

With default settings, a 30-edge visible polyline emitted only through something like:

```text
x = 21.333...
```

instead of the original:

```text
x = 30
```

This became reachable after Phase 20F started subdividing straight line/polyline segments.

Required fix:

- capped occlusion classification must not silently truncate curves;
- if occlusion sampling would exceed the cap, either:
  - fall back to original curve rendering/export; or
  - include/preserve the unsampled remainder safely.
- The preferred fix is to fall back to original non-occluded rendering/export for that curve and optionally report/mark occlusion as skipped.
- Do not emit only a sampled prefix.

## Goal

Fix Phase 20F curve occlusion so that:

1. Valid backtracking curves such as `A -> B -> A` are preserved.
2. Collinear merge only merges same-direction, monotonic, compatible segments.
3. Sampling caps never truncate curves.
4. When a curve exceeds the occlusion sampling cap, output remains complete and safe.
5. SVG and TikZ output remain consistent.
6. Disabled visibility behavior remains unchanged.
7. Inline TikZ output still has no blank lines.
8. TikZ indentation remains 4 spaces.

## Scope

This is a targeted Phase 20F fix.

Implement:

- safe collinear merge logic;
- `mergeKey`-compatible merging only;
- non-reversing / monotonic-extension check;
- cap behavior that preserves complete curve output;
- tests for backtracking curves and long capped polylines.

Do not implement:

- exact analytic curve/surface intersection;
- exact clipping at true occlusion boundaries;
- BSP splitting;
- new visibility UI;
- new curve kinds;
- new geometry features;
- broad SVG/TikZ export refactors;
- new dependencies.

Do not change:

- visibility option semantics;
- hidden curve style semantics;
- surface face depth logic;
- point-in-projected-face logic;
- original curve geometry;
- save/load format;
- disabled visibility output behavior;
- layer/depth mode semantics.

## 1. Inspect current occlusion run merging

Inspect:

- `src/rendering/curveOcclusion.ts`;
- run grouping logic;
- collinear merge logic around the reviewed line;
- `mergeKey` or equivalent source/style identity;
- SVG path consumption in `SvgDiagram.tsx`;
- TikZ occlusion export consumption in `generateTikz.ts`.

Find where adjacent visible/hidden segments are merged.

The merge must not:

- merge segments with different `mergeKey`;
- merge segments with different visibility class;
- merge segments with different style override context;
- merge segments when direction reverses;
- produce a zero-length or collapsed segment unless the original geometry was zero-length and already handled safely.

## 2. Add same-direction / monotonic-extension check

For adjacent line-like sampled subsegments:

```text
s1: A -> B
s2: B -> C
```

It is safe to merge into:

```text
A -> C
```

only if:

1. `B` matches the end of `s1` and start of `s2`;
2. the direction vectors point the same way;
3. the combined segment length is not smaller than either component in a way that indicates backtracking;
4. the merge does not collapse to zero;
5. all merge identity/style keys match.

Suggested vector check:

```ts
v1 = B - A
v2 = C - B
dot(v1, v2) > epsilon
crossMagnitude(v1, v2) <= collinearTolerance
```

or equivalent.

For backtracking:

```text
A -> B -> A
```

the dot product is negative, so do not merge.

If existing geometry helpers support vector dot/cross/length, reuse them.

## 3. Respect mergeKey

The review explicitly mentions:

> Cross-key merging needs a same-direction/monotonic-extension check, or should only merge segments with the same `mergeKey`.

Implement both if practical:

- only merge if `mergeKey` is identical;
- only merge if direction is same/monotonic;
- only merge if visibility class and style context are identical.

If `mergeKey` is currently missing for some segment types, define a stable one that captures at least:

- source curve id;
- source segment index;
- style override identity;
- visibility class if not otherwise checked.

Do not merge across different source path segments if that can erase meaningful vertices or style changes.

For a polyline `A -> B -> C` with same direction and same style, merging may be fine.

For a polyline `A -> B -> A`, merging must not happen.

## 4. Avoid zero-length merged output

After any proposed merge, check the resulting segment length.

Reject merge if:

- merged start and end are approximately equal;
- merged length is smaller than expected due to reversal/collapse;
- either input segment is non-finite.

Zero-length original subsegments should be skipped or handled according to existing policy, but merging must not create a zero-length visible run from nonzero input geometry.

## 5. Fix capped sampling behavior

Inspect sampling cap logic around `curveSegmentSamples` and `maxCurveSegmentsPerCurve`.

Current bad behavior:

- sampling stops at cap;
- returns non-empty prefix;
- callers render/export the prefix;
- rest of the curve disappears.

Required behavior:

A capped curve must never be partially emitted as if complete.

Choose one of the following policies.

### Preferred policy: fallback to original rendering/export for that curve

If occlusion sampling would exceed cap:

- mark occlusion classification for that curve as skipped/fallback;
- SVG renders the original curve normally, without hidden segmentation;
- TikZ exports the original curve normally, without hidden segmentation;
- no curve geometry is lost;
- optionally include/report status in debug/test helper;
- do not mutate diagram.

This is the safest MVP.

### Alternative policy: preserve unsampled remainder

If implementing fallback is hard:

- classify sampled prefix;
- append unsampled remainder as visible/original style;
- ensure final output reaches the original curve end;
- clearly document approximation.

This is acceptable only if output is complete and deterministic.

Do not keep the current behavior of emitting only the sampled prefix.

## 6. Add explicit result state for cap fallback

If useful, change the occlusion classification result to distinguish:

```ts
type CurveOcclusionResult =
  | { kind: "segmented"; runs: OccludedCurveRun[] }
  | { kind: "fallbackOriginal"; reason: "sampleCapExceeded" };
```

or equivalent.

Then callers can handle it safely.

Requirements:

- SVG caller renders original curve for fallback;
- TikZ caller exports original curve for fallback;
- tests cover the fallback path.

If changing the result shape is too broad, add a flag:

```ts
sampleCapExceeded: boolean
```

and ensure callers check it before using partial runs.

## 7. Preserve hidden segmentation when under cap

The cap fallback should only apply when the cap is exceeded.

For normal curves under cap:

- visible/hidden segmentation still works;
- straight partially hidden lines still split;
- hidden style still applies;
- style overrides still apply;
- run grouping still works.

## 8. Preserve style overrides

Both fixes must preserve style behavior.

For merging:

- do not merge across style override boundaries;
- if a segment style override differs, keep separate runs.

For cap fallback:

- original rendering/export should preserve existing style overrides as it did before occlusion;
- do not flatten style information.

## 9. Tests

Add focused tests.

### Backtracking merge tests

1. A fully visible polyline:

```text
A -> B -> A
```

must not collapse to a zero-length run.

Expected:

- output contains two visible segments or an equivalent non-collapsed representation;
- start/end sequence preserves the backtracking geometry.

2. Same test for TikZ output:

- generated TikZ should include both directions or otherwise represent the backtracking curve;
- it should not render/export as a single `A -> A` segment.

3. Same test for SVG helper/output.

4. Adjacent same-direction collinear segments:

```text
A -> B -> C
```

may still merge into `A -> C` if style/mergeKey compatible.

5. Adjacent collinear segments with different `mergeKey` do not merge.

6. Adjacent collinear segments with different style overrides do not merge.

### Cap behavior tests

7. Long visible polyline exceeding default sampled segment cap falls back to original rendering/export or preserves unsampled remainder.

Expected:

- final SVG/TikZ output reaches the original final endpoint.
- no truncation at an intermediate x value.

8. Long hidden/partially hidden polyline exceeding cap still outputs complete curve using fallback policy.

9. Classification result indicates fallback/skipped occlusion if the chosen model supports it.

10. Normal shorter polyline under cap still uses occlusion segmentation.

### Regression tests

11. Straight partially occluded segment under cap still splits into visible/hidden/visible.

12. Cubic occlusion tests still pass.

13. Arc/template occlusion tests still pass if present.

14. Hidden style applied in SVG/TikZ still works.

15. Disabled visibility mode still preserves normal output.

16. Inline TikZ output has no blank lines.

17. TikZ indentation remains 4 spaces.

18. No NaN/Infinity in output.

## 10. Constructing test examples

### Backtracking test

Use simple coordinates:

```text
A = (0, 0, 0)
B = (1, 0, 0)
A = (0, 0, 0)
```

No surface occlusion needed, or use a situation where all segments classify as visible.

The test should catch that output does not collapse to `A -> A`.

### Cap test

Use a polyline with enough edges to exceed current default cap after per-edge subdivision.

Example:

```text
(0,0,0) -> (1,0,0) -> ... -> (30,0,0)
```

Expected:

- output reaches `(30,0,0)`;
- no silent truncation.

If comparing exact TikZ coordinates is brittle, test the pure classification/export helper result and ensure the final endpoint is present.

## 11. Documentation/comments

Add comments near merge logic:

- collinear merge is only safe for same-direction monotonic extension;
- backtracking curves must not be collapsed.

Add comments near cap logic:

- if occlusion sampling exceeds cap, use fallback/original rendering rather than truncating;
- this preserves correctness over approximate occlusion.

Update docs only if Phase 20F docs mention cap behavior.

## 12. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Backtracking:

1. Create a polyline/path `A -> B -> A`.
2. Enable auto visibility/curve occlusion.
3. Confirm the curve is still visible as an out-and-back segment.
4. Generate TikZ.
5. Confirm it does not collapse to a single zero-length command.

Cap:

6. Create a long visible polyline with many segments.
7. Enable auto visibility.
8. Confirm the entire polyline remains visible through its final endpoint.
9. Generate TikZ.
10. Confirm output reaches the final endpoint and is not truncated.

Regression:

11. Create a straight line partially hidden behind a surface.
12. Confirm it still splits into visible/hidden/visible.
13. Disable visibility.
14. Confirm normal output returns.

## 13. Preserve existing behavior

Do not regress:

- visible/hidden classification;
- curve sampling under cap;
- hidden style persistence;
- SVG hidden style attributes;
- TikZ hidden style output;
- disabled-mode preservation;
- style overrides;
- layer-vs-depth behavior;
- mutation avoidance;
- inline no-blank-lines;
- 4-space indentation;
- save/load;
- undo/redo.

## 14. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 15. Report after implementation

Please report:

- files modified;
- root cause of backtracking curve collapse;
- new merge safety checks;
- mergeKey/style compatibility behavior;
- root cause of cap truncation;
- chosen cap fallback/remainder policy;
- how SVG/TikZ callers handle capped curves;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
