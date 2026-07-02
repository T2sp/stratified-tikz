# Phase 27B Fix Prompt: Template-path inline-node export boundary and stale segmentIndex cleanup

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

Phase 27B added path inline nodes/vertices exported as TikZ `node[pos=..., ...]`.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

## Medium issue 1: Template-path inline nodes are accepted but silently dropped in TikZ export

Current problem:

- `curveInlineNodeSegmentCount()` allows inline nodes on `templatePath`.
- Model/UI can persist inline nodes on template paths.
- However, `emitTemplatePath(...)` and `emitTemplatePath3D(...)` emit `circle` / `ellipse` commands without appending `node[pos=...]`.
- Example probe:

```tex
\draw (...) circle[radius=1];
```

Expected if supported:

```tex
\draw (...) circle[radius=1] node[pos=0.5, ...] {...};
```

or an explicit rejection/fallback.

Actual:

```tex
\draw (...) circle[radius=1];
```

The inline node is silently dropped.

This violates the Phase 27B requirement that accepted/persisted inline nodes must be preserved in TikZ, or explicitly rejected/fallback-handled.

## Medium issue 2: Removing a segment from a concatenated path can leave stale inline-node segment references

Current problem:

- A concatenated path can have inline nodes with:

```ts
segmentIndex: 1
```

- If the last segment is removed and the path becomes one segment, the inline node remains with stale `segmentIndex: 1`.
- Validation then fails because the inline node references a non-existent segment.
- Review location:

```text
src/ui/pathEditing.ts
```

This violates save/model consistency after path editing.

## Goal

Fix Phase 27B inline-node edge cases.

Specifically:

1. Template-path inline nodes must not be silently dropped.
2. Choose one explicit policy:
   - support/export template-path inline nodes; or
   - reject template-path inline nodes in validation/UI with a clear message.
3. Concatenated-path segment removal must prune or remap inline nodes so no stale `segmentIndex` remains.
4. Add focused tests for both issues.
5. Preserve ordinary polyline/cubic/concatenated path inline-node behavior.

Preferred policy for template paths:

```text
If TikZ syntax can preserve node[pos=...] on circle/ellipse template commands reliably, implement export support.
Otherwise, explicitly reject template-path inline nodes in validation and UI.
```

Do not keep the current behavior where the model accepts template inline nodes but TikZ drops them.

## Scope

This is a targeted Phase 27B fix.

Implement:

- template-path inline-node export or rejection;
- validation/UI consistency for template-path inline nodes;
- inline-node cleanup/remap during concatenated-path segment removal;
- regression tests.

Do not implement:

- new path template types;
- new inline-node model features beyond what is needed;
- path splitting;
- broad path editor rewrite;
- new dependencies;
- new TikZ export modes.

Do not change:

- ordinary path inline-node export for polylines/cubics/concatenated paths;
- inline-node save/load for supported path kinds;
- coordinateRef path export;
- arrows;
- braiding;
- auto-visibility fallback behavior except if template inline nodes require explicit fallback;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## Part 1: Template-path inline-node support boundary

### 1. Inspect template path model and exporters

Inspect:

- `src/model/pathInlineNodes.ts`;
- `curveInlineNodeSegmentCount(...)`;
- template-path validation;
- template-path inline-node UI;
- `emitTemplatePath(...)`;
- `emitTemplatePath3D(...)`;
- template path TikZ tests;
- save/load tests for inline nodes.

Find where `templatePath` is considered inline-node eligible and where export omits the nodes.

### 2. Choose and implement one policy

#### Option A: Export template-path inline nodes

Implement only if verified valid for both 2D and 3D template path export.

Expected behavior:

- A circle/ellipse template path with inline node emits a TikZ path containing `node[pos=...]`.
- Multiple inline nodes emit all nodes in deterministic order.
- Inline node options/text are escaped/formatted by the same helpers used for ordinary paths.
- Inline output has no blank lines.
- 4-space indentation preserved.
- Auto-visibility/sampled export paths either preserve nodes or explicitly fall back with comment.

Potential output concept:

```tex
\draw[style] (0,0) circle[radius=1] node[pos=0.5, above] {$x$};
```

or another valid TikZ syntax confirmed by tests / existing conventions.

For 3D template paths, ensure the local/canvas/tdplot scope does not make `node[pos=...]` invalid.

If there is uncertainty about TikZ validity, choose Option B.

#### Option B: Reject template-path inline nodes

Preferred if export support is not clearly valid.

Implement:

- `curveInlineNodeSegmentCount(templatePath)` returns `0` or otherwise signals inline nodes unsupported.
- Validation rejects inline nodes attached to `templatePath`.
- UI does not offer Add inline node for template paths.
- Save/load rejects template-path inline nodes with a clear error.
- If existing saved diagrams from this subphase could contain them, consider migration only if needed; otherwise reject is acceptable.

Error example:

```text
Inline nodes are not currently supported on circle/ellipse template paths.
```

Requirement:

- no accepted template-path inline node should silently disappear from TikZ.

### 3. Keep supported paths unchanged

Ensure inline nodes still work for:

- ordinary line/polyline paths;
- cubic paths;
- concatenated paths;
- path segments where current tests pass.

## Part 2: Clean inline nodes when removing concatenated-path segments

### 4. Inspect segment removal logic

Inspect:

- `src/ui/pathEditing.ts`;
- segment removal helpers;
- inline-node validation helpers;
- tests for removing path segments;
- undo/redo path edit tests.

Review location:

```text
pathEditing.ts around segment removal
```

The bug is stale inline-node `segmentIndex` after removing a segment.

### 5. Define segment removal inline-node policy

When removing segment at index `i` from a concatenated path:

For every inline node attached by segment index:

```text
node.segmentIndex < i:
  keep unchanged

node.segmentIndex === i:
  remove/prune the inline node

node.segmentIndex > i:
  decrement segmentIndex by 1
```

This is the safest MVP.

Alternative for nodes on the removed segment:

- remap to adjacent segment if semantically meaningful.
- This is more complex and not required.

Preferred MVP:

```text
Inline nodes on removed segments are pruned.
```

Also handle global-position inline nodes if the model supports them:

- If inline node uses global path position, either recompute/remap based on new path length or prune if affected.
- If global positions are not currently used, document not applicable.

Requirements:

- no inline node references a segment index >= new segment count;
- path remains valid;
- removed nodes no longer export;
- undo/redo restores previous path and inline nodes.

### 6. Removing last segment / empty path behavior

If removing the last remaining segment is allowed:

- decide whether the path becomes invalid/deleted or removal is rejected.
- Inline nodes should be removed with the segment.
- No invalid saved model state should remain.

If the UI prevents deleting the last segment, test that too.

The reported case is "removing the last segment from a multi-segment path leaves stale node on removed segment." Fix that at minimum.

## Tests

### Template-path inline-node tests

Depending on chosen policy:

#### If exporting template-path inline nodes

1. Circle template path with inline node exports `node[pos=...]`.

2. Ellipse template path with inline node exports `node[pos=...]`.

3. 3D template path with inline node exports or falls back explicitly while preserving node.

4. Multiple inline nodes on template path export deterministically.

5. Inline output has no blank lines.

6. No old probe output with dropped node remains.

#### If rejecting template-path inline nodes

1. `curveInlineNodeSegmentCount(templatePath)` or equivalent marks template paths as unsupported.

2. Validation rejects inline node attached to template path.

3. UI helper does not offer Add inline node for template path.

4. Save/load with template-path inline node returns `ok:false`.

5. Error message says template path inline nodes are unsupported.

6. Ordinary template path without inline nodes still exports as before.

### Segment removal cleanup tests

7. Removing segment before an inline node decrements later node `segmentIndex`.

Example:

```text
segments: 0,1,2
node on segment 2
remove segment 1
=> node.segmentIndex becomes 1
```

8. Removing a segment that contains an inline node prunes that node.

9. Removing the last segment from a multi-segment path prunes inline nodes on that removed segment.

10. After segment removal, validation passes.

11. No inline node has stale `segmentIndex`.

12. Undo restores removed segment and inline nodes.

13. Redo removes segment and prunes/remaps nodes again.

14. TikZ export after segment removal contains only remaining valid inline nodes.

### Regression tests

15. Ordinary polyline inline-node export still works.

16. Cubic inline-node export still works.

17. Concatenated path inline-node export still works.

18. CoordinateRef path with inline node still exports both refs and node.

19. Arrow path with inline node still exports arrows and node.

20. Inline math output remains blank-line-free.

21. 4-space indentation preserved.

## Implementation guidance

### Avoid silent drops

The key invariant:

```text
If an inline node is accepted by model/validation/UI, TikZ export must preserve it or explicitly fallback with comment.
```

Do not add another path where accepted inline nodes disappear from output.

### Keep validation and UI aligned

If template nodes are unsupported:

- validation rejects;
- UI does not offer;
- save/load rejects.

If template nodes are supported:

- validation accepts;
- UI offers;
- TikZ exports.

### Prune/remap inline nodes close to segment mutation

The safest place to update inline nodes is in the same helper that removes the segment.

Do not rely on validation to catch stale nodes after mutation.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual checks if practical:

1. Create a circle/ellipse template path.
2. Try adding an inline node.
3. Confirm either:
   - node exports as `node[pos=...]`; or
   - UI/validation rejects with clear message.
4. Create a two-segment concatenated path.
5. Add inline node to second segment.
6. Remove second segment.
7. Confirm no validation error.
8. Confirm node is removed.
9. Undo/redo.

## Preserve existing behavior

Do not regress:

- existing path inline nodes;
- SVG preview for inline nodes;
- inline-node Inspector editing;
- path editing;
- arrows;
- coordinate refs;
- braiding;
- save/load;
- undo/redo;
- TikZ output;
- inline no-blank-lines;
- 4-space indentation.

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
- chosen template-path inline-node policy:
  - exported; or
  - rejected;
- TikZ behavior for circle/ellipse templates;
- validation/UI behavior for template paths;
- segment removal inline-node pruning/remap policy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
