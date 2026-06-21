# Phase 20H / Phase 19C Fix Prompt: Load symbolic boundary-surface JSON by resolving variables before rendering

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

Manual JSON load check found a practical problem:

- A saved diagram contains Coons patch / boundary-surface paths whose coordinates are symbolic.
- The saved file defines variables such as `Len` and `R`, and boundary paths contain expressions such as:
  - `Len`;
  - `R`;
  - `.5*Len`;
  - `-.5*Len`;
  - `0.6*Len`;
- Loading the JSON currently fails with an error similar to:

```text
Saved diagram is invalid: strata[3].primitive.bottom.segments[0].points[1] Boundary surface path coordinates must be numeric because mesh export derives sampled coordinates.
```

This is too strict.

In practice, boundary paths for ruled surfaces / Coons patches are often naturally specified symbolically. The editor should support loading these diagrams by asking the user for variable values, evaluating finite preview coordinates, and then rendering.

## Goal

Change JSON load behavior and boundary-surface validation so that symbolic boundary coordinates are allowed when they can be resolved to finite numeric preview values.

When a loaded JSON contains symbolic variables / symbolic coordinates:

1. detect the variables used by the diagram;
2. show a variable-resolution dialog before final rendering;
3. prefill values from saved variable definitions when available;
4. allow the user to confirm or edit variable values;
5. validate/evaluate variables using the existing Phase 19 expression evaluator;
6. refresh all symbolic preview values, including boundary path snapshots in ruled surfaces and Coons patches;
7. then run full diagram validation and render.

Do not reject boundary surface paths merely because their coordinates are symbolic.

Reject only if symbolic coordinates cannot be resolved to finite numeric preview coordinates.

## Scope

Implement:

- load-time symbolic variable detection;
- pending import / variable resolution flow;
- finite-preview validation for symbolic boundary-surface coordinates;
- symbolic preview refresh for ruled/Coons boundary snapshots before mesh validation;
- tests for loading saved diagrams with symbolic Coons/ruled boundaries.

Do not implement:

- full TeX parser;
- arbitrary raw TikZ evaluation;
- server-side LaTeX evaluation;
- symbolic surface sampling in TikZ itself;
- new surface geometry;
- new variable syntax beyond Phase 19;
- new dependencies.

Do not change:

- symbolic expression grammar except if needed for bug fixes;
- TikZ export syntax for valid symbolic coordinates;
- SVG rendering semantics except allowing finite preview values;
- source geometry semantics;
- save/load format except optional import-state helpers;
- existing numeric-only diagram loading;
- inline/standalone TikZ export formatting.

## 1. Replace “numeric-only” boundary validation with “finite preview required”

Find the validation that emits:

```text
Boundary surface path coordinates must be numeric because mesh export derives sampled coordinates.
```

This validation is too strict.

Update the policy:

### Old policy

```text
Boundary surface path coordinates must be numeric.
```

### New policy

```text
Boundary surface path coordinates must have finite numeric preview values.
```

Allowed:

- numeric coordinate component;
- symbolic coordinate component with a finite `previewValue`;
- symbolic coordinate component whose preview can be refreshed from resolved variables.

Rejected:

- unknown variable;
- invalid expression;
- missing preview after refresh;
- non-finite preview;
- malformed symbolic coordinate object;
- raw unsafe TeX.

Mesh sampling/rendering should use numeric preview values.

TikZ export should preserve symbolic expressions where possible.

## 2. Refresh symbolic previews for boundary snapshots before validation

Ensure symbolic preview refresh covers all geometry paths, including:

- ordinary strata positions;
- labels;
- path segments;
- filled region boundaries;
- work-plane-filled sheet boundaries;
- ruled surface boundary snapshots;
- Coons patch boundary snapshots;
- constant point boundaries if supported;
- curved surface parameters if symbolic fields exist;
- grids if symbolic ranges exist.

The immediate bug concerns:

```text
strata[n].primitive.bottom/right/top/left.segments[*].points[*]
```

or equivalent path segment coordinate fields inside Coons patches.

Requirements:

- all symbolic coordinates inside `BoundaryPathSnapshot` are refreshed using current/resolved variables;
- no raw `TypeError` if a coordinate is malformed;
- malformed coordinates return a load/validation error;
- valid symbolic boundary coordinates produce finite preview values.

## 3. Add pending import flow for variable resolution

When loading JSON, do not immediately fail if symbolic coordinates require variables.

Instead:

1. parse JSON structurally;
2. detect symbolic variables and symbolic coordinate references;
3. collect required variable names;
4. collect saved variable definitions if present;
5. show a modal/panel asking the user to confirm or enter values;
6. only after user confirmation, evaluate variables and complete diagram load.

Suggested UI:

```text
Resolve symbolic variables

This diagram uses symbolic variables.
Enter numeric preview values or expressions.

Len = [ 4 ]
R   = [ 1 ]

[Cancel] [Load diagram]
```

Requirements:

- values are prefilled from saved variable definitions when available;
- if a variable is referenced but not defined, show it with an empty input;
- user cannot complete load until all required variables have valid finite preview values;
- cancel leaves the current diagram unchanged;
- successful confirmation replaces/loads the diagram;
- status/error messages are clear.

If the project already has a Variable Manager, reuse its validation/evaluation logic.

## 4. Should the dialog always appear?

Preferred behavior:

- If a loaded diagram contains any symbolic variables or symbolic coordinates, show the variable-resolution dialog.
- Prefill saved values and allow the user to simply click “Load diagram”.
- This gives users a chance to change variable values on import.

Alternative acceptable behavior:

- If all variables have valid saved values, load immediately and optionally show a non-blocking notice.
- If any variable value is missing/invalid, show the dialog.

The user explicitly wants values requested on load when variables are detected, so the preferred behavior is the blocking dialog with prefilled values.

## 5. Variable detection

Detect variables from:

- `diagram.variables`, if present;
- symbolic coordinate expressions;
- symbolic grid ranges;
- symbolic surface/path parameters;
- any Phase 19 symbolic scalar fields.

Example:

```text
R*cos(q)
```

requires:

```text
R
q
```

Do not confuse function names with variables:

- `sin`;
- `cos`;
- `sqrt`;
- `abs`;
- etc.

Use the Phase 19 parser/AST rather than regex if possible.

Unknown identifiers that are not variables/functions should appear as required variables or be rejected according to existing expression policy.

## 6. Variable evaluation

Use existing Phase 19 variable logic.

Requirements:

- validate variable names/macros;
- validate expressions;
- support dependencies if already supported;
- reject cycles;
- reject unknown variables after resolution;
- reject non-finite preview values;
- reject unsafe tokens;
- do not use JavaScript `eval`;
- do not execute TeX.

Example:

```text
Len = 4
R = 1
```

Then:

```text
.5*Len -> 2
-.5*Len -> -2
R -> 1
```

## 7. Load transaction safety

Do not partially mutate the current editor state while variable resolution is pending.

Required:

- parse/pending import state is UI state;
- current diagram remains unchanged until user confirms;
- cancel restores/leaves the previous diagram;
- failed validation after variable input leaves previous diagram unchanged;
- successful confirmation commits one load operation according to existing load behavior.

If existing load behavior resets undo/redo, preserve that policy.

## 8. Boundary surface mesh sampling

For ruled and Coons surfaces with symbolic boundary coordinates:

- use refreshed numeric preview coordinates for mesh sampling;
- sampled mesh must be finite;
- preview renders correctly;
- TikZ export should keep symbolic coordinate expressions where applicable only if the existing export path supports it;
- if mesh export currently outputs sampled numeric mesh coordinates, it may use preview values, but this should be documented.

Important distinction:

- SVG preview and mesh sampling need numeric preview values.
- The saved symbolic expressions should not be discarded.
- Future TikZ export should preserve symbolic intent where practical.

If current mesh TikZ export cannot preserve symbolic sampling formulas, it may export numeric preview mesh coordinates for boundary surfaces, but it must not reject the loaded diagram solely because input boundary coordinates are symbolic.

## 9. Error handling

Replace the current error with more helpful messages.

Examples:

```text
This diagram uses symbolic boundary coordinates. Please assign values to: Len, R.
```

