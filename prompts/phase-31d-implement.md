# Phase 31D Implementation Prompt: Path inline-node TeX labels through the shared SVG renderer

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

Phases 31A through 31C must be complete. Reuse their parser, adapter, cache,
literal fallback, lifecycle protection, and layout rather than implementing
a second MathJax pipeline.

This subphase adds typesetting to path inline-node `text`. It preserves the
existing path-node marker and selection semantics. It does not add attached
stratum labels or change saved-path `pathLabel` identifiers.

## Goal

Free labels and labels attached to path inline nodes use the same TeX support
and exact-source fallback behavior, while retaining their different existing
placement and interaction policies.

## Required reading before implementation

Inspect at least:

- `AGENTS.md` and the Phase 31A–31C prompts/implementation;
- `prompts/phase-27b-implement.md` and its current applicable review/fix contract;
- `src/model/pathInlineNodes.ts` and inline-node types;
- `src/rendering/svgPathInlineNodes.ts`;
- `src/rendering/SvgDiagram.tsx`, especially `renderPathInlineNodePreview`;
- `src/rendering/svgHitTesting.ts`, especially path-node candidate collection;
- path editing, splitting, reversal, duplicate, and inline-node Inspector paths;
- `src/tikz/generateTikz.ts` inline-node emission;
- relevant model/rendering/selection/TikZ tests and `package.json`.

Currently the inline-node preview computes a projected marker center and a
14-unit placement offset, limits preview nodes, renders text at font size 12,
uses a white outline, and places the group under `pointerEvents="none"`.
Overlap/Alt-click picking is based on the node marker and selects its owning
curve. Preserve the current contract after inspecting the actual code.

## Shared renderer integration

Replace only the label's visible text subtree with the shared renderer. Pass
the inline node's original text, projected placement, current font/color, and
its anchor/baseline presentation as explicit inputs.

Requirements:

- Support `above`, `below`, `left`, `right`, and `center` placement using actual
  measured label bounds and the existing marker-relative offset semantics.
- Preserve font size 12 and current inline-label colors unless an existing
  style path specifies otherwise.
- Preserve the white outline/halo for both ordinary text and formula geometry.
  Apply outline widths in display units; do not apply a 3-unit stroke blindly
  inside a differently scaled MathJax viewBox.
- Do not fill in fraction gaps, counters, or thin formula details accidentally
  while implementing the outline. Any duplicate outline layer is decorative,
  non-interactive, and cannot generate duplicate accessible content.
- Keep marker geometry, marker selection highlight, and marker placement intact.
- Keep empty/whitespace-only node text behavior and the existing preview-node
  limit unless an explicit regression demonstrates a required local fix.
- Continue using geometry-derived projected node positions on all currently
  supported paths, in both 2D and 3D.

## Interaction and request identity

The typeset glyphs must not become independent hit-test objects. Keep the
existing pointer-events policy and owning-curve selection behavior. Preserve
the existing marker-centered candidate tolerance and overlap-cycle priority;
31C's free-label picking policy must not be reused indiscriminately here.

Key runtime requests by enough identity to distinguish document, owning path,
inline-node ID, and current source/settings. Inline-node IDs need not be
globally unique across all paths. Deleting, splitting, reversing, duplicating,
or replacing a path must not apply a stale result to an unrelated node.

Text changes must immediately follow the current-source pending/failure rule.
Position-only changes, reversal, and camera motion reuse valid conversion
results while updating placement. Label conversion does not change node `pos`,
options, marker state, model identity, or TikZ source.

Make settled results available through the same revision-aware interface that
31E will use for free labels. Do not create a second export-only registry.

## Tests

Register every new Node test file in `npm test` and add focused browser coverage
to the production harness introduced/used by 31C.

Cover:

1. Valid inline-node math, mixed text/math, ordinary text, and Japanese text.
2. Each of the five placements with a tall fraction and multi-run label.
3. Raw fallback for invalid delimiters, unsupported commands, and adapter errors.
4. Exact-source whitespace/newline behavior and unaffected sibling node labels.
5. White outline appearance at more than one zoom level, with correct inner
   glyph color and no opaque formula background.
6. Dot/non-dot markers and selected/unselected curves preserve current behavior.
7. Ordinary pointer handling and marker-centered Alt-click/overlap cycling
   still select the owning curve; glyphs are not new selection targets.
8. Reused inline-node IDs on different paths, duplicate, split, reversal,
   deletion, document replacement, and delayed conversion completion.
9. Font/layout changes settle to the current request, while placement/camera
   changes do not recompile unchanged TeX.
10. The existing node-preview cap and empty-text behavior are retained.
11. Save/load, Undo/Redo, path operations, and generated `node[pos=...]` TikZ
    retain the same raw text and data semantics.
12. Existing SVG export includes settled inline-node formulas and current raw
    fallback; the new wait/snapshot policy remains deferred to 31E.

Use actual rendering/interaction evidence for outline and picking. A fake DOM
or a test asserting the component name occurs in source is insufficient.

## Documentation

Extend the TeX-label preview documentation to path inline nodes, with an example
and whole-label error fallback. State that saved-path names and UI captions are
not typeset. Mark 31D complete in the roadmap only after its checks pass.

## Report after implementation

Report changed files, reuse of the shared service/component, placement mapping,
outline handling, node request identity, retained marker/picking behavior,
path-operation regression evidence, tests/browser checks, build/diff-check
results, and the remaining 31E/31F work.
