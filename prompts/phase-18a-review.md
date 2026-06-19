# Phase 18A Review Prompt: TikZ export mode model and UI

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

Phase 17F is complete.

The editor now supports:

- 2D and 3D diagrams;
- many geometric object types;
- custom work planes;
- camera controls;
- layer manager;
- editable style presets;
- imported external TikZ style references;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

New requirement:

The user wants two TikZ export modes:

1. **Standalone mode**
   - This is the current/traditional mode.
   - Setup commands may appear before `\begin{tikzpicture}`.
   - Readability can use blank lines as before.

2. **Inline math mode**
   - Intended for use inside math environments such as `align`, for example:

```tex
\begin{align}
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
  &=
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
  \\
  &=
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
\end{align}
```

   - Each exported diagram is still its own independent `tikzpicture`.
   - All setup and drawing commands for a diagram should be inside that diagram's `tikzpicture`.
   - Inline math mode should not leave blank lines in the generated snippet, because blank lines can cause errors in `align` and other math environments.
   - Readability should be preserved using comment lines rather than empty lines.
   - The `tikzpicture` option should always include:

```tex
baseline={([yshift=-.5ex]current bounding box.center)}
```

Important existing export policies:

- External imported TikZ styles should not be inlined.
- External imported style files should be referenced by comments/instructions only.
- User-defined structured presets can be emitted as local style definitions.
- Phase 9B layer-aware output must remain valid.
- Phase 13I tikz-3dplot camera export must remain valid.
- Phase 17 custom/imported style export must remain valid.
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

Phase 18A should introduce TikZ export mode plumbing and UI for `standalone` vs `inlineMath`.

## Review checklist

Check:

- export mode model exists;
- standalone is default;
- UI selector exists;
- changing mode updates TikZ source;
- generator API receives mode;
- copy/download uses selected mode if applicable;
- mode does not mutate geometry;
- old diagrams load;
- standalone output unchanged;
- mode state persistence policy is clear.

Medium issues include:

- default output changes unexpectedly;
- mode stored as geometry;
- UI changes mode but generator ignores it;
- old diagrams fail to load.

Run verification commands and report results.
