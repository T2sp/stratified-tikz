# Phase 28K Review Prompt: Selectable transparent/white SVG export background

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
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat lint as a required gate while the existing repository-wide lint debt remains.
## Project context

You are working on the current `main` branch of:

```text
https://github.com/T2sp/stratified-tikz
```

The current repository contains the relevant implementation areas:

- `src/ui/svgPreviewExport.ts` for SVG Preview export;
- `src/model/grids.ts` for compact grid/lattice geometry and validation;
- `src/rendering/SvgDiagram.tsx` and related rendering helpers for SVG Preview;
- `src/tikz/generateTikz.ts` for generated TikZ source;
- tests under `tests/`.

Preserve all current behavior unless this prompt explicitly changes it:

- SVG Preview remains the primary editing canvas;
- Export SVG remains a Preview edge action;
- 2D/3D camera, zoom, and pan behavior;
- layer visibility/filtering;
- coordinate anchors and coordinate refs;
- symbolic and work-plane-local coordinates;
- rectangular and honeycomb grids;
- standalone and inline-math TikZ export;
- inline-math output contains no blank lines;
- TikZ indentation remains 4 spaces;
- save/load and undo/redo.
## Review instructions

Review this subphase only.

Do not modify files.

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

At the end, output:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

Use:

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
...
```

Then:

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

Set `ready_to_commit` to `false` if any Critical or Medium issue remains.


## Review checklist

Check:

- user can choose transparent or white;
- default is transparent;
- exported SVG no longer inherits gray editor background;
- transparent mode has no background rectangle;
- white mode has one correctly sized white rectangle behind content;
- live Preview DOM is not mutated;
- current view and diagram content remain intact;
- editor-only nodes remain excluded;
- setting is UI-only and does not affect JSON/TikZ.

Medium issues include:

- gray background remains in either mode;
- transparent mode removes legitimate geometry fills;
- white rectangle covers geometry;
- export mutates live Preview;
- background setting leaks into Diagram/TikZ.
