# Phase 27 Fix Prompt: Detach coordinateRefs from work-plane filled-sheet frame fields

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

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

## Context

You are working on the StratifiedTikZ project.

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The user loaded the attached JSON:

```text
canonical-algebra-mult-skeleton.json
```

and the app reported:

```text
Saved diagram is invalid: strata[30].planeFrame.origin.symbolic.source Unsupported coordinate reference source; coordinateRef is not supported at strata[30].planeFrame.origin.
```

The failing object is:

```text
diagram.strata[30]
id: "filled-sheet-1"
kind: "workPlaneFilledSheet"
```

Its `planeFrame.origin` contains a live coordinate anchor reference:

```json
"symbolic": {
    "source": {
        "kind": "coordinateRef",
        "coordinateId": "coordinate-13"
    }
}
```

There are at least three invalid work-plane filled-sheet frame origins in the uploaded JSON:

```text
strata[30]  id: filled-sheet-1
strata[43]  id: filled-sheet-3
strata[45]  id: filled-sheet-4
```

This is not the Coons/Ruled boundary snapshot issue. In this JSON, the invalid refs are in top-level `workPlaneFilledSheet.planeFrame.origin` fields.

## Root cause

Coordinate refs are valid for visible/export-preserved coordinate fields such as:

- path endpoints/control points where TikZ preserves `(A)`;
- point positions;
- label positions;
- simple sheet vertices when exported as `(A)`.

Coordinate refs are **not** supported in derived work-plane frame fields such as:

```text
planeFrame.origin
planeFrame.u
planeFrame.v
planeFrame.normal
```

because these fields are part of a stored frame snapshot used to derive local geometry and export scopes. The frame must be concrete/finite and must not remain live-linked to coordinate anchors.

The likely creation bug is in the fill-from-closed-paths workflow:

1. `workPlaneFrameForBoundaries(...)` derives a frame from closed boundary paths.
2. `constructWorkPlaneFromThreePoints(...)` uses the first boundary point as the frame origin.
3. That first boundary point may still have:

```ts
symbolic.source.kind === "coordinateRef"
```

4. The frame clone is shallow for `origin`.
5. The coordinateRef leaks into the stored `workPlaneFilledSheet.planeFrame.origin`.

Relevant reported locations:

```text
src/ui/fillFromPaths.ts
src/geometry/workPlane.ts
src/model/symbolicCoordinates.ts
src/model/validation.ts
```

This produces invalid saved diagrams and can also cause export/runtime failures for work-plane filled sheets.

## Correct design

Work-plane frames stored inside objects are snapshots.

When deriving a work-plane frame from boundary points, selected points, coordinate anchors, or coordinateRef-backed path vertices:

- it is fine to use coordinate anchors as input;
- but the resulting stored frame fields must be detached/concretized;
- `planeFrame.origin`, `u`, `v`, and `normal` must not contain `coordinateRef`;
- the filled sheet should remain drawable/exportable even if source coordinates were anchored.

For `workPlaneFilledSheet` specifically:

- the sheet may store boundaries according to existing policy;
- but its `planeFrame` fields are derived frame data and must not stay live-linked to coordinate anchors.

For legacy saved diagrams:

- if a `workPlaneFilledSheet.planeFrame` contains coordinateRefs and the referenced coordinate anchors exist, load should normalize/migrate the frame by detaching those refs to concrete current coordinate values;
- if a referenced anchor is missing or non-finite, load should return `ok:false` with a path-aware error;
- after successful load, no coordinateRefs should remain in `planeFrame.origin/u/v/normal`.

## Goal

Fix the work-plane filled-sheet frame coordinateRef leak.

Required behavior:

1. Creating filled sheets from closed paths must not store coordinateRefs in `workPlaneFilledSheet.planeFrame`.
2. `constructWorkPlaneFromThreePoints(...)` or its callers must deep-sanitize frame fields so derived frames do not carry coordinateRef sources.
3. Legacy JSON with coordinateRefs in `workPlaneFilledSheet.planeFrame.origin/u/v/normal` should be normalized during load if possible.
4. The uploaded-file class should load successfully when referenced coordinate anchors exist and resolve finitely.
5. Missing/unresolvable coordinateRefs in filled-sheet frame fields should fail cleanly with `ok:false`.
6. TikZ export should draw the work-plane filled sheets rather than failing validation or omitting them due to frame coordinateRefs.
7. Validation should still reject coordinateRefs in work-plane frame fields if they remain after normalization.
8. Add focused tests for creation, load migration, validation, export, and missing-anchor failure.

## Scope

This is a targeted filled-sheet/work-plane-frame coordinateRef normalization fix.

Implement:

- frame-field detach/sanitize helper for work-plane frames;
- creation-time sanitization in fill-from-closed-paths workflow;
- legacy load normalization for `workPlaneFilledSheet.planeFrame`;
- tests.

Do not implement:

- live coordinateRef-preserving work-plane frames;
- new work-plane frame model;
- new coordinateRef-supported frame fields;
- new filled-sheet geometry semantics;
- new TikZ export mode;
- broad save/load redesign;
- new dependencies.

Do not change:

- coordinateRef support for visible/export-preserved fields;
- coordinate anchor definitions;
- coordinate deletion/detach behavior;
- layer translation detach behavior;
- Coons/Ruled boundary snapshot fix if active separately;
- existing numeric/symbolic frame validation except to detach coordinateRefs before validation;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect filled-sheet frame construction and validation

Inspect:

- `src/ui/fillFromPaths.ts`;
- `workPlaneFrameForBoundaries(...)`;
- `constructWorkPlaneFromThreePoints(...)`;
- `src/geometry/workPlane.ts`;
- work-plane frame cloning helpers;
- `workPlaneFilledSheet` creation helpers;
- `src/model/symbolicCoordinates.ts`;
- `src/model/validation.ts`;
- save/load normalization in `src/model/serialization.ts`;
- coordinateRef detach helpers in `src/model/coordinateReferences.ts`.

Find where boundary path points are passed into frame construction and where frame origin is copied.

The bug is likely a shallow copy of a point whose symbolic source is still:

```ts
{ kind: "coordinateRef", coordinateId: ... }
```

## 2. Add a frame-field coordinateRef detach/sanitize helper

Add a helper for work-plane frame fields.

Suggested:

```ts
sanitizeWorkPlaneFrameForStorage(
  frame: WorkPlaneFrameSnapshot,
  coordinateAnchors: CoordinateAnchor[],
  options?: {
    path?: string;
    context?: "workPlaneFilledSheet" | "workPlaneSetup" | "derivedFrame";
  }
): Result<WorkPlaneFrameSnapshot>
```

or:

```ts
detachCoordinateRefsInWorkPlaneFrame(
  frame: WorkPlaneFrameSnapshot,
  coordinateAnchors: CoordinateAnchor[],
  path: string
): Result<WorkPlaneFrameSnapshot>
```

Requirements:

- inspect `origin`, `u`, `v`, and `normal`;
- if any field or nested `symbolic.source` is a `coordinateRef`, replace it with concrete coordinate/source derived from the current coordinate anchor;
- preserve non-coordinate symbolic expressions where currently supported;
- fallback to finite numeric/global preview for frame fields where coordinateRef source cannot be safely preserved;
- recompute/validate frame previews;
- return `ok:false` for:
  - missing anchor;
  - non-finite anchor preview;
  - invalid resulting frame;
  - cyclic/unresolvable nested refs.

Frame fields are derived storage fields; do not leave coordinateRef in them.

## 3. Creation-time fix in fill-from-closed-paths workflow

When creating a work-plane filled sheet from closed paths:

1. derive the frame from boundary points as before;
2. immediately sanitize/detach coordinateRefs from the derived frame;
3. validate sanitized frame;
4. store the sanitized frame in `workPlaneFilledSheet.planeFrame`.

