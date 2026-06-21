# Phase 20E Fix Prompt: Make SVG render item ordering a consistent total order

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

Phase 20E implemented optional surface face depth sorting.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

SVG surface depth sorting uses a comparator that is not a consistent total order when sorted surface faces are mixed with curves, points, and labels.

Review details:

- `src/rendering/SvgDiagram.tsx` applies a second global sort after surface faces were already depth-sorted.
- `compareRenderItems(...)` switches ordering rules by pair type:
  - depth order for surface-vs-surface;
  - layer/id order for mixed surface-vs-curve/point/label items.
- This comparator can be non-transitive for same-layer mixed items.

Example:

```text
far surface id: z...
near surface id: a...
curve id: m...
```

The comparator can imply:

```text
far surface < near surface      by depth
near surface < curve            by id
curve < far surface             by id
```

This violates transitivity and can make SVG render order engine-dependent.

Risk:

- unstable SVG ordering;
- non-deterministic rendering;
- surfaces may not depth-sort consistently when mixed with curves/points/labels on the same layer.

## Goal

Fix Phase 20E SVG surface depth sorting so the final render item ordering uses one consistent total comparator when sorted surface faces are mixed with curves, points, and labels.

Requirements:

- preserve depth order among surface faces;
- preserve existing non-surface behavior as much as practical;
- avoid non-transitive comparisons;
- add a regression test with two same-layer surfaces plus a same-layer curve/label whose id sorts between them.

## Scope

This is a targeted Phase 20E fix.

Implement:

- one consistent total comparator for final SVG render item ordering;
- deterministic sort keys for all render items;
- regression tests for mixed same-layer surface/non-surface ordering.

Do not implement:

- new visibility algorithms;
- curve occlusion;
- point/label occlusion;
- BSP splitting;
- exact hidden surface algorithms;
- new UI options;
- TikZ export redesign;
- new dependencies.

Do not change:

- Phase 20E shared face depth sort semantics;
- visibility option model unless required for comparator clarity;
- TikZ sorted face export behavior unless needed for consistency;
- diagram data model;
- SVG geometry rendering itself;
- layer semantics;
- style semantics;
- save/load;
- undo/redo.

## 1. Inspect current SVG render item ordering

Inspect:

- `src/rendering/SvgDiagram.tsx`;
- the code that creates render items;
- the code that depth-sorts surface faces;
- `compareRenderItems(...)`;
- tests for rendering order / surface depth sorting.

Identify:

- all render item kinds;
- how surface face items are represented;
- whether surface faces already have a depth sort index;
- how layer/id ordering is currently applied;
- how selected/highlighted items are layered.

## 2. Define a total render sort key

Replace pair-type-dependent ordering with a single total sort key for every render item.

Suggested shape:

```ts
type SvgRenderSortKey = {
  layer: number;
  depthBucket: number;
  categoryRank: number;
  depthSortValue: number;
  stableIndex: number;
  id: string;
};
```

Exact fields can differ.

The important point:

- every item gets comparable values for the same ordered tuple;
- comparator lexicographically compares the tuple;
- no branch should cause A < B, B < C, and C < A cycles.

## 3. Preserve surface depth order

When surface depth sorting is enabled:

- surface face items on the same layer should preserve depth sorting:
  - farther faces first;
  - nearer faces later;
  - use the Phase 20D/20E depth convention.
- stable tie-breaker should be deterministic:
  - original index;
  - source id;
  - face index.

Important:

- do not depth-sort only some pairs and id-sort other pairs in a way that creates non-transitivity.

## 4. Preserve non-surface behavior as much as practical

For non-surface items:

- curves;
- points;
- labels;
- guides/highlights if represented as render items;

preserve existing relative behavior as much as possible.

Suggested policy:

### Within same layer

Use category ranks:

```text
surface faces
curves
points
labels
```

or the existing intended order.

Then stable order by original/emission index or id.

This is a total ordering and avoids pairwise mixed-mode comparison.

Alternative policy:

- preserve original emission index for all non-surface items;
- place sorted surface faces in a deterministic category relative to non-surface items.

Choose one clear policy and document/test it.

## 5. Decide how surfaces interleave with non-surfaces

There are two reasonable policies. Pick one and implement consistently.

### Policy A: Surface faces before non-surface items within a layer

This is often desirable for diagram readability:

```text
surface faces first, then curves/points/labels on top
```

Pros:

- curves/points/labels remain visible;
- stable and simple;
- good default for stratified diagrams.

Cons:

- a curve behind a surface will not be hidden until Phase 20F curve occlusion.

This is likely the best MVP.

### Policy B: All items receive depth values

Try to depth-sort surfaces, curves, points, and labels together.

Pros:

- more geometrically realistic.

Cons:

- more complex;
- may hide labels/points unexpectedly;
- Phase 20F/20G are intended to handle curve/point/label visibility separately.

