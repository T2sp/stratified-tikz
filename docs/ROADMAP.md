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


## Phase 13E: Orthographic camera model and projection helpers

- Introduce `Camera3D` using tikz-3dplot-compatible notation:
  - `thetaDeg`;
  - `phiDeg`.
- Preserve the previous/default 3D display as `INITIAL_CAMERA_3D`.
- Provide reset-to-initial helper.
- Add camera-aware projection helpers.
- Keep work planes as model-space geometry separate from camera.

## Phase 13F: Camera controls UI and reset

- Add camera controls:
  - theta;
  - phi;
  - zoom;
  - pan;
  - presets;
  - reset to initial.
- Reset to initial display must always be available.
- Camera changes affect SVG preview but not committed geometry.
- Camera operations should not pollute diagram undo history.

## Phase 13G: Camera-aware creation, picking, and drag editing

- Update cursor creation, point picking, and drag handles to use camera-aware screen-to-model conversion.
- Use the pipeline:
  - screen point;
  - camera ray or orthographic inverse;
  - active work-plane intersection;
  - model-space Vec3.
- Preserve 2D behavior.

## Phase 13H: Camera presets, persistence, and reset policy

- Decide and implement camera persistence as view metadata:
  - new JSON writes 3D camera metadata under `diagram.view.camera3d`;
  - legacy top-level camera data still loads;
  - missing or invalid camera metadata falls back to the initial camera.
- Missing/invalid camera data falls back to initial camera.
- Camera reset-to-initial remains always available.
- Reset-to-saved may be offered for the last saved/loaded 3D camera.
- Camera changes do not create geometry undo history entries.
- Geometry edits performed under the current camera remain undoable.

## Phase 13I: TikZ camera/export alignment with tikz-3dplot

- Generated 3D TikZ should reflect current camera orientation.
- Use tikz-3dplot-style output:
  - `\tdplotsetmaincoords{theta}{phi}`;
  - `tdplot_main_coords`.
- Keep 3D coordinates as 3D coordinates.
- Do not pre-flatten geometry to 2D.
- Zoom/pan export policy should be explicit.

## Phase 13J: Perspective projection placeholder and camera hardening

- Keep orthographic camera as the production camera.
- Prepare the camera abstraction for future perspective projection.
- Do not expose broken perspective UI.
- Document that perspective export is future work.

## Phase 14: Concatenated paths

Phase 14 provides the 1-dimensional path infrastructure needed for complex 2D/3D stratified diagrams.

The final target includes diagrams with solid and dotted 1-strata running along or between translucent colored surfaces, as in the reference 3D stratified PDF. Curved colored 2-dimensional surface primitives are deferred to Phase 15.

Recommended `phaseSlugs` entries:

```js
"14A": "concatenated-path-model",
"14B": "same-plane-concatenated-path-creation",
"14C": "concatenated-path-editing",
"14D": "segment-style-overrides",
"14E": "cross-workplane-concatenated-paths",
```

### Phase 14A: Concatenated path data model and validation

- Add first-class concatenated paths made from line and cubic Bézier segments.
- Support 2D and 3D.
- Validate finite coordinates and adjacent endpoint compatibility.
- Preserve codimension conventions:
  - 2D paths are codim 1;
  - 3D paths are codim 2.

### Phase 14B: Same-work-plane concatenated path creation

- Add a creation tool for paths made from sequential line and cubic Bézier segments.
- Support 2D and 3D on one active work plane.
- Add draft preview, finish, and cancel.
- Export committed paths to SVG/TikZ.
- Cursor workflow: first click starts the path, line mode clicks one endpoint,
  and cubic Bézier mode clicks control 1, control 2, then endpoint.
- In 3D, a path draft captures the active work plane at start and blocks
  work-plane changes until Finish or Cancel.
- Direct workflow: users can enter manual line/cubic/arc segment data, or
  create circle, ellipse, and arc templates.
- Circle and ellipse are stored as persistent template path strata so TikZ can
  export native `circle` / `ellipse` syntax. In 3D, templates store the active
  work-plane frame at creation time; template UI state is not exported.
