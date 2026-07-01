# Phase 26G Implementation Prompt: Coordinate anchor marker, show/hide toggle, and hit-test priority

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

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

The repository is a React/TypeScript/Vite GUI for 3-dimensional graphical calculus. It has the expected project structure including `src`, `tests`, `docs`, `prompts`, and automation scripts.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- symbolic variables and symbolic global/work-plane-local coordinate expressions;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- custom work planes and camera controls;
- layer palette/window;
- style manager and imported TikZ style references;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 26 adds TikZ coordinate anchors, distinct from visible point strata.

Core distinction:

```text
Add point:
  visible diagram object
  layer-bound
  styled point
  exported as visible mark/node/drawing command

Add coordinate:
  global reference anchor
  not layer-bound
  exported as \coordinate
  usable by paths/sheets/labels/points as a coordinate reference
  preview-only marker in SVG/PGF Preview
```

Important design requirements:

- Coordinate anchors are global and not layer-bound.
- Coordinate anchors are exported before layer drawing commands.
- Coordinate anchors are not affected by layer View filter or New layer.
- Coordinate anchors can be created by cursor input and direct input.
- Direct input supports both global xyz and work-plane-local symbolic coordinates.
- Coordinate references should be preserved in TikZ when used by paths/sheets/labels/points.
- In SVG Preview, coordinate anchors should eventually appear as a small dot surrounded by a small dotted circle.
- Users need a Show/Hide Coordinates toggle.
- When shown, coordinate anchors should have high hit-test priority over layer-bound geometry.
- Deleting a referenced coordinate should detach references rather than leaving dangling refs.
- During layer translation, layer-bound elements that reference global coordinates should detach first, because coordinate anchors are global and do not move with layers.
- Detach should preserve symbolic/global/work-plane-local coordinate information where supported.
- UI-only state such as show/hide and selection is not stored in `Diagram`.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, arrow/braiding behavior, SVG preview, and TikZ generation.


## Goal

Polish coordinate anchor preview and selection behavior.

Implement:

- coordinate anchors rendered as a small dot surrounded by a small dotted circle;
- show/hide coordinate anchor toggle;
- coordinate hit-test priority over layer-bound geometry when shown.

## Scope

Implement:

- SVG marker visual update;
- show/hide UI state;
- hit-test priority;
- selected coordinate marker styling;
- tests.

Do not implement:

- detach-on-delete;
- layer-translation detach;
- usage-count Inspector.

## Marker appearance

Required:

```text
small dot + small dotted circle
```

Suggested SVG:

```tsx
<g className="coordinate-anchor-marker">
  <circle className="coordinate-anchor-marker__halo" fill="none" strokeDasharray="1.5 2" />
  <circle className="coordinate-anchor-marker__dot" />
</g>
```

Requirements:

- distinct from point stratum;
- preview-only;
- visible above paths/sheets;
- selected state clear;
- no TikZ effect.

## Show/hide toggle

Add:

```text
Coordinates: Show / Hide
```

Requirements:

- hidden coordinates are not rendered;
- hidden coordinates do not intercept clicks;
- references still work;
- `\coordinate` export unchanged;
- UI state only, not saved;
- hiding selected coordinate should clear coordinate selection or follow a documented safe policy.

## Hit-test priority

When shown:

```text
1. active geometry handles
2. coordinate anchors
3. point/label objects
4. curves/paths
5. sheets/regions
6. background
```

Requirements:

- coordinate anchor can be selected even over a path/sheet;
- hidden anchors do not intercept;
- layer filter does not hide anchors.

## Tests

Add tests:

1. marker has dot and dotted circle;
2. show renders markers;
3. hide hides markers;
4. hidden anchors do not hit-test;
5. shown anchors win over paths/sheets;
6. show/hide not serialized;
7. TikZ output unchanged by show/hide.

## Report after implementation

Please report files modified, marker design, toggle location, hit-test policy, tests, results, and limitations.
