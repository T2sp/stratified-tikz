# Implement Phase 9D: `spath/save` integration for path labels

Implement Phase 9D only.

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
Add optional TikZ `spath/save=<name>` integration for path-like exported objects, controlled by diagram data fields that are explicit and editable.

Required behavior:
1. Data model:
   - Add an optional field for path labels / saved path names to path-like strata if not already present.
   - Suggested field name: `pathLabel?: string` or `spathSave?: string`. Choose the name consistent with the codebase.
   - Applies to:
     - polyline curves
     - cubic Bézier curves
     - polygon sheet boundaries, if appropriate for current TikZ output
   - Does not apply to point strata.
   - Labels in `diagram.labels` are free text labels and are not `spath/save` path labels.

2. Inspector UI:
   - Add an editable field for the optional path label on path-like strata.
   - Default empty.
   - Empty means no `spath/save` option is emitted.
   - Use safe string handling. Do not crash on blank/whitespace values.

3. TikZ output:
   - If the field is non-empty after trimming, emit `spath/save=<name>` in the TikZ path options for eligible path-like objects.
   - Preserve all existing style options and drawing geometry.
   - Do not emit `spath/save` for points.
   - Do not emit `spath/save` for free text labels.
   - Preserve Phase 9A coordinate names.
   - Preserve Phase 9B layer-aware output and ordering convention.

4. Sanitization:
   - Implement deterministic, TikZ-safe sanitization for `spath/save` names, or clearly reuse an existing TikZ-safe name sanitizer if appropriate.
   - Avoid producing invalid empty names.
   - Document the sanitization behavior.

5. Save/load:
   - If the field becomes part of diagram data, ensure JSON save/load preserves it.
   - Import validation should accept missing field for backward compatibility.
   - Invalid values should be rejected or normalized safely according to existing validation style.

6. Tests:
   Add tests for:
   - curve with empty path label emits no `spath/save`;
   - polyline curve with path label emits `spath/save=...`;
   - cubic Bézier curve with path label emits `spath/save=...`;
   - point stratum does not emit `spath/save`;
   - save/load or validation preserves/accepts the optional field if covered by existing tests;
   - sanitization edge cases if implemented.

7. Docs:
   Update `docs/TIKZ_OUTPUT.md` and data model docs if present. Clarify difference between:
   - free text labels (`diagram.labels`)
   - optional TikZ path labels / `spath/save` names for path-like strata

Out of scope:
- new path geometry
- layer selection/filter UI changes
- remove/delete
- direct-input creation
- drag editing
- custom work planes
- concatenated paths
- 2D region strata
- 3D curved-boundary sheets
- new dependencies unless the project already depends on the necessary TikZ library documentation only

Report after implementation:
- files modified
- data model field chosen
- inspector behavior
- TikZ output behavior
- sanitization behavior
- save/load compatibility
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