- Arc is a first-class concatenated path segment. The standalone arc direct
  template creates an ordinary concatenated path containing an arc segment.

### Phase 14C: Concatenated path editing

- Inspector editing of segments.
- Drag editing of endpoints and cubic controls.
- Preserve adjacent endpoint consistency.
- Support relative/polar Bézier editing where applicable.

### Phase 14D: Segment-level style overrides

- Add per-segment style overrides.
- Required line styles:
  - solid;
  - dashed;
  - dotted;
  - densely dotted.
- Export mixed-style paths readably, splitting TikZ draw commands if needed.

### Phase 14E: Cross-work-plane and free 3D concatenated paths

- Allow paths whose segments are not restricted to a single work plane.
- Treat work planes as editing aids in cross-work-plane mode rather than global
  path constraints.
- Preserve same-work-plane mode for safety, including mixed-plane rejection.
- Export committed paths as ordinary absolute 3D path geometry while preserving
  segment order and segment-level style overrides.

## Phase 15: Filled closed boundaries and 3D curved surface strata

Phase 15 focuses on filling closed paths in 2D and 3D, then adding curved 3D sheet primitives.

The target includes diagrams with translucent colored regions/sheets, solid/dotted 1-strata, point markers, labels, coordinate axes, and readable TikZ output.

### Phase 15A: Closed-boundary fill data model

- Add 2D codim-0 filled regions.
- Add 3D codim-1 work-plane-local filled sheets.
- Support multiple closed boundaries.
- Support fill rules:
  - nonzero;
  - evenOdd.

### Phase 15B: Create filled regions/sheets from selected closed paths

- Select one or more closed paths.
- Create a 2D filled region in 2D.
- Create a 3D planar/work-plane-local filled sheet in 3D.
- Copy boundary geometry at creation time.
- Support even-odd fill rule for multiple boundaries.

### Phase 15C: SVG and TikZ fill output with even-odd rule

- Render filled regions/sheets in SVG.
- Export to TikZ.
- Use SVG `fill-rule="evenodd"` and TikZ `even odd rule` where appropriate.
- For 3D work-plane-local sheets, prefer TikZ `canvas is plane` scope when available.

### Phase 15D: Filled region/sheet editing

- Inspector editing for fill rule, style, layer, and boundary summary.
- Optional boundary coordinate editing or boundary replacement workflow.
- Preserve save/load and undo/redo.

### Phase 15E: Curved sheet primitive model and sampling utilities

- Add 3D curved sheet primitives:
  - hemisphere / spherical-cap patches;
  - saddle patches.
- Add sampling/mesh helpers and validation.

### Phase 15F: SVG and TikZ export for curved sheet primitives

- Render curved sheets as sampled meshes.
- Export curved sheets to TikZ as sampled filled faces.
- Preserve style, opacity, layer, and readability.

### Phase 15G: Hemisphere and saddle creation/editing

- Add user-facing creation/editing for hemisphere and saddle patches.
- Use active work-plane/frame orientation where appropriate.
- Support style/layer/sampling controls.

### Phase 15H: Reference-diagram presets and export hardening

- Add reference-style examples/templates.
- Add lightweight style presets for translucent sheets and solid/dotted curves.
- Harden TikZ output readability and default sampling.

## Phase 16: Layer Manager

Phase 16 implements layer-level editing and management operations.

### Phase 16A: Layer metadata and Layer Manager foundation

- Add diagram-level layer metadata.
- Existing numeric `layer` fields remain the source of element membership.
- Old diagrams without layer metadata derive default names.
- Add a Layer Manager list showing layer values, names, and element counts.
- Keep filter and creation-layer controls as UI state, not layer metadata.

### Phase 16B: Layer rename and layer swap/reorder

- Rename layers through metadata.
- Swap two layer values across all elements on those layers.
- Preserve save/load, undo/redo, and TikZ layer behavior.
- MVP display order remains deterministic numeric ascending.

### Phase 16C: Layer duplicate and layer delete

- Duplicate all elements on a layer to a new layer with new IDs.
- Delete a layer and all elements on it.
- Clear/validate stale selection/filter/drafts.
- Preserve undo/redo.

### Phase 16D: Layer translation

