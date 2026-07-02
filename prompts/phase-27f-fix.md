# Phase 27F Fix Prompt: Bound selection-cycling candidate collection work

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

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

## Context

You are working on the StratifiedTikZ project.

Phase 27F added docs, combined regression tests, and hardening for Phase 27 interaction/editing polish.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Selection cycling candidate collection is still not truly bounded.

Current problem:

- `collectSvgPreviewSelectionCandidates(...)` builds all coordinate-anchor, crossing, label, and stratum candidates.
- It sorts and slices only after the full candidate array has already been built.
- Inline-node previews are capped per curve, but many curves can still produce unbounded total inline-node preview work for one Alt/Option-click.
- The current test only checks returned length, not the work done to collect/project candidates.

Review locations:

```text
src/rendering/svgHitTesting.ts
src/rendering/svgPathInlineNodes.ts
```

This violates the Phase 27F checklist category:

```text
unbounded candidate/path sampling
```

## Goal

Fix selection-cycling performance so candidate collection applies a real global work budget before sorting/returning.

Required behavior:

1. Candidate collection must not build unbounded candidate arrays.
2. Projection/candidate work must be globally bounded per hit test.
3. Inline-node preview work must be capped globally per hit test, not only per curve.
4. Returned candidates should still be deterministic and priority-ordered within the budget.
5. Existing selection cycling behavior for ordinary diagrams should remain unchanged.
6. Add regression tests that prove work is bounded, not merely that returned length is capped.

## Scope

This is a targeted Phase 27F performance/hardening fix.

Implement:

- real global candidate/work budget for selection cycling;
- bounded candidate collection before sorting/slicing;
- bounded inline-node preview/candidate work;
- tests that instrument or otherwise prove bounded work.

Do not implement:

- new selection features;
- marquee selection;
- new geometry features;
- new path inline-node model changes;
- broad SVG renderer rewrite;
- new dependencies.

Do not change:

- normal click selection priority;
- coordinate anchor show/hide behavior;
- layer filter/visibility behavior;
- 3D auto-hidden point/label exclusion from Phase 27A fixes;
- braiding/crossing marker behavior;
- geometry handle priority;
- TikZ generation;
- save/load;
- undo/redo.

## 1. Inspect current selection-cycling collector

Inspect:

- `src/rendering/svgHitTesting.ts`;
- `collectSvgPreviewSelectionCandidates(...)`;
- all candidate collector helper functions;
- candidate sorting/slicing logic;
- `src/rendering/svgPathInlineNodes.ts`;
- inline-node preview collection helpers;
- `SvgDiagram.tsx` call sites for Alt/Option-click cycling.

The current problematic pattern is conceptually:

```ts
const candidates = [
  ...collectAllCoordinateAnchors(...),
  ...collectAllCrossings(...),
  ...collectAllLabels(...),
  ...collectAllStrata(...),
  ...collectAllInlineNodes(...),
];

return sortCandidates(candidates).slice(0, maxCandidates);
```

This caps returned results but not collection work.

## 2. Define a global selection-cycling budget

Add explicit constants or options.

Suggested:

```ts
const DEFAULT_MAX_SELECTION_CYCLING_CANDIDATES = 64;
const DEFAULT_MAX_SELECTION_CYCLING_PROJECTIONS = 512;
const DEFAULT_MAX_SELECTION_CYCLING_INLINE_NODE_PREVIEWS = 128;
const DEFAULT_MAX_SELECTION_CYCLING_STRATA_SCANS = 2000;
```

Exact values can differ, but they must be:

- finite;
- documented;
- high enough for ordinary diagrams;
- low enough to prevent accidental freezes.

If existing cap constants exist, reuse or align them.

## 3. Bound work before sorting

The collector must enforce budgets while collecting candidates.

Acceptable approaches:

### Option A: Remaining budget passed through collectors

Use a mutable/local budget object:

```ts
type CandidateCollectionBudget = {
  maxCandidates: number;
  maxProjectedPoints: number;
  maxInlineNodePreviews: number;
  candidatesUsed: number;
  projectedPointsUsed: number;
  inlineNodePreviewsUsed: number;
  truncated: boolean;
};
```

Each subcollector:

- checks remaining budget before doing expensive work;
- stops when budget is exhausted;
- marks `truncated`.

### Option B: Bounded priority buckets

Collect into bounded buckets by priority:

```text
coordinate anchors
crossings
labels
points
inline nodes
paths
sheets
```

Each bucket has a cap, and global cap is enforced.

This avoids sorting huge arrays.

### Option C: Streaming top-k / bounded heap

Maintain a bounded candidate set while scanning.

Only keep the best K candidates.

This is more complex but good if distance sorting matters.

Preferred MVP:

- Option A or B.
- Keep implementation readable.

## 4. Candidate order and determinism

Even with a budget, candidate order should remain deterministic.

Requirements:

- priority ordering remains consistent;
- distance ordering remains consistent among collected candidates;
- stable ID tie-break remains;
- cycling wraps as before;
- when budget truncates, the chosen subset is deterministic.

If the collector stops scanning early, make sure scan order is stable.

## 5. Bound inline-node preview work globally

Current inline-node previews are capped per curve.

This is insufficient when there are many curves.

Fix:

- pass a global inline-node preview budget into inline-node candidate collection;
- stop computing inline-node previews once the budget is exhausted;
- avoid calling expensive preview/sampling helpers for all curves after budget is exhausted.

