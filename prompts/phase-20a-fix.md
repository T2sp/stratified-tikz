# Phase 20A Fix Prompt: Robustly reject malformed boundary path snapshots during save/load

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

Also run if available:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 20A added ruled surface and Coons patch model/sampling utilities.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Malformed persisted boundary path segments can crash load/validation instead of returning a clean rejection.

Observed failure path:

- `normalizeLoadedDiagram` refreshes symbolic previews before full diagram validation.
- Boundary snapshots are passed to `refreshPathSegments` as `PathSegment[]` after only checking:

```ts
Array.isArray(snapshot.segments)
```

in `src/model/symbolicCoordinates.ts`.

- If a saved ruled/Coons boundary has a malformed segment such as:

```ts
{ kind: "line", end: ... }
```

then `refreshPathSegment` calls:

```ts
refreshVec3SymbolicPreview(segment.start, ...)
```

where `segment.start` is `undefined`.

- Then `refreshVec3SymbolicPreview` reads:

```ts
point.symbolic
```

and throws:

```text
TypeError: Cannot read properties of undefined (reading 'symbolic')
```

- This was reproduced with `parseSavedDiagramJson(...)`.

This violates the Phase 20A requirement that invalid persisted boundary data be robustly rejected with `ok: false`, not by throwing.

## Goal

Fix Phase 20A save/load robustness for ruled/Coons boundary surfaces.

Malformed boundary path snapshot data should never crash parsing/loading/normalization.

Instead:

- malformed segment objects should be rejected cleanly;
- `parseSavedDiagramJson(...)` should return `ok: false`;
- validation errors should be informative enough to locate the malformed boundary/segment;
- no invalid diagram should be partially accepted.

## Scope

This is a targeted Phase 20A fix.

Implement:

- robust runtime validation/guards for `BoundaryPathSnapshot.segments`;
- safe symbolic preview refresh for boundary path snapshots;
- tests for malformed persisted ruled/Coons boundary segments.

Do not implement:

- new surface types;
- Phase 20B ruled surface UI;
- Phase 20C Coons patch UI;
- depth sorting;
- visibility/occlusion;
- broad save/load redesign;
- new dependencies.

Do not change:

- valid ruled surface behavior;
- valid Coons patch behavior;
- sampling formulas;
- copied-boundary semantics;
- existing path behavior;
- existing symbolic coordinate behavior for valid data;
- TikZ/SVG output semantics.

## 1. Identify all boundary snapshot refresh paths

Inspect:

- `src/model/symbolicCoordinates.ts`;
- `normalizeLoadedDiagram`;
- `refreshPathSegments`;
- `refreshPathSegment`;
- `refreshVec3SymbolicPreview`;
- ruled surface / Coons patch boundary snapshot normalization;
- diagram validation/load code;
- Phase 20A tests.

Find every place where ruled/Coons `BoundaryPathSnapshot` data is treated as already-valid `PathSegment[]`.

The immediate issue is that `Array.isArray(snapshot.segments)` is not enough. Each segment must be structurally validated before any symbolic preview refresh tries to access `segment.start`, `segment.end`, controls, arc data, etc.

## 2. Add structural guards for path segments before symbolic preview refresh

Add runtime validation helpers, or reuse existing ones, to check raw loaded segment objects before refreshing symbolic previews.

Required segment validation before refresh:

### Line segment

A loaded line segment must have:

- `kind: "line"`;
- valid `start`;
- valid `end`.

Reject if `start` or `end` is missing, malformed, non-object, or structurally invalid.

### Cubic Bézier segment

A loaded cubic segment must have:

- `kind: "cubicBezier"` or the project’s exact cubic kind;
- valid `start`;
- valid `control1`;
- valid `control2`;
- valid `end`.

Reject if any required point is missing or malformed.

### Arc segment, if supported

A loaded arc segment must have all required fields according to the current model, for example:

- `kind: "arc"`;
- valid `start`;
- valid `end`;
- valid `center`;
- finite/valid radius;
- finite/valid angles;
- valid direction;
- valid frame if required.

Reject malformed arc segments cleanly.

### Circle/ellipse template segments or path templates, if they can appear in boundary snapshots

If boundary snapshots can contain template path data, validate required fields before refresh.

If they are not supported in boundary snapshots, reject them cleanly.

## 3. Make symbolic preview refresh failure-safe

The symbolic preview refresh functions should not throw raw `TypeError` when given malformed persisted data.

