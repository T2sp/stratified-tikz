# Phase 26C Fix Prompt: Detach coordinate-anchor references before coordinate deletion

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

Phase 26C introduced coordinate-anchor references (`coordinateRef`) so supported geometry fields can reference global TikZ coordinate anchors and export readable TikZ such as:

```tex
\coordinate (A) at (...);
\draw (A) -- (B);
\node at (A) {...};
```

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Deleting a referenced coordinate anchor leaves dangling `coordinateRef` metadata and silently degrades to stale numeric output.

Review details:

- Single delete removes the coordinate anchor only in `src/ui/diagramUpdates.ts`.
- Bulk delete removes coordinate anchors similarly in `src/ui/bulkEditing.ts`.
- References to the deleted coordinate remain in supported geometry fields.
- The coordinate-reference resolver then falls back to the stored point when the anchor is missing.
- TikZ export then falls back to generated helper coordinates when no anchor name exists.
- Result:
  - the diagram contains dangling coordinate refs;
  - validation/preview/export can silently use stale numeric preview values;
  - TikZ source loses the intended `(A)` reference without an explicit detach operation.

This violates the Phase 26 requirement:

```text
Deleting a referenced coordinate should detach references rather than leaving dangling refs.
```

## Goal

Fix coordinate-anchor deletion so removing a coordinate anchor detaches all references to that coordinate across supported fields before the anchor is removed.

Required behavior:

1. Single coordinate delete detaches all references to the coordinate, then deletes the coordinate.
2. Bulk delete involving coordinate anchors detaches all references to those coordinates, then deletes the anchors.
3. Detach preserves the current resolved coordinate value/source as much as possible:
   - preserve global symbolic source when supported;
   - preserve work-plane-local symbolic source when supported;
   - otherwise use finite global preview coordinate as explicit fallback.
4. No dangling `coordinateRef` metadata remains after delete.
5. Preview continues to show the same geometry as much as practical.
6. TikZ output no longer defines the deleted coordinate anchor.
7. TikZ output for former references uses concrete coordinates/sources, not generated stale fallback from missing refs.
8. Validation catches any remaining dangling refs.
9. Add regression tests for single delete, bulk delete, validation, preview, and TikZ output.

## Scope

This is a targeted Phase 26C fix.

Implement:

- coordinate-reference detach before coordinate-anchor deletion;
- integration into single delete path;
- integration into bulk delete path;
- stronger validation/no-silent-missing-ref behavior if needed;
- tests.

Do not implement:

- new coordinate anchor UI beyond needed status messages;
- advanced reference manager;
- layer-translation detach unless already implemented or trivially shared;
- new coordinate reference field support;
- broad save/load redesign;
- new dependencies.

Do not change:

- coordinate anchor model;
- supported coordinateRef locations;
- normal coordinateRef export when anchor exists;
- coordinate anchor TikZ definitions;
- point/path/sheet/label geometry semantics except intentional detach-on-delete;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant;
- SVG rendering semantics except resolved references after detach.

## 1. Inspect current delete paths

Inspect:

- `src/ui/diagramUpdates.ts`;
- `src/ui/bulkEditing.ts`;
- `src/model/coordinateReferences.ts`;
- coordinate-reference validation helpers;
- coordinate-reference resolution helpers;
- TikZ coordinateRef formatting in `src/tikz/generateTikz.ts`;
- tests for coordinate deletion, bulk deletion, and coordinateRef save/load/export.

Find all code paths that remove coordinate anchors.

Known review locations:

```text
src/ui/diagramUpdates.ts
src/ui/bulkEditing.ts
```

Both must detach refs before deleting anchors.

## 2. Use or add a pure detach helper

If a helper already exists from later Phase 26 work, use it.

Otherwise add one now.

Suggested API:

```ts
detachCoordinateAnchorReferences(
  diagram: Diagram,
  coordinateId: string
): Result<{
  diagram: Diagram;
  detachedCount: number;
}, ValidationError>
```

For bulk deletion:

```ts
detachCoordinateAnchorReferencesMany(
  diagram: Diagram,
  coordinateIds: string[]
): Result<{
  diagram: Diagram;
  detachedCount: number;
}, ValidationError>
```

or loop over the single-coordinate helper.

Requirements:

- input diagram is not mutated;
- all supported coordinateRef fields are traversed;
- all refs to the target coordinate are replaced;
- refs to other coordinates remain unchanged;
- no dangling refs to deleted coordinate remain;
- return detached count for status/tests;
- operation is atomic:
  - if any detach fails, do not partially delete/mutate.

## 3. Detach semantics

When replacing a `coordinateRef`, use the current coordinate anchor position.

Preferred priority:

### A. Preserve coordinate source if the target field supports it

If the coordinate anchor has a global symbolic source:

```text
Coordinate A:
  x = R
  y = 0
  z = 0

Path endpoint before:
  coordinateRef(A)

Path endpoint after detach:
  global symbolic x=R, y=0, z=0
```

If the coordinate anchor has a work-plane-local symbolic source and the target field supports work-plane-local sources:

```text
Coordinate P:
  frame snapshot
  a = R*cos(q)
  b = R*sin(q)

Sheet vertex before:
  coordinateRef(P)

Sheet vertex after detach:
  workPlaneLocal(frame copy, a=R*cos(q), b=R*sin(q))
```

### B. Fallback to finite global preview coordinate

If the target field cannot support the anchor's source type:

```text
target field = finite global preview coordinate
```

Requirements:

- fallback must be finite;
- no NaN/Infinity;
- symbolic expressions preserved whenever supported;
- work-plane-local frames deep-copied when preserved;
- coordinate anchor itself is not mutated before deletion;
- preview geometry remains stable as much as practical.

## 4. Single coordinate delete behavior

Update the single delete path so that when the deleted object is a coordinate anchor:

1. find references to that coordinate;
2. detach them;
3. remove the coordinate anchor;
4. clean selection;
5. produce one undoable operation;
6. optionally show a status message:

```text
Deleted coordinate "A" and detached 3 references.
```

If the coordinate is unused:

- simply delete it.

If detach fails:

- do not delete the coordinate;
- return/show clear error;
- do not partially mutate diagram.

## 5. Bulk delete behavior

Update bulk delete when one or more selected/deleted objects are coordinate anchors.

Required flow:

1. collect all coordinate anchors that will be deleted;
2. detach references to those anchors across the diagram;
3. remove the coordinate anchors;
4. remove any other selected objects;
5. clean crossing/braiding states and selection according to existing bulk-delete policy;
6. commit as one undoable operation.

Important edge cases:

### Coordinate and referencing object both deleted

If an object that references coordinate `A` is also deleted in the same bulk delete:

- no need to detach refs inside that object if it is removed;
- but detaching first is acceptable as long as final result has no dangling refs and no partial mutation.
- Prefer a helper that can skip target object ids slated for deletion for efficiency, but not required.

### Multiple coordinates deleted

If an object references several deleted coordinates:

- detach all of them.
- refs to coordinates not being deleted remain refs.

### Coordinate refs inside objects being kept

Must be detached.

## 6. Resolver should not silently accept missing anchors

The review says the resolver currently falls back to the stored point when an anchor is missing.

That can hide dangling refs.

Adjust policy carefully.

### Required validation policy

`validateDiagram` should reject dangling coordinate refs.

This may already happen for supported fields; confirm it.

### Resolver policy

For normal preview/export resolution:

- if a referenced coordinate id is missing, do not silently use stale stored preview as if valid.
- Prefer returning an unresolved/error status or leaving validation to reject before export.
- If resolver must fallback for UI tolerance, make sure validation/export never treats it as valid.

The key is: after delete, refs should be detached, so missing-anchor fallback should not be needed for valid diagrams.

Add tests that a dangling ref fails validation.

## 7. TikZ export behavior after detach

After deleting coordinate `A`:

- output should not contain:

```tex
\coordinate (A)
```

- former references should not output:

```tex
(A)
```

- former references should output concrete coordinates/sources.

