# Phase 20H / Phase 19C Fix Prompt: Support symbolic arc segments and audit remaining numeric-only symbolic-load blockers

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

Recent fixes allowed symbolic boundary coordinates and symbolic work-plane frame coordinates to be resolved at JSON load time by asking the user for variable values.

However, loading the attached JSON still fails with:

```text
Could not load diagram: strata[21].segments[0] Arc segment coordinates must be numeric because arc export derives coordinates from radius and angles.
```

The uploaded JSON contains variables such as:

```text
Len = 4
R = 1
```

and contains many symbolic coordinates. In particular, the failing stratum is a `concatenatedPath` named like `Ufront` whose first segment is an `arc`. The arc has symbolic data such as:

```text
center.y = -.5*Len
frame.origin.y = -.5*Len
```

Other symbolic data in the same file appears in:

- arc centers;
- arc frames;
- line segment starts/ends;
- cubic control points;
- Coons patch boundary segments;
- filled region boundaries;
- polygon/sheet vertices;
- point/label positions.

The current error means the loader/export validation still contains a numeric-only check for arc segments.

This is too strict.

In practical diagrams, arcs and path boundaries are often naturally specified symbolically. The editor should allow symbolic arc segment fields if they can be resolved to finite preview values.

## Goal

Allow symbolic input in arc segments, including when loading saved JSON.

An arc segment should be valid if, after variable resolution and symbolic preview refresh, all fields needed for preview/sampling/export have finite preview values and the arc geometry is valid.

Do not reject an arc merely because its center/frame/radius/angles were originally symbolic.

Also audit the codebase for other remaining “must be numeric because …” validations that block symbolic values despite finite preview values, especially in path/surface/export paths.

## Scope

This is a targeted symbolic-load/export robustness fix.

Implement:

- symbolic preview refresh for arc segment fields;
- finite-preview validation for arc segment fields;
- JSON load-time variable detection for arc segment expressions;
- replacement of numeric-only arc validation with finite-preview validation;
- tests using symbolic arc centers/frames/radius/angles where supported;
- an audit/fix of other remaining numeric-only symbolic blockers in relevant geometry paths.

Do not implement:

- full TeX evaluation;
- raw TikZ evaluation;
- symbolic mesh sampling formulas;
- new expression syntax;
- new geometry types;
- new dependencies;
- broad save/load redesign.

Do not change:

- valid numeric arc behavior;
- arc mathematical semantics;
- symbolic variable manager semantics;
- existing finite-preview boundary/surface fixes;
- SVG preview semantics except allowing symbolic inputs that evaluate finitely;
- TikZ export mode semantics;
- inline no-blank-lines;
- 4-space indentation.

## 1. Find all remaining numeric-only validation blockers

Run a search such as:

```bash
rg "must be numeric because|coordinates must be numeric|must be numeric" src
```

Pay special attention to messages like:

```text
Arc segment coordinates must be numeric because arc export derives coordinates from radius and angles.
Work-plane frame coordinates must be numeric because this export path derives numeric coordinates from the frame.
Boundary surface path coordinates must be numeric because mesh export derives sampled coordinates.
```

Some earlier fixes may have handled boundary and frame messages, but the arc message remains.

For each numeric-only validation found, decide whether the correct policy should be:

```text
finite preview required
```

rather than:

```text
raw numeric input required
```

In Phase 19+ code, most geometry export/preview paths should accept symbolic values if finite preview values exist.

Do not blindly remove validation. Replace numeric-only checks with finite-preview checks and clear unresolved-variable errors.

## 2. Arc segment fields that should support symbolic input

Update arc segment refresh/validation/export helpers to support symbolic values for all relevant fields.

Arc segment fields may include:

```ts
type ArcPathSegment = {
  kind: "arc";
  start: Vec3 | SymbolicVec3;
  end: Vec3 | SymbolicVec3;
  center: Vec3 | SymbolicVec3;
  radius: number | ScalarInputValue;
  startAngleDeg: number | ScalarInputValue;
  endAngleDeg: number | ScalarInputValue;
  direction: "clockwise" | "counterclockwise";
  frame?: WorkPlaneFrameSnapshot;
};
```

Exact types may differ.

At minimum, support symbolic preview refresh for:

- `start`;
- `end`;
- `center`;
- `frame.origin`;
- `frame.u`;
- `frame.v`;
- `frame.normal`.

If the current model allows symbolic scalar values for arc `radius`, `startAngleDeg`, or `endAngleDeg`, support them too.

If radius/angle symbolic scalars are not currently modeled, do not crash on them; either:

- implement symbolic scalar support for them; or
- reject them with a clear expression-specific message.

