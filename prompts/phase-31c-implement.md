# Phase 31C Implementation Prompt: Free-label SVG rendering, measured placement, and picking

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run repository-wide lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report existing lint debt separately; do not turn this subphase into unrelated
cleanup. Run any additional focused checks required below. Never report an
unavailable check as passed.

## Project context

You are working on StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

This prompt series was prepared from public `main` at commit
`1a49d02a7ade18ecf08c4b4f1e22414e740970bb`, following Phase 30.
Inspect the current checkout before making changes; named files are starting
points, not an exhaustive change list. Preserve later compatible work.

Phase 31 consists of these ordered subphases:

| Subphase | Responsibility |
| --- | --- |
| 31A | Label input grammar and exact-source fallback contract |
| 31B | MathJax-to-SVG adapter, metrics, isolated conversion, and cache |
| 31C | Free-label rendering, asynchronous lifecycle, placement, and picking |
| 31D | Path inline-node labels through the shared renderer |
| 31E | Settled-label SVG export and standalone SVG fidelity |
| 31F | Combined regression coverage, documentation, and completion audit |

Implement or review only the subphase named in this file. Later subphases are
not acceptance requirements for earlier ones. Every subphase must leave the
existing application usable and its own verification passing.

Preserve these project conventions and existing behaviors:

- strict TypeScript; avoid `any`;
- an n-stratum means codimension n, not geometric dimension;
- separate model, geometry, rendering, TikZ generation, and UI;
- small, testable helpers and behavior-level tests;
- the SVG Preview editing canvas, 2D/3D projection, pan, zoom, and work planes;
- layer filtering, visibility, locking, selection, and existing edit gestures;
- coordinate anchors/references and symbolic coordinates;
- save/load, existing history semantics, and Undo/Redo;
- human-readable TikZ, 4-space indentation, and blank-line-free inline-math output;
- transparent/white SVG export and removal of editor-only overlays.

## Phase 31 shared contract

Only user-authored visible diagram labels are typeset: free `TextLabel.text`
and path inline-node `text`. Coordinate names, axes, handles, toolbar copy,
and saved-path `pathLabel` identifiers are not TeX labels for this feature.
Do not add new visual uses of previously undisplayed stratum label metadata.

Keep the original input authoritative in the model and editor. Do not add
math delimiters, trim the saved string, change the JSON schema, or rewrite
TikZ source. Existing TikZ export-mode formatting remains unchanged. Generated
SVG, parsed runs, errors, metrics, caches, and pending requests are derived
runtime state and must never enter `Diagram` or undo history.

The bounded preview language supports ordinary Unicode text mixed with
`$...$`, `\(...\)`, `$$...$$`, and `\[...\]` math runs. The exact scanner and
escaped-literal rules are defined in Phase 31A. MathJax is a math typesetter,
not a full LaTeX engine. Arbitrary packages, document preambles, external
style-file macros, and unsupported text-mode commands are outside this phase;
an unsupported label falls back to its complete original source.

For an invalid delimiter, unsupported construct, undefined math command,
TeX parse error, output error, resource failure, or bounded-work failure:

```text
failed label -> latest original input, displayed literally in full
```

Never show an error SVG, a replacement message, a partly typeset label, or a
previous successful formula in place of a failed current label. Preserve
delimiters, backslashes, leading/trailing/repeated spaces, tabs, and physical
newlines in literal fallback. Insert original input as text, never HTML.
The failure of one label must not suppress other labels or diagram geometry.
Pending labels also show their latest source until their own result is ready.

Successful output uses SVG geometry plus ordinary SVG text for text runs;
avoid `foreignObject` and rasterized formulas. Keep geometry self-contained,
colors explicit, and dimensions finite. MathJax-generated markup is not a
license to insert arbitrary user HTML or SVG.

Each label's rendering, bounds, and picking must describe the same input
revision. No stale completion may resurrect a deleted label or overwrite a
newer input, document, selection, or style state. Moving the camera or label
must not recompile unchanged TeX.

## Prerequisites and scope

Phases 31A and 31B must be implemented and reviewed. Inspect their actual
parser/adapter interfaces rather than creating competing conversion helpers.

