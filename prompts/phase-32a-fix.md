# Phase 32A Targeted Fix Prompt: Match native JSON persistence assertions to saved UI settings

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect status first and preserve the implementation,
previous oracle fixes, verifier correction, fixtures, tests, documentation, and
all user changes, including untracked files. Do not reset or restart implementation.

The latest parent checked revision `b0bd6b85144af46bed2194592a44b3be92639736`
plus working-tree changes. Its before/after fingerprint was
`5a4c860a5254711ef637fd7d7345eda3d70c07c188845fba0b0affafa96e92c9`.
This matched the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated point JSON persistence-oracle mismatch, affected
save/load assertions, focused regressions, diagnostics, and further demonstrated
32A acceptance failures. Keep strict TypeScript and avoid new dependencies,
schema changes, unrelated lint cleanup, or new rendering features. Preserve
MathJax/runtime/layout/export behavior and leave 32B-32D deferred.

## Latest execution findings

This is a new parent browser assertion failure, after the previous native line-
metric correction. It is not the child's localhost `EPERM`, a recurrence of the
16.4-versus-15.8127 mismatch, or an observed loss of point text.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-wOC4BM
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and the recorded checkout snapshots;
- `point-native-2d.json`, the actual downloaded JSON that triggered the comparison;
- `point-observation-0133.json`, containing the native/resized/isolated metric
  comparison, and subsequent observations through `point-observation-0138.json`.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-pMecCj/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,496 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointNodesApp.mjs:144` |
| Failure stage | `point-node-native-input` |
| Completed groups / passing records | 11 of 15 / 116 |
| Completed point scenarios | 7 of 11 |
| Page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The seven completed point scenarios remain:
`point-language-shapes-2d-3d`, `point-valid-invalid-valid-exact-source`,
`point-A-B-C-delete-duplicate-history-load`, `point-resource-retry-font-readiness`,
`point-contour-boundaries-cycling`, `point-camera-pan-zoom-drag`, and
`point-hidden-filtered-locked-dimmed-siblings`.

Within the still-incomplete native scenario, the 2D Inspector metric checks,
valid-invalid-valid recovery, undo/redo, and cursor placement now reached the
JSON download comparison. The saved metric comparison shows actual baseline
16.399999618530273 against expected 16.4, with bounds height 30.4. Preserve this
progress without marking the aggregate scenario complete.

The 2D reload and native 3D iteration were not reached. Point settled exports
and the later general App/settled-export groups were not executed. Four groups
remain incomplete: `point-node-body-layout-lifecycle`, `point-node-settled-export`,
`real-App-input-JSON-history-reused-ID-load`, and `settled-SVG-export-standalone`.
The child's reported 0/15 execution is separate from this parent's partial run.

## Confirmed cause: model diagnostics and download payload have different contracts

The current assertion is:

```js
const json = await readFile(path, 'utf8')
assert.deepEqual(JSON.parse(json), JSON.parse(beforeSave.json))
```

The relevant difference in the full parent log is:

```diff
  diagram: {
    ...
+   view: {
+     exportMode: 'inlineMath'
+   }
  }
