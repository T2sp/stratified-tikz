# Phase 22F Fix Prompt: Filter capped path-crossing cleanup against existing 2D curve references

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

Phase 22F implemented arrow/braiding polish, docs, and regression hardening.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Capped crossing cleanup can retain crossing states for deleted or missing curves, leaving the diagram invalid after normal UI operations on dense diagrams.

Review details:

- In `src/model/pathCrossings.ts`, capped detection returns:

```ts
structurallyValidPathCrossingStates(states)
```

- But `structurallyValidPathCrossingStates(...)` only checks shape.
- It does **not** verify that:

```text
pathAId
pathBId
```

still reference existing 2D curve strata.

- Curve deletion calls crossing cleanup in `src/ui/diagramUpdates.ts`.
- In dense diagrams where crossing detection is capped, the cleanup can keep a stale crossing that references a deleted curve.
- Then the diagram can fail validation later with an error such as:

```text
Path B must reference a 2D curve.
```

Review reproduction:

- 50 filler paths plus a braided crossing.
- Delete one crossing curve.
- Capped cleanup leaves:

```text
kept: 1
valid: false
Path B must reference a 2D curve.
```

This violates dense-diagram hardening and save/load robustness.

## Goal

Fix capped path-crossing cleanup so it only retains crossing states whose path references are still valid in the current diagram.

When path-crossing detection is capped and cannot recompute all intersections, the cleanup may preserve save/load-compatible crossing states, but only if they reference:

- distinct existing path IDs;
- existing 2D curve strata;
- codimension-1 curve-like objects appropriate for 2D path crossings;
- non-grid curves, if grids are intentionally excluded from braiding/crossing detection.

Stale crossings referencing deleted/missing curves must be removed.

## Scope

This is a targeted Phase 22F fix.

Implement:

- reference-aware filtering in capped path-crossing cleanup;
- tests for deleting a braided curve in a capped/dense diagram;
- tests for deleting a layer containing a braided curve in a capped/dense diagram;
- preservation of normal uncapped crossing cleanup behavior.

Do not implement:

- new braiding behavior;
- new intersection algorithm;
- new arrow behavior;
- new UI features;
- new save/load format;
- 3D braiding;
- broad crossing model redesign;
- new dependencies.

Do not change:

- existing crossing state shape unless absolutely necessary;
- click-to-toggle cycle;
- braiding/anti-braiding convention;
- normal uncapped cleanup semantics;
- path deletion semantics;
- layer deletion semantics;
- TikZ export semantics;
- SVG marker rendering semantics.

## 1. Inspect capped crossing cleanup

Inspect:

- `src/model/pathCrossings.ts`;
- `structurallyValidPathCrossingStates(...)`;
- crossing cleanup helpers;
- capped intersection detection fallback;
- `src/ui/diagramUpdates.ts` deletion cleanup path;
- layer delete cleanup path;
- validation logic around `Path A/B must reference a 2D curve`.

Find the code path where capped detection returns structurally valid states without checking current diagram references.

The fix should go in the model/helper layer, not only in one UI caller, so all callers benefit.

## 2. Add reference-aware retained-state filtering

Add or update a helper such as:

```ts
filterPathCrossingStatesForExisting2DCurves(
  states: PathCrossingState[],
  diagram: Diagram
): PathCrossingState[]
```

or:

```ts
validExistingPathCrossingStates(states, diagram)
```

Exact name can differ.

Requirements:

For each crossing state, keep it only if:

1. The state is structurally valid.
2. `pathAId` exists in the current diagram.
3. `pathBId` exists in the current diagram.
4. `pathAId !== pathBId`.
5. Both referenced objects are 2D curve strata.
6. Both referenced curves are codim-1 in the 2D convention.
7. Neither referenced object is a grid if the project excludes grids from path crossings.
8. The diagram ambient dimension is 2.

If any condition fails, drop the crossing state.

Do not keep stale states solely because they have the right shape.

## 3. Clarify what counts as an eligible 2D curve

Use the same eligibility policy as Phase 22C intersection detection.

Likely eligible:

- polylines;
- concatenated paths;
- line/cubic/arc path-like curves;
- circle/ellipse path templates if supported.

Likely not eligible:

- grids;
- labels;
- points;
- sheets;
- filled regions;
- 3D curves;
- non-curve strata.

Important:

- Reuse existing helper if available, e.g. `is2DPathLikeCurveForIntersections(...)`.
- Do not duplicate divergent eligibility logic.

If such helper does not exist, extract one and use it both for intersection detection and crossing-state cleanup.

## 4. Use reference-aware filtering in capped cleanup

When detection is capped and cannot recompute intersections:

Current behavior:

```ts
return structurallyValidPathCrossingStates(states);
```

New behavior should be:

```ts
return structurallyValidPathCrossingStates(states)
  .filter((state) => referencesExistingEligible2DCurves(state, diagram));
```

or equivalent.

If the cleanup helper does not currently receive `diagram`, change the function signature or pass enough context, such as a set of eligible curve IDs.

Suggested:

```ts
const eligibleCurveIds = getEligible2DPathCrossingCurveIds(diagram);

return structurallyValidPathCrossingStates(states).filter((state) =>
  eligibleCurveIds.has(state.pathAId) &&
  eligibleCurveIds.has(state.pathBId) &&
  state.pathAId !== state.pathBId
);
```

This is efficient and simple.

## 5. Delete curve and delete layer behavior

