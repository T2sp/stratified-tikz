# ROADMAP update snippet for Phase 26

Add or replace the Phase 26 section with the following.

## Phase 26: Global TikZ coordinate anchors

Phase 26 adds `\coordinate` anchors distinct from visible points.

Coordinate anchors are global, not layer-bound, exported before drawing commands, shown in Preview as overlay markers, and usable as references by paths/sheets/labels/points.

Recommended `phaseSlugs` entries:

```js
"26A": "coordinate-anchor-model-tikz",
"26B": "add-coordinate-input-preview",
"26C": "coordinate-references",
"26D": "coordinate-inspector-editing",
"26E": "coordinate-editing-integration",
"26F": "coordinate-core-polish",
"26G": "coordinate-preview-hide-hit-test",
"26H": "coordinate-reference-detach-helpers",
"26I": "coordinate-delete-detach-usage",
"26J": "layer-translation-detach-coordinate-refs",
"26K": "coordinate-detach-polish",
```

### Phase 26A: Coordinate anchor model, save/load, and global TikZ export

- Add coordinate anchor model.
- Export global `\coordinate` definitions before drawing commands.
- Coordinate anchors have no layer/codim/style.

### Phase 26B: Add coordinate cursor/direct input and basic Preview marker

- Add separate Add coordinate tool.
- Cursor and direct input.
- Basic preview marker and selection.

### Phase 26C: Coordinate references in path/sheet/label/point inputs and TikZ output

- Add `coordinateRef` source.
- Preview resolves refs.
- TikZ emits `(A)` references.

### Phase 26D: Coordinate Inspector, rename, move, and unused delete

- Coordinate-specific Inspector.
- Rename/tikzName edit.
- Move/edit coordinate position.
- Delete unused coordinate.

### Phase 26E: Coordinate anchors integration with editing, snapping, selection, and layer operations

- Snap relation.
- Layer filter/New layer independence.
- Path concatenation integration.
- Coordinate anchors remain non-layer-bound.

### Phase 26F: Coordinate anchor core docs and regression hardening

- Docs and examples for core coordinate anchors.
- Save/load/TikZ regression tests.

### Phase 26G: Coordinate anchor marker, show/hide toggle, and hit-test priority

- Marker is small dot with dotted circle.
- Add Show/Hide Coordinates toggle.
- Coordinate anchors have high hit-test priority.

### Phase 26H: Coordinate reference inventory and detach helpers

- Find coordinate refs across supported fields.
- Pure detach helpers preserve symbolic/local sources when possible.

### Phase 26I: Delete coordinate with detach and Inspector usage count

- Show usage count.
- Delete referenced coordinates by detaching refs first.

### Phase 26J: Layer translation detach for coordinate references

- Coordinate anchors do not move with layers.
- Layer-bound refs detach before translation.

### Phase 26K: Coordinate anchor integration polish, save/load, TikZ, and docs

- Combined tests.
- Save/load/TikZ hardening.
- Docs and UI polish.
