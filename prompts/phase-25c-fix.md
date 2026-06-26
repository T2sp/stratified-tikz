# Phase 25C Fix Prompt: Align symbolic import detection/refresh/validation coverage and guard pending import validation

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

Phase 25C implemented preview refresh, JSON import, and geometry integration for work-plane-local symbolic coordinates.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

## Medium issue 1: Unsupported nested symbolic/local sources can be accepted with stale previews

Current problem:

- `serialization.ts` recursively collects every object shaped like:

```ts
{ kind: "symbolic", expression: ... }
```

under strata/labels.
- However, refresh/validation only walk supported geometry fields.
- This means JSON import can ask the user for variables that occur in unsupported nested data, but after resolving those variables, the unsupported nested data is not refreshed or validated.
- A reproduced case:
  - a valid point contains an extra unsupported local-symbolic coordinate;
  - import asks for `R`;
  - resolving `R = 4` returns `ok: true`;
  - serialized result still contains stale `previewValue: 2`.

This violates Phase 25C requirements:

```text
unsupported cases rejected
no stale previews accepted
```

## Medium issue 2: Pending symbolic JSON import can throw instead of returning clean failure

Current problem:

- `parseSavedDiagramJson` catches malformed validation and returns a failure result.
- But `resolvePendingSymbolicDiagramImport` calls `validateDiagram` without a guard.
- Reproduced case:
  - local-symbolic import with a missing stratum `id`;
  - after variable resolution, validation throws:

```text
Cannot read properties of undefined (reading 'trim')
```

from validation code.
- The UI confirm handler does not catch this.

Required behavior:

- malformed pending import confirmation should return:

```ts
{ ok: false, ... }
```

or the project’s equivalent failure result.
- It must not throw raw exceptions into the UI.

## Goal

Fix Phase 25C JSON import robustness so that:

1. Symbolic expression detection, preview refresh, and validation share the same supported local-coordinate coverage.
2. Unsupported nested symbolic/local coordinate sources are rejected or stripped intentionally before variable resolution can accept stale previews.
3. No stale unsupported symbolic preview data can remain after successful import.
4. `resolvePendingSymbolicDiagramImport` catches malformed validation/normalization failures and returns `ok: false` instead of throwing.
5. Regression tests cover both reported cases.

## Scope

This is a targeted Phase 25C fix.

Implement:

- aligned supported-field traversal for symbolic variable detection, refresh, and validation;
- rejection or explicit stripping of unsupported nested symbolic/local sources;
- no-stale-preview guarantees for successful import;
- guarded pending import validation;
- regression tests.

Do not implement:

- new symbolic expression grammar;
- new work-plane-local geometry fields beyond already-supported coverage;
- new UI features;
- broad save/load redesign;
- new dependencies;
- TikZ export changes unless required by validation consistency.

Do not change:

- supported local-coordinate behavior;
- supported symbolic coordinate import behavior;
- variable-resolution dialog semantics;
- direct/Inspector local coordinate UI;
- save/load format for valid diagrams;
- SVG preview semantics;
- TikZ generation semantics;
- inline/standalone output formatting.

## 1. Align symbolic variable detection with supported refresh/validation coverage

Inspect:

- `src/model/serialization.ts`;
- recursive symbolic expression collection code;
- `resolvePendingSymbolicDiagramImport`;
- `parseSavedDiagramJson`;
- `src/model/symbolicCoordinates.ts`;
- refresh helpers for supported geometry fields;
- validation helpers for symbolic/local coordinate fields.

The review says the current detection is overly broad:

```text
recursively collects every { kind: "symbolic", expression } under strata/labels
```

but refresh/validation is narrower.

That mismatch must be removed.

### Required design

Use a single source of truth for supported symbolic/local fields.

Preferred approach:

- create a traversal helper that walks exactly the supported geometry fields for symbolic import;
- use it for:
  - variable detection;
  - preview refresh;
  - unsupported local-source validation;
  - stale preview validation.

Example conceptual API:

```ts
collectSupportedSymbolicExpressions(diagram): SymbolicExpressionReference[]
refreshSupportedSymbolicPreviews(diagram, variableContext): Result<Diagram>
validateNoUnsupportedSymbolicSources(diagram): ValidationResult
```

Exact names can differ.

The key requirement is:

```text
If import asks for a variable because it detected an expression, that expression must be in a field that refresh/validation also supports.
```

Do not collect arbitrary nested symbolic expressions that the app does not know how to refresh.

## 2. Reject or strip unsupported nested symbolic/local coordinate sources

Choose a policy.

### Preferred policy: reject unsupported nested symbolic/local sources

If a saved JSON contains symbolic/local coordinate objects in unsupported fields:

- return `ok: false`;
- explain the unsupported path;
- do not accept stale preview data;
- do not silently drop user-authored data.

Example error:

```text
Unsupported symbolic coordinate source at strata[0].extraLocalSource.
```

### Alternative policy: strip unsupported nested symbolic/local sources

Only acceptable if those fields are explicitly non-model extension data and safe to discard.

If stripping is chosen:

- document it;
- test it;
- ensure stripped data cannot affect geometry/export;
- do not strip supported geometry data.

Preferred: reject.

## 3. Validate no stale previews after successful import

After resolving variables and refreshing previews, a successful import must not contain stale unsupported symbolic/local coordinate preview values.

Add a post-refresh check for supported symbolic data:

- every supported symbolic scalar/vector/local coordinate has preview values consistent with the resolved variables;
- every unsupported symbolic/local coordinate object is rejected or stripped according to policy;
- no raw `previewValue` is trusted if expression cannot be evaluated in context.

For the reported reproduction:

```text
valid point + extra unsupported local-symbolic coordinate
R = 4
stale previewValue = 2
```

Expected:

- import returns `ok: false` with unsupported field path; or
- if stripped by policy, final serialized diagram does not contain that stale unsupported coordinate.

It must not return `ok: true` while preserving stale data.

## 4. Guard `resolvePendingSymbolicDiagramImport`

Wrap the pending-import final normalization/validation path so malformed data returns a clean failure result.

Current issue:

```ts
resolvePendingSymbolicDiagramImport(...)
  -> validateDiagram(...)
  -> throws TypeError
```

Required:

```ts
resolvePendingSymbolicDiagramImport(...)
  -> catches validation/normalization exceptions
  -> returns { ok: false, error: ... }
```

or the project’s equivalent result shape.

Do not use a broad catch to hide programmer errors in unrelated code silently. But for user-provided pending JSON import, validation exceptions should be converted into load failures.

Preferred:

- structurally validate before calling `validateDiagram`;
- add targeted guard around `validateDiagram` in pending import;
- reuse existing `parseSavedDiagramJson` error formatting.

## 5. Keep current active diagram unchanged on pending import failure

If pending import confirmation fails after variable resolution:

- current editor diagram must remain unchanged;
- pending import dialog may stay open with error or close according to existing UI policy;
- no partial diagram replacement;
- no undo history entry for failed import.

If the current UI already follows this for normal validation failures, preserve it for thrown-exception-converted failures.

## 6. Tests

Add focused regression tests.

### A. Unsupported nested symbolic/local source coverage tests

1. A valid point plus an unsupported nested symbolic scalar/local coordinate under an arbitrary extra field causes import to fail with `ok: false`.

Example conceptual fixture:

```json
{
  "strata": [
    {
      "id": "p",
      "geometricKind": "point",
      "position": { ... valid ... },
      "unsupportedLocal": {
        "kind": "workPlaneLocal",
        "local": {
          "a": { "kind": "symbolic", "expression": "R", "previewValue": 2 },
          "b": { "kind": "numeric", "value": 0 }
        },
        "preview": ...
      }
    }
  ],
  "variables": [
    { "name": "R", "expression": "4" }
  ]
}
```

Expected:

- import does not return `ok: true` with stale preview;
- either rejects unsupported field or strips it according to policy.

