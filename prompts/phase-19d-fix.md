# Phase 19D Fix Prompt

Repository: https://github.com/T2sp/stratified-tikz  
Phase: 19D  
Review status: `needs_changes`  
Blocking severity: Medium

## Summary

Phase 19D is not ready to complete.

There are no Critical issues. One Medium issue remains: symbolic coordinates stored in persisted `WorkPlaneFrameSnapshot` / local-plane frame `Vec3`s can validate successfully, but TikZ export formats those frame coordinates from numeric preview values instead of preserving symbolic expressions.

This silently loses symbolic intent. For example, a diagram with:

```ts
planeFrame.origin.x = R
```

can validate, but export as:

```tex
plane origin={(2,0,0)}
```

instead of preserving the symbolic macro expression, such as:

```tex
plane origin={({\R},0,0)}
```

or equivalent project-standard symbolic formatting.

## Review Findings

### Critical Issues

None.

### Medium Issues

#### 1. Symbolic `WorkPlaneFrameSnapshot` coordinates validate but export as numeric previews

Affected areas reported by review:

- `src/model/validation.ts`
  - validates frame `Vec3`s without symbolic variable context.
  - Review location: around `validation.ts:1736`.

- `src/tikz/generateTikz.ts`
  - formats work-plane-filled sheet frame coordinates without `GenerateContext`.
  - Review location: around `generateTikz.ts:1093`.

- Same no-context frame formatting pattern appears for:
  - work-plane-filled sheet local-plane TikZ scopes,
  - 3D template scopes,
  - scoped work-plane Bezier frames / work-plane-relative Bezier frames.

Observed bug:

- A symbolic frame coordinate such as `planeFrame.origin.x = R` validates.
- Export then emits the numeric preview value, such as `2`, instead of the symbolic macro expression.
- This is unsafe because accepted symbolic user intent is silently erased during export.

### Low-Priority Issues

None.

## Required Fix

Choose one of the following two strategies, then implement it consistently.

### Preferred Strategy A — Preserve symbolic frame coordinates in export

Thread `GenerateContext` through all local-plane frame coordinate formatting paths so symbolic frame coordinates export as symbolic macro expressions rather than preview-derived numbers.

Use this strategy if frame-based TikZ options can correctly preserve symbolic expressions.

Required behavior:

- `WorkPlaneFrameSnapshot` frame `Vec3`s are validated with the same variable context used for other symbolic coordinates.
- Frame coordinate formatting receives enough context to format symbolic components.
- Symbolic frame components export as symbolic expressions/macros.
- Numeric-only frame components continue to export exactly as before.
- Existing no-blank-lines and option-ordering invariants remain unchanged.

At minimum, inspect and fix formatting for:

- work-plane-filled sheet frame coordinates,
- 3D template local-plane frame/scope coordinates,
- work-plane-relative Bezier frame/scope coordinates,
- any other persisted local-plane / surface / control-mode frame `Vec3` that may carry symbolic metadata.

Likely target areas:

- `src/model/validation.ts`
- `src/model/symbolicCoordinates.ts`
- `src/tikz/generateTikz.ts`
- model definitions containing `WorkPlaneFrameSnapshot`
- tests covering sheet/template/Bezier local-plane export

Implementation guidance:

1. Find all helpers that format frame coordinates as plain numeric tuples.
2. Add or reuse a symbolic-aware coordinate formatter that accepts `GenerateContext`.
3. Ensure the formatter can emit symbolic components using the same escaping/macro mapping policy as existing symbolic point/path exports.
4. Ensure work-plane TikZ option output remains valid when one or more components are symbolic.
5. Avoid duplicating symbolic formatting logic; reuse existing symbolic coordinate helpers where possible.
6. Make export fail closed if invalid symbolic metadata reaches the generator.

### Fallback Strategy B — Reject symbolic frame coordinates if export cannot preserve them

Use this strategy only if symbolic frame coordinates cannot currently be represented correctly in generated TikZ without a larger architecture change.

Required behavior:

