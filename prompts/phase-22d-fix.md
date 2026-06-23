# Phase 22D Fix Prompt: Clean stale path crossing states after symbolic import refresh

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

Phase 22D implemented persistent 2D path crossing states and click-to-toggle braiding states.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

The symbolic variable-resolution import path can reject otherwise valid diagrams with persisted crossing state.

Review details:

- `src/model/serialization.ts` refreshes coordinates during pending symbolic import.
- It then validates `refreshed.diagram` directly.
- It does not clean or reconcile `pathCrossings` after symbolic previews are refreshed.
- Crossing IDs include path parameters.
- Resolving a symbolic variable can change the current path parameter of the same geometric intersection.
- Therefore, a previously normalized crossing can become stale and fail validation with:

```text
Path crossing state must match a current 2D path intersection.
```

Reproduced case from review:

- A 2D crossing lies on a path from `(0,0)` to `(Len,0)`.
- The saved diagram was normalized at `Len = 2`.
- During import, the user resolves `Len = 4`.
- The geometric crossing may still exist, but its path parameter changes.
- The stored crossing state no longer matches the current detected intersection.
- Import fails instead of cleaning or reconciling stale crossing state.

## Goal

Fix Phase 22D symbolic import behavior.

After symbolic preview refresh, but before `validateDiagram`, stale `pathCrossings` must be cleaned or reconciled against the current 2D path intersections.

Importing a diagram with stale crossing state after variable resolution should not fail solely because crossing IDs/parameters changed.

Required:

1. In `resolvePendingSymbolicDiagramImport`, clean or normalize path crossing states after symbolic refresh.
2. Do this before `validateDiagram`.
3. Add a regression test for a symbolic 2D crossing whose resolved variable changes the crossing parameter.
4. Preserve normal save/load validation for valid crossings.
5. Preserve rejection of truly invalid/malformed crossing state when not in a cleanup context.

## Scope

This is a targeted Phase 22D fix.

Implement:

- crossing-state cleanup/reconciliation after symbolic import preview refresh;
- tests for symbolic import with stale crossing parameters;
- preservation of existing crossing cleanup behavior for path edits/deletions.

Do not implement:

- new braiding rendering;
- new crossing detection algorithm;
- Phase 22E TikZ gap/mask behavior;
- 3D braiding;
- new symbolic expression features;
- broad save/load redesign;
- new dependencies.

Do not change:

- crossing state data model unless absolutely necessary;
- toggle cycle;
- braiding/anti-braiding convention;
- normal save/load behavior for valid diagrams;
- path geometry;
- SVG marker rendering;
- TikZ export semantics;
- inline/standalone formatting.

## 1. Inspect current symbolic import flow

Inspect:

- `src/model/serialization.ts`;
- `resolvePendingSymbolicDiagramImport`;
- `normalizeLoadedDiagram`;
- symbolic preview refresh helpers;
- `validateDiagram`;
- path crossing validation;
- crossing cleanup helpers used by curve edits, deletions, layer deletion/translation, path reversal, and geometry handle edits.

The review says the problem is around:

```text
pending symbolic import refreshes coordinates
then validates refreshed.diagram directly
without cleaning pathCrossings
```

Find the exact spot and insert crossing cleanup/reconciliation between refresh and validation.

## 2. Reuse existing crossing cleanup helpers where possible

The review says stale crossing states are already cleaned through shared helpers for:

- curve edits;
- deletion;
- layer deletion/translation;
- path reversal;
- geometry handle edits.

Find that helper.

Possible names might be like:

```ts
cleanPathCrossings(...)
normalizePathCrossings(...)
reconcilePathCrossingsWithIntersections(...)
removeStalePathCrossings(...)
```

Use the existing helper if it:

- recomputes current intersections;
- removes stale crossing states;
- preserves still-valid crossing states;
- is safe for 2D diagrams;
- clears crossings for 3D diagrams according to existing policy.

If no suitable helper exists, add a small helper with the same semantics and use it in both import and existing edit paths if appropriate.

## 3. Cleanup/reconciliation policy

Choose a clear policy.

### Preferred policy: reconcile where possible, otherwise remove stale

After symbolic refresh:

1. Recompute current 2D intersection candidates.
2. For each persisted `PathCrossingState`:
   - if it still matches a current intersection by current ID, keep it;
   - else if it references the same path pair and a nearby current intersection exists, update/rebind to the current intersection while preserving `kind`:
     - `none`;
     - `braiding`;
     - `antiBraiding`;
   - else remove it as stale.

This preserves user braiding choices when the same geometric crossing remains but parameters shift.

### Acceptable MVP: remove stale crossings

After symbolic refresh:

- remove any crossing state that no longer matches current intersections.
- Keep only currently valid crossing states.
- This may lose a crossing toggle, but it avoids failed imports and keeps diagram valid.

