# Preview UI

The Phase 28 editor layout treats the SVG Preview as the main workspace. The
preview expands to roughly the browser viewport height on desktop, while the
top controls stay compact so editing does not require constant scrolling. TikZ
Source stays below the preview so generated code remains visible without
competing with canvas interactions.

## Examples

The Examples control starts expanded so a new session can quickly choose a
diagram. After the user edits the current diagram, the Examples bar collapses to
a compact dropdown. The selected example is still available from the dropdown,
but the control no longer consumes editing space above the preview.

## Preview Toolbar

The creation toolbar floats at the top-left of the SVG Preview. It can be
collapsed with the arrow button and expanded again without changing the diagram
or generated TikZ. Undo and Redo sit directly below the toolbar as preview
overlay buttons.

Toolbar chrome uses translucent backgrounds for the floating toolbar and its
buttons. Text and icons keep their own opaque color, so readability does not
depend on parent opacity.

The Snap control is editor preference state, not diagram geometry. It applies
only to cursor placement and geometry-handle drag editing. Direct coordinate
input, symbolic expression input, JSON load, programmatic updates, and generated
TikZ are not snapped. In 2D mode snapping rounds cursor-derived `x` and `y`
coordinates and keeps `z = 0`; in 3D mode snapping rounds the active work-plane
local coordinates before reconstructing the model point.

See [Editing Fundamentals](./EDITING.md) for Phase 24 snap presets, bulk
editing behavior, symbolic translation, path concatenation, and deferred affine
transform scope.

## Context Quick Style Bar

Selecting an editable object shows a Context quick style bar near the preview
toolbar. It exposes frequent edits without opening the Inspector:

- curves and paths: stroke color, stroke width, and arrows;
- points: point color, radius, and fill mode;
- sheets and filled regions: fill color, fill opacity, stroke color, and stroke
  width;
- free text labels: text color and font size.

The quick bar also exposes copy, paste, and style eyedropper actions. When the
diagram has compatible saved or imported TikZ styles, the quick bar shows a
compact searchable TikZ style menu. Applying an imported style stores the style
reference on the selected object. Editing an explicit shortcut field afterward
keeps the imported TikZ style reference where possible and emits only the
explicit override in generated TikZ, avoiding duplicated options.

Stroke-width-like fields and point radius use sliders snapped to `0.1` steps
plus a text input for custom values. Numeric drafts are lenient while typing:
temporary text such as `.`, `-`, or `1e` stays in the input and shows a warning
without mutating the saved diagram. A valid draft such as `.5` commits normally.

## Label Preview Input Contract (Phase 31A)

