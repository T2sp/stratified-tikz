# Phase 32D Fix for standalone SVG capture

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag, revision, source-panel visibility,
native camera, canonical layer validation and diagnostic-ordering corrections.
Repair the next concrete parent failure: the transparent geometric SVG was
downloaded and reopened, but its fullPage screenshot timed out after fonts
loaded. Reuse the established complete-root standalone SVG capture mechanism
and retain raw reopening observations before image work.

Keep the actual SVG download/reopening and PNG acceptance requirements.
Preserve production code, model/serialization semantics, geometry, PGF references,
all completed native helpers, and exact evidence comparisons. Do not repeat
resolved fixes, rewrite unrelated files, or report the screenshot as optional.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical scoped evidence cannot
establish a 32D pass. Phase 32 remains incomplete until the actual tree has
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

The latest child handoff is
`/private/tmp/stz-32d-canonical-layer-fix-20261010/HANDOFF.md`.
Its exact inventory, tracked diff, preservation hashes, reports, and logs
remain in the same directory. The browser-capable parent's newer records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-DOoEMD/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-1V3I0G/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-1V3I0G/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-1V3I0G/05-check-free-labels/artifacts/`.

At this prompt update, branch is `phase/32d-margin-minsize-anchor`, HEAD
`1bcfcd5f06c1c12e92b744e0cb542c6dd8cb4a1d`. The actual pre-update tree matches
both before/after identities of 1V3I0G and the child handoff:

~~~text
7c83bba1a6e561f74bdb90e741b716656a20ab35a4e2bc66d6d8e959192cb419
~~~

Preserve the ten modified tracked files: both Phase 32 documents,
`scripts/checkPointNodeGeometricShapes.mjs`,
`scripts/pointCheckDiagnostics.mjs`,
`scripts/pointGeometricShapesContract.mjs`,
`tests/model/layers.test.ts`, both Phase 32C/32D policy suites,
`tests/scripts/pointCheckDiagnostics.test.mjs`, and
`tests/scripts/pointGeometricVisibilityFixture.mjs`.
There are no untracked files. Earlier corrections, including source visibility
and its fixtures, are now tracked. Updating this prompt changes the identity;
capture the actual current tree rather than hard-coding this fingerprint.

| Retained run | Actual result |
| --- | --- |
| Canonical-layer child | 6,072/6,072 full tests and 1,602 focused checks passed without failures/skips. Build, diff, and syntax checks passed. No new lint/type errors; reproduced baseline debt remains. Both direct browser attempts failed before Chrome at fresh-server `listen EPERM`. Fresh exact-tree strict child verification stopped at `check:label-assets`, without review/commit. |
| Latest browser-capable parent | 6,072/6,072 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. Paint/import, all eleven shapes, all eight contour interactions, and geometric visibility have terminal successes. The next transparent geometric download reached standalone screenshot and timed out. |

1V3I0G completed 15 of 18 cumulative groups. Its checkpoint is
`point-geometric-download-transparent-observed`. The geometric group remains
incomplete: transparent download has no terminal pass; white download did not
execute. The layout/anchor group and final standalone-export group did not
execute. Page errors are empty. Distinguish the parent screenshot failure from
the child's startup failure and the resolved visibility/layer/native failures.

## Preserve completed native and visibility contracts

Keep Clear's detached imported paint/shape/layout behavior, exact persistence
comparisons, raw source, policy/UI regressions, history, and JSON reload.

Keep scoped native Inspector preparation and toolbar handling:
Select access before conditional collapse, unique real controls, bounded
detached/collapsed confirmation, exact model/history/epoch/selection invariance
of UI actions, fresh connected fixed .23 contour measurement/current CTM/hit
stack, one intended native click, trusted owner/path delivery, owned native
restoration, and first-error-preserving diagnostics/cleanup.
Preserve the precise native SVGPoint binary32 allowance without changing PGF
geometry/reference tolerances or accepting altered requested coordinates.

