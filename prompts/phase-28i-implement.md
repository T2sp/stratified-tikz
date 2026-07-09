# Phase 28I Implementation Prompt: TikZ-faithful SVG arrow preview

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

Make SVG Preview arrowheads visually closer to generated TikZ output.

Current issue:

- SVG Preview arrowheads look identical across options.
- Generated TikZ differs for `>`, `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]`.

## Scope

Implement:

- arrowhead-shape-specific SVG preview;
- endpoint arrows;
- mid-arrows;
- 2D and 3D projected tangents;
- tests.

Do not implement:

- full TikZ renderer;
- new arrow model;
- new arrow options beyond existing model.

## Supported arrowheads

At minimum:

```text
\arrow{>}
\arrow{Stealth}
\arrow{Latex}
\arrow{Stealth[harpoon]}
\arrow{Stealth[harpoon,swap]}
```

Also handle:

- forward/backward direction;
- reversed path;
- mid-arrow at position;
- endpoint arrows.

## SVG implementation

Preferred:

- draw path body normally;
- draw arrowheads as separate SVG overlay shapes;
- compute position and tangent along projected curve;
- orient arrowhead by tangent angle;
- shape depends on arrowhead kind.

Do not rely solely on generic `<marker>` if it cannot handle mid-arrow/harpoon/swap.

## Shape mapping

Approximate:

- `>`: simple narrow triangular/open or filled arrow;
- `Stealth`: wider stealth-like filled arrow;
- `Latex`: classic narrow LaTeX-style arrowhead;
- `Stealth[harpoon]`: one-sided half stealth;
- `Stealth[harpoon,swap]`: opposite half stealth.

Style:

- stroke/fill uses path stroke color;
- opacity follows path opacity;
- size scales with line width.

## 3D

For 3D paths:

- project to screen coordinates;
- compute tangent in projected 2D space;
- place arrowhead in SVG space.

## Occlusion

If curve occlusion is active:

- if arrow position falls on hidden segment, use hidden style if current preview supports it;
- if too complex, document limitation but preserve ordinary visible path arrow fidelity.

## Tests

1. Each arrowhead kind produces distinct SVG shape/class.
2. `Stealth` differs from `Latex`.
3. Harpoon and harpoon swap differ.
4. Endpoint arrow orientation follows tangent.
5. Mid-arrow position follows configured `position`.
6. Reversed path reverses arrow direction.
7. Line width changes arrow size.
8. Stroke color/opacity applied.
9. 3D projected path arrow orientation finite.
10. Existing TikZ export unchanged.
11. Inline output no blank lines.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create paths with each arrowhead kind.
2. Confirm SVG preview visibly differs.
3. Compare roughly with generated TikZ/PDF.
4. Check mid-arrow and harpoon swap.

## Preserve existing behavior

Do not regress:

- arrow TikZ export;
- path rendering;
- 3D projection;
- curve occlusion;
- selection hit testing;
- save/load.

## Report after implementation

Please report files modified, shape design, tangent calculation, 2D/3D behavior, occlusion behavior, tests, results, limitations.
