# Phase 17C Implementation Prompt: Limited tikzset parser for style import

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

Implement a limited parser/importer for `.sty` / `.tex` files containing `\tikzset` style definitions.

The parser should extract style keys and option bodies so they can become imported style references/presets.

Important export rule:

- Do not inline the parsed `\tikzset` block into generated TikZ.
- Generated TikZ should only include comments instructing the user to load the source file externally, as implemented in Phase 17B.

## Prerequisites

Phases 17A and 17B are complete.

## Scope

Implement:

- file import UI for `.sty` / `.tex`;
- limited `\tikzset` parser;
- extraction of style keys and option bodies;
- imported style reference creation;
- safe error/skipped-entry reporting;
- tests using representative `\tikzset` text.

Do not implement:

- full TeX parser;
- macro expansion;
- `\input` resolution;
- evaluation of TeX conditionals;
- `\foreach`;
- inlining full `\tikzset` in output;
- new dependencies.

## Supported syntax

Support common style files like:

```tex
\tikzset{
  3cat/.cd,
    phys/1strata/color/x/.style={
      red!60,opacity=.4
    },
    phys/3strata/shape/L/.style={
      circle,
      draw=black,
      thick,
      fill=white,
      inner sep=1.5pt
    }
}
```

Required parsing features:

- multiple `\tikzset{...}` blocks;
- `.cd` prefixes;
- keys ending in `/.style={...}`;
- nested braces in option body where simple enough;
- comments skipped where practical;
- comma-separated top-level entries.

Expected extraction:

```text
key: 3cat/phys/1strata/color/x
options: red!60,opacity=.4
```

Do not require support for every TeX construct.

Unsupported constructs should be skipped safely with warnings.

## Import UI

Add UI:

```text
Import TikZ style file
[Choose .sty/.tex]
```

After import, show:

- source file name;
- number of styles imported;
- number skipped;
- list of imported style keys.

The source file text itself does not need to be saved in full unless needed. Prefer storing:

- source file name;
- extracted keys/options;
- optional load hint.

Generated TikZ comments should point to the source file name.

## Safety

The file is text input.

Do not execute TeX.

Do not fetch external files.

Do not resolve `\input`.

Do not eval JavaScript.

## Tests

Add tests:

1. Parser extracts one simple `/.style`.
2. Parser handles `.cd` prefix.
3. Parser extracts multiple styles.
4. Parser handles multiline option body.
5. Parser handles comments if implemented.
6. Parser skips unsupported malformed entries safely.
7. Import creates external source metadata.
8. Import creates imported style references.
9. Generated TikZ still does not inline `\tikzset`.
10. Generated TikZ includes only load comments.
11. Duplicate keys handled deterministically.

## Documentation

Update docs:

- parser is limited;
- no TeX macro expansion;
- no `\input` resolution;
- output uses external-load comments, not inlined `\tikzset`.

## Preserve existing behavior

Do not regress:

- user presets;
- imported style references;
- TikZ output;
- SVG preview;
- save/load.

## Report after implementation

Please report:

- files modified;
- parser capabilities;
- unsupported syntax handling;
- import UI behavior;
- storage model;
- tests added/updated;
- test results;
- build results;
- limitations.