Keep drag/layout preparation and owner cycling, selected-point-only movement,
original gesture, pointer identity/capture/release, exactly one bounded history
commit, exact saved/runtime Undo/Redo, and raw parent-imported evidence
validation. Preserve native Inspector reopening for Shape/parameter controls,
Select access, History controls, runner dependencies and test registration.

Keep valid same-document revision equality through preparation/drag/Undo/Redo,
observed/authoritative and event epoch comparisons, and all revision regressions.
Native JSON load/example replacement still advances document ownership;
load's exact +1 and reused-ID stale completion isolation remain required.
Do not modify production revision/cache/model behavior.

Keep the source-only exact-caption → direct production label → unique native
associated select resolver, connected/visible/enabled checks, exact options,
native source-header scroll preparation, bounded selectOption, returned/final
value readback, authoritative settings, and owned actual event observations.
Keep approximate-visibility checkbox prerequisites and native dim/hide/dim.
A selectOption input/change trusted=false is recorded honestly; do not impose
pointer/trusted=true requirements on this API.

Keep native camera details preparation, theta90/phi0 readback, state continuity
and the requirement that only intended UI angles change. Preserve raw model,
history, epoch, selection, source/style/coordinates, work plane, and unrelated
UI settings. Keep actual owner/occluder classification, fill opacity,
connected opacity ancestors and recomputed cumulative opacity.

Keep canonical layer validation: valid owned metadata arrays/records, exactly
one configured matching layer, expected identity/name/point association,
locked=true, optional boolean visibility with omitted/true interpreted visible,
and explicit false for the hidden case. Missing/duplicate/unrelated/malformed
records cannot pass via optional chaining. Keep exact saved/runtime/history
provenance agreement; do not normalize or rewrite observed evidence.
Preserve faithful canonical fixtures, production input→load/save normalization
regression, actual locked before/after renders, hidden absent rendering,
exact native load epoch, and all negative controls.

Keep bounded locked/hidden stage observations before document replacement,
completed candidate observations before assertions, observed versus terminal
passed distinction, partial records, owned late rejections and primary failure
ownership across diagnostics/listener/context cleanup.
The visibility terminal `point-geometric-visibility.json` now exists and passed;
the prior IocgXz rejection is historical, not the current failure.

## Diagnose the standalone fullPage timeout

The latest first failure is:

~~~text
page.screenshot: Timeout 30000ms exceeded.
  taking page screenshot
  waiting for fonts to load...
  fonts loaded

runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:450
scripts/checkFreeLabels.mjs:482
~~~

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
the passed visibility/contour files and the retained
`point-geometric-download-transparent.svg`.

The failure scenario is `point-geometric-download-transparent`.
The saved SVG is 29,281 bytes, with SVG root width520/height360,
viewBox `0 0 520 360`, eleven source titles, outlined math paths, and no href
references or parsererror/foreignObject/image/script elements in its XML.
The retained file is actual native-download output, not a generated substitute.

The caller had already saved/read the SVG, checked captured source against the
later edits, reloaded original inputs, settled the reference preview, opened
the actual file URL, evaluated standalone nodes, and passed the in-process
contour/glyph/cylinder-region/no-external-request checks before screenshot.
These observations are not yet retained in `...-standalone.json`: that write
is after screenshot. The transparent PNG, standalone JSON and terminal scenario
JSON are absent. Do not claim complete download acceptance.
The post-screenshot immutable-parameter assertions and terminal save did not
execute; their success remains required in the fresh run.

The failure snapshot/lifecycle belongs to the original HTTP App page, not the
standalone file page. Empty page errors and the App's open/non-crashed state
do not establish standalone body/viewport measurements.
No direct standalone body/bounds/capture record was retained in this run.

Inspect the configured local Playwright source:
`/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/coreBundle.js`.
Its screenshotPage prepares the page/fonts, then fullPage invokes
`_fullPageSize`. That method waits for a utility callback which returns null
when `document.body` or `document.documentElement` is absent.
An SVG XML document has an SVG root without an HTML body. The source-supported
diagnosis is this fullPage sizing mismatch, consistent with the observed
post-font-readiness stall. The failing standalone body was not directly
measured; retain its actual document/body/bounds in the fresh run.
Do not diagnose this as an unresolved font load, inflate timeouts, or change
export geometry to satisfy screenshot sizing.

