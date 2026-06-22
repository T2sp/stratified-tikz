# Phase 21E Additional Fix Prompt: Reject empty/non-internal layer drag-drop payloads

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

Layer drag/drop can incorrectly swap layer `0` when the drop payload has no `text/plain` data.

Current risky behavior:

```ts
Number(event.dataTransfer.getData("text/plain"))
```

When `getData("text/plain")` returns an empty string:

```ts
Number("") === 0
```

Therefore:

- an external/invalid drop;
- a browser failure to provide the internal payload;
- or an accidental empty payload

can be interpreted as source layer `0`.

This may call:

```ts
onSwapLayers(0, targetLayer)
```

and corrupt layer ordering/membership unexpectedly.

Review location:

```text
src/ui/LayerManager.tsx
LayerPaletteListRow
```

The review specifically says:

> Fix Phase 21E layer drag/drop so empty or non-internal drop payloads cannot resolve to layer 0. In `LayerPaletteListRow`, treat empty `text/plain` as absent, fall back to `draggedLayerValue` only for an active internal drag, reject invalid drops, and add a UI/unit test covering empty payload behavior.

## Goal

Make layer drag/drop robust so invalid, external, or empty drop payloads cannot trigger an unintended layer swap.

Required:

1. Empty `text/plain` payload must not parse as layer `0`.
2. Non-internal drops must be rejected.
3. Fallback to `draggedLayerValue` only when there is an active internal drag.
4. Invalid source/target layers must not call `onSwapLayers`.
5. Add tests covering empty payload behavior.

## Scope

This is a targeted Phase 21E fix.

Implement:

- safe drag payload parsing;
- internal drag guard;
- rejection of empty/non-finite/invalid payloads;
- tests for empty payload and invalid external drop behavior.

Do not implement:

- new layer operations;
- new drag animation;
- broad Layer Manager redesign;
- multi-selection;
- new geometry features;
- new dependencies.

Do not change:

- layer swap semantics;
- layer metadata model;
- layer creation layer behavior;
- layer View/New separation;
- undo/redo behavior;
- TikZ layer output;
- save/load format;
- SVG rendering semantics.

## 1. Inspect drag/drop implementation

Inspect:

- `src/ui/LayerManager.tsx`;
- `LayerPaletteListRow`;
- drag start handler;
- drag over handler;
- drop handler;
- `draggedLayerValue` state;
- `onSwapLayers`;
- any `dataTransfer.setData(...)` and `getData(...)` usage.

Find code like:

```ts
const sourceLayer = Number(event.dataTransfer.getData("text/plain"));
```

or equivalent.

This must be replaced with safe parsing.

## 2. Use an explicit internal drag payload

Prefer adding an internal drag MIME type in addition to or instead of plain text.

Example:

```ts
const LAYER_DRAG_MIME = "application/x-stratified-tikz-layer";
```

On drag start:

```ts
event.dataTransfer.setData(LAYER_DRAG_MIME, String(layerValue));
event.dataTransfer.setData("text/plain", String(layerValue));
```

On drop:

- first read `LAYER_DRAG_MIME`;
- if absent, treat as non-internal unless `draggedLayerValue` confirms an active internal drag;
- do not trust empty `text/plain`.

If adding a custom MIME type is too invasive, at minimum use a safe parser and `draggedLayerValue` guard.

## 3. Safe payload parsing

Add helper:

```ts
function parseDraggedLayerValue(payload: string): number | null
```

or equivalent.

Required behavior:

```ts
parseDraggedLayerValue("") === null
parseDraggedLayerValue("   ") === null
parseDraggedLayerValue("0") === 0
parseDraggedLayerValue("1") === 1
parseDraggedLayerValue("-1") === -1
parseDraggedLayerValue("abc") === null
parseDraggedLayerValue("Infinity") === null
parseDraggedLayerValue("NaN") === null
```

If decimal layer values are supported by the project, allow finite decimals. If layer values are intended to be integers only, reject decimals according to current model policy.

Do not use `Number(payload)` without checking that `payload.trim()` is non-empty.

Required:

- reject empty strings;
- reject non-finite numbers;
- reject invalid layer values according to existing validation policy.

## 4. Internal drag guard

Drop handling should only call `onSwapLayers` if the source layer comes from a valid internal layer drag.

Suggested logic:

```ts
const customPayload = event.dataTransfer.getData(LAYER_DRAG_MIME);
const plainPayload = event.dataTransfer.getData("text/plain");

const parsedFromCustom = parseDraggedLayerValue(customPayload);

const sourceLayer =
  parsedFromCustom ??
  (draggedLayerValue !== null ? draggedLayerValue : null);

if (sourceLayer === null) {
  return;
}
```

Important:

- Do not fall back to `text/plain` if it is empty.
- Do not fall back to `text/plain` from external drags unless you can prove it is internal.
- `draggedLayerValue` fallback should only be used while an internal drag is active.

If there is a state field such as:

```ts
draggedLayerValue: number | null
```

then:

- set it on internal drag start;
- clear it on drag end/drop/cancel;
- only allow fallback while it is non-null.

## 5. Validate source and target before swapping

Before calling:

```ts
onSwapLayers(sourceLayer, targetLayer)
```

check:

- `sourceLayer` is finite and valid;
- `targetLayer` is finite and valid;
- `sourceLayer !== targetLayer`;
- source layer exists in current layer list;
- target layer exists in current layer list;
- the drop is internal.

If any check fails:

- do nothing;
- optionally set a compact status message;
- do not throw;
- do not call `onSwapLayers`.

## 6. Prevent accidental layer 0 fallback

This is the key regression.

Specifically test and ensure:

```ts
event.dataTransfer.getData("text/plain") === ""
```

does **not** result in:

```ts
sourceLayer === 0
```

unless there is an active internal drag whose actual `draggedLayerValue` is `0`.

Two cases:

### Case A: Empty payload, no active internal drag

Expected:

- no swap;
- `onSwapLayers` not called.

### Case B: Empty payload, active internal drag from layer 0

Expected:

- if `draggedLayerValue === 0`, fallback to `0` is allowed;
- swap may occur if target is valid and different.

This distinction is important.

## 7. Clear drag state reliably

Ensure internal drag state is cleared on:

- drop;
- drag end;
- drag cancel if handled;
- component unmount if needed.

This prevents stale `draggedLayerValue` from making later external drops look internal.

## 8. Tests

Add focused tests.

### Pure parser tests

1. Empty string parses to `null`.
2. Whitespace parses to `null`.
3. `"0"` parses to `0`.
4. `"1"` parses to `1`.
5. `"-1"` parses to `-1`.
6. `"NaN"` parses to `null`.
7. `"Infinity"` parses to `null`.
8. `"abc"` parses to `null`.

### Drop behavior tests

9. Empty `text/plain` payload with no active internal drag does not call `onSwapLayers`.

10. Empty `text/plain` payload with active internal `draggedLayerValue = 0` may call `onSwapLayers(0, target)`.

11. External drop with unrelated `text/plain` data does not call `onSwapLayers`.

12. Invalid numeric payload does not call `onSwapLayers`.

13. Dropping on the same layer does not call `onSwapLayers`.

14. Valid internal payload calls `onSwapLayers(source, target)`.

15. Missing custom MIME but active internal drag fallback works if this is the chosen policy.

### Regression tests

16. Normal drag-to-swap still works for layer `0` to layer `1`.

17. Normal drag-to-swap still works for nonzero layers.

18. Layer window open state remains UI-only.

19. Existing layer rename/duplicate/delete/translate tests still pass.

If full React DnD tests are difficult, extract pure helpers:

```ts
resolveLayerDropSource({
  customPayload,
  plainPayload,
  draggedLayerValue,
  validLayerValues,
})
```

and test that helper thoroughly. Still wire the actual `LayerPaletteListRow` drop handler to it.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual tests:

1. Open the Layer window.
2. Drag layer 0 onto layer 1.
3. Confirm swap works.
4. Undo.
5. Drag layer 1 onto layer 0.
6. Confirm swap works.
7. Drop something external onto the layer window if easy, such as selected text from outside the app.
8. Confirm no layer swap occurs.
9. Confirm no unexpected swap involving layer 0.
10. Try a normal layer drag again.
11. Confirm drag state was not broken.

## 10. Preserve existing behavior

Do not regress:

- Layer Palette button;
- layer window open/close;
- row click to set new element layer;
- View/New separation;
- layer swap via valid drag/drop;
- rename;
- duplicate;
- translate;
- delete;
- visibility/lock;
- undo/redo;
- TikZ layer output;
- save/load;
- SVG preview.

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
- root cause of the empty-payload-to-layer-0 bug;
- safe payload parsing behavior;
- internal drag guard behavior;
- how stale `draggedLayerValue` is cleared;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
