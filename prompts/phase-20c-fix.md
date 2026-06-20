# Phase 20C Fix Prompt: Reject closed Coons boundary paths in helper and saved-data validation

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

Phase 20C implemented Coons patch creation, preview, and TikZ export.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Closed Coons boundary paths are rejected only in the UI click/pick workflow, but not in lower-level creation helpers or saved primitive validation.

Current behavior:

- `src/ui/ruledSurface.ts` rejects closed paths during clicking.
- But `createCoonsPatchFromBoundaryPaths(...)` can load/copy snapshots directly.
- `validateCoonsPatchPrimitive(...)` only validates corner equality.
- A persisted `coonsPatch` with a closed bottom boundary and matching degenerate corners can validate as `true`.
- This leaves an ambiguous boundary-order path into creation/save-load outside the click workflow.

Review's targeted requirement:

> Fix Phase 20C Coons patch validation so all four Coons boundary snapshots must be open paths in `validateCoonsPatchPrimitive` and `createCoonsPatchFromBoundaryPaths`, add tests for direct creation and save/load rejection of closed Coons boundaries, and keep existing pick-time behavior unchanged.

## Goal

Make Coons patch closed-boundary rejection robust at all entry points.

A Coons patch requires four open boundary paths:

```text
bottom
right
top
left
```

All four boundary snapshots must be open paths.

Closed paths must be rejected:

- during UI picking, as already implemented;
- during helper-level creation;
- during primitive validation;
- during saved JSON load/validation.

## Scope

This is a targeted Phase 20C fix.

Implement:

- open-boundary validation for all four Coons boundary snapshots;
- rejection in `createCoonsPatchFromBoundaryPaths(...)`;
- rejection in `validateCoonsPatchPrimitive(...)`;
- save/load rejection tests;
- direct helper creation rejection tests.

Do not implement:

- new surface types;
- automatic role inference from closed paths;
- accepting closed paths as Coons boundaries;
- Coons boundary splitting;
- new UI workflows;
- new geometry formulas;
- visibility/depth sorting;
- new dependencies.

Do not change:

- valid open-boundary Coons creation;
- Coons patch formula;
- Coons corner compatibility rules;
- source path copy-on-create semantics;
- ruled surface behavior unless shared helpers require safe refactoring;
- SVG/TikZ export semantics for valid Coons patches;
- save/load format for valid diagrams.

## 1. Define and centralize "open boundary" check

Add or reuse a helper to determine whether a boundary path snapshot is closed.

Suggested helpers:

```ts
isBoundaryPathClosed(boundary: BoundaryPathSnapshot, epsilon: number): boolean
isBoundaryPathOpen(boundary: BoundaryPathSnapshot, epsilon: number): boolean
```

or equivalent.

Definition:

- boundary is closed if its start endpoint and end endpoint are approximately equal within the existing geometric tolerance.
- boundary is open if start and end are both finite and not approximately equal.

Requirements:

- handles malformed boundaries safely;
- does not throw raw `TypeError`;
- works with symbolic preview coordinates;
- uses existing endpoint helpers if available;
- respects existing tolerance conventions.

If malformed endpoint data is encountered, return validation failure rather than treating it as open.

## 2. Enforce open boundaries in `validateCoonsPatchPrimitive`

Update `validateCoonsPatchPrimitive(...)` or equivalent validation logic.

Before or during corner validation, require:

```text
bottom is open
right is open
top is open
left is open
```

If any boundary is closed, validation must fail.

Error should identify the offending role when possible:

```text
Coons patch bottom boundary must be an open path.
```

or:

```text
Coons patch boundaries must be open paths; closed boundary found at bottom.
```

Requirements:

- do not rely solely on UI pick-time guard;
- saved primitive validation catches closed boundaries;
- closed paths with degenerate/matching corners are still rejected;
- valid open-boundary Coons patches still validate.

## 3. Enforce open boundaries in `createCoonsPatchFromBoundaryPaths`

Update `createCoonsPatchFromBoundaryPaths(...)` or equivalent helper.

Requirements:

- reject closed boundaries before creating diagram data;
- reject all roles:
  - bottom;
  - right;
  - top;
  - left;
- do not create a Coons patch when any boundary is closed;
- return a clean failure/result/status rather than throwing;
- preserve existing UI pick-time behavior;
- preserve existing corner compatibility behavior for open paths.

If this helper first auto-orients/reverses boundary snapshots, the open-boundary check can happen before or after orientation, but it must occur before final creation. Since reversing a closed path is still closed, either is fine.

Preferred flow:

```text
copy boundary snapshots
-> validate each boundary is open
-> auto-orient by connectivity
-> validate corners
-> create Coons patch
```

