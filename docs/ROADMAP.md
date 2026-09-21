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

## Phase 24: Editing fundamentals — snapping, multi-selection, symbolic translation, path concatenation, and layer merge

Phase 24 improves core editing features.

Important scope decision:

- General affine transforms are deferred to a later phase.
- Phase 24 implements translation only.
- Translation should support symbolic coordinates.
- Path concatenation does not need to preserve all original source path styles.

### Phase 24A: Cursor snap / coordinate quantization

- Add optional cursor snap step.
- Apply to cursor placement and drag editing.
- 3D snapping is work-plane-local.
- Direct/symbolic input is not snapped.

### Phase 24B: Multi-selection state and selection UI

- Shift/modifier-click multi-selection.
- Same-geometric-kind MVP policy.
- Inspector selection summary.
- Multiple selected highlights.

### Phase 24C: Bulk style/layer/delete/duplicate editing

- Bulk style editing with mixed-value display.
- Bulk layer change.
- Bulk delete.
- Bulk duplicate.

### Phase 24D: Bulk translation with symbolic coordinate support

- Translate selected objects.
- Preserve symbolic coordinate expressions by adding translation deltas.
- Translate frame origins but not basis vectors.
- No affine rotate/scale/shear.

### Phase 24E: Concatenate selected paths

- Concatenate selected paths in selection order.
- Auto-reverse next paths when endpoints match.
- Keep originals option, default on.
- Simple style policy; no need to preserve all original styles.

### Phase 24F: Layer merge and layer translation symbolic hardening

- Merge source layer into target layer.
- Update metadata/View/New layer state predictably.
- Reuse symbolic-aware translation helpers for layer translation.
- General layer affine transform deferred.

### Phase 24G: Editing polish, docs, and regression hardening

- Docs and examples.
- Combined workflow tests.
- Save/load/undo/redo hardening.


## Phase 25: Work-plane-local symbolic coordinates

Phase 25 connects Phase 12 work planes with Phase 19 symbolic input.

Users can enter symbolic 2D local coordinates on a 3D work plane, such as:

```text
a = R*cos(q)
b = R*sin(q)
```

The editor stores the work-plane frame snapshot and local scalar expressions, uses finite global preview values for SVG, and exports local expressions using `canvas is plane` scopes where practical.

Important user decision:

- During global translation, move each object's stored frame origin.
- Do not expand local symbolic expressions into global expressions.
- Do not mutate a shared active work plane.

Recommended `phaseSlugs` entries:

### Phase 25A: Work-plane-local symbolic coordinate model and validation

- Add coordinate source model.
- Store frame snapshot and local scalar expressions.
- Compute finite global preview point.
- Add validation and save/load support.

### Phase 25B: Direct input and Inspector UI

- Add Global xyz / Active work-plane local mode.
- Accept symbolic local scalars.
- Show preview values.
- Edit local coordinates in Inspector.

### Phase 25C: Preview refresh, JSON import, and geometry integration

- Refresh local previews when variables change.
- Detect variables in local scalars and frames during JSON import.
- Extend support to geometry fields.

### Phase 25D: TikZ export using canvas-is-plane scopes

- Export same-frame local symbolic paths/sheets in `canvas is plane` scopes.
- Preserve local expressions.
- Document mixed-frame policy.

### Phase 25E: Editing integration and translation policy

- Global translation moves object frame origins.
- Local expressions remain unchanged.
- Integrate with multi-selection, layer translation, snap, and path concatenation.

### Phase 25F: Polish, docs, and regression hardening

- Add docs/examples.
- Add combined workflow tests.
- Harden save/load/export behavior.

## Phase 26: Global TikZ coordinate anchors

Phase 26 adds `\coordinate` anchors distinct from visible points.

Coordinate anchors are global, not layer-bound, exported before drawing commands, shown in Preview as overlay markers, and usable as references by paths/sheets/labels/points.

### Phase 26A: Coordinate anchor model, save/load, and global TikZ export

- Add coordinate anchor model.
- Export global `\coordinate` definitions before drawing commands.
- Coordinate anchors have no layer/codim/style.

### Phase 26B: Add coordinate cursor/direct input and basic Preview marker

- Add separate Add coordinate tool.
- Cursor and direct input.
- Basic preview marker and selection.

### Phase 26C: Coordinate references in path/sheet/label/point inputs and TikZ output

- Add `coordinateRef` source.
- Preview resolves refs.
- TikZ emits `(A)` references.

### Phase 26D: Coordinate Inspector, rename, move, and unused delete

- Coordinate-specific Inspector.
- Rename/tikzName edit.
- Move/edit coordinate position.
- Delete unused coordinate.

### Phase 26E: Coordinate anchors integration with editing, snapping, selection, and layer operations

- Snap relation.
- Layer filter/New layer independence.
- Path concatenation integration.
- Coordinate anchors remain non-layer-bound.

### Phase 26F: Coordinate anchor core docs and regression hardening

- Docs and examples for core coordinate anchors.
- Save/load/TikZ regression tests.

### Phase 26G: Coordinate anchor marker, show/hide toggle, and hit-test priority

- Marker is small dot with dotted circle.
- Add Show/Hide Coordinates toggle.
- Coordinate anchors have high hit-test priority.

### Phase 26H: Coordinate reference inventory and detach helpers

- Find coordinate refs across supported fields.
- Pure detach helpers preserve symbolic/local sources when possible.

### Phase 26I: Delete coordinate with detach and Inspector usage count

- Show usage count.
- Delete referenced coordinates by detaching refs first.

### Phase 26J: Layer translation detach for coordinate references

- Coordinate anchors do not move with layers.
- Layer-bound refs detach before translation.

### Phase 26K: Coordinate anchor integration polish, save/load, TikZ, and docs

- Combined tests.
- Save/load/TikZ hardening.
- Docs and UI polish.


## Phase 26L: Coordinate-anchor multi-selection state and UI

