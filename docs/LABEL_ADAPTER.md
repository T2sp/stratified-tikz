# Phase 31B label conversion service

The independent adapter is implemented in `src/rendering/labels/`. It is not
connected to the production canvas, picking, React lifecycle, or SVG export.
Phase 31A's [input contract](./PREVIEW_UI.md#label-preview-input-contract-phase-31a)
remains authoritative. Phase 31B is **not yet acceptance-complete**. The targeted
ink-bounds fix and real-engine regressions are implemented, but built-browser
deployment and standalone raster verification still require an environment that
permits localhost and Chrome. See the actual verification status below.

## Dependencies and local assets

The selected exact packages are `@mathjax/src@4.1.3` and
`@mathjax/mathjax-newcm-font@4.1.3`. MathJax supplies mathematical layout and SVG
glyph geometry; New Computer Modern supplies the corresponding SVG font data.
There is no second renderer or TeX distribution. Direct modules permit an
explicit extension set and fresh parser/document state. The code uses the v4
`MathDocument.convertPromise` API, not v3 synchronous conversion or a browser
global `MathJax.tex2svg` configuration. See the official
[direct module API](https://docs.mathjax.org/en/latest/server/direct.html) and
[asynchronous conversion documentation](https://docs.mathjax.org/en/latest/web/convert.html).

`npm run dev`, `npm run build`, and `npm test` first run
`scripts/prepareMathjaxAssets.mjs`. It verifies both installed package versions,
sorts all NewCM SVG dynamic-data module names, generates an explicit import map
in `src/rendering/labels/mathjaxFontImports.generated.ts`, and copies upstream
license files into `public/mathjax-licenses/`. Both outputs are derived and
ignored by Git. An incomplete installation fails preparation; it never silently
omits font ranges. The lockfile must be updated by installing the pinned packages.

Vite sees every possible font import and emits hashed local chunks. No runtime
URL string is assumed to enter its asset graph. The engine module is a dynamic
import reached only for mathematical input; individual extra font ranges are
also dynamic imports. Only a finite package-generated import map can satisfy a
font request. There is no CDN loader, arbitrary script injection, runtime
`require`, or external font URL. SVG uses paths, so no browser math font binaries
are needed. Assets follow the configured `/stratified-tikz/` base in development
and production. Licenses are served below
`/stratified-tikz/mathjax-licenses/`. This follows
[Vite's asset graph and base-path handling](https://vite.dev/guide/assets.html)
and MathJax's [local-hosting guidance](https://docs.mathjax.org/en/latest/web/hosting.html).

Until Phase 31C imports the adapter, Vite builds it as a separate `labelAdapter`
entry with preserved exports and a manifest. The application entry does not
load it. This makes the real deployable asset graph independently testable
without changing existing label rendering.

## Public boundary for Phase 31C

`createLabelService({ measurement })` returns `convert(source, settings)`,
`invalidate()`, a live `generation`, `configurationIdentity`, and diagnostic
`stats()`. `convert` accepts the exact original string and a readonly
`LabelLayoutSettings`; it copies the settings at invocation. It returns a
`Promise<LabelConversionResult>`:

- `kind: 'success'`: original `source`, ordered `ConvertedLabelRun` values,
  immutable `layout`, unique `identity`, `generation`, and configuration identity.
  Each math run has validated `MathSvgGeometry`; text is still text data.
- `kind: 'fallback'`: original `source` unchanged, the same identity fields,
  and an internal `reason`. No earlier successful run geometry survives failure.

The internal reasons distinguish parser `invalid-delimiter`, `unsupported-text`,
work `limit`, `unsupported-input`, `tex-error`, `output-error`, `resource-error`,
`invalid-metrics`, and `timeout`. Diagnostics go only to an optional development
callback. A throwing diagnostic observer cannot change the visible result.

The future consumer must display its latest original source while pending or
failed, as ordinary text with preserved whitespace and physical newlines. It
must compare its own current input/document revision and service generation
before accepting a completion. Service identities do not replace that consumer
check. No React subscription, label ID, diagram reference, placement, selection,
history entry, or persisted derived state is introduced here.

`createBrowserTextMeasurementProvider()` provides actual canvas text metrics and
font readiness. A deterministic `TextMeasurementProvider` can be supplied for
unit tests. `paintMathSvg(geometry, foreground)` creates a reusable immutable
typed SVG tree; `serializeMathSvg` serializes that tree with XML escaping. These
helpers resolve controlled foreground paint without another TeX conversion.
They do not implement full-diagram export.

## Supported mathematics and isolation

Only `base`, `ams`, and `color` are configured. Inline/display style comes from
the Phase 31A run, and only its unchanged `tex` body is converted. Display style
does not add a paragraph break or page margins. Fractions, radicals, indices,
integrals, and AMS matrices are intended fixtures. Physical newlines inside a
formula remain part of that single conversion.

Definitions, user macro/environment/array-column changes, tags, references, counters,
document/preamble commands, `require`, autoload, URL/HTML commands, external
resources, and custom color definitions are rejected. Unknown commands fail
through TeX. `noerrors` and `noundefined` are absent. `\color` and `\textcolor`
can use supported named/numeric colors, subject to narrow SVG paint validation.
Ordinary Unicode outside math stays measured SVG text. A math glyph that
MathJax would emit as font-dependent `<text>` is rejected because the headless
adaptor cannot establish its actual glyph bounds; the entire source then falls
back. Arbitrary packages and full text-mode LaTeX remain unsupported.

Every whole-label conversion creates fresh TeX, SVG, document, and font-instance
state. Only module code and immutable font data are shared. Scoped `formatError`,
`compileError`, and `typesetError` hooks capture failures. Direct conversion's
render stages forward non-retry exceptions through those hooks. The MathML tree
and SVG output are also inspected for error nodes before metadata removal. A
resolved Promise alone cannot establish success. See the official
[error-hook documentation](https://docs.mathjax.org/en/latest/web/errors.html).

MathJax 4.1.3 exposes the expansion option with the spelling
`maxTemplateSubtitutions`; the adapter uses that version-specific spelling.
Its `TexError` values are plain objects, so work-limit failures are classified
by the installed version's error IDs, independently of syntax-error wording.
A per-conversion bounded column parser checks `*{N}{...}` array repetition
before MathJax allocates the expanded template. Per-parser AMS environment
handlers bound `alignat`/`alignedat` and related alignment counts before their
synchronous loops, while retaining ordinary small alignments. `\newcolumntype` and
`\mmlToken` are outside the supported language.
Its font subclass loads only approved local modules and performs setup on each
isolated font instance. It avoids MathJax's shared sticky failure flag, allowing
a rejected font request to be retried without contaminating another label.

## Units, baselines, and SVG portability

All layout coordinates are em. The first alphabetic baseline is `y = 0`, with
positive y downward. SVG coordinates use 1,000 user units per em. MathJax's
nominal `viewBox` is a **layout box, not an ink bound**: overlapping glyphs,
smashed heights, negative spacing, ordinary glyph overhang, and glyph strokes
can exceed it. The original review reproduced incorrect bounds through the
production adapter; clipping was supported by inspection, not observed in a
browser. The fix does not rely on `overflow: visible` or page CSS.

The transient engine result now includes `advanceWidth` in em. An isolated SVG
subclass captures MathJax 4.1.3's `createSVG(h, d, w)` argument `w` before its
minimum viewport clamp to 0.016em. `MathSvgGeometry.metrics.width` is this true
logical advance, including zero; it is never replaced by expanded ink width.
Only the standalone SVG validator's optional advance argument defaults to the
nominal width for synthetic callers. The production service requires a finite
engine advance and never uses that default.

After narrow SVG validation and stylesheet resolution, `labelInkBounds.ts`
traverses the retained geometry. It encloses absolute `M/L/H/V/C/Q/Z` path
endpoints and Bézier control hulls, rectangles, lines, polygons and polylines,
under nested `translate` and `scale` transforms (including negative scales).
The convex-hull property guarantees containment; these are conservative bounds,
not a claim to minimal ink rectangles. The inherited stroke width expands each
shape by a proven stroke envelope: at most four half-widths for the fixed SVG
miter limit of 4, also covering the admitted cap/join styles and dashes. See
[SVG stroke joins and miter limits](https://www.w3.org/TR/SVG2/painting.html#StrokeMiterlimitProperty).
Transparent paint may conservatively enlarge bounds; no geometry is deleted.
Traversal/tokenization is linear within existing node/depth/payload budgets,
with at most six path operands retained. This is not a general SVG renderer.

The portable viewport is the union of measured ink, the nominal box, the
logical advance interval, and baseline zero. It obeys the existing 10,000em
per-formula extent limit. Its original horizontal enclosure is exposed as
`metrics.inkLeft` / `metrics.inkRight`; ascent/descent cover the full vertical
interval about baseline zero. Normalization translates the children once by
`offsetX = -inkLeft`, and gives `viewBox` a zero left edge. SVG width/height come
from this enclosure, not the advance or external em/ex dimensions.

For a placement `(x, baseline)`, put the normalized SVG at
`(x - geometry.offsetX, baseline - geometry.metrics.ascent)`, with dimensions
`viewBox[2] / 1000` and `viewBox[3] / 1000` em. The next run begins at
`x + geometry.metrics.width`. Do not translate the children again or use the
viewport width to advance. Whole-label bounds include both signed ink sides;
line baselines use enclosed ascent/descent. Final label scaling is applied once.
Empty math has zero advance; its valid minimum MathJax viewport is retained.

| Construct | Policy |
| --- | --- |
| `\rlap`, `\llap`, `\smash` (including indices/descenders and nested uses) | Supported via retained geometry enclosure, preserving true advance. |
| `\!`, `\kern`, `\mkern`, `\hspace` with negative spacing, including grouped/nested and trailing forms | Supported when the resulting whole math-run advance is nonnegative; actual translated ink is measured. |
| Any negative whole-run advance, e.g. `\kern-1em x`, trailing `x\kern-1em`, or negative spacing alone | Exact complete-source `invalid-metrics` fallback; backwards run advances are outside this adapter contract. Detected from actual engine output, independent of source spelling/nesting. |
| Relative/smooth/arc paths, rotation/skew/matrix transforms, root viewport transforms, or other unhandled effects | Exact complete-source `output-error` fallback, even when hidden by paint/opacity. |
| Fractions, radicals, indices, matrices/rules, ordinary spacing and multiline text/math | Supported; existing parser, resources, work limits and isolation still apply. |

Any rejected later run discards all earlier geometry. Fallback retains the exact
whole source including delimiters, spaces, tabs and physical newlines; later
valid requests remain usable. No new persisted field or diagram schema exists.

Text measurements use explicit font family, CSS-pixel normalization size,
weight, style, and `fontReadinessGeneration`. Each of these, plus provider
identity, tab size, and line gap, participates in layout caching. Browser
FontFaceSet readiness includes the label's actual ordinary Unicode text.
Canvas glyph overhang contributes to bounds separately from advance width.
Consumers apply their final label/font scaling once to the normalized result.

Spaces are retained in text fragments. Tabs advance to the next multiple of
`tabSize * measured-space-width` from the visual line origin. LF, CR, and CRLF
are explicit newline placements; CRLF is one visual break. Only text-run
newlines split lines. Adjacent lines use their measured ascent/descent and
explicit em line gap, preventing tall formulas from overlapping or clipping.

`fontCache: 'none'` makes each formula self-contained without IDs or references.
Validation permits only the small geometry element/attribute set actually
needed by the configured output. It rejects scripts, HTML, text glyph fallback,
foreignObject, events, IDs, hrefs, arbitrary CSS, and URL-valued paint. It checks
finite numeric values and path syntax. Unknown visible effects fail the entire
label. MathJax's frame/line, dash, and glyph-stroke effects become presentation
attributes before class/data attributes are removed. `currentColor` becomes a
typed foreground token; the final paint helper replaces it with an explicit
approved color and preserves internal formula colors. No page stylesheet is
needed. See [MathJax SVG options](https://docs.mathjax.org/en/latest/options/output/svg.html).
Glyph stroke thickening applies only to glyph paths, as in the installed
MathJax stylesheet. Inner geometry uses numeric user units or px; child em/ex
lengths are rejected to prevent dependence on the embedding page's font.

## Work, cache, timeout, and retry limits

| Boundary | Default finite limit |
| --- | --- |
| Original source / parsed runs | Phase 31A: 16,384 UTF-16 code units / 256 runs |
| Macro expansions / template substitutions | 1,000 each |
| TeX buffer / brace nesting | 16,384 code units / 128 levels |
| Array repetition / column-parser steps / expanded template | 256 repeats / 256 steps / 16,384 code units, checked before repetition allocation |
| AMS alignment pairs (`alignat` family) | 128 pairs, checked before count expansion |
| Intermediate MathML nodes | 12,000 per whole label |
| Engine snapshot nodes / paths / depth | 10,000 / 5,000 per whole label / 128 levels |
| Validated SVG nodes / paths / depth | 10,000 / 5,000 / 128 per formula |
| Engine SVG attribute/text payload | 2,000,000 estimated UTF-16 bytes per whole label |
| Independent SVG validator attribute/text payload | 2,000,000 code units per formula |
| Ink measurement | Existing SVG node/depth/payload budgets; at most six path operands; 10,000em viewport span/coordinate limit |
| Layout fragments / extent | 32,768 fragments / 1,000,000 em |
| Distinct pending public requests | 32 |
| Unsettled underlying work, including retired work | 64 mathematical + 64 plain-text requests |
| Each completed cache | 64 entries and 2 MiB of estimated UTF-16 JSON/key bytes |
| Font-data settlement / service deadline / transient retry delay | 8 seconds / 10 seconds / 1 second |

Limits apply before initialization where possible; synchronous TeX work is
bounded by engine/parser limits, not just a Promise timeout. Two independent
deterministic LRU caches retain neutral geometry and composed label results.
Their combined bound is 128 entries / 4 MiB. Oversize results are returned but
not cached. Cache values contain frozen data, never engine or DOM objects.

Geometry keys contain exact source and complete engine/version/configuration
identity (currently `stz-label-v4-ink`, changed for the advance/ink contract and
bounded geometry policy). Layout keys also contain all font and spacing inputs. Concurrent
identical requests coalesce, including geometry shared across different font
layouts. Position, camera, pan/zoom, selection, opacity, and foreground color are
not conversion inputs. A new font generation recomposes layout using cached
math geometry. Paint-only changes call the paint helper.

On loader/font failure or timeout, the service retires the affected generation,
settles its public requests as complete-source fallbacks, clears its caches, and
permits a replacement initialization after a one-second cooldown. Late work
cannot write replacement caches. `invalidate()` provides an explicit immediate
retry and generation change. Math resource cooldown does not block plain text;
font readiness cooldown applies to all labels requiring that font measurement.
No transient failure is stored as a completed negative cache entry.

JavaScript cannot cancel an arbitrary injected Promise or native module import.
Retired underlying tasks therefore remain counted until they settle; reaching
the finite cap returns a work-limit fallback instead of spawning unlimited
work. Math and plain-text caps are separate so a stalled math loader cannot
disable ordinary text. Once abandoned work settles, slots become available.
Consumers must schedule retries on explicit lifecycle/resource changes, not on
every React render. No worker is required for bounded synchronous TeX expansion.

## Verification and current status

Every new test file is explicitly registered in `npm test`. Tests cover the
actual adapter with the installed engine as well as deterministic error/resource
fixtures; real-engine tests fail, rather than skip, when MathJax is unavailable.

Required commands use Node >=22.12. The targeted fix was verified on
2026-09-20 with Node v26.9.0 using these exact check commands (logs were redirected
to `/private/tmp/stz-phase31b-fix-verification/`):

```sh
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/rendering/labels/labelSvg.ts \
  src/rendering/labels/labelMetrics.ts \
  src/rendering/labels/labelService.ts \
  src/rendering/labels/mathjaxConfig.ts \
  src/rendering/labels/mathjaxEngine.ts \
  src/rendering/labels/mathjaxRuntime.ts \
  src/rendering/labels/labelInkBounds.ts
PATH=/opt/homebrew/bin:$PATH node --check scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/checkLabelAssets.mjs
git diff --check
```

| Check | Actual result |
| --- | --- |
| Six focused files | Exit 0; 81 passed, 0 failed, 0 skipped (`focused.log`) |
| Full `npm test` | Exit 0; 2,237 passed, 0 failed, 0 skipped (`npm-test.log`) |
| Production build | Exit 0 (`build.log`); Vite's non-failing >500kB chunk warnings remain |
| Seven production modules, targeted ESLint | Exit 0 (`lint.log`) |
| Both script syntax checks | Exit 0 each |
| `git diff --check` | Exit 0 |

No test file was added: expanded tests remain in the explicitly enumerated
six files. The real-adapter file has 19 tests. Its independent bounded oracle
solves quadratic/cubic derivative roots for actual path extrema (unlike the
production control hull), includes stroke envelopes and transforms, and checks
portable viewports, signed run extents, offsets and composed label bounds.
Known pinned glyph points also establish the reported left/right/top/bottom
regressions. Coverage includes two lap forms, two smash variants, seven
nonnegative-total negative-spacing forms, three nested/following-content forms,
multiline/tab composition, seven negative-total rejections repeated with exact
entire-source/no-runs/no-layout assertions, and normal fraction/radical/index/
matrix/empty/safe-spacing/color/rule controls. Cache immutability, failure
isolation, parser/resource limits and recovery regressions still pass.

`npm run check:label-assets` invokes `scripts/checkLabelAssets.mjs`. Supply an
installed Playwright through `STZ_PLAYWRIGHT_MODULE` and optionally a Chromium
path through `STZ_BROWSER_EXECUTABLE`. These are verification tools, not new
application dependencies. The script serves `dist` only below the configured
base, reads the adapter entry from the manifest, blocks external network
requests, checks that plain labels do not load MathJax, and requests additional
font data after the initial formula. It also checks exact-source failure and
renders standalone colored SVG without a page stylesheet. It checks accepted
overflow fixtures, zero-advance placement, negative-advance exact fallback and
recovery. A blank-page native `getBBox()` oracle checks viewport and composed
label containment; an enlarged reference image detects pixels lost by clipping
in a standalone SVG image, including strokes. A deliberately cropped real glyph
must fail both oracles. Zero extra font-data requests fail the probe rather than
being reported as asset coverage. The original red/blue counts establish paint
presence only and are retained alongside these stronger containment assertions.

Both pinned 4.1.3 packages remain installed and agree with the lockfile;
no dependency, font version, build configuration or asset preparation changes
were needed. The former review results (2,223 full / 67 focused passing tests)
are superseded by the targeted-fix results above, not used as evidence for the
new bounds. Production canvas/picking/React integration and full-diagram export
waiting remain deferred to later phases.

The built-asset browser smoke was rerun after the fresh successful build with
the cached Playwright and installed Google Chrome:

```sh
PATH=/opt/homebrew/bin:$PATH \
STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
STZ_SMOKE_ARTIFACT_DIR=/private/tmp/stz-label-smoke \
node scripts/checkLabelAssets.mjs
```

It exits **1** at the test server's localhost bind with `listen EPERM: operation
not permitted 127.0.0.1`. Full stderr is in
`/private/tmp/stz-phase31b-fix-verification/browser-smoke.log`. No browser mounting,
lazy initialization, same-origin network/font request, browser fallback/recovery,
or standalone paint/containment assertion ran. These are **unavailable, not
passed**; no SVG/PNG raster artifacts were produced in the requested
`/private/tmp/stz-label-smoke` directory. A separate direct Chrome launch also
exited 1 with a closed-target error, SIGABRT, and cleanup `kill EPERM`; its exact
command and observed error summary are in
`/private/tmp/stz-phase31b-fix-verification/chrome-probe.txt`. No browser security
or network checks were weakened. Run the same smoke in an environment permitting
localhost and Chrome before treating Phase 31B acceptance as complete.

A supplementary static check reads `dist/.vite/manifest.json`, verifies every
entry file and import/dynamic-import reference, compares its dynamic-font
entries with the installed package's `mjs/svg/dynamic/*.js`, and checks the
entry HTML's asset base. The fresh build resolves all **46 manifest entries, 86
references, and 40 dynamic font-data modules**. Local entry URLs use
`/stratified-tikz/`; the pre-existing Google Tag Manager URL is recorded separately
and remains blocked by the smoke's external-network route. Build preparation
preserves upstream licenses. The supplementary command exits 0:

```sh
PATH=/opt/homebrew/bin:$PATH node /private/tmp/stz-phase31b-fix-verification/check-static-assets.mjs
```

The script, `static-assets.log`, and `static-assets.json` are retained in that
verification directory. This is static evidence only and does not substitute
for browser requests or raster verification.

Repository-wide lint was not rerun: the checkout has pre-existing
`react-hooks/refs` debt in unchanged `src/rendering/SvgDiagram.tsx`, outside this
fix. The previously recorded wider baseline was 79 errors and 7 warnings across
24 files; this task does not reassert those counts as a fresh measurement.
Only targeted lint was required and run. No unrelated cleanup was made.
