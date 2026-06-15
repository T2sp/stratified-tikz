# Phase 10E Review Prompt: One-step undo

Review Phase 10E only: one-step undo for diagram-editing operations.

Do not modify files yet.

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

- `Diagram` contains persistent diagram data.
- Selection, highlighting, active tools, draft geometry, active work plane, layer filter, coordinate input mode, and undo state are UI/editor state.
- UI/editor state should not be saved into JSON export or exported to TikZ.
- Phase 9B TikZ layer ordering convention is intentional:
  - numeric layer order;
  - codimension / element-kind section order within each layer;
  - original order within each section.
- Do not report the Phase 9B codimension section ordering convention as an issue in this review.

## Phase 10E intended behavior

Phase 10E should add minimal one-step undo.

Expected:

- A visible Undo control exists.
- Undo is disabled or inert when there is no undo snapshot.
- One committed diagram edit can be undone.
- Only one previous diagram state is stored.
- Undo is not multi-step.
- Redo is not implemented.
- Undo state is editor/UI state only.
- JSON export does not include undo history.
- TikZ output does not depend on undo state.
- UI-only changes do not create undo snapshots.
- Undo leaves selection/drafts safe and non-stale.

## Review scope

Review only Phase 10E.

Do not require:

- redo
- multi-step history
- persistent history across reloads
- command palette
- timeline UI
- new dependencies
- unrelated refactors
- changes to TikZ semantics
- changes to diagram schema unless unavoidable

## Checklist

### 1. Scope control

Check that the implementation is limited to one-step undo and supporting tests/docs.

Flag as Medium or Critical if it introduces unrelated features such as:

- redo
- multi-step history beyond one previous diagram
- major architecture rewrite without need
- new dependencies
- unrelated TikZ output changes
- unrelated geometry/model/schema changes
- unrelated save/load format changes

### 2. Undo state location

Check that undo state is stored as UI/editor state, not in `Diagram`.

Expected:

- undo snapshot stores a previous `Diagram` value or equivalent
- undo state is not exported to TikZ
- undo state is not saved in JSON
- undo state does not affect diagram validation

Flag if undo data is added to persistent diagram schema without a strong reason.

### 3. One-step semantics

Verify true one-step undo semantics.

Expected example:

- initial diagram: `A`
- edit to `B`
- edit to `C`
- undo restores `B`
- a second undo does not restore `A`

Flag if implementation accidentally creates unbounded multi-step history, or if one-step undo does not work reliably.

### 4. Diagram mutation coverage

Inspect all diagram mutation paths.

Check likely paths:

- inspector edits
- stratum name/layer edits
- coordinate edits
- style edits
- label edits
- cursor creation tools
- direct-input creation tools, if present
- remove/delete selected, if present
- JSON load/import handling
- drag handle editing, if present

Expected:

- committed diagram mutations are undo-aware
- UI-only state changes are not undo-aware

Flag as Medium if an important committed editing path bypasses undo.

Flag as Low if a minor edge path bypasses undo but is documented and not central.

### 5. UI-only state does not create undo snapshots

Check that the following do not create undo history:

- selecting an element
- clearing selection
- changing layer filter
- changing active tool
- changing coordinate input mode
- changing active work plane
- changing draft geometry before commit

Flag if selection/tool changes consume the one undo slot.

### 6. Drag editing behavior

If Phase 10D drag editing exists, check undo behavior around dragging.

Preferred:

- one undo snapshot per completed drag operation, not per mousemove

Acceptable for Phase 10E if clearly implemented and documented:

- drag editing is covered by a commit boundary if available
- if the current drag architecture cannot distinguish commit boundaries, implementation chooses the least surprising behavior and reports the limitation

Flag as Medium if dragging creates many intermediate undo states or makes undo unusable.

### 7. Selection and draft safety after undo

Check that undo cannot leave stale references.

Expected:

- selected element still exists -> selection may stay
- selected element no longer exists -> selection is cleared
- active drafts are cancelled or made safe if inconsistent
- inspector does not show stale element data
- preview does not crash

Flag if undo can leave the app in a broken state.

### 8. Save/load behavior

Check the chosen policy.

Acceptable policies:

- loading a diagram is undoable as a committed diagram replacement; or
- loading clears undo history for safety

Either is fine if documented and consistent.

Required:

- JSON export does not include undo state
- JSON import does not require undo state
- import/load leaves selection/drafts safe

### 9. Keyboard shortcut

Check whether `Cmd+Z` / `Ctrl+Z` is implemented.

It is desirable but not required if omitted with a reasonable limitation note.

If implemented:

- should not break normal text/numeric input editing
- should not fire repeatedly in surprising ways
- should respect disabled/no-history state

Flag as Medium if the shortcut breaks native input editing.

### 10. Tests

Check that tests cover the core behavior.

Expected tests:

- undo restores previous diagram after a simple committed edit
- undo is one-step, not multi-step
- UI-only state changes do not create undo snapshots
- stale selection is cleared or sanitized after undo
- undo state is not included in JSON export, if existing test infrastructure makes this feasible

Flag as Medium if there are no meaningful tests for undo behavior.

Flag as Low if tests are present but miss a secondary edge case.

### 11. Documentation

Check that documentation is updated if an appropriate docs file exists.

Expected concise docs:

- one-step undo exists
- undo state is editor state only
- redo and multi-step history are future work

Do not require extensive docs.

### 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Report both results.

## Severity guidance

Critical issues:

- app cannot build
- tests cannot run due to implementation errors
- undo corrupts persistent diagram data
- undo breaks core editing or preview rendering
- JSON save/load schema is unintentionally broken
- TikZ generation is unintentionally changed or broken

Medium issues:

- important committed edit path is not undoable
- undo is accidentally multi-step or not one-step
- undo state is stored in persistent diagram data
- UI-only actions consume undo history
- stale selection after undo can crash inspector/preview
- keyboard shortcut breaks text/numeric input editing
- drag undo creates unusable many-step behavior
- missing meaningful tests for the feature

Low-priority issues:

- minor UX wording issues
- missing shortcut when button works and limitation is documented
- small documentation gaps
- minor edge path not covered if central paths work

## Output format

Return a human-readable review followed by a machine-readable JSON block exactly in this form:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Rules:

- Set `ready_to_commit` to `false` if there are any Critical or Medium issues.
- Set `summary` to `needs_changes` if there are any Critical or Medium issues.
- Include a concise `suggested_fix_prompt` when `ready_to_commit` is false.
- Do not modify files during this review.
