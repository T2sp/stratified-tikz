# Phase 32B Targeted Fix Prompt: Separate saved body layout from scale-dependent SVG text measurements

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first. Preserve the namespace/
canonical-alias correction, geometrically scaling point contours, interior fixture
framing, coverage preflight, capture-coordinate checks, cleanup and regressions,
including the untracked `scripts/pointResponsiveFraming.mjs`. Preserve all earlier
31/32A, Inspector, persistence, export and user changes. Do not reset or restart.

The latest parent checked revision `9710e9252f2dd6c8d71a2d0d11bf2f99a14b66cd`
plus working-tree changes. Its before/after fingerprint was:

```text
41ff7e9818ac6df5cd04cc30c75f625d2723ffaf0f22757dbdf2227f61163dd0
```

This matches the inspected checkout before this prompt update. Updating the
prompt and implementing the correction changes identity; obtain fresh final-tree
evidence, including untracked files.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated responsive-download body measurement assertion,
focused diagnostics/regressions, and further demonstrated 32B acceptance failures.
Keep strict TypeScript, avoid new dependencies and unrelated cleanup, and defer
32C/32D. Do not change production geometry or export semantics merely to satisfy
an invalid comparison of browser measurements.

## Latest execution findings

The previous root-clipping failure has been corrected. The latest parent passes
both `point-paint-responsive-circle` and `point-paint-responsive-triangle`,
including their required scales, variants, probes and non-scaling controls.
It now fails in `point-paint-responsive-downloads`, on an exact comparison of
native text bounds between display scales.

This is separate from the child's localhost `EPERM`. Chrome launched and native
assertions ran in the parent. Neither the old clipping diagnosis nor a sandbox
permission change explains this new assertion.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-F4Fxc7
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and matching checkout snapshots;
- `point-paint-responsive-transparent-app-framed.json`, `.png` and `.svg`;
- `point-paint-responsive-transparent.svg`, the actual downloaded file;
- `point-paint-responsive-transparent-scale-0.5.json`, `.png`,
  `-full.png` and `.raster.svg`;
- the corresponding `point-paint-responsive-transparent-scale-2` files;
- completed circle, triangle, namespace and earlier paint artifacts.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-xx19j0/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,836 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointResponsivePaint.mjs:212` |
| Stage / scenario | `point-node-paint-import-persistence` / `point-paint-responsive-downloads` |
| Completed groups / evidence records | 14 of 16 / 153 |
| Completed point scenarios | 19 of 20 |
| Browser / Node | Chrome 153.0.8010.53 / Node v26.9.0 |
| Page errors | Empty |
| Checkout before/after | Same fingerprint |
| Fresh independent acceptance review | Not reached |

All eleven cumulative 32A scenarios, all five earlier paint scenarios, namespace
aliases, responsive circle and responsive triangle passed. The first transparent
solid-circle download was reopened at both scales. Its per-scale framing,
physical paint, export-envelope and capture checks completed before the exact
cross-scale body comparison failed. Both native PNGs and complete-root PNGs
were saved with stable capture coordinates.

Do not mark the download scenario complete: later cross-scale/final assertions,
the other five shape/variant/background combinations, and the separate
`settled-SVG-export-standalone` group have not completed. The latter group was
not executed in this run.

## Confirmed cause: native text bounds are being treated as saved layout

`measureResponsivePointPaint()` assigns `body.bounds` from `body.getBBox()`.
These values are browser measurements of the rendered text, not a stored layout
record. The failing comparison is:

```js
assert.deepEqual(small.body.bounds, large.body.bounds,
  'Download body layout is invariant under CSS resize')
