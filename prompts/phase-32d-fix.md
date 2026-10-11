# Phase 32D Fix for resolved layout and native edit provenance

## Objective and preserved implementation

Continue from the implemented Phase32D checkout, including native 2D zoom/control
and root-relative placement proof, unique export-path inline-node binding,
deterministic pending fixture/preparation and all preceding fixes.
Repair the next concrete parent failure: the view baseline compares resolved
preview layout with the entire authored model layout, including units provenance.

Keep the correct production distinction. Preview layout contains resolved
dimensions, anchor and font context; authored layout preserves dimension source/
unit/context metadata. Correct the harness comparison and exact native-edit
baseline, then make the synthetic fixtures faithfully represent both forms.
Do not alter production model, rendering, Inspector, serialization, camera,
geometry or PGF references to make the assertion pass.

Keep all current native view/control/matrix checks, pending/click/release contracts,
inline binding and complete SVG/PNG/TikZ acceptance.
Do not repeat completed fixes or rewrite unrelated files.

Read `AGENTS.md`, `prompts/phase-32d-implement.md`,
`prompts/phase-32d-review.md`, `docs/PHASE_32D_IMPLEMENTATION.md`, and
`docs/PHASE_32_PLAN.md`. Inspect the actual tree before editing.
Keep cumulative strict verification, verification-before-review/commit and
the exact-tree post-review identity guard.
Phase32 remains incomplete until accepted verification and matching review.

## Latest evidence and checkout identity

Latest child handoff:
`/private/tmp/stz-32d-view-fix-20261011/HANDOFF.md`.
Its exact inventory, diff, identities, preservation hashes, reports and logs
remain in that directory. Newer browser-capable parent records:

- Worker:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-4XpVdp/response.json`.
- Verification:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-E5qxLx/verification.json`.
- Free-labels log:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-E5qxLx/05-check-free-labels/command.log`.
- Raw evidence:
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-E5qxLx/05-check-free-labels/artifacts/`.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `63a6afc6ae212458d17d0fe11849bf2957ecb2f7`.
The actual pre-prompt-update tree matches parent checkout/checkoutAfter and child:

~~~text
ded68d9355198d2bdb1dd7a94b797d75b56fbdfc7dca461d1dfee295fe0ea3f9
~~~

Preserve eleven modified tracked files: both Phase32 documents, `package.json`,
`scripts/automation/phase-verification.mjs`,
`scripts/checkPointLayoutAnchors.mjs`, `scripts/pointLayoutAnchorsContract.mjs`,
`scripts/pointLayoutPendingFixture.mjs`,
`tests/scripts/phase32dVerification.test.mjs`,
`tests/scripts/pointLayoutPendingFixture.test.mjs`,
`tests/scripts/runPhaseRunner.test.mjs` and
`tests/scripts/standalonePointDownloadFixture.mjs`.
Preserve three new files: `scripts/pointLayoutPendingView.mjs`,
`tests/scripts/pointLayoutPendingView.test.mjs` and
`tests/scripts/pointLayoutPendingViewFixture.mjs`.
Earlier pending preparation/body/diagnostic/capture corrections are tracked.
This prompt edit changes the fingerprint: capture the actual current tree
rather than treating this historical identity as future acceptance.

| Retained run | Actual result |
| --- | --- |
| View/inline-binding child | 6,347/6,347 full tests, 779/779 focused checks, 37/37 runner checks, build and diff passed. Focused fixture TypeScript/changed-helper lint/syntax passed. Fresh strict verification stopped at label-assets server `listen EPERM` before Chrome; separate direct browser attempts also stopped before launch. Baseline lint/type checks remain failed. No completion review/commit/push. |
| Latest E5qxLx parent | 6,347/6,347 tests, build, diff and full label-assets passed. Native Chrome launched and 16/18 groups completed. Transparent pending selection and held SVG click succeeded; view baseline validation failed before any zoom fill. |

Preserve E5qxLx terminal successes: complete geometric eleven-shape/eight-contour/
visibility group and both geometric transparent/white native downloads with
reopening/PNG acceptance; layout90 sizing cases across15 shapes; 305 supported
anchor cases and all six unsupported 2D/3D×ellipse/circle/cylinder ordinary
body → far → warning cases; native controls/persistence; six imports/order/unit
cases; eleven async transitions; four 2D/3D×rectangle/circular-sector native
interaction cases and two negative-padding body-overflow/Alt-cycle cases.

