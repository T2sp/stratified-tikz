# Phase 31E Targeted Fix Prompt: Bound standalone SVG screenshots and finish export acceptance

## Environment

Work on the current `phase/31e-tex-label-svg-export` checkout. Preserve the
pending Phase 31E implementation, fixtures, tests, documentation and user
changes. Do not reset the branch or rerun implementation from scratch.

The latest parent run used `70c7548b5dd832b90acb5d6116f2055c507042e8` plus
five modified tracked files: `docs/PREVIEW_UI.md`, `docs/ROADMAP.md`,
`scripts/automation/run-phase.mjs`, `scripts/checkFreeLabels.mjs`, and
`scripts/checkSettledSvgExports.mjs`. There were no untracked files. Preserve
the independent standalone-page ownership correction, settlement observations,
policy-specific artifacts, exact-source oracle, negative controls and tests.
Preserve the user's pending runner changes; screenshot repair does not require
changing runner configuration, sandbox settings or review gates.

Inspect current status; files may since have been committed or changed. Preserve
Phase 31D's merged candidate-cycle correction and recovery coverage. This
failure belongs to 31E export acceptance, not the historical 31D Alt assertion.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax, shared parser/adapter/cache/rendering semantics and authoritative raw
model text. Limit work to this export failure and further demonstrated 31E
regressions. Phase 31F's combined audit and unrelated lint cleanup remain
out of scope. Settled export is required in this phase, not deferred to 31F.

## Latest execution findings

This is a **parent verification failure before 31E review**. Chrome started,
the preceding ten groups completed, and the new standalone page was created.
Do not describe the current error as historical Vite `EPERM` or the earlier
`Please use browser.newContext()` failure. No new review ran; do not invent
severity counts, `REVIEW_JSON` or approval.

### Current failure: full-page screenshot of a standalone SVG times out

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-xlQmJP
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`, `checkout.diff`, `checkout-untracked.json`;
- `settled-export-autoHide-completed.json` and
  `settled-export-autoHide-failure.json`;
- `settled-export-autoHide-completed-serialized.svg` and retained capture/live/
  detached SVGs;
- the `settled-export-autoHide-standalone-failure` diagnostic and
  `settled-export-autoHide-failure-live-preview.png`.

The checkout was unchanged during verification. Its fingerprint was
`30d91d9fa20a47d12152c5d7e31923e35b103bba6c82917088e889293125a5df`, and
tracked diff SHA-256 was
`d77a5cbf567c69135fbc48a7e39b5b2daf22b57ce63512647d4348c860e7733d`.
The run used Node v26.9.0, Chrome `153.0.8010.52`, the external Playwright
runtime, and the Vite fixture at `http://127.0.0.1:5174`.

`check:free-labels` exited 1 at `settled-SVG-export-standalone`:

```text
page.screenshot: Timeout 30000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded
at runSettledSvgVisibilityChecks (scripts/checkSettledSvgExports.mjs:503:28)
```

This is the first **autoHide** iteration. The independent `browser.newPage`,
`file://` navigation and `standalone.evaluate` returned before the failing
`standalone.screenshot({ fullPage: true })`. Thus the former page/context
ownership blocker is repaired in this path. Preserve that correction and its
cleanup; do not reimplement it as still missing.

The computed `reopened` result was only going to be recorded after the image
operation, so it was lost when that operation threw. The subsequent namespace,
geometry and opacity assertions also did not run. Navigation/evaluation success
is not complete standalone acceptance.

| Saved observation | Latest result |
| --- | --- |
| Policy / source | autoHide / `$\frac{autoHide}{x}$` |
| Serialized SVG | 435 bytes, SVG XML root, width 900, height 700 |
| Root viewBox | `0 0 900 700` |
| Standalone viewport | 1100 × 850 |
| Captured labels / source-specific conversion requests | 0 / 0 |
| Preparation outcome | `success`, about 1 ms |
| Exported labels / math paths | 0 / 0, appropriate for this hidden label |
| Live SVG preserved during serialization | `true` |
| Standalone screenshot | Timed out after 30 seconds |

