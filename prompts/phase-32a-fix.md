# Phase 32A Targeted Fix Prompt: Create the literal oracle Canvas correctly in standalone SVG documents

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect status first and preserve the implementation,
previous source/metric/persistence/locator fixes, verifier correction, fixtures,
tests, documentation, and all user changes, including untracked files. Do not
reset or restart implementation.

The latest parent checked revision `9be2a400f875d5d0d95f9ac9c14f7e3cc673b998`
plus working-tree changes. Its before/after fingerprint was
`2e7adfc033330b2bc09d475b57252a27b2c40f453bb868c1a3413f04a1a99610`.
This matched the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated standalone SVG/XML Canvas-creation mismatch,
affected test-oracle consumers, focused regressions and diagnostics, and further
demonstrated 32A acceptance failures. Keep strict TypeScript and avoid new
dependencies, schema changes, unrelated lint cleanup, or new rendering features.
Preserve shared MathJax/runtime/layout/export behavior and leave 32B-32D deferred.

## Latest execution findings

The native direct/cursor/Inspector/persistence scenario now passes, including
both 2D and 3D. The latest parent next fails while observing literal fallback in
the first downloaded standalone SVG. This is not the child's localhost `EPERM`,
the earlier coordinate-mode locator timeout, or a demonstrated exported-geometry
or source-preservation defect.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-iP6w9K
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and the checkout snapshots;
- `point-native-direct-cursor-workplanes-inspector-persistence.json` and all four
  `point-native-{2,3}d[-standalone].json` downloads;
- `point-native-pending-transparent-edit.svg`, the actual downloaded SVG;
- point export observations through `point-observation-0187.json`, including
  the literal collection error and native-failure diagnostics.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-lqcAeD/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,559 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at standalone literal observation |
| Failure stage | `point-node-settled-export` |
| Native call site | `checkPointNodesApp.mjs:265` |
| Completed groups / passing records | 11 of 15 / 117 |
| Completed point scenarios | 8 of 11 |
| Page errors | Empty; the evaluated observer throws |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The eight completed point scenarios are the previous seven fixture scenarios
plus `point-native-direct-cursor-workplanes-inspector-persistence`. Preserve that
new native pass; do not continue describing 3D input or JSON persistence as wholly
unexecuted. The source and line-metric corrections also remain intact.

`point-native-pending-transparent-edit` started, downloaded its SVG, and reopened
it through `file://`. The file parses as XML with an SVG-namespace root and contains
the captured formula and fallback sources. The observer failed before completing
fallback metrics, geometry assertions, standalone evidence JSON, or PNG capture;
file existence and successful parsing are not acceptance of those checks.

The white export and whole-node fallback scenarios were not reached, nor were
the later general App and settled-export groups. The report still lists four
incomplete groups: `point-node-body-layout-lifecycle`, `point-node-settled-export`,
`real-App-input-JSON-history-reused-ID-load`, and `settled-SVG-export-standalone`.
Keep the reported group completion distinct from individual scenario passes.
The child's 0/15 pre-launch result is separate from this parent run.

## Confirmed immediate cause: HTML Canvas creation assumed an HTML document

`checkPointNodesApp.mjs` opens the saved SVG with:

```js
await standalone.goto(pathToFileURL(svgPath).href)
```

It then calls `observePointLiteral()`, which injects the shared test-only observer
into that page. `inspectPositionedLiteral()` currently executes:

```ts
const context = required(
  document.createElement('canvas').getContext('2d'),
  'Oracle Canvas unavailable',
)
```

The source is `scripts/fixtures/labelBrowserOracle.ts:350`; the stack's anonymous
line refers to the transpiled/injected copy. In an SVG/XML document,
`document.createElement('canvas')` does not create an HTML Canvas element.
The resulting element has no `getContext` method, causing:

```text
page.evaluate: TypeError: document.createElement(...).getContext is not a function
```

The exception occurs before `required()` can check for a null 2D context and before
any baseline/extent comparison. Live App checks used an HTML document, so their
success did not exercise this creation boundary.

The same repository already uses namespace-explicit Canvas creation for standalone
SVG raster observation in `scripts/checkSettledSvgExports.mjs:316`. Use that
established approach with the target node's owner document, for example:

```ts
node.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
```

Keep the Canvas detached and in the same document/font context. The required
namespace is XHTML, not the SVG namespace. Inspect native document/element
properties in the bounded reproduction to retain direct evidence of this cause.
Do not infer that the downloaded SVG or browser Canvas implementation is broken.

## Goal and required reading

Make the independent literal observer obtain a real 2D Canvas context in both
live HTML and standalone SVG/XML pages, without changing the exported document,
font/line-metric contract, or acceptance strength. Complete fresh native export
verification after the correction.

Read `AGENTS.md`, `prompts/phase-32a-implement.md`,
`prompts/phase-32a-review.md`, `docs/PHASE_32A_IMPLEMENTATION.md`, and:

- `scripts/fixtures/labelBrowserOracle.ts`,
  `scripts/fixtures/positionedLiteralAssertions.ts`, and `scripts/pointLiteralOracle.mjs`;
- `scripts/checkPointNodesApp.mjs`, `scripts/pointCheckDiagnostics.mjs`,
  `scripts/checkSettledSvgExports.mjs`, and `scripts/standaloneSvgCapture.mjs`;
