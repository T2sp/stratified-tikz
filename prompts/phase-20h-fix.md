# Phase 20H Fix Prompt: Surface-only face cap before projection/sort and boundary arc scalar validation

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

Phase 20H is under review after symbolic arc fixes and visibility/export hardening.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

## Medium issue 1: TikZ surface-depth sorting cap does not bound pre-fallback work

Review location:

- `src/tikz/generateTikz.ts`
- `src/rendering/projectedPrimitives.ts`

Current problem:

- `maxSurfaceFacesForSorting` is enforced only after:

```ts
extractProjectedRenderPrimitives(...)
```

has already sampled and projected all render primitives.

- `extractProjectedRenderPrimitives(...)` also walks curves and points before filtering to surface faces.
- Therefore, TikZ export for large diagrams still pays expensive pre-fallback work:
  - surface extraction/projection;
  - unrelated curve/point primitive extraction;
  - only then filtering to surface faces;
  - only then cap fallback.
- The surface-face cap therefore does not actually bound the work it is intended to bound.

Required fix:

- Make TikZ surface depth sorting use a **surface-only projected face collector**.
- Enforce `maxSurfaceFacesForSorting` during surface-face collection, before:
  - unrelated curve/point sampling;
  - sorting;
  - any expensive unnecessary projection.
- Prefer short-circuiting at `cap + 1`.

## Medium issue 2: Boundary arc symbolic scalars are not validated against variables in direct `validateDiagram()`

Review location:

- `src/model/validation.ts`
- `src/geometry/curvedSheets.ts`

Current problem:

- Symbolic arc scalars inside ruled/Coons boundary snapshots are refreshed on save/load.
- But direct `validateDiagram()` does not validate those scalar expressions against the diagram variable context.
- `validateCurvedSheetPrimitive()` accepts finite previews.
- Therefore an in-memory boundary arc scalar like:

```ts
{
  kind: "symbolic",
  expression: "Missing",
  previewValue: 1
}
```

can validate even though the variable `Missing` is unresolved.

This creates a stale-preview validation hole.

Required fix:

- Extend curved-sheet boundary validation so symbolic arc scalars:
  - `radius`;
  - `startAngleDeg`;
  - `endAngleDeg`;
  inside ruled/Coons boundary snapshots are validated against the diagram variable context.
- Reject unresolved variables and stale previews.
- Add tests for unresolved and stale preview values.

## Goal

Fix Phase 20H hardening gaps:

1. Surface depth sorting must not call the general projected primitive extractor for TikZ face sorting.
2. Surface face cap must be enforced during surface-only collection before sorting and before sampling unrelated curves/points.
3. Ruled/Coons boundary arc symbolic scalar fields must be validated against the diagram variable context during direct `validateDiagram()`, not only during save/load refresh.
4. Tests must cover both issues.

## Scope

This is a targeted Phase 20H fix.

Implement:

- surface-only projected face collection for TikZ surface depth sorting;
- cap enforcement during face collection;
- validation of symbolic arc scalar expressions in ruled/Coons boundary snapshots against variables;
- tests for cap behavior and boundary arc scalar validation.

Do not implement:

- new visibility algorithms;
- new geometry primitives;
- exact hidden-surface algorithms;
- broad projected primitive rewrite beyond necessary extraction helpers;
- new symbolic expression grammar;
- new save/load format;
- new dependencies.

Do not change:

- normal under-cap surface sorting order;
- visibility option semantics;
- disabled visibility behavior;
- curve occlusion behavior except avoiding unnecessary work;
- SVG rendering semantics unless shared helpers require safe refactor;
- TikZ output format except comments/fallback behavior if already defined;
- inline no-blank-lines;
- 4-space indentation.

## Part 1: Surface-only projected face collector

### 1. Inspect current surface sorting path

Inspect:

- `src/tikz/generateTikz.ts`;
- `src/rendering/projectedPrimitives.ts`;
- surface sorting helpers from Phase 20D/20E;
- visibility options and caps;
- tests for sorted surface export.

Find where TikZ export currently does something like:

```ts
const primitives = extractProjectedRenderPrimitives(...);
const surfaceFaces = primitives.filter((p) => p.kind === "surfaceFace");
if (surfaceFaces.length > maxSurfaceFacesForSorting) ...
surfaceFaces.sort(...)
```

This is the issue.

### 2. Add a surface-only collector

Add a helper that extracts only projected surface faces.

Suggested name:

```ts
collectProjectedSurfaceFacesForSorting(...)
```

or:

```ts
extractProjectedSurfaceFaces(...)
```

Suggested result:

```ts
type ProjectedSurfaceFaceCollectionResult =
  | {
      kind: "ok";
      faces: ProjectedSurfaceFace[];
    }
  | {
      kind: "capExceeded";
      cap: number;
      observedCount: number;
    };
```

