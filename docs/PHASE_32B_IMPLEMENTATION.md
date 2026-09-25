# Phase 32B: Independent point paint and imported styles

Status: 32B remains incomplete pending fresh matching browser-capable parent
verification and independent review of the targeted import/override fixes below.
The `xgI0o0` pre-fix parent verification passed; the subsequent independent review
ran and requested changes for three Medium production defects. Its browser,
responsive saved-body/font/background and PGF evidence remains accepted for that
historical tree. See the final section for these fixes and current handoff.

Historically, the prior checkout passed parent verification, then independent review
rejected it for two Medium production defects: imported-style namespace lookup
and responsive point-border geometry. This targeted correction addresses both;
fresh verification and subsequent independent review of the corrected checkout
are required before completion. 32C/32D remain deferred. No new dependency or
schema change is introduced.

The accepted parent is `stz-phase32b-before-review-yeWQVG`, revision
`a3f5998bd5b74e8622ca5e599390f2c32f65e070` plus the retained working-tree diff,
with matching before/after fingerprint
`17c0b7af52dc566d3f6a3abb8c6de927c755301d57644cf0481705e2f51a434b`.
All five commands passed, including both browser commands; all 16 groups and
16 named point scenarios completed with 160 evidence records and empty page-error
and incomplete-group arrays (Node v26.9.0, Chrome 153.0.8010.53). Actual point
paint SVG downloads, standalone reopen JSON/PNG, command logs and checkout
snapshots were inspected. Independent review ran 2,769 passing tests and a
passing build, found zero Critical and two Medium issues, and returned
`ready_to_commit: false`. Its additional sandbox-blocked browser launch does
not invalidate the matching accepted parent evidence.

The earlier Inspector locator, disabled-control and selection-oracle failures
described below are historical and superseded by that successful parent run.
Their corrections and evidence are retained. The accepted parent is a baseline,
not verification of the production changes made in this correction.

## Targeted namespace and responsive-stroke correction (2026-09-24)

The namespace resolver previously tried the declaring style's directory first
and changed that owner during nested expansion. PGF expands `.style` bodies in
the active invocation directory; normal node invocation starts in `/tikz`.
`ns/outer={base}` therefore refers to root `base`, even when `ns/base` exists.
The resolver now uses that runtime context, with internal canonical identity
shared by declaration deduplication, lookup and cycle detection. Bare `base`
and `/tikz/base` obey the same last-definition-wins order, including repeated
alias overwrites. `/other/base` and relative `tikz/base` remain distinct.
Raw source/options, saved reference identity, external key spelling and load
hints are retained. Unknown references stay diagnosed/unresolved, preserving
external effects until later known options or local paint edits resolve them.
Runtime `.cd` is explicitly unsupported; it never approximates declaration-relative
lookup or executes arbitrary TeX. See [the grammar](IMPORTED_POINT_PAINT.md).

The contour's `non-scaling-stroke` previously contradicted local layout at
responsive display scales. It is removed only from point contours; the shared
preview/detached view now scales their width, dashes and phase with their body.
No viewport-dependent layout, cache or export machinery was added. Pure
regressions retain shape/body/painted-bound distinctions, miter geometry,
selection tolerance, zero-alpha versus disabled paint, and immutable capture.

Changed production files are `src/model/importedTikzPaint.ts`,
`src/model/importedTikzStyles.ts`, `src/rendering/svgPointPaint.ts` and the
contract comment in `src/rendering/svgPointNodeLayout.ts`. Focused model and
renderer tests, independent PGF fixtures, the native paint harness/oracle,
document-only native fixtures and verifier policy/tests extend their existing
coverage. Preview/adapter notes and this report describe the corrected contract.
There are no new dependencies, schema changes or unrelated lint repairs.

The retained ten-row PGF opacity/color-order fixture remains unchanged.
The added [namespace reference](../tests/fixtures/point-paint-pgf/namespaces/README.md)
retains independently compiled PGF results for root shadowing, qualified nested
references, both alias declaration directions, repeated overwrites and distinct
absolute directories. Missing root `base` is expected-failure evidence: PGF
reports unknown `/tikz/base`, even though `ns/base` exists. Bounded resolver
tests separately cover alias cycles, depth/work termination and unsupported
runtime `.cd`; recursive PGF compilation is not used for preview limits.

Mandatory browser coverage keeps the original 16 groups and 16 point scenarios
and adds `point-paint-namespace-aliases`, `point-paint-responsive-circle`,
`point-paint-responsive-triangle` and `point-paint-responsive-downloads`.
Namespace coverage uses actual imported-preset application, local edits,
download/reload and both TikZ modes. Responsive coverage uses measured CSS/root
SVG transforms below and above one, actual native screenshot pixels, 20pt
borders, independent 60-degree miter geometry, ordinary and Alt-click probes,
disabled/zero-alpha states and dash/phase samples. A deliberately non-scaling
contour must fail the physical-paint oracle. Actual transparent/white downloads
are reopened outside the App at both scales, with uncropped captures and no
editor overlays. Existing pending-edit/load isolation checks remain required.
Observations precede assertions; required artifacts and fail-closed policy
tests prevent completion from an old 16-scenario report.

These descriptions specify implemented checks, not a claim of fresh native
execution. The corrected-tree command results and handoff are recorded below.

## Prerequisite evidence

