# Phase 20C Fix Prompt: Infer Coons corners from endpoint connectivity, not only pre-oriented paths

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

Phase 20B/20C implemented ruled surfaces and Coons patches. A previous fix attempted to auto-orient boundary paths, but manual testing still shows this error:

```text
Coons patch corners must match: bottom start = left start, bottom end = right start, top start = left end, and top end = right end.
```

Observed problem:

- The selected paths' endpoints match geometrically.
- The four paths form a closed boundary cycle.
- However, Coons creation still fails unless path orientations already match the implementation's exact canonical orientation.
- This means the current validation/orientation logic is still too oriented-path-specific.

User expectation:

- If the four selected boundary paths form a closed loop as endpoint sets, Coons patch creation should succeed.
- The implementation should reinterpret/reverse copied boundary snapshots into the canonical Coons orientation automatically.
- Source paths must not be mutated.

This fix should make Coons patch boundary handling based on endpoint connectivity first, and orientation second.

## Goal

Fix Coons patch boundary validation/orientation so that it accepts geometrically connected boundary paths even when their individual directions follow a closed loop orientation or are otherwise reversed.

Also make sure ruled surface boundary orientation remains robust.

## Scope

This is a targeted Phase 20C fix.

Implement:

- endpoint-set / corner-inference based Coons boundary orientation;
- robust reversal of copied boundary snapshots;
- tests for closed-loop boundary orientation cases;
- ruled surface orientation regression tests.

Do not implement:

- new surface primitives;
- automatic role inference from unordered four paths;
- live linked boundaries;
- path direction editing UI;
- snapping;
- approximate endpoint repair;
- new dependencies.

Do not change:

- Coons patch mathematical formula;
- source path geometry;
- copy-on-create policy;
- ruled/Coons data model unless absolutely necessary;
- SVG/TikZ export semantics;
- save/load format.

## Key design change

Current or previous logic appears to require the four paths to already satisfy the canonical oriented equations:

```text
bottom.start == left.start
bottom.end   == right.start
top.start    == left.end
top.end      == right.end
```

This is too strict as an initial check.

Instead, for picked roles:

```text
bottom, right, top, left
```

first check endpoint connectivity as unordered endpoints:

```text
bottom and left share bottom-left corner
bottom and right share bottom-right corner
top and left share top-left corner
top and right share top-right corner
```

Then orient the copied boundaries into canonical Coons orientation:

```text
bottom: bottom-left -> bottom-right
right:  bottom-right -> top-right
top:    top-left -> top-right
left:   bottom-left -> top-left
```

After orientation, the existing canonical Coons equations should hold.

Important:

- The roles `bottom`, `right`, `top`, `left` are not reordered.
- Only individual boundary direction may be reversed.
- The source paths are not mutated.
- The created Coons patch stores oriented copied boundary snapshots.

## Example that must succeed

Suppose four paths form a closed loop in cyclic direction:

```text
bottom: A -> B
right:  B -> C
top:    C -> D
left:   D -> A
```

This is a perfectly valid closed boundary cycle.

Canonical Coons orientation wants:

```text
bottom: A -> B
right:  B -> C
top:    D -> C
left:   A -> D
```

So the implementation should automatically reverse `top` and `left` in the copied boundary snapshots and create the patch.

This case must not fail with the current corner error.

## 1. Add endpoint connectivity helpers

Add or reuse pure helpers:

```ts
getBoundaryStart(boundary): Vec3
getBoundaryEnd(boundary): Vec3
areEndpointsEqual(a, b, epsilon): boolean
findSharedEndpoint(boundaryA, boundaryB, epsilon): SharedEndpointResult
```

A boundary has two endpoint candidates:

```text
start
end
```

`findSharedEndpoint` should determine whether the endpoint sets share exactly one geometric endpoint within tolerance.

Return enough information to know which endpoint was shared:

```ts
type BoundaryEndpointRole = "start" | "end";

type SharedEndpointResult =
  | {
      ok: true;
      point: Vec3;
      aEndpoint: BoundaryEndpointRole;
      bEndpoint: BoundaryEndpointRole;
    }
  | {
      ok: false;
      reason: string;
    };
```

