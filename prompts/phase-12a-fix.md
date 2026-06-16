# Phase 12A Fix Prompt: Validate WorkPlane epsilon inputs

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

* src/geometry/workPlane.ts exports geometry helpers that accept optional epsilon.
* These helpers do not validate epsilon.
* With epsilon = NaN, normalizeVector({ x: 0, y: 0, z: 0 }, NaN) returns { x: NaN, y: NaN, z: NaN } instead of rejecting.
* With epsilon = Infinity or epsilon = NaN, validateWorkPlane can disable normalized/orthogonal/handedness checks.
* This violates Phase 12A requirements:
    * invalid inputs must be rejected;
    * helpers must not produce NaN or infinite geometry;
    * validation must not silently pass invalid work-plane data.

Goal

Validate WorkPlane epsilon inputs everywhere they are accepted.

Invalid epsilon values must not allow:

* NaN vectors;
* infinite vectors;
* false-positive validation;
* disabled normalization/orthogonality/handedness checks.

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
* existing valid work-plane construction behavior;
* axis-aligned work-plane behavior;
* TikZ output;
* save/load;
* diagram data model.

Required fix

Inspect:

* src/geometry/workPlane.ts;
* normalizeVector;
* origin+normal work-plane constructor;
* three-point work-plane constructor;
* validateWorkPlane;
* any other exported WorkPlane geometry helper that accepts an optional epsilon.

Add centralized epsilon validation.

Preferred helper:

function validateEpsilon(epsilon: number): number {
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new Error("epsilon must be a finite positive number.");
  }
  return epsilon;
}

The exact name can differ.

Requirements:

1. epsilon = NaN is rejected.
2. epsilon = Infinity is rejected.
3. epsilon = -Infinity is rejected.
4. epsilon = 0 is rejected.
5. negative epsilon is rejected.
6. valid finite positive epsilon still works.
7. default epsilon still works.
8. normalizeVector must never return a vector containing NaN or Infinity.
9. constructors must not accept invalid epsilon.
10. validateWorkPlane must not accept invalid epsilon or use it to bypass normalized/orthogonal/handedness checks.
11. invalid epsilon should fail loudly and consistently, preferably by throwing, if that matches the existing validation style.

Specific cases to fix

normalizeVector

Current bad behavior:

normalizeVector({ x: 0, y: 0, z: 0 }, NaN)

may return:

{ x: NaN, y: NaN, z: NaN }

Required behavior:

* reject invalid epsilon before comparing norms;
* reject zero vector correctly;
* never return non-finite components.

WorkPlane constructors

Both construction paths should validate epsilon:

* constructWorkPlaneFromOriginNormal(..., epsilon?);
* constructWorkPlaneFromThreePoints(..., epsilon?);
* any options object carrying epsilon.

Invalid epsilon should prevent construction.

validateWorkPlane

validateWorkPlane(plane, epsilon) or equivalent must validate epsilon before using it.

Invalid epsilon must not make checks vacuous.

In particular:

* epsilon = Infinity must not make every norm/dot/cross check pass;
* epsilon = NaN must not accidentally bypass checks;
* invalid epsilon should throw or return validation failure consistently with existing style.

Tests

Add focused regression tests.

Required tests:

1. normalizeVector rejects NaN epsilon.
2. normalizeVector rejects Infinity epsilon.
3. normalizeVector rejects -Infinity epsilon.
4. normalizeVector rejects zero epsilon.
5. normalizeVector rejects negative epsilon.
6. normalizeVector with invalid epsilon never returns non-finite vector components.
7. constructWorkPlaneFromOriginNormal rejects invalid epsilon.
8. constructWorkPlaneFromThreePoints rejects invalid epsilon.
9. validateWorkPlane rejects invalid epsilon.
10. validateWorkPlane does not pass malformed/non-orthonormal planes under epsilon = Infinity or NaN.
11. Valid finite positive epsilon still works.
12. Default epsilon still works.

Also ensure existing Phase 12A tests still pass:

* origin+normal construction;
* three-point construction;
* axis-aligned compatibility;
* local/global coordinate conversion;
* invalid point/vector cases;
* patch finiteness tests.

Documentation / comments

If useful, add a short comment near the epsilon helper:

* epsilon must be finite and positive;
* invalid epsilon is treated as invalid input;
* geometry helpers should not use invalid tolerance values.

Do not add large unrelated documentation.

Preserve existing behavior

Do not regress:

* custom WorkPlane model;
* origin+normal construction;
* three-point construction;
* finite basis validation;
* handedness;
* axis-aligned xy, xz, yz compatibility;
* local-to-global and global-to-local coordinate conversion;
* createWorkPlanePatch size validation/finiteness behavior from the previous fix;
* existing tests.

Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Report after implementation

Please report:

* files modified;
* root cause of the epsilon validation issue;
* centralized epsilon validation policy;
* which helpers now validate epsilon;
* how normalizeVector is prevented from returning non-finite vectors;
* how validateWorkPlane avoids false positives under invalid epsilon;
* tests added/updated;
* test results;
* build results;
* remaining limitations.