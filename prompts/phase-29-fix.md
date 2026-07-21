# Phase 29 Targeted Fix Prompt 8: Coons patch editor performance

## Environment

Work on the current Phase 29 branch, not `main`:

```text
phase/29-live-linked-coons-boundaries
```

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
git diff main --check
```

Run lint only if the repository is already established as repository-wide lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies unless a dependency is demonstrably necessary and explicitly justified.

## Project context

You are applying a focused Phase 29 performance fix in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 29 implements optional live-linked Coons patch boundaries while retaining materialized snapshots for sampling, Preview, SVG, TikZ, persistence, and stale fallback.

All Phase 29 correctness behavior must remain intact.

The reported user-visible symptom is:

> After creating a Coons patch, the editor becomes clearly sluggish.

Two manual diagnostic observations are important:

1. Moving selection away from the Coons patch does not materially improve responsiveness.
2. Detaching the Coons boundary links does not materially improve responsiveness.

Therefore, do not assume that the selected-patch Inspector or linked-boundary synchronization is the primary bottleneck.

The strongest current hypothesis is repeated curved-sheet sampling, projection, surface sorting, and occlusion preparation during ordinary SVG Preview renders.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- all prior Phase 29 fix prompts present in the repository;
- `src/rendering/SvgDiagram.tsx`;
- `src/rendering/curvedSheetMesh.ts`;
- `src/rendering/projectedPrimitives.ts`;
- `src/rendering/svgSurfaceDepthSort.ts`;
- `src/rendering/curveOcclusion.ts`;
- `src/rendering/pointOcclusion.ts`;
- `src/geometry/curvedSheets.ts`;
- `src/ui/undo.ts`;
- `src/model/coonsPatchLinks.ts`;
- relevant visibility, projection, Preview, curved-sheet, and performance tests;
- `package.json`, especially the explicit `npm test` file list.

Search for every call to:

- `sampleCurvedSheetPrimitive`;
- `sampleCoonsPatch`;
- `surfaceBoundaryPolylines`;
- `curvedSheetToSvgMesh`;
- `extractProjectedRenderPrimitives`;
- `sortedSvgSurfaceFaces`;
- `classifyCurveOcclusion`;
- `classifyAnchorOcclusion`;
- `validateCurvedSheetPrimitive`;
- `synchronizeLinkedCoonsPatches`.

Do not assume the filenames above are the only hot paths.

## Current performance hypothesis

Verify the actual current implementation before changing it.

The branch appears to have several potentially overlapping costs:

1. `SvgDiagram` prepares curve, point, and label occlusion separately and also prepares depth-sorted surface faces.
2. Surface sorting and the occlusion classifiers can independently extract/project surface faces.
3. Curved-sheet face extraction samples the complete Coons mesh.
4. `curvedSheetToSvgMesh` samples a curved sheet and then requests boundary polylines through a helper that may sample the same primitive again.
5. Curved-sheet validation may sample the full mesh rather than performing only structural/corner/finite checks.
6. Many of these computations can run again when React rerenders for selection, draft, pointer, or other UI-only state.
7. A Coons patch multiplies these costs by `uSegments × vSegments`, even when it is static or detached.

These are hypotheses to verify with deterministic instrumentation.

Do not submit a speculative rewrite without measuring the production call graph first.

## Goal

Make SVG Preview interaction remain responsive after one or more Coons patches are created.

The fix must:

- eliminate redundant sampling of the same curved-sheet primitive;
- eliminate redundant projection/extraction of the same surface faces;
- share prepared surface data across depth sorting and occlusion where semantics permit;
- avoid recomputing expensive surface data for selection-only or unrelated UI rerenders;
- preserve immediate Preview updates after geometry or camera changes;
- preserve all existing visibility, depth-sort, fallback, and export behavior;
- preserve every Phase 29 correctness fix;
- keep static, detached, linked, stale, and legacy Coons patches behaviorally identical.

Do not “fix” performance by permanently lowering sampling quality, disabling automatic visibility, delaying source following, or removing features.

## Stage 1: establish a deterministic baseline

Before implementing the optimization, add a temporary local probe or test-only instrumentation around the relevant pure helpers.

Measure call counts for at least:

- `sampleCurvedSheetPrimitive`;
- Coons mesh sampling;
- projected surface-face extraction;
- surface-face projection;
- surface depth sorting;
- curve occlusion preparation;
- point occlusion preparation;
- label occlusion preparation.

Exercise these scenarios:

1. A 3D diagram with paths but no curved sheet.
2. The same diagram with one Coons patch.
3. The patch selected.
4. Another element selected.
5. The patch linked.
6. The patch detached/static.
7. Automatic curve/point/label visibility enabled.
8. Automatic visibility disabled.
9. Surface depth sorting enabled and disabled.
10. Low and moderate/high `uSegments` / `vSegments`.
11. An unrelated selection-only rerender.
12. An unrelated element edit.
13. Camera rotation.
14. A linked source edit.

Report the before-fix call counts.

Remove temporary console logging and ad hoc profiling code before completion.

Prefer deterministic call-count tests over wall-clock assertions.

Wall-clock measurements may be included in the implementation report, but they must not be the only regression guard.

## Primary implementation: one prepared surface scene per Preview state

Introduce a reusable, pure preparation layer for SVG surface rendering.

Names may follow repository conventions. A conceptual design is:

```ts
type SampledSurfaceGeometry = {
  sheetId: string
  sheet: SheetStratum
  faces3D: readonly SurfaceFace3D[]
  curvedMesh?: SurfaceSampleMesh
  boundaryPolylines3D?: readonly Vec3[][]
}

