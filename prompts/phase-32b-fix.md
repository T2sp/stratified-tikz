# Phase 32B Targeted Fix Prompt: Diagnose native App scroll stability and complete acceptance

## Environment and scope

Work on `phase/32b-color-opacity-outline`. Inspect status and preserve the
current implementation and untracked runner helpers/tests. At this prompt
update HEAD is `73698463338ee5c0ca60afe0519f815b2a0fce24`, with tracked changes
to `docs/PHASE_32B_IMPLEMENTATION.md`, `package.json` and
`tests/scripts/runPhaseRunner.test.mjs`, plus four untracked helper/test files.
The runner handoff and latest failed parent verification identify the same
pre-prompt tree:

```text
c0708e3431620fc0285ca29136e4a24173fef6ee9bded85b442df2289f54f2ed
```

This fingerprint describes the checkout before this prompt edit. Recompute the
final identity after corrections, including untracked files and binary bytes.
Do not reset, discard or restart the existing implementation.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

The immediate task is the native App geometry/stability failure below, followed
by complete same-tree acceptance. Preserve the completed runner hardening,
directory-uncertainty fix and App continuity work. Keep strict TypeScript,
bounded parsing, existing dependencies and 32A behavior; defer 32C/32D.
Do not execute arbitrary TeX in the importer/preview, upgrade npm because of
its update notice, or perform unrelated lint cleanup.

## Evidence and current status

Completed runner implementation and independent review:

```text
/private/tmp/stz-32b-runner-investigation-8CHXcc/handoff.json
/private/tmp/stz-32b-runner-investigation-8CHXcc/independent-review.md
```

That implementation passed 3,325 tests, build, diff, strict TypeScript and
targeted lint. It retained the 60-second fixture deadline, added actionable
process diagnostics, preserved failed evidence and bounded cleanup of owned
child processes. Independent review found no remaining concrete code defect,
but returned `needs_changes` for missing native acceptance: its final verifier
stopped at localhost `EPERM` before browser startup. The separate direct
free-label attempt also stopped before startup.

The newer parent run did launch the browser and failed later:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-GPJG0D/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-GPJG0D/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-GPJG0D/05-check-free-labels/artifacts/free-labels-evidence.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-wST3PW/response.json
```

| Latest parent observation | Actual result |
| --- | --- |
| `npm test` | 3,325 passed; zero failed/skipped/cancelled |
| Build, diff, `check:label-assets` | Passed |
| `check:free-labels` | Failed at `real-App-workflows` |
| Runtime | Node v26.9.0; Chrome 154.0.8037.57 |
| Cumulative free-label report | 13 completed groups; 124 evidence records |
| Real-App group | `real-App-input-JSON-history-reused-ID-load` incomplete |
| Later groups | `settled-SVG-export-standalone` and `point-node-paint-import-persistence` unexecuted |
| Checkout before/after | Identical pre-prompt fingerprint shown above |
| Verification / commit readiness | Failed; no commit or push |

This runtime failure is not the earlier startup `EPERM`. The historical
`window.stzAppLabels` loss and old runner null-status trigger remain unproven.
Host sleep was independently observed overlapping historical runner timing
anomalies; that does not establish the cause of this new browser timeout.
The latest parent test duration was 3,126,609.6615 ms. Preserve timing evidence
without treating long duration alone as proof of suspension or resource pressure.

## 1. Diagnose the actual App scroll/stability failure

The primary failure is:

```text
locator.scrollIntoViewIfNeeded: Timeout 29998.788000000175ms exceeded.
  - attempting scroll into view action
  - waiting for element to be stable
