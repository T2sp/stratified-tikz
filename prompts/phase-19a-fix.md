# Phase 19A Fix Plan

Repository: <https://github.com/T2sp/stratified-tikz>
Phase: 19A
Status: `needs_changes`
Blocking severity: Medium

## Repository Context

This fix plan targets the Phase 19A working tree reviewed by Codex.

The public GitHub `main` branch was checked for repository structure and verification commands. At the time of inspection, the reviewed Phase 19A files named in the Codex report, especially `src/tikz/expressionFormatter.ts` and `src/model/scalarExpressions.ts`, were not visible in GitHub `main`; they appear to be local or branch-only Phase 19A changes. Apply this fix in the same working tree where `prompts/phase-19a-review.md` was run.

The current repository uses a Vite + TypeScript + React setup, with `npm test`, `npm run build`, and `npm run lint` available through `package.json`.

## Summary

Phase 19A is not ready to complete because dangerous or reserved TeX control sequence names are still accepted by the scalar-expression variable and TikZ macro formatting path.

There are no Critical issues and no Low-priority issues. The remaining Medium issue is safety-related: variables such as `def`, `newcommand`, `include`, or `shipout` can pass validation and later be mapped or formatted as dangerous TeX macros such as `\def`, `\newcommand`, `\include`, or `\shipout`.

## Review Findings

### Critical Issues

None.

### Medium Issues

#### 1. Dangerous TeX command filtering is too narrow

Files reported by review:

- `src/tikz/expressionFormatter.ts`
- `src/model/scalarExpressions.ts`

The current Phase 19A implementation rejects some raw TeX-like syntax, but its macro-name denylist is too small. The review found that `isSafeTikzMacroName` still accepts dangerous or reserved macro mappings such as:

- variable `def` mapped to `\def`
- variable `newcommand` mapped to `\newcommand`
- variable `include` mapped to `\include`
- variable `shipout` mapped to `\shipout`

The review also found that `isScalarExpressionVariableName('def')` returns true. That means a future toolbar variable can pass Phase 19A validation and later generate broken or dangerous TikZ output.

This violates the Phase 19A requirement that dangerous TeX/raw commands are rejected.

### Low-Priority Issues

None.

## What Already Looks Correct

Do not regress these parts while fixing the safety issue:

- Expression model distinguishes numeric and symbolic scalar inputs.
- Parser is hand-written and does not use JavaScript `eval` or `new Function`.
- Variables, arithmetic, parentheses, constants, elementary functions, and right-associative exponentiation are supported.
- PGFMath degree trig semantics are implemented and documented.
- Unknown variables/functions, backslashes, braces, semicolons, newlines, missing preview values, and non-finite evaluation results are rejected.
- TikZ formatter maps variables through explicit macro mappings and preserves ordinary precedence with readable output.
- Existing numeric coordinate behavior is not touched by this subphase.

## Required Fixes

### Fix 1 — Introduce a shared dangerous/reserved TeX control-sequence policy

Create a single shared policy for TeX control sequence names used by both scalar variable-name validation and TikZ macro mapping validation.

Preferred shape:

- Add a shared constant or helper near the existing scalar-expression validation code, for example:
  - `DANGEROUS_TEX_CONTROL_SEQUENCE_NAMES`
  - `isDangerousTexControlSequenceName(name: string): boolean`
  - `isSafeScalarExpressionVariableName(name: string): boolean`
  - `isSafeTikzMacroName(name: string): boolean`
- Reuse the helper from both `src/model/scalarExpressions.ts` and `src/tikz/expressionFormatter.ts`.
- Avoid maintaining two separate denylists that can drift apart.

The denylist must include at least the names from the review:

```text
def
let
newcommand
renewcommand
providecommand
include
includeonly
usepackage
shipout
special
immediate
openin
closein
closeout
write18
```

Also strongly consider rejecting the following additional TeX/LaTeX primitives or high-risk names, unless the project has a specific reason to allow one of them:

