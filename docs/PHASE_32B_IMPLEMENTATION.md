# Phase 32B: Independent point paint and imported styles

Status: implemented, awaiting acceptance. Fresh parent browser acceptance and subsequent
independent review are required before completion. 32C/32D are not implemented.
No new dependency is introduced.

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
