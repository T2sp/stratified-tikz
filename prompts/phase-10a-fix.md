# Phase 10A — Fix Instructions

## Summary

Phase 10A is mostly implemented correctly, and both required verification commands pass. There is one Medium issue around layer-filter state after deletion.

Fix Phase 10A deletion so that removing an element normalizes `layerFilter` against the updated diagram, add a focused regression test, then rerun test and build.

## Issue to Fix

### Medium Issue

In `src/App.tsx`, deletion removes an element from `editableDiagram` but leaves `current.layerFilter` unchanged.

If the user filters to a layer and deletes the only element on that layer, `availableLayers` no longer contains the selected layer, but the UI state still points at it. This can leave the layer dropdown with a non-matching value and make the preview hide all remaining diagram elements.

Existing behavior already defines that missing layer filters should reset to all layers in:

```text
src/ui/layerFilter.ts
```

Therefore, removal should normalize the filter after changing diagram data.

## Required Fix

When deleting the selected element:

1. compute the updated diagram first;
2. normalize the current `layerFilter` against that updated diagram;
3. store the normalized filter in state together with the updated diagram;
4. ensure stale selection and associated labels/strata cleanup still behave as before.

The fix should be local and should reuse the existing layer-filter normalization helper from `src/ui/layerFilter.ts` rather than duplicating that logic.

## Suggested Implementation Target

Look at the deletion logic in:

```text
src/App.tsx
```

especially around the existing selected-element removal handler.

The intended behavior is:

```text
delete selected element
→ updated editableDiagram no longer contains that element
→ available layers are recomputed from the updated diagram
→ if current.layerFilter no longer exists, reset to all layers
→ preview remains non-empty if other diagram elements remain
→ dropdown value remains valid
```

## Required Test

Add a focused test for the regression:

1. start with a diagram containing at least two layers;
2. set `layerFilter` to a layer that contains exactly one element;
3. delete that element;
4. assert that the resulting filter is normalized to all layers, or to the project’s canonical all-layers value;
5. assert that remaining elements are visible in preview state if the relevant test utilities expose that behavior.

Prefer placing the test near existing Phase 10A deletion tests or layer-filter tests.

Relevant existing files to inspect:

```text
src/ui/layerFilter.ts
src/ui/diagramUpdates.ts
src/App.tsx
```

## Preserve Existing Correct Behavior

Do not regress the following Phase 10A behavior:

1. The “Remove selected” control exists.
2. It is disabled when there is no selection.
3. Strata, labels, and stale selections are cleaned up on deletion.
4. Delete/Backspace ignores editable targets.
5. TikZ is generated from `editableDiagram` only.
6. Selection, filter, and drafts are preview/editor state only.
7. Serialization still stores only `Diagram`.

## Verification Commands

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

The previous review observed:

```text
npm test: 181 tests, 0 failures
npm run build: passed
```

After the fix, both commands should still pass, with the new regression test included.

## Acceptance Criteria

The fix is complete only if:

1. deleting the only element on the active filtered layer resets the layer filter to all layers;
2. the layer dropdown no longer points at a missing layer;
3. remaining diagram elements are not accidentally hidden by a stale filter;
4. existing deletion behavior remains unchanged;
5. a focused regression test is added;
6. `npm test` and `npm run build` pass.

## Final Report Format

When done, report:

```markdown
# Phase 10A Fix Report

## Summary

Briefly describe the fix.

## Files Changed

List changed files.

## Tests Added

Describe the focused regression test.

## Verification

List commands run and results.

## Notes

Mention any limitations or intentionally unchanged behavior.
```
