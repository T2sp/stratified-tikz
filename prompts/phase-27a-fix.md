# Phase 27A Fix Prompt: Exclude 3D auto-hidden points and labels from selection cycling

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

Phase 27A implemented selection cycling for overlapping SVG/PGF Preview objects.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Hidden 3D auto-visibility targets can still be selected by Alt-click / Option-click cycling.

Current behavior:

- SVG rendering correctly removes or hides some auto-hidden 3D objects:
  - points when `pointVisibility === "hideHidden"`;
  - labels when `labelVisibility === "autoHide"`.
- However, selection-cycling candidate collection does not receive or use the resolved 3D visibility/occlusion state.
- Candidate collection only checks:
  - layer visibility/filtering;
  - geometric visibility;
  - coordinate show/hide;
  - ordinary selectable state.
- Therefore, an object that is **not rendered in the SVG preview** can still be returned as a cycling candidate and selected.

Review references:

```text
src/rendering/SvgDiagram.tsx
src/rendering/svgHitTesting.ts
```

The specific problem is that rendering and hit/cycling visibility have diverged.

## Goal

Fix Phase 27A selection cycling so candidate collection mirrors SVG preview visibility for 3D auto-hidden points and labels.

Required behavior:

1. If a point is hidden by 3D auto-visibility with `pointVisibility === "hideHidden"`, it must not be returned as a cycling candidate.
2. If a label is hidden by 3D auto-visibility with `labelVisibility === "autoHide"`, it must not be returned as a cycling candidate.
3. Objects that are actually rendered should remain selectable/cyclable.
4. Ordinary layer visibility/filtering behavior must remain unchanged.
5. Coordinate anchor show/hide behavior must remain unchanged.
6. Selection cycling state remains UI-only and must not affect TikZ/export.
7. Add focused tests for hidden point and hidden label cases.

## Scope

This is a targeted Phase 27A fix.

Implement:

- pass resolved visibility/occlusion state, or equivalent visibility predicates, into `collectSvgPreviewSelectionCandidates`;
- exclude auto-hidden points and labels from selection-cycling candidates;
- tests.

Do not implement:

- new visibility algorithms;
- new occlusion calculations;
- new selection model features;
- broad SVG rendering rewrite;
- new UI features;
- new dependencies.

Do not change:

- rendered SVG visibility behavior;
- normal click selection behavior except excluding invisible candidates;
- braiding marker click behavior;
- coordinate anchor hit priority/show-hide behavior;
- layer filter/lock behavior;
- TikZ generation;
- save/load;
- undo/redo.

## 1. Inspect rendering and candidate-collection paths

Inspect:

- `src/rendering/SvgDiagram.tsx`;
- `src/rendering/svgHitTesting.ts`;
- point rendering logic around the `pointVisibility === "hideHidden"` path;
- label rendering logic around the `labelVisibility === "autoHide"` path;
- point/label occlusion map construction;
- `collectSvgPreviewSelectionCandidates(...)`;
- all call sites of `collectSvgPreviewSelectionCandidates(...)`;
- selection cycling state and Alt/Option-click handler.

The fix should align candidate collection with the actual rendered object set.

## 2. Prefer explicit visibility predicates

Preferred design:

Compute visibility once in `SvgDiagram.tsx`, then pass predicate functions or sets into the hit/cycling collector.

Suggested conceptual API:

```ts
type SvgSelectionCandidateVisibility = {
  isPointSelectableInPreview: (id: string) => boolean;
  isLabelSelectableInPreview: (id: string) => boolean;
};
```

or:

```ts
type SvgSelectionCandidateVisibility = {
  hiddenPointIds: ReadonlySet<string>;
  hiddenLabelIds: ReadonlySet<string>;
};
```

Then:

```ts
collectSvgPreviewSelectionCandidates({
  ...,
  visibility: {
    hiddenPointIds,
    hiddenLabelIds,
  },
});
```

Requirements:

- hidden point ids reflect the same logic used by renderer;
- hidden label ids reflect the same logic used by renderer;
- candidate collector excludes them;
- 2D diagrams should not accidentally hide candidates through missing maps;
- defaults preserve old behavior when visibility data is absent.

## 3. Define exact exclusion policy

### Points

When:

```text
ambientDimension === 3
visibilityOptions.pointVisibility === "hideHidden"
```

and the resolved point occlusion/visibility map says a point is hidden:

- do not render the point;
- do not include it in selection-cycling candidates.

If point visibility option is not `hideHidden`, preserve existing selection behavior.

