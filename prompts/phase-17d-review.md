# Phase 17D Review Prompt: Auto-detect color/style presets and SVG preview approximation

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
## Project context

You are working on the StratifiedTikZ project.

Phase 16 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, concatenated paths, path templates, sheets, filled regions/sheets, curved surface primitives;
- custom work planes;
- camera controls;
- layer-aware TikZ output;
- layer manager operations;
- save/load;
- undo/redo;
- style editing in the Inspector.

Current limitation:

- The Inspector Style section has presets, but they are not freely user-editable.
- Users want editable presets and imported TikZ style references.
- Users want to import style information from `.sty` / `.tex` files containing `\tikzset`.
- However, generated TikZ should **not** inline a large `\tikzset{...}` block before `\begin{tikzpicture}`.
- Imported external style files should be referenced by comments/instructions only.
- User-created local style presets added inside StratifiedTikZ should be defined as options of `\begin{tikzpicture}`, not as pre-picture `\tikzset`.

Important conventions:

- UI/editor state should not be stored in `Diagram`.
- Diagram-level style presets and imported style references may be saved if they affect export.
- Generated TikZ should remain readable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve camera, work-plane, layer manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.
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

Phase 17D should auto-detect useful presets from imported TikZ styles and approximate preview style for common options, while preserving external style references in TikZ output.

## Review checklist

Check:

- `/color/` styles detected;
- `/shape/` styles detected;
- imported presets displayed clearly;
- targets inferred safely;
- applying imported preset stores style key reference;
- preview approximation handles simple colors/opacity/line styles;
- unsupported options ignored for preview but preserved for export;
- TikZ output uses imported key;
- external load comments emitted;
- no full `\tikzset` inlined;
- no active `\input` emitted by default;
- user presets still work.

Medium issues include:

- imported styles inlined in output;
- detected preset cannot be applied;
- applying preset breaks SVG/TikZ;
- preview parser creates invalid style values;
- imported style key lost on save/load.

Run verification commands and report results.
