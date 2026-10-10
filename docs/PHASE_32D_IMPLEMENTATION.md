# Phase 32D spacing, minima, anchors, and combined audit

Status (2026-10-10): implementation and focused Node verification are present.
Phase 32 is **not complete**. Fresh accepted required commands, strict native
browser/download evidence and independent review remain required. 32A and main's
later 32B have historical accepted evidence. The plan still records unaccepted
fresh strict native/review gates for the merged 32C checkout; implementation
presence does not close that prerequisite or the final gate.

## Canonical layer visibility evidence correction (2026-10-10)

The actual starting checkout is clean at
`1bcfcd5f06c1c12e92b744e0cb542c6dd8cb4a1d`, fingerprint
`ab8f4425318cba5b7adc25dcefaca340389f29e898392fc2be687cadb68dc97c`.
The previous source-panel and camera corrections are now tracked, including
their helpers, fixtures, registrations and isolated-runner dependencies.

The latest browser-capable parent `stz-phase32d-before-review-IocgXz` passed
5,987/5,987 tests, build, diff and full label-assets with Chrome 154.0.8037.98.
It completed 15/18 cumulative groups, all eleven shapes and all eight native
contour interactions. Native camera preparation and all three dim/hide/dim
actions completed at epoch 110, retaining actual input/change events with
`trusted: false`. Dimmed fill and cumulative opacity are .28; hide removes the
render. Its first failure is the visibility validator's raw `visible === true`
assertion. Production normalizes the visible default by omitting that field.
This is separate from the resolved locator/camera/toolbar/drag failures and the
child's server-startup restriction. These observations have no terminal visibility
pass; both geometric downloads, layout/owner-cycle matrix and final standalone
export did not execute. Page errors are empty.

The scoped contract requires explicit layer metadata, exactly one valid matching
owned record, the configured point layer and name, and `locked === true`. Only
the visibility assertion interprets omitted/boolean true as visible. False and
malformed present values fail. Saved/runtime/current-history point and layer
records must agree exactly; the validator preserves their raw representation.
The hidden record retains explicit false, exact point data, absent rendering and
the native load's exact +1 epoch. Synthetic policy fixtures now omit visible
defaults, with production load/save normalization covered in the registered
layer suite. Both parent suites distinguish valid explicit true input from
canonical output and reject corrupt or unowned metadata and raw disagreement.

Bounded observed diagnostics retain locked before/after state and rendering
before hidden load, hidden state/render before occlusion load, and the complete
raw candidate before its terminal assertions. Observed records cannot count as
passed scenarios. Stage/candidate ordering and rejection regressions retain the
first action/assertion failure through secondary capture, artifact and cleanup
failures. Other scenario saving and all completed native helpers remain intact.

Production, geometry, saved format, coordinates, references and tolerances are
unchanged. The 172-box / 4,925-anchor / 11-failure inventory remains; the diamond
outer-separation exception still requires independent PGF review. Fresh strict
verification of the exact final tree must precede matching read-only review.
Current results, preservation hashes, identities and handoff are retained under
`/private/tmp/stz-32d-canonical-layer-fix-20261010/`. Phase 32 remains incomplete;
no review, commit or push follows failed or incomplete verification.

Executed local checks use Homebrew Node v26.9.0. Normalization and both parent
policy suites passed 680/680; the diagnostics suite passed 18/18. Build and seven
changed-script syntax checks passed. No new lint errors were introduced: HEAD
has four geometric caller `no-unsafe-finally` errors and verifier unused `_role`;
current primary-error cleanup leaves three of those caller errors. The existing
layers suite also reproduces its unused `defaultCurveStyle` and eleven standalone
strict TypeScript diagnostics, identical to HEAD after path/line shifts. These
focused lint/type checks remain failed; application TypeScript/build passed.
Both direct browser commands stopped before Chrome at fresh-server
`listen EPERM 127.0.0.1`. Label-assets passed only its static graph; strict
free-labels completed zero groups with all eighteen unexecuted. Final full/focused
commands, fresh `32D verify` response/report and matching tree identity belong to
the external handoff. Startup diagnostics do not establish native acceptance.

## Earlier source-panel and camera correction

The earlier browser-capable parent, retained as `stz-phase32d-before-review-yYQ7Zh`,
passed 5,830 tests, build, diff and full label-assets with Chrome 154.0.8037.98.
It completed 15 of 18 cumulative groups: full paint/import, all eleven named
shapes and all eight 2D/3D contour interactions passed, including trusted native
selection/drag, one bounded history commit, exact saved/runtime Undo/Redo and
unchanged document epochs 100 through 107. The next active scenario is
`point-geometric-visibility`, which stopped at the caption-only exact
`getByLabel('Hidden points:')` lookup. The source-panel wrapping label also
contains its option text. Page errors are empty. Visibility and both geometric
downloads, the full layout/anchor matrix and final standalone-export group
remain unaccepted. This is separate from the resolved toolbar/drag/revision
assertions and the child's startup restriction.

The current scoped correction starts from the actual clean tracked checkout
`0c622432757e67d5a37c50a8aa84da969d67d670`, fingerprint
`d0dfa54a1754b33aa96ceb46a3c339e9634251086876c1aaa4cd000db92f3bf2`.
All prior corrections, including the former twelve modified files and selection
fixture, are tracked here. The final identity is captured from the actual tree,
including new untracked helpers/fixtures, rather than an older parent report.

