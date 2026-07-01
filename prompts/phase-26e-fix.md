# Phase 26E Fix Prompt: Reserve coordinate anchor IDs during layer and bulk duplication

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

Phase 26E integrates coordinate anchors with editing, snapping, selection, and layer operations.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.
- One Low-priority issue remains.

## Medium issue

Duplicate operations do not reserve coordinate anchor IDs.

Current problem:

- Coordinate anchor IDs are globally unique together with stratum IDs and label IDs.
- Validation requires coordinate anchor IDs to be unique against strata and labels.
- However, duplicate operations generate copied stratum/label IDs using only existing strata and labels.
- They do not reserve `diagram.coordinateAnchors[*].id`.
- This can generate a copied stratum/label ID that collides with an existing coordinate anchor ID.

Review examples:

```text
src/model/layers.ts
src/ui/bulkEditing.ts
```

Known affected paths:

- `duplicateLayer`;
- bulk duplicate / selected-element duplicate.

Reproduced scenario:

```text
Existing stratum id:
  source-point

Existing coordinate anchor id:
  source-point-copy

Duplicate source-point
```

Current duplicate logic may generate:

```text
source-point-copy
```

for the copied stratum.

Then validation fails:

```text
coordinateAnchors[0].id: Id must be unique; already used at strata[1].id.
```

This means duplicate operations can create invalid diagrams.

## Low-priority issue

The file:

```text
src/ui/coordinateAnchorDeletion.ts
```

is currently untracked.

It must be included in the commit with the tracked changes if it is part of the Phase 26E implementation.

## Goal

Fix Phase 26E duplicate ID allocation so all top-level diagram IDs are reserved during duplication.

Specifically:

1. Layer duplication must reserve coordinate anchor IDs when generating copied stratum/label IDs.
2. Bulk/selected duplicate must reserve coordinate anchor IDs when generating copied stratum/label IDs.
3. Any other duplicate helper that creates new top-level IDs must also reserve coordinate anchor IDs.
4. Generated IDs must be unique across:
   - `diagram.strata[*].id`;
   - `diagram.labels[*].id`;
   - `diagram.coordinateAnchors[*].id`.
5. Add regression tests for both duplicate paths where a coordinate anchor already owns the default `-copy` ID.
6. Update duplicate invariants/tests to include coordinate anchors in top-level ID uniqueness checks.
7. Ensure `src/ui/coordinateAnchorDeletion.ts` is tracked if it is required by the implementation.

## Scope

This is a targeted Phase 26E fix.

Implement:

- shared top-level ID reservation helper or update existing ID generation helpers;
- layer duplication ID collision fix;
- bulk/selected duplication ID collision fix;
- tests;
- commit hygiene for untracked coordinate-anchor deletion file.

Do not implement:

- new coordinate anchor model behavior;
- duplicating coordinate anchors unless already intentionally supported;
- new layer semantics;
- new selection behavior;
- new UI features;
- broad duplicate/refactor beyond ID allocation correctness;
- new dependencies.

Do not change:

- coordinate anchor global/non-layer-bound behavior;
- coordinateRef validation/export behavior;
- existing duplicate semantics except ID uniqueness;
- layer duplicate geometry/style behavior;
- bulk duplicate geometry/style behavior;
- save/load format;
- TikZ generation semantics;
- undo/redo semantics.

## 1. Inspect duplicate ID generation

Inspect:

- `src/model/layers.ts`;
- `src/ui/bulkEditing.ts`;
- any model-level duplicate helpers;
- any helper that generates copy IDs, such as:
  - `nextCopyId`;
  - `makeUniqueId`;
  - `disambiguateId`;
  - `duplicateDiagramLayer`;
  - `duplicateLayer`;
  - `duplicateSelectedElements`;
- validation logic for top-level IDs in `src/model/validation.ts`.

Find every duplicate path that generates new IDs for:

- copied strata;
- copied labels;
- copied generated coordinate names if applicable;
- copied metadata references.

The review points to several locations in `layers.ts` and `bulkEditing.ts` where only strata/labels are considered. These must include coordinate anchor IDs.

## 2. Add or update a top-level ID collection helper

Preferred approach:

Create or reuse a helper that returns all top-level diagram IDs:

```ts
collectTopLevelDiagramIds(diagram): Set<string>
```

It should include:

```text
strata ids
label ids
coordinate anchor ids
```

If other top-level ID-bearing entities exist, include them if validation requires uniqueness.

Then use it anywhere a new stratum/label/coordinate-anchor ID is generated.

Suggested helper:

```ts
function collectReservedDiagramIds(diagram: Diagram): Set<string> {
  return new Set([
    ...diagram.strata.map((s) => s.id),
    ...diagram.labels.map((l) => l.id),
    ...diagram.coordinateAnchors.map((c) => c.id),
  ]);
}
```

Exact shape depends on current model.

Requirements:

- old diagrams with no `coordinateAnchors` handled safely;
- helper is pure;
- helper is tested;
- helper is used by layer duplication and bulk duplication.

## 3. Fix layer duplication

When duplicating a layer:

- copied strata must get IDs unique across strata, labels, and coordinate anchors;
- copied labels must get IDs unique across strata, labels, and coordinate anchors;
- if multiple objects are copied, update the reserved ID set as each new ID is allocated;
- references between copied objects must be updated according to existing behavior;
- coordinate anchors themselves should not be duplicated by layer duplication because they are global/non-layer-bound, unless existing semantics explicitly say otherwise.

Required regression case:

```text
stratum id: source-point
coordinate anchor id: source-point-copy
duplicate layer containing source-point
```

