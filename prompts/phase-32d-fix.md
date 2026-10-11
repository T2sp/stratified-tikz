# Phase 32D Fix for pending combined-export selection preparation

## Objective and preserved implementation

Continue from the implemented Phase 32D checkout and completed Clear,
Inspector/toolbar selection, native drag/revision, visibility/camera,
canonical layer, measured diagnostic candidates, ordinary visible-body selection
and standalone SVG/PNG capture corrections.
Repair the next concrete parent failure: pending combined-export setup tries to
select layout-circle at its .23 contour point, but another point is in front.

The ordinary body correction now passes native verification, including all six
unsupported cases and negative-padding body overflow. Preserve it.
The intended-target assertion correctly rejects this sibling obstruction.
Fix only pending export fixture layout or its narrowly scoped selection preparation,
without weakening native selection or changing production rendering/geometry.

Preserve source/model/serialization semantics, all PGF references and tolerances,
completed native helpers, body target and export/capture contracts.
Do not repeat resolved fixes, remove the occluding sibling or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.
Keep strict cumulative verification, verification-before-review/commit and
the exact-tree post-review identity gate. Phase32 remains incomplete until
complete accepted verification and matching independent review.

## Latest evidence and checkout identity

Latest child handoff:
`/private/tmp/stz-32d-body-fix-20261011/HANDOFF.md`.
Its inventory, full diff, preservation hashes, reports and logs are retained
in the same directory. The newer browser-capable parent records are:

- Worker response:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-mR9DMM/response.json`.
- Verification report:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-DvEwwg/verification.json`.
- Browser log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-DvEwwg/05-check-free-labels/command.log`.
- Raw native evidence/failure artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-DvEwwg/05-check-free-labels/artifacts/`.

Branch is `phase/32d-margin-minsize-anchor`, HEAD
`cf6a9d34feb64b8ba512371e272a1b8ff32c8b7d`.
The actual pre-prompt-update tree matches both before/after parent identities
and the child handoff:

~~~text
ea197302a5b1be67d630132011233af0637c9ac39ab2a9c718b2f3690b7f25ce
~~~

Preserve the eleven modified tracked files: both Phase32 documents, `package.json`,
`src/rendering/SvgPointNode.tsx`, `src/rendering/svgPointNodeView.ts`,
`scripts/pointUnsupportedDiagnostic.mjs`,
`scripts/pointUnsupportedDiagnosticContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/pointUnsupportedDiagnostic.test.mjs`,
`tests/scripts/pointUnsupportedDiagnosticContract.test.mjs` and
`tests/scripts/pointUnsupportedDiagnosticFixture.mjs`.
Preserve the new untracked `tests/rendering/svgPointBodyInteraction.test.ts`.
Earlier candidate/helper/capture changes are tracked.
This prompt edit changes the fingerprint; capture the actual current tree,
rather than hard-coding a historical identity as acceptance.

| Retained run | Actual result |
| --- | --- |
| Visible-body child | 6,158/6,158 full tests passed without failures/skips. Build, diff, nine production-component body regressions and focused changed-source TypeScript/lint/syntax passed. Fresh strict verification stopped at `check:label-assets` with fresh-server `listen EPERM` before Chrome; both direct browser attempts also failed at startup. Reproduced baseline lint/type debt remains failed. No completion review/commit/push. |
| Latest browser-capable parent | 6,158/6,158 tests, build, diff and full `check:label-assets` passed. All geometric cases/downloads and layout sizing, anchors/unsupported diagnostics, controls/persistence, imports, async isolation and native interaction passed. First transparent pending export setup then failed before native selection input. |

DvEwwg completed 16 of 18 cumulative groups. The full geometric group passed,
including eleven shapes, eight contours, visibility and both actual transparent/
white geometric SVG download/reopening/PNG terminal scenarios.
Preserve their raw records, actual files and identity checks; historical evidence
cannot substitute for fresh acceptance of the next changed tree.

The following layout scenarios are now terminal passed:

- Sizing: 90 cases across fifteen shapes.
- Anchors/rotation: 305 supported cases and all six unsupported native cases,
  2D/3D × ellipse/circle/cylinder. Ordinary body → far → warning selects
  app-point → null → app-point with the required measured route and bounded ring.
- Native controls/persistence, six import/order/unit cases and eleven async
  isolation transitions.
- Four native interaction cases, 2D/3D × rectangle/circular sector, including
  drag/history/owner cycling/visibility/camera/reference checks.
  Both native negative-padding body-overflow cases and their Alt owner cycles pass.

