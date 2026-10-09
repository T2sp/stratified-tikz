# Phase 32D Fix for native point drag preparation and evidence

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout, the completed Clear
provenance correction, and the shared native Inspector selection preparation
fix. Repair the next concrete acceptance failure: the first geometric contour
interaction selects its point successfully, but its subsequent native handle
drag leaves the model position unchanged.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing and preserve
all existing implementation, regressions, PGF references, and documentation.
Do not restart Phase 32D or repeat the resolved Clear/selection repairs.

Keep strict cumulative 32D verification and the parent workflow's
verification-before-review/commit contract. Historical 32C-only deferrals cannot
establish a 32D pass. Phase 32 remains incomplete until the current tree has
accepted complete evidence and passing independent review.

## Latest evidence and checkout identity

The completed Inspector-fix handoff is
`/private/tmp/stz-32d-inspector-fix-20261009/HANDOFF.md`.
Its six-file inventory, complete diff, logs, and final identity are retained in
the same directory. The latest browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-ZZ6j0L/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tfTYBh/verification.json`.
- Primary browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tfTYBh/05-check-free-labels/command.log`.
- Native observations and failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tfTYBh/05-check-free-labels/artifacts/`.

At this prompt update, the branch is `phase/32d-margin-minsize-anchor`, HEAD
`375cd56b33f5f03357562d359be85c501da15b3f`. The pre-update tree matches both
before/after identities of the latest parent report:

```text
7e377338711f78089b72a53b36ea7eb6df0216ae5ab5a427ef37812239678741
```

There are six modified tracked files and no nonignored untracked files before
this prompt update:

- `scripts/pointGeometricSelection.mjs`
- `scripts/checkPointNodeGeometricShapes.mjs`
- `scripts/checkPointLayoutAnchors.mjs`
- `tests/scripts/phase32cVerification.test.mjs`
- `docs/PHASE_32D_IMPLEMENTATION.md`
- `docs/PHASE_32_PLAN.md`

Preserve those changes. Earlier 32D implementation, Clear corrections, and
reference fixtures are already tracked. Updating this prompt changes the tree
identity again. Capture the actual current tracked/untracked identity; do not
hard-code an old fingerprint as an acceptance constant.

| Retained run | Actual result |
| --- | --- |
| Inspector-fix child | 133 focused tests and 5,411/5,411 full tests passed without failures/skips. Build, diff, syntax, and applicable focused checks passed. No new lint errors; reproduced script baseline debt is documented. Both browser commands stopped before Chrome launch at fresh-server `listen EPERM`. |
| Latest browser-capable parent | 5,411/5,411 tests, build, diff, and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. `check:free-labels` completed the paint/import group and all eleven named geometric-shape cases, then failed on the first contour interaction's drag. |

The parent completed 15 of 18 cumulative groups. All eleven
`point-geometric-{shape}` cases, including diamond and cylinder, passed.
That does not complete `point-node-geometric-shapes`: its later interaction,
visibility/lifecycle, and export cases remain pending. The layout/anchor group
and final standalone-export group did not execute. The retained page-error list
is empty. This real parent drag failure is distinct from the child's startup
`EPERM` and from the earlier failed selection setup.

## Preserve the completed Clear and selection corrections

Keep the corrected expectations in `scripts/checkPointImportedPaint.mjs` and
`scripts/automation/phase-verification.mjs`. The parent records
`point-paint-clear-imported-style` as passed and completes
`point-node-paint-import-persistence`.

Preserve exact comparisons and rejection controls for detached imported
paint/shape/layout provenance, explicit layout and per-axis units/contexts,
unselected controls, raw source, one effective history commit, no-op repetition,
undo/redo, history capacity, and JSON reload. Keep the policy/UI regressions.
Do not strip layout fields from persistence comparisons or restore orphaned
provenance in production.

The shared `selectGeometricPoint` now closes a unique open Inspector through
its real native control, verifies bounded detachment and the closed opener,
then performs Select/scroll/fresh measurement before one native click.
It records intended targets/composed paths, verifies authoritative state/history
invariance, rejects false initial selection, and supports legitimate later
selected-handle pointer-capture continuation. Both callers preserve native
Inspector reopening for actual controls; the layout caller's duplicate
selection close was removed.

Keep this completed behavior and its 38 additional synthetic regressions.
The latest parent demonstrates successful reused-page selection through all
eleven shapes and the next diamond boundary. Synthetic records remain policy
tests, not native evidence.

## Diagnose the separate native drag failure

The latest primary assertion is:

```text
AssertionError [ERR_ASSERTION]:
Expected "actual" not to be strictly deep-equal to:
{ x: 3, y: 3, z: 0 }