Example:

Before delete:

```tex
\coordinate (A) at ({\R},0);
\draw (A) -- (B);
```

After detach+delete:

```tex
\draw ({\R},0) -- (B);
```

or existing coordinate formatting equivalent.

Do not rely on generated helper coordinates because the anchor name is missing.

## 8. Preview behavior after detach

Preview should remain visually stable.

Example:

- path endpoint referencing `A` at `(2,0)` should remain at `(2,0)` immediately after delete.
- moving/deleting `A` should not leave the path endpoint stale-linked to a missing anchor.

## 9. Tests

Add focused tests.

### Single delete tests

1. Delete unused coordinate anchor removes it.

2. Delete referenced coordinate anchor detaches path endpoint ref and removes anchor.

3. Delete referenced coordinate anchor detaches label position ref.

4. Delete referenced coordinate anchor detaches point position ref if supported.

5. Delete referenced coordinate anchor detaches simple sheet vertex ref if supported.

6. After delete, `validateDiagram(...)` passes.

7. After delete, no `coordinateRef` remains with the deleted coordinate id.

8. Preview/resolved geometry remains at the coordinate's current position.

9. TikZ output no longer contains `\coordinate (A)`.

10. TikZ output no longer contains `(A)` references.

11. TikZ output preserves global symbolic expression when detaching a global symbolic coordinate.

12. TikZ output preserves work-plane-local source or uses documented finite global fallback when detaching local coordinate.

### Bulk delete tests

13. Bulk delete coordinate anchor and keep referencing path:
    - path ref detaches;
    - coordinate removed;
    - validation passes.

14. Bulk delete multiple coordinate anchors:
    - refs to each are detached;
    - refs to non-deleted coordinates remain refs.

15. Bulk delete coordinate anchor and referencing object:
    - final diagram has no dangling refs;
    - operation succeeds.

16. Bulk delete coordinate anchor plus ordinary point/path still deletes all selected objects and detaches kept refs.

17. Bulk delete undo/redo restores/detaches correctly.

### Dangling ref validation tests

18. A diagram with a coordinateRef pointing to a missing anchor fails validation.

19. Save/load with dangling coordinateRef returns `ok: false`.

20. Resolver/export does not silently produce valid TikZ from dangling refs without validation.

### Regression tests

21. Existing supported coordinateRef export with existing anchor still uses `(A)`.

22. Coordinate anchor definitions still emitted before references.

23. Inline output no blank lines.

24. 4-space indentation preserved.

25. Existing coordinateRef unsupported-location rejection still works.

26. Existing bulk delete behavior for non-coordinate objects unchanged.

## 10. Error/status messages

Good status:

```text
Deleted coordinate "A" and detached 3 references.
```

Good error:

```text
Could not delete coordinate "A": failed to detach reference in path "f".
```

Avoid silently deleting the anchor while refs remain.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Create coordinate anchor `A`.
2. Create path endpoint referencing `A`.
3. Export TikZ and confirm `(A)` appears.
4. Delete `A`.
5. Confirm path remains visually in place.
6. Confirm `A` marker disappears.
7. Export TikZ.
8. Confirm `\coordinate (A)` is gone.
9. Confirm `(A)` references are gone.
10. Confirm concrete coordinate appears instead.
11. Undo.
12. Confirm `A` and `(A)` refs return.
13. Bulk delete `A` together with another object and confirm no dangling refs.

## 12. Preserve existing behavior

Do not regress:

- normal coordinateRef export;
- coordinate anchor definitions;
- coordinateRef validation for existing anchors;
- supported coordinateRef locations;
- unsupported coordinateRef rejection;
- preview resolution when anchor exists;
- bulk delete for non-coordinate objects;
- undo/redo;
- save/load;
- inline no-blank-lines;
- 4-space indentation;
- SVG preview.

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
- root cause of dangling ref delete behavior;
- detach helper used/added;
- single delete behavior;
- bulk delete behavior;
- symbolic/global/local preservation policy;
- resolver/validation missing-anchor policy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
