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

### Phase 12: Custom work planes and work-plane-local export

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

Phase 12 adds custom work planes, plane-local direct creation, existing coordinate sources, and work-plane-local TikZ export for eligible 3D relative Béziers.

## Phase 13: Editor usability and preview guides

Phase 13 improves editing usability before moving into more advanced geometric constructions.

It should be run as subphases `13A`, `13B`, `13C`, and `13D`.

Recommended `phaseSlugs` entries:

```js
"13A": "3d-coordinate-axes-guide",
"13B": "inspector-layout-stabilization",
"13C": "workplane-toolbar-reorganization",
"13D": "coordinate-source-highlighting",
```

### Phase 13A: 3D coordinate axes guide

- Show a faint default `x`, `y`, `z` coordinate guide in 3D SVG preview.
- Hide it in 2D.
- The guide is preview-only, non-selectable, and does not intercept pointer events.
- Add a user option to include/exclude this guide in TikZ output.
- TikZ export should not include axes by default.

### Phase 13B: Inspector layout stabilization

- Selecting or creating elements should not expand a huge inspector body by default.
- Inspector should start compact/collapsed after selection/creation.
- User can expand the inspector for detailed coordinate/style editing.
- SVG preview should not jump downward dramatically when inspector content changes.

### Phase 13C: Work-plane toolbar reorganization

- Reorganize work-plane controls into readable grouped/collapsible sections.
- Keep active work-plane summary visible in 3D.
- Organize:
  - preset axis-aligned planes;
  - custom origin+normal;
  - custom three-point input;
  - pick 3 existing points.
- Hide or minimize 3D work-plane controls in 2D.
- Do not change work-plane semantics.

### Phase 13D: Coordinate source highlighting

- Highlight selected coordinate sources in SVG preview.
- Apply to direct creation source selections:
  - point sources;
  - polyline vertices;
  - sheet vertices;
  - optional Bézier points.
- Apply to Pick 3 points for work plane.
- Highlights are preview-only and not exported to TikZ or saved to JSON.

## Phase 14: Concatenated paths

- 14A: data model for paths made from line and cubic Bézier segments.
- 14B: same-work-plane concatenated path creation.
- 14C: editing concatenated paths.
- 14D: cross-work-plane concatenated paths.

## Phase 15: Regions and curved 3D surface strata

Phase 15 prioritizes diagrammatic surfaces needed for 3-categorical graphical calculus, including 2D filled regions and 3D curved colored surfaces such as hemispheres and saddle patches.

### Phase 15A: 2D codim-0 region model

- Add 2D `RegionStratum`.
- Boundary is a closed path.
- Style includes fill and stroke options.

### Phase 15B: 2D closed-boundary validation

- Validate closed paths.
- Check endpoint matching, finite coordinates, and `z = 0`.

### Phase 15C: 2D filled region creation and editing

- Create and edit 2D codim-0 filled regions.
- Export to SVG/TikZ as filled closed paths.

### Phase 15D: 3D curved surface primitive data model

- Add model support for 3D curved sheet primitives.
- Initial primitives may include:
  - hemisphere patches;
  - saddle patches;
  - parametric rectangular patches.
- These are codim-1 sheet-like strata in 3D.

### Phase 15E: Colored hemispheres

- Create/render/export colored hemisphere surface patches.
- Support fill/stroke/opacity and layer behavior.
- Keep initial parameterization simple.

### Phase 15F: Saddle patches

- Create/render/export saddle-like surface patches.
- Support fill/stroke/opacity and layer behavior.
- Keep initial parameterization simple.

### Phase 15G: General 3D curved-boundary sheets

- Extend 3D sheets to support planar closed boundaries made from line and cubic Bézier segments.
- Render as projected filled paths or approximated patches.
- Export to TikZ readably.

## Phase 16: Layer manager

Layer manager is postponed until after editor usability and core surface features.

Planned features:

- layer rename;
- layer swap/reorder;
- layer duplicate;
- delete a layer and all elements on it;
- translate all elements on a layer while preserving relative positions;
- optional layer visibility/locking.

## Phase 17: Multi-selection and batch editing

Multi-selection is postponed until after layer manager.

Planned features:

- multi-select model/UI;
- same-geometric-kind batch style editing;
- batch layer changes;
- batch deletion;
- box selection;
- later duplicate/affine transform of selected groups.

## Later phases

- Anchored vertices / linked point references.
- Snapping and constraints.
- Full 3D camera controls.
- Perspective projection.
- Advanced TikZ export settings.
- TikZ import.
