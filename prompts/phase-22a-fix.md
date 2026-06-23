# Phase 22A Fix Prompt: Preserve arrow options in split path and occlusion-segmented TikZ exports

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

Phase 22A added persistent path arrow options and TikZ option generation.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Configured arrows are silently dropped for split curve/path exports.

Review details:

1. A concatenated path with multiple style runs routes through split path export code in `src/tikz/generateTikz.ts`.

2. Each run's draw options include only style options, not `pathArrowTikzOptions`.

3. The same omission exists for 3D auto-occlusion segmented curve draws.

4. Result:
   - persisted `PathArrowOptions` may exist on the path;
   - normal single-style path output includes arrows;
   - but mixed-style / split path output and occlusion-segmented output omit arrows.

This means saved arrow data does not consistently affect TikZ output.

## Goal

Fix Phase 22A arrow TikZ export so persisted `PathArrowOptions` are preserved or explicitly handled for:

1. mixed-style concatenated paths / split style-run exports;
2. 3D auto-occlusion segmented curve output;
3. any other split curve output path that emits multiple `\draw` commands for one logical path.

Add regression tests covering:

- endpoint arrows on split paths;
- mid-arrow decorations on split paths;
- endpoint/mid arrows on occlusion-segmented 3D curves;
- required library emission.

## Scope

This is a targeted Phase 22A fix.

Implement:

- arrow-aware options for split style-run path export;
- arrow-aware options for occlusion-segmented curve export;
- correct endpoint-arrow distribution across split runs;
- correct mid-arrow placement across split runs;
- library requirement detection for split exports;
- tests.

Do not implement:

- new arrowhead kinds;
- new SVG arrow UI;
- new path direction reversal UI;
- braiding/intersection features;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- persisted arrow model except if a small helper field is absolutely necessary;
- single-style path arrow export semantics;
- path geometry;
- style override semantics;
- occlusion classification semantics;
- layer-aware output;
- inline/standalone export modes;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect all split path export paths

Inspect `src/tikz/generateTikz.ts` for every path that can emit multiple draw commands for one logical curve/path.

Known review locations:

- mixed-style concatenated path export, around the reviewed `generateTikz.ts` route;
- run draw options around the reviewed split style-run options;
- 3D auto-occlusion segmented curve draw output.

Search for code patterns like:

```ts
styleOptions(...)
drawOptions(...)
emitPathRun(...)
emitSegmentedCurve(...)
pathArrowTikzOptions(...)
```

Find all places where:

- a logical path has `PathArrowOptions`;
- export emits multiple commands/runs;
- arrow options are not included or are intentionally dropped.

## 2. Define whole-path arrow semantics for split exports

Arrow options are attached to a logical path, not to every split run.

When a path is split into multiple draw commands, preserve whole-path semantics.

### Endpoint arrows

Endpoint arrows should appear only at the true endpoints of the whole path.

For split runs in path order:

- `endpoint: "none"`:
  - no endpoint arrows.
- `endpoint: "forward"`:
  - only the final emitted run should get the forward endpoint arrow.
- `endpoint: "backward"`:
  - only the first emitted run should get the backward endpoint arrow.
- `endpoint: "both"`:
  - first emitted run gets backward arrow;
  - final emitted run gets forward arrow;
  - if there is only one run, it gets both.

Do not add endpoint arrows to every split run.

### Mid-arrow decorations

Mid-arrow decoration is also whole-path semantic.

For:

```ts
mid.enabled === true
mid.position === p  // default 0.5
```

emit the mid-arrow exactly once, at the run containing the global path position `p`.

Do not add a mid-arrow to every split run.

Compute a local run position:

```text
localPosition = (targetDistanceAlongWholePath - runStartDistance) / runLength
```

and use that local position in the run's TikZ decoration:

```tex
mark=at position <localPosition> with {\arrow{...}}
```

Requirements:

- local position must be finite;
- clamp only if needed for floating error, e.g. within `[epsilon, 1 - epsilon]`;
- if the target lies exactly at a run boundary, choose a deterministic adjacent run;
- do not emit duplicate mid arrows.

If exact path-length data is unavailable, use the existing path sampling/flattening approximation. It is acceptable for mid-arrow placement to be approximate, but it must not be silently omitted.

## 3. Split style-run export

For mixed-style concatenated paths:

- preserve style options for each run;
- add run-specific endpoint arrow options only to the first/final runs as described above;
- add mid-arrow decoration only to the run containing the global mid-arrow position;
- preserve segment-level style overrides;
- preserve layer-aware output;
- preserve path order.

If a style run is too short or zero-length:

- skip it safely;
- ensure endpoint arrows/mid arrow are reassigned to a non-empty run when possible;
- otherwise emit a clear fallback comment or omit only with an explicit tested policy.

Do not silently drop arrow options for nonzero split paths.

## 4. Occlusion-segmented curve export

For 3D auto-occlusion segmented curve output:

- the logical path may be split into visible and hidden runs;
- endpoint arrows and mid arrows should still be handled as whole-path options;
- visible/hidden style should apply to the run where the arrow appears.

Expected policy:

### Endpoint arrows

- If the whole path start is in a visible run, the backward endpoint arrow uses visible style.
- If the whole path start is in a hidden run, the backward endpoint arrow uses hidden style.
- Same for the whole path end and forward endpoint arrow.

### Mid arrow

- The mid arrow appears on whichever visible/hidden run contains the global arrow position.
- If that run is hidden, the mid arrow should use hidden style with the hidden run.
- If that run is visible, it should use normal/visible style.

### Fallback paths

