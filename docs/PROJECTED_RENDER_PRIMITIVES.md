# Projected Render Primitives

Phase 20D introduces projected render primitives as a pure metadata layer for
future approximate 3D visibility. The extraction code lives in
`src/rendering/projectedPrimitives.ts` and is not used by `SvgDiagram` or TikZ
generation yet, so manual layer order and existing output order are unchanged.

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

## Approximation Goal

This model is a foundation for automatic visibility, not the visibility feature
itself. It provides finite projected coordinates and finite depth metadata that
can later support:

- surface face depth sorting;
- curve visible/hidden segmentation behind surfaces;
- point and label visibility policies;
- TikZ ordering that matches the SVG preview as closely as practical.

## Current Limitations

- The extractor only works with supported orthographic 3D cameras.
- It does not reorder SVG or TikZ output.
- It does not compute curve/surface intersections or hidden segments.
- Work-plane filled sheets with holes are represented as separate boundary-loop
  face primitives rather than triangulated polygons with holes.
- Labels are not emitted as primitives yet.
