Fix Phase 9B review issues: preserve same-layer emission order and improve codimension comments in TikZ output.

Context:
Phase 9B implemented layer-aware TikZ output.

Review result:

* Tests pass.
* Build passes.
* No critical issues.
* One medium issue remains.

Medium issue:
Same-layer ordering is not actually preserved for multiple items of the same exported kind.

Current issue:

* emitLayeredItems calls sortByLayer(items).
* sortByLayer sorts by numeric layer, but for equal-layer ties it uses id.localeCompare(...).
* This means two curves on the same layer are reordered by id, not by their original diagram/emission order.
* This conflicts with the Phase 9B requirement:
    * preserve ordering within each numeric layer.
* It can also change the Phase 9A coordinate index assigned to those strata.

Target:
Fix same-layer ordering so that:

* layers are still ordered deterministically by numeric layer
* within the same layer, items preserve their original diagram/emission order
* no same-layer tie-break by id is used for emitted items

Additional readability improvement:
Within each layer block, codimension section comments should be more visually readable by surrounding them with %------style separators.

For example, instead of a plain comment like:

% Codim 1: curves

prefer something like:

%----------------------------------------
% Codim 1: curves
%----------------------------------------

or a similarly readable %------based style.

Scope:
This is a targeted Phase 9B fix.

Do not implement:

* layer-based selection/filter UI
* spath/save
* remove/delete
* direct-input creation
* drag editing
* custom work planes
* concatenated paths
* region strata
* new geometry features
* save/load changes
* new dependencies

Do not change:

* Phase 9A coordinate-name semantics except as necessary to preserve correct ordering
* diagram geometry
* SVG rendering
* creation behavior
* inspector behavior
* styles/colors
* label text
* TikZ drawing semantics beyond ordering/comment formatting fixes

Tasks:

1. Fix same-layer ordering

Inspect:

* src/tikz/generateTikz.ts
* sortByLayer
* emitLayeredItems
* coordinate-name indexing logic
* any item collection logic for sheets, curves, points, and labels

Update the implementation so that:

* layer blocks are emitted in deterministic numeric layer order
* items within the same layer preserve original emission order
* same-layer ties are not sorted by id
* stable ordering is explicit and tested

A good implementation pattern is:

items
  .map((item, originalIndex) => ({ item, originalIndex }))
  .sort((a, b) => {
    const layerDiff = compareLayer(a.item.layer, b.item.layer);
    if (layerDiff !== 0) return layerDiff;
    return a.originalIndex - b.originalIndex;
  })

or equivalent.

If layer grouping is already done by layer, another acceptable approach is:

* collect used layers in sorted numeric order
* for each layer, emit items by filtering the original items array
* do not sort within that layer

Choose the simpler approach that fits the current generator.

2. Preserve Phase 9A coordinate-name behavior

Important:
The fix must not accidentally change coordinate-name indexing in an unstable way.

Expected:

* coordinate names still use sanitized stratum names
* polyline and Bézier coordinate names remain distinct
* duplicate names remain disambiguated
* coordinate indices are assigned according to the intended original diagram/emission order, not id sorting

If coordinate names are generated before layer sorting, preserve that behavior if it is correct.
If coordinate names are generated during layer emission, ensure same-layer ordering is stable and based on original order.

3. Preserve cross-layer behavior

Layer order should remain deterministic.

Expected:

* lower numeric layer values are behind higher numeric layer values
* negative layers are handled as before
* sparse layers are handled as before
* declared layer order remains deterministic
* main handling remains as before

Do not remove pgfonlayer support.

4. Improve codimension section comments inside layer blocks

Update TikZ output formatting so that codimension section comments inside each layer block are easier to visually scan.

Preferred style:

%----------------------------------------
% Codim 1: curves
%----------------------------------------

or equivalent using %-----.

Apply this consistently to codimension sections inside layer blocks, such as:

* codim 0 regions, if present
* codim 1 sheets/curves depending on ambient dimension
* codim 2 curves/points depending on ambient dimension
* codim 3 points in 3D
* labels section, if currently grouped similarly

Requirements:

* comment formatting only
* no TikZ drawing semantics change
* no coordinate-name change caused by comments
* output remains readable
* tests should not become overly brittle, but should check at least one separator if appropriate

5. Add focused tests for same-kind same-layer ordering

Add or update tests so this exact bug is caught.

Required test shape:

* create a diagram with at least two same-kind elements on the same layer
* their ids should sort opposite to insertion/order in diagram.strata
* generated TikZ should preserve diagram/emission order, not id order

Good examples:

* two polyline curves on layer 0:
    * first inserted id: z-curve
    * second inserted id: a-curve
    * names should make output easy to identify
    * generated TikZ should emit the z-curve element before the a-curve element if that is the diagram order

or:

* two cubic Bézier curves on the same layer
* two polygon sheets on the same layer

At least one same-kind same-layer test is required.

Also ensure the test catches coordinate-name indexing if possible.

6. Add or update formatting tests for codimension separators

Add a lightweight test that generated TikZ contains the improved codimension comment separator format.

Do not make the test too brittle about exact separator length.

Acceptable assertions:

* output contains a %--- separator near a Codim comment
* output contains % Codim 1: and nearby %---
* output contains readable codimension section comments inside a pgfonlayer block

7. Keep existing Phase 9B tests passing

Existing tests should still pass:

* layer declarations
* negative/sparse layers
* labels
* pgfonlayer
* single-layer output
* Phase 9A names

Update snapshots/assertions only where the corrected order or improved comment formatting requires it.

8. Documentation cleanup

Update docs/TIKZ_OUTPUT.md.

Review the later section around the older “Label section” wording.

If it says or implies that labels are emitted in a separate non-layered label section, update it to reflect Phase 9B:

* free text labels are emitted inside the appropriate layer block
* label coordinates/comments may still be documented elsewhere if applicable
* selection/highlighting is not exported
* layer output uses pgfonlayer
* codimension sections inside layer blocks use %------style readable separators

Keep the docs concise and consistent.

9. Preserve existing behavior

Do not regress:

* save/load
* point creation
* label creation
* polyline creation
* cubic Bézier creation
* sheet creation
* inspector name editing
* inspector layer editing
* inspector coordinate editing
* inspector style editing
* SVG preview
* generated TikZ geometry
* Copy TikZ
* 2D output
* 3D output
* validation
* blank stratum name prevention
* invalid numeric input safety

10. Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Environment:
The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

when running npm commands.

11. Report after implementation

Please report:

* files modified
* where same-layer ordering was fixed
* old ordering behavior
* new ordering behavior
* how original diagram/emission order is preserved within the same layer
* how cross-layer ordering remains deterministic
* how Phase 9A coordinate-name behavior is preserved
* how codimension comments were reformatted
* what focused same-kind same-layer ordering test was added
* what comment-formatting test was added or updated
* whether docs/TIKZ_OUTPUT.md was updated
* test results
* build results
* remaining limitations