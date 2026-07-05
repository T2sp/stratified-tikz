# Phase 26/27 Fix Prompt: Detach coordinateRefs when snapshotting Coons/Ruled curved-sheet boundaries

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

Current repository:

```text
https://github.com/T2sp/stratified-tikz
```

The user loaded `mult-intermid.json` and got:

```text
Saved diagram is invalid: strata[0].primitive.bottom.segments[0].start.symbolic.source Unsupported coordinate reference source; coordinateRef is not supported at strata[0].primitive.bottom.segments[0].start.
```

The same data previously produced TikZ export comments like:

```tex
% Curved sheet "Coons patch" [sheet-1] omitted because coordinate references inside curved sheet primitives cannot be preserved by sampled mesh TikZ export.
% Use concrete coordinates for curved sheet primitives or use polygon/quad sheet vertices when coordinate anchors must be preserved.
% Curved sheet "Coons patch" [sheet-2] omitted because coordinate references inside curved sheet primitives cannot be preserved by sampled mesh TikZ export.
% Use concrete coordinates for curved sheet primitives or use polygon/quad sheet vertices when coordinate anchors must be preserved.
```

The uploaded JSON contains:

- `diagram.strata[0]`: `primitive.kind = "coonsPatch"`;
- `diagram.strata[1]`: `primitive.kind = "coonsPatch"`;
- Coons boundary path snapshots whose cubic segment endpoints contain `coordinateRef` sources, for example:

```text
strata[0].primitive.bottom.segments[0].start.symbolic.source.coordinateId = coordinate-25
strata[0].primitive.bottom.segments[0].end.symbolic.source.coordinateId = coordinate-33
strata[0].primitive.right.segments[0].start.symbolic.source.coordinateId = coordinate-33
strata[0].primitive.right.segments[0].end.symbolic.source.coordinateId = coordinate-34
...
```

The coordinate anchors themselves exist in `diagram.coordinateAnchors`.

## Root cause

The current implementation treats coordinate references inside sampled curved-sheet primitives as unsupported, because Coons/Ruled/curved sheet TikZ export samples the primitive into numeric mesh faces and cannot preserve `(A)`-style coordinate anchor references in the emitted mesh.

That rejection policy is correct for **live coordinate references inside sampled mesh primitives**.

However, the creation workflow for Coons patches is snapshot-based:

```text
selected boundary paths -> copied boundary snapshots -> Coons patch primitive
```

During that copy/snapshot step, coordinateRefs from the source boundary paths are being copied into the Coons primitive instead of being detached to concrete coordinates.

As a result:

1. newly created Coons patches can contain coordinateRefs inside `primitive.bottom/right/top/left`;
2. TikZ export omits those Coons patches because sampled mesh export cannot preserve refs;
3. save/load later rejects the same data as invalid.

This is a boundary snapshot normalization bug, not a request to make sampled mesh export preserve coordinateRefs.

## Correct design

For sampled curved-sheet primitives such as Coons patches and ruled surfaces:

- coordinate anchors may be used while picking/selecting source boundary paths;
- but when creating the curved-sheet primitive, boundary snapshots must be **detached** from coordinate anchors;
- the primitive should store concrete boundary coordinates/sources at creation time;
- the resulting Coons/Ruled primitive is a snapshot and is not live-linked to coordinate anchors;
- TikZ export can then sample and draw the mesh normally.

For legacy saved diagrams that already contain coordinateRefs inside Coons/Ruled curved-sheet boundary snapshots:

- the loader/normalizer should migrate them by detaching refs to concrete coordinates using the current coordinate anchors in the file;
- if all refs can be resolved, the diagram loads and exports;
- if any ref is missing or cannot be detached safely, load should return `ok:false` with a path-aware error;
- no invalid coordinateRef should survive in sampled curved-sheet primitives after successful load.

## Goal

Fix the Coons/Ruled curved-sheet coordinateRef handling so that:

1. Creating a Coons patch from anchored boundary paths does not store coordinateRefs inside the Coons primitive.
2. Creating a ruled surface from anchored boundary paths also detaches boundary coordinateRefs, if applicable.
3. Legacy JSON containing coordinateRefs inside Coons/Ruled boundary snapshots is normalized/migrated during load.
4. The uploaded `mult-intermid.json` class of diagram loads successfully if all referenced anchors exist and resolve finitely.
5. Coons patches from that file export as sampled mesh faces instead of omission comments.
6. Validation still rejects coordinateRefs inside sampled curved-sheet primitives if they remain after normalization.
7. Missing coordinate anchors or unresolvable refs produce clean `ok:false` load errors, not silent omission or raw exceptions.
8. Tests cover creation, load migration, export, missing refs, and no-live-link snapshot semantics.

## Scope

This is a targeted curved-sheet / coordinateRef normalization fix.

Implement:

- detach coordinateRefs when snapshotting boundary paths into Coons/Ruled primitives;
- load-time migration/normalization for legacy Coons/Ruled primitives containing coordinateRefs;
- export regression tests ensuring Coons patches are drawn, not omitted;
- validation no-coordinateRef postcondition for sampled curved sheets.

Do not implement:

- live coordinateRef-preserving sampled mesh export;
- symbolic mesh formulas for Coons/Ruled patches;
- new curved sheet model;
- new coordinate anchor UI;
- new work-plane UI;
- broad save/load redesign;
- new dependencies.

Do not change:

- coordinateRef preservation for ordinary paths, labels, points, and simple polygon/quad sheet vertices;
- coordinateRef rejection in genuinely unsupported derived/sampled fields after normalization;
- coordinate anchor deletion/detach behavior;
- layer translation detach behavior;
- Coons/Ruled sampling math except replacing refs with resolved concrete coordinates;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect Coons/Ruled creation and save/load paths

Inspect:

- Coons patch creation helpers;
- ruled surface creation helpers;
- boundary path snapshot clone/copy functions;
- `cloneBoundaryPathSnapshot` or equivalent;
- coordinate reference detach helpers;
- symbolic preview refresh/load normalization;
- validation for curved sheet primitives;
- TikZ export for Coons/Ruled/curved sheets.

Likely relevant files include:

```text
src/ui/ruledSurface.ts
src/geometry/curvedSheets.ts
src/model/coordinateReferences.ts
src/model/symbolicCoordinates.ts
src/model/serialization.ts
src/model/validation.ts
src/tikz/generateTikz.ts
```

Find where selected source paths are copied into:

```text
coonsPatch.bottom/right/top/left
ruledSurface.boundary0/boundary1
```

and ensure coordinateRefs are detached there.

## 2. Add a curved-sheet boundary snapshot detach helper

Add or reuse a helper such as:

```ts
detachCoordinateRefsInBoundaryPathSnapshot(
  snapshot: BoundaryPathSnapshot,
  coordinateAnchors: CoordinateAnchor[],
  options?: {
    target: "sampledCurvedSheetBoundary";
  }
): Result<BoundaryPathSnapshot>
```

or:

```ts
normalizeBoundarySnapshotForSampledCurvedSheet(...)
```

Requirements:

- walk all path segment coordinate fields in the boundary snapshot:
  - line start/end;
  - cubic start/control1/control2/end;
  - arc fields that are allowed in boundary snapshots;
  - any template/path fields converted to snapshot segments;
- when a field is `coordinateRef`, replace it with a concrete coordinate source/value from the referenced anchor;
- preserve symbolic global coordinates where supported;
- preserve work-plane-local coordinate sources where supported by boundary snapshots;
- otherwise fallback to finite global preview coordinates with explicit helper policy;
- recompute previews after replacement;
- return `ok:false` for:
  - missing coordinate anchor id;
  - non-finite resolved preview;
  - unsupported nested refs that cannot be safely detached;
  - invalid resulting segment geometry.

Do not mutate source paths or coordinate anchors.

## 3. Apply detach during Coons/Ruled creation

When creating a Coons patch:

1. collect/copy the selected boundary path snapshots;
2. orient/reverse boundaries as existing logic does;
3. detach coordinateRefs in each boundary snapshot using current coordinate anchor positions;
4. validate the detached boundary snapshots;
5. create the Coons patch primitive.

After creation, the new Coons primitive must not contain `coordinateRef`.

Same for ruled surfaces if their boundary snapshots are copied from paths that may contain coordinateRefs.

Important:

- Source paths remain unchanged and may still contain coordinateRefs.
- The Coons/Ruled primitive is a snapshot.
- Moving a coordinate anchor later should move the source path if it references the anchor, but should not automatically mutate the already-created Coons/Ruled primitive unless a future live-surface feature is added.

Add a status/doc comment if needed:

```text
Curved sheets store detached boundary snapshots for sampled mesh export.
```

## 4. Add legacy load migration

Saved diagrams created before this fix can already contain coordinateRefs inside Coons/Ruled primitives.

During JSON load/normalization:

1. before validation rejects unsupported coordinateRefs in sampled curved sheet primitives;
2. detect coordinateRefs inside Coons/Ruled boundary snapshots;
3. detach them using coordinate anchors from the saved diagram;
4. refresh previews;
5. then validate.

If all coordinateRefs resolve:

- load succeeds;
- saved diagram in memory has detached concrete boundary snapshots;
- future save writes the normalized/detached representation.

If any coordinateRef cannot resolve:

- `parseSavedDiagramJson(...)` returns `ok:false`;
- error message points to the field, e.g.:

```text
strata[0].primitive.bottom.segments[0].start: coordinate anchor coordinate-25 was not found.
```

Do not leave coordinateRefs in sampled curved sheet primitives after successful load.

## 5. Validation postcondition

After creation or load normalization:

- sampled curved sheet primitives should not contain coordinateRefs.
- validation should still reject coordinateRefs if they appear in these primitives after normalization.

Update error wording if helpful:

```text
Coordinate references are not stored inside sampled curved sheet primitives. They should be detached during curved-sheet creation or legacy load normalization.
```

This keeps the invariant clear.

## 6. TikZ export behavior

After the fix, Coons patches in the uploaded-file class should export sampled mesh faces instead of omission comments.

Required:

- no omission solely because boundary snapshots originally came from coordinateRef source paths;
- no coordinateRef remains in the primitive by export time;
- generated mesh coordinates are finite;
- layer/style/fill opacity preserved;
- inline output has no blank lines;
- 4-space indentation preserved.

If export still encounters coordinateRefs inside sampled curved sheet primitives defensively:

- emit a clear comment or error, but tests should ensure normal creation/load avoids that path.

## 7. Tests

Add focused tests.

### Creation tests

1. Create a Coons patch from four boundary paths whose endpoints are coordinateRefs.

Expected:

- Coons primitive is created;
- its boundary snapshots contain no coordinateRef;
- source boundary paths still contain coordinateRefs;
- validation passes.

2. Same for Coons boundary cubic control points if coordinateRefs are allowed there.

3. Moving a coordinate anchor after Coons creation updates the source path preview but does not mutate the Coons primitive snapshot.

4. TikZ export of the created Coons patch emits sampled face commands and does not contain the omission comment:

```text
omitted because coordinate references inside curved sheet primitives cannot be preserved
```

5. Ruled surface creation from coordinateRef boundary paths detaches refs similarly, if ruled surfaces support coordinateRef source paths.

### Legacy load migration tests

6. A saved Coons patch primitive with boundary start/end coordinateRefs like:

```text
strata[0].primitive.bottom.segments[0].start.symbolic.source.coordinateId
```

loads successfully when the anchor exists.

7. After load, the in-memory primitive contains no coordinateRef inside `primitive.bottom/right/top/left`.

8. Load preserves finite previews and validation passes.

9. Export after load draws the Coons patch and does not omit it.

10. Missing anchor id in a legacy Coons boundary returns `ok:false` with path-aware error.

11. Non-finite resolved anchor position returns `ok:false`.

