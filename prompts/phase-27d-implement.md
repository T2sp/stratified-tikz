# Phase 27D Implementation Prompt: Style eyedropper for same geometric kind

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

Implement a style eyedropper/copy-paste style feature between elements with the same `geometricKind`.

Users should be able to copy style from one object and apply it to another object or a multi-selection of the same geometric kind.

## Scope

Implement:

- style copy source selection;
- apply style to target(s);
- same-geometric-kind validation;
- UI command / mode;
- undo/redo;
- tests.

Do not implement:

- geometry copying;
- layer copying by default;
- cross-kind style mapping;
- new style fields unless needed.

## Style scope

Copy style only.

Do not copy:

- geometry;
- id/name;
- layer, unless explicitly chosen;
- coordinate refs;
- labels/text content.

Recommended:

- layer is not considered style for eyedropper MVP.

Style fields by kind:

### Curves

- stroke color;
- line width;
- line style;
- opacity;
- arrow options;
- imported/custom style references if appropriate.

### Sheets/regions

- fill color;
- fill opacity;
- stroke color;
- stroke opacity;
- line width;
- imported/custom style references.

### Points

- point color;
- size;
- shape if supported.

### Labels

- text style;
- font/scale/color if supported.

Use existing style model helpers.

## UI options

Implement one or both:

### Copy/paste style commands

```text
Copy style
Paste style
```

Workflow:

1. Select source object.
2. Copy style.
3. Select target object(s).
4. Paste style.

### Eyedropper mode

```text
Style eyedropper
```

Workflow:

1. Select target(s) or start eyedropper.
2. Click source to sample style.
3. Click target(s) to apply.

MVP can be copy/paste style commands if simpler.

## Same geometric kind

Allowed:

```text
curve -> curve
sheet -> sheet
point -> point
label -> label
```

Rejected:

```text
curve -> sheet
point -> coordinate anchor
label -> point
```

Coordinate anchors have no style, so they are excluded.

## Multi-selection

If target selection is multi-selection of same geometric kind:

- paste style applies to all selected targets;
- one undo history entry.

If target selection is mixed or incompatible:

- reject with clear status;
- do not partially apply.

## Tests

Add tests:

1. Copy style from curve and paste to curve.
2. Curve arrow options copied if considered style.
3. Copy style from sheet to sheet.
4. Copy style from point to point.
5. Copy style from label to label if supported.
6. Cross-kind paste rejected.
7. Coordinate anchor style copy/paste rejected or unavailable.
8. Multi-selection paste applies to all compatible targets.
9. Mixed incompatible target selection rejects atomically.
10. Layer not copied.
11. Geometry not copied.
12. Undo/redo works.
13. TikZ output reflects pasted style.
14. Save/load unaffected.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create two paths with different styles.
2. Copy style from one.
3. Paste to the other.
4. Confirm geometry/layer unchanged.
5. Confirm arrows copied if intended.
6. Try curve -> sheet and confirm rejected.
7. Multi-select curves and paste style.

## Report after implementation

Please report:

- files modified;
- UI workflow;
- copied fields by geometric kind;
- same-kind validation;
- layer policy;
- multi-selection behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
