# Projected Render Primitives

Phase 20D introduced projected render primitives as a pure metadata layer for
approximate 3D visibility. The extraction code lives in
`src/rendering/projectedPrimitives.ts`.

Phase 20E uses these primitives for optional surface face depth sorting in SVG
preview and TikZ export. The option is stored as `diagram.view.visibility` and
is off by default, so manual layer order and existing output order are unchanged
unless the user enables sorting.

## Primitive Model

`extractProjectedRenderPrimitives(diagram, options)` returns:

- `surfaceFace` primitives for visible geometric 2-dimensional sheet faces;
- `curveSegment` primitives for sampled geometric 1-dimensional curves;
- `point` primitives for geometric 0-dimensional points.

Each primitive preserves:

- `sourceId`, the source stratum id;
- `layer`, the source layer value;
- `originalIndex`, a stable extraction-order index for tie-breaking;
- projected 2D coordinates from the active 3D camera;
- original model-space `Vec3` coordinates used for depth.

Extraction is pure: it clones emitted coordinate values and does not mutate the
diagram.

## Depth Convention

Depth is computed with the orthographic 3D camera's model-space forward/view
direction:

```ts
depth(point) = dot(point, cameraForward)
```

The exported constant `PROJECTED_DEPTH_CONVENTION` is
`"smallerDepthIsCloser"`.

That means a point with smaller depth is closer to the camera, and a point with
larger depth is farther along the camera's view direction. Future sorting and
occlusion code must use this same convention.

`DepthStats` stores `min`, `max`, and `avg` over the model-space vertices of a
primitive.

## Geometry Coverage

Surface face primitives are emitted for:

- polygon sheets and quad sheets;
- 3D work-plane filled sheets, one approximating face per boundary loop;
- sampled curved sheet meshes;
- ruled surfaces;
- Coons patches.

Curve segment primitives are emitted for:

- polyline curves;
- cubic Bezier curves;
- concatenated paths, including sampled cubic and arc segments;
- template paths;
- grid preview segments.

Point primitives are emitted for point strata.

## Surface Face Depth Sorting

The visibility option shape is:

```ts
type VisibilityOptions = {
  enabled: boolean;
  surfaceDepthSort: boolean;
  sortMode: "layerThenDepth" | "depthThenLayer";
  depthEpsilon: number;
};
```

The default is conservative:

```ts
{
  enabled: false,
  surfaceDepthSort: true,
  sortMode: "layerThenDepth",
  depthEpsilon: 1e-9
}
```

When enabled, each sheet is split into projected surface-face primitives. Faces
are sorted using average depth, with larger depth drawn first because smaller
depth is closer to the camera. Ties within `depthEpsilon` are resolved by
`originalIndex`, preserving stable extraction order.

`layerThenDepth` keeps manual layer order as the primary key and sorts faces by
depth inside each layer. `depthThenLayer` is available in the shared sorting
helper and SVG preview; TikZ output still emits `pgfonlayer` blocks, so PGF
layer order remains the final layer-aware drawing structure.

Sorted SVG preview renders sheet faces individually and leaves curves, points,
and labels in their existing non-occluded rendering path. Sorted TikZ export
emits one `\filldraw` command per sorted face with comments recording the source
sheet, face index, and average depth.

## Approximation Goal

This model is a foundation for automatic visibility. It provides finite
projected coordinates and finite depth metadata that can support:

- curve visible/hidden segmentation behind surfaces;
- point and label visibility policies;
- TikZ ordering that matches the SVG preview as closely as practical.

## Current Limitations

- The extractor only works with supported orthographic 3D cameras.
- Surface sorting is a painter's algorithm, not exact hidden-surface removal.
- Intersecting surfaces or cyclic overlaps may still sort incorrectly.
- Large faces may need finer sampling before depth sorting looks right.
- It does not compute curve/surface intersections or hidden segments.
- Work-plane filled sheets with holes are represented as separate boundary-loop
  face primitives rather than triangulated polygons with holes.
- Labels are not emitted as primitives yet.