Suggested API:

```ts
collectSvgPathInlineNodePreviewCandidates({
  ...,
  budget,
});
```

or:

```ts
collectInlineNodeCandidatesForCurve(..., remainingInlineNodeBudget)
```

Requirements:

- many curves with inline nodes cannot cause unbounded work during one hit test;
- ordinary diagrams still show/cycle inline node candidates;
- if budget truncates, optional status/debug flag may exist but no user-visible error is required.

## 6. Bound projection work

Projection can also be expensive if done for many targets.

If candidate collection projects coordinates for every object before filtering:

- add a projection budget;
- filter by rough bounds before projection where possible;
- stop when projection budget is exhausted.

Do not perform expensive path sampling for objects already outside reasonable hit radius if a cheap bounding box is available.

MVP acceptable:

- cap the number of projected points/candidates processed globally.

## 7. Avoid over-collecting then slicing

The key invariant:

```text
No collector should build an unbounded array and rely on final slice.
```

After the fix, code should not have a path where all candidates are accumulated before applying a global cap.

Search for:

```bash
rg "slice\\(|sort\\(|candidates.push|collectSvgPreviewSelectionCandidates|inlineNode" src/rendering
```

Update relevant code paths.

Final slicing is still okay as a defensive measure, but it must not be the only cap.

## 8. Expose bounded-work metadata for tests

To prove bounded work, add test-only or ordinary metadata.

Options:

### Option A: Return diagnostics in test helper

```ts
const result = collectSvgPreviewSelectionCandidates(..., { includeDiagnostics: true });

result.diagnostics.projectedPoints
result.diagnostics.inlineNodePreviews
result.diagnostics.truncated
```

### Option B: Injectable counters

Allow tests to pass callbacks:

```ts
onProjectPoint?: () => void
onInlineNodePreview?: () => void
```

### Option C: Export pure budget helpers

Test the collectors with synthetic data and assert budgets.

Preferred:

- diagnostics/counters that do not affect production behavior.

Do not make tests depend only on returned candidate length.

## 9. Tests

Add focused tests.

### Global candidate budget tests

1. With many overlapping coordinate anchors, collector returns at most the configured candidate cap **and** candidate creation/projection count stays within budget.

2. With many labels/points/strata, collector does not project/process beyond the global budget.

3. Budget exhaustion sets a `truncated` diagnostic or equivalent if implemented.

4. Candidate order remains deterministic under a fixed budget.

### Inline-node global budget tests

5. Many curves with many inline nodes do not compute inline-node previews for every curve.

Example:

```text
1000 curves
each with inline nodes
global inline preview budget = 32
```

Expected:

- inline preview work <= 32 or bounded constant;
- returned candidates <= max;
- no unbounded loop through every inline node.

6. Per-curve inline-node cap remains respected.

7. Ordinary small diagram inline-node candidates still appear.

### Mixed overlap tests

8. Diagram with many coordinate anchors, paths, and inline nodes:
   - collection work bounded;
   - returned candidates capped;
   - priority order still starts with high-priority visible candidates.

9. Hidden coordinate anchors do not consume candidate budget if skipped cheaply.

10. 3D auto-hidden points/labels do not consume returned candidates and ideally are skipped before expensive work.

### Regression tests

11. Normal click selection still chooses top visible candidate.

12. Alt/Option cycling still wraps.

13. Coordinate anchor priority preserved.

14. Braiding marker click behavior preserved.

15. Selection cycling state remains UI-only.

16. TikZ output unaffected.

17. Existing Phase 27F combined tests still pass.

## 10. Performance design guidance

### Cheap filters before expensive work

Prefer:

```text
visibility/layer/hidden checks
rough bounding boxes
hit radius checks
budget checks
projection/sampling
candidate creation
```

over:

```text
project/sample all
then filter
```

### Avoid scanning expensive inline nodes for every path

If possible:

- scan paths in stable order;
- stop inline-node processing when global inline budget exhausted;
- still allow path/curve body candidates separately if budget remains.

### Keep ordinary behavior good

Do not make budget so low that normal diagrams cannot cycle through a few overlapping candidates.

If there are more candidates than budget, cycling only sees the bounded subset. That is acceptable if documented internally.

## 11. Optional status/debug behavior

No user-facing warning is required when cycling candidates are truncated.

But a developer diagnostic or debug flag is useful.

If adding a status message, keep it unobtrusive:

```text
Selection candidates truncated for performance.
```

Not required for MVP.

## 12. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual checks:

1. Create a normal overlapping object case.
2. Alt/Option-click cycles as before.
3. Create or load a dense diagram with many paths/inline nodes.
4. Alt/Option-click remains responsive.
5. Coordinate anchors and braiding markers still cycle correctly.
6. Hidden coordinates / auto-hidden points/labels are not selected.

## 13. Preserve existing behavior

Do not regress:

- selection cycling UX;
- normal click selection;
- coordinate anchor hit priority/show-hide;
- layer filters;
- 3D auto-hidden point/label exclusion;
- braiding marker toggles;
- geometry handles;
- inline-node preview rendering;
- SVG preview;
- TikZ generation;
- save/load;
- undo/redo.

## 14. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Optional:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Only treat lint as required if the repository is already lint-clean.

## 15. Report after implementation

Please report:

- files modified;
- root cause of unbounded candidate work;
- global budget constants/options;
- candidate collection strategy;
- inline-node budget behavior;
- diagnostics/counters added for tests;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