Important:

- source boundary paths should remain unchanged and may still contain coordinateRefs;
- the filled sheet frame is a snapshot;
- moving coordinate anchors later should not mutate the stored frame unless a future live-frame feature is added;
- do not silently store live coordinateRef in the frame.

Add a small code comment:

```text
Work-plane frames are stored snapshots. Coordinate refs from boundary points must be detached before storing planeFrame.
```

## 4. Consider fixing `constructWorkPlaneFromThreePoints(...)`

The reported cause includes `constructWorkPlaneFromThreePoints(...)` using the first point as frame origin.

If that function is used in multiple workflows, choose one of these policies:

### Preferred

Make `constructWorkPlaneFromThreePoints(...)` produce a clean frame origin that does not share mutable/symbolic-source metadata from the input points.

It should deep-copy or normalize the origin so it does not carry unsupported coordinateRef source metadata.

### Alternative

Leave low-level constructor simple, but ensure every caller that stores the frame calls `sanitizeWorkPlaneFrameForStorage(...)`.

Preferred: do both where safe.

Be careful not to break workflows that intentionally preserve symbolic non-coordinate frame expressions.

## 5. Legacy load normalization

Before validation rejects coordinateRefs in `workPlaneFilledSheet.planeFrame`, normalize legacy diagrams.

During `parseSavedDiagramJson(...)` / normalization:

1. walk all strata;
2. find `kind === "workPlaneFilledSheet"`;
3. inspect `planeFrame.origin/u/v/normal`;
4. if coordinateRefs are present:
   - detach using `diagram.coordinateAnchors`;
   - replace frame with sanitized frame;
   - refresh previews;
5. continue validation.

If the referenced coordinate exists:

- load should succeed and the in-memory diagram should contain no coordinateRefs in `planeFrame`.

If missing:

- return `ok:false` with a path-aware error, for example:

```text
strata[30].planeFrame.origin: coordinate anchor coordinate-13 was not found.
```

Do not leave invalid coordinateRefs in frame fields after successful load.

## 6. Validation postcondition

Validation should keep rejecting coordinateRefs in frame fields after normalization.

This invariant is still correct:

```text
coordinateRef is not supported at workPlaneFilledSheet.planeFrame.origin/u/v/normal
```

But for legacy files, normalization should remove valid/resolvable refs before validation runs.

Add or update tests so validation directly rejects a manually constructed invalid frame that bypasses normalization.

## 7. TikZ export behavior

After creation/load normalization:

- `workPlaneFilledSheet` should export normally;
- no frame coordinateRef omission/error should occur;
- output should include the filled sheet commands;
- layer/style/fill opacity preserved;
- inline output has no blank lines;
- 4-space indentation preserved.

If export defensively encounters a coordinateRef in a frame, it may emit a clear error/comment, but normal creation/load should prevent this.

## 8. Tests

Add focused tests.

### Creation tests

1. Create a closed path whose first boundary point is a coordinateRef.

2. Run fill-from-closed-paths to create a `workPlaneFilledSheet`.

Expected:

- `planeFrame.origin` contains no coordinateRef;
- frame validates;
- sheet validates;
- source path still contains coordinateRef if it did before;
- TikZ export draws the filled sheet.

3. Same test where boundary points include coordinateRefs in non-origin positions, ensuring derived `u/v/normal` are also coordinateRef-free.

4. Moving the coordinate anchor after filled-sheet creation does not mutate the stored `planeFrame` snapshot.

### Legacy load migration tests

5. Saved `workPlaneFilledSheet` with:

```text
planeFrame.origin.symbolic.source.kind = coordinateRef
```

loads successfully if the anchor exists.

6. After load, `planeFrame.origin` contains no coordinateRef.

7. Saved frame `u` with coordinateRef migrates or fails according to policy. Preferred: migrate if finite.

