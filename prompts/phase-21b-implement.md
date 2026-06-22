# Phase 21B Implementation Prompt: Floating SVG Preview toolbar and tool model cleanup

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

Move the main tool controls into a compact translucent toolbar inside the SVG Preview, and simplify the creation tool model.

This implements the toolbar part of the reference UI.

## Requirements from the user

- The toolbar should appear at the top inside the SVG Preview.
- It should be horizontally arranged and take as little height as practical.
- Toolbar background should be semi-transparent.
- Show ↑ / ↓ button to collapse the toolbar into the top edge of SVG Preview and expand it again.
- Undo / Redo should always be displayed just below the toolbar on the left side of the SVG Preview as semi-transparent buttons.
- Remove selected should be implemented as a trash icon-like button at the right end of the toolbar.
- Default input is cursor input.
- Direct input should be an option expanded per Add mode, not a global toolbar mode.
- Add polyline and Add cubic Bézier should be integrated into Add path.
- Fill paths should appear only when Select or Add path is active.

## Scope

Implement:

- floating toolbar overlay in SVG Preview;
- collapse/expand toolbar button;
- persistent Undo/Redo overlay buttons;
- trash/remove selected toolbar button;
- tool model cleanup for Add path;
- hide/remove global Direct input toggle;
- show Fill paths only in Select/Add path context.

Do not implement yet:

- direct input drawer; Phase 21C;
- inspector drawer; Phase 21D;
- layer window; Phase 21E;
- new geometry features.

## Toolbar content

Suggested toolbar items:

```text
[Select] [Add point] [Add label] [Add path ▾] [Add sheet ▾] [Fill paths] ... [Trash]
```

`Add path` should include:

- line/manual path;
- polyline behavior;
- cubic Bézier behavior;
- arc;
- circle;
- ellipse;
- existing path templates.

Exact UI can differ if existing components are reused.

## Collapse/expand behavior

Requirements:

- expanded toolbar is visible at the top inside Preview.
- collapse button hides most controls into top edge.
- a small expand button remains visible.
- collapse state is UI state only.
- does not affect diagram data or export.
- does not break keyboard/mouse interactions.

## Undo/Redo overlay

Requirements:

- always visible in SVG Preview area;
- placed below toolbar on the left;
- semi-transparent;
- disabled state visible;
- clicking stops propagation so it does not select/create geometry.

## Remove selected

Requirements:

- trash icon-like button at the right end of toolbar;
- disabled when nothing removable is selected;
- uses existing remove selected logic;
- stops event propagation.

If no icon library is present, use text/emoji/simple SVG:

```text
🗑
```

or an inline simple icon.

No new dependency.

## Tool model cleanup

### Default input

- default behavior is cursor input.
- remove or de-emphasize global `Input: cursor/direct` toolbar selector.

### Direct input per Add mode

- direct input will be shown as an option inside each Add mode menu/panel.
- actual direct input drawer is Phase 21C.
- For this phase, make sure global direct toggle is no longer the main UI driver.

### Add path consolidation

- remove separate top-level Add polyline and Add cubic Bézier buttons.
- Add them under Add path mode.
- Existing creation behavior must remain available:
  - polyline;
  - cubic Bézier;
  - concatenated path;
  - arc/circle/ellipse templates if implemented.

### Fill paths visibility

- show Fill paths only when active tool is:
  - Select; or
  - Add path.
- hide/disable it otherwise.

## Tests

Add tests where practical:

1. Toolbar collapse state toggles.
2. Undo/Redo actions still call existing history handlers.
3. Trash button calls remove selected.
4. Fill paths visible only in Select/Add path states.
5. Add path menu exposes polyline and cubic Bézier options.
6. Global input selector is not required for cursor default if testable.
7. Overlay button clicks do not propagate to SVG canvas if component-testable.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Toolbar appears inside SVG Preview top.
2. Toolbar is semi-transparent.
3. Collapse/expand works.
4. Undo/Redo appear below toolbar left.
5. Undo/Redo do not create/select diagram objects.
6. Trash/remove selected works.
7. Add path contains polyline and cubic Bézier.
8. Fill paths appears only in Select/Add path.
9. Cursor creation remains default.
10. Existing creation modes still work.

## Preserve existing behavior

Do not regress:

- all creation tools;
- undo/redo;
- remove selected;
- fill paths;
- SVG pointer mapping;
- camera overlay;
- TikZ output;
- save/load.

## Report after implementation

Please report:

- files modified;
- toolbar overlay structure;
- collapse behavior;
- Undo/Redo overlay behavior;
- Add path consolidation;
- Fill paths visibility rule;
- tests added/updated;
- test results;
- build results;
- limitations.
