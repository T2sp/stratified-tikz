# ROADMAP update snippet for Phase 24

Add or replace the Phase 24 section with the following.

## Phase 24: Editing fundamentals — snapping, multi-selection, symbolic translation, path concatenation, and layer merge

Phase 24 improves core editing features.

Important scope decision:

- General affine transforms are deferred to a later phase.
- Phase 24 implements translation only.
- Translation should support symbolic coordinates.
- Path concatenation does not need to preserve all original source path styles.

Recommended `phaseSlugs` entries:

```js
"24A": "cursor-snap-coordinate-quantization",
"24B": "multi-selection-state-ui",
"24C": "bulk-style-layer-delete-duplicate",
"24D": "bulk-symbolic-translation",
"24E": "path-concatenation",
"24F": "layer-merge-symbolic-translation",
"24G": "editing-polish-hardening",
```

### Phase 24A: Cursor snap / coordinate quantization

- Add optional cursor snap step.
- Apply to cursor placement and drag editing.
- 3D snapping is work-plane-local.
- Direct/symbolic input is not snapped.

### Phase 24B: Multi-selection state and selection UI

- Shift/modifier-click multi-selection.
- Same-geometric-kind MVP policy.
- Inspector selection summary.
- Multiple selected highlights.

### Phase 24C: Bulk style/layer/delete/duplicate editing

- Bulk style editing with mixed-value display.
- Bulk layer change.
- Bulk delete.
- Bulk duplicate.

### Phase 24D: Bulk translation with symbolic coordinate support

- Translate selected objects.
- Preserve symbolic coordinate expressions by adding translation deltas.
- Translate frame origins but not basis vectors.
- No affine rotate/scale/shear.

### Phase 24E: Concatenate selected paths

- Concatenate selected paths in selection order.
- Auto-reverse next paths when endpoints match.
- Keep originals option, default on.
- Simple style policy; no need to preserve all original styles.

### Phase 24F: Layer merge and layer translation symbolic hardening

- Merge source layer into target layer.
- Update metadata/View/New layer state predictably.
- Reuse symbolic-aware translation helpers for layer translation.
- General layer affine transform deferred.

### Phase 24G: Editing polish, docs, and regression hardening

- Docs and examples.
- Combined workflow tests.
- Save/load/undo/redo hardening.