The first six layout scenarios passed. Both pending layout downloads and final
standalone acceptance remain incomplete/unexecuted.
An SVG click while held is not a terminal downloaded-file acceptance.
Page errors are empty. Historical passes cannot replace fresh changed-tree checks.

## First failure and retained observations

The actual first failure is `assertPendingLayoutViewStage` at
`scripts/pointLayoutPendingView.mjs:170`, reached through `changePendingLayoutView`
line288 and `checkPointLayoutAnchors.mjs:666`:

~~~text
actual resolved preview:
{ innerXSep:3, innerYSep:1, outerXSep:5, outerYSep:2,
  minimumWidth:110, minimumHeight:25, anchor:'north',
  fontContext:{fontSizePt:10,xHeightPt:4.30554} }

expected incorrectly spreads raw model layout:
{ ...same values,
  units:{minimumWidth:{source:'110',unit:'pt',texPoints:110}},
  fontContext:{fontSizePt:10,xHeightPt:4.30554} }
~~~

Read `free-labels-evidence.json`,
`point-layout-pending-transparent-edit-preparation.json`,
`point-layout-pending-transparent-edit-post-click-view.json`,
`point-layout-pending-cleanup.json`, current selection records and native
source/anchor/minimumWidth diagnostics before changing code.

The raw view artifact honestly contains only `before`:
`fillCount:0`, unique numeric/slider counts1, zoom1/slider1, pan0/0,
no control events, no observation errors. The actual camera disclosure was
initially closed, opened for baseline measurement and restored closed.
Observer removal/disclosure restoration succeeded; secondaryErrors are empty.

Selected circle has source `later $changed$`, anchor north, minimumWidth110,
and exact units metadata shown above in both saved and runtime JSON.
Rectangle/cylinder retain their original sources/layouts.
All three observed nodes are connected/current; the circle is ready for its new
source. Its original export source remains held with started2/completed0/
releasedfalse. Do not confuse new-source readiness with captured-source release.
Current before-stage root-relative origins are measured, but no after-stage
zoom geometry or native zoom input exists. This run proves no completed zoom.

The immutable click snapshot still has all15 points, selected layout-circle,
revision427, original captured transparent source, anchor base/minimumWidth35
and click-time started1/completed0/unreleased. The later hold count2 is distinct.
No intended release, saved pending-layout SVG/PNG/TikZ or reopening acceptance
was reached. Cleanup subsequently released both held requests without errors
and released the export listener; this is failure cleanup, not acceptance.
White pending and final standalone are unexecuted.
Do not reclassify this browser-capable parent failure as child startup EPERM.

## Correct the resolved-layout oracle

Trace the unchanged production contract:

1. `src/ui/inspector/PointLayoutFields.tsx` uses `updatePointNodeDimension`.
   Native Minimum width input `110` means pt when no suffix is written.
2. `src/model/pointNodeLayout.ts` stores resolved minimumWidth110 and
   `units.minimumWidth={source:'110',unit:'pt',texPoints:110}`.
   It preserves other authored metadata and per-axis contexts.
3. `resolvePointNodeLayoutOptions` returns exactly six numerical dimension
   fields, anchor and merged fontContext. Its resolved type has no units.
   Legacy size/stroke/default precedence and resolution are unchanged.
4. `src/rendering/svgPointNodeLayout.ts` computes that resolved form;
   `src/rendering/svgPointNodeView.ts` serializes it as `data-point-layout`.
5. The harness spreads `point.model.style.layout` into expected DOM layout.
   This injects authored units into a diagnostic that intentionally omits them.

Use a narrow explicit resolved-field expectation for the actual preview.
Compare the entire parsed DOM layout strictly with the correct resolved schema:
all six dimensions, anchor and effective fontContext. Reject missing, malformed,
extra or incorrect resolved fields; keep current owner/source/request/model
binding and finite geometry checks.
For this complete pending fixture, the authored six dimensions are explicit.
Do not add an unrelated generic normalization framework or redefine fallback
semantics. If supporting omitted values, match existing size/stroke/font-context
precedence exactly with meaningful existing controls.

