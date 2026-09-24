# Phase 32B Targeted Fix Prompt: Recognize the intentional white SVG export background

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve existing
changes, including untracked `scripts/pointResponsiveBody.mjs` and
`tests/scripts/pointResponsiveBody.test.mjs`. Keep the saved-body structure
contract, actual leaf-font/literal checks, return-scale captures, negative
controls, fixture framing and all prior production corrections. Do not reset
or restart implementation.

The latest parent checked revision `ef8c50cd7dde032d65d482a11ea028d1a2ad21af`
plus working-tree changes. Its before/after fingerprint was:

```text
5ebdfe6a8e4600b4e6b4ceda9a7943cf632a23a183bbeadf84fe26709fed219a
```

This matches the inspected checkout before this prompt update. Obtain fresh
final-tree evidence after the correction, including untracked files.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated white-background metadata assertion, focused
regressions/diagnostics and further demonstrated 32B acceptance failures. Keep
strict TypeScript, avoid new dependencies and unrelated cleanup, and defer
32C/32D. Preserve production rendering and export semantics.

## Latest execution findings

The parent successfully launches Chrome and passes responsive circle and
triangle preview scenarios. Within the responsive-download scenario, all three
transparent combinations complete the new structure/literal, scale-return and
negative-control checks. Execution then fails on the first white-background
download at scale 0.5:

```text
saved file: sanitized runtime attributes
actual: [{ element: 'rect', name: 'data-stratified-tikz-export-background' }]
expected: []
```

This is separate from the child's localhost startup `EPERM`. It is also a new
failure after the previous native text-bounds comparison was corrected.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-1MopVV
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and matching checkout snapshots;
- `point-paint-responsive-white.svg`, the actual downloaded file;
- `point-paint-responsive-white-body-baseline.json`;
- `point-paint-responsive-white-scale-0.5.json`, `.png` and `.raster.svg`;
- the corresponding white App-framing artifacts;
- all three transparent download baselines, scale/return-scale artifacts and
  `-body-controls.json` files;
- `point-paint-observation-0579.json`, `point-paint-observation-0638.json` and
  `point-paint-observation-0697.json`, which record completed transparent cases
  with restored documents and unchanged file bytes.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-um8Dcd/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,908 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `pointResponsiveBody.mjs:111`, through `checkPointResponsivePaint.mjs:219` |
| Stage / scenario | `point-node-paint-import-persistence` / `point-paint-responsive-downloads` |
| Completed groups / evidence records | 14 of 16 / 153 |
| Completed point scenarios | 19 of 20 |
| Browser / Node | Chrome 153.0.8010.53 / Node v26.9.0 |
| Page errors | Empty |
| Checkout before/after | Same fingerprint |
| Fresh independent acceptance review | Not reached |

All three transparent combinations—solid circle, solid triangle and dashed
circle—have successful body contracts at 0.5 → 2 → 0.5, native/full-root PNGs,
correctly rejected and restored text/displacement/font controls, and unchanged
downloaded bytes. Those are completed cases inside an incomplete scenario;
the scenario's final evidence record has not been emitted.

The white solid-circle scale-0.5 native PNG and observations were saved, but the
body assertion failed before `bodyContractPassed`, subsequent per-scale paint/
envelope assertions, and the complete-root capture. White scale 2/return-scale,
white triangle/dashed-circle cases and the separate
`settled-SVG-export-standalone` group remain unexecuted. Do not infer acceptance
from the existence of a partial capture.

## Confirmed cause: export metadata is misclassified as runtime metadata

The downloaded white file begins with this SVG-root child:

```xml
<rect x="0" y="0" width="520" height="360" fill="#ffffff"
      data-stratified-tikz-export-background="white"/>
```

Its rectangle covers the root viewBox `0 0 520 360` and precedes the drawing.
This is an intentional, established export marker:

- `src/ui/svgPreviewExport.ts` removes editor/runtime metadata and old marked
  backgrounds, then inserts a new marked white rectangle only for white mode.
- `insertWhiteSvgExportBackground()` uses the SVG namespace, white fill,
  root/viewBox bounds and the first root-element position.
- `tests/ui/svgPreviewExport.test.ts` explicitly requires exactly one such
  rectangle in white mode, none in transparent mode, and no duplication after
  repeated sanitization.
- `scripts/checkSettledSvgExports.mjs` already distinguishes this marker from
  unwanted metadata and independently checks the background geometry and mode.

The new `responsiveBodyStructureInDocument()` collects every `data-*` attribute
except its temporary root-style bookkeeping as `runtimeAttributes`.
`assertDeclaration()` then requires that list to be empty. Consequently, it
rejects valid white output. There is no demonstrated production export defect
in this failure.

The existing body-contract unit fixture manually supplies
`runtimeAttributes: []` and omits a white background. Its injected-metadata test
does not exercise collecting the real export marker, which explains the missing
regression coverage.

## Required reading

Read `AGENTS.md`, the paired 32B implement/review prompts and the latest section
of `docs/PHASE_32B_IMPLEMENTATION.md`. Inspect:

- `scripts/pointResponsiveBody.mjs` and its registered tests;
- `scripts/checkPointResponsivePaint.mjs`, including the existing
  `background` loop and baseline/observation calls;
- `src/ui/svgPreviewExport.ts` and `tests/ui/svgPreviewExport.test.ts`;
- the standalone background checks in `scripts/checkSettledSvgExports.mjs`;
- the responsive artifact/evidence requirements in
  `scripts/automation/phase-verification.mjs`.

Line numbers identify the inspected checkout; locate current equivalents if they
move. Use the existing export contract as the specification, not an instruction
to import production sanitization as its own test oracle.

