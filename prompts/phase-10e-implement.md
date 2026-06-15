# Phase 10E Implementation Prompt: One-step undo

Implement Phase 10E only: one-step undo for diagram-editing operations.

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

when running npm commands.

Verification commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Context

This project is StratifiedTikZ, a Vite + React + TypeScript app for drawing 2D and 3D stratified diagrams and exporting TikZ.

Important conventions:

- `ambientDimension: 2 | 3` is top-level on `Diagram`.
- All internal coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should remain `0`.
- `n`-stratum means codimension `n`, not dimension.
- Selection, highlighting, active tools, draft geometry, active work plane, layer filter, and coordinate input mode are UI/editor state and should not be saved into `Diagram` or exported to TikZ.
- Free text labels are first-class objects in `diagram.labels`.
- TikZ output is generated from diagram data only.

Current relevant phases:

- Phase 8: save/load implemented.
- Phase 9A: TikZ coordinate names use sanitized user-controlled name stems.
- Phase 9B: layer-aware TikZ output implemented.
  - Phase 9B ordering convention:
    - numeric layer order;
    - codimension / element-kind section order within each layer;
    - original order within each section.
  - Do not change this convention in Phase 10E.
- Phase 9C: layer-based selection/filtering may be implemented before this phase.
- Phase 9D: `spath/save` integration may be implemented before this phase.
- Phase 10A: remove selected elements may be implemented before this phase.
- Phase 10B: direct-input creation for points and labels may be implemented before this phase.
- Phase 10C: direct-input creation for paths and sheets may be implemented before this phase.
- Phase 10D: cursor drag handle editing may be implemented before this phase.

## Goal

Add a minimal, reliable, one-step undo feature.

The user should be able to undo the immediately preceding committed diagram-editing operation.

This is intentionally not a full multi-step history system.

## Required behavior

Implement one-step undo for committed diagram changes.

Examples of operations that should be undoable if they exist in the current codebase:

- editing stratum name
- editing stratum layer
- editing stratum coordinates
- editing stratum style
- editing free text label text
- editing free text label position
- editing free text label style
- creating a point
- creating a label
- creating a polyline curve
- creating a cubic Bézier curve
- creating a polygon sheet
- removing selected elements
- direct-input creation operations
- drag handle edits, once a drag is committed
- loading a diagram, if the app currently replaces the diagram through load

The undo operation should restore the previous `Diagram` value.

Selection and draft/UI state should be made safe after undo.

Recommended behavior:

- After undo, clear stale selection if the selected element no longer exists.
- Cancel active drafts if undo would make them inconsistent.
- Do not store selection, draft geometry, layer filter, coordinate input mode, active work plane, or creation tool state in the undo snapshot.
- Do not export undo state to TikZ.
- Do not save undo state in JSON export.

## Non-goals

Do not implement:

- redo
- multi-step history
- persistent history across save/load
- keyboard shortcut customization UI
- timeline UI
- command palette
- collaborative editing
- diff UI
- new dependencies
- changes to TikZ output semantics
- changes to diagram schema unless unavoidable

## UX requirements

Add a visible Undo control to the UI.

Expected UX:

- A toolbar button labeled `Undo` or similar.
- The button is disabled when there is no undo snapshot.
- Clicking the button restores the previous diagram.
- The app remains usable after undo.

Keyboard shortcut:

- Add `Cmd+Z` on macOS and `Ctrl+Z` on non-macOS if straightforward.
- Do not let the shortcut break text/numeric input editing.
- If an input or textarea is focused, native browser undo for that field should take priority where practical.
- If shortcut support is risky or intrusive, implement the button first and document the limitation.

## Implementation guidance

Prefer a small, explicit state helper rather than a large architecture rewrite.

A good pattern is:

```ts
const [diagram, setDiagram] = useState<Diagram>(...);
const [undoDiagram, setUndoDiagram] = useState<Diagram | null>(null);

function commitDiagramChange(nextDiagram: Diagram) {
  setUndoDiagram(diagram);
  setDiagram(nextDiagram);
}

function undoLastChange() {
  if (!undoDiagram) return;
  setDiagram(undoDiagram);
  setUndoDiagram(null);
  // Clear or sanitize selection/drafts if needed.
}
```

