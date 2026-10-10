# Phase 32D Fix for unsupported-anchor diagnostic clicks

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag, revision, visibility/camera,
canonical layer, diagnostic-ordering and standalone SVG capture corrections.
Repair the next concrete parent failure: the unsupported-anchor diagnostic
case chooses a fixed rightward far point which can leave the native SVG canvas.

Keep this negative picking test meaningful: the far click must be inside the
requested but unpainted shape, outside the visible body/warning picking region,
and delivered to the actual canvas. Select an eligible point from a bounded
deterministic set of measured candidates; do not weaken the canvas-hit assertion.

Preserve production source, model/serialization semantics, geometry, PGF
references, all completed native helpers, and accepted real download/PNG evidence.
Do not repeat resolved fixes or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.
Keep strict cumulative verification, verification-before-review/commit and
the exact-tree post-review identity gate. Phase32 remains incomplete until
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

Latest child handoff:
`/private/tmp/stz-32d-svg-capture-fix-20261010/HANDOFF.md`.
Its exact inventory, diffs, preservation hashes, reports and logs are retained
in the same directory. The newer browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-oqcZ1K/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tIPiXu/verification.json`.
- Browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tIPiXu/05-check-free-labels/command.log`.
- Raw native evidence/failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tIPiXu/05-check-free-labels/artifacts/`.

Branch is `phase/32d-margin-minsize-anchor`, HEAD
`2f9cba7d0bb3a555c13d2e70d4ec673a44237768`.
The actual pre-prompt-update tree matches both before/after parent identities
and the child handoff:

~~~text
050578337d1576d341294dcabeaa612c9e1f3302807055a00ba0dabd29f7c67b
~~~

Preserve the thirteen modified tracked files: both Phase32 documents,
`package.json`, `scripts/automation/phase-verification.mjs`,
both geometric/layout export callers and contracts, `scripts/ownedAppPage.mjs`,
`tests/scripts/ownedAppPage.test.mjs`, both 32C/32D policy suites, and
`tests/scripts/runPhaseRunner.test.mjs`.
Preserve the four new untracked files:
`scripts/standaloneSvgCaptureContract.mjs`,
`tests/scripts/pointGeometricStandaloneCapture.test.mjs`,
`tests/scripts/pointLayoutStandaloneCapture.test.mjs`, and
`tests/scripts/standalonePointDownloadFixture.mjs`.
Earlier corrections are now tracked. This prompt edit changes the identity;
capture the current tree rather than hard-coding a historical fingerprint.

| Retained run | Actual result |
| --- | --- |
| SVG-capture child | 6,119/6,119 full tests and 1,589 focused checks passed without failures/skips. Build, diff and syntax passed. Existing lint/type debt remains failed and documented. Fresh strict verification stopped at `check:label-assets` with fresh-server `listen EPERM` before Chrome. No review/commit/push. |
| Latest browser-capable parent | 6,119/6,119 tests, build, diff and full `check:label-assets` passed. Chrome 154.0.8037.98 ran native scenarios. Paint/import, eleven geometric shapes, eight contours, visibility, and both transparent/white geometric SVG download/reopening/PNG scenarios passed. Layout sizing passed; unsupported-anchor diagnostic preparation then failed. |

tIPiXu completed 16 of 18 cumulative groups. The complete geometric group now
passed. Both geometric raw standalone records remain observed candidates with
saved capture; their separate terminal scenario records passed.
Actual PNGs are 1700×1300, 31,278 bytes transparent and 31,548 bytes white.
Each records one measurement, bodyExists=false, a complete 520×360 SVG root,
stable coordinates, and the accepted actual file identity.

`point-layout-per-shape-spacing-minima` passed 90 cases across fifteen shapes.
The anchor-support/rotation scenario is not terminal passed: its last summary
checkpoint names the supported cylinder/bottom observation, while the active
failure is its first unsupported native case, 2D ellipse.
The remaining layout scenarios/pending downloads and final standalone-export
group did not execute. Page errors are empty.
Distinguish this native diagnostic failure from child startup restrictions and
the resolved screenshot/visibility/layer/toolbar/drag failures.

## Preserve completed native, visibility and capture contracts

Keep Clear's detached imported paint/shape/layout behavior, exact persistence,
raw source, history, policy/UI regressions and JSON reload.

Keep scoped native Inspector preparation and toolbar handling:
Select access before conditional collapse, unique real controls, bounded
detached/collapsed confirmation, exact model/history/epoch/selection invariance
of UI actions, fresh fixed .23 contour/current CTM/hit stack, one native click,
trusted owner/path delivery, owned native restoration and primary-error precedence.
Preserve the precise SVGPoint binary32 allowance without changing PGF tolerances.

Keep selected-point-only drag/layout movement, gesture identity, pointer capture/
release, exactly one bounded commit, exact saved/runtime Undo/Redo, raw parent
validation, native Inspector reopening for fields and fresh owner cycling.
Keep same-document revision equality through preparation/drag/Undo/Redo;
native JSON load/example replacement still advances ownership, including exact
load +1 and stale reused-ID isolation. Do not modify production revision/cache.

Keep source-only exact-caption/direct-label/associated-select resolution,
native scroll/preconditions, bounded dim/hide/dim actions, actual returned values,
settings/event evidence, honest trusted=false selectOption provenance, native
theta90/phi0 preparation and intended UI-angle-only changes.
Keep canonical layer defaults, owned unique metadata, locked=true and explicit
visible=false for the hidden layer, raw saved/runtime/history agreement and faithful fixtures.
Keep actual owner/occluder/opacity validation and pre-assertion observed diagnostics.

Keep both export callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling/one native image/no retry, measured complete-root coverage,
at most one viewport expansion, stable coordinates, actual full PNG validation
and exact SVG/PNG path/file identity. Preserve pre-image reopening records,
owned page/listener cleanup, no extra failure screenshot, and first-error handling.

Keep `standaloneSvgCaptureContract.mjs` and parent verification of actual
PNG CRC/chunks/inflated scanlines/dimensions/byte length and raw capture state.
Do not accept missing/pending/failed/unrelated/cropped/changed capture or mock
header files. Keep source/contour/cylinder paint/placement/background checks
independent of image success, explicit artifact lists, registered integration
tests and isolated runner dependency copying.

## Diagnose the off-canvas diagnostic candidate

The latest first failure is:

~~~text
AssertionError: Far diagnostic click reaches the native SVG canvas
false !== true

runPointLayoutAnchorChecks
  scripts/checkPointLayoutAnchors.mjs:419
scripts/checkFreeLabels.mjs:483
~~~

Read `free-labels-evidence.json`, `point-layout-failure.json`,
`point-layout-app-failure.json`, `point-layout-app-lifecycle.json`,
`point-layout-app-failure.png` and the passed layout sizing/geometric artifacts.

The unsupported loop is 2D/3D × ellipse/circle/cylinder, source
`WWWW diagnostic`, anchor `not a PGF anchor`, minimumWidth/Height1000.
The first loaded native case is 2D ellipse, owner epoch397.
No body/far/warning click has executed: line419 asserts the measured boolean
before `diagnosticClick` or its native event collection.

The caller's current far candidate is:

~~~js
{ x: bodyBounds.maxX + 100, y: (bodyBounds.minY + bodyBounds.maxY) / 2 }
~~~

It is transformed through the current point screen CTM, then checked only with
`canvas.contains(document.elementFromPoint(...))`.
The returned `rendered` record is not persisted before this assertion.
Thus the actual native far coordinate, CTM and hit stack are absent from the
retained diagnostic artifact.

The failure DOM independently retains root viewBox `0 0 520 360`,
node `translate(404 36)`, data-label bounds approximately
`[-48.706, -7, 48.706, 7]`, unsupported source/anchor/minima, no selection,
Inspector opener aria-expanded=false and an expanded creation toolbar.
The PNG shows the body near the right canvas edge.

The source/DOM-supported inference is that the fixed rightward candidate maps
to SVG x≈552.7, beyond viewBox right520. Actual native text getBBox/CTM/screen
coordinates were not saved; measure and retain them in the fresh run.
Do not call this a proven toolbar or Inspector interception. Closing a drawer
or increasing the browser viewport alone does not correct a point outside
the SVG viewBox. Production point placement/minima are not the defect.

## Resolve an eligible negative probe from actual geometry

Implement a small unsupported-diagnostic-specific measurement/candidate resolver
or local helper. Keep the existing rightward candidate as an observed first
candidate, then evaluate a bounded fixed-order set such as left/below/above
with the same declared clearance relative to measured visible bounds.
Do not search by trial clicks, pick an arbitrary successful pixel, or choose
a point after observing selection outcomes.

Require the adopted far candidate to satisfy all of these before input:

1. Actual connected unique canvas, expected point/body/warning and current
   owner/request/source/unsupported anchor. Zero contour is intentional here.
   All native local bounds and node/root screen matrices must be finite;
   require valid invertible matrices and retain both coordinate frames.
2. The local point lies inside actual requested shape bounds. Preserve the
   requested minima1000 and zero painted bounds; this is a counterexample
   inside the suppressed contour, not an unrelated blank page click.
3. It is more than six local units from both actual body and warning bounds.
   After body selection, preserve the bounded visible selection ring and
   ensure the far probe remains outside that visible selection affordance.
4. Its projection lies inside the actual SVG viewBox/drawing area, canvas
   client bounds and visible viewport, with current scroll/clip conditions.
   Account for SVG preserveAspectRatio and nontrivial CTMs rather than treating
   local/viewBox/CSS/client coordinates as interchangeable.
5. Native elementFromPoint/elementsFromPoint show an unobstructed route into
   the exact production canvas, away from body/warning/handle/UI overlays.
   Retain actual target identity and rejection reasons for every candidate.
   Missing/null/outside/overlay targets cannot be accepted as negative picking.

If no measured candidate is eligible, fail with all observations and no click.
Do not relocate the model point, alter source/minima/anchor/shape, change
camera/pan/zoom/work plane, force a click, synthesize events, or alter production
picking/geometry/reference tolerances to make the test pass.
Do not clamp the old point in a way that loses its geometric negative condition.

Use scoped native UI preparation only when actual measured obstruction requires
it: close an owned Inspector if present, access real Select before conditional
toolbar collapse, and preserve the actual state. Re-measure after any native
scroll/collapse/selection change. Restore only UI state owned by this preparation,
preserving the terminal expected selection and first failure.

`prepareGeometricCanvasClick` and `observeGeometricSelection` currently require
a connected painted contour and intended point target. They cannot be used
unchanged for contourCount0 or a far background probe.
Reuse compatible controls/event ownership patterns, but do not weaken the
completed contour selection helper's invariants or suppress its errors.
Keep this unsupported diagnostic path narrowly scoped.

## Retain measurements and actual input delivery

Persist partial/raw preparation observations as observed before assertions,
including scenario/dimension/shape/id/epoch, saved/runtime/history/UI settings,
work plane, native body/warning/requested/painted/anchor bounds, point/canvas
CTMs, viewBox/client bounds, viewport/scroll, Inspector/toolbar state, all
candidate points/projections/hit stacks and eligibility/rejection reasons.
The fresh failure must retain the actual coordinate and target, not only a
derived `nativeCanvasAtFarClick` flag or a later full-page screenshot.

Keep the exact body → far → warning sequence and one intended native mouse
click per action. Re-measure current geometry/CTM/hit immediately before each
input, including after body selection adds its ring and any UI changes.
Bind each requested point to that fresh measurement and retain before/after
authoritative state, native events and the actual final selection.

Extend the current diagnostic listener, which records only type/trust/client,
with owned bounded target/composed-path, pointer/button/order, document epoch,
owner/request/source and canvas identity observations.
Require trusted real pointerdown/pointerup/click at the adopted projected point
and delivery through the exact production canvas, with expected selection.
Keep body and warning selecting app-point; far must leave app-point unselected.

Record the actual SVG/body/warning picking mechanism. Literal body glyphs may
have pointer-events:none, so their native target can be canvas background while
production hit testing selects the owned point. Do not invent glyph targets or
require a painted-contour path for an intentionally missing contour.
The far action must show actual background delivery outside the owned visible
regions, not an unrelated document/UI event with matching coordinates.

Preserve exact raw source, point coordinates/style/layout, model/history/epoch,
camera/work plane and saved document throughout the diagnostic clicks.
Allow only their intended selection changes and explicitly owned UI preparation.
Keep ring radius bounded by visible body/warning geometry, never the hidden
1000-unit requested shape. Keep actual zero contour, zero painted bounds,
unsupported warning and unchanged diagram assertions.

Bound observation/artifact/listener/restoration/cleanup work, own late failures,
and retain primary action/assertion errors if secondary diagnostics fail.
Only accepted full raw evidence produces terminal passed cases/scenarios.

## Contracts, regressions and cumulative continuation

Extend the layout raw contract and 32D parent policy for actual candidate/
coordinate/input evidence. Preserve all six native cases, full supported anchor
matrix, source/anchor/minima, zero-contour/paint, visible body/warning/ring,
body/far/warning ordering, trusted input and unchanged state requirements.
Reject success flags alone, missing or unrelated targets, stale owner/epoch/
CTM/state, malformed bounds, off-canvas candidates and mismatched projections.

Add meaningful pure/integration/policy controls for the actual failure:
right candidate outside SVG but a left/below candidate valid; nontrivial CTMs/
preserveAspectRatio; all candidates invalid; overlay/viewport clipping; far
inside visible picking bounds/ring or outside requested shape; stale measurements
after preparation/body selection; event misdelivery or wrong epoch; and primary
failure through diagnostic/restoration/cleanup errors.
Synthetic controls are not native acceptance. Do not duplicate unrelated helper
test matrices or inflate equivalent fixture mutations.

Register new tests in the explicit test list and copy new imported helper
dependencies into isolated runner fixtures. Add no dependency.
Use strict TypeScript without `any`. Preserve 2D z=0, active 3D work planes and
the mathematical codimension convention.

Use the same cumulative pages and strict predecessor sequence. Retain the
complete geometric group with both actual download/PNG cases, then fresh layout
sizing, supported anchors and six unsupported diagnostic cases.
Complete remaining layout controls/persistence, lifecycle/picking/owner cycle,
imports, both pending transparent/white layout SVG/TikZ downloads and final
standalone export. Diagnose each later first failure from fresh raw evidence.

## Preserve Phase32D geometry and persistence

Keep saved envelope version2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution and per-axis em/ex context.
Preserve PGF solvers/anchors, body/baseline/depth inputs, unsupported-anchor
diagnostics, overflow-body picking, painted/anchor-clearance bounds, 2D/3D
projection and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all raw/reference files and tolerances. No geometry/reference regeneration is
justified by this harness candidate failure. The diamond outer-separation
exception still requires independent PGF review.
Preserve external source/exact text, typography/paragraph/TeX-program limitations,
free labels and inline path nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused unsupported-diagnostic geometry/
input, parent policy, diagnostics/ownership and runner regressions; preserve
completed native selection/toolbar/drag/visibility/capture checks.
Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused TypeScript/lint and changed-script syntax checks.
Report reproduced baseline debt accurately: current geometric caller has two
no-unsafe-finally errors and the verifier unused _role; the unchanged layers
suite has unused defaultCurveStyle and eleven inherited focused strict-TypeScript
diagnostics. These checks remain failed; application TypeScript/build passed.
Do not describe failed baseline checks as passes or expand into unrelated cleanup.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused/scoped evidence cannot establish strict 32D acceptance.
If the child hits `listen EPERM`, retain its startup failure and exact tree for
the parent without weakening sandbox/acceptance rules.
Do not describe the latest parent diagnostic assertion as startup failure.

Load updated callers/helpers/contracts/policy in a fresh parent process and
verify the preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Preserve the implementation/fix clean-tree guard. Do not reset, discard, stash,
commit or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import, complete
32C shapes/visibility/downloads and point-node-layout-anchors-combined.
Require terminal successes, valid raw artifacts, no page errors, native history/
JSON persistence, both TikZ modes, pending transparent/white downloads and
actual reopened standalone SVG/complete PNG acceptance.
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

Report the scoped measured diagnostic candidate/input correction, preserved
download/capture contracts, changed files, focused/full checks, fresh parent
evidence/identity, actual six-case/layout/download/standalone coverage,
review result and remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
