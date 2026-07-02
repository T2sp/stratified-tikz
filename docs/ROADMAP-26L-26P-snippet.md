# ROADMAP update snippet for Phase 26L-26P

Add these follow-up subphases after Phase 26K.

```js
"26L": "coordinate-multi-selection",
"26M": "coordinate-translation-helper",
"26N": "coordinate-translation-inspector",
"26O": "coordinate-drag-translation",
"26P": "coordinate-translation-polish",
```

## Phase 26L: Coordinate-anchor multi-selection state and UI

- Coordinate-only multi-selection.
- Shift/modifier-click toggle.
- Inspector summary and selected marker highlighting.
- Mixed coordinate + layer-bound selection is not MVP.

## Phase 26M: Coordinate-anchor translation helper with symbolic and work-plane-local support

- Pure helper for translating coordinate anchors.
- Global symbolic coordinates preserve expressions.
- Work-plane-local coordinates move stored frame origin.
- Internal coordinateRefs in selected coordinate positions detach first.
- Atomic failure behavior.

## Phase 26N: Coordinate multi-translation UI and undo/redo

- Inspector translation panel for selected coordinates.
- Numeric/symbolic delta input according to helper support.
- Undo/redo.
- References remain live.

## Phase 26O: Drag translation for multi-selected coordinate anchors with snap support

- Drag one selected coordinate to move all selected coordinates.
- Snap applies to drag translation.
- One history entry.

## Phase 26P: Coordinate multi-selection translation polish, docs, and regression hardening

- Docs.
- Combined tests.
- Save/load/TikZ/undo/redo hardening.