The file contains sheet geometry but no visible label or formula. Zero math
paths are correct for autoHide, not a recurrence of the old autoDim failure.

The catch block retries the same full-page screenshot before recording the
original error. Neither the normal standalone PNG nor the attempted failure
PNG exists in this evidence directory, even though the diagnostic lists the
intended failure path. Do not present that path as a retained image.

### Source-supported cause to confirm and correct

The installed external `playwright-core` is version 1.62.1. In its bundled
`lib/coreBundle.js`, `_fullPageSize` waits for both `document.body` and
`document.documentElement`; it returns no size while either is absent.
`screenshotPage` takes that branch when `fullPage` is true, after its font
readiness step. The saved file is an SVG XML document, not an HTML document
with a body. This strongly explains the timeout after `fonts loaded`.

The actual reopened page's content type/body state was not persisted. Confirm
that state during the focused reproduction instead of claiming a newly measured
browser fact. The log does not establish a font-loading timeout. Do not disable
font readiness or enlarge timeouts as the assumed solution.

The same `fullPage: true` pattern appears in the visibility success/failure
captures near lines 503/520 and the actual download `readStandalone` success/
failure captures near lines 144/179. Locate their current equivalents. Fixing
only the first call can leave the same blocker later in acceptance.

### Historical issues and the remaining gate

The ownership failure in `stz-phase31e-before-review-HVvae4` is historical.
The earlier run in `stz-phase31e-before-review-r43lZG` failed the autoDim
positive geometry assertion for `$\frac{autoDim}{x}$`; its original failing
SVG/outcome was not saved. The current run still does not reach autoDim, so
its cause and acceptance remain unresolved. The 20,000 ms fixture service vs
10,050 ms export boundary is a hypothesis for that older issue, not an
explanation of this 30-second screenshot timeout.

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,390 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at autoHide standalone screenshot |
| 31E independent review | Not reached |

There are 119 passing scenario records, ten completed groups and no reported
`pageErrors`. The Node-side screenshot timeout still makes the run fail.
The eleventh group started but remains incomplete; `unexecuted: []` tracks
groups, not individual checks. No complete new visibility scenario passed.
AutoDim, layerFilter, hiddenLayer, invalid-viewport retry and actual App
settled-download/reopen scenarios were not reached. Preserve the passing 31D
camera/candidate-cycle/recovery/halo and App regressions. The older
`settled-export.png` belongs to current-SVG-cloning, not this failed reopen.

## Goal

Use a bounded screenshot path suitable for a standalone SVG document, retain
reopen observations before image capture, and preserve the repaired ownership
and cleanup. Then execute autoDim and all remaining export checks, resolving
any further demonstrated failures with actual evidence, and obtain complete
fresh parent verification before independent review.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31e-implement.md`, and
  `prompts/phase-31e-review.md`;
- the latest parent evidence above, including the pending-file snapshot; use
  earlier ownership/autoDim reports as distinct historical evidence;
- `scripts/checkSettledSvgExports.mjs`, `scripts/checkFreeLabels.mjs`,
  `scripts/fixtures/freeLabels.tsx`, `scripts/fixtures/freeLabelsApp.tsx`, and
  `scripts/fixtures/tsconfig.json`;
- `src/ui/svgSettledExport.ts`, `src/ui/svgPreviewExport.ts`,
  `src/rendering/svgLabelExportRegistry.ts`, `src/rendering/svgLabelView.ts`,
  `SvgTexLabel`, shared label service/runtime and relevant App export handling;
- `scripts/fixtures/settledSvgExportOracle.ts`,
  `tests/scripts/settledSvgExportOracle.test.ts`, and the new observer regressions;
- the installed external Playwright screenshot path, especially
  `_fullPageSize`, `screenshotPage` and font-readiness ordering in
  `playwright-core/lib/coreBundle.js`; do not modify the installed runtime;
- `src/ui/fileTransfer.ts`, registered export/file-transfer tests, `package.json`,
  and relevant preview/roadmap documentation;
- `scripts/automation/phase-verification.mjs`, `run-phase.mjs`, and their tests.

## 1. Capture standalone SVGs without an HTML-body-dependent full-page path

Use the saved 435-byte autoHide SVG for a focused native-browser reproduction;
it does not require rerunning conversion to investigate screenshot behavior.
Keep the file unchanged and open it directly as `file://` in the independent
standalone page. Before any screenshot, retain:

- URL, content type, ready state, root local name/namespace, whether an HTML
  body exists, and parser errors;
- root width/height/viewBox, finite client bounds, current viewport, scroll
  position and device pixel ratio;
- the already computed exact-source/label/geometry/opacity observations,
  browser errors, requested image path and capture options.

Confirm the body-less SVG/full-page-size interaction against the installed
screenshot code, then make a small harness correction. Prefer a viewport
screenshot with `fullPage` omitted/false, or an explicit bounded clip that
avoids `_fullPageSize`. The current 900 × 700 SVG should fit the 1100 × 850
viewport; verify the actual root bounds rather than relying on those constants.
For later exports, ensure the measured complete SVG fits the chosen viewport/
clip, adjusting a finite viewport when necessary. Do not silently crop labels,
white outlines, geometry or background edges. Keep dimensions and capture
limits finite; a screenshot of a blank corner is not acceptance.

Use the supported bounded capture approach consistently for standalone SVG
success and failure paths in both the visibility helper and `readStandalone`.
A small shared helper is reasonable if it prevents divergent handling. Ordinary
HTML application screenshots need not change. Do not broadly refactor browser
lifecycle or export rendering for this harness issue.

Keep the exported SVG unchanged and standalone. Do not insert an HTML body,
wrap the export in the app/HTML to make full-page sizing work, navigate the live
fixture away, or patch the Playwright runtime. Preserve the independent page
ownership and `finally` cleanup, closing only resources owned by this reopen.
Do not change production font/conversion/export limits, disable font waiting,
or merely increase the 30-second timeout.

Require actual native success with the saved SVG and then the full workflow.
Retain a real PNG with measured coverage of the export; preserve existing
browser-raster assertions for transparent/white backgrounds, color and halos.
Viewport margins or the browser's page background are not substitutes for
checking the exported SVG's own alpha/background pixels.

## 2. Save observations before capture and bound failure handling

In the current visibility path, `reopened` exists before the screenshot but
is only persisted afterward. Move the diagnostic checkpoint/JSON write ahead
of image capture and assertions. Similarly preserve `readStandalone`'s DOM/
geometry/raster/request observations before its screenshot; the existing raster
PNG must not be the only surviving evidence if that capture fails.

Keep these observations diagnostic until the complete scenario passes. Record
image success only after capture/write succeeds and the file exists. On failure,
retain the original error and available measurements before any optional error
screenshot. Record unsuccessful image attempts as failed/missing, not as paths
to nonexistent evidence.

Do not spend another default 30 seconds repeating the same full-page operation
in the catch block. Any best-effort diagnostic capture must use a supported,
explicitly bounded path; its failure and cleanup errors must not overwrite the
primary failure. A normal required capture failure must not be swallowed and
reported as a passing scenario. Keep all required file reopening and visual
checks, and retain page-error collection and independent-resource cleanup.

Avoid sleeps, retry-until-green loops or a second diagnostics-only redesign.
The previous observation/oracle infrastructure is present; extend it only where
this screenshot failure currently loses results. Add focused tests only for
meaningful new helper/coverage logic; static checks do not replace native
standalone capture evidence.

## 3. Preserve diagnostics and resolve any remaining autoDim failure

The previous follow-up already added the evidence needed for the original
failure. Retain the production observation hook, source-specific request and
settlement timings, policy-specific pre-assertion artifacts, exact-source
foreground oracle and negative controls. Keep observers non-mutating and
preserve the pinned conversion/export limits.

For each policy, preserve capture/live/detached/serialized SVGs and its bounded
JSON diagnostics: exact source/owner/settings, conversion kind/reason, deadline
and hold/release ordering, foreground geometry/text/namespace, effective opacity,
serialization non-mutation and standalone reopen measurements. Keep diagnostics
separate from passed scenario records. Do not duplicate the entire accumulated
request history at each checkpoint or add model/UI debug fields.

