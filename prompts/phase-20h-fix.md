# Phase 20H Fix Prompt: Allow symbolic work-plane frame coordinates after variable resolution

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

Phase 19G and Phase 20H are complete.

A previous fix changed JSON loading so symbolic boundary path coordinates can be resolved by asking the user for variable values before rendering.

However, loading the attached JSON still fails with:

```text
Could not load diagram: strata[3].primitive.bottom.segments[0].frame.origin Work-plane frame coordinates must be numeric because this export path derives numeric coordinates from the frame.
```

This means the loader now handles symbolic boundary point coordinates better, but still rejects symbolic coordinates inside work-plane frame snapshots.

The uploaded diagram uses symbolic variables such as `Len` and `R`, and at least one Coons/ruled boundary segment carries a work-plane frame whose `origin` or other frame coordinates are symbolic.

This is too strict.

In practice, boundary paths and their associated work-plane frames are often naturally defined symbolically. Loading should succeed after variable values are provided and all symbolic frame coordinates evaluate to finite numeric preview values.

## Goal

Update load/validation/rendering so symbolic coordinates in work-plane frame snapshots are allowed when they can be resolved to finite preview values.

The error:

```text
Work-plane frame coordinates must be numeric because this export path derives numeric coordinates from the frame.
```

should be replaced by a finite-preview requirement.

New policy:

```text
Work-plane frame coordinates may be numeric or symbolic.
They are valid if, after variable resolution and preview refresh, all frame coordinates have finite numeric preview values and the frame is geometrically valid.
```

## Scope

This is a targeted Phase 20H / symbolic-load fix.

Implement:

- symbolic preview refresh for work-plane frame snapshots;
- finite-preview validation for frame `origin`, `u`, `v`, and `normal`;
- load-time variable resolution covering frame coordinates;
- tests using symbolic frame coordinates in Coons/ruled boundary snapshots;
- improved error messages.

Do not implement:

- full TeX evaluation;
- raw TikZ evaluation;
- symbolic surface mesh export formulas;
- new surface primitives;
- new expression syntax;
- new dependencies.

Do not change:

- valid numeric work-plane frame behavior;
- variable manager semantics;
- existing symbolic boundary coordinate support;
- Coons/ruled surface formulas;
- source path copy-on-create policy;
- TikZ export mode behavior;
- inline no-blank-lines;
- 4-space indentation.

## 1. Replace numeric-only frame validation with finite-preview validation

Find the validation that emits:

```text
Work-plane frame coordinates must be numeric because this export path derives numeric coordinates from the frame.
```

This validation is too strict.

Update it to require finite numeric preview values instead.

### Old policy

```text
Work-plane frame coordinates must be numeric.
```

### New policy

```text
Work-plane frame coordinates must have finite preview coordinates after symbolic variable resolution.
```

Allowed:

- numeric frame coordinates;
- symbolic frame coordinates with finite refreshed preview values.

Rejected:

- unresolved variable;
- invalid expression;
- missing preview value;
- non-finite preview value;
- malformed symbolic coordinate object;
- unsafe raw TeX expression;
- geometrically invalid frame after preview evaluation.

## 2. Refresh symbolic previews for frame snapshots

Add or extend helpers so every work-plane frame snapshot can be refreshed using resolved variables.

Frame-like objects may include:

```ts
type WorkPlaneFrameSnapshot = {
  origin: Vec3 | SymbolicVec3;
  u: Vec3 | SymbolicVec3;
  v: Vec3 | SymbolicVec3;
  normal: Vec3 | SymbolicVec3;
};
```

Exact types may differ.

Required refresh behavior:

- refresh `origin`;
- refresh `u`;
- refresh `v`;
- refresh `normal`;
- return finite preview vectors;
- do not mutate malformed input into accepted data;
- return validation failure instead of throwing.

Suggested helper names:

```ts
refreshWorkPlaneFrameSymbolicPreview(...)
refreshSurfaceFrameSymbolicPreview(...)
refreshBoundarySegmentFrameSymbolicPreview(...)
```

or equivalent.

Important paths to inspect:

