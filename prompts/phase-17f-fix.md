# Phase 17F Fix Plan

Repository: <https://github.com/T2sp/stratified-tikz>
Phase: 17F
Status: `needs_changes`
Blocking severity: Medium

## Summary

Phase 17F is not ready to complete because `docs/SPEC.md` contradicts the actual TikZ export ordering implemented by the generator and asserted by existing tests/docs.

There are no Critical issues. One Low-priority UI polish issue was also found: the import status report can become very tall when a large `.sty` file contributes many imported keys.

## Review Findings

### Critical Issues

None.

### Medium Issues

#### 1. `docs/SPEC.md` describes the wrong imported-style option ordering

`docs/SPEC.md` currently says imported keys are emitted after structured/local-preset options.

That contradicts the current implementation and existing test/doc expectations:

- `src/tikz/generateTikz.ts` emits imported keys before structured fallback options when no local preset is used.
- `tests/tikz/generateTikz.test.ts` asserts the current ordering.
- `docs/TIKZ_OUTPUT.md` also documents/asserts the current ordering.

This is a Phase 17F Medium issue because the formal spec contradicts actual export behavior.

### Low-Priority Issues

#### 2. Import status report can grow too tall for large `.sty` imports

`src/App.tsx` renders every imported key in the import status report, and `src/App.css` does not currently cap or scroll that report.

The main Inspector preset list is already scrollable/filterable, so the primary workflow remains usable. However, a large `.sty` import can make the toolbar report excessively tall.

## Required Fixes

### Fix 1 — Align `docs/SPEC.md` with actual export ordering

Update the imported-style option ordering text in `docs/SPEC.md` so it matches the generator, tests, and `docs/TIKZ_OUTPUT.md`.

The corrected rule should state that, when no local preset is used, imported keys are emitted before structured fallback options.

Do **not** change `src/tikz/generateTikz.ts` or existing tests merely to match the old SPEC wording unless inspection proves the review is outdated. The intended targeted fix is documentation alignment.

Expected result:

- `docs/SPEC.md` no longer claims that imported keys are always emitted after structured/local-preset options.
- The documented ordering distinguishes the local-preset case from the no-local-preset fallback case if needed.
- `docs/SPEC.md`, `docs/TIKZ_OUTPUT.md`, `src/tikz/generateTikz.ts`, and `tests/tikz/generateTikz.test.ts` describe/assert compatible behavior.

### Fix 2 — Cap or scroll the import status key list

Update the import status UI so a large `.sty` import cannot make the toolbar/status report unboundedly tall.

Suggested implementation:

- Add a max height to the imported-key status list/container in `src/App.css`.
- Enable vertical scrolling with `overflow-y: auto`.
- Keep the current content and wording intact where possible.
- Avoid large UI redesigns.
- Avoid changing the Inspector preset list behavior unless necessary.

Expected result:

- Import status remains readable for small imports.
- Large imports do not push the rest of the toolbar/UI far down the page.
- The list of imported keys remains accessible through scrolling.

## Implementation Checklist

- [ ] Inspect the current text around `docs/SPEC.md` imported style ordering.
- [ ] Compare it with `docs/TIKZ_OUTPUT.md` and `tests/tikz/generateTikz.test.ts`.
- [ ] Update `docs/SPEC.md` to match current generator/test behavior.
- [ ] Inspect the import status report markup in `src/App.tsx`.
- [ ] Add or adjust CSS in `src/App.css` to cap/scroll the imported-key report.
- [ ] Keep existing export behavior unchanged unless a separate bug is discovered.
- [ ] Keep existing import/apply/export/save/load behavior unchanged.
- [ ] Re-run tests and build.

## Regression Tests

### Required

Run the existing full test suite:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
```

Existing tests should continue to pass, especially TikZ generation tests around imported styles and local user styles.

### Optional but Recommended

If the repository has suitable UI/component tests for the import status report, add or update a test covering a large imported key list.

Suggested assertion:

- The imported-key status report renders many keys without losing the key names.
- The relevant status container has a CSS class or structure that applies bounded height/scrolling.

Do not add brittle visual snapshot tests unless that is already the project convention.

## Build / Verification Commands

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

If lint/typecheck commands are available separately in `package.json`, also run them:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
PATH=/opt/homebrew/bin:$PATH npm run typecheck
```

Only run the separate lint/typecheck commands if they exist.

## Completion Criteria

Phase 17F can be marked complete after all of the following are true:

- [ ] `docs/SPEC.md` accurately describes imported-style option ordering.
- [ ] `docs/SPEC.md` no longer contradicts `src/tikz/generateTikz.ts`, `tests/tikz/generateTikz.test.ts`, or `docs/TIKZ_OUTPUT.md`.
- [ ] Large `.sty` imports no longer produce an unboundedly tall import status report.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm test` passes.
- [ ] `PATH=/opt/homebrew/bin:$PATH npm run build` passes.
- [ ] Any existing Vite chunk-size warning is treated as non-blocking unless it changes or indicates a new regression.
- [ ] No Critical or Medium review issues remain.

## Suggested Codex Prompt

```text
You are working in the Stratified TikZ repository.

Fix the Phase 17F review issues.

Context:
- The review found no Critical issues.
- There is one Medium issue: docs/SPEC.md contradicts actual TikZ export ordering for imported style keys.
- docs/SPEC.md currently says imported keys are emitted after structured/local-preset options.
- The generator emits imported keys before structured fallback options when no local preset is used.
- Existing tests and docs/TIKZ_OUTPUT.md assert the generator's current ordering.
- There is one Low issue: the import status report renders every imported key and is not capped or scrollable, so large .sty imports can make the toolbar report very tall.

Tasks:
1. Update docs/SPEC.md so imported-style option ordering matches src/tikz/generateTikz.ts, tests/tikz/generateTikz.test.ts, and docs/TIKZ_OUTPUT.md.
2. Do not change TikZ export behavior unless inspection proves the review is outdated.
3. Add a bounded height and vertical scrolling for the import status key list/report in the UI, preferably with a small CSS-only change in src/App.css and minimal markup changes in src/App.tsx only if needed.
4. Preserve existing import/apply/export/save/load behavior.
5. Run:
   PATH=/opt/homebrew/bin:$PATH npm test
   PATH=/opt/homebrew/bin:$PATH npm run build
6. Report files changed, tests run, build result, and whether Phase 17F is ready for re-review.

Completion criteria:
- docs/SPEC.md no longer contradicts generator/tests/docs.
- Large .sty import status reports are capped or scrollable.
- Tests pass.
- Build passes.
- No Critical or Medium issues remain.
```

## Re-review Notes

During re-review, check these exact points:

1. `docs/SPEC.md` ordering text now matches actual output ordering.
2. No generator behavior changed accidentally.
3. Existing TikZ generation tests still pass.
4. Import status report has a bounded height or scroll behavior.
5. The UI polish fix does not hide warnings, source names, load hints, or imported key names.

