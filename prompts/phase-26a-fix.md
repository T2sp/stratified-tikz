# Phase 26A Fix Prompt: Robustly reject malformed global coordinate-anchor positions during save/load

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

Also run:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 26A introduced global TikZ coordinate anchors.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Malformed global coordinate-anchor positions can throw during save/load instead of being reported as validation errors.

Observed failure path:

- In `src/model/symbolicCoordinates.ts`, malformed global coordinate-anchor values return `null` without adding an error.
- Load then continues into symbolic-preview refresh.
- A later call to `coordinateAnchorPositionToVec3(...)` dereferences:

```ts
position.value.x
position.value.y
position.value.z
```

- For a saved anchor like:

```ts
position: {
  kind: "global",
  value: {}
}
```

this throws:

```text
Cannot read properties of undefined
```

instead of making `parseSavedDiagramJson(...)` return:

```ts
{ ok: false, ... }
```

This violates the Phase 26A requirement that malformed saved coordinate-anchor data be rejected cleanly.

## Goal

Fix Phase 26A coordinate-anchor load validation so malformed global anchor positions are reported as saved-diagram validation errors before symbolic-preview refresh can dereference missing fields.

Specifically:

1. Malformed global coordinate-anchor positions must never throw raw `TypeError`.
2. `parseSavedDiagramJson(...)` must return `ok: false` for malformed coordinate anchors.
3. Validation errors should identify the malformed coordinate-anchor path.
4. Valid coordinate anchors should still load, refresh, validate, and export correctly.
5. Add regression tests for missing/invalid `position.value.x/y/z`.

## Scope

This is a targeted Phase 26A fix.

Implement:

- structural validation for global coordinate-anchor positions before refresh;
- robust error reporting for malformed coordinate-anchor position fields;
- no-throw behavior for malformed saved coordinate anchors;
- regression tests.

Do not implement:

- new coordinate anchor features;
- Add coordinate UI changes;
- coordinate references;
- detach behavior;
- preview marker changes;
- broad save/load redesign;
- new dependencies.

Do not change:

- valid coordinate-anchor model;
- valid global coordinate-anchor behavior;
- valid work-plane-local coordinate-anchor behavior;
- TikZ coordinate-anchor export placement;
- old diagram load behavior;
- inline/standalone TikZ formatting;
- layer/New layer independence.

## 1. Inspect coordinate-anchor load and refresh paths

Inspect:

- `src/model/symbolicCoordinates.ts`;
- `src/model/coordinateAnchors.ts`;
- `src/model/serialization.ts`;
- `src/model/validation.ts`;
- `parseSavedDiagramJson(...)`;
- coordinate-anchor normalization/refresh helpers;
- `coordinateAnchorPositionToVec3(...)`.

Find every path that assumes a global anchor position has:

```ts
position.value.x
position.value.y
position.value.z
```

without first structurally validating those fields.

The review points to the immediate problem:

```text
malformed global values return null without adding an error
then coordinateAnchorPositionToVec3 dereferences missing x/y/z
```

## 2. Validate global coordinate-anchor position shape before refresh

For a coordinate anchor with:

```ts
position.kind === "global"
```

require:

```ts
position.value
position.value.x
position.value.y
position.value.z
```

to be present and structurally valid.

Each component should be valid according to the existing coordinate component model, for example:

- numeric coordinate component;
- symbolic coordinate component with expression/preview structure;
- existing supported scalar/coordinate source shape.

Reject:

- missing `position.value`;
- missing `position.value.x`;
- missing `position.value.y`;
- missing `position.value.z`;
- malformed component objects;
- non-finite numeric values;
- unsupported symbolic source shapes;
- stale/unresolved symbolic values according to existing symbolic validation policy.

Do not allow malformed values to pass into preview refresh.

## 3. Return validation errors instead of null-without-error

If a helper currently returns `null` for malformed coordinate-anchor data without recording an error, change it.

Preferred behavior:

```ts
return {
  ok: false,
  errors: [
    "coordinateAnchors[0].position.value.x is required"
  ]
}
```

or the project's existing validation error/result format.

If the helper must return `null` for legacy reasons, ensure the caller records a validation error and stops refresh.

Do not silently drop malformed coordinate anchors unless the saved format explicitly allows stripping invalid anchors. Preferred: reject the saved diagram.

## 4. Guard `coordinateAnchorPositionToVec3`

`coordinateAnchorPositionToVec3(...)` may be intended to operate on trusted data, but it should not crash on user-loaded malformed data if reachable.

Preferred fix:

- make malformed data impossible to reach it from load/refresh paths by validating earlier.

Additional safety:

- add defensive checks in `coordinateAnchorPositionToVec3(...)` or its callers;
- return a result/error or throw a controlled validation error if data is invalid.

Avoid raw JavaScript errors such as:

```text
Cannot read properties of undefined
```

in user-facing load paths.

## 5. Ensure `parseSavedDiagramJson` catches this cleanly

For malformed saved coordinate anchors:

```ts
parseSavedDiagramJson(json)
```

should:

- not throw;
- return `ok: false`;
- include an error message that points to the malformed coordinate anchor.

Example acceptable messages:

```text
coordinateAnchors[0].position.value.x is required.
```

```text
Saved diagram is invalid: coordinateAnchors[0].position.value must contain x, y, and z.
```

```text
Invalid global coordinate-anchor position at coordinateAnchors[0].position.value.
```

Exact wording can differ, but it should not be a raw TypeError.

## 6. Preserve valid behavior

Do not regress what the review says is already correct:

- Coordinate anchors are modeled separately from point strata in `Diagram.coordinateAnchors`.
- Coordinate anchors have no layer, codimension, or style fields.
- Validation rejects `layer`.
- Old diagrams without `coordinateAnchors` load with an empty list.
- Runtime validation rejects duplicate anchor IDs and duplicate/invalid TikZ names.
- Valid global anchors round-trip.
- Valid work-plane-local anchors round-trip.
- TikZ exports coordinate anchors before drawing coordinates and layer drawing commands.
- Coordinate anchors are emitted outside `pgfonlayer`.
- Inline math output remains blank-line-free.
- Layer visibility and New layer metadata do not suppress coordinate-anchor export.

## 7. Tests

Add focused regression tests.

### Malformed global position tests

1. Saved coordinate anchor with:

```ts
position: { kind: "global", value: {} }
```

makes `parseSavedDiagramJson(...)` return `ok: false`, not throw.

2. Missing `position.value.x` returns `ok: false`, not throw.

3. Missing `position.value.y` returns `ok: false`, not throw.

4. Missing `position.value.z` returns `ok: false`, not throw.

5. `position.value.x = undefined` returns `ok: false`, not throw.

6. `position.value.x = {}` malformed component returns `ok: false`, not throw.

7. Non-finite numeric component returns `ok: false`.

8. Unsupported symbolic component shape returns `ok: false`.

### No-throw assertions

For every malformed fixture above:

```ts
expect(() => parseSavedDiagramJson(json)).not.toThrow();
expect(result.ok).toBe(false);
```

or the project’s equivalent pattern.

### Valid regression tests

9. Valid numeric global coordinate anchor still loads.

10. Valid symbolic global coordinate anchor still loads after variable resolution.

11. Valid work-plane-local coordinate anchor still loads.

12. Old diagrams with no `coordinateAnchors` still load.

13. Duplicate TikZ name validation still works.

14. Coordinate anchor with forbidden `layer` still rejected.

15. TikZ export for valid coordinate anchors still emits `\coordinate` before drawing commands.

16. Inline output with valid coordinate anchors still has no blank lines.

## 8. Optional helper tests

If you introduce a structural validation helper, add pure tests:

```ts
validateLoadedCoordinateAnchorPosition(...)
validateGlobalCoordinateAnchorPositionShape(...)
```

Test:

- valid numeric global;
- valid symbolic global;
- missing value;
- missing x/y/z;
- malformed component;
- unsupported source.

This keeps the save/load tests smaller and easier to debug.

## 9. Error-message quality

Error messages should be path-aware.

Preferred path format:

```text
coordinateAnchors[0].position.value.x
```

or existing project path style.

Avoid generic messages like:

```text
Invalid coordinate anchor.
```

unless accompanied by field detail.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

If practical, manually test:

1. Create a valid coordinate anchor.
2. Save JSON.
3. Edit JSON to make:

```json
"position": { "kind": "global", "value": {} }
```

4. Load JSON.
5. Confirm app shows a clean validation error.
6. Confirm app does not crash.
7. Load the original valid JSON.
8. Confirm it still loads and exports.

## 11. Preserve existing behavior

Do not regress:

- coordinate-anchor model;
- valid global coordinate anchors;
- valid work-plane-local coordinate anchors;
- old diagram load;
- TikZ coordinate export;
- variable resolution;
- inline no-blank-lines;
- 4-space indentation;
- layer/New layer independence;
- save/load;
- undo/redo.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 13. Report after implementation

Please report:

- files modified;
- root cause of the malformed global-anchor crash;
- where structural validation was added;
- how malformed `position.value.x/y/z` are reported;
- whether `coordinateAnchorPositionToVec3` was made defensive;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
