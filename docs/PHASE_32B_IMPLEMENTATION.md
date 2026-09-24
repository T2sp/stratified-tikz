# Phase 32B: Independent point paint and imported styles

Status: the prior checkout passed parent verification, then independent review
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