The full layout group is still incomplete because neither pending layout download
scenario has passed. Transparent failed during setup; white and the final standalone
export group did not execute. No layout pending SVG/PNG/TikZ download artifacts
were produced. Page errors are empty.
Distinguish this sibling-overlap failure from startup restrictions and the resolved
body-route/far-candidate/visibility/layer/toolbar/drag/screenshot failures.

## Diagnose the actual pending sibling obstruction

The latest first failure is:

~~~text
AssertionError:
Current native click target is the intended SVG point or its selected drag handle

scripts/pointGeometricSelection.mjs:384
scripts/pointGeometricSelection.mjs:446
scripts/checkPointLayoutAnchors.mjs:154
scripts/checkPointLayoutAnchors.mjs:644
scripts/checkFreeLabels.mjs:483
~~~

Read `free-labels-evidence.json`, `point-layout-failure.json`,
`point-layout-app-failure.json`, `point-layout-app-lifecycle.json` and
`point-layout-selection-0493.json` through `point-layout-selection-0499.json`.
In particular, 0496 retains the fresh contour/hit measurement, 0497 retains
prepared input before its target assertion, and 0499 retains the final primary
failure and restoration observations. The latest failure screenshot is intentionally
omitted for pending scenarios; do not claim an image exists or add a failure image.
The owned App DOM snapshot is truncated at its bounded limit.
It does not contain complete measured sibling geometry.

The active scenario is `point-layout-pending-transparent-edit`, selection sequence39,
id `layout-circle`, owner epoch427, source
`captured transparent $\frac{anchor_{32D}}{1+\frac{x}{y}}$`.
The full source is held pending; its literal estimate produces circle radius
152.72695312500002 and contour arclength approximately959.22412.

Actual current measurements show:

- Native .23 local boundary approximately (19.0882263,151.529419).
  Contour screen CTM a=d=3.1,b=c=0,e=548.378363,f=256.575.
  Requested screen point (607.55188,726.31622) matches that native CTM.
- Native elementFromPoint is a rect owned by `layout-trapezium`.
  Hit-stack order begins trapezium rect → trapezium path →
  isosceles-triangle path → intended layout-circle circle.
  The desired circle is fourth, so an ordinary click cannot reach its owner.
- Point-node transform is `translate(162.7027027027027 36)`,
  body/contour placement is `translate(0 -4)`, and anchor is `base`.
  The canvas is connected; the requested point is inside its visible bounds.
- Inspector is closed and toolbar is expanded. The top target is neither toolbar,
  Inspector nor selected handle. Preparation performs one native Select action,
  no toolbar collapse; selection remains null. Secondary/observation/page errors
  are empty.

The rect is source-supported as the sibling's new preview body target; the raw
target descriptor itself records tag/point ownership rather than target bounds.
Do not invent measured trapezium dimensions/CTMs absent from these records.
Retain those actual sibling observations in the next run.

The failure occurs before the mouse input, Inspector reopening, export-background
selection, click-snapshot arming and download. No pending-export native selection
or export is accepted by this run.
The captured conversion is released by final cleanup after failure; that is not
a successful pending download.

## Repair only pending-export setup

The combined fixture currently assigns all fifteen shapes to a four-unit grid:

~~~js
position: { x: (index % 4) * 4, y: 13 - Math.floor(index / 4) * 4, z: 0 }
~~~

All points keep innerXSep3/innerYSep1, outerXSep5/outerYSep2, minimumWidth35/
minimumHeight25, base anchors except cylinder shape center.
The held circle's long literal body produces a much larger pending contour than
the grid spacing anticipates. Fresh projection and ordinary SVG stacking cause
a legitimate overlap, not a stale-owner or production picking defect.

`SvgDiagram` uses `compareSvgRenderItems`: layer/category/surface order/id/stable
index. Changing strata array order alone does not bring circle to the front.
Do not change ids, layers, production sort, pointer-events, sibling visibility
or the body target to bypass this real interception.
The current loaded 2D camera is fresh; prior native camera edits are not the
observed cause. Do not add pan/zoom/camera resets without actual evidence.

Prefer a small deterministic initial fixture-layout correction for these two
pending export scenarios. Declare coordinates before the normal JSON load,
with space for the pending and settled node footprints and combined siblings.
Retain all fifteen shapes, their ids/source/layout/parameters and existing list
order, including captured circle at index0, both free labels and path inline nodes.
Do not alter their mathematical styles or shorten the held source.
Do not relocate loaded model points in response to selection outcomes.

