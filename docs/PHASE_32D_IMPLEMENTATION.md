# Phase 32D spacing, minima, anchors, and combined audit

Status (2026-10-08): implementation and focused Node verification are present.
Phase 32 is **not complete**. Fresh accepted required commands, strict native
browser/download evidence and independent review remain required. 32A and main's
later 32B have historical accepted evidence. The plan still records unaccepted
fresh strict native/review gates for the merged 32C checkout; implementation
presence does not close that prerequisite or the final gate.

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