However, use React functional updates if necessary to avoid stale closure bugs.

Important:

- Ensure all diagram-mutating paths use the same commit helper.
- Avoid pushing undo snapshots for UI-only changes.
- Avoid pushing undo snapshots when the diagram did not actually change.
- If an edit consists of many intermediate updates, such as dragging, prefer storing one undo snapshot for the committed drag operation rather than one per mousemove.
  - If Phase 10D has a clear drag commit boundary, use it.
  - If not, implement the least surprising behavior and document it.

## Diagram mutation coverage

Inspect the current codebase for all places where `setDiagram`, diagram update helpers, creation helpers, deletion helpers, load/import handlers, or drag-edit handlers are used.

Route committed diagram mutations through a single undo-aware helper where feasible.

At minimum, cover:

- inspector edits
- cursor creation tools
- direct-input creation tools if present
- delete/remove selected if present
- JSON load/import if it replaces the diagram
- drag handle editing if present

If a mutation path is intentionally not covered, explain why in the implementation report.

## Save/load behavior

Undo history is editor state, not diagram data.

Requirements:

- JSON export should not include undo state.
- JSON import should not require undo state.
- Importing/loading a diagram should leave the app in a safe state.

Recommended:

- Treat loading a diagram as an undoable committed diagram replacement when practical.
- Alternatively, clear undo history on load if that is safer; document the chosen behavior.

Choose one clear policy and test it if feasible.

## Selection and stale references

After undo:

- If the selected stratum/label still exists, selection may be preserved.
- If it no longer exists, selection must be cleared.
- Draft geometry should be cancelled if it could refer to stale diagram state.
- The preview should not crash.
- The inspector should not show stale data.

## Tests

Add focused tests for undo behavior.

Depending on the existing test setup, use the most appropriate layer:

- pure helper tests for undo/history helpers if introduced;
- React component tests if existing UI tests already cover toolbar interactions;
- focused unit tests for selection sanitization helpers if introduced.

Required coverage:

1. One-step undo restores previous diagram after a simple committed edit.

Example:

- start with point name `A`
- edit to `B`
- undo
- name is `A`
- undo is no longer available

2. Undo snapshot is replaced by the latest committed change, not accumulated as multi-step history.

Example:

- start with name `A`
- edit to `B`
- edit to `C`
- undo
- name is `B`
- another undo does nothing

This verifies one-step undo semantics.

3. UI-only state changes do not create undo snapshots.

Example candidates:

- selecting an element
- changing layer filter
- changing creation tool
- changing coordinate input mode
- changing active work plane

Use whatever is easiest and stable in the current codebase.

4. Undo clears stale selection or keeps only valid selection.

Example:

- create or remove an element
- undo
- selected element should not refer to a non-existing stratum/label

5. JSON export/import does not include undo state.

If existing tests already verify saved JSON shape, update or add a small test to ensure undo state remains UI-only.

## Documentation

Update documentation if there is a relevant UI or roadmap document.

At minimum, add a concise note to an appropriate docs file, if one exists:

- Phase 10E adds one-step undo.
- Undo stores only the previous `Diagram` value.
- Undo history is editor state and is not exported to TikZ or JSON.
- Redo and multi-step history are future work.

Do not over-document.

## Scope control

Do not modify unrelated files unless necessary.

Expected likely files:

- UI/App/editor state files
- diagram update helper files if appropriate
- tests
- docs

Avoid unrelated formatting churn.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Report after implementation

Please report:

- files modified
- where undo state is stored
- how committed diagram changes are routed through undo
- which mutation paths are covered
- which mutation paths, if any, are intentionally not covered
- how stale selection/drafts are handled after undo
- whether `Cmd+Z` / `Ctrl+Z` was implemented
- chosen save/load undo policy
- tests added or updated
- documentation updated
- test results
- build results
- remaining limitations
