# Phase 26H Fix Prompt: Recompute enclosing previews after nested work-plane-local frame reference detach

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

Recent work made inventory and detach recurse into references nested inside:

```ts
Vec3.symbolic.source.kind === "workPlaneLocal"
source.frame.origin
source.frame.u
source.frame.v
source.frame.normal
```

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Nested work-plane-local frame references are detached without recomputing the enclosing work-plane-local preview.

Current behavior:

1. Detach now finds coordinate refs nested inside `workPlaneLocal.source.frame`.
2. Detach replaces those refs with the current coordinate anchor value/source.
3. However, it does **not** recompute the enclosing work-plane-local preview.

Therefore, after detaching a nested frame ref, stale preview fields may remain, such as:

- enclosing `point.x/y/z`;
- `symbolic.x/y/z`;
- `symbolic.source.preview`;
- `CoordinateAnchorPosition.preview`.

Reproduced failure:

1. A work-plane-local coordinate source has a frame field referencing coordinate anchor `A`.
2. The anchor `A` is moved after the nested ref was created.
3. `detachCoordinateAnchorReferences(...)` uses the current anchor value to replace the nested frame ref.
4. The enclosing preview still contains the old preview.
5. Detach returns `ok: true`.
6. `validateDiagram(...)` fails with:

```text
Work-plane-local coordinate preview must match the stored global preview point.
```

The same root issue exists for work-plane-local coordinate anchors.

## Goal

Fix nested work-plane-local frame reference detach so that after replacing refs inside a source frame, the enclosing preview values are recomputed from the updated frame and local source.

Required behavior:

1. When a coordinate ref inside `workPlaneLocal.source.frame` is detached, recompute the enclosing global preview point.
2. Recompute using:

```text
preview = frame.origin + a * frame.u + b * frame.v
```

where `frame` is the updated frame and `a,b` are the current local scalar previews.
3. For ordinary `Vec3` / point-like coordinate values, update all stored preview/global fields consistently.
4. For `CoordinateAnchorPosition.kind === "workPlaneLocal"`, update `position.preview` consistently.
5. If recomputation fails, return `ok: false`.
6. Failed detach must be atomic: do not partially mutate the input diagram.
7. Add tests where the referenced anchor has moved before delete/detach.

## Scope

This is a targeted Phase 26H fix.

Implement:

- recomputation of enclosing work-plane-local previews after nested frame-reference detach;
- recomputation for ordinary `Vec3`-like values;
- recomputation for `CoordinateAnchorPosition.kind === "workPlaneLocal"`;
- atomic failure behavior when recomputation fails;
- regression tests for moved-anchor nested frame refs.

Do not implement:

- new coordinate-anchor features;
- new coordinateRef-supported locations;
- new UI;
- new layer semantics;
- broad coordinate model refactor;
- new TikZ export behavior;
- new dependencies.

Do not change:

- direct coordinate-reference detach behavior;
- direct global/work-plane-local coordinate preservation policy;
- existing inventory recursion behavior;
- existing frame-field fallback policy;
- coordinate anchor export;
- coordinate delete/detach UI behavior except through fixed helper behavior;
- layer translation detach policy except through fixed helper behavior;
- save/load format;
- inline/standalone TikZ formatting.

## 1. Inspect nested detach implementation

Inspect:

- `src/model/coordinateReferences.ts`;
- `detachCoordinateAnchorReferences(...)`;
- `detachCoordinateReferencePoint(...)`;
- helpers that detach coordinate refs in `workPlaneLocal` source frames;
- helpers that compute/evaluate work-plane-local coordinate previews;
- coordinate anchor position validation;
- `validateDiagram(...)` logic for:

```text
Work-plane-local coordinate preview must match the stored global preview point.
```

Review locations:

```text
src/model/coordinateReferences.ts around nested frame detach
src/model/coordinateReferences.ts around work-plane-local coordinate anchor detach
```

Find every branch that:

- updates a nested `source.frame`; but
- returns without refreshing the enclosing preview.

## 2. Recompute enclosing Vec3 previews after frame detach

For any coordinate value shaped conceptually like:

```ts
{
  x: ...,
  y: ...,
  z: ...,
  symbolic: {
    source: {
      kind: "workPlaneLocal",
      frame,
      local: { a, b },
      preview
    }
  }
}
```

or the project’s equivalent structure:

When a coordinate ref inside `source.frame` is detached:

1. update the frame field;
2. evaluate the updated work-plane-local source;
3. recompute the global preview point;
4. update all stored preview/global components consistently.

Required updates may include, depending on actual model shape:

- `point.x/y/z`;
- `symbolic.x/y/z`;
- `symbolic.source.preview`;
- any cached `previewValue` fields.

The resulting data must satisfy the existing validator.

Use existing Phase 25 helpers if available, for example:

```ts
evaluateWorkPlaneLocalCoordinate(...)
refreshWorkPlaneLocalCoordinatePreview(...)
workPlaneLocalSourceToVec3(...)
refreshVec3SymbolicPreview(...)
```

Do not duplicate formula logic if a tested helper exists.

## 3. Recompute CoordinateAnchorPosition previews

For a coordinate anchor whose own position is work-plane-local:

```ts
CoordinateAnchor.position = {
  kind: "workPlaneLocal",
  frame,
  local: { a, b },
  preview
}
```

If a coordinate ref nested inside `position.frame` is detached:

1. update the frame;
2. recompute `position.preview`;
3. validate finite preview;
4. return updated coordinate anchor position.

This is specifically called out by the review.

## 4. Use current anchor value, not stale stored preview