`pointSourceVisibility.mjs` scopes its exact caption span to `.source-panel`,
requires the direct production label and unique associated native select,
checks connected/visible/enabled state and exact `dimHidden`/`hideHidden`
options, then scrolls the real field into the internal source header before a
bounded native `selectOption`. Raw before/prepared/after records retain caption/
label text, old/corrected locator counts, options/value, bounds/scroll ancestors,
authoritative visibility settings, model/history/epoch/selection/camera/work
plane and actual owned input/change events. The first dim selection may be a
same-value observation; real hide then dim actions retain their resulting states
and rendering. Pointer delivery or invented trusted flags do not establish a
select action. Diagnostic/listener cleanup cannot replace the first failure.

The retained failure DOM also shows an actual setup mismatch: camera theta 13,
phi -23, zoom 1, with the point classified visible and fill opacity 1. Saved
`view.camera3d` takes precedence over the overwritten `diagram.camera`.
The intended theta 90 / phi 0 occlusion orientation now uses the real numeric
camera controls, with exact before/after UI-only invariance and render records.
The checkbox still runs natively. The dimmed fill-opacity assertion remains,
with a retained cumulative opacity chain in addition. No production camera,
visibility, geometry, model, revision, cache or saved-coordinate behavior changes.

Both parent policies require raw visibility/control/setup/render evidence;
summary success booleans cannot substitute. Registered synthetic controls test
the scoped resolver, no-op/transition values, stale/ambiguous/disabled states,
internal scrolling, exact return/final settings and primary-error ownership.
Runner fixtures copy the new transitive helper dependency. Native visibility,
downloads and standalone acceptance still require a fresh complete strict 32D
parent process followed by independent review of the matching tree. Final child
commands, preservation hashes, tracked/untracked diff and exact handoff are
retained under `/private/tmp/stz-32d-visibility-fix-20261010/`. Failed browser
startup is pending parent work, never accepted evidence. Phase 32 stays incomplete.

Earlier toolbar-fix parent `stz-phase32d-before-review-gn1o0M` passed 5,621
tests/build/diff/label-assets and all eleven shapes, then stopped at expanded
Creation controls covering the configured 2D semicircle's fixed .23 boundary.
Its 2D diamond/star epochs 100/101 were complete; the newer parent above
supersedes that native failure while preserving its diagnostic history.

The earlier toolbar correction starts from the actual clean tracked checkout
`c2ddd167d5f0a6c99dc392368b02bc9d477ff629`, fingerprint
`cee0ec21f6db9226c985ea5ae32ef1a81a595cd351cd9e3c81323af52978a696`.
The prior seven-file revision fix and updated prompt are already tracked there.
All prior implementation, regressions and reference files are preserved.
Shared native preparation records toolbar/drawer state and exact authoritative
data/history/epoch/selection/UI settings, camera and work plane. Native Select
runs while visible; an inherited collapsed toolbar expands through its unique
real control. Only a fresh Creation/owned quick-style hit causes one collapse.
Bounded detachment/collapsed/expand-control checks precede final scrolling and
remeasurement of the connected contour's same `.23` point and own screen CTM.
The intended first SVG hit is required before one native click. History or other
remaining obstructions stop with their actual hit stack. No geometry, viewport,
overlay event behavior or fixture model coordinates are changed.

Canvas observation excludes toolbar actions; raw after-input events/state are
retained before assertions. Owned toolbar changes restore natively after observer
cleanup, with exact local before/after state comparisons preserving the expected
selected owner rather than comparing it to initial null selection. Restoration
uses unique real controls even if a secondary diagnostic read fails, and cannot
mask the first native/action/assertion failure. Inspector controls still reopen
through the existing callers. Layout selection and owner cycling share the scoped
input preparation. Native drag expands for Select when necessary and restores
inherited toolbar state without changing its handle/capture/movement/history or
same-document revision contract. The next selection and drag retain native
Select access. Both parent policies require complete raw selection/toolbar
records, CTM-derived input, owner/request/source identity, trusted delivery and
restoration; counters or summary booleans cannot establish success. Runner
fixtures include the added transitive selection helper import.

Synthetic toolbar/selection, drag, ownership and both parent policy controls are
registered in existing suites; the new selection fixture is an imported helper.
They cover native action ordering, covered semicircle, collapsed/unobstructed
paths, ambiguous/missing controls, failed transitions/restoration, stale geometry,
remaining obstructions, exact UI-action invariance and primary-error ownership.
They do not establish native acceptance. Current child check results and exact
final handoff are retained under `/private/tmp/stz-32d-toolbar-fix-20261010/`.
Fresh complete strict parent verification must precede independent review;
Phase 32 remains incomplete and no commit or push is authorized by a partial run.

The earlier browser-capable parent's retained `stz-phase32d-before-review-5waNKq`
report passed 5,507 tests, build, diff and label-assets, then failed the harness's
revision assertion after 15 of 18 groups. The full paint/import group, corrected
Clear provenance and all eleven named geometric-shape cases passed. The first
2D diamond contour drag delivered trusted handle input with captured canvas
continuation/release, changed only its selected model position, and made exactly
one bounded history commit. Both authoritative and observed document revisions
remain 100. The revised harness requires that same document epoch across drag
and Undo/Redo; production advances it only on document replacement. Drag Undo/Redo
and the remaining contours, later geometric cases, layout/anchors and final
standalone export did not execute in that failed parent run. Complete current-tree
native/download acceptance and independent review remain required. The completed
Clear/selection/preparation corrections and exact layout/unit/context comparisons
remain. Earlier failure/fix records are retained below.

