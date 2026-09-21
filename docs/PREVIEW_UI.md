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
Settled-label SVG export is implemented as described in [Export SVG](#export-svg),
with its standalone browser gate pending. The combined audit remains assigned
to [Phase 31F](./ROADMAP.md#phase-31-typeset-tex-labels-in-svg-preview).

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
revision-aware layout interface as free labels.

Saved-path `pathLabel` names and UI captions are not typeset. SVG export settles
the free-label and inline-node sources captured at the export click. The combined
regression and completion audit remains Phase 31F.

The shared `onLabelLayoutChange(id, snapshot, ownerIdentity)` callback publishes
current free-label and inline-node layouts. Consumers key by `ownerIdentity`,
not by the path-local node ID. Inline owner identities encode document revision,
path ID, and node ID; request identities also include original source and font
settings. A `null` snapshot retires that owner. Phase 31E additionally associates
immutable committed inputs with their rendered elements in a runtime WeakMap;
no conversion or export state enters the model or history.

### Inline-node verification

`npm run check:free-labels` requires the two inline-node groups in addition to
all eight existing free-label groups. The fixture retains all five placements
at zoom 1 and 1.4, mixed Japanese/text/nested fractions, transparent math,
2D/3D path kinds, real pointer/Alt cycling, ownership and delayed completions,
font readiness, path operations, raw history/TikZ data and current SVG cloning.
Phase 31D acceptance is **incomplete**. The preceding independent review
returned `needs_changes`: no Critical issues, one Medium issue, and no
Low-priority issues. Its missing 3D marker interaction and same-node recovery
cases were subsequently implemented. Parent verification then executed the
changed harness and failed its initial-camera overlap expectation in
`stz-phase31d-before-review-2KaWQt`; it stopped before another review. The
current candidate-cycle correction requires fresh complete parent evidence
and a separate independent re-review. The accepted halo correction is preserved.

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
- The prior halo-oracle fix started from clean
  `2622458c5e652febdfb1b065be1d1b33d84bdd5e` on
  `phase/31d-tex-path-inline-labels`. The eight previously pending files are
  committed unchanged: the diff from `6fd794c8a98bfda62e0d8173409d38dfc23dde82`,
  excluding the later fix prompt, has SHA-256
  `6679416198d0a12c59aa6376e137fd475dced9d96ce80ba919baa633d0f29e28`.
  All four original implementation files remain tracked.

For that earlier failed run, the saved worst pixel is `(98,21)` in a 115 × 34
raster with viewBox
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

The prior targeted change was an oracle correction, with production paint
unchanged.
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
primitive overlap. The subsequent matching parent run validated this correction,
as recorded below.

Pre-assertion retention preserves every original metric and layer PNG/SVG,
original calculated expectation/differences, bounded worst samples, native
metadata and full-page screenshot. Original `maxCompositeError` remains a
flattened-reference diagnostic. Added artifacts include `foregroundOnWhite`,
`backdropExpected`, `backdropDifference`, each original worst pixel's direct
reference, and bounded worst samples for both new comparisons. On the first
placement the browser also independently removes foreground strokes or adds
foreground isolation, retaining each controlled experiment as diagnostics.
These experiments were unexecuted in the prior child. The subsequent parent
retained their browser diagnostics with the placement evidence; the original
flattened-reference discrepancy is not a current acceptance blocker.

Six browser negative controls mutate only a fresh tested output, leaving all
reference images unchanged: halo above foreground, missing halo, oversized
halo, opaque rectangle, wrong foreground color and wrong foreground opacity.
Each must fail the independent comparison; corresponding solid-pixel, white
outline, extent and transparent-gap checks also reject their specific defects.
The normal placement matrix and transparent-math case retain all existing
width, inner-color, counter/gap, accessibility and picking assertions. A group
is completed only after all assertions return. These six controls and the
placement matrix subsequently passed in the matching parent run below.

The phase-aware parent validator and its tests are unchanged by this fix. It
accepts complete eight- or ten-group 31C evidence and requires all ten groups
for 31D–31F. Its 53 behavioral helper/runner tests still reject missing inline
groups, duplicate/unsupported/incomplete reports, browser errors, nonzero exits
and checkout changes, while preserving 31B and verification-before-review.

The prior compositing-fix child verification used Node v26.9.0 with
`/opt/homebrew/bin` first in
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

A direct external-Playwright Chrome launch from the prior child exited 1
(`Target page, context or browser has been closed`, SIGABRT; cleanup reported
`kill EPERM`). No browser version or new pixels were obtained. Native Terminal
and Chrome UI access were also denied by the tool. These restrictions are
separate from the parent's **executed** halo assertion. The saved-image numeric
analysis and an unexecuted local reproduction are retained under
`/private/tmp/stz-phase31d-compositing-fix/`; they are not acceptance evidence.

The subsequent authorized parent verification passed under Node v26.9.0 and
Chrome 153.0.8010.52 at
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-Fiv3uY/`.
`verification.json` records exit 0 for `npm test` (2,356 passing tests),
`npm run build`, `git diff --check`, `check:label-assets`, and
`check:free-labels`. The two browser command logs and their artifacts are in
`04-check-label-assets/` and `05-check-free-labels/`.
`05-check-free-labels/artifacts/free-labels-evidence.json` reports
`result: "passed"`, `stage: "complete"`, all ten groups complete, and empty
`incompleteGroups`, `unexecuted`, and `pageErrors`. Its matching checkout was
`2622458c5e652febdfb1b065be1d1b33d84bdd5e` plus working-tree changes, with
fingerprint `b08ec90799f1b9d2edbf63946db7edba81a928a67b2730f70e9bff3e5db29f00`.
The then-untracked `scripts/fixtures/inlineLabelComposite.ts` and
`tests/scripts/inlineLabelComposite.test.ts` are included in that identity;
they are now tracked and preserved.

The independent review in `logs/codex/31D-review-summary.json` accepted the
halo/raster evidence, including formula detail at both zoom levels, and found
no production defect. It ran tests (2,356 passed), build, fixture TypeScript,
targeted lint, all five requested browser-script syntax checks and diff check
successfully. It used the matching parent browser evidence without repeating
the browser commands. Its one Medium finding identifies assertions that were
absent: the old 3D projection checks did not click markers, and editing mounted
a new document before recovering the invalid inline node. Ten completed groups
proved the old assertions passed, not these missing scenarios.

The preceding targeted coverage fix started from clean
`14875dbbf61a2a61e031a40261ab14037e63a43c` on
`phase/31d-tex-path-inline-labels`. It added assertions inside the existing two
inline groups:

- `inline-3d-interaction-initial-camera` and
  `inline-3d-interaction-moved-camera` retain one explicitly 3D document,
  renderer and runtime. Two curve owners have nonzero z coordinates,
  distinguishable sources and reused local IDs. Current marker geometry and
  SVG screen transforms drive real ordinary/Alt mouse clicks for both owners;
  Alt-clicks at their overlapping markers are required to reach both curve
  owners without an intervening reset. Independent probes reset by an
  actual blank-canvas click. Each click checks the selected `stratum` owner
  and exactly one callback; dot/non-dot markers and selected highlights are
  checked. A native filled-glyph point is proved outside every marker's
  10-unit tolerance and both curves' hit geometry before ordinary and Alt
  nonselection probes. Rotation, pan and zoom use the existing camera props
  path; marker motion is measured while owner identity, document revision,
  raw model/history/TikZ and conversion count remain unchanged. Camera,
  owner, marker/probe, callback and selection diagnostics plus screenshots
  distinguish both states.
- `inline-same-owner-valid-invalid-valid-recovery` extends `identityA/shared`
  before mounting the operations fixture. Observations and screenshots retain
  A-ready, B-fallback, C-pending, C-ready and a late obsolete failure. DOM
  handles verify continuous owner, marker and label mounting. Invalid B
  immediately removes A's compiled glyphs and displays all current literal
  fragments, including spaces, tab, CRLF, ordinary text and invalid math,
  without injecting markup. A distinct valid C is held by the production
  delivery hook, checked as whole-current-source pending literal output, then
  released to two current math runs and current measured layout. Source/font
  request identity, the same document/path/node owner, positions/options,
  marker and sibling isolation are checked at each stage. The inverted
  completion and obsolete-failure assertions remain; a late failure must not
  replace recovered glyphs or bounds.

Each deliberate text edit uses `mutateInlineNode`/`commitDiagramChange` and
must change only the intended text plus its normal undo entry. The harness
captures a new baseline immediately after each edit, then compares settlement
and delivery release against that baseline for serialized JSON, history,
selection and both TikZ modes. It does not require history to remain unchanged
across user edits. Existing Undo/Redo, 2D pointer tests, supported-path
projection, halo thresholds/negative controls, path operations, App workflows
and current SVG cloning remain in their original groups.

That coverage-fix child attempted `PATH=/opt/homebrew/bin:$PATH npm run check:free-labels`
under Node v26.9.0 with the external Playwright module and installed Chrome
executable. It exited 1 at `development-server-listen` because binding
`127.0.0.1:5173` returned `EPERM`, before browser launch. No browser version or
new scenario measurements were obtained; all ten groups remain unexecuted in
this attempt. The diagnostic report is
`/private/tmp/stz-phase31d-coverage-fix-browser/free-labels-evidence.json` and
its command log is `/private/tmp/stz-phase31d-coverage-fix-browser.log`.
This child restriction is separate from the prior successful parent run.
That preceding coverage-fix child verification under Node v26.9.0 passed the six requested
focused test files: **93 tests**, none failed or skipped (a subset of the full
suite). Strict fixture TypeScript, the five browser-script `node --check`
commands, targeted ESLint including changed `scripts/checkFreeLabelGeometry.mjs`,
and `git diff --check` all exited 0. Exact command arguments, exit statuses and
log paths are retained in
`/private/tmp/stz-phase31d-coverage-fix/focused-checks.json`. `npm test` exited
0 with **2,356 passing tests**, none failed or skipped; the 93 focused tests
are included in that total. `npm run build` exited 0 with the existing
chunk-size warning only. Full command arguments, exit statuses and logs are
in `/private/tmp/stz-phase31d-coverage-fix/full-checks.json`. No production
files changed; App/SvgDiagram's existing 10 lint errors and 4 warnings remain
out of scope, and repository-wide lint was not run. The final handoff at
`/private/tmp/stz-phase31d-coverage-fix/handoff.json` records that handoff's
tracked/untracked checkout identity. These are historical checks of the
coverage fix, not verification of the current candidate-cycle correction.

The subsequent parent **did execute** the added assertions under Node v26.9.0
and Chrome 153.0.8010.52, with the Vite fixture at `http://127.0.0.1:5174`.
Evidence is retained in
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-2KaWQt/`.
Its `verification.json` reports tests (2,356 passed), build, diff check and
`check:label-assets` exit 0; `check:free-labels` exits 1 at
`inline-node-production-rendering-and-path-lifecycle`. The unchanged checkout
was revision `14875dbbf61a2a61e031a40261ab14037e63a43c` plus five modified files,
with no untracked files, tracked diff SHA-256
`2f1d06c077ab8ff8fd908682260f1b18f43921c17138a23e2b7b4c36e7011c66` and fingerprint
`49077e86deb20d3f7fd111e2de41533f54848ae78481cdc2f9d79c7f3ac24a47`.
The free-label report retains 82 passing records and seven completed groups,
with no page errors. Its last checkpoint is
`inline-3d-interaction-initial-camera/overlap-alt-1`: two native Alt clicks
each selected `pick3dB` with exactly one replace-selection callback, failing
the expectation that two clicks must reach both owners. Independent ordinary
and Alt probes for both initial-camera owners, highlights, normal overlap and
blank reset reached their assertions. Both halo zoom matrices, all six
negative controls, transparent math, supported-path projection and 2D picking
passed. Initial-camera glyph probes, moved-camera interaction and same-owner
recovery were not reached; inline lifecycle/path/export and real-App groups
were unexecuted. Their implemented coverage remains preserved and required.

The current targeted correction starts from clean
`1f43eefe171c2c834060e10418aae80876ed0651`. The failed parent's `failure.png`
visibly reads `Selected 3/4: path "pick3dB"` after the second click. Production
cycles candidates, including distinct inline markers and curve bodies that
can select the same owner. The retained image supports advancement to index
2 of four candidates; the saved JSON lacks the ordered list and first-click
cycle feedback. Source reconstruction at the saved DOM marker center (and
its integer floor/round alternatives) gives
`pathInlineNode:pick3dA:overlap`, `pathInlineNode:pick3dB:overlap`,
`curve:pick3dB`, `curve:pick3dA`, predicting indices `1, 2, 3, 0, 1` and owners
`B, B, A, A, B` for one full cycle plus wrap. This reconstruction is not a
fresh native-browser measurement. It explains why the two-click/unique-owner
expectation is invalid under the existing candidate contract, without claiming
that the missing complete native trace has run.

At the saved DOM y coordinate `307.5735778808594`, curve B's reconstructed
distance is about `0.00000985` SVG units and curve A's is `0.00001502`.
Their exact projected center is `307.57359312880715`; the tiny difference is
enough to order the curve candidates by distance. The coincident 2D fixture
has zero distances, so its bodies sort A then B and the first two owners are
B then A. These source-only comparisons and explicit event-point hypotheses
are retained in `/private/tmp/stz-phase31d-alt-cycle/source-model-reproduction.json`
with a rerunnable `reproduce.mjs`; the next native trace records the actual
event coordinates instead of assuming a rounding rule.

The harness now verifies candidate membership/count before using that count
for one complete native Alt cycle plus wrap, with an explicit fixture maximum
of four candidates. It requires actual visible cycle feedback to advance,
stable ordered membership, both expected curve owners and exactly one callback
per click. A bounded read-only fixture observer retains actual event modifiers,
client coordinates, mapped SVG coordinates, fractional rounding, camera,
document/runtime continuity, candidate IDs/kinds/distances/owners and current
feedback before assertions. Marker/owner geometry is retained before and after
the sequence. Native clicks and independent geometry remain the acceptance
inputs; production selection priorities, tolerances, initial index and
candidate identity are unchanged. No production file or dependency changes.

The current child attempted the same browser command under Node v26.9.0 on an
intermediate diagnostic checkout, after adding the fixture observer but before
the bounded-cycle harness correction. It is not evidence for the final tree.
It exited 1 at `development-server-listen`: `listen EPERM` on
`127.0.0.1:5173`, before Chrome launched. All ten groups were unexecuted and
the report has no browser version or scenario measurements. This is a new
child startup restriction, separate from the executed parent B/B assertion.
Its report is `/private/tmp/stz-phase31d-alt-cycle-browser/free-labels-evidence.json`
and log is `/private/tmp/stz-phase31d-alt-cycle-browser.log`. The report records
only `scripts/fixtures/freeLabels.tsx` modified at revision
`1f43eefe171c2c834060e10418aae80876ed0651`. This restricted attempt does not
establish browser acceptance.

Current child checks with `PATH=/opt/homebrew/bin:$PATH` (Node v26.9.0) passed
all seven requested focused test files: **197 tests**, none failed or skipped,
included within **2,356 passing full-suite tests** from `npm test` (exit 0).
`npm run build` exited 0 with the existing nonblocking chunk-size warning.
Strict fixture TypeScript, all five browser-script syntax checks, the requested
targeted ESLint including the changed fixture, and `git diff --check` exited 0.
Exact commands/statuses/log paths are retained in
`/private/tmp/stz-phase31d-alt-cycle/focused-checks.json` and
`/private/tmp/stz-phase31d-alt-cycle/full-checks.json`. The regression is the
native full-cycle assertion; no production helper changed or new helper unit
test was added. The corrected halo oracle, its tests and all later assertions
are unchanged. Existing App/SvgDiagram lint debt remains outside this fix;
repository-wide lint was not run. Final tracked/untracked checkout identity
is recorded separately in `/private/tmp/stz-phase31d-alt-cycle/handoff.json`
so documenting the fingerprint does not itself change that fingerprint.

After this child handoff, the normal outer runner must perform complete parent
verification and then independent review. For standalone verification, the
authorized parent command is
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31D verify`
on the final tracked/untracked checkout. It must obtain an identified browser and
`passed`/`complete` evidence with all ten groups and no incomplete, unexecuted
or page-error entries, and retain the new records above. Historical parent
success does not verify the added assertions. The normal order remains fix,
parent verification, independent review; `verify` alone does not run review
or approve completion. 31E's settled-export waiting and 31F's combined audit
remain deferred.

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
The Phase 31E export changes and pending browser gate are described below;
Phase 31F remains deferred.

## Export SVG

The SVG export control is a sticky preview edge action at the lower-right of
the preview frame, next to the Layer control area and protruding below the
frame. Its background selector offers `Transparent background` (the default)
and `White background` before using `Export SVG`. The Preview workspace may
remain gray on screen; that editor-only background is not inherited by the
download. White export instead adds an explicit white rectangle covering the
exported viewBox behind the diagram.

Every click captures the currently committed view: diagram geometry, camera,
viewport, visible layers and filtering, label text and style, draw order, and
the selected background. The capture happens before waiting for conversion.
Editing, camera movement, layer changes, Undo/Redo, deletion, and document loads
remain available during preparation. They affect the next export; a pending
file retains its complete click-time view.

`Preparing SVG export…` appears in the accessible status area while the export
button is disabled and busy. Only one request may be pending; repeated clicks
are ignored, including clicks before the disabled state has committed. The
action is restored after success or failure. Success is reported after the
completed SVG has been handed to the browser for download. An infrastructure
failure reports `SVG export failed` and does not download malformed output.

Export settles every represented free label and path inline-node label through
the shared bounded conversion service and cache. Successful formulas use
self-contained SVG geometry alongside ordinary Unicode text. Failed labels
contain their complete captured source, including delimiters, backslashes,
markup characters, edge/repeated spaces, tabs, and physical newlines, as literal
SVG text. Unsupported input, undefined commands, parse/output errors, resource
failures, and exhausted work limits affect only their own labels. There is no
pending state in the downloaded file. This remains a bounded preview language,
not a full LaTeX engine.

Hidden layers and labels removed by `autoHide` are not awaited. Labels retained
by `autoDim` or layer filtering are settled and retain their captured opacity.
Resource loading and conversion use the adapter's finite-work limits, with a
bounded export wait also covering injected/outstanding services and fallback
font readiness. A transient resource failure does not poison future exports.

The exporter clones the committed SVG synchronously, captures immutable inputs
from the shared label renderer, and replaces the clone's label subtrees by
synchronously rendering their settled results with the same pure layout/view.
Server rendering places the shared label view inside an actual React SVG
wrapper. The parser validates and extracts its single direct label group; only
that group replaces the captured target, so the wrapper adds no final viewport.
It does not depend on a live React update committing after a conversion promise
resolves. It creates no temporary React root and never replaces live labels.
Request identities guard completion, status, cancellation, and cleanup; detached
nodes and download object URLs are released after their owning request.

Sanitization removes editor chrome, handles, cursor/work-plane guides, selection
and hover feedback, label hit rectangles, classes, and preview-only metadata.
Explicit paint, opacity, transforms, baseline/anchor placement, whitespace
layout, and path-label white outlines remain. Formula geometry uses local,
collision-free definitions/paths without application styles, remote fonts,
`foreignObject`, or bitmap formulas. Transparent output has no added background
rectangle; white output has exactly one behind the captured diagram.

SVG export is independent from TikZ export. Using `Export SVG` never changes the
diagram model, undo history, TikZ source, or TikZ export mode. The most recently
selected SVG background remains active for the current component lifetime, but
is export-only and is not included in saved diagram JSON.

Phase 31E's focused Node coverage is registered in `npm test`. The shared
`check:free-labels` harness now also requires `settled-SVG-export-standalone`.
It controls free/path conversion timing, edits text and font size through the
real Inspector during preparation, loads a changed 3D document, and downloads
both transparent and white files through the production action. It saves the
files and reopens them as standalone `file://` SVGs in browser pages without
the application. Assertions cover geometry/text, literal markup and whitespace,
colors, outlines, placement, references, backgrounds, overlays, duplicates,
visibility/dimming, retry after resource failure, and serialization failure.
SVG files, standalone screenshots, raster PNGs, and per-scenario observations
are retained with the existing browser evidence. The parent verifier requires
all eleven groups for 31E/31F and rejects older ten-group reports for these
phases; earlier phases retain their complete historical group sets.

The earlier parent run on 2026-09-21 failed **before independent review** at
`settled-export-autoDim-visibility`, source `$\frac{autoDim}{x}$`, because the
parsed export had zero observed formula paths. Node v26.9.0 and Chrome
153.0.8010.52 ran against the Vite production-component fixture. All ten
preceding groups completed (120 successful scenario records, no page errors),
including 31D candidate cycling and same-owner recovery. Only autoHide had
completed in the eleventh group; layerFilter, hiddenLayer, invalid-viewport
retry, actual App downloads and standalone reopen were not reached. The live
preview screenshot does not establish what the failed export contained.

The report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-r43lZG/verification.json`,
with checkout fingerprint
`0b8395cac3fad28b360ad8ac377f00bfdc086a2375a291d6273208aedefcc467`.
That report is historical; the subsequent parent result is described below.

The diagnostic follow-up added policy-specific diagnostics to the existing
harness before assertions: exact capture/source/owner/settings/style/camera,
source-filtered conversion identities and timestamps, the actual export
settlement outcome/deadline, pre-sanitization label markup, serialized SVG,
and separately identified live-preview SVGs. Exported label/foreground
namespaces, paths, other geometry, literal fragments, ancestor paint/opacity,
and standalone reopen screenshots/observations are retained. App download
observations are also persisted before their assertions. Diagnostics are not
passing scenario records. The exact-source foreground oracle rejects missing
math, whole-source fallback, unrelated paths, and halo-only geometry; the
original positive path assertion remains.

The earlier `r43lZG` autoDim cause cannot be recovered from its missing output.
At the diagnostic stage, the fixture's 20,000 ms versus the export boundary's
10,050 ms suggested a timing hypothesis; neither a string-rendering test nor
the live preview established the detached export's contents. The later
`Qku3Ld` run below measured successful conversion well within the deadline and
retained a title-only detached subtree, establishing its production failure.
Limits, hold/release order, cache ownership and visibility policy were not
changed to make the hypothesis pass. The diagnostic production addition is a
non-mutating optional runtime observer, with no model fields or UI controls.

The historical page-ownership parent verification is **failed/partial**:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-HVvae4/verification.json`.
It used Node v26.9.0, Chrome 153.0.8010.52 and Vite at `http://127.0.0.1:5174`,
with unchanged checkout fingerprint
`0f048c1fb81251ba0652e4335077c3e24418e21ad0468bf0b439511f68efcd34`
and tracked diff SHA-256
`4a33aa2a09b5e9b97b54f29e9cd8b4dc5bac1f7fe0f603b9de70a5cbdb2f78ff`.
Tests (2,390), build, diff and label-assets checks exited 0. Free-label acceptance
exited 1 after ten completed groups and 119 passing records, with no page errors.
The eleventh group failed at `settled-export-autoHide-failure` before reopening:
`page.context().newPage()` tried to add a page to the context implicitly owned
by the fixture's `browser.newPage()`. Playwright rejected that API use with
`Please use browser.newContext()`. This is a harness ownership error.

The retained `05-check-free-labels/artifacts/settled-export-autoHide-completed.json`
and companion capture/live/detached/serialized SVGs show successful preparation
in 8 ms, zero captured labels and source-specific requests, zero math paths,
and preserved live SVG. Those zero counts are correct for autoHide. No native
standalone page was created and no new visibility scenario passed. AutoDim,
layerFilter, hiddenLayer, invalid-viewport retry and actual App downloads were
not reached; the report's empty `unexecuted` list tracks started groups only.
It neither reproduces nor resolves the historical autoDim failure.

The ownership correction started from clean commit
`70c7548b5dd832b90acb5d6116f2055c507042e8`, which preserves the eleven-file
diagnostic handoff at `/private/tmp/stz-31e-diagnostic-checks/handoff.json`.
The harness now passes its browser to the visibility checks and opens the exact
saved SVG in an independent `browser.newPage()` with an explicit 1100×850
viewport. It records standalone errors, namespaces, geometry, opacity and bounds,
and closes only that page and its implicitly owned context in `finally`.
Navigation/assertion failures retain the policy, source, file path and error;
a cleanup error is recorded without replacing an original failure. The live
fixture stays open for subsequent policies. Production code, conversion limits,
pending-at-capture coverage, exact-source oracle/negative controls, 31D checks,
and the runner's eleven-group/review/commit gates are preserved.

Its child browser attempt exited 1 at Vite `listen EPERM` on
`127.0.0.1:5173`, before Chrome launch; all eleven groups were unexecuted.
This startup restriction is separate from both parent failures. Its exact
command/environment/log and checkout snapshot are retained in
`/private/tmp/stz-31e-page-ownership-jcajtsos/browser-check.json` and
`browser-artifacts/free-labels-evidence.json` in that directory. It verifies no
native reopen or autoDim outcome. The earlier child startup evidence remains
at `/private/tmp/stz-31e-diagnostic-start/free-labels-evidence.json`.

Historical ownership-fix commands, exit statuses and logs are retained in
`/private/tmp/stz-31e-page-ownership-jcajtsos/focused-static-checks.json` and
`full-checks.json`; final checkout identity is in `handoff.json` there.
With `/opt/homebrew/bin` first in `PATH`, Node v26.9.0 and npm 11.19.1 passed
115 focused tests, included in the full 2,390-test total, with no failures or
skips. Build exited 0 with the existing chunk-size warning. Strict fixture
TypeScript, six script syntax checks, targeted ESLint and diff checks exited 0.
No new helper/test file or dependency was needed for the ownership correction.

The historical full-page-capture parent verification is **failed/partial**:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-xlQmJP/verification.json`.
It used Node v26.9.0, Chrome 153.0.8010.52, external Playwright 1.62.1 and Vite at
`http://127.0.0.1:5174`. Revision `70c7548b5dd832b90acb5d6116f2055c507042e8`
and the pending snapshot were unchanged during verification: checkout fingerprint
`30d91d9fa20a47d12152c5d7e31923e35b103bba6c82917088e889293125a5df`,
tracked diff SHA-256
`d77a5cbf567c69135fbc48a7e39b5b2daf22b57ce63512647d4348c860e7733d`.
Tests (2,390), build, diff and label-assets checks exited 0; free-label acceptance
exited 1 after ten completed groups and 119 passing scenario records, with no
page errors. The independent autoHide page was created, navigated to the saved
SVG, and evaluated successfully, confirming that the ownership repair reached
this path. Its required `fullPage: true` screenshot then timed out after
30 seconds, after the log reported `fonts loaded`. The eleventh group remained
incomplete and no new standalone visibility scenario passed.

The retained `settled-export-autoHide-completed.json` and companion SVGs show
successful preparation in 1 ms, zero captured labels/requests (correct for
autoHide), preserved live SVG, and a 435-byte serialized SVG with width 900,
height 700 and `viewBox="0 0 900 700"`. The computed reopen result was lost
because it was written only after capture. Neither the normal standalone PNG
nor its attempted failure PNG exists; the diagnostic's failure image path was
only an intended path. `settled-export-autoHide-failure-live-preview.png` is
retained, but depicts the application, not the standalone export. AutoDim,
layerFilter, hiddenLayer, invalid-viewport retry and actual App downloads were
not reached. This screenshot failure does not resolve the older autoDim result.

Inspection of installed `playwright-core/lib/coreBundle.js` version 1.62.1
shows that `screenshotPage` finishes font readiness before its full-page branch.
That branch's `_fullPageSize` waits for both `document.body` and
`document.documentElement`; it returns no size while either is absent. The
export is an SVG XML document, so this is the source-supported explanation of
the timeout. The parent did not persist the reopened document's content type
or body state; the later `Qku3Ld` run below supplies those native measurements.

The bounded-capture follow-up starts from clean commit
`5f357d1b186302fda951ff073f2e32c68a34b2ce`, preserving the committed runner
changes. Both standalone visibility and actual-download reopening now use
`scripts/standaloneSvgCapture.mjs`. It records document URL/type/readiness,
root namespace/dimensions/viewBox/client bounds, parser errors, HTML-body
presence, viewport, scroll position and device pixel ratio. A finite viewport
may expand once, followed by remeasurement; coverage must contain the complete
SVG root, within an 8,192-pixel side limit and 16,777,216-pixel area limit.
Capture uses `fullPage: false`, `scale: 'css'` and a 5,000 ms timeout, retaining
font readiness and the unchanged standalone SVG. A PNG is recorded as retained
only after its file, PNG header and dimensions are checked against the measured
coverage. Existing export raster/background/color/halo assertions remain.

DOM, exact-source geometry/opacity, raster/request and image-attempt diagnostics
are persisted before image capture and assertions. Required capture failures
still fail the scenario; failure diagnostics retain the original error without
attempting a second screenshot. Independent pages retain their existing owned
resource cleanup, and cleanup failures do not replace primary failures. No
production, fixture, oracle, conversion-limit or runner change is part of this
capture correction.

The historical bounded-capture child reproduction opened no SVG: Chrome launch
ended with SIGABRT and cleanup logged `kill EPERM`, before navigation. Its saved
source hash, command error and stage are retained at
`/private/tmp/stz-31e-bounded-capture/native-reproduction.json`. That child run
alone supplied no document/body measurements, standalone PNG, autoDim
timing/geometry or App acceptance. Its launch restriction is distinct from the
executed parent failures and does not describe the subsequent `Qku3Ld` run.
With `/opt/homebrew/bin` first in `PATH`, Node v26.9.0 and npm 11.19.1 passed
128 focused tests, including 13 new capture-helper tests registered in
`package.json`; these are included in the full `npm test` total of 2,403, with
zero failures or skips. `npm run build` exited 0 with the existing chunk-size
warning. Strict fixture TypeScript, eight script syntax checks (the six existing
scripts plus the capture helper and its test), targeted ESLint and
`git diff --check` all exited 0. Exact commands, exit statuses and log paths are
retained in `/private/tmp/stz-31e-bounded-capture/checks.json`; the final checkout
identity and handoff are in `/private/tmp/stz-31e-bounded-capture/handoff.json`.

The historical parent verification was **failed/partial, before review**:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-Qku3Ld/verification.json`.
It tested revision `5f357d1b186302fda951ff073f2e32c68a34b2ce` with the four
modified tracked files and two untracked bounded-capture files recorded in
`05-check-free-labels/artifacts/checkout.diff` and `checkout-untracked.json`.
Checkout fingerprint
`1cfe1d338e653e6040d1922168cc25607c68778f4e6b651cb1989103aa35a80c`
was unchanged during verification. Node v26.9.0, Chrome 153.0.8010.52, external
Playwright and Vite at `http://127.0.0.1:5174` ran the checks. Tests (2,403),
build, diff and label-assets checks exited 0; free-label acceptance exited 1
after ten completed groups and 120 passing scenario records, without page
errors. AutoHide passed; autoDim failed on the missing foreground element's
namespace. Root/label-owner namespaces and XML parsing passed. The eleventh
group remains incomplete; `unexecuted: []` records started groups, not completion
of later layer-filter, hidden-layer, invalid-viewport/retry or App-download cases.

The retained autoDim capture owns source `$\frac{autoDim}{x}$`, color `#802080`
and effective opacity `0.24499999999999997`. Settlement reported `success` and
`ready` after 137 ms within its 10,050 ms budget, with one math SVG containing
12 groups, eight paths and one rectangle. Nevertheless,
`settled-export-autoDim-completed-label-2-before-sanitize.svg` contains only
the title, and `settled-export-autoDim-completed-detachedBeforeSanitization.svg`
already has no label paint or foreground. The final `-serialized.svg` is
472 bytes, containing sheet geometry and the formula's title. This is a
production subtree-loss defect before sanitization, not a conversion deadline
or selector-only failure. Existing whole-render-string tests missed it because
paths still appeared elsewhere in the rendered string.

The matching `settled-export-autoHide-standalone.json` and
`settled-export-autoDim-standalone.json` retain actual browser observations:
`image/svg+xml`, no HTML body, valid SVG namespace, no parser errors, and a
900×700 root completely covered by the 1100×850 viewport. Both corresponding
`-standalone.png` files exist with verified 1100×850 dimensions. Independent
page ownership and the bounded capture therefore passed on these visibility
paths. AutoDim still has no reopened foreground or bounds, so its saved PNG
does not establish formula fidelity. No external requests or standalone page
errors were observed. Policy-specific capture/live/detached/serialized SVGs,
completion records and failure diagnostics remain under that run's
`05-check-free-labels/artifacts/` directory.

That confirmed render boundary in `prepareSettledSvgExport()` rendered
`SvgTexLabelView` without a React SVG parent, then wrapped the finished string.
Installed React DOM 19.2.7 renders that case in HTML context and hoists the
title before its owning group. Parsing the string wrapper and selecting its
first child therefore replaced the captured label with only the title. An
actual React `<svg xmlns="http://www.w3.org/2000/svg">` parent must exist during
server rendering; adding its namespace afterward cannot restore SVG context.

The correction in `src/ui/svgSettledExport.ts` now uses
`renderSettledSvgLabelDocument()` for that React SVG context and
`extractSettledSvgLabel()` before `prepareSettledSvgExport()` imports/replaces
the captured target. Validation rejects parser errors, a wrong root/descendant
namespace, title-only or extra wrapper children, mismatched captured
source/request/owner/state, or missing title, paint, foreground, outline or
expected rendered runs. Literal fragments and math descendant structure are
checked against the settled result. The returned group retains the shared
renderer's title, placement/layout transforms, explicit paint/captured opacity, foreground
and separate glyph-local halo. Only the temporary wrapper is discarded;
successful math is not converted to fallback to conceal structural failure.
Actual conversion failures still use the complete literal source. Empty
labels and snapshots with zero represented labels remain valid. Invalid
structure makes preparation fail without a malformed download. The shared
renderer, pinned adapter, live preview, capture/settlement/cancellation policy,
authoritative model/history and TikZ source remain unchanged.

Two added tests in the already registered `tests/ui/svgSettledExport.test.ts`
reproduce installed React's bare-render title hoisting and exercise the
production SVG-context helper for successful math, Unicode, full-source literal
fallback, empty source and an inline halo. The native regression in
`scripts/fixtures/settledSvgBoundaryFixture.ts` calls the real
`prepareSettledSvgExport()` through parsing, extraction, replacement,
sanitization and final serialization. It inspects the selected subtree and
same captured owners in the final document, with source-specific geometry,
position/color/opacity, literal fragments/whitespace and separate foreground
and halo. A native control reconstructs the former bare-render/first-child
boundary through replacement, sanitization and final parsing: the selected
title and final SVG lack math although the intermediate document has paths.
Additional controls corrupt a valid foreground/structure and must be rejected;
they do not pass trivially because the original foreground is missing. The
native fixture's execution remains a parent gate.

The SVG-context correction child used `/opt/homebrew/bin` first in `PATH`,
Node v26.9.0 and npm 11.19.1 from starting revision
`d1b72b3240177dfa368b43255ca07fd5738e3920`. The requested eight focused test
files passed 130/130, included in the full `npm test` result of 2,405/2,405,
with no failed or skipped tests. The two added Node cases live in the already
registered export test file; `package.json` and the 13 capture-helper tests are
preserved. `npm run build` exited 0 with the existing chunk-size warning.
Strict fixture TypeScript, targeted ESLint including the new boundary fixture,
all eight requested script syntax checks, and `git diff --check` exited 0.
Exact commands/statuses and logs are retained in
`/private/tmp/stz-31e-svg-boundary/` as `focused-result.json`,
`npm-test-result.json`, `npm-build-result.json`, `fixture-typescript-result.json`,
`targeted-eslint-result.json`, `syntax-results.json` and their referenced logs.
Installed React DOM 19.2.7's bare-group versus SVG-parent reproduction is saved
in `react-context-reproduction.json` in that directory.
Those child results are separate from the historical 128/2,403 handoff and the
subsequent parent execution below.

The SVG-context correction child's installed Chrome launch through external
Playwright failed before creating pages with SIGABRT and cleanup `kill EPERM`.
Its log is `/private/tmp/stz-31e-svg-boundary/browser-startup.log`, with checkout
identity and checks in that directory's `handoff.json`. That child restriction
does not describe the subsequent parent execution.

The latest executed parent verification is **failed/partial, before review**:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31e-before-review-t7U6g3/verification.json`.
It tested revision `d1b72b3240177dfa368b43255ca07fd5738e3920` plus five modified
tracked files and the untracked boundary fixture, recorded in
`05-check-free-labels/artifacts/checkout.diff` and `checkout-untracked.json`.
The checkout was unchanged during verification, with fingerprint
`8eaf530b72fe06ff821eeb4e173e6abff5559bdfaa52f59aba68870189ad235b`.
Node v26.9.0, Chrome 153.0.8010.52, external Playwright and Vite at
`http://127.0.0.1:5174` ran the checks. Tests (2,405 passed, none failed or
skipped), build, diff and label-assets checks exited 0. Free-label acceptance
exited 1 after ten completed groups and 120 passing records, with no page errors.

AutoHide passed. AutoDim reached and passed exact source, SVG root/label/
foreground namespace, eight own foreground paths and finite positive bounds
(approximately 73.5561×29.8807) after reopening. Its pending captured label
settled `success`/`ready` in 148 ms within 10,050 ms; the 6,176-byte serialized
SVG retains the complete label group and formula geometry. Both policies saved
verified 1100×850 PNGs covering their entire 900×700 SVG root; autoDim's PNG is
6,541 bytes. Neither standalone page made external requests or reported errors.
These observations demonstrate the repaired label subtree for this executed
case; the historical `Qku3Ld` title-only defect did not recur.

The new blocker is strict equality across numeric representations: captured
`0.7 * 0.35` is `0.24499999999999997`, and that raw opacity attribute survives
detached rendering, sanitization and serialization unchanged. The native product
of `Number(getComputedStyle(ancestor).opacity)` is `0.245`, an absolute difference
of `2.7755575615628914e-17`. This is a harness comparison failure, not evidence
of a production dimming defect. The completed/standalone JSON, capture/live/
detached/serialized SVGs, PNGs and failure diagnostics remain in that report's
`05-check-free-labels/artifacts/` directory. AutoDim's later detached/oracle
assertions did not execute although their diagnostic observations were saved.
Layer filtering, hidden-layer exclusion, invalid-viewport retry, the native
boundary fixture and actual App download/reopen workflow remain unexecuted in
this run. `unexecuted: []` records started groups, not all assertions within them.

The follow-up uses `scripts/standaloneSvgOpacity.mjs` only for the harness
comparison between captured numeric opacity and the independent native
computed-style ancestor product. Both values must first be numbers, finite
and within `[0, 1]`; missing, null, non-numeric,
non-finite or out-of-range observations cannot pass by coercion. It then uses
an explicit absolute tolerance of `1e-12`, enough for the observed CSSOM
serialization/arithmetic difference on these fixtures. Production opacity,
capture and serialization are unchanged. Exact raw-attribute comparisons remain
exact, as do source, identity, count and namespace contracts; geometry checks
stay intact. The opacity regressions accept the reported pair and equal values
including zero and one, and reject missing dimming (`0.7` or `1`), doubled dimming (`0.08575`),
zero versus nonzero, and `2e-12`/`1e-10` drift in either direction. These errors
exceed the bound; the separate exact-source geometry oracle and its
valid-foreground negative controls
remain intact. A later material mismatch requires diagnosis, not a wider bound.
The existing standalone record now includes raw ancestor opacity attributes,
computed-style strings, the product and captured comparison/error/tolerance
before image capture. Four helper regressions in
`tests/scripts/standaloneSvgOpacity.test.mjs` are registered in `npm test`.

The opacity correction child's checks used `/opt/homebrew/bin` first in `PATH`,
Node v26.9.0 and npm 11.19.1, from revision
`4c1dd9faeca926cbbda81edb57f82ebe89fb26a1`. The nine focused files passed
134/134 tests, including the four comparator regressions; all are included in
the full `npm test` result of 2,409/2,409, with no failures or skips. Build,
strict fixture TypeScript, targeted ESLint including both added files, ten
script syntax checks and diff checks exited 0. Build retains the existing
nonblocking chunk-size warning. Logs and command results are retained under
`/private/tmp/stz-31e-opacity-comparison/` (`focused.log`, `npm-test.log`,
`npm-build.log`, `fixture-typescript.log`, `targeted-eslint.log` and
`syntax-results.json`); final checkout identity is recorded in `handoff.json`.
These are child checks, separate from pending parent browser verification.

Fresh complete matching parent verification remains required for the opacity
correction and all eleven groups, followed by independent review, which has
not run. This fix child leaves browser execution to the outer parent runner.
The production SVG-context regression and bounded screenshot helper remain
required: complete pre/post-sanitization label subtrees, all four visibility
policies, invalid-viewport retry, native boundary controls, actual transparent/
white App downloads/reopens and subsequent 3D view must execute successfully.
Neither the partial `t7U6g3` run nor historical `Qku3Ld` verifies this corrected
checkout. Standalone verification can use
`PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31E verify`;
it does not run review or establish approval. The fix → complete parent
verification → independent review order and commit/push gates remain unchanged.
Phase 31E is not complete and 31F remains deferred.

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
