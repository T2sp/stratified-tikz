# Phase 26H Fix Prompt: Recursively detach coordinate refs inside replacement work-plane-local anchor sources

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

Recent fixes made detach recurse into nested coordinate refs inside:

```ts
Vec3.symbolic.source.kind === "workPlaneLocal"
source.frame.origin
source.frame.u
source.frame.v
source.frame.normal
```

and recompute enclosing work-plane-local previews after nested frame refs are detached.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Detaching a reference to a work-plane-local coordinate anchor can reintroduce coordinate refs from that anchor’s own saved frame into the replacement point.

Current failure path:

1. A geometry field references coordinate anchor `coord-a`.
2. `coord-a` itself has a work-plane-local position/source.
3. That work-plane-local source frame contains a coordinateRef, for example:

```text
coord-a.position.kind = workPlaneLocal
coord-a.position.frame.origin.symbolic.source.kind = coordinateRef
coord-a.position.frame.origin.symbolic.source.coordinateId = coord-a
```

or a batch/mutual-anchor variant.

4. `detachedCoordinatePointForAnchor(...)` preserves/clones the anchor’s work-plane-local source.
5. The caller returns that clone as the replacement coordinate.
6. The replacement source frame still contains coordinateRef metadata.
7. `detachCoordinateAnchorReferencesMany(diagram, ["coord-a"])` returns `ok: true`, but the resulting diagram still contains `"coordinateId": "coord-a"`.
8. `findCoordinateAnchorReferences(..., "coord-a")` still finds the nested ref, for example:

```text
labels[0].position.symbolic.source.frame.origin
```

9. `validateDiagram(...)` fails.

This violates:

```text
no dangling refs after successful detach
unsupported cases fail atomically
```

Review’s suggested target:

```text
Fix detachCoordinateAnchorReferencesMany so replacement points produced from work-plane-local coordinate anchors cannot carry coordinateRef sources inside their work-plane-local frame. Recursively detach those source-frame refs or fail atomically; add tests for self/batch anchor-frame refs and assert no refs remain after successful detach.
```

## Goal

Fix Phase 26H detach so replacement coordinates cloned from work-plane-local coordinate anchors cannot reintroduce dangling coordinateRefs.

Required behavior:

1. When a coordinateRef is detached by replacing it with a coordinate anchor’s position/source, the replacement must be free of refs to any coordinate anchors being detached.
2. If the replacement source is work-plane-local and its stored frame contains coordinateRef metadata, those nested frame refs must be recursively detached or rejected atomically.
3. `detachCoordinateAnchorReferencesMany(...)` must not return `ok: true` while any refs to the target coordinate ids remain.
4. Self-referential and batch-referential anchor-frame refs must be handled explicitly.
5. If recursive detach cannot safely eliminate nested frame refs, return `ok: false` without mutating the source diagram.
6. Add regression tests for:
   - self-referential anchor frame refs;
   - batch anchor-frame refs;
   - successful detach no-ref invariant;
   - atomic failure behavior.

## Scope

This is a targeted Phase 26H fix.

Implement:

- recursive sanitization/detach of replacement coordinate sources;
- no-dangling-ref postcondition for `detachCoordinateAnchorReferencesMany`;
- handling for work-plane-local coordinate anchor positions whose frames contain coordinateRef sources;
- tests.

Do not implement:

- new coordinate-anchor UI;
- new coordinateRef-supported exported locations;
- new layer semantics;
- new TikZ export behavior;
- broad coordinate model refactor;
- new dependencies.

Do not change:

- direct coordinateRef detach behavior except to make replacement sources safe;
- nested frame inventory behavior;
- enclosing preview recomputation behavior from the previous fix;
- coordinate delete/detach UI behavior except through fixed helper correctness;
- layer translation detach policy except through fixed helper correctness;
- save/load format;
- inline/standalone TikZ formatting.

## 1. Inspect replacement-source detach path

Inspect:

- `src/model/coordinateReferences.ts`;
- `detachedCoordinatePointForAnchor(...)`;
- `detachCoordinateAnchorReferencesMany(...)`;
- `detachCoordinateAnchorReferences(...)`;
- helpers that clone coordinate anchor positions into geometry fields;
- helpers that detach refs inside `workPlaneLocal` frames;
- helpers that recompute work-plane-local previews;
- inventory helpers such as `findCoordinateAnchorReferences(...)`.

The review points to:

```text
detachedCoordinatePointForAnchor preserves the anchor’s work-plane-local source
caller returns that clone without recursively detaching/rejecting nested coordinateRefs in the replacement source frame
```

Find every place where a coordinate anchor’s position/source is cloned as a replacement for a `coordinateRef`.

## 2. Add a replacement-source sanitization helper

Add a helper that takes a coordinate anchor position/source and returns a safe replacement for detaching refs.

Suggested conceptual API:

```ts
makeDetachedCoordinateReplacementFromAnchor(
  diagram: Diagram,
  anchor: CoordinateAnchor,
  detachingCoordinateIds: Set<string>,
  options: {
    targetLocation: CoordinateReferenceLocation;
  }
): Result<CoordinatePointLike>
```

