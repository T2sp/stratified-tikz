# Phase 26C Fix Prompt: Preserve coordinateRef TikZ output under 3D auto-visibility export

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

Phase 26C introduced coordinate-anchor references (`coordinateRef`) so paths, points, labels, and simple sheets can reference global TikZ coordinate anchors and export readable TikZ such as:

```tex
\coordinate (A) at (...);
\draw (A) -- (B);
\node at (A) {...};
```

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Coordinate refs are silently degraded to numeric helper coordinates when 3D auto-visibility sampling is enabled.

Normal export preserves `(A)` references. However, when auto-visibility export paths are enabled:

### Surface depth sorting branch

For polygon/quad sheets, normal export can preserve coordinate references such as:

```tex
\filldraw ... (A) -- (B) -- (C) -- cycle;
```

But the depth-sorted surface branch emits sampled face vertices from:

```ts
face.vertices3D
```

through generated helper coordinates, producing names like:

```tex
(sheetPoly...Face0p0)
```

instead of preserving:

```tex
(A) -- (B) -- (C)
```

Relevant review locations:

```text
src/tikz/generateTikz.ts around depth-sorted sheet face emission
src/tikz/generateTikz.ts around context.coordinates.define(...)
```

### Curve occlusion branch

For paths, normal export preserves coordinate references.

But the curve-occlusion branch samples referenced paths and emits generated helper coordinates such as:

```tex
(curvePoly...OcclusionpN)
```

instead of anchor references like:

```tex
(A) -- (B)
```

Relevant review locations:

```text
src/tikz/generateTikz.ts around curve occlusion sampled coordinate emission
```

This occurs only when visibility options are enabled, but it violates Phase 26C’s requirement:

```text
coordinateRef sources should preserve (tikzName) in TikZ rather than silently becoming numeric output.
```

## Goal

Fix Phase 26C coordinate-ref preservation in 3D auto-visibility TikZ export.

When surface depth sorting or curve occlusion would sample a path/sheet containing `coordinateRef` sources:

1. Do not silently degrade coordinate refs to numeric helper coordinates.
2. Either:
   - fall back to ordinary coordinate-reference-preserving export with a clear comment; or
   - preserve endpoint/vertex refs in emitted paths where possible.
3. Add regression tests for:
   - polygon/quad sheets with `surfaceDepthSort` enabled;
   - paths with `curveOcclusion` enabled.
4. Preserve normal non-ref auto-visibility behavior.

Preferred MVP policy:

```text
If a path/sheet contains coordinateRef sources, disable sampled auto-visibility export for that object and fall back to ordinary reference-preserving TikZ export with an explicit comment.
```

This is safer than trying to partially preserve refs inside sampled visibility output.

## Scope

This is a targeted Phase 26C fix.

Implement:

- detection of coordinateRef sources before sampled auto-visibility export;
- reference-preserving fallback for those objects;
- explicit fallback comments;
- tests for surface depth sorting and curve occlusion.

Do not implement:

- exact coordinate-ref-preserving depth sorting;
- exact coordinate-ref-preserving curve occlusion splitting;
- new visibility algorithms;
- new coordinateRef model fields;
- new UI features;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- normal coordinateRef export when visibility is disabled;
- normal auto-visibility export for objects without coordinateRef;
- coordinate anchor definitions;
- coordinateRef validation;
- SVG preview behavior;
- layer-aware output semantics;
- inline/standalone formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Inspect sampled auto-visibility export paths

Inspect `src/tikz/generateTikz.ts`.

Find all export paths that sample geometry and emit generated helper coordinates:

### Surface depth sorting

Look for code that:

- handles `surfaceDepthSort`;
- emits sorted faces from `ProjectedSurfaceFace`;
- uses `face.vertices3D`;
- calls `context.coordinates.define(...)` for face vertices;
- emits generated face coordinate names.

### Curve occlusion

Look for code that:

- handles `curveOcclusion`;
- emits visible/hidden sampled curve segments;
- creates generated coordinate names for sampled segment points;
- emits hidden-style draw commands.

The fix should guard these paths when the source object contains coordinateRef sources.

## 2. Add coordinateRef detection helper for export

Add or reuse a helper such as:

```ts
geometryContainsCoordinateRef(source): boolean
```

or more specific helpers:

