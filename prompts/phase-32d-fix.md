# Phase 32D Fix for cylinder fitting/anchors and repeatable reviewer verification

## Objective and scope

The matching strict parent passed. New independent read-only review returned
needs_changes, Critical0 / Medium3 / Low0, ready_to_commit:false.
Fix all three current issues:

1. Cylinder anchor construction loses fitted signs and end/base role ordering
   by reconstructing them from painted bounds.
2. Cylinder zero-divisor diagnosis ignores TeX dimension scanning/fitting and
   therefore misses dimensions that become zero scaled points.
3. The freezing regression has a machine-dependent real1s deadline; the required
   reviewer suite also stalls/cancels with an unresolved verifier promise.

Limit production work to runtime cylinder fitting/anchor metadata and the
PGF-equivalent cylinder domain classification needed for these reproductions.
Limit test/automation work to deterministic freezing/deadline/promise ownership
and required regressions/native/file replay integration.
Preserve raw model/options/units/text, valid signed/degenerate geometry,
previous singular-cylinder diagnostic, deterministic live-writer scheduling,
existing native/capture/association/empty-body/publication contracts.
No unrelated model/schema, renderer, math/exporter or concurrency rewrite.

Read `AGENTS.md`, implementation/review prompts and both Phase32 docs.
Inspect authenticated PGF/actual-generated reproductions and complete reviewer
log before edits. The passed parent cannot override needs_changes.
Phase32 remains incomplete; verification-before-review/commit and matching-tree
guards remain mandatory.

## Latest review, accepted parent and identity

Newest review:
`/Users/takamatoshinori/.codex/attachments/07495896-70ab-4961-9698-51b4e3bb7c8f/Pasted text.txt`.
Reviewer records:
`/private/tmp/stz-32d-review-1791812464902/review-verification.json` and
`npm-test.log` in that directory.
Independent PGF/production reproductions:
`/private/tmp/stz-review-cylinder-empty-folded-2yP0XK/comparison.json`;
`/private/tmp/stz-review-cylinder-subsp-y0liua/comparison.json`,
with all sibling TeX/raw/compiler/generated/production artifacts.