- `tests/scripts/pointLiteralMetrics.test.ts`, existing point oracle/diagnostic
  tests, fixture TypeScript settings, `package.json`, and verifier requirements.

## 1. Correct document-aware Canvas creation and error handling

Create an HTML Canvas explicitly through the observed node's `ownerDocument`,
with the XHTML namespace. Keep strict types and check the resulting Canvas
capability and 2D context; report unsupported/missing capabilities clearly instead
of making an unchecked method call or silently returning placeholder metrics.

The measurement Canvas must remain detached. Do not insert a body, canvas,
foreignObject, stylesheet, or script element into the downloaded SVG, wrap it in
an HTML page, measure with a separate App document's fonts, or replace the native
SVG observation with a PNG. Retain the existing direct `file://` reopen workflow
and its request/sanitization checks.

Continue using explicit computed font longhands and effective Canvas configuration,
font-line boxes plus per-line ink expansion, native SVG whitespace advances,
current-source fragments, baseline/centering/bounds, and containment checks.
Do not switch back to SVG `Mg` bounds for line height, widen tolerances, or import
production layout output to manufacture expected values.

Audit related DOM creation in the shared injected observer for HTML-document
assumptions. The other `createElement('canvas')` in `inspectLabelContent()` is
currently used by the live HTML oracle; determine actual affected consumers and
keep any shared correction small. This failure alone does not justify changing
production `labelMetrics.ts` or unrelated browser code.

## 2. Test the actual document/Canvas creation boundary

Existing `pointLiteralMetrics.test.ts` supplies Canvas metric callbacks and
configuration test doubles; it does not exercise DOM Canvas creation. Retain
those tests and cover the missing boundary.

Add focused checks for correct namespace, owner document, detached state, and
usable 2D context. If a helper is introduced, cover missing `getContext` or null
context with clear failures. A type assertion or permissive mock alone cannot
prove that a real SVG/XML document produces an HTMLCanvasElement.

Obtain browser coverage using the same observer in the live HTML App and in an
actual saved SVG opened as a top-level `file://` document. An inline SVG under
HTML, `page.setContent()` with HTML, or only a detached DOMParser document is not
an equivalent replacement for the failed workflow. Reuse the saved failing SVG
for a bounded diagnosis, then run the real current-tree export scenarios.

Check that the observer leaves the exported document unchanged after temporary
SVG probes are cleaned up. Preserve exact visible text/whitespace, XML newline
normalization, font identity, baseline and extent checks, and existing corruption
controls. Test both transparent and white export workflows; do not reduce the
fixture to a single simple line to avoid fallback whitespace coverage.

## 3. Save standalone document diagnostics before metrics can throw

The current collection wrapper preserves the primary error, but its error record
lacks the standalone document/Canvas context. Record URL, content type, root
local name/namespace, relevant body/font properties, created Canvas namespace and
interface/capabilities, owner-document identity, connection state, and 2D-context
availability before the metric call or in a bounded failure path.

Capture these details from the standalone page before it is closed. Existing
native App setup diagnostics alone cannot describe its XML document. Preserve
the saved SVG path and original error if observation, evidence writing, capture,
or cleanup fails. Never turn diagnostic collection into an additional unbounded
screenshot wait or count it as a passing scenario.

## 4. Preserve previous fixes and complete the remaining acceptance

Retain the native coordinate-mode locator fix and state/coordinate assertions,
2D/3D direct/cursor/work-plane/Inspector/history coverage, and both modes' JSON
persistence checks. Keep model-only `state().json`, independently observed UI
metadata, strict save/reload assertions, and restored controls.

Finish `point-native-pending-transparent-edit`,
`point-native-pending-white-load`, and `point-whole-node-fallback-opacity-validation`,
then the remaining general App/settled-export groups. Preserve source/history
isolation, current captured-source export semantics, contour/opacity validation,
external-resource checks, required standalone JSON/PNG artifacts, bounded capture,
and the corrected sanitized-SVG verifier policy.

If additional failures are demonstrated after Canvas collection works, retain
their evidence and fix only the specific 32A issue. Do not weaken the assertions
or broaden into 32B-32D to obtain a pass.

## Verification and completion

Run focused regressions, applicable script syntax, strict fixture TypeScript,
and targeted lint, then:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

The browser-capable parent/Terminal must obtain fresh verification on the final
corrected checkout, including untracked files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Keep all fifteen groups, eleven named point scenarios, required artifacts,
checkout matching, fresh verifier process, and pre-review/commit failure gates.
Do not lower counts, skip checks, weaken sandboxing, or rewrite historical failure
evidence. If child browser startup is restricted, run available checks and provide
an exact handoff; parent browser acceptance remains required.

A standalone `verify` run does not perform independent review. After accepted
complete verification, review the exact matching checkout against
`prompts/phase-32a-review.md`. Do not recursively launch implementation/fix from
the fix child. Update `docs/PHASE_32A_IMPLEMENTATION.md` and relevant completion
documentation with actual native results and remaining gates.

## Report after fixing

Report the observed HTML/XML document difference, Canvas creation/capability
correction, affected consumers, collection-boundary regressions, preserved metric
assertions, document-context diagnostics, changed files, actual check results,
and fresh parent scenario/artifact results with checkout identity. Separate prior
fixes, child `EPERM`, this parent standalone observer failure, subsequent native
acceptance, and independent review. Keep 32A pending until its gates pass and
leave 32B-32D outside this fix.