```ts
pathContainsCoordinateRef(path): boolean
sheetContainsCoordinateRef(sheet): boolean
stratumContainsTikzPreservedCoordinateRef(stratum): boolean
```

Requirements:

- detect coordinateRef in supported path fields:
  - endpoints;
  - polyline vertices;
  - line segment start/end;
  - cubic controls;
  - arc start/end/center only if coordinateRef is supported there;
  - concatenated path segments.
- detect coordinateRef in simple sheet fields:
  - polygon/quad vertices;
  - filled simple boundaries if supported and export-preserving.
- do not flag unsupported coordinateRef locations that validation already rejects, except defensively.
- no false negatives for ordinary path endpoint refs or polygon sheet vertex refs.

## 3. Fallback policy for surface depth sorting

When `surfaceDepthSort` is enabled and a simple sheet/polygon/quad contains coordinateRef sources:

### Preferred behavior

Do not emit sampled sorted faces for that object.

Instead emit:

1. A concise comment:

```tex
% Auto surface depth sorting skipped for <name/id>: coordinate references are preserved by ordinary export.
```

2. The ordinary sheet export that preserves coordinate refs:

```tex
\filldraw ... (A) -- (B) -- (C) -- cycle;
```

Requirements:

- coordinate refs appear as `(tikzName)`;
- coordinate anchor definitions remain before use;
- sheet remains in the correct layer;
- style/fill opacity preserved;
- no generated numeric face coordinates for that object;
- other surfaces without coordinateRef may still be depth sorted.

### Alternative behavior

If preserving refs inside sampled face output is implemented, tests must prove `(A)`, `(B)`, etc. appear where appropriate and no silent numeric-only degradation occurs.

MVP fallback is strongly preferred.

## 4. Fallback policy for curve occlusion

When `curveOcclusion` is enabled and a path/curve contains coordinateRef sources:

### Preferred behavior

Do not emit sampled visible/hidden occlusion segments for that object.

Instead emit:

1. A concise comment:

```tex
% Curve occlusion skipped for <name/id>: coordinate references are preserved by ordinary export.
```

2. The ordinary path export that preserves coordinate refs:

```tex
\draw ... (A) -- (B);
```

Requirements:

- coordinate refs appear as `(tikzName)`;
- endpoint/mid arrows and path styles preserved through ordinary export;
- hidden/dotted occlusion is skipped only for that object;
- other curves without coordinateRef may still use occlusion;
- no generated numeric occlusion helper coordinates for that object.

### Important

This is a deliberate tradeoff:

```text
preserve maintainable TikZ coordinate references over auto-visibility sampling for coordinate-ref paths.
```

Document this in code/comment.

## 5. Preserve auto-visibility for non-ref objects

Do not disable all visibility features globally.

Only fall back per object when that object contains coordinateRef sources that would be degraded by sampling.

Required:

- sheet without coordinateRef still depth-sorts as before;
- path without coordinateRef still occlusion-splits as before;
- mixed diagram can contain:
  - normal sorted surfaces;
  - fallback ref-preserving sheet;
  - normal occluded curves;
  - fallback ref-preserving path.

## 6. Fallback comments

Comments should be explicit but concise.

Good examples:

```tex
% Surface depth sorting skipped for sheetName: coordinate references preserved by ordinary export.
```

```tex
% Curve occlusion skipped for pathName: coordinate references preserved by ordinary export.
```

Inline mode requirement:

- comments must not introduce blank lines;
- 4-space indentation preserved.

If the project has an existing fallback-comment style, reuse it.

## 7. Coordinate definitions

Ensure coordinate anchor definitions are still emitted before fallback ordinary exports.

Example expected output:

```tex
\coordinate (A) at (...);
\coordinate (B) at (...);
% Curve occlusion skipped for f: coordinate references preserved by ordinary export.
\draw ... (A) -- (B);
```

Do not emit `(A)` before defining `A`.

## 8. Layer-aware output

Fallback ordinary export must remain inside the correct layer context.

Requirements:

- if original path/sheet is on layer 2, fallback output appears in layer 2 block;
- layer ordering unchanged;
- `pgfonlayer` indentation preserved.

## 9. Arrows, braiding, and style interaction

For path fallback:

- preserve arrow options;
- preserve path styles;
- preserve segment style runs if ordinary export supports them;
- preserve braiding/crossing output behavior as ordinary export currently does.

