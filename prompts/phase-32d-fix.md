# Phase 32D Fix for imported layout provenance and native acceptance

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout. Fix the imported-style Clear
verification failure below, add regressions for the new layout metadata, and
obtain fresh cumulative verification before independent review. Preserve the
spacing, minima, PGF anchors, persistence, Inspector controls, and shared live
and exported placement already implemented. Do not restart Phase 32D.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual working tree before editing.
Preserve all existing tracked changes and untracked implementation, tests,
reference fixtures, and documentation. Do not reset, discard, stash, commit,
or push the unfinished implementation to get past a runner guard.

The current request continues the existing 32D implementation. Historical
32C-only deferrals do not authorize a scoped 32D pass. Keep strict cumulative
32D verification and the runner's verification-before-review/commit contract.
Phase 32 remains incomplete until the current tree has accepted evidence and
passing independent review.

## Retained evidence and checkout identity

The implementation handoff is `/private/tmp/stz-32d-handoff/HANDOFF.md`;
its changed-file inventory is `/private/tmp/stz-32d-handoff/changed-files.txt`.
The latest supplied browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-edFhng/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-CFirlz/verification.json`.
- Primary failure log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-CFirlz/05-check-free-labels/command.log`.
- Native observations, failure screenshots, and scenario records:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-CFirlz/05-check-free-labels/artifacts/`.

At prompt preparation the branch was `phase/32d-margin-minsize-anchor`, HEAD
`721c2655bb97e8479d8a4caf913915e5a46672ab`. The supplied parent report records
fingerprint `038040d249a87bbf2e6fb4040157e684221ae767de99b378bb449268b15a9754`.
The actual tree before adding this prompt instead had fingerprint
`6cd3c4fff15a3b582dc44c20259c34d7e3cdffe08962660da0a873c829475835`, with
53 nonignored untracked files. The prompt addition changes that identity again.
Capture the actual current identity, including untracked files; these historical
hashes are diagnostic context and must not become acceptance constants.

Distinguish the child startup restriction from the later real parent failure:

| Retained run | Result |
| --- | --- |
| Implementation child | 5,328 tests passed without failures or skips; build, diff, focused TypeScript, changed-TypeScript lint, and script syntax checks passed. Browser commands stopped before launch at `listen EPERM`. |
| Independent PGF references | The handoff records 172 fixed boxes, 4,925 anchors, 11 authentic failure controls, and 406 passing geometry tests. Preserve their inputs, artifacts, and established tolerances. |
| Browser-capable parent | 5,328 tests, build, diff, and `check:label-assets` passed. Chrome executed native scenarios; `check:free-labels` then failed at the Clear assertion below. |

The parent's free-label report completed 14 of 18 groups. The paint/import group
started but did not complete. The geometric-shapes group, layout/anchor group,
and final standalone-export group did not execute. The retained page-error list
is empty, but unfinished scenarios and downloads still block acceptance.
Neither this report nor the older child `EPERM` run is a complete 32D pass.

## Diagnose the Clear assertion first

The primary failure is:

```text
AssertionError [ERR_ASSERTION]: Clear changes only references/provenance on app-point
scripts/checkPointImportedPaint.mjs:313
runPointImportedPaintChecks -> clearCase -> clearCheck