or:

```ts
sanitizeDetachedCoordinateReplacement(
  replacement: CoordinateSourceOrPoint,
  diagram: Diagram,
  detachingCoordinateIds: Set<string>
): Result<CoordinateSourceOrPoint>
```

Exact type names can differ.

Requirements:

- If replacement has no coordinateRefs, return it unchanged.
- If replacement contains coordinateRefs not in `detachingCoordinateIds`, decide whether to preserve them or detach them according to existing detach policy.
- If replacement contains coordinateRefs in `detachingCoordinateIds`, those must not remain.
- For work-plane-local source frames:
  - recursively inspect frame `origin/u/v/normal`;
  - detach nested refs using the current anchor positions;
  - recompute enclosing preview after frame mutation;
  - if impossible, return `ok:false`.

Preferred policy:

```text
When creating a detached replacement during detachCoordinateAnchorReferencesMany, recursively detach any coordinateRefs whose ids are in the detaching set. CoordinateRefs to non-deleted anchors may remain only if the target field supports them and validation/export policy allows them.
```

For safety, it is also acceptable to detach all coordinateRefs inside replacement work-plane-local frames, not only those in the detaching set, as long as this is documented and tested.

## 3. Handle self-referential anchor-frame refs

A coordinate anchor may have a work-plane-local frame that references itself.

Example:

```text
coord-a.position.kind = workPlaneLocal
coord-a.position.frame.origin = coordinateRef(coord-a)
```

When detaching refs to `coord-a`:

- cloning `coord-a.position` as replacement would reinsert `coordinateRef(coord-a)`;
- this must not be allowed.

Acceptable behavior:

### Preferred

- recursively replace the nested self-ref with the current finite position/source of `coord-a`, then recompute preview;
- if this would be cyclic/ambiguous, fail atomically with a clear error.

### Safe MVP

- reject detach with `ok:false` if the replacement anchor’s own source contains a ref to a coordinate being detached.

However, the user-facing delete operation should ideally succeed when possible. Prefer recursive detach if current anchor position can be resolved finitely.

Do not return `ok:true` with self-ref still present.

## 4. Handle batch anchor-frame refs

`detachCoordinateAnchorReferencesMany(diagram, ["coord-a", "coord-b"])` must handle cases where:

```text
coord-a.position.frame.origin references coord-b
coord-b.position.frame.origin references coord-a
```

or:

```text
a geometry field references coord-a
coord-a's replacement source frame references coord-b
coord-b is also being deleted/detached
```

Required:

- no refs to any deleted/detaching ids remain after success;
- if cyclic resolution cannot be safely resolved, return `ok:false`;
- no partial mutation.

Suggested implementation strategy:

1. Resolve current finite anchor positions before starting detach.
2. Build a replacement map for all coordinates being detached:
   - each map entry should be a safe concrete replacement source/point;
   - nested frame refs to detaching ids are replaced using the pre-resolved finite positions or sanitized sources.
3. If any replacement cannot be made safe, fail before mutating.
4. Apply replacements to geometry fields.

This avoids order-dependent behavior.

## 5. Recompute previews after replacement-source sanitization

If sanitization modifies a work-plane-local frame:

- recompute enclosing preview immediately;
- update `Vec3` preview fields consistently;
- update `CoordinateAnchorPosition.preview` if the replacement is itself a coordinate-anchor position clone;
- validate finite preview.

This is the same issue as the previous review, but now specifically for replacement sources cloned from anchors.

## 6. Add a no-dangling-ref postcondition

After `detachCoordinateAnchorReferencesMany(...)` succeeds:

- there must be no coordinateRefs to any of the detached ids in the returned diagram.

Add an internal assertion/check if appropriate:

```ts
for (const id of detachingCoordinateIds) {
  assert(findCoordinateAnchorReferences(result.diagram, id).length === 0)
}
```

In production code, avoid throwing if the project prefers result errors. But tests should enforce the invariant.

If the helper detects refs remain before returning:

- return `ok:false`;
- do not return a mutated diagram as success.

## 7. Atomic failure behavior

If replacement-source sanitization or preview recomputation fails:

- return `ok:false`;
- leave the input diagram unchanged;
- do not partially detach direct refs while leaving nested refs.

Failure cases to cover:

- cyclic/self-ref replacement cannot be resolved;
- replacement work-plane-local frame becomes invalid;
- recomputed preview is non-finite;
- referenced anchor missing;
- unsupported nested coordinateRef location cannot be safely detached.

## 8. Coordinate deletion integration

Coordinate deletion uses `detachCoordinateAnchorReferencesMany`.

After this fix:

- deleting a coordinate whose own replacement source contains nested refs should not leave dangling refs;
- if recursive replacement is possible, delete succeeds;
- if impossible, delete fails cleanly;
- no invalid diagram should be committed.

Add at least one test through the delete path if available.