- Persisted work-plane/surface/control-mode frame `Vec3`s must reject symbolic metadata during validation/load/import.
- UI paths must not allow symbolic input for those frame fields.
- Export must not silently convert symbolic frame metadata to numeric preview values.
- If invalid persisted symbolic frame metadata reaches export, export must fail closed rather than emit preview-derived numeric coordinates.

At minimum, reject symbolic metadata on:

- `WorkPlaneFrameSnapshot.origin`
- `WorkPlaneFrameSnapshot.u`
- `WorkPlaneFrameSnapshot.v`
- work-plane-filled sheet local-plane frames
- 3D template frames
- scoped work-plane Bezier / control-mode frames
- any related persisted frame `Vec3` that currently exports through numeric-only frame formatting

Implementation guidance:

1. Add a clear validation helper, for example `validateNumericOnlyFrameVec3` or equivalent.
2. Use that helper in model validation and saved-diagram parsing.
3. Ensure malformed or unsupported symbolic frame metadata returns a clean validation/parse error.
4. Do not strip symbolic metadata silently.
5. Do not export numeric previews for unsupported symbolic frame metadata.
6. Document the rejection in tests and, if appropriate, in developer-facing comments.

## Important Decision Rule

Do not allow this intermediate state:

```text
symbolic frame Vec3 validates successfully
but export emits numeric preview coordinates
```

That is the bug to eliminate.

The accepted final behavior must be exactly one of:

```text
symbolic frame Vec3 validates and exports symbolically
```

or:

```text
symbolic frame Vec3 is rejected before export
```

## Detailed Codex Prompt