If curve occlusion is skipped for a coordinateRef path, do not accidentally remove arrows or coordinate refs.

## 10. Tests

Add focused tests.

### Surface depth sorting with coordinateRef

1. Polygon/quad sheet with vertices referencing coordinate anchors exports `(A)`, `(B)`, `(C)` when `surfaceDepthSort` is disabled.

2. Same sheet with `surfaceDepthSort` enabled still exports `(A)`, `(B)`, `(C)`.

3. Same sheet with `surfaceDepthSort` enabled emits a fallback comment explaining depth sorting was skipped to preserve coordinate refs.

4. Same sheet does **not** emit generated numeric face helper coordinates for that object, such as `Face0p0`.

5. Other sheet without coordinateRef still uses depth-sorted sampled export when visibility option is enabled.

6. Layer-aware output preserved for the fallback sheet.

### Curve occlusion with coordinateRef

7. Path with endpoints referencing coordinate anchors exports `(A) -- (B)` when `curveOcclusion` is disabled.

8. Same path with `curveOcclusion` enabled still exports `(A) -- (B)`.

9. Same path with `curveOcclusion` enabled emits a fallback comment explaining occlusion was skipped to preserve coordinate refs.

10. Same path does **not** emit generated numeric occlusion helper coordinates for that object, such as `Occlusionp0`.

11. Path without coordinateRef still uses occlusion segmented output when enabled.

12. Hidden style output for non-ref paths remains unchanged.

13. Endpoint/mid arrows on coordinateRef path are preserved through fallback ordinary export.

### Formatting tests

14. Standalone output with fallback comments is valid-looking and includes coordinate definitions before references.

15. Inline output with fallback comments has no blank lines.

16. 4-space indentation preserved.

17. No NaN/Infinity in fallback output.

### Regression tests

18. Normal coordinateRef path/point/label/simple sheet export still passes.

19. Unsupported coordinateRef fields remain rejected.

20. Numeric/non-ref auto-visibility tests still pass.

21. Braiding/arrow tests still pass.

## 11. Defensive validation/export guard

Even if validation should reject unsupported refs, add defensive checks in sampled exporters:

- if source object contains coordinateRef in a location that would be sampled numerically, use fallback or emit a clear policy comment.
- do not silently sample to numeric helper coordinates.

This prevents future fields from reintroducing silent degradation.

## 12. Documentation/comments

Add a code comment near the fallback decision:

```text
Sampled auto-visibility export would replace coordinateRef sources with generated numeric helper coordinates. For coordinate-ref geometry we prefer ordinary reference-preserving export with an explicit comment.
```

Update user docs only if there is a Phase 26 coordinateRef limitations section.

Suggested doc note:

```text
When 3D auto-visibility is enabled, paths/sheets that use coordinate anchors are exported without sampled visibility splitting so that TikZ coordinate references remain readable.
```

## 13. Preserve existing behavior

Do not regress:

- coordinateRef model;
- supported coordinateRef validation;
- coordinate anchor definitions;
- normal path/point/label/simple sheet ref export;
- unsupported coordinateRef rejection;
- auto-visibility for non-ref geometry;
- hidden curve style export;
- surface depth sorting for non-ref sheets;
- layer-aware output;
- arrows;
- braiding;
- inline no-blank-lines;
- 4-space indentation;
- save/load;
- undo/redo.

## 14. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create coordinate anchors `A`, `B`, `C`.
2. Create a path using `A` and `B`.
3. Enable curve occlusion / auto visibility.
4. Generate TikZ.
5. Confirm output uses `(A)` and `(B)`, not generated numeric occlusion coordinates.
6. Confirm fallback comment appears.
7. Create a polygon sheet using `A`, `B`, `C`.
8. Enable surface depth sorting.
9. Generate TikZ.
10. Confirm sheet uses `(A)`, `(B)`, `(C)` and fallback comment appears.
11. Create a similar path/sheet without coordinate refs.
12. Confirm auto-visibility still uses sampled output.

## 15. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 16. Report after implementation

Please report:

- files modified;
- root cause of coordinateRef degradation in auto-visibility export;
- coordinateRef detection helper;
- surface depth sorting fallback behavior;
- curve occlusion fallback behavior;
- fallback comment wording;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