```

The saved observations show:

| Quantity | CSS scale 0.5 | CSS scale 2 |
| --- | --- | --- |
| Root CSS dimensions | 260 × 180 | 1040 × 720 |
| Body bounds x | -12.9931640625 | -12.9931640625 |
| Body bounds y | -6 | -6.5 |
| Body bounds width | 26 | 25.9921875 |
| Body bounds height | 12 | 13 |
| Capture coordinates stable | true | true |

Comparing the actual downloaded XML with both observed raster SVGs establishes
that the body subtree and circle attributes are unchanged:

- Exact title and visible text: `Scale`.
- Body placement: outer `translate(0 0)`, inner
  `translate(-12.9931640625 4)`.
- Actual text declaration: `Times New Roman, Times, serif`, size 12, weight 400,
  normal style, start anchor, alphabetic baseline, x=0, y=0.
- Circle radius: `41.507105564650516`; declared border remains 24 local units.
- Within each scale, measurements before and after the screenshot agree.

The failure therefore does not establish mutated saved layout. It demonstrates
that exact equality of native SVG text bounds across different CSS scales is
the wrong invariant for this static export. Do not attribute the difference to
a specific browser hinting mechanism or a font-loading race without evidence.

There is also a diagnostic mismatch: `body.font` currently reads computed style
from the enclosing `g`, yielding `16px Inter, Arial, sans-serif`. The leaf
`text` explicitly declares a different font. Record the actual text element's
computed font and readiness before reasoning about text metrics.

## Required reading

Read `AGENTS.md`, the paired 32B implement/review prompts, and the latest sections
of `docs/PHASE_32B_IMPLEMENTATION.md`. Trace:

- `scripts/checkPointResponsivePaint.mjs`, especially the actual download loop;
- `scripts/pointPaintOracle.mjs` and `scripts/pointResponsiveFraming.mjs`;
- `scripts/pointLiteralOracle.mjs` and
  `scripts/fixtures/positionedLiteralAssertions.ts`;
- `scripts/fixtures/labelBrowserOracle.ts` and
  `scripts/pointExportReference.mjs`;
- their registered tests, responsive paint/capture tests, and
  `scripts/standaloneSvgCapture.mjs`;
- `scripts/automation/phase-verification.mjs` and its 20-point-scenario policy.

The existing export reference deliberately compares Canvas quantities in local
font units and notes that SVG advances can differ with display scale. The
literal observer already supports sanitized `file://` SVGs with a detached
XHTML Canvas, native text measurements and document-restoration checks. Reuse
or narrowly adapt those independent mechanisms instead of adding a second
production-layout implementation to the harness.

## Required correction

### 1. Assert exact saved structure and local placement

Replace the inappropriate cross-scale body `getBBox()` equality with explicit
invariants on the same actual downloaded SVG. Compare source/title, foreground
text and order, body/ancestor local transforms, text coordinates and baseline
attributes, declared font/spacing/whitespace settings, and contour geometry.
Use a namespace-aware structural comparison or a deterministic snapshot that
accounts only for irrelevant XML serialization differences.

Establish the baseline from the unmodified saved file and the independently
declared fixture source/font, not merely from whatever DOM the second sample
happens to contain. A wrong font or displacement present in both samples must
not become acceptable just because the samples agree.

Only the controlled root CSS display size/placement and resulting screen CTMs
may vary during resizing. Keep the root viewBox, exported geometry, local
placement and body content invariant. Do not globally ignore style/transform
attributes. Verify the downloaded file remains unchanged; do not rewrite its
body, coordinates, fonts or viewBox after export or generate a new file at each
scale.

Retain the exact contour/path invariants and independent native border raster
checks. Do not replace all geometry checks with XML identity alone.

### 2. Validate actual text independently at each scale

Observe actual foreground text font properties, font readiness, source,
baselines, local transforms, native bounds and screen CTMs at each scale.
Use bounded font/layout settling before the retained measurement. Record
`document.fonts` state and the actual text font declaration/check; the enclosing
group's inherited font is not the text font.

Use the independent source/font/Canvas line contract and native SVG fragment
observations to check visible text, finite positive bounds, correct placement
and containment. Preserve the existing positioned-literal baseline, centering,
whitespace and containment checks where applicable. Expected values must not
come from production body bounds or from the very exported position being
tested. Keep sanitized exports free of runtime attributes.

Do not simply delete the failed assertion, round all bounds, add a blanket
one-unit epsilon, increase existing tolerances, or accept any difference that
fits inside the circle. Do not force every SVG `getBBox()` to equal a Canvas
metric: they measure different aspects of text. Keep measured bounds as
diagnostics and use them in the appropriate per-scale visibility/containment
checks. If new evidence instead demonstrates a genuine font/placement defect,
fix that demonstrated cause and retain a regression.

### 3. Preserve coherent capture and prove the revised assertion

