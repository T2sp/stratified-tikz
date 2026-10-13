# Phase 32D Fix for pending-selection evidence publication and deadline ownership

## Objective and scope

The cylinder fitting/anchor, staged TeX-domain and deterministic freezing/owned
verifier-progress fixes are implemented. The fresh matching parent passed tests,
build, diff and label-assets, but free-labels failed during transparent pending
layout preparation:

~~~text
AggregateError: Geometric selection diagnostics failed
Error: Timed out after 2000ms during Geometric selection final evidence
~~~

Fix the bounded final-evidence path, its publication metadata amplification and
deadline ownership. Diagnose the complete nested operation before assigning the
timeout to a particular serialization, writer, queue or page read.
Keep the production2,000ms diagnostic and5,000ms publication limits unchanged.

Scope edits to evidence publication/strict resolution, the owned diagnostic/
report/pending-preparation composition needed at this boundary, meaningful
regressions, necessary runner copies and Phase32 status documentation.
No production geometry, model/schema, PGF reference, rendering, input, capture
or TikZ change is justified by this failure.
Do not repeat the completed cylinder or freezing fixes.
Preserve every required observation, exact checkout/raw/file authentication,
current native gesture and pending-download acceptance contract.

Read `AGENTS.md`, implementation/review prompts and both Phase32 docs.
Resolve the authenticated latest artifacts with `readEvidenceDocumentSync` and
their exact checkout. Do not treat pointer JSON as the raw observation.
Phase32 is incomplete; fresh verification before independent review/commit and
matching-tree guards remain mandatory.

## Latest implementation, parent and exact identity

Implementation handoff:
`/private/tmp/stz-32d-fitting-progress-fix-20261013/HANDOFF.json`.
Handoff SHA256:
`97250ff4d45f8ce0951f74165d8f83f0d39b5587262bc4753cdc4c339bdebb09`.

Current parent verifier handoff:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-QBA9vY/response.json`.
Current parent report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-u4oMpK/verification.json`.
Current free-labels artifact directory:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-u4oMpK/05-check-free-labels/artifacts/`.
Child strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-3ByfEC/verification.json`.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `afe1bd642f8bf5a97671c0ade2b3a2c5565ffcbf`.
Before this prompt edit, the checkout matches parent before/after:

~~~text
a31f594e86c088453c16d9904b6b99cc034837dd2ae91a4f17a989227362029c
~~~

Tracked-diff SHA256:
`4b9008cf404157a89eb7c69279f653b9472ec24df3980ca674c87d69522a7250`.
Preserve26 modified tracked files and571 untracked files:562 separate additive
evidence files and nine code/test files. Use the handoff's35-file source/test/docs
inventory and all exact reference hashes; do not reset/drop inherited work.
The original110 cylinder-domain files are retained predecessors.
Prompt edits change identity; all new gates must capture actual tracked and
untracked bytes rather than reuse this fingerprint.

| Evidence | Actual result |
| --- | --- |
| Implementation checks | 7,237/7,237 full tests passed, zero failures/cancellations/skips. Focused cylinder154/154; broader909/909. Build, strict TypeScript, scoped new-code lint, syntax and diff passed. Counts overlap; do not add them. |
| Inherited debt | Four original lint findings plus one inherited `SvgDiagram` finding reproduced separately. Repository-wide lint was not rerun. |
| Child browsers | Both commands failed at localhost startup with `listen EPERM` before Chrome. No new child native acceptance. |
| Matching parent | npm test/build/diff/label-assets passed. Free-labels failed at the final selection diagnostic; unchanged exact checkout. |
| Cumulative browser evidence | 16/18 groups completed,17 started,193 evidence records/4,761 diagnostics; no top-level page errors. Ten of12 layout scenarios passed before the failure. |
| Remaining acceptance | Both pending layout scenarios incomplete; transparent stopped in preparation before export. White pending and final standalone were not executed. Combined layout is incomplete. |
| Review/status | Fresh independent completion review has not started. Phase32 incomplete; no commit or push. |

The passed layout scenarios include all prior spacing/anchor/controls/import/
isolation/native cases, signed-polygonal/zero-axis coverage and the singular,
subsp and folded cylinder cases. Keep all12 registered named scenarios.
Do not report the local diagnostic timeout as a production browser page error;
retain its actual outer failure and secondary-error record.

## Proven failure boundary and pending state

Current stack:
`pointGeometricSelection.mjs:595` →
`pointLayoutPendingPreparation.mjs:282` →
`checkPointLayoutAnchors.mjs:194/1053` →
`checkFreeLabels.mjs:487`.
The nested cause is the final-evidence2,000ms timeout, not a failed contour hit
or initial-render timeout.

