# Phase 26C Fix Prompt: Detach coordinate refs before translation and align supported path ref fields with TikZ preservation

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
- Two Medium issues remain.

## Medium issue 1: Translation detaches coordinate refs using stale stored preview values

Current problem:

- SVG preview resolves coordinate refs through `resolveDiagramCoordinateRefs`, so moving an anchor updates visible referenced geometry.
- But layer translation and selected-element translation use raw translation helpers directly on the stored element data.
- A coordinateRef stores stale numeric/symbolic preview data from when it was created.
- If the coordinate anchor has moved since then, translation uses the stale stored preview instead of the current coordinate anchor position.

Reproduced case:

1. Anchor `A` originally at `(1,1)`.
2. An element references `A`.
3. Anchor `A` is moved to `(5,5)`.
4. Preview correctly resolves the element at `(5,5)`.
5. `translateLayer(..., { x: 1, y: 0, z: 0 })` produces `(2,1)` after detaching/translating from stale data.
6. Correct result should be `(6,5)` if the referenced element is translated, while anchor `A` remains at `(5,5)`.

Affected paths:

- `src/model/layers.ts`: layer translation sends layer elements directly through translation helpers.
- `src/model/translation.ts`: raw `translateVec3` translates stored coordinateRef preview data.
- `src/ui/bulkEditing.ts`: selected-element translation uses the same raw path.

## Medium issue 2: Some accepted path coordinate-ref fields are not actually TikZ-preserved

Current problem:

- Some fields are listed as supported and validated as coordinateRef-compatible, but export does not preserve `(A)` references.

Known examples:

### Path template center

- `pathTemplateCenter` is listed as supported and validated.
- 3D template export converts center to local numeric `(a,b)` instead of using `(A)`.
- Direct 3D template parser rejects all symbolic centers, including coordinate refs.
- This means accepted refs can still degrade to numeric output in some export paths.

### Arc center

- Arc centers are validated as `pathCoordinate` refs.
- 2D arc TikZ emits only start/end/radius/angles and does not use the center as `(A)`.
- 3D arcs are converted to numeric cubic approximations.
- Therefore a center coordinateRef is accepted but not preserved in TikZ.

This violates the Phase 26C rule:

```text
CoordinateRef support must match TikZ preservation.
If a location cannot export `(tikzName)` references, reject it clearly instead of silently degrading to numeric output.
```

## Goal

Fix Phase 26C coordinate-reference translation/export gaps.

Specifically:

1. Before layer translation and selected-element translation, detach coordinate refs inside moved layer-bound elements using **current coordinate anchor positions**, not stale stored previews.
2. Preserve symbolic/global/work-plane-local anchor data when detaching, where the target field supports it.
3. Do not move global coordinate anchors during layer translation unless the coordinate anchor itself is explicitly selected/moved by a coordinate-anchor editing operation.
4. Align coordinateRef supported locations with TikZ preservation:
   - either fully preserve refs for 3D template centers and arc centers; or
   - reject those fields as unsupported with clear validation errors and tests.
5. Preferred MVP:
   - reject `coordinateRef` in path template centers and arc centers unless the exporter can preserve `(A)` in every relevant path.
6. Add regression tests for translation and unsupported accepted fields.

## Scope

This is a targeted Phase 26C fix.

Implement:

- current-anchor-based detach before layer translation;
- current-anchor-based detach before selected-element translation;
- validation/support-boundary updates for template centers and arc centers;
- tests.

Do not implement:

- full coordinateRef-preserving 3D template export unless it is small and safe;
- full coordinateRef-preserving arc-center export if arc syntax cannot use center refs;
- new coordinate anchor UI;
- new coordinate reference fields;
- layer-bound coordinate anchors;
- affine transforms;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- normal coordinateRef export for supported fields:
  - path endpoints;
  - path controls where truly preserved;
  - points;
  - labels;
  - simple sheet vertices;
- coordinate anchor definitions;
- coordinate anchor delete-detach behavior from previous fixes;
- coordinate anchor global/non-layer-bound nature;
- layer translation semantics for non-ref objects;
- selected-element translation semantics for non-ref objects;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## Part 1: Detach coordinate refs before translation using current anchors

### 1. Inspect translation paths

Inspect:

- `src/model/layers.ts`;
- `src/model/translation.ts`;
- `src/ui/bulkEditing.ts`;
- coordinate reference detach helpers;
- coordinate reference resolver;
- coordinate anchor move/edit helpers;
- validation tests for translation.

Known issue locations:

