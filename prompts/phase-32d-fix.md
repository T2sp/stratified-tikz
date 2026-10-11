# Phase 32D Fix for post-click 2D view evidence

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag/revision, visibility/camera,
canonical layer, measured diagnostics, ordinary body selection,
deterministic pending fixture/preparation and standalone SVG/PNG capture fixes.
Repair the next concrete parent failure: transparent pending export changes
2D zoom, then incorrectly requires `state.uiSettings` to change.

2D zoom/pan are absent from that serialized observation by design.
Use actual native controls and current SVG point placement to prove the view
change. Do not alter production persistence or uiSettings to force inequality.
Also correct the source-proven pending inline-node binding described below,
which would fail later in the same export callback.

Keep the now successful pending fixture and native .23 preparation.
Preserve production model/rendering/geometry/camera semantics, PGF references
and tolerances, all completed helpers and download/capture contracts.
Do not repeat resolved fixes or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.
Keep strict cumulative verification, verification-before-review/commit and
the exact-tree post-review identity gate. Phase32 remains incomplete until
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

Latest child handoff:
`/private/tmp/stz-32d-pending-fix-20261011/HANDOFF.md`.
Its inventory, full diff, preservation hashes, raw reports and logs are retained
in the same directory. The newer browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-zgKwaA/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-bmgK6V/verification.json`.
- Browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-bmgK6V/05-check-free-labels/command.log`.
- Raw native evidence/failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-bmgK6V/05-check-free-labels/artifacts/`.

Branch is `phase/32d-margin-minsize-anchor`, HEAD
`dab98a52983920f68da09982dedacb9342c959ab`.
The actual pre-prompt-update tree matches both before/after parent identities
and the child handoff:

~~~text
483e48d2aa8cbf2f8094ef3d200d5a0f7dc19c7e7f7112f76ddb07dbaba6826c
~~~

Preserve the nine modified tracked files: both Phase32 documents, `package.json`,
`scripts/checkPointLayoutAnchors.mjs`, `scripts/fixtures/freeLabelsApp.tsx`,
`scripts/pointLayoutAnchorsContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs`, and
`tests/scripts/standalonePointDownloadFixture.mjs`.
Preserve the four new untracked files:
`scripts/pointLayoutPendingFixture.mjs`,
`scripts/pointLayoutPendingPreparation.mjs`,
`tests/scripts/pointLayoutPendingFixture.test.mjs`, and
`tests/scripts/pointLayoutPendingPreparation.test.mjs`.
Earlier body/candidate/helper/capture corrections are tracked.
This prompt edit changes the fingerprint; capture the actual current tree,
rather than hard-coding a historical identity as acceptance.

| Retained run | Actual result |
| --- | --- |
| Pending-fixture child | 6,212/6,212 full tests, build and diff passed. Frozen pending fixture/preparation/policy/capture focus passed 384/384; runner controls passed 37/37. Changed fixture TypeScript/lint and changed-script lint/syntax passed. Fresh strict verification and direct browser attempts stopped at fresh-server `listen EPERM` before Chrome. Baseline lint/type debt remains failed. No completion review/commit/push. |
| Latest browser-capable parent | 6,212/6,212 tests, build, diff and full `check:label-assets` passed. Geometric and the first six layout scenarios passed. Transparent pending native preparation, selected owner and held SVG export-click snapshot succeeded; the post-click 2D uiSettings inequality then failed. |

bmgK6V completed 16 of 18 cumulative groups. Preserve these terminal successes:

- Complete geometric group: eleven shapes, eight contours, visibility and both
  actual transparent/white geometric SVG download/reopening/PNG scenarios.
- Layout sizing: 90 cases across fifteen shapes.
- Anchors/rotation: 305 supported cases and all six unsupported native cases,
  2D/3D × ellipse/circle/cylinder, ordinary body → far → warning.
- Native controls/persistence, six import/order/unit cases and eleven async
  isolation transitions.
- Four native interaction cases, 2D/3D × rectangle/circular sector, with drag/
  history/owner cycles/visibility/camera/reference checks.
  Both negative-padding body-overflow cases and Alt cycles pass.

The new transparent pending preparation also passes, but is an accepted
preparation record within an incomplete download scenario.
An actual SVG export click is recorded while held.
Neither pending layout download has terminal acceptance or saved SVG/PNG/TikZ/
reopening artifacts. White and final standalone export remain unexecuted.
Page errors are empty. Historical passes cannot substitute for fresh acceptance
of the next changed tree.

## Diagnose the incorrect 2D view observation

The latest first failure is:

~~~text
AssertionError: Expected "actual" to be strictly unequal to:
'{"exportMode":"standalone","includeCoordinateAxesInTikz":false,
  "visibility":{...}}'

scripts/checkPointLayoutAnchors.mjs:669
scripts/ownedPageEvent.mjs:62
scripts/checkPointLayoutAnchors.mjs:656
scripts/checkFreeLabels.mjs:483
~~~

Read `free-labels-evidence.json`, `point-layout-failure.json`,
`point-layout-app-failure.json`, `point-layout-app-lifecycle.json`,
`point-layout-pending-transparent-edit-preparation.json`,
`point-layout-pending-cleanup.json` and the last selection records through
`point-layout-selection-0516.json`.
The failure screenshot is intentionally omitted for pending scenarios.
The bounded failure DOM ends before the camera inputs and cannot prove their
post-fill values. Do not invent a measured zoom/CTM change from it.

Relevant observed diagnostic entries in `free-labels-evidence.json` are:
`point-layout-pending-transparent-edit-before-export-click`,
`point-layout-pending-transparent-edit-export-click-held`,
`point-layout-pending-transparent-edit-anchor-native-input` and
`point-layout-pending-transparent-edit-minimumWidth-native-input`.

The raw evidence shows:

- Native preparation sequence39 selects `layout-circle` at epoch427 with one
  trusted ordinary .23 gesture. Input hits that circle first at approximately
  (593.53717,1134.83984), with no sibling/UI interception or secondary errors.
- All fifteen click-time point snapshots are captured. The circle at (7,6.5,0)
  has full source `captured transparent $\frac{anchor_{32D}}{1+\frac{x}{y}}$`,
  status pending, held started1/completed0/releasedfalse and transform
  `translate(158.1818181818182 167.78181818181818)`.
  Actual selected owner is circle and native background control is transparent.
- The production SVG export control is clicked while held. The immediately
  observed hold later has started2/completed0/releasedfalse.
  Preserve the distinct actual click-time and later hold observations.
- Native post-click source edit runs, then anchor north and minimumWidth110
  inputs are recorded with trusted input and matching model values.
- The camera disclosure summary before fill reads zoom1, pan x0, pan y0.
  `zoom.fill('1.4')` is awaited, then the inequality fails.
  The planned `-post-click-view` observation is after the assertion, so no
  actual post-fill control/placement record exists.
- Intended captured-release/download.saveAs/reopening/comparison never executes.
  Finally cleanup releases two held requests and removes the export listener,
  with errors[]. This is cleanup evidence, not intended release or acceptance.

Do not describe this as zoom already1.4, a lost native click, renewed fixture
obstruction or child startup failure. The requested fill is known; its actual
applied value and view geometry still require fresh observation.

Trace the source contract:

1. `src/App.tsx`'s DEV `AppLabelBrowserSnapshot.uiSettings` records export mode,
   axes, visibility and `camera3d` only when ambientDimension===3.
   It intentionally excludes the 2D camera controls.
2. `updateCameraNumericField` updates cameraControl. In both dimensions,
   `previewCameraAdjustment` supplies zoom/pan to `SvgDiagram`.
3. `src/rendering/svgCamera.ts` applies the 2D adjustment to the fitted scale/
   origin, changing model-point projection independently of uiSettings.
4. Saved JSON omits runtime camera; `pointExportClickSnapshot`'s camera read
   from saved JSON is not an effective live 2D preview-camera observation.

Thus uiSettings equality is compatible with a real 2D view change.
Purely deleting the assertion would remove needed immutable-view acceptance.
Replace its observation and preserve the production contracts.

## Prove the actual post-click view change

Implement a small scoped read-only view observation/control helper or fixture
diagnostic for this transparent pending export path. Prefer actual DOM controls
and native point measurements. If a DEV observation is necessary, keep it separate
from saved model/UI serialization and the normal product flow.
Do not add camera fields to persisted version2 or production uiSettings solely
to make the failed inequality pass.

Require all of the following:

1. Resolve one actual zoom numeric control and its associated slider/disclosure
   from the current App. Expand the real owned camera details only when needed.
   Capture the baseline after expansion/scroll, so those actions cannot be
   confused with camera projection. Retain actual accessible name, count, values,
   connection/identity and supported finite input range.
2. The baseline is after the already intended source/anchor/minimum edits and
   before the zoom input. Observe its authoritative state and current owners.
   Require the declared target1.4 to differ from actual current zoom.
   An already-equal value is a failed precondition, not view-change success.
3. Apply one ordinary native numeric fill through the real control.
   Retain actual input/change provenance honestly, input value/order and owner.
   Observe after input and bounded commit, before any assertion or image work.
   Require actual numeric/slider values to reflect the declared finite zoom.
   Do not synthesize input, retry values or patch camera state programmatically.
4. Observe current connected point-node outer placement, source/request/document
   owner and native matrices before/after. Use stable reference points or anchors,
   keeping their model coordinates exact and separate from their text/contour
   dimensions and selected-anchor placement.
   Demonstrate that the current model-to-canvas projection changes with zoom.
5. Normalize point geometry into the actual SVG root coordinate frame using
   finite invertible native node/root matrices. Record viewBox, client/viewport,
   scroll/disclosure conditions and actual model positions.
   Root SVG screenCTM can stay constant when zoom changes: it primarily describes
   viewport/CSS placement. Root CTM inequality alone cannot prove a view change.
   Screen-coordinate differences due only to scrolling/resizing cannot pass.
6. Verify the actual placement change is consistent with zoom while pan and
   declared model coordinates remain fixed. For example, use two distinct stable
   model points and their root-relative projected separation before/after,
   independent of CSS movement and source/layout edits.
   Use existing precise native rounding allowances; do not alter PGF tolerances
   or derive a successful observation solely from the production solver under test.
7. During this view-only action preserve exact saved/runtime diagram, history,
   selection, document revision, source/layout and unrelated UI settings.
   uiSettings may correctly remain identical in this 2D case.
   Preserve current held source unreleased until its intended post-click release.
   Account honestly for unrelated async typesetting completion; it cannot be
   substituted for camera movement or mix stale owner/request observations.
8. Keep the immutable old export-click snapshot and its captured placement.
   The later live view differs, but downloaded/reopened geometry must match
   original click-time/settled expectations after normal original-fixture reload.
   Do not overwrite click data with a later current-view snapshot.

Persist before/immediate-input/after observations and actual control events
before validation, including failed/no-op/stale/missing observations.
Keep the planned `-post-click-view` evidence and bind it into terminal download,
standalone raw records and fresh parent validation.
Reject a declared `viewChanged:true` without actual control/geometry proof.

Own only this control/listener/preparation work; bound it and remove observers
through primary-error-preserving cleanup. Do not add an extra click/export/retry,
failure screenshot, camera reset or 3D replacement scenario to make it pass.

## Correct the pending inline-node binding

One further concrete source defect is reachable after the current inequality
is fixed. This is code inspection, not an executed native failure:

- `checkPointLayoutAnchors.mjs:470` defines `siblings` for async isolation using
  `siblingSnapshot()`. That value is an object with labels/paths/rendered.
- Pending fixture construction now uses `buildPendingLayoutFixture` and no longer
  declares the old pending array named siblings.
- The pending standalone callback at line717 still reads
  `siblings[0].inlineNodes`. It resolves the earlier async object, so index0 is
  undefined; it cannot validate the current exported inline nodes.

Bind the pending callback to its own declared fixture's unique `export-path`,
checking geometricKind/kind and the expected two inline nodes.
Preserve exact current inline source/content and existing XML text checks.
Do not use the post-click replacement model, an unrelated async snapshot,
a positional point at index0, or optional chaining that silently skips validation.
Keep the successful async-isolation snapshot and tests unchanged.

Add a small meaningful binding regression using the complete pending fixture
and a distinct prior async snapshot. Require missing/duplicate/wrong-kind path
or omitted/changed inline content to fail. Preserve both free-label checks and
the all-fifteen point/source/layout/placement comparison.
Do not expand into unrelated export refactoring.

## Preserve pending fixture, preparation and immutable downloads

Keep `pointLayoutPendingFixture.mjs`'s declared initial positions:
circle (7,6.5,0), right grid x19/23/27/31 and rows13/9/5/1 with its per-shape
assignments. Preserve all fifteen ids/shapes/order/full sources/styles/layout/
parameters, circle at index0, two free labels and the export-path inline nodes.
Keep pre-load cloning and normal JSON load, with no outcome-based repositioning.

Keep `pointLayoutPendingPreparation.mjs` and the unchanged shared .23 native
selection helper, current sibling body/contour bounds/CTMs/owner/request/state,
real first hit/stack, current held request, authoritative state invariance,
immediate input binding, one ordinary trusted no-modifier gesture and selected
owner proof before Inspector reopening. Keep separate preparation artifact,
native modifier cleanup, UI restoration and first-error handling.

Keep actual click-time snapshots for all fifteen points, selected owner,
background control and held conversion. Require current unreleased pending
source at the SVG click, exact source/style/position entries and intended
post-click release. Do not conflate cleanup release with that successful boundary.

Preserve the sequence: hold full source → normal combined load → pending native
selection → actual background control/armed snapshots → SVG click while pending →
transparent source/layout/view edits or white replacement load → intended release →
actual downloaded file → original-fixture reload/settled expectations/both TikZ
modes → external standalone reopening → complete-root PNG validation.

Keep captured old source/layout/placement after post-click changes, no edit/load
leakage, actual ready MathJax expected nodes, pending-versus-settled contour
inequality, cylinder paint/shape-center anchors and combined label/path content.
Do not settle/release the held source before click or weaken source/position
comparisons to accommodate later changes.

## Contracts, regressions and cumulative continuation

Extend the layout raw contract and parent policy for mandatory actual post-click
2D view evidence, while preserving the current preparation/hold/click/release
and SVG/PNG/TikZ checks. Terminal and standalone records must agree with their
actual persisted observations and exact same old click snapshot.
If adding an artifact, register and require it explicitly; missing/unrelated/
stale/failed evidence cannot pass or support completion review.

Add focused controls that expose this real oracle error: uiSettings unchanged
while 2D controls and root-relative point projection change correctly; no-op or
unapplied control; numeric value alone without view movement; CSS/scroll-only
movement; wrong control/owner/request/epoch; invalid matrices; changed model/
history/pan; missing before/after event/geometry; overwritten click snapshot;
early release or secondary diagnostic/cleanup errors.
Do not assert root CTM must change or treat serialized camera omission as failure.
Clearly identify synthetic controls; they are not native acceptance.

Retain production component body tests, the successful native pending selection
and fixture/policy/runner/capture controls. Register new tests in the explicit
list and copy imported dependencies into isolated runner fixtures.
Add no dependency without explaining necessity.
Use strict TypeScript without `any`; preserve 2D z=0, active 3D work planes and
the mathematical codimension convention.

Use the same cumulative pages and strict predecessor sequence. Preserve freshly
passed geometric and six layout scenarios, all anchors/diagnostics/body/overflow/
owner cycles. Complete both pending transparent/white layout SVG/TikZ downloads,
their actual reopening/PNG acceptance, then final standalone export.
Diagnose any subsequent first failure from fresh raw evidence.

## Preserve completed native, visibility, geometry and capture work

Keep Clear's detached imported paint/shape/layout behavior, exact persistence,
raw source, history, policy/UI regressions and JSON reload.

Keep scoped native Inspector/toolbar preparation, real Select before conditional
collapse, state invariance, fresh fixed .23 contour/CTM/hit, trusted owner/path,
owned restoration and first-error handling. Keep precise SVGPoint binary32
allowances without changing PGF tolerances.

Keep selected-point drag/layout movement, trusted handle/capture/release, one
history commit, exact saved/runtime Undo/Redo, field Inspector reopening and
owner cycles. Keep same valid revision through drag/Undo/Redo, native JSON-load +1,
stale reused-ID isolation and existing cache/revision semantics.

Keep canonical layers, exact-caption/associated-select visibility resolution,
dim/hide/dim/raw provenance, honest trusted=false selectOption records, native
theta90/phi0 and intended UI-angle-only changes, actual owner/occluder/opacity
validation and conditional owned preparation/restoration helpers.

Keep preview-only current body bounds/placement/request targets, nonempty finite
conditions, inherited layer/filter/lock behavior and detached/export exclusion.
Keep ordinary unsupported body/warning hits, bounded rings, body overflow,
contour/Alt selection and production-backed regressions.
Keep four fixed diagnostic candidates/first eligible adoption, six-unit visible
clearance, bounded-ring exclusion, viewport/clipping and genuine far background
delivery. Preserve all six ordinary body → far → warning cases.

Keep saved envelope version2, additive layout, legacy Size/2 precedence, ordered
shorthand/axis resolution, per-axis em/ex contexts, PGF solvers/anchors, actual
body/baseline/depth and painted/anchor-clearance bounds, 2D/3D projection and
immutable click-time placement. Preserve external raw text and existing
typography/paragraph/TeX-program limitations, free labels and inline path nodes.

Retain independent 172-box / 4,925-anchor / 11-failure reference inventory,
raw/reference files and tolerances. No geometry/reference regeneration is
justified by this observation/binding correction.
The diamond outer-separation exception still requires independent PGF review.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling/one native image/no retry, complete-root coverage, at most one
viewport expansion, stable coordinates and exact SVG/PNG file identity.
Preserve pre-image reopening records, owned page/listener cleanup,
no extra failure screenshot and primary-error handling.
Keep actual PNG CRC/chunks/inflated scanlines/dimensions/byte length validation,
independent source/contour/cylinder paint/placement/background checks, explicit
artifact lists and runner copying. Reject incomplete/cropped/unrelated/changed
images, missing raw observations or mock PNG headers.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused 2D post-click view and inline
binding controls, pending preparation, native selection/body, layout/capture,
parent-policy/ownership and runner checks.
Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused TypeScript/lint and changed-script syntax checks.
Report reproduced baseline debt accurately: retained geometric caller
no-unsafe-finally errors, verifier unused _role, unchanged layers suite unused
defaultCurveStyle and inherited focused strict-TypeScript diagnostics.
These checks remain failed; application TypeScript/build passed.
Do not report baseline failures as passes or expand into unrelated cleanup.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused/scoped evidence cannot establish strict 32D acceptance.
If the child hits `listen EPERM`, retain its startup failure and exact tree for
the parent without weakening sandbox/acceptance rules.
Do not reclassify the latest parent's uiSettings assertion as startup failure.

Load updated callers/helpers/contracts/policy in a fresh parent process and
verify the preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Preserve implementation/fix clean-tree guard. Do not reset, discard, stash,
commit or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import, complete
32C shapes/visibility/downloads and point-node-layout-anchors-combined.
Require terminal successes, actual valid artifacts, no page errors, native history/
JSON persistence, both TikZ modes, both pending layout downloads and reopened
standalone SVG/complete PNG acceptance.
Do not skip predecessors, reuse historical/scoped reports, create a deferred
32D profile or reclassify unexpected failures as backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect actual report/artifacts.
Matching accepted evidence can support a sandboxed reviewer; stale, partial
or failed reports cannot substitute for acceptance.

Update status only to observed accepted results. Keep Phase32 incomplete while
any native/download/reference/review gate remains open.
Preserve stop-before-review/commit on failed verification and the parent's
post-review identity guard.

Report the corrected 2D view observation and current-fixture inline binding,
preserved native/pending/capture contracts, changed files, focused/full checks,
fresh parent evidence/identity, actual transparent/white/download/final standalone
coverage, review result and any remaining concrete first failure.
Leave commit/push to the parent after verification and review pass.
Do not claim completion from child-only or historical results.
