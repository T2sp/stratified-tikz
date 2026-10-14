# Phase 32D Fix for the real-App stable-frame deadline failure

## Objective and scope

Authenticated metadata sharing and absolute deadline ownership are implemented
across the complete pending-selection publication path. The fresh matching tree
passed 7,291/7,291 tests, build, strict TypeScript, scoped new-code lint, syntax
and diff. Do not repeat those fixes or the completed cylinder/freezing fixes.

The latest browser-capable parent passed tests/build/diff/label-assets, then
free-labels failed earlier in `real-App-workflows`:

~~~text
Error: Timed out after 2100ms during App stable frame wait
    at Object.expire (scripts/pointCheckDiagnostics.mjs:31:17)
    at Timeout.<anonymous> (scripts/pointCheckDiagnostics.mjs:77:85)
~~~

Diagnose this owned App geometry/frame wait and fix an established defect,
preserving its existing acceptance and deadlines. An established execution
discontinuity may instead require a valid fresh run; do not invent a code defect
or relax absolute deadlines to accept a suspended run.
The historical pending-selection timeout's exclusive bottleneck remains unproven.
The new App failure does not establish that the
publication fix regressed, nor that production geometry, scrolling, renderer
frames, transport, timer delivery or host event-loop blocking caused the timeout.
Distinguish the actual wait failure from those hypotheses before changing code.

Scope edits to the real-App stability wait, its diagnostic/ownership/cancellation
composition, compact evidence needed to establish this boundary, meaningful
regressions, necessary runner dependency copies and Phase 32 status documentation.
No production geometry, model/schema, PGF reference, rendering, input, capture
or TikZ change is justified by the current evidence. Any additional scope must
follow a reproduced, authenticated cause, not this host timeout alone.
Preserve every required observation, exact checkout/raw/file authentication,
current native gesture and pending-download acceptance contract.

Read `AGENTS.md`, implementation/review prompts and both Phase 32 docs.
Resolve latest published artifacts with `readEvidenceDocumentSync` and their
complete exact checkout. Ordinary App diagnostic/lifecycle JSON is separate from
published pointer JSON; do not treat a pointer as the raw observation.
Phase 32 is incomplete; fresh verification before independent review and the
post-review matching-tree guard remain mandatory. No commit or push.

## Latest implementation, parent and exact identity

Latest authenticated implementation handoff:
`/private/tmp/stz-32d-pending-evidence-fix-20261014/HANDOFF.json`.
Bytes: 910,802. SHA256:
`c1173a218d922d0ee46aae2f1b372eff61b922b2d98c78c3ae18af3f6957b9ac`.
Use its exact 16-file inventory and hashes, final registered-suite result,
strict child report, preserved reference manifests and recorded first outcomes.

Current parent verifier handoff:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-P19JEq/response.json`.
SHA256: `3f376bc169a671f9c98f7af1b5ace321cd4421ed4bacba7c8d4792468ae97722`.
Current parent report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-yWdc9n/verification.json`.
SHA256: `52f413b7abf43c6f151062f21cee05ad770ff6e3d1d9b7ed0d94df052a959f86`.
Current free-labels artifact directory:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-yWdc9n/05-check-free-labels/artifacts/`.
Strict child report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-hT0kf0/verification.json`.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `6a4f5ab577a7d7d4fb28ff35dde059dc212550cc`.
Before this prompt edit, the checkout matches both latest handoff and current
parent before/after:

~~~text
4f2a45e43929b82c25f558a38909dc2b5aaef658d1f94a6a61dfa9a175b17fe7
~~~

Tracked-diff SHA256:
`3659da351d555965a63d83b72e4cecb63781fda57fc2c0e3b3b56257cee4e609`.
The one untracked file is `tests/scripts/pendingSelectionPublication.test.mjs`,
SHA256 `043b88328beb7dd8f842d99d140d34da81230a2f570b2837c8ea00dd8819becd`.
Preserve all 15 modified tracked files plus that untracked file. The handoff's
`finalSourceInventory.inventorySha256` is
`e079701bf4deb8d331c1ee29ad9255cd291ae513594435787c9ea572b0d428f2`.
All 16 current source bytes match that inventory before this prompt edit.

