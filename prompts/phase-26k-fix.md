# Phase 26K follow-up: fix coordinate-anchor hit-test priority documentation

## Context

A review of Phase 26K found one Medium issue: `docs/COORDINATE_ANCHORS.md` contradicts the implemented hit-test priority.

The documentation currently says that coordinate hit-testing checks coordinate markers before “geometry handles,” but the implementation ranks `geometryHandle` before `coordinateAnchor` in:

- `src/rendering/svgHitTesting.ts`
- specifically the hit priority ordering near the top of the file

The behavior is also explicitly covered by a test:

- `tests/rendering/svgHelpers.test.ts`
- the test around line ~328 asserts that geometry handles win over coordinate anchors

The implementation and test appear intentional. This follow-up should therefore fix the documentation, not the behavior, unless inspection reveals a stronger reason to change behavior.

## Task

Update `docs/COORDINATE_ANCHORS.md` so the coordinate-anchor hit-testing documentation accurately describes the actual priority order.

The corrected documentation should make clear that:

1. Geometry handles remain higher priority than coordinate anchors.
2. Coordinate anchors outrank ordinary layer-bound geometry / drawing hits.
3. Coordinate anchors are global, not layer-bound.
4. This priority is intentional so that editable handles stay easy to grab when overlapping a coordinate anchor.
5. No runtime behavior should change.

Do not modify `src/rendering/svgHitTesting.ts` or the existing tests unless you discover that the review summary is inaccurate.

## Suggested wording direction

Replace any wording like:

> coordinate markers are checked before geometry handles

with wording along these lines:

> Hit-testing gives geometry handles the highest priority. Coordinate anchors are checked after geometry handles but before ordinary layer-bound geometry, so handles remain easy to manipulate while coordinate anchors still take precedence over regular drawing elements.

Use the project’s existing terminology and style. Keep the edit narrow.

## Verification

After the documentation change, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check