# Phase 20C Fix Prompt: Auto-orient boundary paths for Ruled surfaces and Coons patches

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

Phase 20B/20C implemented ruled surfaces and Coons patches.

Current issue:

- Boundary paths must currently have exactly the expected orientation.
- Even when the endpoints match geometrically, creation can fail if one or more selected paths are reversed.
- This is especially painful for Coons patches, where users pick four existing paths as:

```text
bottom -> right -> top -> left
```

- If those paths connect at the correct endpoints as geometric sets, but some of them are oriented oppositely, the app should automatically reinterpret/reverse copied boundary snapshots instead of rejecting the input.
- Ruled surfaces have a similar issue: the two boundary curves should be automatically aligned when one is picked in the opposite direction.

Desired behavior:

- Source paths remain unchanged.
- Boundary snapshots copied into the new surface may be reversed/canonicalized.
- If a valid orientation exists, creation should succeed.
- If no orientation assignment makes the boundaries compatible, creation should still reject clearly.

## Goal

Implement automatic boundary path orientation for:

1. Ruled surfaces from two boundary paths.
2. Coons patches from four boundary paths.

The user should be able to select geometrically compatible paths without manually editing their directions.

## Scope

This is a targeted Phase 20B/20C fix.

Implement:

- path boundary reversal helper;
- ruled surface boundary auto-orientation;
- Coons patch boundary auto-orientation;
- validation updates;
- tests.

Do not implement:

- new surface types;
- new creation UI beyond status text if helpful;
- live linked boundaries;
- path direction editing UI;
- snapping;
- broad multi-selection changes;
- auto-repair of nonmatching endpoints;
- boolean operations;
- new dependencies.

Do not change:

- Coons patch formula;
- ruled surface formula;
- source path geometry;
- copy-on-create policy;
- SVG/TikZ export semantics except created surfaces now succeed in more cases;
- save/load format unless absolutely necessary.

## 1. Add path boundary reversal helpers

Add pure helpers for reversing boundary snapshots and path segments.

Suggested helpers:

```ts
reverseBoundaryPathSnapshot(boundary: BoundaryPathSnapshot): BoundaryPathSnapshot
reversePathSegments(segments: PathSegment[]): PathSegment[]
reversePathSegment(segment: PathSegment): PathSegment
```

Requirements:

- do not mutate input;
- preserve symbolic coordinate metadata;
- preserve style/metadata if present;
- reverse segment order;
- swap start/end for line segments;
- swap start/end and control points for cubic Bézier segments:
  - reversed cubic start = original end;
  - reversed control1 = original control2;
  - reversed control2 = original control1;
  - reversed end = original start;
- reverse arc segment orientation correctly if arcs are supported:
  - swap start/end;
  - swap start/end angles or otherwise preserve the same geometric arc traversed in reverse;
  - flip direction clockwise/counterclockwise;
  - preserve center/radius/frame;
- handle circle/ellipse/path-template boundaries only if they are supported as boundary snapshots;
  - if not supported, reject them cleanly.

## 2. Endpoint helper utilities

Add or reuse helpers:

```ts
boundaryStart(boundary): Vec3
boundaryEnd(boundary): Vec3
pointsApproximatelyEqual(a, b, epsilon): boolean
endpointDistance(a, b): number
```

Requirements:

- finite checks;
- symbolic preview coordinates used for comparison;
- respect existing tolerance;
- no thrown TypeError for malformed input;
- invalid/malformed boundaries rejected cleanly.

## 3. Coons patch auto-orientation

Coons role order remains:

```text
bottom -> right -> top -> left
```

Canonical Coons orientation should satisfy:

```text
bottom.start == left.start
bottom.end   == right.start
top.start    == left.end
top.end      == right.end
```

Current behavior appears to require picked paths already satisfy this orientation.

New behavior:

- Given the four picked boundary paths, try orientation flips for each path.
- There are only `2^4 = 16` possible orientation assignments.
- Find assignments that satisfy the corner compatibility equations within tolerance.
- If at least one valid assignment exists:
  - choose the assignment with the fewest reversals;
  - if tied, use deterministic tie-break order;
  - store copied boundary snapshots in canonical orientation;
  - create the Coons patch.
- If no assignment exists:
  - reject with a clear validation message;
  - keep draft picks so user can reset/fix;
  - do not create invalid diagram data.

Important:

- Do not reorder roles. Only reverse individual paths.
- If the user picked a path as `bottom`, it remains `bottom`.
- The source path object is not mutated.
- Only the copied boundary snapshot is reversed if needed.

Suggested helper:

```ts
orientCoonsBoundaries({
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
}, ValidationError>
```

## 4. Ruled surface auto-orientation

For ruled surfaces, the two boundary paths should have compatible parameter direction.

Preferred behavior:

- Keep `boundary0` orientation as picked.
- Compare `boundary1` in original and reversed orientation.
- Choose the orientation whose endpoints best align with `boundary0`.

For open boundaries:

```text
same direction score =
  distance(boundary0.start, boundary1.start)
  + distance(boundary0.end, boundary1.end)

reversed direction score =
  distance(boundary0.start, boundary1.end)
  + distance(boundary0.end, boundary1.start)
```

If reversed score is clearly smaller, reverse `boundary1`.

If endpoints are expected to match exactly according to current ruled-surface validation, require the chosen orientation to pass that validation.

If the current ruled surface model only needs same closure status and parameter sampling, use the distance heuristic and document it.

Requirements:

- source paths unchanged;
- copied boundary1 may be reversed;
- finite endpoint checks;
- deterministic behavior;
- clear status/report if boundary1 was auto-reversed.

