# Implement Phase 10B: Direct-input creation MVP for points and labels

Implement Phase 10B only.

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
Add direct numeric-input creation for point strata and free text labels. This complements cursor creation.

Required behavior:
1. UI mode:
   - Use the existing coordinate input mode concept if present.
   - Direct-input creation should be editor/UI state only.
   - Do not store direct-input form state in `Diagram`.

2. Create point by direct input:
   - User can enter coordinates and create a point.
   - In 2D, show/edit x and y only; z must be 0.
   - In 3D, show/edit x, y, z.
   - Created point uses existing point defaults:
     - `geometricKind: "point"`
     - codim 2 in 2D, codim 3 in 3D
     - default style/layer/name/id policy consistent with cursor-created points
   - Created point is selected after creation.

3. Create label by direct input:
   - User can enter label text and coordinates.
   - In 2D, z is 0 and hidden.
   - In 3D, x/y/z are editable.
   - Created label is added to `diagram.labels`.
   - Default text can be `Label` if blank input is rejected or normalized; choose the safer existing convention.
   - Created label is selected after creation.

4. Numeric validation:
   - Reuse existing finite-number parsing helpers if available.
   - Reject or safely ignore invalid/non-finite numeric inputs.
   - Do not create elements with NaN/Infinity.
   - Do not crash on blank fields.

5. Existing cursor creation:
   - Do not regress cursor point/label creation.
   - Do not change polyline/Bezier/sheet creation behavior.

6. Layer behavior:
   - Use the existing default layer policy for new elements unless a clear current-layer policy already exists.
   - Do not couple direct creation to Phase 9C filter unless that behavior is already intentionally implemented and tested.

7. TikZ/SVG:
   - Direct-created points/labels should render in SVG and TikZ just like cursor-created ones.
   - Preserve Phase 9A/9B output conventions.

8. Tests:
   Add tests for:
   - direct-created 2D point has z=0 and codim 2;
   - direct-created 3D point preserves z and codim 3;
   - direct-created label added to `diagram.labels`;
   - invalid numeric input does not create invalid geometry;
   - TikZ output for direct-created elements matches normal model behavior if helper-level test is practical.

9. Docs:
   Update user-facing docs or roadmap.

Out of scope:
- direct-input creation for curves or sheets
- drag editing
- remove/delete changes
- spath/save changes
- custom work planes
- concatenated paths
- region strata
- save/load format changes
- new dependencies

Report after implementation:
- files modified
- UI/direct-input state added
- point direct creation behavior
- label direct creation behavior
- validation behavior
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