- Translate all elements on a layer by a vector.
- 2D: dx/dy and z remains 0.
- 3D: dx/dy/dz.
- Preserve relative positions, ids, styles, names, and layer values.
- Update frame origins and absolute coordinates consistently.

### Phase 16E: Layer visibility, locking, and filter integration

- Add preview/editor visibility toggles.
- Optionally add locking.
- Hidden layers are not selectable in SVG preview.
- TikZ export policy should be clear; default is to export all layers unless explicitly changed.

### Phase 16F: Layer Manager polish and regression hardening

- Add UI polish, status messages, confirmations, disabled states.
- Add combined-operation regression tests.
- Update docs.

## Phase 17: Style Manager and TikZ style import

Phase 17 makes Inspector Style presets user-editable and adds support for referencing external TikZ styles.

Important export policy:

- User-created structured presets inside StratifiedTikZ are emitted as local style definitions in `\begin{tikzpicture}` options.
- Imported external `\tikzset` definitions are **not** inlined into generated TikZ.
- Generated TikZ only includes comments instructing the user to load the external style file.
- Imported style keys may be used in `\draw`, `\filldraw`, and `\node` options.

### Phase 17A: User-editable structured style presets

- Add user-created presets for curves, sheets, points, labels, and regions.
- Built-in presets remain available.
- User presets can be created, renamed, edited, deleted, and applied.
- In TikZ output, these user preset styles are defined inside `\begin{tikzpicture}[...]`.

### Phase 17B: Imported TikZ style references and external load comments

- Add model for external style files and imported style keys.
- Commands can reference imported keys.
- Generated TikZ adds comments telling the user which external style file to load.
- Do not inline `\tikzset`.
- Do not emit active `\input` by default.

### Phase 17C: Limited `\tikzset` parser for style import

- Parse simple `.sty` / `.tex` files containing `\tikzset`.
- Support `.cd` prefixes and `key/.style={...}`.
- Skip unsupported TeX constructs safely.
- Store extracted style keys/options as imported style references.

### Phase 17D: Auto-detect color/style presets and SVG preview approximation

- Detect likely color and shape presets from imported style keys/options.
- Add detected presets to Inspector Style preset lists.
- Approximate simple color/opacity/line-style options in SVG preview.
- Preserve imported TikZ keys for export.

### Phase 17E: Apply custom/imported styles to `draw`, `filldraw`, and `node` output

- Apply local user presets and imported style keys to relevant TikZ commands.
- Support curves, sheets, regions, points, labels, paths, and surfaces where applicable.
- Preserve layer-aware output and coordinate naming.

### Phase 17F: Style Manager polish, docs, and regression hardening

- Polish UI for built-in/user/imported preset groups.
- Add error/status messages.
- Add combined workflow tests.
- Document import/export limitations.

## Phase 18: TikZ export modes for standalone and inline math

Phase 18 separates traditional standalone TikZ export from inline math export intended for environments such as `align`.

Recommended `phaseSlugs` entries:

```js
"18A": "tikz-export-mode-model-ui",
"18B": "inline-math-setup-baseline",
"18C": "inline-math-no-blank-lines",
"18D": "export-mode-polish-docs",
```

### Phase 18A: TikZ export mode model and UI

- Add export mode:
  - standalone;
  - inline math.
- Add UI selector.
- Pass mode through TikZ generator.
- Standalone remains default.

### Phase 18B: Inline math setup placement and baseline option

- In inline math mode, all setup and drawing commands are inside each `tikzpicture`.
- Always include:
  - `baseline={([yshift=-.5ex]current bounding box.center)}`.
- Emit `\definecolor`, local `\tikzset`, layer setup, and camera setup inside the picture.
- Imported external style files are still comments only.

### Phase 18C: Blank-line-free inline formatter with comment separators

- Inline math output contains no blank lines.
- Use comment separator lines for readability.
- Safe for `align` and similar math environments.

### Phase 18D: Export mode polish, documentation, and regression coverage

- Add docs and examples.
- Ensure copy/download uses selected mode.
- Add representative regression tests.

## Phase 19: Symbolic input and grid generation