## Model, grammar, and compatibility

`PointStyle.layout` is an additive explicit option object in saved envelope
version 2. Optional numeric `innerXSep`, `innerYSep`, `outerXSep`, `outerYSep`,
`minimumWidth` and `minimumHeight` are TeX pt; optional `anchor` is a literal name
or decimal border angle. Per-axis `units` records original text, unit, resolved
TeX points and optional conversion `fontContext`. That per-axis context overrides
the legacy shared `layout.fontContext`; merges preserve each inherited axis's
context before applying a local override. `importedLayout` records
imported baselines and deliberate local overrides, separately from paint/shape.

Dimensions accept signed finite decimal literals with optional pt/mm/cm/in/bp/
em/ex; a bare number means TeX pt. Exponents, macros, PGF programs and arbitrary
unit expressions are unsupported. The finite preview domain is ±10000pt. Zero
and negative separation remain explicit; undefined constructions are diagnosed.
Cylinder's content fitting rejects its recorded singular negative inner-y branch;
a valid negative-x branch is tested. Zero-axis diamond numeric anchors and two
strong-negative sector directions (`45`, `south west`) have authenticated PGF
failure references and receive individual diagnostics. The other 23 sector
anchors remain usable. Counts/angles retain separate scalar domains.

An inch is 72.27 TeX pt, while bp uses 72 per inch. Preview's 1.2 local SVG units
per TeX pt is separate from CSS pixels, PDF bp and viewport scaling. Unit context
defaults to 10pt em and 4.30554pt ex. A custom context resolves dimensions to
numeric pt; it does not change preview/export typography, text baseline or mid
anchor x-height. No LaTeX font execution or exact TeX/MathJax ink match is claimed.

Omitted inner axes retain legacy Size / 2; an explicit axis overrides that axis
only. Editing Size clears both explicit inner axes. Omitted outer axes use half
the effective line width, omitted minima use 1pt and omitted anchor means center.
Historical empty-node, white hollow, black text and 0.4pt border semantics remain.
Explicit values and source metadata survive presets, clipboard, JSON, history and
immutable export capture. Measurements, contours, requests and SVG are not saved.

Import expands `inner sep`, `outer sep` and `minimum size` into both axes at their
position in the option stream; later axis values replace only their axis. Bounded
style references/local override intent remain in force. Unsupported programs
retain raw external source and diagnostics. `text height`, `text depth`, `text
width` and paragraph `align` are explicitly unsupported. Imported node transforms
(`rotate`, `transform shape`) remain unsupported with diagnostics and preserved
external source; they never become `shape border rotate` or rotate the body in
preview. Border rotation has its separate supported anchor rules below.

Both TikZ modes emit readable axes/minima/anchor options and named xcolor custom
paint. Imported references keep external-source semantics. Standalone node bodies
preserve raw source; inline math retains the existing physical-line folding in
emitted code, while saved source stays exact. Neither adds math delimiters.

## Anchor support

Every identity supports `center`, `text`, `base`, `mid`, eight compass anchors and
finite signed decimal numeric border directions within PGF's scaled-point parse
range. Magnitudes at 16,384 degrees or more are diagnosed, with source retained.
Unsigned and leading-plus literals require an integer prefix and are truncated
before the range check (`0.5` is valid; `.5` and `+.5` are diagnosed). Negative
literals use PGF's dimensional parser, which rounds before truncation and can
also overflow by rounding near that boundary.
Coordinates outside PGF's TeX dimension range also produce a diagnostic
for the selected anchor. PGF truncates decimal directions
toward zero (`13.7` becomes `13`, `-30.8` becomes `-30`) before the radial query;
ellipse compass diagonals use eccentric angle. The recorded PGF 3.1.11a
table is not inferred from screen rectangles. “Text sides” means `base east`,
`base west`, `mid east`, and `mid west`.

| Shape | Text sides | Shape-specific anchors |
| --- | --- | --- |
| circle / rectangle / ellipse | yes | none |
| diamond | no | none |
| square / triangle | no | `corner N`, `side N`, for 4 / 3 sides |
| regular polygon | no | `corner N`, `side N`, for configured sides |
| star | no | `outer point N`, `inner point N`, for configured points |
| trapezium | yes | top/bottom left/right corner; top/bottom/left/right side |
| isosceles triangle | yes | apex; left/right corner; left/right/lower side |
| kite | yes | upper/lower/left/right vertex; upper/lower left/right side |
| dart | yes | tip; left/right tail; tail center; left/right side |
| semicircle | yes | apex; arc start/end; chord center |
| circular sector | no | arc start/end; sector center; arc center |
| cylinder | yes | shape center; before/after top/bottom; top; bottom |

Indices are one-based and bounded by configured count. Unsupported names/indices
remain saved and produce a visible diagnostic. Dart `tail`, sector `apex`/`chord
center`, and unsupported text sides are not fabricated aliases.
When a construction or selected anchor is unsupported, its hidden requested
contour contributes no painted bounds, hits or selection radius. The exact body
and a small SVG warning beside it remain visible and pickable; the ring encloses
those visible bounds only. Requested shape and anchor-clearance metadata remain
distinct for diagnosis. Six native large-minimum cases exercise body/warning
hits and a far miss inside the requested ellipse/circle/cylinder in 2D and 3D.

