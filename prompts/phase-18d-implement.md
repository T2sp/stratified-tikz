# Phase 18D Implementation Prompt: Export mode polish, documentation, and regression coverage

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

Polish the standalone vs inline math TikZ export mode feature and harden it with documentation and regression tests.

This subphase should make the feature easy to use and safe for common math-environment workflows.

## Prerequisites

Phases 18A-18C are complete.

## Scope

Implement:

- documentation;
- UI polish;
- copy/download filename or labels if helpful;
- regression tests covering representative diagrams;
- examples/snippets for `align`.

Do not implement:

- new geometry;
- new style features;
- combined multi-picture export;
- LaTeX compilation service.

## UI polish

Ensure the export mode UI is clear.

Suggested labels:

```text
TikZ export mode:
  Standalone
  Inline math
```

Add short help text or tooltip:

```text
Inline math puts setup inside tikzpicture, adds baseline centering, and removes blank lines for align.
```

Copy/download behavior:

- copy current mode output;
- download current mode output;
- optional filename suffix:
  - `diagram-standalone.tex`;
  - `diagram-inline-math.tex`.

## Documentation

Update `docs/TIKZ_OUTPUT.md` or equivalent.

Document:

### Standalone mode

- current/traditional output;
- setup may appear before `tikzpicture`;
- best for ordinary document snippets or standalone figures.

### Inline math mode

- intended for `align`, `aligned`, equation-like environments;
- all setup inside each `tikzpicture`;
- `baseline={([yshift=-.5ex]current bounding box.center)}` always included;
- no blank lines;
- comments used for readability;
- external style files must be loaded in the parent document;
- generated snippet includes comments but not active external `\input`.

Add example:

```tex
\begin{align}
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    % ...
  \end{tikzpicture}
  &=
  \begin{tikzpicture}[baseline={([yshift=-.5ex]current bounding box.center)}]
    % ...
  \end{tikzpicture}
\end{align}
```

## Regression coverage

Add representative tests for inline and standalone output using:

- 2D diagram;
- 3D diagram with camera;
- diagram with layers;
- diagram with user style presets;
- diagram with imported external style references;
- diagram with colors;
- diagram with filled regions/sheets if existing fixtures available.

Required assertions:

- standalone remains semantically unchanged;
- inline contains baseline;
- inline has setup inside picture;
- inline has no blank lines;
- inline includes comments for external styles but no active `\input`;
- inline does not inline imported `\tikzset`;
- layer output valid;
- camera output valid;
- local styles valid.

## Preserve existing behavior

Do not regress:

- generated TikZ for standalone mode;
- inline output from 18B/18C;
- SVG preview;
- save/load;
- copy/download;
- all geometry export.

## Report after implementation

Please report:

- files modified;
- UI/help text changes;
- docs updated;
- representative tests added;
- copy/download behavior;
- test results;
- build results;
- limitations.