8. Saved frame `v` with coordinateRef migrates or fails according to policy. Preferred: migrate if finite.

9. Saved frame `normal` with coordinateRef migrates or fails according to policy. Preferred: migrate if finite.

10. Missing coordinate anchor in `planeFrame.origin` returns `ok:false`.

11. Non-finite anchor preview returns `ok:false`.

12. Error messages include path such as:

```text
strata[30].planeFrame.origin
```

### Uploaded fixture regression

13. Add a minimized fixture derived from `canonical-algebra-mult-skeleton.json` containing:
    - at least one `workPlaneFilledSheet`;
    - a `planeFrame.origin` coordinateRef to an existing coordinate anchor.

Expected:

- `parseSavedDiagramJson(...)` returns `ok:true`;
- in-memory frame contains no coordinateRef;
- TikZ export includes the filled sheet and no validation error.

Do not commit the full large uploaded JSON unless project convention supports it. Prefer a minimized fixture.

### Validation postcondition tests

14. Directly constructed invalid diagram with coordinateRef in `workPlaneFilledSheet.planeFrame.origin` still fails `validateDiagram(...)` if normalization is not run.

15. Same for `planeFrame.u/v/normal` if applicable.

### Regression tests

16. Numeric work-plane filled sheets still load/export.

17. Symbolic non-coordinate frame fields still load/export if previously supported.

18. Filled region/path boundary coordinateRefs remain supported or rejected according to existing policy, unchanged by this fix.

19. Coons/Ruled coordinateRef boundary snapshot tests still pass.

20. Inline output no blank lines.

21. 4-space indentation preserved.

## 9. Implementation guidance

### Avoid shallow copies of input points into frames

The safest rule:

```text
Frame fields should never hold a direct object reference to a source path point/coordinate field.
```

When deriving frames:

- copy only necessary numeric/symbolic non-ref values;
- detach coordinateRefs;
- recompute previews.

### Do not detach source paths

Only detach the derived frame stored in the filled sheet.

Source paths should remain live/anchored if they were anchored.

### Be careful with basis vectors

If `u/v/normal` are vectors rather than points, coordinateRef semantics may be nonsensical.

If a coordinateRef appears there in legacy data:

- if it can be converted to a finite vector value safely, do so;
- otherwise return `ok:false`.

Document chosen behavior in tests/report.

### Shared helper reuse

If there is already a `workPlaneFrameField` fallback policy from Phase 26H, reuse it.

The key is that frame fields are fallback/concrete storage locations, not TikZ-preserved coordinateRef fields.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual checks:

1. Load `canonical-algebra-mult-skeleton.json`.
2. Confirm it no longer fails with:

```text
coordinateRef is not supported at strata[30].planeFrame.origin
```

3. Confirm filled sheets such as `filled-sheet-1`, `filled-sheet-3`, and `filled-sheet-4` load.
4. Generate TikZ.
5. Confirm filled sheets are emitted.
6. Create a new closed path from coordinate anchors.
7. Fill it.
8. Save/load.
9. Confirm the new work-plane filled sheet has no coordinateRef in its `planeFrame`.

## 11. Preserve existing behavior

Do not regress:

- coordinate anchors;
- coordinateRef support in visible/export-preserved fields;
- coordinate deletion/detach;
- layer translation detach;
- Coons/Ruled fixes;
- work-plane setup;
- fill-from-paths for numeric paths;
- symbolic coordinates;
- save/load;
- TikZ export;
- SVG preview;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## 13. Report after implementation

Please report:

- files modified;
- root cause of the filled-sheet frame coordinateRef leak;
- frame sanitization helper behavior;
- fill-from-closed-paths creation changes;
- `constructWorkPlaneFromThreePoints` changes, if any;
- legacy load migration behavior;
- behavior for origin/u/v/normal;
- whether a minimized fixture from `canonical-algebra-mult-skeleton.json` was added;
- TikZ export behavior after fix;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
