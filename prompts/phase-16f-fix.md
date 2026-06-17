# Phase 16F Fix Prompt: Make nextUnusedLayerValue terminate for huge layer values

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

Phase 16F implemented Layer Manager polish and regression hardening.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

`src/model/layers.ts` has a helper `nextUnusedLayerValue`.

Current problem:

- `nextUnusedLayerValue` can loop forever for large finite layer values.
- Example layer value:

```ts
9007199254740992
```

- This is finite, but in JavaScript:

```ts
9007199254740992 + 1 === 9007199254740992
```

- Therefore, if `candidate = sourceLayer + 1` and `usedLayers.has(candidate)` remains true, `candidate` never advances.
- `src/ui/LayerManager.tsx` calls this helper during render for the duplicate target default.
- Loading or creating such a layer can freeze the Layer Manager render path.

This violates Phase 16F's robustness goal.

## Goal

Fix `nextUnusedLayerValue` so it always terminates for finite layer values.

Layer Manager duplicate default computation must never freeze during render.

If no safe next finite/progressing layer can be derived, the duplicate target default should be rejected, omitted, or disabled safely.

Add regression tests for huge finite layer values such as:

```ts
9007199254740992
```

## Scope

This is a targeted Phase 16F robustness fix.

Implement:

- termination-safe `nextUnusedLayerValue`;
- safe UI behavior when no default duplicate target can be derived;
- tests for huge finite layer values.

Do not implement:

- new Layer Manager features;
- multi-selection;
- affine transforms;
- new geometry;
- new export features;
- broad UI redesign;
- new dependencies.

Do not change:

- layer metadata model unless absolutely necessary;
- normal duplicate/delete/swap/translate semantics;
- TikZ layer output semantics;
- save/load format unless absolutely necessary;
- SVG rendering semantics;
- geometry model.

## 1. Fix nextUnusedLayerValue termination

Inspect:

- `src/model/layers.ts`;
- `nextUnusedLayerValue`;
- any layer value validation helpers;
- duplicate layer helper;
- Layer Manager duplicate target default logic.

Update `nextUnusedLayerValue` so it cannot loop forever.

Requirements:

1. The helper must always terminate.
2. It must not rely on `candidate += 1` if that operation stops changing the number.
3. It must reject or return no result when it cannot find a safe finite candidate.
4. It must not return `NaN` or `Infinity`.
5. It must not return a candidate that is already used.
6. It must preserve normal behavior for ordinary layer values such as:
   - `-1`;
   - `0`;
   - `1`;
   - `2`;
   - sparse layers like `0`, `10`;
   - decimal layer values if the project currently supports them.

Acceptable implementation options:

### Option A: Result/nullable helper

Change the helper to return:

```ts
number | null
```

or a result object:

```ts
{ ok: true; value: number } | { ok: false; reason: string }
```

When no safe next value can be found, return `null` or failure.

### Option B: Bounded search

Keep returning `number`, but use a bounded search and throw a clear error if no candidate can be found.

This is acceptable for model helpers, but UI render paths must catch or avoid throwing during render.

### Option C: Safe integer policy for generated defaults

For default duplication targets, search within safe integer layer values only.

Example:

- try `sourceLayer + 1` only if it produces a finite value and progresses;
- otherwise search a bounded range of safe integer candidates such as `0, 1, 2, ...`;
- if no candidate found, return `null` / failure.

Choose the smallest safe option consistent with existing code style.

## 2. Detect non-progressing numeric increments

If the helper uses incremental candidate search, explicitly detect non-progressing increments.

Example:

```ts
const next = candidate + 1;
if (next === candidate || !Number.isFinite(next)) {
  return null;
}
candidate = next;
```

or use a different bounded strategy.

Do not allow a `while (usedLayers.has(candidate))` loop without a guaranteed progress condition.

## 3. Layer Manager duplicate default behavior

Inspect `src/ui/LayerManager.tsx` around duplicate target default computation.

Current issue:

- `nextUnusedLayerValue` is called during render.
- If it loops, the UI freezes.

Required behavior:

- Layer Manager render must never call a potentially non-terminating function.
- If no safe default duplicate target exists:
  - disable duplicate controls for that layer; or
  - show a concise message; or
  - leave the target field empty and require manual input.