The earlier plan status was stale. The actual parent report
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-gtRban/verification.json`
passed all five required commands with Node 26.9.0 and Chrome 153.0.8010.53.
Its free-label evidence completed all 15 groups and 11 named point scenarios,
with empty page-error arrays and nonempty required JSON/SVG/PNG artifacts.
`logs/codex/32A-review.log` and `32A-review-summary.json` record the subsequent
independent passing review and `ready_to_commit: true`.

The accepted fingerprint is
`804bf81f7a02433884cd92e6547e564ef2811eb12bdf9c19f731ae33b1c44420`.
The SHA256 of the binary diff from `d02c0d4` to this task's clean starting
`595139d`, excluding the four then-untracked files, matches the report's
`f59627bb19409fc07e6b1daca8102d5128c1798ed40ad85e4f22d0298b44d659`.
All four committed file hashes match its untracked hashes. This establishes the
32A prerequisite, not a browser pass for the new 32B changes.

## Saved representation and migration decision

The saved envelope advances to version 2; the internal `Diagram.version` remains
1. Loading accepts envelope versions 1 and 2. Both point strata and saved user
point presets materialize explicit `paint` on load/save. Raw body text and
coordinates are unchanged. No runtime conversion, SVG, metrics or cache enters
the model/history. Malformed explicit paint is rejected, not silently repaired.

`PointStyle.paint` contains `text {color, opacity}`, `fill {enabled, color,
opacity}`, and `stroke {enabled, color, opacity, width, lineStyle, dashPattern?,
dashPhase, lineCap, lineJoin}`. Width, dash lengths and phase use TeX points.
The existing `opacity` is an independent application multiplier applied once to
each operation, including visibility dimming. Paint is authoritative whenever
present. Legacy `color` and `fill` remain compatibility metadata, not competing
paint controls. Absence of paint in legacy programmatic input resolves black
text, same-color border/fill (white for hollow), alpha 1, solid 0.4pt border.
`size / 2`, the four legacy shapes and empty-node fitting retain their meanings.

Constructors create explicit paint; clones preserve legacy absence where needed
and deep-copy all present paint objects and dash arrays. Serialization normalizes
the saved copy. Disabled paint and enabled zero alpha remain distinct. Hollow
means white fill; transparent fill uses `fill.enabled=false`.

## Rendering and capture

Contour fill and border use separate SVG operation alphas. Text uses its own
color/alpha while validated explicit MathJax colors survive. Paint changes reuse
the source-keyed conversion and measured body. Border width expands painted
bounds, selection and picking, including polygon miter joins; body and shape
bounds remain distinct. SVG and PGF use miter limit 10. Dimming multiplies each
paint once, without introducing a contour group opacity.

Point contours use ordinary geometric SVG scaling. Width, dash lengths and
phase are TeX points multiplied by 1.2 in local SVG coordinates; responsive
root viewBox/CSS scaling multiplies their displayed size with the body. A 20pt
border has local full width 24 and half-width 12 at every display scale.
Painted bounds and the existing 6-local-unit picking/selection padding therefore
stay coherent, including polygon miter extensions. Enabled zero-opacity borders
retain their geometry; disabled borders do not. Only the selection overlay keeps
its own non-scaling outline. Unrelated curves, handles, markers and formula
outlines are unchanged.

The whole-point export capture deep-copies and freezes every paint component and
dash array before waiting. Detached export uses the same point layout/view as
preview. Later nested paint edits cannot mutate an in-flight download.

## Imported style grammar and reference

See [the precise grammar and precedence](IMPORTED_POINT_PAINT.md) for declaration
forms, namespaces, bounded references, supported xcolor names/mixtures and
literal definecolor models, numeric/dimension grammar, and unresolved option
behavior. Border width must be positive; PDF's device-dependent zero-width
hairline is explicitly diagnosed as unsupported preview input and retained for
external TikZ. The user can disable Border instead. Contextual em/ex, new shapes,
minimum dimensions and configurable anchors remain later-stage work.

The independent [PGF fixture](../tests/fixtures/point-paint-pgf/README.md) was
compiled using PGF 3.1.11a and pdfTeX 1.40.29 (TeX Live 2026). Its actual PDF
operators establish graphics/text opacity order, general/specific color order,
none and zero-alpha states. The retained PNG was inspected. No application
resolver generates those expected values.

## Native acceptance added

The cumulative policy requires all 12 Phase 31F groups, all 3 Phase 32A groups,
and `point-node-paint-import-persistence`, containing these named scenarios:

- `point-paint-native-inspector-history`: legacy node/preset load, actual
  inspector mixed paint/invalid/zero/none edits, undo/redo, copy/bulk/duplicate.
- `point-paint-imported-presets-persistence`: both declarations, references,
  ordered/partial/unsupported styles, local overrides, both TikZ modes and actual
  JSON download/reload.
- `point-paint-lifecycle-dimming`: real pending/settled/fallback source and
  layout, paint-only conversion reuse, 3D occlusion, independent SVG operation
  alpha and raster overlap observations.
- `point-paint-pending-transparent-edit` and `point-paint-pending-white-load`:
  actual downloads reopened outside App, captured colors/alphas/dash/width,
  settled body/contour, source/history isolation and SVG/JSON/PNG artifacts.

These are implemented assertions, not native passes in the child session.
The checkout snapshot now hashes raw bytes consistently with the parent and
retains base64 binary/symlink snapshots, including the new PGF PDF/PNG. Regression
checks reject old 32A reports for 32B, missing terminal/scenario/artifact evidence,
checkout mismatch and failed verification before review/commit. The existing
fresh-process verifier is retained.

## Original implementation verification (historical)

Missing native evidence remains an acceptance gap. Screenshots, helper tests and historical 32A results do not close
32B's browser/review gates.


Executed with Node **v26.9.0**, npm **11.19.1**, `/opt/homebrew/bin` first in PATH:

| Check | Actual result / retained log |
| --- | --- |
| `npm test` | **2,679 passed**, zero failed/skipped; `/private/tmp/stz-32b-final-npm-test.log` |
| `npm run build` | Passed; existing >500kB chunk warning; `/private/tmp/stz-32b-final-build.log` |
| Strict production TypeScript | Passed; `/private/tmp/stz-32b-final-strict-tsc.log` |
| Strict fixtures/new test TypeScript | Passed; `/private/tmp/stz-32b-final-fixture-tsc.log` |
| Focused ESLint | 30 changed TS/TSX files passed; `/private/tmp/stz-32b-final-focused-eslint.log`; changed JS passed `/private/tmp/stz-32b-js-eslint.log` |
| Changed script syntax | 14 files passed; `/private/tmp/stz-32b-script-syntax.log` |
| `git diff --check` | Passed |
| `check:label-assets` | Failed before browser launch: localhost `listen EPERM`; `/private/tmp/stz-32b-label-assets.log` |
| `check:free-labels` | Failed at `development-server-listen`, `listen EPERM 127.0.0.1:5173`; `/private/tmp/stz-32b-free-labels.log` |

Focused model/UI, renderer with actual MathJax, imported paint/TikZ, policy,
runner and independent observation tests are included in the full registered
suite. The PNG/PDF PGF reference is actual compiled evidence. Native point
SVG/PNG downloads are **not** established in this child: the free-label failed
report at `/private/tmp/stz-32b-child-free-labels/free-labels-evidence.json` has
zero completed groups, all 16 groups unexecuted and no launched browser version.
Static asset inspection passed (4 entries, 43 worker chunks, 85 references,
40 approved font modules), which is not a native browser pass.

Focused lint of the changed existing `tests/tikz/generateTikz.test.ts` reports
25 `no-regex-spaces` errors. Running the HEAD version through ESLint with its
production filename reproduces the same 25 errors:
`/private/tmp/stz-32b-tikz-lint-baseline.log`. No unrelated lint cleanup was made;
repository-wide lint was not run because this demonstrates existing debt.

## Original implementation parent handoff (historical)

From the final checkout in the browser-capable parent environment:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Use the fresh verifier process and all five required commands. Inspect terminal
success, all 16 groups, all 16 named point scenarios (11 from 32A, 5 from 32B),
page-error arrays, actual scenario observations and required standalone files.
The parent report must match the exact checkout, including untracked PGF binary
fixtures. Then independently review that checkout against
`prompts/phase-32b-review.md`. The current child cannot close either gate; no
commit or Phase 32C/32D work was performed. The final child checkout identity is
saved outside the tracked tree at `/private/tmp/stz-32b-final-checkout.json`.

## Changed files

The implementation touches the model/serialization/preset/visibility boundaries,
point inspector and shared paint fields, bulk/update/summaries, point view/layout/
picking/capture, imported style resolver and TikZ generator. The following is
the complete changed/new file inventory; ignored build outputs are excluded.

- `docs/DATA_MODEL.md`
- `docs/IMPORTED_POINT_PAINT.md`
- `docs/LABEL_ADAPTER.md`
- `docs/PHASE_32B_IMPLEMENTATION.md`
- `docs/PHASE_32_PLAN.md`
- `docs/PREVIEW_UI.md`
- `docs/ROADMAP.md`
- `docs/SPEC.md`
- `docs/TIKZ_OUTPUT.md`
- `package.json`
- `scripts/automation/phase-verification.mjs`
- `scripts/browserCheckoutSnapshot.mjs`
- `scripts/checkFreeLabels.mjs`
- `scripts/checkPointNodePaint.mjs`
- `scripts/checkPointNodes.mjs`
- `scripts/fixtures/freeLabelsApp.tsx`
- `scripts/pointCheckDiagnostics.mjs`
- `scripts/pointExportReference.mjs`
- `scripts/pointLiteralOracle.mjs`
- `scripts/pointPaintOracle.mjs`
- `src/model/constructors.ts`
- `src/model/importedTikzPaint.ts`
- `src/model/importedTikzStyles.ts`
- `src/model/serialization.ts`
- `src/model/stylePresets.ts`
- `src/model/styles.ts`
- `src/model/types.ts`
- `src/model/validation.ts`
- `src/model/visibility.ts`
- `src/rendering/SvgPointNode.tsx`
- `src/rendering/svgHitTesting.ts`
- `src/rendering/svgLabelExportRegistry.ts`
- `src/rendering/svgPointNodeLayout.ts`
- `src/rendering/svgPointNodeView.ts`
- `src/rendering/svgPointPaint.ts`
- `src/tikz/generateTikz.ts`
- `src/ui/bulkEditing.ts`
- `src/ui/diagramUpdates.ts`
- `src/ui/inspector/PointPaintFields.tsx`
- `src/ui/inspector/PointStyleEditor.tsx`
- `src/ui/inspector/UserStylePresetControls.tsx`
- `src/ui/inspectorSummary.ts`
- `src/ui/layerPalette.ts`
- `tests/fixtures/point-paint-pgf/README.md`
- `tests/fixtures/point-paint-pgf/compilation.txt`
- `tests/fixtures/point-paint-pgf/observations.json`
- `tests/fixtures/point-paint-pgf/ordered-paint.pdf`
- `tests/fixtures/point-paint-pgf/ordered-paint.png`
- `tests/fixtures/point-paint-pgf/ordered-paint.tex`
- `tests/fixtures/point-paint-pgf/pdf-operators.txt`
- `tests/fixtures/point-paint/legacy-v1.json`
- `tests/model/importedTikzStyles.test.ts`
- `tests/model/pointPaint.test.ts`
- `tests/model/pointPaintImport.test.ts`
- `tests/model/serialization.test.ts`
- `tests/rendering/svgPointPaint.test.ts`
- `tests/scripts/browserCheckoutSnapshot.test.mjs`
- `tests/scripts/freeLabelsFailureEvidence.test.mjs`
- `tests/scripts/jsonPersistenceOracle.test.ts`
- `tests/scripts/pointPaintOracle.test.mjs`
- `tests/scripts/runPhaseRunner.test.mjs`
- `tests/scripts/runPhaseVerification.test.mjs`
- `tests/tikz/generateTikz.test.ts`

## Targeted circle-selection assertion correction

This correction started on `phase/32b-color-opacity-outline` at clean
`a2f2ba66faa9afe299dc5471ccc18bb43b043f42`, which includes the fix prompt and
prior implementation. No existing implementation, PGF fixture, FontFace cleanup,
verification policy or commit/review gate was replaced. No production geometry,
font metrics, schema or dependencies changed. 32C/32D remain deferred.

The historical parent report at
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-mGKjaz/verification.json`
and verifier response at
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-XephXb/response.json`
have matching before/after fingerprint
`8556ca895ef531add08c6a0d54164e18206c6eb1657bba22575530af5119eb02`.
That parent launched Chrome 153.0.8010.53: tests (2,679), build, diff and
label-assets passed. Free-label acceptance failed in the owned-font callback,
after 112 passing records, 10/16 completed groups and 3/16 point scenarios.
It was an executed selection assertion failure, not a browser-startup failure.

Its observations 0114/0115 record contour radius `70.76046333097682`, border
width `0.48` SVG units, and highlight `77.00046333097681`. The stale
`radius + 6` oracle expected `76.76046333097682`: it omitted exactly
`0.4pt * 1.2 / 2 = 0.24` SVG units, apart from binary floating-point arithmetic.
Observations 0117/0119 retain successful ownership-based font removal, the same
document/FontFaceSet, and restored radius `70.7953467895476`. Cleanup success
does not turn the incomplete font scenario into a pass. Six historical groups
remained incomplete: point body/layout/lifecycle, point picking/visibility,
point settled export, point paint/import/persistence, real-App JSON/history,
and standalone settled export. The last five were not reached.

`scripts/pointSelectionOracle.mjs` now supplies one independent circle contract
to resource recovery, injected-font selection, and selected restored geometry:

```text
expectedBorderWidth = declared.enabled ? declared.widthPt * 1.2 : 0
expectedHighlightRadius = currentNativeContourRadius + expectedBorderWidth / 2 + 6
```

The resource fixture explicitly declares the legacy enabled 0.4pt, opacity-1
border. The oracle independently checks contour stroke presence, stored width
and opacity against declared paint; rendered width cannot redefine the expected
contract. Disabled borders retain the positive stored SVG width attribute but
contribute zero geometry. Enabled zero-opacity borders still contribute their
half-width. Missing, blank and nonfinite measurements fail. The highlight's own
3-unit outline is separate. No tolerance was increased. This circle-only oracle
does not replace polygon miter-aware bounds or picking.

Before lifecycle assertions, including each post-click selection check, saved
observations include exact source, owner, request/current font generation,
declared paint, native contour/stroke attributes, expected components, actual
highlight/delta and model/history state. Restored selection uses the restored
contour. Finally-safe owned-face removal, same-page restoration, later-owner
reference checks and primary-error preservation remain in place; observation
records do not count as passed scenarios.

The registered `tests/scripts/pointSelectionOracle.test.mjs` adds 16 regressions
using the actual selected `SvgPointNodeView` SVG output: legacy 0.4pt, enabled
4pt, disabled stored 4pt and enabled zero-opacity borders; missing/doubled
half-width; stale pre-font-change selection; malformed/missing measurements;
wrong rendered width with a self-consistent wrong highlight; and diagnostic
persistence before failure. Its deterministic measurement providers exercise
view synchronization; they do not claim native FontFace acceptance.

### Correction verification and remaining gates

All commands use `PATH=/opt/homebrew/bin:$PATH`, Node v26.9.0, npm 11.19.1.
The first correction runner report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-Ir6IeD/verification.json`.
It predates this documentation update and is not final-checkout acceptance.

| Command | Executed correction result |
| --- | --- |
| `node --test tests/scripts/pointSelectionOracle.test.mjs tests/scripts/ownedFontFace.test.mjs tests/scripts/pointCheckDiagnostics.test.mjs tests/rendering/svgPointPaint.test.ts` | 51 passed; `/private/tmp/stz-32b-selection-focused.log` |
| `node scripts/automation/run-phase.mjs 32B verify` | Exit 1: npm test **2,695 passed**, build and diff passed; stopped at label-assets localhost `listen EPERM` before Chrome; free-labels not reached by runner |
| `npx tsc -p tsconfig.app.json --strict` | Passed; `/private/tmp/stz-32b-selection-strict-tsc.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed; `/private/tmp/stz-32b-selection-fixture-tsc.log` |
| `node --check` on the two changed/new scripts and new test | Passed |
| Focused ESLint, recommended JS rules with Node/browser globals | Passed; `/private/tmp/stz-32b-selection-eslint.log`; config `/private/tmp/stz-32b-selection-eslint.config.mjs` |
| Direct `npm run check:free-labels` with the runner's cached Playwright/Chrome paths | Exit 1 at `development-server-listen`, `listen EPERM 127.0.0.1:5173`; `/private/tmp/stz-32b-selection-child-free-labels-configured.log` |

An initial bare direct free-label command failed earlier at Playwright import;
its log is `/private/tmp/stz-32b-selection-child-free-labels.log`. The configured
attempt above uses the established runner paths, introduces no dependency, and
retains evidence in `/private/tmp/stz-32b-selection-child-free-labels/`.
These child startup failures are separate from the historical parent's 0.24
selection discrepancy. Existing unrelated lint debt documented above remains
unchanged; repository-wide lint was not run.

After this documentation update the same runner and configured direct browser
check are rerun, with final results, exact commands, artifact inventory,
before/after binary-aware checkout identity and fingerprint recorded outside
the source tree in `/private/tmp/stz-32b-selection-handoff.json`. Keeping the
fingerprint external avoids changing the checkout by documenting its own hash.

Required but unexecuted in this child: native label-assets assertions; all 16
free-label groups and all 16 point scenarios (11 cumulative 32A plus all five
32B paint scenarios listed above); corresponding required native JSON/SVG/PNG
artifacts; and the subsequent independent phase review. Empty page-error arrays
with no launched browser do not establish acceptance. The handoff lists each
unexecuted group/scenario and required artifact explicitly.

The browser-capable parent must run all five commands successfully on the exact
final tree and inspect terminal/scenario/artifact evidence before independently
reviewing it through the existing runner workflow. `32B verify` itself performs
no review. Its failure stops that workflow; no review, commit or push gate was
bypassed. Phase 32B remains **implemented, awaiting acceptance and review**.

Correction files: `scripts/checkPointNodes.mjs`, new
`scripts/pointSelectionOracle.mjs`, new
`tests/scripts/pointSelectionOracle.test.mjs`, `package.json`, this document,
and `docs/PREVIEW_UI.md`.

## Targeted Inspector field-locator correction

This correction began with a clean `phase/32b-color-opacity-outline` checkout at
`cc4ae775987e927321c60db8d6ba817bf08d3d5c`, including the preceding corrections
and updated fix prompt. Its initial fingerprint was
`05eb9ee1557b51d994e9bcafc54572a0b80130af9b4e8ebc21a3151661eddfb2`.
Existing production paint, schema, selection geometry, all 16 selected-view
regressions, font ownership cleanup, PGF/binary fixtures and acceptance gates
are preserved. No production file or dependency changed. 32C/32D remain deferred.

### Observed parent failure versus prior correction

Read and audited:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-yLwzPX/verification.json`,
its `05-check-free-labels/command.log`, evidence/checkout snapshots, paint
observations 0001/0002, legacy document, completed point records and native
SVG/PNG exports; and
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-TDvlPq/response.json`.
The parent checked `a2f2ba66faa9afe299dc5471ccc18bb43b043f42` plus changes with
matching before/after fingerprint
`6475b6191b76ea9ba28d891839ff309d40c97f8407c0ebe782f41e708447c03e`.

That report passed tests (2,695), build, diff and label-assets. Chrome
153.0.8010.53 started successfully and completed 14/16 groups with 145 passing
records and empty page errors. All eleven 32A point scenarios passed, including
the independent border-half-width selection expectation, resource/font readiness,
native persistence and transparent/white whole-node settled exports. Their
required artifacts exist. The earlier selection issue was exercised successfully.

The first new paint scenario stopped after 30 seconds at exact associated-label
lookup for `Border line style`. Selection remained `app-point`; text red/.6,
fill blue/.35, border green/.7 and width 2 reached the model, while line style,
cap and join remained solid/butt/miter. Requests remained 3. Zero of five 32B
paint scenarios completed. The distinct later `settled-SVG-export-standalone`
group was not reached; this does not negate the completed
`point-node-settled-export` group. Independent review was not reached.

`EditableSelectField` wraps caption and option descendants in one label, so
Playwright's exact associated-label text query includes more than the caption.
This is different from a role locator's accessible-name computation. Production
`EditableParsedNumberField` likewise adds its warning inside the label after an
invalid draft. The Border width post-`NaN` exact lookup and corrective fill were
predicted later failures, not observations from that parent. The retained parent
paint observations contain no Inspector DOM/count measurements; none are inferred
from source inspection.

### Bounded harness correction and regression coverage

`scripts/pointInspectorFields.mjs` resolves one exact `.inspector-field-label`
caption inside `#preview-inspector-drawer`, validates its `.inspector-field`
wrapper, and resolves exactly one expected native control. Inspector, caption,
wrapper and control must be visible; relevant elements must be enabled. It does
not select by index, use loose label text, or fall back to page-wide controls.
Live and `Preset ` fields remain distinct. Selects validate the complete expected
option values and enabled requested option, use native `selectOption` with a
5-second bound, and check both returned and actual selected values.