### Labels

When:

```text
ambientDimension === 3
visibilityOptions.labelVisibility === "autoHide"
```

and the resolved label occlusion/visibility map says a label is hidden:

- do not render the label;
- do not include it in selection-cycling candidates.

If label visibility option is not `autoHide`, preserve existing selection behavior.

## 4. Keep normal selection and cycling consistent

After the fix:

- normal click should not select an object that is not rendered due to auto-hide;
- cycling should not select an object that is not rendered due to auto-hide;
- candidate cycling should still include visible overlapping objects;
- cycling order remains deterministic;
- wrapping remains unchanged.

If normal click and cycling use separate hit-test paths, make sure both are consistent if the invisible object can also be hit by normal click.

The review specifically calls out cycling, but selecting invisible objects through normal hit testing would be the same bug class.

## 5. Preserve coordinate and layer behavior

Do not regress:

- hidden coordinate anchors are excluded when `Coordinates: Hide`;
- shown coordinate anchors remain high-priority candidates;
- layer-filter-hidden objects are excluded;
- locked/hidden layers follow current selection policy;
- braiding/crossing markers remain clickable/cyclable according to existing behavior.

## 6. Tests

Add focused tests.

### Candidate collector tests

1. A visible 3D point is returned as a candidate.

2. A 3D point hidden by `pointVisibility === "hideHidden"` is **not** returned as a candidate.

3. If `pointVisibility` is not `hideHidden`, the point candidate behavior remains as before.

4. A visible 3D label is returned as a candidate.

5. A 3D label hidden by `labelVisibility === "autoHide"` is **not** returned as a candidate.

6. If `labelVisibility` is not `autoHide`, label candidate behavior remains as before.

7. 2D point/label candidates are not affected by missing 3D occlusion maps.

8. Coordinate show/hide exclusion still works.

9. Layer-hidden candidates are still excluded.

### Cycling interaction tests

10. In an overlap where one candidate is a hidden auto-visibility point and another is a visible path/label, Alt-click cycling never selects the hidden point.

11. In an overlap where one candidate is a hidden auto-visibility label and another is visible, Alt-click cycling never selects the hidden label.

12. Cycling order among remaining visible candidates is deterministic and wraps.

13. Cycling state resets as before when location changes.

### Rendering consistency tests

14. For a hidden 3D point, the renderer omits the point and the collector omits the point.

15. For a hidden 3D label, the renderer omits the label and the collector omits the label.

### Regression tests

16. Normal non-Alt click behavior still selects top visible candidate.

17. Braiding marker click priority remains preserved.

18. TikZ output unaffected by cycling/visibility candidate state.

19. Selection cycling state remains UI-only and is not serialized.

## 7. Avoid duplicating visibility logic incorrectly

Do not reimplement point/label occlusion logic separately in `svgHitTesting.ts` if it can drift.

Preferred:

- compute hidden/visible ids in the same place or helper used by rendering;
- pass the computed results into candidate collection.

If a small predicate wrapper is needed, make sure it uses the same maps/options as renderer.

Add comments explaining that selection candidates must mirror rendered preview visibility.

## 8. Error-prone cases to consider

### Missing visibility maps

If visibility maps are absent due to disabled visibility mode or 2D diagram:

- collector should behave as before.
- Do not throw.

### Stale ids

If visibility map contains ids no longer in diagram:

- ignore safely.

### Labels attached to hidden geometry

If label auto-hide logic hides labels because their anchor/target is hidden:

- candidate collector should follow that exact hidden label result.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Open or create a 3D diagram with a point behind a surface.
2. Enable 3D visibility option such that hidden points are hidden:
   - `pointVisibility = hideHidden`.
3. Confirm the hidden point is not rendered.
4. Alt/Option-click near the hidden point location.
5. Confirm the hidden point cannot be selected through cycling.
6. Repeat for a label hidden by:
   - `labelVisibility = autoHide`.
7. Confirm visible overlapping candidates still cycle normally.
8. Disable the hide/auto-hide option and confirm candidates behave according to visible rendering.

## 10. Preserve existing behavior

Do not regress:

- selection cycling order for visible candidates;
- coordinate anchor show/hide and priority;
- layer filtering;
- braiding marker clicks;
- geometry handle interactions;
- SVG rendering;
- TikZ/export;
- save/load;
- undo/redo.

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
- root cause of hidden auto-visibility objects appearing in cycling;
- how visibility/occlusion state is passed to candidate collection;
- point exclusion behavior;
- label exclusion behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