Actual baseline/depth, text origin, body/text center, shape center and placement
reference are distinct. Body and contour translate by the negative selected
anchor offset, leaving the anchor at the stored coordinate after async metrics
changes. Text remains upright under border-only rotation; specific/compass
anchors follow PGF incircle and restricted-rotation rules. Picking inverse-
translates by the current offset. Drag and coordinate-reference semantics remain.
Valid negative inner padding can place visible text outside the painted contour.
Picking unions the actual body ink with the contour/stroke region; the selection
ring encloses both. Painted bounds remain contour/stroke-only, body bounds remain
separate, and outer anchor clearance enters neither that hit union nor the ring.

Outer separation supplies shape-specific anchor clearance without inflating
picking to that clearance. PGF's diamond has a recorded exception: painted axis
radius is `fitted radius + (1 - 1.414213) * outer axis separation`, while anchor
radius is fitted radius plus outer separation. Positive separation shrinks paint;
negative separation enlarges it. The native matrix measures the exact delta,
rather than waiving its comparison. This differs from the prompt's unconditional
paint-invariance wording; independent review must assess the documented PGF
behavior. Other supported shapes retain painted contour/bounds invariance.

## Independent PGF references

The generator imports no application solver. It invokes pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026), PGF 3.1.11a, identical fixed width/height/
depth, normalized TeX-point options and recorded font context. Artifacts under
`tests/fixtures/point-node-anchors/` retain exact TeX, raw soft paths, coordinates,
compilation logs, command and hashes. Recorded source hashes:

- geometric library: `bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee`.
- core shapes module: `01dd81e3f2c56a8db7864916ada1a5036964aff2e8176aafd4773244e236bb27`.

The manifest also authenticates core-point, trigonometric and math-calculation
sources, including cylinder's bounded line/arc angular bisection.