Phase 19 adds PGFMath-style symbolic variables, symbolic coordinate expressions, and compact grid generation using `\foreach` and `\clip`.

### Phase 19A: Symbolic scalar expression model and evaluator

- Add limited PGFMath-like expression grammar.
- Support variables, arithmetic, elementary functions, and degree-based trig.
- Provide numeric preview evaluation and TikZ expression formatting.
- Reject unsafe/raw TeX input.

### Phase 19B: Variable Manager and `\pgfmathsetmacro` export

- Add toolbar Variable Manager.
- Variables export as `\pgfmathsetmacro`.
- Validate macro names, expressions, duplicates, and cycles.
- Support save/load.

### Phase 19C: Symbolic coordinate input

- Allow coordinate fields to accept expressions such as `R*cos(q)`.
- SVG uses numeric preview values.
- TikZ exports symbolic components such as `{\R * cos(\q)}`.
- Integrate with Inspector and direct creation.

### Phase 19D: Symbolic TikZ export integration

- Harden export across element kinds.
- Ensure variables are emitted before use.
- Preserve standalone/inline export modes.

### Phase 19E: Grid generation data model and SVG preview

- Add grid objects with range/step/clip controls.
- Support 2D grids and 3D work-plane-local grids.
- Render preview with line count limits.

### Phase 19F: Grid TikZ export using `\foreach` and `\clip`

- Export grids compactly using `\foreach`.
- Use rectangular clip ranges.
- Use `canvas is plane` for 3D work-plane-local grids.

### Phase 19G: Symbolic input and grid polish

- Add docs, examples, error messages, and combined regression tests.

## Phase 19H: Triangular and honeycomb lattice grid patterns

- Extend grid generation beyond the existing rectangular/cubic lattice.
- Add triangular lattice pattern.
- Add honeycomb lattice pattern.
- Support 2D and 3D work-plane-local grids.
- Preserve compact TikZ export using `\foreach` and `\clip` where practical.
- Preserve inline math no-blank-lines and 4-space indentation.
- Keep existing rectangular/cubic grid behavior unchanged.

## Phase 20: Boundary surfaces and approximate 3D visibility

Phase 20 adds ruled surfaces, Coons patches, and approximate automatic 3D visibility/depth handling.

The visibility algorithm is inspired by screen-depth and z-sorting ideas from TikZ/PGF 3D tooling, but the MVP computes visibility inside StratifiedTikZ rather than depending on external TikZ packages.

### Phase 20A: Ruled surface and Coons patch model/sampling utilities

- Add data models for ruled surfaces and Coons patches.
- Add boundary path sampling.
- Add mesh generation and validation.

### Phase 20B: Ruled surface creation, SVG preview, and TikZ export

- Create a ruled surface from two boundary paths.
- Copy boundary geometry.
- Render/export sampled mesh.

### Phase 20C: Coons patch creation, SVG preview, and TikZ export

- Create a Coons patch from four boundary paths.
- Validate corner compatibility.
- Render/export sampled mesh.

### Phase 20D: Projected render primitive and depth model

- Decompose diagrams into projected render primitives.
- Compute depth values from current camera.
- Preserve source/layer metadata.

### Phase 20E: Surface face depth sorting

- Optionally depth-sort surface faces.
- Preserve manual layer order through a layer/depth sort mode.
- Apply to SVG and TikZ output.

### Phase 20F: Curve occlusion and hidden segment styling

- Approximate curve/surface occlusion.
- Split sampled curves into visible/hidden segments.
- Render hidden segments as dotted/dimmed.

### Phase 20G: Point/label visibility options and auto-visibility UI

- Add UI options for auto visibility.
- Add hidden point behavior.
- Keep labels foreground by default.

### Phase 20H: Auto-visibility TikZ export hardening and docs

- Harden TikZ export and performance.
- Add docs/examples.
- Document approximation limitations.

## Phase 21: Preview-centered UI overhaul

Phase 21 implements the full UI redesign based on the reference mockup.

Recommended `phaseSlugs` entries:

```js
"21A": "preview-centered-ui-shell",
"21B": "floating-toolbar-tool-model",
"21C": "direct-input-drawer",
"21D": "inspector-preview-drawer",
"21E": "ibis-style-layer-window",
"21F": "ui-overhaul-polish",
```