If choosing the MVP removal policy, document it in report/tests.

Important:

- Do not mutate the previous current editor diagram during pending import.
- The cleaned diagram should be the one passed to `validateDiagram`.

## 4. Insert cleanup before validation

The load flow should become:

```text
pending import raw diagram
-> apply user-provided variable values
-> refresh symbolic previews
-> clean/reconcile pathCrossings against refreshed geometry
-> validateDiagram(cleanedDiagram)
-> commit if valid
```

Not:

```text
refresh
-> validate with stale crossings
```

Requirements:

- `validateDiagram` sees a diagram whose `pathCrossings` are already consistent with refreshed geometry;
- import does not fail for stale crossing parameters caused by variable resolution;
- truly invalid diagrams still fail after cleanup if other validation issues remain.

## 5. Preserve 3D behavior

Crossing states are 2D-only.

If symbolic import changes or preserves `ambientDimension: 3`:

- cleanup should remove or ignore pathCrossings according to existing 3D policy;
- validation should not allow 3D crossing states.

Do not introduce 3D crossing support.

## 6. Tests

Add focused tests.

### Symbolic import stale crossing tests

1. Create a saved 2D diagram with:
   - variable `Len = 2`;
   - a path from `(0,0)` to `(Len,0)`;
   - another path crossing it;
   - one persisted `pathCrossing` normalized for `Len = 2`.

2. Resolve/import with `Len = 4`.

Expected:

- `resolvePendingSymbolicDiagramImport(...)` returns success;
- no validation failure:
  - `Path crossing state must match a current 2D path intersection`;
- resulting diagram has cleaned/reconciled `pathCrossings`.

If reconcile policy is implemented:

- crossing state remains and parameters/ID update to the current intersection;
- `kind` is preserved.

If removal policy is implemented:

- stale crossing state is removed;
- import succeeds.

3. Test same scenario with a non-`none` state:

```ts
kind: "braiding"
```

Expected:

- if reconciled, kind preserved;
- if removed, no stale crossing remains and import succeeds.

### Direct cleanup helper tests

4. After symbolic preview refresh changes path geometry, cleanup removes stale crossing states.

5. Cleanup keeps currently valid crossing states.

6. Cleanup does not throw on missing referenced path; it removes the stale crossing.

7. Cleanup returns empty crossings for 3D diagrams.

### Regression tests

8. Normal save/load with valid pathCrossings still preserves them.

9. Normal save/load with invalid malformed pathCrossings still fails or cleans according to existing policy; do not accidentally accept bad data silently outside intended cleanup path.

10. Path edit/delete cleanup tests still pass.

11. Toggle cycle tests still pass.

12. SVG marker rendering tests still pass.

13. Inline/standalone TikZ output unaffected.

## 7. Avoid over-cleaning on ordinary validation

This fix is specifically for symbolic import refresh and other geometry-changing operations.

Do not make `validateDiagram` silently clean invalid crossings, unless that is already the project policy.

Validation should generally validate.

The import flow should explicitly clean before validation because symbolic resolution is a geometry-changing operation.

## 8. Error handling

If import still fails after cleanup, error should reflect the real remaining issue.

Avoid surfacing:

```text
Path crossing state must match a current 2D path intersection
```

for the stale-parameter symbolic import case.

If all stale crossings are removed and another error exists, report that other error.

## 9. Documentation/comments

Add a comment near the symbolic import cleanup call:

```text
Variable resolution can change path geometry and intersection parameters. Clean/reconcile crossing states before validation so stale crossing IDs do not reject otherwise valid imports.
```

Update docs only if user-visible behavior changes significantly.

If stale crossings are removed rather than reconciled, mention that resolving variables during import may discard crossing toggles whose intersections no longer match.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual-style test if practical:

1. Create a 2D diagram with variable `Len`.
2. Create two crossing paths, one using `Len`.
3. Toggle a crossing state.
4. Save JSON.
5. Load JSON and resolve `Len` to a different value.
6. Confirm import succeeds.
7. Confirm stale crossing state is either updated or removed according to policy.
8. Confirm the app does not show:
   - `Path crossing state must match a current 2D path intersection`.

## 11. Preserve existing behavior

Do not regress:

- path crossing model;
- click-to-toggle cycle;
- braiding convention;
- save/load for valid crossings;
- stale cleanup after path edits/deletions;
- 2D-only crossing behavior;
- 3D crossing rejection;
- SVG crossing markers;
- symbolic variable resolution;
- numeric diagram loading;
- save/load old diagrams;
- undo/redo;
- TikZ generation.

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
- root cause of the symbolic import crossing failure;
- where cleanup/reconciliation is inserted;
- whether stale crossings are removed or reconciled;
- whether crossing `kind` is preserved on reconciliation;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
