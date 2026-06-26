# Phase 25D Fix Prompt: Align symbolic import coverage and guard pending import validation

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

Phase 25D is under review, but the remaining issues are in the symbolic JSON import / validation path introduced around Phase 25C and still blocking Phase 25D completion.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

## Medium issue 1: Unsupported nested symbolic/local sources can be accepted with stale previews

Current problem:

- `src/model/serialization.ts` recursively collects every object shaped like:

```ts
{ kind: "symbolic", expression: ... }
```

under `strata` / `labels`.

- Refresh and validation only walk supported geometry fields in `src/model/symbolicCoordinates.ts`.

- Therefore, JSON import can ask for variables found in unsupported nested data, but those unsupported symbolic/local fields are never refreshed or validated.

Reproduced case:

- A valid point contains an extra unsupported local-symbolic coordinate.
- Import asks for `R`.
- User resolves `R = 4`.
- Import returns `ok: true`.
- Serialized output still contains stale:

```ts
previewValue: 2
```

This violates the Phase 25 requirement:

```text
unsupported cases rejected
no stale previews accepted
```

## Medium issue 2: Pending symbolic JSON import can throw instead of returning clean error

Current problem:

- `parseSavedDiagramJson` catches malformed validation.
- But `resolvePendingSymbolicDiagramImport` calls `validateDiagram` without a guard.
- Reproduced case:
  - local-symbolic import with missing stratum `id`;
  - after variable resolution, validation throws:

```text
Cannot read properties of undefined (reading 'trim')
```

from validation code.

Required behavior:

- `resolvePendingSymbolicDiagramImport` should return:

```ts
{ ok: false, ... }
```

or the project's equivalent failure result.

It must not throw raw exceptions into the UI.

## Goal

Fix the symbolic JSON import pipeline so that:

1. Symbolic expression detection, refresh, and validation use the same supported local-coordinate coverage.
2. Unsupported nested symbolic/local coordinate sources are rejected or explicitly stripped.
3. Successful import cannot preserve stale preview values from unsupported symbolic/local data.
4. `resolvePendingSymbolicDiagramImport` returns `ok: false` for malformed pending imports instead of throwing.
5. Regression tests cover both reported issues.

## Scope

This is a targeted Phase 25D blocker fix.

Implement:

- supported-field-only symbolic expression detection;
- unsupported nested symbolic/local source rejection or safe stripping;
- post-refresh stale-preview validation;
- guarded pending symbolic import validation;
- regression tests.

Do not implement:

- new symbolic expression grammar;
- new work-plane-local geometry fields beyond existing supported coverage;
- new UI features;
- broad save/load redesign;
- new dependencies;
- TikZ export changes unless required by validation consistency.

Do not change:

- valid work-plane-local symbolic coordinate behavior;
- valid global symbolic coordinate behavior;
- variable-resolution dialog behavior;
- direct/Inspector local coordinate UI;
- valid save/load format;
- SVG preview semantics;
- TikZ output semantics;
- inline/standalone formatting.

## 1. Replace arbitrary recursive symbolic collection with supported-field traversal

Inspect:

- `src/model/serialization.ts`;
- recursive symbolic expression collection code;
- `resolvePendingSymbolicDiagramImport`;
- `parseSavedDiagramJson`;
- `src/model/symbolicCoordinates.ts`;
- supported symbolic refresh helpers;
- local-coordinate validation helpers.

The current detector is too broad:

```text
recursively collects every { kind: "symbolic", expression } under strata/labels
```

but refresh/validation are model-aware and only support known geometry fields.

Fix this mismatch.

### Required design

Create or reuse a model-aware traversal that walks only supported symbolic/local-coordinate fields.

Use this same supported coverage for:

- variable detection;
- preview refresh;
- validation;
- stale-preview checks.

Suggested conceptual helpers:

```ts
collectSupportedSymbolicExpressions(diagram): SymbolicExpressionReference[]
refreshSupportedSymbolicPreviews(diagram, variableContext): Result<Diagram>
validateNoUnsupportedSymbolicSources(diagram): ValidationResult
```

Exact names can differ.

Core invariant:

```text
If import asks for a variable because it detected an expression, that expression must be in a field that refresh/validation also supports.
```

Do not collect arbitrary nested symbolic expressions that the app cannot refresh.

## 2. Reject or strip unsupported nested symbolic/local sources

Choose and implement a clear policy.

### Preferred policy: reject unsupported symbolic/local sources

If saved JSON contains symbolic/local-coordinate objects in unsupported fields:

- return `ok: false`;
- include the unsupported path in the error message;
- do not accept stale preview data;
- do not silently drop user-authored data.

Example error:

```text
Unsupported symbolic coordinate source at strata[0].extraLocalSource.
```

### Alternative policy: strip unsupported sources

Only acceptable if those fields are clearly non-model extension data and safe to discard.

If stripping is chosen:

- document it;
- test it;
- ensure stripped data cannot affect geometry/export;
- do not strip supported geometry fields.

Preferred: reject.

## 3. Add post-refresh no-stale-preview validation

After resolving variables and refreshing supported previews, a successful import must not contain stale unsupported symbolic/local coordinate data.

For supported symbolic data:

- every symbolic scalar/vector/local coordinate should have preview values consistent with the resolved variables according to existing Phase 19/25 policy;
- stale previews should be refreshed or rejected consistently;
- unresolved variables should fail.

For unsupported symbolic/local coordinate-looking data:

- reject or strip according to the chosen policy.

The reproduced case must no longer be possible:

```text
valid point + unsupported local-symbolic coordinate
R = 4
stale previewValue = 2
import returns ok: true
```

Expected after fix:

- import returns `ok: false`; or
- stale unsupported field is stripped and cannot appear in serialized result.

## 4. Guard `resolvePendingSymbolicDiagramImport`

Update `resolvePendingSymbolicDiagramImport` so malformed pending imports produce clean failure results.

Current bad flow:

```text
resolvePendingSymbolicDiagramImport
-> refresh symbolic previews
-> validateDiagram
-> throw raw TypeError
```

Required flow:

```text
resolvePendingSymbolicDiagramImport
-> refresh symbolic previews
-> validate supported/unsupported symbolic coverage
-> validateDiagram inside guarded path
-> return ok:false on malformed data
```

Requirements:

- `validateDiagram` exceptions are caught and converted into failure result;
- error message is useful;
- current active diagram is not replaced on failure;
- UI confirm handler can display the failure instead of crashing.

Good error examples:

```text
Could not resolve pending symbolic import: strata[0].id is missing or invalid.
```

```text
Unsupported symbolic coordinate source at strata[0].metadata.foo.
```

Avoid raw TypeError messages.

## 5. Preserve current active diagram on failure

If pending import confirmation fails after variable resolution:

- do not replace current editor diagram;
- do not push undo history;
- do not partially commit variables/geometry;
- keep or close the dialog according to existing policy, but show a clear error.

This should match existing behavior for normal validation failures.

## 6. Tests

Add focused regression tests.

### Unsupported nested symbolic/local source tests

1. A valid point with an unsupported nested work-plane-local coordinate source under an extra field fails import with `ok: false`.

Example conceptual fixture:

```json
{
  "strata": [
    {
      "id": "p",
      "name": "p",
      "geometricKind": "point",
      "position": { "...": "valid supported point position" },
      "unsupportedLocal": {
        "kind": "workPlaneLocal",
        "local": {
          "a": { "kind": "symbolic", "expression": "R", "previewValue": 2 },
          "b": { "kind": "numeric", "value": 0 }
        },
        "preview": { "...": "stale preview" }
      }
    }
  ],
  "variables": [
    { "name": "R", "expression": "4" }
  ]
}
```

Expected:

- import does not return `ok: true` with stale data.

2. Unsupported nested `{ kind: "symbolic", expression: "R", previewValue: 2 }` in an unknown field is not collected as a variable unless it is also rejected as unsupported.

3. Supported symbolic local coordinates still import and refresh successfully.

4. Supported global symbolic coordinates still import and refresh successfully.

5. Function names such as `sin`, `cos`, `sqrt` are not treated as variables.

### Stale-preview tests

6. Supported symbolic coordinate with stale preview is refreshed or rejected according to existing policy.

7. Unsupported symbolic coordinate with stale preview cannot survive successful import.

8. Work-plane-local `a/b` stale preview cannot survive successful import.

### Pending import no-throw tests

9. `resolvePendingSymbolicDiagramImport` with missing stratum `id` returns `ok: false`, not thrown TypeError.

Use:

```ts
expect(() => resolvePendingSymbolicDiagramImport(...)).not.toThrow();
expect(result.ok).toBe(false);
```

10. Pending import with malformed local-symbolic source returns `ok: false`, not throw.

11. UI-level confirm handler, if testable, handles `ok: false` without replacing the current diagram.

### Regression tests

12. Valid pending symbolic import still succeeds.

13. Valid work-plane-local symbolic import still succeeds.

14. Valid JSON with supported labels/points/path/sheet/grid/Coons/Ruled local sources still succeeds.

15. Cancel path still leaves current diagram unchanged.

16. Old numeric diagrams still load.

17. Phase 25D TikZ export tests still pass.

## 7. Implementation guidance

### Do not use arbitrary recursive variable collection over model data

Avoid:

```ts
walkEverythingAndCollectAnyKindSymbolic(...)
```

unless it is paired with explicit unsupported-field rejection.

### Prefer model-aware traversal

Use known diagram schema fields, such as:

- points;
- labels;
- path segment coordinates;
- arc/circle/ellipse fields;
- polygon/sheet vertices;
- filled boundaries;
- work-plane sheet frames;
- grid/lattice frames/ranges;
- ruled/Coons boundary snapshots;
- constant point boundaries;
- supported work-plane-local coordinate sources.

If a future field is added, it should be added to the traversal intentionally.

### Make validation path-aware

For unsupported local/symbolic source rejection, include a path string such as:

```text
strata[0].unsupportedLocal
labels[1].metadata.foo
```

This makes JSON import errors debuggable.

## 8. Documentation/comments

Add a short code comment near the supported traversal:

```text
Variable detection must use the same model-aware coverage as preview refresh/validation. Arbitrary recursive collection can accept unsupported symbolic objects with stale previews.
```

Update user docs only if needed.

## 9. Preserve existing behavior

Do not regress:

- valid work-plane-local symbolic import;
- valid global symbolic import;
- variable-resolution dialog;
- direct/Inspector local coordinate UI;
- TikZ export for local coordinates;
- canvas-is-plane export;
- save/load old diagrams;
- SVG preview;
- inline no-blank-lines;
- 4-space indentation;
- undo/redo.

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
- root cause of unsupported stale preview acceptance;
- new supported-field traversal strategy;
- chosen policy for unsupported nested symbolic/local sources;
- root cause of pending import throw;
- how `resolvePendingSymbolicDiagramImport` now returns `ok: false`;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
