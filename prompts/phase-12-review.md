# Phase 12 Review Prompt: Custom work planes and work-plane-local TikZ export

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

## Review instructions

Review Phase 12 only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set:

```json
"ready_to_commit": false
```

If only Low-priority issues remain, set:

```json
"ready_to_commit": true
```

## Phase 12 goal

Phase 12 should implement custom 3D work planes and use them for work-plane-local 3D Bézier relative-control TikZ export.

Required work-plane capabilities:

1. define a custom work plane by origin + normal vector;
2. define a custom work plane by three numeric points;
3. preferably define a custom work plane from three existing point strata.

Required export capability:

- if a 3D cubic Bézier curve has relative Cartesian or relative polar controls in a known work-plane-local frame, generated TikZ should emit that curve inside a TikZ `3d` library `scope` using `plane origin`, `plane x`, `plane y`, and `canvas is plane`, so the path inside the scope can use 2D-style relative control syntax.

Required design properties:

- active work planes are editor/UI state, not `Diagram` data;
- custom work-plane guides are preview-only;
- custom work-plane guides are not exported to TikZ;
- geometry created on custom planes is ordinary committed `Vec3` diagram data;
- persistent Bézier metadata may include a work-plane frame snapshot if needed for faithful export;
- future 3D camera work remains feasible through work-plane/camera separation.

## Subphase review map

Assess the implementation against:

- 12A: WorkPlane model and geometry utilities.
- 12B: Custom plane from origin + normal.
- 12C: Custom plane from three numeric points.
- 12D: Custom plane from three existing point strata.
- 12E: Custom work-plane preview and creation integration.
- 12F: Camera-ready projection/export separation.
- 12G: Work-plane-local cubic Bézier metadata.
- 12H: TikZ `3d` library scope export for work-plane-local Béziers.

## Scope review

Phase 12 should not add unrelated features:

- full 3D camera orbit/pan/zoom UI;
- perspective projection;
- TikZ import;
- snapping;
- region strata;
- curved-boundary sheets;
- new dependencies;
- broad UI redesign.

Classify unrelated work according to severity.

## Review checklist

### 1. WorkPlane model and geometry utilities

Check custom work planes include:

- `origin: Vec3`;
- `u: Vec3`;
- `v: Vec3`;
- `normal: Vec3`.

Check:

- values are finite;
- vectors are approximately normalized and orthogonal;
- handedness is documented or consistent;
- active custom work-plane state is not stored as ordinary `Diagram` data.

If only origin+normal is stored without in-plane basis vectors, classify as Medium.

Check helpers/logic for:

- dot/cross/norm/normalize;
- finite checks;
- construction from origin+normal;
- construction from three points;
- validation;
- local-to-global and global-to-local plane coordinate conversion;
- custom screen-to-model placement.

Invalid cases must be handled:

- zero normal rejected;
- non-finite input rejected;
- coincident points rejected;
- collinear points rejected;
- no `NaN`/`Infinity` plane data.

### 2. Origin + normal UI

Check:

- 3D-only UI exists;
- origin x/y/z and normal nx/ny/nz can be specified;
- finite valid input applies custom plane;
- zero normal rejected;
- invalid input does not corrupt previous work-plane state;
- 2D mode hides/disables it.

Missing origin+normal UI is Medium.

### 3. Three numeric points UI

Check:

- 3D-only UI exists;
- three finite points can be specified;
- valid non-collinear input applies custom plane;
- collinear/coincident input rejected;
- `p0` used as origin or policy documented;
- `p1 - p0` determines `u` or policy documented;
- invalid input does not corrupt previous state.

Missing three-point numeric UI is Medium.

### 4. Existing point-strata plane creation

Check whether the implementation supports defining a plane from three existing point strata.

Preferred behavior:

- point-picking mode or equivalent;
- only point strata are pickable;
- three distinct point IDs required;
- duplicates rejected;
- collinear point strata rejected;
- cancel/reset works;
- picking state is UI state only;
- creation tools do not accidentally create geometry while picking.

Because the user explicitly wanted this, missing it should usually be Medium unless clearly staged and documented.

### 5. Cursor creation on custom work planes

Check cursor creation works on active custom planes in 3D:

- point;
- label;
- polyline;
- cubic Bézier;
- 3D polygon sheet.

Created vertices should lie on the custom plane. Geometry should render in SVG, export to TikZ, and preserve creation layer/filter/selection behavior.

If cursor creation ignores custom planes, classify as Medium.

### 6. Work-plane preview

Check custom plane preview:

- visible in 3D when custom plane active;
- preview-only;
- not selectable;
- does not intercept pointer events;
- not stored in `Diagram`;
- not exported to TikZ;
- visually distinct from sheet strata.

If guide intercepts clicks or is exported, classify as Medium.

### 7. Camera-ready separation

Check:

