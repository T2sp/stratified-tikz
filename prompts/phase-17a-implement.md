# Phase 17A Implementation Prompt: User-editable structured style presets

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

Make the Inspector Style presets user-editable.

Users should be able to:

- create a preset from the currently selected element style;
- rename a preset;
- edit a preset's structured style values;
- delete a user preset;
- apply a preset to compatible selected elements.

Built-in presets should remain available and may stay read-only.

Important TikZ export rule:

- Styles created inside StratifiedTikZ in this phase should be defined as local styles in the `\begin{tikzpicture}` options.
- Do **not** emit these Phase 17A user preset definitions as a pre-picture `\tikzset{...}` block.

Expected TikZ shape:

```tex
\begin{tikzpicture}[
  stratifiedStyleBlueSheet/.style={fill=blue!40, fill opacity=0.35, draw=blue!60},
  stratifiedStyleBlackCurve/.style={draw=black, line width=0.8pt}
]
  ...
\end{tikzpicture}
```

Then commands may reference:

```tex
\draw[stratifiedStyleBlackCurve] ...
\filldraw[stratifiedStyleBlueSheet] ...
```

or use an equivalent local style option scheme.

## Scope

Implement:

- user-editable structured style preset model;
- UI for creating/editing/renaming/deleting user presets;
- applying presets from Inspector Style;
- save/load for user presets;
- TikZ export of user preset definitions as `tikzpicture` options;
- tests.

Do not implement yet:

- `.sty` / `.tex` import;
- `\tikzset` parser;
- external style file comments;
- imported style key application;
- full TeX parser;
- symbolic TikZ expressions;
- new dependencies.

## Data model

Add diagram-level style preset data.

Suggested:

```ts
type StylePresetKind =
  | "curve"
  | "sheet"
  | "point"
  | "label"
  | "region";

type UserStylePreset = {
  id: string;
  name: string;
  kind: StylePresetKind;
  style: CurveStyle | SheetStyle | PointStyle | LabelStyle | RegionStyle;
  tikzStyleName: string;
};
```

The exact shape can differ, but it must support:

- stable id;
- user-visible name;
- compatible element kind;
- structured style data;
- TikZ local style name used in generated output.

Requirements:

- built-in presets remain available;
- user presets are saved/loaded;
- old diagrams without style presets still load;
- duplicate IDs rejected;
- blank preset names rejected or defaulted;
- `tikzStyleName` sanitized and collision-safe;
- preset kind compatibility enforced.

## UI requirements

Add UI in Inspector Style or a compact Style Manager.

Required actions:

- Save current style as preset;
- Rename preset;
- Edit preset values;
- Delete user preset;
- Apply preset.

Built-in presets:

- can be shown together with user presets;
- should not be accidentally overwritten;
- may be read-only.

When applying a preset:

- selected element's structured style updates;
- style editor fields update;
- SVG preview updates;
- TikZ output updates;
- undo/redo records the style change if existing style edits do.

## TikZ export for Phase 17A presets

User-created structured presets should be defined as `tikzpicture` options.

Do not emit:

```tex
\tikzset{...}
```

before `\begin{tikzpicture}` for Phase 17A presets.

Required:

- local style definitions are placed inside `\begin{tikzpicture}[...]`;
- style names are sanitized;
- style definitions are deterministic;
- only used presets need to be emitted, or all diagram user presets may be emitted if simpler;
- no duplicate style names;
- layer-aware output preserved;
- existing inline/structured style output preserved for elements that do not use presets.

If an element uses a user preset plus additional custom modifications, choose a clear policy:

- either apply preset and then extra inline options;
- or materialize style into structured options.
- Document/test the chosen policy.

## Tests

Add tests:

1. Create user curve preset from current style.
2. Create user sheet preset.
3. Rename user preset.
4. Blank preset name rejected/defaulted.
5. Delete user preset.
6. Apply preset to compatible element.
7. Incompatible preset cannot be applied or is hidden.
8. User preset save/load round-trip.
9. Old diagrams without presets still load.
10. TikZ output defines user preset in `\begin{tikzpicture}` options.
11. TikZ output does not emit a pre-picture `\tikzset` for Phase 17A presets.
12. Commands reference the local preset style.
13. Built-in presets remain available.
14. SVG preview updates when preset is applied.

## Documentation

Update docs:

- user presets are editable;
- built-in presets are preserved;
- Phase 17A user preset definitions are emitted as `tikzpicture` local style options;
- no pre-picture `\tikzset` block is generated for these presets.

## Preserve existing behavior

Do not regress:

- existing style editing;
- SVG preview;
- TikZ export for existing diagrams;
- layer-aware output;
- save/load old diagrams;
- undo/redo;
- Inspector layout.

## Report after implementation

Please report:

- files modified;
- user preset data model;
- UI behavior;
- TikZ local style export format;
- sanitization/collision policy;
- tests added/updated;
- test results;
- build results;
- limitations.
