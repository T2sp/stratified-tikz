# Phase 27B Review Prompt: Path inline nodes/vertices exported as `node[pos=..., ...]`

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

Also run:

```bash
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```
## Project context

You are working on the StratifiedTikZ project.

The editor now has mature core editing features:

- 2D and 3D diagrams;
- preview-centered UI;
- cursor and direct creation;
- coordinate anchors and coordinate references;
- symbolic variables;
- global and work-plane-local symbolic coordinates;
- cursor snapping;
- multi-selection and bulk editing;
- symbolic-aware translation;
- path concatenation;
- layer merge/translation;
- custom work planes and camera controls;
- paths with arrows;
- 2D braiding/string-diagram crossings;
- grids/lattices;
- points, labels, paths, sheets, filled regions/sheets, ruled surfaces, Coons patches, and curved surfaces;
- layer palette/window;
- style manager and imported TikZ style references;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math TikZ output with no blank lines;
- save/load;
- undo/redo.

Phase 27 is an interaction/editing polish phase.

Prioritized features:

1. Selection cycling for overlapping objects.
2. Path inline nodes/vertices exported as `node[pos=..., ...]` on paths.
3. Path splitting at an interior point.
4. Style eyedropper between objects with the same `geometricKind`.
5. UI polish:
   - make the Layer window Actions popover/panel semi-transparent and easier to understand;
   - change Inspector numeric inputs to allow temporarily invalid text and show warnings instead of blocking input, so values like `.5` are easy to type;
   - rename Add path `Line/manual path` to something clearer like `Arbitrary path`.

Important conventions:

- UI-only state must not be stored in `Diagram`.
- Anything affecting exported TikZ must be persisted.
- Selection/cycling state is UI-only.
- Path inline nodes/vertices affect TikZ and must be persisted.
- Path split creates or updates geometry and must be undoable.
- Style eyedropper changes style only, not geometry.
- Inline math TikZ output must contain no blank lines.
- TikZ indentation remains 4 spaces.
- Preserve save/load, undo/redo, SVG preview, TikZ export, symbolic input, work-plane-local coordinates, coordinate anchors, layer manager, arrows, braiding, and existing geometry behavior.
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

Phase 27B should add path-attached inline nodes/vertices exported as TikZ `node[pos=...]`.

## Review checklist

Check:

- path inline node model exists;
- position validation works;
- save/load round-trip;
- UI can add/edit node;
- SVG preview finite;
- TikZ emits `node[pos=...]`;
- coordinateRef/arrows preserved;
- auto-visibility handles or falls back explicitly;
- path geometry not split;
- old paths unchanged.

Medium issues include:

- inline nodes silently lost in TikZ;
- nodes mutate path geometry;
- invalid pos accepted;
- path deletion leaves stale node refs;
- inline output blank lines.

Run verification commands and report results.
