# Phase 32D Fix for authenticated standalone point correspondence

## Objective and scope

Continue from the implemented geometry, root/background native input and separate
unobstructed live-capture lifecycle. The newest parent passes the2D zero-axis
native sequence and strict live PNG proof, then rejects the first standalone
SVG because the checker pairs DOM order with model order.

Correct the scoped standalone identity/order association in observations,
caller assertions, parent raw/file replay and faithful fixtures.
Keep real SVG document order and immutable model/click expectation order distinct;
bind each actual node to its authenticated point before exact contour/placement
comparison. Resolve the zero-axis pixel CTM through that binding too.

Limit changes to these evidenced standalone harness/contract/fixture branches,
necessary isolated runner copies and Phase32 status documents.
Preserve production rendering/export order, metadata sanitization, geometry,
paint/picking, camera/model coordinates, raw text/units, saved version2,
authenticated references and complete-root capture helpers.
Do not repeat the resolved live-capture fix or alter the generated SVG/model
to make the checker indices align.
Any later production change needs separately retained independent evidence.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect the actual downloaded SVG and raw reopened nodes.
Maintain cumulative strict verification, verification-before-review/commit and
the post-review matching-tree guard. Phase32 remains incomplete.

## Latest handoff, parent failure and identity

Implemented live-capture handoff:
`/private/tmp/stz-32d-live-capture-fix-20261012/HANDOFF.json`.
Its preservation audit, native-input/pixel-oracle span audit, exact inventories,
65 new regression controls, retained obstruction records and logs remain evidence.
Child strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-3rUZue/verification.json`.

Newest parent verifier:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-qlY8X8/response.json`.
Strict report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-BjrAYN/verification.json`.
Current browser evidence is under its `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and ordered diagnostics.
- `point-layout-signed-polygonal-zero-axis-2d-native.json`,
  `...-2d-live-capture.json` and `...-2d-live.png`.
- `point-layout-signed-polygonal-zero-axis-2d.svg`,
  `...-2d-saved.json`, both `...-2d-standalone.tex`/`...-2d-inlineMath.tex`,
  and `...-2d-standalone.json` containing persisted reopening observations/error.
- `point-layout-failure.json` and `point-layout-app-failure.json`.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `ae8cea9b8c2a7c6535e7d1a611415272cd9dbe76`.
Pre-prompt tree matches the parent's before/after checkout:

~~~text
41c77a3e38ab8a5a712cf2b17b0888c7a89fa1fef663d8dc00972ec6eb16c558
~~~

Tracked-diff SHA256:
`88995113e6660971c3c23b601905cf7255c78f8bcf5cc1a7a372049e99cd0b37`.
Preserve seven modified tracked files: both Phase32 status documents;
`scripts/checkFreeLabels.mjs`, `scripts/checkPointLayoutAnchors.mjs`,
`scripts/pointLayoutAnchorsContract.mjs`,
`tests/scripts/phase32dVerification.test.mjs` and
`tests/scripts/runPhaseRunner.test.mjs`.
Preserve both untracked modules and exact bytes:
`scripts/zeroAxisLiveCapture.mjs` and `scripts/zeroAxisLiveCaptureWorkflow.mjs`.
Keep the prior494-file reference/test inventory in HEAD and all production files.
Use the handoff's exact inventories/hashes. The prompt changes tree identity;
capture actual current tracked/untracked bytes for all future acceptance.

| Retained evidence | Actual result |
| --- | --- |
| Latest implementation child | 6,775/6,775 tests passed, zero failures/skips; build/diff, focused strict TypeScript, changed-script lint/syntax passed.65 new capture regression controls,55 background controls retained. Focused sweeps overlap. Four inherited lint errors remain. Strict/direct browser startup stopped at localhost EPERM before Chrome. |
| BjrAYN parent | Tests/build/diff/label-assets passed; free-labels failed during first2D standalone reopening assertions. Sixteen of18 cumulative groups completed,17 started. Combined layout incomplete, final standalone unexecuted; pageErrors empty. |
| Current progress | Six32D predecessor scenarios terminal-pass. Six2D signed polygonal observations, zero-axis five native actions and owned live PNG lifecycle completed. Standalone fixture JSON saved/reloaded, both TikZ artifacts produced, actual SVG downloaded and externally reopened. |
| Remaining | First standalone PNG/capture and its pixel proof are not executed. New3D cases/live/download, both pending scenarios and final standalone remain unexecuted. The new scenario has no terminal pass or complete parent raw-policy acceptance. Independent completion review has not begun; no child commit/push. |

