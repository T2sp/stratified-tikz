# Phase 25D Fix Prompt: Fallback local-symbolic points and labels to global preview coordinates when frame scope export is unsupported

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

Recent fixes added a guard so `plane origin`, `plane x`, and `plane y` do not silently drop `Vec3.symbolic.source` metadata when a stored work-plane frame cannot be faithfully represented in a `canvas is plane` scope.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Work-plane-local points and free text labels with a non-exportable stored frame are currently omitted instead of falling back to finite global preview coordinates.

Review details:

- The new frame guard correctly rejects `symbolic.source` metadata in frame options.
- However, in `src/tikz/generateTikz.ts`, the point/label local export paths currently return omission comments when their stored frame cannot be emitted as a `canvas is plane` scope.
- Curves and sheets already use an explicit global-preview fallback policy in similar unsupported-frame cases.
- Points and labels have finite absolute model positions, so omitting them loses visible diagram content.

Required behavior:

- Work-plane-local points and labels whose stored frame cannot be emitted as a `canvas is plane` scope should fall back to finite global model/preview coordinates.
- The fallback must include an explicit symbolic-intent warning/comment.
- This should match the curve/sheet fallback policy.
- Add standalone and inline TikZ tests.

## Goal

Fix Phase 25D TikZ export so unsupported-frame work-plane-local points and free text labels are not dropped.

Specifically:

1. If a point or label has a work-plane-local coordinate source but its stored frame cannot be emitted in a `canvas is plane` scope, export it using its finite global preview/model coordinate.
2. Emit an explicit comment warning that symbolic work-plane-local frame intent could not be preserved and global preview fallback was used.
3. Do not silently omit the point/label.
4. Do not silently emit a misleading local scope.
5. Preserve existing local `canvas is plane` export for points/labels when the frame is exportable.
6. Preserve existing curve/sheet fallback behavior.
7. Add tests for both standalone and inline output.

## Scope

This is a targeted Phase 25D fix.

Implement:

- point fallback to finite global preview coordinates when local frame scope export is unsupported;
- free text label fallback to finite global preview coordinates when local frame scope export is unsupported;
- explicit fallback warning comments;
- tests for standalone and inline output;
- no-blank-line inline preservation.

Do not implement:

- full symbolic global expansion of unsupported frames;
- new work-plane coordinate model;
- new UI features;
- broad TikZ generator rewrite;
- new export mode;
- new dependencies.

Do not change:

- same-frame local symbolic point/label export when the frame is exportable;
- local symbolic path/sheet export;
- curve/sheet fallback semantics except for shared helper reuse;
- variable macro emission policy;
- layer-aware output;
- 4-space indentation;
- inline no-blank-lines invariant;
- SVG preview behavior;
- save/load behavior.

## 1. Inspect point and label local export paths

Inspect `src/tikz/generateTikz.ts`.

Review locations:

```text
src/tikz/generateTikz.ts around point local export
src/tikz/generateTikz.ts around free text label local export
```

Find the branches that currently do something like:

```text
if frame cannot be formatted:
    return omission comment
```

or:

```text
unsupported frame -> omit point/label
```

These branches should be changed to fallback output.

## 2. Define fallback policy for points and labels

When a point or label coordinate is work-plane-local but its frame cannot be exported as a valid local `canvas is plane` scope:

### Required output

Use the finite global preview/model coordinate.

Example concept:

```tex
% Work-plane-local point "p" uses a frame that cannot be represented as a canvas-is-plane scope; using finite global preview coordinates.
\filldraw[...] (2,0,0) circle (...);
```

For labels:

```tex
% Work-plane-local label "label1" uses a frame that cannot be represented as a canvas-is-plane scope; using finite global preview coordinates.
\node[...] at (2,0,0) {Label};
```

Exact command syntax should match existing point/label export style.

### Required comment

The comment must make clear:

- symbolic/local frame intent was not preserved;
- finite global preview fallback was used;
- content was not omitted.

Keep the comment concise.

Suggested text:

```tex
% Work-plane-local frame for point <name> could not be emitted symbolically; using global preview coordinates.
```

```tex
% Work-plane-local frame for label <name> could not be emitted symbolically; using global preview coordinates.
```

Use existing project comment style if available.

### Requirements

- output must include the point/label command;
- output must not be only an omission comment;
- output must not silently drop the element;
- output must not emit a misleading `canvas is plane` scope using incomplete frame symbolism;
- fallback coordinates must be finite;
- if the preview/model coordinate is non-finite, reject/omit with existing invalid-geometry policy, not fallback.

## 3. Match curve/sheet fallback policy

Find existing curve/sheet mixed-frame or unsupported-frame fallback comments and behavior.

Prefer reusing the same helper/policy.

If existing behavior is:

```text
emit explicit policy comment
emit global preview path/sheet
```

then points and labels should do the same.

Add helper if useful:

```ts
formatLocalSymbolicFrameFallbackComment(kind, nameOrId)
```

or:

```ts
emitGlobalPreviewFallbackForLocalPoint(...)
emitGlobalPreviewFallbackForLocalLabel(...)
```

Do not duplicate inconsistent warning wording if a shared policy exists.

## 4. Preserve layer-aware output

Points and labels may be emitted inside layer blocks.

Requirements:

- fallback point/label output remains in the correct layer;
- layer ordering unchanged;
- `pgfonlayer` formatting unchanged;
- inline output no blank lines;
- 4-space indentation preserved.

If the local-scope export path used a nested scope inside a layer, the fallback should still be placed in the same layer context.

## 5. Preserve variable macro behavior

If the fallback uses numeric global preview coordinates and no symbolic expressions remain in the emitted point/label command:

- do not require extra variable macros solely for that point/label unless project policy emits all diagram variables.
- But if other commands still use variables, preserve those macros.

If the comment mentions the symbol names, it should not require macros.

Do not emit unresolved symbolic expressions.

## 6. Local export still works when frame is exportable

Do not regress the successful case.

For a point or label whose work-plane-local frame can be emitted:

- keep exporting inside a local `canvas is plane` scope;
- preserve local expressions `a,b`;
- preserve variable macros;
- preserve layer output.

Only unsupported-frame cases should fallback.

## 7. Tests

Add targeted tests.

### Point fallback tests

1. A work-plane-local point with an unsupported stored frame containing `Vec3.symbolic.source` is exported using finite global preview coordinates, not omitted.

2. Output contains an explicit fallback warning/comment.

3. Output does not contain only an omission comment.

4. Output does not emit a misleading `canvas is plane` scope for that unsupported frame.

5. The point command is inside the correct layer if layer output is enabled.

### Label fallback tests

6. A work-plane-local free text label with an unsupported stored frame containing `Vec3.symbolic.source` is exported using finite global preview coordinates, not omitted.

7. Output contains an explicit fallback warning/comment.

8. The label text is preserved.

9. The label command is inside the correct layer if layer output is enabled.

### Inline formatting tests

10. Inline math output with a fallback point has no blank lines.

11. Inline math output with a fallback label has no blank lines.

12. 4-space indentation is preserved.

### Standalone tests

13. Standalone output with fallback point includes fallback comment and point command.

14. Standalone output with fallback label includes fallback comment and label command.

### Regression tests

15. Exportable local-symbolic point still emits local `canvas is plane` scope and local expressions.

16. Exportable local-symbolic label still emits local `canvas is plane` scope and local expressions.

17. Curves/sheets unsupported-frame fallback remains unchanged.

18. Numeric/global point and label export unchanged.

19. Variable macro emission tests still pass.

20. No NaN/Infinity appears in fallback output.

## 8. Constructing the test fixture

Create a minimal diagram with:

- one point or label;
- coordinate source is work-plane-local;
- the stored frame origin has `Vec3.symbolic.source` metadata that the current frame formatter cannot represent;
- the global preview coordinate is finite, e.g. `(2,0,0)`.

Example conceptual setup:

```text
frame.origin.preview = (2, 0, 0)
frame.origin.symbolic.source = workPlaneLocal(... local a = R ...)
point.local = (0, 0)
point.preview = (2, 0, 0)
```

The exact structure should match the current model.

The key assertion:

```text
output includes the point/label command at finite global coordinates
output includes fallback warning
output does not omit the element
```

## 9. Error handling

If fallback cannot be used because the preview/global coordinate is non-finite:

- use existing invalid-coordinate behavior;
- do not output invalid TikZ;
- provide a useful warning/error if the generator has such mechanism.

Do not use numeric fallback for non-finite previews.

## 10. Documentation/comments

Add a code comment near the fallback branch:

```text
Points and labels have finite absolute preview positions. If their local frame cannot be emitted as a canvas-is-plane scope, preserve visible content by falling back to global preview coordinates with an explicit symbolic-intent warning.
```

Update user docs only if there is a section on work-plane-local symbolic export limitations.

## 11. Preserve existing behavior

Do not regress:

- same-frame local symbolic point/label export;
- same-frame local symbolic path/sheet export;
- mixed-frame path/sheet fallback;
- variable macro emission;
- layer-aware output;
- inline no-blank-lines;
- 4-space indentation;
- numeric/global point/label export;
- SVG preview;
- save/load;
- undo/redo.

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
- root cause of point/label omission;
- fallback policy for unsupported-frame points;
- fallback policy for unsupported-frame labels;
- fallback comment wording;
- standalone tests added;
- inline tests added;
- test results;
- build results;
- remaining limitations.