Keep the strict before/after checks within each screenshot in
`assertResponsiveCaptureStable()`. Their purpose is to reject a layout or
coordinate change during one capture; the failed cross-scale comparison does
not justify weakening them. Preserve independent framing preflight, positive
margins, actual PNG dimensions, bounded screenshots and the native PNG pixel
mask. Preserve all existing stroke/dash/selection tolerances.

Add registered regressions based on the reported bounds pair and unchanged
body declarations. The pair must not fail solely because native bounds differ
between scales. Tests must still reject missing/nonfinite measurements, changed
source, missing visible text, changed text font/size, displaced baseline/local
transform, and changed contour geometry. Include a displaced body that remains
inside the circle so containment alone cannot make it pass.

In native acceptance, reuse the same downloaded file through scales
0.5 → 2 → 0.5. Retain the existing artifacts at both required scales and give
return-scale evidence a distinct name. Confirm local structure/font contract,
stable measurements within each capture and return-scale placement; do not
reintroduce exact text-bounds equality between different scales.

Exercise focused native negative controls for text mutation, displacement and
font changes. Assert rejection for the intended content/placement/font reason,
restore the original DOM in `finally`, and prove observation/control cleanup
leaves the positive document unchanged. Do not modify the saved file on disk.
Keep source/model/history/request identity checks, temporary root-style cleanup,
owned-page cleanup and primary-error preservation.

### 4. Complete every existing responsive download case

Run transparent and white exports for solid circle, solid triangle and dashed
circle at both required CSS scales. Use the actual App export action and reopen
each unmodified file directly. Keep external-request restrictions, background
policy, sanitization, absence of editor overlays, standalone parsing, complete
root coverage, native paint geometry and dash/phase checks.

Persist structural snapshots, actual text font/readiness, independent literal
observations and per-scale capture data before assertions can throw. A saved
PNG or partial case must not be promoted to a completed scenario. Diagnose any
subsequent failure from its own evidence.

## Preserve implemented corrections and acceptance gates

Keep canonical runtime namespace/alias resolution and ordering, cycle and
missing-reference diagnostics, both TikZ modes and the independent PGF
references (11 observations plus the expected missing-root failure). Keep
geometrically scaling contours, independent paint alphas, painted/miter bounds,
six-local-unit picking tolerance and immutable click-time exports.

Retain the interior fixture, coverage preflight, capture-coordinate consistency,
Inspector/FontFace/source/metric/persistence fixes and all earlier coverage.
Do not reintroduce `non-scaling-stroke` on production point contours or change
unrelated curves/overlays.

The current policy requires all 16 groups and 20 named point scenarios,
including namespace aliases, responsive circle, responsive triangle and
responsive downloads with required JSON/SVG/PNG artifacts. Do not reduce
coverage or weaken fingerprint, artifact, review or commit/push gates.

## Verification and completion criteria

Run focused oracle/literal/capture regressions, the registered full suite, build,
applicable strict TypeScript/fixture checks, changed-script syntax, targeted
lint and `git diff --check`. Run `npm test` and `npm run build` sequentially;
their shared asset preparation has already demonstrated a parallel-run collision.
Preserve established unrelated lint/type debt and the nonblocking build warning.
Do not regenerate unchanged PGF references merely for this harness correction.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, both browser checks, all 16 groups and all
20 named point scenarios with the required artifacts and empty page-error
arrays. Inspect all six responsive downloads and their scale/return-scale
evidence. Match evidence to the final checkout, including untracked files.

The child's startup failure, the older accepted checkout and the partial
`F4Fxc7` native run are distinct evidence. None completes acceptance of the
corrected final tree. After verification passes, independently review that same
tree against `prompts/phase-32b-review.md`, including the earlier production
findings. `32B verify` itself does not review. Phase 32B remains incomplete
until both gates pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant acceptance notes with the
observed metric-contract mismatch, immutable body evidence, actual leaf-font
diagnostics, replacement assertions, negative controls, exact commands/results
and final checkout identity. Separate the now-passed responsive preview cases,
partial transparent-circle download progress, remaining download/settled-export
acceptance and independent review. Do not describe the static body as having
changed layout solely because its native text `getBBox()` changed with CSS scale.
