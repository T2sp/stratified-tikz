# Phase 21C Implementation Prompt: Direct input drawer inside SVG Preview

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

Phase 20 is complete.

The editor now supports:

- 2D and 3D diagrams;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- symbolic variables and coordinate expressions;
- grids;
- paths, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches, and auto visibility;
- save/load;
- undo/redo;
- SVG preview;
- TikZ source generation.

Phase 21 is a major UI overhaul.

The attached reference mockup has the overall idea:

- compact top panels for Example/File/TikZ style/Variable editor/Work plane selector;
- a large SVG Preview area;
- a floating toolbar inside the top of SVG Preview;
- Undo/Redo as translucent preview-overlay buttons;
- compact Inspector/Layer/Camera buttons around the preview;
- TikZ Source below the preview area.

Important constraints:

- This is UI/layout work unless explicitly stated.
- Do not change diagram data model unless a UI state field truly must persist.
- Do not change TikZ generation semantics.
- Do not change SVG rendering geometry semantics.
- UI overlay state is editor/UI state, not `Diagram`.
- Preserve save/load, undo/redo, camera, work-plane, layer manager, style manager, symbolic input, grid, auto-visibility, and all geometry behavior.


## Goal

Move Direct input from a global toolbar concept into per-Add-mode options, and show direct input forms as a drawer on the right side of the SVG Preview.

## Requirements

- Default input is cursor.
- Direct input is selected/expanded per Add mode.
- When Direct input is selected, an input window/drawer opens on the right side of SVG Preview.
- The drawer should be semi-transparent or panel-like and should not push the preview layout.
- It should be dismissible/collapsible.
- It should show the appropriate direct creation form for the current Add mode.

## Scope

Implement:

- direct input mode per Add tool/subtool;
- Preview-right direct input drawer;
- form placement inside drawer;
- close/collapse behavior;
- preservation of existing direct creation logic.

Do not implement:

- new direct creation capabilities;
- inspector drawer; Phase 21D;
- layer window; Phase 21E;
- broad form redesign.

## Direct input drawer behavior

When user chooses Direct for current Add mode:

- drawer opens on right side of SVG Preview.
- form corresponds to active Add tool:
  - point;
  - label;
  - Add path variants;
  - Add sheet variants;
  - grid if applicable;
  - variables if already separate should remain where appropriate.
- drawer height fits within Preview.
- drawer scrolls internally.
- drawer close returns to cursor or hides form according to chosen policy.

Clicking inside drawer should not propagate to SVG canvas.

## Add path direct input

Make sure Add path direct input remains reachable:

- manual path;
- line/cubic/arc segment;
- circle/ellipse template;
- symbolic coordinate input where supported.

Do not lose existing direct path functionality.

## Add sheet direct input

Make sure Add sheet direct input remains reachable where implemented:

- polygon sheet;
- ruled surface;
- Coons patch;
- filled paths;
- curved surfaces if any direct forms exist.

## Tests

Add tests where practical:

1. Selecting Direct for Add point opens drawer.
2. Selecting Direct for Add path opens path form.
3. Closing drawer hides form.
4. Drawer state is UI-only.
5. Direct creation still creates selected object.
6. Clicking drawer controls does not trigger SVG canvas handler.
7. Switching tools resets or preserves drawer according to documented policy.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Cursor is default.
2. Select Add point and enable Direct.
3. Drawer opens on right side of Preview.
4. Create point directly.
5. Select Add path and enable Direct.
6. Create direct path/circle/arc.
7. Drawer scrolls if form is tall.
8. Drawer close works.
9. Canvas clicks still work outside drawer.

## Preserve existing behavior

Do not regress:

- direct creation logic;
- cursor creation;
- symbolic coordinate input;
- work-plane-local direct input;
- SVG pointer mapping;
- TikZ output;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- direct input state model;
- drawer UI behavior;
- supported Add modes;
- close/switch policy;
- tests added/updated;
- test results;
- build results;
- limitations.