The parent tracked the earlier 26 modified and 571 untracked files at HEAD.
Those inherited files are no longer 571 current untracked files. All 571 retained
filename/hash associations, 562 additive evidence hashes and 654 original
reference hashes still match; do not reset/drop/replace inherited work.
The original 110 cylinder-domain files remain retained predecessors.
Prompt edits change identity; all new gates must capture actual tracked and
untracked bytes rather than reuse this fingerprint.

| Evidence | Actual result |
| --- | --- |
| Matching implementation checks | 7,291/7,291 full tests, zero failures/cancellations/skips/todos; build, strict TypeScript, scoped new-code lint, syntax and diff passed. Earlier focused counts overlap; do not add them. |
| Offline large composition regression | 571 checkout entries, 859 prior documents, 4,761 diagnostic rows; 851,936-byte index. All five required publications completed in 59.331917ms with 2,000ms/5,000ms limits. This is helper evidence, not native acceptance or a proved historical cause. |
| Inherited debt | Four original lint findings plus one inherited `SvgDiagram` finding remain separately recorded. Repository-wide lint was not claimed. |
| Child browsers | Both commands hit localhost `listen EPERM` before Chrome; no current child native acceptance. |
| Matching current parent | npm test 7,291/7,291, build, diff and label-assets passed. Free-labels failed at real-App-workflows; checkout unchanged before/after. |
| Current cumulative browser evidence | 13/18 groups completed, 14 started; 123 evidence records, 348 diagnostics, 377 checkpoints; zero top-level page errors. App initial-valid, invalid-pending and invalid-fallback observations passed before the failure. |
| Current acceptance gaps | real-App-workflows is incomplete. Settled standalone export, point paint/import/persistence, geometric shapes and combined layout groups were unexecuted. Neither layout pending workflow nor final standalone has current acceptance. |
| Review/status | Fresh independent completion review has not started. Phase 32 remains incomplete; no commit or push. |

Historical parent `u4oMpK` and verifier `QBA9vY` belong to the previous checkout:
16/18 groups completed, ten of twelve layout scenarios passed, then transparent
pending preparation failed at geometric selection final evidence (2,000ms).
Retain its immutable pre-expiry observation and later failure/cleanup records.
Its native success does not accept the new tree. Do not describe its layout
failure or ten passed scenarios as the current parent's results.

## Establish the current App failure boundary

Authenticate and resolve `free-labels-evidence.json`, then inspect
`app-failure.json`, `app-lifecycle.json`, `app-geometry-index.json`, the retained
`app-geometry-*.json`, persistence artifacts and owned-server records.
`app-workflows.json` is absent: failure occurred before the full App workflow
returned. Preserve that absence as an incomplete gate, not inferred success.
The stage is `valid-again-pending` for source `$\mathord{\mathrm{i}}$`.
`app-geometry-0068.json` proves the wrapped `geometry()` stable boundary already
passed in 54.877292ms. `app-geometry-0069.json` retains primary failure afterward.
The failing wait is an unwrapped later `waitForStableAppGeometry`: either the
pointer helper at `checkFreeLabelsApp.mjs:211` or the final stage wait at `:269`.
The records do not identify which probe/wait. Trace both actual call sites and
retain stage/probe identity for every wait without removing native assertions.

These snapshots retain exact pending source/request/bounds and owner
`["free-label",1,"app-label"]`, original URL/document generation/API identity,
visible/focused document, live frame observer, no Inspector or animations.
App errors/dropped errors are zero; last recorded edit advances past history
from two to three entries. Do not infer full current model state or held-request
counts at failure: those were not captured. The earlier pending predicate passed.
All 69 App geometry captures have zero dropped events/samples and diagnostic
errors. Disposed diagnostics record `pendingEvaluation=false`; lifecycle records
page close and no secondary capture/cleanup errors were logged. Cancellation's
actual outcome remains unrecorded, so these facts do not prove wait-token cleanup.