## Reuse the measured complete-root capture

`scripts/standaloneSvgCapture.mjs` already provides the appropriate mechanism.
Paint/import/responsive workflows use `captureStandaloneSvg` with persistence
before image work. Read that helper, its registered tests, and those callers.
Reuse it rather than adding a parallel screenshot workaround.

Apply the same scoped correction to both affected pending-export callers:
the geometric screenshot at line450 and the layout pending-export screenshot
in `scripts/checkPointLayoutAnchors.mjs` (currently fullPage=true at line690).
The layout case is the same known standalone SVG capture path, not a separate
production geometry change. Preserve all its existing layout/download assertions.

The existing capture mechanism requires:

- Actual file-page measurements: URL, content type/ready state, SVG namespace/
  root dimensions/viewBox/bounds, body state, parser errors, viewport, scroll
  origin and device pixel ratio.
- Bounded layout settling, finite positive root dimensions and complete-root
  coverage within side/pixel budgets. Permit at most one measured viewport
  expansion, followed by fresh measurements. Never shrink/scale the SVG or
  accept a clipped corner as complete export evidence.
- One `fullPage: false` CSS-scale native screenshot with the explicit bounded
  timeout, preserving normal font readiness and document content.
- Before/after coordinate stability, actual PNG signature/file presence and
  pixel dimensions matching the measured CSS viewport, including root edges.
- Pending/saved/failed capture status, actual requested/retained path,
  PNG dimensions/byte length and diagnostic persistence throughout.

The helper is already tested and registered. Leave it unchanged unless actual
integration evidence reveals a concrete defect. No browser flags, font-readiness
bypass, retries, synthetic rasterization or new dependency is justified here.

## Preserve reopening evidence before image work

Give each affected caller a bounded persist callback retaining the actual
reopened nodes, requests, page errors, settled expected observations, captured
click snapshot and scenario-specific pending/layout data before assertions/image
work, then update the same raw standalone artifact with capture progress/results.
Retain the actual saved file path/URL and bind records to the correct scenario
and background. Use observations, not invented success booleans.
Publish pre-image candidates as observed; terminal passed records still require
the completed image and all applicable download assertions.

Preserve all current source, exact contour/paint-region, glyph, XML/forbidden
content, no-external-assets and background comparisons. For layout, preserve
node/body transforms, immutable placement/layout, settled versus pending
contour, free/inline labels, and both captured TikZ-mode outputs.
Keep pending click-time source/parameters immutable through later editor edits,
shape changes, replacement loads or view changes.

A failed screenshot must retain pre-image reopening observations and failed
capture details, propagate its original error, and fail the scenario.
Only complete validated image and raw evidence may produce terminal passed
records. Do not count an SVG alone, observed JSON, missing/invalid PNG,
mock header file or screenshot metadata alone as native acceptance.

Keep standalone page/context and event ownership, bounded persistence/failure
diagnostics and cleanup, and owned late rejections. Do not try to use the
App-specific state/API reader unchanged on the SVG file document.
Do not run another screenshot in the failure path. Preserve the first
action/assertion/capture error when diagnostic or close operations also fail;
without a prior error, cleanup failure must still fail the workflow.

## Contracts, regressions and native continuation

Keep geometric/layout required artifact lists, including SVG, real PNG and
standalone JSON. Bind parent evidence validation to retained capture records:
saved status, exact scenario path/file URL, real PNG bytes/signature/dimensions/
byte length, finite complete-root containment, and stable before/after raw
measurements. Reuse suitable existing capture validation rather than duplicate
screenshot logic. Check raw reopened/expected/click agreement and all existing
source/paint/placement/background comparisons independently of capture success.

