Phase 12A Fix Prompt: Validate malformed axis-aligned work-plane names

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

Phase 12A implemented the WorkPlane model and geometry utilities.

Review result:

* Tests pass.
* Build passes.
* No Critical issues.
* One Medium issue remains.

Medium issue:

* src/geometry/workPlane.ts has an AxisAlignedWorkPlane shape.
* validateWorkPlane accepts malformed axis-aligned planes when plane is not one of:
    * "xy";
    * "xz";
    * "yz".
* It only validates offset.
* Then workPlaneToBasis calls axisAlignedBasis with the invalid name.
* axisAlignedBasis returns undefined rather than a rejected validation result.
* This violates Phase 12A requirements:
    * invalid inputs must be rejected;
    * exported geometry helpers should not silently accept malformed work-plane data;
    * coordinate/basis helpers should not run on invalid axis-aligned plane names.

Goal

Add runtime validation for AxisAlignedWorkPlane.plane.

Malformed axis-aligned work-plane names must be rejected before workPlaneToBasis or coordinate helpers run.

This is a targeted Phase 12A fix.

Scope

Do not implement:

* Phase 12B UI;
* Phase 12C three-point UI;
* Phase 12D point picking;
* custom work-plane preview UI;
* cursor creation on custom planes;
* TikZ 3d scope export;
* camera controls;
* new dependencies;
* broad geometry refactors.

Do not change:

* WorkPlane model shape unless absolutely necessary;
* valid axis-aligned work-plane behavior;
* valid custom work-plane behavior;
* TikZ output;
* save/load;
* diagram data model.

Required fix

Inspect:

* src/geometry/workPlane.ts;
* AxisAlignedWorkPlane;
* axisAlignedWorkPlane;
* axisAlignedBasis;
* validateWorkPlane;
* workPlaneToBasis;
* coordinate conversion helpers using axis-aligned planes.

Add a runtime validator for axis-aligned plane names.

Allowed values:

"xy" | "xz" | "yz"

Suggested helper:

function isAxisAlignedPlaneName(value: unknown): value is "xy" | "xz" | "yz" {
  return value === "xy" || value === "xz" || value === "yz";
}

or:

function assertAxisAlignedPlaneName(value: unknown): "xy" | "xz" | "yz" {
  if (value !== "xy" && value !== "xz" && value !== "yz") {
    throw new Error("Axis-aligned work-plane name must be one of xy, xz, or yz.");
  }
  return value;
}

Use whichever style is consistent with existing validation.

Required behavior

axisAlignedWorkPlane

If axisAlignedWorkPlane is exported or can receive runtime values, validate its plane argument.

Required:

* axisAlignedWorkPlane("xy", offset) works;
* axisAlignedWorkPlane("xz", offset) works;
* axisAlignedWorkPlane("yz", offset) works;
* malformed values such as "zy", "abc", "", null, undefined, or a number are rejected at runtime;
* non-finite offset continues to be rejected.

validateWorkPlane

For axis-aligned planes, validate both:

* plane.plane;
* plane.offset.

Required:

* valid axis-aligned planes pass;
* malformed axis-aligned plane names fail validation or throw according to existing validation style;
* invalid plane names must not be treated as valid merely because offset is finite.

If validateWorkPlane currently returns boolean, return false for malformed axis-aligned names.

If validateWorkPlane currently throws for invalid inputs, throw consistently.

axisAlignedBasis

Ensure axisAlignedBasis cannot silently return undefined for invalid names in a way that later helpers treat as acceptable.

Acceptable approaches:

1. make axisAlignedBasis validate and throw on invalid plane names;
2. make it return an explicit failure result;
3. make callers validate before calling and still guard defensively.

Preferred:

* centralize validation and throw clearly for invalid runtime values.

workPlaneToBasis

Ensure workPlaneToBasis rejects malformed axis-aligned planes before returning basis data.

Required:

* no undefined basis is returned;
* no downstream helper receives an invalid plane name silently.

Coordinate helpers

If there are helpers converting points to/from work-plane coordinates, ensure malformed axis-aligned plane names are rejected before use.

Tests

Add focused regression tests.

Required tests:

1. axisAlignedWorkPlane("xy", finiteOffset) succeeds.
2. axisAlignedWorkPlane("xz", finiteOffset) succeeds.
3. axisAlignedWorkPlane("yz", finiteOffset) succeeds.
4. axisAlignedWorkPlane("zy" as any, finiteOffset) is rejected.
5. axisAlignedWorkPlane("abc" as any, finiteOffset) is rejected.
6. axisAlignedWorkPlane("" as any, finiteOffset) is rejected.
7. axisAlignedWorkPlane(null as any, finiteOffset) is rejected if TypeScript/runtime path allows testing it.
8. axisAlignedWorkPlane(undefined as any, finiteOffset) is rejected if practical.
9. validateWorkPlane rejects an axis-aligned object with malformed plane.
10. workPlaneToBasis rejects an axis-aligned object with malformed plane.
11. Coordinate conversion helpers reject malformed axis-aligned plane names if applicable.
12. Existing valid xy, xz, yz tests still pass.

Use as any in tests where needed to simulate malformed runtime data that bypasses TypeScript.

Also ensure existing Phase 12A tests still pass:

* origin+normal construction;
* three-point construction;
* axis-aligned compatibility;
* local/global coordinate conversion;
* invalid point/vector cases;
* invalid epsilon tests;
* patch finiteness tests.

Documentation / comments

If useful, add a short comment near the axis-aligned validation helper:

* runtime validation is needed because malformed objects may come from parsed JSON, tests, or unsafe casts;
* valid axis-aligned plane names are exactly "xy", "xz", and "yz".

Do not add large unrelated documentation.

Preserve existing behavior

Do not regress:

* valid xy, xz, yz work planes;
* custom WorkPlane model;
* origin+normal construction;
* three-point construction;
* finite basis validation;
* handedness;
* local-to-global and global-to-local coordinate conversion;
* createWorkPlanePatch size validation/finiteness behavior;
* epsilon validation behavior;
* existing tests.

Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Report after implementation

Please report:

* files modified;
* root cause of the malformed axis-aligned validation issue;
* runtime validation policy for axis-aligned plane names;
* which helpers now validate axis-aligned plane names;
* how axisAlignedBasis avoids returning undefined silently;
* how workPlaneToBasis rejects malformed axis-aligned planes;
* tests added/updated;
* test results;
* build results;
* remaining limitations.