Keep raw authored layout separate and exact in the authoritative model/saved
state/history and stage invariants. Its source, unit, texPoints and applicable
per-axis/context metadata remain mandatory wherever the native edit supplies
them. The absence of units in resolved DOM is correct; absent or altered units
in the authored expected baseline is not correct.

Do not merely delete the comparison, allow arbitrary subsets, globally strip
metadata from records, copy actual DOM into its expected value, or relax all
deep-equality/persistence checks. Do not add units to production preview diagnostics
or drop units from production model/persistence to make schemas identical.
Keep raw persisted observations unchanged, including failed pre-input records.

## Correct the exact native-edit baseline and faithful fixtures

A second source-proven defect is in `assertPendingLayoutViewEvidence`'s intended
post-click baseline construction around lines195–197. It changes circle text,
anchor and minimumWidth110 but does not add native units metadata.
After fixing the first stage comparison, its exact runtime equality would still
reject the real Inspector edit. This is inspected code, not an executed second
native failure in E5qxLx.

Construct the expected baseline from the immutable complete click-time model
and the actual declared native edits: source `later $changed$`, anchor north,
minimumWidth110, with minimumWidth provenance
`{source:'110',unit:'pt',texPoints:110}`.
Preserve pre-existing units for other axes and any existing font contexts.
Do not invent pt-axis font metadata that the native editor does not add.
Require exact full runtime/model equality after only these intended edits.
Keep exact saved/runtime/history/selection/revision/uiSettings invariance during
the subsequent view-only action. Do not base the expected edit on the unvalidated
actual model or discard provenance before equality.

`tests/scripts/pointLayoutPendingViewFixture.mjs` repeats both mistakes:
numeric-only minimumWidth edit and raw-layout spread into synthetic DOM.
Update it to represent actual native provenance in runtime/saved/history present
and resolved-only preview diagnostics.
Retain honest intermediate source/anchor history snapshots, the immutable old
click source/layout, all15 points and all current synthetic native view geometry/
control/event/hold/cleanup contracts. Avoid using the assertion under test to
generate its own expected success. Coordinate any dependent parent-policy/
standalone/runner fixtures; do not loosen their required raw records.

Add a small set of meaningful regressions that exposes both bugs:

- The faithful native `110` edit retains units in authored saved/runtime model,
  omits them from resolved preview, and passes genuine control/projection proof.
  A direct before-stage test and complete evidence test should exercise both
  stage and exact-baseline paths.
- Missing/changed minimumWidth source, unit or texPoints in the authored baseline
  fails even if resolved minimumWidth stays110. Preserve applicable context and
  other-axis metadata; view-only metadata changes must fail exact invariants.
- Missing/changed dimension, anchor or effective fontContext, malformed layout
  JSON or unexpected fields in actual resolved DOM fail.
  A fixture incorrectly including authored units in resolved DOM fails.
- Preserve existing no-op/unapplied zoom, numeric-only/CSS-only movement,
  invalid matrix, stale owner/request/epoch, changed model/history/pan,
  early release, rewritten click and cleanup/diagnostic-error negative controls.
- Fresh parent validation still requires matching full raw native view artifact/
  diagnostics/terminal/standalone records. Add a focused metadata corruption
  control where needed; summary flags or synthetic fixtures cannot replace
  actual native acceptance.

Keep existing import units, per-axis em/ex, context cloning, persistence and
PGF controls. Do not inflate broad test matrices or rewrite successful suites.

## Preserve implemented 2D view and inline binding

Keep the scoped `pointLayoutPendingView.mjs` helper: actual unique zoom numeric/
associated slider/disclosure, baseline after required expansion/scroll and
intended source/layout edits, target1.4 differing from baseline, one ordinary
native fill and truthful ordered trusted input/optional change evidence.
Keep bounded before/immediate-input/after observations persisted before validation,
current references, ranges, pan and exact state/hold invariants.

Keep connected outer point origins for circle/rectangle/cylinder normalized
through finite invertible native node/root matrices into the actual SVG root.
Stable rectangle/cylinder separation must follow zoom on both axes; measured
fixed origin verifies absolute placements at fixed model coordinates/pan.
Retain precise propagated binary32 rounding, viewBox/viewport/scroll evidence,
immutable click identity and primary-error-preserving observer/disclosure cleanup.
Root screenCTM may remain constant; CSS/scroll-only movement cannot pass.
Do not substitute text/contour/anchor-offset changes or async completion for zoom.
Production 2D uiSettings/persisted camera omission remains correct.

