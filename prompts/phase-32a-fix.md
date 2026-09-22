# Phase 32A Targeted Fix Prompt: Correct native point literal line-metric expectations

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect status first and preserve the implementation,
previous oracle correction, fixtures, tests, documentation, and all user changes,
including untracked files. Do not reset to an earlier revision or restart implementation.

The latest parent checked revision `ad10fe2866c5bc69cf6ec88bc981a48ce127e70f`
plus working-tree changes. Its before/after fingerprint was
`6bc7f77ac305194a1cde6557f21b8c3d33cd32852d3f2ed4eafc50c542d068df`.
This matched the inspected checkout before this prompt update. The prompt itself
changes checkout identity; obtain fresh evidence for the eventual corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated native point literal line-metric mismatch,
affected oracle consumers, focused regressions, useful diagnostics, and further
demonstrated 32A acceptance failures. Preserve strict TypeScript and the shared
MathJax/runtime/layout/export design. No new dependency, schema, paint model,
shape feature, or unrelated lint cleanup is needed. Keep 32B-32D deferred.

## Latest execution findings

The previous fix separated exact source identity from visible fragments and
positioned whitespace, added negative controls, and saved observations before
assertions. That correction is present. The latest parent now passes seven point
scenarios before failing in native Inspector editing. Do not reapply the old
concatenated-text fix or describe this parent failure as localhost `EPERM`.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-ni1bPs
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and the latter
check's `artifacts/free-labels-evidence.json`, `point-observation-0127.json`,
preceding observations, and checkout snapshots. Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-7wjjNZ/response.json
```

| Observation | Actual parent result |
| --- | --- |
| Node / browser | Node v26.9.0 / Chrome 153.0.8010.53 |
| Fixture | Vite development fixture using production components, port 5174 |
| Checkout before/after | Same fingerprint |
| `npm test` | Exit 0; 2,485 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at native Inspector fallback assertion |
| Failure stage | `point-node-native-input` |
| Completed groups / passing records | 11 of 15 / 116 |
| Completed point scenarios | 7 of 11 |
| Page errors | Empty |
| Independent review | Not reached |

Completed point scenarios:

- `point-language-shapes-2d-3d`
- `point-valid-invalid-valid-exact-source`
- `point-A-B-C-delete-duplicate-history-load`
- `point-resource-retry-font-readiness`
- `point-contour-boundaries-cycling`
- `point-camera-pan-zoom-drag`
- `point-hidden-filtered-locked-dimmed-siblings`

The native direct/cursor/Inspector/persistence scenario started but did not finish.
The three point export scenarios and the later general App/settled-export groups
were not executed. Four groups remain incomplete:
`point-node-body-layout-lifecycle`, `point-node-settled-export`,
`real-App-input-JSON-history-reused-ID-load`, and `settled-SVG-export-standalone`.
Keep this partial success distinct from complete acceptance.

## Confirmed immediate cause and diagnostic limits

The current source entered through the actual Inspector is:

```js
const invalid = '  $\\missingNativePoint$\t\n tail  '
```

`checkPointNodesApp.mjs:87` calls `assertPositionedLiteral()`. The assertion at
`scripts/fixtures/positionedLiteralAssertions.ts:36` reports:

```text
Positioned literal: fragment 1 tab/line position
```

In `point-observation-0127.json`, fragment 1 is the second physical line,
`' tail  '`. Its x position is correct; the disagreement is vertical:

| Measurement in SVG local units | Observed value |
| --- | --- |
| Actual second-line y | 16.399999618530273 |
| Actual transformed baseline | 16.39999961853027 |
| Oracle expected y | 15.81269874572754 |
| Absolute y difference | 0.587300872802734 |
| Current position tolerance | 0.5 |
| Oracle SVG probe ascent / descent | 10.661375999450684 / 2.7513227462768555 |
| Font size / extra line gap | 12 / 2.4 |
| Published layout height | 30.4 |
| Oracle expected layout height | 29.225397491455077 |

The saved model source, source attribute, title, and request identity retain the
exact input. The two visible fragments have the expected text and no compiled
math remains. Replaying the saved observation through the current assertion
reproduces the error without launching a browser. This replay is diagnostic,
not new native acceptance.

The oracle and production use different vertical metric contracts:

1. `inspectPositionedLiteral()` in `scripts/fixtures/labelBrowserOracle.ts`
   measures an SVG clone containing `Mg` with `getBBox()`, treats this box as the
   line ascent/descent for every line, and adds `fontSize * .2`. Here the resulting
   baseline is `10.661375999450684 + 2.7513227462768555 + 2.4`.
2. `createBrowserTextMeasurementProvider()` in
   `src/rendering/labels/labelMetrics.ts` initializes line metrics from Canvas
   `fontBoundingBoxAscent`/`fontBoundingBoxDescent`, with actual-ink fallbacks.
   Each line also accommodates measured fragment ink. `composeLabelLayout()`
   advances by the previous line's descent, the line gap, and the next line's
   ascent. These layout metrics need not equal the native SVG `Mg` box.
3. Earlier isolated-fixture observations, for example
   `point-observation-0003.json`, show SVG ascent/descent 11/3. The native App
   observation instead shows the values above. Identical CSS family/size alone
   does not establish identical measurements in these contexts.

The evidence establishes this inconsistent expectation. It does not capture
the App's Canvas measurements directly or conclusively identify why the native
SVG box differs between contexts. Confirm font/transform/viewport effects in a
bounded reproduction before attributing the discrepancy specifically to browser
scaling, hinting, or font substitution. Do not claim a production defect or
universal production correctness from these partial observations.

Increasing the fragment tolerance alone is insufficient: the current height
expectation also differs by about 1.1746, exceeding its separate tolerance of 1.
Baseline, line extent, centering, and whitespace bounds need one justified
layout-metric contract, with native SVG containment checked separately.

## Goal and required reading

Correct the independent acceptance oracle so it verifies the intended line
layout in actual App and standalone SVG contexts, while still detecting wrong
text, whitespace, baselines, transforms, and bounds. Preserve the existing
source/visual separation and obtain fresh complete parent verification.

Read `AGENTS.md`, `prompts/phase-32a-implement.md`,
`prompts/phase-32a-review.md`, `docs/PHASE_32A_IMPLEMENTATION.md`, and:

- `scripts/fixtures/labelBrowserOracle.ts`,
  `scripts/fixtures/positionedLiteralAssertions.ts`, `scripts/pointLiteralOracle.mjs`;
- `scripts/checkPointNodes.mjs`, `scripts/checkPointNodesApp.mjs`,
  `scripts/pointCheckDiagnostics.mjs`, and the integration in `scripts/checkFreeLabels.mjs`;
- `src/rendering/labels/labelMetrics.ts`, `src/rendering/labels/svgLabelLayout.ts`,
  `src/rendering/svgLabelView.ts`, and the point layout/view/runtime;
- `tests/scripts/pointLiteralOracle.test.ts`,
  `tests/scripts/pointCheckDiagnostics.test.mjs`, existing measurement tests,
  `scripts/automation/phase-verification.mjs`, and `package.json`.

## 1. Reproduce the metric disagreement in its actual context

Use the exact invalid input through the existing native Inspector workflow.
Retain the App CSS, font readiness, SVG viewBox, relevant transforms, and viewport.
Compare with the isolated renderer fixture and the reopened standalone SVG.
Record before assertions:

- computed font longhands, readiness, font identity, and the effective Canvas
  font configuration; never rely on an empty computed `font` shorthand;
- independently measured Canvas font and fragment ink metrics, SVG `Mg` and
  fragment bounds, native space-prefix advances, and the chosen line metrics;
- SVG viewBox, viewport dimensions, relevant CTMs, device pixel ratio, actual
  fragment coordinates, independently expected coordinates, deltas, and tolerances.

Separate local layout units from screen pixels. Preserve primary errors and
pre-assertion diagnostic files if reproduction or capture fails. If a child
cannot launch the browser, report the limit and hand off the exact reproduction
to the parent; do not replace the existing workflow with an easier fixture.

## 2. Correct the complete line-layout expectation coherently

Use a documented, independently measured font-line contract for baseline and
logical bounds. Where matching the established Canvas line-box contract is
appropriate, construct the measurement explicitly from actual font properties
and verify its effective configuration. Keep native SVG measurements for visible
fragment geometry, actual whitespace advances, and foreground containment.

Account for per-line ink expansion, previous descent plus next ascent, explicit
line gap, empty lines, whitespace-only lines, and CRLF as one break. Do not assume
all lines have the same metrics merely because the reported ASCII case does.
Update baseline, extent, centering, and published-height expectations together.

Keep expectations independent from production layout output: do not import the
production composer/provider to compute expected results, copy actual x/y or
published bounds into expectations, or hardcode 16.4, 11/3, or the reported font.
Do not broadly increase tolerances, remove height checks, drop the failing input,
or alter production geometry solely to satisfy the current SVG-box assumption.
If independent native evidence demonstrates a production error, fix that specific
error with a regression and distinguish it from the oracle correction.

Apply the corrected contract across pending/resource fallback, language matrix,
recovery, native Inspector/history, and reopened standalone point fallbacks.
Preserve exact model/editor/JSON/TikZ text, XML normalization handling, contour
and body request identity, current-source fallback, and visibility/dimming checks.
Sanitized standalone SVG must remain testable without live-App CSS, internal
request attributes, or injected styles that conceal an export defect.

## 3. Add regressions at the metric collection boundary

The current SSR oracle tests use synthetic matching font metrics and manually
constructed expectations. They establish text/position checks but do not exercise
the native SVG-versus-Canvas measurement disagreement. Retain those tests and
add focused coverage of the corrected expectation collection/calculation.

Cover representative cases with differing SVG/font boxes, the exact native
Inspector source, multiple physical lines, empty/whitespace lines, LF/CRLF/CR,
tabs at line boundaries, and fragments whose ink changes individual line metrics.
Exercise the real App with a nonidentity viewport transform and a reopened export;
retain both 2D and 3D native workflows. A full Cartesian product is unnecessary.

Preserve the negative controls for missing/stale text, changed edge spaces,
collapsed tabs/lines, transforms, and damaged bounds. Add a displaced-line control
that stays within the old enclosing bounds but violates the declared baseline
contract, so containment alone cannot make incorrect positioning pass.
Register tests in `package.json`; keep browser observations necessary for claims
about actual fonts and transforms.

## 4. Retain useful diagnostics and finish the remaining workflows

Preserve point-specific stages, observations before assertions, honest
incomplete/unexecuted accounting, and primary-error handling. Improve the current
combined "tab/line position" error to identify the differing axis/metric and
actual/expected values. Mark a scenario passed only after all assertions succeed.

Finish native Inspector valid-invalid-valid editing, undo/redo, direct/cursor
creation and work planes, persistence, both pending transparent/white exports,
standalone reopen, and whole-node fallback validation. Preserve the seven
historical point passes and the previous Phase 31 regressions; rerun them on the
corrected tree. Keep source/history isolation, contour corruption controls,
native SVG capture limits, and visibility/opacity assertions intact.

## Verification and completion

Run focused regressions, script syntax, strict fixture TypeScript, and targeted
lint, then:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

The browser-capable parent/Terminal must run fresh verification on the final
corrected checkout, including untracked files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Keep all fifteen groups, eleven named point scenarios and required artifacts,
checkout matching, fresh verifier process, and pre-review/commit failure gates.
Do not lower counts, skip required checks, weaken sandboxing, or rewrite the
historical failed report to obtain a pass. If child browser startup is restricted,
run available checks and provide an exact handoff; parent acceptance remains required.

A standalone `verify` run does not perform independent review. After complete
accepted verification, review the exact matching checkout against
`prompts/phase-32a-review.md`. Do not recursively launch implementation/fix from
the fix child. Update `docs/PHASE_32A_IMPLEMENTATION.md` and relevant completion
documentation with observed causes, actual commands/results, and remaining gates.

## Report after fixing

Report the measured discrepancy, how the corrected metric contract retains an
independent oracle, affected consumers, regressions/negative controls, diagnostic
improvements, changed files, focused/full check results, and fresh parent
scenario/artifact results with checkout identity. Separate the earlier source
oracle correction, child `EPERM`, this parent native metric failure, subsequent
verification, and independent review. Keep 32A pending until its gates pass;
leave 32B-32D outside this fix.