- work plane is model-space geometry;
- projection/camera is separate;
- code structure does not bake camera assumptions into work-plane data;
- future screen-ray + plane-intersection approach remains feasible.

Hardcoding custom planes to one projection in a way that blocks future camera work is Medium.

### 8. Save/load and undo/redo

Check:

- saved JSON does not include transient active custom work-plane UI state;
- loading resets or validates active work-plane state;
- no stale active point-ID references after load.

Important distinction:

- It is acceptable for individual cubic Bézier curves to store persistent work-plane frame metadata if required for faithful TikZ export.
- It is not acceptable to serialize transient active work-plane UI state without a clear format decision.

If undo/redo exists:

- setting active work plane should not create a diagram history entry;
- geometry created on custom plane is undoable like ordinary creation;
- work-plane picking state is cleared/validated after undo/redo.

### 9. Work-plane-local cubic Bézier metadata

Check that eligible 3D relative Cartesian / relative polar Bézier curves preserve enough information for work-plane-local export.

Expected:

- absolute `Vec3` controls remain available for rendering/editing;
- relative Cartesian or relative polar metadata is preserved;
- a work-plane frame snapshot is stored for that curve if needed:
  - origin;
  - `u`;
  - `v`;
  - normal;
- local start/end coordinates can be computed or are stored consistently;
- export does not depend on the currently active UI work plane.

If the implementation relies on current active work-plane state at export time, classify as Medium.

### 10. TikZ `3d` library scope export

Check eligible 3D work-plane-local relative Bézier export.

Required for relative polar:

- generated TikZ includes `\usetikzlibrary{3d}` when needed;
- generated TikZ contains a scope with:
  - `plane origin`;
  - `plane x`;
  - `plane y`;
  - `canvas is plane`;
- inside the scope, the path uses:
  - `.. controls +(q1:r1) and +(q2:r2) ..`;
- independent `\coordinate` declarations for the relative control points are not emitted;
- start/end coordinates are valid in local 2D scope coordinates;
- no dangling references.

Required for relative Cartesian:

- generated TikZ contains a scope with `canvas is plane`;
- inside the scope, the path uses:
  - `.. controls +(dx1,dy1) and +(dx2,dy2) ..`;
- independent control-point coordinate declarations are not emitted.

If a 3D work-plane-local relative curve exports as plain `+(q:r)` outside a `canvas is plane` scope, classify as Medium.

If the scope syntax is invalid TikZ, classify as Critical or Medium depending on severity.

### 11. Fallback export behavior

Check fallback behavior:

- 3D absolute Béziers without work-plane-local metadata still export using existing absolute 3D control syntax;
- arbitrary 3D curves not representable in one work-plane frame do not get misleading local-scope relative export;
- 2D relative Cartesian/polar export remains unchanged;
- Phase 9A coordinate names and Phase 9B layer output are preserved.

### 12. 2D behavior

Check:

- custom 3D work-plane UI hidden/disabled in 2D;
- 2D creation still keeps z = 0;
- switching 2D/3D does not leave invalid work-plane state;
- no crashes.

### 13. Tests

Check tests cover:

- origin+normal construction;
- zero normal rejection;
- non-finite input rejection;
- three-point construction;
- collinear/coincident rejection;
- approximate orthonormal basis;
- custom screen-to-model points lie on the plane;
- cursor-created point or path lies on custom plane;
- existing point-strata picking if implemented;
- TikZ excludes active work-plane guide/state;
- save JSON excludes active work-plane state;
- work-plane-local 3D relative polar Bézier exports with `\usetikzlibrary{3d}` and `scope[canvas is plane]`;
- work-plane-local 3D relative Cartesian Bézier exports with `scope[canvas is plane]`;
- relative control-point coordinate declarations are omitted in scoped relative export;
- absolute 3D Bézier fallback still works;
- 2D relative export unchanged.

Missing geometry validation tests: usually Medium. Missing creation-on-custom-plane tests: usually Medium. Missing scoped TikZ export tests: Medium.

### 14. Documentation

Check docs mention:

- work planes are UI/editor state;
- origin+normal mode;
- three numeric points mode;
- existing point-strata picking if implemented;
- internal `origin/u/v/normal` representation;
- guides are not exported to TikZ;
- geometry created on work planes is ordinary diagram data;
- camera/projection separation;
- work-plane-local Bézier export with TikZ `3d` library `canvas is plane`;
- fallback behavior;
- control-point coordinate declaration policy.

Missing docs are usually Low unless behavior is ambiguous.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Report results.

## Output format

Use this structure:

```markdown
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

**Ready To Call Phase 12 Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt.
```

Then output:

```text
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
```

Rules:

- counts must be numbers;
- `ready_to_commit` must be false if Critical or Medium issues exist;
- `suggested_fix_prompt` should be targeted if fixes are needed.