All live paint actions, including the three selects in every `setMixedPaint()`
call and imported cap/join overrides, use the resolver. Real App assertions
verify dashed/round/bevel model paint, a changed initial value and one history
entry for each initial/imported select edit, unchanged presets and conversion
request count. The existing color input/change event path is preserved; no
fixture mutation or forced action supplies desired paint.

The real Border width edit still enters `NaN`, then re-resolves while the warning
is present. It verifies the draft, `aria-invalid`, warning text/role and
`aria-describedby`, unchanged model/history/requests, and native recovery to 2.
Its production Inspector HTML before, during and after validation supplies the
numeric clone regression. The clone also uses actual production select and
preset markup, replaces wrappers to test re-resolution, preserves a cloned
outside-Inspector control, and rejects absent/duplicate/hidden/disabled targets,
wrong control types, substring captions and unavailable/disabled options.
The real App proves handler and history behavior; clones isolate lookup failures.
Registered Node checks exercise orchestration/rejections and primary errors,
without claiming to reproduce Playwright's label engine.

Before the first select and numeric validation boundary, diagnostics retain
selection, Inspector visibility/expansion markup, caption/wrapper/control DOM,
label text/ARIA, original exact-label and corrected counts, options/current
values, paint, source/request/font/document identity and serialized history.
Post-action observations retain values and validation state. Counts describe
current markup; changed label semantics are reported rather than asserting a
historical zero. Original Playwright message/stack/call log is saved separately
from bounded failure capture. Diagnostic/cleanup errors cannot replace it.
Scenarios pass only after their assertions and artifacts finish.

Files changed for this correction: `scripts/checkPointNodePaint.mjs`, new
`scripts/pointInspectorFields.mjs`, new
`tests/scripts/pointInspectorFields.test.mjs`, test registration in
`package.json`, and these existing notes: `docs/PHASE_32B_IMPLEMENTATION.md`,
`docs/PREVIEW_UI.md`, `docs/LABEL_ADAPTER.md`.

### Executed checks and remaining parent gates

Commands use `PATH=/opt/homebrew/bin:$PATH`, Node v26.9.0. The initial correction
runner report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-63p1vP/verification.json`,
with handoff `stz-phase-verifier-AL6tad/response.json` under the same temporary
root. It precedes this results appendix and is not final-tree browser acceptance.

| Executed command | Result |
| --- | --- |
| `node --test tests/scripts/pointInspectorFields.test.mjs` | 44 passed; `field-regressions.log` |
| `node --test tests/scripts/pointSelectionOracle.test.mjs tests/scripts/pointNativeCoordinateMode.test.mjs tests/scripts/pointCheckDiagnostics.test.mjs tests/scripts/ownedFontFace.test.mjs tests/scripts/pointPaintOracle.test.mjs` | 66 passed; `preserved-regressions.log` |
| `node scripts/automation/run-phase.mjs 32B verify` | Exit 1: tests **2,739 passed**, build and diff passed; label-assets failed at localhost `listen EPERM`; runner did not reach free-labels or review |
| `npx tsc -p tsconfig.app.json --strict` | Passed; `strict-tsc.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed; `fixture-tsc.log` |
| `node --check scripts/checkPointNodePaint.mjs` | Passed |
| `node --check scripts/pointInspectorFields.mjs` | Passed |
| `node --check tests/scripts/pointInspectorFields.test.mjs` | Passed |
| Focused ESLint recommended rules with Node/browser globals on the three JS files above | Zero errors/warnings; `targeted-eslint.log` |
| `git diff --check` | Passed |
| Direct `npm run check:free-labels` with the external Playwright/Chrome environment below | Exit 1 at `development-server-listen`: `EPERM 127.0.0.1:5173`; zero groups/scenarios executed |

Focused logs and the direct browser evidence live in
`/private/tmp/stz-32b-inspector.ziacWM/`. The runner's own `01-npm-test`,
`02-npm-build`, `03-git-diff-check`, and `04-check-label-assets` directories retain
exact commands, output and statuses. The build's existing chunk-size warning and
the previously documented unrelated lint baseline are unchanged; no broad lint
cleanup was performed. The direct browser environment was:

```sh
export PATH=/opt/homebrew/bin:$PATH
export STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
export STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32b-inspector.ziacWM/free-labels
npm run check:free-labels
```

After this appendix, the same official verify command is run again against the
final tree. Its report path, terminal outcome and binary-aware final checkout
identity (including untracked resolver/tests) are retained outside the tracked
tree in `/private/tmp/stz-32b-inspector.ziacWM/handoff.json`, alongside
`final-checkout.json`, `final-checkout.diff`, `final-checkout-untracked.json` and
`verification-final.log`. This avoids a self-referential fingerprint in a tracked
document. The final direct free-label attempt uses the same environment with
`STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32b-inspector.ziacWM/free-labels-final`.

The child restriction is separate from the historical parent's successful startup
and observed select timeout. No new native exact-label/control counts, actual
NaN warning/recovery results, or completed 32B browser scenarios are claimed.
Read-only independent targeted code inspection found no concrete defect; that is
not the Phase 32B acceptance review.

Still required in the browser-capable parent: run
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify`
on the final checkout, requiring all five commands, all 16 groups, all 16 named
point scenarios, empty page-error arrays and actual required JSON/SVG/PNG files.
Specifically unexecuted here: the production wrapped-field clone and live
invalid-width regression, all five paint scenarios (Inspector/history,
imports/persistence, lifecycle/dimming, pending transparent edit and pending
white load), and the later standalone settled-export group. Cumulative 32A
scenarios also need current-tree confirmation despite the historical parent's
success. Once that evidence matches, the existing parent workflow must perform
the read-only review against `prompts/phase-32b-review.md`; `verify` alone does
not review. Verification and independent acceptance review remain open, so
Phase 32B is incomplete. No commit/push or 32C/32D work was performed.

### Historical current-checkout revalidation (2026-09-24)

The later `7bdmDz` parent evidence and targeted correction below supersede this
read-only inspection's finding of no additional defect and its pending-native
claims. The commands in this subsection describe that earlier child only.

The repeated targeted request starts from clean
`99535517c9d465e265f415d7af0e370f4c00f46e` on
`phase/32b-color-opacity-outline`. That revision already contains the resolver,
all five corrected select sites, real invalid-width/recovery assertions,
production-markup clone regression, 44 registered resolver checks and diagnostics
described above. Its clean-tree fingerprint is
`fba4b126c457237c8b37ace37b8526e31f4a68b2e802618971980c7909ce822c`.
Read-only independent targeted inspection found no concrete additional defect.
No harness, production, fixture, dependency or verification-policy change was
necessary in this turn; only this report and the existing preview acceptance
note were updated. This inspection is not the gated Phase 32B acceptance review.

Fresh commands use `PATH=/opt/homebrew/bin:$PATH` and Node v26.9.0:

| Command | Result and log |
| --- | --- |
| `node --test tests/scripts/pointInspectorFields.test.mjs tests/scripts/pointSelectionOracle.test.mjs tests/scripts/pointNativeCoordinateMode.test.mjs tests/scripts/pointCheckDiagnostics.test.mjs tests/scripts/ownedFontFace.test.mjs tests/scripts/pointPaintOracle.test.mjs` | 110 passed; `/private/tmp/stz-32b-current-focused.log` |
| `node scripts/automation/run-phase.mjs 32B verify` | Tests 2,739 passed, build and diff passed; label-assets localhost `listen EPERM`, free-labels not reached; `/private/tmp/stz-32b-current-verify.log` |
| `npx tsc -p tsconfig.app.json --strict` | Passed; `/private/tmp/stz-32b-current-strict-tsc.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed; `/private/tmp/stz-32b-current-fixture-tsc.log` |
| `node --check scripts/checkPointNodePaint.mjs`, `node --check scripts/pointInspectorFields.mjs`, `node --check tests/scripts/pointInspectorFields.test.mjs` | Passed |
| `node --input-type=module < /private/tmp/stz-32b-inspector.ziacWM/targeted-eslint.mjs` | Zero errors/warnings for the three scripts above; `/private/tmp/stz-32b-current-eslint.log` |
| `npm run check:free-labels` with the established external Playwright/Chrome environment above and `STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32b-current-free-labels` | Exit 1 at `development-server-listen`, `EPERM 127.0.0.1:5173`; `/private/tmp/stz-32b-current-free-labels.log` |

The initial fresh report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-iQ1jvu/verification.json`;
its verifier response is `stz-phase-verifier-X5eU6Q/response.json` in the same
temporary root. Before/after identity matches the clean fingerprint above.
These results precede this documentation change. The official verify command
and configured direct free-label check are repeated after the final edits;
their terminal outcomes, report paths, exact commands and binary-aware final
checkout identity are saved outside the tree in
`/private/tmp/stz-32b-current-handoff.json` (logs
`/private/tmp/stz-32b-current-final-verify.log` and
`/private/tmp/stz-32b-current-final-free-labels.log`). No self-referential hash is
written into the tracked report. The unrelated lint baseline remains unchanged.

The old selection issue remains a historical parent pass; the select timeout
remains the historical parent's executed failure; the adjacent invalid-width
lookup remains predicted until native execution. Current child startup failure
provides no new DOM counts or paint-rendering result. All native label-assets
assertions, all 16 free-label groups and 16 named point scenarios (including all
five paint scenarios), production wrapped-field/NaN checks and required native
JSON/SVG/PNG artifacts remain pending for this tree. Empty pre-browser page-error
arrays are not a pass. After this child returns, the existing browser-capable
parent must complete fresh verification, then the read-only review against
`prompts/phase-32b-review.md`. `verify` itself does not review, and no nested
implementation or commit/push gate was invoked. Phase 32B remains incomplete;
32C/32D remain deferred.

## Disabled-control label-retargeting correction (2026-09-24)

This fix began with a clean `phase/32b-color-opacity-outline` checkout at
`a3f5998bd5b74e8622ca5e599390f2c32f65e070`, including the updated prompt.
Only `scripts/pointInspectorFields.mjs`, its registered test file, and the three
existing acceptance documents changed. Production paint/UI/schema, caption
resolution and resolver check order, selection half-width oracle, owned-FontFace
cleanup, PGF/binary fixtures and cumulative verification/review gates are preserved.
No dependency, forced selection or timeout increase was introduced.

### Latest parent progress and actual cause

Inspected the complete report, command log, checkout snapshots and paint
observations `0002`–`0019` and `0035`–`0038` under
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-7bdmDz/`,
plus `stz-phase-verifier-AWviTj/response.json` in the same temporary root.
That report checked `99535517c9d465e265f415d7af0e370f4c00f46e` plus documentation;
before/after fingerprint was
`20cc7c6c846029df9d248f5fc7ae4195e23eb8ab7e0a4e776cc110fd51e04322`.
Its binary-aware diff hash and empty untracked snapshot match the report.