### Phase 21A: Preview-centered UI shell and layout foundation

- Make SVG Preview the central workspace.
- Move TikZ Source below the Preview.
- Keep top controls compact.

### Phase 21B: Floating SVG Preview toolbar and tool model cleanup

- Move toolbar into SVG Preview top.
- Add collapse/expand control.
- Overlay Undo/Redo.
- Put Remove selected at toolbar right as trash button.
- Default to cursor input.
- Consolidate Add polyline and Add cubic Bézier into Add path.
- Show Fill paths only in Select/Add path.

### Phase 21C: Direct input drawer inside SVG Preview

- Direct input becomes per-Add-mode option.
- Direct forms open in a right-side Preview drawer.
- Cursor input remains default.

### Phase 21D: Inspector drawer from SVG Preview button

- Inspector opens only from Preview upper-right button.
- Inspector appears as right-side drawer matching Preview height.
- Inspector scrolls internally.

### Phase 21E: Ibis Paint-style Layer window

- Integrate toolbar Layer and New element layer controls into Layer window.
- Add compact Preview lower-right Layer button showing new layer / total layers.
- Add layer thumbnails/previews.
- Select new element layer graphically.
- Swap layers by dragging rows.
- Show selected-layer action buttons for rename/duplicate/translate/delete.

### Phase 21F: UI overhaul polish, accessibility, and regression hardening

- Fix overlay stacking and pointer events.
- Harden responsive behavior.
- Add accessibility labels and docs.
- Run end-to-end regression checks.

### Phase 22A: Path arrow data model and TikZ option generation

- Add endpoint and mid-arrow options.
- Mid-arrow default position is `.5`.
- Arrow heads:
  - `\arrow{>}`;
  - `\arrow{Stealth}`;
  - `\arrow{Latex}`;
  - `\arrow{Stealth[harpoon]}`;
  - `\arrow{Stealth[harpoon,swap]}`.
- Generate TikZ decoration options and required library hints.

### Phase 22B: Arrow UI, SVG preview, and path direction reversal

- Inspector/UI controls for arrow options.
- SVG arrowhead preview.
- Reverse path direction command.

### Phase 22C: 2D path intersection detection for string diagrams

- Detect intersections between 2D paths.
- Show crossing candidates in SVG preview.
- No 3D braiding.

### Phase 22D: Braiding crossing state and click-to-toggle UI

- Persist crossing states:
  - no braiding;
  - braiding;
  - anti-braiding.
- Click crossing to toggle.

### Phase 22E: TikZ/SVG braiding rendering without knot package

- Render/export braidings using explicit gap/mask strategy.
- Do not use TikZ knot package.
- Preserve arrow decorations on main paths.

### Phase 22F: Arrow/braiding polish, docs, and regression hardening

- Add docs/examples.
- Add performance caps.
- Harden save/load and combined arrow+braiding output.

## Phase 23: UI refinement pass

Phase 23 refines examples, toolbar palettes, and camera UI after the major Phase 21 UI overhaul.

Recommended `phaseSlugs` entries:

```js
"23A": "example-bar-curated-layout",
"23B": "toolbar-palette-add-path-polish",
"23C": "camera-panel-below-preview",
```

### Phase 23A: Full-width Example bar and curated examples

- Make Example bar full browser width.
- Default example is Empty 2D.
- Show only:
  - Empty 2D;
  - Empty 3D;
  - 2D example;
  - 3D example;
  - braiding.
- Use the attached 2D/3D JSON examples.

### Phase 23B: Toolbar palette exclusivity and Add path menu simplification

- Only one toolbar palette can be open.
- Add path Direct input becomes one item.
- Add path buttons receive visually distinct cues.
- Fill paths visibility remains Select/Add path only.

### Phase 23C: Camera UI below Preview with slider controls

- Move camera UI below Preview and above TikZ Source.
- Add theta/phi sliders with keyboard input next to a small 3D coordinate reference.
- Add zoom/pan sliders with keyboard input.

## Phase 24: Multi-selection and batch editing

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
