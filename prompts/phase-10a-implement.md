# Implement Phase 10A: Remove selected elements

Implement Phase 10A only.

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
Allow users to remove the currently selected stratum or free text label from the diagram.

Required behavior:
1. UI affordance:
   - Add a clear remove/delete control for the current selection.
   - It may be in the toolbar or inspector.
   - Disable or hide it when nothing is selected.
   - Use conservative wording such as `Remove selected`.

2. Keyboard shortcut, if simple:
   - Support Delete / Backspace only if it is safe with focused form inputs.
   - Do not delete elements while the user is typing in an input/textarea/select.
   - If this is not simple, skip keyboard shortcut and document that it is future work.

3. Data update behavior:
   - Removing a selected stratum removes it from `diagram.strata`.
   - Removing a selected free text label removes it from `diagram.labels`.
   - After removal, selection becomes null.
   - Draft creation state should be cancelled or left safe if necessary.

4. Safety:
   - No crash when selection is stale.
   - No crash when selected id is missing.
   - No accidental deletion of multiple elements.
   - No deletion of editor-only work-plane preview/draft geometry.

5. TikZ/SVG:
   - Removed elements should disappear from SVG preview.
   - Removed elements should disappear from generated TikZ.
   - Selection/highlighting remains preview-only and not exported.

6. Tests:
   Add helper tests for:
   - remove selected stratum by id;
   - remove selected label by id;
   - stale selection no-op or safe behavior;
   - selection cleared after removal if helper covers state;
   - TikZ no longer includes removed element if practical.

7. Docs:
   Update user-facing or roadmap docs if appropriate.

Out of scope:
- undo/redo
- multi-select
- confirmation dialogs unless trivial
- direct-input creation
- drag editing
- layer filter changes
- spath/save changes
- custom work planes
- new geometry features

Report after implementation:
- files modified
- UI control added
- data update helpers added/modified
- stale selection behavior
- keyboard shortcut behavior, if any
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