Preferred for this fix:

- **Policy A**: within each layer, sorted surface faces are drawn before curves/points/labels.
- Preserve surface depth ordering among surface faces.
- Preserve non-surface ordering among non-surface items.

This yields a consistent total order and avoids premature mixed-item occlusion behavior.

## 6. Comparator requirements

The final comparator must be:

- deterministic;
- total;
- transitive;
- stable under equal sort keys via original index or id;
- independent of JavaScript engine sort quirks.

Implementation approach:

```ts
function compareRenderItems(a, b) {
  return compareTuple(renderSortKey(a), renderSortKey(b));
}
```

Avoid pairwise special cases such as:

```ts
if (a.kind === "surface" && b.kind === "surface") depthCompare();
else idCompare();
```

unless they still reduce to one consistent total key.

## 7. Remove redundant or conflicting sorts

The review says surface faces are already depth-sorted and then a second global sort is applied.

After the fix, make the pipeline clear:

Option 1:

- assign each item a final sort key;
- do one final total sort.

Option 2:

- pre-sort surface faces;
- preserve their sort index as a field;
- final total comparator uses that sort index for surface items.

Either is acceptable.

Do not let a later sort undo or destabilize earlier surface depth sorting.

## 8. Selection/highlight/handle ordering

Check whether selected highlights, geometry handles, coordinate source highlights, or work-plane guides are included in the same item sort.

Requirements:

- selected handles should remain visible/interactive according to existing behavior;
- preview-only guides should not suddenly cover real geometry;
- no pointer-event regressions.

If these are rendered outside the sorted item list, ensure they remain unaffected.

If they are render items, assign explicit category ranks.

## 9. Tests

Add focused tests.

### Comparator tests

1. The comparator is transitive for a constructed mixed set:

```text
far surface id: zSurface
near surface id: aSurface
curve id: mCurve
```

All same layer.

Expected:

- no cycle;
- sorted order is deterministic.

2. Same-layer surface faces preserve depth order.

3. Same-layer non-surface items preserve existing intended order as much as possible.

4. Same-layer mixed surface/curve/point/label items sort according to the chosen category policy.

5. Different layers still sort by layer before category/depth.

6. Tie-breakers are deterministic.

### Regression test explicitly requested by review

7. Construct two same-layer surfaces plus a same-layer curve or label whose id sorts between them.

Example:

```text
surface far id: zzzSurface
surface near id: aaaSurface
curve id: mmmCurve
```

Expected under preferred Policy A:

```text
far surface
near surface
curve
```

or equivalent if your category policy differs, but it must be deterministic and transitive.

### Rendering/output tests

8. SVG render order uses the final total comparator.

9. Surface depth sorting disabled preserves previous behavior as much as practical.

10. Surface depth sorting enabled changes only intended ordering.

11. TikZ export tests still pass.

12. Inline/standalone formatting tests still pass.

## 10. Optional property-based sanity test

If easy, add a small helper test that checks comparator transitivity over a sample set:

```ts
for all a,b,c:
  if compare(a,b) <= 0 and compare(b,c) <= 0
  then compare(a,c) <= 0
```

Do not add a property testing dependency.

A small manual triple loop over representative render items is enough.

## 11. Documentation/comments

Add or update a code comment near the comparator explaining the ordering policy.

Example:

```text
SVG render order uses one total sort key:
layer -> category -> surface depth/order -> stable original index.
This avoids non-transitive mixed surface/non-surface comparisons.
```

If user-facing docs mention auto depth sorting, update limitations if necessary:

- surface faces depth-sort;
- curves/points/labels are not depth-occluded until later phases;
- they may be drawn above surfaces according to category policy.

## 12. Preserve existing behavior

Do not regress:

- visibility options default/off behavior;
- surface face depth sorting among surfaces;
- TikZ sorted face output;
- SVG preview rendering;
- layer filtering;
- selection;
- pointer events;
- guides/highlights;
- save/load;
- undo/redo;
- inline/standalone TikZ formatting;
- 4-space indentation;
- no-blank-lines inline output.

## 13. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual check:

1. Open a 3D diagram with at least two overlapping surfaces on the same layer.
2. Enable surface depth sorting.
3. Confirm surfaces render in stable depth order.
4. Add a curve/label on the same layer with an id/name that alphabetically falls between surface ids if practical.
5. Confirm render order remains stable across refreshes/state changes.
6. Toggle visibility sorting off.
7. Confirm prior behavior is preserved as much as practical.
8. Confirm selection/handles still work.
9. Generate TikZ and confirm no unrelated export regression.

## 14. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 15. Report after implementation

Please report:

- files modified;
- root cause of the non-transitive comparator;
- chosen mixed-item ordering policy;
- final sort key fields;
- how surface depth order is preserved;
- how non-surface order is preserved;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
