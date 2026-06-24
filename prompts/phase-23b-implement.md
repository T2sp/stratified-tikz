# Phase 23B Implementation Prompt: Toolbar palette exclusivity and Add path menu simplification

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
## Project context

You are working on the StratifiedTikZ project.

Phase 22 is complete or near complete.

The editor now supports:

- preview-centered UI;
- floating toolbar inside SVG/PGF Preview;
- direct input drawer;
- inspector drawer;
- layer palette/window;
- camera controls;
- examples and JSON load/save;
- 2D/3D diagrams;
- paths with arrows;
- braiding/string-diagram crossings;
- custom work planes;
- symbolic variables;
- grids/lattices;
- sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- save/load;
- undo/redo.

Phase 23 is a UI refinement phase.

The user wants three groups of changes:

1. Example bar placement and content.
2. Toolbar palette behavior and Add path menu simplification.
3. Camera UI relocation below the Preview and slider-based controls.

Important constraints:

- This is primarily UI/layout work.
- Do not change diagram geometry semantics.
- Do not change TikZ generation semantics unless required by an example asset integration.
- UI open/closed state should remain editor/UI state, not diagram data.
- Preserve all existing creation/editing behavior.
- Preserve save/load, undo/redo, SVG preview, TikZ source generation, camera/work-plane/layer/style/variable/grid/braiding behavior.


## Goal

Improve the toolbar palette behavior and simplify the Add path palette.

The user provided a screenshot showing the current toolbar becoming cluttered: Add path sub-options and direct/manual path options all look visually similar and take too much space.

## User requirements

- Only one toolbar palette may be expanded at a time.
  - Example: if Add point palette is open and then Add path is opened, Add point should automatically collapse.
- Add path currently has too many visible items.
  - Direct input should be consolidated into one single item.
- Add path buttons all currently look too similar.
  - Make them visually distinguishable and intuitive.

## Scope

Implement:

- one-open-palette toolbar state;
- automatic collapse of previous palette when another opens;
- Add path palette simplification;
- unified Direct input item for Add path;
- clearer visual treatment of Add path actions;
- tests.

Do not implement:

- new path geometry features;
- new direct input capabilities;
- major toolbar redesign beyond palette behavior;
- new dependencies.

## Palette exclusivity

Current behavior may allow several palettes/dropdowns expanded simultaneously.

New behavior:

```text
openToolbarPalette: null | "addPoint" | "addLabel" | "addPath" | "addSheet" | "addGrid" | ...
```

Requirements:

- opening one palette closes all others;
- clicking the currently open palette button toggles it closed;
- selecting a command closes the palette unless that command intentionally opens a drawer;
- Escape key closes the open palette if keyboard handling exists;
- clicking outside closes palettes if existing pattern supports it;
- palette state is UI-only and not saved in `Diagram`.

## Add path palette simplification

Current Add path palette has many items, including direct input variants.

New behavior:

- Direct input should be a single item:

```text
Direct input...
```

or:

```text
Direct
```

- Clicking it opens the direct input drawer or direct path form.
- Do not show separate direct items for every path subtype inside the top toolbar palette.
- The direct drawer can still contain all direct path creation options:
  - manual path;
  - line;
  - cubic;
  - arc;
  - circle;
  - ellipse;
  - symbolic coordinates, etc.

Suggested Add path palette groups:

```text
Cursor creation
  Line / manual path
  Polyline
  Cubic Bézier
  Arc

Templates
  Circle
  Ellipse

Direct
  Direct input...
```

Exact group labels can differ.

## Visual distinction for Add path buttons

Make Add path choices intuitively distinct.

Use only existing CSS/HTML; no new icon dependency.

Suggested visual cues:

- small text icons:
  - `─` for line;
  - `⌁` or `B` for cubic Bézier;
  - `◜` for arc;
  - `○` for circle;
  - `⬭` for ellipse;
  - `⌨` for direct input;
- group labels;
- different button shapes/secondary styling;
- active/hover styling.

Requirements:

- buttons should not all look identical;
- labels remain readable;
- keyboard/screen-reader labels remain clear;
- styling does not make the toolbar taller than necessary.

## Fill paths behavior

Preserve the Phase 21B rule:

- `Fill paths` appears only when active tool is Select or Add path.
- Do not regress this.

## Tests

Add focused tests:

1. Opening Add point palette sets open palette to `addPoint`.
2. Opening Add path while Add point is open closes Add point and opens Add path.
3. Clicking Add path again closes Add path.
4. Selecting a palette item closes the palette or opens the intended drawer according to policy.
5. Add path palette contains exactly one Direct input item.
6. Add path palette exposes required path actions.
7. Fill paths visibility rule remains Select/Add path only.
8. Palette state is UI-only and does not affect TikZ output.
9. Add path direct drawer still exposes the underlying direct path choices if helper-testable.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open Add point palette.
2. Open Add path palette.
3. Confirm Add point palette collapses.
4. Open Add sheet.
5. Confirm Add path collapses.
6. Open Add path again.
7. Confirm the palette is compact.
8. Confirm there is only one Direct input item.
9. Confirm path buttons have distinct visual cues.
10. Confirm Direct input opens the path direct drawer.
11. Confirm Fill paths appears only in Select/Add path.
12. Confirm existing creation tools still work.

## Preserve existing behavior

Do not regress:

- floating toolbar;
- toolbar collapse/expand;
- Add point/Add label/Add sheet/Add grid creation;
- Add path creation variants;
- direct drawer behavior;
- Fill paths;
- undo/redo/remove selected;
- SVG pointer mapping;
- TikZ generation.

## Report after implementation

Please report:

- files modified;
- palette state model;
- collapse behavior;
- Add path palette final structure;
- Direct input consolidation;
- visual distinction strategy;
- tests added/updated;
- test results;
- build results;
- limitations.