- `src/model/symbolicCoordinates.ts`;
- Coons/ruled boundary snapshot refresh code;
- path segment refresh code;
- arc/circle/ellipse/template path segment refresh code if they contain `frame`;
- curved sheet primitive refresh code;
- grid/work-plane frame refresh code if shared.

## 3. Refresh frames inside boundary path snapshots

The failing path is:

```text
strata[3].primitive.bottom.segments[0].frame.origin
```

So at minimum, symbolic refresh must cover frames nested inside:

- `BoundaryPathSnapshot.segments[*].frame`;
- Coons patch boundaries:
  - bottom;
  - right;
  - top;
  - left;
- ruled surface boundaries:
  - boundary0;
  - boundary1;
- any arc/path-template segments that store a frame.

Before validation and mesh sampling, all these nested frames should have finite preview values.

## 4. Frame geometric validation after preview refresh

Once frame coordinates are refreshed, validate the numeric preview frame.

Required:

- all preview components finite;
- `u`, `v`, and `normal` nonzero;
- `u` and `v` approximately orthogonal;
- `normal` approximately equals or is consistent with `cross(u, v)`;
- frame handedness policy preserved;
- normalization policy preserved.

If the frame is allowed to store non-normalized symbolic vectors, either:

- normalize preview values during validation/usage; or
- reject non-normalized frames consistently with existing work-plane validation.

Do not accept a frame just because symbolic expressions parse; numeric preview geometry must be valid.

## 5. Load-time variable resolution must include frame expressions

When loading JSON with symbolic variables, variable detection must include expressions inside frame coordinates.

Detect variables from:

- frame origin coordinates;
- frame `u`;
- frame `v`;
- frame `normal`;
- boundary path coordinates;
- other symbolic geometry fields;
- diagram variables.

If a frame coordinate references `Len`, `R`, `q`, etc., those variables must appear in the import resolution dialog.

If saved variable definitions exist, prefill them.

Example:

```text
frame.origin.x = -.5*Len
```

must cause `Len` to be required and evaluated.

## 6. Pending import flow behavior

The existing variable-resolution dialog should handle this case.

Required behavior:

1. User selects JSON.
2. Loader detects symbolic variables in boundary coordinates and frame coordinates.
3. Variable-resolution dialog appears.
4. Variables are prefilled from saved definitions if available.
5. User confirms values.
6. Symbolic previews are refreshed for:
   - boundary points;
   - boundary segment frames;
   - surface frames;
   - all other symbolic fields.
7. Full validation runs.
8. Diagram renders.

Cancel must leave the current diagram unchanged.

If frame variables are missing/invalid, load must fail gracefully with an informative error.

## 7. Mesh sampling/export behavior

Coons/ruled mesh sampling needs numeric coordinates.

Use refreshed preview values for frame-derived numeric computations.

Requirements:

- mesh sampling finite;
- no NaN/Infinity;
- symbolic source expressions remain stored where supported;
- source symbolic expressions are not discarded just because preview values are computed;
- TikZ export should continue to work.

If mesh TikZ export currently outputs numeric sampled faces, it may use preview values. That is acceptable for now.

The important fix is:

- do not reject symbolic frame coordinates before preview resolution.

## 8. Error messages

Replace the current error with a clearer finite-preview message.

Bad:

```text
Work-plane frame coordinates must be numeric because this export path derives numeric coordinates from the frame.
```

Good:

```text
Work-plane frame coordinates must have finite preview values after variable resolution.
```

Better with path context:

```text
Could not evaluate strata[3].primitive.bottom.segments[0].frame.origin.x. Variable Len is missing or invalid.
```

or:

```text
Work-plane frame at strata[3].primitive.bottom.segments[0].frame is invalid after evaluating symbolic variables.
```

Avoid raw TypeError or numeric-only messages for valid symbolic input.

## 9. Tests

Add focused tests.

### Frame refresh tests

1. Work-plane frame with numeric coordinates refreshes unchanged.

2. Work-plane frame with symbolic `origin.x = -.5*Len` refreshes to finite preview when `Len = 4`.

