# Phase 20H Fix Prompt: Enforce curve-occlusion surface-face cap before sorting

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

Phase 20H implemented auto-visibility TikZ export hardening and docs.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`classifyCurveOcclusion` collects and sorts all projected surface faces before checking `maxSurfaceFacesForSorting`.

Current problem:

- `src/rendering/curveOcclusion.ts` collects projected surface faces.
- It then sorts all projected faces.
- Only after that does it check `maxSurfaceFacesForSorting`.
- TikZ export reaches this path through `src/tikz/generateTikz.ts`.
- Therefore, large diagrams with curve occlusion enabled can still pay the expensive collection/projection/sort cost before falling back.
- This defeats the purpose of the cap and can hurt performance.

Review's targeted requirement:

> Fix Phase 20H curve-occlusion cap enforcement: in `classifyCurveOcclusion`, enforce `maxSurfaceFacesForSorting` before sorting projected faces, preferably by short-circuiting face collection at `cap + 1`. Add a regression test where curve occlusion is enabled, surface face count exceeds the cap, TikZ emits the surface-face-cap fallback warning for the curve, and no hidden sampled segments are emitted.

## Goal

Fix curve-occlusion surface-face cap enforcement so large diagrams avoid expensive sorting.

Specifically:

- enforce `maxSurfaceFacesForSorting` before sorting projected faces;
- ideally stop collecting/projecting faces once `cap + 1` is reached;
- when the cap is exceeded, return/use a fallback occlusion result;
- TikZ export should emit the existing or new surface-face-cap fallback warning/comment for the curve;
- no hidden sampled curve segments should be emitted in the fallback path;
- SVG and TikZ should preserve complete original curve rendering/export rather than partial hidden output.

## Scope

This is a targeted Phase 20H performance fix.

Implement:

- pre-sort cap enforcement in `classifyCurveOcclusion`;
- short-circuit face collection/projection at `cap + 1` where practical;
- safe fallback behavior when the cap is exceeded;
- tests for the cap-exceeded path in TikZ export and classification helpers.

Do not implement:

- new visibility algorithms;
- exact occlusion;
- BSP splitting;
- new UI options;
- new geometry types;
- new dependencies;
- broad SVG/TikZ export refactors.

Do not change:

- normal curve occlusion behavior below the cap;
- hidden style semantics;
- disabled visibility behavior;
- surface sorting behavior when under cap;
- layer/depth mode semantics;
- original curve geometry;
- save/load format;
- inline/standalone export formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect current cap path

Inspect:

- `src/rendering/curveOcclusion.ts`;
- `classifyCurveOcclusion`;
- projected surface face collection;
- surface face sorting;
- `maxSurfaceFacesForSorting`;
- fallback/warning result types;
- SVG consumer in `src/rendering/SvgDiagram.tsx`;
- TikZ consumer in `src/tikz/generateTikz.ts`.

Identify:

- where surface faces are collected;
- where they are projected;
- where they are sorted;
- where cap checking currently occurs;
- how fallback is represented;
- how TikZ emits fallback comments/warnings.

## 2. Enforce cap before sorting

Move the cap check before sorting projected faces.

Required:

- Do not sort all projected faces before checking the cap.
- If face count exceeds `maxSurfaceFacesForSorting`, return fallback before sorting.
- The fallback should preserve original curve rendering/export.
- Do not emit hidden sampled segments when the cap is exceeded.

Preferred implementation:

- while collecting/projecting surface faces, stop once `cap + 1` faces are reached;
- mark cap exceeded;
- return fallback result immediately;
- avoid sorting entirely in this path.

Pseudo-flow:

```ts
const projectedFaces: ProjectedSurfaceFace[] = [];

for (const face of candidateFaces) {
  const projected = projectFace(face);

  if (projected) {
    projectedFaces.push(projected);
  }

  if (projectedFaces.length > maxSurfaceFacesForSorting) {
    return {
      kind: "fallbackOriginal",
      reason: "surfaceFaceCapExceeded",
      faceCount: projectedFaces.length,
      cap: maxSurfaceFacesForSorting,
    };
  }
}

projectedFaces.sort(...);
```

Exact result shape may differ.

## 3. Avoid expensive work after cap exceeded

When cap is exceeded:

- do not continue collecting faces;
- do not sort faces;
- do not perform curve segment classification against faces;
- do not create hidden sampled segments;
- do not partially classify the curve.