Resolve `point-layout-selection-0819.json`, `point-layout-selection-0821.json`
and `point-layout-selection-0823.json`, plus their pending-preparation and outer
failure/cleanup records.
The retained native proof shows unselected→`layout-circle`, fresh fraction`.23`
click at approximately(593.5371704101562,1134.83984375), exactly three trusted
primary down/up/click events, pointer1, revision461, all modifiers false,
dropped0 and actual circle/owner targeting.
Model/runtime/history/revision/UI, held source, request and current point-node
owner remain unchanged. Inspector closed natively and inherited expanded toolbar
was restored. Native snapshots have no observation errors.

After toolbar restoration/assertion, `selection-finished` persistence times out.
Its immutable raw snapshot was taken BEFORE expiry and has no primary/secondary
errors; the later outer failure records the diagnostic timeout.
Keep both temporal truths. Do not rewrite the frozen observation to imply a
later failure was present at capture.

`preparePendingLayoutPoint` did not reach after-native-selection capture,
terminal preparation validation or SVG export. Its raw result stays observed,
with the AggregateError. Modifier-observer cleanup completed; held-source
release→null and export-listener release were failure cleanup with no errors.
Cleanup release does not prove pending acceptance, download or intended release.

The helper's final diagnostic wraps a pending callback that clones the native
observation, reads modifiers and awaits the caller diagnostic, then `retain()`.
The caller publishes the raw observation and running report; pending retain
publishes its raw observation/report and named preparation artifact.
Five ordered publications, plus cloning/page work, can occur under the same
outer2,000ms diagnostic. Inspect the real call path and shared publisher queue.
Do not remove required preparation/report stages to shorten it.

## Measure and remove authenticated metadata amplification

The current authority index is about86.16MB for859 documents/2,810 boundaries.
The compact serialized checkout is98,708 bytes; each document identity repeats
it. Documents metadata alone is about85.18MB.
Recorded index writes:2,812, totaling125,417,437,237 bytes.
This is measured metadata amplification, not proof of the timeout's direct cause.

Failure-adjacent diagnostic/report/preparation publications2797→2798→2799 all
committed as running. Individual retained pack/boundary timings are small;
recorded index I/O is roughly18–25ms.
`atomic(..., jsonBytes(index()))` starts timing AFTER index serialization.
Current metrics omit that serialization and do not isolate end-to-end callback,
clone, hash, queue wait or deadline/authority timing.
Do not equate I/O-only timing with total persistence time or assert a late commit
occurred after expiry without a timestamp proving it.

Add small owned monotonic timing/progress records at the actual producer and
authority boundaries: operation start/deadline, snapshot/clone, encode/hash,
queue wait, pack/boundary/index serialization and writes, authentication,
document authority commit, report checkpoint, preparation retain and operation
completion/expiry. Associate them with owner/token/generation/sequence.
Capture timing before/after the expensive work; metrics must not recursively
publish large snapshots or introduce new unbounded diagnostics.

Remove repeated complete checkout metadata from the frequently rewritten index.
A canonical authenticated checkout with compact exact identity references is
a supported approach. Preserve its revision, tracked diff, fingerprint and all
571 filename→hash entries, including every evidence file.
Resolve/reconstruct the complete logical identity and compare it strictly before
accepting a document. A fingerprint alone or a stripped metadata envelope is
insufficient. Reject wrong owner/tree/ref/hash/sequence, missing or substituted
identity, cross-checkout documents and stale/nonlatest authority.

Inspect ordered pack/reference metadata too: current boundaries repeat the
accumulated pack list (about729KB near this failure). Share immutable authenticated
ordered references/chunks if needed, preserving all historical reachable packs,
bytes, paths, lengths, hashes and traversal order.
Keep per-document pointer, index and history consistency, frozen observations
and complete raw values/order. Reduce the hot repeated work instead of deferring
mandatory validation outside the diagnostic deadline.

Update the strict reader/parent replay and necessary copied dependencies with
any representation change. Version it narrowly if required; retained old reports
must still resolve and authenticate under their declared schema.
Do not add permissive legacy fallback, filename exemptions, skipped historical
references, broad field stripping or inferred raw success.
Preserve pre-assertion evidence, immutable packs, chunked report arrays, exact
raw resolution, atomic authority, primary-error disposition and complete replay.

## Own outer diagnostic expiry through the composed operation

`boundedPointDiagnostic` owns late promise rejection but does not cancel the
underlying callback. Publisher5,000ms ownership is separate from outer2,000ms.
A timed-out final diagnostic can leave its nested publication/report/retain
work running unless the producer's expiry is propagated and authority is guarded.
The existing record does not timestamp all late commits; establish the behavior.

