# Phase 13G Review Prompt: Camera-aware creation, picking, and drag editing

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

Phase 12 is complete. The app supports:

- 2D and 3D diagrams;
- axis-aligned and custom work planes;
- cursor creation and direct creation;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- selection, inspector, layer filtering, and style editing.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Camera/view state is editor/view state unless explicitly persisted as diagram view options.
- Camera/view state is not a stratum.
- Work planes remain model-space geometry.
- Projection/camera and work planes must remain separate concerns.
- Generated TikZ must remain readable.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware TikZ output.
- Preserve Phase 12 work-plane behavior.


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

Phase 13G should make all screen-to-model editing interactions camera-aware.

## Review checklist

Check:

- cursor creation uses camera-aware inverse mapping;
- drag editing uses camera-aware inverse mapping;
- active work planes remain model-space geometry;
- camera ray/intersection or equivalent orthographic inverse is used;
- initial camera behavior matches previous behavior;
- changed theta/phi still allows correct point/curve/sheet creation;
- created/drafted points lie on the active work plane;
- drag updates lie on the active work plane;
- no-intersection/parallel cases are handled safely;
- 2D behavior unchanged;
- undo/redo grouping for drag not regressed;
- TikZ output not changed in this subphase.

Medium issues include:

- creation still using old fixed projection after camera changes;
- drag handles moving geometry incorrectly after camera changes;
- invalid intersections creating NaN geometry;
- work-plane/camera concerns entangled incorrectly.

Run verification commands and report results.
