# Phase 13D Review Prompt: Coordinate source highlighting

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

Phase 13D should highlight selected coordinate sources in SVG preview for direct creation and Pick 3 points for work plane.

## Review checklist

Check:

- direct-selected point sources are highlighted;
- direct-selected polyline vertex sources are highlighted;
- direct-selected sheet vertex sources are highlighted;
- optional Bézier source highlights work if supported;
- Pick 3 work-plane points are highlighted, preferably numbered;
- reset/cancel clears picking highlights;
- highlights are preview-only;
- highlights are not selectable;
- highlights do not intercept pointer events;
- highlights are not exported to TikZ;
- highlights are not saved to JSON;
- highlights are visually distinct from selection, handles, and work-plane guides;
- invalid/missing sources do not crash;
- layer/filter behavior is understandable.

Medium issues include:

- no visible highlight for selected direct sources;
- highlights exported to TikZ;
- highlights stored in diagram JSON;
- highlights intercepting clicks;
- work-plane point picking highlights missing or stale.

Run verification commands and report results.