```text
translateLayer(...) -> translateStratum / translateTextLabel directly
bulk selected translation -> raw translation path
```

These should not translate stale stored coordinateRef preview data.

### 2. Add or reuse a current-anchor detach helper

Use or add a helper such as:

```ts
detachCoordinateRefsInElements(
  diagram: Diagram,
  elementIds: string[],
  options?: {
    useCurrentAnchorPositions: true;
    skipElementIds?: string[];
  }
): Result<Diagram>
```

or a more targeted helper:

```ts
detachCoordinateRefsBeforeTranslation(
  diagram: Diagram,
  movedElementIds: Set<string>
): Result<Diagram>
```

Core requirement:

- when detaching a coordinateRef, look up the coordinate anchor in the current diagram;
- deep-copy the coordinate anchor's current position/source;
- do **not** use only the coordinateRef's stored preview;
- preserve source if supported;
- fallback to finite global preview only when necessary and explicit in code/tests.

### 3. Layer translation behavior

Before translating a layer:

1. Identify elements on the translated layer.
2. Detach coordinateRefs inside those elements using current coordinate anchor positions.
3. Apply symbolic-aware translation to the now-concrete fields.
4. Leave coordinate anchors unchanged.
5. Leave refs in elements on other layers linked.
6. Clean crossings/braiding according to existing layer translation policy.
7. Commit atomically.

Example:

```text
A currently at (5,5)
Path on layer 2 endpoint = coordinateRef(A)
Translate layer 2 by (1,0)

After:
  A remains (5,5)
  endpoint becomes concrete (6,5)
```

For symbolic anchor:

```text
A.x = R
dx = 1
=> endpoint.x = (R) + 1
A.x remains R
```

For work-plane-local anchor:

- detach to copied local source where supported;
- global translation moves the copied frame origin according to Phase 25E policy;
- local `a,b` unchanged;
- anchor unchanged.

### 4. Selected-element bulk translation behavior

Before translating selected elements:

1. Identify selected layer-bound elements to be moved.
2. If selected objects include coordinate anchors themselves:
   - coordinate anchors may be translated by the coordinate-anchor move behavior if that operation explicitly includes anchors;
   - but refs inside selected layer-bound elements should still be detached using the anchor's current position before those elements are moved.
3. Detach refs inside moved layer-bound elements.
4. Apply translation.
5. Leave non-selected coordinate anchors unchanged.
6. If both a coordinate anchor and a referencing object are selected:
   - choose a clear policy and test it.

Recommended policy for mixed selection:

```text
- Coordinate anchor itself moves if explicitly selected.
- Referencing layer-bound objects detach from the coordinate before translation, using the anchor's pre-translation current position, then translate with the selected elements.
- This preserves the relative visual translation of selected layer-bound geometry and avoids implicit live-reference movement ambiguity.
```

Document/report the chosen policy.

### 5. Do not allow raw `translateVec3` to silently translate missing/stale refs

If `translateVec3` receives a coordinateRef directly, consider one of these:

- make it return an error telling caller to detach refs before translation;
- or make it require a coordinate-anchor lookup context.

Preferred:

```text
translation helpers should not silently translate stale coordinateRef preview data.
```

Add a defensive test if possible.

## Part 2: Align coordinateRef supported fields with TikZ preservation

### 6. Audit current coordinateRef supported locations

Inspect:

- `src/model/coordinateReferences.ts`;
- coordinate-ref support constants/enums;
- validation helpers;
- resolver helpers;
- TikZ path export:
  - path template center export;
  - 2D arc export;
  - 3D arc export;
  - path endpoints/controls;
  - simple sheet vertices.

Known problematic supported locations:

```text
pathTemplateCenter
arc center / pathCoordinate center-like refs
```

### 7. Preferred MVP policy: reject unsupported center refs

If a coordinateRef location cannot preserve `(A)` in TikZ output, reject it.

Specifically, unless full preservation is implemented:

#### Reject coordinateRef in path template centers

Because:

- 3D template export converts center to local numeric coordinates;
- direct 3D parser rejects symbolic centers;
- not all export paths preserve `(A)`.

Validation error example:

```text
Coordinate references are not currently supported for path template centers because 3D template export cannot preserve the anchor reference.
```

#### Reject coordinateRef in arc centers

Because:

- 2D arc export uses start/end/radius/angles, not center;
- 3D arc export converts to numeric cubic approximations;
- center ref is not visible in emitted TikZ.

Validation error example:

```text
Coordinate references are not currently supported for arc centers because arc export does not preserve center references.
```

