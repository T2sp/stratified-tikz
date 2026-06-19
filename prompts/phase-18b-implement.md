# Phase 18B Implementation Prompt: Inline math setup placement and baseline option

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

Implement the actual `inlineMath` TikZ export mode.

In inline math mode, each exported diagram should be a self-contained `tikzpicture` suitable for use inside math environments such as `align`.

Key requirements:

1. All setup and drawing commands for the diagram are inside the `tikzpicture`.
2. `\begin{tikzpicture}` always includes:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

3. Setup commands are placed at the beginning of the `tikzpicture`, not before it.
4. Phase 17 user-defined styles should be emitted using `\tikzset{...}` inside the picture, not as `\begin{tikzpicture}[...]` style options.
5. External imported style definitions are not inlined; only comments/instructions are included.

## Prerequisites

Phase 18A is complete.

## Scope

Implement:

- inline math TikZ generation;
- setup command placement inside `tikzpicture`;
- baseline option;
- local style placement via `\tikzset`;
- inline handling for colors/layers/camera/external style comments.

Do not implement yet:

- blank-line-free formatter hardening; that is Phase 18C;
- docs/examples hardening; that is Phase 18D;
- new geometry;
- new style import behavior.

## Inline math output shape

Inline math output should look like:

```tex
\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
  % External TikZ styles referenced below.
  % Load these files in your LaTeX preamble or before this picture:
  % - mygeometry.sty
  % Suggested:
  %   \input{mygeometry.sty}
  % Local colors
  \definecolor{...}{HTML}{...}
  % Local styles
  \tikzset{
    stratifiedStyleFoo/.style={...}
  }
  % Layers
  \pgfdeclarelayer{...}
  \pgfsetlayers{...}
  % Camera
  \tdplotsetmaincoords{...}{...}
  % Diagram content
  ...
\end{tikzpicture}
```

Comments and indentation can differ.

## Baseline option

In inline math mode, the `tikzpicture` options must always include exactly or equivalently:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

Requirements:

- included for 2D and 3D diagrams;
- included even if the diagram is empty;
- included even if no other options exist;
- if other options are needed, merge deterministically without duplicating baseline.

Important:

- Do not put user style definitions in `\begin{tikzpicture}[...]` in inline mode if they depend on `\definecolor` declared inside the picture.
- Use `\tikzset` after `\definecolor`.

## Setup placement inside tikzpicture

Move or duplicate all necessary setup into the picture body for inline mode.

### Colors

If generated output uses `\definecolor`, emit it at the top of the picture body.

### User structured presets

Phase 17A user presets should be emitted as:

```tex
\tikzset{
  presetName/.style={...}
}
```

inside the picture body, after `\definecolor`.

Do not define them in `\begin{tikzpicture}[...]` options in inline mode.

### Layers

Emit layer setup directly under `\begin{tikzpicture}`, not inside a scope or group:

```tex
\pgfdeclarelayer{...}
\pgfsetlayers{...}
```

Requirements:

- preserve Phase 9B layer-aware output;
- `main` layer included as before;
- no layer setup before the picture in inline mode.

### Camera

If 3D camera export uses `\tdplotsetmaincoords`, emit it inside the picture body.

Do not put `tdplot_main_coords` in `\begin{tikzpicture}[...]` if `\tdplotsetmaincoords` is defined inside the picture after begin.

Instead, use a scope where needed:

```tex
\tdplotsetmaincoords{theta}{phi}
\begin{scope}[tdplot_main_coords]
  ...
\end{scope}
```

or another valid approach.

### External imported TikZ styles

Imported external style definitions are not inlined.

In inline mode, include comments inside the picture body, not before the picture:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before this picture:
% - mygeometry.sty
```

Do not emit active `\input`.

Do not emit full imported `\tikzset`.

## Standalone mode must remain unchanged

Standalone mode should continue using the existing/traditional output placement.

Do not break existing standalone tests.

## Tests

Add tests:

1. Inline output starts with `\begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]` or equivalent.
2. Inline output contains no active setup before `\begin{tikzpicture}`.
3. Inline output places `\definecolor` inside picture when colors are used.
4. Inline output places Phase 17A user preset definitions in `\tikzset` inside picture.
5. Inline output does not place Phase 17A user presets in `\begin{tikzpicture}[...]` options.
6. Inline output places `\pgfdeclarelayer` and `\pgfsetlayers` inside picture body and not inside a nested scope.
7. Inline 3D output places camera setup inside picture and renders commands in a valid `tdplot_main_coords` context.
8. Inline output external style comments are inside picture.
9. Inline output does not inline imported `\tikzset`.
10. Inline output does not emit active `\input`.
11. Standalone output remains unchanged or semantically equivalent.
12. 2D and 3D inline outputs both include baseline.

## Documentation

Update docs briefly:

- inline math mode is self-contained inside each `tikzpicture`;
- setup is inside picture;
- user styles use internal `\tikzset`;
- imported external styles are only comments;
- baseline is always included.

## Preserve existing behavior

Do not regress:

- standalone output;
- layer-aware output;
- camera export;
- local user presets;
- imported style references;
- work-plane-local scopes;
- SVG preview;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- inline output structure;
- baseline handling;
- setup placement order;
- local user style handling;
- external imported style comment handling;
- standalone preservation;
- tests added/updated;
- test results;
- build results;
- limitations.
