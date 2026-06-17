# Phase 16F Fix Prompt: Functional updater layer operations and ARIA cleanup

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

## Context

You are working on the StratifiedTikZ project.

Phase 16F implemented Layer Manager polish and regression hardening.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority issue remains.

## Medium issue

In `src/App.tsx`, the App-level layer operation handlers compute `result` / `nextDiagram` from the render-captured `editableDiagram` before entering `setEditorState`.

Affected operations include:

- `duplicateDiagramLayer`;
- `swapDiagramLayers`;
- `translateDiagramLayer`;
- `deleteDiagramLayer`.

Problem:

- If layer operations are queued in the same React batch, or invoked from a stale render, the later operation can overwrite a newer `current.editableDiagram`.
- This can drop prior layer edits.
- This can record history from the wrong base diagram.
- This directly violates the Phase 16F combined-operation hardening goal.

Required fix:

- Compute diagram changes inside the functional `setEditorState` updater from `current.editableDiagram`.
- Preserve status messages from the actual committed result.
- Add focused test/helper coverage for queued or sequential combined layer operations.

## Low-priority issue

In `src/ui/LayerManager.tsx`, `LayerNameEditor` still renders `role="cell"` even though the Layer Manager changed from a table to a list.

Problem:

- This leaves an invalid ARIA role hierarchy.
- Remove the stale role or restore a proper table/grid structure.

Preferred fix:

- Remove the stale `role="cell"` unless there is a proper parent table/grid role.
- Keep accessibility semantics simple and valid.

## Goal

Fix Phase 16F so that App-level layer operation handlers are safe under React batching/stale renders, and clean up the stale ARIA role.

This is a targeted Phase 16F fix.

## Scope

Implement:

- functional-updater-safe App-level handlers for duplicate/swap/translate/delete layer operations;
- safe status propagation from the actual committed operation result;
- tests or helper coverage for queued/sequential layer operations;
- ARIA cleanup for `LayerNameEditor`.

Do not implement:

- new Layer Manager features;
- multi-selection;
- affine transforms;
- new geometry;
- new export features;
- broad UI redesign;
- new dependencies.

Do not change:

- layer operation semantics;
- layer metadata model;
- duplicate ID strategy;
- swap semantics;
- translate semantics;
- delete semantics;
- TikZ layer output semantics;
- save/load format;
- SVG rendering semantics;
- geometry model.

## 1. Inspect current App-level layer operation handlers

Inspect `src/App.tsx` around the layer operation handlers.

Look for patterns like:

```ts
const result = duplicateDiagramLayer(editableDiagram, ...);

setEditorState((current) => {
  return {
    ...current,
    editableDiagram: result.diagram,
    ...
  };
});
```

or:

```ts
const nextDiagram = deleteDiagramLayer(editableDiagram, ...);

setEditorState((current) => ({
  ...current,
  editableDiagram: nextDiagram,
}));
```

These are unsafe because `editableDiagram` is captured from the render, not from the latest `current.editableDiagram`.

## 2. Compute layer operation results inside functional updater

Update each affected handler so that diagram-changing layer operations are computed inside the `setEditorState` functional updater.

Required operations:

- duplicate layer;
- swap layers;
- translate layer;
- delete layer.

Preferred shape:

```ts
setEditorState((current) => {
  const result = duplicateDiagramLayer(current.editableDiagram, args);

  return {
    ...current,
    editableDiagram: result.diagram,
    selectedElement: clearSelectionIfNeeded(result.diagram, current.selectedElement),
    // other state updates derived from result/current
  };
});
```

Requirements:

- Use `current.editableDiagram` as the base diagram.
- Do not compute `result` from render-captured `editableDiagram`.
- Preserve undo/redo history behavior.
- Preserve selection clearing/validation behavior.
- Preserve layer filter validation behavior.
- Preserve status messages from the actual operation result.
- Preserve existing operation semantics.

If an operation can fail, handle failure inside the functional updater safely.

## 3. Preserve status messages from committed results

Some layer helpers may return status data such as:

- created target layer;
- number of duplicated elements;
- deleted element count;
- translated element count;
- error message;
- warning message.

Because results are now computed inside the updater, status messages must come from the actual result computed from `current.editableDiagram`.

Acceptable approaches:

### Option A: Store status inside editor state

If status is part of `EditorState`, set it inside the functional updater.

### Option B: Capture status in a local variable carefully

For example:

```ts
let nextStatus: string | null = null;

setEditorState((current) => {
  const result = operation(current.editableDiagram);
  nextStatus = result.status;
  return nextState;
});

if (nextStatus !== null) {
  setStatus(nextStatus);
}
```

However, be careful with React Strict Mode or repeated updater calls. Prefer storing status in state if existing architecture allows it.