Expected:

- copied stratum id should not be `source-point-copy`;
- it should be something like `source-point-copy-2` or whatever current unique-ID policy produces;
- `validateDiagram` passes.

## 4. Fix bulk / selected duplicate

When duplicating selected objects:

- copied strata/labels must reserve coordinate anchor IDs;
- if coordinate anchors can be selected and duplicated, their copied IDs must also reserve strata/label IDs;
- if coordinate anchors are not duplicated by bulk duplicate yet, ensure their IDs still reserve names for copied strata/labels;
- update selection to newly copied ids according to existing behavior.

Required regression case:

```text
selected stratum id: source-point
existing coordinate anchor id: source-point-copy
bulk duplicate selected stratum
```

Expected:

- copied stratum id does not collide with coordinate anchor id;
- `validateDiagram` passes.

## 5. Update duplicate invariants

Where duplicate tests check uniqueness, include coordinate anchors.

Add or update a helper test:

```ts
expectTopLevelIdsUnique(diagram)
```

should check:

```text
strata ids
label ids
coordinate anchor ids
```

not only strata/labels.

If such helper already exists, update it.

## 6. Preserve coordinateRef behavior

If duplicated objects contain `coordinateRef` references:

- they should continue to reference the same global coordinate anchor unless existing behavior intentionally detaches/copies refs.
- Duplicating a layer should not duplicate global coordinate anchors.
- Duplicating a selected path/point/label with a coordinateRef should preserve the coordinateRef to the existing anchor.
- Ensure ID remapping does not accidentally remap coordinate anchor IDs unless coordinate anchors themselves are duplicated.

Add tests if not already covered.

## 7. Tests

Add focused regression tests.

### ID helper tests

1. `collectReservedDiagramIds` or equivalent includes stratum IDs.

2. It includes label IDs.

3. It includes coordinate anchor IDs.

4. It handles diagrams with no coordinate anchors.

### Layer duplicate tests

5. Duplicate a layer containing stratum `source-point` when coordinate anchor `source-point-copy` already exists.

Expected:

- copied stratum id does not equal `source-point-copy`;
- diagram validates.

6. Duplicate a layer containing label `source-label` when coordinate anchor `source-label-copy` already exists.

Expected:

- copied label id does not equal `source-label-copy`;
- diagram validates.

7. Duplicate a layer with multiple objects where generated IDs could collide with coordinate anchors.

Expected:

- all copied IDs unique across strata/labels/coordinateAnchors.

8. Coordinate anchors are not duplicated by layer duplication unless explicitly supported.

9. CoordinateRefs inside duplicated layer objects still reference existing anchors.

### Bulk duplicate tests

10. Bulk duplicate selected stratum `source-point` when coordinate anchor `source-point-copy` already exists.

Expected:

- copied stratum id avoids collision;
- diagram validates.

11. Bulk duplicate selected label `source-label` when coordinate anchor `source-label-copy` already exists.

Expected:

- copied label id avoids collision;
- diagram validates.

12. Bulk duplicate multiple selected objects with coordinate-anchor ID collisions.

13. If coordinate anchors are selectable and duplicable, duplicating a coordinate anchor must also avoid collisions with strata/labels.

If coordinate anchor duplication is intentionally unsupported, assert bulk duplicate skips/rejects coordinate anchors according to current policy.

14. Bulk duplicate selected object containing coordinateRef preserves reference to existing anchor.

### Validation/invariant tests

15. `validateDiagram` catches any duplicate id across coordinateAnchors and strata/labels.

16. Duplicate helpers always return diagrams passing `validateDiagram` for the regression fixtures.

### Regression tests

17. Existing layer duplicate behavior remains unchanged when no coordinate anchor ID collision exists.

18. Existing bulk duplicate behavior remains unchanged when no coordinate anchor ID collision exists.

19. Undo/redo for layer duplicate still works.

20. Undo/redo for bulk duplicate still works.

21. TikZ output for duplicated objects remains valid.

## 8. Low-priority commit hygiene: include untracked file

Review notes:

```text
src/ui/coordinateAnchorDeletion.ts is currently untracked.
```

If this file is required for Phase 26E functionality:

- make sure it is included in the final diff/commit;
- ensure it is imported from tracked files;
- ensure tests cover behavior that depends on it.

If it is obsolete:

- remove it;
- ensure no imports reference it.

Do not leave a required implementation file untracked.

## 9. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git status --short
```

Manual-style check if practical:

1. Create point/stratum with id conceptually `source-point`.
2. Create coordinate anchor with id `source-point-copy`.
3. Duplicate layer containing the point.
4. Confirm no validation error.
5. Confirm copied point gets a disambiguated id.
6. Repeat via selected/bulk duplicate.
7. Confirm TikZ export still works.

## 10. Preserve existing behavior

Do not regress:

- layer duplicate geometry/style behavior;
- bulk duplicate geometry/style behavior;
- coordinateRef preservation in duplicates;
- coordinate anchor global/non-layer-bound behavior;
- coordinate anchor deletion/detach behavior;
- selection update after duplicate;
- undo/redo;
- save/load;
- TikZ generation;
- inline no-blank-lines;
- 4-space indentation.

## 11. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git status --short
```

## 12. Report after implementation

Please report:

- files modified;
- root cause of duplicate ID collision;
- shared reserved-ID helper behavior;
- layer duplicate ID allocation fix;
- bulk duplicate ID allocation fix;
- coordinate anchor duplication policy if relevant;
- coordinateRef behavior in duplicated objects;
- whether `src/ui/coordinateAnchorDeletion.ts` is tracked or removed;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
