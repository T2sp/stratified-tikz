# Phase 21A Implementation Prompt: Preview-centered UI shell and layout foundation

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

Refactor the editor into a preview-centered layout that matches the reference mockup at a structural level.

This subphase creates the layout foundation. Later subphases will move the toolbar, inspector, direct input, and layer manager into overlay/drawer components.

## Target layout

The target layout is:

```text
Top compact control area
  Example / File / TikZ style import / Variables / Work plane selector

Main preview area
  large SVG Preview
  overlay entry points for toolbar, inspector, layer, camera

TikZ Source area
  below the preview
```

The SVG Preview should be visually dominant.

## Scope

Implement:

- preview-centered page layout;
- large SVG Preview area;
- TikZ source below preview;
- compact top control area;
- stable panel heights and scroll behavior;
- responsive layout skeleton.

Do not implement yet:

- floating toolbar overlay; Phase 21B;
- direct input drawer; Phase 21C;
- inspector drawer; Phase 21D;
- ibis-style layer window; Phase 21E;
- drag layer swapping; Phase 21E;
- broad design-system rewrite;
- new dependencies.

## Requirements

### Top compact control area

Keep these controls accessible, but do not let them dominate vertical space:

- Example selector;
- File controls:
  - Name;
  - Download JSON;
  - Load JSON;
- TikZ style import;
- Variable editor;
- Work plane selector.

Use collapsible/compact cards if needed.

### Preview area

Requirements:

- SVG Preview is large.
- Preview is the central editor workspace.
- Preview wrapper should be `position: relative` so overlay controls can be placed inside it later.
- Existing camera overlay must continue to work or be preserved for later integration.
- Pointer coordinate mapping must not break.

### TikZ Source

Requirements:

- TikZ source is below the Preview area.
- TikZ source remains copyable/downloadable.
- Standalone/inline mode controls remain accessible.
- Source panel scrolls internally if long.
- Source updates live as before.

### Responsive behavior

For narrow screens:

- the layout should remain usable;
- controls may stack;
- Preview remains accessible;
- TikZ source remains accessible;
- no overlay/control permanently hidden.

## CSS guidance

Recommended:

```css
.app-shell {
    display: grid;
    grid-template-rows: auto minmax(560px, 1fr) auto;
    gap: 12px;
    min-height: 100vh;
}

.preview-shell {
    position: relative;
    min-height: 560px;
    overflow: hidden;
}

.tikz-source-shell {
    max-height: 38vh;
    overflow: auto;
}
```

Exact values can differ.

Use `min-height: 0` in grid/flex children where necessary.

## Tests

Add tests only where helpers/components are easily testable.

Good tests:

1. TikZ source generation unchanged.
2. SVG coordinate mapping helper unchanged.
3. Layout state is UI-only.
4. Copy/download still uses selected TikZ mode if testable.

Mostly rely on manual verification for CSS layout.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. SVG Preview is larger and central.
2. TikZ Source appears below Preview.
3. Example/File/TikZ style/Variable/Work plane controls are compact.
4. SVG selection works.
5. Cursor creation works.
6. Camera overlay/control still works.
7. TikZ source updates.
8. Narrow screen remains usable.

## Preserve existing behavior

Do not regress:

- all geometry creation/editing;
- SVG preview;
- pointer mapping;
- camera controls;
- work-plane controls;
- variables;
- style import;
- layer manager;
- TikZ source generation;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- new layout structure;
- CSS strategy;
- preview size behavior;
- TikZ source placement;
- responsive behavior;
- manual verification notes;
- tests added/updated;
- test results;
- build results;
- limitations.
