# Phase 32D Fix for toolbar interception of native contour selection

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector selection, native drag preparation, and document revision corrections.
Repair the next concrete harness failure: an expanded Creation toolbar
intercepts the configured 2D semicircle's native contour click. The Inspector
is already closed, and earlier diamond/star drag and Undo/Redo now succeed.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing. Preserve
all implementation, native evidence validation, regressions, PGF references,
and documentation. Do not repeat the resolved fixes.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical 32C-only deferrals cannot
establish a 32D pass. Phase 32 remains incomplete until the current tree has
accepted complete evidence and passing independent review.

## Latest evidence and checkout identity

The completed revision-fix handoff is
`/private/tmp/stz-32d-revision-fix-20261010/HANDOFF.md`.
The same directory retains the seven-file inventory, complete diff, logs,
preservation hashes, and final identity. The latest browser-capable parent
records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-cYtf4V/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-gn1o0M/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-gn1o0M/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-gn1o0M/05-check-free-labels/artifacts/`.

At this prompt update, the branch is `phase/32d-margin-minsize-anchor`, HEAD
`8d0a3dab4bea1fd3baf7889ffcfdb16c4478bd20`. The pre-update tree matches both
before/after identities of the latest parent report:

```text
1991b7d4b22d8f6aab7d43b8b4c1793089bd00cf47cd923054b43de94517e312
```

There are seven modified tracked files and no nonignored untracked files
before this prompt update:

- `docs/PHASE_32D_IMPLEMENTATION.md`
- `docs/PHASE_32_PLAN.md`
- `scripts/pointNativeDrag.mjs`
- `tests/scripts/phase32cVerification.test.mjs`
- `tests/scripts/phase32dVerification.test.mjs`
- `tests/scripts/pointNativeDrag.test.mjs`
- `tests/scripts/pointNativeDragFixture.mjs`

Preserve all seven changes. Earlier implementation, Clear, selection, scoped
drag preparation, and raw evidence contracts are already tracked.
Updating this prompt changes the identity again. Capture the actual current
tracked/untracked tree; do not hard-code an old fingerprint as an acceptance
constant.

| Retained run | Actual result |
| --- | --- |
| Revision-fix child | 5,621/5,621 full tests and 524 focused checks passed without failures/skips. Build, diff, and eleven syntax checks passed. No new lint errors; five reproduced baseline errors remain. Both required browser commands stopped before Chrome launch at fresh-server `listen EPERM`. |
| Latest browser-capable parent | 5,621/5,621 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. `check:free-labels` completed paint/import and all eleven named shapes; 2D diamond/star drag with native Undo/Redo succeeded before the next semicircle selection failed. |

The parent completed 15 of 18 cumulative groups. The two retained interaction
successes do not complete `point-node-geometric-shapes`.
Semicircle drag/history did not execute; 2D dart and all four 3D contour
interactions remain pending, as do later geometric visibility/export cases.
The layout/anchor group and final standalone-export group did not execute.
Page errors are empty. This native toolbar interception is distinct from the
child's startup `EPERM` and all earlier failed assertions.

## Preserve the completed corrections

Keep Clear's detached imported paint/shape/layout behavior, exact persistence
comparisons, raw source, policy/UI regressions, history, and JSON reload
coverage. Do not strip layout from comparisons or restore orphaned provenance.

Keep `selectGeometricPoint`'s unique native Inspector close, bounded detached/
closed-state checks, fresh measurements, intended SVG owner/path assertions,
initial-unselected rejection, valid selected-handle/capture continuation, and
primary-error-preserving diagnostics. Preserve native Inspector reopening for
actual Shape/parameter controls.

Keep the scoped `pointNativeDrag.mjs` preparation for both callers:
preserved owner/data/history/camera/work plane, fresh handle/CTM/hit measurement,
one original native gesture, trusted handle input and matching captured canvas
continuation/release, raw evidence before assertions, selected-point-only
movement, one bounded commit, exact native Undo/Redo, and owned cleanup.
Keep layout owner cycling's fresh geometry and explicit owner assertions.

The revision correction is complete. Require valid nonnegative integer
`labelDocumentRevision` values and exact equality across same-document
preparation, drag, Undo, and Redo, including observed/authoritative and event
epoch comparisons. Keep the corrected same-epoch synthetic fixtures and all
114 additional revision regressions. Production revision increases only on
example/document replacement and native JSON load. Preserve load's exact +1,
reused-ID obsolete-completion rejection, and label/cache ownership lifecycle.

Preserve the parent-imported raw evidence contracts in
`scripts/pointGeometricShapesContract.mjs` and
`scripts/pointLayoutAnchorsContract.mjs`. Summary booleans cannot substitute
for native delivery/model/history records. Keep test registration, runner
transitive-helper copying, and identity/clean-tree guards.

## Diagnose the confirmed toolbar interception

The latest failure is:

```text
AssertionError [ERR_ASSERTION]: Native contour click selects its point
actual: undefined
expected: 'app-point'

selectGeometricPoint
  scripts/pointGeometricSelection.mjs:202
