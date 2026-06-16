# ROADMAP

This roadmap reflects the current staged plan for StratifiedTikZ.

## Completed or earlier phases

### Phase 1: Data model

- `Diagram` supports `ambientDimension: 2 | 3`.
- Coordinates are internally `Vec3`.
- 2D diagrams keep `z = 0`.
- Strata use codimension convention:
  - 2D: codim 0 regions, codim 1 curves, codim 2 points.
  - 3D: codim 0 regions, codim 1 sheets, codim 2 curves, codim 3 points.

### Phase 2: Geometry and projection

- Basic projection and work-plane placement helpers.

### Phase 3: TikZ generator

- 2D and 3D TikZ output.
- Explicit styles, labels, and coordinate declarations.

### Phase 4: SVG preview

- Static SVG rendering for diagrams.

### Phase 5: Basic UI

- Example selector, preview, inspector shell, TikZ source display.

### Phase 6: Selection and editable inspector

- Selection.
- Read-only and editable inspector.
- Style editing.

### Phase 7: Cursor creation tools

- Cursor creation for points, labels, polylines, cubic Béziers, and 3D polygon sheets.
- Axis-aligned work-plane guide.

### Phase 8: Save and load

- Versioned JSON export/import.
- Invalid files rejected safely.

### Phase 9: Foundational TikZ semantics

- 9A: user-controlled coordinate-name stems.
- 9B: layer-aware TikZ output.
- 9C: layer-based selection/filtering.
- 9D: `spath/save` integration.

### Phase 10: Basic editing completeness

- 10A: remove selected elements.
- 10B: direct-input creation for points and labels.
- 10C: direct-input creation for paths and sheets.
- 10D: cursor drag editing for selected geometry handles.
- 10E: multi-step undo/redo history.
- Optional follow-up: empty 2D/3D canvas startup.

### Phase 11: Bézier editing improvements

- 11A: relative Cartesian / polar control-point editing.
- 11B: optional TikZ relative-control export for 2D Béziers.
- 11C: preserve relative Bézier intent in TikZ output where possible.

## Phase 12: Custom work planes and work-plane-local export

Phase 12 is split into subphases and should be run as `12A`, `12B`, ..., not as one monolithic `12`.

Recommended `phaseSlugs` entries:

```js
"12A": "workplane-model-geometry",
"12B": "workplane-origin-normal",
"12C": "workplane-three-numeric-points",
"12D": "workplane-existing-point-strata",
"12E": "workplane-preview-creation",
"12F": "workplane-camera-export-separation",
"12G": "plane-local-direct-creation",
"12H": "direct-creation-existing-point-sources",
"12I": "workplane-local-bezier-metadata",
"12J": "tikz-3d-scope-bezier-export",
```

### Phase 12A: WorkPlane model and geometry utilities

- Add robust `WorkPlane` model.
- Custom work planes use `origin`, normalized `u`, normalized `v`, and normalized `normal`.
- Add helpers for construction, validation, local/global coordinate conversion, and axis-aligned compatibility.

### Phase 12B: Custom plane from origin + normal

- Add 3D-only UI to construct a custom work plane from:
  - origin `(x,y,z)`;
  - normal `(nx,ny,nz)`.

### Phase 12C: Custom plane from three numeric points

- Add 3D-only UI to construct a custom work plane from three finite non-collinear numeric points.
- Use `P0` as origin and `P1-P0` as preferred local x-axis.

### Phase 12D: Custom plane from three existing point strata

- Add a picking workflow to select three existing point strata and define a work plane from them.
- Initial scope: point strata only, not curve/sheet vertices.

### Phase 12E: Custom work-plane preview and creation integration

- Render a non-exported, non-interactive custom work-plane guide.
- Cursor creation for points, labels, polylines, cubic Béziers, and polygon sheets works on the active custom plane.

### Phase 12F: Camera-ready projection/export separation

- Harden separation between:
  - model-space work planes;
  - screen projection/camera;
  - committed diagram data;
  - transient UI state;
  - TikZ export.
- Active work-plane UI state is not saved/exported.
- Geometry created on work planes remains ordinary `Vec3` diagram data.

### Phase 12G: Plane-local direct creation

- Direct creation forms in 3D can use active work-plane local coordinates.
- Plane-local input `(a,b)` means:
  - `P = origin + a u + b v`.
- This is not silent projection of global `(x,y,z)` input.
- Supported targets:
  - point;
  - label;
  - polyline vertices;
  - cubic Bézier point-like inputs;
  - polygon sheet vertices.

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

### Phase 12I: Work-plane-local cubic Bézier metadata

- Store enough curve-level metadata for eligible 3D relative Cartesian/polar Béziers to remember their work-plane-local frame.
- Metadata includes a frame snapshot:
  - origin;
  - `u`;
  - `v`;
  - normal.
- Absolute `Vec3` controls remain available for rendering/editing.
- Export meaning does not depend on the currently active UI work plane.

### Phase 12J: TikZ `3d` library scope export for work-plane-local Béziers

- Eligible 3D work-plane-local relative Béziers export using TikZ's `3d` library:
  - `plane origin`;
  - `plane x`;
  - `plane y`;
  - `canvas is plane`.
- Inside the scope, use 2D-style relative controls:
  - `+(dx,dy)` for relative Cartesian;
  - `+(angle:radius)` for relative polar.
- Do not emit independent control-point `\coordinate` declarations for scoped relative controls.
- Fallback to absolute 3D Bézier export when no reliable work-plane-local frame exists.

## Phase 13: Concatenated paths

- 13A: data model for paths made from line and cubic Bézier segments.
- 13B: same-work-plane concatenated path creation.
- 13C: editing concatenated paths.
- 13D: cross-work-plane concatenated paths.

## Phase 14: 2D codimension-0 regions

- 14A: 2D `RegionStratum` data model.
- 14B: closed-boundary validation.
- 14C: filled region creation.
- 14D: region editing.

## Phase 15: General 3D curved-boundary sheets

- 15A: 3D planar closed-boundary sheet model.
- 15B: 3D curved-boundary sheet creation.
- 15C: advanced 3D sheet boundary editing.

## Later phases

- Anchored vertices / linked point references.
- Snapping and constraints.
- Full 3D camera controls.
- Perspective projection.
- Advanced TikZ export settings.
- TikZ import.