```text
You are working in the Stratified TikZ repository.

Fix the Phase 19D review issue.

Repository:
https://github.com/T2sp/stratified-tikz

Phase:
19D

Review status:
needs_changes

Critical issues:
None.

Medium issue:
Symbolic WorkPlaneFrameSnapshot coordinates can validate but are exported as numeric preview values in local-plane TikZ scopes.

The review found that src/model/validation.ts validates frame Vec3 values without the symbolic variable context, while src/tikz/generateTikz.ts formats work-plane-filled sheet frame coordinates without GenerateContext. The same no-context frame formatting pattern appears for 3D template scopes and scoped work-plane Bezier frames.

Observed repro:
A diagram with planeFrame.origin.x = R validates, but exports plane origin={(2,0,0)} instead of preserving the symbolic expression, for example plane origin={({\R},0,0)} or the project-standard equivalent.

Goal:
Eliminate silent symbolic-to-preview-number loss for local-plane frame coordinates.

Acceptable fix strategies:
A. Preferred: preserve symbolic frame coordinates in export by threading GenerateContext through frame coordinate formatting.
B. Fallback: reject symbolic metadata on persisted work-plane/surface/control-mode frame Vec3 values unless export can preserve it.

Do not leave behavior where symbolic frame coordinates validate but export as numeric preview values.

Tasks:

1. Inspect all frame-related data paths.

Start with:
- src/model/validation.ts
- src/model/symbolicCoordinates.ts
- src/tikz/generateTikz.ts
- model definitions for WorkPlaneFrameSnapshot
- work-plane-filled sheet model/export code
- 3D template scope/export code
- work-plane-relative Bezier / scoped control-mode frame code
- save/load and diagram parsing code for persisted frame Vec3s
- tests for symbolic coordinates and TikZ export

Find every persisted frame Vec3 that can carry symbolic metadata and every generator helper that formats frame coordinates without GenerateContext.

2. Choose and implement one consistent policy.

Preferred policy:
If local-plane frame TikZ options can preserve symbolic expressions, thread GenerateContext through frame coordinate formatting and export symbolic frame components using the same macro/expression formatting policy used by existing symbolic point/path coordinates.

Fallback policy:
If symbolic frame TikZ options cannot be preserved correctly in this phase, reject symbolic metadata for those frame Vec3s during validation/load/import and prevent UI creation/editing paths from accepting it.

3. If implementing symbolic export support, ensure:

- frame Vec3 validation uses the variable context needed to resolve symbolic previews;
- frame coordinate formatters receive GenerateContext;
- work-plane-filled sheet frame coordinates preserve symbolic components;
- 3D template frames preserve symbolic components;
- work-plane-relative Bezier frames preserve symbolic components;
- export does not use preview values when symbolic metadata exists;
- invalid symbolic frame metadata fails closed;
- existing numeric-only frame export remains unchanged;
- inline and standalone export ordering remains unchanged;
- no blank physical lines are introduced.

4. If implementing rejection instead, ensure:

- symbolic metadata is rejected for persisted work-plane/surface/control-mode frame Vec3s;
- validation/load/import return clean errors instead of throwing;
- UI add/edit paths report clear validation errors;
- export fails closed if invalid symbolic frame metadata somehow reaches the generator;
- no symbolic frame data is silently stripped;
- no numeric preview values are emitted for unsupported symbolic frames.

5. Add regression tests.

Required tests for the chosen policy:

If preserving symbolic export:
- work-plane-filled sheet with symbolic planeFrame.origin.x exports the symbolic macro/expression, not the preview number.
- work-plane-filled sheet with symbolic planeFrame.u or planeFrame.v exports symbolically.
- 3D template frame with symbolic origin/u/v exports symbolically.
- work-plane-relative Bezier frame with symbolic origin/u/v exports symbolically.
- a valid numeric-only frame still exports exactly as before.
- invalid symbolic metadata in a frame returns a validation/export error rather than throwing or exporting preview values.
- variable definitions still appear before symbolic frame coordinates in standalone and inline modes.
- inline output preserves the no-blank-lines invariant.

If rejecting symbolic frames:
- work-plane-filled sheet with symbolic planeFrame.origin.x is rejected by validation/load.
- symbolic planeFrame.u or planeFrame.v is rejected.
- 3D template frame symbolic origin/u/v is rejected.
- work-plane-relative Bezier frame symbolic origin/u/v is rejected.
- malformed saved symbolic frame metadata returns a clean validation/parse error.
- export cannot produce preview-derived numeric output from symbolic frame metadata.
- numeric-only frames still validate/export exactly as before.

Required specific assertion:
A test must prove that a frame coordinate whose symbolic expression is R and whose preview value is 2 does not export as the bare numeric preview tuple component 2 when symbolic metadata is accepted.

6. Keep existing correct behavior unchanged.

Preserve:
- variables emitted before symbolic coordinate definitions in standalone mode;
- inline mode places variables inside tikzpicture before coordinates;
- inline no-blank-physical-lines invariant;
- point, label, polyline, absolute cubic control, filled boundary, work-plane-filled sheet boundary, sheet vertex, and 2D template center symbolic exports;
- duplicate/invalid variable rejection;
- unsupported symbolic arc coordinates and unsupported 3D template centers, if they are intentionally documented as rejected;
- existing layer/style/camera behavior;
- existing numeric-only frame export.

7. Run verification commands.

Run:
PATH=/opt/homebrew/bin:$PATH git diff --check
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

If lint is available and not already covered, also run:
PATH=/opt/homebrew/bin:$PATH npm run lint

8. Report results.

In the completion message, include:
- chosen policy: symbolic export support or validation rejection;
- files changed;
- frame paths audited;
- tests added;
- test command results;
- build result;
- whether Phase 19D is ready for re-review.

Completion criteria:
- No symbolic frame Vec3 can validate and then export as preview-derived numeric coordinates.
- Work-plane-filled sheet frame behavior is covered by regression tests.
- 3D template frame behavior is covered by regression tests.
- Work-plane-relative Bezier frame behavior is covered by regression tests.
- Numeric-only frame behavior remains unchanged.
- Tests pass.
- Build passes.
- git diff --check passes.
- No Critical or Medium issues remain for Phase 19D.
```

## Regression Test Matrix

### If symbolic frame export is supported

