# Phase 28F Implementation Prompt: Work-plane overlay editor and work-plane-local polar coordinate input

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

Improve 3D work-plane usability.

Implement:

1. Work-plane editor as SVG Preview left-bottom overlay.
2. Active work-plane-local polar coordinate input for 3D Add coordinate / Add point.
3. Work-plane origin reference display near the input.

## Scope

Implement:

- Preview left-bottom Work Plane button/panel;
- 3D-only overlay behavior;
- Add coordinate/Add point local Cartesian/Polar toggle;
- polar `r, theta` input;
- symbolic polar input converted to local `a,b`;
- origin reference display;
- tests.

Do not implement yet:

- work-plane setup order/normal vector overhaul;
- arrow preview changes;
- broad work-plane model redesign.

## Work-plane overlay

Place in Preview left-bottom, similar in spirit to layer manager.

Button:

```text
Work plane: <name/preset> ▾
```

Panel:

```text
Work plane
  current origin
  current plane x / plane y
  setup method controls
  reset/apply
```

Phase 28F may include only current work-plane display and entry point if setup UX is Phase 28G.

Requirements:

- 3D only;
- does not cover major drawing area too much;
- respects z-index hierarchy;
- does not conflict with Layer button/right-bottom edge actions.

## Polar local coordinate input

When Add coordinate or Add point direct input has:

```text
Coordinate mode: Active work-plane local
```

add:

```text
Input mode:
  Cartesian
  Polar
```

Cartesian:

```text
a / plane x
b / plane y
```

Polar:

```text
r
theta
```

Use degrees for theta.

Convert:

```text
a = r * cos(theta)
b = r * sin(theta)
```

For symbolic inputs:

```text
r = R
theta = q
```

store as local expressions:

```text
a = R*cos(q)
b = R*sin(q)
```

using the existing symbolic formatter/parser conventions.

Do not snap direct symbolic input.

## Origin reference display

Near the polar input, show:

```text
Active work-plane origin: (x, y, z)
```

Also show compact plane x/plane y vectors if space allows.

Requirements:

- updates when active work-plane changes;
- read-only;
- no geometry mutation.

## Tests

Add tests:

1. Work-plane overlay button appears in 3D, not 2D.
2. Overlay opens/closes.
3. Add coordinate local polar input accepts numeric r/theta.
4. Numeric polar converts to correct a/b preview.
5. Symbolic polar `R, q` stores `R*cos(q)` / `R*sin(q)` or equivalent.
6. Add point local polar works.
7. Direct polar input not snapped.
8. Origin reference display renders current origin.
9. Save/load of polar-created coordinates works as local a/b.
10. TikZ export preserves local symbolic expressions.
11. Inline output no blank lines.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open 3D diagram.
2. Confirm Work plane button at left-bottom.
3. Add coordinate in active work-plane local polar mode.
4. Enter `r=R`, `theta=q`.
5. Confirm preview and TikZ local expressions.
6. Confirm origin reference text.

## Preserve existing behavior

Do not regress:

- existing work-plane selection;
- global/local Cartesian input;
- cursor input;
- coordinate anchors;
- symbolic input;
- TikZ export;
- save/load.

## Report after implementation

Please report:

- files modified;
- overlay placement;
- polar input behavior;
- symbolic conversion;
- origin reference display;
- tests added/updated;
- test results;
- build results;
- limitations.