Regenerate in the recorded TeX environment:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/generatePointShapeReferences.mjs
PATH=/opt/homebrew/bin:$PATH node scripts/generatePointAnchorReferences.mjs
```

The latter uses `/Library/TeX/texbin/pdflatex -no-shell-escape
-interaction=nonstopmode -halt-on-error fixed-box.tex` in a fresh temporary
directory. No TeX runtime/dependency is added to the App; 32C LPPL attribution
remains. The final focused geometry run verified 172 fixed boxes, 4,925 successful
anchors and eleven separately retained expected PGF failures; 406/406 geometry tests
passed (165 earlier-stage tests plus 241 new tests). Every shape has a strong
negative outer-separation profile (-30pt), including inverted clearance, signed
named directions, ordered infinite-edge intersections and cylinder bisection.
The generator/reference tests pin exact current inventory counts.
Anchor tolerance is .025pt. Additional large-radius contour cases use .03pt,
accounting for PGF cubic-circle deviation plus bounded .005pt sampling; original
32C .025pt cases remain. Controls reject wrong circle diameter, independent
triangle stretching, body offset and ignored outer sep. Actual fonts/MathJax
remain separate native checks.

## Combined acceptance audit

This mapping distinguishes paths/registered tests from actual results. Pending
evidence is neither a pass nor a waiver. Final current-tree commands/fingerprint
belong to the parent's retained verification report.

| Requirement | Production path / registered Node tests | Native scenario / reference | Current result |
| --- | --- | --- | --- |
| 32A Unicode/math, exact full-source fallback and bounds | label service/runtime; svgPointNodeText/Runtime | language shapes; valid-invalid-valid | Earlier accepted; current native rerun pending |
| 32A stale owners/history/fonts | runtime/lifecycle; svgPointNodeAnchors | A-B-C/load; resource/font; combined async | Node paths covered; current native pending |
| 32A contour/picking/visibility/projection | SvgDiagram/svgHitTesting/point geometry | boundaries/cycling, camera/drag, hidden/locked/dim | Current native pending |
| 32A settled whole-node click-time export | svgSettledExport/point view | existing pending downloads plus both layout downloads | Download/reopen pending |
| 32B paint defaults/import/external references/persistence | importedTikzPaint/Styles, pointPaint suites | full paint-import-persistence group retained | Main historical acceptance; current rerun pending |
| 32B paint cache reuse/stroke picking/responsive lifecycle | paint/dash-cap/polygon suites | all prior strict dash/endpoint/responsive scenarios retained | No profile waiver; current native pending |
| 32C eleven shapes/parameters/intrinsic default fit | shape solver; pointShapeParameters/geometric TikZ | original fixed-box fixtures; complete geometric group | References retained; native/review prerequisite unaccepted |
| 32D signed axes/order/units/default precedence | pointNodeLayout model/TikZ; PointLayoutFields | import-order-units; seven native fields | Node paths covered; native pending |
| 32D per-shape aspect/angles/coupling/stretch/minima | pointNodeLayoutAnchors/AnchorReferences | fixed-box inventory; 90 native sizing cases | Focused PGF/layout passed; native pending |
| 32D standard/numeric/specific anchors and baseline/depth | anchors; anchor references; point rendering tests | all PGF anchors; 305 native anchor cases; six unsupported-anchor body/warning/far-click cases | Focused references passed; native pending |
| 32D rotated/incircle/restricted anchors and outer bounds | shared solver/view; reference controls | anchor matrix; diamond exception exact delta | Reference path verified; native pending |
| 32D wide/tall/failure/recovery/fonts/stale load+undo/siblings | runtime/view; svgPointNodeAnchors | eleven combined transitions and real font width/removal | Node paths covered; native pending |
| 32D boundary/drag/reference/Alt/pan/zoom/camera/locks | SvgDiagram/picking/model references | four native 2D/3D rectangle/sector cases plus two outside-contour text clicks/Alt cycles and ink-enclosing rings | Native pending |
| 32D preset/clipboard/JSON/history/both TikZ modes | serialization/provenance/style cloning/layout suites | native controls, actual JSON download/reload, .tex files | Node paths covered; native pending |
| 32D immutable pending transparent-edit/white-load export | capture registry/settled view | fifteen shapes plus free/inline labels per actual SVG | Download/reopen pending |
| Complete cumulative evidence and independent review | verifier/worker/runner; phase32dVerification | eighteen terminal groups, identities/artifacts/fingerprint | Focused policy passed; parent/review pending |

The new group has eight exact scenarios, 90 spacing/minimum cases, 305 applicable
anchor cases plus six unsupported-anchor hit cases, four interactions plus two body-overflow selection cases, eleven lifecycle transitions and two actual
pending downloads. Its minimum 25 named artifacts include saved JSON, .sty,
both TikZ modes, downloaded SVG/PNG and standalone observations. Additional
selection diagnostics and captured source/style/position/camera/anchor inputs
are retained. Standalone observations precede bounded screenshots; primary
failures survive diagnostics/cleanup and owned event actions are drained.

Strict 32D requires all twelve 31F groups, three 32A groups, the complete 32B
paint group, the 32C shape group and `point-node-layout-anchors-combined`. It
rejects old reports, counts without named terminal scenarios, missing/invalid
artifacts, page errors and tracked/untracked checkout mismatch. The fresh-process
worker remains; a live runner regression proves updated policy loads before
review/commit. Historical scoped 32C remains 32C-only and cannot close strict 32D.

Changed surfaces include the explicit layout model/import/provenance/serialization
and Inspector controls; per-shape sizing/anchors and recorded PGF fixtures;
the shared point layout/view, hit testing, immutable export capture and both TikZ
modes. New registered suites cover model layout, geometric layout/anchors,
independent anchor references, rendered placement and TikZ layout. Existing
paint/provenance/picking tests retain compatible expectations.

The new browser harness is `scripts/checkPointLayoutAnchors.mjs`, with its exact
matrix and evidence validation in `scripts/pointLayoutAnchorsContract.mjs`.
`checkFreeLabels.mjs`, the native App fixture, cumulative verifier, runner tests,
failure-evidence tests and explicit package test list include the new group.
`PREVIEW_UI.md`, `SPEC.md`, `ROADMAP.md`, `PHASE_32_PLAN.md`, `LABEL_ADAPTER.md`
and the shape/reference READMEs document the observed contract and remaining
acceptance gates.

## Executed checks and parent handoff

Focused implementation results used Node v26.9.0 with Homebrew first on PATH:

- `node --test tests/scripts/phase32dVerification.test.mjs`: 68/68 passed, including seven body-overflow and nine unsupported-anchor evidence negative controls.
- `node --test --test-name-pattern '32D' tests/scripts/runPhaseVerification.test.mjs tests/scripts/runPhaseRunner.test.mjs`: 5/5 controlled process/policy tests passed; these do not launch a native browser.
- `node --test tests/geometry/pointNodeShapes.test.ts tests/geometry/pointNodeShapeReferences.test.ts tests/geometry/pointNodeLayoutAnchors.test.ts tests/geometry/pointNodeAnchorReferences.test.ts`: 406/406 passed, including 241 new tests and the final reference inventory above.
- Seven changed .mjs files passed syntax checks. Recommended-rule ESLint with Node/browser globals passed new harness/contracts/tests and changed checkFreeLabels/runner files. Configured focused ESLint passed `freeLabelsApp.tsx`.
- Recommended-rule lint of the existing verifier reports unused `_role`, reproduced from read-only `git show HEAD` baseline. This is baseline debt, not a new production failure or an unrelated cleanup.
- `git diff --check` passed at the focused checkpoint; final current-tree rerun remains required after all changes finish.

The first broad implementation run reported 5,264 tests: 5,260 passed and four
failed. All four failures were inherited 17-group count expectations in
`freeLabelsFailureEvidence.test.mjs`; updating them to the cumulative 18-group
contract passed that focused file 4/4. This broad run predates the final expanded
PGF inventory and body-overflow policy additions, so a fresh final full run is
required and this result is not a full-suite pass.

Child configured browser attempts retained `listen EPERM 127.0.0.1` before
Chrome launch. Intermediate logs are `/private/tmp/stz-32d-label-assets-configured.log`
and `/private/tmp/stz-32d-free-labels-configured.log`; failure evidence is under
`/private/tmp/stz-free-labels-1791463136842`. They do not establish final-tree
browser acceptance, native scenarios, downloaded/reopened SVG or review.

The browser-capable parent must retain final command logs, Node/launched browser
versions, geometry/source/history observations, SVG/PNG and exact checkout identity:

```sh
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Independent read-only review must inspect the matching complete strict report
and artifacts. Missing evidence/failed review keeps Phase 32 incomplete. No new
dependency, sandbox change, profile waiver, commit or publication is included.

