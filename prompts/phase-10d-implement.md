# Implement Phase 10D: Cursor drag editing MVP for selected geometry handles

Implement Phase 10D only.

Project context:
- Project: StratifiedTikZ, Vite + React + TypeScript.
- Mathematical convention: n-stratum means codimension n, not dimension.
- Supports 2D diagrams in R^2 and 3D diagrams in R^3.
- `ambientDimension: 2 | 3` is top-level on `Diagram`.
- Internally all coordinates are `Vec3`.
- In 2D, z is hidden/locked/ignored and should stay 0.
- Coordinate input mode, selection state, filters, drafts, and other editor-only UI state must not be stored in `Diagram` unless this prompt explicitly says otherwise.
- Generated TikZ should reflect diagram data only; preview-only UI state such as selection/highlighting/filtering/drafts must not affect TikZ.

Existing completed phases:
- Phase 9A: TikZ coordinate-name stems use sanitized stratum names and preserve polyline/Bezier distinctions.
- Phase 9B: TikZ output is layer-aware using deterministic `pgfonlayer` blocks.

Important Phase 9B ordering convention:
- TikZ layer blocks are ordered by numeric layer value.
- Within each layer block, commands are intentionally organized by codimension / element-kind section order for readability.
- Within each codimension / element-kind section, original diagram order is preserved.
- Do not treat cross-kind same-layer section ordering as a bug.
- Do not change this convention unless explicitly requested.

Goal:
Add MVP cursor drag editing for selected geometry handles in the SVG preview.

Required behavior:
1. Supported drag handles:
   - Selected point stratum position.
   - Selected free text label position.
   - Selected curve vertices/control points:
     - polyline vertices
     - cubic Bézier start/control1/control2/end
   - Selected polygon sheet vertices, if practical.

2. Handle visibility:
   - Show drag handles only for the selected element.
   - Handles are preview/editor UI only.
   - Handles must not be saved to `Diagram`.
   - Handles must not appear in generated TikZ.

3. Drag behavior:
   - 2D: dragging updates x/y and keeps z=0.
   - 3D: dragging updates coordinates on the active work plane if consistent with existing cursor placement model.
   - For 3D xy/xz/yz work planes, convert screen movement to model coordinates on that plane.
   - Do not introduce arbitrary/custom work planes in this phase.

4. Data updates:
   - Use immutable update helpers.
   - Preserve element ids, names, styles, layers, codim, and geometry kind.
   - For cubic Bézier, preserve role order: start, control point 1, control point 2, end.
   - For polygon sheets, preserve vertex order.

5. Interaction safety:
   - Avoid conflict with element selection clicks.
   - Background click still clears selection when not dragging.
   - Dragging should not accidentally create new elements.
   - Dragging should not trigger inspector text inputs.
   - Handle stale selection safely.

6. Layer filter interaction:
   - If Phase 9C layer filter is present, only selected/visible layer elements should expose handles.
   - Do not allow dragging hidden or filtered-out elements.

7. TikZ/SVG:
   - Updated geometry should immediately reflect in SVG and generated TikZ.
   - Selection/handles/highlighting remain preview-only.
   - Preserve Phase 9A coordinate naming and Phase 9B layer output ordering convention.

8. Tests:
   Add helper-level tests where possible for:
   - updating selected point coordinates;
   - updating label coordinates;
   - updating polyline vertex coordinates;
   - updating cubic Bézier control point coordinates while preserving roles;
   - 2D drag/update normalizes z=0;
   - non-finite update rejected or made safe.

UI interaction tests are welcome if the project already has such tests, but do not introduce heavy new infrastructure.

9. Docs:
   Update user-facing docs or roadmap.

Out of scope:
- undo/redo
- snapping
- constraints
- multi-select
- arbitrary/custom work planes
- relative/polar Bézier editing
- new geometry features
- 2D regions
- new dependencies

Report after implementation:
- files modified
- supported drag handles
- 2D drag behavior
- 3D work-plane drag behavior
- immutable update helpers added/used
- interaction safety choices
- tests added/updated
- verification results

Environment:
The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