at geometry (scripts/checkFreeLabelsApp.mjs:123:43)
at inspectStage (scripts/checkFreeLabelsApp.mjs:164:21)
at runAppChecks (scripts/checkFreeLabelsApp.mjs:280:5)
at runPointThenAppChecks (scripts/checkPointNodes.mjs:371:3)
at scripts/checkFreeLabels.mjs:467:3
```

Read `scripts/checkFreeLabelsApp.mjs`, its geometry/pointer helpers, the App
fixture, production preview/camera/Inspector layout and the cumulative caller.
Use the exact current sequence, including the real JSON download:

1. `app-valid-initial`, `app-invalid-pending` and `app-invalid-fallback` passed.
2. The valid source `$\mathord{\mathrm{i}}$` was held and edited;
   `app-valid-again-pending` passed.
3. `save('app-valid-pending')` completed through the production download control.
   The pending JSON and five persistence diagnostic artifacts were retained.
4. `release(valid)` ran. `inspectStage('valid-again-ready', valid, 'ready')`
   closed the Inspector and completed its ready-state wait, then entered
   `geometry()`. Its framing and any pan invariants returned before the scroll
   call timed out. A ready attribute alone does not prove stable geometry.
5. This ready stage's remaining source/paint/geometry/pointer checks and later
   ready JSON, Undo/Redo, obsolete-completion and reused-ID load workflows did
   not complete. Do not infer their success from the passing pending stage.

Inspect artifacts from the failing run before editing. `app-failure.png` is
the screenshot of the actual App page; it shows the App, canvas and rendered
small `i` after the timeout. A full-page still image does not establish viewport
reachability, stable rectangles or uninterrupted document/API ownership during
the wait. The outer `failure.png` belongs to the separate renderer fixture.
Likewise, outer `pageErrors: []` does not report the owned App page's local
errors. Do not interpret either as evidence that the App disappeared or stayed
error-free.

### Required evidence and targeted correction

The free-label `runAppChecks` owns a separate page. Its current catch saves
`app-failure.png`, then cleanup closes that page; local `errors` and `actions`
and failure-time geometry/lifecycle state are not retained. The existing
`ownedAppPage.mjs` continuity helper is wired into the later point-paint group,
which this run never reached. Do not claim it already diagnosed this failure.

1. Add bounded, phase-specific evidence on the actual owned App page around
   pending download, release, ready wait, framing/pan and scroll. Record stage,
   source/request/status, wall and monotonic timestamps, page URL, document
   generation and API identity. Retain local page errors/actions and lifecycle
   events, including navigation, close/crash, visibility and frame progress.
   Capture before the potentially blocking operation as well as on failure;
   use existing ownership/diagnostic helpers where appropriate without a broad
   harness rewrite. Do not depend on the App API for every diagnostic.
2. Collect a small bounded sequence of SVG/label/ancestor rectangles, viewBox,
   client transforms, window/ancestor scroll offsets, viewport dimensions and
   relevant layout/animation state. Correlate Inspector/camera changes and
   downloaded-file completion with those samples. Distinguish node replacement,
   actual layout movement, offscreen geometry, stalled animation frames or
   lifecycle changes using evidence, rather than choosing a cause from the
   Playwright error text alone. Preserve the original timeout if capture fails.
3. Give diagnostic capture and any frame/stability waits finite host-side
   budgets as well as browser-side bounds, so stalled frames or evaluation
   cannot hang cleanup. Retain available JSON/DOM/images before closing the
   owned page; dispose pending work and keep cleanup scoped to owned resources.
   Report partial or unavailable evidence explicitly. Do not replace a primary
   failure with a later screenshot, state-read or close failure.
4. Reproduce the exact valid → invalid → valid pending/ready flow, including
   the pending JSON download, both in a focused run and after the cumulative
   predecessor workload. Measure the cause and make the smallest appropriate
   harness or production correction. If the trigger remains unproven, state
   that and preserve the failed attempt. One passing rerun is not a diagnosis.

Do not solve this by increasing/removing the timeout, unconditional sleeps,
retrying until green, skipping the ready stage, disabling animations globally,
forcing clicks, or removing the stability requirement. If a different scrolling
or framing mechanism is justified, demonstrate equivalent stable, visible
native geometry before measurement, screenshot and pointer actions. Do not
reload/recreate the App, reset history, silently reacquire a replaced document
or API, mutate the model through a fixture shortcut, shorten the label source,
clamp probes or weaken readiness/source ownership assertions.

### Required geometry guarantees and regressions

Keep the existing camera framing through production controls and its exact
saved JSON/history invariants. The label and every inside/outside probe must
fit the usable canvas viewport, with consistent transforms after scrolling.
Preserve `elementFromPoint` checks, real native pointer actions, selection/Alt
behavior, paint/opacity/font observations and raw source/request assertions.
Keep `preserveView` for obsolete-completion observations: corrective pan must
not conceal movement caused by an obsolete result.

Add focused regressions for the demonstrated defect and any new bounded
diagnostic/wait behavior. Exercise actual pending-to-ready geometry after the
download and relevant Inspector/camera layout changes. Controlled failure
cases should cover the changed stability/ownership paths, including a stalled
or never-stable target and primary-error retention where applicable. Keep
native acceptance of the full valid/invalid/valid sequence, Undo/Redo during
held conversion, obsolete completions, CRLF/raw JSON and reused-ID document
loading. Unit/mocked diagnostics alone cannot establish native success.

## 2. Preserve completed fixes and cumulative acceptance

Do not reopen the completed runner task without new evidence. Keep
`tests/scripts/helpers/ownedRunnerProcess.mjs`,
`tests/scripts/helpers/runnerFixtureEvidence.mjs`, their registered regressions
and existing runner cases. Preserve the 60,000 ms deadline, explicit
status/signal/spawn-error and wall/monotonic diagnostics, file-backed output,
bounded owned-process-group termination and failed evidence surviving cleanup.
Never kill unrelated processes or interpret null/abnormal status as success.
Keep fresh-process verifier loading and transitive fixture dependencies,
complete 31F twelve-group acceptance, and rejection of incomplete/tampered
reports, worker failures, checkout mismatch and review-time mutation. Synthetic
fixture reports are not native browser evidence. Avoid unrelated global test
concurrency or production policy changes.

Preserve the directory-uncertainty fix for unsupported mutation bodies and
nested dependencies, including body/work/depth exhaustion. Keep later relative
uncertainty, supported absolute-option recovery, local override intent,
paint-only recovery, source order and reconstruction. Retain the independent
failing/corrected PGF fixtures under
`tests/fixtures/point-paint-pgf/mutation-directory/`, actual compilation of both
corrected modes and generator-to-compiled-byte/operator checks. Do not
regenerate references merely to repair App acceptance orchestration.

Keep the existing owned App page/URL/document/API assertions, exact
saved/runtime JSON, history and revision checks, seven App → SVG → App
transitions, helper-return/next-load checks and three separate native fault
controls. Do not wait away ownership failure or weaken the continuity contract.

The cumulative policy in `scripts/automation/phase-verification.mjs` requires:

- All 16 groups / 27 named point scenarios, including
  `point-paint-mutation-directory-uncertainty` and `point-paint-app-continuity`.
- All seven actual standalone transitions and three native continuity fault
  controls, including 13 required continuity artifacts.
- The directory-mutation import/edit/history/persistence scenario and its 11
  artifacts, plus all existing clear and imported-paint acceptance.
- All six responsive downloads and 91 responsive artifacts, physical border /
  body / font checks, .5 → 2 → .5 captures, negative controls, white-background
  validation and immutable click-time SVG inputs.

Keep detached-provenance cleanup, runtime-model validation separate from
camera-free persistent JSON, the bounded 100-entry history contract,
unsupported color shadowing, raw source text, 2D/3D semantics and existing
free/inline-label behavior. Partial runs and old 25-scenario reports do not
satisfy the current requirements.

## Verification, documentation and review

Read `AGENTS.md`, paired 32B implement/review prompts and current
`docs/PHASE_32B_IMPLEMENTATION.md`, `docs/IMPORTED_POINT_PAINT.md` and
`docs/DATA_MODEL.md`. Keep implementation changes focused on the demonstrated
App failure and its evidence. Preserve all previous failed attempts and
distinguish established findings from hypotheses.

Run focused regressions, applicable strict TypeScript, changed-script syntax,
targeted lint and `git diff --check`. Run `npm test` and `npm run build`
sequentially because they share asset preparation. Distinguish unrelated
established lint debt and the nonblocking build chunk warning from failures.
Obtain native execution in an authorized browser-capable environment; report
an actual environment block separately if it prevents that execution.

Before final verification, update the implementation report with actual
findings, changes, command results and the external handoff location. Freeze
code, tests and tracked docs; keep the final report path/fingerprint in an
external handoff. Then run:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands and current cumulative native evidence to pass on
the same final tree, including tracked/untracked/binary identity. Any checkout
change after verification requires matching verification again. Obtain an
independent read-only review of that same tree against
`prompts/phase-32b-review.md`; `32B verify` itself does not perform review.
The earlier `needs_changes` review and four newly passing commands do not
complete either final gate.

Do not commit or push while verification or review is unsuccessful. 32B remains
incomplete until both gates pass; 32C/32D remain deferred.