This subphase integrates free `TextLabel.text` into the production Preview,
including race-safe rendering, measured placement, and picking. Path inline
nodes remain for 31D. Waiting for settled labels during SVG export remains
for 31E; the existing export must still correctly clone the currently visible
SVG, including pending-source fallback, without losing settled formulas.

## Goal

Show compiled SVG for valid free-label math and the exact current source for
every failed or pending free label. Preserve the editing experience, including
clicking the actual displayed label and moving it in 2D/3D.

## Required reading before implementation

Inspect at least:

- `AGENTS.md` and the Phase 31A/31B implement/review prompts;
- the Phase 31 parser, adapter, immutable results, metrics, and cache;
- `src/rendering/SvgDiagram.tsx`, especially `renderLabel`;
- `src/rendering/svgStyle.ts`, especially `svgLabelAnchorPlacement`;
- `src/rendering/svgHitTesting.ts`, especially free-label bounds and cycling;
- `src/rendering/svgPreviewPolicy.ts` and label occlusion/visibility preparation;
- `src/rendering/svgProjection.ts` and `src/rendering/svgViewBox.ts`;
- `src/ui/selection.ts`, `src/ui/layerFilter.ts`, and relevant App event paths;
- `src/ui/svgPreviewExport.ts`;
- existing rendering, selection, and layer tests; `package.json`.

Current free labels use `style.fontSize * 1.35`, nine anchors, and an outer
group holding selection, layer opacity, pointer policy, and occlusion metadata.
The current hit-test width uses `label.text.length * fontSize * 0.58`; it is
not a usable estimate for typeset TeX.

## Shared production renderer

Introduce a small SVG label component, for example
`src/rendering/SvgTexLabel.tsx`, plus pure layout helpers. Give it explicit
source, position, font, color/opacity, anchor/baseline, and presentation inputs
so 31D can reuse it for inline nodes. Avoid coupling it to the full diagram.

Keep render-time React calculations pure. Perform asynchronous work through
an appropriate hook/controller and the 31B service, not directly inside a
render function. Do not add Hooks to the existing ordinary `renderLabel`
helper; use a proper component or a stable parent-owned service.

Render ordinary text and compiled math in one SVG group. Preserve the run
sequence and align baselines within each physical line. Compute the label's
overall bounds from text measurements and normalized math metrics. Use the
font actually used for text; handle its readiness deterministically.

Follow 31A's newline distinction: ordinary text and literal fallback create
visual label lines; a newline inside a math body remains part of that formula
and is laid out by MathJax. Do not split matrix or multi-line TeX source into
separate label lines before conversion.

The display SVG must contain only normalized, self-contained output. Use
explicit color/currentColor context and avoid external CSS selectors needed
for essential appearance. Do not insert raw source with `innerHTML`.

## Literal-source rendering

Provide one literal renderer for parser failure, adapter failure, and pending
state. It renders the complete latest source, not parsed text or partial math.
Preserve visible spacing and line breaks with explicit SVG whitespace/line
handling, such as `xml:space`, appropriate `white-space`, and per-line `tspan`
positions. Define tab stops consistently. Do not lose CRLF source identity
even when rendering it as a single line break.

Retain raw source as an accessible label or title for typeset SVG as useful;
do not duplicate visible text over the formula. Empty labels stay empty.

## Asynchronous lifecycle

Model a derived label result with at least source identity and a current
pending/ready/fallback state. The current identity includes the source and
every setting that affects conversion or text measurement.

Requirements:

- On an input change, immediately display the new source unless a valid cached
  result for that exact request already exists.
- Never show a last-good formula for a now-invalid source.
- Associate every completion with its request generation; discard obsolete
  results after edits, deletion, document replacement, or unmount.
- Reused model IDs across imported documents must not validate an old request.
- Do not let an obsolete failure reset a newer successful result.
- Cleanup subscriptions/DOM ownership and avoid state updates after unmount.
- Use current placement, color, and opacity when a result arrives; do not
  restore values captured by an old request.
