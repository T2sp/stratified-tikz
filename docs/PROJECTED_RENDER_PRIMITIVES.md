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
  hiddenCurveStyle?: {
    lineStyle: "dotted" | "denselyDotted" | "dashed";
    opacity: number;
  };
};
```

The default is conservative:

```ts
{
  enabled: false,
  surfaceDepthSort: true,
  sortMode: "layerThenDepth",
  depthEpsilon: 1e-9,
  hiddenCurveStyle: {
    lineStyle: "denselyDotted",
    opacity: 0.45
  }
}
```

When enabled, each sheet is split into projected surface-face primitives. Faces
are sorted using average depth, with larger depth drawn first because smaller
depth is closer to the camera. Ties within `depthEpsilon` are resolved by
`originalIndex`, preserving stable extraction order.

`layerThenDepth` keeps manual layer order as the primary key and sorts faces by
depth inside each layer. `depthThenLayer` is available in the shared sorting
helper and TikZ export; TikZ output still emits `pgfonlayer` blocks, so PGF
layer order remains the final layer-aware drawing structure.

Sorted SVG preview renders sheet faces individually, then applies one total
layer-first render key. Within each layer, sorted surface faces are drawn first
in their precomputed face order, and curves, points, labels, and other
non-surface items keep their existing id ordering above those faces. Curve,
point, and label depth occlusion are intentionally left to later phases. Sorted
TikZ export emits one `\filldraw` command per sorted face with comments
recording the source sheet, face index, and average depth.

## Curve Occlusion

Phase 20F adds optional sampled curve occlusion behind projected surface faces.
The implementation lives in `src/rendering/curveOcclusion.ts` and is shared by
SVG preview and TikZ export.

For each sampled curve segment, StratifiedTikZ:

1. computes the segment midpoint in model coordinates;
2. projects that midpoint into camera screen coordinates;
3. finds projected surface faces whose polygon contains the midpoint;
4. estimates the face depth at that projected point using triangle
   barycentric interpolation, with average face depth as a fallback;
5. marks the segment hidden when the curve midpoint is farther than the face by
   more than `depthEpsilon`.

Hidden segments keep the curve stroke color and line width. The hidden style
overrides the line style and multiplies the original stroke opacity by
`hiddenCurveStyle.opacity`. The default is densely dotted at 45% of the curve's
own opacity.

`layerThenDepth` preserves manual layer order for occlusion: only surfaces on
the same or a higher layer can hide a curve. `depthThenLayer` lets depth decide
across layers. SVG preview ignores hidden-layer sheets as occluders. TikZ
export considers exported sheets and emits sampled visible/hidden `\draw`
commands when visibility is enabled; when visibility is disabled, exact curve
export, saved paths, local plane scopes, symbolic-friendly commands, and grid
foreach output are unchanged.

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
- Curve occlusion is midpoint sampled; it does not compute exact
  curve/surface intersections or clipped split points.
- Sampled curve occlusion export is numeric and approximate. Disable
  visibility when exact symbolic paths, saved paths, or grid foreach output are
  more important than preview-matched hidden segments.
- Work-plane filled sheets with holes are represented as separate boundary-loop
  face primitives rather than triangulated polygons with holes.
- Labels are not emitted as primitives yet.