Preferred: support symbolic scalar fields for radius and angles because Phase 19 already has symbolic scalar expressions.

## 3. Replace arc numeric-only policy with finite-preview policy

### Old policy

```text
Arc segment coordinates must be numeric because arc export derives coordinates from radius and angles.
```

### New policy

```text
Arc segment coordinates must have finite preview values after variable resolution.
```

Allowed:

- numeric arc fields;
- symbolic arc coordinate fields with finite preview values;
- symbolic arc scalar fields with finite preview values, if supported.

Rejected:

- unknown variable;
- invalid expression;
- non-finite preview value;
- missing preview value;
- malformed symbolic coordinate/scalar object;
- invalid radius <= 0;
- invalid start/end angles;
- invalid frame after preview evaluation;
- inconsistent start/end relative to center/radius/angles if the current validation checks consistency.

## 4. Refresh symbolic previews for arcs before validation/export

Ensure arc segment symbolic previews are refreshed:

- during JSON load after variable values are resolved;
- when variables change in the editor;
- before SVG preview;
- before TikZ export;
- inside boundary snapshots for Coons/ruled/fill surfaces if arcs appear there.

Important paths to inspect:

- `src/model/symbolicCoordinates.ts`;
- path segment refresh helpers;
- arc segment validation helpers;
- boundary snapshot refresh helpers;
- save/load normalization;
- TikZ path export helpers;
- SVG path rendering helpers;
- curve occlusion sampling helpers.

The failure path is:

```text
strata[21].segments[0]
```

so ordinary top-level `concatenatedPath` arc segments must be fixed, not only surface boundaries.

## 5. Variable detection must include arc fields

The load-time variable-resolution dialog should detect variables used in arc fields.

Examples:

```text
center.y = -.5*Len
frame.origin.y = -.5*Len
radius = R
startAngleDeg = q
endAngleDeg = q + 90
```

Variables required:

```text
Len
R
q
```

Function names such as `sin`, `cos`, etc. should not be treated as variables.

Use the Phase 19 parser/AST rather than fragile regex where possible.

## 6. Arc SVG preview behavior

SVG preview and hit testing should use finite numeric preview values.

Requirements:

- symbolic center/frame/radius/angles evaluate to finite numeric values;
- arc preview renders correctly;
- no NaN/Infinity;
- path selection remains possible;
- curve occlusion sampling can sample symbolic arcs using preview values;
- changing variable values updates arc preview.

## 7. Arc TikZ export behavior

TikZ export should preserve symbolic intent where practical.

Examples:

If variables are:

```text
Len -> \Len
R -> \R
q -> \q
```

and arc center uses:

```text
(0, -.5*Len)
```

then output should prefer:

```tex
(0, {-.5 * \Len})
```

or equivalent in the existing formatter.

For arc syntax, if the exporter derives start/end or local coordinates numerically from center/radius/angles, it may use preview values only if there is no symbolic export path yet. But it should not reject the diagram solely because the input was symbolic.

Preferred export policy:

- use symbolic expressions for coordinate/scalar fields when the arc TikZ syntax can represent them safely;
- otherwise use finite preview values and document fallback.

Do not emit broken TikZ.

Do not export unresolved variable names without corresponding `\pgfmathsetmacro`.

## 8. Check other likely symbolic blockers in the attached JSON

The uploaded JSON contains symbolic fields beyond the failing arc:

- point positions;
- label positions;
- polygon/sheet vertices;
- line endpoints;
- cubic controls;
- Coons patch boundary segments;
- filled region boundaries;
- arc centers and frames;
- work-plane frames.

After fixing arc segments, the file should not simply fail on the next numeric-only validation.

Add an audit/fix so any remaining related numeric-only blocker is addressed or produces a clear unresolved-variable error.

Potential areas to check:

### Path segments

- line start/end;
- cubic start/control1/control2/end;
- arc start/end/center/frame/radius/angles.

### Template paths

- circle center/radius/frame;
- ellipse center/radiusX/radiusY/frame/rotation.

### Filled boundaries

- boundaries containing arc segments;
- work-plane-filled sheets with symbolic frame/local coordinates.

### Ruled/Coons surfaces

- boundary path snapshots containing arc segments;
- boundary segment frames;
- constant point boundaries if present.

### Grid

- symbolic ranges/spacing if allowed.

The prompt does not require making every possible field symbolic if the model cannot represent it yet, but it does require not rejecting valid finite-preview symbolic arc/path/surface data merely for being symbolic.

## 9. Error messages

Replace numeric-only arc error with a finite-preview/evaluation error.

Bad:

```text
Arc segment coordinates must be numeric because arc export derives coordinates from radius and angles.
```

Good:

```text
Arc segment coordinates must have finite preview values after variable resolution.
```

Better with path context:

```text
Could not evaluate strata[21].segments[0].center.y. Variable Len is missing or invalid.
```

or:

```text
Arc segment at strata[21].segments[0] is invalid after evaluating symbolic variables.
```

Avoid raw TypeErrors and misleading numeric-only wording.

## 10. Tests

Add focused tests.

### Arc refresh/validation tests

1. Numeric arc segment still validates.

2. Arc with symbolic center coordinate:

```text
center.y = -.5*Len
Len = 4
```

validates after preview refresh.

3. Arc with symbolic frame origin:

```text
frame.origin.y = -.5*Len
```

validates after preview refresh.

4. Arc with symbolic radius `R` validates after preview refresh if symbolic radius is supported.

5. Arc with symbolic start/end angles validates after preview refresh if symbolic angles are supported.

6. Arc with unknown variable fails cleanly.

7. Arc with non-finite evaluated radius fails.

8. Arc with radius <= 0 after evaluation fails.

9. Arc with malformed symbolic center fails cleanly.

10. Arc frame with invalid evaluated geometry fails cleanly.

### JSON load tests

11. Saved diagram with top-level concatenated path arc center using `-.5*Len` loads after variable resolution.

12. Saved diagram with top-level concatenated path arc frame origin using `-.5*Len` loads after variable resolution.

13. Saved diagram with filled region boundary arc using symbolic center/frame loads after variable resolution.

14. Saved diagram with Coons/Ruled boundary arc using symbolic center/frame loads after variable resolution.

15. Attached/minimized `saddle-skeleton` fixture no longer fails with the numeric-only arc error.

16. If the fixture is still invalid for another reason, the error must not be a numeric-only symbolic rejection; it should be a real finite-preview/geometry error.

### Variable detection tests

17. Variable detection finds `Len` in arc center expression.

18. Variable detection finds `R` in arc radius expression if supported.

19. Variable detection finds `q` in arc angle expression if supported.

20. Function names are not treated as variables.

### SVG/TikZ tests

21. SVG preview can render a symbolic arc after variable resolution.

22. TikZ export succeeds for a symbolic arc.

23. Inline TikZ output with symbolic arc has no blank lines.

24. TikZ output includes required `\pgfmathsetmacro` variables before symbolic arc usage.

25. No NaN/Infinity appears in SVG/TikZ output.

### Regression tests

26. Existing numeric arcs still export as before.

27. Existing arc reversal tests still pass.

28. Existing curve occlusion sampling for arcs still passes.

29. Existing symbolic boundary/frame import tests still pass.

30. Existing save/load old diagrams still pass.

## 11. Use the uploaded JSON as a regression guide

The uploaded file `saddle-skeleton.json` triggered:

```text
strata[21].segments[0] Arc segment coordinates must be numeric...
```

If practical:

- create a minimized fixture based on that stratum rather than committing the full large file;
- include variables `Len` and `R`;
- include one arc segment with symbolic center/frame;
- assert that it loads after variable resolution.

Do not add a huge fixture if it slows tests.

## 12. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test with uploaded JSON:

1. Click Load JSON.
2. Select `saddle-skeleton.json`.
3. Confirm variable-resolution dialog appears if variables are detected.
4. Confirm `Len` and `R` are listed/prefilled.
5. Confirm values.
6. Confirm the diagram loads and renders.
7. Confirm the error:

```text
Arc segment coordinates must be numeric because arc export derives coordinates from radius and angles.
```

does not appear.

8. Generate TikZ.
9. Confirm export succeeds.
10. Switch inline mode.
11. Confirm inline output has no blank lines.
12. Save and reload.

Failure test:

13. Load a version where `Len` is missing or invalid.
14. Confirm a clear variable/evaluation error.

## 13. Preserve existing behavior

Do not regress:

- numeric arc loading/export;
- symbolic variable manager;
- symbolic coordinate input;
- line/cubic segment symbolic support;
- boundary-surface symbolic coordinate support;
- work-plane frame symbolic support;
- Coons/ruled surface loading;
- filled region loading;
- SVG preview;
- TikZ export;
- inline no-blank-lines;
- 4-space indentation;
- save/load old diagrams;
- undo/redo;
- layer/style/camera/work-plane behavior.

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
- root cause of the arc numeric-only rejection;
- arc fields now supporting symbolic finite previews;
- whether symbolic radius/angles are supported or explicitly rejected;
- variable detection for arc fields;
- other numeric-only blockers found and fixed;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
