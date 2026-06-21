# Phase 20H Additional Fix Prompt: Enforce curve-occlusion surface-face cap before projection/sorting

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

Phase 20H implemented auto-visibility export hardening. A previous fix may have attempted to address curve-occlusion cap behavior, but review still reports the same Medium issue.

Current review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`classifyCurveOcclusion` still collects and sorts all projected surface faces before checking `maxSurfaceFacesForSorting`.

Review details:

- In `src/rendering/curveOcclusion.ts`, `classifyCurveOcclusion` collects projected surface faces.
- It then sorts all projected faces.
- The cap check for `maxSurfaceFacesForSorting` happens only after this expensive work.
- TikZ export reaches this through `src/tikz/generateTikz.ts`.
- Therefore, large diagrams with curve occlusion enabled can still pay the expensive surface-face projection/sort cost before falling back.

This defeats the purpose of the cap.

## Goal

Fix Phase 20H curve-occlusion cap enforcement for real.

In `classifyCurveOcclusion`:

1. Enforce `maxSurfaceFacesForSorting` before sorting projected faces.
2. Preferably stop face collection/projection once `cap + 1` relevant faces are reached.
3. When the cap is exceeded:
   - do not sort;
   - do not classify hidden segments;
   - fall back to original curve rendering/export;
   - emit the surface-face-cap fallback warning/comment in TikZ;
   - emit no hidden sampled curve segments.

## Scope

This is a targeted Phase 20H additional fix.

Implement:

- pre-sort cap enforcement in `classifyCurveOcclusion`;
- ideally pre-projection or early projection short-circuit at `cap + 1`;
- fallback behavior when cap is exceeded;
- regression tests proving the cap path avoids hidden segment output.

Do not implement:

- new visibility algorithms;
- exact occlusion;
- BSP splitting;
- new UI options;
- new geometry features;
- broad SVG/TikZ export refactors;
- new dependencies.

Do not change:

- normal curve occlusion behavior under the cap;
- hidden style semantics;
- disabled visibility behavior;
- surface sorting behavior under the cap;
- layer/depth mode semantics;
- original curve geometry;
- save/load format;
- inline/standalone export formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. First add a failing regression test

Before modifying implementation, add a test that currently fails under the review issue.

Test setup should create or call a helper with:

- curve occlusion enabled;
- `maxSurfaceFacesForSorting` set very low, e.g. `1`;
- more than `1` relevant surface face;
- one curve that would otherwise be classified.

Expected behavior after the fix:

- classification returns a cap-exceeded fallback result; or
- TikZ export emits the cap fallback comment and no hidden sampled segments.

This test should fail before the implementation change if the cap is still checked after sorting.

## 2. Inspect and refactor `classifyCurveOcclusion`

Inspect:

- `src/rendering/curveOcclusion.ts`;
- `classifyCurveOcclusion`;
- projected surface face collection;
- surface face projection;
- sorting;
- `maxSurfaceFacesForSorting`;
- fallback result types;
- SVG consumer in `src/rendering/SvgDiagram.tsx`;
- TikZ consumer in `src/tikz/generateTikz.ts`.

Find the exact sequence:

```text
collect faces
project faces
sort faces
check cap
classify curve
```

Refactor it to:

```text
collect/project only up to cap + 1
if cap exceeded:
    return fallback
else:
    sort faces
    classify curve
```

or, even better if possible:

```text
count candidate faces before projection
if count exceeds cap:
    return fallback
else:
    project faces
    sort faces
    classify curve
```

Choose the safest strategy that preserves correctness.

## 3. Enforce cap before sorting

Required implementation rule:

No code path may call the projected-face sorting step before the cap check has proven the number of faces is within `maxSurfaceFacesForSorting`.

Acceptable implementation:

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

projectedFaces.sort(compareProjectedSurfaceFaces);
```

Do not continue collecting/projecting after cap overflow unless there is a documented reason.

Do not sort after cap overflow.

## 4. Avoid expensive work after cap overflow

When cap is exceeded:

- do not sort faces;
- do not classify sampled curve segments;
- do not create hidden runs;
- do not emit hidden sampled segments;
- do not truncate the curve;
- render/export the original curve normally.

This behavior should match the cap fallback policy from Phase 20F/20H.

## 5. Fallback result behavior

If the project has a result type for curve occlusion, use or extend it clearly.

Suggested shape:

```ts
type CurveOcclusionResult =
  | {
      kind: "segmented";
      runs: OccludedCurveRun[];
    }
  | {
      kind: "fallbackOriginal";
      reason:
        | "surfaceFaceCapExceeded"
        | "curveSampleCapExceeded";
      cap: number;
      observedCount?: number;
    };
