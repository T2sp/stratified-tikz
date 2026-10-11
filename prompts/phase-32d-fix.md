# Phase 32D Fix for authenticated zero-axis outside input

## Objective and scope

Continue from the implemented signed polygonal fitting/clearance and faithful
zero-axis ellipse traversal. The newest exact-tree parent run stops before its
first zero-axis outside click because the harness requires the hit target itself
to be the SVG root. Production has an explicitly marked SVG background rect.

Correct this scoped observation/contract/fixture mismatch. Authenticate the
actual current root or production background in fresh hit-stack and trusted
event evidence, then complete the mandatory 2D/3D zero-axis sequence, live paint,
polygonal placement and downloaded/reopened SVG/PNG acceptance.
Retain all implemented geometry, references, predecessors and pending contracts.

Limit changes to the evidenced native observation, zero-axis assertions,
faithful fixtures/regressions, necessary isolated runner copies and Phase32
status documentation. Do not change production geometry, paths, picking,
minimum fitting, camera, authored units, saved version2 or reference expectations
to pass this harness condition.
Any later production change needs separately retained fresh independent evidence.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the exact source and raw failure first.
Maintain cumulative strict verification, verification-before-review/commit and
the post-review matching-tree guard. Phase32 remains incomplete.

## Latest handoff, parent failure and identity

Implemented polygonal/zero-axis handoff:
`/private/tmp/stz-32d-polygon-zero-fix-20261011/HANDOFF.json`.
Child cumulative report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-dNz3ov/verification.json`.

Newest parent verifier:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-nbIe6k/response.json`.
Strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-Ab9guh/verification.json`.
Browser evidence:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-Ab9guh/05-check-free-labels/artifacts/free-labels-evidence.json`,
and its sibling artifacts, especially `point-layout-failure.json`,
`point-layout-app-failure.json` and the retained complete failure DOM.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `be2aabe55e578d036672960f3ba741af4008564f`.
Pre-prompt tree matches the parent report's before/after checkout:

~~~text
6a572c7c45328aa82733a077fdab46118c3c35ad7c244edc7b1df8fb46fcde30
~~~

Tracked-diff SHA256:
`e2aabcb391f41fb56b37dcfc8d8d3d0833083d76b836a75381ee0dbf20b2103e`.
Preserve fourteen modified tracked files: `.gitignore`; both Phase32 documents;
`package.json`; `scripts/automation/phase-verification.mjs`;
`scripts/checkPointLayoutAnchors.mjs`; `scripts/pointLayoutAnchorsContract.mjs`;
`src/geometry/pointNodeShapes/README.md`, `anchors.ts`, `contours.ts`,
`pgfMath.ts`, `solve.ts`, `types.ts`;
`tests/scripts/phase32dVerification.test.mjs`.
Preserve all494 untracked files:490 additive reference/evidence files under
`tests/fixtures/point-node-anchors/signed-polygonal/` and `zero-axis/`, plus
the four registered `pointNodeDegeneratePaths`, `pointNodePolygonalSignedReferences`,
`svgPointNodeDegeneratePaths` and `svgPointNodePolygonalSigned` test files.
Use the handoff's exact inventory/hashes. Keep prior tracked references too.
The prompt changes identity: capture actual current tracked/untracked bytes
rather than treating this historical fingerprint as future acceptance.

| Retained evidence | Actual result |
| --- | --- |
| Latest implementation child | 6,655/6,655 registered tests passed, zero failures/skips; build/diff and focused TypeScript/lint/syntax passed. Four inherited lint errors remain. Strict/direct browser attempts stopped at localhost EPERM before Chrome. |
| Ab9guh parent | Tests/build/diff/label-assets passed; free-labels failed in combined32D layout. Sixteen cumulative groups completed; combined layout is incomplete and final standalone is unexecuted. PageErrors is empty. |
| Current layout progress | First six named32D scenarios passed. Six2D signed polygonal selected-anchor observations were retained, then2D zero-axis outside-clear preparation failed. The new scenario, its3D cases/downloads, both pending scenarios and final standalone have no completed fresh acceptance. |
| Completion | No new independent completion review, commit or push. The prior needs_changes findings led to the implemented geometry fixes; successful synthetic checks do not establish final review or native completion. |

Earlier HMy8AM acceptance/review and historical geometry probes remain evidence
history only. They cannot replace fresh acceptance of this geometry tree.
Distinguish child startup EPERM from the parent's actual pre-input assertion.
Do not report the parent as blocked before Chrome.

