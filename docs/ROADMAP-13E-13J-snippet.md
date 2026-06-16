# ROADMAP update snippet for Phase 13E-13J

Append or replace the camera-related portion of Phase 13 with the following.

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