## 2026-10-09 bounded Clear provenance correction

The native observer and independent parent validator now detach imported layout
provenance in their expected clones, alongside paint/shape provenance and style
associations. Their full point equality, native contour/body/shape/leaves checks,
unselected controls, preset/source/reference definitions, validity and exact undo
requirements remain. JSON persistence comparisons retain all non-view fields.
No production model, geometry, PGF reference input or tolerance changed.

The existing registered Clear UI suite adds a nonempty imported baseline with a
deliberate local `em` axis override and independently inherited `ex` context.
It checks exact axes, minima, anchor and source/context metadata through Clear,
undo/redo and save/load, deep clone isolation and frozen prior snapshots,
detached reimport stability, and standalone/inline TikZ axis precedence.
Synthetic policy fixtures now carry nonempty layout/provenance on selected
points and an unselected control. Their negative controls cover retained layout
provenance after Clear/redo/reload, changed or dropped layout, altered units or
contexts, changed control layout/provenance, and lost undo provenance. Duplicate
point/diagram/state JSON records stay consistent so the intended semantic checks
reject the faults. Existing bounded-history controls remain required.

Focused checks passed: 9/9 UI tests and 122/122 synthetic policy tests, without
failures or skips; strict focused TypeScript, configured TS lint, changed script
syntax, build and diff checks passed. Recommended script lint retains one
unchanged unused `_role` error, reproduced from this checkout's HEAD.
The required full suite is recorded separately in the fix handoff.

Both configured child browser commands failed at `listen EPERM 127.0.0.1`
before Chrome launch. Label-assets passed its static graph check only;
free-labels retained strict mode with zero completed and all eighteen unexecuted
groups. No fresh native scenarios, downloads or standalone reopen were obtained.
These startup failures are separate from the earlier parent's real Clear
assertion. Fresh complete strict parent evidence must precede independent review.
Logs, diagnostic observations, final tracked/untracked identity and handoff are
under `/private/tmp/stz-32d-provenance-fix-20261009/`. No commit or push was made.

## 2026-10-09 bounded Inspector selection preparation

The inspected checkout is `375cd56b33f5f03357562d359be85c501da15b3f` on
`phase/32d-margin-minsize-anchor`, with a clean starting tree. It already tracks
the six Clear corrections and the updated fix prompt; none was restored or
reimplemented. The actual starting identity is retained with this fix's handoff.

`pointGeometricSelection.mjs` observes the inherited Inspector and authoritative
state, then uses the unique real Close button once if the drawer exists. It
requires bounded detachment and the closed Open control before Select/scroll
and fresh point/body/contour measurements and screen CTMs. Closed drawers
receive no close action. The layout caller's duplicate preparation close is
removed. Both callers retain native Open/Expand after successful selection and
record exact JSON/runtime/history/revision equality across those UI actions.

Before/after click observations still precede the native selection assertion.
One actual canvas click must select its intended point and deliver trusted,
ordered pointerdown/up/click through the recorded intended SVG target/path.
Initial setup must be unselected; preexisting selection and overlay-only events
cannot establish success. Existing selected-point handles are accepted only
through their actual handle path and intended selection. Captured continuation
to the owning SVG requires matching pointer identity and observed capture;
native MouseEvent clicks additionally require matching coordinates. Measured
boundary requests remain boundary requests. Bounded diagnostics, observer
cleanup and primary-error precedence remain.

The registered `phase32cVerification.test.mjs` contains 46 explicitly synthetic
selection/preparation controls (38 added), preserving its other controls. They
cover the reused ellipse/open/JSON-load/diamond sequence, one close, closed
no-op, failed/false detachment and control uniqueness, unchanged coordinates/
raw text/styles/history, stale coordinates, remaining obstruction, intended
targets/paths/capture, and primary errors surviving diagnostics/cleanup. These
controls cannot establish native acceptance. The eleven-shape reused-page loop,
all cumulative groups, layout/anchor matrix and actual download/reopen gates
remain required. No geometry, reference, persistence, overlay or dependency
change is included.

Executed child checks used Homebrew-first Node v26.9.0. The registered selection
suite passed 93/93; selection plus existing event/page/diagnostic ownership
regressions passed 133/133; full `npm test` passed 5,411/5,411 without failures
or skips. Build (strict TypeScript) and diff checks passed; all four changed
JavaScript files passed syntax checks. There are no changed TypeScript files.
Recommended script lint found no new errors: helper/layout caller/tests are
clean, while the geometric caller's four `no-unsafe-finally` errors reproduce
exactly from HEAD. The unchanged verifier separately retains its reproduced
unused `_role` error. These failing baseline lint checks are not lint passes.

The focused native attempt and both required configured browser commands failed
at fresh owned-server `listen EPERM 127.0.0.1` before Chrome launch. Label-assets
passed its static graph only. Free-labels kept strict mode with zero complete
groups and all eighteen unexecuted. Fresh intended-target delivery, native
history/JSON persistence, actual pending transparent/white downloads and
standalone reopening remain unobserved here. These startup failures are distinct
from the latest parent's confirmed native Inspector interception. Independent
acceptance review did not start because complete fresh verification is missing.

Logs, raw startup failures, retained-parent diagnosis, the complete six-file
diff, inventory preservation and final tracked/untracked identity are under
`/private/tmp/stz-32d-inspector-fix-20261009/`. Failed browser snapshots precede
this final documentation update and are diagnostic only. The handoff identifies
the exact final tree for fresh parent verification via `32D verify`, then
matching read-only review. Phase 32 remains incomplete; no commit/push occurred.