Node v26.9.0 / Chrome 153.0.8010.53 executed 2,739 passing tests, build, diff and
label-assets successfully. Free-labels failed in
`point-node-paint-import-persistence` / `point-paint-native-inspector-history`.
There were 14/16 completed groups, 145 evidence records, all eleven cumulative
32A point scenarios and zero of five completed 32B scenarios. Page errors were
empty. The complete paint group and subsequent `settled-SVG-export-standalone`
group did not complete; cumulative `point-node-settled-export` did complete.
Independent acceptance review was not reached.

Unlike the older `yLwzPX` timeout, this parent provides native observations of
all three old exact-label counts at zero and corrected control counts at one,
real App dashed/round/bevel edits and mixed paint, and Border width
`2 → NaN → 2`. `aria-invalid` was false/true/false; warning association existed
only while invalid; saved model/history stayed unchanged through invalid input
and recovery. These are executed results, not predictions. Twenty-five clone
checks completed, including live/preset select pairs, re-resolution, outside
isolation, numeric markup and earlier negatives. They are progress inside the
first paint scenario, not a completed scenario. Observation `0038` preserves
the real App state after the clone failure.

The disabled native select correctly rejected at its wrapping label:
`Enabled Inspector field wrapper: Border line style`. The outer expectation
`/Enabled native select/` rejected that valid earlier boundary. Installed
Playwright **1.62.1** source in the configured runtime's sibling
`playwright-core/lib/coreBundle.js` confirms that enabled queries use
`retarget(node, 'follow-label')`, following `label.control`. Source inspection
is not a new browser reproduction. The old observation's wrapper `enabled: true`
was the local `:disabled`/ARIA predicate; it never measured Locator.isEnabled().
This is a negative-test oracle mismatch, not acceptance of a disabled control
or a demonstrated production paint defect.

### Bounded correction and regressions

The disabled-control oracle now requires an `AssertionError` with
`ERR_ASSERTION`, strict false-versus-true enabled metadata, and the exact
Border line style wrapper or native-select message. Missing controls, wrong
fields/options, diagnostic errors and timeouts cannot satisfy it. All resolver
absence, ambiguity, visibility, wrapper and disabled protections remain.

The production-markup clone independently verifies one visible intended
field/select, `label.control` identity, real disabled property and `:disabled`,
both queried enabled states false, an enabled requested option and initial
`solid` different from requested `dashed`. Each negative action records its
name, expected/actual rejection, original element's before/after value and
input/change events before marking completion. Disabled rejection must leave
the value and event list unchanged. Restoring the same control must permit
ordinary selection and produce input/change events. Independent disabled
Inspector/wrapper cases, missing/disabled options, wrong requested value/type,
substring and wrong-control-type cases all remain registered. Real App handlers,
paint/history checks and the actual NaN/recovery sequence remain intact.

Diagnostic `enabled` retains its existing local-only meaning. Explicit
`localDomState` records the disabled property, `:disabled`, ARIA and predicate;
`labelControl` identifies the associated native element and whether it is the
unique resolved control. Separate `playwrightState.wrapper/control` values
record Locator.isEnabled() only for unique matches. Missing/ambiguous targets
retain counts with null queried state; failed queries retain diagnostic errors.
Bounded failure capture and closure continue to preserve the primary failure.

The registered helper file now has **74 passing tests** (30 added), including
correlated false wrapper/control states and early wrapper rejection with zero
selectOption calls, enabled recovery, independent disabled boundaries, narrow
oracle refusal cases, and diagnostic uniqueness/state distinctions. The doubles
model the discovered correlation without claiming to implement browser state
semantics. A separate read-only code inspection found no concrete issue; it is
not the gated independent Phase 32B acceptance review.

### Executed checks and final-tree handoff

Commands use `PATH=/opt/homebrew/bin:$PATH`, Node v26.9.0, npm 11.19.1.
Logs are retained in `/private/tmp/stz-32b-disabled.yx1uRu/` unless stated otherwise.

| Command | Executed result |
| --- | --- |
| `node --test tests/scripts/pointInspectorFields.test.mjs tests/scripts/pointSelectionOracle.test.mjs tests/scripts/pointNativeCoordinateMode.test.mjs tests/scripts/pointCheckDiagnostics.test.mjs tests/scripts/ownedFontFace.test.mjs tests/scripts/pointPaintOracle.test.mjs` | **140 passed**; `focused-regressions.log` |
| `node scripts/automation/run-phase.mjs 32B verify` | **2,769 tests passed**, build and diff passed; exit 1 at label-assets localhost `listen EPERM`, before browser launch; free-labels not reached by runner; `verification-initial.log` |
| `npx tsc -p tsconfig.app.json --strict` | Exit 0; `/private/tmp/stz-32b-disabled-strict-tsc.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Exit 0; `/private/tmp/stz-32b-disabled-fixture-tsc.log` |
| `node --check scripts/pointInspectorFields.mjs`, `node --check tests/scripts/pointInspectorFields.test.mjs`, `node --check scripts/checkPointNodePaint.mjs` | Exit 0; `syntax-results.json` |
| `node --input-type=module < /private/tmp/stz-32b-inspector.ziacWM/targeted-eslint.mjs` | Exit 0, zero errors/warnings; `targeted-eslint.log` |
| Configured direct `npm run check:free-labels` | Exit 1 at `development-server-listen`, localhost `EPERM`; `free-labels-initial.log` and `free-labels-initial/free-labels-evidence.json` |

The initial runner report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-manual-1IVic8/verification.json`,
with verifier response `stz-phase-verifier-9eI3Je/response.json` in the same root.
It precedes this documentation update. The build's existing chunk warning and
unrelated lint baseline remain unchanged; repository-wide lint was not run.

After these final edits, the official verify command and configured direct
free-label check are repeated on the final checkout. Their exact commands,
terminal results, report paths, artifact inventory, remaining named scenarios
and binary-aware before/after identity are recorded externally in
`/private/tmp/stz-32b-disabled.yx1uRu/handoff.json`, with `final-checkout.json`,
`final-checkout.diff`, `final-checkout-untracked.json`, `verification-final.log`
and `free-labels-final.log`. The external identity avoids a self-referential
tracked fingerprint. Both direct attempts use:

```sh
export PATH=/opt/homebrew/bin:$PATH
export STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
export STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32b-disabled.yx1uRu/free-labels-final
npm run check:free-labels
```

The child localhost restriction does not explain the parent's native assertion
failure and does not validate this correction in a browser. Fresh native checks
remain pending: the corrected disabled/re-enabled clone case and subsequent
negatives; later paint variants and copy/bulk/duplicate; all five paint scenarios
(Inspector/history, imports/persistence, lifecycle/dimming, transparent edit and
white load exports); later standalone settled export; and final-tree confirmation
of all cumulative groups/scenarios, page errors and required JSON/SVG/PNG files.

The browser-capable parent must run
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify`
and require all five commands, all 16 groups and all 16 named point scenarios
on the matching final tree, including untracked and binary fixtures. Only after
that success may the existing workflow perform the independent read-only review
against `prompts/phase-32b-review.md`. `verify` itself performs no review. Both
gates remain open; Phase 32B is incomplete and 32C/32D remain deferred.

## Corrected-tree checks and parent handoff (2026-09-24)

This section supersedes the historical handoffs above. The prior `yeWQVG`
checkout passed native verification and reached independent review; its two
Medium production findings motivated this correction. It is not missing
baseline browser evidence. The new production and harness changes require
fresh acceptance of their own.

Commands use `PATH=/opt/homebrew/bin:$PATH`, Node **v26.9.0**, npm **11.19.1**.
Unless noted otherwise, logs and auxiliary check scripts are retained under
`/private/tmp/stz-32b-targeted.ek0IsJ/`.

| Executed check | Result / retained evidence |
| --- | --- |
| `npm test` | **2,815 passed**, zero failures/skips; `npm-test.log` |
| `npm run build` | Passed; existing >500kB chunk warning; `npm-build.log` |
| `node --test tests/model/pointPaintImport.test.ts tests/model/importedTikzStyles.test.ts tests/tikz/generateTikz.test.ts` | **347 passed**; `/private/tmp/stz-32b-namespace-focused.log` |
| `node --test tests/rendering/svgPointPaint.test.ts tests/rendering/svgPointNodeGeometry.test.ts tests/rendering/svgPointNodeRuntime.test.ts tests/ui/svgSettledExport.test.ts` | **50 passed**; `rendering-focused.log` |
| `node --test tests/scripts/runPhaseVerification.test.mjs tests/scripts/browserCheckoutSnapshot.test.mjs tests/scripts/pointPaintOracle.test.mjs` | **116 passed**; `/private/tmp/stz-32b-targeted-policy-final-test.log` |
| `node --test tests/scripts/runPhaseRunner.test.mjs` | **32 passed**; `/private/tmp/stz-32b-targeted-runner-test.log` |
| `npx tsc -p tsconfig.app.json --strict` | Passed; `production-strict.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed; `fixtures-strict.log` |
| `npx tsc -p /private/tmp/stz-32b-targeted.ek0IsJ/tsconfig-paint.json` | Strict changed paint/import tests passed; `paint-tests-strict.log` |
| Targeted ESLint on the four production TS files, fixture and two changed paint/import tests | Passed, zero errors/warnings; `typescript-eslint.log` |
| Recommended JavaScript ESLint with Node/browser globals on all seven changed/new `.mjs` files | Passed, zero errors/warnings; `javascript-eslint.log`, exact config in `changed-eslint.mjs` |
| `node --check` on all seven changed/new `.mjs` files | Passed; exact commands/statuses in `script-syntax.json` |
| `git diff --check` | Passed; `diff-check.log` |
| Independent PGF namespace reference | Eleven observations compiled successfully; expected missing-root compilation exit 1. Exact commands/version/logs/PDF/PNG/operators: [retained fixture](../tests/fixtures/point-paint-pgf/namespaces/README.md) |

The established **25 `no-regex-spaces` errors** and **85 broader changed-test
TypeScript diagnostics** were reproduced against pre-32B `595139d` by the prior
review and remain documented baseline debt. This correction does not modify
the affected unrelated tests. Repository-wide lint and a repeat of that broader
baseline type audit were not run; all applicable changed-code checks above pass.

The configured direct native attempt was:

```sh
PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-phase32b-responsive-child \
node scripts/checkFreeLabels.mjs
```

It exited 1 at `development-server-listen`: `listen EPERM 127.0.0.1:5173`,
before browser launch. The exact log is `/private/tmp/stz-phase32b-responsive-child.log`;
the fail-closed report is `/private/tmp/stz-phase32b-responsive-child/free-labels-evidence.json`.
No native assertion executed, all 16 groups remain unexecuted in that attempt,
and empty page-error arrays do not constitute a pass. No timeout, assertion or
sandbox permission was weakened. This restriction is separate from the valid
accepted parent and its subsequent production findings.

After these final documentation edits, the official command is run on the frozen
corrected tree:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Its exact terminal result, verification report path, per-command outcomes and
final binary-aware checkout identity are retained externally in
`/private/tmp/stz-32b-targeted.ek0IsJ/handoff.json`, alongside `verification-final.log`,
`final-checkout.json`, `final-checkout.diff` and `final-checkout-untracked.json`.
Keeping the fingerprint outside the tracked report avoids a self-referential
checkout hash. Snapshots include the untracked native module and all eleven
new independent PGF artifacts, including PDF/PNG bytes.

Fresh native execution of the corrected tree remains pending for the
browser-capable parent: all five required commands, all 16 groups, all **20**
named point scenarios, successful native paint/download/reopen artifacts,
empty page errors and a matching final checkout identity. Only after that
verification succeeds may the independent review against
`prompts/phase-32b-review.md` accept or reject the same tree, explicitly checking
both production findings. `32B verify` does not perform review. Read-only
integration inspections during implementation are not that acceptance gate.
No fresh passing acceptance review is claimed; Phase 32B remains incomplete
until both gates pass. 32C shapes and 32D configurable spacing/minima/anchors
remain deferred.

## Responsive fixture framing and coherent capture (2026-09-24)

This repair starts from clean `phase/32b-color-opacity-outline` revision
`9710e9252f2dd6c8d71a2d0d11bf2f99a14b66cd`. The earlier namespace/alias and
geometric contour corrections, responsive harness, and PGF binaries are already
committed in that revision. They are preserved; no production source, schema,
dependency, paint width, body source/font, shape size, or reference artifact is
changed or regenerated here. 32C/32D remain deferred.

