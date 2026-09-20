# Phase 31B label conversion service

The independent adapter is implemented in `src/rendering/labels/`. It is not
connected to the production canvas, picking, React lifecycle, or SVG export.
Phase 31A's [input contract](./PREVIEW_UI.md#label-preview-input-contract-phase-31a)
remains authoritative. Phase 31B is **not yet acceptance-complete**. The targeted
ink-bounds fix, disposable-worker recovery, and focused regressions are implemented.
Actual native-import recovery, built-browser deployment, and standalone raster
verification still require an environment that permits localhost and Chrome.
See the actual verification status below.

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
URL string is assumed to enter its asset graph. Mathematical input lazily creates
a same-origin ES module Worker, whose dynamic import loads the engine; individual
extra font ranges are also dynamic imports in that Worker. Only a finite package-generated import map can satisfy a
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
without changing existing label rendering. Vite also emits
`.vite/mathjax-worker-manifest.json`, describing every worker chunk, source
module, static dependency, and dynamic import. The deployment check verifies
both graphs and compares their font entries against the pinned installation.

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
isolated font instance. It avoids MathJax's shared sticky failure flag. This
removes an application/library failure cache only: deleting a rejected Promise
or creating another font/document instance does **not** repair a cached native
ES module failure. Browser recovery therefore retires the complete Worker as
described below.

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
| Owned browser execution contexts | At most one live Worker per service; zero after retirement, until another accepted math request |
| Worker transport / worker active conversions | 32 each; no unbounded secondary queue |
| Worker initialization / individual conversion deadline | 10 seconds each, also bounded by the public service deadline |
| Native module identities | One fixed emitted graph per Worker; 40 approved lazy font modules; no query/random retry URLs |

Limits apply before initialization where possible; synchronous TeX work is
bounded by engine/parser limits, not just a Promise timeout. Two independent
deterministic LRU caches retain neutral geometry and composed label results.
Their combined bound is 128 entries / 4 MiB. Oversize results are returned but
not cached. Cache values contain frozen data, never engine or DOM objects.

Geometry keys contain exact source and complete engine/version/configuration
identity (currently `stz-label-v5-worker-ink`, changed for the disposable loading
contract while retaining the advance/ink policy). Layout keys also contain all
font and spacing inputs. Concurrent identical requests coalesce, including
geometry shared across different font
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

### Native module failure recovery and ownership

