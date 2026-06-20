# Phase 19H Review Prompt: Triangular and honeycomb lattice grid patterns

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

Phase 19G is complete.

The editor now supports:

- symbolic variables and coordinate expressions;
- grid generation;
- grid SVG preview;
- compact grid TikZ export using `\foreach` and `\clip`;
- 2D grids and 3D work-plane-local grids;
- standalone and inline math TikZ export modes;
- 4-space TikZ indentation;
- inline math output with no blank lines;
- layer-aware TikZ output;
- camera/work-plane/layer/style managers;
- save/load and undo/redo.

Current limitation:

- grid generation currently supports only the existing rectangular/cubic-style lattice.
- Users also need triangular lattice and honeycomb lattice patterns.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- In 3D, lattice grids should lie in a stable work-plane-local 2D frame.
- Work planes are model-space editing aids.
- Grid data that affects output should be persisted.
- UI-only draft state should not be stored in `Diagram`.
- TikZ output must remain readable.
- Inline math mode must contain no blank lines.
- TikZ indentation must remain 4 spaces.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve symbolic variables, grid export, save/load, undo/redo, camera, work-plane, layer/style managers, SVG preview, and existing geometry behavior.
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

Phase 19H should extend the existing grid generator with triangular and honeycomb lattice patterns, preserving rectangular/cubic behavior.

## Review checklist

### Data model and validation

Check:

- lattice pattern field exists;
- old grids default to existing rectangular/cubic behavior;
- invalid pattern rejected;
- triangular spacing/cell size finite and positive;
- honeycomb edge length/cell size finite and positive;
- excessive line/edge counts are bounded;
- save/load preserves pattern;
- old diagrams load.

### Triangular lattice

Check:

- preview shows a triangular lattice, not just rectangular grid;
- three line families are present;
- spacing convention documented;
- 2D z remains 0;
- 3D lattice lies in stored work-plane frame;
- generated segments finite.

### Honeycomb lattice

Check:

- preview shows honeycomb/hexagonal edge pattern;
- edge/cell size convention documented;
- duplicate edge behavior acceptable/documented;
- 2D z remains 0;
- 3D lattice lies in stored work-plane frame;
- generated edges finite.

### TikZ export

Check:

- existing rectangular/cubic export unchanged;
- triangular lattice export is compact, preferably using `\foreach`;
- honeycomb lattice export is compact, preferably using `\foreach`;
- clip/range behavior preserved;
- 2D export valid-looking;
- 3D export uses `canvas is plane` and stored frame;
- style/layer preserved;
- inline math output has no blank lines;
- indentation remains 4 spaces;
- no NaN/Infinity.

### UI

Check:

- user can select lattice pattern;
- inputs adapt to pattern;
- UI remains compact/readable;
- invalid inputs show clear errors;
- creation/editing does not corrupt diagram.

### Regression

Check:

- existing grid behavior not regressed;
- symbolic variable/grid tests still pass;
- save/load works;
- undo/redo works if applicable;
- SVG preview remains responsive.

Medium issues include:

- honeycomb/triangular pattern not visually correct;
- huge unbounded generation;
- 3D lattice depends on transient active work plane;
- TikZ export expands into huge output without need;
- inline blank lines return;
- existing rectangular grid broken.

Run verification commands and report results.