select
  scripts/checkPointNodeGeometricShapes.mjs:86
runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:217
scripts/checkFreeLabels.mjs:482
```

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
`point-geometric-app-failure.png`, and selection artifacts, especially
`point-geometric-selection-0066.json` through `0069.json`.
Also inspect `point-geometric-drag-0009.json` and `0018.json`.
The final checkpoint is
`point-node-geometric-shapes / point-geometric-native-contours-2d-3d-observed`.

The failed selection is the third interaction: 2D semicircle, codim 2,
`borderUsesIncircle=true`, `borderRotate=33`, source `drag $x_i$`,
model position `(3, 3, 0)`, owner/revision 102, selection sequence 14.

The retained observations establish:

- Before it, the 2D diamond and star complete trusted native drag, one bounded
  commit, and exact saved/runtime Undo/Redo restoration. Their epochs remain
  100 and 101 respectively throughout those operations; there is no primary
  drag failure in records 0009/0018.
- Semicircle's Inspector is closed, Select is active, and layout is ready.
  Owner/body/point requests agree. Viewport is `1700×1300`, scrollY 129.
  Contour screen CTM remains scale 3.1 with translation
  `(1296.4, 268.975)` before/after the failed click.
- The requested contour point is approximately
  `(1313.197754, 158.548584)`. `elementFromPoint` is
  `span.preview-toolbar-status`. The hit stack places Fill paths and the
  floating Creation toolbar above the intended `app-point` SVG path.
- All trusted pointerdown/up/click events target that toolbar status span.
  Their composed paths include `preview-fill-path-control`,
  `preview-floating-toolbar`, and `preview-toolbar-overlay-stack`;
  they do not deliver the click to the intended SVG owner.
- Selection remains null. Model/layout/epoch are unchanged, and page/observer
  errors and dropped events are absent. The PNG confirms the contour point
  lying under the expanded toolbar.

`observeGeometricPoint` currently obtains the boundary using the connected
contour's `getPointAtLength(getTotalLength() * .23)`, transformed with that
contour's own `getScreenCTM()`. The native point is real and fresh; scrolling
the canvas into view does not expose it from an overlay. The helper checks the
intended hit target only after clicking and asserting selection.

This is confirmed Creation toolbar interception, not evidence of an Inspector,
shape solver, coordinate-transform, 3D projection, or revision defect.
Preserve the fixed .23 contour input and repair native UI preparation.

## Prepare an unobstructed contour click through native UI

Inspect the shared selection helper and both geometric/layout callers, plus
`renderPreviewToolbarOverlay` / `togglePreviewToolbar` in `src/App.tsx`.
Existing production controls are `Collapse preview toolbar` and
`Expand preview toolbar`. The toolbar intentionally intercepts pointer input.
Native collapse hides Creation toolbar and quick style controls while leaving
the History overlay mounted.

Add a small, explicitly owned toolbar preparation path around the actual
canvas selection:

1. Preserve inherited toolbar/drawer state, selected owner, authoritative
   model/history/epoch, camera/work plane, and raw hit/CTM observations.
   Complete the required native Select action while that control is available.
2. If the freshly measured requested contour point is covered by the expanded
   Creation toolbar, operate the unique real `Collapse preview toolbar`
   control once. Verify bounded toolbar detachment/collapsed state and the
   native expand control. Keep observations of the obstructed state.
3. Finish native scrolling and remeasure the connected contour, its screen CTM,
   and the same .23 arclength boundary after all UI actions affecting layout.
   Record current `elementFromPoint` and hit stack. Require the intended SVG
   owner/path before one native canvas click. Preserve the expected selected
   ID and trusted ordered down/up/click delivery assertions.
4. Retain after-click evidence before assertions. Scope the canvas click
   observation so toolbar/drawer actions cannot satisfy native delivery checks.
5. Restore toolbar changes owned by this preparation through the unique real
   `Expand preview toolbar` control at the appropriate boundary, with bounded
   state confirmation. Compare state immediately before/after each UI action:
   it must preserve selection, saved/runtime data, history, document epoch,
   camera/work plane, and relevant UI settings. Do not compare initial null
   selection with the expected selected state across the canvas click.
6. Clean up observers and owned UI preparation on success/failure while
   preserving the first action/assertion error and bounded secondary diagnostics.

Resolve the ordering with both callers and `pointNativeDrag.prepareCanvas`.
Collapse removes the Select button, and drag preparation currently clicks
Select and checks its visible pressed state. Do not leave the toolbar collapsed
and introduce a missing-Select failure in the next drag or document selection.
Prefer a scoped temporary collapse/remeasure/click/native expansion that
restores toolbar access before returning to existing toolbar-dependent paths.
If the toolbar is already collapsed, avoid a redundant collapse; coordinate
any necessary native expansion for Select and restore the caller's owned state.
Do not infer that an absent hidden Select button means the active tool changed.

Keep Inspector reopenings for controls, history buttons, parameter/color cases,
and the cumulative reused-page workflow functional. Audit the analogous layout
selection/owner-cycle inputs for inherited toolbar obstruction without adding
an unconditional application-wide auto-collapse behavior.

Do not change overlay pointer-events/z-index/event propagation, force clicks,
remove toolbar DOM through evaluation, pick another arclength fraction, replace
boundary selection with a center/body/handle click, relocate the model point,
pan/zoom to make a coordinate convenient, mutate fixture selection/model state,
dispatch synthetic events, retry blindly, add arbitrary sleeps, or weaken
owner/path/history assertions. Native reads/measurements remain acceptable.

If the same freshly measured boundary is still obstructed after preparation,
retain its actual hit stack and stop with that failure. Do not click repeatedly
or treat an unrelated obstruction as success. If a fresh unblocked SVG click
fails, diagnose that new production trace before changing geometry/tolerances.

## Regressions and native coverage

Extend the relevant registered selection controls in
`tests/scripts/phase32cVerification.test.mjs` and any affected shared
preparation/parent policy controls. Preserve all existing drag/revision tests.

Cover the configured semicircle's toolbar-covered .23 boundary, native Select/
collapse ordering, one collapse action, bounded detached/collapsed confirmation,
fresh post-collapse/scroll measurement, intended pre-click target, one native
boundary click, and scoped native toolbar restoration. Include already-collapsed
and unobstructed no-op paths, ambiguous/missing controls, failed collapse/
restoration, stale coordinates/CTM, remaining toolbar/History/other obstruction,
and exact model/history/epoch/selection invariance of the UI actions.

Keep false-success controls for preexisting selection and toolbar-only trusted
events. Ensure first native/action/assertion failures survive diagnostic,
artifact, restoration, and observer-cleanup failures. Any temporary collapse
must preserve the next selection and drag helper's native Select access.
Validate retained raw preparation/selection records in the applicable policy
path; do not establish success solely from action counts or summary booleans.

Synthetic controls are not browser acceptance. Reproduce the actual same-page
sequence through all eleven shape cases, 2D diamond/star drag+Undo/Redo, and the
configured semicircle. Then complete all eight original 2D/3D contour
interactions, later geometric visibility/lifecycle/export, and the full layout/
anchor interaction/owner-cycle matrix. Preserve actual pending transparent/white
downloads, standalone SVG reopening, and both TikZ modes.

Use strict TypeScript without `any`; register any new test file in the explicit
test list and add no dependency. Keep model coordinates, 2D z=0, active 3D work
planes, and the mathematical codimension convention.

## Preserve the Phase 32D geometry and persistence contract

Keep saved envelope version 2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution, and per-axis em/ex context. Preserve the
PGF solvers, anchors, body/baseline/depth inputs, unsupported-anchor diagnostics,
overflow-body picking, distinct painted/anchor-clearance bounds, 2D/3D
projection, and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all original reference/raw files, and established tolerances. No geometry/
reference regeneration is justified by the demonstrated toolbar interception.
The diamond outer-separation exception still requires independent PGF review.
Preserve external source/exact saved text, existing typography/paragraph/
TeX-program limitations, free labels, and path inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused toolbar/selection, drag,
ownership, both parent policy suites, and runner regressions first. Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Run applicable focused TypeScript/lint and syntax checks for changed scripts.
Report reproduced baseline lint debt separately from new errors: the unchanged
geometric caller's four `no-unsafe-finally` errors and the independent
verifier's unused `_role` error are documented. Avoid unrelated cleanup.
Required checks that fail or cannot execute remain failed/unavailable.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused diagnostics cannot establish cumulative acceptance.
`check:point-native-focused` does not cover this full workflow; scoped 32C
cannot close 32D. If the child hits `listen EPERM`, retain its startup failure
and hand the exact tree to the parent without weakening sandbox/acceptance
rules. Do not describe the latest parent failure as startup failure.

The parent must load updated helper/contracts/policy in a fresh process.
Verify the preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Preserve the ordinary implementation/fix runner's clean-tree guard. Do not
reset, discard, stash, commit, or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import,
complete 32C shapes, and `point-node-layout-anchors-combined`.
Require terminal successes, valid raw artifacts, no page errors, native
history/JSON persistence, both TikZ modes, actual pending transparent/white
downloads, and reopened standalone SVG. Keep first failures through bounded
diagnostics and resource cleanup.

Diagnose any subsequent failure from its own first evidence. Do not skip
predecessors, reuse historical/scoped reports, create a deferred 32D profile,
or reclassify an unexpected failure as backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect the actual report/artifacts.
A sandboxed reviewer can use genuinely matching accepted parent browser evidence;
stale, partial, or failed evidence cannot substitute for it.

Update implementation/plan/roadmap status only to observed accepted results.
Keep Phase 32 incomplete while any native/download/reference or review gate
remains open. Preserve stop-before-review/commit on failed verification and
the parent's checkout identity guard after review.

Report the toolbar preparation/restoration fix, changed files, focused/full
checks, fresh parent evidence and identity, actual native contour/drag/history
and download coverage, review result, and any remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