## Native handle drag preparation and evidence correction (2026-10-09)

The actual clean starting checkout is `5021a1d8af30f55fa48b67744f6af77de0f2047d`
on `phase/32d-margin-minsize-anchor`, fingerprint
`aede7a853e745cf873b97a6d8ff3fd035c5786c55ae28c9f50906e342a9c2bcb`.
It already tracks the previous six-file Inspector handoff and completed Clear
correction. The actual initial/final identities are retained externally; no old
fingerprint is used as an acceptance constant.

The latest retained browser-capable parent `tfTYBh` passed 5,411 tests,
build/diff/label-assets, the full paint/import group and all eleven named shape
cases. It completed 15/18 cumulative groups and failed the first contour drag:
2D diamond, codim 2, aspect 1.8, exact source `drag $x_i$`, owner/revision 100.
Selection observations 0056–0060 show trusted intended contour selection and
exact state preservation across Inspector reopening. The handle center near
`(1296.4,268.975)` is covered by the reopened drawer in the failure PNG. The old
drag collector mixes selection/setup events, retains only type/trust, and is
read/removed after the movement assertion. Actual drag target/path/capture is
unproven. This diagnoses a harness preparation gap, not a demonstrated production
pointer-controller defect or failure of every 2D/3D drag.

`scripts/pointNativeDrag.mjs` owns a bounded observer before preparation. It uses
one unique real Inspector Close control if open, verifies detachment and the
closed opener, preserves exact saved/runtime JSON, selection, history, revision
and UI settings, then performs native Select/scroll. It measures connected
selected point-position handle bounds/local center/screen CTM and current hit
stack afterwards. The handle is outside `data-point-id`; selected owner, its
actual handle group/path and model name establish ownership. Pointerdown retains
its current CTM/local bounds/center/hit target. Preparation retains viewport,
scroll, camera and active work-plane controls/status.

The geometric and layout callers keep their original `(+28,-16)` and `(+22,-14)`
four-step native drags. Scoped phases distinguish setup, drag, Undo/Redo and
cleanup. Raw targets/composed paths, trust, pointer IDs/buttons/client positions,
capture transitions and post-handler capture states precede movement assertions.
Capture-phase down need not show capture before the handler. Matching captured
move/up on the owned SVG root is valid; unrelated targets/owners/pointers,
cancellation, untrusted input and unchanged coordinates fail. Event coordinates
permit only .05 CSS px browser quantization; requested coordinates and CTM-derived
geometry remain exact. This does not change PGF reference tolerances.

Both independently loaded contracts validate the raw delivery, actual selected
position delta, unchanged other data/camera, exact one bounded history commit,
and native Undo/Redo JSON/history restoration. Summary booleans cannot supply
missing records. Observations/artifact/cleanup failures remain secondary to the
first action/assertion failure; every owned observer is removed on exit, and
duplicate installation cannot remove another owner's observer.

Layout contour/body owner cycling now closes/prepares before fresh measurements
and retains actual owner events/selection/data/history. Production sorts identical
equal-distance point candidates by stable ID; a null cycle starts at index 1.
The explicitly planned first Alt action therefore asserts the overlap owner,
then the continuation asserts `app-point`, freshly measuring each action and
aborting on the first failure. The pure production ordering regression and raw
owner-cycle rejection controls document this correction; no blind retry or
production selection change is included. Shape/parameter Inspector reopening
remains native. Locked clicks also measure after Select/scroll.

The registered 64-case helper suite and extended 32C/32D policy suites are
explicitly synthetic. Existing 46 selection controls are preserved. Controls
cover inherited reopening/one close/closed no-op, stale/missing/detached/wrong
geometry and obstructions, trusted handle plus captured root continuation,
contaminated selection/fabricated flags, pointer/owner/capture/cancellation errors,
unchanged/camera-only/other-point changes, history capacity and exact Undo/Redo,
and primary-error precedence. The isolated runner fixture copies the new
transitive validator dependency; its initial missing-module failure is retained.

No model, solver, rendering, overlay behavior, saved schema, PGF input/artifact,
TikZ generation, dependency or verification profile changes. The independent
172-box / 4,925-anchor / 11-failure inventory is preserved. The diamond
outer-separation exception still needs independent PGF review. Final checks and
complete diff/inventory are retained under
`/private/tmp/stz-32d-native-drag-fix-20261009/`.

Final child checks used Homebrew-first Node v26.9.0: full `npm test` passed
5,507/5,507 with no failures/skips, combined drag/selection/ownership controls
passed 297/297 and isolated runner controls passed 37/37. The first full run's
37 missing-module fixture failures remain in `npm-test-initial.log`; the
corrected fixture copy list passed the complete rerun. Build and diff checks
passed. Ten changed scripts passed syntax; recommended script lint has no new
errors. The geometric caller's four `no-unsafe-finally` errors and unchanged
verifier's unused `_role` error reproduce from HEAD. Overall lint attempts
including that baseline debt remain failed, not lint passes.

