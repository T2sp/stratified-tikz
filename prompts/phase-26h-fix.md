# Phase 26H Fix Prompt: Recurse into nested work-plane-local source frames for coordinate-reference inventory and detach

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

Phase 26H implements coordinate-reference inventory and detach helpers for global TikZ coordinate anchors.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

References inside `workPlaneLocal` coordinate source frames are missed by coordinate-reference inventory and detach helpers.

Current behavior:

- `findCoordinateAnchorReferences(...)` / inventory helpers catch many direct coordinate references.
- `detachCoordinateAnchorReferences(...)` / detach helpers handle many direct references.
- But `collectCoordinateReferencePoint(...)` and `detachCoordinateReferencePoint(...)` only inspect direct references like:

```ts
point.symbolic.source.kind === "coordinateRef"
```

- They do **not** recurse into:

```ts
point.symbolic.source.kind === "workPlaneLocal"
point.symbolic.source.frame.origin
point.symbolic.source.frame.u
point.symbolic.source.frame.v
point.symbolic.source.frame.normal
```

- Validation does recurse into those frame fields.
- Therefore inventory and detach are inconsistent with validation.

Reproduced case:

```text
A label/path/point has:
  symbolic.source.kind = "workPlaneLocal"
  symbolic.source.frame.origin.symbolic.source.kind = "coordinateRef"
  coordinateId = "coord-a"
```

Observed:

```text
findCoordinateAnchorReferences(...) returns 0 references
detachCoordinateAnchorReferences(...) returns ok: true, detachedCount: 0
resulting diagram still contains "coordinateId": "coord-a"
```

This can leave stale coordinate references after coordinate deletion and can break layer translation despite the pre-translation detach step.

## Goal

Fix Phase 26H so coordinate-reference inventory and detach helpers recurse into nested work-plane-local source frames.

Required behavior:

1. `findCoordinateAnchorReferences(...)` must count coordinate refs inside `Vec3.symbolic.source.kind === "workPlaneLocal"` frame fields.
2. Detach helpers must detach those nested frame-field refs.
3. Nested frame fields should be treated as `workPlaneFrameField` fallback locations.
4. Detach should remove all dangling refs to the target coordinate.
5. Detach should preserve source immutability.
6. Detach should be atomic: if detaching a nested frame ref cannot be done safely, the helper must fail without partial mutation.
7. Add regression tests for inventory count, detach count, coordinate deletion, source immutability, and atomic failure.

## Scope

This is a targeted Phase 26H fix.

Implement:

- recursive inventory of coordinate refs inside work-plane-local source frames;
- recursive detach of coordinate refs inside work-plane-local source frames;
- location metadata for nested frame refs;
- fallback behavior for frame fields;
- tests.

Do not implement:

- new coordinate anchor features;
- new coordinateRef-supported exported fields;
- new layer translation semantics beyond using fixed detach helpers;
- new UI;
- new geometry types;
- broad coordinate model redesign;
- new dependencies.

Do not change:

- existing direct coordinate-ref inventory behavior;
- existing direct coordinate-ref detach behavior;
- coordinate anchor export;
- coordinate delete-detach policy except making it complete;
- layer translation detach policy except making it complete;
- save/load format;
- TikZ generation semantics for supported refs;
- inline/standalone formatting.

## 1. Inspect inventory and detach helpers

Inspect:

- `src/model/coordinateReferences.ts`;
- `findCoordinateAnchorReferences(...)`;
- `collectCoordinateReferencePoint(...)`;
- `detachCoordinateAnchorReferences(...)`;
- `detachCoordinateReferencePoint(...)`;
- frame traversal/validation helpers;
- validation recursion into work-plane-local frames;
- coordinate deletion helpers;
- layer translation detach helpers.

Review locations indicate:

```text
coordinateReferences.ts around collectCoordinateReferencePoint
coordinateReferences.ts around detachCoordinateReferencePoint
coordinateReferences.ts validation recursion into point.symbolic.source.frame
```

