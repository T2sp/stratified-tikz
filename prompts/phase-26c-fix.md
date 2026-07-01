# Phase 26C Fix Prompt: Tighten coordinateRef support boundaries and avoid silent numeric degradation

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

Phase 26C introduced coordinate-anchor references (`coordinateRef`) so paths, sheets, labels, and points can reference global TikZ coordinate anchors and export readable TikZ such as:

```tex
\coordinate (A) at (...);
\draw (A) -- (B);
\node at (A) {...};
```

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- Two Medium issues remain.

## Medium issue 1: Unsupported coordinateRef sources can validate in work-plane frame fields

Current problem:

- The symbolic-source collector walks work-plane frame fields such as:

```text
origin
u
v
normal
```

as generic supported `Vec3` values.
- That path marks `coordinateRef` as supported.
- But `validateDiagramCoordinateReferences(...)` does not validate coordinate references in those frame fields.
- Therefore a missing coordinate id inside a frame field can pass `validateDiagram`.

Reproduced case:

```text
grid.frame.frame.origin.symbolic.source = { kind: "coordinateRef", coordinateId: "missing" }
```

This passes validation even though the referenced coordinate does not exist.

This is an unsupported-field acceptance bug.

## Medium issue 2: Curved sheet coordinate refs are accepted/resolved but exported as numeric sampled mesh coordinates

Current problem:

- Coordinate refs inside curved sheet primitives are included in reference resolution/validation.
- But curved sheet export samples the primitive into a numeric mesh.
- The sampled mesh uses generated numeric coordinates and does not preserve `(A)` references.
- Example:
  - a hemisphere center references coordinate anchor `A`;
  - TikZ export emits the `\coordinate (A)` definition;
  - but the sheet faces do not reference `(A)`;
  - the reference is silently degraded to numeric sampled mesh coordinates.

This violates the Phase 26C goal: coordinate refs should either be preserved in TikZ or explicitly rejected/unsupported. They must not silently become numeric output.

## Goal

Fix Phase 26C coordinate-reference support boundaries.

Specifically:

1. Reject `coordinateRef` sources in unsupported frame/derived fields unless full validation/resolution/export support is implemented.
2. Ensure coordinateRef support coverage is consistent across:
   - collection;
   - validation;
   - preview resolution;
   - TikZ export.
3. Curved sheet coordinate refs must not be silently accepted if export only samples numeric mesh coordinates.
4. Either:
   - fully preserve curved-sheet coordinate refs in TikZ; or
   - explicitly reject coordinate refs inside curved sheet primitives with a clear validation error.
5. Add regression tests for dangling refs in frame fields and curved-sheet ref export behavior.

Preferred MVP policy:

- **Reject coordinateRef in frame/derived fields and curved sheet primitives for now.**
- Keep coordinateRef supported only in fields whose TikZ export can preserve `(tikzName)` references.

## Scope

This is a targeted Phase 26C fix.

Implement:

- explicit coordinateRef support boundary helpers;
- validation rejection for unsupported coordinateRef locations;
- collector/resolver/export consistency;
- tests.

Do not implement:

- full coordinateRef-aware symbolic frame algebra;
- symbolic mesh export for curved sheets;
- new coordinate anchor features;
- detach behavior;
- layer-translation detach;
- new geometry types;
- broad save/load redesign;
- new dependencies.

Do not change:

- supported coordinateRef behavior for paths, polygon/quad sheet vertices, points, labels, and any other already-exportable fields;
- coordinate anchor definitions;
- coordinate anchor TikZ name behavior;
- SVG preview for supported refs;
- save/load for valid refs;
- inline/standalone TikZ formatting;
- 4-space indentation;
- inline no-blank-lines invariant.

## 1. Define a single support-boundary policy for coordinateRef

Add or clarify a central helper/policy that answers:

```ts
isCoordinateRefSupportedAtLocation(location): boolean
```

or encode the same policy in model-aware traversals.

Preferred support in Phase 26C:

### Supported

Coordinate refs are supported in fields that can export as `(tikzName)`:

- path vertices/endpoints;
- path controls where TikZ path output can use coordinate refs;
- labels positions;
- point positions;
- polygon/quad sheet vertices if the sheet export preserves coordinate references;
- filled/path boundary fields only if TikZ export preserves refs;
- other explicitly tested fields.

### Unsupported for now

Reject coordinate refs in:

- work-plane frame fields:
  - `frame.origin`;
  - `frame.u`;
  - `frame.v`;
  - `frame.normal`;
- grid/lattice frame fields;
- local coordinate stored frames;
- arc/circle/ellipse frame fields if export cannot preserve them;
- curved sheet primitives that are sampled to numeric mesh:
  - hemisphere;
  - ruled surface;
  - Coons patch;
  - saddle/other curved surface primitives;
  - any mesh-based/sampled surface export;
- any derived or helper-only geometry fields whose TikZ export uses numeric previews.

Important:

- Unsupported coordinateRef fields may still contain global/symbolic numeric expressions if those are supported.
- Only `coordinateRef` is being restricted here.

## 2. Make collector, validator, resolver, and exporter use the same support boundary

The current bug exists because some systems treat generic `Vec3` fields as supported while validation/export do not.

Ensure these are aligned:

1. Variable/symbolic-source collector.
2. Coordinate reference validator.
3. Coordinate reference preview resolver.
4. TikZ coordinate formatter/exporter.
5. Save/load normalization.

Required invariant:

```text
If a coordinateRef can be collected/resolved as supported, it must also be validated and exported preserving the reference.
```

If export cannot preserve the reference, validation must reject it before export.

Do not have a path where:

```text
accepted/resolved coordinateRef -> numeric sampled TikZ output
```

without an explicit unsupported/fallback policy.

## 3. Reject coordinateRef in work-plane frame fields

Frame fields are not currently coordinate-ref export-safe.

Add validation so a coordinateRef inside any unsupported frame field fails.

Examples to reject:

```text
grid.frame.frame.origin.symbolic.source.coordinateId = "A"
grid.frame.frame.u.symbolic.source.coordinateId = "A"
workPlaneFilledSheet.frame.origin.symbolic.source.coordinateId = "A"
arc.frame.origin.symbolic.source.coordinateId = "A"  // if unsupported
local coordinate source frame.origin.symbolic.source.coordinateId = "A"
```

Use path-aware errors.

Good error examples:

```text
Coordinate references are not supported in grid frame origin.
```

```text
coordinateRef is not supported at grid.frame.frame.origin; use a concrete coordinate value instead.
```

Missing refs in these fields should not just fail because missing; they should fail because the location is unsupported.

## 4. Curved sheet primitive policy

Curved sheets currently sample to numeric mesh output.

Therefore, for Phase 26C MVP, reject coordinateRefs inside curved sheet primitives unless full reference-preserving export is implemented.

### Preferred MVP: reject

Reject coordinate refs in:

- hemisphere center/frame/parameters;
- curved sheet primitive control fields;
- ruled surface boundary snapshots if exported as numeric sampled mesh and cannot preserve refs;
- Coons patch boundary snapshots if exported as numeric sampled mesh and cannot preserve refs;
- saddle/other sampled surface primitives.

Error example:

```text
Coordinate references are not currently supported inside curved sheet primitives because TikZ export samples them to numeric mesh coordinates.
```

### Alternative: implement full preservation

Only choose this if practical.

To count as full support, TikZ output must visibly preserve references such as `(A)` in generated sheet/path commands. If the export still samples numeric mesh, it does not count.

Given the review issue, MVP rejection is safer.

## 5. Keep supported polygon/quad sheet refs if they truly preserve `(A)`

The review says polygon/quad sheet vertices export `(tikzName)` references after coordinate definitions.

Keep that behavior.

Do not broadly reject all sheet coordinate refs.

Differentiate:

```text
simple polygon/quad sheet vertices: supported if export preserves refs
curved/sampled sheet primitives: unsupported unless export preserves refs
```

Add tests to prevent accidental over-rejection.

## 6. Save/load behavior

Malformed or unsupported coordinateRef fields in saved JSON should be rejected cleanly.

Requirements:

- `parseSavedDiagramJson(...)` returns `ok: false`;
- no raw throw;
- error path identifies unsupported coordinateRef location;
- old valid diagrams still load;
- valid coordinate refs in supported fields still load.

## 7. TikZ export behavior

After validation fixes:

- supported coordinate refs export `(tikzName)` references;
- unsupported coordinate refs never reach export as silently numeric sampled output;
- coordinate anchor definitions are still emitted before use;
- inline output has no blank lines;
- 4-space indentation preserved.

If the exporter encounters an unsupported coordinateRef defensively, emit an explicit error/comment or fail safely, but validation should catch it earlier.