- Coordinate-only multi-selection.
- Shift/modifier-click toggle.
- Inspector summary and selected marker highlighting.
- Mixed coordinate + layer-bound selection is not MVP.

## Phase 26M: Coordinate-anchor translation helper with symbolic and work-plane-local support

- Pure helper for translating coordinate anchors.
- Global symbolic coordinates preserve expressions.
- Work-plane-local coordinates move stored frame origin.
- Internal coordinateRefs in selected coordinate positions detach first.
- Atomic failure behavior.

## Phase 26N: Coordinate multi-translation UI and undo/redo

- Inspector translation panel for selected coordinates.
- Numeric/symbolic delta input according to helper support.
- Undo/redo.
- References remain live.

## Phase 26O: Drag translation for multi-selected coordinate anchors with snap support

- Drag one selected coordinate to move all selected coordinates.
- Snap applies to drag translation.
- One history entry.

## Phase 26P: Coordinate multi-selection translation polish, docs, and regression hardening

- Docs.
- Combined tests.
- Save/load/TikZ/undo/redo hardening.

## Phase 27: Interaction and editing polish

Phase 27 prioritizes usability and final editing polish after the core editing features are complete.

### Phase 27A: Selection cycling for overlapping preview objects

- Alt/Option-click cycles through overlapping selectable candidates.
- Coordinate anchors, points, labels, paths, sheets, crossing markers, and handles are considered according to priority.
- Cycling state is UI-only.

### Phase 27B: Path inline nodes/vertices exported as `node[pos=..., ...]`

- Add path-attached inline nodes/vertices.
- Export using TikZ `node[pos=...]`.
- This does not split path geometry.

### Phase 27C: Path splitting at an interior point

- Split selected path into two paths.
- Support line/polyline and cubic Bézier at minimum.
- Handle styles/arrows/inline nodes/crossings with documented policy.

### Phase 27D: Style eyedropper for same geometric kind

- Copy/paste style between objects with the same `geometricKind`.
- Works with multi-selection targets.
- Does not copy geometry/layer/id.

### Phase 27E: UI polish — Layer Actions translucency, lenient Inspector numeric inputs, and Add path naming

- Make Layer Actions popover semi-transparent.
- Inspector numeric inputs allow temporary invalid strings and show warnings.
- Rename Add path cursor creation to `Arbitrary path`.

### Phase 27F: Docs, combined tests, and interaction hardening

- Documentation and combined workflow tests.
- Performance and save/load/TikZ hardening.

## Phase 28: Preview-first UI, style shortcuts, SVG export, work-plane UX, and arrow preview

Recommended `phaseSlugs` entries:

### Phase 28A: Preview-first layout and compact Examples dropdown

- SVG Preview around 90dvh.
- Examples collapse to compact dropdown after editing starts.
- Preview safe-area layout.

### Phase 28B: SVG Preview export button and sticky edge actions

- Export current Preview SVG.
- Right-bottom below, sticky, protruding outside frame.
- Coordinate with Layer button.

### Phase 28C: Translucent toolbar/buttons, z-index tokens, and topmost variable modal

- Toolbar and buttons translucent using rgba backgrounds.
- Text remains opaque.
- Variable import modal topmost.

### Phase 28D: Context quick style bar with 0.1-step sliders and custom numeric input

- Fast style shortcuts by geometric kind.
- Stroke width/point radius sliders step 0.1.
- Custom numeric input with invalid draft warnings.

### Phase 28E: Toolbar eyedropper and imported TikZ style shortcut dropdown

- Eyedropper shortcut.
- Imported TikZ style searchable dropdown.
- Avoid duplicate generated options unless overridden.

### Phase 28F: Work-plane overlay editor and work-plane-local polar coordinate input

- Work-plane panel near Preview left-bottom.
- Add point/coordinate active work-plane local polar input.
- Show work-plane origin near input.

### Phase 28G: Work-plane setup UX overhaul with origin + normal vector

- Method order: Pick 3 existing points > Origin + normal vector > Custom 3 points.
- Normal theta/phi with mini preview.

### Phase 28H: Coons direction lifecycle and overlay panel cleanup

- Coons direction window closes when leaving Coons workflow.

### Phase 28I: TikZ-faithful SVG arrow preview

- SVG arrowheads approximate generated TikZ arrows.

### Phase 28J: Phase 28 docs, tutorial hooks, and regression hardening

- Docs/help.
- Combined tests.
- Accessibility and responsive hardening.

### Phase 28K: Selectable transparent/white SVG export background

### Phase 28L: Correct triangular lattice geometry for arbitrary spacing

- Define triangular vertices by the local basis `(s, 0)` and
  `(s/2, sqrt(3)s/2)`, where `s = uRange.step`.
- Keep Preview and compact 2D/3D TikZ line-family phases aligned at the saved
  local range origin for arbitrary positive finite spacing.
- Cover unit, sub-unit, non-integral, and larger spacing with geometry-level
  regression tests.

### Phase 28M: Keep every multiline TikZ library instruction commented

## Phase 29: Live-linked Coons patch boundary synchronization

Recommended `phaseSlugs` entry: `"29": "live-linked-coons-boundaries"`.

- Store optional source links alongside materialized Coons boundary snapshots.
- Refresh valid linked patches after source path/point edits.
- Preserve reverse direction and undo/redo atomicity.
- Retain last valid snapshots when links are temporarily invalid.
- Support static legacy patches and explicit detach.

## Phase 30: Inspector duplicate and translate actions for Coons patches

Recommended `phaseSlugs` entry: `"30": "coons-patch-duplicate-translate"`.

- Duplicate one selected Coons patch as an untranslated copy using ordinary
  patch-only link semantics, then select the copy.
- Translate a selected Coons patch in place at the same ID, detaching only that
  patch before moving it when active boundary links are present.
- Preserve exact last-valid stale snapshots and symbolic-aware translation
  without moving source strata or coordinate anchors.
- Commit each action as one transaction, so Duplicate followed by Translate
  has two-step Undo/Redo.

## Phase 31: Typeset TeX labels in SVG Preview

