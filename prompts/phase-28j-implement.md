# Phase 28J Implementation Prompt: Phase 28 docs, tutorial hooks, and UI regression hardening

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

Polish and harden Phase 28.

Add docs/help updates and regression tests for the preview-first UI, SVG export, style shortcuts, work-plane UX, and arrow preview.

## Scope

Implement:

- docs/help updates;
- combined workflow tests;
- responsive layout tests where feasible;
- accessibility polish.

## Docs/help topics

Update Help/docs for:

- compact Examples dropdown;
- large Preview workspace;
- Export SVG;
- translucent toolbar;
- context quick style bar;
- stroke width/radius sliders;
- imported TikZ style shortcut;
- work-plane overlay;
- work-plane polar input;
- origin + normal vector setup;
- arrow preview limitations/behavior.

## Combined tests

Add tests:

1. Large Preview + Export SVG + Layer button layout.
2. Toolbar style shortcut edit then SVG export.
3. Imported style apply then explicit override.
4. Work-plane polar coordinate creation then TikZ export.
5. Origin + normal vector work-plane setup.
6. Coons direction auto-close.
7. Arrow preview distinct shapes.
8. Variable modal topmost.
9. Inline TikZ no blank lines.
10. 4-space indentation.

## Accessibility

- Export SVG button accessible label.
- Work-plane overlay accessible labels.
- Style shortcut inputs labels.
- Modal focus behavior.
- Toolbar buttons readable with translucent styling.

## Report after implementation

Report docs, tests, accessibility changes, results, limitations.
