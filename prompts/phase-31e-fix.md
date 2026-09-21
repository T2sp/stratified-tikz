# Phase 31E Targeted Fix Prompt: Own download waits and diagnose the later 3D export

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and all user
changes, including untracked files. Inspect current status first; do not reset
the branch, restore a historical base, or rerun implementation from scratch.

The latest failed parent verification used
`4c1dd9faeca926cbbda81edb57f82ebe89fb26a1` plus four modified tracked files:
`docs/PREVIEW_UI.md`, `docs/ROADMAP.md`, `package.json`, and
`scripts/checkSettledSvgExports.mjs`. Two files were untracked:
`scripts/standaloneSvgOpacity.mjs` and
`tests/scripts/standaloneSvgOpacity.test.mjs`. Preserve this numerical comparison
correction and its four registered tests. Files may since have changed or been
committed; the recorded snapshot is evidence, not a checkout to restore.

Preserve the completed React SVG-context/subtree extraction correction, native
boundary fixture, bounded screenshots, independent page ownership, pre-capture
diagnostics, exact-source oracles and negative controls. Preserve the runner's
parent verification/review gates and Phase 31D regressions.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax and shared parser/adapter/cache/rendering semantics. Limit work to
this App download failure, asynchronous error handling and further demonstrated
31E regressions. Phase 31F and unrelated lint cleanup remain out of scope.
Settled export is required in this phase, not deferred to 31F.

## Latest execution findings

This is a **new parent verification failure before independent 31E review**.
The opacity comparison repair passed native verification. All visibility
policies and the native render-boundary regression passed, and the first
actual App export was downloaded and reopened successfully. The new failure
is waiting for the second, later-document 3D white-background download.

Do not reopen the repaired title-hoisting, opacity or screenshot issues as if
they remained current blockers. Do not describe this run as a child browser
startup restriction. Do not invent review severity counts or approval.

### Current failure: an unhandled second-download timeout

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-ylXZks
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, including its final diagnostic
  `settled-export-App-3d-before-download`, and checkout snapshots;
- `export-click-time-2d-transparent.svg`, its standalone JSON/PNG and raster PNG;
- `settled-export-render-boundary.json`, selected/detached/serialized SVGs and
  `settled-export-render-boundary-zero-labels.svg`;
- completed autoHide/autoDim/layerFilter/hiddenLayer diagnostics and standalone
  captures, including the computed opacity values.

The checkout remained unchanged. Its fingerprint was
`91e464c7d49d376ce1d32f95bc73479e3ab28b277644c90406fe53b5a5a1c9e9`.
The run used Node v26.9.0, Chrome `153.0.8010.52`, the external Playwright
runtime, and the Vite fixture at `http://127.0.0.1:5174`.

The process exited 1 with:

```text
node:internal/process/promises:324
triggerUncaughtException(err, true /* fromPromise */);
page.waitForEvent: Timeout 30000ms exceeded while waiting for event "download"
at runSettledSvgExportChecks (scripts/checkSettledSvgExports.mjs:414:36)
```

The relevant sequence is currently:

```js
const secondDownloading = page.waitForEvent('download')
await button().click()
const second = await readStandalone(await secondDownloading,
  'export-later-3d-white', 'white', captured3d)
```

The event promise has no rejection handler until the intervening native click
finishes. It can reject while that click remains pending, outside the surrounding
async try/catch. The log demonstrates an unhandled rejection rather than a
normally caught scenario failure. The line number identifies where the event
wait was created; it does not establish that the export click completed or that
production export preparation started.

### Retained state and limits of the evidence

The final saved checkpoint is **before the second click**:

| Observation | Saved result |
| --- | --- |
| App document revision | 2, the later 3D document |
| Download count | 1 |
| Export status | `SVG exported with transparent background.` |
| `aria-busy` | `false` |
| Current label states | Ready or expected fallback; no pending labels |
| Resource label | Fallback after the deliberately injected earlier failure |
| Recorded conversion requests | All existing recorded requests delivered |
| First downloaded file | 23,341 bytes, transparent SVG; standalone/raster images retained |
| Last completed scenario | `settled-export-click-time-edit-load-duplicate-isolation` |
| Browser page errors at last checkpoint | None |

There is no saved post-click status, actionability failure, second download,
App failure diagnostic or failure screenshot. The aggregate browser report is
left at `result: "running"`, with ten completed groups, one incomplete group,
127 passing scenario records and `unexecuted: []`. The parent verification
correctly reports failure from the nonzero exit. Do not call this partial
report passed or infer that no page errors occurred after the last checkpoint.

