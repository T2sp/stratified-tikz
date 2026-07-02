# Layer Manager

The Layer Manager edits diagram layers by numeric `layer` value. Element
membership is stored on strata and free text labels; diagram-level `layers`
metadata stores names plus preview/editing flags.

Layer rows show:

- layer name;
- numeric layer value;
- element count, including strata and free text labels;
- whether the row matches the current layer filter;
- whether new elements currently target that layer;
- hidden and locked state.

The current layer filter and current new-element layer are editor UI state. They
are not saved as layer metadata.

In the preview Layer window, the Actions panel targets the highlighted layer
row. The panel is semi-transparent over the preview and groups layer operations
by name, state, move, duplicate, merge, and delete controls.

## Operations

Rename changes only `diagram.layers[].name`. It does not move elements and does
not change TikZ layer membership. Blank names are normalized to `Layer <value>`.

Visibility toggles `diagram.layers[].visible`. Hidden layers are omitted from
the SVG preview and their elements cannot remain selected. Visibility is a
preview/editor control; hidden layers are still exported to TikZ.

Locking toggles `diagram.layers[].locked`. Locked layers remain visible but are
not selectable or editable through normal preview/inspector interactions. Layer
Manager operations may still unlock, rename, duplicate, translate, swap, or
delete locked layers.

Swap exchanges numeric layer membership for two layer values across all strata
and free text labels. Metadata names, visibility, and lock state swap with the
contents so the named visual layer identity follows the moved elements.

Duplicate copies all strata and free text labels on the source layer to a target
numeric layer. Copied top-level element IDs, nested boundary IDs, curve style
segment IDs, and non-empty path labels are regenerated to avoid collisions.

Merge moves all strata and free text labels from an existing source layer to an
existing target layer. The source layer metadata entry is removed. Target layer
metadata is preserved, including its name, visibility, and lock state. Merging a
layer into itself is rejected. If the current new-element layer is the source,
it becomes the target. If the current view filter is the source, it becomes the
target. Existing selected elements are preserved when they remain selectable
after the merge; selections that become hidden or otherwise invalid are cleared.

Translate adds a finite vector to all absolute coordinates on the layer. The
translation fields accept numeric values or symbolic scalar expressions using
the diagram variables. Symbolic coordinates are updated by adding the
translation expression and refreshing previews. In 2D only `dx` and `dy` are
accepted and all translated coordinates remain at `z = 0`. In 3D, `dx`, `dy`,
and `dz` are accepted. Frame basis vectors and relative/local coordinates are
preserved; frame origins and absolute points are moved. This includes points,
free text labels, path segments, grids, filled boundaries, ruled surfaces, and
Coons patches.

Delete removes all strata and free text labels on the numeric layer and removes
that layer metadata entry. Other layer metadata, including empty guide layers,
is left unchanged. Delete is confirmed before it runs.

## Undo/Redo

Layer operations that modify diagram data are committed as ordinary undoable
diagram changes:

- rename, visibility, locking, swap, duplicate, translate, and delete can be
  undone and redone;
- merge is undoable and redoable as one diagram change;
- delete also clears selection, drafts, and transient source-picking state;
- hiding or locking a selected layer clears that selected element.

Undo/redo history is editor state and is not saved into JSON.

## Save/Load

Saved diagrams include explicit layer metadata when present:

```ts
type DiagramLayer = {
  value: number;
  name: string;
  visible?: boolean;
  locked?: boolean;
};
```

Older diagrams without `diagram.layers` still load. The editor derives default
metadata from the numeric layer values used by strata and labels. The current
layer filter, expanded/collapsed UI state, and current new-element layer are not
saved.

## TikZ Export

TikZ output is driven by element `layer` values, not by layer names or preview
flags. Renaming a layer does not change export. Swapping, duplicating, merging,
translating, or deleting layers changes export only because those operations
change element membership or coordinates.

Hidden and locked layers are exported by default. Generated TikZ still emits
readable PGF layer blocks such as `stratifiedLayer0` and
`stratifiedLayerMinus1`.

## Current Limits

The Layer Manager does not implement layer rotation, scaling, shear, general
affine transforms, layer style overrides, or new geometry features. General
layer affine transforms are deferred to a later phase; Phase 24 supports
translation only. Curves currently support one primary style per curve; partial
style segments are model-ready but remain outside the Layer Manager MVP.