12. Same migration behavior for ruled surfaces if supported.

### Uploaded fixture regression

13. Add a minimized fixture derived from `mult-intermid.json`:
   - two or one Coons patches with cubic boundaries;
   - coordinate anchors referenced by boundary endpoints;
   - enough data to reproduce the original error.

Expected:

- `parseSavedDiagramJson(...)` returns `ok:true`;
- export contains Coons patch sampled mesh output;
- export does not contain the Coons coordinateRef omission comments.

Do not commit the full large uploaded JSON unless project convention allows large fixtures. Prefer a minimal fixture.

### Validation postcondition tests

14. If coordinateRefs are manually inserted into sampled curved sheet primitive after normalization, `validateDiagram(...)` rejects them.

15. Error message is clear.

### Regression tests

16. Ordinary coordinateRef path export remains `(A)`.

17. Simple polygon/quad sheet coordinateRef vertices still export `(A)` where supported.

18. Filled sheets/path boundaries with coordinateRefs remain supported if current export preserves them.

19. Inline output no blank lines.

20. 4-space indentation preserved.

21. Old numeric Coons/Ruled surfaces still load/export.

## 8. Implementation guidance

### Do not solve by preserving coordinateRefs in sampled mesh TikZ

The immediate issue is not to invent coordinateRef-preserving sampled mesh output.

For Coons/Ruled sampled surfaces, the practical fix is:

```text
snapshot boundary paths by detaching coordinateRefs at creation/load time
```

This keeps export simple and prevents silent loss.

### Keep source paths live

If the source path remains in the diagram, it should keep coordinateRefs.

Only the curved sheet primitive snapshot is detached.

### Reuse existing detach helpers carefully

Existing coordinateRef detach helpers may detach references across an entire diagram. For this fix, prefer a snapshot-local helper that:

- receives a boundary snapshot;
- receives coordinate anchors;
- returns a detached boundary snapshot;
- does not remove or mutate coordinate anchors;
- does not touch unrelated diagram fields.

### Recompute previews

After detaching coordinateRefs:

- refresh each segment coordinate preview;
- for work-plane-local sources, recompute global preview;
- ensure segment start/end/control previews are finite.

Do not leave stale previews from old coordinateRef metadata.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual checks:

1. Load the user’s `mult-intermid.json`.
2. Confirm it loads without:

```text
Unsupported coordinate reference source; coordinateRef is not supported at strata[0].primitive.bottom.segments[0].start
```

3. Generate TikZ.
4. Confirm Coons patches are drawn/exported.
5. Confirm the previous omission comments are gone:

```text
Curved sheet "Coons patch" omitted because coordinate references inside curved sheet primitives cannot be preserved
```

6. Create a new Coons patch from boundary paths anchored at coordinate anchors.
7. Generate TikZ immediately.
8. Confirm the Coons patch is exported.
9. Move a coordinate anchor used by the source boundary path.
10. Confirm source path follows, while existing Coons snapshot behavior is documented/expected.

## 10. Preserve existing behavior

Do not regress:

- coordinate anchors;
- coordinateRef path/label/point/simple sheet export;
- coordinate deletion/detach;
- layer translation detach;
- path concatenation;
- Coons/Ruled creation from numeric paths;
- Coons direction controls;
- point-as-constant-boundary support if implemented;
- symbolic boundary paths;
- save/load;
- TikZ export;
- inline no-blank-lines;
- 4-space indentation;
- SVG preview.

## 11. Verification

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

## 12. Report after implementation

Please report:

- files modified;
- root cause of the Coons load/export failure;
- boundary snapshot detach helper behavior;
- Coons creation changes;
- Ruled creation changes, if any;
- legacy load migration behavior;
- whether `mult-intermid.json` or a minimized fixture now loads;
- TikZ export behavior for Coons patches after fix;
- tests added/updated;
- test results;
- build results;
- remaining limitations, especially that Coons/Ruled surfaces remain snapshots rather than live coordinateRef-linked surfaces.