Phase 31A defines the pure parser and fallback contract. Phases 31C and 31D
connect free labels and path inline-node text to the production SVG Preview
through the shared `SvgTexLabel` renderer.
The [Phase 31B adapter](./LABEL_ADAPTER.md)
now separates true math advance from a conservative enclosure of retained SVG
ink, with exact whole-source fallback for unsupported geometry or negative total
advance. Native-module recovery now retires the complete lazy MathJax Worker
and its runtime/shared/font module map. Phase 31B is acceptance-complete:
the 2026-09-20 (22:55 JST) authorized-terminal run at `880cdde` rebuilt the same
code and ran the unchanged smoke successfully (exit 0) in Chrome 153.0.8010.52.
It verified same-origin additional-font requests, runtime/font/shared-module
failure and same-service recovery on a browser observed to cache failed imports,
Worker retirement, and all 15 standalone SVG containment fixtures. Earlier
`EPERM` attempts stopped before browser launch; this later run supplies their
missing evidence. The 144 focused parser/adapter tests (included in the full
suite), 2,258 full-suite tests, and targeted checks passed on the same unchanged
code. See the adapter's
[current evidence and commands](./LABEL_ADAPTER.md#verification-and-current-status).
Waiting for settled labels during SVG export and the combined audit remain
assigned to [Phases 31E–31F](./ROADMAP.md#phase-31-typeset-tex-labels-in-svg-preview).

The contract applies only to user-authored visible free-label `TextLabel.text`
and path inline-node `text`. Coordinate names, axes, handles, toolbar text,
saved-path `pathLabel` identifiers, and previously undisplayed stratum label
metadata are outside its scope.

The model, Inspector drafts, and saved JSON retain the exact original string.
Preview parsing does not trim it, add math delimiters, or change the existing
TikZ label formatter, including export-mode and inline-math newline formatting.
Parsed runs, generated SVG, metrics, errors, pending conversions, and caches
belong only to derived runtime state, never `Diagram` or undo history. No saved
file version or schema change is needed.

### Supported Grammar

Ordinary Unicode, including Japanese and emoji, remains ordinary text. Empty
input is valid and produces no runs. Whitespace-only input remains a text run.
Plain `<`, `>`, `&`, quotes, braces, and percent characters are text data; this
parser does not interpret HTML or validate full text-mode TeX.

| Source form | Preview interpretation |
| --- | --- |
| `$...$` or `\(...\)` | Inline math |
| `$$...$$` or `\[...\]` | Display-style math within the same label |
| `\$`, `\%`, `\&`, `\_`, `\#`, `\{`, `\}` outside math | The corresponding literal character |
| Any other text-mode TeX command, including `\textbf{...}` or `\\` | Whole-label `unsupported-text` fallback |
| Missing, mismatched, or stray math delimiters; malformed math braces | Whole-label `invalid-delimiter` fallback |

Math entry gives `$$` precedence over `$`. Once inside math, the closer matches
the opener at brace depth zero. An inline dollar closer consumes exactly one
`$`, so `$x$$y$` is two adjacent inline runs; display dollar math requires `$$`
to close. Display style changes formula layout without starting a new label or
paragraph. Top-level delimiter tokens that do not match the expected closer
are invalid.

Inside math, the scanner consumes a backslash and its following character as
one escaped token, except when recognizing an unescaped math delimiter. Thus
`\$` does not end a formula; in `$x\\$`, the two backslashes form one token and
the final dollar closes the formula. Escaped braces do not affect nesting.
Delimiter-looking characters inside nested braces, such as
`$\text{cost $5 and \(x\)}$`, do not end the outer run. Whether these retained
contents are valid TeX is for the Phase 31B adapter to decide. Outside math,
`\\` is unsupported rather than an escape for a literal backslash or a visual
line break.

The TeX body is retained exactly, excluding only its outer delimiters. Unknown
math commands such as `$\unknowncommand{x}$` are parsed as math and left for
the adapter to validate; the parser neither evaluates nor expands macros.
Physical newlines inside math stay in the same run, including in matrices.
Ordinary text newlines separate visual lines in the shared label renderer;
CRLF may be treated as one visual break without rewriting the original source.

### Results, Bounds, and Exact-Source Fallback

The parser returns a readonly discriminated result: `parsed` with the original
`source` and text/math runs, or `fallback` with that complete `source` and reason
`invalid-delimiter`, `unsupported-text`, or `limit`. Run `sourceStart` and
`sourceEnd` are half-open JavaScript string offsets (UTF-16 code units), so
`source.slice(sourceStart, sourceEnd)` always reproduces the original run slice,
including Unicode. Math source ranges include the outer delimiters, while
`tex` excludes them. Text run `text` cooks only the supported literal escapes;
it must never be used to reconstruct fallback.

The named limits are `MAX_LABEL_SOURCE_LENGTH = 16384` UTF-16 code units and
`MAX_LABEL_RUNS = 256`. The scanner performs linear work without macro
expansion; exceeding either limit returns the complete, untruncated source.

Any invalid delimiter or unsupported text construct fails the entire label,
even after earlier runs parsed successfully. For example, `Cost \$5` has a
successful text run displaying `Cost $5`, but `Cost \$5 $x` falls back to the
entire original source, retaining the backslash and unmatched dollar. Leading,
trailing, and repeated spaces, tabs, LF, and CRLF remain exact in `source`.

The shared label renderer also uses the latest complete original input for
pending conversions, undefined math commands, TeX/output errors, resource
failures, and bounded-work failures. Literal fallback displays every physical
source newline as a visual break (CRLF may be one break) and inserts source as
text, never HTML. It never shows an error SVG, substitutes a message, retains a
previous formula, or partly typesets a failed label. Failure in one label does
not suppress other labels or diagram geometry. Successful output combines
self-contained SVG math geometry with ordinary SVG text, without
`foreignObject` or rasterized formulas. MathJax is not a full LaTeX engine:
arbitrary packages, document preambles, and external style-file macros are
outside this bounded preview language.

### Free-label rendering and editing (Phase 31C)

Valid free-label math, including fractions and mixed Japanese text/math, uses
self-contained SVG geometry alongside ordinary SVG text. Pending and failed
labels show their complete current source. Leading, trailing, and repeated
spaces remain visible; tabs advance to four-space tab stops from the line start.
LF, CR, and CRLF make physical lines in ordinary text and literal fallback;
newlines inside successful math stay inside that formula. The original string
also remains available as the label's accessible description. Empty labels
have no visible or selectable text geometry.

The text font is explicitly the Preview's sans-serif font stack and is measured
after browser font readiness. The existing `style.fontSize * 1.35` scale remains.
All nine anchors align the overall measured rectangle, including tall math,
descenders, and multiple lines. Drawing and overlap picking use the same
committed local bounds, projected at the current model position. Ordinary click,
Alt/Option-click cycling, layer locking/filtering, autoHide/autoDim, selected
position markers, and work-plane-based drag handles keep their existing roles.

Each Preview owns a derived label runtime. Source/font request identities and
component subscription generations reject obsolete completions. Document
replacement starts a new label ownership revision even when imported IDs are
reused. Camera changes, movement, selection, color, and opacity reuse conversion
results; font changes remeasure text while retaining valid math geometry.
Measurement failure uses a finite literal layout. Runtime results and bounds
never enter JSON, Undo/Redo, or either TikZ output; the Inspector continues to
edit the raw source.

For pathological inputs, the display font is capped at 4096 SVG units and
unavailable text metrics use bounded emergency spacing. The complete source
and saved style remain unchanged.

Coordinate names, axis captions, handles, saved path identifiers, and attached
stratum metadata are unchanged.

### Path inline-node text (Phase 31D)

Path inline nodes use the same parser, MathJax adapter, immutable conversion
cache, literal fallback, and SVG label renderer as free labels. For example,
enter `射 $f$ : $\frac{a}{b}$` in a path node's text field to combine Japanese
text with two math runs. The Inspector, saved JSON, and Undo/Redo retain that
exact source. Generated TikZ `node[pos=..., ...]` uses the original text through
the existing export-mode formatter. This remains an attachment to the existing
path and does not split or change its geometry.

All five placements use the complete measured label bounds, including tall
fractions and multiple text/math runs. Above and below align the bottom and
top edges respectively; left and right align the right and left edges. Those
edges stay at the existing 14-unit offset from the projected marker center.
Center placement centers the bounds on the marker. Font size remains 12 SVG
units, with the existing dark label color and white outline. The outline uses
display-unit widths for both text and formula geometry and has no rectangular
background; its decorative geometry is non-interactive and hidden from
accessibility descriptions.

Pending or failed node labels display their complete latest source, including
delimiters, backslashes, spaces, tabs, and physical newlines. For example,
`Map $f$ $\unknowncommand{x}$` falls back as a whole label, including the
otherwise valid `$f$` run. One failing node does not suppress its siblings or
the path. Empty and whitespace-only node text still produces no visible label,
and Preview retains its existing limit of the first 128 inline nodes per path.

Marker geometry, dot/non-dot appearance, selected-path highlighting, and
geometry-derived 2D/3D positions are preserved. Label glyphs pass pointer events
through and do not become selection targets. Alt/Option-click overlap cycling
continues to use the marker-centered tolerance and priority and selects the
owning curve, independently of the size of its text or formula.

Runtime ownership distinguishes the current document, owning path, and inline
node, so node IDs may repeat on different paths. Source and font settings
identify each conversion; obsolete completions after editing, duplication,
splitting, reversal, deletion, or document replacement cannot replace current
content. Position, placement, selection, and camera changes reuse unchanged
conversion results. Committed node results are available through the same
revision-aware layout interface as free labels for subsequent export work.

Saved-path `pathLabel` names and UI captions are not typeset. Existing SVG
export includes currently settled node formulas and current literal fallback;
waiting for a consistent settled snapshot remains Phase 31E. The combined
regression and completion audit remains Phase 31F.

The shared `onLabelLayoutChange(id, snapshot, ownerIdentity)` callback publishes
current free-label and inline-node layouts. Consumers key by `ownerIdentity`,
not by the path-local node ID. Inline owner identities encode document revision,
path ID, and node ID; request identities also include original source and font
settings. A `null` snapshot retires that owner. No separate export registry or
model/history fields are introduced.

### Inline-node verification

`npm run check:free-labels` requires the two inline-node groups in addition to
all eight existing free-label groups. The fixture retains all five placements
at zoom 1 and 1.4, mixed Japanese/text/nested fractions, transparent math,
2D/3D path kinds, real pointer/Alt cycling, ownership and delayed completions,
font readiness, path operations, raw history/TikZ data and current SVG cloning.
Phase 31D acceptance is **incomplete**; independent review has not run.

The execution history must distinguish these results:

- The original implementation child and previous diagnostic child could not
  start their local server (`EPERM`). These are startup blocks, not pixel
  results. The previous handoff is `/private/tmp/stz-phase31d-targeted-handoff.json`.
- The first authorized parent launched Chrome and failed before retaining the
  failing operands (`stz-phase31d-before-review-gRWdxT`). The subsequent parent
  run **did retain them** at
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-if6x1M/`.
  Node v26.9.0 / Chrome 153.0.8010.52, Vite fixture `http://127.0.0.1:5174`:
  tests, build, diff check and `check:label-assets` exited 0;
  `check:free-labels` exited 1 at `inline-above-zoom-1`.
  `maxCompositeError=5.082352941176467` failed `<=2`; the preceding
  `compositeCompared=1130 > dark=31` passed. Seven groups and 75 scenarios
  passed, with no page errors. Inline rendering was partial; inline lifecycle
  and real App were unexecuted. This stopped verification **before review**.
- This fix starts from clean `2622458c5e652febdfb1b065be1d1b33d84bdd5e` on
  `phase/31d-tex-path-inline-labels`. The eight previously pending files are
  committed unchanged: the diff from `6fd794c8a98bfda62e0d8173409d38dfc23dde82`,
  excluding the later fix prompt, has SHA-256
  `6679416198d0a12c59aa6376e137fd475dced9d96ce80ba919baa633d0f29e28`.
  All four original implementation files remain tracked.

The saved worst pixel is `(98,21)` in a 115 × 34 raster with viewBox
`[-58,-27,115,34]`. Foreground `[16,23,38,222]` over halo `[255,255,255,255]`
calculates to `[46.9294118,53.0235294,66.0823529,255]`, while the outlined SVG
produces `[43,49,61,255]`. Premultiplication leaves the same blue-channel
error; alpha is already fully opaque. Independently decoding the saved PNGs
finds that all 21 errors above 2 are among 749 opaque-white-halo pixels. The
other 381 compared pixels retain maximum source-over error 0.4899135447.
The foreground and halo subtrees match the corresponding outlined subtrees.
The worst region contains MathJax fill plus a 3-unit stroke scaled to 0.036
SVG display units. This narrows the discrepancy to direct primitive painting
versus a flattened transparent-foreground reference; it does **not** prove
that final readback rounding alone explains 5.08235, or that production paint
violates the white-halo contract.

The targeted change is an oracle correction, with production paint unchanged.
It adds a separately rendered foreground on an independent white rectangle,
with identical SVG size, viewBox, transforms, geometry and explicit paint.
Only when the halo-only RGBA is exactly `[255,255,255,255]` is that direct
white-backdrop reference used. There the local destination is the same opaque
white, so no reconstruction of a flattened foreground's coverage is needed.
All other pixels retain the original source-over calculation and its tolerance
of 2. The maximum straight-alpha bound stays 2 over the **same 1,130 pixels**
for the retained case; the reference partition must sum to the original
population. An additional maximum premultiplied RGB/alpha bound of 2 checks
**every** raster pixel, including low-alpha/transparent pixels. No tolerance
was fitted to 5.08235 and no partially transparent foreground was discarded.
The opaque-white comparison expects the same direct paint operations on the
same byte-valued local backdrop; the existing two-byte allowance remains for
raster/readback quantization, not an accumulation allowance for arbitrary
primitive overlap. New browser measurements must still validate this change.

Pre-assertion retention preserves every original metric and layer PNG/SVG,
original calculated expectation/differences, bounded worst samples, native
metadata and full-page screenshot. Original `maxCompositeError` remains a
flattened-reference diagnostic. Added artifacts include `foregroundOnWhite`,
`backdropExpected`, `backdropDifference`, each original worst pixel's direct
reference, and bounded worst samples for both new comparisons. On the first
placement the browser also independently removes foreground strokes or adds
foreground isolation, retaining each controlled experiment as diagnostics.
These experiments have **not yet executed in this child**; a thin-stroke or
isolation mechanism must not be reported as measured until their values exist.

Six browser negative controls mutate only a fresh tested output, leaving all
reference images unchanged: halo above foreground, missing halo, oversized
halo, opaque rectangle, wrong foreground color and wrong foreground opacity.
Each must fail the independent comparison; corresponding solid-pixel, white
outline, extent and transparent-gap checks also reject their specific defects.
The normal placement matrix and transparent-math case retain all existing
width, inner-color, counter/gap, accessibility and picking assertions. A group
is completed only after all assertions return. These added browser controls
are implemented, **not observed passes**.

The phase-aware parent validator and its tests are unchanged by this fix. It
accepts complete eight- or ten-group 31C evidence and requires all ten groups
for 31D–31F. Its 53 behavioral helper/runner tests still reject missing inline
groups, duplicate/unsupported/incomplete reports, browser errors, nonzero exits
and checkout changes, while preserving 31B and verification-before-review.

Current child verification uses Node v26.9.0 with `/opt/homebrew/bin` first in
`PATH`. The five requested focused test files plus
`tests/scripts/inlineLabelComposite.test.ts` passed **93 tests** (exit 0),
including eight new numeric comparison tests and the 53 parent tests. The new
file is registered in `npm test`; focused counts are included in the full
suite. `npm test` passed **2,356 tests**, `npm run build` exited 0 (the existing
large-chunk warning only), and fixture TypeScript, the five requested script
syntax checks, targeted ESLint (including both new files) and `git diff --check`
all exited 0. `SvgDiagram` was not touched; repository-wide lint was not run
because its previously documented lint debt remains out of scope. Exact
commands, logs and final pending-checkout identity are retained in
`/private/tmp/stz-phase31d-compositing-fix/handoff.json`.
Production renderer, parser/adapter/runtime, pinned MathJax, model/history,
marker/picking, path operations and SVG/TikZ export remain unchanged.

A direct external-Playwright Chrome launch from this child exited 1
(`Target page, context or browser has been closed`, SIGABRT; cleanup reported
`kill EPERM`). No browser version or new pixels were obtained. Native Terminal
and Chrome UI access were also denied by the tool. These restrictions are
separate from the parent's **executed** halo assertion. The saved-image numeric
analysis and an unexecuted local reproduction are retained under
`/private/tmp/stz-phase31d-compositing-fix/`; they are not acceptance evidence.

The authorized parent must execute the complete gate on this final checkout:
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31D verify`.
It must identify a browser, exit 0, report `passed`/`complete`, finish all ten
groups (including both inline groups and real App), and leave no incomplete,
unexecuted or page-error entries. The white-backdrop diagnosis, negative
controls, full placement/halo matrix, lifecycle/App/export observations and
fresh `check:label-assets` remain pending. `verify` does not run review;
subsequent independent review is a separate requirement. 31E's settled-export
waiting and 31F's combined audit remain deferred.

### Free-label verification

Phase 31C browser acceptance is **verified on 2026-09-21**. The authorized
`node scripts/automation/run-phase.mjs 31C verify` run exited 0: all 2,298 tests,
build, diff check, `check:label-assets`, and `check:free-labels` passed. Chrome
153.0.8010.52 completed all eight required groups, including 18 boundary matrix
cases and real App workflows, with 99 passing records and no incomplete groups,
unexecuted groups or page errors. Earlier failures and blocked attempts are
retained below as history; the complete authorized result supersedes them.

The parent report and command logs are in
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31c-manual-wU4DY3`.
`verification.json` records the unchanged checkout before/after verification;
`05-check-free-labels/artifacts/free-labels-evidence.json` records `passed` /
`complete`, individual observations, screenshots, downloads and checkout identity.
The verified revision is `476a39f3315eaeb6d0c85bd95e98ab44a4c0aede` plus tracked
diff SHA-256 `75fec69996c3603806f0a4855f78c66ee45aa7229bb8fc77fd166a65d6590497`,
with no untracked files. Subsequent changes only update these documentation
outcomes. Strict fixture TypeScript, targeted ESLint and all four script syntax
checks also passed. Build retains its nonblocking chunk-size warning.

The latest reported tab failure (manual run `stz-phase31c-manual-jPvNY7`)
exposed a second oracle issue: multiplying a rounded one-space SVG advance
selected the wrong four-space stop near a boundary. At 32.4px it expected
282.5 while the actual next fragment began at 310.10882568359375.
`measureSvgTabStop` now measures complete whitespace prefixes independently,
bracketing the fragment between consecutive stops. Its expected position is
310.109375 (delta -0.00054931640625); the 0.5-unit tab tolerance is unchanged.
Both font sizes, literal edge whitespace, raw source/CRLF preservation and
default-font negative controls passed. The diagnostic is retained at
`/private/tmp/stz-phase31c-tab-grid-diagnostic.json`.

Execution then exposed additional test setup assumptions, corrected without
production changes:

- Occlusion labels explicitly share the sheet's layer so `layerThenDepth`
  permits occlusion. Restored autoDim selection checks normal label selection,
  then Alt cycling through sheet and label, with one callback per click.
- Authored anchor translations still match model projections within `1e-5`.
  Native matrix readback separately allows one coordinate-dependent float32
  ULP plus `1e-5`; Chrome rounded x=533.1764222669804 to 533.1764526367188.
  Ink containment, hit geometry and boundary tolerances are unchanged.
- Real App checks use its pan number inputs to bring long pending text inside
  the canvas, then remeasure client coordinates. Raw text and pointer probes
  are unchanged; pan must preserve JSON/history. After obsolete completions,
  corrective pan is forbidden so it cannot hide an incorrect position change.
  The TikZ mode selector also accounts for option text inside its wrapping label.

**M1's required-browser-evidence gap is closed for this verified snapshot.**

The strengthened `npm run check:free-labels` uses a **Vite development server**,
production `SvgDiagram`, and a separate fixture mounting the real `App`. These
fixtures are not production build entries. No dependencies or MathJax versions
changed. `App` has only a development-gated runtime injection and read-only,
serialized diagnostics; editor, load/save, revision, selection, and history
handlers remain the production handlers.

The harness contains these required assertions, all observed in the complete
authorized browser run:

- Independent alpha-pixel extents of an isolated visible-content SVG clone.
  Native descendant bounds and full `getScreenCTM()` transforms size the raster;
  neither published bounds nor the picking rectangle sizes the oracle. Editor
  overlays are excluded and painted MathJax rectangles/fraction rules retained.
  Raster density is four samples per SVG unit, capped at 4096 on the longest
  side. Allowances per published edge are 0.35 em + 1 SVG unit horizontally,
  plus independently measured literal edge whitespace, and 0.85 em + 1 vertically
  for font leading; ink may protrude by at most 1 unit. Hit/published agreement
  tolerance is 0.01. These finite allowances distinguish ink from advance and
  leading without permitting arbitrary inflation. Negative controls inflate or
  displace both published and hit boxes by 8 em, require rejection with unchanged
  ink, and restore the DOM in `finally`. Retained fixture self-checks use this
  same independent oracle.
- All nine anchors, plus 18 required boundary cases: tall nested fraction
  `$\frac{1}{1+\frac{x}{1+\frac{y}{z}}}$` and compact
  `$\mathord{\mathord{\mathord{\alpha}}}$`, each with center/north/east in 2D,
  after pan/zoom, and after a changed 3D camera at nonzero depth. Each case records
  22 real pointer probes, canvas/client transforms, actual selected targets and
  callback counts. Blank canvas clicks clear selection before probes. Normal
  clicks use the hit rectangle; Alt cycling retains 6/4 units padding plus
  8 units tolerance (14 horizontally, 12 vertically). Compact cases also probe
  inside the obsolete raw-character estimate and outside the measured hit area.
  Glyph clicks, mixed compiled/fallback cycling, and camera/position/paint/
  selection conversion counts are checked separately.
- Held completions record started requests, current font size, held state, and
  delivery even after hidden/deleted/unmounted DOM disappears. Newer completion
  precedes obsolete success or failure, with independent bounds and real boundary
  and stale-layout-only clicks at pending, current-ready, and obsolete-completed
  stages. Completion alone must preserve model, history, both TikZ modes, current
  position/style and selection. Releases wait for request promises and two
  animation frames. Locking removes a previously usable drag handle while pending;
  autoHide transitions from pending autoDim and stays hidden after delivery.
  Restored visibility/unlocking, hidden/filtered layers and autoDim remain covered.
- Real App textarea edits valid → invalid → valid; actual JSON import/download/
  reload with delimiters, backslashes, Unicode, spaces, physical newlines and
  exact CRLF; actual Undo/Redo while held and preservation of an existing redo
  branch; actual JSON document replacement with reused IDs and observed App
  document revisions. Both production TikZ modes and current SVG cloning remain
  checked. Runtime state is never assigned into App model/history by the fixture.

Historical verification on 2026-09-21, at base revision
`4b25b823fab52157eef0b7c9b313a199c9d5aee5` plus this follow-up diff:

| Check | Historical result |
| --- | --- |
| Asset preparation | exit 0 |
| Focused layout/runtime/picking | exit 0; 23 passed (subset of full suite) |
| `npm test` | exit 0; 2,281 passed, none failed/skipped |
| `npm run build` | exit 0; nonblocking chunk-size warning |
| Strict development-fixture TypeScript | exit 0 |
| Targeted lint and all four browser-script syntax checks | exit 0 |
| App/SvgDiagram lint comparison against HEAD | unchanged 10 errors / 4 warnings; raw lint exit 1, baseline comparison passed |
| `git diff --check` | exit 0 |
| Strengthened free-label browser acceptance | **exit 1 before assertions**, `listen EPERM: operation not permitted 127.0.0.1:5173` |

Node was v26.9.0, resolved at `/opt/homebrew/Cellar/node/26.9.0/bin/node`.
Installed Chrome was 153.0.8010.52 (read from its application metadata); **Chrome
was not launched by this attempt**, so there is no observed browser version or
browser pass for it. That session permitted workspace writes but had approval
policy `never`; no escalation was available and no external development origin was
configured. No browser-security or persistent runner settings were changed.

Those historical verification logs/statuses are in
`/private/tmp/stz-phase31c-verification.n21xIe`. The strengthened browser attempt
is retained in `/private/tmp/stz-phase31c-browser-acceptance.2ni7DV`:
`browser.log`, `browser.exit-status`, `free-labels-evidence.json`, `checkout.diff`,
and `checkout-untracked.json`. The evidence records zero completed browser
groups and all required groups unexecuted. **No screenshots, measured extents,
pointer results, race observations or App observations were produced**, since
server startup failed. The tracked code diff SHA-256 for that attempt is
`a906ef520e7189ac24fbdc8e918a10abe774ee7257b4cc5134ddc764376663e7`;
per-file hashes and complete untracked harness contents are in the evidence.
After that blocked attempt, the App script's multiline-input and stale-point
assertions were refined and syntax/lint checked again. No browser assertion ran
on either snapshot; the denied bind was not repeated without an environment
change. `final-handoff.json`, `final-checkout.diff`, and
`final-pending-files.tar.gz` in the same evidence directory identify and retain
the final pending implementation (including untracked files). Earlier blocked
review attempts remain historical; their reported results are not this
follow-up's results. The review attempt at
`/private/tmp/stz-review31c-browser/free-labels-evidence.json` likewise failed
before launch at `development-server-listen`, with `browserVersion: null`, no
executed assertions and all eight groups incomplete/unexecuted.

The subsequent **authorized Terminal run** is retained in
`/private/tmp/stz-phase31c-browser-acceptance.POb7Fz`, including
`free-labels-evidence.json`, `browser.log`, `browser.exit-status`, `failure.png`,
and checkout artifacts. It used Node v26.9.0 and **launched Chrome
153.0.8010.52** against `http://127.0.0.1:5174`, at revision
`4b09c181dcea6b7db9f46daf7d82ef322ef4e3ee` with only
`prompts/phase-31c-fix.md` modified (tracked diff SHA-256
`593ad6f08a702fd53493f298e44baeaa66cd47cfca3d2bb4aa8d249e748fe260`, no
untracked files). The command exited **1** at `renderer-fixture` on
`Tab advances to a measured four-space stop`. Initial renderer/source/state/
whitespace assertions executed; no group completed. Its empty `completed`
array does not mean zero assertions ran. The old `unexecuted` calculation used
an empty grouped evidence array and incorrectly classified this partial renderer
execution. Geometry, races, policy, App and SVG-cloning groups did not run.

The separate permitted diagnostic script and measurements are
`/private/tmp/stz-phase31c-tab-diagnostic.mjs` and
`/private/tmp/stz-phase31c-tab-diagnostic.json`. The displayed fallback used
normal weight 400, size 24.3px and family
`Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`, but computed
`font` shorthand was empty. Assigning it to Canvas silently retained
`10px sans-serif`: space advance 2.7783203125, instead of 5.382659912109375 with
explicit displayed font longhands. The first SVG fragment advanced 212.21875;
the incorrect oracle expected tab x = 222.265625, while production placed the
next fragment at 215.306396484375, exactly matching explicit-font Canvas
measurement. Independent SVG-space measurement gave width 5.390625 and
expected x = 215.625, within the existing 0.5-unit tolerance (delta about
0.319). This diagnoses a **harness font oracle defect**, not a production
tab-layout defect. It proves neither the later scenarios nor a full acceptance
pass; production metrics and placement and the tab tolerance remain unchanged.

The first targeted correction on revision
`476a39f3315eaeb6d0c85bd95e98ab44a4c0aede` plus the pending diff uses
`measureSvgTextAdvance` in the development fixture oracle. It measures temporary
SVG text clones with the displayed font and spacing longhands, preserves
whitespace, and removes each clone in `finally`. Both tab-space measurement and
the alpha-pixel oracle's finite literal-edge whitespace allowance use this
independent path. Painted fraction rules, negative controls and all existing
tolerances are retained. No production renderer, metrics, picking, App or
adapter code changed, and no dependencies or pinned versions changed.

Browser regressions now check tab advance and literal leading/trailing spaces
at the initial font and after changing the model font size to 24. They verify
current clone font/spacing properties and reject the unrelated default 10px
Canvas measurement after deliberately assigning empty or invalid shorthand.
The tab tolerance remains 0.5 SVG units; complete-source and CRLF-as-one-line-
break assertions remain active. Fragment text, x/y, SVG advance, computed font
shorthand/longhands, clone properties, measured spaces, expected stop, actual x
and delta are saved as diagnostics **before** assertions. Started groups and
checkpoints distinguish partial execution from no execution; diagnostics do
not count as passing evidence, and a group completes only after all of its
assertions return. At that child-session handoff these regressions were
implemented but not browser-verified; the later authorized run above verifies them.

Earlier child-session non-browser verification used Node v26.9.0 with
`PATH=/opt/homebrew/bin:$PATH`; logs and individual exit-status files are in
`/private/tmp/stz-phase31c-checks.LSbuyz`:

| Check | Earlier child-session result |
| --- | --- |
| Asset preparation | exit 0 |
| Focused layout/runtime/picking | exit 0; 23 passed (included in full suite) |
| `npm test` | exit 0; 2,298 passed, none failed/skipped |
| `npm run build` | exit 0; nonblocking chunk-size warning |
| Strict fixture TypeScript | exit 0 |
| Targeted ESLint | exit 0 |
| All four browser-script syntax checks | exit 0 |
| `git diff --check` | exit 0 |
| Corrected `npm run check:free-labels` | exit 1 at development-server startup; no browser assertions executed |

No Node tests were added by this fix; the full-suite count includes tests from
the preserved later checkout and must not be added to the focused count.
Repository-wide lint was not run; the historical App/SvgDiagram baseline debt
of 10 errors and 4 warnings is separate from the passing targeted lint, and
neither production file was modified.

The earlier corrected browser attempt is in
`/private/tmp/stz-phase31c-browser-acceptance.Rzi8z7`. It ran the exact resolved
command below, with no inherited `STZ_BROWSER_BASE_URL`, and failed with
`listen EPERM: operation not permitted 127.0.0.1:5173` at
`development-server-listen`. That child session's approval policy was `never`;
no escalation was permitted. The denied bind was not retried, no port was changed
to evade it, and no browser or persistent sandbox settings were changed.
`browser.exit-status` is 1 and `free-labels-evidence.json` records
`browserVersion: null`: Chrome did not launch. Started/completed groups,
checkpoints, diagnostics and evidence are empty; all eight groups remain
incomplete/unexecuted, and no screenshot or geometry/pointer/race/App/export
observations were produced. This fresh environment block does not replace the
earlier authorized run's observed tab assertion or its font diagnosis.

The browser snapshot records revision
`476a39f3315eaeb6d0c85bd95e98ab44a4c0aede`, tracked diff SHA-256
`a2cd3360dcd02d5e6a2a0953a083744545070efff8bd3d43db477f2919b71d6d`, and no
untracked files. Its six modified files are `docs/PREVIEW_UI.md`,
`docs/ROADMAP.md`, `scripts/checkFreeLabels.mjs`,
`scripts/checkFreeLabelGeometry.mjs`, `scripts/checkFreeLabelRaces.mjs`, and
`scripts/fixtures/labelBrowserOracle.ts`. Browser logs/status and
`checkout.diff` / `checkout-untracked.json` retain that exact snapshot. Later
documentation-only updates are included in the final handoff files
`/private/tmp/stz-phase31c-checks.LSbuyz/final-checkout.json`,
`final-checkout.diff`, and `final-checkout-untracked.json`. Preserve the complete
current checkout for the parent run; the historical base alone is insufficient.

At that handoff the parent runner was scheduled to run `check:label-assets` and
`check:free-labels` outside the child sandbox, retaining logs and artifacts and
stopping on failed or incomplete verification. M1 remained open until the
complete authorized parent run recorded at the start of this section.

To reproduce the check, run the harness in the parent runner's authorized environment or an
authorized Terminal/CI checkout containing the complete current pending diff;
a handoff is not acceptance. Check that `STZ_BROWSER_BASE_URL` is unset unless
an external development origin is intended. The resolved external tool paths
and exit-status-preserving command are:

```bash
(
  cd /Users/takamatoshinori/Desktop/stratified-tikz || exit 1
  export PATH=/opt/homebrew/bin:$PATH
  STZ_31C_EVIDENCE_DIR="$(mktemp -d /private/tmp/stz-phase31c-browser-acceptance.XXXXXX)" || exit 1
  printf 'Evidence directory: %s\n' "$STZ_31C_EVIDENCE_DIR"
  node scripts/prepareMathjaxAssets.mjs >"$STZ_31C_EVIDENCE_DIR/prepare.log" 2>&1
  STZ_31C_PREPARE_STATUS=$?
  printf '%s\n' "$STZ_31C_PREPARE_STATUS" >"$STZ_31C_EVIDENCE_DIR/prepare.exit-status"
  if [ "$STZ_31C_PREPARE_STATUS" -ne 0 ]; then
    cat "$STZ_31C_EVIDENCE_DIR/prepare.log"
    exit "$STZ_31C_PREPARE_STATUS"
  fi
  STZ_PLAYWRIGHT_MODULE=/Users/takamatoshinori/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
  STZ_BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  STZ_SMOKE_ARTIFACT_DIR="$STZ_31C_EVIDENCE_DIR" \
  npm run check:free-labels >"$STZ_31C_EVIDENCE_DIR/browser.log" 2>&1
  STZ_31C_BROWSER_STATUS=$?
  printf '%s\n' "$STZ_31C_BROWSER_STATUS" >"$STZ_31C_EVIDENCE_DIR/browser.exit-status"
  printf 'Browser exit status: %s\n' "$STZ_31C_BROWSER_STATUS"
  if [ "$STZ_31C_BROWSER_STATUS" -ne 0 ]; then
    tail -n 60 "$STZ_31C_EVIDENCE_DIR/browser.log"
  fi
  exit "$STZ_31C_BROWSER_STATUS"
)
```

An explicitly set `STZ_BROWSER_BASE_URL` must serve **this checkout and its
development fixtures** (for example, an authorized `npm run dev` server).
A production build does not serve the fixtures. A successful run must retain
`free-labels-evidence.json` with every completion group, per-scenario geometry/
pointer/race/App observations, `geometry-*.png`, race/policy screenshots,
`app-*.png`, App downloaded JSON, `settled-export.png`, logs/status, and checkout
identity. Failures retain partial evidence and a failure screenshot if a page
was reached; they never emit an overall pass. Acceptance requires exit 0,
`result: "passed"`, `stage: "complete"`, an actually launched browser version,
empty `incompleteGroups`, `unexecuted` and `pageErrors`, and all eight completed
groups: `existing-renderer-regressions`, `independent-oracle-negative-controls`,
`boundary-anchor-camera-matrix`, `inverted-success-and-failure-races`,
`pending-lock-and-autohide`, `deletion-and-unmount`,
`real-App-input-JSON-history-reused-ID-load`, and `current-SVG-cloning`.

Reproduce the non-browser checks with:

```bash
export PATH=/opt/homebrew/bin:$PATH
node scripts/prepareMathjaxAssets.mjs
node --test tests/rendering/svgLabelLayout.test.ts tests/rendering/svgLabelRuntime.test.ts tests/rendering/svgLabelPicking.test.ts
npm test
npm run build
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
for script in scripts/checkFreeLabel*.mjs; do node --check "$script" || exit 1; done
node node_modules/eslint/bin/eslint.js \
  scripts/checkFreeLabel*.mjs scripts/fixtures/freeLabels.tsx \
  scripts/fixtures/freeLabelsApp.tsx scripts/fixtures/labelBrowserOracle.ts \
  src/rendering/SvgTexLabel.tsx src/rendering/labels/svgLabelLayout.ts \
  src/rendering/labels/svgLabelRuntime.ts src/rendering/svgLabelBounds.ts \
  src/rendering/svgHitTesting.ts tests/rendering/svgLabelLayout.test.ts \
  tests/rendering/svgLabelRuntime.test.ts tests/rendering/svgLabelPicking.test.ts
git diff --check
```

The reproducible fixture config extends application compiler options and enables
strict checking plus Vite/DOM types for all development TS/TSX fixtures. Compare
App/SvgDiagram lint separately against HEAD; repository-wide lint is skipped
because that baseline is not clean. No adapter/loading/build configuration
changed. The authorized parent run also passed the independent Phase 31B
`check:label-assets`; its evidence remains separate from the Phase 31C results.
The historical free-label verification above predates inline-node integration;
see the Phase 31D implementation and pending browser verification above.
Phase 31E and Phase 31F remain deferred.

## Export SVG

The SVG export control is a sticky preview edge action at the lower-right of
the preview frame, next to the Layer control area and protruding below the
frame. Its background selector offers `Transparent background` (the default)
and `White background` before using `Export SVG`. The Preview workspace may
remain gray on screen; that editor-only background is not inherited by the
download. White export instead adds an explicit white rectangle covering the
exported viewBox behind the diagram.

Export includes the current SVG Preview view, including visible diagram
geometry, labels, and arrow previews. Editor chrome, hit-test metadata, and
preview-only data attributes are removed from the exported SVG.

Export currently clones what is visible: settled free-label and path inline-node
formulas remain SVG geometry, and pending/failed labels remain their current
literal source.
Transparent and white backgrounds are supported, and label hit rectangles and
selected-position markers are excluded. Waiting for a consistent settled-label
snapshot is deferred to Phase 31E.

SVG export is independent from TikZ export. Using `Export SVG` never changes the
diagram model, undo history, TikZ source, or TikZ export mode. The most recently
selected SVG background remains active for the current component lifetime, but
is export-only and is not included in saved diagram JSON.

## Add Path

Path-related creation tools are consolidated under Add path:

- arbitrary path;
- polyline;
- cubic Bezier;
- arc segment path;
- direct manual, circle, ellipse, and arc path input.

This keeps the primary toolbar compact while preserving the existing path
creation modes.

## Direct Input Drawer

Choosing a Direct input creation mode opens the right-side Direct input drawer.
The drawer edits pending creation fields only. It does not change the diagram,
saved JSON, undo history, or TikZ output until the user creates an element.
Closing the drawer returns creation to cursor input.

In 3D point and free-label creation, the drawer offers a coordinate mode:
`Global 3D coordinates` or `Active work-plane local coordinates`. The local mode
shows `Plane x / a` and `Plane y / b` fields. These fields accept numeric or
symbolic scalar expressions, display the evaluated local preview values, and
display the resulting global preview point. Creating the point or label stores a
snapshot of the active work-plane frame plus the local scalar expressions.
Cursor snap does not modify these direct local expressions; snapping applies
only to cursor-derived placement and drag coordinates.

For 3D `Add coordinate` and `Add point`, active work-plane-local input also
supports a polar mode. The first field is the work-plane-local radius and the
second field is the angle in degrees. The input panel shows the active
work-plane origin and plane vectors near the local input mode control, so the
user can see which frame the local polar coordinate will use.

In 2D diagrams, direct input remains global x/y input only; no work-plane-local
coordinate mode is shown.

## Work-Plane Overlay

In 3D mode, the work-plane editor is a preview overlay near the lower-left of
the canvas. It mirrors the Layer window placement style while keeping work-plane
setup near cursor-driven 3D editing. The top toolbar routes to this preview
overlay with `Edit in preview`.

The setup methods are listed in this order:

1. Pick 3 existing points;
2. Origin + normal vector;
3. Custom 3 points.

`Pick 3 existing points` can pick point strata and visible coordinate anchors.
`Origin + normal vector` accepts an xyz origin and a normal described by theta
and phi angle fields. Theta is measured from `+z`; phi is measured in the
`xy`-plane from `+x` toward `+y`. A small normal-vector preview updates from
those two angle drafts. `Custom 3 points` builds a custom plane from three
directly entered points.

## Inspector Drawer

The Inspector button opens the right-side inspector drawer. Opening, closing, or
expanding inspector sections is UI state only. Coordinates and styles change the
diagram only when the inspector fields themselves commit edits.

For selected point strata or free text labels whose position is stored as a
work-plane-local coordinate source, the Inspector shows `Coordinate source:
Work-plane local`, editable `Plane x / a` and `Plane y / b` expressions, the
evaluated global preview point, and a compact stored-frame summary. Editing a
valid local expression updates the local source and recomputes the global
preview. Invalid local expressions are rejected and do not silently convert the
position to global xyz coordinates.

See [Symbolic Input And Grids](./SYMBOLIC_INPUT_AND_GRIDS.md) for variable
resolution, translation policy, and TikZ `canvas is plane` export behavior for
work-plane-local symbolic coordinates.

For multi-selection, the inspector supports bulk style, layer, delete, and
duplicate operations for the selected objects. Style fields are shown only for
safe common fields of the selected geometric kind. If every selected object has
the same value for a field, that value is shown; otherwise the field displays
`Mixed`, and editing that field applies only the edited value to every selected
object. Curve selections expose stroke color, opacity, line width, line style,
and arrow options when every selected curve supports arrows. Sheet and region
selections expose fill color, fill opacity, stroke color, stroke opacity, and
line width. Point selections expose color, opacity, size, shape, and fill mode.
Label selections expose text color, opacity, font size, and anchor.

Bulk layer changes move every selected object to the chosen layer and update
layer metadata as needed. Bulk delete clears the selection and removes stale
crossing states that depended on deleted curves. Bulk duplicate preserves
geometry, styles, symbolic coordinate metadata, and layer values while assigning
new object ids; copied path labels are disambiguated using the same copy naming
policy as layer duplication. Crossing states are not duplicated by the MVP.

Coordinate-anchor multi-selection is separate from layer-bound bulk editing.
When every selected item is a coordinate anchor, the Inspector shows a concise
selected-count summary and direct translation controls. In 2D, `dz` is disabled
and kept at `0`; in 3D, all three delta fields are available. Direct coordinate
translation does not use cursor snap. Dragging one selected coordinate marker
translates the selected coordinate group and does use cursor snap. Mixed
coordinate plus layer-bound multi-selection translation is rejected for the MVP.

## Layer Window

The Layer button opens a floating bottom-right layer window. The window controls
the new-element layer, layer filter, visibility, locking, drag-swap, and layer
actions. Open/closed state and the selected action panel are UI-only state.
Layer operations that modify layer metadata or element membership remain normal
undoable diagram changes.

## Arrow Preview

SVG Preview draws path arrowheads close to the TikZ arrow syntax used on export.
Endpoint arrows use the standard `>`-style head. Mid-arrow previews distinguish
`Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`, and they
follow the path tangent, line width, stroke color, and stroke opacity.

The preview is an SVG approximation of TikZ `arrows.meta`, not a TeX-rendered
copy. It is intended to show direction, position, head family, harpoon side, and
relative size faithfully enough for editing. TikZ export remains the source of
truth for exact TeX rendering.

## Overlay Stacking

Preview overlays use a fixed policy inside `.preview-stage`: the SVG canvas is
the base interaction surface; coordinate highlights and geometry handles render
inside the SVG; floating toolbar/history sit above the canvas; camera and layer
panels sit at the bottom-right; the direct input drawer sits on the right; and
the inspector drawer is the top preview-local panel. Overlay controls stop
click and pointer propagation so canvas creation, selection, dragging, and
camera interactions still work when clicking outside overlays.

The JSON load variable-resolution dialog is a modal outside the preview overlay
stack. It traps focus while open, handles Escape inside the modal flow, and sits
above the toolbar, quick style bar, popovers, layer window, work-plane overlay,
direct input drawer, and inspector drawer.