```text
input
read
write
openout
closeout
catcode
csname
endcsname
expandafter
noexpand
futurelet
afterassignment
everyjob
errmessage
errorstopmode
scrollmode
batchmode
nonstopmode
global
long
outer
protected
par
documentclass
RequirePackage
ProvidesPackage
PassOptionsToPackage
directlua
luaescapestring
pdfobj
pdfcatalog
pdfinfo
pdfliteral
pdfcompresslevel
pdfimageresolution
```

Recommended implementation details:

- Normalize before lookup with a predictable function, for example `name.trim().toLowerCase()`.
- Keep the allowed identifier grammar separate from the dangerous-name policy.
- Treat names as unsafe if they are reserved even when they otherwise match the normal identifier regex.
- Ensure the policy applies to macro names with or without a leading backslash if the formatter accepts either shape internally.
- If `\write18` is parsed as control sequence `write` plus text `18`, reject both `write` and `write18`.

### Fix 2 — Apply the same policy to scalar variable-name validation

Update `isScalarExpressionVariableName` or its equivalent validation path so that dangerous/reserved TeX command names are rejected as scalar variable names.

Required examples that must become invalid:

```ts
isScalarExpressionVariableName('def') === false
isScalarExpressionVariableName('let') === false
isScalarExpressionVariableName('newcommand') === false
isScalarExpressionVariableName('renewcommand') === false
isScalarExpressionVariableName('providecommand') === false
isScalarExpressionVariableName('include') === false
isScalarExpressionVariableName('includeonly') === false
isScalarExpressionVariableName('usepackage') === false
isScalarExpressionVariableName('shipout') === false
isScalarExpressionVariableName('special') === false
isScalarExpressionVariableName('immediate') === false
isScalarExpressionVariableName('openin') === false
isScalarExpressionVariableName('closein') === false
isScalarExpressionVariableName('closeout') === false
isScalarExpressionVariableName('write18') === false
```

Keep ordinary safe variables valid, for example:

```ts
isScalarExpressionVariableName('x') === true
isScalarExpressionVariableName('theta') === true
isScalarExpressionVariableName('radius') === true
isScalarExpressionVariableName('height_1') === true
```

Do not loosen any existing rejection for raw TeX or statement-breaking characters such as:

```text
\
{
}
;
newline
```

### Fix 3 — Apply the same policy to TikZ macro mapping validation

Update `isSafeTikzMacroName` or the equivalent formatter macro-name validation so that explicit macro mappings cannot target dangerous TeX control sequences.

Required examples that must be rejected:

```ts
isSafeTikzMacroName('def') === false
isSafeTikzMacroName('newcommand') === false
isSafeTikzMacroName('renewcommand') === false
isSafeTikzMacroName('providecommand') === false
isSafeTikzMacroName('include') === false
isSafeTikzMacroName('includeonly') === false
isSafeTikzMacroName('usepackage') === false
isSafeTikzMacroName('shipout') === false
isSafeTikzMacroName('special') === false
isSafeTikzMacroName('immediate') === false
isSafeTikzMacroName('openin') === false
isSafeTikzMacroName('closein') === false
isSafeTikzMacroName('closeout') === false
isSafeTikzMacroName('write18') === false
```

If the function accepts leading backslashes, these must also be rejected:

```ts
isSafeTikzMacroName('\\def') === false
isSafeTikzMacroName('\\newcommand') === false
isSafeTikzMacroName('\\include') === false
isSafeTikzMacroName('\\shipout') === false
isSafeTikzMacroName('\\write18') === false
```

Keep normal user-facing symbolic variables and safe macros valid:

```ts
isSafeTikzMacroName('x') === true
isSafeTikzMacroName('theta') === true
isSafeTikzMacroName('radius') === true
isSafeTikzMacroName('height') === true
```

Only keep names valid if they are already valid under the existing grammar. This fix should narrow acceptance, not broaden it.

### Fix 4 — Ensure the formatter fails closed

When formatting a scalar expression to TikZ:

- Reject unsafe variable names before formatting.
- Reject unsafe macro mappings before inserting a control sequence into output.
- Do not silently fall back from an unsafe macro mapping to a raw variable name if that would hide a validation bug.
- Prefer a clear error or result object consistent with the existing formatter style.
- Do not emit partially formatted TikZ if any variable mapping is unsafe.

