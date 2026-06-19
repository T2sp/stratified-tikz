# Phase 18B Fix Prompt: Remove all blank lines from inline math TikZ output

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

Also run if available:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 18B implemented inline math TikZ export.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority test coverage issue remains.

## Medium issue

Inline math output still contains blank lines.

Review notes:

- `src/tikz/generateTikz.ts` routes inline output through `section(...)`.
- `section(...)` inserts empty lines.
- Additional inline helpers append empty string lines, for example:
  - local colors/styles;
  - camera/library comments;
  - other section helpers.
- A targeted check found:
  - 28 blank lines in representative 2D inline output;
  - 32 blank lines in representative 3D inline output.

This violates the align-safe requirement.

Inline math output is intended for use inside math environments such as:

```tex
\begin{align}
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    ...
  \end{tikzpicture}
  &=
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    ...
  \end{tikzpicture}
\end{align}
```

Blank lines inside such snippets can create paragraph breaks and errors in math environments.

## Low-priority issue

The current tests do not assert the no-blank-lines invariant for inline math output.

This allowed the issue to pass.

## Goal

Fix inline math TikZ generation so that:

- `exportMode: "inlineMath"` emits no blank lines anywhere;
- standalone output formatting remains unchanged;
- readability in inline mode is preserved with comment separator lines instead of empty lines;
- tests assert the no-blank-lines invariant for representative 2D and 3D outputs.

## Scope

This is a targeted Phase 18B fix.

Implement:

- blank-line-free inline formatter;
- inline-mode-safe section/comment helpers;
- removal/filtering of empty string lines from inline output;
- tests asserting no blank lines for representative inline outputs.

Do not implement:

- new export modes;
- new geometry;
- new style features;
- new UI features;
- broad TikZ generator rewrite;
- LaTeX compilation;
- new dependencies.

Do not change:

- standalone output formatting, unless absolutely necessary;
- standalone setup placement;
- inline baseline behavior;
- inline setup placement;
- layer-aware TikZ semantics;
- camera export semantics;
- imported external style comment policy;
- local user style behavior;
- SVG preview;
- save/load;
- undo/redo.

## Required inline formatting invariant

For inline math output, no line may match:

```text
^\s*$
```

In other words:

- no empty lines;
- no whitespace-only lines;
- no leading blank line;
- no trailing blank line;
- no blank line between sections.

This should be true for all inline exports:

- 2D;
- 3D;
- with colors;
- with local user presets;
- with imported style comments;
- with layers;
- with camera setup;
- with filled regions/sheets;
- with paths/surfaces.

## Preserve readable section separation with comments

Do not make inline output an unreadable wall of commands.

Use comment separators instead of blank lines.

Preferred style:

```tex
\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
  %----------------------------------------
  % Local colors
  %----------------------------------------
  \definecolor{...}{HTML}{...}
  %----------------------------------------
  % Local styles
  %----------------------------------------
  \tikzset{...}
  %----------------------------------------
  % Layers
  %----------------------------------------
  \pgfdeclarelayer{...}
  \pgfsetlayers{...}
  %----------------------------------------
  % Drawing commands
  %----------------------------------------
  ...
\end{tikzpicture}
```

Comment lines are allowed.

Blank lines are not.

## 1. Inspect current TikZ generator section helpers

Inspect:

- `src/tikz/generateTikz.ts`;
- `section(...)`;
- helpers that return arrays of lines;
- helpers that append `""`;
- local colors/styles emitters;
- camera/library comment emitters;
- layer emitters;
- imported style comment emitters;
- final output join logic.

Find all paths used by `exportMode: "inlineMath"` that can introduce empty lines.

The review specifically mentions:

- `section(...)` around line 452;
- `section(...)` inserting empty lines around line 2436;
- inline helpers appending `""`.

## 2. Add an inline-safe line joining / filtering strategy

Add a clear formatting strategy.

Acceptable approaches:

### Option A: Mode-aware section helper

Make `section(...)` mode-aware.

For standalone mode:

- keep existing behavior with blank lines if desired.

For inline math mode:

- do not insert empty lines;
- use comment separator lines instead.

Example:

```ts
section(title, lines, { exportMode }) {
  if (exportMode === "inlineMath") {
    return [
      "%----------------------------------------",
      `% ${title}`,
      "%----------------------------------------",
      ...lines.filter(isNonBlankLine),
    ];
  }

  return [
    "",
    `% ${title}`,
    "",
    ...lines,
    "",
  ];
}
```

Exact formatting can differ.

### Option B: Final inline sanitizer