actual:   { x: 3, y: 3, z: 0 }
expected: { x: 3, y: 3, z: 0 }

runPointNodeGeometricShapeChecks
  scripts/checkPointNodeGeometricShapes.mjs:226
scripts/checkFreeLabels.mjs:482
```

Read `free-labels-evidence.json`, `point-geometric-failure.json`,
`point-geometric-app-failure.json`, `point-geometric-app-lifecycle.json`,
`point-geometric-app-failure.png`, and the selection observations, especially
`point-geometric-selection-0056.json` through `0060.json`.
The final checkpoint is
`point-node-geometric-shapes / point-geometric-native-contours-2d-3d-observed`.

The failure is the first interaction case: ambient dimension 2, diamond,
codim 2, configured aspect 1.8, raw source `drag $x_i$`, owner/revision 100.
Do not describe this as a demonstrated failure of every 2D/3D drag.

The retained observations establish the following sequence:

1. Selection sequence 12 closes the inherited open/no-selection Inspector.
   The diamond layout is ready and the boundary is freshly measured.
2. The boundary click at approximately `(1307.1869, 200.1844)` reaches the
   intended `app-point` SVG path. Trusted pointerdown/up/click are recorded;
   selection becomes `{ kind: 'stratum', id: 'app-point' }`.
3. Before reopening, the selected handle group has screen bounds
   `x=1279.040, y=251.615, width=34.720, height=34.720`, centered near
   `(1296.4, 268.975)`.
4. Record 0060 and the caller show the wrapper reopening/expanding the
   Inspector. Selection, model position, history, and revision are preserved.
   The failure PNG shows that open drawer covering the selected point center.
5. The caller then measures the handle and sends one native
   move/down/move/up with displacement `(+28, -16)`, four move steps.
   Its before/after model positions remain `(3, 3, 0)`.

The current drag collector stores only event type/trust, starts before
selection, and is read/removed only after the failed position assertion.
The retained evidence therefore does not establish the drag's actual event
target, composed path, pointer capture, or handle CTM at pointerdown.
Inspector interception is a strong candidate supported by the source and PNG;
confirm the actual drag delivery rather than treating the preceding successful
selection trace as a drag trace.

Inspect the production handle/pointer-controller route in
`src/rendering/SvgDiagram.tsx` when interpreting events. The selected point
handle initiates geometry dragging; captured continuation can legitimately
target the canvas root. A ready node and successful boundary selection are not
proof that the subsequent handle received pointerdown.

## Prepare and observe the native drag

Inspect the interaction block in
`scripts/checkPointNodeGeometricShapes.mjs`, the shared selection helper, and
the related native interaction block in `scripts/checkPointLayoutAnchors.mjs`.
The geometric wrapper deliberately reopens the Inspector before returning;
the caller currently performs no separate drawer/hit-target preparation for
the following drag. Audit the layout caller's analogous handle drag and
owner-cycling clicks for the same boundary and stale-measurement issue.

Implement a small, explicitly owned preparation/observation path for canvas
dragging after successful selection:

1. Retain the inherited drawer, selected owner, model/history, viewport,
   work-plane/camera, and rendered handle state. Install an owned observer
   early enough to retain the first failing preparation/action evidence.
2. If the Inspector is open, operate its unique real
   `Close inspector drawer` button once and verify bounded detachment/closed
   state. A closed drawer needs no close action. Preserve the selected owner
   and exact saved/runtime JSON, history, and document revision across this
   preparation.
3. Complete any necessary native mode/scroll preparation, then freshly measure
   the selected handle's connected SVG geometry, bounding box, and screen CTM.
   Read `elementFromPoint` and the hit stack at its current start center.
   Require the intended selected point-position handle before pointerdown.
   Do not reuse measurements from before drawer/scroll changes.
4. Perform one native handle drag through the production path. Preserve the
   original geometric scenario's `(+28, -16)` displacement/four steps, and the
   layout scenario's existing displacement, unless concrete evidence requires
   a documented correction. Record the actual coordinates and result.
5. Before the movement assertion, retain after-action model/selection/history
   and native events, including actual targets/composed paths, pointer IDs,
   buttons, client coordinates, and pointer-capture state/transitions.
   Distinguish the drag from earlier selection, drawer, and setup events.
6. Require delivery of trusted handle pointerdown and matching movement/up
   through the production drag/capture route, a real model coordinate change,
   one effective history commit, and exact Undo/Redo restoration.
   Retain relevant JSON/history states before each assertion and clean up the
   observer on every exit.

Allow legitimate captured movement/up on the owned SVG canvas root; rejecting
all root targets would reject valid production dragging. Reject unrelated
canvas/background/Inspector events, wrong owner/pointer IDs, cancellation,
no movement, camera-only changes, movement of another point, and preexisting
selection used as false evidence of a drag. The handle is outside the point's
`data-point-id` group; establish its selected owner and intended handle path
without requiring that attribute on the handle itself.
Observe capture transitions or post-handler capture state at the appropriate
boundary; a document capture-phase pointerdown can precede the handler's
`setPointerCapture` call. Do not assert capture at an impossible event phase.

Keep diagnostics bounded, retain the first action/assertion failure, and attach
secondary observation/evidence/cleanup failures without replacing it.
The observer must be removed even when the unchanged-position assertion fails.
Avoid duplicate listeners and a page-global collector that mixes separate
interactions. Reuse a narrow shared preparation utility if it improves both
callers; do not add an unconditional global drawer-closing behavior.

Update the relevant native-interaction contracts in
`scripts/pointGeometricShapesContract.mjs` and
`scripts/pointLayoutAnchorsContract.mjs`, which the parent verifier imports.
Validate retained raw drag delivery, model, and history records independently
of summary booleans such as `dragged`, `trustedDown`, or `trustedDrag`.
Add rejection controls for fabricated booleans and contaminated selection
events; preserve all other shape/layout/reference/export requirements.

Preserve native Inspector reopening where Shape/parameter controls are needed.
The drag preparation should preserve the already-selected point rather than
reselecting it through fixture state or repeatedly calling a wrapper that
reopens the drawer. Native owner cycling must use fresh geometry after its
preparation and retain its actual owner assertions.

Do not fix this by changing overlay pointer-events/z-index/event propagation,
forcing inputs through the drawer, relocating the model point, changing camera
or work plane to make a stale coordinate work, mutating fixture selection/model
state, dispatching synthetic events, retrying blindly, adding arbitrary sleeps,
or weakening the movement/history assertions.

If fresh, unobstructed native handle delivery still leaves coordinates
unchanged, retain that new trace and diagnose the actual pointer controller,
projection/work-plane, and commit path. Change production behavior only for a
demonstrated production defect, with an appropriate regression. The retained
failure alone does not justify changing shape geometry or hit tolerances.

## Regressions and full native coverage

Extend the relevant registered script controls, including
`tests/scripts/phase32cVerification.test.mjs`, with synthetic drag-preparation
and delivery regressions. Preserve all existing selection controls. Cover:

- Successful boundary selection followed by native Inspector reopening, one
  close action, preserved selection/data/history, and fresh handle measurement
  after drawer/scroll changes.
- Already-closed no-op preparation, stale coordinates, missing/detached/wrong
  handle, failed close/detachment, and a remaining non-drawer obstruction.
- Trusted intended handle input and legitimate captured canvas continuation;
  overlay-only events, unrelated earlier selection events, wrong pointer/
  owner, untrusted/cancelled input, and unchanged-position false successes.
- Exact one-commit history and Undo/Redo behavior, plus primary action/assertion
  errors surviving observation, artifact, and cleanup failures.

Keep synthetic controls explicitly separate from native browser acceptance.
Reuse the actual cumulative App page; fresh pages cannot substitute for the
inherited drawer sequence. First reproduce the first 2D diamond selection,
reopened Inspector, and handle drag; then complete all eight original contour
interactions across 2D/3D and diamond/star/semicircle/dart with trusted drag and
Undo/Redo evidence.

Retain every supported shape's default/configured body cases, native parameter
and cylinder color controls, owner cycling, visibility/lifecycle cases, actual
pending downloads, and standalone reopening. Keep the complete 32D layout/
anchor matrix and its native interactions. Use model coordinates and the
active work plane correctly; keep 2D cursor results at z=0 and do not confuse
geometric kind with codimension.

Preserve strict TypeScript without `any`, register any new test file in the
explicit `npm test` list, and add no dependency for this correction.

## Preserve the Phase 32D geometry and persistence contract

Keep saved envelope version 2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution, and per-axis em/ex context. Preserve the
PGF solvers, anchors, body/baseline/depth inputs, unsupported-anchor diagnostics,
overflow-body picking, distinct painted/anchor-clearance bounds, 2D/3D
projection, and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
its raw inputs/artifacts, and established tolerances. Do not regenerate
references or alter geometry to conceal an unverified drag-delivery problem.
The documented diamond outer-separation exception still requires independent
PGF review. Preserve both TikZ modes, external source and exact saved text,
existing typography/paragraph/TeX-program limitations, free labels, and path
inline nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused drag-preparation/delivery,
selection, and ownership regressions first, then all required commands:

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
verifier's unused `_role` error are already documented. Avoid unrelated cleanup.
Required checks that fail or cannot execute remain failed/unavailable.

Run browsers in the browser-capable parent with a fresh owned server and
supported Playwright/Chrome configuration. Focused diagnostics cannot establish
cumulative acceptance. `check:point-native-focused` does not cover this complete
geometric-shape workflow; the 32C scoped profile cannot close 32D.
If the child hits `listen EPERM`, retain that startup failure and hand the exact
tree to the parent without weakening sandbox or acceptance rules. Do not use
the startup restriction to describe the latest native drag failure.

The parent must load updated policy in a fresh verifier process. The manual
route checks the preserved dirty tree without committing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
```

Preserve the ordinary implementation/fix runner's clean-tree guard. Do not
reset, discard, stash, commit, or push unfinished work to bypass it. Require all
twelve 31F groups, three 32A groups, the full 32B paint/import group, 32C shapes,
and `point-node-layout-anchors-combined`. Require named terminal successes,
valid artifacts, no page errors, native history/JSON persistence, both TikZ
modes, actual pending transparent/white downloads, and reopened standalone SVG.
Keep raw failures through bounded diagnostics and resource cleanup.

If a subsequent assertion fails, retain its first evidence and diagnose that
specific defect. Do not skip predecessors, reuse historical/scoped reports,
create a deferred 32D profile, or reclassify an unexpected failure as the older
32B backlog.

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

Report the drag preparation/evidence fix, changed files, focused/full checks,
fresh parent evidence and identity, native handle/capture/history and download
coverage, review result, and any remaining concrete failure. Leave commit/push
to the existing parent workflow after verification and review pass. Do not
claim completion from child-only or historical results.