qsihsK's toolbar obstruction and Ab9guh's root-only rejection are resolved
predecessor evidence. HMy8AM acceptance/review is historical.
The latest parent launched Chrome and progressed to an actual downloaded file;
do not report it as child startup EPERM or as failing the live pixel oracle.
Partial historical acceptance cannot replace fresh complete verification.

## Exact observed standalone mismatch

The2D live PNG now passes the unchanged strict oracle:
1700×1300,36,882 bytes,632 magenta pixels,
local y−34.02419354838708..33.71774193548388, with screenCTM
(a=d3.1,b=c0,e1296.4,f268.975).
SHA256:

~~~text
fab81d376069bb3ab3ee08b17a5e89b8db34ea2589ffeeee3b3e13d81cfa26b3
~~~

The current records prove one measured native toolbar collapse, one PNG,
stable state/geometry, inherited expanded toolbar restoration, no secondary
errors and cleared owned registries. Preserve that complete lifecycle.

The first standalone `expected` array remains in model/fixture order.
All seven nodes have empty source/title and layer0.
Actual exported/reopened DOM order follows production's layer/ID ordering:

| DOM ordinal | Actual point ID inferred from authenticated placement/order | Model expected index | Outer transform |
| --- | --- | --- | --- |
| 0 | signed-dart | 5 | translate(356 84) |
| 1 | signed-isosceles-triangle | 4 | translate(228 84) |
| 2 | signed-regular-polygon | 0 | translate(100 212) |
| 3 | signed-square | 1 | translate(228 212) |
| 4 | signed-star | 3 | translate(100 84) |
| 5 | signed-triangle | 2 | translate(356 212) |
| 6 | signed-zero-axis | 6 | translate(484 84) |

`src/rendering/SvgDiagram.tsx:572–574` sorts render items with
`compareSvgRenderItems`. `src/rendering/svgRenderSort.ts` orders these points
by layer then ID, not stratum array position.
`src/ui/svgPreviewExport.ts` deep-clones in-place and strips data/aria metadata.
The standalone SVG has no point IDs; seven blank titles cannot identify owners.

`scripts/checkPointLayoutAnchors.mjs:887–892` collects blank `g > title` bodies
in document order and stamps `shape: expected[index]?.shape` onto them.
That shape field is copied expectation metadata, not an observed shape.
At line906 it compares the first actual dart to model-index0 regular polygon.
Actual dart path begins `M -15.229339599609 0 L 8.538153076172 9.844427490234`
with body/contour transform `translate(5.821307373046876 0)`.
Expected regular polygon begins `M 0 12 L 11.412678195542 3.708203932499`
with transform `translate(4.623168735846111e-16 -7.55020751953125)`.

Every actual contour/node/body transform matches its proper counterpart in the
retained expected set. This supports an association defect, not bad dart or
polygon geometry. Do not claim the raw `shape` field authenticated those owners.

Failure is at caller `assertReopened` line906, through
`capturePointLayoutStandalone` line105/caller882, before
`captureStandaloneSvg` line107.
The raw candidate already retains all seven reopened nodes, the exact fileURL/
XML, no forbidden content/background, no standalone/cleanup errors and the
primary assertion. It has no `capture` record/new standalone PNG.
Preserve this before-image evidence distinction.

## Scoped authenticated correspondence

Inspect the signed-polygonal standalone caller/reopen observer, its immutable
saved/click/expected records, `assertSignedPolygonalStandaloneEvidence` in
`scripts/pointLayoutAnchorsContract.mjs` and the parent runner's raw-file replay.
Keep `capturePointLayoutStandalone` and `captureStandaloneSvg` unchanged.

Keep all seven model points/IDs/positions/styles/sources in their existing
declared order. Keep `expected`, saved strata and click-time point order unchanged.
Retain reopened nodes in actual SVG document order with explicit DOM ordinal,
native source, contour attributes, outer/body transforms, screenCTM and errors.
Do not relabel raw observations with `expected[index].shape`.

