# Boundary surface sheets

Boundary surface sheets are 3D codimension 1 sheet strata created from copied
boundary paths. The MVP supports ruled surfaces and Coons patches.

Ruled surfaces use two boundary paths and are sampled as

```text
S(u, v) = (1 - v) C0(u) + v C1(u)
```

where `C0` and `C1` are copied snapshots of the two chosen boundary paths.

Coons patches use four boundary paths and are sampled as

```text
S(u, v)
= (1 - v) bottom(u) + v top(u)
+ (1 - u) left(v) + u right(v)
- bilinearCornerBlend(u, v)
```

## Ruled Surface Creation

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

## Coons Patch Creation

In a 3D diagram:

1. Create or select four boundary paths. Polylines, cubic Beziers,
   concatenated paths, and path templates can be used. Grids cannot be used as
   boundary paths.
2. Choose `Add sheet`, then `Coons`.
3. Select each source path and assign it with the matching role button:
   `Pick bottom`, `Pick right`, `Pick top`, and `Pick left`.
4. Set `U segments` and `V segments`.
5. Click `Create`.

Boundary role order is part of the geometry:

- bottom: left to right
- right: bottom to top
- top: left to right
- left: bottom to top

The required corner matches are:

- bottom start = left start
- bottom end = right start
- top start = left end
- top end = right end

Inconsistent corners are rejected with a status message. The source paths are
not modified. The created Coons patch stores copied boundary geometry, not live
references, so later source-path edits do not move the patch.

## Preview And Export

The SVG preview samples ruled surfaces and Coons patches into quadrilateral
mesh faces. Sheet fill color, fill opacity, stroke color, stroke opacity,
layer visibility, and selection highlighting use the same behavior as other
sheets.

TikZ export emits one readable `\filldraw` polygon per sampled face. The output
is layer-aware, uses the sheet style, and includes comments identifying the
surface primitive and sampling counts. Export does not depend on `tikz-3dtools`.

## Limitations

The Phase 20C MVP stores copied boundary paths only. It does not support live
linked boundaries, automatic visibility/depth sorting, advanced corner repair,
boolean operations, or advanced surface editing. Template path boundaries are
copied as sampled polylines.