The retained autoHide files describe an empty label capture. They do not
establish that a visible successful formula survives export. Once native
capture works, obtain autoDim's corresponding artifacts and diagnose its
actual result; neither successful page creation nor successful screenshot
capture alone resolves the historical positive-math assertion.

Compare the captured revision, conversion result, detached label before
sanitization, serialized XML and browser-selected subtree. The shared
`SvgTexLabelView` normally emits a label group/title, paint group, foreground
group, then nested SVG math geometry. Determine exactly where the observed
formula disappears or becomes unobservable.

Investigate these possibilities without treating any as already proven:

- **Oracle selection/structure:** verify that the selected title identifies
  this exact label, namespaces are correct, and the observed foreground belongs
  to it. Do not count unrelated diagram paths, halo copies or another label as
  successful math. If the oracle is wrong, correct it and retain checks that
  reject a genuinely missing formula or whole-source fallback for this expected
  successful source. Do not alter valid production markup merely to satisfy a
  mistaken selector.
- **Settlement/timing:** the fixture service currently allows 20,000 ms,
  whereas the export boundary defaults to the production service limit plus
  50 ms (currently 10,050 ms). After `changeService('real')`, autoHide performs
  no represented-label conversion; autoDim is the first cold-service case.
  A live formula after release does not exclude an earlier export timeout
  fallback. Measure actual timings and reasons; this is only a hypothesis.
  Check hold/request/release ordering and cache/runtime ownership. Correct a
  demonstrated fixture setup problem without replacing pending-at-capture
  coverage with a pre-settled capture. Do not simply enlarge limits, add sleeps
  or retry until the assertion passes. Preserve bounded failure and retry tests.
- **Product export:** if successful captured conversion really loses geometry
  during detached rendering, replacement or sanitization, fix that boundary
  and add a focused regression. Keep the capture immutable, use settled output
  directly, and preserve layout, color and opacity. Do not wait for a later
  live React commit and clone a potentially different current view as a fix.

Preserve all four visibility policies: autoHide and hidden layers exclude
labels and must not trigger export-only conversion; autoDim and layer-filter
dimming retain visible labels, await them normally, and retain the captured
effective opacity after classes are removed. Expected successful math must
remain self-contained geometry; actual failed labels retain their complete
captured raw source. Do not hide/export-exclude dimmed labels, weaken the
positive geometry assertion, or accept arbitrary paths as proof of success.

Protect model/history/TikZ and the live SVG from export-side mutations.
Intentional user edits during a pending export remain permitted; compare
asynchronous completion against the state after those edits. Do not require
history to stay unchanged across deliberate edits.

## 4. Finish the complete standalone browser workflow

Run all remaining visibility checks and the existing actual App download/reopen
workflow. Preserve and verify:

- pending free and inline labels, repeated formulas, ordinary Unicode text,
  successful math and full-source malformed/resource-failure fallback;
- synchronous capture before suspension, edits/style/view/document changes
  during preparation, and a later export reflecting the new 3D view;
- accessible pending/success/failure status, duplicate-click suppression,
  finite failure handling, retry and temporary-resource cleanup;
- saved transparent and white SVG files reopened outside the application,
  including actual formula geometry, placement, explicit colors, glyph-local
  white outlines, multiline/tab/markup-like fallback and visible raster pixels;
- finite dimensions, valid local references without collisions, no remote
  resources/page CSS/runtime dependence, and exclusion of editor overlays;
- serialization/invalid-viewport failure without malformed downloads or
  live-view mutation, followed by successful retry.

Do not treat one successful screenshot or autoDim assertion as full acceptance.
Diagnose and minimally fix any later observed failure. Preserve the ten preceding
groups and the additional `settled-SVG-export-standalone` group: 31E requires
**all eleven**, with actual saved/downloaded/reopened artifacts for this group.
The parent validator already implements the extended group contract; retain
its rejection tests and compatibility with complete earlier-phase reports.
Do not weaken it to accept ten groups for 31E or change sandbox/review gates.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/scripts/settledSvgExportOracle.test.ts \
  tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/ui/fileTransfer.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/checkSettledSvgExports.mjs
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/checkSettledSvgExports.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/freeLabels.tsx scripts/fixtures/freeLabelsApp.tsx \
  scripts/fixtures/settledSvgExportOracle.ts \
  tests/scripts/settledSvgExportOracle.test.ts \
  src/ui/svgSettledExport.ts src/ui/svgPreviewExport.ts src/ui/fileTransfer.ts \
  src/rendering/svgLabelExportRegistry.ts src/rendering/svgLabelView.ts \
  src/rendering/SvgTexLabel.tsx tests/ui/svgSettledExport.test.ts \
  tests/ui/svgPreviewExport.test.ts tests/ui/fileTransfer.test.ts
