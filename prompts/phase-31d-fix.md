# Phase 31D Targeted Fix Prompt: Diagnose inline-label halo pixels and complete browser acceptance

## Environment

Work on the current `phase/31d-tex-path-inline-labels` checkout. Preserve the
pending Phase 31D implementation, browser fixtures, tests, documentation and
all user changes. Do not reset the branch, restore the historical base, or
rerun the original implementation from scratch.

The failing parent run used revision
`df37d4f2887dc7b40b9eb7df91b113cd9e35062e` plus a working-tree implementation.
Its tracked diff SHA-256 was
`79a9ab2cdea4fc276fe4e80d04f454a0b901144634b4e81717371fcf5e51bbad`.
These required files were untracked and must not be omitted:

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

The supplied report is an implementation run stopped by **parent verification
before review**, not a completed review with severity counts. Do not invent
review findings, a `REVIEW_JSON` result, or approval to commit.

### Historical child attempt: server startup was blocked

The implementation child reported `EPERM` during local-server startup and
retained `/private/tmp/stz-phase31d-browser-final/free-labels-evidence.json`.
That attempt did not provide actual browser acceptance. The later authorized
parent run below launched Chrome and supersedes the startup restriction as
the current failure. Do not describe this failure as a sandbox configuration
problem or change permissions to make an assertion pass.

### Current failure: inline-label halo compositing assertion

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-gRWdxT
```

Read `verification.json`, `05-check-free-labels/command.log`, and
`05-check-free-labels/artifacts/free-labels-evidence.json`, `failure.png`,
`checkout.diff`, and `checkout-untracked.json` within that directory.

The run used Node v26.9.0 and Chrome `153.0.8010.52`, with the Vite development
fixture at `http://127.0.0.1:5174`. It reached
`inline-node-production-rendering-and-path-lifecycle` and exited 1 at
`scripts/checkInlineLabels.mjs:114`:

```text
AssertionError [ERR_ASSERTION]: Antialiased glyph pixels equal independent
foreground-over-halo compositing within byte rounding
```

The actual condition is:

```js
raster.compositeCompared > raster.dark && raster.maxCompositeError <= 2
```

The saved evidence does not contain these failing values. It therefore does
not establish which operand failed, how large the difference was, or whether
the production renderer or the test oracle is wrong. Do not assume this is
another confirmed 31C-style oracle defect, or declare a production halo defect
from the assertion message alone.

The loop starts with placement `above`, zoom `1`, and the mixed source:

```text
日本語 $\frac{O_1}{1+\frac{a}{b}}$ and $g^2$
```

The preceding placement/native-bounds/accessibility assertions and the solid
inner-glyph assertion returned successfully for that first case. The failure
precedes its PNG writes and placement evidence record. The initial inline
valid/mixed/ordinary/Japanese/whole-source-fallback scenario passed; the full
placement/halo matrix did not.

Seven of the ten required groups completed. The current inline rendering,
placement, halo and picking group started but did not complete. These groups
were not executed:

- `inline-node-lifecycle-path-operations-export`;
- `real-App-input-JSON-history-reused-ID-load`.

The report contains 75 passing scenario records and no uncaught `pageErrors`;
neither fact establishes overall acceptance. Parent test, build, diff check
and `check:label-assets` passed. The implementation reported 2,312 passing
Node tests, strict fixture TypeScript, targeted lint and syntax checks. These
are previous results, not new verification of the fix. The nonblocking build
size warning and reported existing `SvgDiagram` lint debt are separate.

### Additional code-supported acceptance-gate mismatch

The current `scripts/checkFreeLabels.mjs` requires ten completed groups, but
`scripts/automation/phase-verification.mjs` still requires exactly the eight
31C group names in `validateBrowserEvidence`. A successful ten-group browser
run would consequently be rejected by the parent. This is a concrete code
inconsistency found while preparing this prompt; the attached failed run did
not reach that validator after a successful browser command.

Resolve this narrow mismatch as part of completing 31D. Do not weaken the
parent's evidence, exit-status, or checkout-identity checks.

## Goal

Identify and minimally fix the demonstrated halo assertion failure, retain
independent visual and interaction coverage, reconcile the parent evidence
gate with the extended harness, and obtain a complete authorized 31D
verification result for the exact corrected checkout.

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

## 1. Preserve failing-case diagnostics before asserting

The inline harness currently saves raster images and calls `record` after
its pixel assertions. Extend its diagnostic path so an assertion cannot erase
the evidence needed to explain it. Reuse the existing started/checkpoint/
diagnostic convention; diagnostic observations must not count as passes.

Before asserting each halo case, retain:

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

Split the compound assertion or include each operand's values in its error.
Ensure failure identifies the precise placement/zoom and assertion. Keep
diagnostic work bounded and clean up temporary clones/resources in `finally`.
Do not mark the group complete until all of its assertions return.

## 2. Diagnose compositing and apply the smallest justified fix

Reproduce the first failure with the actual production component and browser.
Compare the native painted label with the isolated foreground/halo/composite
rasters and trace the first differing pixels. Investigate, without assuming
the answer:

- straight-alpha versus premultiplied-alpha calculations and the information
  lost when separately rasterized layers are read back as 8-bit Canvas pixels;
- intermediate rounding, low-alpha color reconstruction and whether the
  existing two-byte comparison is valid for the chosen measurement method;
- inherited styles/fonts/colors, group opacity and isolation, serialization,
  viewBox alignment and nested transforms in the cloned SVGs;
- actual foreground/halo order, transparent paint, stroke scaling and formula
  geometry in `SvgTexLabel`.

These are investigation directions, not diagnosed causes. Support the chosen
fix with saved numeric and visual evidence. If the oracle is incorrect, fix
the oracle without adjusting production paint to match it. If the product
violates the white-halo contract, make a targeted renderer correction and
demonstrate that it fixes the visible failure.

Keep the current tolerance unless a measured numerical analysis shows it is
invalid. Do not merely raise `2`, drop partially transparent pixels, replace
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

## 3. Reconcile the parent verification contract

Make the parent validate the actual required group names for the requested
phase. Preserve the eight free-label groups and require both inline groups
for 31D and subsequent phases that already inherit this verification. Use a
small shared definition or explicit phase-aware required/allowed sets; do not
trust a browser report to define its own acceptance requirements.

Keep 31C's existing eight-group evidence validation supported, and explicitly
handle the shared harness's now-complete ten-group output when run for 31C.
Legitimate added groups must not make a complete current run fail solely on
the old length check. Conversely, 31D must never accept only the old eight.

Add behavioral helper/runner regressions for:

- valid 31C evidence and valid complete ten-group 31D evidence;
- the chosen 31C handling of the extended shared harness;
- 31D evidence missing both inline groups, and each inline group individually;
- duplicate/unsupported group names, incomplete/unexecuted groups and browser
  errors, even when the command exits 0 and claims `passed`;
- preservation of 31B verification and checkout-change rejection.

Do not change the child sandbox flags, bypass parent verification, or mark a
nonzero browser command as accepted. Do not modify commit/push behavior.

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
behavior; the parent group-validation correction and rejection tests; exact
commands, versions, exit statuses and focused/full counts; evidence paths
and checkout identity; documentation status; and any remaining unavailable or
failing checks. State whether all Phase 31D gates actually passed, or which
results still require the authorized parent's execution and subsequent review.
