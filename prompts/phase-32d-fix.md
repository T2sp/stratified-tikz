# Phase 32D Fix for the native drag document revision contract

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and the completed Clear,
selection, and scoped native drag preparation corrections. Repair the native
acceptance harness's incorrect document revision expectations. The latest
parent records a real selected-point drag and exactly one bounded history
commit, then stops because the harness incorrectly requires
`labelDocumentRevision` to increase.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing. Preserve all
existing implementation, native preparation, evidence validation, regressions,
PGF references, and documentation. Do not repeat the resolved fixes.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical 32C-only deferrals cannot
establish a 32D pass. Phase 32 remains incomplete until the current tree has
accepted complete evidence and passing independent review.

## Latest evidence and checkout identity

The completed native-drag-fix handoff is
`/private/tmp/stz-32d-native-drag-fix-20261009/HANDOFF.md`.
The same directory retains the thirteen-file inventory, complete tracked/
untracked diff, logs, failures, preservation hashes, and final identity.
The latest browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-E3FRtD/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-5waNKq/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-5waNKq/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-5waNKq/05-check-free-labels/artifacts/`.

At this prompt update, the branch is `phase/32d-margin-minsize-anchor`, HEAD
`5021a1d8af30f55fa48b67744f6af77de0f2047d`. The pre-update tree matches both
before/after identities of the latest parent report:

```text
b419faae1158a5574b493e7c4df096a02e24b3ede195e7b7b761a9d474ce5d6c
```

There are ten modified tracked files and three nonignored untracked files
before this prompt update. Preserve the tracked changes to both Phase 32
documents, `package.json`, both geometric/layout callers, both geometric/layout
contracts, both Phase 32C/32D policy tests, and
`tests/scripts/runPhaseRunner.test.mjs`. Preserve the new files:

- `scripts/pointNativeDrag.mjs`
- `tests/scripts/pointNativeDrag.test.mjs`
- `tests/scripts/pointNativeDragFixture.mjs`

Earlier implementation, Clear, and selection corrections are already tracked.
Updating this prompt changes the tree identity again. Capture the actual
current tracked/untracked identity; do not hard-code an old fingerprint as an
acceptance constant.

| Retained run | Actual result |
| --- | --- |
| Native-drag-fix child | 5,507/5,507 full tests passed without failures/skips; 297 focused checks and 37 runner checks passed. Build, diff, and ten script syntax checks passed. No new lint errors; reproduced baseline debt remains. Both required browser commands stopped before Chrome launch at fresh-server `listen EPERM`. |
| Latest browser-capable parent | 5,507/5,507 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. `check:free-labels` completed the paint/import group and all eleven named shapes, then failed on the first contour interaction's revision assertion after successful native movement/history checks. |

The parent completed 15 of 18 cumulative groups. All eleven
`point-geometric-{shape}` cases passed, but `point-node-geometric-shapes`
remains incomplete. Drag Undo/Redo did not execute in the failed first case;
the other contour interactions and later geometric visibility/export cases
remain pending. The layout/anchor group and final standalone-export group
did not execute. Page errors are empty.

This is a real parent harness assertion failure. It is distinct from the
child's startup `EPERM` and the earlier unprepared/unchanged-position drag.

## Preserve the completed native corrections

Keep the Clear provenance correction, exact persistence comparisons, policy/UI
regressions, detached imported paint/shape/layout behavior, raw source, history,
and JSON reload coverage. Do not strip layout from comparisons or restore
orphaned provenance in production.

Keep `selectGeometricPoint`'s unique native Inspector close, bounded detached/
closed-state checks, Select/scroll/fresh measurement, intended SVG point and
selected-handle paths, initial-unselected rejection, pointer-capture-aware
continuation, and primary-error-preserving diagnostics. Preserve native
Inspector reopening for actual Shape/parameter controls.

Keep the scoped `pointNativeDrag.mjs` preparation shared by both callers:
one real close when needed, preserved selected owner/data/history/camera/work
plane, fresh connected handle/CTM/hit measurements, one original native gesture,
trusted intended handle input, matching captured canvas continuation and
release, raw evidence before assertions, selected-point-only movement, exact
bounded history, native Undo/Redo, and owned observer cleanup. Keep layout
owner cycling's fresh preparation/measurements and explicit owner assertions.

Preserve the parent-imported raw evidence validation in
`scripts/pointGeometricShapesContract.mjs` and
`scripts/pointLayoutAnchorsContract.mjs`, which share
`assertPointNativeDragEvidence` from `scripts/pointNativeDrag.mjs`.
Do not fall back to summary booleans such as `dragged` or `trustedDrag`.
Keep test registration and the runner fixture's imported-helper copying.

## Diagnose the revision assertion with the retained native evidence

The current failure is:

```text
AssertionError [ERR_ASSERTION]:
assert.ok(Number.isInteger(afterState.labelDocumentRevision)
  && afterState.labelDocumentRevision > beforeState.labelDocumentRevision)

