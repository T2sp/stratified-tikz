# Phase 23B Fix Prompt: Add sheet palette polish and Bézier icon update

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

Phase 23B improved the toolbar palette behavior and the Add path palette.

Manual UI review found two remaining toolbar/palette polish items:

1. In the Add path palette, the current Cubic Bézier icon is not visually appropriate. It should be changed to an icon that more intuitively represents a Bézier curve.
2. The Add sheet palette should be redesigned to match the Add path palette style:
   - compact card-like menu;
   - clear grouping/labeling if useful;
   - visually distinct icons/buttons;
   - consistent spacing/hover/active behavior.
3. The Add sheet palette should remove Saddle from the visible palette.
4. The Add sheet palette should be reordered exactly:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

## Goal

Polish the Add path and Add sheet toolbar palettes.

Specifically:

- replace the Cubic Bézier icon with a better curve-like icon;
- make Add sheet palette visually consistent with the Add path palette shown in the reference screenshot;
- remove the Saddle item from the Add sheet palette;
- order Add sheet items as:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

- preserve all existing creation behavior for the remaining tools.

## Scope

This is a targeted Phase 23B UI fix.

Implement:

- Cubic Bézier icon update in Add path palette;
- Add sheet palette visual redesign;
- Add sheet item ordering;
- Saddle removal from Add sheet palette;
- tests where practical.

Do not implement:

- new sheet geometry;
- new surface primitives;
- new direct input fields;
- new toolbar architecture;
- broad UI redesign;
- new dependencies;
- removal of existing saved Saddle data support unless explicitly required.

Do not change:

- diagram data model;
- existing saved saddle/curved surface rendering/export support;
- Add path creation behavior;
- Add sheet creation behavior for Polygon/Coons/Ruled/Hemisphere/Direct input;
- TikZ generation;
- SVG rendering semantics;
- save/load;
- undo/redo.

## 1. Update Cubic Bézier icon

The current Cubic Bézier icon in the Add path palette is not intuitive.

Replace it with a better Bézier-like icon.

Acceptable options:

### Preferred: inline SVG icon

Use a small inline SVG showing a smooth curve with control handles or a curved path.

Example concept:

```text
•──╮
   ╰──•
```

or a small cubic curve with two endpoint dots and two faint control points.

### Acceptable: text/glyph icon

If inline SVG is too much, use a compact glyph that suggests a curve, for example:

```text
⌁
```

or:

```text
∿
```

or another more appropriate curved mark.

Avoid the current icon if it looks like a generic letter or unrelated symbol.

Requirements:

- no new icon dependency;
- icon fits the existing Add path palette item size;
- accessible label remains `Cubic Bézier`;
- button text remains readable;
- visual style matches other Add path icons.

## 2. Match Add sheet palette style to Add path palette

The Add path palette currently has a polished visual structure similar to:

```text
Cursor creation
  [icon] Line/manual path
  [icon] Polyline
  [icon] Cubic Bezier
  [icon] Arc segment path

Direct
  [icon] Direct input...
```

The Add sheet palette should use the same visual language.

Requirements:

- same palette container style as Add path;
- same item card/button style;
- same icon sizing;
- same spacing/gap;
- same hover/focus/active treatment;
- same typography;
- same compact height behavior;
- no visual overflow from the toolbar;
- no horizontal scrolling caused by the palette.

If there is a shared component for palette items, reuse it.

Preferred structure:

```text
Cursor creation
  [icon] Polygon
  [icon] Coons
  [icon] Ruled
  [icon] Hemisphere

Direct
  [icon] Direct input...
```

If grouping labels are not used in Add sheet, still keep item styling consistent with Add path.

## 3. Add sheet palette items and order

The Add sheet palette must contain exactly these visible items in this order:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

Detailed requirements:

### Polygon

- existing polygon sheet creation remains available;
- icon should suggest a polygon/sheet, e.g. small quadrilateral or square.

### Coons

- existing Coons patch creation remains available;
- icon should suggest a curved quadrilateral patch or 4-boundary patch if practical.

### Ruled

- existing ruled surface creation remains available;
- icon should suggest ruled strips / two curves connected by lines if practical.

### Hemisphere

- existing hemisphere creation remains available;
- icon should suggest a dome/hemisphere.

### Direct input

- single direct input item;
- opens or routes to the Add sheet direct input drawer/form;
- does not expand into multiple toolbar items;
- icon can use keyboard-like glyph or small panel icon.

## 4. Remove Saddle from Add sheet palette