Exact shape can differ.

Requirements:

- collect only surface face primitives;
- do not walk/sample curves;
- do not walk/sample points;
- do not construct label primitives;
- enforce `maxSurfaceFacesForSorting` while collecting;
- stop at `cap + 1`;
- return cap-exceeded fallback before sorting;
- collect finite projected faces only;
- preserve source/layer/original-index metadata needed for sorting.

### 3. Enforce cap before sorting

Required flow:

```text
collect/project surface faces up to cap + 1
if cap exceeded:
    return fallback
else:
    sort collected faces
    emit sorted faces
```

Do not:

```text
collect all primitives
filter surface faces
sort all faces
then check cap
```

Do not call the general projected primitive extractor in this TikZ surface sort path if it samples curves/points.

### 4. Preserve under-cap behavior

When surface face count is under the cap:

- sorted surface export should match existing Phase 20E/20H behavior;
- tie-breakers remain deterministic;
- layer/depth/original-index semantics preserved;
- no NaN/Infinity;
- inline/standalone formatting unchanged.

### 5. Cap fallback behavior

When surface face count exceeds cap:

- do not sort;
- do not emit sorted sampled faces through the expensive path;
- use the existing fallback behavior/comment if present;
- output should remain complete and valid;
- no hidden sampled curve segments should be emitted merely because the surface sort cap path was entered;
- inline output still has no blank lines.

If existing fallback comment wording exists, preserve it.

## Part 2: Validate symbolic arc scalars in ruled/Coons boundary snapshots

### 6. Identify all boundary arc scalar fields

Arc segments may contain scalar fields such as:

```ts
radius
startAngleDeg
endAngleDeg
```

These may be numeric or symbolic scalar values.

Boundary snapshots may occur in:

- ruled surface primitive:
  - boundary0;
  - boundary1;
- Coons patch primitive:
  - bottom;
  - right;
  - top;
  - left;
- potentially constant boundaries or path templates if supported.

The immediate issue concerns symbolic arc scalar values inside ruled/Coons boundary snapshots.

### 7. Validate symbolic scalar expressions against variable context

Direct validation must not rely solely on `previewValue`.

If a scalar is symbolic:

```ts
{
  kind: "symbolic",
  expression: "Missing",
  previewValue: 1
}
```

then validation should:

1. parse/validate expression with the current diagram variable context;
2. reject if any referenced variable is not defined;
3. evaluate preview from variables;
4. compare or refresh stale preview according to existing Phase 19 policy;
5. reject if evaluated preview is non-finite;
6. reject if arc-specific constraints fail, e.g. radius <= 0.

Do not accept finite stale previews when expression is unresolved.

### 8. Use existing Phase 19 expression helpers

Reuse existing symbolic expression/variable validation helpers.

Avoid duplicating parser logic.

Expected helpers may include concepts like:

- parse symbolic scalar;
- collect referenced variables;
- evaluate scalar expression;
- refresh symbolic preview;
- validate scalar input value.

If no suitable helper exists, add a small shared helper for validating symbolic scalar fields in geometry validation.

Suggested:

```ts
validateScalarInputValueAgainstVariables(
  scalar,
  variableContext,
  path
): ValidationResult<number>
```

or equivalent.

### 9. Update curved-sheet primitive validation

Update validation call chain:

- `validateDiagram(...)`;
- `validateStratum(...)`;
- `validateCurvedSheetPrimitive(...)`;
- boundary path snapshot validation;
- arc segment validation.

Ensure it passes the diagram variable context down to boundary segment validation.

Required:

- ruled/Coons boundary arc `radius` symbolic expression validated;
- ruled/Coons boundary arc `startAngleDeg` symbolic expression validated;
- ruled/Coons boundary arc `endAngleDeg` symbolic expression validated;
- stale preview values rejected or refreshed consistently;
- finite numeric scalar values still accepted.

### 10. Validate stale previews

Add a policy for stale preview values.

Preferred:

- validation recomputes expected preview from variables and either:
  - updates via refresh before validation; or
  - rejects if stored `previewValue` does not match evaluated value within tolerance.

Since `validateDiagram()` should not mutate if existing validation is pure, it may be better to reject stale preview and ask caller to refresh.

However, direct in-memory validation should not accept:

```ts
expression: "R"
previewValue: 1
```

when variable `R = 2`, unless there is an earlier guaranteed refresh step.

Choose the policy consistent with existing symbolic coordinate validation.

Document it in code/tests.

## Tests

### A. Surface-only cap enforcement tests

Add tests that would fail if general primitive extraction/sorting still happens before cap enforcement.

1. Surface-only collector under cap returns projected surface faces.