2. Unsupported nested `{ kind: "symbolic", expression: "R", previewValue: 2 }` in an unknown field is not collected as a variable unless it is also rejected as unsupported.

3. Supported symbolic local coordinate fields still work and refresh correctly.

4. Supported global symbolic coordinate fields still work and refresh correctly.

5. Variable detection does not include function names.

### B. Stale preview tests

6. Supported symbolic coordinate with stale preview is refreshed or rejected according to existing policy.

7. Unsupported symbolic coordinate with stale preview cannot survive successful import.

8. Work-plane-local `a/b` stale preview cannot survive successful import.

### C. Pending import no-throw tests

9. `resolvePendingSymbolicDiagramImport` with missing stratum `id` returns `ok: false`, not thrown TypeError.

Use assertion:

```ts
expect(() => resolvePendingSymbolicDiagramImport(...)).not.toThrow();
expect(result.ok).toBe(false);
```

10. Pending import with malformed local-symbolic source returns `ok: false`, not throw.

11. UI-level confirm handler, if testable, handles `ok: false` without replacing the current diagram.

### D. Regression tests

12. Valid pending symbolic import still succeeds.

13. Valid work-plane-local symbolic import still succeeds.

14. Valid JSON with supported labels/points/path/sheet/grid/Coons/Ruled local sources still succeeds.

15. Cancel path still leaves current diagram unchanged.

16. Old numeric diagrams still load.

17. Existing save/load tests still pass.

## 7. Error messages

Provide useful errors.

Good examples:

```text
Unsupported symbolic coordinate source at strata[0].unsupportedLocal.
```

```text
Could not resolve pending symbolic import: strata[0].id is missing or invalid.
```

```text
Unsupported symbolic expression at labels[2].metadata.foo; this field is not part of the StratifiedTikZ model.
```

Avoid raw messages such as:

```text
Cannot read properties of undefined (reading 'trim')
```

as user-facing import errors.

## 8. Implementation guidance

### Avoid broad arbitrary-recursive collection

Do not recursively collect all symbolic-looking objects under model data without also validating that they are in supported fields.

This creates exactly the stale-preview bug.

### Prefer model-aware traversal

Use model-aware traversal based on known schema:

- points;
- labels;
- path segments;
- arc/circle/ellipse fields;
- polygon/sheet vertices;
- filled boundaries;
- work-plane sheet frames;
- grid/lattice frames/ranges;
- Coons/Ruled boundary snapshots;
- constant point boundaries;
- other supported local coordinate fields.

If a future field is added, it should be added to the traversal intentionally.

### Validate unknown keys if needed

If the saved diagram format allows arbitrary extra keys, then reject only unknown symbolic/local source objects under those extra keys, not necessarily all unknown data.

If the saved diagram format does not allow arbitrary keys, existing schema validation should already reject them. Ensure that happens before variable detection returns success.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks if practical:

1. Load a valid work-plane-local symbolic diagram.
2. Confirm import dialog appears and variables resolve.
3. Confirm diagram loads.
4. Load a malformed pending symbolic JSON missing a stratum id.
5. Confirm app shows a clean error and does not crash.
6. Confirm current diagram remains unchanged.
7. Load a JSON with an unsupported symbolic object in an extra field.
8. Confirm it is rejected or stripped according to policy, not accepted with stale preview.

## 10. Preserve existing behavior

Do not regress:

- valid work-plane-local symbolic import;
- supported geometry refresh;
- global symbolic import;
- variable-resolution dialog;
- cancel path;
- save/load old diagrams;
- SVG preview;
- TikZ export;
- inline no-blank-lines;
- 4-space indentation;
- undo/redo;
- direct/Inspector local coordinate UI.

## 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 12. Report after implementation

Please report:

- files modified;
- root cause of unsupported stale preview acceptance;
- new supported-field traversal strategy;
- policy for unsupported nested symbolic/local sources;
- root cause of pending import throw;
- how `resolvePendingSymbolicDiagramImport` now returns `ok: false`;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