Find all cases where validation sees nested frame refs but inventory/detach do not.

## 2. Recurse into work-plane-local source frames

For any supported point/vector coordinate value that may contain:

```ts
symbolic.source.kind === "workPlaneLocal"
```

inventory and detach should inspect the source frame:

```text
source.frame.origin
source.frame.u
source.frame.v
source.frame.normal
```

and any nested coordinateRef source inside those fields.

Suggested helper:

```ts
collectCoordinateReferencesInWorkPlaneFrame(
  frame: WorkPlaneFrameSnapshot,
  baseLocation: CoordinateReferenceLocationBase
): CoordinateReferenceLocation[]
```

and corresponding detach helper:

```ts
detachCoordinateReferencesInWorkPlaneFrame(
  frame: WorkPlaneFrameSnapshot,
  coordinateId: string,
  anchorPosition: CoordinateSource
): Result<WorkPlaneFrameSnapshot>
```

Exact names can differ.

## 3. Treat nested frame fields as `workPlaneFrameField` fallback locations

The review explicitly says nested frame fields should be treated as:

```text
workPlaneFrameField fallback locations
```

Meaning:

- coordinate refs inside frame fields are not ordinary exported `(A)` geometry references;
- they are used to build a frame;
- detaching them should replace the ref with a concrete coordinate value/source suitable for a frame coordinate;
- if preserving the coordinate anchor source is not safe for a frame field, fallback to finite global preview.

For example:

```text
Before:
  point.symbolic.source.kind = workPlaneLocal
  source.frame.origin = coordinateRef(coord-a)

Coordinate coord-a:
  current position = (5, 5, 0)

After detach coord-a:
  source.frame.origin = concrete coordinate at (5,5,0)
```

If the coordinate anchor is symbolic:

```text
coord-a.x = R
```

Preferred:

- preserve symbolic expression in frame origin if frame field supports it;
- otherwise finite preview fallback with clear helper policy.

Requirements:

- no dangling refs;
- preview remains finite;
- existing work-plane-local coordinate source remains structurally valid;
- basis frame validation remains valid after detach.

## 4. Location metadata

Inventory should return useful path/location data.

For nested frame fields, location should identify something like:

```text
labels[0].position.symbolic.source.frame.origin
strata[2].segments[1].start.symbolic.source.frame.u
```

or the project’s equivalent location structure.

Requirements:

- enough information for usage count;
- enough information for detach tests;
- enough information for error/debug messages;
- stable enough for tests without being overly brittle.

## 5. Detach semantics for nested work-plane-local frame refs

When detaching target coordinate `coord-a`:

1. Find all direct refs and nested refs.
2. For nested refs in `workPlaneLocal.source.frame.*`:
   - replace with a concrete frame coordinate value derived from `coord-a`'s current position/source;
   - do not mutate `coord-a`;
   - do not mutate the input diagram in place.
3. Return `detachedCount` including nested frame refs.
4. Ensure resulting diagram has no refs to `coord-a`.
5. Re-run or preserve existing frame preview/validation refresh if needed.

If the frame field is part of an object that also contains local `a,b`, do not change `a,b`.

## 6. Coordinate deletion behavior

After this fix, deleting a coordinate that is referenced inside a nested work-plane-local frame should:

- detach that nested ref;
- delete the coordinate anchor;
- leave no dangling refs;
- keep diagram valid;
- preserve visible geometry as much as practical;
- undo/redo should work through existing delete infrastructure.

Add tests through the delete path if practical, not only pure detach helpers.

## 7. Layer translation behavior

Layer translation already detaches refs before moving layer-bound elements.

After this fix, if a layer-bound element has a work-plane-local source whose frame references a coordinate anchor:

- pre-translation detach should catch that nested frame ref;
- translation should then operate on concrete frame data;
- coordinate anchor should remain unchanged;
- no stale ref remains.

Add a regression test if feasible.

## 8. Source immutability and atomic failure

Required:

- source diagram is not mutated by inventory or detach.
- successful detach returns a new diagram.
- failed detach returns `ok:false` and source diagram remains unchanged.
- partial detach must not occur if a nested frame field cannot be detached safely.

Add tests.

Potential failure fixture:

- nested frame ref points to a coordinate whose current position has non-finite preview;
- detach should fail and leave diagram unchanged.

## 9. Tests

Add focused tests.

### Inventory tests

1. Direct coordinateRef inventory still works.

2. CoordinateRef inside:

```text
Vec3.symbolic.source.kind === "workPlaneLocal"
source.frame.origin
```

is counted.

3. CoordinateRef inside `source.frame.u` is counted.

4. CoordinateRef inside `source.frame.v` is counted.

5. CoordinateRef inside `source.frame.normal` is counted if normal supports refs/coordinate sources.

6. Inventory returns 0 for unrelated coordinate ids.

7. Inventory returns useful `workPlaneFrameField` location metadata.

### Detach tests

8. Detach coordinateRef inside work-plane-local source `frame.origin`.

9. Detach coordinateRef inside work-plane-local source `frame.u`.

10. Detach coordinateRef inside work-plane-local source `frame.v`.

11. Detach coordinateRef inside work-plane-local source `frame.normal` if applicable.

12. `detachedCount` includes nested frame refs.

13. After detach, serialized/inspected diagram contains no `"coordinateId":"coord-a"` for the target.

14. Detached frame field uses concrete current anchor position/source.

15. Local `a,b` expressions remain unchanged.

16. Work-plane-local coordinate preview remains finite after detach.

### Coordinate deletion tests

17. Deleting a coordinate referenced only inside a nested work-plane-local frame detaches it and deletes the anchor.

18. After delete, `validateDiagram(...)` passes.

19. TikZ export after delete does not contain dangling `(coord-a)` or `coordinateId`.

20. Undo/redo delete if existing infrastructure supports it.

### Layer translation tests

21. Layer translation detaches nested work-plane-local source frame refs before translation.

22. Coordinate anchor does not move.

23. Translated element uses concrete detached frame and moves according to existing translation policy.

### Immutability/atomic tests

24. Source diagram unchanged after successful detach call.

25. Source diagram unchanged after failed detach call.

26. Failed nested frame detach does not partially detach direct refs.

### Regression tests

27. Existing direct detach tests still pass.

28. Existing coordinate delete-detach tests still pass.

29. Existing layer translation detach tests still pass.

30. Existing supported coordinateRef export tests still pass.

31. Inline output no blank lines.

## 10. Implementation guidance

### Avoid duplicating frame traversal logic

Validation already recurses into work-plane-local source frames.

Try to share a traversal helper or mirror its field coverage exactly.

The bug exists because validation and inventory/detach coverage diverged.

### Be explicit about fallback

For nested frame refs, document in code:

```text
Coordinate references inside work-plane-local source frames are detached as frame-field fallback locations. They are not treated as ordinary TikZ-preserved coordinate references.
```

### Do not over-expand support

This fix is about inventory/detach consistency.

Do not make frame coordinate refs a generally export-preserved feature unless already supported.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual-style check if practical:

1. Create coordinate `A`.
2. Create an object with work-plane-local coordinate source whose stored frame origin references `A`.
3. Confirm coordinate Inspector usage count includes that reference.
4. Delete `A`.
5. Confirm object remains valid and no dangling ref remains.
6. Confirm preview/export do not crash.
7. Undo/redo if available.

## 12. Preserve existing behavior

Do not regress:

- direct coordinate reference inventory/detach;
- coordinate deletion detach;
- layer translation detach;
- coordinateRef validation;
- work-plane-local coordinate validation;
- symbolic/work-plane-local preview refresh;
- TikZ export;
- save/load;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation.

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
- root cause of missed nested work-plane-local frame refs;
- inventory recursion behavior;
- detach recursion behavior;
- `workPlaneFrameField` fallback policy;
- coordinate deletion behavior for nested refs;
- layer translation behavior for nested refs;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