## Exact observed failure

Read diagnostic
`point-layout-signed-polygonal-zero-axis-zero-axis-outside-clear-before-native-input`
and its `...-zero-axis-finished` record in `free-labels-evidence.json`.

The first action is `outside-clear`:
local(12,20) projects through the current connected contour screenCTM
(a=d3.1,b=c0,e1296.4,f268.975) to
screen(1333.6000000000001,330.97499999999997).
Current owner is `["point-node",437,"zero-overlap"]`, source is empty,
layout ready, contour length135.76449584960938, Inspector closed and
owned toolbar collapsed.

Fresh `elementFromPoint` is an SVG rect with `canvas:true`,
`canvasRoot:false`, `pointId:null` and drawer/handle/toolbar/history/quickStyle false.
The first hit-stack element is that rect; the next is the actual
`svg.svg-diagram` root with `canvasRoot:true`.
The contract at `scripts/pointLayoutAnchorsContract.mjs:626` requires
`target.canvasRoot === true`, producing:

~~~text
Outside input reaches the actual canvas beyond all current point contours
false !== true
~~~

`zeroAxisInput` at `scripts/checkPointLayoutAnchors.mjs:353` calls that assertion
after persisting the before-input observation and before `page.mouse.click`.
There is no first-action stateAfter/after/event evidence.
Ordinary-axis, Alt-start/next and outside-final did not execute.
This record establishes a harness root-target assumption, not a production
outside-selection or zero-axis paint failure.

`src/rendering/SvgDiagram.tsx:915` emits
`rect[data-svg-background="true"]`, and `isSvgBackgroundTarget` recognizes
the marker on an SVG element. Root click handling accepts bubbled background
input. The complete DOM/source/stack support the background interpretation,
but the retained target descriptor does not record the marker.
Do not retrofit `svgBackground:true` into historical evidence or claim its
exact attribute was already authenticated by the raw target record.
Observe it freshly in the next run.

## Scoped background observation and contract fix

Inspect `observeGeometricSelection` and the event descriptors in
`scripts/pointGeometricSelection.mjs`, the owned zero-axis observer in
`scripts/checkPointLayoutAnchors.mjs`, `assertFreshZeroAxisAction` and
`assertZeroAxisNativeCase` in `scripts/pointLayoutAnchorsContract.mjs`.
Use a small explicit predicate with raw observations consistent across the
before-hit stack, after observations, native events and parent validation.

For the two outside actions accept the actual current canvas root, or its
unique connected direct-child background rect with exact
`data-svg-background="true"`. Freshly retain the background attribute/predicate
and current-canvas relationship; authenticate that observed identity rather than
accepting any rect/SVG descendant merely because it sits under the canvas.
Require SVG/canvas membership, no point owner, connected current root and
matching hit-stack/composed-path root.
Reject stale/wrong-canvas, unmarked or wrong-marker children, point contours,
drag handles, overlays, toolbar/history/quick-style/drawer targets.
An authenticated root needs no background marker; retain its actual null/false
marker observation. Exact marker=true is mandatory for the rect branch only.
Retain the selected point's source/request/bodyRequest/owner/revision,
model/camera, finite invertible current contour/point/canvas CTMs and measured
click projection. Keep hit-stack head equal to the observed target.

Keep outside local(12,20), ordinary/Alt local(0,20), the unchanged stroke width
and greater-than-six-unit contour clearance. Prove the current coincident
point contours are still the intended fixture; a background DOM target alone
does not prove geometric distance beyond production picking tolerance.
Do not move the click arbitrarily, seek a root-only location, enlarge tolerance,
disable the background rect or bypass the real native gesture.
If fresh geometry/obstruction invalidates a coordinate, preserve the observation
and fail explicitly rather than retrying until selection looks correct.

Require one trusted pointerdown→pointerup→click for each action, actual current
canvas path, correct button/buttons/pointerId/Alt and precise native coordinate
propagation. Pointerdown must reach the freshly observed target. Validate outside
event targets against the authenticated background/root predicate too; do not
leave events as an arbitrary non-point canvas-child check.
Keep real browser capture/retargeting observations rather than fabricating events.

Preserve the five-action order:
`outside-clear` → `ordinary-axis` → `alt-start` → `alt-next` → `outside-final`.
Required selection IDs remain
`null` → `zero-overlap` → `zero-overlap` → `app-point` → `null`.
Require real model/history/revision/uiSettings invariance, continuity between
actions and the same current source/request/owner at each boundary.
The inside hit must remain the actual visible path owned by `zero-overlap`.
No DEV selection mutation, forced/DOM click, larger proximity budget,
synthetic acceptance flag or skip may substitute for native selection.