Build an explicit one-to-one association independent of the contour being
tested. For this fixture, authenticate the point IDs/order in the current
pre-export App SVG and validate against immutable model/click/source/request/
owner/revision and the source-proven point layer/ID render order.
Use the unique captured outer projected placements as an independent cross-check
against the actual reopened nodes. All seven placements are distinct.
Record each derived expected-ID/index ↔ actual-DOM-ordinal/placement relationship
separately from raw observations and retain the evidence establishing uniqueness.

The sanitized file cannot supply stripped point-ID metadata. Mark correlated
ID/shape fields as derived, never as native observations.
Do not add metadata/titles, change fixture IDs/layers/text/positions, reorder the
model, change the renderer comparator or edit downloaded SVG bytes to create an
identity mechanism. Do not rely on blank titles, assumed model-order indices,
shape names copied from expectations or selecting whichever contour matches.

Require exactly one current expected owner and one actual group per association,
full seven-owner coverage, unique ordinals/placements, no duplicate/missing/
foreign/ambiguous candidate and source-proven current ordering.
Validate group/body/contour structural ownership, connected current SVG/root and
actual observed placement before geometry comparison.
Persist raw reopening and association candidates before validation/image work,
including unassignable candidates and their failure reasons.
Retain bounded primary/secondary error handling, request/page/listener cleanup
and exact file identity.

Then compare each associated actual contour and body/outer placement to its
own immutable expected point with the existing exact assertions.
Retain paint attributes, signed anchors, zero-axis traversal, source, transforms
and all forbidden/external/background checks.
An association must not consume or overwrite the field whose correctness is
being tested: do not match by path `d`, expected paint or body/anchor transform.
Outer projected placement is independent of those fitting/clearance attributes.

Update BOTH caller reopening assertions and parent raw-policy replay.
Parent validation must independently reconstruct/validate the association
against immutable saved/click/pre-export order/placement and actual file-local
group structure, not trust a stored success flag or derived ID alone.
Bind each observed contour/body/outer transform to the corresponding actual
node in the exact downloaded XML. Global `xml.includes(attribute)` assertions
prove only that a value occurs somewhere and cannot establish node ownership.
Keep real document ordinals/order and exact SVG/PNG byte/path/root identity.
Use a small testable pure association helper where useful; add no dependency
or unrelated generalized SVG/model rewrite.

Find the unique authenticated `signed-zero-axis` association for standalone
pixel replay. Use that actual node's fresh reopened screenCTM in BOTH caller
and parent byte replay. Replace `raw.reopened.at(-1)` assumptions.
Require current finite invertible CTM and the zero-axis path/placement bound to
that owner. Last array position, magenta pixels alone or a CTM copied from the
live App capture cannot establish standalone ownership.
Keep `observeZeroAxisPixels`/`assertZeroAxisPixelEvidence` unchanged.

## Faithful regressions and remaining acceptance

`tests/scripts/phase32dVerification.test.mjs:519–541` currently builds reopened
records/SVG by mapping model-order `download.expected`. Update the synthetic
fixture to authentic renderer/DOM order while preserving model/click/expected
order and distinct faithful projected placements.
Represent pre-export observed IDs/order separately from stripped-file groups
and separately derived associations. Preserve the actual blank titles/metadata
sanitization rather than injecting IDs into synthetic exported SVG.

The old index-pairing must reject the faithful fixture; corrected authenticated
association must pass exact contour/placement assertions in both dimensions
and complete parent raw/file replay.
Add compact corruption controls for missing/duplicate/foreign owners or groups,
wrong/ambiguous placement, altered ordinal/order evidence, stale model/click/
owner/request/revision, incorrect derived-ID/index bindings, wrong body/contour
ownership and changed path/paint/anchor/outer transforms.
A swapped geometry beneath otherwise valid projected owner placements must fail;
matching the unordered set of shapes is insufficient.

Include file/raw mismatches where all attribute values remain somewhere in the
XML but contours are attached to the wrong point group. The parent must reject
that structural corruption, not pass a global-string presence check.
Include wrong/missing/duplicate zero-axis association and wrong/stale/nonfinite
or foreign reopened CTM, plus unchanged blank/short PNG controls.
Show pixel replay follows the authenticated zero-axis entry rather than the last
raw entry when exercising association/raw ordering controls.
Do not relax canonical-order/identity guards merely to accept arbitrary sorting.
Keep focused cases meaningful and avoid redundant parameter multiplication.

