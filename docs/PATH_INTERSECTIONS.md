# 2D Path Intersection Detection

Path intersection detection is a preview-derived geometry feature used as the
foundation for future braided string-diagram controls. It does not add data to
the saved `Diagram` model and it does not affect TikZ export in this phase.

Detection is enabled only for `ambientDimension: 2`. The output candidates use
model coordinates with `z: 0`.

## Supported Paths

The detector currently flattens these path-like curves:

- polylines;
- cubic Bezier paths, sampled uniformly;
- concatenated paths made from line, cubic Bezier, and arc segments;
- circle and ellipse template paths, sampled as closed loops.

Grid strata, labels, points, sheets, regions, and 3D curves are ignored.

## Policies And Limitations

- Only intersections between distinct path objects are considered.
- Open-path endpoint intersections are skipped, including shared endpoints.
- Closed template paths do not treat the duplicated closing point as an
  endpoint, so circle and ellipse crossings at the seam can still be detected.
- Collinear overlaps are treated as ambiguous and skipped.
- Cubics, arcs, circles, and ellipses use capped sampling rather than exact
  analytic intersection. Very tight curves, near-tangent intersections, or
  dense diagrams can require higher sample counts or can be missed; preview
  sampling options are clamped to finite maxima to keep SVG rendering
  responsive.
- Tangencies are skipped because braided string-diagram crossings require a
  transverse pair of tangents.
- Candidate IDs are deterministic from path IDs and rounded path parameters,
  but large geometry changes can legitimately change IDs.
