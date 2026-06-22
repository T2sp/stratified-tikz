# Phase 21E Fix Prompt: Decouple layer View filter from new-element layer

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

Phase 21E implemented the Ibis Paint-style Layer window.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

The new Layer Palette separates:

- `View` layer filter;
- `New` / new-element layer.

However, old `App` state synchronization still couples them.

Review notes:

- `src/App.tsx` still has an old effect that copies a specific layer filter into `directLayerInput`.
- `src/ui/LayerManager.tsx` now presents `View` and `New` as separate controls.
- The Phase 21E prompt explicitly says layer filter behavior should remain separate unless intentionally combined.
- Current behavior:
  - Choosing `View -> L1` silently changes the new-element layer to `L1`.
  - Later point/path creation can land on the filtered layer instead of the user's chosen creation layer.

This conflicts with the new layer-window design.

## Goal

Fix Phase 21E by fully decoupling the layer View filter from the new-element creation layer.

After the fix:

1. Changing the Layer Palette `View` filter does **not** change the new-element layer.
2. The compact Layer button label does **not** change merely because the View filter changes.
3. Row click or the `New` control still changes the new-element layer.
4. New point/path/sheet/etc. objects are created on the explicitly chosen new-element layer.
5. Existing layer filtering behavior still works for visibility/selection.
6. Existing layer operations remain functional.

## Scope

This is a targeted Phase 21E fix.

Implement:

- removal or deactivation of the old `layerFilter -> directLayerInput` synchronization;
- explicit separation of:
  - layer filter state;
  - new-element layer state;
- tests for the new behavior.

Do not implement:

- new Layer Manager features;
- new geometry features;
- broad UI redesign;
- multi-selection;
- new layer semantics;
- new dependencies.

Do not change:

- diagram data model;
- layer values on existing elements;
- existing layer filter semantics except decoupling from creation layer;
- layer swap/duplicate/delete/translate behavior;
- TikZ layer output semantics;
- save/load format;
- SVG rendering semantics;
- undo/redo semantics.

## 1. Identify and remove old layer-filter synchronization

Inspect `src/App.tsx` around the review-mentioned old effect.

Look for logic conceptually like:

```ts
useEffect(() => {
  if (layerFilter.kind === "specific") {
    setDirectLayerInput(String(layerFilter.layer));
  }
}, [layerFilter]);
```

or any equivalent logic that copies the current layer filter into:

- `directLayerInput`;
- new-element layer state;
- creation layer state;
- direct form layer field.

Remove this automatic synchronization, or make it explicitly opt-in only if a clear UI exists.

Preferred behavior:

- no automatic sync from View filter to new-element layer.

## 2. Preserve explicit new-element layer controls

The new-element layer should change only through explicit user actions intended to change creation layer.

Allowed sources:

- clicking a layer row in the Layer Palette, if Phase 21E uses row click for creation-layer selection;
- a `New` control/form in the Layer Palette;
- any explicit "set as new element layer" action;
- existing direct layer input where still intentionally used.

Not allowed:

- selecting a View filter;
- hiding/showing layers;
- locking/unlocking layers;
- opening/closing the Layer Palette;
- changing Inspector selection.

## 3. Clarify state names if needed

If current state names are confusing, refactor minimally.

For example:

```ts
layerFilter
newElementLayer
directLayerInput
```

should have clear responsibilities.

Recommended:

- `layerFilter`: controls which layers are visible/selectable in preview.
- `newElementLayer`: numeric layer value used for newly created elements.
- `directLayerInput`: UI text field representation of `newElementLayer`, if still needed.

If `directLayerInput` remains a text field, it should sync with `newElementLayer`, not with `layerFilter`.

## 4. Compact Layer button label

The lower-right Layer button should show the new-element layer and total layer count.

Example:

```text
L0 / 3
```

or equivalent.

After the fix:

- changing `View` filter must not update the first number;
- changing new-element layer through row click/New control must update the first number;
- total layer count should still update when layers are added/deleted.