- The UI must remain responsive.
- The user must not be able to commit duplicate to an invalid target layer.
- The duplicate operation helper must still validate the target layer at commit time.

Suggested UI text:

```text
No safe default target layer
```

or:

```text
Choose target layer manually
```

If manual target input exists, allow the user to enter a valid finite target layer.

## 4. Validation policy

Do not broaden or tighten the global layer-value policy unnecessarily.

If the existing model allows any finite numeric layer value, keep that unless the project already decided to require safe integers.

However, generated defaults must be safe.

If you decide to reject unsafe layer values globally, that is a larger behavioral change and must be justified, tested, and save/load compatibility must be considered.

Preferred targeted policy:

- existing finite layer values can continue to exist if the model currently permits them;
- automatic default generation refuses unsafe/non-progressing candidates;
- UI duplicate default disables or asks for manual target when needed.

## 5. Tests

Add focused tests.

Required tests for `nextUnusedLayerValue`:

1. Ordinary source layer works:

```ts
used = new Set([0])
nextUnusedLayerValue(0, used) === 1
```

or equivalent.

2. Sparse layer values work:

```ts
used = new Set([0, 1, 2, 10])
source = 2
result is finite and unused
```

3. Negative layer values work if currently supported:

```ts
used = new Set([-1, 0])
source = -1
result is finite and unused
```

4. Huge finite layer value does not loop:

```ts
source = 9007199254740992
used = new Set([9007199254740992])
```

Expected:

- helper returns `null` / failure / safe fallback; or
- throws a clear bounded error outside render path.

It must not hang.

5. Huge finite layer with `source + 1 === source` is handled explicitly.

6. `Infinity`, `-Infinity`, and `NaN` source values are rejected if the helper accepts runtime inputs.

7. Candidate collision loop has a bound/progress check.

Required UI/helper tests:

8. Layer Manager duplicate default does not hang for a layer value like `9007199254740992`.

9. Duplicate button is disabled or target is empty when no safe default can be derived.

10. Duplicate commit rejects invalid target layer.

Regression tests:

11. Normal duplicate layer behavior still works.

12. Duplicate still creates new IDs and correct target layer for ordinary values.

13. Existing combined-operation tests still pass.

## 6. Avoid render-path hazards

Do not put expensive or unbounded searches directly in render.

If duplicate defaults are computed during render:

- make the computation bounded;
- memoize if needed;
- handle failure without throwing;
- avoid loops over enormous ranges.

Do not scan from `Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`.

## 7. Documentation/comments

Add a small comment near `nextUnusedLayerValue` explaining:

- JavaScript numbers can stop progressing at large magnitudes;
- the helper must be bounded/progress-safe;
- failure is possible when no safe default can be derived.

Update docs only if the user-facing duplicate behavior changes.

## 8. Preserve existing behavior

Do not regress:

- layer metadata derivation;
- layer rename;
- layer swap;
- layer duplicate for normal layer values;
- layer delete;
- layer translation;
- layer visibility/locking;
- layer filter;
- creation layer;
- inspector layer editing;
- save/load;
- undo/redo;
- SVG preview;
- TikZ layer output;
- all geometry rendering;
- previous Phase 16F functional-updater fixes.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify ordinary behavior:

1. Open Layer Manager.
2. Duplicate a normal layer, e.g. layer `0`.
3. Confirm duplicate works.
4. Delete/swap/translate still work.
5. Undo/redo still work.

Verify large layer behavior if practical:

6. Load or construct a diagram with a layer value `9007199254740992`.
7. Open Layer Manager.
8. Confirm the UI does not freeze.
9. Confirm duplicate target default is disabled, empty, or safely handled.
10. Confirm invalid duplicate target cannot be committed.
11. Confirm manual valid target works if manual input is supported.

## 10. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 11. Report after implementation

Please report:

- files modified;
- root cause of the infinite-loop risk;
- new `nextUnusedLayerValue` behavior;
- whether helper returns `null`, result object, or throws on failure;
- how non-progressing increments are detected;
- how Layer Manager handles missing default duplicate target;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