The current v2 publication index has failed disposition, sequence zero and no
documents/history/boundaries, with this App timeout as primary. The latest browser
run never reached layout publication. Earlier native point transparent/white
checks passed; they are distinct from unexecuted combined-layout pending cases.

The App stable helper is in `scripts/appGeometryDiagnostics.mjs` and its callers
are in `scripts/checkFreeLabelsApp.mjs`. The browser timer is 2,000ms; the host
`boundedPointDiagnostic` budget is 2,100ms; token-specific cancellation is bounded
at 250ms. The shared diagnostic's absolute monotonic completion/rejection guards
now reject expiry even when the timer callback is delayed. Preserve that correct
ownership behavior; do not make delayed timer delivery authorize late success.
The supplied stack reports the host timer expiry. Determine browser evaluation,
inner timer/frame outcome, host completion and cancellation timing separately.

Measure host monotonic start/deadline/callback entry/settlement/timer delivery,
browser wait entry/frame samples/inner deadline/settlement, document generation,
URL/API/current source/request/status, and cancellation/drain. Correlate clocks
explicitly; do not subtract browser and host performance.now values as one clock.
The retained `0068` completed -> `0069` failure deltas are:

| Clock/observation | Actual delta |
| --- | --- |
| Host wall | 1,448,062ms |
| Host monotonic | 1,448,119.216834ms |
| Browser snapshot wall | 1,448,068ms |
| Browser performance.now | 1,863.5ms |
| Browser observer frames / last-frame timestamp | +101 / +1,866.6ms |

These endpoints bracket the remaining `inspectStage` work; they do not timestamp
the failing wait's entry or identify which native probes ran.
They do not establish continuous unstable frames or prove
device suspension, clock behavior, event-loop blocking or transport delay.
Establish the actual wait intervals and execution continuity before assigning
cause to geometry, instrumentation, serialization/I/O, renderer inactivity or
host work. Record missing observations honestly. Preserve absolute expiry when
host execution resumes; an inner/browser clock cannot silently extend ownership.

Add compact bounded progress only at the real wait/producer boundaries as needed.
Retain pre-assertion/failure evidence independently of an unresponsive renderer.
Instrumentation must not repeatedly clone or publish the whole accumulated
report under the stable-frame deadline, recursively capture itself or introduce
unbounded work. Use token/generation/sequence associations and explicit caps.
A host deadline failure is not a top-level browser `pageerror`.

## Preserve App stability and owned cleanup

Stable acceptance requires three consecutive exactly equal comparison snapshots.
Preserve generation/URL/API continuity, original source/request/state/bounds,
connected finite node rects and CTMs, node identity, layout/scroll, ancestors,
Inspector, camera, viewBox and viewport. Keep the existing frame/sample/wait-map
budgets. Do not loosen comparison fields/tolerances, return an earlier snapshot,
force a native action, add sleeps/retries or focus/reload/reacquire a replacement
page to manufacture acceptance. Native scroll and pointer/history/source checks
must retain their normal production paths and deadlines.

Preserve the browser's inner 2,000ms wait, host 2,100ms bound, 250ms cancellation,
2,000ms ordinary diagnostics, 5,000ms publication and existing normal App action,
page/I/O/image/cleanup limits. No larger timeout, global clock mock or new heap/
concurrency flag may hide the failure. If a defect is established, fix the
unnecessary work or ownership defect at its actual boundary while retaining
strict stable acceptance. Otherwise retain unresolved causes or an established
execution discontinuity explicitly and obtain valid fresh acceptance.

Own initial browser evaluation and both late outcomes immediately. Expiry must
close the success generation, consume late fulfillment/rejection and prevent a
late running/pass checkpoint, App-group completion or replacement primary error.
Cancel only the exact token in the original owned document; prove frame/timer/
map/listener cleanup when responsive, and separately bounded host cleanup when
unresponsive. Do not revive a stopped observer or restart its ownership lease.
Retain the first native/assertion/timeout Error through diagnostic, cancellation,
write and cleanup failures. Finish owned listener/event/page/browser/server
cleanup without allowing it to stand in for successful workflow acceptance.