```text
Could not load diagram: variable Len has invalid expression.
```

```text
Could not load diagram: Coons boundary coordinate R*cos(q) could not be evaluated with the provided variables.
```

```text
Boundary surface path coordinates must have finite preview values after variable resolution.
```

Avoid:

```text
Boundary surface path coordinates must be numeric
```

for valid symbolic input.

## 10. Tests

Add focused tests.

### Load detection tests

1. Saved diagram with symbolic Coons boundary and variables is detected as needing variable resolution.

2. Saved diagram with symbolic Coons boundary but missing variable definition asks for the missing variable.

3. Function names such as `sin` and `cos` are not treated as required variables.

4. Saved numeric-only diagram loads normally.

### Resolution tests

5. Given variables:

```text
Len = 4
R = 1
```

a saved Coons boundary coordinate containing `.5*Len`, `-.5*Len`, and `R` refreshes to finite previews.

6. Changing import value `Len = 6` updates preview values before rendering.

7. Invalid variable expression prevents load and leaves current diagram unchanged.

8. Cyclic variables prevent load if dependencies are supported.

9. Non-finite variable value prevents load.

### Boundary validation tests

10. `validateCoonsPatchPrimitive` accepts symbolic boundary coordinates when finite previews exist.

11. `validateRuledSurfacePrimitive` accepts symbolic boundary coordinates when finite previews exist.

12. Boundary surface validation rejects symbolic boundary coordinates with missing preview/unresolved variable.

13. Malformed boundary objects are still rejected cleanly.

### Mesh sampling tests

14. Coons patch with symbolic boundary previews samples finite mesh after resolution.

15. Ruled surface with symbolic boundary previews samples finite mesh after resolution.

16. No NaN/Infinity in sampled mesh.

### UI/transaction tests

17. Pending import cancel leaves current diagram unchanged.

18. Confirming variable dialog loads the resolved diagram.

19. Saved values prefill the variable dialog if testable.

### Export/save tests

20. Save/load round-trip preserves symbolic expressions.

21. TikZ export after load works.

22. Inline math output after load has no blank lines.

23. Existing numeric boundary surface diagrams still load.

## 11. Use the attached JSON as a regression fixture if practical

The uploaded example contains symbolic variables such as:

```text
Len
R
```

and Coons/ruled boundary paths with symbolic coordinates.

If appropriate, create a minimized fixture based on that file rather than using the full large file.

Do not add huge fixtures if they make tests slow.

Prefer a small hand-authored fixture containing:

- variables `Len = 4`, `R = 1`;
- one Coons patch boundary with symbolic coordinates;
- enough geometry to reproduce the old rejection.

## 12. Documentation

Update docs:

- JSON load with symbolic variables triggers variable resolution;
- saved values are prefilled;
- mesh preview/export uses numeric preview values;
- symbolic expressions remain part of saved diagram where supported;
- boundary surfaces allow symbolic coordinates if finite previews are available.

## 13. Preserve existing behavior

Do not regress:

- numeric JSON loading;
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

## 14. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test using uploaded JSON:

1. Click Load JSON.
2. Select the uploaded diagram with symbolic Coons boundary coordinates.
3. Confirm a variable-resolution dialog appears.
4. Confirm variables such as `Len` and `R` are listed.
5. Confirm saved values are prefilled if present.
6. Click Load/Confirm.
7. Confirm the diagram loads and renders.
8. Confirm no error says “Boundary surface path coordinates must be numeric”.
9. Change `Len` or `R` during import.
10. Confirm preview changes accordingly.
11. Generate TikZ.
12. Confirm export succeeds.
13. Save the loaded diagram and reload it.
14. Confirm symbolic data persists.

Failure test:

15. Load a file with missing variable value.
16. Confirm load is blocked until a valid value is entered.
17. Enter invalid expression.
18. Confirm useful validation error.

## 15. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 16. Report after implementation

Please report:

- files modified;
- root cause of the numeric-only boundary rejection;
- new import variable-resolution flow;
- whether variable dialog always appears or only when values are missing/invalid;
- how boundary snapshots refresh symbolic previews;
- how mesh validation now checks finite previews;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
