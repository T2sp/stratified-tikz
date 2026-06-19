# Phase 18D Fix Prompt: Use 4-space TikZ indentation and indent pgfonlayer bodies

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

Phase 18D is complete.

Current formatting issue:

1. Generated TikZ source currently uses 2-space indentation.
2. The preferred indentation is now 4 spaces.
3. `pgfonlayer` environments currently do not indent their contents properly.
4. This makes layer-aware output less readable, especially for larger diagrams with nested `tikzpicture`, `scope`, and `pgfonlayer` blocks.

The goal is formatting/readability only.

## Goal

Update generated TikZ formatting so that:

- indentation unit is 4 spaces, not 2 spaces;
- all nested environments/blocks use one additional 4-space indent level;
- contents inside `pgfonlayer` environments are indented;
- both standalone and inline math export modes use the same 4-space indentation policy;
- inline math mode still emits no blank lines;
- generated TikZ semantics remain unchanged.

## Scope

This is a targeted Phase 18D formatting fix.

Implement:

- 4-space indentation in generated TikZ;
- correct indentation for `pgfonlayer` environment bodies;
- tests for representative standalone and inline outputs;
- tests preserving inline no-blank-lines behavior.

Do not implement:

- new TikZ export modes;
- new geometry features;
- new style features;
- new layer semantics;
- new UI features;
- broad TikZ generator rewrite unless necessary.

Do not change:

- diagram data model;
- SVG preview;
- save/load;
- undo/redo;
- layer-aware output semantics;
- camera export semantics;
- imported style comment policy;
- inline math baseline behavior;
- inline math no-blank-lines requirement;
- standalone vs inline setup placement.

## 1. Introduce or update a central indentation helper

Inspect:

- `src/tikz/generateTikz.ts`;
- existing helper functions that indent lines;
- helpers that emit environment blocks;
- helpers that emit `pgfonlayer`;
- standalone/inline output assembly.

If there is already an indentation helper, change its indent unit to 4 spaces.

If indentation is hard-coded with `"  "` or equivalent, replace it with a central constant/helper.

Recommended:

```ts
const TIKZ_INDENT = "    ";

function indentLine(line: string, level = 1): string {
  return `${TIKZ_INDENT.repeat(level)}${line}`;
}

function indentLines(lines: string[], level = 1): string[] {
  return lines.map((line) => line.length === 0 ? line : indentLine(line, level));
}
```

Exact implementation can differ.

Requirements:

- use 4 spaces per level;
- avoid tabs;
- avoid hard-coded 2-space indent fragments in TikZ output;
- preserve no-blank-line behavior for inline mode.

## 2. Indent environment bodies consistently

Ensure the body of every generated environment or nested block is indented one level deeper than the opening and closing lines.

Examples:

### Standalone or inline `tikzpicture`

Expected shape:

```tex
\begin{tikzpicture}[...]
    %----------------------------------------
    % Local colors
    %----------------------------------------
    \definecolor{...}{HTML}{...}
    %----------------------------------------
    % Layers
    %----------------------------------------
    \pgfdeclarelayer{stratifiedLayerZero}
    \pgfsetlayers{stratifiedLayerZero,main}
    \begin{pgfonlayer}{stratifiedLayerZero}
        \draw[...] ...;
    \end{pgfonlayer}
\end{tikzpicture}
```

### `scope`

Expected:

```tex
\begin{scope}[tdplot_main_coords]
    \begin{pgfonlayer}{stratifiedLayerZero}
        ...
    \end{pgfonlayer}
\end{scope}
```

### `pgfonlayer`

Expected:

```tex
\begin{pgfonlayer}{stratifiedLayerZero}
    \coordinate (...) at (...);
    \draw[...] ...;
\end{pgfonlayer}
```

Not acceptable:

```tex
\begin{pgfonlayer}{stratifiedLayerZero}
\coordinate (...) at (...);
\draw[...] ...;
\end{pgfonlayer}
```

or:

```tex
\begin{pgfonlayer}{stratifiedLayerZero}
  \coordinate (...) at (...);
  \draw[...] ...;
\end{pgfonlayer}
```

because the new indentation unit should be 4 spaces.

## 3. Apply to both export modes

Update both:

- standalone mode;
- inline math mode.

Standalone mode:

- may keep blank lines if currently used;
- indentation should be 4 spaces.

Inline math mode:

- must keep the Phase 18 invariant:
  - no blank lines anywhere;
  - no leading/trailing blank lines;
  - `baseline={([yshift=-.5ex]current bounding box.center)}` remains present;
  - setup remains inside `tikzpicture`;
  - imported style files remain comment-only.

Do not reintroduce blank lines while changing indentation.

## 4. Indent section comments

Comments should also follow block indentation.

Example inside `tikzpicture`:

```tex
    %----------------------------------------
    % Local styles
    %----------------------------------------
```

Inside `pgfonlayer`:

```tex
        % Curves
        \draw[...] ...;
```

If section helpers are mode-aware, keep their behavior but update indentation.

## 5. Preserve generated TikZ semantics

This is a formatting-only fix.

Do not alter:

- which commands are emitted;
- command ordering;
- layer declaration ordering;
- layer membership;
- coordinate names;
- style names;
- option ordering unless already controlled by tests;
- camera theta/phi values;
- imported external style comments;
- user preset placement;
- inline vs standalone setup placement.

If snapshots or exact-output tests need updating, update them only for indentation differences.

## 6. Tests

Add or update focused tests.

Required tests:

### A. 4-space indentation

1. Standalone output uses 4-space indentation for lines inside `tikzpicture`.

Assert at least one representative command starts with exactly 4 spaces:

```text
    \draw
```

or:

```text
    \coordinate
```

2. Inline output uses 4-space indentation for lines inside `tikzpicture`.

3. No generated TikZ command line in the main body uses a 2-space-only indent where one indent level is expected.

Do not over-constrain every line if that makes tests brittle, but ensure the new policy is enforced.

### B. pgfonlayer body indentation

4. For a representative layer block, output contains:

```tex
    \begin{pgfonlayer}{...}
        ...
    \end{pgfonlayer}
```

Specifically assert that a drawing or coordinate command inside `pgfonlayer` starts with 8 spaces when `pgfonlayer` itself is inside the `tikzpicture` body.

5. `\end{pgfonlayer}` aligns with `\begin{pgfonlayer}`.

### C. Nested scope indentation

6. If 3D output uses a `scope`, assert:

```tex
    \begin{scope}[...]
        ...
    \end{scope}
```

7. If a `pgfonlayer` appears inside a `scope`, assert body indentation is nested accordingly.

### D. Inline no-blank-lines regression

8. Inline 2D output has no blank lines.
9. Inline 3D output has no blank lines.
10. Inline output with layers has no blank lines.
11. Inline output with labels containing embedded newlines still has no blank lines.

Use or preserve the helper:

```ts
function expectNoBlankLines(output: string): void {
  expect(output.split("\n").some((line) => /^\s*$/.test(line))).toBe(false);
}
```

### E. Semantic regression

12. Standalone output still includes expected layer declarations.
13. Inline output still includes baseline option.
14. Imported external style comments remain comments only.
15. No active `\input` emitted by default.
16. No imported `\tikzset` block inlined.

## 7. Optional formatter helper tests

If you introduce a central formatter/helper, add small pure tests:

- `indentLine("x", 1)` returns `"    x"`;
- `indentLine("x", 2)` returns `"        x"`;
- `indentLines` does not create blank lines accidentally;
- environment helper indents body lines.

## 8. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Then:

1. Generate TikZ in standalone mode.
2. Confirm indentation uses 4 spaces.
3. Confirm commands inside `pgfonlayer` are indented deeper than the `pgfonlayer` environment.
4. Confirm `\end{pgfonlayer}` aligns with `\begin{pgfonlayer}`.
5. Switch to inline math mode.
6. Confirm indentation uses 4 spaces.
7. Confirm there are no blank lines.
8. Confirm baseline option remains present.
9. Confirm setup is still inside `tikzpicture`.
10. Confirm output is readable.
11. Generate a 3D diagram with camera/layers.
12. Confirm `scope` and `pgfonlayer` indentation is correct.

## 9. Preserve existing behavior

Do not regress:

- standalone TikZ output semantics;
- inline math export mode;
- inline baseline option;
- inline no-blank-lines invariant;
- label newline handling;
- layer-aware output;
- camera output;
- local user style output;
- imported external style comments;
- SVG preview;
- save/load;
- undo/redo;
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
- central indentation policy/helper;
- where 2-space indentation was replaced;
- how `pgfonlayer` body indentation was fixed;
- how inline no-blank-lines behavior was preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
