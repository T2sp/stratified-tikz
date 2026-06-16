# Phase 11C Review Prompt: Relative Bézier control TikZ export

Environment

The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

Verification:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Review instructions

Review Phase 11C only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between REVIEW_JSON_START and REVIEW_JSON_END.

If there are any Critical or Medium issues, set:

"ready_to_commit": false

If only Low-priority issues remain, set:

"ready_to_commit": true

Phase 11C goal

Phase 11C should improve cubic Bézier maintainability in generated TikZ source.

If the user specifies or edits Bézier controls in relative modes, TikZ output should preserve that intent:

Relative Cartesian:

.. controls +(x,y) and +(z,w) .. (end)

Relative polar:

.. controls +(q1:r1) and +(q2:r2) .. (end)

For relative control modes, independent \coordinate declarations for the control points should generally be omitted, because they reduce readability and are not needed.

Scope

Phase 11C should not implement unrelated features:

* concatenated paths;
* new curve types;
* arbitrary work planes;
* camera system;
* snapping;
* TikZ import;
* new dependencies;
* broad UI redesign.

Classify unrelated changes according to severity.

Review checklist

1. Data model / metadata

Check that cubic Bézier curves can distinguish:

* absolute control mode;
* relative Cartesian control mode;
* relative polar control mode.

The exact model may differ, but the app must preserve enough information to export the intended TikZ syntax.

If relative input is immediately converted to absolute controls with no metadata/hint and cannot be exported relatively, classify as Medium.

2. Rendering geometry remains robust

Check:

* SVG rendering still uses correct absolute control-point positions;
* relative-mode curves render the same as their equivalent absolute geometry;
* handles appear in correct locations;
* 2D z remains 0;
* 3D coordinates remain finite.

If export metadata breaks rendering, classify as Critical or Medium.

3. Relative Cartesian TikZ export

Check for 2D relative Cartesian Bézier curves:

* TikZ contains .. controls +(dx1,dy1) and +(dx2,dy2) ..;
* first offset is relative to start;
* second offset is relative to end;
* independent coordinate declarations for the relative control points are not emitted unless clearly justified;
* start/end references remain valid;
* no dangling coordinate references.

If relative Cartesian mode exports as absolute control coordinates only, classify as Medium.

4. Relative polar TikZ export

Check for 2D relative polar Bézier curves:

* TikZ contains .. controls +(q1:r1) and +(q2:r2) ..;
* first polar control is relative to start;
* second polar control is relative to end;
* radius is finite and non-negative;
* angle is finite;
* independent coordinate declarations for the polar control points are not emitted unless clearly justified;
* formatting is readable.

If relative polar mode exports as absolute control coordinates only, classify as Medium.

5. Absolute Bézier export regression

Check:

* existing absolute cubic Bézier export remains correct;
* coordinate declarations for absolute control points remain valid if that was the existing behavior;
* Phase 9A coordinate names are not regressed;
* duplicate names remain disambiguated;
* 2D and 3D absolute Béziers still export.

6. 3D behavior

Check the chosen 3D policy.

Acceptable policies:

* relative Cartesian export works in 3D using syntax compatible with the existing 3D TikZ generator;
* or 3D relative modes fall back to absolute export with a documented limitation.

For polar controls, because TikZ polar syntax is naturally 2D plane-relative, it is acceptable to restrict relative polar TikZ export to 2D or known work-plane-local contexts.

Do not allow misleading 2D polar syntax for arbitrary 3D curves.

7. Direct cubic Bézier relative modes

If implemented, check:

* direct Bézier creation lets the user choose absolute / relative Cartesian / relative polar;
* relative Cartesian direct creation computes correct absolute controls;
* relative polar direct creation computes correct absolute controls;
* relative metadata is stored;
* TikZ uses relative syntax;
* invalid values are rejected safely.

If not implemented, check whether the limitation is reported. Missing direct relative modes are usually Low or Medium depending on how strongly the implementation prompt required them. Since the user explicitly asked “if possible,” missing direct support is acceptable if model/export support is complete and limitation is reported.

8. Save/load compatibility

If the model changed, check:

* old saved diagrams without metadata still load;
* missing metadata defaults to absolute mode;
* relative metadata round-trips;
* invalid metadata is rejected or normalized;
* saved JSON contains diagram data only.

If existing saved diagrams break, classify as Critical or Medium.

9. Inspector behavior

Check:

* inspector shows/edits active control mode if applicable;
* switching between absolute / relative Cartesian / relative polar is coherent;
* relative Cartesian offsets are from start/end respectively;
* relative polar angle/radius are from start/end respectively;
* invalid input does not corrupt geometry.

If Phase 11 relative editing regresses, classify as Medium.

10. Coordinate declarations

For relative modes, check specifically:

* no unnecessary \coordinate declarations for control points that are only used as relative controls;
* no dangling references to omitted control coordinates;
* start/end coordinates remain valid;
* coordinate/comment sections remain readable.

If omitted coordinate declarations break path references, classify as Critical.

If unnecessary declarations remain but output is otherwise correct, classify as Low or Medium depending on how strongly the requirement was implemented. Since this was a core user requirement, usually Medium.

11. Tests

Check tests cover:

* relative Cartesian TikZ export syntax;
* absence of control-point coordinate declarations in relative Cartesian mode;
* relative polar TikZ export syntax;
* absence of control-point coordinate declarations in relative polar mode;
* absolute export regression;
* layer-aware output regression;
* relative Cartesian conversion;
* relative polar conversion;
* save/load roundtrip if model changed;
* direct relative creation if implemented.

Missing tests for core export syntax should be Medium.

12. Documentation

Check docs mention:

* relative Cartesian TikZ export syntax;
* relative polar TikZ export syntax;
* absolute export behavior;
* control-point coordinate declaration policy;
* 3D limitations if any;
* save/load compatibility if model changed.

Missing docs are usually Low unless behavior is ambiguous.

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
**Ready To Call Phase 11C Complete**
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

Rules:

* counts must be numbers;
* ready_to_commit must be false if Critical or Medium issues exist;
* suggested_fix_prompt should be targeted if fixes are needed.