## 8. Tests

Add focused regression tests.

### Work-plane/frame unsupported coordinateRef tests

1. A missing coordinateRef in `grid.frame.frame.origin.symbolic.source` makes `validateDiagram(...)` fail.

2. An existing coordinateRef in `grid.frame.frame.origin.symbolic.source` also fails because the location is unsupported.

3. CoordinateRef in frame `u` fails.

4. CoordinateRef in frame `v` fails.

5. CoordinateRef in frame `normal` fails if normal supports symbolic source.

6. Saved JSON with coordinateRef in unsupported frame field returns `ok: false`, not throw.

7. Error message mentions unsupported coordinateRef frame location.

### Curved sheet unsupported coordinateRef tests

8. Hemisphere center referencing coordinate anchor fails validation if export cannot preserve `(A)`.

9. Ruled surface boundary coordinateRef fails validation if export samples numeric mesh.

10. Coons patch boundary coordinateRef fails validation if export samples numeric mesh.

11. Saddle/other curved sheet primitive coordinateRef fails validation if present/supported in model.

12. Curved sheet coordinateRef does not silently export as numeric sampled mesh.

If policy is to preserve instead of reject, then tests must assert `(A)` appears in generated TikZ. Do not accept numeric-only sampled output.

### Supported field regression tests

13. Path endpoint coordinateRef still validates.

14. Path endpoint coordinateRef still exports `(A)`.

15. Label coordinateRef still validates and exports `(A)`.

16. Point coordinateRef still validates and exports `(A)`.

17. Polygon/quad sheet vertex coordinateRef still validates and exports `(A)` if currently supported.

18. Missing coordinateRef in supported field still fails.

19. Save/load round-trip for supported refs still works.

### Consistency tests

20. A helper test verifies the coordinateRef support boundary for representative locations:
    - path endpoint: supported;
    - label position: supported;
    - grid frame origin: unsupported;
    - curved sheet primitive center: unsupported.

21. No coordinateRef accepted in a location whose export path cannot preserve it.

### Formatting/regression tests

22. Inline output with supported coordinateRefs has no blank lines.

23. TikZ coordinate definitions are still emitted before references.

24. Numeric/global diagrams unaffected.

## 9. Implementation guidance

### Avoid generic Vec3 “coordinateRef supported” assumptions

A `Vec3` field being symbolic-capable does not automatically mean coordinateRef should be supported there.

Coordinate refs require export support.

Therefore:

```text
symbolic scalar/vector support != coordinateRef support
```

Model this distinction explicitly.

### Prefer path-aware traversal

Use model-aware traversal rather than generic recursion.

Supported coordinateRef traversal should be based on:

- schema;
- export capabilities;
- tests.

### Defensive export checks

Even after validation, add defensive checks where feasible:

- if sampled curved sheet export sees a coordinateRef in primitive data, emit a clear validation/fallback error rather than silently numeric mesh.

But avoid broad runtime exceptions in normal export.

## 10. Documentation/comments

Add comments near coordinateRef traversal/support helpers:

```text
CoordinateRef support is narrower than symbolic coordinate support because TikZ export must preserve `(name)` references. Frame fields and sampled curved sheets are rejected until reference-preserving export exists.
```

Update docs if Phase 26C docs list supported coordinate-ref fields.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Manual checks if practical:

1. Create coordinate anchor `A`.
2. Use `A` in a path endpoint.
3. Confirm TikZ exports `(A)`.
4. Try to use `A` in a grid frame origin if UI allows it.
5. Confirm UI/validation rejects it.
6. Try a curved sheet parameter/center reference if UI allows it.
7. Confirm rejection or reference-preserving export according to policy.
8. Confirm old valid coordinate ref diagrams still load.

## 12. Preserve existing behavior

Do not regress:

- coordinateRef model;
- supported direct creation from coordinate anchors;
- save/load round-trip for supported refs;
- SVG preview resolution for supported refs;
- path/label/point/polygon sheet reference export;
- coordinate anchor definitions;
- inline no-blank-lines;
- 4-space indentation;
- numeric/global diagrams;
- undo/redo.

## 13. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 14. Report after implementation

Please report:

- files modified;
- coordinateRef support boundary policy;
- frame-field rejection behavior;
- curved sheet coordinateRef policy;
- whether curved sheets reject or preserve refs;
- supported fields retained;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
