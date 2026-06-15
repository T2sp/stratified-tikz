Implement Phase 9B only: layer-aware TikZ output.

Read:

* AGENTS.md
* docs/SPEC.md
* docs/DATA_MODEL.md
* docs/TIKZ_OUTPUT.md
* docs/ROADMAP.md
* src/model/
* src/tikz/
* src/examples/
* relevant tests

Context:
Phase 9A is already complete.

Current behavior:

* Strata have editable layer values in the inspector.
* Layer values are stored in diagram data.
* However, generated TikZ does not yet use layer information.
* Generated TikZ coordinate names already use user-controlled sanitized stratum names from Phase 9A.

Goal:
Make layer values meaningful in generated TikZ output.

Scope:
This is Phase 9B only.

Implement:

* layer-aware TikZ output
* deterministic TikZ layer names
* grouping draw/fill/node commands by layer
* tests for layer-aware output

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
* save/load format changes unless absolutely necessary
* new dependencies

Do not change:

* diagram geometry
* SVG rendering semantics
* creation behavior
* inspector behavior
* TikZ coordinate naming semantics from Phase 9A
* selection/highlighting behavior

1. Inspect current TikZ generation

Find where TikZ commands are emitted for:

* points
* labels
* polyline curves
* cubic Bézier curves
* polygon sheets
* any existing quad sheets if still supported

Identify the point where commands can be grouped by stratum.layer or label.layer.

2. Add deterministic TikZ layer names

Map numeric layer values to TikZ-safe layer names.

Suggested convention:

stratifiedLayer0
stratifiedLayer1
stratifiedLayerMinus1

or equivalent.

Requirements:

* deterministic
* TikZ-safe
* handles negative layer values if supported by the model
* handles sparse layer values
* does not collide with reserved names such as main

3. Emit TikZ layer declarations

Generated TikZ should declare and set layers.

Possible output:

\pgfdeclarelayer{stratifiedLayer0}
\pgfdeclarelayer{stratifiedLayer1}
\pgfsetlayers{stratifiedLayer0,stratifiedLayer1,main}

or an equivalent structure.

Requirements:

* declare all used diagram layers
* layer order should be deterministic
* lower layer numbers should generally appear behind higher layer numbers
* preserve existing relative order within each layer

If main is needed for compatibility, include it appropriately.

4. Wrap draw commands in pgfonlayer

Group relevant drawing commands by layer.

Possible output:

\begin{pgfonlayer}{stratifiedLayer0}
  ...
\end{pgfonlayer}

Requirements:

* points, curves, sheets, and free text labels should be emitted in the layer corresponding to their layer value
* if labels have layer values, use them
* preserve style and coordinate references
* preserve Phase 9A coordinate names
* selection/highlighting must not affect TikZ

5. Preserve drawing semantics

The rendered diagram should remain the same except for explicit layer grouping.

Do not change:

* numeric coordinate values
* coordinate names from Phase 9A
* curve paths
* sheet paths
* point rendering
* label text
* color definitions
* style definitions

6. Tests

Add focused tests.

Good tests include:

* generated TikZ declares layers used by the diagram
* generated TikZ contains pgfonlayer blocks
* elements with layer 0 appear in the layer 0 block
* elements with layer 2 appear in the layer 2 block
* negative layers, if supported, get TikZ-safe names
* ordering within the same layer is preserved
* coordinate names from Phase 9A are preserved
* selection/highlighting does not affect layer output
* diagrams with only one layer still generate valid TikZ
* labels are assigned to their layer if labels support layer

Do not make tests overly brittle about unrelated whitespace.

Do not add React testing dependencies.

7. Documentation

Update docs/TIKZ_OUTPUT.md.

Mention:

* generated TikZ uses pgfonlayer
* layer values map to deterministic TikZ layer names
* lower layer values are emitted behind higher layer values
* selection/highlighting is not exported
* layer filter UI is not part of this phase

Update docs/ROADMAP.md only if appropriate.

8. Preserve existing behavior

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

9. Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Environment:
The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

when running npm commands.

10. Report after implementation

Please report:

* files modified
* how layer names are generated
* how TikZ layer declarations are emitted
* how commands are grouped by layer
* how layer ordering is determined
* what tests were added or updated
* whether docs were updated
* confirmation that Phase 9A coordinate naming was preserved
* confirmation that TikZ drawing semantics were otherwise unchanged
* test results
* build results
* limitations