# Phase 31D Targeted Fix Prompt: Resolve the measured halo compositing mismatch and reach review

## Environment

Work on the current `phase/31d-tex-path-inline-labels` checkout. Preserve the
pending Phase 31D implementation, browser fixtures, tests, documentation and
all user changes. Do not reset the branch, restore the historical base, or
rerun the original implementation from scratch.

The latest failing parent run used revision
`6fd794c8a98bfda62e0d8173409d38dfc23dde82` plus eight modified files.
Its tracked diff SHA-256 was
`6679416198d0a12c59aa6376e137fd475dced9d96ce80ba919baa633d0f29e28`,
with no untracked files. Preserve the newly added diagnostic retention and
phase-aware parent validation, including their regression tests.

These original implementation files are now tracked and must be retained:

- `scripts/checkInlineLabels.mjs`;
- `scripts/fixtures/inlineLabelBrowserOracle.ts`;
- `tests/integration/phase31dInlineNodeSemantics.test.ts`;
- `tests/rendering/svgInlineLabelRuntime.test.ts`.

Inspect current status first; files may since have been committed or changed.
The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve the
pinned MathJax version and the shared parser/adapter/runtime architecture.
Limit work to the failures described below and further demonstrated 31D
regressions. Phase 31E settled-export waiting and 31F's combined audit remain
deferred.

## Latest execution findings

The supplied report is a **fix run stopped by parent verification before
review**, not a completed review with severity counts. Do not invent review
findings, a `REVIEW_JSON` result, or approval to commit.

### Historical child attempt: server startup was blocked

Both the original implementation child and the latest fix child reported
server-startup `EPERM`. The latest child handoff is retained at
`/private/tmp/stz-phase31d-targeted-handoff.json`. These blocked attempts do
not establish browser acceptance. The authorized parent subsequently launched
Chrome and retained the actual assertion and pixel measurements below.
Do not describe the current failure as a sandbox configuration problem.

### Current failure: inline-label halo compositing assertion

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-if6x1M
```

Read `verification.json`, `05-check-free-labels/command.log`, and
`05-check-free-labels/artifacts/free-labels-evidence.json`, `failure.png`,
`checkout.diff`, and `checkout-untracked.json` within that directory.

The run used Node v26.9.0 and Chrome `153.0.8010.52`, with the Vite development
fixture at `http://127.0.0.1:5174`. It reached
`inline-node-production-rendering-and-path-lifecycle` and exited 1 at
`scripts/checkInlineLabels.mjs:137`:

```text
AssertionError [ERR_ASSERTION]: inline-above-zoom-1: independent
foreground-over-halo maxCompositeError=5.082352941176467 must be <=2
```

The failing condition is now identified:

```js
raster.maxCompositeError <= 2
```

The preceding `compositeCompared > dark` assertion passed. The earlier parent
run in `stz-phase31d-before-review-gRWdxT` lacked the operands and failed before
saving images; that diagnostic gap is resolved. Do not repeat the old claim
that the operand or pixel values are unavailable. What remains unresolved is
the cause of the discrepancy and the correct production/oracle/fixture fix.

The saved checkpoint is placement `above`, zoom `1`, and the mixed source:

```text
日本語 $\frac{O_1}{1+\frac{a}{b}}$ and $g^2$
```

The `inline-above-zoom-1` entry in `diagnostics` records:

| Measurement | Observed value |
| --- | --- |
| Raster size / viewBox | 115 × 34 / `[-58, -27, 115, 34]` |
| Solid dark pixels / preserved | 31 / 31 |
| Composite pixels compared | 1,130 |
| Maximum straight-alpha comparison error | 5.082352941176467 |
| Maximum premultiplied RGB error | 5.082352941176467 |
| Maximum alpha error | 0.46666666666664014 |
| Added white pixels | 586 |
| Furthest added pixel | 2.23606797749979 |
| Distant clear / filled pixels | 485 / 0 |

The worst pixel is raster `(98, 21)`, blue channel:

| Layer / calculation | RGBA |
| --- | --- |
| Foreground alone | `[16, 23, 38, 222]` |
| Halo alone | `[255, 255, 255, 255]` |
| Actual outlined output | `[43, 49, 61, 255]` |
| Independently calculated source-over | `[46.929411764705875, 53.0235294117647, 66.08235294117647, 255]` |

Both the expected and actual composite are fully opaque here. The same
5.08235 difference remains in premultiplied RGB; merely switching comparison
space or excluding low-alpha output cannot explain or remove this failure.
The straight-alpha discrepancy is not by itself proof of a product defect.

The following artifacts are already saved before the assertion, with prefix
`inline-above-zoom-1-` in the artifact directory:

- `foreground.png`, `halo.png`, `outlined.png`, and `expected.png`;
- `difference.png` and `alphaDifference.png` (diagnostic gain 32);
- `foreground.svg`, `halo.svg`, and `outlined.svg`;
- `native.png`, a full-page screenshot rather than a pixel-aligned label crop.

The preceding placement/native-bounds/accessibility and solid-pixel assertions
passed for this case. Later outline/gap values above were recorded as
diagnostics but their assertions had not run. The initial inline
valid/mixed/ordinary/Japanese/whole-source-fallback scenario passed; the full
placement/halo matrix did not.

Seven of the ten required groups completed. The current inline rendering,
placement, halo and picking group started but did not complete. These groups
were not executed:

- `inline-node-lifecycle-path-operations-export`;
- `real-App-input-JSON-history-reused-ID-load`.

The report contains 75 passing scenario records and no uncaught `pageErrors`;
neither fact establishes overall acceptance. Parent test, build, diff check
and `check:label-assets` passed. The latest child reported 85 focused tests
(included in 2,348 full-suite passes), strict fixture TypeScript, targeted
lint, syntax checks and build success. These are previous results, not new
verification of the next fix. The nonblocking build size warning and existing
lint debt are separate.

### Completed follow-up work to preserve

The previous prompt's two supporting fixes are implemented:

- `retainRaster` and the `observe` path save all current failing-case artifacts
  and bounded numeric/paint diagnostics before assertions; assertions now
  identify their operand and placement/zoom.
- The parent accepts complete eight- or ten-group 31C evidence and requires
  all ten groups for 31D–31F. Tests reject missing groups, duplicates/unsupported
  names, malformed or incomplete reports, browser errors, nonzero exits and
  checkout changes. Phase 31B behavior is preserved.

Do not reimplement these as if they were still missing, restore the old
eight-only validator, or broaden the automation work. Preserve their tests
and confirm them alongside the targeted halo fix.

### Review has not run

`scripts/automation/run-phase.mjs` calls the implementation/fix child first,
then `runVerification("before-review")`, then the review child. A verification
exception exits the process in `runVerification`, before the review call.
The supplied run therefore never reached `prompts/phase-31d-review.md`.
At prompt preparation, neither `logs/codex/31D-review.log` nor
`logs/codex/31D-review-summary.json` existed.

The `verify` mode exits after verification and **does not run review**, even
when verification succeeds. A passing manual verification is not a review
pass. Completing this targeted fix should allow a normal automated fix run
to reach its subsequent independent review. Do not change this execution
order, bypass the gate, or invoke commit/push to manufacture completion.

## Goal

