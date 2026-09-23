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

## Verification

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

## Exact parent handoff

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
