# Phase 27E Implementation Prompt: UI polish — Layer Actions translucency, lenient Inspector numeric inputs, and Add path naming

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

The editor now has mature core editing features:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes and camera controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 27 is an interaction/editing polish phase.

Prioritized features:

1. Selection cycling for overlapping objects.
2. Path inline nodes/vertices exported as `node[pos=..., ...]` on paths.
3. Path splitting at an interior point.
4. Style eyedropper between objects with the same `geometricKind`.
5. UI polish:
   - make the Layer window Actions popover/panel semi-transparent and easier to understand;
   - change Inspector numeric inputs to allow temporarily invalid text and show warnings instead of blocking input, so values like `.5` are easy to type;
   - rename Add path `Line/manual path` to something clearer like `Arbitrary path`.

Important conventions:

- UI-only state must not be stored in `Diagram`.
- Anything affecting exported TikZ must be persisted.
- Selection/cycling state is UI-only.
- Path inline nodes/vertices affect TikZ and must be persisted.
- Path split creates or updates geometry and must be undoable.
- Style eyedropper changes style only, not geometry.
- Inline math TikZ output must contain no blank lines.
- TikZ indentation remains 4 spaces.
- Preserve save/load, undo/redo, SVG preview, TikZ export, symbolic input, work-plane-local coordinates, coordinate anchors, layer manager, arrows, braiding, and existing geometry behavior.


## Goal

Implement the requested UI polish:

1. Make the Layer window `Actions` panel/popover semi-transparent so it is visually clear that it is an overlay/toggle panel.
2. Change Inspector numeric inputs so temporary invalid text is allowed and a warning is shown, rather than blocking input. This should make values like `.5` easy to type.
3. Rename Add path `Line/manual path` to a clearer name such as `Arbitrary path`.

## Scope

Implement:

- Layer Actions transparency/visual treatment;
- lenient Inspector numeric input component behavior;
- Add path label rename and tooltip/help text;
- tests.

Do not implement:

- new layer actions;
- new input expression grammar;
- broad UI redesign;
- new geometry features;
- new dependencies.

## 1. Layer Actions translucency

Current issue:

- In the Layer window, pressing `Actions` opens an action panel/window.
- It stays open until `Actions` is pressed again.
- This toggle behavior is not obvious for first-time users.

Requested improvement:

- make the Actions window/panel semi-transparent.

Also recommended:

- add a subtle border/shadow;
- include a small close button or "Actions" active state if easy;
- close on outside click/Escape if existing popover pattern supports it.

Required:

- translucency applied to the Actions panel/popover, not the entire Layer window;
- controls remain readable/clickable;
- no contrast/accessibility disaster;
- existing rename/duplicate/translate/delete actions still work.

## 2. Lenient Inspector numeric inputs

Current issue:

- Inspector numeric fields reject impossible input immediately.
- This makes entering values like `.5` difficult, because intermediate text states such as `.` are blocked.

New behavior:

- allow temporary invalid input text;
- show a warning/error message;
- do not commit invalid values to the diagram;
- commit only when input parses/validates.

This should behave like coordinate direct input.

### Required behavior

For numeric fields in Inspector:

- user can type:
  - `.`
  - `.5`
  - `-`
  - `1e`
  - temporary empty string
- invalid intermediate text remains visible in the input;
- warning shown for invalid text;
- diagram value remains last valid committed value;
- when text becomes valid, commit on blur/Enter/change according to chosen policy;
- invalid value should not generate NaN geometry.

Recommended policy:

```text
onChange:
  update local draft string
  validate draft
  if valid, optionally commit immediately or mark ready

onBlur / Enter:
  commit if valid
  if invalid, keep draft and warning or revert according to existing direct input pattern
```

Choose one consistent policy and report it.

### Scope of fields

Apply to Inspector numeric inputs broadly, including:

- point/coordinate positions;
- label positions;
- path vertices/control fields;
- sheet vertices;
- style numeric fields such as line width/opacity where applicable;
- camera/layer numeric fields only if they share the same Inspector component and behavior is safe.

Do not break direct input forms.

## 3. Add path naming

Rename:

```text
Line/manual path
```

to something clearer.

Recommended:

```text
Arbitrary path
```

or:

```text
Arbitrary path (line / arc / Bézier)
```

Use the user's direction:

```text
Arbitrary path
```

Add tooltip/help text:

```text
Create a path with line, arc, and Bézier segments.
```

Requirements:

- label updated in toolbar/palette;
- tests updated;
- no handler/action changed;
- docs/help updated if present;
- old internal tool ids can remain if stable.

## Tests

### Layer Actions tests

1. Actions panel has translucent/overlay class.
2. Actions still execute rename/duplicate/translate/delete.
3. If close/outside/Escape behavior added, test it.

### Numeric input tests

4. Numeric Inspector input accepts temporary `.` string.
5. Numeric Inspector input accepts `.5` and commits to `0.5`.
6. Invalid draft shows warning.
7. Invalid draft does not mutate diagram.
8. Valid draft commits correctly.
9. Existing valid numeric editing still works.
10. No NaN/Infinity produced.

### Add path label tests

11. Add path palette contains `Arbitrary path`.
12. Old `Line/manual path` label no longer appears in user-visible toolbar text.
13. Arbitrary path action still selects same creation mode.
14. Tooltip/help mentions line/arc/Bézier if testable.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Open Layer window, click Actions.
2. Confirm Actions panel is semi-transparent and understandable as overlay.
3. Use an action.
4. Select an object and edit numeric field.
5. Type `.`, then `.5`.
6. Confirm input allows it and commits 0.5 when valid.
7. Type invalid text and confirm warning/no geometry mutation.
8. Open Add path palette and confirm `Arbitrary path` label.
9. Confirm it still creates mixed line/arc/Bézier paths.

## Preserve existing behavior

Do not regress:

- Layer actions behavior;
- Inspector editing;
- direct input forms;
- symbolic input;
- toolbar palette behavior;
- Add path creation;
- save/load;
- undo/redo;
- TikZ generation.

## Report after implementation

Please report:

- files modified;
- Actions translucency styling;
- numeric input draft/commit policy;
- warning behavior;
- Add path label/tooltip changes;
- tests added/updated;
- test results;
- build results;
- limitations.