Validate the actual .23 contour point, fresh CTM, visible canvas/client/viewport
and native top intended-owner hit before one ordinary input. Retain the shared
geometric selection helper's .23 measurement/target/path assertions unchanged.
A fixture correction must work through this actual native route in both transparent
and white setup, not through expected-coordinate mocks or a guessed new grid.

If a dedicated owned-body preparation route is the smaller justified solution,
it may be used only for these pending-export setup callers. This setup selects
the point for the subsequent Inspector edits; its separate contour-interaction
acceptance cases already pass.
Such a route must measure the existing current preview body target, its finite
bounds/CTM/owner/request/source and an unobstructed visible native point, then
perform exactly one ordinary trusted click and prove actual selected owner.
Keep accepted contour/.23/body-overflow/drag/owner-cycle helper behavior unchanged.
Do not disguise a body click as .23 contour evidence or repurpose the negative-
padding overflow contract for a body location inside its contour.
Explain the route explicitly and validate it against all sibling targets.

For either approach, never accept an intended element buried in elementsFromPoint,
click another sibling and pretend it selected circle, use Alt/force/programmatic
selection, disable blockers, synthesize events or search by trial clicks.
Do not release or settle the captured source before the required pending capture,
omit native selection, or skip these download scenarios.

Keep scoped native Select/Inspector/toolbar preparation and restoration where
actual UI obstruction requires them. Freshly measure after owned scroll/toggles;
preserve source, position/style/layout, saved/runtime/history/document revision,
requests and view settings except the already intended scenario changes.
Do not add repeat input or mutate projection to get an eligible hit.

## Retain pending preparation and immutable-download evidence

Persist raw pending-export setup observations before assertions and image work:

- Actual fixture positions/order, source/layout/parameters, document/point/request
  identities and current pending/ready states.
- Captured circle body/contour/target bounds and screen matrices, .23 local/
  screen coordinates when used, canvas viewBox/client/viewport/scroll/clip frames.
- Actual relevant sibling body targets and painted contours, their connected
  owner/request/source/state, native bounds and CTMs, with bounded hit stacks
  and eligibility/rejection reasons. Do not use a later truncated DOM dump
  or caller-provided `intended:true` as the only proof.
- Before/immediate-input/after authoritative state, actual native target/composed
  path, trusted pointer/button/order/no modifiers and actual selected owner.
  Keep owned UI restoration, capture release, listener/hold cleanup and primary
  failure through secondary diagnostics.
- Held conversion and current pending source/request at preparation and export
  click. Evidence must prove that preparation did not release or settle the
  captured request.

Require exact current intended-owner input before opening its Inspector.
Retain bounded observations on an unavailable or obstructed target and fail with
no click. Only accepted complete raw records can become terminal passed.

Preserve the existing immutable export sequence:

1. Hold the exact captured source before loading the combined fixture and wait
   for its actual pending request to start.
2. Select its actual owner natively while held, configure the real background
   control and arm click-time snapshots for all fifteen points.
3. Click the real SVG export control while the circle remains pending.
4. For transparent, edit source/anchor/minimum and view through native controls
   after that export click. For white, load the replacement document after click.
   Preserve their actual before/after evidence and old-source snapshot identity.
5. Release the held conversion at the intended post-click boundary, save the
   actual download and validate its captured source/layout/placement.
6. Reload the original declared fixture and settle only for the independent
   expected placement/contour/TikZ comparison. Reopen the actual file outside App,
   save raw reopening evidence, validate it and capture the complete root.

Keep captured circle index0/order assumptions, pending snapshot status, all
fifteen shapes, each ready expected entry with actual MathJax glyphs, both TikZ
modes, path inline/free-label content and no post-click edit/replacement leakage.
Keep pending-versus-settled contour inequality and captured immutable placement.
Changing initial fixture positions must update their exact expectations consistently,
not waive position/layout comparisons.

## Contracts, regressions and cumulative continuation

Retain the current intended native hit rejection: the first hit/stack element must
be the expected owner, not merely include it underneath another point.
Add focused controls for this actual pending overlap/preparation failure:
the recorded trapezium-before-circle stack must fail before any input, a fresh
unobstructed current target must route one ordinary input to circle, and stale
owner/request/CTM, UI/sibling interception or wrong selection must fail.

If extracting a fixture builder, keep it small and deterministic; verify complete
ids/order/shapes/combined content and unchanged export semantics.
If adding a scoped body preparation, cover current target bounds/path, pending
ownership, no modifiers, unchanged authoritative state and failure cleanup.
Synthetic geometry/orchestration controls are not native acceptance.
Do not add duplicate matrices or inflate equivalent mutations.