Use the saved measurements to identify and minimally fix the halo mismatch,
retain independent visual and interaction coverage and the completed support
fixes, then obtain complete authorized 31D verification. Keep subsequent
independent review explicitly separate from verification success.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31d-implement.md`, and
  `prompts/phase-31d-review.md`;
- the execution evidence above, including the pending implementation snapshot;
- `scripts/checkInlineLabels.mjs`, `scripts/checkFreeLabels.mjs`,
  `scripts/fixtures/inlineLabelBrowserOracle.ts`,
  `scripts/fixtures/freeLabels.tsx`, and `scripts/fixtures/tsconfig.json`;
- `src/rendering/SvgTexLabel.tsx`, `src/rendering/svgPathInlineNodes.ts`,
  the inline-node rendering path in `src/rendering/SvgDiagram.tsx`, and the
  shared label runtime/validated geometry/paint handling;
- `src/ui/svgPreviewExport.ts` and the new inline-node and SVG export tests;
- `scripts/automation/phase-verification.mjs`,
  `scripts/automation/run-phase.mjs`, and their tests in `tests/scripts/`;
- `package.json`, the Phase 31D preview documentation and roadmap entries.

Inspect actual behavior and assertions. The implementation report's claims
about shared rendering, lifecycle and interaction are preservation targets,
not substitutes for the still-unexecuted browser checks.

## 1. Start from the retained failure and preserve its diagnostics

Read the existing `inline-above-zoom-1` diagnostic and its images/SVGs first.
The failure is now reproducible from retained data; another diagnostic-only
rewrite or report that the failing operand is unknown is not the requested
fix. Validate the source-over calculation for the listed worst pixels and
compare the saved SVG structures before requesting new browser measurements.

Keep the implemented pre-assertion retention of:

- placement, zoom, source, path/node/owner/request identity, font and color;
- native/published bounds, SVG/viewBox/raster sizes, transforms and relevant
  computed styles, opacity, stroke width, `vector-effect`, and layer order;
- `dark`, `darkPreserved`, `compositeCompared`, `maxCompositeError`,
  `addedWhite`, `furthestAddedPixel`, `distantClear`, and `distantFilled`;
- bounded worst-pixel diagnostics: pixel coordinates, channel, foreground,
  halo-only and outlined RGBA samples, expected composite RGBA, and separate
  alpha/color differences;
- foreground-only, halo-only and outlined PNGs, plus expected/difference
  visualizations and serialized SVG sufficient to reproduce the discrepancy.

Keep the split assertions, precise checkpoints, bounded work and temporary
resource cleanup. Extend diagnostics only when a specific unresolved cause
requires additional evidence. Record new experiments as diagnostics, not
passing scenarios; never complete a group before all assertions return.

## 2. Diagnose compositing and apply the smallest justified fix

Use the saved SVGs to construct a focused reproduction with the same viewport,
transforms, source and paint, and compare it with the mounted production
component in a permitted browser. Keep this separate from full acceptance.
Trace the listed worst pixels and determine which compositing/rasterization
assumption or production operation accounts for the measured difference.

The saved foreground subtree and halo subtree match their respective
subtrees in the outlined clone structurally. The native metadata records
opacity 1, normal blending and default isolation. Worst samples occur around
nested MathJax geometry, whose paths include inherited fill/stroke and a
stroke width in MathJax units. These observations narrow investigation but
do not prove a cause. Investigate:

- straight-alpha versus premultiplied-alpha calculations and the information
  lost when separately rasterized layers are read back as 8-bit Canvas pixels;
- intermediate rounding, low-alpha color reconstruction and whether the
  tolerance of 2 per 8-bit channel is valid for the chosen measurement method;
- per-primitive fill/stroke antialiasing, overlap and group isolation when
  painting directly onto the halo versus flattening foreground alone onto a
  transparent surface and then composing its pixels;
- inherited styles/fonts/colors, group opacity and isolation, serialization,
  viewBox alignment and nested transforms in the cloned SVGs;
- actual foreground/halo order, transparent paint, stroke scaling and formula
  geometry in `SvgTexLabel`.

Test these factors with controlled comparisons that change one relevant
condition at a time. Preserve raster alignment and distinguish native CSS/
SVG inheritance from isolated-clone state. A full-page screenshot is useful
for appearance, but is not a same-resolution pixel oracle without explicit
coordinate/DPR alignment.

These are investigation directions, not diagnosed causes. In particular,
premultiplied comparison alone still fails on the recorded opaque worst pixel.
Support the chosen fix with saved numeric and visual evidence. If the oracle
is incorrect, fix it without adjusting production paint to match it. If the product
violates the white-halo contract, make a targeted renderer correction and
demonstrate that it fixes the visible failure.

Keep the current tolerance for the unchanged comparison. If the comparison
itself is invalid, justify an alternative using independent measurements and
a defensible error bound, not a threshold chosen to cover 5.08235. Do not
merely raise `2` to `6`, drop partially transparent pixels, replace
maximum error with a forgiving average, remove the compositing assertion, or
derive the expected image from the outlined image being tested. Any replacement
comparison must be independent, quantitatively bounded and sensitive to real
color/alpha errors. If revising the oracle, include meaningful negative controls
that reject relevant bad output, such as foreground obscured by the halo,
missing/oversized outlines, or an opaque rectangular background.

Retain and execute:

- all five placements at both existing zoom settings, including the tall
  nested fraction and mixed Japanese/text/math runs;
- actual white halo pixels and the established display-unit width, unchanged
  inner glyph color, counters, thin details and transparent fraction/text gaps;
- transparent math without a white ghost;
- decorative `aria-hidden`/pointer-pass-through behavior without duplicated
  accessible formula content or free-label hit rectangles;
- current transparent/white SVG cloning with settled formulas and literal
  fallback. The new settled-export waiting policy remains outside 31D.

## 3. Preserve the repaired parent verification contract

The phase-aware validator and its behavioral regressions are already present.
Retain and run the checks for:

- valid 31C evidence and valid complete ten-group 31D evidence;
- the chosen 31C handling of the extended shared harness;
- 31D evidence missing both inline groups, and each inline group individually;
- duplicate/unsupported group names, incomplete/unexecuted groups and browser
  errors, even when the command exits 0 and claims `passed`;
- preservation of 31B verification and checkout-change rejection.

No further automation change is expected unless a new concrete defect is
demonstrated. Do not change the child sandbox flags or review order, bypass
parent verification, or accept a nonzero browser command. Do not modify
commit/push behavior or introduce a new review mode in this halo fix.

## 4. Finish the complete browser run

Fixing the first halo assertion does not establish that later checks pass.
Run the entire strengthened `check:free-labels`, preserving the existing 31C
regressions and the added inline-node cases. Diagnose any further observed
failure as product, oracle or setup before applying a minimal correction.

Require all ten named groups:

```text
existing-renderer-regressions
independent-oracle-negative-controls
boundary-anchor-camera-matrix
inverted-success-and-failure-races
pending-lock-and-autohide
deletion-and-unmount
real-App-input-JSON-history-reused-ID-load
current-SVG-cloning
inline-node-rendering-placement-halo-picking
inline-node-lifecycle-path-operations-export
```

Preserve marker-centered selection of the owning curve, dot/non-dot markers,
selected highlights, native pointer/Alt cycling, 2D/3D supported path kinds,
14-unit placement offsets, font size 12 and conversion reuse. Retain complete
current-source pending/fallback, duplicate node IDs across paths, latest font
and source ownership, delayed completion after reverse/split/duplicate/delete/
document replacement, the preview cap, and empty-text behavior.

Preserve production path operations, save/load, Undo/Redo, raw inline-node
text/options/positions and both TikZ modes. Derived rendering state must stay
outside model/history. Do not bypass failing interaction tests with direct
selection assignment or omit the real App group that this run never reached.

## Verification and permitted execution

Run focused checks first, with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/integration/phase31dInlineNodeSemantics.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/checkInlineLabels.mjs scripts/checkFreeLabels.mjs \
  scripts/fixtures/inlineLabelBrowserOracle.ts scripts/fixtures/freeLabels.tsx \
  src/rendering/SvgTexLabel.tsx src/rendering/svgPathInlineNodes.ts \
  src/rendering/labels/svgLabelRuntime.ts src/ui/svgPreviewExport.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/integration/phase31dInlineNodeSemantics.test.ts \
  tests/ui/svgPreviewExport.test.ts
git diff --check
```