Expected behavior:

- A variable named `def` cannot be accepted into a symbolic scalar expression.
- A macro mapping targeting `\def` cannot be used even if the variable name itself is safe.
- No generated TikZ expression can contain the reviewed dangerous macro names as formatter-produced variable macros.

## Regression Tests

Add tests proving that the dangerous names are rejected in both validation layers.

### Required test coverage

#### Scalar variable-name validation

Add or update tests near the existing scalar expression model tests.

Test all review-required names:

```text
def
let
newcommand
renewcommand
providecommand
include
includeonly
usepackage
shipout
special
immediate
openin
closein
closeout
write18
```

Assert that each one is rejected by scalar variable-name validation.

#### TikZ macro mapping validation

Add or update tests near the existing expression formatter tests.

For each review-required name, assert that macro mapping validation rejects:

- the bare name, such as `def`
- the backslash form, such as `\def`, if that input shape is supported

#### End-to-end formatter rejection

Add at least one end-to-end test proving that the formatter cannot emit a dangerous macro through an explicit variable-to-macro mapping.

Suggested cases:

```ts
formatScalarExpressionToTikz(parseScalarExpression('x'), {
  variableMacros: { x: 'def' },
})
```

and, if backslash values are supported:

```ts
formatScalarExpressionToTikz(parseScalarExpression('x'), {
  variableMacros: { x: '\\def' },
})
```

Both should fail according to the existing error style.

#### Safe-name regression tests

Add tests proving ordinary safe variables still work:

```text
x
y
z
theta
radius
height_1
alphaBeta
```

Also keep existing tests for arithmetic, precedence, functions, constants, and PGFMath degree trig semantics passing.

### Test placement guidance

Use the repository's existing test conventions. Based on the Phase 19A review, likely targets are:

- scalar expression parser/validation tests for `src/model/scalarExpressions.ts`
- TikZ expression formatter tests for `src/tikz/expressionFormatter.ts`

If a new test file is added, remember that this repository's `npm test` script has historically listed test files explicitly. Update `package.json` if needed so the new test file runs under `npm test`.

## Implementation Checklist

- [ ] Inspect `src/model/scalarExpressions.ts` and identify the current identifier validation helper.
- [ ] Inspect `src/tikz/expressionFormatter.ts` and identify `isSafeTikzMacroName` or equivalent.
- [ ] Add one shared dangerous/reserved TeX control-sequence denylist/helper.
- [ ] Ensure scalar variable names reject the denylisted names.
- [ ] Ensure TikZ macro mapping names reject the denylisted names.
- [ ] Normalize names consistently before checking the denylist.
- [ ] Reject both bare and leading-backslash macro-name forms if both are accepted by the current API.
- [ ] Add tests for all review-required dangerous names.
- [ ] Add tests for safe ordinary names to prevent overblocking.
- [ ] Add an end-to-end formatter test proving a dangerous macro cannot be emitted.
- [ ] Run the full test suite.
- [ ] Run build.
- [ ] Run lint and `git diff --check`.

## Verification Commands

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npm run lint
git diff --check
```

Expected results:

- `npm test` passes.
- `npm run build` passes.
- Existing Vite chunk-size warning remains non-blocking unless it changes or points to a new regression.
- `npm run lint` passes.
- `git diff --check` has no output.

The prior review recorded:

- `PATH=/opt/homebrew/bin:$PATH npm test` passed with 787 tests and 0 failures.
- `git diff --check` passed.
- `PATH=/opt/homebrew/bin:$PATH npm run build` passed with the existing-style Vite chunk-size warning.
- Node used: `v26.3.0`.
- npm used: `11.16.0`.

After this fix, the test count may increase if new regression tests are added.

## Completion Criteria

Phase 19A can be marked complete after all of the following are true:

- [ ] Dangerous/reserved TeX control-sequence names are rejected by scalar variable-name validation.
- [ ] Dangerous/reserved TeX control-sequence names are rejected by TikZ macro mapping validation.
- [ ] The denylist includes at least `def`, `let`, `newcommand`, `renewcommand`, `providecommand`, `include`, `includeonly`, `usepackage`, `shipout`, `special`, `immediate`, `openin`, `closein`, `closeout`, and `write18`.
- [ ] Tests prove the review-required dangerous names are rejected.
- [ ] Tests prove ordinary safe variable names still work.
- [ ] Formatter tests prove dangerous macros cannot be emitted through variable mappings.
- [ ] Existing symbolic scalar parsing/formatting behavior is preserved.
- [ ] Existing numeric coordinate behavior is unchanged.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm test` passes.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm run build` passes.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm run lint` passes, if lint is expected for the phase gate.
- [ ] `git diff --check` passes.
- [ ] No Critical or Medium review issues remain.

