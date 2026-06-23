# Phase 22C Fix Prompt: Cap path intersection sampling options

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

Phase 22C implemented 2D path intersection detection for string diagrams.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Path intersection sampling options are still unbounded.

Review details:

- `cubicSamples`, `arcSamples`, and `templateSamples` are accepted as any positive finite number.
- They are then used directly in loops in `src/geometry/pathIntersections.ts`.
- Template sampling is also only minimum-clamped in `src/model/paths.ts`.
- The detector is called from SVG rendering in `src/rendering/SvgDiagram.tsx`.
- Therefore future or external callers can accidentally drive unbounded preview work by passing huge sampling values.
- The Phase 22C review checklist explicitly treats unbounded path sampling as a Medium issue.

What already looks correct:

- Detection is 2D-only.
- Detection filters to 2D curve strata.
- Intersections are only between distinct path objects.
- Shared open endpoints and collinear overlaps are skipped.
- Straight, cubic, arc, and circle-template cases are covered.
- Non-finite geometry is filtered before candidates are returned.
- SVG markers are preview/UI-only.
- 3D diagrams return no candidates.

## Goal

Cap Phase 22C path intersection sampling options to finite documented maxima.

Specifically:

- cap `cubicSamples`;
- cap `arcSamples`;
- cap `templateSamples`;
- keep existing default sampling values unchanged;
- prevent huge caller-provided values from creating unbounded SVG preview work;
- add tests for excessive sampling values;
- preserve existing detection behavior for normal/default values.

## Scope

This is a targeted Phase 22C robustness fix.

Implement:

- bounded normalization of intersection sampling options;
- documented maximum values;
- tests for excessive `cubicSamples`, `arcSamples`, and `templateSamples`;
- preservation of existing defaults.

Do not implement:

- new intersection algorithms;
- exact analytic Bézier intersection;
- new braiding behavior;
- new UI features;
- new path types;
- new dependencies;
- broad rendering refactors.

Do not change:

- default sampling values;
- 2D-only behavior;
- shared endpoint policy;
- collinear overlap policy;
- SVG marker semantics;
- TikZ generation;
- save/load format;
- path geometry.

## 1. Inspect current sampling option flow

Inspect:

- `src/geometry/pathIntersections.ts`;
- any exported intersection detector options type;
- default options for:
  - `cubicSamples`;
  - `arcSamples`;
  - `templateSamples`;
- path/template sampling helpers in `src/model/paths.ts`;
- `SvgDiagram.tsx` call site;
- tests for path intersections.

Find every place where caller-provided sampling counts are used directly in loops.

The review mentions examples around:

```text
pathIntersections.ts
paths.ts
SvgDiagram.tsx
```

## 2. Add documented maximum sampling constants

Add central constants, for example:

```ts
const MAX_INTERSECTION_CUBIC_SAMPLES = 128;
const MAX_INTERSECTION_ARC_SAMPLES = 128;
const MAX_INTERSECTION_TEMPLATE_SAMPLES = 256;
```

Exact values can differ, but they should be:

- high enough for reasonable intersection detection;
- low enough to prevent accidental freezing;
- documented in code comments.

If the project already has sampling cap constants, reuse them or align naming.

Requirements:

- defaults unchanged;
- maxima finite;
- maxima tested;
- no magic numbers scattered across files.

## 3. Normalize sampling options

Add a helper such as:

```ts
normalizePathIntersectionOptions(options?: Partial<PathIntersectionOptions>): NormalizedPathIntersectionOptions
```

or:

```ts
normalizeIntersectionSampleCount(value, defaultValue, maxValue): number
```

Required behavior:

- `undefined` uses the existing default;
- non-finite values use default or reject according to existing style;
- values <= 0 use default or minimum according to existing style;
- positive finite values above max are clamped to max;
- fractional values are floored/rounded consistently;
- normalized values are positive integers;
- no loop receives an unbounded caller-provided value.

Preferred:

```ts
normalized = Math.min(max, Math.max(min, Math.floor(value)))
```

with explicit finite checks.

## 4. Apply normalization at the public boundary

Any exported detector should normalize options once at the entry point.

Example:

```ts
export function detectPathIntersections(diagram, options) {
  const normalized = normalizePathIntersectionOptions(options);
  ...
}
```

Requirements:

- internal helpers receive normalized values;
- external callers cannot bypass caps accidentally;
- SVG rendering path uses normalized values;
- tests can import the normalizer if useful.

## 5. Fix template sampling cap in paths.ts

The review notes that template sampling is only minimum-clamped in `src/model/paths.ts`.

If that helper is used for intersection detection, add a safe cap there too or pass a normalized capped value before calling it.

Important:

- do not globally change all template sampling behavior unless intended;
- if `paths.ts` has a general-purpose sampler, consider adding an optional `maxSamples` or using a separate intersection-specific wrapper.

Preferred minimal fix:

- keep general sampler behavior if other features rely on it;
- ensure the intersection detector passes a capped `templateSamples` value to it;
- if the general sampler is exported and unsafe, add its own cap as well and update tests.

## 6. Behavior for excessive values

If caller passes:

```ts
cubicSamples: 1_000_000
arcSamples: 1_000_000
templateSamples: 1_000_000
```

the detector should:

- not freeze;
- clamp to documented maxima;
- still return deterministic results;
- not throw solely because the value is large, unless the project prefers rejection.

Preferred policy:

- clamp, not reject.

Reason:

- the detector is used for preview;
- clamping keeps rendering robust.

If you choose rejection, ensure SVG caller catches it and does not crash. Clamping is safer for preview.

## 7. Tests

Add focused tests.

### Normalization tests

1. Default options remain unchanged.

2. `cubicSamples` above max clamps to max.

3. `arcSamples` above max clamps to max.

4. `templateSamples` above max clamps to max.

5. `Infinity`, `NaN`, and negative values do not reach loops.

6. Fractional sample counts normalize to finite positive integers.

### Detector behavior tests

7. Detector with excessive `cubicSamples` completes and returns finite candidates.

8. Detector with excessive `arcSamples` completes and returns finite candidates.

9. Detector with excessive `templateSamples` completes and returns finite candidates.

10. Excessive sampling values do not change simple line-line detection behavior.

11. For a cubic/line intersection fixture, excessive `cubicSamples` produces a valid result without unbounded work.

12. For an arc/line intersection fixture, excessive `arcSamples` produces a valid result without unbounded work.

13. For a circle/line or template/line fixture, excessive `templateSamples` produces a valid result without unbounded work.

### Loop/cap tests

14. If a sampling helper can expose generated sample count, assert it never exceeds the max.

15. Template sampling called from intersection detection never receives more than the capped value.

### Regression tests

16. Existing default intersection tests still pass.

17. 3D diagrams still return no candidates.

18. Shared endpoint and collinear overlap policies unchanged.

19. SVG marker rendering does not crash with capped excessive options if helper-testable.

## 8. Avoid performance-heavy tests

Do not add tests that actually iterate millions of samples.

Instead, pass huge values and assert the normalized values are capped.

If you test detector completion, use small geometry and rely on the cap.

## 9. Documentation/comments

Add comments near the sampling option type/defaults:

```text
Intersection detection runs in SVG preview. Caller-provided sampling counts are capped to avoid unbounded preview work.
```

Update docs if Phase 22C documentation mentions sampling:

- cubic/arc/template intersection detection is sampled;
- sample counts are capped;
- dense diagrams may approximate intersections.

## 10. Preserve existing behavior

Do not regress:

- 2D-only detection;
- distinct path filtering;
- deterministic path ordering;
- shared endpoint skipping;
- collinear overlap skipping;
- finite candidate filtering;
- SVG marker preview-only behavior;
- 3D no-candidate behavior;
- future braiding phases;
- SVG preview responsiveness;
- TikZ generation;
- save/load;
- undo/redo.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual check:

1. Open a 2D diagram with crossing paths.
2. Confirm crossing markers still appear.
3. Open a 3D diagram.
4. Confirm no 2D braiding markers appear.
5. If there is a way to tweak sampling options in development, set huge sample values.
6. Confirm preview remains responsive.

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
- maximum sampling constants chosen;
- normalization behavior;
- whether excessive values clamp or reject;
- how `paths.ts` template sampling is protected;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