Ensure stale crossings are removed when:

- deleting one curve that participates in a crossing;
- deleting both curves;
- deleting a layer that contains one or more crossed curves;
- deleting a layer in a dense/capped diagram where full intersection recomputation is skipped.

After deletion:

- `diagram.pathCrossings` should not contain references to deleted curves;
- `validateDiagram(...)` should pass if no other issues remain.

## 6. Preserve uncapped cleanup behavior

When detection is not capped, cleanup should continue to do the full recomputation/matching behavior introduced earlier.

Do not degrade normal crossing preservation behavior.

Specifically:

- valid existing crossings should remain if still matched;
- stale crossings should be removed/reconciled according to existing policy;
- crossing `kind` should be preserved where existing logic preserves it.

The reference-aware filter is especially important in capped fallback paths, but it is safe to apply as a prefilter in all cleanup paths.

## 7. Save/load behavior

Save/load should remain robust.

Requirements:

- valid path crossings that reference existing 2D curves still load.
- path crossings that reference missing curves are rejected or cleaned according to existing load policy.
- no invalid crossing state should remain after UI delete operations.
- diagram validation should not fail after normal delete/layer delete operations because of stale path crossings.

This fix is primarily about normal UI cleanup after deletion in capped/dense diagrams, not necessarily silently cleaning arbitrary invalid JSON. Preserve current save/load validation policy unless needed.

## 8. Tests

Add focused regression tests.

### Pure helper tests

1. `structurallyValidPathCrossingStates(...)` or the new helper drops a crossing whose `pathAId` is missing.

2. Drops a crossing whose `pathBId` is missing.

3. Drops a crossing where `pathAId === pathBId`.

4. Drops a crossing where one referenced object is a point.

5. Drops a crossing where one referenced object is a sheet.

6. Drops a crossing where one referenced object is a grid, if grids are excluded.

7. Keeps a crossing where both ids reference distinct existing 2D codim-1 non-grid curves.

8. Drops all crossings in a 3D diagram if 3D crossings are unsupported.

### Capped cleanup tests

9. Create a dense/capped diagram with many filler paths and one braided crossing.

10. Force crossing cleanup to use the capped fallback path.

11. Delete one curve participating in the crossing.

Expected:

- stale crossing is removed;
- `validateDiagram(...)` passes;
- no crossing state references deleted curve.

12. Delete the other participating curve and verify same behavior.

13. Delete both participating curves and verify same behavior.

### Layer deletion tests

14. Create dense/capped diagram with a braided crossing where one participating curve is on a layer.

15. Delete that layer.

Expected:

- crossing is removed;
- `validateDiagram(...)` passes.

16. Delete a layer containing both crossed curves.

Expected:

- crossing is removed;
- validation passes.

### Regression tests

17. In uncapped cleanup, valid crossings are preserved.

18. In capped cleanup, valid crossings referencing existing curves are preserved.

19. Crossing `kind: "braiding"` is preserved for kept states.

20. Crossing `kind: "antiBraiding"` is preserved for kept states.

21. Existing toggle cycle tests still pass.

22. Existing save/load crossing tests still pass.

23. Existing SVG marker tests still pass.

## 9. Constructing the dense/capped fixture

Use a small but deterministic fixture.

Suggested:

- two real crossing paths:
  - `pathA`;
  - `pathB`;
- one crossing state between them with `kind: "braiding"`;
- enough filler paths to exceed whatever candidate/path/segment cap triggers capped cleanup.

If the cap can be passed as an option, set it very low in the test instead of creating many paths.

Preferred:

```ts
cleanupPathCrossings(diagram, { maxIntersectionCandidates: 0 })
```

or equivalent if available.

The test should not be slow.

## 10. Avoid over-cleaning valid states

The capped fallback is allowed to keep valid references without recomputing exact intersections.

Do not require exact current intersection matching in the capped fallback path, because the cap exists to avoid expensive detection.

However, at minimum, retained states must reference existing eligible curve IDs.

That is the core fix.

## 11. Error/status behavior

No user-facing error is required for dropped stale crossings after deletion.

It is normal cleanup.

If debug/status exists, it may report:

```text
Removed stale crossing states for deleted paths.
```

But do not add intrusive UI.

## 12. Preserve existing behavior

Do not regress:

- crossing toggle cycle;
- braiding/anti-braiding convention;
- SVG markers;
- TikZ braiding export;
- no-knot package policy;
- arrow features;
- dense intersection detection caps;
- save/load;
- path deletion;
- layer deletion;
- undo/redo;
- validation;
- SVG preview;
- TikZ output;
- inline no-blank-lines;
- 4-space indentation.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test if practical:

1. Create a 2D diagram with two crossing paths.
2. Toggle crossing to braiding.
3. Add enough additional paths to trigger dense/capped cleanup, or set a low cap if UI/dev option exists.
4. Delete one of the crossed paths.
5. Confirm no validation error occurs.
6. Save/load diagram if possible.
7. Confirm no stale crossing marker remains.
8. Undo deletion.
9. Confirm crossing can return if undo restores the curve and crossing state according to existing undo behavior.

Layer test:

10. Put one crossed curve on a layer.
11. Delete that layer.
12. Confirm no validation error and no stale crossing.

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
- root cause of capped cleanup retaining deleted curve references;
- new reference-aware filtering behavior;
- definition of eligible 2D non-grid curve;
- how capped cleanup now handles missing curves;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
