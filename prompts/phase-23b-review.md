# Phase 23B Review Prompt: Toolbar palette exclusivity and Add path menu simplification

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

Phase 22 is complete or near complete.

The editor now supports:

- preview-centered UI;
- floating toolbar inside SVG/PGF Preview;
- direct input drawer;
- inspector drawer;
- layer palette/window;
- camera controls;
- examples and JSON load/save;
- 2D/3D diagrams;
- paths with arrows;
- braiding/string-diagram crossings;
- custom work planes;
- symbolic variables;
- grids/lattices;
- sheets, filled regions/sheets, curved surfaces, ruled surfaces, Coons patches;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- save/load;
- undo/redo.

Phase 23 is a UI refinement phase.

The user wants three groups of changes:

1. Example bar placement and content.
2. Toolbar palette behavior and Add path menu simplification.
3. Camera UI relocation below the Preview and slider-based controls.

Important constraints:

- This is primarily UI/layout work.
- Do not change diagram geometry semantics.
- Do not change TikZ generation semantics unless required by an example asset integration.
- UI open/closed state should remain editor/UI state, not diagram data.
- Preserve all existing creation/editing behavior.
- Preserve save/load, undo/redo, SVG preview, TikZ source generation, camera/work-plane/layer/style/variable/grid/braiding behavior.
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

Phase 23B should ensure only one toolbar palette is open at a time and simplify the Add path palette.

## Review checklist

Check:

- only one palette can be open;
- opening a palette closes previous palette;
- clicking active palette toggles closed;
- Add path has one Direct input item;
- direct drawer still exposes path direct options;
- Add path buttons are visually distinguishable;
- Fill paths visibility remains Select/Add path only;
- palette state is UI-only;
- existing creation tools still work;
- overlay clicks do not create canvas objects.

Medium issues include:

- multiple palettes remain open;
- direct path functionality becomes inaccessible;
- Add path options disappear;
- Fill paths visible in wrong modes;
- toolbar becomes taller/more cluttered.

Run verification commands and report results.
