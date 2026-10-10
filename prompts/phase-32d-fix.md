# Phase 32D Fix for ordinary unsupported-node body selection

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag/revision, visibility/camera,
canonical layer, standalone SVG capture and measured diagnostic-candidate fixes.
Repair the next concrete parent failure: a normal Select click inside the visible
unsupported-node body reaches canvas background and leaves selection null.

The fixed far-candidate resolver now works in the native parent. Preserve it.
Do not move the body click to the warning, change it to Alt cycling, accept null,
or weaken the six-case body → far → warning interaction contract.
Inspect and repair the actual ordinary visible-body selection route, permitting
only the necessary small production point-preview interaction change.

Preserve model/serialization semantics, layout/geometry, PGF references, completed
native helpers, export/capture contracts and retained real download/PNG artifacts.
Do not repeat resolved fixes or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.
Keep strict cumulative verification, verification-before-review/commit and
the exact-tree post-review identity gate. Phase32 remains incomplete until
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

Latest child handoff:
`/private/tmp/stz-32d-diagnostic-fix-20261010/HANDOFF.md`.
Its exact inventory, diffs, preservation hashes, reports and logs are retained
in the same directory. The newer browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-iXeDvK/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-pOKk4r/verification.json`.
- Browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-pOKk4r/05-check-free-labels/command.log`.
- Raw native evidence/failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-pOKk4r/05-check-free-labels/artifacts/`.

Branch is `phase/32d-margin-minsize-anchor`, HEAD
`d37c63f4e98c671f3a5f1ab359995ec04f0c2924`.
The actual pre-prompt-update tree matches both before/after parent identities
and the child handoff:

~~~text
af35108b8fd270098650385258e7fa7a410fac9ef179dbb87c00c74b93d69aee
~~~

Preserve the seven modified tracked files: both Phase32 documents, `package.json`,
`scripts/checkPointLayoutAnchors.mjs`,
`scripts/pointLayoutAnchorsContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs`, and
`tests/scripts/runPhaseRunner.test.mjs`.
Preserve the five new untracked files:
`scripts/pointUnsupportedDiagnostic.mjs`,
`scripts/pointUnsupportedDiagnosticContract.mjs`,
`tests/scripts/pointUnsupportedDiagnostic.test.mjs`,
`tests/scripts/pointUnsupportedDiagnosticContract.test.mjs`, and
`tests/scripts/pointUnsupportedDiagnosticFixture.mjs`.
Earlier corrections are tracked. This prompt edit changes the identity;
capture the actual current tree rather than hard-coding a historical fingerprint.

| Retained run | Actual result |
| --- | --- |
| Diagnostic-candidate child | 6,144/6,144 full tests and 1,356 focused checks passed without failures/skips. Build, diff and changed-script lint/syntax passed. Fresh strict verification stopped at `check:label-assets` with fresh-server `listen EPERM` before Chrome; direct browser startup also failed. Reproduced baseline lint/type debt remains failed. No completion review/commit/push. |
| Latest browser-capable parent | 6,144/6,144 tests, build, diff and full `check:label-assets` passed. Paint/import, eleven geometric shapes, eight contours, visibility, and both transparent/white geometric SVG download/reopening/PNG scenarios passed. Layout sizing passed; first unsupported native body click then failed. |

pOKk4r completed 16 of 18 cumulative groups. The complete geometric group
passed, including both actual download/PNG scenarios. Preserve their raw
reopening/capture records, terminal scenarios and actual file identities;
historical acceptance cannot substitute for the next changed tree's fresh run.

`point-layout-per-shape-spacing-minima` passed 90 cases across fifteen shapes.
The anchor-support/rotation scenario is not terminal passed. Its first unsupported
case, 2D ellipse, failed after one body input. Far and warning input, the other
five unsupported cases, remaining layout scenarios/downloads and final
standalone-export group did not execute. Page errors are empty.
Distinguish this native interaction failure from child startup restrictions
and the resolved off-canvas/screenshot/visibility/layer/toolbar/drag failures.

## Diagnose the actual ordinary body-selection route

The latest first failure is:

~~~text
AssertionError: body selects the owned point
actual: null
expected: 'app-point'

scripts/pointUnsupportedDiagnostic.mjs:300
scripts/checkPointLayoutAnchors.mjs:378
scripts/checkFreeLabels.mjs:483
~~~

Read `free-labels-evidence.json`, `point-layout-failure.json`,
`point-layout-app-failure.json`, `point-layout-app-lifecycle.json`,
`point-layout-app-failure.png` and `point-layout-selection-0001.json` through
`point-layout-selection-0009.json`. Records 0007–0009 retain immediate
pre-input, actual after-input and finished observations before/after rejection.

The unsupported loop remains 2D/3D × ellipse/circle/cylinder, raw source
`WWWW diagnostic`, anchor `not a PGF anchor`, minimumWidth/Height1000.
The first case is 2D ellipse, owner epoch397.

The native evidence shows:

- The old right candidate is outside the viewBox: root approximately
  (552.6831, 35.9720). The deterministic resolver adopts the eligible left
  candidate, root approximately (247.2939, 34.7946); below is also eligible.
  Preparation succeeds. Preserve fixed order, measured reasons and adopted point.
- Body click local approximately (-43.04325, .62903), root
  (360.95675, 36.62903), screen (1162.96592, 399.92500).
  It is inside both actual native body bounds
  x[-48.70605,48.68307], y[-6.64516,6.58915] and model body bounds x±48.70605,y±7.
  It is a measured first-character extent point, not a far/background probe.
- The actual native hit is the unobstructed background rect in the exact
  connected production canvas. No Inspector/toolbar/handle overlay intercepts it.
  Select is pressed; Inspector is closed; toolbar is expanded.
  Preparation/restoration UI-action arrays are empty.
- One trusted native pointerdown reaches the background rect, pointerup reaches
  the captured SVG root, and click reaches the SVG root after release.
  Pointer identity and owner/request/epoch are current, capture is false afterward,
  and click's integer client coordinates differ from requested values by less than1.
  This capture continuation occurs in this 2D case; do not label it 3D-only.
- Selection is null before and after; no selection ring appears.
  Model/saved document/history/revision/camera/work plane/UI settings/request
  identity remain unchanged. Raw secondary errors are empty.

These observations rule out the previous off-canvas condition and provide no
evidence of drawer interception, stale CTM, lost native input or failed cleanup.
Do not fix them by more candidate searching, browser resizing, glyph trial
clicks, pointer-capture suppression or extra selection attempts.

Trace the current production route:

1. `src/rendering/SvgPointNode.tsx` supplies `boundsTarget:false`.
2. `src/rendering/svgLabelView.ts` gives the glyph group `pointerEvents:'none'`;
   no body bounds target is emitted for this capture.
3. `src/rendering/SvgDiagram.tsx` selects a point on clicks routed through its
   owned point group. This body input instead targets background/root.
4. `collectSvgPreviewSelectionCandidates`, including
   `src/rendering/svgHitTesting.ts`'s `collectPointCandidate` body/warning union,
   is called by the Alt `onClickCapture` branch. Ordinary background `onClick`
   clears selection when `onCanvasClick` is absent.

Thus a correct pure body candidate does not prove normal native Select delivery.
The current ordinary body-selection expectation has no reachable owner route.
The implementation documentation claims the retained visible body/warning remain
pickable while the unsupported requested contour contributes no hits.
Repair that ordinary interaction rather than changing its test to Alt.

## Repair only the visible-body native interaction

Allow a small production preview change directly necessary for this issue.
Prefer an owned visible-body hit target, or an equally narrow source-justified
ordinary point-body route, derived from the same current layout/owner/request
used for rendering. Explain the chosen route and its actual native delivery.

Require all of the following:

1. One normal Select body click selects the current point without modifiers.
   It must use the fresh measured visible body location. The warning remains a
   separate ordinary input and the adopted far candidate remains a true miss.
2. Any body hit region uses only current finite visible body bounds and its actual
   placement/CTM. Never use the suppressed contour, requested minima1000,
   shape bounds, anchor-clearance bounds, or selection ring as a body hit target.
   Preserve the existing pure collector's six-unit rules and reference tolerances.
3. Keep normal layering, overlap ownership, layer filters, hidden/locked point
   nonselectability, pointer modes and current document/request/font ownership.
   Empty bodies must not create a broad invisible target. Pending/fallback/success
   and reused-ID/load/undo states must not retain obsolete body targets.
4. Keep existing point contour/warning selection, overflow-body selection,
   Alt owner cycling, background pan/camera capture, work-plane cursor creation,
   selected-handle dragging and coordinate-reference behavior.
   Do not invoke a broad all-strata collector for every ordinary canvas click
   or change unrelated background/curve/sheet/free-label selection semantics.
5. Make interaction-only hit elements preview-only or explicitly export-excluded.
   Detached SVG output must retain exactly the visual node/source/paint/placement.
   Do not add a painted/interactive1000-unit contour or change TikZ/export geometry.
   Avoid changing global free-label glyph pointer behavior to fix a point owner.
6. Keep a bounded visible selection ring after body/warning selection and remove
   it after the far miss. Ring radius must use visible body/warning geometry,
   never the hidden requested shape.

Do not use Alt, Shift or another modifier to route this body action through
cycling; do not redirect its coordinate to warning/contour/center, force clicks,
synthesize events, programmatically set selection, relocate the model or change
camera/pan/zoom/work plane/source/minima/anchor to make the test pass.
Do not accept body selection null or classify the unsupported cases as deferred.

The completed painted-contour helper requires a connected contour and point hit.
It must remain unchanged for its accepted scenarios. Do not weaken it to handle
contourCount0 or use it unchanged for a far background probe.
Keep unsupported-specific orchestration and production interaction changes small.

## Preserve measured candidates, raw input and contracts

Retain `pointUnsupportedDiagnostic.mjs`'s bounded conditional native UI preparation:
real Select access, scroll only when needed, close only an obstructing owned
Inspector, conditional toolbar collapse, fresh measurement, owned restoration,
state invariance, primary-error precedence and observer cleanup.

Retain four fixed-order candidates, current bounds/CTMs, requested-shape inclusion,
greater-than-six clearance from visible body/warning, bounded-ring exclusion,
viewBox/client/viewport/clip/preserveAspectRatio checks, and actual exact-canvas
background hit/stack. Preserve all rejection reasons and first eligible adoption.
If no candidate is eligible, save observations and fail without input.

Keep exactly one ordinary native click per body → far → warning action.
Measure again after preparation and each selection change, and immediately
before input; bind geometry, hit, owner/request/epoch and authoritative state.
The far point is fixed before body selection, with no selection-outcome search.

Extend raw observations as needed to identify any real body hit element:
connected identity, actual finite target bounds and transforms, owner point group,
current layout/request/source, native hit stack and composed path.
Read these from actual DOM/state, not caller-provided success/owner flags.
Save partial preparation/pre-input/after-input records before assertions and image
work, including actual null selection and absent ring on failure.

Require trusted native pointerdown/pointerup/click, current pointer identity,
button/order/no modifiers, requested client coordinate tolerance and delivery
through the exact production canvas. When a direct body target is used, prove
actual delivery through the current owned body/point route.
Retain actual background capture continuation only where observed and justified
by production pointerdown/capture/release; do not relabel captured root as a glyph
or owner target. Far must be genuine native background delivery outside all
visible owned regions. Warning must select the actual expected owner.

Keep actual after-input state/geometry, capture release, unchanged raw source,
position/style/layout, saved document/history/document revision, camera/work plane,
UI settings and request identities. Only intended selection and owned UI toggles
may change. No missing/failed/secondary-error evidence can become terminal passed.

Strengthen layout raw contract and parent policy for the corrected route while
preserving all six cases, source/anchor/minima, zero contours/painted bounds,
visible body/warning/ring, exact action ordering and state checks.
Do not retain a synthetic background body success assumption as evidence that
normal production clicking works.

## Meaningful regressions and cumulative continuation

The current synthetic mouse fixture unconditionally assigns app-point after
body/warning input. Its pure contract also accepts a background body target
paired with a declared successful selection. This masks the real production route.
Keep orchestration mocks clearly synthetic and add production-backed regression
coverage that fails on the current disconnected ordinary-body route.
Pure collector tests alone are insufficient.

Cover the actual unsupported literal-body normal click, both ambient dimensions,
current owner/path and bounded body target, unchanged model/history, ring creation,
far clearing and warning reselection. Validate wrong-owner/stale-request/old-document
targets, absent/oversized targets, background body input without a valid production
route, modifier substitution and missing/failed actual selection.
Exercise relevant layer/hidden/locked/empty-body conditions and settled SVG exclusion.
Preserve negative-padding body-overflow and existing contour/Alt-cycle behavior.
Use a small set of meaningful controls, without duplicating unrelated matrices
or inflating equivalent fixture mutations.

Retain deterministic off-canvas-right/eligible-left, nontrivial CTM, all-invalid,
overlay/clipping, ring/clearance, stale measurement and event-misdelivery controls.
Keep first-error behavior through diagnostics/restoration/cleanup.
Register new tests in the explicit test list and copy imported dependencies into
isolated runner fixtures. Add no dependency without explaining necessity.
Use strict TypeScript without `any`. Preserve 2D z=0, active 3D work planes
and the mathematical codimension convention.

Use the same cumulative pages and strict predecessor sequence. Retain the
complete geometric group with both actual download/PNG cases, then fresh layout
sizing, supported anchors and all six unsupported diagnostic cases.
Complete remaining layout controls/persistence, lifecycle/picking/owner cycle,
imports, pending transparent/white layout SVG/TikZ downloads and final standalone
export. Diagnose each later first failure from fresh raw evidence.

## Preserve completed native, visibility and capture work

Keep Clear's detached imported paint/shape/layout behavior, exact persistence,
raw source, history, policy/UI regressions and JSON reload.

Keep scoped native Inspector/toolbar preparation, real Select before conditional
collapse, exact UI-action state invariance, fresh fixed .23 contour/current CTM/
hit stack, trusted owner/path delivery, owned restoration and first-error handling.
Keep the precise SVGPoint binary32 allowance without changing PGF tolerances.

Keep selected-point-only drag/layout movement, trusted handle/capture/release,
one history commit, exact saved/runtime Undo/Redo, fresh owner cycling and native
Inspector reopening for fields. Keep the same valid document revision through
preparation/drag/Undo/Redo. Native JSON/example replacement still advances ownership,
including exact load +1 and reused-ID isolation. Do not change revision/cache rules.

Keep exact-caption/direct-label/associated-select visibility resolution,
native scrolling/preconditions, bounded dim/hide/dim, settings/raw event provenance,
honest trusted=false selectOption records, native theta90/phi0 preparation and
intended UI-angle-only changes. Keep canonical layer defaults, unique metadata,
locked=true and explicit hidden visible=false, saved/runtime/history agreement,
actual owner/occluder/opacity observations and faithful fixtures.

Keep both export callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling/one native image/no retry, complete-root coverage, at most one
viewport expansion, stable coordinates and exact SVG/PNG file identity.
Preserve pre-image reopening records, owned page/listener cleanup,
no extra failure screenshot and primary-error handling.

Keep `standaloneSvgCaptureContract.mjs` and parent validation of actual PNG
CRC/chunks/inflated scanlines/dimensions/byte length and raw capture state.
Reject missing/pending/failed/unrelated/cropped/changed images or mock headers.
Preserve independent source/contour/cylinder paint/placement/background checks,
explicit artifact lists, registered capture tests and runner dependency copying.

## Preserve Phase32D geometry and persistence

Keep saved envelope version2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution and per-axis em/ex context.
Preserve PGF solvers/anchors, body/baseline/depth inputs, unsupported-anchor
diagnostics, overflow-body picking, painted/anchor-clearance bounds, 2D/3D
projection and immutable click-time export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all raw/reference files and tolerances. No geometry/reference regeneration is
justified by this ordinary native routing failure. The diamond outer-separation
exception still requires independent PGF review.
Preserve external source/exact text, typography/paragraph/TeX-program limitations,
free labels and inline path nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused production body-interaction,
unsupported-diagnostic, parent-policy, ownership/diagnostics and runner regressions;
preserve native selection/toolbar/drag/visibility/capture checks.
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
Do not describe failed baseline checks as passes or expand into unrelated cleanup.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused/scoped evidence cannot establish strict 32D acceptance.
If the child hits `listen EPERM`, retain its startup failure and exact tree for
the parent without weakening sandbox/acceptance rules.
Do not describe the latest parent's body-selection assertion as startup failure.

Load updated production/callers/helpers/contracts/policy in a fresh parent process
and verify the preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Preserve the implementation/fix clean-tree guard. Do not reset, discard, stash,
commit or push unfinished work to bypass it.
Require all twelve 31F groups, three 32A groups, full 32B paint/import, complete
32C shapes/visibility/downloads and point-node-layout-anchors-combined.
Require terminal successes, valid raw artifacts, no page errors, native history/
JSON persistence, both TikZ modes, pending transparent/white layout downloads
and actual reopened standalone SVG/complete PNG acceptance.
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

Report the ordinary visible-body routing correction, preserved measured candidates
and download/capture contracts, changed files, focused/full checks, fresh parent
evidence/identity, actual six-case/layout/download/standalone coverage,
review result and remaining concrete failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