git diff --check
```

Include additional changed files in applicable targeted checks. Register any
new Node test in the explicit `package.json` test command. Keep focused counts
within the full-suite total. Compare App/SvgDiagram lint with baseline if
changed; do not clean up unrelated pre-existing diagnostics.

Complete authorized parent/Terminal verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31E verify
```

This runs `npm test`, `npm run build`, `git diff --check`, `check:label-assets`
and `check:free-labels` on the dirty checkout, with fresh logs/artifacts and
tracked/untracked checkout identity. It does not implement, review, commit or
push. Do not recursively run `31E fix` or `31E implement` as verification.

If acting as the automated fix child, run available focused/full Node checks
and build, then let the outer runner perform browser verification after the
handoff. Accurately report child restrictions and pending parent gates. In a
standalone run, use supported permission escalation when necessary and
available, or hand off to the authorized Terminal. Do not change persistent
sandbox settings or weaken browser/security checks to bypass restrictions.

Require fresh complete matching evidence after correction. A review may use
successful matching parent browser results without rerunning commands in its
restricted child environment. Partial or stale evidence cannot close the gate.

## Documentation and acceptance criteria

Update only relevant Phase 31E preview/export and roadmap status. Record the
actual diagnosis, minimal fix, commands, versions, exit statuses, checkout
identity and retained artifacts. Distinguish historical autoDim/ownership/
startup failures, the repaired independent-page path, this executed screenshot
timeout and new results. Replace stale claims that ownership repair still
awaits a parent attempt with this run's actual progress and failed status.
The preceding ten groups passed; do not reopen old 31D failures or infer an
independent review result from browser success.

The normal runner performs fix -> parent verification -> independent review.
This run failed before the 31E review. A standalone `verify` success does not
itself run review or establish approval. Keep that order and commit gate.

31E is ready for review only when:

- a standalone SVG uses a supported bounded capture path with native evidence
  of the document/body state, complete image coverage and a real saved PNG;
- pre-capture DOM/geometry observations survive image failure, failure handling
  is bounded and truthful, and independent pages are cleaned up without
  altering the live fixture or masking primary errors;
- the earlier autoDim zero-path issue is resolved or its current non-reproduction
  is reported accurately, with successful current-source settlement/geometry,
  measured timings and complete retained evidence; any remaining failure has
  an evidence-supported diagnosis and minimal correction;
- all visibility policies pass and successful dimmed math retains captured
  geometry and effective opacity without live/model/history mutation;
- actual App downloads and standalone reopen checks pass in both background
  modes, including pending edits, later 3D view and failure/retry cases;
- fresh matching parent browser evidence is `passed`/`complete`, identifies the
  browser, completes all eleven groups, and has no incomplete/unexecuted groups
  or page errors, with actual observations for the formerly unexecuted cases;
- all required tests, build, static checks and diff checks pass, earlier-phase
  regressions remain intact, and documentation matches observed results.

Do not mark 31E complete before required verification and independent review
succeed. Phase 31F remains deferred.

## Report after implementation

Report changed files; the measured standalone document/body state and
screenshot-size mechanism; minimal capture correction and full-export coverage;
retained pre-image diagnostics, actual PNG paths and bounded failure/cleanup
behavior; autoDim's actual settlement/geometry/timing outcome and any further
product/fixture/oracle issue; all visibility and standalone results;
preserved snapshot/raw-source/history behavior; commands, versions, exit
statuses and focused/full counts; evidence paths and checkout identity; and
unavailable or failing checks. State parent verification and independent review
status separately, without claiming future steps passed.
