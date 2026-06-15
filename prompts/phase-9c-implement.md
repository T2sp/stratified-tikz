# Implement Phase 9C: Layer-based selection and filtering

Implement Phase 9C only.

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
Add editor-only layer-based selection/filtering controls so users can focus on specific numeric layers, especially in 3D overlapping diagrams.

Required behavior:
1. Add a layer filter UI state.
   - The filter must be UI/editor state only.
   - Do not add it to `Diagram`.
   - It should reset safely when loading or switching examples if needed.

2. Layer filter options:
   - `All layers` option.
   - Specific numeric layers present in the current diagram.
   - Include layers used by strata and free text labels.
   - Sort layer options numerically.

3. Preview behavior:
   - When `All layers` is selected, current behavior remains unchanged.
   - When a specific layer is selected, elements on that layer remain normally visible/selectable.
   - Elements outside the selected layer should be visually de-emphasized or hidden. Choose the simplest UX consistent with existing preview architecture.
   - If de-emphasized, they should not be confused with selected/highlighted elements.

4. Selection behavior:
   - In a specific layer filter mode, elements outside the selected layer should not be selectable by clicking.
   - Existing selected element should be cleared if it becomes incompatible with the selected layer.
   - Background click should still clear selection.

5. Labels:
   - Free text labels have layers and should participate in the layer filter.
   - Labels outside the selected layer should follow the same visibility/selectability policy as strata.

6. Creation tools and drafts:
   - Do not implement new creation tools in this phase.
   - Existing creation tools should still work.
   - If a specific layer is selected, do not silently mutate unrelated diagram data.
   - Prefer keeping creation behavior simple and predictable. If the current layer should affect new element layer, document the behavior and test it. Otherwise preserve existing default creation layer behavior.

7. TikZ output:
   - Do not change generated TikZ semantics.
   - Layer filter/highlighting/selection must not affect TikZ.
   - Preserve Phase 9A coordinate naming.
   - Preserve Phase 9B layer-aware output and ordering convention.

8. Tests:
   Add focused tests where appropriate. Prefer pure helper tests if UI interaction testing is already limited. Cover:
   - deriving sorted available layers from strata and labels;
   - filtering/selectability decision for strata and labels;
   - clearing or preserving selection when layer filter changes;
   - TikZ output unaffected by layer filter, if there is a helper boundary to test.

9. Docs:
   Update relevant docs, likely `ROADMAP.md` or a UI/TikZ/data-model doc if present. Document that layer filtering is editor-only and not exported/saved as diagram data.

Out of scope:
- `spath/save`
- remove/delete selected elements
- direct-input creation
- drag editing
- custom work planes
- concatenated paths
- 2D region strata
- 3D curved-boundary sheets
- save/load format changes unless strictly necessary for compatibility
- new dependencies

Report after implementation:
- files modified
- UI state shape added
- how available layers are derived
- behavior for visibility and selectability
- behavior when selected element is outside the active layer
- behavior for labels
- confirmation that TikZ output is unaffected
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