Remove Saddle from the visible Add sheet palette.

Important:

- Do not necessarily remove Saddle model support.
- Do not break loading/rendering/exporting old diagrams containing saddle surfaces.
- If there is an Inspector or existing object editor for already-created saddle surfaces, preserve it.
- This fix only removes Saddle as a creation option in the Add sheet palette unless the codebase explicitly requires otherwise.

If a direct input form still exposes Saddle, remove/hide it there too only if it is part of the Add sheet palette/direct creation choices. Report the exact behavior.

## 5. Preserve existing Add sheet creation behavior

Ensure the following still work after palette reordering:

- Polygon sheet cursor creation;
- Coons patch boundary picking and Direction controls;
- Coons point-as-constant-boundary support;
- Ruled surface boundary picking;
- Hemisphere creation;
- Direct input sheet creation where supported.

Do not break:

- Coons boundary direction UI;
- Coons required corner equations display;
- Ruled surface creation;
- source path/point picking;
- work-plane behavior;
- layer/style assignment.

## 6. Palette exclusivity and interaction

Preserve Phase 23B palette behavior:

- only one toolbar palette open at a time;
- opening Add sheet closes Add path/Add point/Add label/etc.;
- selecting a palette item closes the palette or opens the appropriate drawer according to existing policy;
- overlay clicks stop propagation and do not create canvas objects.

## 7. Accessibility

Each palette item should have a clear accessible label.

Requirements:

- icon-only elements must have text or `aria-label`;
- keyboard focus states remain visible;
- Direct input item label is clear;
- Saddle removal does not leave dangling keyboard focus targets.

## 8. Tests

Add focused tests where practical.

### Add path icon tests

1. Cubic Bézier palette item still exists.
2. Cubic Bézier item has an updated icon/label structure if testable.
3. Cubic Bézier creation action still works or routes to the same handler.

### Add sheet palette structure tests

4. Add sheet palette contains visible items in exactly this order:

```text
Polygon
Coons
Ruled
Hemisphere
Direct input
```

5. Saddle is not present in the Add sheet palette.

6. Direct input appears exactly once in Add sheet palette.

7. Add sheet palette uses the shared palette item component/classes if testable.

8. Palette grouping labels match Add path style if implemented.

### Behavior tests

9. Selecting Polygon still activates polygon sheet creation.
10. Selecting Coons still activates Coons patch creation.
11. Selecting Ruled still activates ruled surface creation.
12. Selecting Hemisphere still activates hemisphere creation.
13. Selecting Direct input opens the sheet direct input drawer/form.
14. Opening Add sheet closes Add path palette.
15. Opening Add path closes Add sheet palette.

### Regression tests

16. Existing Add path palette tests still pass.
17. Coons direction/corner equation UI still works.
18. Saved diagrams containing Saddle still load/render/export if fixtures/helpers exist.
19. TikZ output unaffected by palette icon/order changes.

If full UI tests are difficult, extract or test palette item configuration arrays.

A pure test over the toolbar config is ideal:

```ts
expect(getAddSheetPaletteItems().map((item) => item.label)).toEqual([
  "Polygon",
  "Coons",
  "Ruled",
  "Hemisphere",
  "Direct input",
]);
```

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual tests:

1. Open Add path palette.
2. Confirm Cubic Bézier icon now looks like a curve/Bézier icon.
3. Confirm Cubic Bézier action still works.
4. Open Add sheet palette.
5. Confirm it visually matches Add path palette style.
6. Confirm visible order:
   - Polygon;
   - Coons;
   - Ruled;
   - Hemisphere;
   - Direct input.
7. Confirm Saddle is not visible.
8. Click Polygon and verify creation mode.
9. Click Coons and verify boundary picking still works.
10. Click Ruled and verify boundary picking still works.
11. Click Hemisphere and verify creation still works.
12. Click Direct input and verify sheet direct input drawer/form appears.
13. Confirm opening Add sheet closes Add path.
14. Confirm toolbar remains compact.

## 10. Preserve existing behavior

Do not regress:

- Add path palette;
- Add path direct input;
- Add sheet creation modes that remain visible;
- Coons patch direction UI;
- Coons/ruled boundary picking;
- source path/point picking;
- SVG preview interactions;
- TikZ generation;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior.

## 11. Verification

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

## 12. Report after implementation

Please report:

- files modified;
- new Cubic Bézier icon approach;
- final Add sheet palette structure/order;
- whether Saddle was removed only from palette or also from direct sheet choices;
- shared palette styling changes;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
