# Phase 21F Implementation Prompt: UI overhaul polish, accessibility, and regression hardening

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

Polish and harden the full Phase 21 UI overhaul.

This subphase should ensure the new preview-centered UI is usable, responsive, accessible enough, and does not regress editor behavior.

## Scope

Implement:

- visual polish;
- overlay stacking/z-index cleanup;
- pointer-event regression fixes;
- responsive layout fixes;
- keyboard/accessibility labels;
- docs/help text;
- regression tests.

Do not implement:

- new geometry features;
- new layer semantics;
- full design system;
- new dependencies.

## Overlay stacking

Ensure overlays do not conflict:

- toolbar top;
- undo/redo under toolbar left;
- inspector button/drawer right;
- direct input drawer right;
- layer button/window bottom-right;
- camera button/window bottom-right;
- coordinate source highlights;
- geometry handles.

Requirements:

- overlay clicks stop propagation;
- canvas interactions work when clicking outside overlays;
- drawers/panels have predictable z-index;
- panels can close.

## Responsive behavior

Test and fix:

- desktop wide;
- medium width;
- narrow width.

Narrow fallback may stack panels.

No controls should be permanently unreachable.

## Accessibility

Add reasonable labels:

- toolbar collapse/expand;
- undo;
- redo;
- remove selected;
- inspector;
- layer;
- camera;
- direct input drawer close;
- layer actions.

Use native buttons where possible.

## Regression tests

Add tests where practical:

1. Overlay state is UI-only and not saved.
2. Toolbar collapse does not affect TikZ.
3. Inspector open/closed does not affect TikZ.
4. Layer window open/closed does not affect TikZ.
5. Direct drawer open/closed does not affect TikZ until creation.
6. Copy/download still works.
7. Major existing test suites still pass.

## Documentation/help

Add brief UI help docs or comments:

- toolbar location/collapse;
- Add path consolidation;
- Direct drawer behavior;
- Inspector drawer;
- Layer window.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Perform end-to-end checks:

1. Create point/path/sheet/surface.
2. Use toolbar collapse.
3. Undo/redo.
4. Remove selected.
5. Use direct drawer.
6. Open/close Inspector.
7. Open Layer window and change new layer.
8. Drag swap layers.
9. Use camera.
10. Generate/copy TikZ.
11. Save/load JSON.
12. Resize browser.

## Preserve existing behavior

Do not regress:

- all geometry creation/editing;
- direct/cursor input;
- layer/style/variable/grid managers;
- work plane/camera;
- symbolic input;
- auto visibility;
- save/load;
- undo/redo;
- SVG preview;
- TikZ generation.

## Report after implementation

Please report:

- files modified;
- polish changes;
- overlay stacking policy;
- responsive behavior;
- accessibility labels;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
