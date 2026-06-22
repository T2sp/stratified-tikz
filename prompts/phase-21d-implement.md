# Phase 21D Implementation Prompt: Inspector drawer from SVG Preview button

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

Change Inspector behavior so it opens only when the user presses an Inspector button in the SVG Preview.

The Inspector should open as a drawer/panel on the right side of SVG Preview with the same height as the Preview.

## Requirements

- Inspector button appears in SVG Preview upper-right.
- Inspector is hidden/collapsed by default or according to last UI state.
- Pressing Inspector button opens the Inspector on the right side of SVG Preview.
- Inspector height matches SVG Preview height.
- Inspector scrolls internally.
- Existing inspector content and editing behavior remain unchanged.
- The Inspector drawer should not push the Preview or TikZ source around.

## Scope

Implement:

- Inspector overlay/drawer entry button;
- Inspector panel on right side of Preview;
- open/close behavior;
- internal scrolling;
- preservation of existing Inspector functionality.

Do not implement:

- layer window redesign; Phase 21E;
- broad inspector field redesign;
- new editing features.

## Behavior

When Inspector is closed:

- show compact Inspector button at Preview upper-right.
- selection can still exist.
- selecting/creating objects should not automatically open Inspector unless you choose and document that behavior.
- Preferred: do not auto-open; user opens manually.

When Inspector is open:

- it appears on Preview right side.
- height matches Preview.
- panel scrolls internally.
- close button available.
- editing fields work as before.

## Tests

Add tests if practical:

1. Inspector drawer opens/closes.
2. Closed Inspector state is UI-only.
3. Inspector editing still updates diagram.
4. Inspector drawer click does not trigger SVG canvas.
5. TikZ output unaffected by Inspector open state.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Inspector button appears upper-right in Preview.
2. Click it.
3. Inspector opens on right side.
4. Height matches Preview.
5. Select/edit element.
6. Inspector scrolls internally.
7. Close Inspector.
8. TikZ/SVG unaffected.

## Preserve existing behavior

Do not regress:

- inspector fields;
- style editing;
- coordinate editing;
- selection;
- direct/cursor creation;
- layer/style/variable/grid managers;
- TikZ output.

## Report after implementation

Please report:

- files modified;
- Inspector drawer behavior;
- default open/closed policy;
- CSS strategy;
- tests added/updated;
- test results;
- build results;
- limitations.
