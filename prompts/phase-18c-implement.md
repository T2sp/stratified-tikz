# Phase 18C Implementation Prompt: Blank-line-free inline formatter with comment separators

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

Phase 17F is complete.

The editor now supports:

- 2D and 3D diagrams;
- many geometric object types;
- custom work planes;
- camera controls;
- layer manager;
- editable style presets;
- imported external TikZ style references;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

New requirement:

The user wants two TikZ export modes:

1. **Standalone mode**
   - This is the current/traditional mode.
   - Setup commands may appear before `\begin{tikzpicture}`.
   - Readability can use blank lines as before.

2. **Inline math mode**
   - Intended for use inside math environments such as `align`, for example:

```tex
\begin{align}
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
  &=
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
  \\
  &=
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
\end{align}
```

   - Each exported diagram is still its own independent `tikzpicture`.
   - All setup and drawing commands for a diagram should be inside that diagram's `tikzpicture`.
   - Inline math mode should not leave blank lines in the generated snippet, because blank lines can cause errors in `align` and other math environments.
   - Readability should be preserved using comment lines rather than empty lines.
   - The `tikzpicture` option should always include:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

Important existing export policies:

- External imported TikZ styles should not be inlined.
- External imported style files should be referenced by comments/instructions only.
- User-defined structured presets can be emitted as local style definitions.
- Phase 9B layer-aware output must remain valid.
- Phase 13I tikz-3dplot camera export must remain valid.
- Phase 17 custom/imported style export must remain valid.


## Goal

Make inline math TikZ output safe for `align` and similar math environments by ensuring the generated inline snippet contains no empty lines.

Readability should be preserved with comment separator lines, not blank lines.

This subphase focuses on formatting and regression hardening for inline math mode.

## Prerequisites

Phases 18A and 18B are complete.

## Scope

Implement:

- blank-line-free formatter for inline math mode;
- comment separator style;
- tests guaranteeing no empty lines;
- no regression to standalone formatting unless intentional.

Do not implement:

- new setup placement logic beyond fixes needed for formatting;
- new geometry;
- new style import behavior.

## Inline math formatting rule

In inline math mode, the generated TikZ string must not contain blank lines.

A blank line means any line matching:

```text
^\s*$
```

This should be avoided:

```tex
\begin{tikzpicture}[baseline={...}]

  \definecolor{...}

  \draw ...
\end{tikzpicture}
```

Preferred:

```tex
\begin{tikzpicture}[baseline={...}]
  %----------------------------------------
  % Local colors
  %----------------------------------------
  \definecolor{...}
  %----------------------------------------
  % Drawing commands
  %----------------------------------------
  \draw ...
\end{tikzpicture}
```

Comment lines are allowed and encouraged.

## Formatter/helper

If there is a TikZ string builder, add an option:

```ts
format: "standalone" | "inlineMath"
```

or make inline math mode use a helper such as:

```ts
joinTikzLinesNoBlankLines(lines)
```

Requirements:

- comments may be used as separators;
- no empty lines in inline output;
- no leading empty line;
- no trailing empty line;
- no double newline that creates a blank line;
- whitespace indentation is okay;
- standalone output can keep existing readable blank lines.

## Align safety

Generated inline snippets should be safe to paste into:

```tex
\begin{align}
  <inline tikzpicture>
  &=
  <inline tikzpicture>
\end{align}
```

This means:

- no blank lines inside snippet;
- no paragraph breaks;
- no active pre-picture setup outside the picture;
- no trailing blank line after `\end{tikzpicture}`.

## Tests

Add tests:

1. Inline 2D output has no blank lines.
2. Inline 3D output has no blank lines.
3. Inline output with colors has no blank lines.
4. Inline output with layers has no blank lines.
5. Inline output with camera has no blank lines.
6. Inline output with external style comments has no blank lines.
7. Inline output with user presets has no blank lines.
8. Inline output has no leading or trailing blank line.
9. Standalone output formatting remains unchanged or intentionally documented.
10. Inline output still contains helpful comment separators.

Use a helper assertion:

```ts
expect(output.split("\\n").some((line) => /^\\s*$/.test(line))).toBe(false)
```

or equivalent.

## Documentation

Update docs:

- inline math mode avoids blank lines;
- comments are used for readability;
- suitable for `align`.

## Preserve existing behavior

Do not regress:

- inline setup placement;
- baseline option;
- standalone mode;
- TikZ semantic output;
- SVG preview;
- save/load.

## Report after implementation

Please report:

- files modified;
- formatting helper changes;
- no-blank-line guarantee;
- comment separator style;
- tests added/updated;
- test results;
- build results;
- limitations.
