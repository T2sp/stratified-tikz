# Phase 20C Fix Prompt: Allow point inputs as constant Coons boundaries and show target corner equations

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

Phase 20C implemented Coons patch creation from four boundary paths.

Recent fixes added or attempted to add boundary-direction handling. The desired behavior now needs two additional changes:

1. **Allow point inputs for Coons patch boundaries.**

   In Add sheet > Coons patch mode, users should be able to select an existing point as one of the four Coons inputs:

   ```text
   bottom
   right
   top
   left
   ```

   A selected point should be treated as a constant path:

   ```text
   C(t) = P
   ```

   so its start and end are both the selected point.

2. **Show the correct Coons corner-matching conditions during direction adjustment.**

   While selecting paths/points and adjusting boundary directions, the UI should explicitly display the target equations:

   ```text
   bottom start = left start
   bottom end   = right start
   top start    = left end
   top end      = right end
   ```

   The display should update as the user reverses paths or selects point inputs.

## Goal

Fix Coons patch creation so that:

- each Coons boundary role can be either:
  - an existing path boundary; or
  - an existing point interpreted as a constant path;
- explicit point inputs are accepted even though their start and end coincide;
- ordinary closed path inputs remain rejected if that is the current Coons policy;
- source paths and source points are never mutated;
- the Coons direction UI shows the desired corner equations and current match/mismatch status;
- Coons patch creation uses the effective oriented/copied boundaries.

## Scope

This is a targeted Phase 20C fix.

Implement:

- point-as-constant-boundary support for Coons patch inputs;
- Coons boundary input model that can distinguish path boundaries from explicit point boundaries;
- effective constant-path boundary snapshots;
- validation updates allowing explicit point constant boundaries;
- UI display of target Coons corner equations;
- tests for point boundary inputs and direction-equation display helpers.

Do not implement:

- point inputs for all surface types unless trivial and explicitly safe;
- general live linked boundaries;
- automatic role inference from unordered paths/points;
- automatic snapping/endpoint repair;
- new surface formulas;
- new geometry object kinds beyond what is needed for constant boundary snapshots;
- broad multi-selection redesign;
- new dependencies.

Do not change:

- source path geometry;
- source point geometry;
- copy-on-create policy;
- Coons patch formula;
- SVG/TikZ export semantics for valid Coons patches;
- save/load format unless needed to persist explicit constant boundaries in completed Coons patches;
- ruled surface behavior unless explicitly reusing safe helpers.

## 1. Extend Coons boundary input model

Currently Coons boundaries are likely represented as path snapshots.

Extend the creation/input model to support explicit point boundaries.

Suggested draft state:

```ts
type CoonsBoundaryRole = "bottom" | "right" | "top" | "left";

type PickedCoonsBoundary =
  | {
      kind: "path";
      sourcePathId: string;
      reversed: boolean;
    }
  | {
      kind: "point";
      sourcePointId: string;
    };
```

Exact shape can differ.

Requirements:

- path inputs keep the existing `reversed` behavior;
- point inputs do not need `reversed`, because a constant path has no direction;
- point input is explicit and must be distinguishable from a closed path;
- point input draft state is UI/editor state until creation;
- completed Coons patch stores copied boundary geometry / primitive data, not live references.

## 2. Constant path representation

Add a representation for a constant Coons boundary.

Recommended persistent representation:

```ts
type CoonsBoundarySnapshot =
  | {
      kind: "path";
      segments: PathSegment[];
      name?: string;
      sourceId?: string;
    }
  | {
      kind: "constantPoint";
      point: Vec3;
      name?: string;
      sourceId?: string;
    };
```

or equivalent.

Alternative:

- represent constant point as a special boundary snapshot that evaluates to `point` for every parameter `t`;
- avoid encoding it as a normal closed path with zero-length segment unless the validation clearly distinguishes explicit constant boundaries from rejected closed paths.

Important:

- Do not simply accept all closed paths as Coons boundaries.
- Explicit point-as-constant-boundary is allowed.
- Ordinary closed path boundaries are still rejected for Coons unless there is a separate intentional feature.

## 3. Evaluation and endpoints for constant boundaries

Update boundary helper functions to support constant point boundaries.

Required helper behavior:

```text
boundaryStart(constantPoint(P)) = P
boundaryEnd(constantPoint(P)) = P
evaluateBoundary(constantPoint(P), t) = P for all t
sampleBoundary(constantPoint(P), n) = [P, P, ..., P]
reverseBoundary(constantPoint(P)) = constantPoint(P)
```

Requirements:

- finite point required;
- symbolic preview coordinates supported if the project supports symbolic points;
- no NaN/Infinity;
- constant boundary samples must have the same number of points as other sampled boundaries when used in Coons patch sampling.

## 4. Coons validation with constant boundaries

Canonical Coons corner equations remain:

```text
bottom start = left start
bottom end   = right start
top start    = left end
top end      = right end
```

Point boundaries should satisfy these equations with start=end.

Examples:

### Bottom is a point

If:

```text
bottom = P
```

then:

```text
bottom start = P
bottom end   = P
```

So validation requires:

```text
left start  = P
right start = P
```

This represents a bottom edge collapsed to a point.

### Top is a point

If:

```text
top = P
```

then validation requires:

```text
left end  = P
right end = P
```

### Left is a point

If:

```text
left = P
```

then validation requires:

```text
bottom start = P
top start    = P
```

### Right is a point

If:

```text
right = P
```

then validation requires:

```text
bottom end = P
top end    = P
```

Reject if equations fail.

## 5. Coons sampling with constant boundaries

Update Coons patch sampling to support constant boundaries.

The standard Coons interpolation still works if boundary evaluators return constant values.

Requirements:

- sampling returns finite mesh;
- constant boundaries do not crash;
- degenerate but valid patches are allowed when corner equations are satisfied;
- surface may degenerate to triangular-like or cone-like patch near the collapsed boundary;
- no division by zero or non-finite values.

## 6. Add point picking in Add sheet > Coons mode

Update click handling in Add sheet > Coons mode.

Current Coons workflow picks paths sequentially.

New behavior:

- clicking an eligible path assigns a path boundary to the next role;
- clicking an eligible point assigns a constant point boundary to the next role;
- no need to switch to Select mode;
- selected role order remains:

```text
bottom -> right -> top -> left
```

Requirements:

- point input is accepted only in Coons patch mode unless intentionally supported elsewhere;
- path and point clicks should not mutate selection as their primary action in Add sheet > Coons mode;
- invalid clicked objects are rejected without clearing draft;
- previous picks are preserved;
- Reset clears all picks;
- Create disabled until all four roles are filled and validation passes.

## 7. Direction / reverse controls with point inputs

For path boundary inputs:

- show current direction;
- show Reverse button/toggle;
- reversal affects the copied boundary only.

For point boundary inputs:

- show it as constant:

```text
Bottom: Point P (constant)
```

or:

```text
Bottom: P -> P
```

- no Reverse button is needed, or it should be disabled.

If a point is shown with endpoints:

```text
start = end = (x,y,z)
```

## 8. Show target Coons corner equations

Add UI display in Add sheet > Coons mode showing the canonical target conditions.

Required display:

```text
Required Coons corners:
  bottom start = left start
  bottom end   = right start
  top start    = left end
  top end      = right end
```

The display should update with current status if enough roles are picked.

Preferred UI:

```text
Required Coons corners
  ✓ bottom start = left start
      (0,0,0) = (0,0,0)
  ✗ bottom end = right start
      (1,0,0) ≠ (0,1,0)
  ✓ top start = left end
  ✓ top end = right end
```

Acceptable MVP:

- always show the required equations as text;
- show a concise validation status below them;
- when a mismatch occurs, mention which equation failed.

Better behavior:

- display checkmarks/crosses for each equation;
- include endpoint coordinates or point/path names where compact.

Requirements:

- equations visible only for Coons mode;
- updates when boundary directions are reversed;
- updates when a point constant boundary is selected;
- helps the user know which path to reverse.

## 9. Error messages

Improve the current generic error.

Instead of only:

```text
Coons patch corners must match...
```

show something actionable:

```text
Coons corners do not match with current boundary directions.
Failed: bottom end = right start.
Use Reverse controls or choose a point/path with matching endpoint.
```

If multiple conditions fail, list them concisely.

If point constant boundary is involved, make message clear:

```text
Bottom is a constant point, so left start and right start must both equal that point.
```

## 10. Save/load behavior

If completed Coons patches can persist constant point boundaries, update save/load validation.

Requirements:

- valid Coons patch with constant point boundary saves/loads;
- invalid constant boundary point rejected if non-finite/malformed;
- malformed saved constant boundary rejected cleanly;
- old diagrams without constant boundaries still load.

If you choose to convert constant point boundary into a degenerate path representation for persistence, tests must prove the validator still distinguishes explicit constant boundaries from ordinary closed paths.

Preferred:

- use explicit `kind: "constantPoint"` or equivalent.

## 11. TikZ/SVG export behavior

Created Coons patches with constant point boundaries should render/export like other Coons patches.

Requirements:

- SVG preview finite;
- TikZ sampled mesh finite;
- style/layer preserved;
- inline math output no blank lines;
- 4-space indentation preserved.

No special TikZ syntax is required for constant boundaries. Existing sampled mesh output is fine.

## 12. Tests

Add focused tests.

### Constant boundary helper tests

1. `boundaryStart(constantPoint(P)) = P`.
2. `boundaryEnd(constantPoint(P)) = P`.
3. `evaluateBoundary(constantPoint(P), t) = P`.
4. Reversing constant point boundary is a no-op.
5. Sampling constant boundary returns finite repeated points.
6. Non-finite constant point rejected.

### Coons validation tests

7. Coons patch with bottom constant point validates when left.start and right.start match it.
8. Coons patch with top constant point validates when left.end and right.end match it.
9. Coons patch with left constant point validates when bottom.start and top.start match it.
10. Coons patch with right constant point validates when bottom.end and top.end match it.
11. Constant boundary with mismatched adjacent endpoints rejected.
12. Ordinary closed path boundary is still rejected.
13. Valid open-boundary Coons patch still validates.

### Coons sampling tests

14. Coons patch with one constant boundary samples finite mesh.
15. Coons patch with two compatible constant boundaries samples finite mesh if geometrically valid.
16. Degenerate invalid cases rejected or sampled safely according to policy.

### UI/draft tests

17. Coons draft can store a point input for bottom.
18. Coons draft can store mixed path/point inputs.
19. Reverse control is disabled/hidden for point inputs.
20. Direction/equation status updates when a path is reversed.
21. Required equations display helper returns all four equations.
22. Mismatch status identifies failing equation.

### Creation tests

23. Add sheet > Coons mode can create a patch with one point input and three paths.
24. Source point is not mutated.
25. Source paths are not mutated.
26. Created patch stores copied constant boundary.
27. Created patch selected.

### Save/load/export tests

28. Coons patch with constant boundary save/load round-trip.
29. Malformed constant boundary in saved JSON returns `ok: false`.
30. SVG/TikZ export works.
31. Inline TikZ output has no blank lines.

### Regression tests

32. Coons patch with four open paths still works.
33. Coons path direction controls still work.
34. Closed path rejection still works.
35. Ruled surface behavior unchanged unless intentionally extended.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Create a point `P`.
2. Create three open paths that meet at `P` as required for a Coons patch with one collapsed boundary.
3. Enter Add sheet > Coons mode.
4. Pick `P` as one role, e.g. bottom.
5. Pick paths for right/top/left.
6. Confirm UI shows bottom as constant.
7. Confirm required corner equations are visible.
8. Confirm matching equations show success/failure.
9. Reverse relevant path directions if needed.
10. Confirm status updates.
11. Create Coons patch.
12. Confirm SVG preview shows a finite surface.
13. Confirm TikZ output is generated.
14. Save/load and confirm the patch persists.

Regression:

15. Create Coons patch with four paths as before.
16. Confirm direction controls still work.
17. Confirm ordinary closed path boundaries are still rejected.

## 14. Preserve existing behavior

Do not regress:

- Coons sequential boundary picking;
- Coons path direction reverse controls;
- ordinary open-boundary Coons patches;
- closed path rejection;
- ruled surface creation;
- source path/point copy-on-create;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior;
- inline/standalone TikZ formatting.

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
- constant boundary representation;
- point picking behavior in Coons mode;
- validation rules for constant boundaries;
- sampling behavior;
- direction/equation UI behavior;
- save/load behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
