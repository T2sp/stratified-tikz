# Phase 11 — Review Instructions

You are reviewing the implementation of **Phase 11** of the 3D Stratified Diagram GUI project.

The review should focus on correctness, regression risk, determinism, and consistency with the established ordering conventions from earlier phases. Treat Phase 11 as a mechanical continuation unless the repository specification says otherwise.

## Review Scope

Review only the changes relevant to Phase 11, but check for accidental regressions in previously completed behavior from Phases 1–10D.

Pay special attention to:

1. whether the implementation actually satisfies the Phase 11 specification;
2. whether the change is unnecessarily broad;
3. whether codimension/depth/layer ordering remains consistent with prior decisions;
4. whether rendering and export output are deterministic;
5. whether tests cover the new behavior and likely regressions.

## Critical Issues

Mark an issue as **Critical** if any of the following are true:

1. Phase 11's main requirement is not implemented.
2. The implementation breaks existing Phase 1–10D behavior.
3. The project no longer builds or typechecks.
4. The implementation introduces nondeterministic rendering/export order.
5. The implementation uses PGF/TikZ layers incorrectly, for example:
   - a `pgfonlayer` references a layer not included in `\pgfsetlayers`;
   - `main` is omitted from the layer list;
   - layer declarations occur after the relevant `tikzpicture` starts;
   - layer names are not TeX-safe.
6. The implementation changes the established codimension ordering policy without an explicit Phase 11 requirement.

## Medium Issues

Mark an issue as **Medium** if any of the following are true:

1. The behavior is mostly correct but misses an important edge case.
2. Tests are present but do not cover ordering-sensitive or export-sensitive cases.
3. The implementation duplicates existing logic instead of reusing project abstractions.
4. The implementation is correct but too broad for Phase 11.
5. The UI, domain model, and export logic become unnecessarily coupled.
6. Error handling is incomplete but does not break the main happy path.
7. Generated output is deterministic but poorly normalized or unnecessarily verbose.

## Minor Issues

Mark an issue as **Minor** if any of the following are true:

1. Naming is slightly unclear.
2. Comments are stale or insufficient.
3. Test names could be more descriptive.
4. Formatting is inconsistent but harmless.
5. There are small opportunities to simplify code without changing behavior.

## Suggested Review Procedure

1. Inspect the diff.
2. Identify the intended Phase 11 requirement from the repository specification.
3. Check whether implementation files match that requirement.
4. Run or inspect the relevant tests.
5. Check ordering-sensitive behavior manually if tests are insufficient.
6. Check generated/exported output for determinism.
7. Verify that no unrelated refactor was introduced.

If available, run:

```bash
npm run typecheck
npm test
npm run build
```

If the phase automation supports review/fix flows, also check:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 11
```

For fixes after review, the expected command is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 11 fix
```

## Output Format

Use the following review format.

```markdown
# Phase 11 Review

## Summary

Choose one:

- needs changes
- approved

## Critical Issues

List critical issues here. If none, write:

None found.

## Medium Issues

List medium issues here. If none, write:

None found.

## Minor Issues

List minor issues here. If none, write:

None found.

## Tests / Verification

Describe what was checked, including commands run and results.

## Notes

Add any non-blocking observations here.
```

## Review Guidance

Do not request changes merely because a different ordering convention might be aesthetically preferable. If the implementation preserves the established codimension ordering and the output is deterministic, that should generally be accepted unless Phase 11 explicitly requires another ordering policy.

Do not ask for broad refactors unless there is a concrete correctness or maintainability problem introduced by Phase 11.