Include any additional changed files in the applicable targeted checks and
syntax-check changed automation scripts. Compare `SvgDiagram` lint against
the baseline if touched; introduce no new errors. Run repository-wide lint
only if already lint-clean. Keep focused counts within the full-suite total.

The authorized parent/Terminal command for final verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31D verify
```

`verify` accepts the dirty checkout and runs `npm test`, `npm run build`,
`git diff --check`, `check:label-assets` and `check:free-labels`, saving fresh
logs/artifacts and checking checkout identity. It does not implement, review,
commit or push. Do not recursively invoke `31D fix` or `31D implement` to
perform verification.

If working as the automated implementation child, the outer runner will
perform these browser commands after you return. Run available focused/full
Node tests and build there, then state precisely which browser gates await
the parent. A blocked child must not claim acceptance. Use a supported
permission escalation when available and permitted; otherwise retain the
block and hand off to the authorized parent/Terminal. Do not repeatedly retry
unchanged restrictions or weaken browser security. The previous parent has
already demonstrated that local server and Chrome startup can work.

For a targeted direct browser run, use the existing external Playwright/Chrome
arrangement and a fresh `STZ_SMOKE_ARTIFACT_DIR`; resolve paths in the current
environment and avoid an inherited server from another checkout. Re-run the
complete parent verification on the corrected code. Never replace full
acceptance with a successful isolated diagnostic.

## Documentation and acceptance criteria

Update only relevant Phase 31D portions of `docs/PREVIEW_UI.md` and
`docs/ROADMAP.md` with the actual diagnosis, commands, versions, exit statuses,
checkout/pending-file identity, and retained evidence. Identify the earlier
child `EPERM`, the executed parent assertion, and the new result separately.
Preserve the verified 31B/31C history and keep 31E/31F deferred.

31D is ready for review only when:

- the failing compositing condition has an evidence-supported explanation and
  a minimal fix with a trustworthy independent visual regression;
- the complete browser command exits 0 with `result: "passed"`,
  `stage: "complete"`, an identified browser, all ten groups completed, and
  empty `incompleteGroups`, `unexecuted` and `pageErrors`;
- both inline groups and the real App group have actual observations, not
  merely implemented assertions or historical evidence;
- the parent accepts that complete evidence while rejecting missing or
  malformed evidence, and all required non-browser checks pass;
- no raw data, history, marker/picking, accessibility or existing free-label
  regression is introduced, and documentation matches the observed result.

A child-only handoff, environment block, partial run or passing helper tests
leaves browser acceptance incomplete. Do not mark 31D complete prematurely.

## Report after implementation

Report changed files; which compositing operand failed and its recorded values;
whether the root cause was production rendering, oracle or fixture setup;
the minimal fix and any justified comparison change; negative-control and
full placement/halo results; preserved marker/path/lifecycle/App/export
behavior; preservation of the parent group-validation fix and rejection tests; exact
commands, versions, exit statuses and focused/full counts; evidence paths
and checkout identity; documentation status; and any remaining unavailable or
failing checks. State whether all Phase 31D gates actually passed, or which
results still require the authorized parent's execution and subsequent review.