Keep bounded evidence persistence before every validation/input and after
input before assertions/image work, owned Inspector/toolbar preparation and
restoration, primary error precedence, Alt/listener registry cleanup and
bounded secondary diagnostics. Failure cleanup must remain observable.
Do not turn a pre-input record into a success or erase missing after evidence.

## Faithful regressions and required acceptance

`tests/scripts/phase32dVerification.test.mjs:184–204` currently synthesizes
outside targets as root `svg` with `canvasRoot:true`. Add a faithful marked
background-rect success fixture through both fresh-action and complete parent
raw-evidence validation; retain genuine root success as a separate case.
Make fixture events/hit stacks/current canvas/marker observations agree,
and preserve authentic target differences between input/capture events.

Add focused failures for missing/false/wrong marker on the background-rect
branch, arbitrary SVG child,
wrong canvas/root/path, point/handle/overlay ownership, stale owner/request/
revision/CTM, mismatched measured click, dropped/untrusted/wrong events,
wrong selection/cycle order and changed model/history/UI.
An unchanged old root-only assertion must reject the faithful rect fixture;
an overbroad canvas-descendant predicate must fail the negative controls.
Use compact meaningful cases, not a redundant parameter cross product.

Update schema/artifact/raw-policy assertions and isolated runner dependencies
only as needed for the added observations. Keep all prior fixtures, negative
controls, required group/scenario counts and failure evidence.
Do not make raw marker/current-canvas observations optional in new outside
records; the rect branch requires the exact true marker, while authenticated
root records retain the actual absent/false marker.

The nine required32D scenarios include
`point-layout-signed-polygonal-zero-axis` between the six predecessor scenarios
and the two pending scenarios. Require all twelve polygonal selected-anchor
cases across2D/3D and both zero-axis native sequences.
Retain actual native live PNG bytes/hash/dimensions, fresh before/after CTMs/state
and magenta stroke pixel extents along both turning extrema.
Require both new transparent signed-polygonal/zero-axis standalone downloads
with all six polygonal nodes plus the zero-axis node, exact file identity,
external SVG reopening and complete PNG validation.
Preserve both existing pending transparent/white workflows and final cumulative
standalone acceptance. None is optional because the child lacks browser startup.

Keep authenticated reference bundles byte-for-byte:
original172 boxes/4,925 anchors/11 failure controls; signed-basic8 boxes/
192 anchors;54 polygonal boxes/1,386 anchors;12 direct arithmetic controls;
four dart fitting traces; one singular boundary control;
eleven zero-axis PGF paths and37 independent rendering records.
Keep existing32C reference files and490 additive polygonal/zero-axis artifacts.
Do not regenerate oracle expected values or loosen0.025pt anchor/0.03pt contour
tolerances,0.005-unit sampling precision or2048 finite-work budget.

Preserve signed fitted radii/isosceles angle distinctions/dart parameter-defined
miter and narrow reciprocal branch corrections, ordered collapsed-axis traversal
including partial/reversed/rotated extrema and zero-area fill.
Keep production path/dash/cap/join/closure, painted bounds and picking conformance.
Retain all registered geometry/reference/rendering/model/TikZ regressions,
both TikZ modes and2D z=0/3D active-work-plane semantics.
This fix adds native evidence fidelity without reopening those geometry branches.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier full6,425 test pass cleared that prior review failure; the latest
registered suite passes6,655 tests. Do not loosen this deterministic control.

Keep explicit resolved preview schema (six dimensions, anchor, effective font
context) separate from exact authored units/source/context.
Keep immutable-click-derived native source/anchor/`110` expectations for full
runtime/saved envelope/history present, faithful fixtures and parent corruption
controls. Do not restore raw layout spreads or globally strip metadata.

Keep real unique zoom numeric/associated slider/disclosure, one native1.4 fill,
ordered before/immediate/after observations, native input/change provenance,
connected circle/rectangle/cylinder root-relative matrices, measured both-axis
scale/fixed-origin proof and precise binary32 propagation.
Keep exact state/history/selection/revision/uiSettings/pan/held-source invariants,
owned cleanup, mandatory post-click artifact and terminal/standalone/raw-policy
binding. Root screenCTM equality and persisted2D camera omission remain valid.