## Meaningful regressions and preserved publication fixes

Exercise the actual host helper -> browser frame wait -> snapshot/comparison ->
App caller -> failure/cancellation/cleanup composition. Existing successful frame
or standalone diagnostic stubs do not reproduce this composed boundary.
Use controlled entered/release gates and an operation-scoped clock/scheduler
seam; ordinary setup, file I/O, image and native work keep their normal budgets.
Register new tests in the explicit `package.json` test list if needed.

Cover exact stable success before return; changing geometry/node identity/source/
request resetting the three-frame count, followed by genuinely stable snapshots;
no frames; missing/nonfinite targets; original URL/API/generation loss;
stopped observer; bounded sample/frame/map limits; host expiry with
responsive cancellation and stalled cancellation; late fulfillment/rejection;
inner failure versus host backstop; earlier native/assertion Error identity;
cleanup failure; cancellation before browser wait registration; late registration
after host expiry; and withheld host/browser timer delivery crossing absolute
deadlines. Exercise clock discontinuity/late callback entry with deterministic
owned seams, and distinguish the two clocks without changing production budgets.
Control delivery/clock entry deterministically rather than charging expensive
fixture work to a tiny real timer. Release/drain all gates; prove no orphan or
unhandled rejection, no stale checkpoint/pass and exact cleanup/primary retention.
Node helper controls cannot replace current native App acceptance.

Keep the implemented v2 canonical immutable authenticated complete checkout,
compact document references and ordered immutable pack-reference links.
Preserve every logical identity field/hash, historical pack/path/length/hash/order,
pointer/index/history agreement, raw values/order and strict declared-v1 replay.
Wrong/missing owner/tree/ref/hash/order/sequence and stale authority remain rejected;
no legacy exemption, fingerprint-only comparison or broad field stripping.

Keep compact producer/authority timing, absolute composed diagnostic guards,
queued freezing, independent bounded failure-publication queue, immediate producer
rejection ownership and immutable failed authority. Preserve all five ordered
final selection/report/preparation publications and successful return only after
complete validation/retention. Late work cannot rewrite failed authority or
replace an earlier native Error/the actual timeout AggregateError.
Retain the faithful large-checkout composition, expiry/late/error/corruption
controls and recorded first failures/outcomes. The 851,936-byte/59.33ms regression
establishes reduced authenticated metadata work, not an exclusive historical
bottleneck or a fresh pending-download pass.

## Preserve completed cylinder fixes and independent references

Keep runtime signed cylinder fitting metadata, actual end/base role ordering,
full named/text-side/numeric anchor construction and shared placement.
Preserve folded valid geometry, ordered paint bounds, seam/custom regions,
PGF clearance/branch order, rotation/frame conversion and valid signed neighbors.
Keep staged TeX dimension scanning/fitting and source-aware domain resolution,
raw authored options/units/context, warning-only zero-domain live/settled/picking/
export behavior, valid zero-axis shapes and same-owner state transitions.

Retain all562 new evidence files unchanged:
173 under `cylinder-fitting-scanning/` and389 under `cylinder-export-domain/`.
Keep authenticated folded37-anchor coverage,254 recorded scanning/control anchors,
13 zero failures/13 compiler successes and12 later reciprocal-failure controls.
Keep33 model/66 actual-generated compiler runs in the export-domain bundle,
including16 zero-divisor,15 success and two nonzero later-failure model cases.
Use the handoff/reference manifests for exact input/source/engine/command/
compiler/hash counts rather than counting files as geometry cases.
No PGF data or tolerance widening can hide conformance.

Retain original172 boxes/4,925 anchors/11 original failures, signed-basic8/
192,54 polygonal/1,386,12 arithmetic controls/four dart traces/one singular control,
eleven zero-axis paths/37 render records/490 additive files and original110
raw-zero cylinder-domain artifacts with11 failure controls/12 controls/93 anchors.
Keep0.025pt anchor/0.03pt contour tolerances,0.005 precision/2048 finite-work budget.
Keep singular/subsp warning-only downloads under their dedicated strict diagnostic
context; no broad empty-body/filename exemption. Preserve seven-owner empty-body
acceptance and full native/association/SVG/PNG/TikZ provenance independently.

