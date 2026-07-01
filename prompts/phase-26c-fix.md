# Phase 26C Fix Prompt: Generate sampled-sheet fallback commands lazily in depth-sorted surface export

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

## Context

You are working on the StratifiedTikZ project.

Phase 26C introduced coordinate-anchor references (`coordinateRef`) and added safeguards so coordinate refs are preserved in normal TikZ output rather than silently degrading to numeric helper coordinates.

A recent Phase 26C fix added fallback behavior for coordinateRef geometry under 3D auto-visibility export.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`emitDepthSortedSurfaceFaces` eagerly builds ordinary sampled-sheet fallback commands even when the fallback is never used.

Review details:

- In `src/tikz/generateTikz.ts`, `sampledSheetCommands` is built eagerly.
- That eager build calls `emitSheet(...)`.
- `emitSheet(...)` mutates the shared TikZ coordinate context, especially:

```ts
context.coordinates
```

- Even when depth-sorted surface output succeeds and the ordinary fallback is not returned, the eager fallback generation has already registered ordinary sampled sheet vertex coordinates.
- Result:
  - numeric depth-sorted sheets emit unused ordinary vertex coordinate definitions;
  - then they also emit depth-sorted face coordinate definitions.

Observed output example for one numeric 3D sheet:

```text
sheetPolyNumericSheet0p0
sheetPolyNumericSheet0Face0p0
```

Only the `Face` coordinates are referenced.

This regresses existing numeric depth-sorted TikZ readability and violates the checklist item:

```text
existing direct/numeric fields unaffected
```

## Goal

Fix `emitDepthSortedSurfaceFaces` so ordinary sampled-sheet fallback commands are generated lazily only when the fallback is actually returned.

Specifically:

1. Do not call `emitSheet(...)` for non-coordinateRef sheets during successful depth sorting.
2. Do not mutate the shared TikZ coordinate context while merely preparing a fallback that will not be used.
3. Preserve coordinateRef fallback behavior.
4. Preserve successful depth-sorted numeric surface output.
5. Remove unused ordinary sampled-sheet coordinate definitions from successful depth-sorted output.
6. Add regression tests.

## Scope

This is a targeted Phase 26C export fix.

Implement:

- lazy fallback generation for sampled-sheet commands;
- no shared context mutation unless fallback is actually emitted;
- tests for numeric depth-sorted surface output;
- tests preserving coordinateRef fallback output.

Do not implement:

- new coordinateRef model behavior;
- new visibility algorithm;
- new surface geometry;
- new TikZ output mode;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- normal non-depth-sorted sheet export;
- coordinateRef ordinary sheet/path/point/label export;
- coordinate anchor definitions;
- depth sorting order;
- layer-aware output semantics;
- inline/standalone formatting;
- 4-space indentation;
- inline no-blank-lines invariant;
- SVG preview behavior;
- save/load behavior.

## 1. Inspect current depth-sorted surface export path

Inspect `src/tikz/generateTikz.ts`.

Focus on:

- `emitDepthSortedSurfaceFaces`;
- `sampledSheetCommands`;
- calls to `emitSheet(...)`;
- coordinateRef fallback logic;
- ordinary depth-sorted face emission;
- `context.coordinates.define(...)`;
- layer-aware wrapping.

Find where fallback commands are currently built eagerly.

The problematic pattern is conceptually:

```ts
const sampledSheetCommands = emitSheet(...); // mutates context.coordinates

if (shouldFallback) {
  return sampledSheetCommands;
}

return depthSortedFaceCommands;
```

This must become lazy.

## 2. Generate fallback commands only when needed

Preferred approach:

Use a thunk / callback:

```ts
const emitSampledSheetFallback = () => emitSheet(...);
```

Then only call it in fallback branches:

```ts
if (shouldFallback) {
  return emitSampledSheetFallback();
}

return emitDepthSortedFaces(...);
```

Requirements:

- if depth sorting succeeds, fallback thunk is never called;
- shared `context.coordinates` is not mutated by fallback code;
- ordinary fallback commands are not generated;
- ordinary fallback coordinate definitions are not registered.

## 3. Avoid context mutation during fallback probing

Do not use a pattern that still calls `emitSheet(...)` into the real context just to inspect output.

If any fallback decision currently depends on `sampledSheetCommands`, refactor the decision so it uses non-mutating predicates instead.

Examples of predicates:

```ts
sheetContainsCoordinateRef(sheet)
surfaceDepthSortUnsupportedForSheet(sheet)
shouldUseCoordinateRefPreservingFallback(sheet)
```

These should inspect the source object, not generate TikZ.

If a fallback really needs generated commands, generate them after the decision is made.

## 4. CoordinateRef fallback behavior must remain

The previous Phase 26C fix likely introduced fallback behavior:

```text
If a sheet contains coordinateRef sources and surface depth sorting would sample it numerically, skip sampled depth sorting for that sheet and emit ordinary reference-preserving export with a comment.
```

Preserve that behavior.

Required:

- coordinateRef sheet with surfaceDepthSort enabled still exports `(A)`, `(B)`, etc.;
- fallback comment remains;
- ordinary fallback commands are emitted only for that coordinateRef sheet;
- coordinate anchor definitions appear before references.

## 5. Numeric depth-sorted sheets must not leak ordinary fallback coordinates

For a numeric sheet with surfaceDepthSort enabled and successful depth sorting:

Required:

- output includes depth-sorted face coordinate definitions if that is existing behavior;
- output does **not** include ordinary sampled sheet coordinate definitions created only by unused fallback;
- no `sheetPoly...p0` ordinary fallback coordinates unless actually referenced by successful output;
- only the intended `Face...` helper coordinates appear, if that is the current depth-sorted naming policy.

The key test should fail before the fix and pass after.

## 6. Consider temporary context only if necessary

If there is an unavoidable need to generate fallback commands for analysis, do not use the real shared context.

Use a temporary isolated context or dry-run mode.

However, preferred solution is simpler:

```text
do not generate fallback until returning fallback
```

If a temporary context is used, ensure:

- no coordinate definitions leak into real output;
- no library requirements or style metadata leak accidentally;
- tests cover no unused coordinates.

## 7. Layer-aware output

Preserve current layer-aware behavior.

Requirements:

- depth-sorted numeric faces remain in the correct layer block;
- coordinateRef fallback sheet remains in the correct layer block;
- no duplicate layer wrapping;
- indentation remains 4 spaces;
- inline output has no blank lines.

## 8. Tests

Add focused tests.

### Numeric depth-sorted sheet regression tests

1. A simple numeric 3D polygon/quad sheet with `surfaceDepthSort` enabled exports depth-sorted face coordinates.

2. The same output does **not** include unused ordinary fallback coordinate definitions.

Example assertion concept:

```ts
expect(output).toContain("Face0p0");
expect(output).not.toContain("NumericSheet0p0");
```

Use actual stable naming patterns from the project.

3. No unreferenced ordinary sheet helper coordinates are emitted.

If exact naming is brittle, assert that every generated coordinate definition without `Face` is referenced, or use a helper if available.

4. The depth-sorted output remains deterministic.

### CoordinateRef fallback preservation tests

5. A polygon/quad sheet with coordinateRef vertices and `surfaceDepthSort` enabled still emits ordinary reference-preserving fallback.

6. Output contains `(A)` / `(B)` references.

7. Output contains fallback comment.

8. Output does not emit sampled numeric face helper coordinates for that coordinateRef sheet.

9. Coordinate anchor definitions appear before use.

### Mixed diagram tests

10. Diagram with one numeric sheet and one coordinateRef sheet:
    - numeric sheet uses depth-sorted face output;
    - coordinateRef sheet uses fallback ordinary output;
    - numeric sheet does not leak ordinary fallback coordinates;
    - coordinateRef sheet preserves refs.

### Formatting/regression tests

11. Inline output has no blank lines.

12. 4-space indentation preserved.

13. Layer-aware output preserved.

14. Non-depth-sorted ordinary sheet export unchanged.

15. Existing auto-visibility tests for non-ref surfaces still pass.

16. Existing coordinateRef path/point/label/simple sheet tests still pass.

## 9. Defensive checks

Search for similar eager fallback generation patterns in TikZ export:

```bash
rg "fallback|emitSheet|sampledSheetCommands|emitDepthSortedSurfaceFaces" src/tikz/generateTikz.ts
```

If other branches eagerly generate fallback output into shared context and discard it, consider fixing them if they are clearly the same bug.

Keep the fix focused.

## 10. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual-style checks if practical:

1. Create a 3D numeric polygon sheet.
2. Enable surface depth sorting.
3. Generate TikZ.
4. Confirm only depth-sorted face helper coordinates appear.
5. Confirm no unused ordinary `sheetPoly...p0` coordinates appear.
6. Create a sheet with coordinateRef vertices.
7. Enable surface depth sorting.
8. Confirm fallback comment appears and `(A)` references are preserved.

## 11. Preserve existing behavior

Do not regress:

- ordinary sheet export;
- coordinateRef sheet fallback;
- surface depth sorting for non-ref sheets;
- coordinate anchor definitions;
- layer-aware output;
- inline no-blank-lines;
- 4-space indentation;
- SVG preview;
- save/load;
- undo/redo;
- existing coordinateRef validation/export behavior.

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
- root cause of unused ordinary coordinates leaking;
- how fallback generation is now lazy;
- whether a thunk, predicate, or temporary context was used;
- how coordinateRef fallback remains preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