### Observed clipping, distinct from stroke scaling

Read the parent `verification.json`, command log, checkout snapshots, native
responsive JSON/SVG/PNG, observations `0147`–`0159`, completed namespace/earlier
paint artifacts and verifier handoff under:

- `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-cI6r6H/`
- `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-HQDJFV/response.json`

Their binary-aware before/after fingerprint is
`be4e5fe6e9cd755f6994d642c651add632979d7a3dc28750bf4504c0e2357262`, based on
`d9345434d8051e045d3dfd9c3a31665af8c1d484` plus changes. The saved diff and all
12 untracked snapshot hashes match, including binary PGF files.

The root viewBox is `0 0 520 360`, displayed at `(20,20)` with size `260×180`.
The point center is `(78,182)` on screen, or `(58,162)` inside the PNG. Its
measured path radius is about `41.50710678`; the declared 20pt border has 24
local units of width. The expected bottom is
`162 + (41.50710678 + 12) × 0.5 = 188.75355339`, beyond the 180px image.
Initial, selected and non-scaling-control PNGs all visibly truncate below.
The valid east border measures 12px and the control 24px. The failure is root
clipping, not defective 20pt conversion or insufficient antialiasing tolerance.
The observations do not demonstrate scroll drift.

That parent passed 2,815 tests, build, diff and label-assets, with Chrome
153.0.8010.53 / Node v26.9.0. Free-labels failed before responsive control
rejection: 14/16 groups, 151 evidence records, 17/20 point scenarios. All eleven
32A scenarios, all five earlier paint scenarios and namespace aliases passed.
The first circle files are observations, not a passed responsive case/control;
scale 2, variants, triangles, responsive downloads and the separate
`settled-SVG-export-standalone` group were not reached. No fresh independent
acceptance review followed that failed verification.

### Fixture, independent coverage and capture correction

The responsive input now chooses the midpoint of the actual coordinate axes'
model-space fit bounds. Current supported axes give `(1.375,1.375,0)` and the
normal App fit projects it to the existing viewBox center `(260,180)`. The same
input supplies every preview case and the independently loaded download branch.
No screen coordinate, generated path, viewBox or production clipping rule is
rewritten. Framing and setup settle before model/history/request baselines;
CSS alone supplies the measured 0.5 and 2 display scales, checked by native CTMs.

`pointResponsiveFraming.mjs` checks an independent expected envelope using the
20pt declaration, measured circle/polygon paths, the verified regular triangle's
60-degree miter, six-local-unit selection padding, the overlay's non-scaling
3px stroke and the larger non-scaling negative control. It transforms that
envelope and the measured body into screen, root and capture coordinates.
Every envelope and intended clear/inside/outside click must have at least 2px
of margin within the root, capture and browser viewport, including disabled and
zero-opacity variants. Invalid/nonfinite geometry, singular/stale CTMs, crops
and inconsistent CSS/viewBox measurements fail as setup errors. Expected bounds
are never clamped. Failed preflights retain their envelopes and margins.

Each native capture explicitly scrolls and settles before retaining its snapshot,
then persists root/CSS/viewBox dimensions, path/body bounds, CTMs, model camera,
preview camera summary, position and framing margins. It saves before/after
measurements around the bounded screenshot and rejects coordinate/layout/crop
changes before decoding the exact PNG. Native click coordinates are revalidated
after selection/layout changes. The standalone full-root helper likewise settles
without requiring an HTML body and rejects capture drift. XML-safe Canvas PNG
decoding and the existing 1.75px paint-extent tolerance remain unchanged.

The actual native red-mask uncropped check precedes the physical-width assertion,
so a clipped control cannot satisfy the narrowly matched negative-control
rejection. Both scenes must pass coverage; only the injected vector effect must
fail physical paint. Root styles (including absent versus empty), original vector
effects and owned pages are restored/released on failure without replacing the
primary error. Body/path geometry, model/history and request identity remain
checked through scaling, selection, capture and restoration.

Before each real Export click, the independently reloaded App receives its own
framed capture. Temporary CSS is restored before export; the downloaded SVG is
saved unmodified and reopened at both CSS scales for both backgrounds and the
existing circle/triangle/dash cases. No post-download repair is performed.

### Executed checks and final frozen-tree handoff

Commands use `PATH=/opt/homebrew/bin:$PATH`, Node **v26.9.0**, npm **11.19.1**.
Logs are retained under `/private/tmp/stz-32b-framing.NeevK3/`.

| Command/check | Executed result |
| --- | --- |
| `npm test` | **2,836 passed**, zero failures/skips; `npm-test.log` |
| `npm run build` | Passed; existing >500kB chunk warning; `npm-build.log` |
| `node --test tests/scripts/pointPaintOracle.test.mjs tests/scripts/standaloneSvgCapture.test.mjs tests/scripts/pointCheckDiagnostics.test.mjs tests/scripts/pointSelectionOracle.test.mjs tests/scripts/runPhaseVerification.test.mjs tests/scripts/runPhaseRunner.test.mjs tests/scripts/browserCheckoutSnapshot.test.mjs` | **212 passed**; `focused-regressions.log` |
| `node --test tests/scripts/pointPaintOracle.test.mjs tests/scripts/standaloneSvgCapture.test.mjs` | **45 passed** after the final bounded-capture edits; `capture-regressions.log` |
| `npx tsc -p tsconfig.app.json --strict` | Passed; `production-strict.log` |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed; `fixtures-strict.log` |
| `npx eslint scripts/fixtures/freeLabelsApp.tsx` | Passed; `typescript-eslint.log` |
| Recommended JavaScript ESLint, Node/browser globals, all changed/new `.mjs` files | Passed, zero errors/warnings; `javascript-eslint.log`; exact invocation/config retained in `changed-eslint.mjs` |
| `node --check` on all changed/new `.mjs` files | Passed; exact commands/status in `script-syntax.json` |
| `git diff --check` | Passed; `diff-check.log` |

The existing registered files contain 28 oracle tests and 17 standalone capture
tests (21 added in total). Regressions reproduce the historical 260×180 crop,
retain the unchanged physical-paint expectations after moving its center, exercise
circle/triangle and both scales, selection, invisible paint, larger controls,
invalid measurements, capture drift, failure diagnostics and exact cleanup.
Synthetic/helper observations do not establish real App framing acceptance.

An initial overlapping `npm test`/`npm run build` launch collided in their shared
MathJax asset preparation (`ENOTEMPTY`, before build compilation). The retained
`npm-build-concurrent-preparation-failed.log` records that command-orchestration
failure. After test completion, the sequential build above passed; the official
runner below also sequences these commands. The established unrelated lint/type
baseline is unchanged; repository-wide lint was not rerun.

The configured direct `npm run check:free-labels` attempt stopped at
`development-server-listen`, `listen EPERM 127.0.0.1:5173`, before browser launch.
See `free-labels-initial.log` and
`free-labels-initial/free-labels-evidence.json`. This child restriction is
separate from the parent's native clipping failure and the earlier accepted
`yeWQVG` tree. It proves no native responsive case.

After these documentation edits, the final frozen checkout is checked with:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify

PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-32b-framing.NeevK3/free-labels-final \
npm run check:free-labels
```

Their exact exit statuses, per-command results, verification report/artifact paths,
remaining native cases and binary-aware final-tree identity are recorded externally
in `/private/tmp/stz-32b-framing.NeevK3/handoff.json`, with
`verification-final.log`, `free-labels-final.log`, `final-checkout.json`,
`final-checkout.diff` and `final-checkout-untracked.json`. Keeping the final
fingerprint external avoids a self-referential tracked document hash. The snapshot
includes the new untracked framing helper and the committed PGF binaries.

Fresh browser-capable parent verification remains required: all five commands,
both browser checks, all 16 groups, all 20 named point scenarios, uncropped valid
and control scenes at both scales, all variants and actual transparent/white
responsive downloads, complete JSON/SVG/PNG artifacts, empty page errors and a
matching final checkout. Only after success may the independent read-only review
against `prompts/phase-32b-review.md` assess that same tree, including the original
namespace and scaling findings. Interim implementation inspection is not that
acceptance review, and `32B verify` does not review. Phase 32B remains incomplete
until both gates pass; no browser restriction, partial prior report or helper test
waives them.

## Saved SVG body contract versus display-scale text measurements (2026-09-24)

This handoff supersedes the preceding framing handoff for the current correction.
The checkout began clean on `phase/32b-color-opacity-outline`, at
`ef8c50cd7dde032d65d482a11ea028d1a2ad21af`. That revision incorporates the
historical `9710e9252f2dd6c8d71a2d0d11bf2f99a14b66cd` working-tree fixes and
updated targeted prompt. All nine historical tracked diff sections match the
incorporated changes. The formerly untracked `scripts/pointResponsiveFraming.mjs`
is now tracked with the same SHA256
`76e516efb016a9a8486349e678c187aa45b4e7567e799d85d4a0e54726804328`.
No reset, production geometry/export change, dependency addition or PGF reference
regeneration was performed for this measurement-contract correction.

### Observed parent failure and immutable file evidence

Inspected the `verification.json`, command log, checkout snapshots, scenario
records, actual saved XML, app-framed and scale-specific JSON/SVG/PNG evidence
under `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-F4Fxc7/`,
and `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-xx19j0/response.json`.
The parent's before/after fingerprint was
`41ff7e9818ac6df5cd04cc30c75f625d2723ffaf0f22757dbdf2227f61163dd0`.
It passed 2,836 tests, build, diff and label-assets with Node v26.9.0 / Chrome
153.0.8010.53. Free-labels reached 14/16 groups, 19/20 point scenarios and 153
records, with empty page errors. Namespace aliases, all eleven 32A scenarios,
all five earlier paint scenarios, and responsive circle/triangle previews passed.

The first transparent solid-circle download completed framing, physical paint,
export-envelope and coherent native/full-root captures at 0.5 and 2. Its body
subtree and contour declarations are identical in the saved SVG and both raster
SVGs: title/foreground `Scale`, outer `translate(0 0)`, inner
`translate(-12.9931640625 4)`, text at `(0,0)` with start/alphabetic alignment,
Times New Roman/Times/serif, size 12, weight 400, normal style, radius
`41.507105564650516` and 24-local-unit border. Root CSS alone supplied the display
resize. Native measurements were:

| CSS scale | Root display | Body x | Body y | Body width | Body height |
| --- | --- | --- | --- | --- | --- |
| 0.5 | 260 × 180 | -12.9931640625 | -6 | 26 | 12 |
| 2 | 1040 × 720 | -12.9931640625 | -6.5 | 25.9921875 | 13 |

Within each screenshot the retained measurements agreed. These native text
bounds are not saved layout records; their exact cross-scale comparison was an
invalid invariant. This evidence does not identify a specific browser hinting
mechanism or font-loading race. The old `body.font` diagnostic described the
inherited enclosing group (`16px Inter, Arial, sans-serif`), not the explicitly
styled foreground text. Diagnostics now report actual leaf longhands, requested
font/check, document font status/faces, text bounds and screen CTMs; the group
font is separately named `inheritedGroupFont`.

That partial parent run completed **no responsive download scenario**. Its later
assertions, other five download combinations and separate
`settled-SVG-export-standalone` group remained unexecuted. It did not reach a
fresh independent acceptance review. Its passed preview cases are historical
native evidence, not final-tree acceptance of this correction.

### Replacement checks and failure sensitivity

`pointResponsiveBody.mjs` parses the unmodified downloaded XML into a
namespace-aware structural baseline before resizing. Expanded element/attribute
names, deterministic CSS property ordering and XML serialization whitespace
handling preserve meaningful content, declarations and order. Only the explicitly
controlled root display CSS and temporary root-style bookkeeping may vary;
viewBox, all other styles/transforms, foreground text, local placement and contour
geometry remain exact. Expected source/font/baselines and point placement are
independently declared fixture inputs. The full ancestor placement, native
root-relative body position and local transforms are checked so an identically
wrong file and observation cannot establish their own correct placement.

Each scale uses bounded font/layout settling, actual leaf font/readiness,
the existing detached XHTML Canvas source/line observer and native SVG fragments.
The existing positioned-literal baseline, centering, whitespace, visibility and
containment tolerances are unchanged. The Canvas contract supplies independent
local expectations; native SVG boxes remain finite positive visibility and
containment observations and are never forced to equal Canvas metrics. Structure
and diagnostic observations are saved before assertions. Literal measurement
probes and settling must leave the document unchanged.

Each of the six actual App downloads (transparent/white × solid circle/solid
triangle/dashed circle) is reopened directly once and kept through
**0.5 → 2 → 0.5**. Return captures use distinct `-return-scale-0.5` names. Native
paint masks, dash/phase checks, exact contour bounds, framing margins, bounded
native/full-root PNGs and PNG dimensions remain required. Independent literal
observations and the associated capture must share text geometry/CTMs, and the
return scale must recover the initial screen placement. Exact before/after
`assertResponsiveCaptureStable()` comparisons within one screenshot remain intact.

Native negative controls mutate foreground content, shift the body by one local
unit while still inside the contour, and change the font family. They must fail
for the intended content/placement/font reason. `finally` restores the exact
original DOM, a final positive observation must pass, and root-style cleanup must
restore the entire positive document. Disk bytes, model/history/source/request
identity and owned-page cleanup remain checked; secondary cleanup errors cannot
replace the primary failure.

Registered regressions accept the reported native bounds pair and reject missing,
nonfinite, invisible or changed text measurements, wrong source/font/size,
baseline/transform/ancestor/CSS displacement and contour/viewBox changes. They
also exercise canonicalization, independent placement, negative-control cleanup
and primary-error preservation. The parent policy retains **16 groups / 20 named
point scenarios**, adds 32 failure regressions, and requires all **91 responsive
download artifacts**, three captures per file, actual font readiness, stable
captures, restored controls with matching rejection reasons, and immutable
file/document evidence. Partial captures cannot complete the scenario.

### Executed checks and final-tree handoff

All commands use `PATH=/opt/homebrew/bin:$PATH` (Node v26.9.0, npm 11.19.1).
Logs and exact supplemental commands are under
`/private/tmp/stz-32b-body.v2N7nG/`.

| Check | Result |
| --- | --- |
| `npm test` | Initial full run: **2,903 passed**, zero failures/skips (`npm-test.log`); final five cleanup/placement regressions were subsequently added and passed in the focused run below. The frozen verifier reruns the final registered suite. |
| `npm run build` | Passed after the full suite, sequentially (`npm-build.log`); existing >500kB chunk warning only. |
| `node --test tests/scripts/pointResponsiveBody.test.mjs tests/scripts/pointPaintOracle.test.mjs tests/scripts/standaloneSvgCapture.test.mjs tests/scripts/pointLiteralOracle.test.ts tests/scripts/pointLiteralMetrics.test.ts tests/scripts/pointOracleCanvas.test.ts tests/scripts/pointCheckDiagnostics.test.mjs` | **134 passed**, zero failures/skips (`focused-final.log`), including all 39 new body-contract regressions. |
| `node --test tests/scripts/runPhaseVerification.test.mjs` | **136 passed**, zero failures (`/private/tmp/stz-download-policy-complete-tests.log`). |
| `npx tsc -p tsconfig.app.json --strict` | Passed (`production-strict.log`). |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed (`fixtures-strict.log`). |
| Recommended JavaScript ESLint with Node/browser globals on all seven changed/new scripts/tests | Passed, zero errors/warnings (`javascript-eslint.log`; exact configuration/invocation in `changed-eslint.mjs`). |
| `node --check` on the same seven `.mjs` files | Passed; exact commands/results in `script-syntax.json`. |
| `git diff --check` | Passed; final result retained in `diff-check.log`. |

Established unrelated lint/type debt is unchanged; no repository-wide cleanup or
new production TypeScript was introduced. A read-only integration inspection
identified the ancestor-placement and declared text-rendering gaps above; both
were corrected and regressed. This inspection is not the independent acceptance
review required after passing final-tree browser verification.

The direct configured `node scripts/checkFreeLabels.mjs` attempt stopped before
browser launch at `development-server-listen`, `listen EPERM 127.0.0.1:5173`.
See `free-labels-initial.log` and `free-labels-initial/free-labels-evidence.json`.
A separate file-only helper attempt also failed at Chrome startup before opening
or observing the historical SVG (`file-only-helper-native-attempt.json`). No
native assertion executed in either child attempt. Neither failure diagnoses the
parent's measurement assertion or waives native coverage; permissions and
assertions were not relaxed.

After these documentation edits, the frozen checkout is checked with:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Exact final command outcomes, verification report location, remaining gates and
binary-aware checkout identity are retained externally in
`/private/tmp/stz-32b-body.v2N7nG/handoff.json`, with `verification-final.log`,
`final-checkout.json`, `final-checkout.diff` and `final-checkout-untracked.json`.
The snapshot includes both new untracked helper/test files. Keeping the final
fingerprint outside tracked documentation avoids a self-referential hash.

Fresh browser-capable parent verification must pass all five commands, both
browser checks, all 16 groups and all 20 point scenarios on that same final tree,
including all six downloads and scale/return-scale artifacts with empty page
errors. Only then may the independent review against
`prompts/phase-32b-review.md` accept that tree, including the preserved namespace
and geometric-scaling production corrections. `32B verify` does not perform
review. Phase 32B remains incomplete until both gates pass; 32C/32D remain deferred.

## Intentional white export-background contract (2026-09-25)

This handoff supersedes the preceding saved-body handoff. Work began on a clean
`phase/32b-color-opacity-outline` checkout at
`5ff8289bb15cdec412469269947c659a63408c31`, initial fingerprint
`7fa7726260c8c25183129ac81044c3bdc9b1cd432b3d6b26bf97b76e7eacb950`.
That commit incorporates all eight historical tracked patches from the `ef8c50`
parent checkout and both formerly untracked body helper/test files byte-for-byte;
it also updates the targeted fix prompt. Nothing was reset or restarted.

### Prior parent evidence and demonstrated cause

Inspected `verification.json`, `05-check-free-labels/command.log`, checkout
snapshots, saved SVGs, baselines, scale/return JSON and raster SVGs/PNGs,
App-framing artifacts and body controls under
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-1MopVV/`,
plus `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-um8Dcd/response.json`.
The matching historical before/after fingerprint is
`5ebdfe6a8e4600b4e6b4ceda9a7943cf632a23a183bbeadf84fe26709fed219a`.
The parent passed 2,908 tests, build, diff and label-assets with Node v26.9.0 /
Chrome 153.0.8010.53. Free-labels stopped at 14/16 groups, 19/20 named point
scenarios and 153 completed records, with empty page errors.

Observations `0579`, `0638` and `0697` confirm that all three transparent download
cases completed 0.5 → 2 → 0.5, independent body/font/literal checks, coherent
native/full-root captures, intended control rejections, exact DOM restoration
and unchanged disk bytes. The overall download scenario did **not** complete.
White solid-circle scale 0.5 retained its native PNG and observation, but failed
before `bodyContractPassed`, subsequent paint/envelope checks and full-root
capture. White scale 2/return-scale, white triangle/dashed-circle and the separate
`settled-SVG-export-standalone` group were unexecuted. Only 50/91 required
responsive artifacts existed, and fresh independent acceptance review was not
reached. Partial captures are not passing acceptance evidence.

The downloaded white SVG correctly starts with an SVG `rect` at `(0,0)`, sized
`520 × 360`, filled `#ffffff`, with unnamespaced
`data-stratified-tikz-export-background="white"`, covering its local viewBox.
`insertWhiteSvgExportBackground()` intentionally inserts this marker after
removing runtime metadata and old backgrounds. Existing export tests require
one in white mode, none in transparent mode and no duplication on repeated
sanitization; the settled-export harness already distinguishes it from runtime
metadata. The body collector instead classified every `data-*` as runtime
metadata. This was an oracle defect, not a demonstrated production export defect.

### Scoped correction and regressions

The download fixture now explicitly passes `transparent` or `white` into the
saved-file baseline and each reopened observation, including the three native
negative controls and restored positive observation. Expected mode and observed
root/marker attributes, namespaces, parent/order, local geometry and paint are
persisted before assertions. Neither marker presence nor later matching samples
can establish the expected mode.

Both saved and displayed declarations independently validate the background.
White requires one unnamespaced marker with value `white` on an SVG `rect`,
directly under the root as its first element, with white fill and exact local
viewBox bounds. These fixtures require the exporter's plain rectangle; extra
paint/transform/visibility/clipping/animation declarations and inherited root
paint overrides fail. Transparent rejects marked backgrounds and unmarked
copies of the plain full-viewBox export rectangle. Ordinary white diagram content,
including an outlined full-viewBox drawing rectangle, is not identified solely
by its fill. CSS screenshot dimensions never supply local rectangle geometry.
Foreign XML elements without a CSS style object retain raw diagnostic attributes
before their invalid namespace is rejected.

Only the separately validated export marker is removed from the runtime-attribute
list. All other runtime `data-*` attributes, including namespaced variants and
attributes on the background itself, remain forbidden. The owned temporary
root-style exception remains limited to that unnamespaced attribute on the root.
The background node, marker, attributes and order remain in canonical full-root
comparisons; changing even an otherwise valid numeric spelling between scales
fails comparison. No sanitization or downloaded-file repair is performed.

The registered body test file retains all 39 existing tests and adds **62**
collection-boundary regressions with a faithful DOM fixture matching the actual
export's rectangle and point/body/title/text structure. They cover both modes,
nonzero viewBox/CSS scaling, malformed/missing/duplicate markers, namespaces,
location/order, bounds/fill/overrides, unrelated runtime metadata, identical
corruption in baseline and sample, and later changed/removed backgrounds.
Source/font/baseline, displaced-body, native metrics, same-capture coordinates,
negative-control restoration and primary-error tests remain intact. The verifier
adds **36** missing/wrong-mode/background-observation regressions and retains all
16 groups, 20 named point scenarios and 91 responsive-download artifacts.

Production namespace/alias resolution and PGF references, geometric contour
scaling, independent paint, immutable click-time export, fixture framing and
native paint/selection probes are unchanged. No dependency, schema, production
rendering/export change or PGF regeneration was made. A separate read-only
implementation inspection found two collection edge cases (ordinary outlined
white content and foreign XML styles); both were corrected and regressed. This
inspection is not the independent Phase 32B acceptance review.

### Executed checks and frozen-tree handoff

All commands use `PATH=/opt/homebrew/bin:$PATH`, Node v26.9.0. Logs and exact
supplemental invocations are under `/private/tmp/stz-32b-background.BebSPe/`.

| Check | Result |
| --- | --- |
| `node --test tests/scripts/pointResponsiveBody.test.mjs tests/ui/svgPreviewExport.test.ts` | **120 passed**, zero failures/skips (`focused-final.log`). |
| Broader body/export/paint/capture/literal/Canvas/diagnostics/verifier focused suite | **384 passed**, zero failures/skips (`focused.log`); ran before the last three collection edge tests, which passed above and in the full suite. Exact invocation: `commands.json`. |
| `npm test` | **3,006 passed**, zero failures/skips (`npm-test.log`), including all 101 body tests and 172 policy tests. |
| `npm run build` | Exit 0, run after `npm test` completed (`npm-build.log`); existing nonblocking >500kB chunk warning only. |
| `npx tsc -p tsconfig.app.json --strict` | Exit 0 (`production-strict.log`). |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Exit 0 (`fixtures-strict.log`). |
| `node --check` on all five changed `.mjs` scripts/tests | Exit 0 (`script-syntax.json`); final body-test syntax rechecked after the last regressions. |
| Recommended JavaScript ESLint, Node/browser globals, on those same five files | Exit 0, zero errors/warnings (`javascript-eslint.log`; executable configuration: `changed-eslint.mjs`). |
| `git diff --check` | Exit 0 (`diff-check.log`). |

No unrelated lint/type debt was changed. The first direct free-label attempt
lacked configured external Playwright and stopped at import; the configured
retry used the existing cached Playwright and installed Chrome and stopped at
`development-server-listen`, `listen EPERM 127.0.0.1:5173`, before browser launch.
See `free-labels-initial.log`, `free-labels-configured.log` and
`free-labels-configured/free-labels-evidence.json`. The latter reports no browser
version, no completed groups and all 16 unexecuted. This child restriction is
separate from the prior parent's white-marker assertion. No permissions or
acceptance assertions were weakened.

