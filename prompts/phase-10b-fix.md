Fix Phase 10B direct point/label creation under active layer filters.

Context:
Phase 10B implemented direct-input creation for points and free text labels.

Review result:

* Tests pass.
* Build passes.
* No critical issues.
* One Medium issue remains.

Medium issue:
Direct-created points/labels may be immediately hidden and not selected under an active layer filter.

Current behavior:

* In src/App.tsx, direct-created point/label selection is passed through clearSelectionForLayerFilter(...).
* Direct-created elements use the default next-layer policy from src/ui/diagramUpdates.ts.
* If the user has filtered to a specific existing layer, the new direct-created point/label may be created on a different layer.
* The layer filter then hides the new element.
* clearSelectionForLayerFilter(...) clears the new selection.
* The UI can report “Label created.” while the label is invisible and not selected.

This violates the Phase 10B requirement:

* newly created labels should be selected.
* newly created points should also remain visible and selected after direct creation.

Goal:
Fix direct-input point/label creation so newly created elements remain visible and selected even when a specific layer filter is active.

Scope:
This is a targeted Phase 10B fix.

Do not implement:

* direct-input curve creation
* direct-input sheet creation
* remove/delete
* drag editing
* custom work planes
* undo/redo
* spath/save
* new geometry features
* save/load changes
* new dependencies

Do not change:

* TikZ export semantics
* SVG rendering semantics except visibility naturally following UI filter state
* cursor creation behavior unless needed for consistency
* diagram data model
* persisted saved JSON format
* Phase 9B layer-aware TikZ output
* Phase 9C layer filter model except as needed for this UI-state fix

Important constraints:

* Selection state must remain UI/editor state, not stored in Diagram.
* Layer filter state must remain UI/editor state, not stored in Diagram.
* Direct creation form state must remain UI/editor state, not stored in Diagram.
* TikZ output must continue to depend only on committed diagram data, not on selection/filter/direct form status.

1. Decide and implement the intended direct-creation layer/filter behavior

Implement one clear policy so that direct-created points and labels are visible and selected immediately after creation.

Preferred policy:
When a specific layer filter is active, direct-created points/labels should be created on that active filtered layer.

For example:

* If layer filter is all, use the existing default next-layer behavior.
* If layer filter is a specific layer, create the new direct point/label on that layer.
* Then select the newly created element directly.
* Do not clear that selection via clearSelectionForLayerFilter(...), since the element should now pass the filter.

Alternative acceptable policy:
Create the new element using the existing default layer policy, but immediately update the layer filter to the new element’s layer so the element is visible and selected.

If this alternative is chosen:

* keep layer filter as UI state only
* make the behavior explicit and tested
* avoid surprising hidden creation

The preferred policy is usually simpler and less surprising:
direct creation while filtered to layer N creates on layer N.

2. Fix direct point creation

Inspect the direct point creation path in src/App.tsx.

Ensure:

* valid direct coordinates still create a point
* 2D direct coordinates still normalize z to 0
* 3D direct coordinates still require finite x/y/z
* created point uses the same point creation helper/defaults as cursor point creation where appropriate
* when a specific layer filter is active, the created point is visible under that filter
* created point is selected immediately after creation
* status message remains accurate

Do not store selection/filter state in Diagram.

3. Fix direct label creation

Inspect the direct label creation path in src/App.tsx.

Ensure:

* valid direct coordinates still create a free text label in diagram.labels
* blank label text still defaults to Label
* raw label text is preserved otherwise
* 2D direct label coordinates still normalize z to 0
* 3D direct label coordinates still require finite x/y/z
* when a specific layer filter is active, the created label is visible under that filter
* created label is selected immediately after creation
* status message remains accurate

This is the main review issue.

4. Avoid incorrect selection clearing

Do not pass the newly created selection through clearSelectionForLayerFilter(...) in a way that can clear it immediately after creation.

Acceptable options:

* create on the active filtered layer, then select directly
* or update filter to include the new layer before applying selection filtering
* or adjust the selection/filter helper usage so creation paths can guarantee visibility

Do not weaken clearSelectionForLayerFilter(...) globally if it is needed elsewhere for stale selections after filter changes.

5. Add focused tests

Add tests that catch this exact bug.

Required tests:

A. Direct-created label under active layer filter

Set up:

* a diagram with at least one existing layer
* active layer filter set to a specific layer
* create a direct label

Expected:

* the label is added to diagram.labels
* the label is on a visible layer under the active filter, preferably the active filtered layer
* the new label is selected
* the selection is not cleared to null

B. Direct-created point under active layer filter

Set up:

* active layer filter set to a specific layer
* create a direct point

Expected:

* the point is added to diagram.strata
* the point is on a visible layer under the active filter, preferably the active filtered layer
* the new point is selected
* the selection is not cleared to null

C. Existing direct input validation still works

Keep or update existing tests for:

* invalid numeric input rejected
* 2D z normalization to 0
* 3D finite coordinate requirements
* blank label text defaults to Label

If direct creation behavior is difficult to test at the App level, extract small UI helper functions and test those helpers. Keep the implementation simple.

6. Preserve existing behavior

Do not regress:

* cursor point creation
* cursor label creation
* layer filter behavior when manually changing filters
* selection clearing for elements hidden by manual filter changes
* example switching
* save/load
* generated TikZ
* SVG preview
* direct form state
* inspector editing
* style editing
* point/label defaults
* 2D/3D coordinate normalization

7. Documentation

Update docs only if there is an existing relevant UI or roadmap note.

If you update docs, state:

* direct-created points/labels are created on the active layer when a specific layer filter is active
* direct creation state/filter/selection remain UI state
* TikZ export is unaffected by active layer filter and selection

Do not add large unrelated documentation.

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

* files modified
* which policy was chosen for direct creation under active layer filters
* how direct-created points remain visible and selected
* how direct-created labels remain visible and selected
* how selection/filter state remains outside Diagram
* how TikZ output remains unaffected
* what tests were added or updated
* test results
* build results
* remaining limitations