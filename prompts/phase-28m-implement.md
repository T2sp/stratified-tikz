# Phase 28M Implementation Prompt: Keep every multiline TikZ library instruction commented

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
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat lint as a required gate while the existing repository-wide lint debt remains.
## Project context

You are working on the current `main` branch of:

```text
https://github.com/T2sp/stratified-tikz
```

The current repository contains the relevant implementation areas:

- `src/ui/svgPreviewExport.ts` for SVG Preview export;
- `src/model/grids.ts` for compact grid/lattice geometry and validation;
- `src/rendering/SvgDiagram.tsx` and related rendering helpers for SVG Preview;
- `src/tikz/generateTikz.ts` for generated TikZ source;
- tests under `tests/`.

Preserve all current behavior unless this prompt explicitly changes it:

- SVG Preview remains the primary editing canvas;
- Export SVG remains a Preview edge action;
- 2D/3D camera, zoom, and pan behavior;
- layer visibility/filtering;
- coordinate anchors and coordinate refs;
- symbolic and work-plane-local coordinates;
- rectangular and honeycomb grids;
- standalone and inline-math TikZ export;
- inline-math output contains no blank lines;
- TikZ indentation remains 4 spaces;
- save/load and undo/redo.


## Goal

Fix generated TikZ package/library instructions so every physical line remains commented, including the second and later library lines after line wrapping.

Keep the current multiline formatting. Do not collapse the instruction to one long line merely to avoid the bug.

## Confirmed current issue

Inspect `emitRequiredLibraryComment(...)` and all helpers that format required TikZ libraries.

The current generator already emits several requirements as comments, but at least one path emits an active command such as:

```ts
lines.push("\\usetikzlibrary{3d}", "")
```

Other multiline library formatting can comment only the first physical line, leaving continuation lines active.

Generated preamble guidance must remain guidance/comments only.

## Desired output

Examples of acceptable commented formatting:

```tex
% Required TikZ libraries:
% \usetikzlibrary{
%     arrows.meta,
%     decorations.markings,
%     calc,
%     3d
% }
```

or, if the existing formatter groups libraries differently:

```tex
% \usetikzlibrary{arrows.meta,
%     decorations.markings,
%     calc,
%     3d}
```

The exact wrapping style may remain unchanged, but **every non-empty physical line belonging to the instruction must begin with `%`**.

No second/subsequent library line may become active TeX.

## Central helper

Create or reuse one central helper, for example:

```ts
commentEveryPhysicalLine(lines: readonly string[]): string[]
formatCommentedTikzLibraryInstruction(libraries: readonly string[]): string[]
```

Requirements:

- deterministic order;
- de-duplicate library names;
- preserve existing line wrapping;
- prefix every physical continuation line;
- do not double-comment lines already intentionally commented;
- keep section-spacing behavior separate from command commenting.

Avoid fixing only `3d`; all current and future required-library combinations should use the safe helper.

## Required-library collection

Audit all current library sources, including where applicable:

```text
3d
arrows.meta
decorations.markings
calc
spath3
shapes.geometric
shapes.symbols
```

and any other current required libraries.

Keep existing conditions and headings. The bug fix is about safe comment formatting, not enabling extra libraries unnecessarily.

## Standalone mode

In standalone TikZ output:

- all package/library instructions remain comments before the picture;
- no active `\usetikzlibrary` command should be introduced by requirement guidance;
- preserve readable blank-line separation.

In particular, `requiresTikz3dLibrary` must not emit an uncommented active command.

## Inline-math mode

Preserve the inline-math invariants:

- setup guidance is inside the `tikzpicture` only according to current project policy;
- no blank lines;
- no double-comment corruption;
- every library instruction continuation remains commented;
- 4-space indentation remains intact where applicable.

## Tests

Add focused tests.

1. One required library produces a fully commented instruction.
2. Two required libraries preserve line breaks and every instruction line starts with `%`.
3. Three or more required libraries preserve line breaks and every instruction line starts with `%`.
4. `3d` requirement is commented.
5. `spath3` requirement is commented.
6. non-circular point-shape libraries are commented.
7. arrows + markings combination is fully commented.
8. calc + 3d + arrows/markings combination is fully commented.
9. Duplicate library requirements are emitted once.
10. Library order is deterministic.
11. No active `\usetikzlibrary` occurs in the requirements section.
12. A regex over the requirements section confirms every non-empty physical line is commented.
13. Standalone output keeps current readable line breaks.
14. Inline output has no blank lines.
15. Inline output does not double-prefix comments incorrectly.
16. Actual drawing commands remain active.
17. External TikZ style load comments remain unchanged.
18. Existing generated TikZ snapshots/examples are updated only where the old output was unsafe.

A useful invariant assertion:

```ts
for (const line of requiredLibrarySectionLines) {
  if (line.trim() !== "") {
    expect(line.trimStart().startsWith("%")).toBe(true);
  }
}
```

## Documentation

If docs show generated library instructions, update examples so every continuation line is commented.

## Report after implementation

Please report:

- files modified;
- exact root cause;
- central comment-formatting helper;
- library collection/order policy;
- standalone behavior;
- inline behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