| Area | Test case | Expected result |
|---|---|---|
| Work-plane-filled sheet | `planeFrame.origin.x = R`, preview `2` | Exports symbolic expression/macro, not bare `2` |
| Work-plane-filled sheet | `planeFrame.u.x = R` or `planeFrame.v.x = R` | Exports symbolically |
| 3D template frame | symbolic `origin/u/v` component | Exports symbolically |
| Work-plane Bezier frame | symbolic `origin/u/v` component | Exports symbolically |
| Invalid metadata | missing symbolic component fields | Clean validation/export error |
| Numeric baseline | numeric-only frame | Existing output unchanged |
| Ordering | symbolic frame uses variable `R` | `\pgfmathsetmacro{\R}{...}` appears before use |
| Inline output | symbolic frame in inline TikZ | No blank physical lines |

### If symbolic frame metadata is rejected

| Area | Test case | Expected result |
|---|---|---|
| Work-plane-filled sheet | symbolic `planeFrame.origin.x` | Validation/load rejects |
| Work-plane-filled sheet | symbolic `planeFrame.u/v` | Validation/load rejects |
| 3D template frame | symbolic `origin/u/v` | Validation/load rejects |
| Work-plane Bezier frame | symbolic `origin/u/v` | Validation/load rejects |
| Malformed metadata | incomplete `Vec3.symbolic` object | Clean validation/parse error |
| Export guard | invalid symbolic frame reaches generator | Export fails closed |
| Numeric baseline | numeric-only frame | Existing output unchanged |

## Verification Commands

Run:

```bash
PATH=/opt/homebrew/bin:$PATH git diff --check
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

If available:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

## Completion Criteria

Phase 19D can be marked ready for re-review only when all of the following are true:

- [ ] The implementation no longer allows symbolic frame coordinates to validate and then export as numeric previews.
- [ ] The chosen policy is consistent across validation, load/import, UI paths, and export.
- [ ] Work-plane-filled sheet frame behavior is covered by tests.
- [ ] 3D template frame behavior is covered by tests.
- [ ] Work-plane-relative Bezier frame behavior is covered by tests.
- [ ] Numeric-only frame export behavior remains unchanged.
- [ ] Existing symbolic point/path/template-center behavior remains unchanged.
- [ ] `PATH=/opt/homebrew/bin:$PATH git diff --check` passes.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm test` passes.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm run build` passes.
- [ ] No Critical or Medium issues remain.

## Compressed Prompt

```text
Fix Phase 19D in the Stratified TikZ repository.

The review found one Medium issue: symbolic WorkPlaneFrameSnapshot/local-plane frame Vec3 coordinates can validate but export as numeric preview values. Example: planeFrame.origin.x = R validates but exports plane origin={(2,0,0)} instead of preserving {\R} or the project-standard symbolic expression. validation.ts validates frame Vec3s without symbolic variable context, and generateTikz.ts formats work-plane-filled sheet frame coordinates without GenerateContext. Similar no-context frame formatting appears for 3D template scopes and work-plane-relative Bezier frames.

Eliminate silent symbolic-to-preview-number loss.

Choose one consistent policy:
1. Preferred: thread GenerateContext through local-plane frame coordinate formatting and preserve symbolic origin/u/v components in export.
2. Fallback: reject symbolic metadata on persisted work-plane/surface/control-mode frame Vec3s unless export can preserve it.

Do not allow symbolic frame data to validate and then export as preview numbers.

Audit and fix:
- WorkPlaneFrameSnapshot validation
- symbolicCoordinates helpers
- work-plane-filled sheet frame export
- 3D template frame/scope export
- work-plane-relative Bezier frame/scope export
- save/load/import validation
- export defensive guards

Add regression tests for:
- work-plane-filled sheet frame origin/u/v
- 3D template frame origin/u/v
- work-plane-relative Bezier frame origin/u/v
- malformed symbolic frame metadata
- numeric-only frame baseline
- variable ordering before symbolic use
- inline no-blank-lines invariant if symbolic export is supported

Required assertion: a symbolic frame component with expression R and preview value 2 must not export as the bare numeric preview 2 when symbolic metadata is accepted.

Run:
PATH=/opt/homebrew/bin:$PATH git diff --check
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

Report chosen policy, files changed, tests added, command results, and whether Phase 19D is ready for re-review.
```
