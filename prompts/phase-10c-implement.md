# Implement Phase 10C: Direct-input creation for paths and sheets

Implement Phase 10C only.

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
Add direct-input creation for path-like strata and polygon sheets, building on Phase 10B direct-input creation.

Required behavior:
1. Supported direct-input creations:
   - Polyline curve creation by entering a list of vertices.
   - Cubic Bézier curve creation by entering start, control point 1, control point 2, and end.
   - 3D polygon sheet creation by entering polygon vertices.

2. Ambient/codim behavior:
   - 2D polyline/cubic Bézier curves: codim 1, z=0.
   - 3D polyline/cubic Bézier curves: codim 2.
   - 3D polygon sheets: codim 1.
   - Do not create polygon sheets in 2D unless the existing model explicitly supports 2D regions; Phase 14 handles 2D regions later.

3. Input format:
   - Choose a simple, explicit MVP UI.
   - Accept either structured rows or a simple text format, whichever fits existing UI better.
   - Must be clear to users how to enter points.
   - Invalid rows should not create invalid geometry.

4. Validation:
   - Reuse finite-number parsing and geometry validation helpers.
   - Polyline requires at least 2 vertices.
   - Cubic Bézier requires exactly 4 points.
   - Polygon sheet requires at least 3 finite vertices.
   - In 2D, normalize z to 0.
   - Reject NaN/Infinity.

5. Defaults:
   - Use same default names/styles/layers/id generation as cursor-created polyline, cubic Bézier, and polygon sheet tools.
   - Created element should be selected after creation.

6. Existing cursor creation:
   - Do not regress cursor polyline, cubic Bézier, point, label, or sheet creation.
   - Draft behavior remains preview-only and not exported.

7. TikZ/SVG:
   - Direct-created curves/sheets should render and export exactly like normal model elements.
   - Preserve Phase 9A coordinate naming.
   - Preserve Phase 9B layer-aware output and ordering convention.
   - Preserve Phase 9D `spath/save` behavior if already implemented.

8. Tests:
   Add tests for:
   - direct-created 2D polyline normalizes z=0 and codim 1;
   - direct-created 3D polyline has codim 2;
   - cubic Bézier requires exactly 4 finite points;
   - 3D polygon sheet requires at least 3 finite vertices;
   - invalid numeric input does not create geometry;
   - created elements are compatible with TikZ generation.

9. Docs:
   Update user-facing docs or roadmap.

Out of scope:
- 2D codim-0 regions
- arbitrary/custom work planes
- drag editing
- concatenated paths beyond existing polyline/cubic types
- cross-work-plane concatenated paths
- undo/redo
- new dependencies

Report after implementation:
- files modified
- direct-input UI chosen
- validation behavior
- created element defaults
- 2D/3D behavior
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