Keep mandatory `point-layout-pending-transparent-edit-post-click-view.json`,
ordered fresh diagnostics and their binding into actual terminal/standalone
records and parent validation. Failed before-only evidence cannot pass.

Keep unique `export-path` inline binding through the complete current pending
fixture, correct geometricKind curve/kind polyline, both exact declared inline
nodes, raw content/order/placement/options and existing XML checks.
Preserve missing/duplicate/wrong-kind/changed-content regressions, both free labels,
all15 points and successful distinct async sibling snapshots.
Do not restore the former `siblings[0]` lookup or weaken content comparisons.

## Preserve pending fixture, preparation and immutable downloads

Keep `pointLayoutPendingFixture.mjs`'s declared initial positions:
circle (7,6.5,0), right grid x19/23/27/31 and rows13/9/5/1 with its per-shape
assignments. Preserve all fifteen ids/shapes/order/full sources/styles/layout/
parameters, circle at index0, two free labels and the export-path inline nodes.
Keep pre-load cloning and normal JSON load, with no outcome-based repositioning.

Keep `pointLayoutPendingPreparation.mjs` and the unchanged shared .23 native
selection helper, current sibling body/contour bounds/CTMs/owner/request/state,
real first hit/stack, current held request, authoritative state invariance,
immediate input binding, one ordinary trusted no-modifier gesture and selected
owner proof before Inspector reopening. Keep separate preparation artifact,
native modifier cleanup, UI restoration and first-error handling.

Keep actual click-time snapshots for all fifteen points, selected owner,
background control and held conversion. Require current unreleased pending
source at the SVG click, exact source/style/position entries and intended
post-click release. Do not conflate cleanup release with that successful boundary.

Preserve the sequence: hold full source → normal combined load → pending native
selection → actual background control/armed snapshots → SVG click while pending →
transparent source/layout/view edits or white replacement load → intended release →
actual downloaded file → original-fixture reload/settled expectations/both TikZ
modes → external standalone reopening → complete-root PNG validation.

Keep captured old source/layout/placement after post-click changes, no edit/load
leakage, actual ready MathJax expected nodes, pending-versus-settled contour
inequality, cylinder paint/shape-center anchors and combined label/path content.
Do not settle/release the held source before click or weaken source/position
comparisons to accommodate later changes.

## Contracts and cumulative continuation

Retain current preparation/hold/click/release/view and SVG/PNG/TikZ raw contracts.
Terminal and standalone observations must agree with the same actual persisted
records and immutable click snapshot. Missing, unrelated, stale, failed or
summary-only evidence cannot pass.

Register any new test in the explicit test list and copy actual imported
dependencies into isolated runner fixtures. Preserve current policy/ownership/
runner controls. Add no dependency without explaining necessity.
Use strict TypeScript without `any`; preserve 2D z=0, active 3D work planes and
the mathematical codimension convention.

Use the same cumulative pages and strict predecessor sequence. Preserve fresh
geometric and first-six-layout acceptance; complete both pending transparent/
white SVG/TikZ downloads, reopening/PNG acceptance and final standalone export.
Diagnose any next first failure from fresh raw observations.

## Preserve completed native, visibility, geometry and capture work

Keep Clear's detached imported paint/shape/layout behavior, exact persistence,
raw source, history, policy/UI regressions and JSON reload.

Keep scoped native Inspector/toolbar preparation, real Select before conditional
collapse, state invariance, fresh fixed .23 contour/CTM/hit, trusted owner/path,
owned restoration and first-error handling. Keep precise SVGPoint binary32
allowances without changing PGF tolerances.

Keep selected-point drag/layout movement, trusted handle/capture/release, one
history commit, exact saved/runtime Undo/Redo, field Inspector reopening and
owner cycles. Keep same valid revision through drag/Undo/Redo, native JSON-load +1,
stale reused-ID isolation and existing cache/revision semantics.

Keep canonical layers, exact-caption/associated-select visibility resolution,
dim/hide/dim/raw provenance, honest trusted=false selectOption records, native
theta90/phi0 and intended UI-angle-only changes, actual owner/occluder/opacity
validation and conditional owned preparation/restoration helpers.

