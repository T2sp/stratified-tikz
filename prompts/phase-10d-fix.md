Fix Phase 10D geometry handles so they do not intercept cursor creation clicks.

Context:
Phase 10D implemented cursor drag editing MVP for selected geometry handles.

Review result:

* Tests pass.
* Build passes.
* No critical issues.
* One Medium issue remains.

Medium issue:
Selected geometry handles remain visible and intercept pointer events while creation tools are active.

Current behavior:

* src/App.tsx always passes onGeometryHandleDrag.
* src/rendering/SvgDiagram.tsx always renders selected handles.
* In non-select creation modes, src/App.tsx refuses to update geometry, but the handle circles still receive pointer/click events and stop propagation.
* This can block creation clicks where a selected handle is visible.
* For example, if a selected point/vertex handle is visible and the user switches to Add point / Add label / Add polyline / Add cubic Bézier / Add sheet, clicking on or near that visible handle may be captured by the handle instead of creating the new element.

Goal:
Fix Phase 10D so geometry handles are visible and interactive only in Select mode.

When a creation tool is active, geometry handles should not intercept cursor creation clicks.

Scope:
This is a targeted Phase 10D fix.

Do not implement:

* undo/redo
* snapping
* arbitrary/custom work planes
* relative/polar Bézier editing
* new creation tools
* region strata
* concatenated paths
* broad UI redesign
* new dependencies

Do not change:

* diagram data model
* save/load format
* TikZ export semantics
* SVG geometry rendering semantics
* cursor creation geometry
* direct creation behavior
* layer-aware TikZ output
* layer filtering semantics except as needed for handle visibility

Important constraints:

* Geometry handles are editor/rendering UI only.
* Handles must not be stored in Diagram.
* Selection, drafts, layer filter, work plane state, and handle state remain UI/editor state only.
* TikZ output must not depend on handles, selection, filters, or drafts.

1. Render handles only in Select mode

Inspect:

* src/App.tsx
* src/rendering/SvgDiagram.tsx
* handle rendering logic
* onGeometryHandleDrag
* creation tool state, likely something like creationTool

Update the app so that selected geometry handles are rendered only when the active tool is Select mode.

Expected behavior:

* Select mode:
    * selected element handles are visible;
    * handles are interactive;
    * dragging handles updates geometry.
* Add point mode:
    * handles are not visible, or at least have pointer-events: none;
    * handles do not intercept clicks;
    * clicking creates a point as usual.
* Add label mode:
    * handles are not visible/intercepting;
    * clicking creates a label as usual.
* Add polyline mode:
    * handles are not visible/intercepting;
    * clicking adds polyline draft vertices as usual.
* Add cubic Bézier mode:
    * handles are not visible/intercepting;
    * clicking adds Bézier draft points as usual.
* Add sheet mode:
    * handles are not visible/intercepting;
    * clicking adds sheet draft vertices as usual.

Preferred implementation:
Pass a boolean prop to SvgDiagram, for example:

showGeometryHandles={creationTool === "select"}

and only render selected geometry handles when this is true.

Also pass onGeometryHandleDrag only in Select mode, or make SvgDiagram ignore it when showGeometryHandles is false.

Do not rely only on App.tsx refusing to update geometry after drag starts. Handles should not capture pointer events in creation modes at all.

2. Ensure handles do not stop propagation in creation modes

Inspect the handle pointer/click handlers in src/rendering/SvgDiagram.tsx.

Currently handle events may call:

* event.stopPropagation();
* pointer capture;
* drag start logic.

Ensure these handlers cannot run in creation modes.

Acceptable approaches:

A. Do not render handles outside Select mode.

B. Render handles visually disabled with pointerEvents="none" outside Select mode.

Preferred: A.

If you choose B, make sure disabled handles do not capture pointer events and do not block creation clicks.

3. Preserve drag editing in Select mode

Do not regress Phase 10D drag editing.

In Select mode, handles should still work for:

* points;
* free text labels, if label position handles are implemented;
* polyline vertices;
* cubic Bézier start/control/end points;
* polygon sheet vertices.

Expected:

* 2D drags normalize z to 0;
* 3D drags use active xy/xz/yz work plane;
* updates are immutable;
* ids/styles/layers/codim/kinds are preserved;
* cubic Bézier point order/control roles are preserved;
* polygon vertex order is preserved;
* filtered-out selected elements do not render handles;
* drag updates still respect layer filter.

4. Fix low-priority accessibility label consistency if small

Low-priority issue:
Handle accessibility labels use zero-based vertex labels such as Vertex 0, while inspector UI appears to use one-based labels.

If this is small and localized, update handle labels to match inspector conventions.

Preferred:

* display/user-facing handle labels should be one-based:
    * Vertex 1;
    * Vertex 2;
    * etc.
* internal indices should remain zero-based.

Do not spend much effort on this if it risks broad changes. The Medium issue is the priority.

5. Add focused regression tests

Add tests that catch the pointer interception bug if practical.

Required or strongly preferred tests:

A. Handles hidden/disabled in creation modes

Test that when selected element exists and active tool is not Select:

* geometry handles are not rendered; or
* geometry handles have pointer-events: none; or
* SvgDiagram receives showGeometryHandles={false} and does not emit handle nodes.

Cover at least one creation mode, preferably Add point.

B. Handles visible/interactable in Select mode

Test that when active tool is Select and an editable selected element exists:

* geometry handles are rendered;
* handle drag callback is available/used.

C. Creation click is not blocked by handles

If App-level pointer tests are practical:

* select an element so handles would normally exist;
* switch to Add point or Add label;
* click at a position overlapping/near a previous handle;
* verify a new element is created.

If App-level pointer tests are too brittle, test the render condition and event props instead.

D. Accessibility labels

If you update handle labels:

* update or add a small test that user-facing labels are one-based.

6. Manual verification checklist

After implementation, run:

PATH=/opt/homebrew/bin:$PATH npm run dev

Verify:

1. Select an existing point or curve.
2. Confirm handles appear in Select mode.
3. Drag a handle.
    * geometry updates correctly.
    * TikZ source changes accordingly.
4. Switch to Add point mode.
    * handles disappear or no longer intercept pointer events.
5. Click where a handle used to be.
    * a new point is created.
    * the click is not blocked.
6. Repeat for Add label mode.
7. Repeat for Add polyline mode.
8. Repeat for Add cubic Bézier mode.
9. In 3D, repeat for Add sheet mode.
10. Switch back to Select mode.

* handles for the selected element are visible/interactable again as appropriate.

7. Preserve existing behavior

Do not regress:

* selection behavior;
* layer filtering;
* cursor creation for points;
* cursor creation for labels;
* cursor creation for polylines;
* cursor creation for cubic Bézier curves;
* cursor creation for 3D polygon sheets;
* direct creation;
* empty canvas behavior if implemented;
* work-plane guide behavior;
* draft previews;
* inspector editing;
* style editing;
* save/load;
* SVG preview;
* TikZ generation;
* Phase 9A coordinate names;
* Phase 9B layer-aware output;
* Phase 9C layer filtering.

8. Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Environment:
The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

when running npm commands.

9. Report after implementation

Please report:

* files modified;
* root cause of the pointer interception bug;
* how handle visibility/interactivity is restricted to Select mode;
* whether onGeometryHandleDrag is passed only in Select mode or ignored otherwise;
* how creation clicks are protected from handle interception;
* whether accessibility labels were updated to one-based labels;
* what tests were added or updated;
* test results;
* build results;
* remaining limitations.