Preserve all65 live-capture and55 background controls, completed native input,
full-stroke measured conditional collapse, one actual CSS viewport PNG,
correct screenCTM/scroll mapping, exact inherited UI restoration and owned
failure/secondary cleanup. Keep both new capture modules and strict pixel oracle.
The earlier synthetic heap allocation issue is resolved by structural sharing;
keep normal concurrency/heap settings and complete controls.

Register any new tests/raw association records in existing policy/artifact
requirements and isolated runner copies. Keep missing new proof fail-closed
without retrofitting historical failure records.

Require all nine named32D scenarios, twelve polygonal selected-anchor cases,
both zero-axis native/live sequences and both transparent new standalone
downloads/reopening/complete PNG/TikZ, each with all six polygonal nodes plus
the zero-axis node. Keep both existing fifteen-entry pending transparent/white
workflows and final cumulative standalone acceptance.
Production sorting and valid rendered order are preserved; no supported case
may be dropped because of stripped identity metadata or child startup limits.

Keep every authenticated reference byte:
original172 boxes/4,925 anchors/11 failure controls; signed-basic8 boxes/
192 anchors;54 polygonal boxes/1,386 anchors;12 direct arithmetic controls;
four dart fitting traces; one singular boundary control;
eleven zero-axis PGF paths and37 independent rendering records.
Preserve original32C and490 additive polygonal/zero-axis evidence files,
0.025pt anchor/0.03pt contour tolerances,0.005 precision and2048 finite-work budget.
Retain signed fitting/clearance, narrow reciprocal math, ordered collapsed-axis/
partial/reversed/rotated traversal, zero-area fill and dash/cap/join/closure.
Keep registered geometry/rendering/reference/model/TikZ tests, both TikZ modes
and2D z=0/3D active-work-plane semantics.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier full6,425 test pass cleared that prior review failure; the latest
registered suite passes6,775 tests. Do not loosen this deterministic control.

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
Update Phase32 status documents to the actual standalone correspondence scope
and observed current results, preserving completed live/native/geometry evidence.
Count overlapping focused sweeps honestly.

Use Homebrew Node>=22.12.0. Run focused association/reopening/file-local replay/
pixel-CTM/faithful fixture/parent-policy/runner checks and applicable preserved
live-capture, native, geometry/reference, pending, standalone and deterministic
stalled-report controls.
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
The earlier stalled-report race and fixture allocation failure are resolved.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all18 cumulative groups: twelve31F groups (already including final
standalone), three32A groups and one each for32B paint/import,32C shapes/
visibility/downloads and combined32D layout.
Require all nine named32D scenarios, both native/live cases, all twelve polygonal
cases, both new transparent downloads with exact owner/contour/placement/CTM
binding and complete PNGs, both pending downloads/reopening/PNG/TikZ,
native history/JSON persistence, valid exact artifacts and no page errors.
Do not reuse BjrAYN's partial result, qsihsK/Ab9guh/HMy8AM history, scoped reports,
synthetic tests or cleanup captures as complete acceptance.
Do not skip predecessors or defer supported cases.

Preserve implementation/fix clean-tree rules; do not reset/stash/discard/commit
unfinished work to bypass them.
If child startup encounters EPERM, retain failure/exact tree and pending parent
native work without weakening acceptance. Obtain approved browser-capable
execution where available.
If another boundary fails, persist raw current geometry/identity/order/frame/
file evidence before interpretation and report the next concrete blocker.

After fresh required verification passes, obtain independent read-only completion
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md` and inspect actual reports/artifacts.
Require prior geometry findings independently resolved, faithful native/live
and standalone correspondence/paint/placement proof, full-suite success and
complete cumulative acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when required tests/browser checks pass.

Report the scoped association fix, meaningful regression controls, preserved
production/reference/capture bytes, changed files, focused/full checks, baseline
failures, exact tree/report identity and independent review result.
Keep Phase32 incomplete until every gate passes.
Leave commit/push to the parent after verification and review.