Keep preview-only current body bounds/placement/request targets, nonempty finite
conditions, inherited layer/filter/lock behavior and detached/export exclusion.
Keep ordinary unsupported body/warning hits, bounded rings, body overflow,
contour/Alt selection and production-backed regressions.
Keep four fixed diagnostic candidates/first eligible adoption, six-unit visible
clearance, bounded-ring exclusion, viewport/clipping and genuine far background
delivery. Preserve all six ordinary body → far → warning cases.

Keep saved envelope version2, additive layout, legacy Size/2 precedence, ordered
shorthand/axis resolution, per-axis em/ex contexts, PGF solvers/anchors, actual
body/baseline/depth and painted/anchor-clearance bounds, 2D/3D projection and
immutable click-time placement. Preserve external raw text and existing
typography/paragraph/TeX-program limitations, free labels and inline path nodes.

Retain independent 172-box / 4,925-anchor / 11-failure reference inventory,
raw/reference files and tolerances. No geometry/reference regeneration is
justified by this observation/binding correction.
The diamond outer-separation exception still requires independent PGF review.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling/one native image/no retry, complete-root coverage, at most one
viewport expansion, stable coordinates and exact SVG/PNG file identity.
Preserve pre-image reopening records, owned page/listener cleanup,
no extra failure screenshot and primary-error handling.
Keep actual PNG CRC/chunks/inflated scanlines/dimensions/byte length validation,
independent source/contour/cylinder paint/placement/background checks, explicit
artifact lists and runner copying. Reject incomplete/cropped/unrelated/changed
images, missing raw observations or mock PNG headers.

## Fresh verification and parent handoff

Use Node >=22.12.0 through Homebrew. Run focused resolved-layout/provenance/
native-baseline/faithful-fixture checks plus current view/preparation/inline
binding, layout/capture, parent-policy/ownership and runner checks.
Run required commands:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run applicable focused TypeScript/lint and changed-script syntax checks.
Report reproduced baseline debt accurately: geometric caller's two
no-unsafe-finally errors, modified verifier's inherited unused _role, unchanged
layers' unused defaultCurveStyle and eleven inherited focused strict-TypeScript
diagnostics. These checks remain failed; application TypeScript/build is separate.
Do not relabel baseline failures as passes or expand into unrelated cleanup.

Use a fresh owned server and supported Playwright/Chrome in the browser-capable
parent. Focused/scoped evidence cannot establish strict32D acceptance.
If child browser attempts encounter `listen EPERM`, retain startup failure and
exact tree for the parent without weakening sandbox/acceptance rules.
The latest parent's resolved-layout assertion occurred after native launch.

Load updated helpers/contracts/policy in a fresh parent process and verify
the preserved dirty tree without committing:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Preserve implementation/fix clean-tree guard. Do not reset, discard, stash,
commit or push unfinished work to bypass it.
Require all twelve31F groups, three32A groups, complete32B paint/import,
complete32C shapes/visibility/downloads and point-node-layout-anchors-combined.
Require terminal successes, actual valid artifacts, no page errors, native
history/JSON persistence, both TikZ modes, both pending downloads and reopened
standalone SVG/complete PNG acceptance.
Do not skip predecessors, reuse historical/scoped reports, create a deferred32D
profile or reclassify unexpected failures as backlog.

## Independent review and completion

After complete fresh strict parent verification, obtain read-only independent
review of the exact matching tracked/untracked tree using
`prompts/phase-32d-review.md`. Inspect actual report/artifacts.
Matching accepted evidence can support a sandboxed reviewer; stale, partial or
failed reports cannot substitute for acceptance.

Update status only to observed accepted results. Keep Phase32 incomplete while
any native/download/reference/review gate remains open.
Preserve stop-before-review/commit on failed verification and the parent's
post-review identity guard.

Report corrected resolved-layout/native-edit expectations and faithful fixtures,
preserved production/view/pending/capture contracts, changed files, focused/full
checks, fresh parent evidence/identity, actual transparent/white downloads/final
standalone coverage, review result and any remaining concrete first failure.
Leave commit/push to the parent after verification and review pass.
Do not claim completion from child-only or historical results.