The curve should fall back to original rendering/export.

This matches the performance intent of the cap.

## 4. Preserve behavior under the cap

For diagrams where projected surface face count is within the cap:

- existing occlusion behavior should be unchanged;
- projected faces should still sort deterministically;
- visible/hidden segmentation should still work;
- tests for hidden/visible classification should still pass.

## 5. Fallback behavior

When `maxSurfaceFacesForSorting` is exceeded:

### SVG

Preferred:

- render the original curve normally;
- optionally no special warning in SVG.

### TikZ

Emit a concise comment/warning near the curve output if existing conventions allow it.

Example:

```tex
% Curve occlusion skipped for curveName: surface face count exceeded maxSurfaceFacesForSorting.
```

or existing project wording.

Requirements:

- no hidden sampled segments emitted;
- original curve/path export remains complete;
- no geometry truncation;
- no NaN/Infinity;
- inline output still has no blank lines;
- 4-space indentation preserved.

## 6. Tests

Add focused tests.

### Classification helper tests

1. `classifyCurveOcclusion` with face count under cap still returns segmented/classified result.

2. `classifyCurveOcclusion` with face count over cap returns fallback result before sorting.

If sorting can be spied on or helper-separated:

3. Sorting helper is not called when cap is exceeded.

If spying is too hard, test via result and keep implementation simple.

4. Face collection/projection stops at `cap + 1` if a helper can expose/debug count.

If not easy, test that the function returns fallback quickly/deterministically.

### TikZ export tests

5. With curve occlusion enabled and surface face count exceeding cap, generated TikZ emits the surface-face-cap fallback warning/comment for the curve.

6. In that cap-exceeded output, no hidden sampled curve segments are emitted.

Assert absence of hidden style markers if the test can identify them.

7. The original curve is still exported completely.

For example, if the curve is a line/path from A to B, ensure the final endpoint still appears or that the normal unsplit curve output appears.

8. Inline math output with cap fallback has no blank lines.

9. 4-space indentation is preserved.

### SVG/export regression tests

10. SVG fallback renders original curve when cap is exceeded, if helper-testable.

11. Normal under-cap occlusion still emits hidden segments.

12. Disabled visibility mode remains unchanged.

13. Existing surface depth sort tests still pass.

## 7. Constructing the regression test

Create a diagram or helper fixture with:

- curve occlusion enabled;
- one curve that would be checked for occlusion;
- enough surface faces to exceed `maxSurfaceFacesForSorting`.

Use a deliberately low cap in test options if possible, e.g.:

```ts
maxSurfaceFacesForSorting: 1
```

Then provide at least two or more projected surface faces.

Expected:

- classification/export uses fallback;
- warning/comment emitted;
- no hidden sampled segments.

This keeps the test small and fast.

## 8. Avoid false positives

Ensure the cap is specifically for surface faces used in curve occlusion.

Do not confuse it with:

- max curve samples;
- max emitted curve segments;
- surface face sorting cap for rendering;
- grid line cap.

Use clear names in tests and messages.

## 9. Documentation/comments

Add a short code comment near the cap check:

- the cap must be enforced before sorting;
- otherwise large diagrams pay the expensive sort cost before fallback;
- collection stops at `cap + 1` to detect overflow.

Update docs only if user-facing behavior changes.

## 10. Preserve existing behavior

Do not regress:

- sorted surface export determinism;
- hidden/visible curve TikZ output when under cap;
- disabled visibility mode;
- inline no-blank-line behavior;
- docs warning that visibility is approximate;
- examples;
- save/load coverage;
- ruled/Coons surfaces;
- layer/style/camera/work-plane behavior;
- symbolic/grid export;
- 4-space indentation.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

If practical:

1. Create or load a large diagram with many surface faces.
2. Enable curve occlusion.
3. Set a low `maxSurfaceFacesForSorting` if UI exposes it, or use default if enough faces exist.
4. Generate TikZ.
5. Confirm export remains responsive.
6. Confirm a fallback warning/comment is emitted.
7. Confirm curves are exported normally, not as hidden sampled segments.
8. Confirm no partial/truncated curve output.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 13. Report after implementation

Please report:

- files modified;
- root cause of the performance issue;
- where the cap check was moved;
- whether face collection now stops at `cap + 1`;
- fallback result behavior;
- SVG fallback behavior;
- TikZ fallback warning/comment behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
