# Review Phase 10C: Direct-input creation for paths and sheets

Do not modify files yet. Review the current implementation of Phase 10C only.

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

Phase 10C review scope:
- Verify direct-input path/sheet form state is UI/editor-only.
- Verify 2D curves normalize z=0 and have codim 1.
- Verify 3D curves have codim 2.
- Verify 3D polygon sheets have codim 1 and require at least 3 finite vertices.
- Verify cubic Bézier requires exactly 4 finite points.
- Verify invalid input cannot create NaN/Infinity geometry.
- Verify created elements use defaults consistent with cursor-created elements and become selected.
- Verify existing cursor creation behavior is not regressed.
- Verify TikZ/SVG treat direct-created paths/sheets normally.
- Verify no 2D regions, arbitrary work planes, drag editing, or unrelated features were implemented.

Review criteria:
- Identify Critical, Medium, and Low-priority issues.
- Critical: correctness bugs, data loss, broken build/tests, exported TikZ corruption, invalid model changes, or broad out-of-scope changes.
- Medium: missing required behavior, incomplete tests for core behavior, meaningful UX breakage, or scope leaks that should be fixed before calling the phase complete.
- Low: minor docs, naming, formatting, small edge-case coverage, or non-blocking improvements.
- Do not report intentionally preserved Phase 9B codimension / element-kind section ordering as a Medium issue.
- Confirm that UI/editor-only state is not saved to `Diagram` unless explicitly required.
- Confirm that selection/highlighting/filtering/drafts do not affect generated TikZ.

Required verification:
Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

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

Output format:
1. Human-readable review with sections:
   - Summary
   - Critical issues
   - Medium issues
   - Low-priority issues
   - What looks correct
   - Test results
   - Build results
   - Ready to call Phase 10C complete
   - Suggested targeted follow-up prompt, if needed

2. End with exactly one machine-readable JSON block:

REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END

Rules for JSON:
- `ready_to_commit` must be false if any Critical or Medium issues exist.
- `summary` should be `pass` only if Critical and Medium counts are both 0.
- `suggested_fix_prompt` should be concise but actionable if changes are needed.