Reject pending/failed/missing capture, mismatched path/URL/PNG dimensions,
malformed/nonfinite or cropped root measurements, coordinate changes,
unrelated records, and forged success flags. Do not weaken strict parent
acceptance or relabel a failed image as diagnostic-only.

Run existing standaloneSvgCapture tests and add only meaningful integration/
policy regressions for the affected callers and both parent suites.
Cover pre-image persistence, one bounded capture/no retry, canonical SVG without
an HTML body, real complete-root dimensions, rejecting invalid/missing PNG,
observed versus passed status, and primary errors surviving secondary persistence/
cleanup failures. Reuse existing helper controls; do not duplicate its whole
test matrix or multiply equivalent fixture mutations.

If contracts/verifier newly import the shared capture module, copy that
dependency and its transitive dependencies into isolated runner fixtures.
Register any new test file in the explicit test list. Preserve faithful
synthetic policy controls as distinct from native browser acceptance.

Reuse the cumulative App sequence through paint/import, all eleven shapes,
eight contours and terminal visibility; then complete transparent and white
geometric downloads, the full layout/anchor/owner-cycle matrix including its
pending downloads, and final standalone export.
Require actual native SVG download/reopening, real PNGs, both TikZ modes,
and raw history/JSON persistence. Diagnose later failures from their own first
fresh evidence.

Use strict TypeScript without `any`, add no dependency, and preserve model
coordinates, 2D z=0, active 3D work planes and codimension conventions.

## Preserve Phase 32D geometry and persistence

Keep saved envelope version2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution and per-axis em/ex context.
Preserve PGF solvers/anchors, body/baseline/depth inputs, unsupported-anchor
diagnostics, overflow-body picking, painted/anchor-clearance bounds, 2D/3D
projection and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all raw/reference files and tolerances. No geometry/reference regeneration
is justified by this capture mismatch. The diamond outer-separation exception
still requires independent PGF review. Preserve external source/exact text,
typography/paragraph/TeX-program limitations, free labels and inline path nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused capture/caller integration,
both parent policy suites, diagnostics/ownership and runner regressions, while
retaining the completed visibility/selection/toolbar/drag coverage.
Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused TypeScript/lint and changed-script syntax checks.
Report reproduced baseline debt accurately: three current geometric caller
no-unsafe-finally errors and verifier unused _role; the existing layers test's
unused defaultCurveStyle and eleven inherited focused strict-TypeScript
diagnostics are also documented in the latest handoff.
Application TypeScript/build passed. These separate failed baseline checks
must not be described as passes or expanded into unrelated cleanup.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused/scoped 32C results cannot establish strict 32D acceptance.
If the child hits `listen EPERM`, retain its startup failure and exact tree
for the parent without weakening sandbox/acceptance rules.
Do not describe the latest parent screenshot failure as startup failure.

Load updated callers/helpers/contracts/policy in a fresh parent process and
verify the preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Preserve the implementation/fix runner's clean-tree guard. Do not reset,
discard, stash, commit or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import,
complete 32C shapes and `point-node-layout-anchors-combined`.
Require terminal successes, valid raw artifacts, no page errors, native
history/JSON persistence, both TikZ modes, pending transparent/white downloads
and reopened standalone SVG with actual complete PNG evidence.

Do not skip predecessors, reuse historical/scoped reports, create a deferred
32D profile or reclassify unexpected failures as backlog.
Preserve first failures and cleanup.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect the actual report/artifacts.
Matching accepted parent evidence can support a sandboxed reviewer;
stale, partial or failed reports cannot substitute for acceptance.

Update status only to observed accepted results. Keep Phase32 incomplete while
any native/download/reference or review gate remains open.
Preserve stop-before-review/commit on failed verification and the parent's
post-review identity guard.

Report the scoped capture integration and pre-image evidence correction,
changed files, focused/full checks, fresh parent evidence/identity, actual
transparent/white geometric/layout download and standalone coverage, review
result, and remaining concrete failures. Leave commit/push to the parent
workflow after verification and review pass.
Do not claim completion from child-only or historical results.
