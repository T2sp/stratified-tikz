# Phase 11C Implementation Prompt: Preserve relative Bézier control syntax in TikZ export

Environment

The default shell may use Node v16.17.0 at /usr/local/bin/node.

This project requires Node >=22.12.0.

Use:

PATH=/opt/homebrew/bin:$PATH

Verification:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Context

You are working on the StratifiedTikZ project.

Phase 11 implemented improved cubic Bézier editing, including relative/polar control-point editing in the inspector.

Currently, the app may internally convert relative Cartesian or relative polar control input into absolute control-point coordinates. This is fine for rendering and geometry editing.

However, for maintainability of generated TikZ source, the TikZ output should preserve the user’s relative Bézier-control intent where possible.

Manual requirement:
If a cubic Bézier curve’s control points were specified or edited using relative control modes, the generated TikZ path should use TikZ relative control syntax instead of predeclaring independent absolute control-point coordinates.

Desired TikZ forms:

.. controls +(x, y) and +(z, w) .. (end)

for relative Cartesian controls, and:

.. controls +(q_1:r_1) and +(q_2:r_2) .. (end)

for relative polar controls.

For relative modes, independent \coordinate declarations for control points are usually unnecessary and reduce readability.

Goal

Improve cubic Bézier model/edit/export behavior so that:

1. absolute-control Bézier curves continue to work as before;
2. relative Cartesian control input can be preserved and exported as TikZ relative Cartesian control syntax;
3. relative polar control input can be preserved and exported as TikZ relative polar control syntax;
4. relative control points do not need separate TikZ coordinate declarations when exporting the corresponding path;
5. direct cubic Bézier creation can optionally choose absolute / relative Cartesian / relative polar control modes, if practical.

Scope

This is a targeted Phase 11 follow-up.

Do not implement:

* new curve types other than cubic Bézier;
* concatenated paths;
* path joining;
* arbitrary work planes;
* new 3D camera system;
* snapping;
* region strata;
* new TikZ import;
* new dependencies;
* broad UI redesign.

Do not change:

* SVG rendering semantics;
* drag-handle geometry behavior;
* save/load versioning unless necessary;
* non-Bézier TikZ output;
* layer-aware TikZ output;
* Phase 9A coordinate naming for ordinary coordinates;
* existing absolute Bézier behavior except where needed to support the new export mode.

Design principle

Keep the internal geometry robust.

Recommended design:

* Store or derive absolute control-point positions for rendering, hit testing, dragging, and geometry updates.
* Additionally store an optional Bézier-control export/input mode for each cubic Bézier curve or segment.

For example, extend the cubic Bézier model with metadata like:

type CubicBezierControlMode =
  | { kind: "absolute" }
  | {
      kind: "relativeCartesian";
      firstControlOffset: Vec2 | Vec3;
      secondControlOffset: Vec2 | Vec3;
      secondOffsetReference: "end";
    }
  | {
      kind: "relativePolar";
      firstControl: { angleDegrees: number; radius: number };
      secondControl: { angleDegrees: number; radius: number };
      secondOffsetReference: "end";
    };

The exact type can differ, but the model must clearly distinguish:

* absolute control-point mode;
* relative Cartesian mode;
* relative polar mode.

Important TikZ convention:

For a cubic Bézier path

(start) .. controls +(a,b) and +(c,d) .. (end)

the first relative control is relative to the start point, and the second relative control is relative to the end point.

Similarly,

(start) .. controls +(theta1:r1) and +(theta2:r2) .. (end)

uses polar offsets relative to the start and end points respectively.

1. Preserve relative control intent from inspector editing

Inspect the Phase 11 inspector/editor implementation.

When the user edits a cubic Bézier using relative Cartesian controls:

* preserve enough metadata to export as +(x,y) / +(z,w);
* still update absolute control points for rendering;
* keep start/end points unchanged unless the user edits them;
* ensure second control offset is interpreted relative to the end point, not relative to the start point.

When the user edits using relative polar controls:

* preserve angle/radius values where possible;
* still update absolute control points for rendering;
* ensure second polar control is interpreted relative to the end point;
* reject invalid angle/radius input safely;
* radius should be finite and non-negative;
* angles should be finite.

If the user drags control handles directly in SVG, choose a clear policy:

Preferred:

* direct handle dragging changes the control mode to absolute, because the user is now manipulating absolute geometry.

Alternative:

* keep relative mode and recompute relative offsets from the dragged absolute positions.

Choose one policy and document/test it. The preferred policy is simpler and less surprising internally.

2. TikZ export for absolute Bézier curves

Absolute Bézier curves should continue to export correctly.

Existing output may use predeclared coordinates such as:

\coordinate (curveBezierFoo0p0) at (...);
\coordinate (curveBezierFoo0p1) at (...);
\coordinate (curveBezierFoo0p2) at (...);
\coordinate (curveBezierFoo0p3) at (...);
\draw (...) .. controls (...) and (...) .. (...);