If occlusion classification falls back to original output because of caps or unsupported cases:

- use normal whole-path arrow export on the original path;
- do not drop arrow options.

## 5. Shared helper for run-specific arrow options

Add a helper to avoid duplicating logic.

Suggested types:

```ts
type LogicalPathRun = {
  index: number;
  startDistance: number;
  endDistance: number;
  length: number;
  isFirstNonEmpty: boolean;
  isLastNonEmpty: boolean;
  styleContext: ...
};

type RunArrowOptions = {
  endpointMode: EndpointArrowMode;
  mid?: {
    position: number;
    direction: "forward" | "backward";
    head: ArrowHeadKind;
  };
};
```

Suggested helper:

```ts
pathArrowTikzOptionsForRun(
  pathArrows: PathArrowOptions,
  run: LogicalPathRun,
  allRuns: LogicalPathRun[]
): string[]
```

or equivalent.

Requirements:

- returns no arrows for runs that should not carry them;
- returns endpoint options only for path endpoints;
- returns one mid-arrow decoration for the correct run;
- includes required library metadata in a separate collector or via existing mechanism.

## 6. Required library emission

Existing Phase 22A single-style output already emits or records required libraries for arrow decorations.

Ensure split exports also contribute required libraries:

- `decorations.markings` when mid arrows are used;
- `arrows.meta` when head kind requires it:
  - `Stealth`;
  - `Latex`;
  - `Stealth[harpoon]`;
  - `Stealth[harpoon,swap]`.

Required:

- mixed-style path with mid arrow emits required libraries/comments;
- occlusion-segmented path with mid arrow emits required libraries/comments;
- endpoint arrows with default arrow heads preserve existing library behavior;
- no duplicate library lines beyond existing de-dup policy.

## 7. TikZ output formatting

Preserve existing formatting constraints:

- 4-space indentation;
- inline math output has no blank lines;
- no new blank lines in inline mode;
- standalone formatting remains readable;
- layer-aware output preserved.

If split runs emit additional comments, inline comments must not introduce blank lines.

## 8. Tests

Add focused regression tests.

### Mixed-style concatenated path tests

1. A concatenated path with multiple style runs and `endpoint: "forward"` exports exactly one endpoint arrow on the final run.

2. Same path with `endpoint: "backward"` exports exactly one endpoint arrow on the first run.

3. Same path with `endpoint: "both"` exports endpoint arrows at the first and final runs, not every run.

4. Same path with mid-arrow enabled at default position `0.5` exports exactly one mid-arrow decoration.

5. The mid-arrow is assigned to the run containing global position `0.5`.

6. The local run position is finite and in `(0,1)`.

7. Segment style overrides are preserved.

8. Required libraries are emitted for mid-arrow decorations.

9. `Stealth`, `Latex`, `Stealth[harpoon]`, and `Stealth[harpoon,swap]` still export correctly in split output.

### Occlusion-segmented curve tests

10. A 3D/visibility segmented curve with endpoint arrow preserves endpoint arrow on the correct first/final segment.

11. An occlusion-segmented curve with mid arrow emits exactly one mid-arrow decoration.

12. If the mid-arrow lies in a hidden segment, the hidden-style draw command carries the mid-arrow decoration.

13. If occlusion falls back to original output, the original arrow options are still present.

14. Required libraries are emitted for occlusion-segmented mid arrows.

15. Hidden style emission still works.

### Formatting tests

16. Inline math output with split path arrows has no blank lines.

17. Inline math output with occlusion-segmented arrows has no blank lines.

18. 4-space indentation preserved.

### Regression tests

19. Single-style path arrow output unchanged.

20. Numeric path output without arrows remains free of arrow/decorations options.

21. Path without arrows in split export remains unchanged except for existing style-run behavior.

22. TikZ output contains no NaN/Infinity.

## 9. Decide behavior for impossible mid-arrow assignment

There may be edge cases:

- zero-length path;
- all runs zero length;
- mid position falls into a skipped zero-length run;
- path export is unsupported.

Do not silently drop persisted arrow data without trace.

Acceptable behavior:

- emit no mid-arrow for zero-length path and add a validation warning if warning infrastructure exists;
- or reject invalid zero-length path arrow options earlier;
- for nonzero paths, always assign the mid-arrow to a nonzero run.

Document chosen behavior in tests/report.

## 10. Preserve existing behavior

Do not regress:

- arrow model validation;
- old diagram loading;
- single-style arrow output;
- endpoint/mid arrow syntax;
- required library emission;
- mixed-style path styles;
- occlusion segmented hidden/visible output;
- disabled visibility behavior;
- layer-aware output;
- inline/standalone formatting;
- SVG preview;
- save/load;
- undo/redo.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create a concatenated path with multiple segment style overrides.
2. Add endpoint forward arrow.
3. Generate TikZ.
4. Confirm arrow appears at the whole path end, not at every style run.
5. Add mid-arrow at position `.5`.
6. Confirm exactly one mid-arrow decoration appears.
7. Change head to `Stealth`.
8. Confirm `arrows.meta` / required library handling appears.
9. Create a 3D curve with auto-occlusion segmentation.
10. Add arrows.
11. Confirm segmented TikZ output still includes arrows.
12. Switch to inline math mode.
13. Confirm no blank lines.

## 12. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 13. Report after implementation

Please report:

- files modified;
- root cause of arrows being dropped in split exports;
- whole-path arrow semantics for split runs;
- endpoint arrow run assignment policy;
- mid-arrow local-position calculation;
- occlusion-segmented arrow behavior;
- required library handling;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
