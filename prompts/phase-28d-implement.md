# Phase 28D Implementation Prompt: Context quick style bar with 0.1-step sliders and custom numeric input

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

Add a context quick style bar to the Preview toolbar for frequently changed style fields.

The bar should reduce Inspector trips and scrolling during editing.

Core requirements:

- context-sensitive by selected `geometricKind`;
- stroke-width-like fields and point radius use slider snapped to `0.1`;
- custom numeric input allowed;
- invalid numeric drafts allowed with warnings;
- multi-selection mixed values supported;
- slider drags should not create excessive undo history.

## Scope

Implement:

- context quick style bar;
- curve/path stroke color, stroke width, arrows shortcut entry points;
- point color/radius shortcuts;
- sheet/region fill/stroke/opacity/stroke width shortcuts;
- label basic shortcuts if supported;
- reusable snapped style slider component;
- tests.

Do not implement yet:

- imported TikZ style dropdown;
- toolbar eyedropper workflow;
- broad Inspector redesign;
- new style model fields.

## Context bar visibility

Show when there is a compatible selection:

- single curve/path;
- same-geometricKind multi-selection;
- point(s);
- sheet/region(s);
- label(s).

Do not show style shortcuts for coordinate anchors because they have no style.

If selection is mixed/incompatible:

- hide context bar or show clear status;
- do not apply partial style edits.

## Curve/path shortcuts

Include:

```text
Stroke color
Stroke width
Arrow
```

Recommended:

```text
Stroke [color swatch]  Width [slider] [input]  Arrow [dropdown]
```

Stroke width:

```text
min: 0.1
max: 8.0 or existing sensible max
step: 0.1
```

If current units are pt, label accordingly.

## Point shortcuts

Include:

```text
Fill/color
Radius
```

Radius uses same slider/input pattern:

```text
step: 0.1
```

## Sheet/region shortcuts

Include:

```text
Fill color
Fill opacity
Stroke color
Stroke width
```

Fill opacity:

```text
min: 0
max: 1
step: 0.05 or 0.1
```

Stroke width step:

```text
0.1
```

## Label shortcuts

If label style fields exist, include compact:

```text
Text color
Scale
```

Scale may use 0.1-step slider/custom input.

If label style model is not stable, defer and document.

## Snapped slider + custom numeric input

For stroke width / point radius / scale:

- slider uses step `0.1`;
- numeric input supports custom values such as `0.35`;
- text input allows temporary invalid drafts:
  - `.`
  - `.5`
  - `-`
  - `1e`
  - empty string
- invalid drafts show warning;
- invalid drafts do not mutate diagram;
- valid input commits according to chosen policy.

Recommended:

```text
slider:
  live preview updates during drag
  one undo entry on pointer up

numeric:
  local draft on change
  commit on Enter/blur when valid
```

If live preview during slider drag is too hard, commit on change but coalesce history if existing infrastructure supports it. Avoid many undo entries.

## Multi-selection mixed values

If selected objects share a field value, show it.

If values differ:

```text
mixed
```

Behavior:

- moving slider from mixed applies the new value to all selected targets;
- editing color/width applies only that field;
- one undo entry.

## Tests

Add tests:

1. Context bar appears for selected curve.
2. Stroke width slider step is 0.1.
3. Stroke width numeric input accepts `.5` draft and commits 0.5.
4. Invalid draft shows warning and does not mutate diagram.
5. Slider update changes curve stroke width.
6. Slider drag commits one undo entry or history is coalesced according to policy.
7. Point radius shortcut works with step 0.1.
8. Sheet stroke width/fill opacity shortcut works.
9. Mixed multi-selection shows mixed.
10. Editing mixed width applies to all selected curves.
11. Coordinate anchor selection does not show style shortcut.
12. TikZ output reflects style shortcut changes.
13. Inline output no blank lines.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Select path; change stroke width via slider.
2. Type `.5` in width input.
3. Select points; change radius.
4. Multi-select curves with different widths; confirm mixed then apply.
5. Undo once after slider drag.
6. Confirm Inspector reflects changes.

## Preserve existing behavior

Do not regress:

- Inspector style editing;
- style eyedropper;
- imported styles;
- arrows;
- multi-selection;
- undo/redo;
- TikZ export.

## Report after implementation

Please report:

- files modified;
- context bar placement;
- fields supported by geometricKind;
- slider ranges/step;
- numeric draft/commit policy;
- undo coalescing policy;
- multi-selection behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