type ProjectedSvgSurfaceScene = {
  surfaceGeometry: readonly SampledSurfaceGeometry[]
  projectedFaces: readonly ProjectedSurfaceFace[]
  projectedFacesBySheetId: ReadonlyMap<string, readonly ProjectedSurfaceFace[]>
}
```

Possible helpers:

```ts
prepareSvgSurfaceGeometry(diagram, options)
projectSvgSurfaceScene(surfaceGeometry, camera)
```

or one equivalent render-scoped abstraction.

The exact API may differ, but the following semantics are required.

### Sample each curved sheet at most once per preparation cycle

For a given diagram geometry state:

- sample each curved-sheet primitive at most once;
- derive its world-space faces from that mesh;
- derive its boundary polylines from that same mesh;
- do not independently resample it for:
  - ordinary sheet rendering;
  - boundary rendering;
  - surface depth sorting;
  - curve occlusion;
  - point occlusion;
  - label occlusion.

Polygonal and filled-sheet behavior must remain unchanged.

### Project each surface face once per camera state

For a given sampled surface scene and resolved camera:

- project each relevant surface face once;
- compute depth data once;
- reuse the resulting projected faces for all consumers whose current semantics are compatible.

Consumers include, where applicable:

- depth-sorted SVG surface rendering;
- curve occlusion;
- point occlusion;
- label occlusion.

Do not independently call `extractProjectedRenderPrimitives` from each consumer during the same Preview render.

### Preserve consumer-specific rules

Before sharing data, inspect and preserve differences in:

- visible/hidden layer filtering;
- `shouldRenderStratumInSvgPreview`;
- occluding-surface ID filters;
- maximum surface-face caps;
- sorting modes;
- fallback behavior;
- ambient dimension and camera mode;
- work-plane-filled-sheet sampling;
- curve sampling counts;
- visibility options.

If two consumers genuinely require different surface geometry, cache by a complete semantic key rather than incorrectly forcing one representation.

It is acceptable for consumers to:

- filter a shared immutable projected-face array;
- sort a copy using their existing comparator;
- apply their own cap/fallback checks.

It is not acceptable for each consumer to resample the same Coons patch.

Do not mutate a shared array through in-place `.sort()` unless a private copy is made first.

## Refactor occlusion APIs to accept prepared faces

Update the occlusion helpers so the Preview path can pass precomputed projected surface faces.

A suitable conceptual extension is:

```ts
type CurveOcclusionOptions = {
  // existing options
  projectedSurfaceFaces?: readonly ProjectedSurfaceFace[]
}