After building inline output, run a final helper:

```ts
removeBlankLinesForInlineMath(output)
```

or build with:

```ts
joinTikzLines(lines, { allowBlankLines: false })
```

This is acceptable only if it does not remove meaningful content.

Preferred:

- combine mode-aware section helpers with a final guard/sanitizer.

### Option C: Dedicated inline builder

Route inline output through a dedicated builder that never appends blank lines.

This is acceptable if not too broad.

## 3. Remove or guard empty string lines from inline helpers

Any helper used by inline output should avoid appending `""`.

Examples to inspect:

- local colors/styles helpers;
- imported external style comment helpers;
- camera setup helpers;
- library comments;
- layer setup helpers;
- coordinate sections;
- draw sections.

Required:

- helpers may return empty arrays when nothing is needed;
- helpers should not return arrays containing `""` in inline mode;
- final inline output should have no blank lines even if some helper accidentally returns `""`.

## 4. Preserve standalone formatting unchanged

Standalone mode should remain the traditional readable output.

Required:

- standalone output may keep blank lines;
- standalone tests should not be rewritten to match inline formatting;
- avoid changing standalone output unless there is a bug.

Add or keep a regression test that standalone output remains unchanged or semantically equivalent.

## 5. Preserve Phase 18B inline setup behavior

Do not regress what Phase 18B got right.

Inline output should still:

- start directly with `\begin{tikzpicture}`;
- include:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

- emit no active setup before `\begin{tikzpicture}`;
- place `\definecolor` inside the picture;
- place local user preset `\tikzset` inside the picture;
- place layer declarations inside the picture;
- place 3D camera setup inside the picture;
- keep imported external TikZ styles comment-only;
- emit no active `\input`;
- not inline imported external `\tikzset`;
- preserve standalone behavior.

## 6. Tests

Add focused tests.

Create a reusable assertion helper, for example:

```ts
function expectNoBlankLines(output: string): void {
  const blankLines = output
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*$/.test(line));

  expect(blankLines).toEqual([]);
}
```

or equivalent.

Required tests:

1. Representative 2D inline export has no blank lines.

Use a diagram with at least:

- a point or curve;
- layer output if feasible;
- local style/color if feasible.

2. Representative 3D inline export has no blank lines.

Use a diagram with at least:

- 3D camera setup;
- layer output;
- one rendered object.

3. Inline output with local user style presets has no blank lines.

This should cover:

- `\definecolor`;
- local `\tikzset`.

4. Inline output with imported external style comments has no blank lines.

This should cover comment-only imported style instructions.

5. Inline output with layers has no blank lines.

This should cover:

- `\pgfdeclarelayer`;
- `\pgfsetlayers`;
- `pgfonlayer` blocks.

6. Inline output with camera setup has no blank lines.

This should cover:

- `\tdplotsetmaincoords`;
- `tdplot_main_coords` scope if used.

7. Inline output has no leading or trailing blank line.

8. Inline output still includes the baseline option.

9. Inline output still has setup inside `tikzpicture`, not before it.

10. Standalone output remains unchanged or at least is not forced into no-blank-line formatting.

If snapshot tests are brittle, assert structural invariants rather than exact full output.

## 7. Optional debug assertion

Consider adding an internal development/test helper:

```ts
assertNoBlankLinesForInlineMath(output)
```

This can be used in tests only.

Do not throw in production unless that is consistent with existing generator validation.

## 8. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Then:

1. Select TikZ export mode: Inline math.
2. Generate/copy a simple 2D diagram.
3. Confirm the output contains no blank lines.
4. Confirm it starts with `\begin{tikzpicture}[baseline=...]`.
5. Confirm setup is inside the picture.
6. Generate/copy a 3D diagram.
7. Confirm no blank lines.
8. Confirm camera setup is inside the picture.
9. Generate/copy a diagram with imported style comments.
10. Confirm comments are present but no blank lines.
11. Paste output inside a simple `align` environment if practical.
12. Confirm there are no blank-line paragraph breaks.
13. Switch to Standalone mode.
14. Confirm standalone formatting remains readable and unchanged.

## 9. Preserve existing behavior

Do not regress:

- inline baseline option;
- inline setup placement;
- imported style comment-only policy;
- local user style output;
- layer-aware output;
- camera output;
- standalone output;
- SVG preview;
- save/load;
- copy/download;
- all geometry export.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of blank lines in inline output;
- formatter/helper changes;
- whether `section(...)` is now mode-aware;
- whether final inline sanitizer was added;
- how standalone formatting was preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