### 8. Keep coordinateRef in truly preserved fields

Do not over-reject.

Keep support for fields where TikZ output actually uses `(tikzName)`:

- path endpoints/start/end;
- line endpoints;
- cubic start/end/control points if export emits them as coordinates;
- labels;
- points;
- simple sheet vertices;
- any other field with tests proving `(A)` appears in TikZ.

If a cubic control point ref is exported as a coordinate in TikZ controls, keep it. If not, review and test.

### 9. Make validation and UI parser agree

If validation rejects coordinateRef in path template centers or arc centers:

- UI direct creation should not offer coordinate anchors for those fields;
- if user somehow imports JSON with those refs, parse/load returns `ok:false`;
- resolver should not claim support.

The support boundary should be centralized.

## Tests

### A. Translation stale-preview regression tests

1. Create anchor `A` at `(1,1)`.
2. Create point/path endpoint on layer 2 referencing `A`.
3. Move anchor `A` to `(5,5)`.
4. Translate layer 2 by `(1,0)`.
5. Assert:
   - anchor `A` remains `(5,5)`;
   - referenced element is detached;
   - translated concrete coordinate is `(6,5)`;
   - no dangling coordinateRef remains for that element.

6. Same test for selected-element bulk translation.

7. Same test with global symbolic anchor:

```text
A.x = R
dx = 1
=> detached translated expression includes R + 1
```

8. Same test with work-plane-local anchor if supported:
   - copied frame origin moves;
   - local `a,b` unchanged.

9. Element on another layer still referencing `A` remains linked after layer translation.

10. If selected translation includes both anchor and referencing element, test chosen policy.

11. Raw translation helper does not silently translate stale coordinateRef preview if called directly, or higher-level helpers ensure refs are detached before it.

### B. Supported-location boundary tests

12. `pathTemplateCenter` coordinateRef is rejected by validation unless full TikZ preservation is implemented.

13. Saved JSON with coordinateRef in path template center returns `ok:false`.

14. Arc center coordinateRef is rejected by validation unless full TikZ preservation is implemented.

15. Saved JSON with coordinateRef in arc center returns `ok:false`.

16. Error messages mention unsupported path template center / arc center.

17. Direct 3D template parser and validation agree:
   - coordinateRef center is not accepted if unsupported.

18. Direct/UI helper for arc center does not offer coordinateRef if unsupported.

### C. Preserved field regression tests

19. Path endpoint coordinateRef still validates and exports `(A)`.

20. Cubic control coordinateRef remains supported only if TikZ exports `(A)`; otherwise reject with tests.

21. Label coordinateRef still validates and exports `(A)`.

22. Point coordinateRef still validates and exports `(A)`.

23. Simple sheet vertex coordinateRef still validates and exports `(A)`.

24. Missing refs in supported fields still fail.

### D. TikZ/formatting tests

25. After translation detach, TikZ output no longer references the anchor for moved element but preserves concrete/symbolic coordinate.

26. Coordinate anchor definition remains for `A` if anchor still exists.

27. Inline output no blank lines.

28. 4-space indentation preserved.

29. Existing coordinateRef delete-detach tests still pass.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual test if practical:

1. Create coordinate `A`.
2. Create a path endpoint referencing `A` on layer 2.
3. Move `A`.
4. Translate layer 2.
5. Confirm path endpoint moves from current `A`, not stale old `A`.
6. Confirm `A` does not move.
7. Confirm path endpoint no longer depends on `A`.
8. Try to create/import a circle/ellipse template center referencing `A` in unsupported 3D template context.
9. Confirm validation rejects or export preserves `(A)` according to implemented policy.
10. Try arc center reference.
11. Confirm validation rejects or export preserves `(A)` according to policy.

## Preserve existing behavior

Do not regress:

- coordinateRef model;
- supported coordinateRef export;
- coordinate anchor definitions;
- coordinate delete detach;
- layer translation for non-ref objects;
- selected translation for non-ref objects;
- symbolic translation;
- work-plane-local translation policy;
- path endpoint/label/point/simple sheet refs;
- inline no-blank-lines;
- 4-space indentation;
- save/load;
- undo/redo;
- SVG preview.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## Report after implementation

Please report:

- files modified;
- root cause of stale preview translation;
- current-anchor detach-before-translation flow;
- layer translation behavior;
- selected-element translation behavior;
- mixed selection policy if anchor and referencing element both move;
- path template center coordinateRef policy;
- arc center coordinateRef policy;
- support-boundary changes;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
