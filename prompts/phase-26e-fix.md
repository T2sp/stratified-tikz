# Phase 26E Fix Prompt: Make Coordinate Inspector deletion detach-aware

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

Phase 26E integrates coordinate anchors with editing, snapping, selection, and layer operations.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority issue remains.

## Medium issue

Referenced coordinate deletion is inconsistent across UI paths.

Current behavior:

- Toolbar delete / Delete-key path uses detach-aware bulk delete.
- Inspector still disables `Delete coordinate` when:

```ts
referenceCount > 0
```

- Inspector still calls:

```ts
deleteUnusedCoordinateAnchor(...)
```

which rejects referenced coordinate anchors.
- This contradicts the Phase 26 requirement:

```text
Deleting a referenced coordinate should detach references rather than block forever.
```

Review locations:

```text
src/ui/inspector/EditableInspector.tsx
src/ui/coordinateAnchorEditing.ts
```

The old behavior was:

```text
Referenced coordinate anchors cannot be deleted.
```

The required behavior is now:

```text
Referenced coordinate anchors can be deleted.
All references are detached first.
Then the coordinate anchor is removed.
```

## Low-priority issue

`Hide Coordinates` only hides marker rendering.

Hidden coordinate anchors still contribute to fit-to-view framing through unconditional:

```ts
coordinateAnchorPreviewPoints(diagram)
```

in `SvgDiagram.tsx`.

A far-away hidden anchor can still shrink the visible diagram.

This is low priority, but it is safe to fix if local to the same UI state.

## Goal

Fix the coordinate Inspector delete behavior so it uses the same detach-aware coordinate deletion path as toolbar/Delete-key deletion.

Required:

1. Inspector must allow deleting referenced coordinate anchors.
2. Inspector delete must detach all references before removing the coordinate.
3. Inspector delete behavior must match toolbar/Delete-key behavior.
4. Tests that still expect referenced coordinate deletion to be blocked must be updated.
5. Existing toolbar/Delete-key detach-aware deletion must not regress.
6. Undo/redo must work.
7. No dangling `coordinateRef` metadata may remain.
8. TikZ output after deletion must not contain the deleted coordinate definition or `(tikzName)` references.
9. Former references should export concrete coordinates/sources.
10. Optionally, hidden coordinate anchors should not affect fit-to-view framing.

## Scope

This is a targeted Phase 26E fix.

Implement:

- detach-aware coordinate deletion from the Inspector;
- shared delete helper usage between Inspector and toolbar/Delete-key paths;
- updated tests;
- optional fit-to-view behavior correction for hidden coordinates.

Do not implement:

- new coordinate anchor model features;
- new coordinate reference fields;
- new reference manager UI;
- broad Inspector redesign;
- new layer semantics;
- new TikZ output mode;
- new dependencies.

Do not change:

- coordinate anchor global/non-layer-bound nature;
- coordinateRef supported locations;
- coordinateRef validation/export behavior when anchors exist;
- toolbar/Delete-key delete semantics except shared helper cleanup;
- layer translation detach behavior;
- save/load format;
- inline/standalone TikZ formatting;
- SVG marker appearance except optional fit-to-view behavior.

## 1. Inspect current delete paths

Inspect:

- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/coordinateAnchorEditing.ts`;
- toolbar delete handler;
- Delete-key handler;
- bulk delete helper;
- detach-aware coordinate deletion helper from Phase 26C/26I if already present;
- tests that mention referenced coordinate deletion.

Find the mismatch:

```text
toolbar/Delete-key:
  detach-aware bulk delete

Inspector:
  disables Delete coordinate if referenceCount > 0
  calls deleteUnusedCoordinateAnchor