This is acceptable for absolute mode.

Do not regress:

* Phase 9A coordinate-name stems;
* duplicate-name disambiguation;
* 2D and 3D coordinates;
* layer-aware TikZ output;
* style output;
* labels;
* comments.

3. TikZ export for relative Cartesian Bézier curves

If a cubic Bézier curve is in relative Cartesian mode, export the path using TikZ relative Cartesian control syntax.

Expected form in 2D:

\draw[<style>] (startCoord)
  .. controls +(dx1,dy1) and +(dx2,dy2) .. (endCoord);

or inline equivalent.

Requirements:

* start and end coordinates may still be predeclared with \coordinate;
* relative control points should not be independently predeclared as \coordinate unless there is a strong reason;
* the path should use +(dx,dy) syntax for controls;
* output should be readable;
* relative offsets should reflect the user’s relative Cartesian input;
* if offsets are internally 3D but the diagram is 2D, z must not appear.

For 3D:
If existing TikZ output supports 3D coordinates in paths, choose a syntax consistent with the current 3D output.

Acceptable options:

* use 3D relative coordinate syntax if supported by the existing generator;
* or fall back to absolute mode for 3D if relative 3D syntax is not reliable, but report/document the limitation.

Preferred:

* support relative Cartesian in 2D at minimum;
* support 3D if the current TikZ coordinate syntax allows it cleanly.

4. TikZ export for relative polar Bézier curves

If a cubic Bézier curve is in relative polar mode, export the path using TikZ relative polar control syntax.

Expected form:

\draw[<style>] (startCoord)
  .. controls +(q1:r1) and +(q2:r2) .. (endCoord);

Requirements:

* start and end coordinates may still be predeclared;
* polar control points should not be independently predeclared as coordinates;
* angles/radii should reflect the user’s relative polar input;
* radius should be finite and non-negative;
* angle should be finite;
* output should be readable;
* avoid unnecessary decimal noise.

For 3D:
TikZ polar syntax is naturally 2D plane-relative. If the current model supports 3D Bézier curves on work planes, decide carefully.

Acceptable policy:

* support polar relative TikZ export for 2D diagrams;
* for 3D diagrams, either:
    * export relative polar only when the curve lies in a known work plane with a clear local 2D basis; or
    * fall back to absolute control coordinates and document/report the limitation.

Do not generate misleading 2D polar syntax for arbitrary 3D curves.

5. Coordinate declarations for relative control modes

Avoid unnecessary coordinate declarations.

For relative Cartesian and relative polar Bézier curves:

* do not emit separate \coordinate definitions for control points if they are only used once as relative controls;
* emit coordinates for start/end points as needed by the existing generator;
* ensure comments/coordinate sections remain readable;
* ensure no dangling coordinate references are produced;
* ensure tests cover absence of control-point coordinate declarations in relative modes.

For absolute mode, existing coordinate declarations may remain.

6. Direct cubic Bézier creation modes

If practical, extend direct cubic Bézier creation so the user can choose one of:

* absolute controls;
* relative Cartesian controls;
* relative polar controls.

Required if implemented:

Absolute direct mode

Existing behavior:

* start;
* control point 1;
* control point 2;
* end.

Relative Cartesian direct mode

Suggested fields:

Start: x, y (, z)
End: x, y (, z)
Control 1 offset from start: dx1, dy1 (, dz1 if supported)
Control 2 offset from end: dx2, dy2 (, dz2 if supported)

Commit behavior:

* compute absolute control points for rendering:
    * c1 = start + offset1;
    * c2 = end + offset2;
* store relative Cartesian metadata for TikZ export.

Relative polar direct mode

Suggested fields:

Start: x, y
End: x, y
Control 1 from start: angle q1, radius r1
Control 2 from end: angle q2, radius r2

Commit behavior:

* compute absolute control points for rendering:
    * c1 = start + polar(q1, r1);
    * c2 = end + polar(q2, r2);
* store relative polar metadata for TikZ export.

If implementing direct relative polar in 3D is ambiguous, restrict polar direct creation to 2D or to a known active work plane and report the limitation.

Validation:

* reject non-finite coordinates;
* reject non-finite offsets;
* reject non-finite angles/radii;
* reject negative radii;
* 2D z normalization remains correct;
* 3D finite coordinate validation remains correct.

If direct relative modes are too large for this task, implement the data/export support first and report direct relative creation as a limitation. However, prefer implementing at least 2D direct relative Cartesian/polar.

7. Save/load compatibility

If the cubic Bézier model gains new metadata, update save/load validation carefully.

Requirements:

* existing saved diagrams without the new metadata still load;
* missing metadata defaults to absolute mode;
* invalid metadata is rejected or normalized safely;
* exported JSON contains only diagram data, not UI state;
* undo/redo, if present, handles the new metadata as part of diagram data.

If the project has versioned saved files, update the version only if the established pattern requires it.

8. Inspector behavior

Update inspector display/editing if needed.