The immediate download absence has not yet been explained. Possible causes
include a blocked native click, an export-preparation failure, or a download
handoff/event problem. Do not assume a production timeout from this log alone.

One concrete source-supported hypothesis is UI interception: the harness opens
and expands the inspector drawer for editing and does not close it. The first
export uses `element.click()` for its intentional synchronous duplicate-click
test; the second export uses native `locator.click()`. The inspector and bottom-
right export controls have overlapping layout potential and different stacking
levels. Measure the actual button/hit target and retain the native click trace;
this is a hypothesis, not an observed overlap in the saved run.

### What passed, and what remains incomplete

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,409 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at the second App download wait |
| Independent 31E review | Not reached |

These new native scenarios passed in this parent run:

- all four visibility policies, including computed opacity within the justified
  `1e-12` tolerance while exact attribute assertions remain intact;
- invalid-viewport failure and successful retry;
- the real render/parse/extract/replace/sanitize/serialize boundary, including
  the former title-only control, free/inline labels and empty/zero-label cases;
- the first actual transparent 2D App download/reopen, with pending capture,
  deliberate text/style/background edits and a later 3D document load while
  preparation is held, duplicate-click isolation and unchanged current history.

The later 3D white-background download/reopen, transient resource recovery in
that export, injected serialization failure and successful retry remain
unverified. Preserve the ten earlier groups and the newly passing scenarios.
The child handoff at `/private/tmp/stz-31e-opacity-comparison/handoff.json`
records 134 focused tests within 2,409 full tests and no child-native attempts;
the parent's executed results supersede that handoff's pending status.

## Goal

Make event waits and triggering actions fail through the normal diagnostic and
cleanup path, establish why the second native click/download did not complete,
and minimally correct the demonstrated fixture or production cause. Obtain
fresh complete eleven-group parent evidence, then independent review.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the latest parent evidence above and opacity-comparison child handoff;
- `scripts/checkSettledSvgExports.mjs`, especially all staged download waits,
  its filechooser helper, App diagnostics, native clicks and cleanup;
- `scripts/checkFreeLabels.mjs` and the running/failed/complete evidence contract;
- `scripts/fixtures/freeLabelsApp.tsx`, App export/capture/status handling,
  inspector drawer controls and relevant overlay CSS;
- `src/ui/svgSettledExport.ts`, `src/ui/fileTransfer.ts`, associated tests and
  the label service/fixture hold-release behavior relevant to resource retry;
- `scripts/fixtures/settledSvgBoundaryFixture.ts`, exact-source oracle/tests,
  `scripts/standaloneSvgCapture.mjs` and `scripts/standaloneSvgOpacity.mjs`
  with their tests;
- `package.json`, fixture TypeScript settings, preview/roadmap documentation,
  `scripts/automation/phase-verification.mjs`, `run-phase.mjs` and their tests.

## 1. Own asynchronous waits from creation through cleanup

Repair the download-event/trigger sequencing so every created promise has an
immediate rejection handler and is awaited or otherwise settled on every path.
Register listeners before triggering actions to retain immediate downloads.
Do not leave a rejecting download promise unobserved while awaiting a native
click, an edit, a file chooser, diagnostics or a later assertion.

For a simple click/download pair, a jointly awaited operation can own both
outcomes. The first scenario deliberately spans held conversions and intervening
edits/load/release operations, so preserve that coverage with a properly owned
wait rather than shortening it into a pre-settled export. Handle equivalent
patterns in the first, second and retry downloads and the local filechooser
helper where the same rejection hazard applies. Keep the change scoped to this
workflow; a large generic automation framework is unnecessary.

Use explicit finite action/event deadlines and keep them meaningfully separate.
An actionability failure must retain its own message/call log, not be hidden
behind a download timeout that wins by a few milliseconds. On action failure,
missing event, page close or intervening assertion failure, remove owned
listeners/timers and cancel or safely drain remaining work using supported
mechanisms. Closing a page must not create a later unhandled rejection.

Ensure the original scenario failure reaches App and outer harness catch/finally
blocks: persist failure diagnostics, mark the browser evidence `failed`, and
perform owned-resource cleanup. Preserve the primary error if diagnostics,
screenshot or cleanup also fails. The parent must still receive a nonzero exit.
Do not patch a partial report to `passed`, install a global unhandled-rejection
suppressor, catch and ignore required failures, or disable strict rejection
handling. Merely adding a delayed catch or extending 30 seconds does not fix
promise ownership or establish why the action failed.