```

The downloaded point text, coordinates, style, IDs, strata, and labels match the
expected model. The additional view metadata is required existing behavior:

1. `tikz()` in `scripts/checkPointNodesApp.mjs` selects `standalone`, then
   `inlineMath`, to verify both generated outputs. It leaves `inlineMath` selected.
2. The App's read-only browser snapshot uses `editableDiagramSignature`, computed
   as `serializeDiagram(editableDiagram)` without current UI serialization options
   (`src/App.tsx:1036-1044`). This intentionally supports model/history invariants.
3. Actual `downloadJson()` passes `createSerializeDiagramOptionsForUi(...)` to
   `serializeDiagram()` (`src/App.tsx:1823`), including the selected export mode,
   applicable camera/axis options, and visibility settings.
4. `normalizePersistentView()` in `src/model/serialization.ts` persists these
   values. Existing `tests/ui/tikzExportMode.test.ts` and model serialization tests
   explicitly require selected TikZ export-mode persistence.

Thus equality with the unaugmented diagnostic JSON is an incorrect save oracle.
Do not remove legitimate metadata from production downloads or change the model
just to make that equality pass.

Also account for the next native 3D iteration: saving can add
`view.showCoordinateAxesInTikz: false` and serialize the current UI camera rather
than just the diagram's stored view. Nondefault visibility is also persisted.
Adding only `exportMode` to this 2D expected value is not a complete correction.

The following reload assertion compares the reloaded model with the saved
payload, so it has a different, valid purpose. A read-only production parser/
serializer replay of the saved 2D artifact and a representative 3D save produced
exact round trips. This is not browser acceptance, but gives no reason to weaken
the reload comparison because of the preceding save mismatch.

## Goal and required reading

Verify exact diagram preservation and correct persistence/restoration of current
UI settings through actual JSON download and load, while retaining independent
model/history invariants and all point rendering/export checks.

Read `AGENTS.md`, `prompts/phase-32a-implement.md`,
`prompts/phase-32a-review.md`, `docs/PHASE_32A_IMPLEMENTATION.md`, and:

- `scripts/checkPointNodesApp.mjs`, `scripts/checkPointNodes.mjs`,
  `scripts/checkFreeLabelsApp.mjs`, and `scripts/fixtures/freeLabelsApp.tsx`;
- App diagnostic observation, `downloadJson()`, JSON loading, and UI-setting state
  in `src/App.tsx`;
- `src/ui/tikzExportMode.ts`, `src/model/serialization.ts`, and their tests;
- existing point diagnostics/tests and `scripts/automation/phase-verification.mjs`.

## 1. Correct the save expectation without weakening preservation checks

Capture the model snapshot and independently known/observed UI settings at the
save boundary. Check the downloaded file against the documented persistence
contract: exact non-view document content plus precise expected view metadata.
Account for existing view fields, UI overrides, supported normalization, and
optional/default-field rules. Reject unexpected changes outside those rules.

Use the actual selected controls or clearly separate read-only observations to
establish expected settings. Do not derive expected values from the downloaded
file, blindly delete `diagram.view`, ignore all metadata, or reduce the check to
point counts/source substrings. Keep exact raw text, coordinates, IDs, codim,
styles, layers, document fields, and format/version checks.

Preserve the current meaning of `state().json`. Replacing it globally with the
UI-augmented download payload would break existing invariants when `tikz()`
changes the selected mode. If extra diagnostic fields are necessary, add them
separately as serialized, read-only observations. Ensure observations are current
when settings change and avoid fixture mutation shortcuts.

Retain both TikZ mode checks. Restoring/changing the mode alone does not correct
the save contract: even an explicitly saved `standalone` value can differ from
an omitted model field. Do not remove the mode selection or download step to
avoid the failure.

## 2. Cover 2D/3D save and reload as distinct boundaries

Audit both the failing comparison and related save/load consumers. Preserve
strict comparison after loading the saved payload, unless a separately reproduced
normalization requires a narrowly documented expectation.

Verify that download itself changes neither model nor history, that raw point
text survives the round trip, and that loaded UI controls restore the saved
export mode and applicable camera/axis/visibility settings. Keep intentional
load/document-replacement history behavior distinct from download invariance.
Use the actual Download JSON and Load JSON UI, owned download/filechooser waits,
and the existing revision/settled waits.

Include representative 2D and 3D coverage, both export modes, and applicable
nondefault UI settings so a default-only fixture cannot conceal stale metadata.
Audit 3D camera/axis behavior before declaring the save assertion corrected.
Preserve the existing work-plane, direct/cursor, Inspector, and recovery scenarios.

## 3. Add focused regressions and pre-assertion persistence evidence

Add registered tests for the actual save comparison boundary, not only another
serializer test that misses the snapshot-versus-UI distinction. Establish that
correct UI metadata is accepted while these defects are rejected:

- missing, stale, or incorrect saved export mode;
- incorrect applicable 3D camera/axis or nondefault visibility metadata;
- changed point text/whitespace, coordinates, IDs, style, or unrelated document data.

Keep expected UI values independently controlled, rather than using the same
unverified output for both sides. Retain strict round-trip assertions and existing
model/history isolation tests. Reuse established serialization rules without
adding a parallel production save implementation.

Before vulnerable save/load assertions, record dimension, scenario, original
model, selected settings, downloaded file path/payload, expected metadata, and
useful difference paths. Save post-load model/control observations before their
assertions too. Existing point observations cover rendering but the current
aggregate native-scenario artifact is written only after both dimensions finish.
Diagnostics must survive an early persistence failure; never mark them as passes.
Preserve primary errors and bounded capture/cleanup behavior.

## 4. Preserve previous corrections and complete native acceptance

Keep exact-source/visible-fragment separation, independent Canvas line/ink
expectations, native SVG whitespace/containment checks, unchanged tolerances,
position corruption controls, and font/viewport/CTM diagnostics.

Preserve the corrected sanitized-SVG verifier policy and its structural checks,
required artifacts, and scenarios. Its Node regression pass is not proof that
unexecuted point download/reopen workflows have passed in the browser.

Finish both native dimensions, all three point settled-export scenarios, and
the subsequent general App/settled-export groups. Preserve all prior Phase 31
regressions and seven completed point scenarios; rerun them on the corrected tree.
If further failures occur, diagnose saved evidence and fix only demonstrated
32A issues without masking assertions or expanding to 32B-32D.

## Verification and completion

Run focused tests, applicable script syntax, strict fixture TypeScript, and
targeted lint, then:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

The browser-capable parent/Terminal must obtain fresh verification on the final
corrected checkout, including untracked files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Keep all fifteen groups, eleven named point scenarios, required artifacts,
checkout matching, fresh verifier process, and pre-review/commit failure gates.
Do not lower counts, skip checks, weaken sandboxing, or rewrite historical failure
evidence. If child browser startup is restricted, run available checks and provide
an exact handoff; parent browser acceptance remains required.

A standalone `verify` run does not perform independent review. After accepted
complete verification, review the exact matching checkout against
`prompts/phase-32a-review.md`. Do not recursively launch implementation/fix from
the fix child. Update `docs/PHASE_32A_IMPLEMENTATION.md` and relevant completion
documentation with the cause, actual results, and remaining gates.

## Report after fixing

Report the corrected save/load contract and consumers, metadata and raw-content
assertions, regressions/negative controls, diagnostic improvements, changed files,
focused/full check results, and fresh parent scenario/artifact results with
checkout identity. Distinguish historical oracle corrections, child `EPERM`, this
parent persistence assertion, subsequent verification, and independent review.
Keep 32A pending until its gates pass and leave 32B-32D outside this fix.