Requirements:

* inspector should show which control mode is active for a cubic Bézier curve;
* switching modes should be possible if Phase 11 already supports it;
* relative Cartesian fields should correspond to offsets from start/end;
* relative polar fields should correspond to angle/radius from start/end;
* editing relative fields should update absolute geometry and metadata consistently;
* invalid input should not corrupt geometry.

If direct handle dragging changes mode to absolute, inspector should reflect that after drag.

9. Rendering and geometry behavior

SVG rendering should remain based on absolute geometry.

Requirements:

* relative mode curves render identically to the equivalent absolute control points;
* selected handles appear in correct positions;
* geometry drag/editing remains stable;
* 2D z stays 0;
* 3D coordinates remain finite.

Do not make SVG rendering depend on TikZ export syntax.

10. Tests

Add focused tests.

Required TikZ tests:

A. Relative Cartesian export

* create a 2D cubic Bézier with relative Cartesian metadata;
* generated TikZ contains:
    * .. controls +(dx1,dy1) and +(dx2,dy2) ..
* generated TikZ does not contain independent coordinate declarations for the two control points;
* start/end coordinates are valid;
* no dangling references.

B. Relative polar export

* create a 2D cubic Bézier with relative polar metadata;
* generated TikZ contains:
    * .. controls +(q1:r1) and +(q2:r2) ..
* generated TikZ does not contain independent coordinate declarations for polar control points;
* radius/angle formatting is stable and readable.

C. Absolute export regression

* existing absolute cubic Bézier export remains unchanged or semantically equivalent;
* control-point coordinate declarations remain valid in absolute mode.

D. Layer-aware output regression

* relative Bézier curves still appear inside the correct layer block;
* Phase 9B layer behavior is not regressed.

Required model/geometry tests:

E. Relative Cartesian conversion

* start/end + offsets produce expected absolute control points;
* second offset is relative to end.

F. Relative polar conversion

* start/end + polar controls produce expected absolute control points;
* negative radius rejected;
* non-finite values rejected.

Required save/load tests if model changes:

G. Missing metadata defaults to absolute.

H. Relative metadata round-trips through save/load.

Required direct creation tests if direct modes implemented:

I. Direct relative Cartesian Bézier creation

* creates curve with correct absolute control points;
* stores relative Cartesian metadata;
* TikZ uses relative Cartesian syntax.

J. Direct relative polar Bézier creation

* creates curve with correct absolute control points;
* stores relative polar metadata;
* TikZ uses relative polar syntax.

11. Documentation

Update relevant docs.

Good places:

* docs/TIKZ_OUTPUT.md;
* docs/DATA_MODEL.md;
* roadmap/phase notes if present.

Document:

* absolute Bézier mode exports as before;
* relative Cartesian mode exports with +(dx,dy) controls;
* relative polar mode exports with +(angle:radius) controls;
* relative controls generally do not get separate coordinate declarations;
* SVG rendering still uses absolute geometry;
* 3D relative polar limitations, if any.

12. Manual verification checklist

After implementation, run:

PATH=/opt/homebrew/bin:$PATH npm run dev

Verify:

1. Create or edit a 2D cubic Bézier in relative Cartesian mode.
2. Confirm SVG curve looks correct.
3. Confirm generated TikZ uses:

.. controls +(x,y) and +(z,w) ..

4. Confirm no separate control-point \coordinate declarations are emitted for the relative controls.
5. Create or edit a 2D cubic Bézier in relative polar mode.
6. Confirm generated TikZ uses:

.. controls +(q_1:r_1) and +(q_2:r_2) ..

7. Confirm no separate control-point \coordinate declarations are emitted for the polar controls.
8. Create an absolute Bézier and confirm absolute export still works.
9. Save/load a relative Bézier diagram and confirm mode/export survives.
10. If direct relative creation is implemented, create relative Cartesian and polar Béziers from direct input and verify export.

13. Preserve existing behavior

Do not regress:

* ordinary point/label creation;
* polyline creation;
* absolute cubic Bézier creation;
* cubic Bézier handle dragging;
* relative/polar inspector editing from Phase 11;
* direct creation validation;
* layer selection for new elements;
* layer filtering;
* selection behavior;
* undo/redo;
* save/load existing diagrams;
* SVG preview;
* TikZ output for non-Bézier elements;
* Phase 9A coordinate names;
* Phase 9B layer-aware output.

14. Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

15. Report after implementation

Please report:

* files modified;
* chosen data model for Bézier control mode metadata;
* how relative Cartesian intent is preserved;
* how relative polar intent is preserved;
* how absolute control points are still available for rendering;
* how TikZ export differs for absolute / relative Cartesian / relative polar;
* how unnecessary control-point coordinate declarations are avoided;
* whether direct cubic Bézier relative Cartesian/polar creation was implemented;
* how save/load compatibility was handled;
* tests added/updated;
* test results;
* build results;
* remaining limitations, especially for 3D relative polar export if any.