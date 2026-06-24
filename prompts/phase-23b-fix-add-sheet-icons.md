# Phase 23B Fix Prompt: Replace ambiguous Add sheet palette icons

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

## Context

You are working on the StratifiedTikZ project.

Phase 23B polished the toolbar palette behavior and made the Add sheet palette visually similar to the Add path palette.

Manual UI review found a remaining usability issue:

- The current Add sheet palette icons are too visually similar.
- The icons do not clearly communicate the meaning of each sheet type.
- In the current palette, it is hard to distinguish:
  - Polygon;
  - Coons;
  - Ruled;
  - Hemisphere;
  - Direct input.
- The user wants these icons replaced with more intuitive and visually distinct ones.

The current Add sheet palette order is already intended to be:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

Do not change this order.

## Goal

Replace the Add sheet palette icons with clearer, more semantically appropriate icons.

The final palette should make it obvious, at a glance, which item is:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

## Scope

This is a targeted Phase 23B UI polish fix.

Implement:

- new distinct icons for Add sheet palette items;
- reusable icon components or inline SVGs;
- accessible labels;
- tests where practical.

Do not implement:

- new sheet geometry;
- new surface primitives;
- new palette items;
- new toolbar architecture;
- new dependencies;
- broad UI redesign.

Do not change:

- Add sheet item order;
- Add sheet creation behavior;
- Coons/Ruled boundary picking behavior;
- Coons direction UI;
- Hemisphere creation behavior;
- Direct input behavior;
- TikZ generation;
- SVG geometry rendering;
- save/load;
- undo/redo.

## Required Add sheet palette icons

Use inline SVGs or existing local icon components.

Do not add an icon library dependency.

Each icon should be small, clear, and visually distinct at toolbar-palette size.

### 1. Polygon

Icon should suggest a flat polygonal sheet.

Recommended visual:

- quadrilateral/parallelogram outline;
- optionally lightly filled;
- visible corner points.

Example concept:

```text
▱
```

Better as inline SVG:

- four-corner polygon;
- maybe one diagonal or subtle fill.

Avoid icons that look like generic line/path tools.

### 2. Coons

Icon should suggest a curved four-boundary patch.

Recommended visual:

- curved quadrilateral patch;
- four boundary arcs;
- perhaps slightly warped square with curved edges.

Example concept:

```text
curved square / warped patch
```

Important:

- should be visibly different from Polygon.
- should communicate “four curved boundaries”.

### 3. Ruled

Icon should suggest a ruled surface between two boundary curves.

Recommended visual:

- two roughly parallel curves;
- several short straight ruling lines connecting them.

Example concept:

```text
~~~~
||||   or short connectors
~~~~
```

Better as inline SVG:

- top curved path;
- bottom curved path;
- 3-4 straight connector segments.

Important:

- should not look like the Coons icon.
- should emphasize straight rulings between two curves.

### 4. Hemisphere

Icon should suggest a dome / half sphere.

Recommended visual:

- semicircular dome outline;
- base line;
- maybe one meridian/latitude curve.

Example concept:

```text
◠ over a baseline
```

Better as inline SVG:

- half-circle dome;
- horizontal base;
- one curved meridian line.

Important:

- should not look like a generic arc path icon.
- should communicate a surface/dome, not just a curve.

### 5. Direct input

Icon should suggest typed input or a form.

Recommended visual:

- small keyboard;
- small input panel;
- `⌨` glyph is acceptable if consistent.

If using SVG:

- rectangle with small horizontal input lines;
- or keyboard-like grid.

This icon may stay similar to current if it is already clear, but it should visually match the new sheet icons.

## Styling requirements

Icons should match the Add path palette style.

Requirements:

- same icon box size as Add path icons;
- same line weight;
- same color treatment;
- hover/focus states remain consistent;
- disabled states remain readable;
- text labels remain visible beside icons;
- no visual overflow from palette item height;
- works in light/dark/current theme as applicable.

Suggested implementation:

```tsx
function PolygonSheetIcon() { ... }
function CoonsPatchIcon() { ... }
function RuledSurfaceIcon() { ... }
function HemisphereIcon() { ... }
function DirectInputIcon() { ... }
```

or a shared `PaletteIcon` wrapper.

Use `aria-hidden="true"` on decorative SVG icons and rely on the button label for accessible name.

## Palette content/order preservation

The Add sheet palette must still show exactly:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

in that order.

Do not reintroduce Saddle.

Do not add extra items.

Do not split Direct input into multiple items.

## Behavior preservation

Selecting each item must keep the same behavior as before:

- Polygon activates polygon sheet creation.
- Coons activates Coons patch creation / boundary picking.
- Ruled activates ruled surface creation / boundary picking.
- Hemisphere activates hemisphere creation.
- Direct input opens the sheet direct input drawer/form.

The icon change must not alter tool state semantics.

## Accessibility

Requirements:

- buttons retain readable text labels;
- icons are decorative or have clear accessible labels;
- keyboard focus styling remains visible;
- no icon-only controls unless they have `aria-label`.

## Tests

Add focused tests where practical.

### Palette structure tests

1. Add sheet palette contains exactly these labels in order:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

2. Saddle is not present.

3. Direct input appears exactly once.

### Icon tests

4. Polygon item renders a polygon-specific icon component or icon marker.

5. Coons item renders a Coons-specific icon component or icon marker.

6. Ruled item renders a Ruled-specific icon component or icon marker.

7. Hemisphere item renders a Hemisphere-specific icon component or icon marker.

8. Direct input item renders a Direct-specific icon component or icon marker.

If DOM snapshots are brittle, test palette configuration:

```ts
expect(getAddSheetPaletteItems().map((item) => item.iconKey)).toEqual([
  "polygonSheet",
  "coonsPatch",
  "ruledSurface",
  "hemisphere",
  "directInput",
]);
```

### Behavior regression tests

9. Clicking Polygon still selects the polygon sheet creation mode.

10. Clicking Coons still selects the Coons patch creation mode.

11. Clicking Ruled still selects the ruled surface creation mode.

12. Clicking Hemisphere still selects the hemisphere creation mode.

13. Clicking Direct input still opens the sheet direct input drawer/form.

14. Opening Add sheet still closes other palettes.

15. TikZ output is unaffected by the palette being opened.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Open the Add sheet palette.
2. Confirm the icons are clearly distinguishable.
3. Confirm Polygon looks like a polygonal sheet.
4. Confirm Coons looks like a curved four-boundary patch.
5. Confirm Ruled looks like a surface ruled by straight connectors.
6. Confirm Hemisphere looks like a dome/spherical cap.
7. Confirm Direct input looks like input/form/keyboard.
8. Confirm order is:
   - Polygon;
   - Coons;
   - Ruled;
   - Hemisphere;
   - Direct input.
9. Confirm Saddle is absent.
10. Click each item and confirm the corresponding tool still works.
11. Confirm palette style still matches Add path palette.

## Preserve existing behavior

Do not regress:

- Add sheet palette order;
- Polygon sheet creation;
- Coons patch creation and direction UI;
- Ruled surface creation;
- Hemisphere creation;
- Direct input drawer;
- palette exclusivity;
- toolbar collapse/expand;
- SVG preview interactions;
- TikZ generation;
- save/load;
- undo/redo.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## Report after implementation

Please report:

- files modified;
- new icon design for each Add sheet item;
- whether icons are inline SVGs or another local approach;
- Add sheet palette final order;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
