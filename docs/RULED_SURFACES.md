# Boundary surface sheets

Boundary surface sheets are 3D codimension 1 sheet strata. Ruled surfaces use
copied boundary paths. Coons patches always keep materialized boundary
snapshots and may additionally retain live source links.

Ruled surfaces use two boundary paths and are sampled as

```text
S(u, v) = (1 - v) C0(u) + v C1(u)
```

where `C0` and `C1` are copied snapshots of the two chosen boundary paths.

Coons patches use four boundary roles—`bottom`, `right`, `top`, and `left`—and
are sampled as

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

1. Create or select four compatible boundary sources, one for each role. A
   role may use a supported open boundary path (polyline, cubic Bezier,
   concatenated path, or supported open path template) or a supported point
   stratum as a constant-point boundary. Grids and closed paths cannot be used.
2. Choose `Add sheet`, then `Coons`.
3. Click the boundary sources directly in this order: `bottom`, `right`, `top`,
   then `left`. The picked sources remain in the current Add sheet draft, so
   there is no need to switch back to Select mode between picks.
4. For each path boundary, check its direction and use the per-role `Reverse`
   control when needed. Constant-point boundaries do not need path reversal.
   Reversal never mutates the source path. For a static patch it determines the
   initial copied snapshot orientation; for a linked patch the stored
   `reversed` flag is reapplied on every successful source refresh.
5. Leave `Keep linked to boundary sources` checked for a live-linked patch, or
   clear it for a static copied patch.
6. Set `U segments` and `V segments`.
7. Click `Create`.

Boundary role order is part of the geometry:

- bottom: left to right
- right: bottom to top
- top: left to right
- left: bottom to top

All four selected boundaries, including constant-point boundaries, must satisfy
these corner equations:

- bottom start = left start
- bottom end = right start
- top start = left end
- top end = right end

Inconsistent corners are rejected with a status message. If four path
boundaries form a geometric loop but the corners do not match in the current
directions, reverse the affected roles in the Coons draft and revalidate. The
source paths are not modified.

A linked Coons patch stores both the four source roles (including each path's
`reversed` flag) and four materialized snapshots. Valid path, point, coordinate
anchor, coordinate-reference, symbolic-preview, bulk, and layer edits refresh
all four snapshots atomically. Sampling, SVG preview, SVG export, and TikZ
export continue to consume those snapshots rather than looking up sources at
render time.

If a source is missing or invalid, or if the current source corners do not
match, the source edit is still accepted. The patch displays and exports its
last valid materialized geometry and the Inspector reports `Linked — stale`.
Repairing the sources makes the patch catch up automatically. `Detach boundary
links` removes only the source metadata and leaves the current snapshots,
identity, style, layer, and sampling unchanged. Detach before intentionally
maintaining patch geometry independently from its former sources.

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
For symbolic boundary snapshots, this sampled mesh output uses their resolved
numeric preview values. A stale linked patch keeps the complete last-valid
snapshot model frozen, so its saved previews remain authoritative until the
sources recover; detaching that stale patch preserves the same frozen fallback.

## Compatibility And Limitations

Ruled surfaces remain snapshot-only in Phase 29. Coons patches from older JSON
files have no `boundarySources` metadata and remain static; links are never
inferred from optional IDs inside old snapshots. Linked JSON with dangling
source IDs remains loadable because the saved snapshots are the fallback.

Phase 29 does not add automatic corner repair, endpoint propagation, relinking,
independent linked-patch transform offsets, exact hidden-surface removal,
boolean operations, or advanced surface editing. Automatic visibility remains
an approximate painter's algorithm with sampled midpoint curve occlusion, so
intersecting surfaces, cyclic overlaps, and coarse meshes may still need manual
layer adjustment. Template path boundaries are copied as sampled polylines;
closed templates remain invalid as open Coons boundaries.