## 4. Save/load behavior

Malformed or invalid saved diagrams containing Coons patches with closed boundaries must be rejected.

For `parseSavedDiagramJson(...)` or equivalent:

- a saved `coonsPatch` with a closed bottom boundary returns `ok: false`;
- same for right/top/left;
- no raw exception is thrown;
- error message should mention closed Coons boundary or open-boundary requirement.

Do not silently normalize closed boundaries into open ones.

Do not accept closed boundaries just because corner equations are degenerate and pass.

## 5. Keep pick-time behavior unchanged

Existing click/pick UI already rejects closed paths.

Preserve that behavior.

This fix adds lower-level defense, not a replacement.

The UI should still reject closed paths immediately when picking Coons boundaries if it currently does.

## 6. Ruled surface behavior

This fix is primarily about Coons patches.

Do not add a closed-boundary restriction to ruled surfaces unless the existing ruled-surface design already requires it.

Ruled surfaces may validly connect two closed boundary curves, for example between two loops, depending on current semantics.

Therefore:

- Coons: all four boundaries must be open.
- Ruled: keep existing policy.

Add tests to ensure ruled surface behavior is not accidentally changed, if practical.

## 7. Tests

Add focused tests.

### Primitive validation tests

1. `validateCoonsPatchPrimitive` rejects closed bottom boundary.
2. `validateCoonsPatchPrimitive` rejects closed right boundary.
3. `validateCoonsPatchPrimitive` rejects closed top boundary.
4. `validateCoonsPatchPrimitive` rejects closed left boundary.
5. `validateCoonsPatchPrimitive` rejects a closed boundary even if corner equality would otherwise pass.
6. `validateCoonsPatchPrimitive` accepts a valid open-boundary Coons patch.

### Helper creation tests

7. `createCoonsPatchFromBoundaryPaths(...)` rejects closed bottom boundary.
8. `createCoonsPatchFromBoundaryPaths(...)` rejects closed right boundary.
9. `createCoonsPatchFromBoundaryPaths(...)` rejects closed top boundary.
10. `createCoonsPatchFromBoundaryPaths(...)` rejects closed left boundary.
11. Helper returns a clean failure/status and does not replace/mutate the diagram.
12. Helper still creates a Coons patch from valid open boundaries.

### Save/load tests

13. `parseSavedDiagramJson(...)` returns `ok: false` for saved Coons patch with closed bottom boundary.
14. Same for right boundary.
15. Same for top boundary.
16. Same for left boundary.
17. Saved valid open-boundary Coons patch still loads.
18. No raw exception is thrown for invalid closed-boundary Coons patch.

### Regression tests

19. UI pick-time closed-path rejection still works if testable.
20. Ruled surface behavior for closed boundaries remains unchanged according to existing policy.
21. Existing Coons auto-orientation tests still pass.
22. Existing Coons SVG/TikZ export tests still pass.
23. Existing malformed boundary load rejection tests still pass.

## 8. Error messages

Add or update error text to be clear.

Good examples:

```text
Coons patch bottom boundary must be an open path.
```

```text
Coons patch boundaries must be open paths; closed boundary found at top.
```

Avoid generic corner-only errors when the real problem is a closed boundary.

This matters because a closed path may produce confusing degenerate corner matches.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual tests:

1. Create a closed path.
2. Enter Add sheet > Coons mode.
3. Try to pick it as bottom boundary.
4. Confirm UI rejects it immediately, as before.

Then test helper/save-load behavior if practical:

5. Load or construct a diagram JSON with a Coons patch whose bottom boundary is closed.
6. Confirm load is rejected gracefully.
7. Confirm app does not crash.
8. Confirm error/status mentions open-boundary requirement.
9. Load a valid open-boundary Coons patch.
10. Confirm it loads/renders/exports.

Regression:

11. Create a Coons patch from four valid open paths.
12. Confirm creation succeeds.
13. Create a ruled surface with closed-loop boundaries if currently allowed.
14. Confirm ruled policy is unchanged.

## 10. Preserve existing behavior

Do not regress:

- valid open-boundary Coons creation;
- Coons path auto-orientation;
- Coons corner compatibility for open boundaries;
- sequential boundary picking;
- source path copy-on-create;
- ruled surface creation/validation;
- SVG preview;
- TikZ export;
- save/load of valid diagrams;
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
- where open-boundary validation was added;
- how `validateCoonsPatchPrimitive` rejects closed boundaries;
- how `createCoonsPatchFromBoundaryPaths` rejects closed boundaries;
- save/load rejection behavior;
- error messages added/updated;
- ruled surface behavior preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
