# Phase 32D Fix for unobstructed native zero-axis paint capture

## Objective and scope

Continue from the implemented signed polygonal/zero-axis geometry and fresh
root/background authentication, trusted capture-event validation and measured
coincident-contour clearance. The latest parent now completes all five2D
zero-axis native actions, then fails the live PNG extrema assertion.

The retained screenshot shows the restored expanded toolbar covering the upper
stroke. Correct the scoped live-capture preparation/lifecycle and raw evidence:
measure the entire current stroke, remove the observed obstruction through
owned native UI controls, capture once with fresh geometry, and restore the
inherited UI afterward. Keep the unchanged pixel oracle strict.

Limit changes to this live capture, its observations/contracts, faithful
regressions, necessary isolated runner copies and Phase32 status documentation.
Preserve production geometry, paths, picking, camera/model coordinates,
authored units, saved version2 and every authenticated reference byte.
Do not repeat the resolved root-only fix or infer a new production paint defect
from the partially covered raster.
Any later production change needs separately retained fresh independent evidence.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the actual PNG and matching raw records first.
Maintain cumulative strict verification, verification-before-review/commit and
the post-review matching-tree guard. Phase32 remains incomplete.

## Latest handoff, parent failure and identity

Implemented background fix:
`/private/tmp/stz-32d-background-fix-20261011/HANDOFF.json`, including preservation
audit, precursor coordinate evidence, exact inventory/hashes and logs.
Child strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-QWbS9S/verification.json`.

Newest parent verifier:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-khe3zT/response.json`.
Strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-qsihsK/verification.json`.
All current browser evidence is under its
`05-check-free-labels/artifacts/`, especially:

- `free-labels-evidence.json` and the raw before-capture/bytes/native diagnostics.
- `point-layout-signed-polygonal-zero-axis-2d-native.json`.
- `point-layout-signed-polygonal-zero-axis-2d-live.png`.
- `point-layout-failure.json` and `point-layout-app-failure.json`,
  including complete failure DOM and screenshot.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `09cd6a7e8a7e2226acb4c04634b36dbd166f0858`.
Pre-prompt tree matches the parent report's before/after checkout:

~~~text
d8bebf0f986e24235a7de02e56c138115ce3265937a8037ad60068449eb79a2c
~~~

Tracked-diff SHA256:
`cc0ce90fff0c2b494f4f8b2e2bf2d74342ce0aee6bc648dca39275a36589a9a7`.
Preserve the six modified tracked files:
`scripts/pointGeometricSelection.mjs`, `scripts/checkPointLayoutAnchors.mjs`,
`scripts/pointLayoutAnchorsContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs` and both Phase32 status documents.
Current untracked count is zero. The prior494-file evidence/test inventory is
retained in the current HEAD; it is not the current untracked count.
Preserve its bytes and every prior production/reference change.
The prompt changes identity: capture actual current tracked/untracked bytes
rather than treating this historical fingerprint as future acceptance.

| Retained evidence | Actual result |
| --- | --- |
| Latest implementation child | 6,710/6,710 tests passed, zero failures/skips; build/diff, focused policy/geometry/runner/capture/pending, strict TypeScript/lint/syntax passed.55 new regression controls. Focused sweeps overlap. Four inherited lint errors remain. Browser checks stopped at localhost EPERM before Chrome. |
| qsihsK parent | Tests/build/diff/label-assets passed; free-labels failed at live zero-axis PNG extrema. Sixteen of18 cumulative groups completed;17 started. Combined layout is incomplete, final standalone unexecuted, pageErrors empty. |
| Current layout progress | Six predecessor32D scenarios passed. Six2D polygonal selected-anchor observations retained. All five2D zero-axis gestures, native selection/cycle assertions and owned cleanup completed before live raster failure. The new scenario has no terminal pass. |
| Remaining | New2D standalone download,3D polygonal/zero-axis/live/download cases, both existing pending scenarios and final standalone remain unexecuted. Independent completion review has not started; no child commit/push. |

Earlier Ab9guh root-only rejection and HMy8AM acceptance/review remain history.
The newest parent did launch Chrome and execute trusted zero-axis input.
Distinguish that from child startup EPERM and from unperformed3D/download work.
Historical or partial acceptance cannot establish completion of the next tree.

## Exact observed raster failure

In `point-layout-signed-polygonal-zero-axis-2d-native.json`, the five action keys
are `outside-clear`, `ordinary-axis`, `alt-start`, `alt-next`, `outside-final`.
Each retains three trusted events, droppedEvents0 and actual after-state.
Selection IDs are `null → zero-overlap → zero-overlap → app-point → null`.
Outside input reaches the authenticated background rect at pointerdown, then
the current SVG root at captured pointerup/click. The completed records retain
model/history/revision/uiSettings invariance and Alt/observer cleanup.
Do not revert this capture retargeting to identical-target assertions.

`zeroAxisInput` restores the inherited expanded toolbar in its finally block
before the separate live screenshot. Its preparation/restoration is successful.
Both live snapshots report `toolbar.collapsed:false` and Inspector closed.
Current owner is `["point-node",437,"zero-overlap"]`, empty source, ready body,
matching current request/bodyRequest and unchanged geometry.

The actual path is:

~~~text
M 0 0 L 0 -33.941125496954 L 0 0 L 0 33.941125496954 L 0 0 Z
~~~

Its native arclength is135.76449584960938.
Fresh pre/post contour screenCTM remains
(a=d3.1,b=c0,e1296.4,f268.975).
Projected geometric y extrema are approximately163.7575 and374.1925 screen px.
The actual native screenshot contains1700×1300 pixels and56,406 bytes,
SHA256:

~~~text
0564067bd15143ff9ea591bb12f2fa62b0c380b21e29e88df5a2313e7daee10e
~~~

The oracle finds582 magenta pixels with local bounds:
x−0.2903225806451906..0.35483870967739,
y−28.54032258064515..33.71774193548388.
Expected y extrema are ±33.941125496954 with the unchanged1.5/screen-scale
raster allowance. The upper stroke is covered by the expanded floating toolbar
in the actual PNG; the lower extremum is within the existing allowance.

`assertZeroAxisPixelEvidence` at `scripts/pointLayoutAnchorsContract.mjs:591`
correctly rejects that partially hidden raster, called at
`scripts/checkPointLayoutAnchors.mjs:830` after image bytes/raw native evidence
have been saved.
This is supported evidence of a capture obstruction; the next run must freshly
authenticate the whole stroke's visibility and demonstrate unchanged paint.
Do not reinterpret the snapshot as proof that native drawing failed, or that
a reduced/occluded raster should pass.

## Scoped owned live-capture preparation

Inspect the live capture block in `scripts/checkPointLayoutAnchors.mjs`,
`observeGeometricSelection`, owned native toolbar preparation/restoration
patterns, `observeZeroAxisPixels`, `assertZeroAxisPixelEvidence` and
`assertZeroAxisNativeCase` in `scripts/pointLayoutAnchorsContract.mjs`.

Preserve the completed native interaction workflow, including its own
Inspector/toolbar restoration and five-action evidence. Add a separate bounded
capture lifecycle after that restoration, with an explicit inherited baseline.
Do not leave interaction cleanup unfinished to obtain a clean screenshot.

Before any capture preparation, persist actual state, current source/request/
owner/revision, coincident contour geometry, finite invertible canvas/point/
contour CTMs, viewport/visual viewport/scroll, toolbar/control/overlay bounds
and visibility measurements for the complete projected stroke footprint,
including both extrema and stroke width.
Measure actual current overlay/hit-stack ownership where obstruction is tested.
A clear local.23 click point or correct DOM path length does not establish that
both extrema/all paint are visible.
Use the independently known zero-axis extrema and real native traversal,
not observed truncated raster bounds, to define the required capture region.

If the expanded toolbar obstructs that footprint, use one unique normal native
Collapse preview toolbar control. Retain the observed reason, control identity/
count, actual action and fresh resulting UI/state/geometry.
For an already clear/inherited-collapsed case, retain an explicit no-action
record. Do not expand/select/collapse repeatedly or change the selected owner.
Reuse small existing native ownership/diagnostic patterns where useful without
weakening the completed geometric-selection contracts.
The existing geometric-toolbar validator requires one Select action and a
click-specific obstruction; do not apply it unchanged to capture preparation.
Use a separate small capture contract without another Select action, preserving
the existing native control/state-invariance/restoration behavior.

After the transition, freshly measure both endpoints, full stroke footprint,
current canvas/contours and overlays. Require the stroke inside the actual
viewport/canvas and unobstructed by toolbar, Inspector, history, quick-style,
selection decorations or other UI. Unexpected stale geometry, remaining
occlusion or unsupported scroll/viewport conditions must retain evidence and
fail explicitly. Do not change camera/zoom/model positions or use arbitrary
coordinate shifts to avoid the observed toolbar.

Capture exactly one actual live PNG using the existing bounded non-full-page
CSS-pixel screenshot approach. Keep normal fonts and the current magenta
stroke; no screenshot retry, DOM/CSS hiding, reconstructed image, forced click,
export-only substitute, crop that omits an extremum or softened color/extent
threshold may establish live acceptance.
Bind screenshot coordinates to the actual viewport origin and fresh screenCTM;
retain scroll/visual-viewport/device-scale observations so root/contour CTMs
are interpreted in the correct coordinate frame.
The current screenCTM already reflects page scroll; do not subtract the retained
scrollY129 again or reuse pre-preparation matrices in a changed capture frame.

Persist PNG path/bytes/hash/dimensions before image inspection and assertions.
Retain fresh before/after state, source/owner/request and canvas/point/contour
CTMs around that single capture. Validate stable geometry/viewport and unchanged
model/history/selection/revision/uiSettings.
Continue using the unchanged magenta pixel replay and existing raster allowance
to require both extrema and narrow stroke width.
Keep PNG byte/file identity and parent replay validation; success flags or
geometry-only extrema cannot substitute for real screenshot pixels.

Restore the capture's inherited toolbar/UI state in owned bounded finally
cleanup after the image attempt, including screenshot/oracle/persistence failure.
Restore only what this capture changed; preserve primary error identity and
retain bounded secondary/restoration evidence.
Do not take an extra failure screenshot.
Require no model/history/selection/document/UI-setting changes and no leaked
observer/listener/Alt/owned resources.

Update `assertZeroAxisNativeCase`'s lifecycle binding explicitly:
native action end → completed interaction toolbar restoration → capture inherited
baseline → optional measured native collapse → prepared pre-image snapshot →
single image/post-image snapshot → capture restoration.
Retain exact model/state/owner continuity at each boundary; do not replace
existing checks with broad metadata stripping or mere equality to an arbitrary
new baseline.
Allow legitimate measured DOM/viewport matrices before versus after native UI
preparation, while requiring stable capture-frame matrices/viewport around PNG
bytes and exact restoration/state invariants afterward.
Keep the same current model geometry/source/request and actual canvas throughout.

## Faithful regressions and remaining acceptance

Update the live fixture at `tests/scripts/phase32dVerification.test.mjs:243–252`,
which currently clones a final-action snapshot rather than modeling the capture
UI lifecycle. Add a faithful restored-expanded-toolbar fixture whose upper
stroke is covered after the earlier valid collapsed native input workflow.
It must require capture preparation and complete restoration while retaining
that earlier input/picking proof separately.
Add an inherited-collapsed or already-unobstructed no-action success case.
Keep their current control identity, target/overlay bounds, viewport/CTMs,
native action evidence and PNG byte/extent records consistent.

Add meaningful failures for missing/wrong/duplicate capture controls, stale or
foreign root/owner/request/revision/CTM, an endpoint outside the viewport,
occlusion remaining after collapse, clear.23 but covered extremum, changed
model/history/selection/UI, fabricated/no action, mismatched screenshot frame,
truncated/blank/short-stroke PNG, altered raw/file identity and absent/failed
restoration. Preserve primary image/evidence failures when cleanup also fails.
Exercise both ambient dimensions and the complete parent raw/native-file policy,
not only a local success summary. Avoid redundant test multiplication.

Keep all55 new background regression controls and their authentic root/rect
branch distinction, raw exact marker/current-canvas observation, measured
coincident-contour clearance and trusted capture-event propagation.
Retain outside local(12,20), ordinary/Alt local(0,20), greater-than-six-unit
clearance, precise binary32 pointer/integer click propagation, five-action
selection order, source/request/owner consistency and complete cleanup.
Do not loosen or rerun those corrections as a substitute for live paint proof.

Update new live preparation/restoration records, required raw-policy validation,
artifact inventories and isolated runner copies as needed.
Keep absent new capture proof fail-closed. Preserve historical reports unchanged.

Require all nine named32D scenarios, including
`point-layout-signed-polygonal-zero-axis` with twelve polygonal selected-anchor
cases and both zero-axis native sequences/live PNGs.
Require both new transparent standalone downloads, all six polygonal nodes plus
the zero-axis node, exact file identity, external SVG reopening and complete PNG.
Keep the shared zero-axis pixel oracle strict for standalone callers too.
Do not alter the completed complete-root capture helper or presume the live
toolbar obstruction also exists in standalone SVG.
Preserve both retained fifteen-entry pending transparent/white download/reopening/
complete PNG/TikZ workflows and final cumulative standalone acceptance.

Preserve byte-for-byte all authenticated references:
original172 boxes/4,925 anchors/11 failure controls; signed-basic8 boxes/
192 anchors;54 polygonal boxes/1,386 anchors;12 direct arithmetic controls;
four dart fitting traces; one singular boundary control;
eleven zero-axis PGF paths and37 independent rendering records.
Keep original32C files and490 additive polygonal/zero-axis evidence files.
Do not regenerate expected values or loosen0.025pt anchor/0.03pt contour
tolerances,0.005 sampling precision or2048 finite-work budget.
Preserve signed fitting/clearance, narrow reciprocal math, faithful ordered
collapsed-axis/partial/reversed/rotated traversal, zero-area fill and
dash/cap/join/closure behavior.
Retain all registered geometry/rendering/reference/model/TikZ tests,
both TikZ modes and2D z=0/3D active-work-plane semantics.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier full6,425 test pass cleared that prior review failure; the latest
registered suite passes6,710 tests. Do not loosen this deterministic control.

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
Update Phase32 status documents to the actual capture-preparation scope and
current results, preserving completed background and geometry evidence.
Count overlapping focused sweeps honestly.

Use Homebrew Node>=22.12.0. Run focused live-capture lifecycle/faithful fixture/
pixel replay/parent policy/runner checks and applicable preserved native,
geometry/reference, pending, standalone and deterministic stalled-report controls.
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
Report reproduced failed baseline checks separately from passing changed-file
checks. Avoid unrelated cleanup or claiming unperformed checks.
The earlier stalled-report full-suite race is resolved.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 cumulative groups: twelve31F groups (already including final
standalone), three32A groups and one each for32B paint/import,32C shapes/
visibility/downloads and combined32D layout.
Require all nine named32D scenarios, both fresh zero-axis native/live cases,
all twelve polygonal cases/new downloads, retained signed cases, both pending
downloads/reopening/complete PNG/TikZ, native history/JSON persistence,
valid exact artifacts and no page errors.
Do not reuse qsihsK's partial result, Ab9guh/HMy8AM history, scoped reports,
synthetic tests or cleanup captures as complete native acceptance.
Do not skip predecessors or defer supported cases.

Preserve implementation/fix clean-tree rules; do not reset/stash/discard/commit
unfinished work to bypass them.
If child startup encounters EPERM, retain failure/exact tree and pending parent
native work without weakening acceptance. Obtain approved browser-capable
execution where available.
If another native/capture boundary fails, persist raw current geometry/input/
frame/file evidence before interpretation and report the next concrete blocker.

After fresh required verification passes, obtain independent read-only completion
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md` and inspect actual reports/artifacts.
Require prior geometry findings independently resolved, faithful background/
native capture proof, unobstructed live paint/placement conformance, full-suite
success and complete fresh cumulative acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when required tests/browser checks pass.

Report the scoped capture fix, meaningful regression controls, unchanged
production/reference bytes, changed files, focused/full checks, baseline
failures, exact tree/report identity and independent review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