After documentation is finalized, the frozen checkout is checked with:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Its exact command outcomes, report location and before/after binary-aware
checkout identity are retained externally in
`/private/tmp/stz-32b-background.BebSPe/handoff.json`, alongside
`verification-final.log`, `final-checkout.json`, `final-checkout.diff` and
`final-checkout-untracked.json`. These snapshots include any nonignored untracked
files; the formerly untracked body helper/test are now tracked. Keeping the final
fingerprint outside this tracked document avoids a self-referential hash.

The browser-capable parent must verify that same final tree: all five commands,
both native browser checks, all 16 groups / 20 named point scenarios, all six
actual downloads with 0.5 → 2 → 0.5 and all 91 responsive artifacts, valid white
background placement, empty page-error arrays, restored controls and unchanged
files. The remaining white cases and settled-export group have no passing
final-tree evidence from this child. After verification passes, independently
review that exact checkout against `prompts/phase-32b-review.md`, including the
preserved namespace and geometric-scaling corrections. `32B verify` does not
review. Phase 32B remains incomplete until both gates pass; 32C/32D remain deferred.

## Targeted persistent override and ordered-import correction (2026-09-25)

This correction began on clean `phase/32b-color-opacity-outline` at
`d3f86a85b9c5ded504496e50467d96b0bc021fc5`. Existing white-background,
saved-body, leaf-font, responsive-capture, namespace and verifier corrections
were preserved. No dependencies, CMYK support, TeX execution, 32C/32D features
or unrelated lint repairs were added.

### Accepted historical evidence and the three causes

Read the supplied independent review and production reproductions at
`/private/tmp/stz-32b-review-reproductions.log`, plus the actual `xgI0o0`
`verification.json`, label-assets reports and free-label artifacts. That parent
verified `5ff8289bb15cdec412469269947c659a63408c31` plus changes with matching
before/after fingerprint
`4061512fdc4f58a9d71ec92378920a24dbe8c22406beba9c222aa232c0011742`:
3,006 tests passed, build/diff/both browser checks passed, Chrome 154.0.8037.57,
Node v26.9.0, all 16 groups/20 scenarios, 164 records and empty page errors.
All six .5 → 2 → .5 responsive downloads and accepted independent PGF evidence
were present. The review ran afterward and returned needs changes, zero Critical,
three Medium, zero Low, not ready to commit. This was a production correction,
not a browser-startup or white-background acceptance repair.

1. Export compared current paint only to the unresolved preview fallback. Black
   after `#123456 → #000000` was indistinguishable from untouched black, so it
   omitted the necessary post-external-key fill override even after save/reload.
2. Import diagnostics/presets saw only the current file while export saw more
   definitions. Old preview snapshots therefore overrode known cross-file colors.
   Root bodies could also stay stale through an older reference ID, and load
   comments recorded selected files without their known dependencies.
3. Parsing discarded unsupported color declarations. Their missing bindings
   exposed earlier literals or built-in colors such as red, incorrectly replacing
   an external CMYK definition in exported paint.

### Persisted editing state and compatibility

`PointStyle.importedPaint` is a small optional additive saved-envelope-v2
extension: `{ referenceId, baseline: PointPaint, overriddenFields: PointPaintField[] }`.
The baseline identifies importer-produced preview/fallback values; the bounded
field list records authoritative accepted user edits independently of equality.
It covers channel color, enablement and opacity, border width/dash/phase/cap/join,
and overall opacity. It contains no React state, measurements or renderer cache.

The diagram and preset update boundaries initialize missing provenance on a new
edit and record explicit control fields, including accepted equal values. Coupled
Color/Fill and built-in presets mark their intentionally selected channels;
ordinary single-channel edits cannot claim unknown unrelated paint. Bulk/quick
controls use the same editing contract. Both TikZ modes emit local overrides
after the actual external key. Enablement-only edits use bare `fill`/`draw` when
necessary to retain an unresolved color. Existing effective opacity and dimming
continue to multiply once. A subsequent independent integration audit caught
pristine numeric blur being treated as an edit; the numeric commit boundary now
ignores untouched blur while accepting actual input and explicit Enter. Registered
and mandatory native checks preserve empty intent and unchanged history on focus/blur.

Cloning, duplication, clipboard, history, serialization and preset copies own
independent nested baseline paint, dash arrays and override lists. Reapplying an
imported preset replaces point-local overrides with the preset's own style/intent;
reapplying an unedited imported preset resets point overrides. A different reference
or detached copy clears unrelated provenance. Malformed metadata, invalid baselines,
unknown/duplicate fields and reference mismatches fail validation. Envelope versions
1 and 2 remain readable; Diagram.version stays 1. See [model notes](DATA_MODEL.md).

Absent metadata preserves historical explicit styles and does not fabricate intent
for every fallback. New edits lazily compare against the shared resolved baseline,
retaining distinguishable old values before recording the new edit. Manual values
that differ from a recorded baseline also remain authoritative. Historical edits
returning exactly to a fallback cannot be recovered: old files never stored that
information. No claim is made to reconstruct those ambiguous edits.

### One context, ordered dependencies, unknown colors

Import, diagnostics, preset construction, baseline/unresolved-field reconstruction
and export share `createImportedTikzResolutionContext`. Source-array order is load
order; later canonical definitions win for roots and nested invocations. `base`
and `/tikz/base` share identity; `/other/base` remains distinct. Style bodies retain
the invocation's runtime directory, ordered options, work/depth limits and cycle
warnings. Runtime directory changes remain explicitly unsupported. Raw source,
raw options, original key spellings and source/reference IDs are preserved.

On later imports, only tracked importer snapshots refresh their unoverridden
paint fields and baseline. Actual user edits and metadata-absent explicit saved
styles are retained, and prior history remains immutable. Refreshing a previously
unknown dependency never marks its old fallback as a local edit. Diagnostics are
reconstructed in the same final context. Unrelated presets are not regenerated.

Colors have three states: absent (built-in fallback is allowed), supported literal,
or recognized unknown (`null`). Unsupported declarations shadow earlier values
and built-ins; a later supported declaration restores resolution. The effective
color environment is read at invocation after applicable sources load, not at
the textual position of a style body. Unknown explicit or implicit-white mixture
operands propagate uncertainty to the affected channels. Known unrelated paint
remains resolved. A later unsupported option can retain the last known preview
value as a diagnosed fallback; it is never treated as successful resolution.

Resolution tracks known style/color source dependencies, including unknown color
bindings. Export load comments deduplicate by source identity and follow source
load order independently of element traversal. Selecting outer alone includes
base then outer; custom hints remain comments. Unknown external dependencies stay
unresolved. Arbitrary raw preambles are neither embedded nor executed. See the
[import grammar and export contract](IMPORTED_POINT_PAINT.md).

### Regressions and independent evidence

New registered production tests are `tests/model/pointPaintIntent.test.ts`,
`tests/model/pointPaintImportContext.test.ts`, and
`tests/tikz/pointImportedResolution.test.ts`. They exercise exact review inputs,
return edits and non-color settings, channel isolation, reload/history, cloned and
copied metadata, preset/reference changes, legacy/invalid metadata, cross-file
colors/styles, late dependencies, canonical root replacement, ordered hints,
unsupported declaration order/mixtures and restored supported values. Both-mode
assertions locate the actual external key and resolve the subsequent generated
named-color definitions; unrelated or pre-key colors cannot satisfy them.

The new [PGF import-order reference](../tests/fixtures/point-paint-pgf/import-order/README.md)
compiled successfully with pdfTeX 1.40.29 / PGF 3.1.11a. It retains actual source
files, command output, PDF, full log, uncompressed page operators and nine manually
observed rows: cross-file colors, later root aliases, colors declared after bodies,
untouched macro/CMYK effects and explicit post-key black overrides. Existing
opacity/namespace references were not regenerated. Expected paint is independent
of the TypeScript resolver.

Native acceptance adds `point-paint-local-override-intent`,
`point-paint-cross-file-resolution`, and `point-paint-unsupported-color-bindings`
through real import/preset/Inspector events. It requires observations before
assertions, both generated modes with post-key paint checks, JSON download/reload,
Undo/Redo, preview paint and actual downloaded/reopened SVG/PNG artifacts. Missing
then later known dependencies and old-reference canonical replacement are covered.
The fail-closed parent policy now requires **16 groups / 23 named point scenarios**;
an old successful 20-scenario report cannot pass. All existing lifecycle/MathJax,
picking, immutable capture, six responsive downloads, 91 responsive artifacts,
three body controls and validated white-background exception remain mandatory.

### Executed checks and final-tree handoff

Commands use `PATH=/opt/homebrew/bin:$PATH` (Node v26.9.0). The final binary-aware checkout identity is
retained outside tracked documents in `/private/tmp/stz-32b-import-override-handoff/`
to avoid a self-referential hash. The final `32B verify` invocation captures the
same tree, including new untracked tests and PGF fixtures.


| Check | Result |
| --- | --- |
| `npm test` | **3,086 passed**, zero failures/skips (`/private/tmp/stz-32b-final-tests-complete.log`). |
| `npm run build` | Passed, executed after that full test process exited (`/private/tmp/stz-32b-final-build-sequential.log`). Existing >500kB chunk-size warning only. |
| `npx tsc -p tsconfig.app.json --strict` | Passed (`/private/tmp/stz-32b-final-production-strict.log`). |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Passed (`/private/tmp/stz-32b-final-fixture-strict.log`). |
| `npx tsc --ignoreConfig --noEmit --strict --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --jsx react-jsx --skipLibCheck --types node tests/model/pointPaintIntent.test.ts tests/model/pointPaintImportContext.test.ts tests/tikz/pointImportedResolution.test.ts tests/ui/inspectorNumericInput.test.ts` | Passed (`/private/tmp/stz-32b-final-focused-strict.log`). |
| Independent integration audit | Independently replayed all three review inputs through actual production functions; 42 focused tests passed. It found the numeric focus/blur issue above, then inspected its correction. No further concrete defect found; this is **not** the final acceptance review. |
| Changed JavaScript syntax/recommended ESLint | All **8** changed/new `.mjs` files passed with zero lint errors/warnings; file list and exact results in the external handoff. |
| Targeted TypeScript/TSX ESLint | **20 of 21 files clean**. InspectorField has **2 pre-existing** errors, reproduced at HEAD: existing effect state synchronization and existing non-component export. Baseline log: `/private/tmp/stz-inspector-field-baseline-lint.log`. |
| `git diff --check` | Passed (`/private/tmp/stz-32b-final-diff-check.log`); also rerun by the frozen-tree verifier. |

The separately established **25 pre-existing `no-regex-spaces` errors** in
`tests/tikz/generateTikz.test.ts` remain unchanged; that file is not modified in
this follow-up. They are not new failures or conflated with the two demonstrated
InspectorField baseline errors. No repository-wide lint cleanup was performed.
The build chunk-size warning is nonblocking and separate from lint debt.

An initial full run found 32 runner-fixture failures because the isolated copied
verifier did not include its newly imported post-key oracle and two transitive
helpers. The fixture now copies those actual dependencies. All 32 runner tests,
updated policy rejection tests and the final full suite passed; fresh-process
loading, checkout checks and review/commit guards remain intact.

The direct configured `node scripts/checkFreeLabels.mjs` attempt failed before
browser startup at `development-server-listen`, `listen EPERM 127.0.0.1:5173`.
Its actual report and log are in the handoff's `direct-free-labels` directory;
no native assertion ran. Permissions and browser assertions were not changed.

After documentation is frozen, execute the required final-tree command:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Exact final outcomes and report path, before/after checkout identity, tracked
binary diff and untracked hashes are saved in
`/private/tmp/stz-32b-import-override-handoff/handoff.json`,
`verification-final.log`, and `final-checkout.json`. These external records are
authoritative for the frozen tree; earlier passing reports and intermediate
fingerprints do not verify the new changes. Browser startup restrictions remain
pending parent evidence, never a pass. The parent must complete **all five**
commands, both native browser checks, all **16 groups / 23 scenarios**, the 35 new
required artifacts and all preserved responsive evidence with empty page errors.
After that passes, independently review the same tree against
`prompts/phase-32b-review.md`, explicitly rechecking all three original findings.
The earlier independent review did run and requested these changes; `32B verify`
does not itself review. No commit/push or Phase 32B completion is authorized by
partial verification; 32C/32D remain deferred.

## Targeted detachment and unsupported-mutation correction (2026-09-25)

