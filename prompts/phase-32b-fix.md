# Phase 32B Targeted Fix Prompt: Correct the disabled-control rejection oracle for Playwright label retargeting

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve the existing
paint implementation, Inspector field resolver, selection-oracle correction,
previous 32A fixes, fixtures, tests, documentation and user changes. Do not reset
or restart implementation.

The latest parent checked revision `99535517c9d465e265f415d7af0e370f4c00f46e`
plus documentation changes. Its before/after fingerprint was
`20cc7c6c846029df9d248f5fc7ae4195e23eb8ab7e0a4e776cc110fd51e04322`.
This matches the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated disabled-control negative-test mismatch, focused
regressions/diagnostics, and further demonstrated 32B acceptance failures.
Preserve strict TypeScript. Avoid new dependencies, additional schema changes,
production UI changes to accommodate this test, and unrelated lint cleanup.
Keep 32C geometric shapes and 32D spacing, minimum dimensions and anchors deferred.

## Latest execution findings

The original caption-based resolver correction is already present at `9953551`.
The latest parent now supplies native evidence that the live line-style/cap/join
edits and Border width invalid-draft/recovery sequence work. Do not repeat the
previous prompt's claim that these are still only predicted or unexecuted.

The child reported localhost startup `EPERM`; the parent launched Chrome and
failed later inside the cloned Inspector's disabled-control negative test.
This is neither the historical 30-second exact-label timeout nor a permissions
failure. The earlier read-only inspection finding no additional defect is
superseded by this concrete native test failure. Documentation-only revalidation
does not correct the newly demonstrated mismatch.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-7bdmDz
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and checkout snapshots;
- `point-paint-observation-0002.json` through `0013.json` for live field edits,
  mixed paint and invalid-width/recovery;
- `point-paint-observation-0014.json` through `0019.json` for cloned production
  select/numeric markup and old/corrected locator counts;
- `point-paint-observation-0035.json` for the disabled native select;
- `point-paint-observation-0036.json` through `0038.json` for the failed rejection
  assertion, completed clone checks and preserved real-App state.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-AWviTj/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,739 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `pointInspectorFields.mjs:216`, through `reject` at line 198 |
| Failure stage / scenario | `point-node-paint-import-persistence` / `point-paint-native-inspector-history` |
| Completed groups / evidence records | 14 of 16 / 145 |
| Completed point scenarios | All 11 from 32A; 0 of 5 new 32B scenarios |
| Browser | Chrome 153.0.8010.53; Node v26.9.0 |
| Browser page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent acceptance review | Not reached |

Native observations show all three old exact-label counts are 0 and corrected
control counts are 1. The real App reaches `dashed`/`round`/`bevel` paint and
passes its mixed-paint checks. Border width follows `2 -> NaN -> 2`, with
`aria-invalid` false/true/false, warning association present only while invalid,
and unchanged saved model/history during invalid input and recovery.

The clone completes 25 recorded checks before the disabled-control mismatch,
including all three live/preset select pairs, re-resolution, outside-drawer
isolation, numeric snapshots and earlier negative cases. These are progress
within the first paint scenario, not a completed paint scenario. Later paint
variants, copy/bulk/duplicate, imports/persistence, lifecycle/dimming and paint
exports remain unverified by this run. The separate later
`settled-SVG-export-standalone` group was not reached; cumulative
`point-node-settled-export` did complete.

## Confirmed cause: correct rejection occurs at the wrapping label

The clone intentionally sets the resolved native select's `disabled` property
and expects the resolver to reject:

```js
await reject('disabled-control', ({ controls }) => controls.evaluate((element) => {
  element.disabled = true
}), /Enabled native select/)
```

The resolver checks the Inspector, caption, wrapper and native control in order.
Its shared `assertUsable()` calls `locator.isEnabled()` for the wrapper before
checking the native select. Production fields use a wrapping HTML label.

In the installed Playwright 1.62.1, enabled/disabled state queries use
`retarget(node, 'follow-label')`. A wrapping label is retargeted to its associated
`label.control`. Consequently, disabling the select also makes the wrapper
locator's `isEnabled()` return false. The resolver correctly rejects before
attempting selection, at:

```text
Enabled Inspector field wrapper: Border line style
false !== true
```

The outer `assert.rejects` then fails because that valid early rejection does
not match `/Enabled native select/`. The demonstrated defect is an overly
specific rejection oracle, not acceptance of a disabled control, a renewed
caption-lookup failure, or a production rendering defect.

There are two related test/evidence gaps:

1. `tests/scripts/pointInspectorFields.test.mjs` uses independent
   `wrapperEnabled` and `controlEnabled` booleans. The disabled-control fixture
   leaves the wrapper enabled, so it misses the real label-to-control delegation.
   Its 44 passing helper tests do not establish native state semantics.
2. `inspectPointInspectorField()` calls a local DOM predicate
   `!element.matches(':disabled') && aria-disabled !== 'true'` its `enabled`
   observation. `0035` therefore reports wrapper `enabled: true` and control
   `enabled: false`, while Playwright rejects at the wrapper. These values are
   different measurements, not inconsistent native behavior. Preserve that
   distinction in diagnostics instead of treating the local predicate as an
   equivalent implementation of `Locator.isEnabled()`.

The parent's configured Playwright module is:

```text
/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

Inspect the installed sibling `playwright-core` state-query/retarget implementation
when confirming this contract; do not change, patch or vendor the dependency.
No new browser reproduction is claimed merely from reading its source.

## Required reading

Read `AGENTS.md`, `prompts/phase-32b-implement.md`,
`prompts/phase-32b-review.md`, `docs/PHASE_32B_IMPLEMENTATION.md`, and relevant
acceptance notes in `docs/PREVIEW_UI.md` and `docs/LABEL_ADAPTER.md`.

Trace the failure through:

- `scripts/pointInspectorFields.mjs`, especially `assertUsable`, resolver order,
  field diagnostics and the clone's `reject` helper;
- `tests/scripts/pointInspectorFields.test.mjs` and its selector-aware doubles;
- `scripts/checkPointNodePaint.mjs`, `scripts/pointCheckDiagnostics.mjs`, and
  `src/ui/inspector/InspectorField.tsx` / `PointPaintFields.tsx`;
- the preserved selection-oracle and owned-FontFace regressions;
- `scripts/automation/phase-verification.mjs` and the existing runner workflow.

Line numbers identify the inspected failure; locate current equivalents if
later edits have shifted them.

## Required correction

### 1. Assert the intended rejection without prescribing an incorrect boundary

Prefer preserving the resolver's current disabled-target rejection and correct
the clone's expected failure to account for label retargeting. Keep the check
specific to disabled-state rejection for this exact field. Accepting the known
wrapper assertion for the wrapping-label case is appropriate; a generic
`assert.rejects` accepting any error, blanket `/Enabled/`, or catching a timeout
is not sufficient.

Verify the preconditions independently: there is exactly one intended visible
field and native select, its disabled state is real, and its starting value is
different from the requested value. Assert that rejection leaves the value
unchanged and produces no input/change events. In helper tests, also establish
that `selectOption` was never invoked. An unrelated missing-control error,
option mismatch or thrown diagnostic error must not count as the expected pass.

Do not remove enabled checks, force selection, enable the target before the
rejection, skip the negative case or increase timeouts. Do not reorder/drop
wrapper protection solely to make an old error-message regex pass. If a small
refactoring makes failure categories explicit, preserve all existing absence,
ambiguity, visibility and disabled-state protections and keep the change local.
A new general validation framework is not required.

### 2. Cover label delegation in focused and native regressions

Extend the existing registered tests with the actual correlated state: a native
select is disabled and its wrapping label's Playwright enabled query is also
false. Confirm the intended early rejection and zero native selection attempts.
Keep an independent disabled wrapper/Inspector case so fixing this expectation
does not collapse distinct negative controls into one permissive result.

Use the existing clone of actual production markup to retain a native regression
for the reported case. Record wrapper and control state before rejection, prove
no value/event mutation, then verify that the restored enabled control can be
selected normally. Keep the real App's production handlers/model/history checks;
clone success alone cannot establish the whole paint workflow.

Ensure remaining negative cases execute, including missing/disabled options and
wrong requested values/types. Preserve caption/preset isolation, all three
selects, rerender re-resolution and the real `NaN`/recovery sequence now confirmed
by the parent. Unit doubles should exercise the discovered relationship without
claiming to reimplement the browser's full accessibility/state algorithm.

### 3. Distinguish local DOM state from Playwright enabled state in evidence

Add clearly named observations for the local `disabled`/`:disabled`/ARIA state
and Playwright's queried enabled state at the wrapper and control. Where useful,
record which native element `label.control` references. Collect locator state
only when the match is unique; absent or ambiguous targets must remain diagnosable
without throwing a different error during evidence collection.

Do not silently change the meaning of existing diagnostic fields consumed
elsewhere. Preserve current DOM/caption/option/value observations and explicitly
identify any local-only predicate. Save the negative-case name, expected/actual
rejection reason and unchanged-value/event evidence before marking that check
complete. Maintain bounded diagnostics and cleanup that preserve the primary
error if evidence capture or page closure also fails.

### 4. Preserve the accepted earlier behavior and cumulative gates

Keep the caption-based resolver already in `9953551`, all corrected real-App
select sites, valid/invalid/recovered numeric behavior, independent border
half-width selection oracle and ownership-based FontFace cleanup. Preserve
independent point paint, opacity composition, saved-format v2 migration,
ordered imports/presets, TikZ overrides, immutable pending SVG capture, raw
source/history, PGF reference artifacts and binary-aware checkout identity.

Do not weaken groups, named scenarios, required artifacts, fingerprint matching,
review or commit/push gates. If later execution reveals another failure, retain
its evidence and diagnose it before a bounded 32B correction; do not assume all
remaining failures are merely error-message mismatches.

## Verification and completion criteria

Run focused regressions, the registered full suite, build, applicable strict
TypeScript/fixture checks, changed-script syntax checks, targeted lint and
`git diff --check` with the supported PATH. Preserve the documented unrelated
lint baseline rather than expanding this task into cleanup.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, including both browser checks. Inspect the
terminal result, all 16 groups, all 16 named point scenarios (11 from 32A and
5 from 32B), page-error arrays and required JSON/SVG/PNG artifacts. The complete
paint group and later standalone settled-export group must execute successfully.
Partial clone checks, helper tests and historical reports do not close the gate.

Evidence must match the final checkout, including untracked files and binary
fixtures. If child browser startup is unavailable, report that limitation
separately and use the established browser-capable parent path. It does not
explain this parent's native assertion failure.

After matching verification succeeds, independently review the same checkout
against `prompts/phase-32b-review.md` through the existing workflow. `32B verify`
itself does not perform review. Phase 32B remains incomplete until both gates
pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant acceptance notes with the
latest parent's native progress, label-retargeting cause, bounded correction,
regressions, exact commands/results, evidence paths and final checkout identity.
Separate historical exact-label/selection failures, now-executed real-App
selection and NaN recovery, the current negative-test mismatch, fresh acceptance
and independent review. List remaining unexecuted checks explicitly. Do not
claim that production paint was defective or that all of the first paint
scenario passed merely because its earlier field edits now work.