### Option C: Use a helper that returns a complete editor-state patch

Extract a helper such as:

```ts
applyLayerOperationToEditorState(current, operationArgs): EditorState
```

This can be easier to test.

Choose the simplest safe approach consistent with existing App state architecture.

## 4. Preserve undo/redo history

Layer operations are diagram edits and must remain undoable.

Required:

- duplicate layer creates one undoable history entry;
- swap layer creates one undoable history entry;
- translate layer creates one undoable history entry;
- delete layer creates one undoable history entry;
- undo restores previous diagram;
- redo reapplies operation;
- history base must be the actual previous `current.editableDiagram`, not a stale captured diagram.

Do not push history entries for UI-only state changes.

## 5. Preserve selection and filter safety

After each operation:

### Duplicate layer

- existing selection can remain if still valid.
- if created duplicated layer is selected by operation, preserve existing behavior.
- layer filter should not hide newly selected duplicated items unless existing behavior intentionally does so.

### Swap layer

- selected element remains selected if it still exists.
- selected element layer may change.
- validate selection against layer filter / visibility / locking rules.

### Translate layer

- selected element remains selected if it still exists.
- geometry updates should be based on current diagram.

### Delete layer

- if selected element was deleted, clear selection.
- if layer filter targets deleted layer, validate or reset according to existing behavior.
- clear/validate stale draft/source/highlight state if existing code already does this.

Do not introduce stale selections.

## 6. Add focused tests / helper coverage

Add tests that would catch this stale-state bug.

If direct React batching tests are hard, extract pure helpers for applying layer operations to editor state and test those.

Required or strongly preferred tests:

### A. Sequential duplicate + translate uses latest diagram

Simulate two operations applied in sequence to editor state:

1. duplicate layer;
2. translate the duplicated or original layer.

Expected:

- translate sees the diagram after duplicate;
- duplicated elements are not lost;
- translation applies to the intended current diagram.

### B. Swap + delete uses latest diagram

Simulate:

1. swap layers;
2. delete one of the swapped layers.

Expected:

- delete operates on the post-swap diagram;
- no elements from stale pre-swap state reappear;
- metadata remains coherent.

### C. Duplicate + delete does not resurrect stale state

Simulate:

1. duplicate a layer;
2. delete the original or duplicated layer.

Expected:

- result reflects both operations;
- no duplicated elements are lost or resurrected incorrectly.

### D. Undo history base is correct

If history helpers are testable:

- apply a layer operation;
- apply another layer operation;
- undo once;
- verify the diagram returns to the state after the first operation, not to an unrelated stale state.

### E. Status comes from actual committed result

If status helpers are testable:

- ensure status message reflects the result computed from the current diagram.

Existing model-level tests for duplicate/swap/translate/delete should continue to pass.

## 7. ARIA cleanup

Inspect `src/ui/LayerManager.tsx`, especially `LayerNameEditor`.

Current low-priority issue:

- `LayerNameEditor` renders `role="cell"` even though the Layer Manager changed from a table to a list.

Fix:

- remove `role="cell"` from `LayerNameEditor`; or
- restore a proper parent role hierarchy if the UI is intended to be a table/grid.

Preferred:

- remove the stale role.
- Use native semantics where possible.
- Keep labels/inputs accessible.

Do not make broad accessibility redesigns.

Add a small test only if existing UI tests support it.

## 8. Preserve existing behavior

Do not regress:

- layer metadata derivation;
- layer rename;
- layer swap;
- layer duplicate;
- layer delete;
- layer translation;
- layer visibility/locking;
- layer filter;
- creation layer;
- inspector layer editing;
- save/load;
- undo/redo;
- SVG preview;
- TikZ layer output;
- all geometry rendering;
- Layer Manager layout/scrolling fixes.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open Layer Manager.
2. Duplicate a layer.
3. Immediately translate the duplicated layer.
4. Confirm duplicate remains and translation applies.
5. Swap two layers.
6. Delete one swapped layer.
7. Confirm result matches the current post-swap state.
8. Undo once.
9. Confirm only the last operation is undone.
10. Redo.
11. Confirm it reapplies correctly.
12. Rename a layer.
13. Confirm rename still works.
14. Delete a layer with selected element.
15. Confirm stale selection is cleared.
16. Generate TikZ.
17. Confirm TikZ reflects the final layer state.
18. Inspect Layer Manager accessibility if possible and confirm no stale `role="cell"` warning from obvious markup.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Also run if available:

```bash
git diff --check
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of stale-state risk;
- which App handlers were changed;
- how each layer operation now uses `current.editableDiagram`;
- how status messages are preserved;
- how undo/redo base state is preserved;
- tests added/updated for queued/sequential operations;
- ARIA cleanup performed;
- test results;
- build results;
- remaining limitations.