## Required correction

### 1. Make the background expectation explicit

Carry the expected `transparent` or `white` mode from the download fixture into
baseline and displayed-file validation. Do not infer the expected mode from the
marker being inspected or accept an invalid baseline because later samples
match it.

Collect enough structural information to validate marker value, element and
attribute namespaces, parent/order, rectangle geometry and paint. Retain these
observations in the saved-file baseline and pre-assertion diagnostics.

For these viewBox-based responsive fixtures, require:

- Transparent mode: no export-background marker or export-background rectangle.
  Ordinary white-filled diagram content must not be mistaken for the background.
- White mode: exactly one unnamespaced
  `data-stratified-tikz-export-background="white"` attribute on an SVG
  `rect` that is a direct, first element child of the SVG root, has white fill
  and covers the root viewBox in local coordinates.
- The background must remain visible and unshifted; reject paint/transform
  overrides that defeat the specified background.
- Any other runtime `data-*` attribute remains forbidden, including one placed
  on the otherwise valid background rectangle.

Apply the same independent declaration checks to both the parsed saved file
and the reopened observations. Do not use CSS screenshot dimensions as the
rectangle's local geometry or hard-code one captured viewport.

### 2. Permit only the validated export marker

Separate the recognized export-background marker from unexpected runtime
metadata, then retain the strict empty-list assertion for the latter. Keep the
background node, marker value, attributes and order in the canonical full-root
snapshot and all saved/displayed structure comparisons.

Do not allow all `data-*`, all `data-stratified-tikz-*`, or all metadata on
rectangles. An exact-name exception alone must not authorize the marker on
arbitrary nodes, with arbitrary values or in transparent mode. Preserve the
existing narrow handling of owned temporary root-style bookkeeping.

Do not delete the marker from production export, strip it from downloaded
files before validation, remove the background from structural comparisons,
rerun the sanitizer to make the test pass, or skip white cases. The change
belongs in the test contract and its call sites unless fresh evidence proves
an additional production defect.

### 3. Add regressions at the collection boundary

Add a positive white-background case using the actual exported structure or a
faithful DOM fixture that passes through `responsiveBodyStructureInDocument()`.
Retain transparent positives and verify that white and transparent expectations
come from the test case. Merely setting a precomputed `runtimeAttributes` list
to empty would not reproduce or prevent this failure.

Add focused rejection cases for missing/duplicate markers, incorrect marker
value, wrong mode, wrong element/namespace/location/order, wrong bounds/fill,
and an unrelated runtime attribute on the background or point content. Cover
corruption shared by both baseline and observation so equality alone cannot
legitimize invalid output. Also verify that changing/removing the valid
background between scale observations fails structural comparison.

Keep existing source/font/baseline, displaced-body-inside-contour, metric,
capture-coordinate and cleanup regressions. Register any new tests in the
normal suite. Update evidence consumers only if observation fields change;
do not weaken their completion conditions.

### 4. Complete the native matrix with existing controls intact

Reopen all six actual App downloads: transparent/white × solid circle, solid
triangle and dashed circle. Preserve 0.5 → 2 → 0.5 on each unchanged saved file,
with distinct return-scale artifacts. Check background semantics alongside
independent body/font/literal and native paint assertions.

Keep all three existing native body controls and their intended rejection
reasons, exact DOM restoration, immutable disk bytes, bounded capture, owned
resource cleanup and primary-error preservation. Keep root framing, native PNG
pixel measurements, geometric stroke/dash/selection checks, and model/history/
request invariants. Do not reintroduce cross-scale text `getBBox()` equality.

Persist the expected mode and observed background structure before assertions,
so a later failure distinguishes background semantics from unrelated metadata.
Complete the remaining white cases and settled-export group; diagnose any new
failure on its own evidence.

## Preserve implemented corrections and acceptance gates

Keep namespace/alias resolution and its PGF references, geometrically scaling
contours, independent text/fill/border paint, immutable click-time export,
interior fixture framing, same-capture coordinate checks, and the independent
saved-body/leaf-font contract. No schema or production geometry/export change
is justified by this assertion.

Retain all 16 groups, all 20 named point scenarios and the current 91 required
responsive-download artifacts. Preserve the return-scale, body-contract,
negative-control/restoration and immutable-file evidence gates. Do not weaken
fingerprint, artifact, review or commit/push checks.

## Verification and completion criteria

Run the focused responsive-body/export regressions, registered full suite,
build, applicable strict TypeScript/fixture checks, changed-script syntax,
targeted lint and `git diff --check`. Run `npm test` and `npm run build`
sequentially because they share asset preparation. Preserve unrelated lint/type
debt and the nonblocking build warning. Do not regenerate unchanged PGF references.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands, both browser checks, all 16 groups and all 20 named
point scenarios to pass with required artifacts and empty page-error arrays.
Inspect all six responsive downloads, including white background placement and
scale/return-scale evidence. Match evidence to the final checkout and untracked
files.

The child's startup failure and the partial `1MopVV` parent run do not establish
acceptance of the corrected final tree. After verification passes, independently
review that same tree against `prompts/phase-32b-review.md`, including the earlier
namespace and scaling production findings. `32B verify` itself does not review.
Phase 32B remains incomplete until both gates pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant acceptance notes with the
intentional export-marker contract, its previous misclassification, the narrowly
scoped oracle correction, collection-boundary regressions, exact commands/results
and final checkout identity. Distinguish completed transparent cases from the
incomplete download scenario, remaining white/settled-export checks and fresh
independent review. Correct nearby claims that sanitization removes every
`data-*` attribute where this documented export marker is the explicit exception.
