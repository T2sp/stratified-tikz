# Phase 28G Implementation Prompt: Work-plane setup UX overhaul with origin + normal vector

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

Improve 3D work-plane setup UX.

Required method order:

1. Pick 3 existing points.
2. Origin + normal vector.
3. Custom 3 points.

Add a usable origin + normal vector method with normal theta/phi controls and a small normal-vector preview.

## Scope

Implement:

- method order/relabeling;
- Pick 3 existing points improvements;
- Origin + normal vector method;
- normal theta/phi input;
- normal vector preview;
- tests.

Do not implement:

- live coordinateRef work planes;
- new 3D camera model;
- broad work-plane model redesign.

## Method order

Panel should list:

```text
Pick 3 existing points
Origin + normal vector
Custom 3 points
```

in this order.

## Pick 3 existing points

Support picking:

- point strata;
- coordinate anchors.

If coordinate anchors are hidden, they are not pickable.

Frame is snapshot-based unless existing model supports live refs.

## Origin + normal vector

UI:

```text
Origin:
  pick existing point/coordinate
  or direct xyz

Normal vector:
  theta
  phi
  [mini preview]
```

Use mathematical spherical convention:

```text
theta = polar angle from +z
phi = azimuth in xy plane from +x

normal = (
  sin(theta) * cos(phi),
  sin(theta) * sin(phi),
  cos(theta)
)
```

Use degrees.

If the project already has a different theta/phi convention, document and avoid conflict with camera theta/phi by labeling:

```text
Normal theta
Normal phi
```

## Basis choice

Normal vector alone does not determine plane x/y.

MVP deterministic rule:

1. project world +x onto the plane and normalize as plane x;
2. if +x nearly parallel to normal, use world +y;
3. plane y = normal × plane x or existing handedness convention.

Document/test.

## Normal vector preview

Small SVG preview near theta/phi:

- x/y/z axes;
- normal arrow;
- optional theta/phi arcs.

Does not need full 3D rendering.

## Tests

1. Method order correct.
2. Pick 3 accepts coordinate anchors.
3. Pick 3 creates valid snapshot frame.
4. Origin + normal numeric theta/phi creates expected normal.
5. Phi/theta edge cases handled.
6. Basis deterministic and orthonormal.
7. Normal preview rendered.
8. Origin from coordinate anchor works.
9. Hidden coordinate anchors not pickable.
10. Custom 3 points still works.
11. Save/load active work-plane behavior unchanged.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open 3D work-plane panel.
2. Confirm method order.
3. Create work plane with coordinate anchors.
4. Create work plane with origin + normal theta/phi.
5. Confirm normal preview updates.

## Preserve existing behavior

Do not regress:

- existing work-plane creation;
- active work-plane local input;
- camera;
- cursor creation;
- TikZ export.

## Report after implementation

Please report files modified, method order, normal convention, basis rule, coordinate-anchor pick behavior, tests, results, and limitations.