The checkout supplied for this correction was clean on
`phase/32b-color-opacity-outline` at
`d85ce9f4cf3842f3b25e5bbe6bd6407b76fe55cf`, which contains the preceding
corrections and the updated fix prompt. It was not reset to the older reported
revision. All 15 formerly untracked helper/test/import-order PGF files in the
accepted parent's manifest matched their recorded SHA-256 hashes on inspection;
the existing work and binary artifacts were preserved.

The accepted pre-fix report remains
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-4OOIEu/verification.json`:
3,086 tests, build/diff/both browser checks, 16 groups / 23 point scenarios,
167 evidence records, no page errors, Chrome 154.0.8037.57 and Node v26.9.0.
Its before/after fingerprint was
`2fcf764109737beb6b1fd02b66d3f5178338a1adb2a4c9480ea1a5a111a9ad0d`.
The subsequent review independently reproduced two Medium production defects
and returned `needs_changes`. That accepted browser evidence covers the pre-fix
tree only; it is not new acceptance for the changes below.

### Atomic external-style detachment

`clearContextQuickStylePresetReferences()` already served single and multiple
selection. Its actual detachment helper deleted `stylePresetId` and
`importedTikzStyleReferenceId` but retained point `style.importedPaint`. Validation
correctly rejected the resulting detached provenance, so saving/reloading and
redo failed even though undo restored a valid point.

The helper now applies `pointStyleForImportedReference(style, undefined)` when
detaching a point. All explicit paint, opacity, shape/size, raw text and geometry
survive, with cloned nested paint and no mutation of presets, unselected points
or history. Validation and serialization were not weakened. Existing equivalent
preset/reference replacement and clipboard paths already use this cleanup.
The similarly named bulk-edit helper intentionally clears only `stylePresetId`;
ordinary paint edits retain the external reference and provenance.

The registered `tests/ui/pointStyleClear.test.ts` covers the exact redpoint
reproduction, independent paint with enablement/dash variants, multiple points
and an unselected imported control, immediate validation/reload, a single effective
commit, repeated-clear no-op, frozen prior snapshots and valid undo/redo. Both
TikZ modes inspect each actual target node and resolve named colors, retaining
other objects' legitimate external invocations and all source/preset records.

### Ordered uncertainty without handler execution

Previously the parser discarded an unsupported `.append style` declaration and
the shared context rebuilt the earlier red definition as known. Export therefore
wrote red overrides after the external key, replacing PGF's actual blue effect.

The scanner now retains ordered supported-definition and targeted-invalidation
events in addition to selectable definitions. Literal targets follow canonical
aliases and declaration-level `.cd`. Recognizable unsupported handlers, handler
chains and legacy `\tikzstyle{key}+=[...]` invalidate the target without executing
their bodies. The shared context carries an explicit unresolved definition,
last-known preview body, diagnostic and source dependencies. Missing-option
resolution and saved-reference fallback cannot restore false certainty. A later
full supported definition restores known resolution; a nested invalidated
invocation followed by `text=green` restores only text certainty. Unrelated keys
remain resolved.

The unresolved state is reconstructed from saved raw sources and used by direct
invocation, nested resolution, preset creation, snapshot refresh and both export
modes. Stable reference IDs, raw options/source and explicit local edits survive.
The preview can remain red with a visible warning; this deliberately does not
claim execution of the blue append. Untouched uncertain paint stays before the
external key, with supported and explicit local overrides after it. Returning an
edited fill to fallback red still overrides fill without claiming untouched text.

An independent integration audit also found a missing load hint when an append
body invoked a literal style from a third file. Recognizable style-list mutation
bodies now contribute bounded dependency-only discovery: defining, mutating,
nested-style and named-color source hints remain in load order, including after
reload. These bodies never apply paint or restore certainty. Arbitrary code
handlers remain uninterpreted. Mutation-only-file import UI remains outside scope.

Registered model/export regressions cover one/separate blocks, source ordering,
canonical aliases, `.cd`, distinct `/other` targets, definition/mutation/definition
restoration, nested field certainty, stale-reference fallback, literal-target
recognition boundaries, apply before/after mutation, late import refresh,
save/reload/history and local return edits. Expected colors are literals; export
checks inspect options after the actual external key and resolve named colors.

### Native and independent PGF evidence

Two new mandatory native scenarios are `point-paint-clear-imported-style` and
`point-paint-unsupported-mutations`. They use production import/preset/Inspector,
the actual **TikZ style selector → Clear TikZ style**, native Undo/Redo and actual
JSON download/reopen. Clear covers single/multiple points, an unselected imported
control, immediate model validity, unchanged explicit paint/preview, both target
outputs, and actual SVG downloads reopened outside the App. Mutation covers
visible diagnostics, red fallback, both modes, local override/return intent,
history/persistence and retained raw source. Read-only fixture observations
expose validation and resolution; no fixture mutation bypasses native App events.

The cumulative policy requires **16 groups / 25 named point scenarios**, adding
**25 mandatory artifacts** (10 mutation, 15 clear). Detached-state checks require
both reference and provenance absence at cleared/redone/reloaded boundaries;
the existing imported-state checks still require an active reference. Added
fail-closed regressions reject old 23-scenario evidence and missing/corrupted
new observations/artifacts. Fresh-process dependency copying remains intact.
The prior three import scenarios, all six responsive downloads and their 91
artifacts, .5 → 2 → .5 checks, body/font controls, white-background validation,
immutable captures and review/commit gates remain mandatory.

[The focused PGF comparison](../tests/fixtures/point-paint-pgf/unsupported-mutations/README.md)
preserves the independent review's failing source, generated TikZ, actual PDF,
compiler log and uncompressed operators byte-for-byte under `before/`. Corrected
standalone and inline outputs were generated from the actual production code and
compiled with pdfTeX 1.40.29 / PGF 3.1.11a, exit 0. Both generated nodes and the
external node are blue fill/text (`0 0 1 rg`); the original generated node was red
(`1 0 0 rg`). The registered regression checks these independent page operators
and exact equality of current exports with the files actually compiled. The
Poppler rendering was visually inspected. Existing opacity, namespace and
import-order PGF references were not regenerated; no importer/preview TeX execution
or new dependencies were added. Phase 32C/32D remain deferred.

### Verification and frozen-tree handoff

Commands use `PATH=/opt/homebrew/bin:$PATH`, Node v26.9.0. Exact logs, supplemental
commands and the final binary-aware checkout snapshot are retained in
`/private/tmp/stz-32b-detach-mutation-handoff/`. The final identity is external to
this tracked report to avoid a self-referential hash; it includes new untracked
tests and all retained/new PGF binaries.

| Executed check | Result |
| --- | --- |
| `node --test tests/ui/pointStyleClear.test.ts tests/ui/contextQuickStyleBar.test.ts tests/model/pointPaintIntent.test.ts tests/model/pointPaintImportContext.test.ts tests/tikz/pointImportedResolution.test.ts tests/ui/bulkEditing.test.ts tests/ui/undo.test.ts` | **152 passed**, zero failures/skips (`focused-regressions.log`). |
| `node --test tests/scripts/runPhaseVerification.test.mjs tests/scripts/runPhaseRunner.test.mjs tests/scripts/pointPaintOracle.test.mjs` | **389 passed**, zero failures/skips (`/private/tmp/stz-new-native-final-policy.log`); includes all 32 isolated runner tests. Synthetic negative verification cases are not browser executions. |
| `npm test` | **3,231 passed**, zero failures/skips (`npm-test.log`). |
| `npm run build` | Exit 0, started after the full test process exited (`npm-build.log`). Existing >500kB chunk-size warning only. |
| `npx tsc -p tsconfig.app.json --strict` | Exit 0 (`production-strict.log`). |
| `npx tsc -p scripts/fixtures/tsconfig.json` | Exit 0 (`fixtures-strict.log`). |
| Focused strict TypeScript for clear, intent, import-context and imported-export tests | Exit 0 (`tests-strict.log`; exact flags in `commands.json`). |
| Syntax and recommended JavaScript ESLint on all **7** changed/new `.mjs` files | Exit 0, zero errors/warnings (`script-checks.json`, `javascript-eslint.log`; executable check is `changed-script-checks.mjs`). |
| Targeted ESLint on all **7** changed/new `.ts`/`.tsx` files | Exit 0 (`typescript-eslint.log`). |
| `git diff --check` | Exit 0 (`diff-check.log`), also checked by the final verifier. |
| Independent read-only integration audit | **92 focused tests passed** after the dependency correction (`/private/tmp/stz-integration-audit-focused.log`); actual PDF bytes and unchanged failing artifacts were independently checked. No remaining concrete functional defect found. This does not satisfy missing native acceptance. |

The established two `InspectorField.tsx` lint errors and 25 `no-regex-spaces`
errors in `tests/tikz/generateTikz.test.ts` remain untouched. Neither file changed
in this correction; no repository-wide lint cleanup was performed. Those baseline
debts are separate from the passing changed-file checks and nonblocking build
chunk-size warning.

The configured direct free-label run failed at `development-server-listen` with
`listen EPERM 127.0.0.1:5173`, before browser launch. Its actual log/report are
`direct-free-labels.log` and `direct-free-labels/free-labels-evidence.json` in that
handoff. This is a child startup restriction, not passing browser evidence.
No assertions, permissions or gates were relaxed. The final verifier is run only
after this report and all code/fixtures are frozen:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

`verification-final.log`, `handoff.json` and `final-checkout.json` record its exact
outcome and report path, with `final-checkout.diff` and
`final-checkout-untracked.json` preserving raw binary diff/untracked bytes.
The final same-tree independent review is retained externally as
`independent-review.md` with its structured result in `independent-review.json`;
it must keep readiness false while fresh required browser evidence is missing.
The browser-capable parent must complete all five commands and both browser checks
on that same identity, all 16 groups/25 scenarios/new artifacts, preserved
responsive evidence and empty page errors. Only then may independent review of
the same tree accept Phase 32B, explicitly rechecking both original findings.
`32B verify` itself does not review. Missing fresh browser acceptance remains a
gate even when focused/static tests and the PGF comparison pass.

## Runtime diagnostic snapshot correction (2026-09-25)

The subsequent parent verification at
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-1cbUWu/verification.json`
passed all 3,231 tests, build, diff check and label assets, but stopped in
`point-paint-local-override-intent` when `pointPaintModelDiagnostics()` read
`camera.mode`. The fixture had cast the persistent file's diagram as a runtime
`Diagram`; `serializeDiagram()` intentionally omits the runtime camera. This
was a diagnostic boundary error, not evidence of a missing editor camera.

The existing DEV App observer now captures `runtimeDiagramJson` directly from
the committed `editableDiagram`, separately from the unchanged saved JSON.
Point paint diagnostics validate and resolve a detached copy of that runtime
snapshot. They do not reconstruct through the saved-file loader, normalize
styles, insert a camera, or mutate App/history. The observer depends on the
complete runtime diagram so runtime-only changes cannot leave stale diagnostics.
Native JSON download/reload checks still use the persistent snapshot.

Seven registered regressions cover valid 2D/3D imported points, detached
provenance, invalid runtime cameras, custom IDs, independent diagnostic results
and immutable prior snapshots. All seven pass, as do strict production,
fixture and focused-test TypeScript checks. The changed fixtures/test are
ESLint-clean. App ESLint reproduces the same nine errors and four warnings at
HEAD, with no new diagnostics; baseline/current JSON reports are retained at
`/private/tmp/stz-32b-runtime-eslint-{baseline,current}.json`.

The direct browser rerun log is `/private/tmp/stz-32b-runtime-free-labels.log`.
That rerun passed the previously failing local-override scenario, cross-file
resolution, unsupported color bindings and unsupported mutations. It then
exposed an unbounded history-length assertion during multi-point clear: the
editor correctly retained 100 entries while the check expected 101. Its log
is preserved as `/private/tmp/stz-32b-runtime-free-labels-history-failure.log`.
Both the native clear assertion and evidence policy now verify the complete
100-entry bounded stack, including the exact pre-clear state, oldest-entry
eviction, a changed current diagram and an empty redo stack. Retained earlier
snapshots must remain unchanged; merely accepting a capped length is insufficient.
Policy regressions cover the capacity boundary and reject incorrect commits.

Final cumulative verification is recorded externally in
`/private/tmp/stz-32b-runtime-final-verification.log`, which identifies the
fresh worker report and binary-aware checkout fingerprint without introducing
a self-referential tracked hash. Required acceptance remains all five commands,
16 groups / 25 named point scenarios and all mandatory artifacts, followed by
same-tree independent review. The failed `1cbUWu` report cannot satisfy that gate.