Keep deterministic pre-load fifteen-point fixture/ids/order/sources/styles/layout/
parameters, selected circle(7,6.5,0), two free labels and unique export-path
curve/polyline with both exact inline nodes/content/options.
Keep fixed.23 native preparation, current hit stack/owner/request/held source,
one ordinary trusted gesture, selected owner proof, Inspector/UI restoration and
all missing/duplicate/wrong-content inline/preparation regressions.

Keep immutable pending sequence: hold → normal load → native selection →
actual background/armed snapshots → SVG click while held → post-click edit/view
or replacement load → intended release → actual download → original reload/
settled expectations/both TikZ modes → external reopening → complete-root PNG.
Keep all15 click-time entries, original source/layout/placement, pending/settled
contour distinction and release-boundary evidence. Cleanup release is not
acceptance. Preserve transparent/white content and background assertions.

Keep Clear/imported paint/shape/layout detachment and exact persistence/history;
native Select/Inspector/toolbar preparation/restoration; trusted handle/capture/
release movement, one history commit and exact Undo/Redo under the same valid
document revision; fresh JSON-load/reused-ID/cache/request isolation;
canonical layers, exact Hidden points controls, dim/hide/dim provenance,
camera theta90/phi0 and owner/filter/lock/occluder checks.
Keep ordinary unsupported body → far → warning, fixed diagnostic candidates,
six-unit clearance, bounded warnings, overflow bodies and native owner cycles.

Keep saved version2/additive layout, legacy Size/2, ordered spacing/shorthand/
per-axis em/ex contexts, text/baseline/depth, real preview/export projection,
raw free/attached/inline text and existing typography/TeX limitations.
The documented diamond outer-separation exception was authenticated and judged
correct by the preceding independent review; preserve it without applying
that exception to these signed-axis defects. No unrelated reference issue was found.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling, one actual image/no retry, complete-root coverage, at most
one viewport expansion, stable coordinates and exact SVG/PNG file identity.
Keep pre-image reopening records, owned cleanup, primary errors and no extra
failure screenshot. Preserve actual PNG CRC/chunks/inflated scanline/dimensions/
byte validation, artifact inventories, raw-policy checks and runner copies.

## Fresh verification, review and handoff

Use strict TypeScript without `any`; keep module separation, codim convention,
raw user text and model coordinates. Add no dependency without explaining why.
Update Phase32 status documents with the actual background-target correction,
retained reference inventory and observed results. Preserve evidence history.

Use Homebrew Node>=22.12.0. Run focused fresh-action/native-event/parent-policy
and faithful-fixture checks, applicable runner and preserved geometry/path/
capture/pending controls. Count overlapping focused sweeps honestly.
Run all required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused strict TypeScript/lint and changed-script syntax checks.
Four inherited lint errors remain: two geometric-caller no-unsafe-finally errors,
verifier unused _role and layers unused defaultCurveStyle.
Preserve/report reproduced failed baseline checks separately from passing
changed-file checks; avoid unrelated cleanup or claiming unperformed checks.
The earlier stalled-report full-suite race is resolved.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 cumulative groups as registered by the runner: twelve31F groups
(already including final standalone), three32A groups and one group each for
32B paint/import,32C shapes/visibility/downloads and combined32D layout.
Require all nine named32D scenarios, the new twelve polygonal cases/both
zero-axis sequences/live paint/downloads, all retained signed cases, both
pending downloads/reopening/complete PNG/TikZ, native history/JSON persistence,
valid exact artifacts and no page errors.
Do not substitute Ab9guh's partial result, historical HMy8AM, a scoped report,
synthetic tests or cleanup captures for fresh complete acceptance.
Do not skip predecessors or defer supported cases.

Preserve implementation/fix clean-tree rules; do not reset/stash/discard/commit
unfinished work to bypass them.
If child browser startup encounters EPERM, retain exact startup failure/tree
and pending parent work without weakening acceptance. Obtain approved
browser-capable execution where available; do not endlessly repeat blocked
startup or confuse it with the parent's assertion.
If a later native boundary fails, persist raw pre/after input/current geometry
before interpreting it and report the next concrete blocker.

After fresh required verification passes, obtain independent read-only completion
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md` and inspect actual reports/artifacts.
Require the prior geometry findings independently resolved, faithful outside
background/native owner proof, paint/placement conformance, full-suite success
and fresh cumulative acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when required tests/browser checks pass.

Report the scoped observation/contract fix, meaningful fixture controls,
preserved production/reference bytes, changed files, focused/full checks,
baseline failures, exact tree/report identity and independent review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
