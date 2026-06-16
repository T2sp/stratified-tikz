# ROADMAP update snippet for Phase 12H

Replace the current Phase 12H section with the following.

## Phase 12H: Existing coordinate sources for direct creation

Direct creation forms can use existing diagram coordinates as sources.

Supported source types:

- point stratum positions;
- polyline vertices, in both 2D and 3D;
- polygon sheet vertices, in 3D;
- optionally cubic Bézier start/control/end points.

Initial policy:

- copy-on-create;
- no live linking;
- no anchored vertices.

This means:

- selecting an existing coordinate source copies its current coordinate into the new geometry;
- the new curve/sheet does not remain linked to the source;
- moving or deleting the original source later does not update or invalidate the newly created geometry.

Coordinate mode behavior:

- In global coordinate mode, the source model-space `Vec3` is copied exactly.
- In active work-plane local mode, the source coordinate should lie on the active work plane, unless an explicit projection option is later added.
- Off-plane sources should not be silently projected.

This phase should not implement live linked vertices. Linked/anchored vertices are a later feature.