Suggested helper:

```ts
orientRuledSurfaceBoundaries(
  boundary0,
  boundary1,
  epsilon
): Result<{
  boundary0: BoundaryPathSnapshot;
  boundary1: BoundaryPathSnapshot;
  reversedBoundary1: boolean;
}, ValidationError>
```

Optional:

- allow reversing both boundaries only if the current model has a canonical direction requirement.
- MVP should keep boundary0 as picked and only reverse boundary1 if needed.

## 5. Integrate with creation workflows

Update creation helpers used by:

- Add sheet > Ruled surface;
- Add sheet > Coons patch;
- sequential boundary picking workflow;
- creation from selected paths if still supported.

Integration point should be before final surface validation and before copying into the created surface.

Expected flow:

```text
picked source paths
-> copy boundary snapshots
-> auto-orient copied snapshots
-> validate oriented surface
-> create surface
```

Do not mutate source paths.

## 6. Status messages

If a boundary was auto-reversed, it is helpful to show a concise status message.

Examples:

```text
Coons patch created. Auto-reversed top boundary.
```

```text
Coons patch created. Auto-reversed right and left boundaries.
```

```text
Ruled surface created. Auto-reversed second boundary.
```

If status messages are not easy to implement, at least include reversal information in helper return values and tests.

## 7. Validation behavior

Cases that should now succeed:

### Coons

- endpoints match geometrically but one or more paths are reversed;
- all four roles are correct, but directions differ.

Cases that should still fail:

- endpoints do not match any orientation assignment;
- wrong roles picked, e.g. top path picked as right path;
- missing boundary;
- malformed boundary;
- non-finite endpoint;
- unsupported boundary type.

### Ruled

- second boundary is picked in the opposite direction and can be reversed;
- source paths remain unchanged.

Cases that should still fail:

- incompatible closure status if current validation requires matching closure status;
- malformed boundary;
- non-finite endpoint;
- unsupported boundary type.

## 8. Tests

Add focused tests.

### Boundary reversal helper tests

1. Reversing a line segment swaps start/end.
2. Reversing a cubic segment swaps start/end and control1/control2 correctly.
3. Reversing a multi-segment boundary reverses segment order and endpoints.
4. Reversal preserves symbolic coordinate metadata.
5. Reversing an arc segment preserves geometric arc in reverse direction if arcs are supported.
6. Unsupported boundary segment is rejected cleanly.

### Coons orientation tests

7. Coons boundaries already oriented correctly remain unchanged.
8. Coons patch with reversed bottom boundary succeeds and stores bottom reversed.
9. Coons patch with reversed right boundary succeeds and stores right reversed.
10. Coons patch with reversed top boundary succeeds and stores top reversed.
11. Coons patch with reversed left boundary succeeds and stores left reversed.
12. Coons patch with multiple reversed boundaries succeeds.
13. Coons orientation chooses the fewest reversals.
14. Coons with no valid orientation assignment fails cleanly.
15. Coons source paths are not mutated.

Use simple paths with endpoints:

```text
bottom: A -> B
right: B -> C
top: D -> C or C -> D depending on canonical convention
left: A -> D
```

Match the canonical equations in the implementation.

### Ruled orientation tests

16. Ruled boundaries with same direction remain unchanged.
17. Ruled second boundary reversed is auto-reversed.
18. Ruled source paths are not mutated.
19. Ruled incompatible boundaries still fail if validation requires compatibility.

### Creation workflow tests

20. Sequential Coons picking with reversed path directions can create a patch.
21. Sequential ruled picking with reversed second boundary can create a surface.
22. Draft is preserved on failed final orientation.
23. Created surface uses oriented copied boundary snapshots.
24. SVG/TikZ export still works for created surfaces.

### Regression tests

25. Existing Coons patch creation with already oriented paths still works.
26. Existing ruled surface creation still works.
27. Save/load valid ruled/Coons surfaces still works.
28. Malformed boundary save/load rejection from earlier fix still works.

## 9. Documentation

Update docs or creation help text:

- Boundary paths may be picked in either direction.
- Coons patch roles still matter:
  - bottom;
  - right;
  - top;
  - left.
- The editor may auto-reverse copied boundary snapshots to satisfy endpoint compatibility.
- Source paths are not modified.
- If no orientation assignment matches, creation is rejected.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Coons manual test:

1. Create four boundary paths whose endpoints form a quadrilateral.
2. Reverse one of the paths by creating it in the opposite direction.
3. Enter Add sheet > Coons mode.
4. Pick paths in role order:
   - bottom;
   - right;
   - top;
   - left.
5. Confirm creation succeeds.
6. Confirm surface appears.
7. Confirm source paths remain unchanged.
8. Repeat with multiple reversed boundaries.

Ruled manual test:

9. Create two open boundary paths with opposite directions.
10. Enter Add sheet > Ruled surface mode.
11. Pick first boundary.
12. Pick second reversed boundary.
13. Confirm creation succeeds.
14. Confirm source paths remain unchanged.

Failure test:

15. Pick paths whose endpoints cannot form a valid Coons patch under any reversal.
16. Confirm creation fails cleanly and draft is preserved.

## 11. Preserve existing behavior

Do not regress:

- sequential boundary picking workflow;
- source path copy-on-create;
- ruled surface sampling;
- Coons patch sampling;
- Coons corner validation;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior;
- inline/standalone TikZ formatting.

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
- boundary reversal helper implementation;
- Coons auto-orientation algorithm;
- Ruled surface auto-orientation algorithm;
- tie-break policy;
- validation behavior;
- source mutation avoidance;
- status message behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
