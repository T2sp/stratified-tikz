# Phase 17F Implementation Prompt: Style Manager polish, docs, and regression hardening

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

Polish the style preset/import workflow and harden combined behavior.

This subphase should make the Style Manager/Inspector preset UI usable and document the import/export model clearly.

## Prerequisites

Phases 17A-17E are complete.

## Scope

Implement:

- UI polish;
- error/status messages;
- combined workflow tests;
- documentation updates;
- import/export regression hardening.

Do not implement:

- full TeX parser;
- symbolic TikZ expressions;
- `\foreach`;
- style marketplace/library;
- broad app redesign.

## UI polish

Improve:

- preset list grouping:
  - built-in;
  - user;
  - imported;
- clear edit/delete affordances for user presets;
- imported style source display;
- imported style target editing if available;
- warnings for approximate preview;
- warnings that external style files must be loaded by the user.

Ensure large imported style lists remain usable:

- scrollable list;
- search/filter if small to implement;
- no layout overflow.

## Error handling

Add concise messages for:

- failed style import;
- unsupported TikZ syntax skipped;
- duplicate imported key;
- invalid preset name;
- incompatible preset target;
- missing external source.

## Combined workflow tests

Add tests:

1. Import style file.
2. Auto-detect color preset.
3. Apply imported preset to curve.
4. Generate TikZ.
5. Assert external load comment exists.
6. Assert full `\tikzset` not inlined.
7. Assert `\draw` uses imported key.
8. Create user preset.
9. Assert user preset defined in `tikzpicture` options.
10. Save/load.
11. Assert user and imported presets persist.
12. Delete user preset.
13. Built-in presets remain.

## Documentation

Update docs:

- user-editable presets;
- external TikZ style import limitations;
- generated TikZ does not inline imported `\tikzset`;
- generated TikZ only comments load instructions;
- Phase 17A user presets are local `tikzpicture` options;
- SVG preview is approximate for imported TikZ styles.

## Report after implementation

Please report:

- files modified;
- UI polish changes;
- error messages;
- combined tests;
- docs updated;
- test results;
- build results;
- remaining limitations.