Retain earlier67 empty-body,72 publication,61 correspondence,65 live-capture and
55 background controls plus completed cylinder/domain/freezing/progress suites.
Preserve actual DOM order/derived owner association, file-local contour/body/root/
placement/paint proof, owner-bound CTM, full-stroke pixels, exact model/click/
history and SVG/PNG/TikZ/file identities, owned capture and UI restoration.
No production dependency, saved schema or reference change is needed.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier stalled-report race was resolved; preserve that targeted control.
The global20ms live-writer race was corrected with scoped scheduler control;
preserve that fix. Deterministic freezing and owned verifier progress are now
implemented and the first affected/full suites completed. The historical reviewer
cancellation was not uniquely established or reproduced; do not claim a proved
historical cause. The current real-App stable-frame timeout is a distinct blocker.

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
that exception to other shapes. Preserve completed signed-axis and cylinder fixes.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling, one actual image/no retry, complete-root coverage, at most
one viewport expansion, stable coordinates and exact SVG/PNG file identity.
Keep pre-image reopening records, owned cleanup, primary errors and no extra
failure screenshot. Preserve actual PNG CRC/chunks/inflated scanline/dimensions/
byte validation, artifact inventories, raw-policy checks and runner copies.

## Fresh verification, review and handoff

Use strict TypeScript without `any`, small separated helpers and no new dependency.
Update both Phase 32 docs to the current real-App stable-frame failure,
established wait/ownership fixes and actual completed checks. Preserve the
completed publication optimization and its authenticated offline measurements.
Separate child EPERM, parent partial native success, new
verification and independent review. Do not claim the historical verifier
cancellation cause was proven or that the current operation already passed.

Run focused App geometry/frame-wait/ownership/cancellation/full-workflow tests,
publication/authentication/reader/report/deadline/pending-selection composition
and strict parent-corruption/runner tests, plus preserved cylinder/
scanning/placement/native/capture/association/pending/standalone regressions.
Use Homebrew Node>=22.12.0 and normal project settings:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run focused strict TypeScript, changed-code lint and script syntax/diff.
Keep four original inherited lint findings and the separately reproduced
inherited `SvgDiagram` finding distinct from new-code checks.
Do not fix unrelated debt or claim unperformed repository-wide checks.

Run fresh browser-capable strict parent verification on actual changed bytes:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 cumulative groups and all12 named layout scenarios, including
folded/subsp/singular cylinder and signed-polygonal/zero-axis cases; both ambient
dimensions/native/live/standalone; both pending transparent/white workflows,
full15-entry immutable click envelopes, actual downloads, external reopening,
complete SVG/PNG/TikZ/source/reference/authority replay and no page errors.
Real-App-workflows and its native geometry controls must finish before that
group completes. Final standalone must execute and pass. Do not reuse yWdc9n
or historical u4oMpK partial acceptance after edits, or substitute either run
for a complete current run.

Preserve clean-tree rules; do not reset/stash/discard inherited work or commit.
If child startup hits EPERM, record the exact failure/tree and continue through
approved browser-capable parent execution without relaxing coverage.
After every required check completely passes, obtain fresh independent read-only
completion review using `prompts/phase-32d-review.md` on exact matching tracked/
untracked bytes and inspect actual resolved reports/artifacts.
Require complete reviewer/full-suite success and all current native/file gates.
An incomplete/cancelled reviewer run or needs_changes blocks completion/commit.
Keep the post-review matching-tree guard.

Report established findings, any proved App cause and any justified scoped fix,
or a documented execution discontinuity and valid fresh run. State unresolved
causes explicitly. Include meaningful regressions, authenticated wait/timing
results, preserved publication measurements, exact changed files, first completed
focused/full/browser outcomes, baseline failures and tree/report hashes.
Show preserved source/reference identities separately.
Phase32 remains incomplete until every required gate passes.
Do not commit or push; leave that decision to the parent after verification and review.