Preferred behavior:

- validate raw data before calling refresh helpers;
- return a validation error/result if raw data is malformed;
- only call `refreshVec3SymbolicPreview` on structurally valid points.

If existing refresh functions are intended to operate only on trusted data, add a wrapper for loaded/persisted data:

```ts
refreshLoadedBoundaryPathSnapshot(...)
```

or equivalent.

This wrapper should:

1. structurally validate segments;
2. refresh symbolic previews;
3. return success or validation failure.

Do not blindly wrap the entire load path in `try/catch` and swallow errors without producing useful validation failures.

A narrow `try/catch` may be acceptable as a final safety net, but the primary fix should be structural validation.

## 4. Ensure parseSavedDiagramJson returns ok: false

For malformed saved ruled/Coons boundary data, `parseSavedDiagramJson(...)` must return:

```ts
{ ok: false, ... }
```

or the project’s equivalent failure result.

It must not throw.

Add tests that call `parseSavedDiagramJson(...)` directly with malformed JSON.

Required behavior:

- invalid data rejected;
- error message mentions boundary/path/segment enough to debug;
- process does not crash;
- valid diagrams still load.

## 5. Tests

Add focused regression tests.

Required tests:

### Ruled surface malformed boundaries

1. Malformed ruled surface boundary with line segment missing `start`:

```json
{ "kind": "line", "end": { ... } }
```

Expected:

- `parseSavedDiagramJson(...)` returns `ok: false`;
- no thrown exception.

2. Malformed ruled surface boundary with line segment missing `end`.

3. Malformed ruled surface boundary with cubic segment missing `control1`.

4. Malformed ruled surface boundary with cubic segment missing `start`.

5. Malformed ruled surface boundary with unknown segment kind.

6. Malformed ruled surface boundary where `segments` is not an array.

### Coons patch malformed boundaries

7. Malformed Coons patch boundary with line segment missing `start`.

8. Malformed Coons patch boundary with cubic segment missing `control2`.

9. Malformed Coons patch boundary with malformed arc segment if arcs are supported.

10. Malformed Coons patch boundary with unknown segment kind.

11. Coons patch with one malformed boundary among otherwise valid boundaries returns `ok: false`.

### Valid regression tests

12. Valid ruled surface saved diagram still loads.

13. Valid Coons patch saved diagram still loads.

14. Symbolic coordinates in valid boundary snapshots still refresh correctly.

15. Existing path/filled-region/curved-sheet save/load tests still pass.

### No-throw assertion

For all malformed tests, assert no exception is thrown.

Use something like:

```ts
expect(() => parseSavedDiagramJson(json)).not.toThrow();
expect(parseSavedDiagramJson(json).ok).toBe(false);
```

or the project’s equivalent pattern.

## 6. Error reporting

Make errors useful but not overly verbose.

Good messages:

```text
Invalid ruled surface boundary segment at boundary0.segments[0]: missing start
```

```text
Invalid Coons patch boundary "left" segment 2: missing control2
```

Exact text can differ.

Avoid raw TypeError messages as user-facing validation output.

## 7. Preserve valid symbolic behavior

Do not break symbolic coordinate support.

Valid boundary points may contain:

- numeric coordinates;
- symbolic coordinate metadata;
- preview values.

Valid symbolic boundary snapshots should still be refreshed/evaluated using existing variable definitions.

Do not remove symbolic support from boundary snapshots.

## 8. Preserve existing behavior

Do not regress:

- valid ruled surface model;
- valid Coons patch model;
- boundary deep-copy behavior;
- ruled sampling;
- Coons sampling;
- Coons corner compatibility validation;
- existing path save/load;
- existing filled region/sheet save/load;
- symbolic coordinate save/load;
- SVG preview;
- TikZ export;
- inline/standalone export modes.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

If practical, manually test:

1. Load a valid diagram containing a ruled surface.
2. Confirm it loads.
3. Load a valid diagram containing a Coons patch.
4. Confirm it loads.
5. Modify saved JSON to remove `start` from a ruled boundary line segment.
6. Confirm the app rejects the file gracefully instead of crashing.
7. Modify saved JSON to remove `control1` from a Coons boundary cubic segment.
8. Confirm graceful rejection.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of the crash;
- structural validation added for boundary snapshots;
- how symbolic preview refresh now avoids malformed segments;
- how `parseSavedDiagramJson(...)` reports failure;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