or equivalent.

Validation:

- missing endpoints rejected cleanly;
- non-finite endpoints rejected;
- if no endpoint matches, return failure;
- if both endpoints match due to degeneracy/closed path ambiguity, return failure unless there is a clear existing policy.

## 2. Infer Coons corners from endpoint connectivity

Implement helper:

```ts
orientCoonsBoundariesByConnectivity({
  bottom,
  right,
  top,
  left,
  epsilon,
}): Result<{
  bottom: BoundaryPathSnapshot;
  right: BoundaryPathSnapshot;
  top: BoundaryPathSnapshot;
  left: BoundaryPathSnapshot;
  reversed: {
    bottom: boolean;
    right: boolean;
    top: boolean;
    left: boolean;
  };
  corners: {
    bottomLeft: Vec3;
    bottomRight: Vec3;
    topRight: Vec3;
    topLeft: Vec3;
  };
}, ValidationError>
```

or update the existing orientation helper to follow this behavior.

The helper should:

1. Find shared endpoint between `bottom` and `left`.
   - This is `bottomLeft`.

2. Find shared endpoint between `bottom` and `right`.
   - This is `bottomRight`.

3. Find shared endpoint between `right` and `top`.
   - This is `topRight`.

4. Find shared endpoint between `top` and `left`.
   - This is `topLeft`.

5. Verify the four corner points are well-defined and non-degenerate.
   - At least reject obvious degeneracy where adjacent required corners collapse unexpectedly.

6. Orient each copied boundary to canonical direction:
   - `bottom`: `bottomLeft -> bottomRight`;
   - `right`: `bottomRight -> topRight`;
   - `top`: `topLeft -> topRight`;
   - `left`: `bottomLeft -> topLeft`.

7. Validate that the oriented boundaries now satisfy:

```text
bottom.start == left.start
bottom.end   == right.start
top.start    == left.end
top.end      == right.end
```

8. Return the oriented copies and reversal flags.

If any shared endpoint is missing, return a clean validation failure.

## 3. Add helper to orient a boundary to requested endpoints

Add pure helper:

```ts
orientBoundaryToEndpoints(
  boundary: BoundaryPathSnapshot,
  desiredStart: Vec3,
  desiredEnd: Vec3,
  epsilon: number
): Result<{ boundary: BoundaryPathSnapshot; reversed: boolean }, ValidationError>
```

Behavior:

- if `boundary.start ~= desiredStart` and `boundary.end ~= desiredEnd`, return original copy;
- if `boundary.start ~= desiredEnd` and `boundary.end ~= desiredStart`, return reversed copy;
- otherwise return failure.

Do not mutate input.

Use existing or new `reverseBoundaryPathSnapshot`.

## 4. Ensure reversal handles all supported segment kinds

Verify `reverseBoundaryPathSnapshot` works for every path segment that can be used in Coons/Ruled boundaries.

Required:

### Line

```text
start/end swapped
```

### Cubic Bézier

```text
start = old end
control1 = old control2
control2 = old control1
end = old start
```

### Arc, if supported

Reverse geometric traversal:

- start/end swapped;
- direction flipped;
- start/end angles swapped or otherwise adjusted consistently;
- center/radius/frame preserved.

### Concatenated multi-segment path

- segment order reversed;
- each segment reversed.

The reversed boundary's start and end must be correct.

## 5. Integrate with Coons creation

Update every Coons creation path:

- sequential Add sheet > Coons picking;
- creation from selected paths if still supported;
- pure helper tests;
- any direct helper.

Expected flow:

```text
picked source paths
-> copy boundary snapshots
-> orientCoonsBoundariesByConnectivity(...)
-> validate oriented Coons patch
-> create Coons patch
```

Do not use the old canonical orientation check before attempting connectivity-based orientation.

If final validation fails after orientation, report a meaningful error.

## 6. Improve error messages

Current error says only:

```text
Coons patch corners must match...
```

That is still useful after orientation fails, but the UI should clarify whether:

- endpoints do not form a closed boundary cycle;
- a specific adjacent pair does not share an endpoint;
- orientation succeeded but corner consistency still failed.

Example messages:

```text
Coons patch boundaries do not form a connected cycle: bottom and right do not share an endpoint.
```

```text
Coons patch boundaries form a cycle, but canonical orientation failed.
```

```text
Coons patch created. Auto-reversed top and left boundaries.
```

Keep messages concise.

## 7. Ruled surface orientation refinement

For ruled surfaces, ensure the previous auto-orientation fix is robust.

Behavior:

- keep `boundary0` orientation as picked;
- compare `boundary1` original vs reversed using endpoint-distance score;
- choose the orientation with smaller score;
- if existing validation requires endpoint compatibility, validate after orientation;
- source paths unchanged.

Add tests for the common case:

```text
boundary0: A -> B
boundary1: D -> C
```

where the intended aligned orientation is:

```text
boundary1: C -> D
```

or equivalent depending on the chosen endpoint matching convention.

## 8. Tests

Add focused tests.

### Coons connectivity/orientation tests

1. Closed-loop cyclic orientation succeeds:

```text
bottom: A -> B
right:  B -> C
top:    C -> D
left:   D -> A
```

Expected:

- creation/orientation succeeds;
- copied `top` reversed to `D -> C`;
- copied `left` reversed to `A -> D`.

2. All canonical orientation succeeds unchanged:

```text
bottom: A -> B
right:  B -> C
top:    D -> C
left:   A -> D
```

3. Reversed bottom only succeeds if endpoints form the same cycle.

4. Reversed right only succeeds.

5. Reversed top only succeeds.

6. Reversed left only succeeds.

7. Multiple reversed paths succeed.

8. Source boundary snapshots are not mutated.

9. Returned reversal flags are correct.

10. Oriented result satisfies canonical equations.

### Coons failure tests

11. `bottom` and `right` do not share an endpoint -> clean failure.

12. `right` and `top` do not share an endpoint -> clean failure.

13. Degenerate/ambiguous endpoint sharing is rejected or handled according to documented policy.

14. Wrong role assignment still fails.

### Coons creation workflow tests

15. Sequential Add sheet > Coons picking can create patch with cyclically oriented boundaries.

16. Draft is preserved if final orientation fails.

17. Error message is clear.

### Ruled tests

18. Ruled surface auto-reverses second boundary when needed.

19. Ruled source paths not mutated.

20. Ruled incompatible boundaries still fail if required by validation.

### Regression tests

21. Existing Coons patch creation with already oriented paths still works.

22. Existing ruled surface creation still works.

23. SVG/TikZ export still works for created surfaces.

24. Save/load valid Coons and ruled surfaces still works.

25. Malformed boundary load rejection still works.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual Coons test:

1. Create four paths that form a closed loop:
   - bottom left-to-right;
   - right bottom-to-top;
   - top right-to-left;
   - left top-to-bottom.
2. Enter Add sheet > Coons mode.
3. Pick in role order:
   - bottom;
   - right;
   - top;
   - left.
4. Confirm Coons patch is created.
5. Confirm no corner mismatch error.
6. Confirm source paths remain unchanged.

Then test:

7. Reverse one or more source path directions.
8. Pick the same roles.
9. Confirm Coons patch still creates.

Failure test:

10. Pick four paths that do not form a closed endpoint cycle.
11. Confirm creation fails cleanly and indicates which adjacency is bad.

Manual ruled test:

12. Create two ruled boundaries with opposite directions.
13. Pick them in ruled mode.
14. Confirm ruled surface is created.

## 10. Preserve existing behavior

Do not regress:

- sequential boundary picking;
- Coons formula;
- ruled formula;
- copy-on-create;
- source path geometry;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior;
- inline/standalone TikZ formatting.

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
- root cause of remaining corner mismatch error;
- endpoint connectivity algorithm;
- canonical orientation policy;
- boundary reversal helper behavior;
- Coons success/failure cases tested;
- ruled orientation updates;
- source mutation avoidance;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