- Reuse immutable cache results; do not share a mutable SVG DOM node between
  two labels.
- Selection, dragging, pan/zoom, and 3D camera changes must not recompile TeX
  whose conversion inputs have not changed.
- A font measurement change may update layout without corrupting math cache
  identity or overwriting a newer source.
- Conversion or measurement failures leave finite literal fallback bounds.

Expose enough revision-aware settled-result state for 31E export preparation.
Do not implement a global mutable cache whose result changes without React
subscription/update notification.

## Measured placement and bounds

Add one pure layout calculation consumed by both rendering and picking.
Given normalized run dimensions, physical line layout, font size, and anchor,
return the local label bounds and transforms relative to the projected model
position.

Requirements:

- Preserve the established font-size scale.
- Respect all nine `LabelAnchor` values using actual width/height, including
  tall fractions, descenders, multi-line fallback, and mixed text/math.
- Keep center, north/south, and east/west anchoring geometrically consistent;
  do not apply the old half-font-height offset again on top of measured bounds.
- Position follows existing model-to-screen projection and camera transforms.
- Source fallback and successful output each use their own current bounds.
- Unknown/zero/empty metrics never create NaN, Infinity, or enormous hit areas.
- Preserve current picking tolerance and priority policy where applicable.

Update the free-label hit-testing/cycling call path to consume the same
revision-matched bounds used by the renderer. Thread a readonly runtime bounds
snapshot through rendering/UI services as needed; do not store it in `Diagram`.
Do not continue using the raw TeX character count after compilation succeeds.

## Existing interaction and visibility

Preserve the existing outer group's selection callback and layer/occlusion
policy. Keep selected-position markers and drag handles editor-only.

Test ordinary click and overlap cycling with compiled and fallback labels.
Honor locked/hidden/filtered layers and `autoHide`/`autoDim` without giving
hidden labels selectable geometry. A formula's internal paths must not
introduce separate selectable objects or duplicate click events.

Do not convert coordinate names, axis captions, selection feedback, grid
metadata, or handle tooltips. Do not modify attached-stratum-label behavior.

## Tests

Add focused layout/lifecycle tests and an actual browser integration check.
Register new Node test files explicitly in `npm test`; use the existing browser
harness if available, otherwise justify a minimal development-only harness.

Cover:

1. `$F^{(1)}L$`, `$\alpha \colon f \Rightarrow g$`, fractions, mixed Japanese
   text/math, multiple runs, and physical line breaks.
2. Parse errors, undefined macros, output/load errors, and input-limit failure
   render exact source; one failed label does not affect its siblings.
3. Leading/trailing/repeated spaces, tabs, `<>&`, quotes, and backslashes in
   fallback are literal and preserved visually as specified.
4. All nine anchors, font-size changes, explicit color, opacity, and tall math.
5. Drawing and hit-test bounds agree in 2D and 3D and after pan/zoom.
6. Click, overlap cycling, locked layers, hidden layers, autoHide/autoDim,
   selected markers, and dragging retain existing semantics.
7. Controlled completion inversion, valid-invalid-valid editing, deletion,
   imported documents reusing IDs, and unmount never apply stale results.
8. Duplicate labels render simultaneously without shared DOM/ID corruption.
9. Moves, camera changes, selection, and color changes reuse valid conversion
   results; verify invocation counts, not arbitrary timing alone.
10. JSON, Undo/Redo, and both TikZ outputs are unaffected by result arrival.
11. Existing SVG export preserves settled formulas and current literal fallback
    before the 31E waiting policy is introduced.

Real browser verification must exercise the production renderer and selection
handler; source-text assertions and fake SVG alone are insufficient evidence.

## Documentation

Document free-label preview behavior, pending/error fallback, supported scope,
and retained raw editing in `docs/PREVIEW_UI.md`. Update only the completed
31C roadmap entry. Explicitly leave inline-node integration and settled export
for 31D/31E.

## Report after implementation

Report files modified, runtime state ownership, stale-result protection,
measurement/anchor policy, picking integration, preserved interactions, cache
reuse evidence, tests and browser evidence, build/diff-check results, and
remaining deferred work.