The former Window runtime import and generated font imports reused fixed native
module identities. On browsers caching failed module downloads, even a later
successful network connection and `invalidate()` could not repair those entries.
An earlier review identified this in the former loader by code inspection,
**not a browser reproduction in this checkout**. The latest review found no
confirmed defect in the current Worker adapter; its remaining Medium issue is
the unverified browser acceptance gate. Chrome's official
[155 beta notes](https://developer.chrome.com/blog/chrome-155-beta#avoid_caching_module_failures)
describe the later native retry behavior change; upgrading Chrome is not the fix.

The production browser loader now creates a dedicated ES module Worker only when
supported math is requested. `mathjaxWorker.ts` dynamically imports
`mathjaxRuntime.ts`; runtime code, shared dependencies, and the finite generated
font map execute in that Worker's global environment and native module map.
The Window loads only the small service/transport/validation code. In the current
build, the worker entry has no static dependencies; runtime depends on the entry
(for shared helpers) and a separate SVG/font-core chunk. That shared chunk and
all font imports belong to the same disposable context. Changing only the entry
URL would leave a poisoned shared dependency; terminating the context retires
**all** of these native identities together.

Runtime import rejection, additional-font rejection, worker errors, or transport
failure reject initialization/conversions as `resource-error`. The service
retires that generation. Both service cancellation and transport deadlines
terminate the Worker, detach its listeners, clear transport timers and pending
records, and reject every affected conversion. No failed module map remains
reachable through a reusable engine. Worker termination also discards queued
execution and ongoing conversion, including synchronous engine work. Browser
network/VM cleanup timing is browser-managed, but no abandoned Worker is retained
for reuse and the old context is terminated before a replacement is created.
There are no extra retry identities, retained context pool, or exhausted lifetime
retry budget. Healthy code/font modules remain reusable in the one current
Worker until a resource failure, deadline, or explicit invalidation.

After access returns, the same public service can retry the same original source
with `invalidate()`, or the next requested conversion after its one-second
cooldown. Neither path reloads the page. A replacement Worker uses the same URLs
with a fresh module map; ordinary HTTP caching of successful resources is safe.
There is no background retry loop. Repeated calls during cooldown do not start
loaders. Explicit invalidation bypasses cooldown intentionally; consumers should
use it for resource/document lifecycle changes, not every render.

Equivalent requests still share a Promise; distinct requests share initialization.
The transport bounds in-flight messages independently of the service limits.
Typed error categories cross the Worker boundary without relying on cloned Error
prototypes. The public service validates and deeply freezes cloned SVG results
before caching them. A later-run failure transfers no partial result: delimiters,
spaces, tabs, LF and CRLF come from the complete original source. Plain labels
never initialize a Worker and remain usable during a math-resource outage.
Scoped TeX state/error capture and all ink/advance validation remain unchanged.

Each service generation supplies an AbortSignal to its loader. Invalidation
before its scheduled initializer runs starts no Worker. Late readiness/results
from a retired context cannot enter the new generation's caches. A custom engine
resolving after retirement is disposed without conversion; a live engine is
released once through its optional idempotent `dispose()` boundary. Use
`invalidate()` when abandoning a service to release its healthy Worker as well.

An arbitrary injected loader/measurement Promise cannot be forcibly cancelled.
Its underlying tasks remain counted until they settle; the existing independent
64-math/64-plain caps prevent unlimited abandoned work. Production worker work
rejects promptly on termination and releases those slots. Node real-engine tests
continue using installed direct modules in a Node-only branch excluded from the
browser asset graph; those tests verify typesetting, not browser native-cache
recovery. The existing font callback fixture deliberately rejects **before** its
native import and remains complementary adapter-level coverage.

## Verification and current status

The latest verification-only follow-up began on **2026-09-20 at 04:06 JST**, against
checkout `ff37dfffad2b5973071a8bffca1b06df4105b234`, on macOS 26.6.2 (25G83),
Darwin arm64. The shell was zsh with `PATH=/opt/homebrew/bin:$PATH`;
`/opt/homebrew/bin/node` reported **v26.9.0**, npm **11.19.1**.
The installed executable reported **Google Chrome 153.0.8010.52** using
`--version`; **no browser launched**, so there is no observed launched-browser
version or native-cache capability result.

The initial working tree was clean. No adapter, test, dependency, build
configuration, or smoke-script change was made. Only this document,
`PREVIEW_UI.md`, and `ROADMAP.md` changed in this follow-up. Preparation and the
fresh build regenerated ignored font imports, licenses, and `dist/` from this
checkout. `environment.json` records tracked code/test/script input SHA-256
hashes; `build-output-sha256.json` identifies the generated assets and build.

Before repeating the previously blocked smoke, a minimal Node HTTP capability
probe tested the same `listen(0, '127.0.0.1')` operation. It exited **1** with
`listen EPERM: operation not permitted 127.0.0.1`. This session again prohibits
escalation, and no permitted alternative execution environment was accessible.
Accordingly, **`npm run check:label-assets` was not rerun** under the unchanged
restriction. Its current exit status is **not available**, not 1, 2, or 0.
The smoke and every assertion remain unchanged. No current runtime or harness
defect was demonstrated; Phase 31B remains acceptance-incomplete.

All current logs and supplemental static inspection are in the fresh directory
`/private/tmp/stz-phase31b-verification-_sohhkx7/`. Its `browser/` subdirectory
remains empty. `environment.json` records paths, permissions, and versions;
`*-result.json` records executed argv, times, environment, log paths, and exits.
`browser-status.json` records the unexecuted smoke and blocking prerequisite.
The external `run-check.py` captures stdout/stderr and preserves child exits;
it does not alter repository scripts. Full probe code/command and the exact error
are in `localhost-capability-result.json` and `localhost-capability.log`.

Historical results remain separate. The prior verification-only attempt at
`138a4e1f621ec35cb9bad10c2192ff2a0c91fba6` ran the unchanged smoke and exited 1
at bind before Chrome launched; its logs and smoke-generated static graph remain
in `/private/tmp/stz-phase31b-browser-acceptance/`. The native-loading fix logs are in
`/private/tmp/stz-phase31b-native-recovery/`, with static evidence in
`/private/tmp/stz-label-smoke/`; the subsequent review's static artifact is in
`/private/tmp/phase31b-review-assets/`. Earlier reported tests passed with browser
execution blocked. The counts below are
from fresh executions, not copied from those reports. None of those historical
static artifacts establishes browser acceptance.

The check commands executed by the logging helpers were:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts \
  tests/rendering/mathjaxLoader.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/rendering/labels/labelSvg.ts \
  src/rendering/labels/labelMetrics.ts \
  src/rendering/labels/labelInkBounds.ts \
  src/rendering/labels/labelService.ts \
  src/rendering/labels/mathjaxConfig.ts \
  src/rendering/labels/mathjaxEngine.ts \
  src/rendering/labels/mathjaxRuntime.ts \
  src/rendering/labels/mathjaxShared.ts \
  src/rendering/labels/mathjaxWorker.ts \
  src/rendering/labels/mathjaxWorkerClient.ts \
  src/rendering/labels/mathjaxWorkerProtocol.ts \
  vite.config.ts \
  tests/rendering/labelMetrics.test.ts \
  tests/rendering/labelSvg.test.ts \
  tests/rendering/labelService.test.ts \
  tests/rendering/labelServiceLifecycle.test.ts \
  tests/rendering/mathjaxAdapter.test.ts \
  tests/rendering/mathjaxErrors.test.ts \
  tests/rendering/mathjaxLoader.test.ts \
  scripts/prepareMathjaxAssets.mjs \
  scripts/checkLabelAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/prepareMathjaxAssets.mjs
PATH=/opt/homebrew/bin:$PATH node --check scripts/checkLabelAssets.mjs
git diff --check
```

| Check | Actual result |
| --- | --- |
| Asset preparation | Exit 0 (`prepare.log`); both installed/locked packages remain exactly 4.1.3 |
| Seven focused files | Exit 0; 102 passed, 0 failed, 0 skipped (`focused.log`) |
| Full `npm test` | Exit 0; 2,258 passed, 0 failed, 0 skipped (`full.log`) |
| Production build | Exit 0 (`build.log`); non-failing >500kB chunk warnings remain |
| Targeted ESLint, all 21 listed production/config/test/script files | Exit 0 (`targeted-eslint.log`) |
| Both script syntax checks | Exit 0 each (`prepare-syntax.log`, `smoke-syntax.log`) |
| `git diff --check` | Exit 0 (`diff-check.log`) |
| Supplemental fresh-build static inspection | Exit 0 (`static-inspection.log` / `.json`); no browser assertions |
| Localhost capability probe | Exit 1 (`localhost-capability.log`); `listen EPERM` |
| Browser asset/retry/raster smoke | Not rerun: same confirmed bind restriction, escalation prohibited; no current browser exit or log |

All seven focused files ran in one command: **102 is a non-overlapping total**.
It is a subset of the full suite, not an additional 102 unique full-suite tests.
These are this attempt's observed results, not sums of historical review groups.

The loader file is registered in the explicit `npm test` list. Its 16 tests
exercise sticky fixed runtime/shared/font identities across four repeated
failure/recovery cycles each, one current context, queue limits, cooldown,
coalescing, native-error events, startup/conversion deadlines, transport failure,
listener cleanup and ignored late events. Five existing service lifecycle tests
cover aborted initialization, late custom engine disposal, concurrent callers,
timeout/invalidation and stale conversion completion. These deterministic models
supplement, and do not replace, real browser native-import failures.

All prior real-engine ink/advance regressions remain: independent extrema/stroke
containment, overlap/smash geometry, zero advance and following run origins,
negative-advance exact fallback, isolation and immutable reuse. The browser
script retains its independent native `getBBox()` and enlarged-viewport raster
oracles, including a deliberately cropped real glyph that must fail both.
Nonempty/red/blue pixels remain paint checks only, not clipping evidence.

### Fresh static deployment inspection

After the successful fresh build, supplemental filesystem inspection found
**3 main manifest entries,
43 worker chunks, 83 references, and all 40 approved additional-font modules**.
Every referenced file resolves. The graph is recorded in this attempt's
`static-inspection.json`, including
these target paths (static build identities, **not observed HTTP requests**):

- Worker: `/stratified-tikz/assets/mathjaxWorker-DfxTIyyr.js`
- Runtime: `/stratified-tikz/assets/mathjaxRuntime-BQPLTncu.js`
- Shared dependency: `/stratified-tikz/assets/svg-Cy2x9LIX.js`

Licenses and the configured `/stratified-tikz/` base are retained; there is no
duplicate Window runtime graph.
These names came from the current manifests; they are not hard-coded fixtures.
This is supplemental deployment inspection, not a replacement smoke or observed
browser network evidence. The same file records installed/locked/declared 4.1.3
pins, the Worker URL in the built adapter, and the emitted license file. The
inspection command was `python3 /private/tmp/stz-phase31b-verification-_sohhkx7/inspect-build.py`;
its source, argv/status metadata, and build hashes are retained alongside it.

### Browser prerequisite block and outstanding assertions

The capability probe failed with exactly:

```text
Error: listen EPERM: operation not permitted 127.0.0.1
```

The current session uses `workspace-write` sandboxing, restricted network access,
and approval policy **`never`**; its execution instructions prohibit supplying
`sandbox_permissions`. Supported escalation is therefore unavailable in this
session. The probe's `listen(0, '127.0.0.1')` was denied; browser launch was never
attempted. This is an environment block, not an observed runtime defect. The
blocked command was not repeated, and no alternate server or security bypass
was used. No security or network assertion was weakened. Application
mounting, lazy browser initialization, actual same-origin/font requests, native
failure caching, native runtime/font/transitive failure and same-page recovery,
matrices/fallback/paint, or standalone native/raster containment **did not run**.
There are **no actual failed/restored module requests**, HTTP 503/200 recovery
observations, same-service recovery, or Worker retirement events from this run.
`native-retry-evidence.json`, `containment-evidence.json`, `label-standalone.svg`,
`label-standalone.png`, and fixture SVG/PNG/reference PNG files are absent in the
fresh directory. **`asset-graph-evidence.json` is also absent in this attempt**,
because the smoke was not rerun. That file can be written before a smoke's bind
failure, so the historical copy is only static evidence. Current supplemental
inspection and execution logs/metadata are not browser evidence. Phase 31B remains
**acceptance-incomplete**, and readiness to commit is not asserted from unit or
static evidence alone.

When executable, the smoke first measures whether a real HTTP 503 import remains
cached in that browser after the exact URL is restored. It then independently
starts cold pages for runtime, additional-font, and shared-dependency 503 cases.
Each uses the built public service's default loaders, verifies that the intended
request reached the server and affected conversion, preserves complete mixed
source including an earlier valid run and CRLF, restores access, and calls
`invalidate()` on the same service/page. Recovery must request the same URL with
HTTP 200, terminate the old internal Worker, and produce immutable successful
geometry; subsequent math/plain requests must succeed. No page/context/cache is
replaced between failure and recovery. Expected failures are scoped to the exact
injected request; unrelated errors and external requests remain failures.
`native-retry-evidence.json` records URLs, failures, fallback, recovery, contexts,
and actual browser version. A further attempt requires an environment permitting
localhost and Chrome/Chromium, a fresh build, and a new artifact directory. Keep
the existing smoke unchanged unless an executed assertion demonstrates a defect.

| Smoke exit | Interpretation |
| --- | --- |
| 0 / `passed` | All assertions completed, including same-service recovery on a browser observed to cache failed native imports. |
| 2 / `functional-checks-passed-affected-browser-unverified` | Functional assertions completed, but this browser retries failed imports itself; the affected-browser gate remains open. Use an available supported affected browser to finish it. |
| 1 | Inspect the actual error: earlier smoke attempts stopped at bind before launch; an assertion failure after browser execution requires separate diagnosis. The current capability probe's exit 1 is not a smoke result. |

A browser version or an artifact's presence alone cannot establish those gates.

### Handoff to a permitted execution environment

Run in an authorized local session with permission to bind an ephemeral port on
`127.0.0.1` and launch Chrome/Chromium through the existing external Playwright.
The target is `ff37dfffad2b5973071a8bffca1b06df4105b234` plus the three pending
documentation changes listed above; production/build/test inputs are unchanged.
Preserve any subsequent user work, record it with the new run, and rebuild there.
Do not reuse this session's `dist/` as evidence for another checkout.

The resolved commands below create a new artifact directory on every attempt,
save the full logs and actual exit statuses, and run the existing smoke unchanged.
The subshell returns the build failure or smoke exit without closing the terminal:

```sh
(
cd /Users/takamatoshinori/Desktop/stratified-tikz || exit 1
STZ_ACCEPTANCE_DIR="$(mktemp -d /private/tmp/stz-phase31b-browser-acceptance.XXXXXX)" || exit 1
{
  date '+%Y-%m-%dT%H:%M:%S%z'
  sw_vers
  uname -m
  git rev-parse HEAD
  git status --short
  PATH=/opt/homebrew/bin:$PATH node --version
  PATH=/opt/homebrew/bin:$PATH npm --version
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --version
} > "$STZ_ACCEPTANCE_DIR/environment.log" 2>&1
git diff --binary HEAD > "$STZ_ACCEPTANCE_DIR/checkout.patch"
PATH=/opt/homebrew/bin:$PATH npm run build > "$STZ_ACCEPTANCE_DIR/build.log" 2>&1
stz_build_status=$?
printf '%s\n' "$stz_build_status" > "$STZ_ACCEPTANCE_DIR/build.exit-status"
stz_acceptance_status=$stz_build_status
if [ "$stz_build_status" -eq 0 ]; then
  PATH=/opt/homebrew/bin:$PATH \
  STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
  STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  STZ_SMOKE_ARTIFACT_DIR="$STZ_ACCEPTANCE_DIR" \
  npm run check:label-assets > "$STZ_ACCEPTANCE_DIR/browser.log" 2>&1
  stz_smoke_status=$?
  printf '%s\n' "$stz_smoke_status" > "$STZ_ACCEPTANCE_DIR/browser.exit-status"
  stz_acceptance_status=$stz_smoke_status
fi
printf 'Evidence directory: %s\n' "$STZ_ACCEPTANCE_DIR"
exit "$stz_acceptance_status"
)
```

Inspect `browser.log` for the final result, base-path/font requests, and actual
launched version; the installed executable's `--version` is not launch evidence.
Expected smoke artifacts are `asset-graph-evidence.json`,
`native-retry-evidence.json`, `containment-evidence.json`,
`label-standalone.svg`, `label-standalone.png`, and fixture SVG/PNG/reference PNG
files. Check the native-cache probe, all three failed/restored module URLs and
503/200 responses, same-service recovery, old Worker closure, and both containment
oracles including the cropped control. Artifact presence alone does not suffice;
exit 2 still requires an available supported browser observed to cache failures.
This handoff has not been executed and does not close the remaining Medium gate.
The same commands are saved in this attempt's `run-permitted-acceptance.sh`;
`zsh -n` passed (`handoff-syntax.log`), checking syntax only.

No dependency, pinned version, diagram schema, persistence, TikZ, history, or
production label rendering changed. `labelMetrics.ts`, `labelInkBounds.ts`, and
`labelSvg.ts` retain their reviewed geometry. The unchanged `SvgDiagram.tsx`
`react-hooks/refs` lint debt is outside scope; repository-wide lint was not run.
Phase 31C canvas/React/picking integration and later export waiting remain deferred.
