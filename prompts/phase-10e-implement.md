# Phase 10E Implementation Prompt: Multi-step undo/redo history

Environment

The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

when running npm commands.

Verification commands:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Context

You are working on the StratifiedTikZ project.

The app currently supports editing a committed Diagram through UI actions such as:

* cursor creation;
* direct creation;
* inspector edits;
* style edits;
* layer edits;
* coordinate edits;
* drag-handle edits;
* save/load;
* empty canvas switching, if implemented.

Phase 10E should add undo/redo support.

Important conventions:

* Diagram is the committed document data.
* Selection, layer filter, coordinate input mode, creation tool, drafts, direct form state, work-plane state, and UI status messages are editor/UI state.
* Generated TikZ must depend only on committed diagram data.
* Undo/redo history should be editor/UI state, not stored in Diagram.
* Undo/redo history should not be saved to JSON.
* Undo/redo should not affect TikZ except by changing the committed diagram.

Goal

Implement multi-step undo/redo for diagram edits.

The user should be able to:

* undo many previous committed diagram changes;
* redo undone changes;
* see whether undo/redo are currently available;
* use toolbar buttons and keyboard shortcuts.

This is not just one-step undo.

Use a sufficiently large bounded history, for example 100 states.

Terminology

Use standard terminology:

* Undo: move one step backward in committed diagram history.
* Redo: cancel an undo by moving one step forward in the history.

The user may describe redo as “cancel undo”; implement it as Redo.

Scope

This is Phase 10E only.

Do not implement:

* collaborative history;
* persistent history in saved JSON;
* branching history UI;
* command-level semantic history;
* grouped transactions beyond simple practical grouping;
* timeline panel;
* snapshots stored on disk;
* new dependencies;
* broad UI redesign.

Do not change:

* diagram data model unless absolutely necessary;
* save/load file format;
* TikZ generator semantics;
* SVG renderer semantics;
* creation geometry;
* inspector behavior except to route edits through undoable updates;
* style semantics;
* layer-aware TikZ semantics;
* layer filter semantics.

1. Add undo/redo history state

Implement an editor-level history structure.

Preferred model:

type DiagramHistory = {
  past: Diagram[];
  present: Diagram;
  future: Diagram[];
};

or equivalent.

Requirements:

* present is the current committed diagram.
* past contains previous committed diagrams.
* future contains diagrams available for redo.
* History is UI/editor state only.
* Do not store history inside Diagram.
* Do not save history to JSON.
* Use immutable updates.
* Bound the history size to a sufficiently large number, e.g. MAX_HISTORY_SIZE = 100.

When a new edit is committed:

* push previous present into past;
* set new diagram as present;
* clear future;
* truncate past to the history limit.

When undo is triggered:

* if past is non-empty:
    * move current present to the front/top of future;
    * pop the last item from past;
    * set it as present.

When redo is triggered:

* if future is non-empty:
    * push current present into past;
    * take the next item from future;
    * set it as present.

2. Replace direct setEditableDiagram edit paths with undoable commits

Audit all places where committed diagram data changes.

Route real diagram edits through a common helper such as:

commitDiagramChange(nextDiagram, options?)

or:

setDiagramWithHistory((current) => nextDiagram)

Required undoable operations include:

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
* inspector name edits;
* inspector layer edits;
* inspector coordinate edits;
* inspector style edits;
* drag-handle geometry edits;
* delete/remove selected elements, if already implemented in Phase 10A;
* empty canvas creation/switching, if implemented;
* JSON load/import, if it replaces the committed diagram.

Non-diagram UI state changes should not create undo entries:

* selecting an element;
* changing layer filter;
* changing creation tool;
* changing coordinate input mode;
* changing active work plane;
* changing direct form text fields;
* changing draft points before finish;
* toggling preview UI;
* copy TikZ;
* status message changes.

Draft actions:

* adding polyline draft vertices should not necessarily create undo entries;
* finishing/committing the polyline should create one undo entry;
* canceling a draft should not create an undo entry;
* same for cubic Bézier and sheet drafts.

3. Handle drag editing sensibly

Drag-handle editing can produce many intermediate updates.

Avoid creating one undo entry per pointer move.

Preferred behavior:

* record a history entry at drag start or at drag commit/end;
* during drag, update preview/current diagram as needed;
* after drag ends, one undo should revert the entire drag to the pre-drag geometry.

If the current implementation only updates on pointer move and there is no explicit drag end structure, implement the simplest robust grouping that avoids excessive history pollution.

Acceptable MVP:

* store the pre-drag diagram at drag start;
* update diagram during drag without pushing every intermediate state;
* on drag end, commit one history entry from pre-drag to final state.

If this is too large, at minimum avoid pushing dozens of history entries during one drag. Report any limitation.

4. Selection behavior after undo/redo

Keep selection as UI state, but make it safe.

After undo or redo:

* if the selected element still exists, keep selection;
* if it no longer exists, clear selection;
* do not store selection in history;
* do not restore old selection from history.

This keeps the model simple and avoids saving UI state in history.

Layer filter behavior:

* keep the current layer filter;
* after undo/redo, if selected element is hidden or absent, clear selection;
* do not store layer filter in history.

Draft behavior:

* undo/redo should clear active drafts, or otherwise ensure drafts do not point to stale geometry.
* Prefer clearing drafts on undo/redo.

Direct form state:

* may remain unchanged.
* Do not store it in history.

5. UI controls

Add user-visible undo/redo controls.

Requirements:

* Undo button;
* Redo button;
* disabled state when unavailable;
* labels/tooltips are clear;
* buttons should not be hidden in ordinary editor usage.

Suggested labels:

Undo
Redo

or:

↶ Undo
↷ Redo

Keyboard shortcuts:

* Cmd+Z / Ctrl+Z: undo;
* Cmd+Shift+Z / Ctrl+Shift+Z: redo;
* optionally Ctrl+Y on non-Mac-like platforms for redo.

Avoid interfering with text input fields:

* If the user is typing in an input/textarea/select/contenteditable field, do not steal ordinary text-editing undo/redo.
* Only handle global shortcuts when focus is not inside an editable input, or carefully allow native input behavior.

6. Save/load behavior

Undo/redo history should not be saved.

When loading/importing a diagram:

Preferred behavior:

* treat the loaded diagram as a committed diagram change, so Undo returns to the previous diagram;
* clear redo future;
* clear drafts and stale selection.

Alternative acceptable behavior:

* replace the current diagram and reset history.

Choose one policy and document/test it.

Preferred policy is more user-friendly:

* loading a file can be undone.

But if implementing this is risky, use reset-history behavior and report it clearly.

Export/save JSON:

* export only the current present diagram;
* do not include past or future.

7. Empty canvas behavior

If empty canvas creation/switching exists:

* switching to Empty 2D or Empty 3D should be undoable if it replaces the current committed diagram;
* after undo, previous diagram returns;
* after redo, empty diagram returns;
* selection/drafts are cleared or validated.

If empty canvas is not implemented yet, do not implement it as part of Phase 10E.

8. Tests

Add focused tests for history behavior.

Required tests:

A. Basic multi-step undo

* start from a diagram;
* commit at least three diagram changes;
* undo repeatedly;
* verify each previous diagram state is restored in reverse order;
* verify more than one undo step works.

B. Redo

* commit changes;
* undo at least two steps;
* redo;
* verify the undone state is restored forward;
* redo again if possible.

C. New edit clears redo future

* commit A → B → C;
* undo to B;
* make new edit D;
* verify redo is no longer available;
* verify history is A → B → D, not A → B → C.

D. History limit

* commit more than the limit, or test helper behavior directly;
* verify history is bounded, e.g. max 100 past states;
* no unbounded growth.

E. UI state not stored in diagram history

Test where practical:

* selection changes do not create undo entries;
* layer filter changes do not create undo entries;
* direct form input changes do not create undo entries;
* draft changes before finish do not create undo entries.

F. Creation undo

* create point/label/curve/sheet;
* undo removes it;
* redo restores it.

At least test point and one path-like element.
More coverage is better.

G. Inspector edit undo

* edit a coordinate or layer/name/style;
* undo restores previous diagram data;
* redo reapplies edit.

H. Drag edit grouping

If drag editing has explicit helpers:

* simulate drag start/update/end;
* verify one undo reverts the whole drag, not just one pointer move.
* If not practical, add a TODO/limitation and test the lower-level update helper where possible.

I. Save/export excludes history

If save serialization is testable:

* export/save output contains only current diagram;
* no past, present, future, or history metadata is included.

J. Keyboard shortcut behavior

If UI tests are available:

* Cmd/Ctrl+Z triggers undo outside inputs;
* input-focused shortcut does not break native text editing.

Do not make keyboard tests brittle if the project does not already have such tests.

9. Documentation

Update relevant docs briefly.

Good places:

* docs/ROADMAP.md;
* any UI/editor behavior documentation.

Mention:

* Phase 10E adds multi-step undo/redo;
* history is bounded, e.g. 100 states;
* redo cancels undo;
* history is UI/editor state only;
* history is not saved to JSON;
* selection/filter/drafts are not part of history;
* drag edits should be grouped as one undoable change where implemented.

Do not add large unrelated docs.

10. Manual verification checklist

After implementation, run:

PATH=/opt/homebrew/bin:$PATH npm run dev

Verify:

1. Create a point.
2. Create a label.
3. Create a polyline.
4. Press Undo once:
    * polyline disappears.
5. Press Undo again:
    * label disappears.
6. Press Undo again:
    * point disappears.
7. Press Redo:
    * point returns.
8. Press Redo again:
    * label returns.
9. Press Redo again:
    * polyline returns.
10. Undo once, then make a new edit:

* redo is disabled/cleared.

11. Edit a coordinate in inspector:

* undo restores old coordinate.
* redo reapplies coordinate.

12. Drag a handle:

* one undo reverts the drag.

13. Save JSON:

* file does not contain history.

14. Load JSON:

* behavior matches the chosen load-history policy.

11. Preserve existing behavior

Do not regress:

* cursor creation;
* direct creation;
* empty canvas behavior if implemented;
* layer selection for new elements;
* layer filtering;
* selection behavior;
* inspector editing;
* style editing;
* drag handle editing;
* work-plane projection;
* draft previews;
* save/load current diagram;
* SVG preview;
* TikZ generation;
* Phase 9A coordinate names;
* Phase 9B layer-aware output;
* Phase 9C layer filtering;
* Phase 10D drag handles.

12. Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

13. Report after implementation

Please report:

* files modified;
* history data structure used;
* history limit;
* how undo works;
* how redo works;
* how new edits clear redo future;
* which diagram updates are undoable;
* which UI-only changes are not undoable;
* how selection is validated after undo/redo;
* how drafts are handled after undo/redo;
* how drag edits are grouped;
* how save/load handles history;
* keyboard shortcuts implemented;
* tests added/updated;
* test results;
* build results;
* remaining limitations.