2. Surface-only collector over cap returns cap-exceeded result after `cap + 1`.

3. The TikZ surface depth sorting path does not call/require general projected primitive extraction for curves/points.

If direct spying is hard, structure code so the surface-only helper can be tested directly.

4. Large diagram with many surfaces and many curves:
   - `maxSurfaceFacesForSorting` low;
   - export hits cap fallback;
   - no curve/point primitive extraction is required for deciding surface sort fallback, if testable.

5. TikZ export over cap emits the existing cap fallback warning/comment.

6. TikZ export over cap does not emit hidden sampled segments due to this fallback path.

7. Under-cap sorted surface export remains deterministic.

8. Inline output with cap fallback has no blank lines.

### B. Boundary arc scalar validation tests

9. Ruled boundary arc with symbolic `radius: { expression: "R", previewValue: 1 }` validates when variable `R = 1`.

10. Coons boundary arc with symbolic `radius` validates when variable is defined.

11. Ruled boundary arc with symbolic `startAngleDeg` validates when variable is defined.

12. Coons boundary arc with symbolic `endAngleDeg` validates when variable is defined.

13. Boundary arc with unresolved symbolic radius:

```ts
expression: "Missing"
previewValue: 1
```

makes `validateDiagram()` fail.

14. Boundary arc with unresolved symbolic start angle fails.

15. Boundary arc with unresolved symbolic end angle fails.

16. Boundary arc with stale preview fails or is refreshed according to chosen policy.

Example:

```ts
variables: R = 2
radius: { expression: "R", previewValue: 1 }
```

Expected:
- fail if validation is pure;
- or pass only if refresh happens before validation and stored preview is updated in a controlled path.

The test must reflect the chosen policy.

17. Boundary arc symbolic radius evaluating to `0` or negative fails.

18. Boundary arc symbolic radius evaluating to `Infinity`/NaN fails.

19. Ordinary top-level path arc scalar symbolic validation still works.

20. Numeric arc scalars still validate as before.

### C. Regression tests

21. Save/load refresh tests for symbolic arc scalars still pass.

22. Valid Coons/Ruled surfaces still validate.

23. Malformed boundary segment load rejection still passes.

24. Existing symbolic coordinate validation tests still pass.

25. Existing visibility/export tests still pass.

## Implementation notes

### Surface-only collector should not duplicate too much logic

If the existing general extractor has useful surface extraction code, refactor into smaller helpers:

```ts
extractSurfaceFacePrimitives(...)
extractCurvePrimitives(...)
extractPointPrimitives(...)
```

Then surface sorting can call only:

```ts
extractSurfaceFacePrimitives(...)
```

Keep refactor focused.

### Avoid breaking SVG depth model

If SVG rendering still uses the general projected primitive extractor, that is okay.

The review issue specifically concerns TikZ surface sort path and the cap not bounding pre-fallback work.

But if a shared helper improves SVG too, ensure behavior remains equivalent.

### Error messages

For symbolic arc scalar validation, use clear path-aware errors:

```text
strata[3].primitive.bottom.segments[0].radius Unknown variable Missing.
```

or:

```text
Coons boundary arc radius expression could not be evaluated.
```

Avoid accepting stale finite preview silently.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

If practical:

1. Open a diagram with many surface faces.
2. Enable surface sorting.
3. Set `maxSurfaceFacesForSorting` low if UI exposes it.
4. Generate TikZ.
5. Confirm export remains responsive and emits cap fallback.
6. Confirm no hidden sampled segments are emitted due to cap fallback.

Symbolic validation:

7. Create/load a ruled or Coons surface whose boundary arc radius uses variable `R`.
8. Confirm it validates/renders when `R` is defined.
9. Remove or rename `R`.
10. Confirm validation/load fails with a useful unresolved-variable error.
11. Change `R` so stored preview would be stale.
12. Confirm refresh or validation behavior matches the chosen policy.

## Preserve existing behavior

Do not regress:

- surface depth sorting under cap;
- disabled visibility mode;
- hidden/visible curve export;
- inline no-blank-line behavior;
- 4-space indentation;
- symbolic save/load refresh;
- symbolic arc support in ordinary paths;
- Coons/Ruled sampling;
- SVG preview;
- TikZ export;
- save/load old diagrams;
- undo/redo;
- layer/style/camera/work-plane behavior.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## Report after implementation

Please report:

- files modified;
- root cause of surface-sort cap not bounding work;
- new surface-only projected face collector behavior;
- cap enforcement point;
- whether collection stops at `cap + 1`;
- root cause of boundary arc scalar validation gap;
- how symbolic arc `radius`, `startAngleDeg`, `endAngleDeg` are validated against variables;
- stale preview policy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
