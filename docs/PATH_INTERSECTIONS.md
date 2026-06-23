# 2D Path Intersection Detection

Path intersection detection is a preview-derived geometry feature used as the
foundation for braided string-diagram controls. The detector itself is derived
from current curve geometry. User-selected crossing states are stored separately
in `Diagram.pathCrossings`, while final TikZ gap/mask output is deferred to the
braiding export phase.

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
- Preview detection is bounded by additional caps:
  - at most 48 path-like curves are considered by default;
  - at most 128 flattened/sample segments are considered per path by default;
  - at most 384 path pairs are checked by default;
  - at most 256 crossing candidates are returned by default.
  Caller-provided higher limits are clamped to hard maxima. When a cap is hit,
  detection returns the candidates found so far and a status message for the
  preview toolbar instead of continuing unbounded work.
- Tangencies are skipped because braided string-diagram crossings require a
  transverse pair of tangents.
- Candidate IDs are deterministic from path IDs and rounded path parameters,
  but large geometry changes can legitimately change IDs.

## Crossing State Convention

Crossing candidates are generated from paths sorted by id. Therefore `pathAId`
is the lexicographically earlier curve id and `pathBId` is the later curve id.

Stored crossing states use this convention:

- `none`: no braiding;
- `braiding`: `pathAId` passes over `pathBId`;
- `antiBraiding`: `pathBId` passes over `pathAId`.

If a saved crossing no longer matches a current candidate with the same id and
path order, it is treated as stale and removed during load or diagram cleanup.
If detection is capped while cleaning or validating a dense diagram, exact
candidate reconciliation is skipped and structurally valid crossing states are
kept so save/load does not discard persisted braiding data merely because the
preview detector reached a performance limit.

The preview reports overlapping collinear path segments as ambiguous. They are
not converted into braiding candidates because a range overlap does not define a
single transverse crossing point.