## 9. Layer translation integration

Layer translation uses detach helpers before translating.

After this fix:

- if a translated element references a coordinate anchor whose replacement source has nested frame refs, layer translation must not leave dangling refs;
- if sanitization succeeds, translation proceeds;
- if sanitization fails, layer translation fails atomically.

Add regression test if feasible.

## 10. Tests

Add focused tests.

### Replacement-source sanitization tests

1. `detachedCoordinatePointForAnchor` or equivalent replacement builder returns a replacement without refs to the detached coordinate id.

2. Work-plane-local coordinate anchor whose frame origin references itself:
   - detach either succeeds with no dangling refs and valid preview; or
   - returns `ok:false` atomically according to chosen policy.
   - It must not return `ok:true` with refs remaining.

3. Work-plane-local coordinate anchor whose frame origin references another coordinate in the detach set:
   - detach many removes both refs or fails atomically.

4. Work-plane-local coordinate anchor whose frame origin references a coordinate not in the detach set:
   - policy tested:
     - preserved if allowed; or
     - detached if choosing detach-all-nested-frame-refs.

5. Sanitizing replacement recomputes preview after nested frame changes.

### detachCoordinateAnchorReferencesMany tests

6. Geometry field references `coord-a`; `coord-a` replacement source frame also references `coord-a`.
   - after detach success, `findCoordinateAnchorReferences(result, "coord-a")` is empty.
   - if failure policy, result is `ok:false` and source unchanged.

7. Geometry field references `coord-a`; `coord-a` replacement source frame references `coord-b`; call detach many with `["coord-a", "coord-b"]`.
   - no refs to either remain after success; or failure is atomic.

8. `detachedCount` includes the original direct ref and any nested refs if your count policy includes nested replacement refs. Document count policy.

9. `validateDiagram(...)` passes after successful detach.

10. Source diagram is unchanged after successful detach call.

11. Source diagram is unchanged after failed detach call.

### Coordinate deletion tests

12. Deleting coordinate `coord-a` whose replacement source frame references `coord-a` does not commit an invalid diagram.

13. If deletion succeeds, no refs to `coord-a` remain and validation passes.

14. If deletion fails, coordinate remains and source diagram unchanged.

### Layer translation tests

15. Layer translation involving a coordinateRef whose replacement source frame has nested refs does not leave dangling refs.

16. Translation either succeeds with valid diagram or fails atomically.

### Regression tests

17. Direct coordinateRef detach without nested frame refs still works.

18. Nested frame detach from previous fix still recomputes preview.

19. Existing inventory tests still pass.

20. Existing unsupported frame-field fallback tests still pass.

21. Inline output no blank lines if export test is added.

## 11. Implementation guidance

### Resolve replacements before mutation

To keep atomic behavior, build all replacements first.

Suggested flow for `detachCoordinateAnchorReferencesMany`:

```text
1. Build detaching id set.
2. Resolve/sanitize replacement for each coordinate id using current diagram.
3. If any replacement fails, return ok:false.
4. Apply all replacements immutably.
5. Verify no refs to detaching ids remain.
6. Return ok:true.
```

### Avoid infinite recursion

Self/batch references can create cycles.

Add recursion guard:

```ts
visitedCoordinateIds
```

or build replacements from finite resolved previews to break cycles.

If cycle cannot be resolved safely, fail atomically.

### Prefer finite current anchor previews as cycle breaker

For self-referential replacement, if the coordinate anchor already has a finite current preview, it may be acceptable to use that finite global preview as the replacement for nested frame refs.

This preserves visible geometry and avoids cyclic symbolic data.

If using this policy, document/test it.

### Do not reintroduce refs to deleted ids

Before returning a sanitized replacement, scan it.

If it still contains any coordinateRef whose id is in the detaching set:

```text
fail
```

## 12. Error messages

Good errors:

```text
Could not detach coordinate "coord-a": replacement source still references a coordinate being deleted.
```

```text
Could not detach coordinate reference in work-plane-local frame: cyclic coordinate-anchor frame reference.
```

Avoid returning success with invalid state.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual-style check if practical:

1. Create coordinate `A`.
2. Give `A` a work-plane-local position whose frame origin references `A` or another coordinate.
3. Create a label/path referencing `A`.
4. Delete/detach `A`.
5. Confirm either:
   - operation succeeds and no refs to `A` remain; or
   - operation fails cleanly and diagram unchanged.
6. Confirm no validation failure is committed.

## 14. Preserve existing behavior

Do not regress:

- direct coordinate reference detach;
- nested frame detach and preview recomputation;
- coordinate deletion detach for normal anchors;
- layer translation detach for normal refs;
- coordinateRef validation;
- work-plane-local coordinate validation;
- save/load;
- TikZ export;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation.

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
- root cause of replacement-source reintroducing refs;
- replacement sanitization strategy;
- self-reference policy;
- batch-reference policy;
- recursion/cycle handling;
- no-dangling-ref postcondition;
- atomic failure behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