type AnchorOcclusionOptions = {
  // existing options
  projectedSurfaceFaces?: readonly ProjectedSurfaceFace[]
}
```

or a dedicated prepared-scene argument.

Requirements:

- the SVG Preview production path must share one prepared surface scene;
- standalone unit tests and other callers may retain a backward-compatible self-contained path;
- provided prepared data must prevent internal re-extraction/resampling;
- curve, point, and label occlusion results must remain identical;
- existing caps and fallback reasons must remain identical;
- the public API must stay typed and explicit;
- do not introduce hidden module-global mutable state.

Point and label occlusion should reuse the same prepared faces rather than each extracting them independently.

## Eliminate curved-sheet boundary resampling

Refactor `curvedSheetToSvgMesh` and `surfaceBoundaryPolylines` so one invocation does not sample the same primitive twice.

A suitable pattern is:

```ts
const mesh = sampleCurvedSheetPrimitive(sheet.primitive)
const boundaryPolylines = surfaceBoundaryPolylinesFromMesh(mesh)
```

or:

```ts
surfaceBoundaryPolylines(sheet.primitive, { sampledMesh: mesh })
```

Requirements:

- preserve the current boundary order and geometry;
- support ruled surfaces and Coons patches;
- preserve all error/fallback behavior;
- do not change the Coons formula;
- do not change sampling counts;
- add a call-count regression proving one sample per `curvedSheetToSvgMesh` invocation.

## Memoize expensive Preview preparation correctly

Memoize surface geometry and projected scene preparation in `SvgDiagram` or an appropriate rendering hook/helper.

A selection-only or other UI-only rerender with unchanged:

- resolved diagram geometry;
- camera;
- viewport;
- layer/visibility inputs relevant to surfaces;

must reuse the prepared data.

### Stable dependencies

Do not add ineffective `useMemo` calls whose dependencies are recreated on every render.

Inspect the referential stability of:

- the resolved camera object;
- resolved visibility options;
- fit-to-view extra points;
- layer filters;
- source diagram;
- resolved-coordinate diagram;
- draft geometry.

Use one of:

- stable scalar dependency lists;
- a small canonical camera/visibility key;
- memoized camera/visibility construction;
- a verified immutable object-identity cache;
- a combination of these.

Do not use `JSON.stringify(diagram)` during every render as a cache key.

### World-space mesh reuse across camera changes

Prefer a two-stage cache:

```text
diagram geometry
-> sampled world-space surface geometry

