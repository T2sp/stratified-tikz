# Phase 26M Implementation Prompt: Coordinate-anchor translation helper with symbolic and work-plane-local support

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
## Project context

You are working on the StratifiedTikZ project.

Phase 26 adds global TikZ coordinate anchors, distinct from visible point strata.

Coordinate anchors are global, not layer-bound, exported as `\coordinate`, and can be referenced by paths/sheets/labels/points through `coordinateRef` sources.

Current expected coordinate-anchor behavior after Phase 26A-26K:

- coordinate anchors are stored separately from strata/labels;
- coordinate anchors have no layer, codimension, or style;
- coordinate anchors can be created by cursor/direct input;
- coordinate anchors can be referenced by supported geometry fields;
- supported coordinate refs export as `(tikzName)`;
- unsupported coordinate refs are rejected instead of silently numericized;
- coordinate anchor deletion detaches references;
- layer translation detaches coordinate refs in layer-bound objects before moving them;
- coordinate markers can be shown/hidden;
- coordinate markers are preview-only;
- coordinate anchors are not affected by layer View filter or New layer;
- save/load, undo/redo, TikZ export, inline no-blank-line behavior, and 4-space indentation must be preserved.

Phase 26 follow-up adds coordinate-anchor multi-selection and coordinate-anchor translation.

Important design decisions:

- Coordinate anchors support coordinate-only multi-selection.
- Mixed multi-selection of coordinate anchors and layer-bound objects is not supported in the MVP.
- Coordinate translation moves the coordinate anchors themselves.
- Geometry referencing translated coordinate anchors remains live and therefore follows the moved anchors.
- Unlike layer translation, coordinate translation does not detach references in layer-bound objects.
- If a selected coordinate anchor's own position contains `coordinateRef` sources, detach those internal refs before translating that coordinate anchor.
- Global coordinate positions translate by adding the delta to components, preserving symbolic expressions when possible.
- Work-plane-local coordinate positions translate by moving their stored frame origin; local `a,b` expressions and frame basis vectors remain unchanged.
- Drag-based coordinate translation uses cursor snap.
- Numeric/direct translation does not use cursor snap.
- Translation is atomic and undoable.
- Selection state is UI/editor state and is not stored in `Diagram`.


## Goal

Implement the pure model/helper layer for translating coordinate anchors.

This subphase should not yet add the final Inspector/drag UI. It should provide robust, tested helpers that later UI paths can call.

## Scope

Implement:

- `translateCoordinateAnchors` or equivalent helper;
- global symbolic coordinate translation;
- work-plane-local coordinate translation by moving stored frame origin;
- internal coordinateRef detach inside selected coordinate anchor positions before translation;
- preview recomputation;
- atomic failure behavior;
- tests.

Do not implement yet:

- Inspector translation panel;
- drag group translation;
- mixed selection translation;
- layer-bound object translation changes.

## Translation semantics

Coordinate-anchor translation moves coordinate anchors themselves.

Layer-bound geometry referencing those anchors remains live and follows them through reference resolution.

Do not detach references in layer-bound objects when translating coordinate anchors.

## Helper API

Suggested:

```ts
translateCoordinateAnchors(
  diagram: Diagram,
  coordinateIds: string[],
  delta: Vec3 | SymbolicVec3Delta
): Result<{
  diagram: Diagram;
  translatedCount: number;
}, ValidationError>
```

Exact type names may differ.

Requirements:

- input diagram is not mutated;
- operation is atomic;
- ids must reference existing coordinate anchors;
- duplicate ids handled deterministically;
- no layer-bound objects are directly mutated;
- returns useful status/count.

## Global coordinate translation

For a coordinate anchor with global position:

```text
x -> x + dx
y -> y + dy
z -> z + dz
```

Requirements:

- numeric components add numerically;
- symbolic components preserve expressions, e.g.:

```text
R*cos(q) + 1
```

- omit trivial `+ 0` where practical;
- preview values recomputed;
- 2D z policy preserved if coordinate is used in 2D;
- invalid/non-finite results fail atomically.

Use existing Phase 24D symbolic translation helpers if possible.

## Work-plane-local coordinate translation

For a coordinate anchor with work-plane-local position:

```text
P = frame.origin + a*u + b*v
```

Global translation by `d` should produce:

```text
frame.origin' = frame.origin + d
a' = a
b' = b
u' = u
v' = v
normal' = normal
```

Requirements:

- local `a,b` expressions unchanged;
- basis vectors unchanged;
- frame origin translated symbolically/numerically using existing helpers;
- preview recomputed;
- no stale preview;
- active/global work plane is not mutated.

## Coordinate anchor position containing coordinateRef

If a selected coordinate anchor's own position contains `coordinateRef` sources:

- detach those internal coordinateRefs to current coordinate values before applying translation;
- then translate the now-concrete position;
- do not detach references in layer-bound objects.

This applies to:

- direct `position.kind === "coordinateRef"` if such shape exists;
- global Vec3 with `symbolic.source.kind === "coordinateRef"`;
- work-plane-local source frame fields containing coordinateRefs.

MVP policy:

```text
Selected coordinate anchors each move from their current preview position by delta.
Any internal coordinateRef dependencies inside selected coordinate positions are detached first.
```

If a selected coordinate depends on another selected coordinate:

- detach using pre-translation current positions;
- then translate all selected coordinates by the same delta.

This makes the operation predictable and avoids live dependency ambiguity.

## Preview recomputation

After translation:

- coordinate anchor preview values must match translated position/source;
- work-plane-local previews recomputed;
- validation passes.

## Atomic failure

If translating any selected coordinate fails:

- return `ok:false`;
- do not mutate any coordinate anchor;
- do not partially translate other anchors.

Failure cases:

- missing coordinate id;
- invalid coordinate position;
- non-finite delta;
- unsupported internal coordinateRef detach;
- non-finite preview after translation;
- work-plane-local frame invalid after origin translation.

## Tests

Add focused tests.

### Global coordinate tests

1. Translate numeric global coordinate.
2. Translate symbolic global coordinate and preserve expression.
3. Translation by zero omits/no-ops cleanly.
4. Non-finite delta rejected.
5. Preview recomputed.

### Work-plane-local tests

6. Translate work-plane-local coordinate by moving frame origin.
7. Local `a,b` unchanged.
8. Basis vectors unchanged.
9. Preview moves by delta.
10. Active/global work plane not mutated.

### Internal coordinateRef detach tests

11. Coordinate B position references coordinate A; translating B detaches B from A and moves B from A's current position.

12. A and B both selected, B references A:
    - use pre-translation current A for B detach;
    - both final previews move by delta.

13. Work-plane-local coordinate whose frame origin references A detaches frame ref then translates frame origin.

14. No dangling refs remain inside translated coordinate anchors.

### Atomicity tests

15. Missing coordinate id fails with no mutation.
16. One invalid coordinate among many fails with no mutation.
17. Non-finite recomputed preview fails with no mutation.

### Regression tests

18. Layer-bound paths referencing translated coordinates remain refs.
19. Referencing geometry preview moves because anchor moved.
20. TikZ output updates only coordinate definitions for referencing paths.
21. Undo integration can be deferred but helper is pure.

## Preserve existing behavior

Do not regress:

- coordinate delete detach;
- layer translation detach;
- coordinateRef validation;
- work-plane-local preview validation;
- symbolic translation helpers;
- TikZ export;
- save/load.

## Report after implementation

Please report:

- files modified;
- helper API;
- global symbolic translation behavior;
- work-plane-local frame-origin behavior;
- internal coordinateRef detach policy;
- atomicity behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