Extend raw layout/parent policy only as needed to require the actual preparation,
held request, selected owner and click-time continuation for both backgrounds.
Retain complete artifact/source/geometry/file checks and failure-before-review/
commit policy. Reject success flags paired with wrong/missing/stale raw input.
Register new tests and copy imported helper dependencies into isolated runner
fixtures. Add no dependency without explaining necessity.
Use strict TypeScript without `any`; preserve 2D z=0, active 3D work planes
and the mathematical codimension convention.

Use the same cumulative pages and strict predecessor sequence. Preserve freshly
passed layout sizing, all supported and six unsupported anchors, native controls/
persistence/imports/async/interaction/overflow/owner cycles.
Complete both pending transparent/white layout SVG/TikZ downloads, their actual
reopening/PNG acceptance, then the final standalone-export group.
Diagnose any subsequent first failure from fresh raw evidence.

## Preserve completed native, body, visibility and capture work

Keep Clear's detached imported paint/shape/layout behavior, exact persistence,
raw source, history, policy/UI regressions and JSON reload.

Keep scoped native Inspector/toolbar preparation, real Select before conditional
collapse, state invariance, fresh fixed .23 contour/CTM/hit, trusted owner/path,
owned restoration and first-error handling. Keep the precise SVGPoint binary32
allowance without changing PGF tolerances.

Keep selected-point-only drag/layout movement, trusted handle/capture/release,
one history commit, exact saved/runtime Undo/Redo, native field Inspector reopening
and owner cycles. Keep the same valid document revision through drag/Undo/Redo,
actual JSON-load +1 and stale reused-ID isolation; preserve revision/cache rules.

Keep canonical layers, exact-caption/associated-select visibility resolution,
dim/hide/dim settings/raw provenance, honest trusted=false selectOption records,
native theta90/phi0, intended UI-angle-only changes and actual owner/occluder/
opacity validation. Preserve all conditional preparation/restoration helpers.

Keep the preview-only current `data-point-body-target` rect, its body bounds/
placement/request identity, nonempty/positive finite conditions, inherited
lock/filter nonselectability and detached/export exclusion.
Keep ordinary unsupported body/warning hits, bounded rings and negative-padding
overflow, existing contour/Alt-cycle behavior and production-backed regressions.

Keep four fixed diagnostic candidates and first eligible adoption, actual bounds/
CTMs, requested-shape inclusion, six-unit visible-region clearance, bounded-ring
exclusion, viewport/clipping and exact background hit/stack.
Preserve body → far → warning, current body/point/warning path, trusted no-modifier
input, actual owner/selection, capture/release and authoritative state invariance
in all six cases. Do not accept synthetic background-body success.

Keep both export callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling/one native image/no retry, complete-root coverage, at most one
viewport expansion, stable coordinates and exact SVG/PNG file identity.
Preserve pre-image reopening records, owned page/listener cleanup,
no extra failure screenshot and primary-error handling.

Keep `standaloneSvgCaptureContract.mjs` and parent actual PNG validation:
CRC/chunks/inflated scanlines/dimensions/byte length and raw capture state.
Reject missing/pending/failed/unrelated/cropped/changed images or mock headers.
Preserve independent source/contour/cylinder paint/placement/background checks,
explicit artifact lists, registered capture tests and runner dependency copying.

## Preserve Phase32D geometry and persistence

Keep saved envelope version2, additive layout, legacy Size/2 precedence,
ordered shorthand/axis resolution and per-axis em/ex context.
Preserve PGF solvers/anchors, body/baseline/depth inputs, unsupported diagnostics,
painted/anchor-clearance/body bounds, 2D/3D projection and immutable export placement.

Retain the independent 172-box / 4,925-anchor / 11-failure reference inventory,
all raw/reference files and tolerances. No production solver/render ordering/
reference regeneration is justified by this pending-fixture obstruction.
The diamond outer-separation exception still requires independent PGF review.
Preserve external source/exact text, typography/paragraph/TeX-program limitations,
free labels and inline path nodes.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused pending-export preparation,
native selection/body, layout/capture, parent-policy/ownership and runner controls.
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
Do not describe the latest parent's sibling-hit assertion as startup failure.

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
JSON persistence, both TikZ modes, both pending layout downloads and actual
reopened standalone SVG/complete PNG acceptance.
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

Report the pending fixture/preparation correction, preserved body/native/capture
contracts, changed files, focused/full checks, fresh parent evidence/identity,
actual pending transparent/white/layout/final standalone coverage, review result
and any remaining concrete first failure.
Leave commit/push to the parent workflow after verification and review pass.
Do not claim completion from child-only or historical results.