## Suggested Codex Prompt

```text
You are working in the Stratified TikZ repository.

Fix the Phase 19A review issue.

Context:
- The review found no Critical issues and no Low-priority issues.
- There is one Medium safety issue.
- src/tikz/expressionFormatter.ts and src/model/scalarExpressions.ts currently reject some raw TeX-like syntax, but dangerous TeX command filtering is too narrow.
- isSafeTikzMacroName accepts dangerous macro mappings such as variable def -> \def, newcommand -> \newcommand, include -> \include, and shipout -> \shipout.
- isScalarExpressionVariableName('def') currently returns true.
- This violates the Phase 19A requirement that dangerous TeX/raw commands are rejected.

Tasks:
1. Add a shared dangerous/reserved TeX control-sequence policy used by both scalar variable-name validation and TikZ macro mapping validation.
2. Reject dangerous/reserved names including at least:
   def, let, newcommand, renewcommand, providecommand, include, includeonly, usepackage, shipout, special, immediate, openin, closein, closeout, write18.
3. Apply the same policy to isScalarExpressionVariableName or the equivalent scalar variable-name validation path.
4. Apply the same policy to isSafeTikzMacroName or the equivalent TikZ formatter macro mapping validation path.
5. If macro names may be supplied with a leading backslash, reject both bare and backslash-prefixed forms.
6. Ensure the formatter fails closed and never emits a dangerous formatter-produced macro when a variable mapping is unsafe.
7. Add regression tests proving all review-required dangerous names are rejected by scalar variable validation and macro mapping validation.
8. Add tests proving ordinary safe names such as x, theta, radius, height_1, and alphaBeta still work.
9. Add at least one end-to-end formatter test proving an unsafe mapping such as x -> \def cannot emit TikZ.
10. Preserve existing parser behavior, arithmetic precedence, PGFMath degree trig semantics, and numeric coordinate behavior.
11. Run:
    PATH=/opt/homebrew/bin:$PATH npm test
    PATH=/opt/homebrew/bin:$PATH npm run build
    PATH=/opt/homebrew/bin:$PATH npm run lint
    git diff --check
12. Report files changed, tests added, commands run, and whether Phase 19A is ready for re-review.

Completion criteria:
- Dangerous/reserved TeX command names are rejected consistently in scalar variable validation and TikZ macro mapping validation.
- Regression tests cover the full required denylist.
- Safe ordinary variable names remain valid.
- Tests pass.
- Build passes.
- Lint and git diff --check pass.
- No Critical or Medium issues remain.
```

## Re-review Notes

During re-review, check these exact points:

1. The dangerous-name policy is shared or otherwise impossible to drift between `scalarExpressions.ts` and `expressionFormatter.ts`.
2. `isScalarExpressionVariableName('def')` and the other review-required names return false.
3. `isSafeTikzMacroName('def')`, `isSafeTikzMacroName('newcommand')`, `isSafeTikzMacroName('include')`, `isSafeTikzMacroName('shipout')`, and `isSafeTikzMacroName('write18')` return false.
4. Backslash-prefixed forms are rejected if the API accepts such inputs.
5. Formatter output cannot contain dangerous macros introduced through variable macro mappings.
6. The fix does not use `eval`, `new Function`, or raw TeX escaping as a workaround.
7. The fix does not break safe symbolic scalar expressions.
8. Full tests and build pass.