Status: in progress. Phases 31A and 31B are complete. The independent adapter's
ink/advance fix, disposable-worker recovery, and regressions passed their checks.
The 2026-09-20 (22:55 JST) authorized-terminal run at `880cdde` rebuilt the same
code and passed the unchanged browser smoke (exit 0) in Chrome 153.0.8010.52.
Actual additional-font loading, same-service native-import recovery, Worker
retirement, and standalone SVG containment are verified; earlier sandbox
`EPERM` attempts are historical. 31C is implemented with its production-browser
acceptance check pending. Phase 31D implementation and acceptance status are
recorded below; 31E and 31F remain planned.
Implement and review the subphases in order; mark each complete only after its
own acceptance checks pass.

Start with the [Phase 31A implementation contract](../prompts/phase-31a-implement.md)
and [review contract](../prompts/phase-31a-review.md). Subsequent subphases have
matching implementation/review pairs in `prompts/`.

- Typeset user-authored free labels and path inline-node text with MathJax SVG.
- Preserve ordinary text mixed with supported math delimiters. This is a bounded
  math preview, not a full LaTeX engine or arbitrary preamble/package support.
- On a label error, unsupported input, or resource failure, display that label's
  entire latest input literally, including delimiters, backslashes, whitespace,
  and newlines. Pending labels also show their latest source; never retain a
  stale last-good formula or display a partially compiled label.
- Preserve authoritative label strings, the JSON schema, existing Undo/Redo,
  and both TikZ export modes. Keep compiled geometry, metrics, errors, requests,
  and caches in derived runtime state only.

Recommended `phaseSlugs` entries:

```json
{
  "31A": "tex-label-input-contract",
  "31B": "tex-label-svg-adapter",
  "31C": "tex-free-label-preview",
  "31D": "tex-path-inline-labels",
  "31E": "tex-label-svg-export",
  "31F": "tex-label-regression-docs"
}
```

### Phase 31A: Label input grammar and exact-source fallback contract

Status: implemented. The pure parser is not connected to production rendering;
existing label appearance is unchanged.

- Added a pure, bounded parser for ordinary Unicode text mixed with `$...$`,
  `\(...\)`, `$$...$$`, and `\[...\]`, with explicit delimiter/escape rules.
- Keeps exact original source for whole-label fallback. Ordinary text retains
  newlines for future visual line breaks; math-source newlines remain inside
  the math run for future MathJax conversion. Literal fallback preserves all
  source line breaks.
- Established typed contracts, focused tests, and grammar documentation without
  changing production label rendering yet.
