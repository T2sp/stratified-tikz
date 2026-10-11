# Phase 32D Fix for signed polygonal clearance and zero-axis ellipse paint

## Objective and scope

Continue from the implemented Phase32D checkout and successful cumulative
parent verification. The newest independent review returned needs_changes:
two supported-layout defects remain despite6,425 passing registered tests.

Correct both issues:

1. Preserve PGF signed polygonal fitting/clearance for regular polygon,
   legacy square/triangle, star, isosceles triangle and dart.
2. Emit faithful zero-axis ellipse paths so live/settled SVG paint and committed/
   native picking agree.

Keep the completed rectangle/ellipse signed-axis and negative-radius density
corrections, additive authenticated references and deterministic stalled-report
test. The newest review judged those corrections sound. Do not repeat resolved
fixes, reopen the old test race or rewrite unrelated modules.

Limit production work to the evidenced fitting/anchor/degenerate-path branches
and small pure runtime state/helpers needed to preserve PGF semantics.
Keep model validation, saved version2, authored units/raw text, camera and all
current native/pending/download/capture contracts.
Do not reject/clamp valid negative or zero dimensions to avoid these cases.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md` and
`docs/PHASE_32_PLAN.md`. Inspect exact source and independent evidence first.
Maintain cumulative strict verification, verification-before-review/commit and
the post-review matching-tree guard. Phase32 remains incomplete.

## Latest review, acceptance and identity

Newest review:
`/Users/takamatoshinori/.codex/attachments/a475cffd-a3cc-40c7-a161-583203c56760/Pasted text.txt`.
Read-only review records/logs:
`/private/tmp/stz-phase32d-readonly-review-Zm4oWG/`, especially
`review-observations.json`, before/after checkout identities, `npm-test.log`,
`npm-build.log` and `baseline-reproduction.json`.

Matching passed parent:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-HMy8AM/verification.json`.
Native report and artifacts:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-HMy8AM/05-check-free-labels/artifacts/`.

New independent reproductions:

- `/private/tmp/stz-32d-geometry-review/empty/manifest.json` and all18 case
  directories with complete TeX inputs/raw geometry/compiler/production results.
- `/private/tmp/stz-32d-geometry-review/targeted/manifest.json` and its case
  directories for additional anchors/body profiles.
- `/private/tmp/stz-32d-geometry-review/zero-axis/view-results.json`,
  `render-results.json`, complete PGF raw/input/compiler/PDF and actual production/
  reference SVG/PNG files. Reproduction scripts are in the parent directory.
- `/private/tmp/stz-32d-geometry-review/model-paths-results.json` and retained
  saved2D/3D models/both TikZ modes.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `f9893fad1fa0586260d614e832ffb99b00ce513f`.
Pre-prompt tree matches parent/reviewer before/after:

~~~text
8f0ffe266755d990a3a0abd284f012c714623a3399c75a8fa37cbc05c0033478
~~~

Preserve fifteen modified tracked files: `.gitignore`; both Phase32 documents;
`scripts/checkPointLayoutAnchors.mjs`; `scripts/pointLayoutAnchorsContract.mjs`;
`src/geometry/pointNodeShapes/README.md`, `anchors.ts`, `contours.ts`, `solve.ts`,
`types.ts`; `tests/geometry/pointNodeAnchorReferences.test.ts`;
`tests/geometry/pointNodeShapes.test.ts`;
`tests/rendering/svgPointNodeAnchors.test.ts`;
`tests/scripts/phase32dVerification.test.mjs` and
`tests/scripts/pointNativeFocused.test.mjs`.
Preserve the13 untracked files under
`tests/fixtures/point-node-anchors/signed-axes/`, including its complete generator/
references/raw/compiler/README and retained review bundle.
Keep their bytes and scoped artifact-inclusion rules.
The prompt changes identity: capture actual current tracked/untracked bytes
rather than treating a historical fingerprint as future acceptance.

| Retained evidence | Actual result |
| --- | --- |
| HMy8AM parent | Required tests/build/diff/label-assets/free-labels passed. All18 cumulative groups and eight named32D scenarios complete, none incomplete/unexecuted, pageErrors empty. Node v26.9.0, Chrome154.0.8037.98, matching checkout identities. |
| Latest read-only reviewer | Fresh6,425/6,425 tests, zero failures/skips; build, focused strict TypeScript, changed-file lint, syntax and diff passed. Independently inspected matching parent browser reports. Four unchanged-HEAD lint errors reproduced; whole-repository lint not run. |
| Completion decision | needs_changes, zero Critical, two Medium, ready_to_commit:false. Independent PGF3.1.11a/librsvg probes exposed production defects missing from registered cases. No commit followed review. |

Preserve authentic90 sizing/305 anchor cases, all other predecessors,
both pending transparent/white downloaded/reopened SVG/complete PNG/TikZ and
final standalone acceptance. The native interaction record additionally contains
two signedAnchorCases and two signedPickingCases from the previous correction.
These accepted cases do not cover the new polygonal/zero-axis defects.
Historical passes cannot replace fresh verification of the next geometry tree.
The old full-suite test race is resolved; the current blocker is production
conformance, not browser startup or unexecuted pending downloads.

## Signed polygonal fitting and clearance

For empty body, inner x/y separation-30pt, minimum width/height-20pt,
outer x/y separation+3pt, regular polygon anchor corner1:
manifest expected SVG-frame y=6.29184TeX pt, production y=13.7082039325pt.
Placement differs7.41636pt before scaling to1.2 SVG units/pt.
Raw PGF corner1 y is-6.29184 in Y-up coordinates: reverse Y exactly once.
Do not mistake the already converted manifest value for raw PGF Y-up.

The empty manifest covers six shapes×outer0/+3/-3. Regular polygon,
square, triangle and star agree at outer0, then apply signed clearance in the
wrong direction at ±3. Other recorded +3 selected results, all converted
SVG-frame TeX pt, include:

| Shape/anchor | PGF expected | Production |
| --- | --- | --- |
| square/corner1 | (-4.07089,4.07089) | (-10.0710678,10.0710678) |
| triangle/corner1 | (0,4) | (0,16) |
| star/outer point1 | (0,5.37004) | (0,14.6300858) |
| dart/tip | (-4.85109,0) | (-20.6245303,0) |

Read every recorded anchor, not only the selected summary.
Isosceles apex is nearly correct, but lower corners and numeric borders are not:
the +3 case has maximum error about184.54pt.
Dart also differs at outer0, including tip error0.09377pt and maximum0.21692pt,
so a clearance-sign-only patch would leave an evidenced fitting defect.

Inspect `solve.ts`, `anchors.ts`, runtime solution types, `pgfMath.ts` and
authenticated PGF geometric/basic math source. Address the distinct causes:

1. Regular polygon/square/triangle retain a signed fitted radius in construction,
   but `anchors.ts` converts it through `Math.hypot` before clearance.
   Preserve the fitted radius and add the PGF miter length with its sign,
   retaining declared start angle/index/order, rotation, external radius,
   names and numeric-border branch behavior.
   Do not globally change the magnitude radius used for painted bounds/picking.
2. Star's generic geometric outward miter loses PGF's declared signed inner/
   outer-radius adjustment. Retain both fitted radii and PGF's separate miter/
   cosecant adjustments, ratio/height fitting and declared inner/outer indices.
   Do not fix every polygon with a blanket separation-sign reversal.
   Verify mixed-sign radii through independent PGF before assuming a rule.
3. Isosceles triangle reconstructs its half-angle with `atan2` from signed
   fitted vertices; this changes quadrant when dimensions are negative.
   Preserve original and effective PGF fitting angles, including the original
   apex cosecant versus effective corner-angle distinction.
   Match PGF divide→atan stretch semantics instead of inferring a new quadrant.
   Keep minimum order, signed axes, upright body offsets and rotation branches.
4. Dart's winding-derived miter disagrees with parameter-defined PGF tip/tail/
   left/right vectors when fitting is signed. Preserve those PGF vectors and
   fitted lengths/separation/offset, names, external radius and numeric borders.
   Resolve the recorded outer0 fitting discrepancy too. Trace sequential
   fixed-point minimum scaling and reciprocal arithmetic against raw PGF.
   `pgfReciprocal` currently chooses its >100 noninteger branch after abs,
   while upstream tests the signed integer part; large negative noninteger
   inputs take a different PGF branch.
   Permit only the evidenced signed branch/rounding correction and small direct
   arithmetic controls, not a general math rewrite or replacement with exact1/x.

Preserve ordered paint envelopes separately from signed fitted quantities.
Keep clearance outside the paint/hit regions, model coordinates unchanged,
named/indexed/text-side/numeric anchor distinctions and valid singular diagnostics.
Retain old positive/negative/zero-axis/reference cases, unsupported-name behavior,
finite-work guards and2D/3D shared placement.
Do not hide discrepancies by changing authored source, minimum limits, tolerances,
PGF expected values or the export camera.

## Zero-axis ellipse SVG paint

Empty ellipse, inner xsep0pt, inner ysep20pt, minima/outer separation0,
anchor center and enabled0.4pt stroke is valid and survives saved JSON reload.
PGF paints a vertical stroke with raw extrema±28.2843TeX pt.
Production's analytic half-extent is28.284271247462pt, corresponding to
33.941125496954 SVG units at1.2 units/pt.

Production emits:

~~~text
M 0 0 A 0 33.941125496954 0 0 0 0 0
      A 0 33.941125496954 0 0 0 0 0 Z
~~~

Each half-arc starts/ends at the center. SVG omits arcs with coincident
endpoints; zero-radius arcs with distinct endpoints become lines under the
[SVG arc parameter rules](https://www.w3.org/TR/SVG/paths.html#ArcOutOfRangeParameters).
Current sampled vertices still span ±33.941125, so committed picking selects
the invisible contour at local(0,20).

Retained2D/3D producer records are ready, validate/round-trip successfully,
have no limitation and use the same path for live and settled SVG.
Actual librsvg rendering of production is blank, while independently converted
PGF paint is nonempty. These are producer/picking/render probes, not actual
native click acceptance; preserve that evidence distinction.

Add a narrow faithful degenerate-path branch retaining the full signed angular
traversal and intervening extrema. For this positive zero-x full ellipse it
traces center→upper SVG extremum→center→lower extremum→center, then closure.
Equivalent line/cubic encoding must retain ordered retracing, path length,
dash phase and cap/join/closure behavior; a shortened single segment is not
equivalent. Zero-area fill must remain zero-area.

Handle zero-y/both-zero and signed surviving axes consistently with authenticated
PGF/SVG semantics. Do not add epsilon radii, a disc/rectangle/marker, reject valid
models, suppress current picking to match invisible paint or change anchors to
avoid the defect. Paint paths and sampled/picking geometry must describe the
same traversal.

Keep nondegenerate arcs and corrected magnitude-based sampling,0.005-unit
precision/2048 budget unchanged.
If altering the shared arc builder, include actual signed/reversed/rotated partial
sweeps and all intervening turning extrema. Equal subdivisions of at most90°
alone are insufficient: zero-x45→135° still has coincident endpoints while
traversing an extremum. Do not rewrite unrelated curved-shape construction.

## Authenticated references and meaningful regressions

Preserve byte-for-byte all existing32C and original172-box/4,925-anchor/
11-failure references, plus the new signed-basic8-box/192-anchor bundle and
retained historical review records under `signed-axes/`.
Keep unchanged0.025pt anchor/0.03pt contour tolerances,0.005 sampling precision,
2048 budget and independent negative controls.
Add evidence separately; do not regenerate old expectations from production.

Retain the new empty/targeted/zero-axis review inputs/raw/compiler/reproduction
outputs with hashes before edits. The polygon manifest records source/production
hashes but not all artifact hashes: authenticate retained input/raw/compiler/
parsed observations explicitly when adding repository references.
Preserve engine/PGF3.1.11a/source hashes, no-shell-escape command, exit status,
complete fixed-box dimensions/options and TeX pt/Y conversion.
Oracle generation/parsing must remain independent of production fitting/math/
support tables. Production results are failing reproductions, not oracle inputs.

Use the18 empty cases and targeted evidence as a compact core across all six
branches, outer0/+3/-3, required named/indexed/standard/numeric anchors.
Add a small purposeful set for body-dominant versus minimum-dominant fitting,
signed radius/length transitions, rotation/incircle/stretch, star ratio/height
and mixed-sign inner/outer radii. Include direct reciprocal signed-branch evidence
needed for dart and preserve parameter/singular boundary guards.
A sign-flipped/absolute-radius/geometric-outward-miter control must fail even
when paint bounds remain correct. Isosceles apex-only coverage cannot pass.

Add a PGF-authenticated zero-x paint traversal/reference, zero-y and both-zero
controls and signed surviving-axis coverage.
Tests must inspect actual emitted path and rendered stroke/extents, not just
finite bounds/vertices or selected candidates.
Retain valid zero-area fill and meaningful cap/join/dash-phase traversal checks.

Use registered geometry/reference/rendering suites where practical. Verify
validation and exact saved/raw units/provenance, both TikZ modes, unchanged
model coordinates and current/pending/settled placement in both ambient dimensions.
New2D points use z=0;3D placement/projection uses its active work-plane semantics.
Do not inflate a redundant full parameter cross product.

Add narrow required native cases in the existing cumulative layout workflow:
actual polygonal selected-anchor placement, zero-axis visible stroke and current
ordinary click/Alt cycling at the observed local-axis point in2D/3D.
Bind input/control/CTM/source/owner/request/revision and paint/selection evidence
to the real current model and artifacts; persist observations before validation.
Require a genuinely outside point beyond existing tolerance to stay unselected,
and current lock/layer/filter/stale-owner guards to remain.
Do not use a DEV selection mutation, larger proximity tolerance or synthetic
success flag to establish native acceptance.

Verify actual standalone downloaded/reopened SVG/complete-root PNG retains the
corrected stroke and placement with existing content/background/file-identity
contracts. Existing all18 passes do not establish these new cases.
Clearly distinguish pure/fixed-metric, independent renderer and real native
browser observations in contracts and status documents.

Register new tests explicitly in `npm test` and required native cases/raw artifacts
in current contracts/parent policy. Copy actual imported dependencies into
isolated runner fixtures. Keep existing predecessor/scenario counts honest;
do not drop prior cases to accommodate additions.
Do not add a runtime dependency on TeX/librsvg or silently make evidence optional.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The full6,425 test pass clears that prior review failure; do not loosen it.

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
Update Phase32 status/geometry docs to the actual polygonal/zero-axis scope,
reference inventory and observed current results. Preserve evidence history.

Use Homebrew Node>=22.12.0. Run focused authenticated polygonal/degenerate PGF,
signed math/fitting, production path/placement/paint/picking, previous signed-axis/
density, resolved-provenance/view/pending/capture, diagnostic/runner and parent-policy
checks. Run all required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused strict TypeScript/lint and changed-script syntax checks.
Latest review reproduced four unchanged-HEAD lint errors:
two geometric-caller no-unsafe-finally errors, verifier unused _role and layers
unused defaultCurveStyle. Preserve/report these failed baseline checks separately
from passing changed-file checks; repository-wide lint was not run.
Do not carry the resolved full-suite race forward as current debt or claim
unperformed checks. Avoid unrelated lint cleanup.

Use a fresh owned browser-capable parent process/server, supported Playwright/
Chrome and actual current tracked/untracked tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all twelve31F groups, three32A groups, complete32B paint/import,
complete32C shapes/visibility/downloads, combined32D layout and final standalone,
including new polygonal/zero-axis native cases and all retained signed cases.
Require both pending downloads/reopening/complete PNG/TikZ, actual valid artifacts,
native history/JSON persistence and no page errors.
Do not reuse HMy8AM after edits, skip predecessors, defer supported cases,
reject valid models or substitute scoped/synthetic reports.
Preserve implementation/fix clean-tree rules; do not reset/stash/discard/commit
unfinished work to bypass them.
If child execution encounters server EPERM, retain startup failure/exact tree
and pending parent native work without weakening acceptance.

After fresh required verification passes, obtain independent read-only completion
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`, and inspect actual reports/artifacts.
Require both findings resolved with independent authenticated references,
production/native paint/placement conformance, full-suite success and fresh
cumulative acceptance. Keep post-review identity guard.
Failed/incomplete verification stops before review/commit; needs_changes blocks
completion/commit even when required tests/browser checks pass.

Report scoped signed-fitting/clearance and degenerate-path fixes, added authenticated
references/native cases, preserved contracts, changed files, focused/full checks,
baseline failures, exact tree/report identity and independent review result.
Keep Phase32 incomplete until all gates pass.
Leave commit/push to the parent after verification and review.