```

The Inspector path must stop using the old unused-only deletion path for normal delete.

## 2. Create or reuse a single detach-aware coordinate delete helper

Prefer one shared helper used by all UI paths.

Suggested API:

```ts
deleteCoordinateAnchorWithDetach(
  diagram: Diagram,
  coordinateId: string
): Result<{
  diagram: Diagram;
  detachedCount: number;
  deletedCoordinateName: string;
}, ValidationError>
```

or equivalent.

If the existing bulk delete helper already supports coordinate detach correctly, either:

- call it from Inspector for a single coordinate; or
- extract the coordinate detach/delete logic into a shared model/UI helper used by both.

Requirements:

- detach all refs to the coordinate using current coordinate anchor position/source;
- remove the coordinate anchor;
- return detached reference count for status;
- no dangling refs;
- operation atomic;
- no partial mutation if detach fails.

## 3. Update Inspector UI behavior

### Delete button state

Change the Inspector behavior:

Old:

```text
Delete coordinate disabled when referenceCount > 0
```

New:

```text
Delete coordinate enabled even when referenceCount > 0
```

If referenced, the UI should communicate that refs will be detached.

Suggested button text or helper text:

```text
Delete coordinate
```

with small text:

```text
Used by 3 objects. Deleting will detach references.
```

or:

```text
Delete and detach references
```

If the existing UI pattern supports confirmation:

```text
Coordinate "A" is used by 3 objects. Detach references and delete?
[Cancel] [Detach and delete]
```

MVP acceptable:

- explicit delete button detaches automatically and shows status:

```text
Deleted coordinate "A" and detached 3 references.
```

Choose one policy and test/report it.

### Inspector handler

Update the Inspector delete action to call the detach-aware helper.

Do not call:

```ts
deleteUnusedCoordinateAnchor(...)
```

for normal coordinate delete.

If `deleteUnusedCoordinateAnchor` is still useful internally, rename or restrict it to avoid accidental use in the UI.

## 4. Update coordinateAnchorEditing helpers

Review `coordinateAnchorEditing.ts`.

Likely changes:

- keep a pure helper for unused-only delete if tests need it;
- add a detach-aware delete helper;
- update exported functions so Inspector uses the detach-aware one;
- update names to reduce confusion.

Suggested naming:

```ts
deleteCoordinateAnchorWithDetach(...)
deleteUnusedCoordinateAnchor(...) // internal/legacy, not Inspector default
```

or:

```ts
removeCoordinateAnchor(...)
```

where the default behavior is detach-aware.

## 5. Update tests that expected deletion to be blocked

Find tests that assert referenced coordinate deletion is disabled/rejected.

Update them to the new requirement.

New expected behavior:

- referenced coordinate delete succeeds;
- references are detached;
- coordinate is removed;
- no dangling refs remain;
- undo/redo restores state if applicable.

## 6. Required tests

Add or update focused tests.

### Inspector delete tests

1. Inspector shows usage count for referenced coordinate.

2. Inspector delete button is enabled for referenced coordinate.

3. Inspector delete action detaches references and removes coordinate.

4. Inspector delete action returns/statuses detached count.

5. Inspector delete action clears coordinate selection or updates selection safely.

6. Inspector delete action uses same semantics as toolbar/Delete-key delete.

### Detach behavior tests

7. Referenced path endpoint detaches to concrete coordinate.

8. Referenced label position detaches.

9. Referenced point position detaches if supported.

10. Referenced simple sheet vertex detaches if supported.

11. Detached symbolic coordinate preserves symbolic expression where supported.

12. Detached work-plane-local coordinate preserves local source/frame where supported or uses documented fallback.

13. No dangling `coordinateRef` to deleted coordinate remains.

14. `validateDiagram(...)` passes after Inspector deletion.

### TikZ tests

15. TikZ output no longer contains:

```tex
\coordinate (A)
```

for the deleted coordinate.

16. TikZ output no longer contains:

```tex
(A)
```

references to the deleted coordinate.

17. Former references export concrete coordinates/sources.

18. Inline output has no blank lines.

19. 4-space indentation preserved.

### Undo/redo tests

20. Undo Inspector delete restores coordinate and refs.

21. Redo Inspector delete detaches/removes again.

### Regression tests

22. Toolbar delete still detaches references.

23. Delete-key delete still detaches references.

24. Bulk delete still detaches references.

25. Deleting unused coordinate still works.

26. Existing coordinateRef validation/export tests still pass.

## 7. Optional Low-priority fix: hidden coordinates and fit-to-view

If straightforward, fix the low-priority issue too.

Current issue:

```text
Hide Coordinates hides marker rendering, but hidden anchors still contribute to fit-to-view framing.
```

Required optional behavior:

- if coordinate anchors are hidden, they should not contribute to automatic fit-to-view / preview bounding box calculations;
- if coordinate anchors are shown, they may contribute to fit-to-view;
- coordinate references still affect geometry, so referenced objects still contribute through their actual geometry.

Implementation idea:

- pass coordinate visibility state into the preview-bounds calculation;
- include `coordinateAnchorPreviewPoints(diagram)` only when coordinates are shown;
- keep TikZ/export unaffected.

Tests if implemented:

27. Hidden far-away coordinate anchor does not affect fit-to-view bounds.

28. Shown far-away coordinate anchor does affect bounds, if that is the chosen policy.

29. Coordinate references still affect bounds via referencing geometry.

This is Low-priority, so do not let it delay the Medium issue fix if it becomes invasive.

## 8. Error and status messages

Good status examples:

```text
Deleted coordinate "A".
```

```text
Deleted coordinate "A" and detached 3 references.
```

Good error example:

```text
Could not delete coordinate "A": failed to detach reference in path "f".
```

Avoid:

```text
Coordinate is referenced and cannot be deleted.
```

except if a truly unsupported detach failure occurs.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual Inspector test:

1. Create coordinate anchor `A`.
2. Create path endpoint referencing `A`.
3. Select coordinate `A`.
4. Confirm Inspector shows usage count.
5. Confirm Delete coordinate is enabled.
6. Click Delete coordinate.
7. Confirm coordinate disappears.
8. Confirm path remains visually in place.
9. Confirm no dangling ref.
10. Generate TikZ.
11. Confirm `\coordinate (A)` is gone.
12. Confirm `(A)` references are gone.
13. Undo.
14. Confirm coordinate and `(A)` references return.
15. Redo.
16. Confirm detach/delete happens again.

Optional fit test:

17. Create far-away coordinate.
18. Hide coordinates.
19. Fit view.
20. Confirm far-away hidden coordinate does not shrink the visible diagram.

## 10. Preserve existing behavior

Do not regress:

- toolbar delete;
- Delete-key delete;
- bulk delete;
- coordinateRef validation;
- coordinateRef export when anchor exists;
- coordinate anchor definitions;
- coordinate show/hide marker behavior;
- layer translation detach;
- save/load;
- undo/redo;
- inline no-blank-lines;
- 4-space indentation;
- SVG preview;
- TikZ generation.

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
- root cause of inconsistent Inspector deletion;
- shared detach-aware delete helper used/added;
- Inspector delete UI behavior;
- confirmation/status policy;
- tests updated from old blocked-delete behavior;
- optional fit-to-view hidden-coordinate behavior, if implemented;
- test results;
- build results;
- remaining limitations.
