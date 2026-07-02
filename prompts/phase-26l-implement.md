# Phase 26L Implementation Prompt: Coordinate-anchor multi-selection state and UI

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

Phase 26 adds global TikZ coordinate anchors, distinct from visible point strata.

Coordinate anchors are global, not layer-bound, exported as `\coordinate`, and can be referenced by paths/sheets/labels/points through `coordinateRef` sources.

Current expected coordinate-anchor behavior after Phase 26A-26K:

- coordinate anchors are stored separately from strata/labels;
- coordinate anchors have no layer, codimension, or style;
- coordinate anchors can be created by cursor/direct input;
- coordinate anchors can be referenced by supported geometry fields;
- supported coordinate refs export as `(tikzName)`;
- unsupported coordinate refs are rejected instead of silently numericized;
- coordinate anchor deletion detaches references;
- layer translation detaches coordinate refs in layer-bound objects before moving them;
- coordinate markers can be shown/hidden;
- coordinate markers are preview-only;
- coordinate anchors are not affected by layer View filter or New layer;
- save/load, undo/redo, TikZ export, inline no-blank-line behavior, and 4-space indentation must be preserved.

Phase 26 follow-up adds coordinate-anchor multi-selection and coordinate-anchor translation.

Important design decisions:

- Coordinate anchors support coordinate-only multi-selection.
- Mixed multi-selection of coordinate anchors and layer-bound objects is not supported in the MVP.
- Coordinate translation moves the coordinate anchors themselves.
- Geometry referencing translated coordinate anchors remains live and therefore follows the moved anchors.
- Unlike layer translation, coordinate translation does not detach references in layer-bound objects.
- If a selected coordinate anchor's own position contains `coordinateRef` sources, detach those internal refs before translating that coordinate anchor.
- Global coordinate positions translate by adding the delta to components, preserving symbolic expressions when possible.
- Work-plane-local coordinate positions translate by moving their stored frame origin; local `a,b` expressions and frame basis vectors remain unchanged.
- Drag-based coordinate translation uses cursor snap.
- Numeric/direct translation does not use cursor snap.
- Translation is atomic and undoable.
- Selection state is UI/editor state and is not stored in `Diagram`.


## Goal

Add coordinate-anchor-only multi-selection.

This subphase should let users select multiple coordinate anchors using the same broad interaction pattern as existing multi-selection, while keeping coordinate anchors separate from layer-bound object multi-selection.

No coordinate translation is implemented yet; that starts in Phase 26M.

## Scope

Implement:

- coordinate-anchor multi-selection state;
- Shift/modifier-click toggle for coordinate anchors;
- coordinate-only multi-selection policy;
- selected marker highlighting for multiple coordinate anchors;
- Inspector summary for coordinate multi-selection;
- selection cleanup after coordinate deletion/load/update;
- tests.

Do not implement yet:

- coordinate multi-translation;
- coordinate drag group translation;
- mixed coordinate + layer-bound selection;
- coordinate batch delete beyond existing delete behavior;
- coordinate detach changes.

## Selection model

If the current selection model uses target kinds, support coordinate-anchor multi-selection explicitly.

Suggested shape:

```ts
type SelectionTarget =
  | { kind: "stratum"; id: string }
  | { kind: "label"; id: string }
  | { kind: "coordinateAnchor"; id: string };

type Selection =
  | { kind: "none" }
  | { kind: "single"; target: SelectionTarget }
  | { kind: "multi"; targets: SelectionTarget[] };
```

If the existing model differs, adapt while preserving these semantics.

Requirements:

- coordinate-anchor multi-selection is UI state only;
- not stored in `Diagram`;
- stale coordinate ids cleaned when coordinates are deleted or diagrams load;
- coordinate-anchor selection does not depend on layer View filter.

## Multi-selection policy

MVP policy:

```text
coordinate anchors can be multi-selected only with other coordinate anchors.
```

Allowed:

```text
A, B, C coordinate anchors selected together
```

Not allowed in MVP:

```text
coordinate A + path f
coordinate A + point P
coordinate A + sheet S
```

When user Shift-clicks a coordinate while a layer-bound multi-selection exists, choose and document a safe policy.

Preferred policy:

- replace the existing layer-bound selection with the clicked coordinate anchor; or
- clear incompatible selection and start coordinate selection.

Do not silently create mixed selections.

## UI interaction

When coordinates are shown:

- Click coordinate anchor:
  - select single coordinate.
- Shift-click / platform modifier-click coordinate anchor:
  - add/remove coordinate anchor from coordinate multi-selection.
- Shift-click already selected coordinate:
  - remove it.
- Background click:
  - clear selection.
- Hide Coordinates:
  - clear coordinate selection or keep only if current UI can safely display hidden selections. Preferred: clear.

When coordinates are hidden:

- coordinate anchors are not hit-testable;
- cannot be added to multi-selection by preview click.

## Inspector summary

For multiple coordinates selected, show a coordinate-specific summary:

```text
3 coordinates selected
```

Do not show layer/style/codimension/point-style fields.

Recommended actions shown later or disabled placeholders:

```text
Translate selected coordinates
```

Translation UI comes in Phase 26N, so this subphase may show a disabled or informational line.

## Preview highlighting

Multiple selected coordinate anchors should be visibly highlighted.

Requirements:

- all selected coordinate markers show selected style;
- markers still use dot + dotted circle appearance;
- no TikZ effect;
- no geometry mutation.

## Tests

Add focused tests.

1. Click coordinate selects single coordinate anchor.
2. Shift-click second coordinate creates coordinate multi-selection.
3. Shift-click selected coordinate removes it.
4. Background click clears coordinate multi-selection.
5. Hide Coordinates clears coordinate selection or follows documented policy.
6. Coordinates hidden are not hit-testable.
7. Coordinate multi-selection cannot include layer-bound object in MVP.
8. Shift-click coordinate while layer-bound selection exists follows chosen incompatible-selection policy.
9. Multiple selected coordinate markers render selected state.
10. Inspector summary shows selected coordinate count.
11. Selection state is not serialized.
12. TikZ output unaffected by coordinate multi-selection.
13. Selection cleanup removes stale coordinate ids after coordinate deletion/load.

## Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create three coordinate anchors A/B/C.
2. Shift-click A/B/C and confirm all become selected.
3. Shift-click B again and confirm it is removed.
4. Select a path, then Shift-click A; confirm mixed selection is not created.
5. Hide coordinates; confirm selection clears or follows documented policy.
6. Confirm TikZ output unchanged.

## Preserve existing behavior

Do not regress:

- single coordinate selection;
- coordinate marker rendering/show/hide;
- layer-bound multi-selection;
- coordinate anchor TikZ export;
- coordinate references;
- coordinate deletion/detach;
- save/load;
- undo/redo.

## Report after implementation

Please report:

- files modified;
- selection model changes;
- coordinate-only multi-selection policy;
- incompatible selection behavior;
- Inspector summary;
- preview highlight behavior;
- tests added/updated;
- test results;
- build results;
- limitations.