Give the composed operation explicit ownership/expiry at the actual boundary.
Check it before every subsequent observation/checkpoint/preparation publication
and authority transition, including queued work.
Use the absolute monotonic deadline at these checks; synchronous serialization
can delay the timer callback, so timer delivery alone cannot authorize a commit.
After expiry, late fulfillment/rejection must be consumed and cannot create
a running/pass checkpoint, resurrect successful selection/preparation, mutate
the primary error or overwrite failed/terminal authority.
Already committed before-expiry raw records remain valid historical evidence.

Keep cleanup/failure persistence separately owned and bounded so it can save
the actual failure and release modifiers, inherited UI, conversion hold and
export listener without reviving the expired success operation.
Retain original native/assertion Error identity when one already exists.
For this no-earlier-primary case, preserve the diagnostic timeout in the thrown
AggregateError and secondary evidence. Further cleanup/write failures cannot
replace or hide it. Do not return a rendered/passed preparation until its required
final evidence and validation have fully completed.

Keep immediate rejection ownership, generation guards, pending gate settlement
and owned cleanup for all callers. Maintain diagnostic result`observed` versus
accepted scenario result`passed`.
No fire-and-forget persistence, promise-ignore/fake success, swallowed final
diagnostic, extra click, retry or moved unbounded final writer.
Preserve production2,000ms/5,000ms deadlines, normal page/I/O/capture/cleanup
limits and the existing deterministic deadline seams; no global timer mock,
new sleep, increased deadline or heap/concurrency flag may hide the problem.

## Meaningful integration and deterministic regressions

Exercise the actual `selectGeometricPoint` → pending wrapper →
`createPointDiagnostics` → observe/report → pending retain/publication composition,
using faithful measurement/state fixtures and ordinary asynchronous file writers.
Tiny-checkout publisher tests, nine-boundary retainers or an immediate diagnose
stub do not exercise the observed metadata size/nested queue path.

Use a realistically large checkout with hundreds of separately hashed evidence
entries, accumulated document/pack history and the same raw final/preparation
shape. Share expensive immutable setup where appropriate; keep independent
negative controls. Prove exact lossless raw/report/history replay and bounded
metadata growth, including index/identity reference bytes, without duplicating
the present125GB write pattern in a regression.

Add controlled entered/release gates at the intended final diagnostic boundary,
using its existing scoped scheduler seam or a narrowly owned seam at the real
operation. Ordinary file I/O, measurements and image work retain normal deadlines.
Assert deadline values and gate entry deterministically; do not charge expensive
fixture construction to an arbitrary short real timer.
Test success, queued freezing before mutation, controlled expiry, late fulfillment,
late rejection, earlier native/assertion failure and cleanup failure.
A metadata/identity corruption must fail strict parent replay, not get normalized
away. Cover missing/wrong owner/identity/chunk/hash/order/sequence and both old/new
authenticated representation paths if a schema is changed.

After controlled expiry, release/drain every owned operation and assert no late
running/pass/primary mutation, no orphan/unhandled rejection, stable failed/
terminal authority and exact listener/modifier/UI/held-source cleanup.
After success, final selection/preparation artifacts must be completely published
and resolve before the helper returns. Keep the one trusted native gesture,
state/history/source/request/current-owner invariants and real acceptance gates.

Complete affected files and the registered full suite under normal settings.
Record first outcomes, zero failures/cancellations/skips and complete counts.
Diagnostic retries or isolated passes cannot replace repeatable full-suite or
fresh browser verification.

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
historical cause. The current native final-evidence timeout is a distinct blocker.

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
Update both Phase32 docs to the observed final-evidence failure, measured
metadata amplification, established ownership/optimization fixes and actual
completed checks. Separate child EPERM, parent partial native success, new
verification and independent review. Do not claim the historical verifier
cancellation cause was proven or that the current operation already passed.

Run focused publication/authentication/reader/report/deadline/pending-selection
composition and strict parent-corruption/runner tests, plus preserved cylinder/
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
Final standalone must execute and pass. Do not reuse u4oMpK acceptance after edits
or substitute its ten passed layout cases for a complete current run.

Preserve clean-tree rules; do not reset/stash/discard inherited work or commit.
If child startup hits EPERM, record the exact failure/tree and continue through
approved browser-capable parent execution without relaxing coverage.
After every required check completely passes, obtain fresh independent read-only
completion review using `prompts/phase-32d-review.md` on exact matching tracked/
untracked bytes and inspect actual resolved reports/artifacts.
Require complete reviewer/full-suite success and all current native/file gates.
An incomplete/cancelled reviewer run or needs_changes blocks completion/commit.
Keep the post-review matching-tree guard.

Report the established cause and scoped publication/composition/ownership fix,
meaningful regressions, authenticated metadata/timing results, exact changed
files, first completed focused/full/browser outcomes, baseline failures and
tree/report hashes. Show preserved source/reference identities separately.
Phase32 remains incomplete until every required gate passes.
Leave commit/push to the parent after verification and review.
