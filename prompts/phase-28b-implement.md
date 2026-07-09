# Phase 28B Implementation Prompt: SVG Preview export button and sticky edge actions

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

Add SVG export for the diagram currently shown in SVG/PGF Preview, and place the Export SVG button as a sticky edge action at the right-bottom below the Preview frame, protruding outside the frame.

## Scope

Implement:

- Export SVG action;
- right-bottom below sticky placement;
- Preview edge action layout with Layer button;
- tests.

Do not implement:

- PNG export;
- screenshot including editor UI;
- new TikZ export behavior;
- toolbar translucency.

## Button placement

User-specified placement:

```text
Export SVG button is right-bottom below the Preview frame,
sticky, and allowed to protrude outside the frame.
```

Recommended layout:

```text
┌──────────────────────── Preview ────────────────────────┐
│                                                          │
│                                                          │
└──────────────────────────────────────────────┬───────────┘
                                               [Export SVG] [Layer L0/8]
```

or stacked if width is small.

Requirements:

- button remains visually attached to Preview frame;
- does not cover diagram content unnecessarily;
- does not conflict with Layer button;
- sticky behavior keeps it reachable during large Preview editing;
- accessible label.

## Export target

Export the diagram SVG, not UI chrome.

Include:

- current Preview view/projection/camera/pan/zoom;
- layer visibility;
- coordinate marker visibility only if markers are considered part of exported preview. Choose and document.
- arrow preview;
- surfaces/sheets/labels/paths;
- 3D visibility preview state if currently rendered.

Exclude:

- toolbar;
- buttons;
- layer/inspector/work-plane controls;
- selection handles;
- hover/cycling highlights;
- editor-only warnings.

Preferred default:

```text
Export current diagram view SVG without editor chrome.
```

## SVG content

Requirements:

- valid standalone SVG file;
- includes viewBox/width/height;
- includes inline styles or attributes so it renders outside the app;
- no React event handlers;
- no editor-only ids that break standalone display;
- filename reasonable, e.g. `stratified-tikz-preview.svg`.

If current SVG contains HTML/foreignObject, ensure output still works or document limitation.

## Future extensibility

Design so later modes can be added:

```text
Export current view SVG
Export fitted diagram SVG
```

MVP only needs current view.

## Tests

Add tests:

1. Export SVG button is rendered as Preview edge action.
2. Button is right-bottom below/protruding via class/style if testable.
3. Exported SVG excludes toolbar/button UI.
4. Exported SVG includes diagram path/point/sheet elements.
5. Exported SVG reflects current view transform/pan/zoom.
6. Exported SVG includes arrow preview elements if diagram has arrows.
7. Layer-hidden objects are not exported if not shown in Preview.
8. TikZ source unaffected.
9. Inline/standalone TikZ export unaffected.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Draw a diagram.
2. Click Export SVG at Preview right-bottom below edge.
3. Open downloaded SVG.
4. Confirm it contains diagram only, not toolbar/buttons.
5. Change pan/zoom/layers and export again.
6. Confirm current view reflected.

## Preserve existing behavior

Do not regress:

- Layer button;
- Preview overlays;
- TikZ export;
- save/load;
- SVG rendering;
- coordinate markers/show-hide;
- arrows/surfaces.

## Report after implementation

Please report:

- files modified;
- button placement;
- SVG serialization strategy;
- included/excluded elements;
- current-view behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