actual:   style.importedLayout is absent
expected: style.importedLayout = {
  referenceId: 'imported-style-redpoint',
  baseline: {},
  overriddenFields: []
}
```

Inspect `free-labels-evidence.json` and the retained
`point-paint-clear-imported-style` observations before changing an assertion.
The last recorded checkpoint is
`point-node-paint-import-persistence / paint-point-paint-clear-imported-style-observed`.
This failure occurred after browser launch and many real native transitions.
Do not describe it as a localhost-permission failure.

The current production path supports the observed result:

- `createImportedPointPaintSnapshot` in `src/model/styles.ts` now records
  `importedLayout`, even when the imported style has an empty layout baseline.
- `pointStyleForImportedReference` removes `importedPaint`, `importedShape`,
  and `importedLayout` when their reference is detached or replaced. The explicit
  `style.layout` and its unit/context values are retained.
- `src/model/validation.ts` requires imported layout provenance to match the
  active `importedTikzStyleReferenceId`. Retaining that provenance after Clear
  would create an invalid point.
- `tests/ui/pointStyleClear.test.ts` already removes all three provenance fields
  from its expected cleared point.

Confirm these contracts against the actual code. The expected correction is to
update the two stale verification expectations, not to retain orphaned metadata
in production or to remove explicit layout settings.

## Correct both verification expectations

1. In `scripts/checkPointImportedPaint.mjs`, the expected clone in `clearCheck`
   deletes `stylePresetId`, `importedTikzStyleReferenceId`, `importedPaint`, and
   `importedShape`, but omits `importedLayout`. Remove imported layout provenance
   from the expected selected point as well. Preserve the full exact comparison
   of every other field and the native contour/body/shape/leaves comparisons.
2. In `scripts/automation/phase-verification.mjs`,
   `validateDetachedPaintEvidence` has the same omission in its expected clone.
   Correct that independent evidence validator too. Check that cleared, redone,
   and reloaded targets have no preset/external association or imported
   paint/shape/layout provenance. Keep explicit layout values and unselected
   controls unchanged; undo must restore the exact original imported point.

Keep the browser observer and independent parent acceptance assertions effective.
Do not strip layout from both sides, normalize away the difference, accept
partial objects, replace exact comparisons with selected-field checks, or
waive model validity. Preserve raw text, positions, paint, shape parameters,
presets, external source, reference definitions, and all retained history.
Legacy points without layout metadata must retain their existing meaning.

`appJsonPersistence.mjs` and the JSON persistence oracle already compare saved
non-view fields strictly. Do not exclude layout/provenance fields from those
comparisons to obtain a pass.

## Add regressions that expose this omission

Extend `clearRegressionEvidence` and the existing clear fault matrices in
`tests/scripts/runPhaseVerification.test.mjs`. The synthetic policy fixtures
currently exercise imported paint but do not carry imported layout provenance.
Add nonempty explicit layout and matching imported baseline/override metadata
to selected points and an unselected control. The selected provenance disappears
only at clear/redo/reload; the explicit layout remains identical, and undo
restores provenance. Label these records as synthetic policy tests; they are
not native browser evidence.

Require rejection controls for retained layout provenance after clear, redo,
or reload; changed or dropped explicit layout; changed unselected layout; and
undo losing the original layout provenance. Keep duplicate snapshot/state JSON
representations consistent in fault fixtures so a test reaches the intended
semantic check instead of failing only because redundant records disagree.
Preserve the existing one-commit, no-op repeat, redo-discard, and 100-entry
history-capacity controls.

Add a model/UI regression in `tests/ui/pointStyleClear.test.ts` with a nonempty
imported layout and a deliberate local axis override, including contextual
`em`/`ex` metadata. Check explicit axes, minima, anchor, units, and conversion
contexts survive Clear, undo/redo, and serialization/reload; provenance is
removed on detach and restored on undo; old snapshots and nested objects stay
immutable. Reimporting the old style must not modify the detached point.
Exercise standalone and inline TikZ options without assuming the legacy Size/2
defaults for a point that has explicit layout axes.

Use strict TypeScript without `any` for TypeScript changes. Prefer small,
testable corrections. Register any new test file in the explicit `npm test`
list. Add no dependencies for this fix.

## Preserve the full Phase 32D contract

Retain saved envelope version 2, additive optional layout, legacy Size/2
precedence, ordered shorthand/axis resolution, and per-axis em/ex context.
Preserve the recorded PGF solvers and anchors, actual body/baseline/depth,
unsupported-anchor diagnostics, overflow-body picking, separate painted and
anchor-clearance bounds, authoritative model coordinates, 2D/3D projection,
and immutable click-time export placement.

Do not relax PGF reference tolerances or change geometry to repair a stale
metadata expectation. The documented diamond outer-separation exception remains
subject to independent review against its PGF evidence. Preserve both TikZ
modes, external-source semantics, exact saved text, and the existing font/
paragraph/TeX-program limitations. Free labels and path inline nodes retain
their established behavior.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused clear/provenance and policy
regressions first, then all required commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Run focused TypeScript/lint checks for changed TypeScript and syntax checks for
changed JavaScript. Keep documented baseline lint debt separate from new errors.
Avoid unrelated cleanup. Required checks that fail or cannot execute remain
failed/unavailable; do not report them as passed.

Run browser acceptance in the browser-capable parent with a fresh owned server
and supported Playwright/Chrome configuration. A focused reproduction can help
diagnosis but cannot establish cumulative acceptance. `check:point-native-focused`
does not run this imported paint workflow; the 32C scoped profile cannot close
32D. If the child encounters `listen EPERM`, retain that startup failure and hand
the exact current tree to the parent instead of weakening the sandbox or checks.

The parent must load updated policy in a fresh verifier process. Its manual
verification route can check the preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Do not bypass the ordinary implementation/fix runner's clean-tree guard or
discard unfinished work to satisfy it. The parent's strict report must require
all twelve 31F groups, all three 32A groups, the complete 32B paint/import group,
the 32C shapes group, and `point-node-layout-anchors-combined`.
Require named terminal scenarios, actual artifacts, no page errors, native
single/multiple Clear and history/persistence, both TikZ modes, pending
transparent/white downloads, and downloaded SVG reopening outside the App.
Keep raw failure evidence and primary errors through bounded diagnostics and
resource cleanup.

If a later assertion fails after this correction, preserve its first failure
and diagnose that concrete defect before changing production or acceptance.
Do not skip predecessors, reuse historical/scoped reports, introduce a new
deferred profile, or relabel unexpected failures as the earlier 32B backlog.
A new concrete failure keeps strict 32D verification incomplete.

## Independent review and completion

After fresh complete strict parent verification, review the exact matching
tracked/untracked checkout read-only using `prompts/phase-32d-review.md`.
Check the actual report and artifacts. Reviewer startup restrictions do not
require repeating a successful matching parent browser run; missing, stale,
partial, or failed evidence cannot substitute for it.

Update implementation/plan/roadmap status only to the actual verified state.
Keep Phase 32 incomplete while any required acceptance or independent-review
gate remains open. Preserve the parent's stop-before-review/commit behavior
on failed verification and its checkout identity guard after review.

Report the bounded fix, changed files, focused/full checks, fresh parent evidence
path and checkout identity, native/download coverage, independent review result,
and any remaining concrete failure. The implementation child must leave commit
and push to the existing parent workflow after its verification and review gates
pass. Do not bypass review or claim completion from child-only or historical
results.
