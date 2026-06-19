# Phase 17E Implementation Prompt: Apply custom/imported styles to draw, filldraw, and node output

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

Ensure custom and imported style presets are applied correctly to generated TikZ commands:

- `\draw`;
- `\filldraw`;
- `\node`.

This subphase connects the Style Manager / imported style system to all relevant element kinds and hardens export behavior.

Important rules:

1. Imported external style definitions are not inlined.
2. Imported external style files are mentioned only in comments.
3. User-defined structured styles from Phase 17A are defined as local styles in `\begin{tikzpicture}` options.
4. Commands use the appropriate style names/keys.

## Prerequisites

Phases 17A-17D are complete.

## Scope

Implement/export hardening for:

- curves / paths -> `\draw`;
- sheets / regions -> `\filldraw` or equivalent fill path command;
- points / labels -> `\node`;
- segment-level style overrides if present;
- path templates if present;
- curved surfaces if present.

Do not implement:

- full TeX parser;
- style inheritance beyond TikZ's own behavior;
- inlining imported `\tikzset`;
- active `\input` output by default.

## Export behavior

### User-defined structured presets

Defined locally in `\begin{tikzpicture}` options:

```tex
\begin{tikzpicture}[
  stratifiedStyleFoo/.style={...}
]
```

Commands reference them:

```tex
\draw[stratifiedStyleFoo] ...
```

### Imported external style keys

Do not define them locally.

Do not inline their `\tikzset`.

Do not emit active `\input`.

Emit comments:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before the picture:
% - mygeometry.sty
% Suggested:
%   \input{mygeometry.sty}
```

Commands reference imported keys:

```tex
\draw[3cat/phys/1strata/color/x] ...
\filldraw[3cat/phys/1strata/color/y] ...
\node[3cat/phys/3strata/shape/L] at (...) {};
```

## Option ordering

Choose deterministic option ordering.

Suggested order:

1. local user style preset name;
2. imported external style key;
3. structured inline fallback options;
4. element-specific options such as label anchor.

or another documented order.

Important:

- avoid duplicate options where possible;
- do not drop structured options unless intentionally overridden;
- preserve existing style behavior for elements without custom/imported presets.

## Applicable elements

Ensure support for:

- ordinary curves;
- concatenated paths;
- arc/circle/ellipse path templates;
- segment-level style overrides where relevant;
- polygon sheets;
- filled regions;
- work-plane-filled sheets;
- curved sheet primitives;
- points;
- labels.

If some exotic element kind cannot support custom style yet, document it and ensure it falls back safely.

## Tests

Add tests:

1. User preset style appears in `tikzpicture` options.
2. User preset is referenced by a `\draw` command.
3. User preset is referenced by a `\filldraw` command.
4. User preset is referenced by a `\node` command.
5. Imported style key is referenced by a `\draw` command.
6. Imported style key is referenced by a `\filldraw` command.
7. Imported style key is referenced by a `\node` command.
8. Imported external source comment appears once.
9. Full `\tikzset` is not emitted.
10. Active `\input` is not emitted.
11. Layer-aware output preserved.
12. Work-plane-local `canvas is plane` output preserved.
13. Segment-level overrides still work.
14. Elements without custom/imported styles export as before.

## Documentation

Update `docs/TIKZ_OUTPUT.md`:

- local user presets in `tikzpicture` options;
- imported external style keys require external file load;
- generated TikZ only comments the load instruction;
- commands use style keys in `draw/filldraw/node`.

## Preserve existing behavior

Do not regress:

- all existing geometry export;
- layer output;
- coordinate naming;
- style rendering in SVG;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- option ordering policy;
- element kinds supported;
- external comment behavior;
- local style definition behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
