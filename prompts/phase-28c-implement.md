# Phase 28C Implementation Prompt: Translucent toolbar/buttons, z-index tokens, and topmost variable modal

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```
## Project context

You are working on the StratifiedTikZ project.

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The editor already has mature core editing features:

- 2D and 3D diagrams;
- SVG/PGF Preview-centered editing;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- coordinate-anchor multi-selection/translation;
- symbolic-aware translation;
- path concatenation;
- path inline nodes and path splitting;
- style eyedropper;
- selection cycling;
- layer palette/window;
- custom work planes and camera/view controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 28 is a preview-first UI, style shortcut, work-plane UX, SVG export, arrow-preview, and help/tutorial phase.

High-level design principles:

- SVG Preview is the main workspace.
- Reduce scrolling during editing.
- Reduce toolbar/palette calls during editing.
- Keep frequent style edits available from Preview toolbar shortcuts.
- Keep Inspector for detailed editing.
- Keep TikZ source/export readable and unchanged unless the user explicitly changes diagram/style data.
- UI-only state must not be saved into `Diagram`.
- Exported TikZ must keep 4-space indentation.
- Inline math output must contain no blank lines.
- Preserve save/load, undo/redo, coordinate anchors, coordinate refs, symbolic input, work-plane-local coordinates, layers, camera/view, arrows, braiding, path inline nodes/splitting, and existing geometry semantics.

Important user-specified UI requirements:

- SVG Preview height should expand to roughly 90% of the browser viewport.
- Example bar should not consume editing space; after editing begins it should collapse into a compact/dropdown control.
- Export SVG button should be sticky at the right-bottom below the Preview frame, protruding outside the frame.
- Toolbar background should be translucent.
- Toolbar buttons should also be translucent, but button text must remain fully opaque/readable.
- Load-JSON variable-resolution modal must appear above toolbar and all preview overlays.
- Coons direction window should auto-close when leaving Coons workflow or selecting other tools/subtools.
- 3D work-plane editor should be a Preview overlay near the left-bottom, similar in spirit to the current layer manager.
- 3D Add coordinate / Add point with active work-plane-local coordinates should support polar input in the work plane.
- Work-plane local polar input should show the active work-plane origin near the input.
- Work-plane setup UX should list methods in this order:
  1. Pick 3 existing points;
  2. Origin + normal vector;
  3. Custom 3 points.
- Origin + normal vector should use normal-vector theta/phi input with a small normal-vector preview.
- Arrow previews in SVG should look like the generated TikZ arrows, including `>`, `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`.
- Context quick style bar should expose frequently changed style fields:
  - curve/path stroke color;
  - curve/path stroke width;
  - arrows;
  - point fill/color;
  - point radius;
  - sheet fill/opacity/stroke width;
  - label color/scale where applicable;
  - style eyedropper;
  - imported TikZ style dropdown if it does not clutter the toolbar.
- Stroke-width-like fields and point radius should use a snapped slider with step `0.1` plus custom numeric input.
- Numeric text inputs should allow temporary invalid drafts and show warnings instead of blocking intermediate input, so `.5`, `.`, `-`, `1e` can be typed.
- Imported TikZ styles in the shortcut bar should be compact/searchable and should avoid duplicating options in generated TikZ unless the user explicitly overrides a field.


## Goal

Polish Preview overlay styling and modal stacking.

Implement:

- translucent toolbar background;
- translucent toolbar buttons with opaque text;
- z-index token hierarchy;
- ensure Load JSON variable-resolution modal is above toolbar and all overlays.

## Scope

Implement:

- CSS/layout styling;
- z-index variables/tokens;
- modal topmost behavior;
- tests.

Do not implement:

- new toolbar commands;
- context quick style bar;
- SVG export;
- broad UI rewrite.

## Toolbar translucency

User requirement:

- toolbar background is translucent;
- toolbar buttons are also translucent;
- button text must not be faded.

Do **not** use parent `opacity`, because it fades text.

Use `rgba()` backgrounds.

Recommended:

```css
.preview-toolbar {
    background: rgba(248, 246, 238, 0.42);
    backdrop-filter: blur(10px);
}

.preview-toolbar button {
    background: rgba(255, 255, 255, 0.36);
    color: rgb(20, 24, 32);
}

.preview-toolbar button:hover {
    background: rgba(255, 255, 255, 0.62);
}

.preview-toolbar button.is-active {
    background: rgba(255, 255, 255, 0.82);
}
```

Adapt to existing design tokens.

Requirements:

- text remains fully opaque/readable;
- active button clear;
- disabled button readable but subdued;
- background does not fully block Preview;
- no accessibility disaster.

## Z-index hierarchy

Define or rationalize z-index tokens:

```css
--z-preview-canvas: 0;
--z-preview-selection: 5;
--z-preview-toolbar: 20;
--z-preview-context-bar: 21;
--z-preview-edge-actions: 25;
--z-workplane-panel: 30;
--z-layer-window: 35;
--z-inspector-drawer: 40;
--z-popover: 60;
--z-modal-backdrop: 90;
--z-modal: 100;
```

Exact values can differ.

Requirements:

- variables modal is above toolbar;
- layer window/inspector/popovers stack predictably;
- toolbar remains above canvas;
- edge actions remain clickable;
- no accidental pointer-event blocking.

## Variable resolution modal

Load JSON variable setting dialog must be topmost.

Requirements:

- appears over toolbar, layer window, inspector, work-plane panel;
- focus is inside modal;
- background interactions disabled;
- Escape/Cancel behavior preserved;
- no click-through to toolbar.

## Tests

Add tests:

1. Toolbar uses translucent background class/style.
2. Buttons use translucent background but text has opaque color.
3. Toolbar does not use parent opacity.
4. Variable modal has modal z-index/topmost class.
5. Variable modal appears above toolbar in DOM/class hierarchy if testable.
6. Modal blocks toolbar interaction while open.
7. Layer/Inspector overlay z-index not regressed.
8. Existing toolbar commands still work.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Toolbar over Preview: diagram visible behind it.
2. Button text readable.
3. Active/hover states readable.
4. Load JSON needing variables.
5. Confirm variable dialog above toolbar.
6. Try clicking toolbar behind modal; should not work.

## Preserve existing behavior

Do not regress:

- toolbar interactions;
- palette open/close;
- layer window;
- inspector drawer;
- variable import workflow;
- save/load;
- TikZ export.

## Report after implementation

Please report:

- files modified;
- transparency implementation;
- z-index token hierarchy;
- modal stacking behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