Matching passed parent:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-dTPBzJ/verification.json`.
Fresh reviewer policy replay/audit:
`/private/tmp/stz-phase32d-review-evidence-20261012/browser-evidence-audit.json`.
Resolve its authenticated browser artifacts with `readEvidenceDocumentSync` and
the exact checkout. Previous implementation handoff:
`/private/tmp/stz-32d-cylinder-timeout-fix-20261012/HANDOFF.json`.
The child T6o1A2 startup failure is historical; dTPBzJ is the accepted parent.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `f4dbfd7c7930515f6cd1d57db17ad32a96fc4d47`.
Pre-prompt identity matches parent/review before/after:

~~~text
55b5887a001d5bb2f7a8182aaf7802c6049b39276372d7572d36e3d196c48452
~~~

Tracked-diff SHA256:
`44aaf730e6bfd80aa02a3e4b9d2c29733e645b6fe1a116aaf34f0c27de50eb9b`.
Preserve13 modified tracked files: both Phase32 docs; `package.json`;
`scripts/automation/phase-verification.mjs`,
`scripts/checkPointLayoutAnchors.mjs`, `scripts/pointCheckDiagnostics.mjs`,
`scripts/pointLayoutAnchorsContract.mjs`,
`scripts/zeroAxisLiveCaptureWorkflow.mjs`,
`src/geometry/pointNodeShapes/solve.ts`,
`tests/scripts/phase32dParentEvidenceFixture.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs` and
`tests/scripts/runPhaseVerification.test.mjs`.
Preserve116 untracked files:110 additive evidence files under
`tests/fixtures/point-node-anchors/cylinder-domain/` plus
`scripts/singularCylinderDiagnostic.mjs`,
`scripts/singularCylinderDiagnosticContract.mjs`,
`tests/geometry/pointNodeCylinderDomainReferences.test.ts`,
`tests/rendering/svgPointNodeCylinderDomain.test.ts`,
`tests/scripts/singularCylinderDiagnostic.test.mjs` and
`tests/scripts/singularCylinderFixture.mjs`.
Use the handoff/report's exact inventories/hashes; do not reset/drop prior work.
Prompt edits change identity; future gates must capture actual tracked/untracked
bytes rather than reuse this fingerprint.

| Evidence | Actual result |
| --- | --- |
| Matching parent | All five checks passed,7,094/7,094 tests, zero failures/skips; both browser checks accepted. Node26.9.0 / Chrome154.0.8037.98, unchanged exact checkout. |
| Browser/reviewer policy | All18 groups and10 layout scenarios accepted,203 records/4,625 diagnostics; no missing artifacts, page errors, incomplete/unexecuted groups. |
| Reviewer full suite | 7,055 observed:7,053 passed,1 failed,1 cancelled. Interrupted after no progress for over two hours; incomplete. These counts are not complete registered-suite acceptance. |
| Other reviewer checks | Isolated freezing/closed-title retries each1/1 passed; geometry/reference/render538/538 and model/layout/TikZ/export74/74 passed. Build, strict app/new-test TypeScript, changed-code lint,14 syntax checks/diff passed. Four scoped baseline lint errors reproduced; repo-wide lint not run. |
| Review disposition | Two production defects plus unsuccessful full reviewer verification remain. No Critical/Low issues; needs_changes, ready_to_commit:false, no checkout changes or commit. |

The raw-ry0 guard, diagnostic-download parent route and intended live-writer
deadline fix are implemented predecessors. Preserve them rather than redoing
the prior review. HoyCdl and earlier blockers are history.
Complete parent acceptance does not excuse reviewer failures or missing PGF
conformance; fresh verification/review of the next tree is required.

## Retain signed cylinder construction and declared end/base roles

Folded reproduction: empty body, innerXSep−30pt, innerYSep5pt, minima1pt,
outer sep0, line width0.4pt, anchor bottom.
Independent PGF succeeds; expected bottom(4.6,0)pt, production(0.6,0)pt.
The4pt error becomes4.8 SVG units at1.2 units/pt and shifts preview/picking/
settled placement. Shape center is PGF≈5.09999 versus production3.1;
several compass/text-side/numeric anchors fail, maximum retained residual≈5.33625pt.

This case has positive `rx=ry=5`. Axial minimum produces halfLength≈−4.6,
actual endCenter≈0.6 and baseCenter=9.6: their geometric left/right order folds.
At `anchors.ts:589`, bounds-derived radius magnitudes and
`baseCenter=bounds.minX+rx` reconstruct base≈5.6, losing the true role.
A negative-radius-only or bottom-only fix leaves evidenced errors.

Preserve signed fitted radii, actual unrotated end/base centers, top/bottom
role points and needed fitting state from `solve.ts` as runtime-only metadata,
following the existing signed-axes/polygonal fitting pattern.
Anchor resolution must use that construction, not min/max paint envelopes.
Keep stored model/history/clipboard/TikZ schema unchanged.
Document the coordinate frame and apply SVG Y conversion/rotation exactly once.

Keep painted bounds ordered and paint outline/seam/custom regions independent
from clearance. Do not reorder end/base by x, take absolute radii for fitting,
reject folded layouts or move model coordinates to hide the mismatch.
Preserve PGF end-arc clearance `max(outerXSep,outerYSep)` and side-point
`outerYSep`, signed external-radius behavior, named/text-side/numeric anchors,
declared segment/angle branch order, infinite-line selection and bounded arc
bisection/finite-work guards.
Confirm upstream semantics rather than infer geometric “outward” conventions.

Add a separate authenticated full-anchor bundle for the retained folded case:
all23 named anchors including cylinder/text sides, plus meaningful numeric
spellings/angles. Existing domain controls cover only8 anchors normally and
5 for the deeply signed control, so they cannot close this finding.
Add compact independent neighbors for signed nonzero fitting, axial/transverse
minima, `rx0/ry>0`, rotation90/270/incircle, unequal signed outer sep and unitScale.
Check paint paths/seam/regions separately from all anchor/placement results.
Keep existing inputs/raw/compiler/source hashes and Y-frame provenance,
0.025pt anchor/0.03pt contour tolerances and original references unchanged.

## Diagnose TeX-scanned zero transverse dimensions

Subsp reproduction: empty cylinder, innerXSep0, innerYSep0.000001pt,
minimumWidth0, minimumHeight80pt, line0.4pt, anchor center.
Actual generated/wrapped TikZ retains those options and fails PGF divide-by-zero.
Production still paints an approximately96-SVG-unit narrow cylinder with
selection radius≈48.4594 and no warning.
`solve.ts:338` tests raw JavaScript `ry === 0`, missing the register-domain zero.

One scaled point is1/65536pt≈0.0000152587890625pt.
The retained1e−6pt scans to zero. Implement a small unit-aware PGF/TeX
dimension-domain evaluation at the same stages as upstream cylinder fitting,
using `unitScale ?? 1` to classify in TeX points.
Do not use an epsilon threshold, raw JS equality alone or round only the final
floating expression.

Authenticate the relevant upstream stages: inner-separation dimension scanning,
separate body-width/height/depth half-products/advances, rotation/innerSep
exchange or incircle fitting, scanned minimumWidth and its dimensional halving,
then the final transverse register used by PGF division.
Half-products/cancellation order can differ from rounding a combined expression.
The existing `pgfRound=Math.round` is asymmetric at negative half-sp ties;
do not assume it is a faithful dimension scanner without independent controls.
Keep dimensional scanning distinct from scalar/reciprocal arithmetic.

Use staged quantization only where required for cylinder PGF-domain classification;
avoid blanket rounding of model values or unrelated geometry/reference results.
Preserve authored0.000001pt/unit source/em/ex context, saved values, history,
coordinates and raw TikZ; do not canonicalize tiny authored values to0.
Classify PGF-equivalent zero before division via the existing RangeError/limitation
route, preserving warning-only live/settled/picking/export behavior and no
invented contour/seam/custom regions/large hidden selection region.

Extend independent references additively with below-half-sp, signed/tie
boundaries and first nonzero±sp neighbors, dimension half-product/cancellation,
rotations/incircle and unitScale/contextual-unit controls.
MinimumWidth1sp halves to0 while2sp can yield1sp; authenticate both.
For negative surviving radii, use minima that do not independently clamp them
to0; retain genuinely valid neighbors instead of blanket rejection.
MinimumHeight80/outerSep/lineWidth must not rescue an earlier zero divisor.
Keep current raw-zero11 failure controls/12 valid controls/93 recorded control
anchors and all110 evidence files byte-for-byte.

## Shared placement/native/artifact regression coverage

Add shared live/pending/settled/model/TikZ regressions for BOTH reproductions
in2D/3D. Folded bottom/full-anchor placement must match PGF while model coordinates,
painted contour and authored negative padding remain intact.
Subsp zero must use the existing warning, empty requested painted bounds, no
contour/seam/regions/internal border, visible body/warning picking and far miss.
Verify same-owner valid→invalid→valid transitions, current source/request/
revision, raw units/context, JSON/history/reload and both TikZ modes.

Extend required current native coverage within the existing cumulative32D
workflow: normal load/Inspector/native input, fresh owner/CTM/projection,
folded anchor placement/contour picking and subsp warning-only behavior across
both ambient dimensions. Persist before-assert observations and real downloads/
reopening/complete PNG/TikZ with exact immutable provenance.
No DEV geometry/selection mutation or contour-only synthetic success.

Preserve all ten existing named layout scenarios, including
`point-layout-singular-cylinder-diagnostic`; register added cases/artifacts and
parent counts honestly without dropping predecessors.
The singular warning-only download uses its dedicated authenticated diagnostic
context, not a filename skip or the seven-owner empty-body route.
Extend its strict raw/model/source/domain/owner/file/PNG replay for the subsp
case, preserving all absence-of-requested-paint and legacy body-gate controls.
Keep generic publication/ref/association/root/CTM validations mandatory.

## Deterministic freezing test and owned verifier progress

Reviewer full log has one explicit failure:
`evidencePublication.test.mjs:130–133`,
`queued observations are frozen before awaiting a writer or another publication`:

~~~text
Timed out after 1000ms during evidence publication before
~~~

The test stalls the first ordinary writer, then constructs/clones/queues a full
fixture and mutates it before releasing the writer. All that ordinary work is
charged to a real1s first-publication budget.
It tests freezing/queue semantics, not a deliberate timeout; heavy full-suite
scheduling can make it fail while isolated execution passes.

Use deterministic entered/release gates and a scoped scheduler/deadline seam
so the freezing property does not depend on machine speed.
Prepare expensive independent fixture/expected values before starting the
deliberately held publication when possible.
Keep actual async ordinary writes, queued snapshot freezing BEFORE subsequent
mutation, exact corrupted-field controls, artifact resolution and lossless
equality. The test must still prove data was frozen at enqueue, not after release.
Retain production5,000ms/default bounded persistence and legitimate timeout tests.
Do not merely increase a real1s/whole-test wall budget or remove the queued
mutation/write/replay proof.
No global clock mock, fake success, concurrency/heap flag change or skipped
case may make the test pass.

Attach rejection ownership immediately to first/queued publications while
awaiting entry; unexpected early failure must fail the test promptly rather
than leave an unresolved entry gate.
Own both gates and all pending outcomes in finally/test cleanup, settle/drain
late fulfillment/rejection and prevent orphan/unhandled operations.
Preserve publisher primary Error identity, terminal/failed pointer authority,
immutable byte refs and generation guards.

The same reviewer run stopped progressing and was interrupted:
file-level `tests/scripts/runPhaseVerification.test.mjs:1` cancellation says
`Promise resolution is still pending but the event loop has already resolved`.
7,055 observed is incomplete; the parent registers7,094 tests.
The logs do not identify a unique root cause or prove this cancellation was
caused by the freezing failure.
An isolated closed-title or freezing pass is not full-file/full-suite acceptance.

Investigate the REAL verifier test path with bounded stage/subtest progress,
owned pending-promise/gate/writer state and cleanup observations.
The last retained contextual missing-title subtest took roughly8.55million ms;
later publication-authority checks follow in source. Use that only as a
localization clue, not as proof of which operation hung.
Inspect awaited subtests, fixture mutations/restoration, publication queue/
authority operations, parser progress and pending gates at the stalled boundary.
Ensure unexpected rejection/cancellation cannot leave a promise waiting forever
or silently let a file appear complete.

Fix the actual ownership/progress defect once established; preserve independent
corruption/whole-parent/raw-file replay assertions.
Do not add a long sleep, bypass the stalled cases, accept cancellation, mock
mandatory validation or treat forced interruption as a completed test run.
Use deterministic injected stalled/failing operations to prove progress,
proper error propagation, gate settlement and complete cleanup.
Keep normal project settings and both existing scoped live-writer deadline
cases (including pre-restoration cleanup); do not regress the prior20ms fix.

Run the affected file and registered full suite to completion with zero failures/
cancellations/skips. Demonstrate controlled contention without relying on repeated
reruns until lucky. Record exact first outcomes and total test counts; individual
diagnostic retries cannot replace complete reviewer verification.

## Preserve completed contracts and independent references

Keep the prior raw-zero cylinder domain guard/diagnostic,11 failure references,
12 controls/93 anchors,110 artifacts and actual-generated wrapper evidence.
Keep native diagnostic case, exact warning structure/pixels/placement and its
strict parent artifact context separate from seven-node empty-body handling.
Keep valid zero-axis ellipse/basic shapes and signed cylinder neighbors.

Retain earlier67 empty-body,72 publication,61 correspondence,65 live-capture and
55 background controls plus the current cylinder/deadline suites.
Preserve source-proven association, actual DOM order, derived ownership,
file-local contour/body/root/placement/paint proof, owner-bound CTM and exact
SVG/PNG/TikZ/model/click/history records.
Keep lossless refs/pack hashes/current checkout, scoped native input/capture,
full-stroke sample data, one PNG, inherited UI restoration and late-writer
failure authority. No reference data or tolerance widening can hide conformance.

Preserve original172 boxes/4,925 anchors/11 original failures, signed-basic8/
192,54 polygonal/1,386,12 arithmetic controls/four dart traces/one singular control,
eleven zero-axis paths/37 render records and490 additive files.
Add new folded/full-anchor/subsp evidence separately with complete independent
inputs/raw/compiler/command/engine/source hashes, nonzero failure status where
appropriate and single PGF-Y conversion.
Keep0.025pt anchor/0.03pt contour tolerances,0.005 precision/2048 finite-work budget.
No TeX/runtime dependency or saved-schema change; strict TypeScript without any.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier stalled-report race was resolved; preserve that targeted control.
The global20ms live-writer race was corrected with scoped scheduler control;
preserve that fix. The newest freezing-test deadline and unresolved verifier
promise are separate current blockers.

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

Use strict TypeScript, small pure helpers and separated model/geometry/rendering/
TikZ/UI. Add no dependency without explaining why.
Update Phase32 docs to the three actual findings/fixes, additive reference
inventory and real completed outcomes. Separate parent pass, incomplete reviewer
run, focused/isolated diagnostics and new verification.
Do not mark Phase32 complete based on the passed parent alone.

Run focused full-cylinder-anchor/scanning/neighbor/placement/render/picking/
model/TikZ cases, deterministic freezing/progress/owned-promise regressions and
preserved native/publication/association/artifact/pending/standalone/runner checks.
Use Homebrew Node>=22.12.0 and normal project settings:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run focused strict TypeScript, changed-code lint and script syntax/diff.
Keep four reproduced scoped inherited lint findings separate from new-code
checks. Latest reviewer did not run repo-wide lint; older debt remains documented.
Do not clean unrelated debt or claim unperformed checks.

Run fresh browser-capable strict parent verification on changed actual bytes:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 groups and all ten current layout scenarios plus mandatory new
folded/subsp coverage, both ambient dimensions/native/live/standalone records,
all old polygonal/zero-axis/singular cases, both pending transparent/white
workflows/PNG/TikZ, complete artifact/targeted/reference replay and no page errors.
Do not reuse dTPBzJ after edits or substitute scoped/synthetic/isolated passes.
Complete full-suite success and native/file acceptance are required before review.

Preserve clean-tree rules; do not reset/stash/discard/commit unfinished work.
If child startup hits EPERM, record exact failure/tree and use approved
browser-capable parent execution without relaxing coverage.

After required checks completely pass, obtain fresh independent read-only
completion review using `prompts/phase-32d-review.md` on exact matching tracked/
untracked bytes and inspect actual resolved reports/artifacts.
Require ALL three findings resolved: PGF full-anchor conformance, TeX-scanned
domain diagnosis with valid neighbors, deterministic COMPLETE reviewer/full-suite
verification and fresh cumulative acceptance.
An incomplete/cancelled reviewer run or needs_changes blocks completion/commit.
Keep post-review matching-tree guard.

Report scoped cylinder/runtime metadata/domain and test-progress fixes,
additive independent evidence, meaningful regressions, changed files,
focused/full COMPLETED checks, baseline failures, exact identity/report hashes
and independent review outcome.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
