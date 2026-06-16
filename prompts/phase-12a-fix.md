Phase 12A Fix Prompt: Validate work-plane patch size

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

* src/geometry/workPlanePatch.ts has a helper createWorkPlanePatch.
* createWorkPlanePatch does not validate options.size.
* Passing Infinity, NaN, or an overflowing finite size can produce non-finite patch corners.
* Phase 12A requires geometry helpers not to produce NaN or infinite coordinates.
* Non-finite input producing geometry is a Medium issue.

Goal

Fix createWorkPlanePatch so invalid or unsafe options.size values cannot produce non-finite patch corners.

This is a targeted Phase 12A fix.

Scope

Do not implement:

* Phase 12B UI;
* Phase 12C three-point UI;
* Phase 12D point picking;
* custom work-plane preview UI beyond this helper;
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

* src/geometry/workPlanePatch.ts
* createWorkPlanePatch
* existing tests for work-plane geometry helpers.

Update createWorkPlanePatch so that:

1. options.size is validated before computing patch corners.
2. NaN is rejected.
3. Infinity and -Infinity are rejected.
4. negative or zero sizes are rejected or normalized according to a clearly documented policy.
    * Preferred: reject size <= 0.
5. overflowing finite values that would produce non-finite corners are rejected.
6. returned patch corners are guaranteed finite.
7. invalid size input should not silently produce invalid geometry.

Acceptable implementation options:

* Throw a clear error for invalid size.
* Or return a failure/result type if existing geometry helpers use that style.

Prefer consistency with existing Phase 12A helper validation style.

If other geometry helpers already use thrown errors for invalid input, use thrown errors here too.

Suggested validation policy

Use a helper such as:

function assertFinitePositiveSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Work-plane patch size must be a finite positive number.");
  }
  return size;
}

Also verify the computed corners:

const corners = [...];
if (!corners.every(isFiniteVec3)) {
  throw new Error("Work-plane patch produced non-finite corners.");
}

This second check is important because an extremely large but finite size may overflow when multiplied by basis vectors or added to the origin.

If the project already has an epsilon or geometry validation helper, reuse it.

Tests

Add focused regression tests.

Required tests:

1. createWorkPlanePatch rejects NaN size.
2. createWorkPlanePatch rejects Infinity size.
3. createWorkPlanePatch rejects -Infinity size.
4. createWorkPlanePatch rejects zero size.
5. createWorkPlanePatch rejects negative size.
6. createWorkPlanePatch rejects or safely handles overflowing finite size values that would produce non-finite corners.
7. For a valid finite positive size, createWorkPlanePatch returns finite corners.

If the helper throws, use toThrow.

If the helper returns a result object, assert that invalid inputs return failure.

Also ensure existing Phase 12A tests still pass:

* origin+normal construction;
* three-point construction;
* axis-aligned compatibility;
* local/global coordinate conversion;
* invalid constructor input cases.

Documentation

If there is a small geometry helper doc or comment near createWorkPlanePatch, document:

* size must be a finite positive number;
* patch corners are guaranteed finite for successful calls.

Do not add large unrelated docs.

Preserve existing behavior

Do not regress:

* custom WorkPlane model;
* origin+normal construction;
* three-point construction;
* finite basis validation;
* handedness;
* axis-aligned xy, xz, yz compatibility;
* local-to-global and global-to-local coordinate conversion;
* existing tests.

Verification

Run:

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Report after implementation

Please report:

* files modified;
* root cause of the invalid patch corner issue;
* validation policy for options.size;
* how overflowing finite sizes are handled;
* how finite returned corners are guaranteed;
* tests added/updated;
* test results;
* build results;
* remaining limitations.