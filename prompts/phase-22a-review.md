# Phase 22A Review Prompt: Path arrow data model and TikZ option generation

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Also run if available:

```bash
git diff --check
```
## Project context

You are working on the StratifiedTikZ project.

Phase 21 is complete.

The editor now supports:

- 2D and 3D diagrams;
- preview-centered UI;
- paths, path templates, arc/circle/ellipse, sheets, filled regions/sheets, ruled surfaces, Coons patches, curved surfaces;
- symbolic variables and coordinate expressions;
- grid/lattice generation;
- custom work planes;
- camera controls;
- layer manager;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo;
- SVG preview and TikZ generation.

Phase 22 adds:

1. Arrow options for 2D and 3D paths.
2. Mid-segment arrow decorations, similar to TikZ `decorations.markings`.
3. Path direction reversal.
4. 2D-only braided monoidal category string-diagram crossing controls:
   - detect path intersections;
   - click an intersection to toggle:
     - no braiding;
     - braiding;
     - anti-braiding;
   - avoid relying on the TikZ `knot` package because it tends to conflict with decorations.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI overlay/draft state should not be stored in `Diagram`.
- Arrow/braiding data that affects TikZ output should be persisted.
- Generated TikZ must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve save/load, undo/redo, symbolic input, grid output, style manager, camera, work-plane, layer manager, and all existing geometry behavior.
## Review instructions

Review this subphase only.

Do not modify files.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.

If only Low-priority issues remain, set `"ready_to_commit": true`.

Use this human-readable structure:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call This Subphase Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt.
```

Then output exactly:

```text
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
```

Rules:

- counts must be numbers;
- `summary` must be `"pass"` or `"needs_changes"`;
- `ready_to_commit` must be false if Critical or Medium issues exist;
- `suggested_fix_prompt` should be targeted if fixes are needed.


## Goal under review

Phase 22A should add a robust arrow option data model and TikZ option generation for endpoint and mid-segment arrow decorations.

## Review checklist

Check:

- arrow data model exists;
- defaults preserve old diagrams;
- default mid-arrow position is 0.5;
- default head is `\arrow{>}`;
- configured heads include Stealth/Latex/harpoons;
- invalid positions/head kinds rejected;
- TikZ markings output valid-looking;
- required libraries handled;
- inline output no blank lines;
- numeric/path output without arrows unchanged.

Medium issues include:

- old diagrams fail to load;
- invalid arrow options accepted;
- generated TikZ missing required libraries;
- mid-arrow syntax broken;
- inline blank lines reintroduced.

Run verification commands and report results.
