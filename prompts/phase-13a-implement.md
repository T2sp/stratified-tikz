# Phase 13A Implementation Prompt: 3D coordinate axes guide

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

Phase 12 is complete.

The app now has:

- 2D and 3D diagrams;
- cursor creation and direct creation;
- custom work planes;
- work-plane-local Bézier support;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI/editor state should not be stored in `Diagram`.
- Preview-only guides and highlights should not be exported to TikZ unless explicitly requested by an export option.
- Generated TikZ must remain readable and should not include selection/editor-only state.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


## Goal

Add a faint default `x`, `y`, `z` coordinate axes guide to the 3D SVG preview.

The guide should be visible by default in 3D diagrams so users can orient themselves spatially.

The user should also be able to choose whether this coordinate axes guide is included in generated TikZ output.

## Scope

Implement:

- preview-only 3D coordinate axes guide;
- user-visible option controlling whether axes are exported to TikZ;
- optional save/load of the export option if it is stored as diagram-level export/view options;
- tests for guide generation and TikZ inclusion/exclusion.

Do not implement:

- full 3D camera controls;
- perspective projection;
- snapping;
- layer manager;
- multi-selection;
- new geometry strata;
- broad UI redesign;
- new dependencies.

Do not change:

- ordinary diagram geometry;
- existing work-plane guide behavior;
- custom work-plane behavior;
- creation behavior;
- layer filtering;
- TikZ output for ordinary elements except for optional axes export.

## 1. SVG 3D coordinate axes guide

Add a faint 3D coordinate axes guide to the SVG preview.

Requirements:

- shown in 3D diagrams by default;
- hidden in 2D diagrams;
- preview-only;
- not selectable;
- pointer-events disabled;
- visually distinct from work-plane guides, sheet strata, and selected-element highlights;
- does not obscure diagram geometry;
- includes faint labels `x`, `y`, and `z`;
- respects existing projection/camera helpers.

Suggested style:

- thin strokes;
- low opacity;
- small arrowheads or simple endpoints if easy;
- small labels near axis ends;
- neutral colors or understated conventional colors, but avoid visual conflict with user styles.

The axes length should be reasonable for empty and non-empty diagrams.

Acceptable MVP:

- fixed model-space axis length, e.g. 2 or 3 units;
- centered at the origin;
- no zoom-dependent scaling.

## 2. TikZ export option

Add a user option such as:

```text
Export coordinate axes to TikZ
```

or:

```text
Show xyz axes in TikZ output
```

Behavior:

- When disabled, generated TikZ does not include the axes guide.
- When enabled, generated TikZ includes a light coordinate axes guide.
- SVG preview may still show axes regardless of the TikZ export option, unless a separate preview toggle is also added.

Recommended:

- preview axes visible by default in 3D;
- TikZ export disabled by default, so existing output remains clean.

The option may be stored as UI/editor state or diagram-level export options.

If stored in diagram data:

- use a clearly named diagram-level export/view option;
- update save/load validation safely;
- do not store it as a stratum.

If stored only in UI state:

- report that it is not saved with diagrams.

Choose the simpler policy consistent with existing export option patterns.

## 3. TikZ axes output

If export option is enabled, emit readable TikZ for axes.

Requirements:

- use existing 3D coordinate syntax;
- respect layer output if appropriate, or place in a clearly documented guide layer/comment block;
- style should be faint and nonintrusive;
- labels should be simple:
  - `$x$`
  - `$y$`
  - `$z$`
- axes guide should be clearly marked in comments;
- selection/editor state must not affect it.

Do not use this as a real stratum.

## 4. Empty 3D canvas behavior

The axes guide should be useful on empty 3D diagrams.

Requirements:

- empty 3D preview should show axes;
- empty 3D TikZ output should include axes only if export option is enabled;
- creation from empty 3D canvas should still work.

## 5. Tests

Add focused tests where practical.

Required tests:

1. 3D preview axes guide data/helper exists or renders without crashing.
2. 2D diagrams do not show 3D axes.
3. Axes guide is preview-only and not selectable.
4. TikZ output excludes axes by default.
5. TikZ output includes axes when the export option is enabled.
6. Exported axes do not affect ordinary diagram strata/labels.
7. Empty 3D diagram can generate TikZ with axes enabled.
8. Save/load behavior is tested if the option is persisted.

Do not add React testing dependencies solely for visual CSS.

## 6. Documentation

Update docs briefly:

- 3D SVG preview shows a faint xyz coordinate guide by default;
- TikZ axes export is user-controlled;
- axes guide is not a stratum;
- preview guide is editor/display state.

## Preserve existing behavior

Do not regress:

- 2D preview;
- 3D work-plane preview;
- cursor/direct creation;
- custom work planes;
- save/load;
- undo/redo;
- inspector editing;
- layer filtering;
- TikZ output for ordinary geometry.

## Report after implementation

Please report:

- files modified;
- how SVG axes are rendered;
- whether axes preview is always on or toggleable;
- how TikZ export option is represented;
- whether the option is saved;
- TikZ output format for axes;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
