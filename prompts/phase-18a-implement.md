# Phase 18A Implementation Prompt: TikZ export mode model and UI

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

Introduce a TikZ export mode setting that separates:

- `standalone` mode;
- `inlineMath` mode.

This subphase should add the model/UI plumbing and prepare the generator API, with minimal output behavior changes.

The actual inline-math command placement and no-blank-line formatting will be implemented in later subphases.

## Scope

Implement:

- export mode type/model;
- UI selector;
- generator option plumbing;
- save/load behavior if export settings are persisted;
- tests.

Do not implement yet:

- full inline setup placement;
- inline blank-line-free formatter;
- baseline insertion logic, except possibly an initial placeholder;
- broad TikZ generator refactor;
- new geometry or style features.

## Export mode model

Add a type such as:

```ts
type TikzExportMode = "standalone" | "inlineMath";
```

or:

```ts
type TikzSetupPlacement = "externalSetup" | "insidePicture";
```

Preferred user-facing labels:

```text
Standalone TikZ
Inline math TikZ
```

Requirements:

- default mode should preserve current behavior, i.e. standalone;
- mode should be passed explicitly to `generateTikz` or equivalent;
- mode should affect only TikZ output, not SVG preview or diagram geometry;
- changing mode should not create diagram undo history entries unless export settings are intentionally persisted as diagram data.

## Persistence policy

Choose one policy and document it.

Preferred:

- export mode is editor/export UI state, not diagram geometry;
- it may be saved as diagram export preferences if the project already saves export options;
- old diagrams without the setting load with `standalone`.

Do not store export mode as a stratum or geometry object.

## UI

Add a compact control near the TikZ source/export area:

```text
TikZ export mode:
  Standalone
  Inline math
```

Requirements:

- changing mode immediately updates generated TikZ source;
- mode selection is visible but not disruptive;
- no model/geometry behavior changes;
- copy/download uses the currently selected mode.

## Generator API

Update generator entry point so it accepts mode:

```ts
generateTikz(diagram, { exportMode: "standalone" })
generateTikz(diagram, { exportMode: "inlineMath" })
```

or equivalent.

For this subphase, it is acceptable for `inlineMath` to behave like `standalone` plus a TODO test stub, but later subphases will implement differences. Prefer adding at least one visible marker/test so plumbing is proven.

## Tests

Add tests:

1. Default export mode is standalone.
2. UI/export state can switch to inline math mode.
3. `generateTikz` receives the selected mode.
4. Copy/download uses selected mode if helper-testable.
5. Changing export mode does not mutate diagram geometry.
6. Old saved diagrams without export mode still load.
7. Standalone output remains unchanged for existing tests.

## Documentation

Update docs:

- there are two TikZ export modes;
- standalone is the default;
- inline math mode is intended for `align` and similar environments;
- later subphases will specialize inline output.

## Preserve existing behavior

Do not regress:

- standalone TikZ output;
- SVG preview;
- save/load;
- undo/redo;
- imported styles;
- local user styles;
- layer-aware output.

## Report after implementation

Please report:

- files modified;
- export mode type/model;
- UI location;
- persistence policy;
- generator API changes;
- tests added/updated;
- test results;
- build results;
- limitations.