The critical test case is a moved anchor.

Example:

```text
coord-a originally at (1, 1)
nested work-plane-local source frame.origin references coord-a
coord-a later moved to (5, 5)
detach coord-a
```

Expected after detach:

```text
frame.origin becomes concrete/current (5,5)
enclosing preview recomputes using (5,5)
validation passes
no old (1,1) stale preview remains
```

The implementation must not use the coordinateRef’s stale stored preview as the detach value when the anchor still exists.

## 5. Atomic failure behavior

If recomputation fails, detach must fail atomically.

Failure cases include:

- updated frame is invalid;
- local `a` or `b` preview is missing or non-finite;
- frame `origin/u/v/normal` preview is non-finite;
- recomputed preview is non-finite;
- malformed nested source;
- any helper reports a validation error.

Required:

- return `ok: false` or the project’s equivalent result;
- do not mutate the source diagram;
- do not partially detach some refs and leave others changed;
- error message should indicate nested work-plane-local preview recomputation failure.

Good error examples:

```text
Could not detach coordinate reference in work-plane-local frame: recomputed preview is non-finite.
```

```text
labels[0].position.symbolic.source.frame.origin: failed to recompute work-plane-local preview after detach.
```

Avoid raw TypeErrors.

## 6. Coordinate deletion integration

Coordinate deletion uses detach helpers.

After this fix, deleting a coordinate referenced inside a nested work-plane-local frame should:

- detach that nested ref;
- recompute enclosing preview;
- delete coordinate anchor;
- leave no dangling refs;
- leave a diagram that passes `validateDiagram(...)`;
- preserve visible geometry as much as practical;
- undo/redo should work through existing delete infrastructure.

Add at least one test through the delete path if the delete helper is available in model/UI tests.

## 7. Layer translation integration

Layer translation detaches coordinate refs before translating layer-bound objects.

After this fix:

- layer translation involving nested work-plane-local frame refs should detach and recompute preview before translation;
- translation should then apply to valid concrete work-plane-local source data;
- final diagram should validate.

Add a regression test if feasible.

## 8. Tests

Add focused tests.

### Pure detach recomputation tests

1. Nested coordinate ref in `Vec3.symbolic.source.frame.origin` is detached and enclosing preview is recomputed.

2. Same for `frame.u`, if detaching basis vectors is supported.

3. Same for `frame.v`, if supported.

4. Same for `frame.normal`, if supported.

5. Local `a,b` expressions remain unchanged after nested frame detach.

6. Recomputed preview equals:

```text
updated origin + a*u + b*v
```

within tolerance.

7. No stale old preview values remain.

8. `validateDiagram(...)` passes after detach.

### Moved anchor regression tests

9. Anchor moved after reference creation:
   - nested frame ref has old stored preview;
   - detach uses current anchor value;
   - enclosing preview recomputes to current anchor value;
   - validation passes.

10. Same moved-anchor test for `CoordinateAnchorPosition.kind === "workPlaneLocal"`.

### Coordinate deletion tests

11. Delete coordinate referenced only inside a nested work-plane-local frame:
   - refs detach;
   - coordinate removed;
   - enclosing preview recomputed;
   - final diagram validates;
   - no dangling refs remain.

12. TikZ export after delete does not contain the deleted coordinate ref and does not fail.

### Layer translation tests

13. Layer translation detaches nested work-plane-local frame refs and recomputes preview before translation.

14. Translated geometry uses the recomputed current-anchor position, not stale preview.

15. Coordinate anchor itself does not move unless explicitly selected/moved.

### Atomic failure tests

16. If recomputation after nested frame detach would be non-finite, detach returns `ok: false`.

17. Source diagram remains unchanged after failed detach.

18. No partial detach occurs when multiple refs are present and one nested recomputation fails.

### Regression tests

19. Direct coordinateRef detach still works.

20. Direct work-plane-local coordinate source detach still works.

21. Existing inventory tests still pass.

22. Existing source immutability tests still pass.

23. Existing unsupported frame-field fallback tests still pass.

24. Inline output no blank lines if any export test is added.

## 9. Implementation guidance

### Prefer recomputation close to mutation

The best place to recompute is immediately after updating the nested frame inside the enclosing object, before returning the detached coordinate/source.

Avoid relying on a later global refresh pass unless the detach helper explicitly runs it and tests guarantee it.

### Use existing symbolic/work-plane-local refresh helpers

If Phase 25 provides a helper to refresh a work-plane-local source from variables/frame/local scalars, reuse it.

Do not hand-roll inconsistent preview formulas.

### Keep detach helpers pure

Do not mutate the input diagram.

Use immutable updates / deep copies as existing detach helpers do.

### Validate before returning success

Before returning `ok: true`, ensure:

```text
detached diagram has no target coordinate refs
work-plane-local previews are consistent
```

At minimum, run the relevant local validation helper. Full `validateDiagram` may be too heavy in the pure helper, but tests should call it.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual-style check if practical:

1. Create coordinate `A`.
2. Create work-plane-local coordinate source whose frame origin references `A`.
3. Move `A`.
4. Delete/detach `A`.
5. Confirm referenced object remains visually consistent with current `A`.
6. Confirm validation passes.
7. Confirm no stale preview error appears.

## 11. Preserve existing behavior

Do not regress:

- direct coordinate reference inventory/detach;
- nested inventory from previous fix;
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
- root cause of stale enclosing preview after nested frame detach;
- where recomputation was added;
- how ordinary Vec3 work-plane-local previews are refreshed;
- how CoordinateAnchorPosition previews are refreshed;
- atomic failure behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
