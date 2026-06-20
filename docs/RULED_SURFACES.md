# Ruled surfaces

Ruled surfaces are 3D codimension 1 sheet strata created from two boundary
paths. The surface is sampled as

```text
S(u, v) = (1 - v) C0(u) + v C1(u)
```

where `C0` and `C1` are copied snapshots of the two chosen boundary paths.

## Creation

In a 3D diagram:

1. Create or select two boundary paths. Polylines, cubic Beziers,
   concatenated paths, and path templates can be used. Grids cannot be used as
   boundary paths.
2. Choose `Add sheet`, then `Ruled`.
3. Select a boundary path and click `Pick boundary path`; repeat for the second
   boundary.
4. Set `Segments`.
5. Click `Create`.

The source paths are not modified. The created ruled surface stores copied
boundary geometry, not live references, so later source-path edits do not move
the surface.

## Preview And Export

The SVG preview samples the ruled surface into quadrilateral mesh faces. Sheet
fill color, fill opacity, stroke color, stroke opacity, layer visibility, and
selection highlighting use the same behavior as other sheets.

TikZ export emits one readable `\filldraw` polygon per sampled face. The output
is layer-aware, uses the sheet style, and includes comments identifying the
surface as a ruled surface with its sampling counts. Export does not depend on
`tikz-3dtools`.

## Limitations

The Phase 20B MVP stores copied boundary paths only. It does not support live
linked boundaries, automatic visibility/depth sorting, Coons patch creation,
boolean operations, or advanced surface editing. Template path boundaries are
copied as sampled polylines.
