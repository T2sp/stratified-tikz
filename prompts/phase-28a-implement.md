# Phase 28A Implementation Prompt: Preview-first layout and compact Examples dropdown

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

Make SVG/PGF Preview the primary editing workspace.

Specifically:

- expand SVG Preview height to roughly 90% of the browser viewport;
- compact/collapse the Example bar so it does not consume editing space;
- keep layout responsive;
- preserve existing Preview overlays and lower panels.

## Scope

Implement:

- Preview-first page layout;
- Example bar compact/dropdown behavior;
- Preview safe-area layout for overlays;
- tests.

Do not implement yet:

- SVG export button;
- translucent toolbar styling;
- context quick style bar;
- work-plane overlay;
- arrow preview changes.

## Preview height

Use viewport-relative height.

Recommended:

```css
.preview-stage {
    height: min(90dvh, calc(100dvh - var(--compact-header-height) - 12px));
    min-height: 640px;
}
```

Adapt to existing CSS architecture.

Requirements:

- Preview should be large on desktop/laptop screens;
- page may scroll to reach Camera/View and TikZ source panels below;
- no overlap with header;
- responsive fallback for smaller screens;
- no horizontal overflow.

## Example bar behavior

Example bar is useful before editing, but after editing begins it should not take vertical space.

Required behavior:

### Initial / untouched state

May show the curated examples:

```text
Empty 2D
Empty 3D
2D example
3D example
Braiding
```

or whatever current example list is.

### After editing starts

Collapse to a compact control:

```text
Examples ▾
```

Editing starts when one of the following occurs:

- user creates/modifies/deletes any diagram object;
- user loads JSON;
- user changes style/geometry;
- user switches from an example and begins editing.

Do not collapse merely due to hover/focus.

### Expanded compact dropdown

Clicking `Examples ▾` opens a dropdown/popover.

Requirements:

- opening Examples does not push Preview down;
- dropdown overlays the page/header area;
- examples remain clickable;
- switching examples still follows existing confirmation/reset policy;
- keyboard/accessibility labels reasonable.

## Safe-area layout

Preview is now larger and will contain more overlays.

Define/maintain safe areas for:

- top toolbar;
- right-bottom edge actions;
- left-bottom work-plane editor later;
- right-top Inspector button;
- right-bottom Layer button;
- modals/popovers.

Phase 28A does not need to implement all future controls, but should avoid layout choices that make them impossible.

## Tests

Add tests:

1. Preview stage has large viewport-oriented layout class/style.
2. Example bar is expanded before editing if current policy says so.
3. Editing action collapses Example bar to compact dropdown.
4. Loading JSON collapses Example bar.
5. Example dropdown opens without reducing Preview height.
6. Switching examples still works.
7. Preview overlays still render.
8. TikZ output unaffected by Example bar state.
9. Example bar state is UI-only and not stored in Diagram.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open app on desktop screen.
2. Confirm Preview occupies roughly 90% viewport height.
3. Confirm Examples do not dominate top vertical space.
4. Start editing; confirm Examples compact.
5. Open Examples dropdown; confirm Preview height does not shrink.
6. Scroll to TikZ source; confirm layout still usable.

## Preserve existing behavior

Do not regress:

- example loading;
- preview rendering;
- toolbar overlays;
- Inspector/Layer buttons;
- Camera/View panel;
- TikZ source;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- Preview height strategy;
- Example bar collapse trigger;
- dropdown behavior;
- responsive behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
