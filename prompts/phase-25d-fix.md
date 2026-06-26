# Phase 25D Fix Prompt: Compare symbolic work-plane frame metadata, not only preview values

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

## Medium issue

`sameWorkPlaneFrame(...)` compares frame previews, not symbolic frame metadata.

Review location:

```text
src/tikz/generateTikz.ts
sameWorkPlaneFrame
```

Current problem:

- Two work-plane-local frames with different symbolic origins or basis expressions can have equal preview values.
- The exporter treats them as the same frame because it compares only numeric preview values.
- It then emits one `canvas is plane` scope using only one frame's symbolic/numeric data.
- This silently drops the symbolic intent of the other frame.

Reproduced example:

- Point A uses a local frame whose origin expression is `R`.
- Point B uses a local frame whose origin expression is `S`.
- Both variables currently preview to `2`.
- The exporter merges both points into one `canvas is plane` scope using only `\R`.
- The `\S`-based frame is lost in the generated TikZ.

This matches the Phase 25D checklist issue:

```text
mixed-frame symbolic loss
```

## Goal

Fix Phase 25D mixed symbolic frame detection.

Work-plane frame equality for local-symbolic TikZ export must compare symbolic coordinate metadata/expressions, not only preview values.

Required behavior:

1. Frames with identical numeric preview values but different symbolic frame metadata must be treated as mixed/different frames.
2. The exporter must not merge those coordinates into one `canvas is plane` scope.
3. The generated TikZ must not silently drop one frame's symbol.
4. Identical frames should still be recognized as identical when their symbolic metadata and preview values match.
5. Numeric-only frames should continue to compare by existing tolerance-based preview equality.
6. Add regression tests for equal-preview frames with origins `R` and `S`.

## Scope

This is a targeted Phase 25D fix.

Implement:

- symbolic-aware work-plane frame equality/signature;
- safer grouping of local coordinates by frame;
- tests for equal-preview but symbolically different frames;
- preservation of existing numeric-frame and identical-symbolic-frame behavior.

Do not implement:

- new work-plane model;
- new symbolic expression simplifier;
- new global symbolic expansion;
- new UI features;
- broad TikZ generator rewrite;
- new dependencies.

Do not change:

- work-plane-local coordinate data model unless a tiny helper field is unavoidable;
- valid same-frame local TikZ export behavior;
- variable macro emission;
- layer-aware output;
- inline/standalone export formatting;
- 4-space indentation;
- inline no-blank-lines invariant;
- SVG preview behavior;
- save/load behavior.

## 1. Inspect current frame comparison and grouping

Inspect:

- `src/tikz/generateTikz.ts`;
- `sameWorkPlaneFrame(...)`;
- local-symbolic coordinate grouping logic;
- `canvas is plane` scope generation;
- frame serialization / frame snapshot type;
- symbolic coordinate/scalar types.

Find all places where work-plane frames are compared for local TikZ export.

The review specifically points to `sameWorkPlaneFrame(...)`, but there may also be frame grouping keys or helper functions elsewhere.

## 2. Define symbolic-aware frame equality

A work-plane frame contains, conceptually:

```text
origin
u
v
normal
```

Each of these may include:

- numeric preview coordinates;
- symbolic coordinate metadata;
- local/source metadata;
- scalar expressions.

Frame equality for TikZ local-scope grouping should use both:

1. numeric preview equality within tolerance; and
2. symbolic/source metadata equality.

### Required policy

Two frames are considered the same for `canvas is plane` grouping only if:

- their preview `origin`, `u`, `v`, and `normal` are equal within tolerance; and
- their symbolic/source metadata for those fields is equivalent.

If any symbolic/source metadata differs, treat frames as different.

Examples:

### Same numeric frame

```text
origin = (2,0,0) numeric
origin = (2,0,0) numeric
```

Same, if all basis vectors match.

### Identical symbolic frame

```text
origin.x = R
origin.x = R
```

Same, if previews and all other frame fields match.

### Different symbolic frame with equal preview

```text
origin.x = R, preview 2
origin.x = S, preview 2
```

Different.

### Numeric vs symbolic with equal preview

```text
origin.x = 2
origin.x = R, preview 2
```

Conservative policy: different.

This avoids silently dropping the symbolic expression.

## 3. Add frame signature helper

Add a helper such as:

```ts
workPlaneFrameSymbolicSignature(frame): string
```

or:

```ts
compareWorkPlaneFrameSources(a, b): boolean
```

or both.

The signature should include all relevant fields:

- origin x/y/z source/expression;
- u x/y/z source/expression;
- v x/y/z source/expression;
- normal x/y/z source/expression.

Requirements:

- deterministic;
- includes symbolic expressions and numeric values;
- does not rely only on preview values;
- handles missing/legacy numeric-only frames;
- rejects or treats malformed metadata as unequal rather than merging.