Add focused regressions for any changed coordination/helper logic, including:

- an event timeout while the triggering action is still pending produces one
  handled failure, with no process-level unhandled rejection;
- an action failure while the event wait is pending retains the action error
  and cleans up the wait;
- an immediate download before the click promise resolves is retained;
- successful delayed delivery, page close and cleanup paths leave no listeners,
  timers or late rejections that can affect another attempt.

A bounded subprocess regression under strict unhandled-rejection handling is
appropriate if needed to prove the specific process-crash failure is caught.
Do not merely test that a helper returns a promise or mirror its implementation.
Register new test files in `package.json` and retain actual native acceptance.

## 2. Diagnose the second native click and apply the smallest correction

Reproduce the same workflow and retain bounded checkpoints that distinguish:
listener armed; native click started; click completed or failed; App pending/
status transition; download received; saveAs completed; standalone reopened.
Do not require observing a transient pending UI if a fast valid export already
completed; use completed status and the actual event as evidence in that case.

Before the second click, record the actual background choice, document/revision,
current labels, download count, export status, button match count/visibility/
enabled state, client bounds, viewport/scroll, open drawers and relevant hit
stack at the intended click point. Retain native actionability logs or a focused
trace and an App screenshot when possible. Keep failure observations available
before optional image work. Do not duplicate the entire request history at
every checkpoint or add persistent model/UI debug fields.

Determine which boundary fails before changing production behavior:

- If the open inspector or another expected overlay intercepts the button,
  dismiss it through its real UI control as a normal user would, then use a
  native click on the accessible export control. Preserve all captured edits,
  the later 3D document, white background and the first duplicate-click test.
  If the normal UI cannot expose the action, investigate the demonstrated UI
  defect and fix it narrowly instead of changing unrelated layout.
- If the click completes but export preparation fails or remains pending,
  retain the App failure message, capture/settlement/serialization observations,
  current request identities and resource retry state. Fix the actual source of
  failure with a focused regression; do not infer that all requests remain held
  from the old first-export setup or extend production limits without cause.
- If the App reports handoff success but no browser download arrives, inspect
  real anchor/blob/object-URL lifetime and download failure/event observations.
  Preserve `acceptDownloads`, native download verification and filename policy.

Do not bypass actionability with `force: true`, replace the second native click
with DOM `element.click()`, call the controller/download handler directly, or
fabricate a file/event to satisfy the waiter. An automatically retried click
until a download appears can introduce duplicate files and is not a diagnosis.
Preserve the deliberate first synchronous double-click test for its existing
purpose; it does not prove that the later native button is reachable.

## 3. Finish remaining App export scenarios and preserve passed coverage

After the second download succeeds, retain the actual 3D white SVG and reopen
it outside the application. Verify updated text, style/anchor/position, newly
visible label, camera projection, geometry, captured opacity, foreground and
white outlines, white background and raster pixels. Establish resource-failure
recovery in this later export. Preserve live SVG/model/history non-mutation.

Then execute the existing injected serialization-failure case, verify failure
status and restored action without malformed download, restore the serializer
in finally, and complete the successful retry/download/reopen. Preserve exact
download counts, duplicate suppression, status, raw source and snapshot policy.

Keep successful math as self-contained geometry and actual failed labels as
complete captured literal source, with Unicode, markup-like text, spaces, tabs
and newlines intact. Keep valid local references, finite dimensions, explicit
color/opacity, both background modes, no external runtime/page CSS dependencies
and exclusion of editor overlays.

Preserve the already proven React SVG context, owning-group extraction and
native boundary controls. Keep `assertStandaloneSvgOpacity()` finite/range
validation and `1e-12` tolerance only for computed-style comparisons; raw
attribute checks and discrete contracts remain exact. Preserve separate opacity
regressions and exact-source geometry negative controls.

Keep bounded standalone captures (`fullPage: false`, 5-second timeout, measured
full-root coverage, finite viewport adjustment, verified PNG dimensions),
independent standalone pages, observations saved before images and truthful
failure/cleanup behavior. Do not reopen fixed capture or comparison issues.

Require **all eleven** browser groups, including the fully completed
`settled-SVG-export-standalone` group. Previously passed scenarios must remain
in the full fresh run. Keep parent rejection tests for partial/running evidence,
nonzero exits, errors, checkout changes and missing required groups. Do not
weaken runner, sandbox, verification, review, commit or push gates.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/settledSvgExportOracle.test.ts \
  tests/scripts/standaloneSvgCapture.test.mjs \
  tests/scripts/standaloneSvgOpacity.test.mjs \
  tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/ui/fileTransfer.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/standaloneSvgCapture.mjs