3. Work-plane frame with symbolic `u`, `v`, or `normal` refreshes to finite preview when expressions are valid.

4. Frame with unknown variable fails cleanly.

5. Frame with non-finite evaluated value fails cleanly.

6. Frame with malformed symbolic coordinate fails cleanly.

### Boundary snapshot tests

7. Coons boundary segment frame with symbolic origin refreshes successfully after variable resolution.

8. Ruled boundary segment frame with symbolic origin refreshes successfully after variable resolution.

9. Symbolic frame inside an arc/circle/ellipse segment refreshes successfully if such segments are supported.

10. Malformed frame inside boundary snapshot returns validation failure, not thrown exception.

### Load tests

11. `parseSavedDiagramJson` or import flow detects variables used in `frame.origin`.

12. JSON with symbolic Coons boundary frame loads after providing variable values.

13. JSON with symbolic ruled boundary frame loads after providing variable values.

14. JSON with missing frame variable prompts/requires the missing variable.

15. JSON with invalid frame variable value fails without mutating current diagram.

16. Numeric-only saved diagrams still load.

### Validation/sampling tests

17. `validateCoonsPatchPrimitive` accepts symbolic boundary frame coordinates after finite previews exist.

18. `validateRuledSurfacePrimitive` accepts symbolic boundary frame coordinates after finite previews exist.

19. Coons patch with symbolic boundary frame samples finite mesh.

20. Ruled surface with symbolic boundary frame samples finite mesh.

21. Invalid frame geometry after evaluation is rejected.

### Export tests

22. TikZ export after loading symbolic frame Coons patch succeeds.

23. Inline math output after loading symbolic frame diagram has no blank lines.

24. No NaN/Infinity in SVG/TikZ output.

### Regression tests

25. Previous symbolic boundary coordinate import tests still pass.

26. Malformed boundary segment load rejection still passes.

27. Existing work-plane validation tests still pass.

## 10. Use uploaded JSON as a regression source if practical

The uploaded file `counit (3).json` triggers:

```text
strata[3].primitive.bottom.segments[0].frame.origin
```

If possible, create a minimized fixture from it containing:

- variables such as `Len` and `R`;
- one Coons patch boundary segment with symbolic `frame.origin`;
- enough geometry to reproduce the old error.

Do not add a huge fixture if it slows tests.

A small hand-written fixture is preferred.

## 11. Documentation

Update docs:

- symbolic coordinates are allowed in work-plane/surface frame snapshots if finite preview values can be resolved;
- load-time variable resolution applies to frame coordinates as well as point coordinates;
- mesh sampling uses preview values;
- symbolic expressions are preserved where supported.

## 12. Preserve existing behavior

Do not regress:

- numeric JSON loading;
- symbolic boundary coordinate loading;
- variable-resolution dialog;
- variable manager;
- symbolic coordinate editing;
- ruled/Coons surface creation;
- boundary malformed-data rejection;
- SVG preview;
- TikZ export;
- inline no-blank-lines;
- 4-space indentation;
- save/load old diagrams;
- undo/redo;
- layer/style/camera/work-plane behavior.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test with uploaded JSON:

1. Click Load JSON.
2. Select the uploaded diagram.
3. Confirm variable-resolution dialog appears.
4. Confirm variables such as `Len` and `R` are listed and prefilled if saved.
5. Confirm values.
6. Confirm the diagram loads and renders.
7. Confirm no error says:
   - `Boundary surface path coordinates must be numeric`
   - `Work-plane frame coordinates must be numeric`
8. Generate TikZ.
9. Confirm export succeeds.
10. Switch inline mode if applicable.
11. Confirm inline output has no blank lines.

Failure test:

12. Load a version with missing `Len`.
13. Confirm dialog asks for `Len`.
14. Enter invalid value.
15. Confirm useful validation error and current diagram unchanged.

## 14. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 15. Report after implementation

Please report:

- files modified;
- root cause of the frame numeric-only rejection;
- frame symbolic refresh helper behavior;
- variable detection for frame expressions;
- load-time variable resolution behavior;
- finite-preview frame validation behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