assertMovement
  scripts/pointNativeDrag.mjs:276
dragSelectedPoint
  scripts/pointNativeDrag.mjs:416
runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:218
scripts/checkFreeLabels.mjs:482
```

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
the failure PNG, and `point-geometric-drag-0001.json` through `0005.json`.
The final checkpoint is
`point-node-geometric-shapes / point-geometric-native-contours-2d-3d-observed`.

The first interaction is again the 2D diamond, codim 2, configured aspect 1.8,
source `drag $x_i$`, selected owner `app-point`, document revision 100.
The new records establish more than the preceding failed run:

- The Inspector is closed once through its native control. The fresh handle
  start is approximately `(1296.4, 268.975)`; the requested end is
  `(1324.4, 252.975)`, preserving `(+28, -16)` and four move steps.
- Trusted pointerdown targets the selected point-position handle. Pointer ID 1
  receives canvas capture; all four moves and pointerup reach the captured
  owned SVG root. Pointerup releases capture and lostpointercapture is retained.
- The model position changes from `(3, 3, 0)` to
  `(3.191563400173898, 3.1286778583820283, 0)`.
  Saved/runtime records show only that selected point position changed.
- The history is exactly the prior history plus one effective bounded commit,
  with redo cleared and the moved model as present. Both past lengths are 100
  because the capacity is already full; unchanged length is not a no-op.
- Before/after `labelDocumentRevision` are both 100. The position, data,
  history, and delivery assertions run before the failing revision condition.
  Secondary diagnostic errors are empty.
- Record 0004 retains after-action evidence; 0005 retains the same evidence,
  final observation, and primary failure. No Undo/Redo records exist because
  the movement assertion stops before those native actions.

The latest evidence establishes successful native movement/delivery in this
first case, not a complete geometric group or accepted cumulative drag coverage.
Do not reuse the old unchanged-position diagnosis or claim unexecuted history/
3D/download cases have passed.

## Correct the document ownership contract

Inspect the actual App revision lifecycle rather than treating the field name
as an edit counter:

- `src/App.tsx` initializes `labelDocumentRevision` to zero. Its two setter
  call sites are `selectExample` and `commitLoadedJsonDiagram`; these replace
  the active document and advance its ownership even if IDs are reused.
- `handleGeometryHandleDrag` updates editor model/history through the geometry
  drag session. Drag start/end and ordinary Undo/Redo do not increment this
  revision. Undo/Redo restore diagram/history under the current document epoch;
  that epoch is outside the saved diagram/history.
- `src/rendering/SvgDiagram.tsx` keys label-bound and point-commit maps by the
  document revision. Source/font/request and placement changes have their own
  existing mechanisms. A location change is not a document replacement.

Correct both incorrect requirements in `scripts/pointNativeDrag.mjs`:

1. `assertMovement` currently requires a larger revision after drag.
   Require valid nonnegative integer App revisions and exact revision equality
   across this same-document drag, alongside the existing real model movement
   and one-history-commit requirements.
2. `assertPointNativeDragEvidence` also requires a larger revision after each
   drag Undo/Redo, currently at line 304. Correct both to same-document equality
   with their respective before states. Fix these now rather than waiting for
   the first movement repair to expose the next identical assertion.
3. Preserve preparation/state continuity and observed revision-to-authoritative
   state comparisons. A missing, invalid, changed, or internally inconsistent
   revision must not pass. Keep exact saved/runtime JSON, Undo/Redo history,
   selected owner, camera/work plane, source/style, and native delivery checks.

Keep document-replacement expectations intact. In particular,
`scripts/checkFreeLabelsApp.mjs` requires native JSON load to advance ownership
once and rejects stale completion across reused-ID loads. The geometric/layout
load waits also depend on that increment. Do not replace load assertions with
same-revision rules or weaken stale-request isolation.

Do not increment the production revision on movement or Undo/Redo to satisfy
the harness, restore it from history, introduce another edit counter, change
model/schema, or remove revision checking wholesale. The demonstrated defect
is the harness's invented monotonic edit contract. Preserve production geometry,
persistence, label ownership/cache lifecycle, reference inputs, and tolerances.

## Correct synthetic fixtures and add meaningful regressions

The current `tests/scripts/pointNativeDragFixture.mjs` fabricates revision
values `100 -> 104 -> 105 -> 106` for drag/Undo/Redo and their snapshots.
Update those states and matching observations to the actual unchanged document
epoch. Keep genuine position/history transitions and trusted event/capture
records. Synthetic policy data must reflect the App contract and cannot serve
as native acceptance.

Extend the registered drag/helper and parent policy controls:

- Accept unchanged revision across preparation, movement, native Undo, and
  native Redo while requiring actual selected-point movement and exact history.
- Reject an increased or decreased revision during drag and each history
  action, plus missing/invalid revisions. When testing this invariant, update
  redundant state/snapshot/continuity records consistently so rejection reaches
  the epoch rule rather than an unrelated record mismatch.
- Reject disagreement between observed and authoritative revision records.
  Preserve no-movement, wrong-owner, camera-only movement, multiple commits,
  bogus Undo/Redo, overlay/earlier-selection contamination, pointer/capture,
  bounded-history, and cleanup/primary-error rejection controls.
- Exercise the corrected fixture and revision rejection through both
  Phase 32C/32D parent-imported contracts, not just the helper's direct tests.
  Preserve native load/reused-ID ownership tests showing that document
  replacement still advances the epoch and rejects obsolete completion.

Keep tests explicitly synthetic when using orchestration doubles. Reproduce
the same cumulative App page natively, completing the first 2D diamond drag
and its real Undo/Redo, then all eight original contour interactions across
2D/3D and diamond/star/semicircle/dart. Retain each action's raw revision,
position, saved/runtime model, and bounded history.

Preserve every shape's default/configured body and native parameter/color
cases, layout/anchor interactions, owner cycling, visibility/lifecycle cases,
both TikZ modes, actual pending downloads, and standalone reopening.
Use model coordinates and the active work plane correctly; keep 2D cursor
results at z=0 and preserve the mathematical codimension convention.
Use strict TypeScript without `any` and add no dependency.

## Preserve the Phase 32D geometry and persistence contract

Keep saved envelope version 2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution, and per-axis em/ex context. Preserve the
PGF solvers, anchors, body/baseline/depth inputs, unsupported-anchor diagnostics,
overflow-body picking, distinct painted/anchor-clearance bounds, 2D/3D
projection, and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all original reference files/raw artifacts, and established tolerances.
No geometry/reference regeneration is justified by this harness assertion.
The documented diamond outer-separation exception still requires independent
PGF review. Preserve external source/exact saved text, existing typography/
paragraph/TeX-program limitations, free labels, and path inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused drag, selection, ownership,
both parent policy suites, and runner regressions first. Run required commands:

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

Run browsers in the browser-capable parent with a fresh owned server and
supported Playwright/Chrome configuration. Focused diagnostics cannot establish
cumulative acceptance. `check:point-native-focused` does not cover this complete
workflow; the 32C scoped profile cannot close 32D.
If the child hits `listen EPERM`, retain that startup failure and hand the exact
tree to the parent without weakening sandbox or acceptance rules. Do not use
the startup restriction to describe the latest native revision assertion.

The parent must load the updated helper/contracts/policy in a fresh verifier
process. The manual route checks the preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Preserve the ordinary implementation/fix runner's clean-tree guard. Do not
reset, discard, stash, commit, or push unfinished work to bypass it. Require all
twelve 31F groups, three 32A groups, full 32B paint/import, complete 32C shapes,
and `point-node-layout-anchors-combined`. Require terminal successes, valid raw
artifacts, no page errors, native history/JSON persistence, both TikZ modes,
actual pending transparent/white downloads, and reopened standalone SVG.
Keep first failures through bounded diagnostics and resource cleanup.

If a later assertion fails, retain its first evidence and diagnose that
specific defect. Do not skip predecessors, reuse historical/scoped reports,
create a deferred 32D profile, or reclassify an unexpected failure as backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect the actual report/artifacts.
A sandboxed reviewer can use genuinely matching accepted parent browser evidence;
stale, partial, or failed evidence cannot substitute for it.

Update implementation/plan/roadmap status only to observed accepted results.
Keep Phase 32 incomplete while any required native/download/reference or review
gate remains open. Preserve stop-before-review/commit on failed verification
and the parent's checkout identity guard after review.

Report the corrected revision contract and fixtures, changed files, focused/
full checks, fresh parent evidence and identity, actual native drag/Undo/Redo
and download coverage, review result, and any remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
