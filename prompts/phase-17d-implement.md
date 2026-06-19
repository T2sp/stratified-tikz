# Phase 17D Implementation Prompt: Auto-detect color/style presets and SVG preview approximation

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```
## Project context

You are working on the StratifiedTikZ project.

Phase 16 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, concatenated paths, path templates, sheets, filled regions/sheets, curved surface primitives;
- custom work planes;
- camera controls;
- layer-aware TikZ output;
- layer manager operations;
- save/load;
- undo/redo;
- style editing in the Inspector.

Current limitation:

- The Inspector Style section has presets, but they are not freely user-editable.
- Users want editable presets and imported TikZ style references.
- Users want to import style information from `.sty` / `.tex` files containing `\tikzset`.
- However, generated TikZ should **not** inline a large `\tikzset{...}` block before `\begin{tikzpicture}`.
- Imported external style files should be referenced by comments/instructions only.
- User-created local style presets added inside StratifiedTikZ should be defined as options of `\begin{tikzpicture}`, not as pre-picture `\tikzset`.

Important conventions:

- UI/editor state should not be stored in `Diagram`.
- Diagram-level style presets and imported style references may be saved if they affect export.
- Generated TikZ should remain readable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve camera, work-plane, layer manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.


## Goal

Automatically detect useful style presets from imported `\tikzset` styles, especially color styles, and make them available in the Inspector Style Preset UI.

Also parse simple TikZ option bodies enough to approximate SVG preview for common color/opacity/line style options.

Important export rule:

- Export should use the imported style key and external load comments.
- Do not inline the imported `\tikzset` definition.
- Do not emit active `\input` by default.

## Prerequisites

Phases 17A-17C are complete.

## Scope

Implement:

- heuristics for detecting style preset kind/targets;
- automatic preset creation from imported styles;
- simple TikZ option preview approximation;
- UI display of imported presets;
- tests.

Do not implement:

- full TikZ option parser;
- TeX macro expansion;
- symbolic expressions;
- exact color model for all xcolor syntax;
- inlining `\tikzset`.

## Auto-detection heuristics

Detect likely color presets.

Signals:

- key contains `/color/`;
- options contain color-like tokens:
  - black;
  - white;
  - gray;
  - red;
  - blue;
  - green;
  - yellow;
  - orange;
  - purple;
  - opacity;
  - fill opacity;
  - draw opacity.

Detect likely node/point shape styles.

Signals:

- key contains `/shape/`;
- options contain:
  - circle;
  - rectangle;
  - draw=;
  - fill=;
  - inner sep;
  - minimum size.

Targets:

- color styles may target:
  - curve;
  - sheet;
  - region;
  - label;
  - point.
- shape styles may target:
  - point;
  - label/node.

Users should be able to adjust targets if simple UI exists. If not, use conservative defaults and report limitation.

## Preset creation

Imported style presets should appear in the same preset chooser as user presets or in a clearly separated imported section.

Display name should be readable.

Example:

```text
3cat: phys/1strata/color/x
3cat: phys/3strata/shape/L
```

Requirements:

- imported presets reference the imported style key;
- imported presets keep source file metadata;
- imported presets can be applied to compatible elements;
- imported presets should not overwrite user presets;
- duplicates handled deterministically.

## Preview approximation

Parse simple options to approximate SVG preview.

Supported MVP:

- `opacity=.4`;
- `fill opacity=.4`;
- `draw opacity=.4`;
- named colors:
  - black;
  - white;
  - gray;
  - red;
  - blue;
  - green;
- xcolor mix like `red!60`, `blue!40`, `gray!30` approximately;
- `dashed`;
- `dotted`;
- `densely dotted`;
- `thick`;
- `thin`;
- `line width=<...>` if easy.

If an option cannot be parsed:

- ignore it for preview;
- preserve it for TikZ export by keeping the imported style key.

## Applying imported presets

When applied:

- structured preview style updates where inferable;
- TikZ style key is stored as a custom/imported style reference;
- generated TikZ command includes the imported key;
- external load comment lists source file;
- no full `\tikzset` is emitted.

## Tests

Add tests:

1. `/color/` key auto-detected.
2. `/shape/` key auto-detected.
3. `opacity=.4` parsed.
4. `fill opacity` / `draw opacity` parsed.
5. `red!60` approximate preview color parsed.
6. `dashed`, `dotted`, `densely dotted` parsed.
7. `thick` parsed to line width approximation.
8. Imported preset appears in preset list.
9. Applying imported preset stores style key reference.
10. TikZ output uses imported key.
11. TikZ output includes external load comment.
12. TikZ output does not inline `\tikzset`.
13. Unsupported options ignored for preview but preserved for export.

## Documentation

Update docs:

- imported style detection is heuristic;
- preview is approximate;
- TikZ export preserves imported key;
- full definitions remain external.

## Preserve existing behavior

Do not regress:

- Phase 17A user presets;
- Phase 17B imported references;
- Phase 17C parser;
- SVG preview;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- detection heuristics;
- preview parser capabilities;
- target inference behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
