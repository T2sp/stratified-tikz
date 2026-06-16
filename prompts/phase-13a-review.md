# Phase 13A Review Prompt: 3D coordinate axes guide

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

Phase 12 is complete.

The app now has:

- 2D and 3D diagrams;
- cursor creation and direct creation;
- custom work planes;
- work-plane-local Bézier support;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- UI/editor state should not be stored in `Diagram`.
- Preview-only guides and highlights should not be exported to TikZ unless explicitly requested by an export option.
- Generated TikZ must remain readable and should not include selection/editor-only state.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve save/load and undo/redo behavior.


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

Phase 13A should add a faint default `x`, `y`, `z` coordinate axes guide to 3D SVG preview, and a user option for including that guide in TikZ output.

## Review checklist

Check:

- 3D SVG preview shows a faint xyz axes guide;
- 2D preview does not show 3D axes;
- axes guide is preview-only unless export option is enabled;
- axes guide is not selectable;
- axes guide does not intercept pointer events;
- axes guide is visually distinct from work-plane guides and real strata;
- empty 3D diagrams show the axes guide and remain usable;
- TikZ export excludes axes by default;
- TikZ export includes axes when the user option is enabled;
- axes are not stored as a stratum;
- save/load behavior for the option is clear and tested if persisted;
- existing work-plane guide and custom plane behavior are not regressed;
- ordinary TikZ geometry/style/layer behavior is preserved.

Medium issues include:

- axes exported to TikZ unconditionally without user option;
- axes stored as ordinary strata;
- axes intercepting selection/creation clicks;
- 2D diagrams showing 3D axes;
- axes breaking existing TikZ output.

Run verification commands and report results.