Both required child browser commands failed at fresh owned-server `listen EPERM`
before Chrome; label-assets passed its static graph only. Free-labels retained
strict mode and zero completed groups. These startup failures are distinct from
the parent's real first diamond drag failure. Fresh handle/capture/history
observations, all eight contour interactions, full layout/anchor matrix, native
JSON/TikZ persistence, actual pending transparent/white downloads and standalone
reopening remain required in the browser-capable parent. No independent
acceptance review began. Use a fresh `32D verify` process on the exact final
dirty tree, then matching read-only review only after complete accepted evidence.
Phase 32 remains incomplete; commit/push remain with the parent workflow.

## Same-document native drag revision contract (2026-10-10)

The actual clean starting checkout is `8d0a3dab4bea1fd3baf7889ffcfdb16c4478bd20`
on `phase/32d-margin-minsize-anchor`, fingerprint
`708282ded8a7079f0add86d8f60bf67158216601e80614ece73121d19cc1c1fc`.
It already tracks the thirteen-file native-drag handoff and the updated prompt.
The actual inventory, diff and final tracked/untracked identity are captured under
`/private/tmp/stz-32d-revision-fix-20261010/`; older fingerprints are diagnostic
history, never acceptance constants.

The retained `5waNKq` parent records the first 2D diamond, codim 2, aspect 1.8,
source `drag $x_i$`, selected owner `app-point`, document epoch 100. Records
0001–0005 retain one native Inspector close, fresh handle start approximately
`(1296.4,268.975)`, original `(+28,-16)` displacement and four movement steps.
Trusted pointerdown reaches the intended selected-position handle; pointer ID 1
captures the owned canvas, receives all four moves and pointerup, then releases
capture with lostpointercapture retained. Position changes from `(3,3,0)` to
`(3.191563400173898,3.1286778583820283,0)`. Exact saved/runtime comparisons show
only that selected position changed. History equals the prior history plus one
effective bounded commit, with redo cleared; both past lengths are 100 because
capacity is full. Authoritative and observed before/after revisions are 100,
with no secondary diagnostics or page errors. Record 0004 precedes assertion;
0005 preserves the same evidence, final observation and primary revision failure.
No native Undo/Redo records exist for that failed first case.

`App.tsx` initializes this runtime document ownership epoch outside Diagram/history
and advances it only in `selectExample` and `commitLoadedJsonDiagram`. Geometry
drag sessions and Undo/Redo edit/restore the current diagram under the same epoch.
`SvgDiagram` keys its label-bound and point-commit maps by that document ownership;
source/font/request/placement changes have their existing mechanisms. No production
revision setter, schema, model, rendering, geometry or persistence behavior changed.

`pointNativeDrag.mjs` now validates nonnegative integer revisions and exact
same-document equality across preparation, movement, native Undo and native Redo.
Observed revisions still match their authoritative states; scoped native drag
events must retain the before-state epoch. Real selected-point movement, unchanged
camera/work plane/source/style/other data, exact bounded history and native delivery
checks remain. The synthetic fixture retains epoch 100 throughout instead of
fabricating 100→104→105→106. Its genuine position/history transitions and trusted
event/capture records remain explicitly synthetic, never native acceptance.

The registered helper and both parent-imported policy suites add 114 revision
regressions. They accept unchanged epochs 0/100, reject increased/decreased/missing/
null/negative/fractional/string/nonfinite revisions at each action, reject invalid
preparation epochs and observed/authoritative disagreements, and retain earlier
movement, owner, camera, multiple-commit, history, contamination, capture and
cleanup/primary-error controls. Redundant snapshots/successor states are updated
consistently so faults reach the epoch rule. Native JSON load still requires exactly
one ownership increment and reused-ID completion cannot restore an obsolete owner.
Both geometric/layout contracts, callers, runner dependency-copying/clean-tree
guards and strict cumulative policy are preserved byte-for-byte.

Focused drag/selection/ownership/policy/runner verification passed 524/524 with no
failures/skips, including all 37 runner controls. The two policy suites separately
passed 261/261. Homebrew-first Node v26.9.0 was used. Full `npm test` passed
5,621/5,621 with zero failures/skips, exit 0 (`npm-test.log`). Build (strict TypeScript), diff and eleven script syntax
checks passed; no TypeScript source changed. Recommended JavaScript lint found
zero new errors. Four geometric caller `no-unsafe-finally` errors and the verifier
unused `_role` error reproduce identically from read-only HEAD and live files;
overall lint including those baseline files remains failed.

Both required configured browser attempts failed at fresh owned-server `listen
EPERM 127.0.0.1` before Chrome launch. Label-assets passed its static graph only;
strict free-labels completed zero groups, leaving all eighteen unexecuted. These
startup artifacts identify their attempted tree before this final documentation
update and provide no native acceptance. This child restriction is separate from
the latest parent's real revision assertion. Native first-diamond Undo/Redo, all
eight original 2D/3D contour interactions, later visibility/export, complete
layout/anchor matrix, actual pending transparent/white downloads and standalone
reopening remain required from a fresh browser-capable parent verifier.

All original production files and PGF shape/anchor/paint references are preserved,
including the 172-box / 4,925-anchor / eleven-failure inventory, raw artifacts and
tolerances. The documented diamond outer-separation exception still requires
independent PGF review. No dependency, scoped/deferred 32D profile, sandbox change
or acceptance waiver was added. Fresh `32D verify` on the exact final dirty tree
must pass all five required commands and complete cumulative raw evidence before
read-only independent review of the matching checkout. No acceptance review,
commit or push occurred. Phase 32 remains incomplete.
