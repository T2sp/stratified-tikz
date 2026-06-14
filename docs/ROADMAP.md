# Roadmap

## Phase 0: Project setup

Status: in progress

Tasks:

- Create Vite + React + TypeScript app
- Initialize Git repository
- Add project documentation
- Push to GitHub

## Phase 1: Pure data model

Goal:

Implement the internal diagram data model with support for both 2D and 3D ambient modes.

Tasks:

- Define `AmbientDimension = 2 | 3`
- Define `Vec2`, `Vec3`
- Define `Camera2D`, `Camera3D`
- Define `Diagram`
- Define codimension-based strata
- Define `EditorState`
- Define `CoordinateInputMode = "direct" | "cursor"`
- Define `WorkPlane`
- Implement constructors:
  - `createEmptyDiagram({ ambientDimension })`
  - `createPointStratum({ ambientDimension, ... })`
  - `createCurveStratum({ ambientDimension, ... })`
  - `createSheetStratum(...)`
- Implement validation:
  - `validateDiagram(diagram)`

Add explicit style data types.

Tasks:

- Define `HexColor`
- Define `Opacity`
- Define `RegionStyle`
- Define `SheetStyle`
- Define `CurveStyle`
- Define `PointStyle`
- Define `LineStyle`
- Define `PointShape`
- Define `PointFill`
- Replace `styleId` fields with explicit `style` objects
- Add default styles:
  - `defaultRegionStyle`
  - `defaultSheetStyle`
  - `defaultCurveStyle`
  - `defaultPointStyle`
- Add style validation rules

Supported MVP style features:

- custom colors
- opacity
- sheet fill and stroke styles
- curve line width
- curve line style
- point shape
- point fill mode
- point size


Add support for first-class free text labels.

Tasks:

- Define `TextLabel`
- Define `LabelStyle`
- Define `LabelAnchor`
- Add `labels: TextLabel[]` to `Diagram`
- Implement `createTextLabel`
- Validate label positions and label styles
- Do not automatically wrap label text in `$...$`

No UI in this phase.

## Phase 2: Geometry and projection

Goal:

Implement projection between model coordinates and screen coordinates.

Tasks:

- Implement `projectVec3`
- Implement `screenToModel2D`
- Implement `screenToModelOnWorkPlane`
- Implement coordinate normalization for 2D mode
- Add tests for 2D projection
- Add tests for 3D orthographic projection
- Add tests for cursor input on xy, xz, and yz work planes

## Phase 3: TikZ generator

Goal:

Generate readable TikZ source from both 2D and 3D diagrams.

Tasks:

- Implement `generateTikz(diagram: Diagram): string`
- Dispatch to:
  - `generateTikz2D(diagram)`
  - `generateTikz3D(diagram)`
- In 2D mode:
  - emit codim 1 curves
  - emit codim 2 points
- In 3D mode:
  - emit codim 1 sheets
  - emit codim 2 curves
  - emit codim 3 points
- Add tests for both modes
- Ensure TikZ output does not depend on coordinate input mode


The TikZ generator should preserve explicit style values.

Tasks:

- Emit deterministic `xcolor` color definitions
- Emit sheet fill and stroke styles
- Emit curve stroke color, opacity, line width, and line style
- Emit point shape, fill mode, opacity, and size
- Add tests for custom colors
- Add tests for curve line styles
- Add tests for point shapes
- Add tests for hollow point variants

The TikZ generator should emit free text labels as:

```tex

\node at (#1) {#2};

```

Tasks:

- Emit 2D label coordinates as `(x,y)`
- Emit 3D label coordinates as `(x,y,z)`
- Preserve user-provided label text
- Support label style options when non-default
- Add tests for plain text labels
- Add tests for math labels such as `$F^{(1)}L$`

## Phase 4: Static SVG preview

Goal:

Render sample 2D and 3D diagrams.

Tasks:

- Create `src/examples/twoDimensionalExample.ts`
- Create `src/examples/threeDimensionalExample.ts`
- Create `SvgDiagram` component
- Render codim 1 curves in 2D
- Render codim 2 points in 2D
- Render codim 1 sheets in 3D
- Render codim 2 curves in 3D
- Render codim 3 points in 3D
- Render labels
- Sort by layer

No editing in this phase.

## Phase 5: Basic UI

Goal:

Show preview and generated TikZ side by side.

Tasks:

- Add main layout
- Add 2D / 3D mode selector for new diagrams
- Add coordinate input mode selector:
  - direct
  - cursor
- Add TikZ source panel
- Add copy-to-clipboard button
- Add sample diagram selector

- Add a label tool to the toolbar. The label tool should allow:
    - cursor placement of a label
    - direct coordinate editing of a label
    - editing label text
    - editing label style

## Phase 6: Selection and inspector

Goal:

Allow users to select and edit existing strata.

Tasks:

- Click to select stratum
- Show selected stratum in inspector
- Edit name
- Edit label
- Edit style
- Edit layer
- Edit coordinates numerically
- In 2D mode, hide or lock z-coordinate
- In 3D mode, expose x, y, z coordinates

The inspector should allow users to edit style values.

For sheets:

- fill color
- fill opacity
- stroke color
- stroke opacity

For curves:

- stroke color
- stroke opacity
- line width
- line style

For points:

- color
- opacity
- shape
- filled / hollow
- size

The UI may provide style presets, but presets should only update explicit style values in the model.

The saved diagram should not depend on preset definitions.

When a free text label is selected, the inspector should expose:

- name
- text content
- x coordinate
- y coordinate
- z coordinate, only in 3D mode
- text color
- opacity
- font size
- anchor
- layer

The text content should be treated as raw LaTeX/TikZ label content.

The app should not automatically add `$...$`.


## Phase 7: Cursor-based creation tools

Goal:

Allow users to create diagram elements graphically.

Tasks:

- Add codim 3 point tool in 3D mode
- Add codim 2 point tool in 2D mode
- Add codim 2 curve tool in 3D mode
- Add codim 1 curve tool in 2D mode
- Add codim 1 sheet tool in 3D mode
- Add label tool
- Add work plane selector for 3D cursor input

## Phase 8: Save and load

Goal:

Allow persistence of diagrams.

Tasks:

- Export JSON
- Import JSON
- Store current diagram in local storage

## Later phases

Possible future features:

- curve visibility segmentation
- hidden-line support in preview
- automatic layer suggestions
- sheet templates
- ambient box templates
- TikZ macro mode
- LaTeX/PDF preview
- basic source/target consistency checks
- movie move templates
- 2D-to-3D embedding
- 3D-to-2D projection