```

Exact shape can differ.

Requirements:

- SVG caller renders the original curve for fallback;
- TikZ caller exports the original curve for fallback;
- TikZ caller emits a comment/warning for `surfaceFaceCapExceeded`;
- no hidden sampled segment output is emitted in fallback path.

## 6. TikZ fallback comment

Generated TikZ should contain a concise comment when the surface-face cap is exceeded.

Example:

```tex
% Curve occlusion skipped for <curve name or id>: surface face count exceeds maxSurfaceFacesForSorting.
```

Requirements:

- comment is emitted only when fallback occurs;
- comment does not introduce blank lines in inline math mode;
- 4-space indentation preserved;
- no active TikZ commands are introduced by the warning.

## 7. Tests

Add or update tests.

### Classification tests

1. Under-cap case:
   - `classifyCurveOcclusion` returns normal segmented result.
   - projected faces are sorted/classified as before.

2. Over-cap case:
   - with `maxSurfaceFacesForSorting = 1` and at least 2 projected faces;
   - `classifyCurveOcclusion` returns fallback, not segmented hidden runs.

3. If possible, assert sorting is not called when over cap.
   - If direct spying is hard, factor sorting into a helper and test the call path indirectly.
   - Or assert via a deliberately throwing comparator/sort helper in a unit test if architecture allows.
   - Do not add new dependencies just for this.

4. If possible, assert face collection/projection stops at `cap + 1`.

### TikZ export tests

5. With curve occlusion enabled and surface face count exceeding cap:
   - generated TikZ emits the surface-face-cap fallback warning/comment.

6. In the same output:
   - no hidden sampled curve segments are emitted;
   - hidden style marker is absent for that curve if testable.

7. Original curve output is still complete.
   - It must reach the original endpoint.
   - It must not be truncated.
   - It must not disappear.

8. Inline math output with the fallback comment has no blank lines.

9. 4-space indentation is preserved.

### Regression tests

10. Normal under-cap hidden/visible curve output still works.

11. Disabled visibility mode remains unchanged.

12. Sorted surface export tests still pass.

13. Existing curve sample cap fallback tests still pass.

14. Ruled/Coons surface examples/tests still pass.

## 8. Avoid false confidence from tests

The previous test suite passed despite the review issue.

Make sure the new test specifically checks the surface-face cap path before sorting.

A test that only verifies the fallback comment appears after sorting is not enough.

Try to make the test fail if the implementation still sorts all faces before checking the cap.

Possible strategies:

- expose a helper that collects projected faces with cap and returns `{ faces, capExceeded }`;
- test that helper directly;
- mock or wrap the sorting helper in a way that would throw if called in the cap-exceeded case;
- count how many projection calls happen if the projection helper can be injected.

Keep the change small and idiomatic.

## 9. Preserve behavior under cap

For diagrams below the cap:

- do not change sorting order;
- do not change hidden/visible classification;
- do not change SVG/TikZ output except for incidental internal refactor with identical semantics;
- all existing tests should pass.

## 10. Documentation/comments

Add a code comment near the cap check:

```text
The surface-face cap must be enforced before sorting. Otherwise large diagrams still pay the expensive projected-face sort before falling back.
```

Update user docs only if needed.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

If the UI exposes the cap:

1. Open a diagram with many surface faces.
2. Enable curve occlusion.
3. Set `maxSurfaceFacesForSorting` low.
4. Generate TikZ.
5. Confirm output remains responsive.
6. Confirm fallback warning/comment appears.
7. Confirm no hidden sampled curve segments are emitted.
8. Confirm the original curve still appears fully.

If the UI does not expose the cap, rely on tests.

## 12. Preserve existing behavior

Do not regress:

- sorted surface export determinism;
- hidden/visible curve TikZ output under cap;
- disabled visibility mode;
- inline no-blank-line behavior;
- 4-space indentation;
- visibility docs/examples;
- save/load visibility caps;
- ruled/Coons surfaces;
- layer/style/camera/work-plane behavior;
- symbolic/grid export.

## 13. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 14. Report after implementation

Please report:

- files modified;
- why the previous implementation still checked cap too late;
- exact new cap-check location;
- whether collection/projection stops at `cap + 1`;
- whether sorting is skipped on cap overflow;
- fallback result behavior;
- TikZ fallback warning/comment behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