## 5. Layer Palette controls

The Layer Palette has separate controls for:

- `View`;
- `New`.

Ensure they remain separate in behavior.

### View control

Changing View:

- filters the preview/selection according to existing layer filter rules;
- may clear selection if selected element is no longer visible according to existing policy;
- must not change new-element layer.

### New control / row click

Changing New:

- updates new-element layer;
- updates compact Layer button label;
- affects subsequent creation;
- must not change View filter unless an explicit option says so.

## 6. Creation behavior

After changing View filter, creating new objects should still use the previously chosen new-element layer.

Example test scenario:

1. New layer is `L0`.
2. View filter is changed to `L1`.
3. User creates a point.
4. Created point should be on `L0`, not `L1`.

Then:

1. User explicitly changes New layer to `L2`.
2. User creates a path.
3. Created path should be on `L2`.

If layer filter hides the new layer, preserve existing policy. If the app currently ensures created objects remain visible by updating the filter, keep that behavior only if it does not confuse View/New separation. If necessary, document the chosen policy.

Preferred:

- changing New layer may update View only if there is an explicit "show creation layer" behavior already designed.
- changing View never updates New.

## 7. Tests

Add focused tests.

### State/helper tests

1. Changing layer filter does not change new-element layer.

2. Changing layer filter does not change `directLayerInput` if it mirrors new-element layer.

3. Changing new-element layer updates `directLayerInput` or equivalent UI field.

4. Changing new-element layer does not change the View filter unless explicitly designed.

### Layer button tests

5. Compact Layer button label remains unchanged when View filter changes.

Example:

```text
initial: L0 / 3
set View to L1
still:   L0 / 3
```

6. Compact Layer button label updates when New layer changes.

Example:

```text
initial: L0 / 3
set New to L2
now:     L2 / 3
```

### Creation tests

7. Set New layer to `0`; set View filter to `1`; create point. The point is on layer `0`.

8. Set New layer to `2`; create path/label/point. New object is on layer `2`.

9. View filter remains `1` after changing New layer unless existing explicit behavior says otherwise.

### Regression tests

10. View filter still filters visible/selectable elements.

11. Layer row click still changes creation layer.

12. Rename/duplicate/delete/translate/swap still work.

13. Old direct creation layer behavior still works.

14. TikZ layer output uses created object's actual layer.

15. Save/load unaffected.

If full UI tests are hard, extract pure state helpers and test them. Still wire the actual App/LayerManager interactions through the helpers.

## 8. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Open a diagram with at least two layers.
2. Open the Layer Palette.
3. Confirm Layer button shows current New layer / total layers.
4. Set New layer to `L0`.
5. Change View filter to `L1`.
6. Confirm Layer button still shows `L0 / total`.
7. Create a point/path.
8. Confirm new object is on `L0`.
9. Change New layer to `L1` using row click/New control.
10. Confirm Layer button updates to `L1 / total`.
11. Create another object.
12. Confirm it is on `L1`.
13. Change View filter again.
14. Confirm New layer remains `L1`.
15. Confirm View filtering still works.

Regression:

16. Swap layers.
17. Duplicate layer.
18. Delete layer.
19. Translate layer.
20. Confirm creation layer and filter still behave separately.

## 9. Preserve existing behavior

Do not regress:

- Layer Palette button;
- layer thumbnails;
- row click creation-layer selection;
- drag/drop swap;
- rename;
- duplicate;
- translate;
- delete;
- visibility/lock;
- layer filter rendering;
- selection cleanup under filters;
- creation layer use by all creation tools;
- direct creation;
- cursor creation;
- SVG preview;
- TikZ layer output;
- save/load;
- undo/redo.

## 10. Verification

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

Only treat lint as required if it is already clean in the repo.

## 11. Report after implementation

Please report:

- files modified;
- root cause of View/New coupling;
- whether old `layerFilter -> directLayerInput` sync was removed or made opt-in;
- updated state ownership for layer filter vs new-element layer;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
