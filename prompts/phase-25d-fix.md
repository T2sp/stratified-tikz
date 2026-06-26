# Phase 25D Fix Prompt: Preserve or explicitly fallback for work-plane-local symbolic frame coordinates in TikZ plane scopes

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

## Context

You are working on the StratifiedTikZ project.

Phase 25D implements TikZ export for work-plane-local symbolic coordinates using `canvas is plane` scopes.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority test coverage issue remains.

## Medium issue

`plane origin`, `plane x`, and `plane y` can silently drop work-plane-local symbolic source metadata from stored frame coordinates.

Review details:

- `src/tikz/generateTikz.ts` formats frame coordinates through `formatFrameCoordinate`.
- `formatFrameCoordinate` currently preserves per-axis symbolic components.
- However, it does not preserve symbolic metadata stored as `Vec3.symbolic.source`, especially when the source is work-plane-local.
- If a frame origin is stored as a work-plane-local symbolic source with numeric global preview components, TikZ export emits only the numeric preview.

Observed example:

- A grid frame origin has work-plane-local symbolic metadata involving `R`.
- Its global preview is numerically `(2,0,0)`.
- Export currently emits:

```tex
plane origin={(2,0,0)}
```

instead of preserving symbolic intent or explicitly falling back.

This silently loses the symbolic source metadata.

This is a Phase 25D issue because local symbolic frame data can affect exported geometry while being reduced to preview numbers without warning.

## Low-priority issue

There is no targeted TikZ test for a stored frame coordinate whose symbolic metadata is only in:

```ts
Vec3.symbolic.source
```

rather than per-axis symbolic components.

## Goal

Fix Phase 25D TikZ frame-coordinate export so `formatTikzPlaneScopeOptions` and related helpers do not silently emit numeric previews for frame coordinates that contain work-plane-local symbolic source metadata.

Required behavior:

1. Detect when `plane origin`, `plane x`, or `plane y` has symbolic/source metadata that is not representable by the current per-axis formatter.
2. Either:
   - preserve such frame coordinates symbolically when safe; or
   - explicitly fall back / omit local canvas-scope export with a clear policy comment.
3. Do not silently export numeric preview coordinates as if symbolic intent did not exist.
4. Add targeted tests for grid/path/sheet canvas scopes whose stored frame origin has only work-plane-local symbolic source metadata.
5. Preserve existing correct local canvas-scope behavior for ordinary numeric and per-axis symbolic frames.

## Scope

This is a targeted Phase 25D fix.

Implement:

- symbolic-source-aware frame coordinate formatting;
- detection of unsupported `Vec3.symbolic.source` metadata in frame coordinates;
- explicit fallback policy when symbolic frame source cannot be safely represented;
- targeted TikZ tests.

Do not implement:

- full symbolic frame algebra if too large;
- broad coordinate model refactor;
- new work-plane UI;
- new symbolic expression grammar;
- new TikZ export modes;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- local coordinate data model unless unavoidable;
- existing same-frame local path/sheet/point/label export behavior;
- existing variable macro emission;
- layer-aware output;
- inline/standalone export formatting;
- 4-space indentation;
- inline no-blank-lines invariant;
- SVG preview behavior;
- save/load behavior.

## 1. Inspect current frame-coordinate export path

Inspect:

- `src/tikz/generateTikz.ts`;
- `formatTikzPlaneScopeOptions`;
- `formatFrameCoordinate`;
- helpers that format `plane origin`, `plane x`, and `plane y`;
- local `canvas is plane` scope export helpers for:
  - points;
  - labels;
  - paths;
  - sheets;
  - filled sheets;
  - grids/lattices;
  - any work-plane-local template/path export;
- frame equality helpers from the previous Phase 25D fix.

Find where frame coordinates are reduced to preview numbers.

The review specifically points to the path:

```text
formatTikzPlaneScopeOptions
-> formatFrameCoordinate
-> per-axis symbolic formatting only
-> numeric preview fallback
```

## 2. Clarify supported frame-coordinate export cases

Define a clear policy.

### Case A: Numeric frame coordinate

Example:

```ts
origin = { x: 2, y: 0, z: 0 }
```

Export as before:

```tex
plane origin={(2,0,0)}
```

### Case B: Per-axis symbolic components

Example:

```ts
origin.x = { kind: "symbolic", expression: "R", previewValue: 2 }
origin.y = 0
origin.z = 0
```

Export symbolically as before or improve if needed:

```tex
plane origin={({\R},0,0)}
```

or existing equivalent.

### Case C: `Vec3.symbolic.source` work-plane-local metadata

Example:

```ts
origin.preview = (2,0,0)
origin.symbolic.source = {
  kind: "workPlaneLocal",
  frame: ...,
  local: { a: { expression: "R" }, b: 0 }
}
```

This must **not** silently export as:

```tex
plane origin={(2,0,0)}
```

Acceptable policies:

#### Preferred policy: preserve if safely representable

If the source can be converted to a valid global symbolic expression, export it symbolically.

For example, if the source is:

```text
origin = sourceFrame.origin + R * sourceFrame.u + 0 * sourceFrame.v
```

and `sourceFrame` itself is numeric/per-axis-symbolic enough to format safely, then export:

```tex
plane origin={({... + \R * ...}, ...)}
```

This may be too complex for MVP.

#### Safe MVP policy: explicit fallback

If `Vec3.symbolic.source` work-plane-local metadata is present and cannot be safely represented by `formatFrameCoordinate`, do not emit a local `canvas is plane` scope that relies on this frame.

Instead:

- trigger the existing mixed-frame / unsupported-local-frame fallback policy;
- emit a clear comment;
- export using numeric preview fallback only if the existing policy explicitly comments that symbolic frame source could not be preserved;
- or reject local-scope export for that object if the current export path can surface a clear error/comment.

The key is: **no silent numeric preview export.**

Preferred MVP:

```tex
% Work-plane-local frame source contains nested symbolic metadata that cannot be represented in a canvas-is-plane scope; using numeric preview fallback for this object.
```

or equivalent existing policy comment.

## 3. Add detection helper

Add a helper such as:

```ts
hasUnsupportedFrameSymbolicSource(vec: SymbolicVec3 | Vec3): boolean
```

or:

```ts
frameCoordinateHasNonAxisSymbolicSource(coord): boolean
```

It should detect cases where:

- a coordinate has `symbolic.source`;
- the source is work-plane-local or otherwise non-axis metadata;
- the current formatter would ignore it and use numeric previews.

Also add a frame-level helper:

```ts
workPlaneFrameHasUnsupportedSymbolicSource(frame): boolean
```

that checks:

- `origin`;
- `u`;
- `v`;
- `normal` if relevant for export decisions.

Requirements:

- deterministic;
- handles legacy numeric frames;
- handles per-axis symbolic frames as supported;
- handles malformed metadata by returning unsupported or validation failure rather than silently numeric.

## 4. Integrate detection into `formatTikzPlaneScopeOptions`

Before formatting:

```text
plane origin
plane x
plane y
```

check whether the frame contains unsupported symbolic source metadata.

If unsupported metadata exists:

- do not call `formatFrameCoordinate` and let it drop the metadata;
- use the explicit fallback policy.

Depending on current generator architecture, return a result object:

```ts
type PlaneScopeFormatResult =
  | { kind: "ok"; options: string[]; requiredLibraries: string[] }
  | { kind: "unsupportedSymbolicFrameSource"; reason: string };
```

or equivalent.

If changing return shape is too broad, add a higher-level guard before calling `formatTikzPlaneScopeOptions`.

## 5. Fallback behavior

Apply the existing mixed-frame/local export fallback if possible.

For example, if local scope export is not safe:

- export the object using global/numeric preview coordinates, with an explicit comment;
- or use existing global symbolic fallback if available;
- or skip local scope grouping and output separate scopes where safe.

The chosen policy must be tested.

Important:

- If using numeric preview fallback, it must be accompanied by an explicit comment.
- The output should not look like a normal symbolic-preserving canvas scope.
- It should not silently omit a variable macro that is still referenced.
- It should not emit unresolved variables.

## 6. Ensure variable macro behavior is correct

If symbolic source metadata is preserved:

- emit needed macros, e.g. `\R`.

If fallback uses numeric previews:

- do not emit unused macros solely because the fallback no longer references them, unless the project's variable emission policy emits all variables.
- But do include a comment explaining why symbolic frame source was not preserved.

If the object still uses local symbolic `a,b` expressions in coordinates, preserve their macros as before.

## 7. Tests

Add targeted tests.

### Frame coordinate formatting tests

1. Numeric frame coordinate exports numeric as before.

2. Per-axis symbolic frame coordinate exports symbolically as before.

3. Frame origin with `Vec3.symbolic.source.kind = "workPlaneLocal"` is detected as unsupported by the plain per-axis frame formatter.

4. Frame `u` with work-plane-local symbolic source is detected as unsupported.

5. Frame `v` with work-plane-local symbolic source is detected as unsupported.

6. Frame `normal` with work-plane-local symbolic source is detected if normal participates in same-frame/signature/export safety.

### TikZ export tests

7. Grid with frame origin carrying only work-plane-local symbolic source metadata does not export silently as:

```tex
plane origin={(2,0,0)}
```

without a fallback comment.

Expected:
- either symbolic expression involving `\R` is preserved; or
- output contains explicit fallback comment and does not emit a misleading normal local scope.

8. Path with a canvas-scope frame origin carrying only work-plane-local symbolic source metadata triggers the same safe behavior.

9. Sheet or filled sheet with such a frame triggers the same safe behavior.

10. Same object with numeric frame still exports normal `canvas is plane` scope.

11. Same object with per-axis symbolic frame still exports normal symbolic frame scope.

12. Inline output with fallback comment has no blank lines.

13. 4-space indentation preserved.

14. Layer-aware output preserved around fallback/scopes.

### Regression tests

15. Existing same-frame local symbolic path/sheet/point/label export tests still pass.

16. Equal-preview but symbolically different frames still do not merge.

17. Numeric/global coordinate export unchanged.

18. Variable macro emission tests still pass.

## 8. Avoid silent loss in future helpers

Search for similar fallback behavior in frame formatting:

```bash
rg "formatFrameCoordinate|plane origin|plane x|plane y|symbolic.source|preview" src/tikz src/model src/rendering
```

If another frame formatting path silently reduces `Vec3.symbolic.source` to numeric preview, apply the same policy or document why it is safe.

## 9. Documentation/comments

Add a code comment near the frame formatter:

```text
Frame coordinates may carry symbolic.source metadata. If the formatter only supports per-axis symbolic components, it must not silently emit numeric previews for non-axis sources because that drops symbolic intent.
```

Update user docs only if the fallback policy is user-visible.

## 10. Preserve existing behavior

Do not regress:

- same-frame local symbolic point/label/path/sheet export;
- local expression preservation;
- `canvas is plane` scope syntax;
- `\usetikzlibrary{3d}` handling;
- variable macro emission;
- layer-aware output;
- inline no-blank-lines;
- 4-space indentation;
- numeric/global export;
- SVG preview;
- save/load;
- undo/redo.

## 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 12. Report after implementation

Please report:

- files modified;
- root cause of frame source metadata loss;
- whether unsupported `Vec3.symbolic.source` is preserved or triggers explicit fallback;
- fallback comment/policy;
- affected frame fields:
  - plane origin;
  - plane x;
  - plane y;
  - normal if relevant;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