sampled surface geometry + camera
-> projected surface scene
```

Camera rotation should reproject faces but should not resample unchanged Coons geometry.

If an object-identity `WeakMap` cache is used for primitives:

- first verify that curved-sheet primitives are replaced rather than mutated for every geometry/sampling edit;
- cache only pure sampling results;
- use weak keys to avoid leaks;
- do not cache stale results after in-place mutation;
- add a regression for geometry and sampling changes.

If immutability cannot be guaranteed, use an explicit geometry-relevant fingerprint or a render-scoped cache with safe invalidation.

### Do not let React Strict Mode invalidate tests

Development Strict Mode may intentionally render more than once.

Test the pure preparation/cache helpers directly for deterministic call counts.

Manual profiling may account for Strict Mode separately.

## Skip work when features are disabled

The prepared pipeline must avoid unnecessary work.

Examples:

- if ambient dimension is not 3D, do not build 3D surface-occlusion data;
- if curve occlusion is disabled, do not run curve classification;
- if point visibility is disabled, do not classify points;
- if label visibility is disabled, do not classify labels;
- if depth sorting is disabled, do not sort surface faces;
- if there are no relevant surfaces, return inexpensive empty results;
- if a face-count cap causes an existing fallback, preserve that fallback without doing unnecessary sorting afterward.

Do not remove surface mesh generation when it is still required for visible curved-sheet rendering.

## Secondary investigation: validation and linked synchronization

Because deselecting the patch and detaching links do not materially improve responsiveness, Inspector status and live-link synchronization are not the primary target.

Still measure them.

### Linked synchronization

Verify whether unrelated committed edits call expensive candidate inspection or full Coons sampling.

Only if profiling shows material cost:

- add a cheap source-change fast path before candidate construction;
- avoid inspecting previous and next complete candidates when source fingerprints are unchanged;
- index strata by ID once per synchronization call;
- cache source resolution within one synchronization call.

Do not change Phase 29 semantics.

Do not skip indirect changes caused by:

- coordinate anchors;
- coordinate references;
- symbolic expressions;
- path templates;
- concatenated paths;
- variables;
- layer/bulk transforms.

Do not make detaching necessary for acceptable performance.

### Validation

Inspect whether `validateCurvedSheetPrimitive` builds a full mesh in a hot render or edit path.

If it does, separate:

```text
structural / finite / corner validation
```

from:

```text
full sampling verification
```

only where safe.

Requirements:

- do not weaken JSON load, creation, or final model validation;
- do not allow an invalid primitive into the committed diagram;
- retain full sampling verification where it is a correctness boundary;
- status display and unchanged-source fast paths must not build a full mesh merely to report `up to date`;
- add focused tests for any new validation helper.

Do not perform this refactor unless the baseline confirms it is on a meaningful hot path.

## Preserve rendering behavior exactly

The optimized Preview must preserve:

- surface face geometry;
- depth-sort ordering;
- visible/hidden curve classification;
- point visibility;
- label visibility;
- face-count and curve-sample fallback behavior;
- layer visibility and selection rules;
- sheet styles and opacity;
- boundary strokes;
- camera projection;
- automatic visibility options;
- static, detached, linked, and stale Coons appearance;
- stale last-valid snapshots;
- source recovery;
- SVG structure except for harmless ordering already guaranteed by existing comparators.

Sampling, SVG export, and TikZ export must remain snapshot-based.

Do not make render-time source lookups.

## Performance regression tests

Add focused tests in an appropriate file, for example:

```text
tests/rendering/phase29CoonsPreviewPerformance.test.ts
```

If `npm test` enumerates files explicitly, include the new test file.

Do not use fragile absolute millisecond thresholds as required gates.

### Required deterministic tests

#### 1. One sample per curved sheet in direct SVG mesh conversion

For one Coons patch:

- invoke the direct curved-sheet SVG mesh helper;
- verify the curved primitive is sampled at most once;
- verify boundary polylines come from the same mesh;
- verify output geometry matches the pre-fix behavior.

#### 2. Shared projected surface faces

Prepare a Preview scene with:

- one Coons patch;
- at least one curve;
- at least one point;
- at least one label;
- automatic visibility enabled;
- depth sorting enabled.

Verify:

- each curved sheet is sampled once during world-space preparation;
- each surface face is projected once per camera state;
- depth sorting, curve occlusion, point occlusion, and label occlusion consume the prepared faces;
- none of those consumers independently resamples the Coons patch.

#### 3. Selection-only rerender/cache hit

With unchanged diagram, camera, viewport, layer filter, and visibility settings:

- change only selection or another UI-only prop;
- verify world-space surface geometry is reused;
- verify no Coons resampling occurs;
- verify rendered selection behavior still changes correctly.

If a React rendering harness is not available, test the extracted cache/preparation helper directly and manually verify the component integration.

#### 4. Camera-only change

Rotate or otherwise change the 3D camera without changing diagram geometry.

Verify:

- world-space Coons mesh is reused;
- projected surface faces are recalculated;
- depth and occlusion results update;
- no stale projection remains.

#### 5. Geometry change

Edit the Coons patch or a linked source so the materialized primitive changes.

Verify:

- the affected patch is resampled exactly once for the next scene;
- unaffected curved sheets are not resampled;
- projected faces and Preview geometry update;
- linked Phase 29 behavior remains correct.

#### 6. Sampling-setting change

Change `uSegments` or `vSegments`.

Verify:

- the cache invalidates;
- the patch is resampled;
- face count changes as expected;
- no old mesh is reused.

#### 7. Static/detached parity

Compare linked and detached/static Coons patches with identical materialized snapshots.

Verify the rendering preparation cost is the same or effectively the same.

Detaching must not be required for performance.

#### 8. Visibility disabled

Disable automatic curve, point, and label visibility and depth sorting as supported by the model.

Verify:

- unused classifiers are not called;
- surface geometry is still generated only when needed for visible rendering;
- output matches current fallback behavior.

#### 9. Stale fallback and recovery

Make a linked patch stale.

Verify:

- the cached/rendered mesh uses the last-valid materialized snapshots;
- no source lookup occurs in the rendering cache;
- repairing the source invalidates the primitive cache through the updated materialized primitive;
- recovered geometry appears immediately.

#### 10. Multiple consumers, multiple patches

Use at least two curved sheets and shared/overlapping occlusion consumers.

Verify:

- each primitive is sampled at most once per required geometry state;
- one patch changing does not force unchanged patches to resample where the chosen cache architecture supports per-primitive reuse.

### Rendering correctness assertions

In addition to call counts, compare representative outputs before and after refactoring:

- projected face vertices;
- face order;
- curve visibility segments;
- point visibility;
- label visibility;
- boundary polylines;
- depth-sort fallback;
- SVG output for a stable fixture.

Avoid huge brittle snapshots when focused structural assertions suffice.

## Manual performance verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Use a representative 3D file containing:

- one or more Coons patches;
- moderate sampling;
- visible paths, points, and labels;
- automatic visibility enabled.

Verify:

1. Create a Coons patch and continue editing.
2. Select the patch, then select another element.
3. Edit an unrelated point or label.
4. Drag a boundary path.
5. Rotate the camera.
6. Detach the patch.
7. Toggle visibility/depth-sort options.
8. Increase and decrease sampling.

Record:

- before/after sampled-mesh call counts;
- before/after projected-face extraction counts;
- before/after render preparation time where available;
- whether input lag remains;
- whether camera drag remains visually current;
- whether linked source dragging remains visually current.

Use the browser Performance panel or React Profiler if available.

If the sandbox cannot bind a local server, report that limitation accurately and provide deterministic test/probe results instead.

Do not claim browser verification if it was unavailable.

## Performance acceptance criteria

Phase 29 performance is acceptable only when all of the following hold:

- creating a static or detached Coons patch no longer introduces repeated full-mesh work across independent Preview consumers;
- selection-only rerenders do not resample unchanged Coons patches;
- one surface preparation cycle samples each curved-sheet primitive at most once;
- direct curved-sheet SVG mesh generation does not sample again for its boundary;
- depth sorting and curve/point/label occlusion share prepared projected surface faces where their semantics are compatible;
- camera-only changes do not resample unchanged world-space Coons geometry;
- a geometry or sampling change invalidates the correct cached data immediately;
- unrelated edits do not rebuild unchanged curved-sheet meshes unnecessarily;
- no stale camera, geometry, layer, visibility, or fallback result appears;
- linked, detached, static, stale, and legacy Coons patches remain correct;
- all existing tests, build, and diff checks pass.

A small constant amount of unavoidable React/rendering work is acceptable.

Repeated `O(uSegments × vSegments)` sampling of the same primitive within one Preview state is not acceptable.

## Scope constraints

Do not:

- merge Phase 29 into `main`;
- change the Coons formula;
- lower default sampling quality as the primary fix;
- cap sampling below current supported values;
- disable automatic visibility or depth sorting;
- debounce geometry until pointer-up;
- make linked patches visually lag behind source edits;
- move source resolution into rendering;
- weaken stale fallback or persistence guarantees;
- weaken symbolic/provenance validation;
- change JSON schema or version;
- change duplication, ID reservation, detach, or history semantics;
- add a general dependency graph;
- introduce unsafe module-global mutable caches;
- use full-diagram `JSON.stringify` as a render cache key;
- perform unrelated UI cleanup;
- add dependencies without explicit justification.

Keep the production diff focused on verified render/preparation hot paths and any measured secondary synchronization/validation cost.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
git diff main --check
```

Also run every focused rendering, visibility, occlusion, curved-sheet, and performance test file modified or added by this fix.

## Report after implementation

Report:

- branch and commit range reviewed;
- files modified;
- baseline reproduction used;
- before-fix call counts;
- verified primary bottleneck;
- whether selection and detach controls confirmed the diagnosis;
- surface preparation/cache architecture introduced;
- cache keys and invalidation rules;
- how world-space mesh reuse differs from camera projection reuse;
- how surface data is shared by depth sorting and each occlusion consumer;
- how curved-sheet boundary double sampling was removed;
- whether validation or linked synchronization was also optimized, with measured justification;
- behavior preserved for caps and fallbacks;
- deterministic performance tests added;
- before/after call counts;
- optional before/after timings;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- `git diff main --check` result;
- manual browser verification performed or the exact reason it was unavailable;
- remaining known performance limitations.