node --check tests/scripts/standaloneSvgCapture.test.mjs
node --check scripts/standaloneSvgOpacity.mjs
node --check tests/scripts/standaloneSvgOpacity.test.mjs
node --check scripts/checkSettledSvgExports.mjs
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/standaloneSvgCapture.mjs tests/scripts/standaloneSvgCapture.test.mjs \
  scripts/standaloneSvgOpacity.mjs tests/scripts/standaloneSvgOpacity.test.mjs \
  scripts/checkSettledSvgExports.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/settledSvgExportOracle.ts \
  scripts/fixtures/settledSvgBoundaryFixture.ts \
  tests/scripts/settledSvgExportOracle.test.ts \
  src/ui/svgSettledExport.ts src/ui/svgPreviewExport.ts src/ui/fileTransfer.ts \
  src/rendering/svgLabelExportRegistry.ts src/rendering/svgLabelView.ts \
  src/rendering/SvgTexLabel.tsx tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts tests/ui/fileTransfer.test.ts
npm test
npm run build
git diff --check
```

Include any new helper/regression or other changed files in applicable focused,
syntax and lint checks. Keep focused counts within the full-suite total. Compare
App/SvgDiagram lint with baseline if changed; leave unrelated lint debt alone.

Complete authorized parent/Terminal verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31E verify
```

This runs tests, build, diff check, label assets and the full browser harness
on the dirty checkout with fresh logs/artifacts and tracked/untracked identity.
It does not implement, review, commit or push. Do not recursively run `31E fix`
or `31E implement` as verification.

If acting as the automated fix child, run available focused/full Node checks
and build, then let the outer runner perform browser verification after the
handoff. A child browser restriction does not prevent promise-handling fixes
or available regression tests. In a standalone run, use supported permission
escalation when necessary and available, or hand off to the authorized Terminal.
Do not change persistent sandbox settings or weaken browser/security checks.

Require fresh complete matching parent evidence after correction. Successful
matching parent results can support review without repeating commands in its
restricted child. Partial or stale evidence cannot close the gate.

## Documentation and acceptance criteria

Update only relevant Phase 31E preview/export and roadmap status. Record the
asynchronous error-handling defect, the measured reason for the missing second
download, minimal correction, tests and new native evidence. Replace stale
claims that visibility/native-boundary/first-App acceptance is unexecuted with
this run's actual passes. Keep 3D white export and subsequent failure/retry
pending until executed successfully. Do not label an interception hypothesis
as confirmed before measuring it.

The normal runner performs fix -> parent verification -> independent review.
This run failed before review. A standalone `verify` success does not itself
run review or establish approval. Preserve that order and the commit gate.

31E is ready for review only when:

- every staged event wait is handled from creation, and action/event failures
  reach diagnostic/cleanup paths without unhandled rejection or leaked waits;
- the second native click/download failure has an evidence-supported diagnosis
  and minimal correction, with successful real 3D white download/reopen;
- serialization failure and successful retry execute with correct status,
  download counts and live/model/history preservation;
- previously passing visibility, native-boundary, first captured transparent
  export, opacity/geometry controls and earlier-phase regressions remain intact;
- bounded captures and failure artifacts are truthful, and an intentional
  harness failure results in terminal failed evidence rather than `running`;
- fresh matching parent evidence is `passed`/`complete`, identifies the browser,
  completes all eleven groups and has no incomplete/unexecuted groups or page
  errors, with observations and actual files for the formerly unexecuted cases;
- required tests/build/static/diff checks pass and documentation reflects the
  observed implementation, parent verification and independent review status.

Do not mark 31E complete before required verification and independent review
succeed. Phase 31F remains deferred.

## Report after implementation

Lead with the measured second-download cause and promise-ownership correction.
Report changed files; action/event checkpoints and native click diagnostics;
regressions for early rejection, action failure, immediate event and cleanup;
3D white download/reopen and serialization retry results; preserved production,
opacity and screenshot fixes; commands, versions, exit statuses and focused/
full counts; evidence paths and current checkout fingerprint; and unavailable
or failing checks. Keep child implementation/checks, parent browser verification
and independent review statuses separate. The partial ylXZks run demonstrates
progress but cannot verify the corrected checkout or complete 31E.
