# Coordinate anchors

Coordinate anchors are global TikZ reference points. They are deliberately
separate from visible point strata.

## Coordinate anchors vs point strata

Add point creates a visible diagram object:

- it is a `geometricKind: "point"` stratum;
- it has codimension 2 in 2D and codimension 3 in 3D;
- it belongs to a layer;
- it has a point style;
- it exports as a visible point mark or node.

Add coordinate creates a reference anchor:

- it is stored in `diagram.coordinateAnchors`;
- it is global and has no layer;
- it has a stable TikZ name;
- it is exported as `\coordinate`;
- it can be referenced by paths, sheet vertices, point positions, and free text
  label positions;
- it renders only as a preview/editing marker in the SVG preview.

Coordinate anchors are not strata. They do not use `codim`, `geometricKind`,
or stratum styles.

## Creation

Coordinate anchors can be created by cursor input or direct input.

In 2D cursor input, the clicked canvas position is committed as `(x, y, 0)`.
In 3D cursor input, the clicked screen position is projected onto the active
work plane before it is committed.

Direct input supports global `x,y,z` coordinates. In 3D it also supports
active-work-plane-local coordinates. Work-plane-local anchors store:

- a copied work-plane frame snapshot;
- local scalar coordinates `a,b`;
- a finite global preview coordinate.

Symbolic scalar expressions are preserved in global and work-plane-local anchor
coordinates when the referenced variables are defined.

## Coordinate references

Layer-bound geometry and free text labels may store a coordinate reference in
their `Vec3.symbolic.source`:

```ts
{
  kind: "coordinateRef",
  coordinateId: "coord-a",
  preview: { x: 0, y: 0, z: 0 }
}
```

The `coordinateId` is the model reference. The anchor's current `tikzName` is
looked up during export, so renaming an anchor updates exported references
without rewriting every referencing object.

Currently supported reference locations are:

- path coordinates;
- polygon and quad sheet vertices;
- point positions;
- free text label positions.

Coordinate references are rejected in locations where current TikZ export would
need to sample or rewrite geometry numerically, such as curved sheet primitives,
arc centers, path template centers, and work-plane frame fields.

## TikZ export

Coordinate anchors export in the `% Coordinates` section before generated helper
coordinates and before all layer drawing commands:

```tex
\coordinate (A) at (0,0);
\coordinate (B) at (2,1);
\draw (A) -- (B);
```

Work-plane-local anchors in 3D export in a local TikZ 3d plane scope when the
saved frame and local expressions can be preserved. If not, the exporter falls
back to the finite global preview coordinate and emits an explanatory comment.

Inline math export keeps coordinate anchors inside the `tikzpicture` and emits
no blank lines. Standalone and inline output both use four-space indentation
inside the picture body.

## Example

The reference example catalog includes `coordinateAnchorExample`, which exports
global anchors `A` and `B`, a work-plane-local anchor, a path using `(A) -- (B)`,
a visible point stratum placed at `B`, and a free text label placed at the local
anchor. The preview marker for each coordinate anchor remains separate from the
visible point stratum.

## Layers and preview state

Coordinate anchors are global. Layer view filters, hidden layers, layer merge,
layer delete, and the "New layer" creation value do not assign layers to
coordinate anchors and do not hide or move them.

The SVG preview has a Show/Hide Coordinates toggle. This is UI-only state and
is not saved in `Diagram`, so it does not affect save/load or TikZ export.
When coordinates are shown, each preview marker is a small dot surrounded by a
small dotted circle. The marker is preview-only and is not emitted to TikZ.

Coordinate markers are drawn above layer-bound geometry. Selection hit-testing
checks coordinate markers before strata, labels, and geometry handles, and each
marker has a larger transparent hit target than its visible dot. This gives
coordinate anchors high hit-test priority while keeping them visually small.
The marker tooltip names the coordinate anchor and its TikZ name.

## Deleting referenced coordinates

The saved model must not contain dangling coordinate references. Loading rejects
a diagram whose coordinate reference points to a missing anchor.

In the current editor, deleting a referenced coordinate detaches supported
references first, then removes the anchor. This is undoable. The inspector and
bulk-delete status messages report how many coordinate references were detached.

Detach is intentionally conservative:

- supported path, sheet-vertex, point-position, and free-label references are
  replaced by the coordinate's current model coordinate;
- global symbolic coordinate components are preserved when the target location
  supports symbolic coordinates;
- 3D work-plane-local coordinate anchors detach to ordinary coordinates with
  preserved local `a,b` expressions and a copied frame when the target location
  supports work-plane-local coordinates;
- coordinate references nested inside work-plane frame fields are detached to
  concrete finite preview coordinates, because frame fields cannot themselves
  preserve `\coordinate` references in TikZ;
- if a replacement would still reference a coordinate being deleted, the editor
  falls back to finite preview coordinates rather than leaving a dangling ref.

## Layer translation detach

Layer translation moves layer-bound strata and free text labels. Coordinate
anchors are global, so they do not move with the layer.

Before translating a layer, the editor detaches coordinate references used by
the layer-bound elements on that layer. The translated objects then move their
own copied coordinates, while the global coordinate anchors remain unchanged.
This prevents a path, point, sheet vertex, or label from continuing to point at
a global anchor that did not move with the layer. The layer operation status
reports detached coordinate-reference counts when any detach happened, and
undo/redo restores both the detach state and the translated coordinates.

## Limitations

Coordinate references are currently preserved in TikZ only for path
coordinates, polygon/quad sheet vertices, point positions, and free text label
positions. Unsupported locations are rejected during validation because export
would otherwise need to silently resample or rewrite geometry numerically:

- curved sheet primitive coordinates and sampled boundary snapshots;
- path template centers;
- arc centers;
- work-plane frame fields;
- derived preview coordinates.

Coordinate anchors are global reference handles, not styled point strata. They
do not currently have layer membership, style presets, partial visibility
policies, or TikZ output beyond their `\coordinate` definitions.
