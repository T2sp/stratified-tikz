Review Phase 9B: layer-aware TikZ output.

Do not modify files.

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
Phase 9B implemented layer-aware TikZ output.

Expected Phase 9B behavior:

* Generated TikZ uses layer information from strata and labels.
* Layer values are mapped to deterministic TikZ-safe layer names.
* Draw/fill/node commands are grouped by layer.
* TikZ uses pgfonlayer or equivalent.
* Phase 9A coordinate-name behavior is preserved.
* Geometry and style semantics are otherwise unchanged.

Goal:
Review Phase 9B for correctness, TikZ validity, determinism, maintainability, and scope control.

This is only a review.

Do not implement fixes.
Do not modify files.

1. Scope control

Confirm that Phase 9B only implemented layer-aware TikZ output.

It may implement:

* TikZ layer-name helper
* layer declarations
* pgfonlayer grouping
* tests
* documentation updates

It should not implement:

* layer-based selection/filter UI
* spath/save
* remove/delete
* direct-input creation
* drag editing
* custom work planes
* concatenated paths
* region strata
* new geometry features
* unrelated save/load changes
* new dependencies

2. TikZ layer names

Review layer-name generation.

Check that names are:

* deterministic
* TikZ-safe
* unique
* compatible with numeric layer values
* safe for negative layer values if supported
* not colliding with main or other reserved names

3. Layer declaration and ordering

Check generated TikZ.

Expected:

* all used layers are declared
* layer order is deterministic
* lower numeric layers are behind higher numeric layers
* main is handled correctly if used
* output remains readable

4. pgfonlayer grouping

Check that commands are grouped into the correct layer blocks.

Review:

* point commands
* polyline commands
* cubic Bézier commands
* sheet commands
* free text label node commands
* any comments or coordinate sections

Check that each item uses its own layer value.

5. Phase 9A preservation

Confirm that Phase 9A coordinate naming is preserved.

Expected:

* coordinate names still use sanitized stratum names
* polyline and Bézier coordinate names remain distinguishable
* duplicate names remain disambiguated
* no regression to old ambiguous coordinate names

6. TikZ drawing semantics

Confirm that geometry and styles are unchanged except for layer wrapping.

Check that implementation did not change:

* numeric coordinate values
* curve paths
* cubic Bézier point order
* sheet vertex order
* point rendering
* label text
* color definitions
* style definitions
* selection/highlighting exclusion

7. Labels

Check whether free text labels have layer values.

If they do:

* labels should appear in the appropriate layer block

If they do not:

* note the current behavior clearly

8. Tests

Check whether focused tests were added.

Good tests include:

* layer declarations are emitted
* pgfonlayer blocks are emitted
* elements appear in the correct layer block
* labels appear in correct layer block if applicable
* negative/sparse layers are handled if supported
* ordering within a layer is preserved
* Phase 9A coordinate names are preserved
* one-layer diagrams still produce valid output

Do not add React testing dependencies just for this review.

9. Documentation

Check whether docs/TIKZ_OUTPUT.md was updated.

Good docs mention:

* layer values map to TikZ layer names
* pgfonlayer is used
* lower numeric layers are behind higher numeric layers
* selection/highlighting is not exported
* layer filter UI is a later phase

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

11. Output format

Do not modify files.

First, provide a normal human-readable review with:

* Summary: pass / needs changes
* Critical issues, if any
* Medium issues, if any
* Low-priority issues, if any
* What looks correct
* Test results
* Build results
* Whether Phase 9B is ready to call complete
* Suggested targeted follow-up prompts for any fixes

At the very end, output exactly one machine-readable JSON block between these markers:

REVIEW_JSON_START
{
“summary”: “pass or needs_changes”,
“critical_count”: 0,
“medium_count”: 0,
“low_count”: 0,
“ready_to_commit”: true,
“suggested_fix_prompt”: “”
}
REVIEW_JSON_END

Rules for the JSON block:

* If there are any Critical or Medium issues, set ready_to_commit to false.
* If only Low-priority issues exist, set ready_to_commit to true.
* summary must be either "pass" or "needs_changes".
* critical_count, medium_count, and low_count must be numbers.
* suggested_fix_prompt should be a concise targeted prompt if fixes are needed, otherwise an empty string.
* Do not include markdown fences around the JSON block.