Do not over-normalize expressions.

For MVP, string equality of canonical stored expression text is acceptable.

Examples:

```text
R
(R)
R + 0
```

may be treated as different unless the existing expression parser has canonicalization. That is acceptable and safer.

## 4. Update `sameWorkPlaneFrame(...)`

Update `sameWorkPlaneFrame(...)` or equivalent so it:

1. first checks numeric preview equality within tolerance;
2. then checks symbolic/source metadata equality;
3. returns false if metadata differs.

This function should not consider equal previews alone sufficient.

If the function is also used outside TikZ export for UI/preview grouping, be careful. If some callers truly need preview-only equality, split into two helpers:

```ts
sameWorkPlaneFramePreview(...)
sameWorkPlaneFrameForTikzLocalScope(...)
```

Use the symbolic-aware one for TikZ export grouping.

## 5. Update local-scope grouping behavior

When a path/sheet/collection has local coordinates whose frames are not symbolically identical:

- do not merge them into a single `canvas is plane` scope.

Use the existing mixed-frame policy.

Preferred behavior:

- emit explicit mixed-frame fallback/comment;
- or emit separate local scopes when possible;
- but never silently use one frame for all.

If the existing mixed-frame policy falls back to numeric/global preview output with a comment, use that policy.

Important:

- generated TikZ should not lose a symbol silently.
- In the `R` vs `S` equal-preview repro, output should either:
  - contain separate scopes preserving both `\R` and `\S` where possible; or
  - use the existing mixed-frame fallback with an explicit policy comment.
- It must not emit one scope using only `\R` for both points.

## 6. Variable macro emission

Ensure variable macro emission remains correct.

For the repro:

- if output preserves both frames symbolically, macros for both `\R` and `\S` should be emitted before use.
- if mixed-frame fallback uses numeric preview values, the output should include a comment explaining the fallback and should not pretend the second point uses `\R`.

Do not emit unresolved variables.

## 7. Tests

Add focused regression tests.

### Frame equality tests

1. Numeric identical frames compare equal.

2. Numeric frames with different preview values compare different.

3. Identical symbolic frames compare equal.

Example:

```text
origin.x = R
origin.x = R
```

4. Symbolically different frames with equal previews compare different.

Example:

```text
frameA.origin.x = R, R preview 2
frameB.origin.x = S, S preview 2
```

5. Numeric frame and symbolic frame with equal preview compare different under the conservative TikZ grouping policy.

Example:

```text
origin.x = 2
origin.x = R, preview 2
```

6. Difference in basis symbolic metadata also makes frames different:

```text
u.x = A
u.x = B
```

even if previews match.

### TikZ export tests

7. Two local points with same symbolic frame `R` export in one `canvas is plane` scope, preserving local expressions.

8. Two local points with frame origins `R` and `S` with equal previews do **not** merge into one `canvas is plane` scope using only `\R`.

Assert one of the following, depending on chosen policy:

- output contains separate scopes and both `\R` and `\S`; or
- output uses mixed-frame fallback/comment and does not incorrectly use only `\R`.

9. A local path whose vertices have symbolically different equal-preview frames triggers mixed-frame policy.

10. A local sheet whose vertices have symbolically different equal-preview frames triggers mixed-frame policy.

11. Required variables are emitted before use when both symbolic frames are preserved.

12. Inline output remains blank-line-free.

13. 4-space indentation preserved.

### Regression tests

14. Existing same-frame path/sheet local TikZ export tests still pass.

15. Numerically different mixed-frame local paths still fall back with existing policy.

16. Numeric/global export unchanged.

17. Layer-aware output preserved.

## 8. Avoid false positives from preview-only tests

The review issue exists because preview-only equality made tests pass.

Add tests that specifically assert symbolic metadata matters.

Do not write only:

```ts
expect(frameA.preview).toEqual(frameB.preview)
```

Instead assert:

```ts
expect(sameWorkPlaneFrameForTikzLocalScope(frameA, frameB)).toBe(false)
```

for `R` vs `S`.

## 9. Documentation/comments

Add a code comment near the frame comparison helper:

```text
TikZ local-scope grouping must compare symbolic frame metadata, not only preview values. Equal previews can come from different symbolic expressions, and merging them would drop symbolic intent.
```

Update docs only if there is user-visible mixed-frame behavior clarification.

## 10. Preserve existing behavior

Do not regress:

- same-frame local symbolic points/labels/paths/sheets;
- local expression preservation;
- variable macro emission;
- layer-aware output;
- `canvas is plane` scope syntax;
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
- root cause of symbolic frame merging;
- new frame equality/signature policy;
- how numeric-only frames compare;
- how symbolic frames compare;
- mixed-frame export behavior for equal-preview different-symbol frames;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
