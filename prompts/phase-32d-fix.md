# Phase 32D Fix for signed anchors, arc picking and deterministic report tests

## Objective and scope

Continue from the implemented Phase32D checkout and its successful cumulative
parent browser/download verification. Independent review returned needs_changes:
two production geometry defects and one full-suite reliability defect remain.

Correct all three targeted issues:

1. Preserve signed fitted ellipse/rectangle axes when resolving PGF anchors.
2. Use radius magnitudes for arc sampling density so negative radii do not
   collapse the shared picking contour.
3. Isolate ordinary writes from the stalled-report test's short deadline,
   preserving its timeout, primary-error, late-rejection and cleanup assertions.

The resolved-preview/native `110` provenance correction is implemented.
Keep it and the complete native view/pending/inline/download/capture contracts.
This iteration permits narrow production geometry corrections justified by the
review. Do not rewrite unrelated rendering, model, camera, persistence or UI.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree and independent evidence first.
Maintain cumulative strict verification, verification-before-review/commit and
the parent's exact-tree post-review guard. Phase32 remains incomplete.

## Latest evidence and exact checkout

Child handoff:
`/private/tmp/stz-32d-resolved-provenance-20261011/HANDOFF.txt`.
Its six-file diff, identities, preservation summary, reports and logs are adjacent.
The newer browser-capable parent and subsequent review supersede the child's
startup-only and acceptance-pending status for that same implementation tree:

- Parent worker:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-ortrXN/response.json`.
- Passed strict verification:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-kpMSxP/verification.json`.
- Native report/artifacts:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-kpMSxP/05-check-free-labels/artifacts/`.
- Review findings and machine summary:
  `/Users/takamatoshinori/.codex/attachments/9c144160-38b9-4093-8c21-8fb48664e343/Pasted text.txt`.
- Independent PGF and fixed-metric production reproductions:
  `/private/tmp/stz32d-review-layout/manifest.json`, with authenticated input,
  raw geometry, compilation, reproduction script and production results.
- Reviewer failed full-suite log:
  `/private/tmp/stz-32d-review-npm-test.log`.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `8067dea1c9e43a1387a7b6083ff2d1805e4c9752`.
Pre-prompt current identity matches parent checkout/checkoutAfter and child:

~~~text
6a4c53cdf0a1a230294154f0723916f6d8c8549bb19596d681af57896a25639d
~~~

Preserve six modified tracked files: `docs/PHASE_32D_IMPLEMENTATION.md`,
`docs/PHASE_32_PLAN.md`, `scripts/pointLayoutPendingView.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/pointLayoutPendingView.test.mjs` and
`tests/scripts/pointLayoutPendingViewFixture.mjs`.
There are no untracked files. Prior fixes are tracked in the actual baseline.
The prompt edit changes identity; capture the actual current tree rather than
hard-coding retained identity as future acceptance. Do not reset/stash/discard
or commit existing work to bypass implementation/fix guards.

| Retained run | Actual result |
| --- | --- |
| Resolved-provenance child | 6,361/6,361 tests, 1,334 focused checks, 37 runner checks, build/diff/changed-script lint/syntax and fixture TypeScript passed. Fresh strict/direct browser attempts stopped before Chrome at server `listen EPERM`. Baseline lint/type checks remained failed. No completion review/commit/push. |
| kpMSxP parent | Required tests/build/diff/label-assets/free-labels all passed. Node v26.9.0, Chrome154.0.8037.98. All18 cumulative groups completed, none incomplete/unexecuted, no page errors, matching before/after identity. |
| Subsequent independent review | needs_changes, zero Critical, three Medium, ready_to_commit:false. Reviewer full suite failed6,360/6,361 with zero skips; build passed. Reported focused geometry/oracle241/241, model/export62/62 and policy478/478 passed; focused TypeScript/lint/syntax/diff passed. Isolated16/16 does not clear the full-suite failure. Existing baseline debt was reproduced separately. |

The parent now accepted both transparent/white pending layout SVG downloads,
actual reopening/complete PNG, both TikZ modes and final standalone exports.
Transparent post-click view has one native fill, zoom1→1.4 and all three
before/immediate-input/after stages. The whole geometric and eight layout
scenarios passed. Keep these as authentic retained results; they do not cover
the newly discovered negative-dimension cases or substitute for verification
of the next changed tree. Review rejection, rather than a browser startup or
pending download failure, is the current completion blocker.
No commit/push followed the review.

## Signed ellipse/rectangle anchors

Inspect `src/geometry/pointNodeShapes/solve.ts`, `anchors.ts`, `types.ts` and
the authenticated PGF basic/geometric source and review artifacts.

For an empty ellipse or rectangle with:

~~~text
inner xsep=-100pt, inner ysep=-100pt
minimum width=-160pt, minimum height=-160pt
outer xsep=0pt, outer ysep=0pt, anchor=east
~~~

Validation and save/load succeed. PGF resolves east to(-80,0)TeX pt.
Production resolves east to(+96,0)SVG units at1.2 units/pt, i.e.(+80,0)pt.
Correct placementOffset is(+96,0); current offset is(-96,0).
Preview/settled SVG and TikZ disagree by160pt.
Raw PGF north is(0,-80) in its positive-Y-up frame; convert Y exactly once
when comparing with SVG. The smaller fixed20/8/3pt body with inner-30pt and
minima-2/-5pt likewise has PGF east-1pt versus app+1.2SVG units.

The solver's ellipse/rectangle construction already computes signed fitted axes:
rectangle max(padded half-size, minimum/2), ellipse
max(sqrt(2)*padded half-size, minimum/2).
`anchors.ts` reconstructs axes from ordered painted bounds.maxX/maxY,
which loses their signs. Paint bounds describe the envelope, not PGF's
signed saved dimensions.

Preserve authoritative signed fitted axes through a small pure construction/
anchor boundary, or an equally narrow shared fitting calculation.
Apply each axis's own outer separation to its signed fitted axis before anchor
resolution. Do not infer sign from sorted envelope bounds or sparse vertices.
Keep named compass/text-side and numeric border semantics distinct, including
ellipse eccentric compass diagonals versus radial numeric directions.
Preserve PGF's signed comparisons, zero-axis behavior, numeric parser/range/
rounding branches and negative outer-separation rules.

Do not clamp, reject or absolute-value authored dimensions/fitted anchor axes.
Do not change model coordinates, saved version2, Inspector validation or TikZ
source to hide the disagreement. Keep ordered finite painted bounds, true SVG
paint contours, upright body/baseline/anchor placement and shared preview/export
coordinates. Do not change circle/diamond or other shapes without independent
evidence requiring it.

Correct the narrow README explanation that negative minima are always inactive:
`src/geometry/pointNodeShapes/README.md` currently states that around lines62–63.
They can dominate when fitted content axes are more negative. Describe the
observed PGF max behavior; preserve valid negative dimensions and genuine
upstream singular-branch diagnostics.

## Negative radii and picking density

Independently inspect `src/geometry/pointNodeShapes/contours.ts:75`:
`ShapeContourBuilder.arc` uses `Math.max(rx,ry)` to choose the sagitta step.
For rx=ry=-96 it takes the small-radius π/2 branch and samples four cardinal
vertices, even though the actual SVG path paints a radius96 ellipse.

The retained production picking reproduction is `ellipse-strong`, nonempty
source `x`, anchor center. Local(67.2,-67.2) lies95.035 units from the center,
inside painted radius96; the sampled diamond boundary is27.153 units away,
beyond existing six-unit proximity tolerance, so candidates are empty.
`ellipse-empty` independently records empty-source east placement and the same
negative radii/four vertices. Empty-source center picking is a required new
regression, not an already recorded browser observation.
The PGF/fixed-metric reproduction bundle is independent/pure evidence,
not native browser acceptance.

SVG rendering normalizes arc radius signs to magnitudes; see the primary
[SVG arc parameter rules](https://www.w3.org/TR/SVG/paths.html#ArcOutOfRangeParameters).
Use `max(abs(rx),abs(ry))` for sampling density.
Preserve signed coordinate construction, start/end progression, endpoints,
sweep flags, rotation and analytic extrema. Do not apply a blanket absolute-value
change to the path/PGF fitting/anchor math.

Keep0.005-unit sagitta precision and the bounded2048-sample arc budget.
Large negative magnitudes must receive the same precision/work guard as their
positive counterparts. Preserve zero-axis/degenerate behavior and excessive-work
rejection; do not enlarge the budget/tolerance or add a blanket circle hit region.
Shared current contour/paint/picking/export consistency and layer/filter/lock/
owner/request/stale-result guards remain mandatory.

## Independent and production regressions

Add a compact registered set that fails against the current production defects.
Retain all existing reference files, hashes and tolerances byte-for-byte,
including the original172-box/4,925-anchor/11-failure inventory and32C references.
Add separately authenticated negative-padding-plus-negative-minima PGF evidence;
do not overwrite old oracles or regenerate expectations from production.

Start from the review's manifest/input/raw outputs, verify hashes and engine/
PGF versions, and retain reproducible no-shell-escape commands, complete input,
compiler output, raw paths/anchors and independent parsed observations in the
repository. Supplement cases through actual PGF when needed, keeping production
solvers/support tables out of oracle generation.
Document TeX pt versus1.2 SVG units/pt and Y-up/Y-down conversion.
Do not enlarge geometry tolerances to fit incorrect signs/sparse contours.

Cover a small purposeful set: empty strongly negative ellipse/rectangle,
the recorded nonempty small-minimum case, mixed-sign axes and an outer separation
crossing an axis sign. Check PGF-backed east/west/north/south, appropriate
diagonals/text-side and numeric directions without assuming their equivalence.
Wrong-sign/absolute-axis controls must fail, including correct absolute paint
bounds paired with incorrect signed anchors.

Use existing geometry/reference and rendering integration suites where practical:
`tests/geometry/pointNodeLayoutAnchors.test.ts`,
`tests/geometry/pointNodeAnchorReferences.test.ts`,
`tests/geometry/pointNodeShapes.test.ts` and
`tests/rendering/svgPointNodeAnchors.test.ts`.
Verify correct selected anchor/placementOffset at scale1.2, unchanged model
coordinates and signed source/provenance through validation/save/load and both
TikZ modes. Preview/current/settled SVG must share placement for the same body.

For picking, assert analytic contour precision and production candidate inclusion
at the recorded oblique interior point; include empty-body center and meaningful
mixed-sign/dominant-negative axes. Keep a genuinely outside point excluded under
existing tolerance. Overlapping candidates must allow Alt cycling to this
ellipse while honoring current ownership/filter/lock guards.
Exercise both ambient dimensions through appropriate production projection,
preserving2D z=0 and3D active work planes; avoid a large redundant cross product.
Vertex count alone is not sufficient proof of contour or interaction correctness.

Retain genuine native acceptance for corrected placement/picking through the
existing cumulative workflow where applicable. Any new native case must use
actual current controls/CTM/hit/owner evidence and be required by its raw contract/
parent policy; synthetic flags cannot establish native Alt-cycle success.
Keep observed/failing records persisted before assertions and distinguish
pure/fixed-metric, synthetic and real browser evidence honestly.

Register new tests in the explicit `npm test` list and copy actual imported
dependencies into isolated runner fixtures. Do not skip new/old cases or
silently omit references from full verification.

## Deterministic stalled-report test

The review full suite failed at
`tests/scripts/pointNativeFocused.test.mjs:237–246`,
`a stalled failure report has a finite deadline and owns its late rejection`.
It expected injected `native first error` but received:

~~~text
Timed out after 20ms during focused-point-native-evidence.json write
~~~

`diagnosticTimeoutMs:20` covers all injected writes, including ordinary
`writeFile` calls for startup/running reports before the native error is reached.
Under full-suite filesystem load a normal report write can time out first.
The runner then correctly owns that timeout as primary.
This is fixture isolation failure, not justification to change production
timeout or primary-error priority.

Limit the fix to this test's injected writer. Make ordinary writes complete
immediately through an in-memory recorder; only result===failed report writes
should return deliberately unresolved controllable promises.
Retain the actual short20ms bounded diagnostic path and production helper
`boundedPointDiagnostic` unchanged.
Other existing tests continue covering real filesystem/report serialization.

Require exact injected native Error identity and one arrival at nativeChecks,
two failed-report attempts, finite timeout of each stalled operation and owned
late rejections fired after runner completion and drained without unhandled
rejection. Keep listener removal → page close → browser close → server close,
empty handlers and cleanup even when report capture/write fails.
Record/inspect ordinary write arguments and failed report payloads as needed
without racing normal disk latency against the intentional20ms stall.

Do not increase deadlines to mask the race, change test concurrency globally,
skip/mark flaky the test, retry until a pass or remove primary/late-error/cleanup
assertions. Preserve all production diagnostic/owned-runner/resource semantics.
Run the focused suite and a fresh full `npm test` with normal project concurrency.
A focused16/16 pass alone does not clear the review's required full-suite failure.

## Preserve completed layout, native and capture work

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
correct by this review; preserve it without applying that exception to these
signed-axis defects. No unrelated reference issue was found.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling, one actual image/no retry, complete-root coverage, at most
one viewport expansion, stable coordinates and exact SVG/PNG file identity.
Keep pre-image reopening records, owned cleanup, primary errors and no extra
failure screenshot. Preserve actual PNG CRC/chunks/inflated scanline/dimensions/
byte validation, artifact inventories, raw-policy checks and runner copies.

## Fresh verification, review and handoff

Use strict TypeScript without `any`; keep module separation, codim convention,
user raw text and model coordinates. Add no dependency without explaining why.
Update Phase32 status documents with actual new scope/results and README's
signed-minimum correction; retain baseline debt and evidence history accurately.

Use Node>=22.12.0 through Homebrew. Run focused independent PGF/geometry/
production placement/picking, deterministic focused-runner, resolved-provenance/
view/pending/capture, parent-policy/ownership and isolated runner checks.
Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused strict TypeScript/lint and changed-script syntax checks.
The reviewer full-suite failure is required work, separate from documented
baseline geometric-script no-unsafe-finally, verifier unused _role, layers unused
defaultCurveStyle and eleven inherited focused-TypeScript diagnostics.
Baseline failed checks remain failed; do not relabel them as passes or expand
into unrelated cleanup.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and the actual preserved dirty tree:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all twelve31F groups, three32A groups, complete32B paint/import,
complete32C shapes/visibility/downloads, full combined32D layout and final
standalone exports. Require both pending downloads/reopening/complete PNG/TikZ,
native geometry/history/JSON persistence, actual valid artifacts and no page errors.
Do not reuse kpMSxP after geometry/test edits, skip predecessors, adopt deferred
profiles or substitute scoped/synthetic reports.
If child attempts stop at server EPERM, retain exact startup failure/identity and
remaining native acceptance for the parent without weakening rules.

After all fresh required checks pass, obtain independent read-only completion
review of the exact matching tracked/untracked tree with
`prompts/phase-32d-review.md` and inspect actual reports/artifacts.
Require the three findings resolved with authenticated negative-case evidence,
full-suite success and fresh cumulative native/download acceptance.
Preserve stop-before-review/commit on failed verification and the parent's
post-review exact-tree guard. needs_changes prevents completion/commit even
when an earlier verification passed.

Report the scoped signed-axis/sampling/test-fixture fixes, additive authenticated
references, preserved contracts, changed files, focused/full checks and any
baseline failures, current native/download coverage, exact tree/report identity
and independent review result. Keep Phase32 incomplete until all gates pass.
Leave commit/push to the parent after verification and review.
