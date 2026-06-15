Phase 10E Review Prompt: Multi-step undo/redo history

Environment

The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

when running npm commands.

Verification commands:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Review instructions

Review Phase 10E only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between REVIEW_JSON_START and REVIEW_JSON_END.

If there are any Critical or Medium issues, set:

"ready_to_commit": false

If only Low-priority issues remain, set:

"ready_to_commit": true

Phase 10E goal

Phase 10E should implement multi-step undo/redo history.

It is not sufficient to support only one-step undo.

The user should be able to:

* undo many previous committed diagram changes;
* redo undone changes;
* use undo/redo toolbar controls;
* use keyboard shortcuts where appropriate.

Redo is the operation that cancels undo.

Core correctness requirements

Check that:

* history is editor/UI state only;
* history is not stored in Diagram;
* history is not saved to JSON;
* generated TikZ depends only on current committed diagram;
* undo/redo changes the committed diagram, not just UI status;
* selection/filter/drafts/direct form state are not stored as part of diagram history;
* history is bounded to a sufficiently large size, e.g. 100 states.

Scope review

Phase 10E should not add unrelated features.

It should not implement:

* collaborative history;
* persistent history in JSON;
* timeline panel;
* semantic command history UI;
* snapping;
* arbitrary work planes;
* region strata;
* TikZ import;
* new dependencies;
* broad UI redesign.

Classify unrelated features according to severity.

Functional review checklist

1. Multi-step undo

Check:

* more than one undo step works;
* at least several consecutive committed changes can be undone;
* undo restores previous diagram data exactly enough for editor use;
* undo availability is correctly reflected in UI disabled state.

If undo only supports one step, this is Medium.

If undo is present but does not restore diagram data correctly, this is Critical or Medium depending on severity.

2. Redo

Check:

* redo exists;
* redo restores undone states in forward order;
* redo availability is correctly reflected in UI disabled state;
* redo is cleared when a new edit is made after undo.

If redo is missing, classify as Medium because the user explicitly requested “undo cancel.”

3. History limit

Check:

* history is bounded;
* limit is sufficiently large, preferably around 100 states;
* no obvious unbounded memory growth for ordinary editing.

If history is unbounded, classify as Medium unless project has a clear reason.

4. Undoable diagram changes

Check that these committed diagram changes are undoable where implemented in the app:

* cursor-created point;
* cursor-created label;
* cursor-created polyline;
* cursor-created cubic Bézier;
* cursor-created polygon sheet;
* direct-created point;
* direct-created label;
* direct-created polyline;
* direct-created cubic Bézier;
* direct-created polygon sheet;
* inspector name/layer/coordinate edits;
* inspector style edits;
* delete/remove selected elements, if implemented;
* empty canvas switch, if implemented;
* JSON load/import, depending on chosen policy.

If major edit paths bypass history, classify as Medium.

If some obscure style field bypasses history but core behavior works, classify as Low or Medium depending on breadth.

5. Non-undoable UI-only changes

Check that these do not create history entries:

* selection change;
* layer filter change;
* creation tool change;
* coordinate input mode change;
* active work plane change;
* direct form text changes;
* draft vertex additions before finish;
* draft cancel;
* status message changes;
* copy TikZ.

If UI-only changes pollute history significantly, classify as Medium.

6. Draft and creation behavior

Check:

* draft construction does not create many history entries;
* finishing a draft creates one undoable committed diagram change;
* undo/redo clears or validates stale drafts;
* creation remains visible/selected according to existing behavior.

7. Drag edit grouping

Check drag-handle editing behavior.

Preferred:

* one drag gesture creates one undoable change;
* one undo reverts the whole drag.

If every pointer move creates a history entry, classify as Medium because it makes undo nearly unusable.

If drag edits are not undoable at all, classify as Medium.

8. Selection after undo/redo

Check:

* selection is not stored/restored as part of history;
* if selected element still exists after undo/redo, selection may remain;
* if selected element no longer exists, selection is cleared;
* stale selection does not crash inspector/SVG;
* layer filter does not cause invalid selection.

9. Save/load/export behavior

Check:

* saved JSON includes only current diagram data;
* no history fields like past, present, future, history, undoStack, or redoStack are saved;
* loading behavior matches the implementation’s documented policy:
    * either load is undoable;
    * or load resets history.
* loading does not leave stale drafts/selections.

If history is persisted in saved JSON, classify as Medium or Critical depending on compatibility impact.

10. Keyboard shortcuts

Check:

* Cmd+Z / Ctrl+Z triggers undo outside text inputs;
* Cmd+Shift+Z / Ctrl+Shift+Z triggers redo outside text inputs;
* optionally Ctrl+Y triggers redo;
* shortcuts do not break native text editing in input fields.

If shortcuts are missing but buttons work, classify as Low unless the implement prompt explicitly required them as must-have. If shortcuts break typing in inputs, classify as Medium.

11. Tests

Check tests cover:

* multi-step undo;
* redo;
* redo clearing after new edit;
* history limit;
* creation undo;
* inspector edit undo;
* drag edit grouping if practical;
* UI-only changes not creating history entries;
* save/export excludes history;
* selection validation after undo/redo if practical.

Missing tests for multi-step undo or redo should be Medium.

Missing tests for keyboard shortcuts may be Low.

Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Report results.

Output format

Use this structure:

**Summary:** pass / needs changes
**Critical Issues**
- ...
**Medium Issues**
- ...
**Low-Priority Issues**
- ...
**What Looks Correct**
- ...
**Test Results**
...
**Build Results**
...
**Ready To Call Phase 10E Complete**
Yes/No, with a short reason.
**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt.

Then output:

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

Rules for JSON:

* critical_count, medium_count, and low_count must be numbers.
* ready_to_commit must be false if critical_count > 0 or medium_count > 0.
* suggested_fix_prompt should be a short targeted prompt if fixes are needed.