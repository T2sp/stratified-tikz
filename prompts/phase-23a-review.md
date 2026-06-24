# Phase 23A Review Prompt: Full-width Example bar and curated examples

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

Phase 23A should make the Example bar full-width and reduce examples to the curated requested set.

## Review checklist

Check:

- Example bar spans full width;
- no horizontal scroll required at normal desktop width;
- `Empty 2D` is default;
- order starts with `Empty 2D`, `Empty 3D`;
- only examples are `Empty 2D`, `Empty 3D`, `2D example`, `3D example`, `braiding`;
- attached 2D/3D JSON examples are integrated and load;
- braiding example still loads;
- existing example switching behavior preserved;
- layout remains usable on narrow screens.

Medium issues include:

- old extra examples remain in the main bar;
- default is not Empty 2D;
- Example bar still overflows horizontally;
- attached JSON examples fail to load;
- example switching corrupts state.

Run verification commands and report results.