- Grammar, delimiter precedence, source offsets, and finite limits are specified
  in [Label Preview Input Contract](./PREVIEW_UI.md#label-preview-input-contract-phase-31a).

### Phase 31B: MathJax-to-SVG adapter, metrics, isolated conversion, and cache

Status: complete. The 2026-09-20 (22:55 JST) authorized-terminal run at `880cdde`
passed a fresh build and the unchanged browser smoke (exit 0), closing the
earlier environment-blocked gate. Chrome 153.0.8010.52 was observed to cache
failed native imports, and all runtime/font/shared-module failure scenarios
recovered in the same service/page after invalidation, with old Workers retired.
Actual base-path/font requests and all 15 standalone SVG containment fixtures
passed. Evidence is in `/private/tmp/stz-phase31b-browser-acceptance.hKjXxy/`.
The 144 focused parser/adapter tests (included in the full suite), 2,258 full
tests, targeted lint, and script syntax checks passed on the same unchanged
production code. No production or harness correction was needed for the terminal
run. The production canvas is unchanged. See
[adapter interfaces, limits, assets, and verification status](./LABEL_ADAPTER.md).

- Added the justified, pinned MathJax dependency and locally served resources
  compatible with the application's Vite base path.
- Converts complete labels into immutable SVG/text results with finite normalized
  metrics, or exact-source fallback. Detect error output even when conversion
  resolves successfully; an undefined command is a failure.
- Isolates per-label engine state, constrains generated SVG, and keeps glyph
  geometry self-contained. Bounds work, requests, and cache storage, with a
  recovery policy for transient resource failures.
- Resource failure, timeout, and invalidation terminate the lazy MathJax Worker
  and its whole native module map, including shared dependencies and fonts.
  Retries reuse fixed asset URLs in a fresh bounded context; actual same-page
  native-import recovery passed the affected-browser acceptance gate.
- Retained geometry and strokes now determine conservative portable ink bounds,
  independently of true run advance. Unsupported geometry and negative whole-run
  advances fall back to the exact complete source.
- Real adapter tests cover overhang, nested/negative spacing, and later-request
  recovery. Browser deployment and standalone raster containment also passed,
  with actual requests and independent geometry/raster evidence.

### Phase 31C: Free-label SVG rendering, measured placement, and picking

Status: implemented and browser acceptance verified on 2026-09-21. The authorized
parent `31C verify` run passed tests, build, diff check and both required browser
commands. All eight 31C groups completed with no page errors or unexecuted groups.

- Free labels now use `SvgTexLabel` and a Preview-owned runtime with complete
  current-source fallback, subscription generations, and document ownership
  revisions. Derived state stays outside the model and Undo/Redo.
- Measured text/math layout supplies all nine anchors and revision-matched
  picking bounds. The existing font scale, explicit paint, layer/occlusion
  rules, selection markers, and drag paths are preserved.
- Conversion geometry is reused across duplicate labels and measurement
  changes; placement, camera, selection, and paint are separate inputs.
- Targeted M1 follow-up extends the development-server browser harness with
  independent raster ink bounds and negative controls; 18 tall/compact anchor/
  camera boundary cases; instrumented inverted completions and pending lock/
  autoHide transitions; and real App editor, JSON, Undo/Redo and reused-ID loading.
  The old transparent-hit-rectangle bounds assertion is replaced. Coverage is
  implemented; the early authorized run executed only initial renderer
  assertions, leaving complete evidence pending until the final run below.
- Historical 2026-09-21 verification at `4b25b823` plus the follow-up diff: focused
  23 tests (subset of the full 2,281) passed; build, strict fixture typecheck,
  targeted lint, all browser-script syntax checks and diff check passed. Build
  emitted only a nonblocking size warning. App/SvgDiagram lint debt remains
  10 errors / 4 warnings against HEAD; repository-wide lint was not run.
- The historical strengthened browser command exited **1 before assertions** at Vite
  startup: `listen EPERM: operation not permitted 127.0.0.1:5173`. No Chrome
  launch or browser observations occurred in this attempt. Evidence (including
  explicit unexecuted groups and checkout diff identity) is in
  `/private/tmp/stz-phase31c-browser-acceptance.2ni7DV`; the separate review's
  `/private/tmp/stz-review31c-browser` attempt was also blocked before launch.
- The later authorized Terminal run at `4b09c181dcea6b7db9f46daf7d82ef322ef4e3ee`
  plus a prompt-only diff launched Chrome 153.0.8010.52 using Node v26.9.0 and
  development origin `http://127.0.0.1:5174`. It exited **1** at
  `renderer-fixture` on `Tab advances to a measured four-space stop`. Evidence
  and a failure screenshot are in `/private/tmp/stz-phase31c-browser-acceptance.POb7Fz`.
  Initial assertions ran, but `completed: []` means no complete group; its old
  `unexecuted` field incorrectly classified partial renderer progress.
- The independent `/private/tmp/stz-phase31c-tab-diagnostic.json` explains that
  failure: empty computed `font` left Canvas at its unrelated default 10px font.
  Production tab placement exactly matched the explicit displayed-font Canvas
  measurement, and independent native SVG space measurement was within the
  unchanged 0.5-unit tolerance. This is a harness defect, not evidence of a
  production layout defect or a complete browser pass.
- The targeted fix at `476a39f3315eaeb6d0c85bd95e98ab44a4c0aede` plus the pending
  diff uses temporary SVG text clones with current displayed font/spacing for
  tab stops and literal-edge whitespace. New browser regressions cover empty/
  unusable shorthand, reject unrelated default-10px metrics, and check a changed
  font without widening tolerances. Diagnostics are saved before assertions;
  started groups/checkpoints distinguish partial execution from no execution.
  Production code is unchanged. These regressions subsequently passed in the
  complete authorized browser run.
- Earlier child-session checks passed with Node v26.9.0: 23 focused tests (included in all
  2,298 tests, none failed/skipped), build, strict fixture TypeScript, targeted
  lint, all four script syntax checks and diff check. Build emitted only the
  nonblocking chunk-size warning. Logs are in
  `/private/tmp/stz-phase31c-checks.LSbuyz`; final checkout metadata/diff in its
  `final-checkout.*` files include the documentation updates.
- The corrected child-session browser attempt in
  `/private/tmp/stz-phase31c-browser-acceptance.Rzi8z7` exited **1** at
  `development-server-listen` with `EPERM` on `127.0.0.1:5173`. Chrome did not
  launch, all eight groups are incomplete/unexecuted, and no browser
  observations were produced. That session prohibited escalation; the parent
  runner subsequently executed both browser checks outside the child sandbox.
  The prior authorized renderer assertion remains a distinct historical result.
  M1 remained open at that handoff. See
  [coverage, outcomes and authorized-run handoff](./PREVIEW_UI.md#free-label-verification).
- The final authorized run is retained in
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31c-manual-wU4DY3`.
  Node v26.9.0: 2,298 tests passed; build and diff check passed; both browser
  commands exited 0. Chrome 153.0.8010.52 completed all eight 31C groups with
  99 passing records, including all 18 boundary matrix cases and the real App
  editor/history/JSON/reused-ID workflows. The runner verified an unchanged
  checkout. Strict fixture TypeScript, targeted lint and script syntax checks
  also passed; the build warning remains nonblocking.
  The follow-up corrects test-only whitespace rounding, same-layer occlusion
  setup, native SVG matrix precision, overlap-cycle expectations, and App
  framing/selector assumptions. Original tab/ink/picking tolerances are retained;
  authored coordinates remain strict and native matrix readback uses float32
  precision. Obsolete App completions must preserve position without corrective
  pan. No production code changed. **M1's browser-evidence gap is closed.**
- This subphase leaves inline-node integration to 31D below and settled export
  preparation to 31E. Current SVG export clones visible formulas/fallback.

### Phase 31D: Path inline-node TeX labels through the shared SVG renderer

Status: incomplete. The preceding independent review returned `needs_changes`
for two then-missing browser scenarios under one Medium issue. Those cases
were implemented; the next parent verification executed the changed harness
and failed its initial-camera overlap assertion before another review. The
current candidate-cycle correction awaits complete parent verification and
independent re-review. The accepted halo oracle correction remains preserved.

- Inline-node text uses the shared `SvgTexLabel` parser, adapter, cache,
  exact-source fallback, lifecycle controller and measured layout. Five anchors
  retain the 14-unit marker offsets and font 12. Decorative white halos,
  marker/highlight geometry, pointer pass-through and marker-centered owning
  curve selection are preserved. Owner identity includes document/path/node;
  derived state stays outside model/history and raw TikZ data.
- The initial child server `EPERM` and previous diagnostic-child block remain
  historical. An earlier authorized parent did launch Chrome 153.0.8010.52
  under Node v26.9.0 and failed `check:free-labels` (exit 1) at `above`, zoom 1:
  `maxCompositeError=5.082352941176467 > 2`, after `1130 > 31` passed. Tests,
  build, diff check and label assets exited 0. Seven groups completed, inline
  rendering was partial, and inline lifecycle/real App were unexecuted.
  Retained operands, PNG/SVGs and checkout snapshot are in
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-if6x1M/`.
  That earlier verification stopped before review.
- The prior oracle fix started at clean `2622458c5e652febdfb1b065be1d1b33d84bdd5e`.
  Previously pending implementation/diagnostic/validation changes are committed
  and preserved (previous eight-file diff SHA-256
  `6679416198d0a12c59aa6376e137fd475dced9d96ce80ba919baa633d0f29e28`).
  Independent saved-PNG decoding reproduces the opaque worst pixel exactly:
  expected blue 66.08235 versus actual 61. All 21 errors above 2 occur among
  749 opaque-white-halo pixels; the other 381 have max error 0.4899135447.
  Premultiplication alone does not fix it. Direct thin fill/stroke painting
  versus a flattened transparent foreground is the targeted oracle assumption;
  its independent white-backdrop comparison subsequently passed the parent
  browser matrix and was accepted by review.
- The oracle adds an independent direct foreground-on-white reference only at
  exact opaque-white halo pixels; all other pixels retain the original
  source-over comparison. Both keep maximum tolerance 2, with the same original
  pixel population and an additional all-pixel premultiplied RGB/alpha bound 2.
  Production paint is unchanged. Original pre-assertion diagnostics remain;
  the added white reference, bounded samples, difference PNGs, stroke/isolation
  experiments and six bad-output controls are retained before assertions.
  Controls cover wrong layer order, missing/oversized outlines, opaque gaps,
  color and opacity errors. All six controls and the complete ten-group matrix
  passed in the matching `Fiv3uY` parent run recorded below.
- Phase-aware parent validation is unchanged: complete 31C eight-/ten-group
  evidence is accepted; 31D–31F require ten. Rejection tests preserve missing,
  malformed, duplicate, unsupported, incomplete/error/nonzero and changed-tree
  cases plus 31B behavior. The prior child focused checks passed 93 tests,
  including
  eight new numeric tests and 53 parent helper/runner tests (Node v26.9.0,
  exit 0). `npm test` passed all 2,356 tests (including the focused subset);
  build, fixture TypeScript, requested syntax checks, targeted lint and diff
  check exited 0. The existing build-size warning/lint debt are separate.
  Those commands and that dirty-checkout identity are recorded at
  `/private/tmp/stz-phase31d-compositing-fix/handoff.json`.
- The prior child's direct Chrome launch exited 1 before measurements;
  Terminal and Chrome UI access were denied. The subsequent authorized parent
  passed under Node v26.9.0 / Chrome 153.0.8010.52, with exit 0 for all 2,356
  tests, build, diff check, `check:label-assets` and `check:free-labels`.
  Evidence is retained at
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-Fiv3uY/`:
  `verification.json`, both browser command logs/artifacts, and
  `05-check-free-labels/artifacts/free-labels-evidence.json`. The browser report
  is `passed`/`complete`, all ten groups completed, with no incomplete groups,
  unexecuted cases or page errors. Checkout fingerprint:
  `b08ec90799f1b9d2edbf63946db7edba81a928a67b2730f70e9bff3e5db29f00` at
  `2622458c5e652febdfb1b065be1d1b33d84bdd5e` plus changes, including the two
  then-untracked compositing helper/test files (now tracked and preserved).
- Independent review ran, used that matching parent browser evidence, passed
  2,356 tests/build/static/diff checks and found no production defect.
  `logs/codex/31D-review-summary.json` records `needs_changes` with zero
  Critical, one Medium and zero Low-priority issues: actual 3D owning-curve
  clicks and recovery of the same continuously mounted inline node were
  absent. Halo compositing is resolved; prior group completion cannot prove
  assertions the old harness never contained.
- The preceding coverage fix started from clean
  `14875dbbf61a2a61e031a40261ab14037e63a43c`. The existing rendering group gains
  `inline-3d-interaction-initial-camera` and `inline-3d-interaction-moved-camera`:
  one 3D document with nonzero z, reused local IDs, real ordinary/Alt owner
  selection, overlapping-marker cycling, blank-canvas resets, dot/non-dot
  highlighting and native-glyph nonselection outside marker/curve tolerance.
  Coordinates are remeasured through the current SVG screen transform after
  rotation and pan/zoom; unchanged owner/revision, raw data/history/TikZ and
  conversion count are checked, with camera/event/geometry evidence and
  screenshots for both states.
- The existing lifecycle group gains
  `inline-same-owner-valid-invalid-valid-recovery`: A-ready, exact B fallback,
  held C-pending, C-ready and late obsolete-failure observations before any
  new mount. Same DOM/runtime owner and sibling isolation are checked with
  current source/font request identity, glyphs and measured layout. Text edits
  keep their normal undo entries; snapshots immediately after each intentional
  edit are compared with asynchronous settlement/release so rendering cannot
  alter JSON, history, selection or either TikZ mode. Existing inverted races,
  Undo/Redo, halo oracle, 2D/path matrix, App and export assertions remain.
- That coverage-fix child attempted `npm run check:free-labels` with `/opt/homebrew/bin`
  first in `PATH` (Node v26.9.0). It exited 1 at development-server startup:
  `listen EPERM` at `127.0.0.1:5173`, before browser launch, with all ten groups
  unexecuted and no identified browser. Diagnostics are retained at
  `/private/tmp/stz-phase31d-coverage-fix-browser/free-labels-evidence.json` and
  `/private/tmp/stz-phase31d-coverage-fix-browser.log`.
- That preceding coverage-fix child verification under Node v26.9.0 passed 93 focused tests with
  no failures or skips (included in the full-suite total). Strict fixture
  TypeScript, all five requested script syntax checks, targeted ESLint expanded
  to `scripts/checkFreeLabelGeometry.mjs` and diff check exited 0. Exact commands
  and logs are in `/private/tmp/stz-phase31d-coverage-fix/focused-checks.json`.
  `npm test` exited 0 with 2,356 passes and no failures/skips (including the
  focused subset); `npm run build` exited 0 with the existing chunk warning.
  Full commands/statuses/logs are in
  `/private/tmp/stz-phase31d-coverage-fix/full-checks.json`. No production files
  changed; existing App/SvgDiagram lint debt is untouched and repository-wide
  lint was not run. `/private/tmp/stz-phase31d-coverage-fix/handoff.json`
  records that handoff's tracked/untracked checkout identity. These historical
  checks do not verify the current candidate-cycle correction.
- The next parent verification executed the added coverage under Node v26.9.0
  / Chrome 153.0.8010.52 at `http://127.0.0.1:5174` and failed before review.
  Evidence is in
  `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-2KaWQt/`.
  Tests (2,356 passes), build, diff check and label assets exited 0; free-labels
  exited 1 after two overlap Alt clicks selected B/B, each with one callback.
  Seven groups and 82 records passed with no page errors. The final checkpoint
  was `inline-3d-interaction-initial-camera/overlap-alt-1`; moved-camera/glyph
  and recovery assertions were not reached, and lifecycle/path/export plus
  real-App groups never started. Both halo matrices, all six negative controls,
  transparent math, supported-path projection and 2D selection passed. The
  unchanged checkout was `14875dbbf61a2a61e031a40261ab14037e63a43c` plus five
  modified files and no untracked files; diff SHA-256
  `2f1d06c077ab8ff8fd908682260f1b18f43921c17138a23e2b7b4c36e7011c66`, fingerprint
  `49077e86deb20d3f7fd111e2de41533f54848ae78481cdc2f9d79c7f3ac24a47`.
- The current correction starts from clean
  `1f43eefe171c2c834060e10418aae80876ed0651`. Saved `failure.png` displays
  `Selected 3/4: path "pick3dB"` after the second click. Candidate cycling can
  visit an inline marker and its curve body consecutively with the same owner.
  Source reconstruction predicts marker A, marker B, curve B, curve A and
  indices `1, 2, 3, 0, 1` / owners `B, B, A, A, B`; it is not a fresh native
  trace. The harness replaces its two-click/unique-owner assumption with one
  full native cycle plus wrap, bounded by the verified candidate count and an
  explicit maximum of four. It asserts stable candidate membership, actual
  visible index/count advancement, both expected owners and one callback per
  click. Read-only fixture diagnostics retain actual event/client/SVG points,
  rounding, candidate IDs/kinds/distances/owners, geometry, camera and document
  continuity. Production picking, priorities, tolerances and initial-cycle
  semantics are unchanged; both 3D scenarios and same-owner recovery remain
  implemented and required.
- The current child's intermediate diagnostic browser attempt, after adding
  the fixture observer but before the bounded-cycle harness correction, ran
  under Node v26.9.0 and exited 1 at
  `development-server-listen` (`EPERM` at `127.0.0.1:5173`) before browser launch.
  All ten groups were unexecuted, with no new native trace or browser version.
  Report and log:
  `/private/tmp/stz-phase31d-alt-cycle-browser/free-labels-evidence.json`,
  `/private/tmp/stz-phase31d-alt-cycle-browser.log`. This child restriction is
  separate from the parent assertion and does not match or verify the final
  corrected checkout.
- Current child checks with `/opt/homebrew/bin` first in `PATH` (Node v26.9.0)
  passed 197 focused tests (seven requested files), included in the full
  `npm test` total of 2,356; no failures/skips, exit 0. Build exited 0 with the
  existing chunk warning. Strict fixture TypeScript, all five script syntax
  checks, targeted ESLint including the changed fixture, and diff check exited
  0. Exact commands/statuses/logs are in
  `/private/tmp/stz-phase31d-alt-cycle/focused-checks.json` and `full-checks.json`.
  The focused regression is the native full candidate cycle; no production
  helper changed or new helper unit test was added. Final checkout identity is
  retained in `/private/tmp/stz-phase31d-alt-cycle/handoff.json` outside the
  fingerprinted tree. Fresh parent verification and independent review
  remain pending for the normal outer runner after this handoff; standalone
  parent verification uses
  `PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31D verify`.
  The normal order remains fix, complete parent verification, independent
  review. The final tracked/untracked checkout must pass all ten groups with
  identifiable new scenario records before re-review; `verify` itself does
  not review, approve completion or commit.
- 31E's settled export wait/snapshot policy and 31F's combined audit remain
  deferred. See [inline-node verification](./PREVIEW_UI.md#inline-node-verification).

### Phase 31E: Settled-label SVG export and standalone SVG fidelity

Status: export implementation, SVG-context correction and bounded capture
retained. The latest parent verification reopened autoDim with its complete
foreground, then failed strict equality between captured opacity
`0.24499999999999997` and computed opacity `0.245`. A harness-only `1e-12`
absolute tolerance addresses that representation difference; fresh complete
matching parent verification and independent review remain outstanding.
The earlier parent report `stz-phase31e-before-review-r43lZG` passed ten groups
and 120 scenario records with no page errors, then failed the dimmed formula
path assertion for `$\frac{autoDim}{x}$`. This is a 31E acceptance failure;
31D's candidate-cycle and recovery checks passed on that snapshot. The old
report did not retain the failed export or settlement outcome, so its cause
cannot be determined from the live preview screenshot.

The diagnostic follow-up added bounded, source-specific timing/outcome,
detached/serialized SVG, opacity, and standalone observations before assertions,
plus exact-source foreground negative controls and settlement regressions.
The 20,000 ms fixture versus 10,050 ms export boundary was an unconfirmed timing
hypothesis at that stage; the later `Qku3Ld` record measures successful
conversion within the deadline and loss of its detached subtree. No limit
increase, sleep, retry-to-pass or visibility relaxation was applied. The
subsequent parent report
`stz-phase31e-before-review-HVvae4` passed ten groups and 119 scenario records,
then failed before autoHide reopening: `page.context().newPage()` attempted
a second page in the fixture's implicitly page-owned context. AutoHide
serialization succeeded in 8 ms with zero represented labels/requests (correct
for hidden labels) and preserved live SVG; no new standalone visibility scenario
passed. AutoDim and all later export scenarios were not reached. Node tests
(2,390), build, diff and label-assets checks passed; free-label acceptance exited
1. This confirmed API misuse is distinct from the older autoDim assertion.

The historical parent report `stz-phase31e-before-review-xlQmJP` passed tests
(2,390), build, diff and label-assets checks, then failed free-label acceptance after ten
completed groups and 119 passing records, with no page errors. The independent
autoHide page was created and its file navigation/evaluation returned, confirming
progress past ownership failure. A `fullPage: true` screenshot timed out after
30 seconds, after `fonts loaded`; the catch repeated that unsupported capture.
Neither standalone PNG exists. AutoHide's saved 435-byte SVG is 900×700 with
`viewBox="0 0 900 700"`; preparation succeeded in 1 ms with zero labels/requests
and preserved live SVG. The computed reopen result was not saved before capture,
and autoDim or later standalone scenarios were not reached. Checkout fingerprint
`30d91d9fa20a47d12152c5d7e31923e35b103bba6c82917088e889293125a5df`
and tracked diff SHA-256
`d77a5cbf567c69135fbc48a7e39b5b2daf22b57ce63512647d4348c860e7733d`
were unchanged. Node v26.9.0, Chrome 153.0.8010.52 and external Playwright 1.62.1
ran this parent check. No independent review ran.

Installed Playwright's full-page sizing waits for both document body and root,
after font readiness. This supports the SVG XML/body-dependent sizing diagnosis;
that parent's unsaved content type/body state was later measured in `Qku3Ld`.
The bounded-capture correction uses one finite `fullPage: false` viewport
screenshot, with measured whole-root coverage, at most one viewport expansion,
8,192-pixel side/16,777,216-pixel area limits and a 5,000 ms timeout. Both
standalone paths persist observations before capture, verify actual PNG file
dimensions before reporting retention, and preserve the original error without
a second failure screenshot. Independent-page cleanup remains intact.

The bounded-capture follow-up started clean at `5f357d1`, preserving the
committed runner changes. Its focused saved-SVG reproduction stopped during
Chrome launch with SIGABRT (`kill EPERM` during cleanup), before navigation, so it provides no new
body measurements, PNG, autoDim outcome or App acceptance. See
[SVG export verification](./PREVIEW_UI.md#export-svg),
`/private/tmp/stz-31e-bounded-capture/native-reproduction.json` and
`/private/tmp/stz-31e-bounded-capture/handoff.json` for historical child results and
checkout identity. This restriction is distinct from the parent screenshot
timeout and historical child Vite startup failure. Production/fixture/oracle
semantics, snapshot/raw-source/history behavior, conversion limits, diagnostics,
negative controls, 31D regressions and runner gates are preserved.

That child verification used Node v26.9.0/npm 11.19.1: 128 focused tests
(including 13 new registered helper tests) and all 2,403 full-suite tests passed
with no failures or skips. Build exited 0 with the existing chunk-size warning;
strict fixture TypeScript, eight syntax checks, targeted ESLint and diff checks
also exited 0. Commands, statuses and logs are recorded in
`/private/tmp/stz-31e-bounded-capture/checks.json`. These child-only results
precede the executed parent result below; they are not new correction results.

The historical parent report, `stz-phase31e-before-review-Qku3Ld/verification.json`
under `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/`, is failed/partial
before independent review. Node v26.9.0, Chrome 153.0.8010.52, external
Playwright and Vite at `http://127.0.0.1:5174` ran tests (2,403), build, diff and
label-assets checks successfully; free-label acceptance exited 1. Ten groups
and 120 scenario records passed without page errors, including autoHide, but
autoDim failed the foreground namespace assertion. Its root/owner namespaces
and XML parsing passed. The eleventh group is incomplete; remaining policies,
invalid-viewport retry and actual App download/reopen were not reached.
Revision `5f357d1b186302fda951ff073f2e32c68a34b2ce` plus four tracked changes and
two untracked capture files were unchanged, with fingerprint
`1cfe1d338e653e6040d1922168cc25607c68778f4e6b651cb1989103aa35a80c`.

Both visibility captures saved verified 1100×850 standalone PNGs, covering a
900×700 SVG root. Native observations show `image/svg+xml`, no HTML body,
valid SVG namespace, no parser errors, no external requests and no page errors.
AutoDim source `$\frac{autoDim}{x}$` settled `success`/`ready` in 137 ms within
10,050 ms, with eight math paths and a rectangle at captured effective opacity
`0.24499999999999997`. Its selected detached node is nevertheless only a title
before sanitization; its 472-byte final SVG has no formula foreground/bounds.
The `05-check-free-labels/artifacts/settled-export-autoDim-completed*` SVG/JSON
files, both policies' `-standalone.json`/`.png` files, and failure diagnostics
retain this evidence. Successful image capture is not foreground verification.

The confirmed historical production defect was HTML-context React server
rendering in `prepareSettledSvgExport()`: React DOM 19.2.7 hoists the label title before its
group, and the post-render XML wrapper's first-child extraction retains only
that title. `renderSettledSvgLabelDocument()` now renders the shared view inside
an actual React SVG parent. `extractSettledSvgLabel()` validates the SVG root,
single direct label group, namespace, captured source/request/owner/state and
required title/paint/foreground/halo/run structure before replacement. It retains
raw-source text, layout, paint, foreground and inline halo, and fails preparation
on invalid structure; empty/zero-label exports remain valid. The wrapper does
not survive as a nested viewport. Whole-render-string assertions could not
detect the old subtree loss. The older `r43lZG` output remains unavailable, so
this confirmed `Qku3Ld` cause does not establish every detail of that older run.

New Node regressions reproduce installed React title hoisting and exercise the
production SVG-context renderer. The native `settledSvgBoundaryFixture.ts`
regression exercises real preparation and final XML, including literal/inline
labels, chosen/replaced subtrees, captured owners and malformed-structure
controls against valid foreground geometry. The SVG-context correction child's
Chrome launch stopped with SIGABRT (`kill EPERM` during cleanup) before any page.
Its startup evidence is `/private/tmp/stz-31e-svg-boundary/browser-startup.log`;
checkout identity and command results are in that directory's `handoff.json`.
That restriction is separate from the subsequent parent execution below.

SVG-context correction child verification from revision
`d1b72b3240177dfa368b43255ca07fd5738e3920` used Node v26.9.0/npm 11.19.1 with
`/opt/homebrew/bin` first in `PATH`: 130 focused tests and 2,405 full-suite tests
passed, with none failed or skipped; the focused tests are included in the full
total. Build exited 0 with the existing chunk-size warning. Strict fixture
TypeScript, targeted ESLint including the new fixture, eight script syntax
checks and diff checks exited 0. The added two Node regressions are in the
existing registered export test; no dependency or package registration changed.
Exact commands, statuses and logs are retained under
`/private/tmp/stz-31e-svg-boundary/`, with final checkout identity in
`handoff.json`. These child checks precede the latest parent run and do not
replace complete native verification or independent review.

The latest parent report, `stz-phase31e-before-review-t7U6g3/verification.json`
under `/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/`, is failed/partial
before review. It verified unchanged revision `d1b72b3240177dfa368b43255ca07fd5738e3920`
plus five tracked modifications and the untracked boundary fixture, fingerprint
`8eaf530b72fe06ff821eeb4e173e6abff5559bdfaa52f59aba68870189ad235b`.
Node v26.9.0, Chrome 153.0.8010.52, external Playwright and the Vite fixture at
`http://127.0.0.1:5174` passed tests (2,405, no failures/skips), build, diff and
label-assets checks. Free-label acceptance exited 1 after ten completed groups
and 120 passing records, with no page errors. AutoHide passed. AutoDim's exact
source, SVG root/label/foreground namespace, eight foreground paths and finite
positive bounds (approximately 73.5561×29.8807) passed after standalone reopening.
Its complete 6,176-byte SVG and verified 1100×850 PNG retain the repaired formula;
settlement was `success`/`ready` in 148 ms within 10,050 ms. Both policies saved
PNGs with full 900×700 root coverage and no external requests or browser errors.

AutoDim then failed `assert.equal(reopened.opacity, capture.opacity)`: captured
`0.7 * 0.35` and the detached/serialized raw attribute are
`0.24499999999999997`; the native computed-style ancestor product is `0.245`.
The absolute difference is `2.7755575615628914e-17`, a numeric representation
mismatch rather than a demonstrated dimming defect. Observations remain in the
parent's `05-check-free-labels/artifacts/` directory. Later autoDim detached/
oracle assertions, remaining policies, invalid-viewport retry, the native
boundary fixture and actual App downloads/reopens did not execute in this run.
`unexecuted: []` identifies started groups and cannot establish those checks.

The follow-up harness helper `scripts/standaloneSvgOpacity.mjs` first requires
numeric finite `[0, 1]` values, then accepts an absolute difference at most
`1e-12`. It retains captured opacity as the independent expectation and native
computed-style ancestor multiplication
as the observed rendering. Raw-attribute checks remain exact; model values,
production arithmetic, serialization and discrete contracts are unchanged.
Focused opacity controls accept the reported pair and exact zero/one, while
rejecting missing/non-numeric/non-finite/out-of-range values, missing dimming
(`0.7`/`1`), doubled dimming (`0.08575`), zero/nonzero errors and `2e-12`/`1e-10`
drift in either direction. The four helper tests are registered in `npm test`.
This tight bound covers the observed representation error without concealing
material defects; a larger native mismatch must be investigated separately.
The independent exact-source geometry controls, native boundary regression,
screenshot ownership/coverage and failure handling remain required.

The opacity correction child used Node v26.9.0/npm 11.19.1 with the required
`PATH`, from revision `4c1dd9faeca926cbbda81edb57f82ebe89fb26a1`. All 134 focused
tests passed within the 2,409 passing full-suite tests, with no failures/skips.
Build (existing nonblocking chunk-size warning), strict fixture TypeScript,
targeted ESLint including the helper and tests, ten syntax checks and diff
checks exited 0. Command logs and final checkout identity are retained in
`/private/tmp/stz-31e-opacity-comparison/`, including `handoff.json`. These are
child results; fresh browser verification remains assigned to the outer parent.

The normal order remains fix, matching complete parent verification, then
independent review. `check:free-labels` still requires all eleven groups for
31E/31F, including all four visibility policies, invalid-viewport retry, native
boundary controls and downloaded transparent/white 2D/3D files reopened outside
the application. Neither partial `t7U6g3` nor historical `Qku3Ld` verifies this
opacity correction. The remaining standalone workflow and failure/retry gates
require fresh complete evidence; Phase 31E must not be called complete until
verification and independent review succeed. Phase 31F remains deferred.

The exporter captures a detached copy of the committed SVG and immutable label
inputs before awaiting conversion. A shared synchronous label view renders the
settled results into that copy before sanitization; React commit timing cannot
leave successful labels pending in the file. One export runs at a time while
editing remains available. See [SVG export](./PREVIEW_UI.md) for behavior.

- Capture one consistent click-time diagram/view/options snapshot, settle its
  visible labels, and render a detached export without interrupting live edits.
- Export successful labels as typeset SVG and failed labels as complete captured
  source. Never mix snapshot revisions or serialize a successful label before
  its settled result is represented.
- Preserve self-contained geometry, colors, outlines, literal whitespace,
  transparent/white backgrounds, and editor-only exclusions after sanitization.
- Bound export waiting and verify downloaded SVGs by reopening them outside the
  application, including mixed success/failure labels and a 3D view.

### Phase 31F: Combined regression coverage, documentation, and completion audit

Status: planned.

- Verify A-E together across errors/recovery, rapid edits, lifecycle changes,
  cache reuse, placement/picking, 2D/3D visibility, and snapshot export.
- Verify unchanged source persistence and TikZ output; register new tests in the
  explicit test script and run tests, build, and browser/export checks.
- Update Preview help, specification, and roadmap with the actual supported
  subset and limits. Record unavailable required checks as unresolved rather
  than marking the phase complete without evidence.
