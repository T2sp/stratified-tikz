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
3. Click the first boundary path in the SVG preview, then click the second
   boundary path. The picked paths remain in the current Add sheet draft, so
   there is no need to switch back to Select mode between picks.
4. Set `Segments`.
5. Click `Create`.

The source paths are not modified. The created ruled surface stores copied
boundary geometry, not live references, so later source-path edits do not move
the surface.

Saved JSON may contain symbolic boundary coordinates in the copied snapshots,
and 3D arc boundary segment frame snapshots may contain symbolic `origin`, `u`,
`v`, or `normal` components. When such a file is loaded, StratifiedTikZ asks for
the referenced variable values before committing the diagram. The preview and
mesh sampler use the resolved finite numeric preview coordinates; symbolic
coordinate and frame expressions remain in the saved model where supported.

## Coons Patch Creation

In a 3D diagram:

1. Create or select four boundary paths. Polylines, cubic Beziers,
   concatenated paths, and path templates can be used. Grids cannot be used as
   boundary paths.
2. Choose `Add sheet`, then `Coons`.
3. Click the boundary paths directly in this order: `bottom`, `right`, `top`,
   then `left`. The picked paths remain in the current Add sheet draft, so
   there is no need to switch back to Select mode between picks.
4. Check the displayed direction for each picked boundary. Use the per-role
   `Reverse` control to flip a boundary direction for this Coons patch draft.
   Reversal affects only the copied boundary snapshot used by the new Coons
   patch; it does not modify the source path.
5. Set `U segments` and `V segments`.
6. Click `Create`.

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

Inconsistent corners are rejected with a status message. If the four paths form
a geometric loop but the corners do not match in the current directions, reverse
the affected roles in the Coons draft and revalidate. The source paths are not
modified. The created Coons patch stores copied boundary geometry, not live
references, so later source-path edits do not move the patch.

## Preview And Export

The SVG preview samples ruled surfaces and Coons patches into quadrilateral
mesh faces. Sheet fill color, fill opacity, stroke color, stroke opacity,
layer visibility, and selection highlighting use the same behavior as other
sheets.

TikZ export emits one readable `\filldraw` polygon per sampled face. The output
is layer-aware, uses the sheet style, and includes comments identifying the
surface primitive and sampling counts. When automatic visibility is enabled,
the sampled mesh faces can participate in the same approximate painter-style
depth sorting as other sheet faces, and curves can be sampled into visible and
hidden runs behind the sheet. Export does not depend on `tikz-3dtools`.
For symbolic boundary snapshots, this sampled mesh output uses the resolved
numeric preview values from import or the current variable manager state.

## Limitations

The Phase 20 MVP stores copied boundary paths only. It does not support live
linked boundaries, exact hidden-surface removal, advanced corner repair,
boolean operations, or advanced surface editing. Automatic visibility is an
approximate painter's algorithm with sampled midpoint curve occlusion, so
intersecting surfaces, cyclic overlaps, and coarse meshes may still need manual
layer adjustment. Template path boundaries are copied as sampled polylines.
