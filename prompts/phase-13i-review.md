# Phase 13I Review Prompt: TikZ camera/export alignment with tikz-3dplot

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

Phase 13I should make generated 3D TikZ output reflect the current camera orientation using tikz-3dplot-compatible `theta` / `phi` notation.

## Review checklist

Check:

- 3D TikZ output includes `\tdplotsetmaincoords{theta}{phi}`;
- values match current camera `thetaDeg` / `phiDeg`;
- `tikzpicture` uses `tdplot_main_coords`;
- 3D coordinates remain 3D and are not pre-flattened;
- changing camera changes generated TikZ orientation values;
- reset-to-initial restores initial TikZ camera values;
- 2D output does not include unnecessary 3D camera setup;
- package/library/comment policy is clear;
- layer-aware output preserved;
- coordinate names preserved;
- work-plane-local `canvas is plane` scoped export remains compatible;
- zoom/pan export policy is explicit and not misleading;
- axes guide export, if enabled, uses same camera.

Medium issues include:

- TikZ output not reflecting current camera theta/phi;
- pre-flattening coordinates destructively;
- missing required tikz-3dplot setup;
- 2D output polluted with 3D setup;
- reset camera not reflected in TikZ output.

Run verification commands and report results.
