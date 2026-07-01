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

## Layers and preview state

Coordinate anchors are global. Layer view filters, hidden layers, layer merge,
layer delete, and the "New layer" creation value do not assign layers to
coordinate anchors and do not hide or move them.

The SVG preview has a Show/Hide Coordinates toggle. This is UI-only state and
is not saved in `Diagram`. When coordinates are shown, their preview markers are
drawn above layer-bound geometry and use a larger transparent hit target for
selection. The current marker is preview-only; it is not emitted to TikZ.

## Deleting referenced coordinates

The saved model must not contain dangling coordinate references. Loading rejects
a diagram whose coordinate reference points to a missing anchor.

In the current editor, deleting a referenced coordinate detaches supported
references first, replacing each reference with the coordinate's current
concrete position, then removes the anchor. This is undoable. A fuller reference
manager remains future work.
