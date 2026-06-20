# Phase 20C Fix Prompt: Sequential boundary-path picking for Ruled surfaces and Coons patches

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

Phase 20B/20C added ruled surfaces and Coons patches.

Manual UI check found a serious workflow issue:

- In Add sheet mode, Coons patch creation can only use the one path that is already selected when entering the mode.
- For each of `bottom`, `right`, `top`, `left`, the user currently needs to leave Add sheet mode, go back to Select mode, select another path, and then return.
- Returning to Select mode clears the previously picked boundary information, so it is not possible to pick all four Coons boundaries in one workflow.
- Ruled surface creation has the same problem for its two boundary paths.

Desired behavior:

- In Add sheet > Coons mode, users should be able to click existing paths directly and pick them sequentially without leaving Add sheet mode.
- Coons picking order should be:

```text
bottom -> right -> top -> left
```

- In Add sheet > Ruled surface mode, users should be able to click two existing paths sequentially without leaving Add sheet mode.
- Previously picked paths should remain stored in the current creation draft until the user finishes, cancels, resets, or changes tool intentionally.

## Goal

Fix the Add sheet ruled/Coons creation workflow so boundary paths can be selected continuously inside Add sheet mode.

The user should not need to switch to Select mode between boundary picks.

## Scope

This is a targeted Phase 20B/20C UI/workflow fix.

Implement:

- sequential boundary picking while Add sheet mode is active;
- Coons boundary draft state for `bottom`, `right`, `top`, `left`;
- ruled surface boundary draft state for `boundary0`, `boundary1`;
- path click handling in Add sheet mode;
- visible status/progress text;
- highlight of already picked boundary paths if infrastructure exists;
- tests for the draft state and click handling where practical.

Do not implement:

- new surface primitives;
- new geometry formulas;
- auto-visibility/depth sorting;
- broad multi-selection;
- general selection redesign;
- live linked boundaries;
- snapping;
- new dependencies.

Do not change:

- ruled surface data model except if needed for picking state;
- Coons patch data model except if needed for picking state;
- copy-on-create boundary policy;
- Coons corner validation;
- SVG/TikZ export semantics;
- save/load format;
- normal Select mode behavior.

## 1. Add explicit boundary-picking draft state

Do not rely on global `selectedElement` as the only source for boundary paths.

Add or refine Add sheet draft state so it stores picked boundary path IDs/roles.

Suggested state shape:

```ts
type RuledSurfaceBoundaryDraft = {
  kind: "ruledSurface";
  boundary0Id?: string;
  boundary1Id?: string;
  nextRole: "boundary0" | "boundary1";
  status?: string;
};

type CoonsPatchBoundaryDraft = {
  kind: "coonsPatch";
  bottomId?: string;
  rightId?: string;
  topId?: string;
  leftId?: string;
  nextRole: "bottom" | "right" | "top" | "left";
  status?: string;
};
```

Exact shape can differ.

Requirements:

- draft state is UI/editor state only;
- draft state is not stored in `Diagram`;
- draft survives path clicks while staying in Add sheet mode;
- draft is cleared on Cancel/Reset/Finish;
- draft is cleared or validated when changing tool/mode if existing creation drafts behave that way;
- draft is not exported to TikZ.

## 2. Coons patch sequential picking workflow

In Add sheet > Coons mode:

1. Initially prompt:

```text
Pick bottom boundary path
```

2. User clicks an existing path.
3. Store it as `bottom`.
4. Prompt:

```text
Pick right boundary path
```

5. User clicks another existing path.
6. Store it as `right`.
7. Prompt:

```text
Pick top boundary path
```

8. Store clicked path as `top`.
9. Prompt:

```text
Pick left boundary path
```

10. Store clicked path as `left`.
11. Once all four are present, enable Create/Finish.

Required:

- boundary role order is exactly `bottom -> right -> top -> left`;
- user does not leave Add sheet mode;
- previously picked boundary IDs are not lost;
- repeated clicks on the same path are rejected unless explicitly allowed;
- invalid clicked objects are rejected without clearing previous picks;
- status message indicates progress, e.g.:

```text
Coons patch: picked 2/4. Next: top.
```

- optional Back/Undo-pick button may remove the last picked boundary;
- Reset clears all picked boundaries;
- Cancel exits/clears draft according to existing Add sheet behavior.

## 3. Ruled surface sequential picking workflow

In Add sheet > Ruled surface mode:

1. Prompt:

```text
Pick first boundary path
```

2. User clicks an existing path.
3. Store as `boundary0`.
4. Prompt:

```text
Pick second boundary path
```

5. User clicks another existing path.
6. Store as `boundary1`.
7. Enable Create/Finish.

Required:

- user does not leave Add sheet mode;
- previously picked boundary is not lost;
- duplicate path rejected unless explicitly allowed;
- invalid clicked objects rejected without clearing previous pick;
- status message indicates progress.

## 4. Click handling in Add sheet mode

Inspect:

- `App.tsx` Add sheet creation handlers;
- `SvgDiagram.tsx` click handlers;
- selection click handlers for curves/paths;
- surface creation UI.

Currently, existing path clicks likely route to normal selection only in Select mode.

Modify click handling so that:

### In Select mode

- clicking a path selects it as before.

### In Add sheet > Coons mode

- clicking an eligible path uses it as the next Coons boundary role;
- it should not replace global selection as the primary workflow;
- it should not clear previously picked roles;
- it should not accidentally create a different sheet vertex.

### In Add sheet > Ruled mode

- clicking an eligible path uses it as the next ruled boundary;
- same constraints as above.

### In other Add sheet modes

- existing behavior remains unchanged.

Avoid breaking:

- ordinary path selection;
- cursor creation of polygon sheets;
- point picking for work planes;
- coordinate source picking;
- camera dragging;
- handle dragging.

## 5. Eligible boundary paths

Define which existing objects can be boundary paths.

Preferred eligible objects:

- concatenated paths;
- path templates if boundary extraction supports them:
  - circle;
  - ellipse;
  - arc-containing path if closed/open rules match;
- other curve strata only if existing boundary evaluation supports them.

For ruled surfaces:

- open paths allowed if both boundaries have compatible closure status;
- closed paths allowed if both are closed;
- mismatch rejected according to existing Phase 20A/20B policy.

For Coons patches:

- each boundary should be an open path with endpoints matching the adjacent boundaries;
- if closed paths are not meaningful for a Coons boundary, reject them with a clear message.
- corner compatibility is checked after four picks.

Do not silently accept unsupported curve kinds.

## 6. Validation timing

Validation should happen in two stages.

### On each pick

Validate:

- clicked object is an eligible path;
- path has finite/evaluable geometry;
- path can be used as boundary snapshot;
- duplicate path not already picked for this draft unless allowed.

If invalid:

- show status message;
- keep existing picked boundaries unchanged.

### On Finish/Create

Validate full surface:

Ruled:

- two boundaries present;
- ruled surface validation passes.

Coons:

- all four boundaries present;
- corner compatibility passes:
  - bottom start = left start;
  - bottom end = right start;
  - top start = left end;
  - top end = right end;
- Coons sampling validation passes.

If final validation fails:

- keep draft data so user can reset/back/fix;
- do not create invalid diagram data.

## 7. Boundary highlighting / preview

If the project already has coordinate-source or picked-source highlighting, reuse it.

Preferred:

- picked boundary paths are highlighted in SVG preview;
- different roles are labeled or indicated:
  - bottom;
  - right;
  - top;
  - left;
- next expected role is shown in UI status.

MVP acceptable:

- text status only, no highlight;
- but report highlight limitation.

Do not store highlights in `Diagram`.

Do not export highlights to TikZ.

## 8. Create/Finish behavior

When the user clicks Create/Finish:

Ruled surface:

- copy boundary path snapshots from the two picked paths;
- create one ruled surface stratum;
- select created surface;
- clear draft;
- push one undo history entry if undo/redo exists.

Coons patch:

- copy four boundary path snapshots;
- create one Coons patch stratum;
- select created surface;
- clear draft;
- push one undo history entry if undo/redo exists.

Source paths remain unchanged.

No live linking.

## 9. UI controls

Add or adjust controls in Add sheet mode.

Suggested UI:

```text
Sheet type:
  Polygon
  Ruled surface
  Coons patch

Ruled surface:
  Picked:
    Boundary 1: <name or none>
    Boundary 2: <name or none>
  Next: Boundary 2
  [Back] [Reset] [Create]

Coons patch:
  Picked:
    Bottom: <name or none>
    Right: <name or none>
    Top: <name or none>
    Left: <name or none>
  Next: Top
  [Back] [Reset] [Create]
```

Requirements:

- Create disabled until required boundaries are picked;
- Reset visible;
- Cancel/back behavior clear;
- UI remains compact and does not overflow badly;
- switching between Ruled and Coons should reset or convert draft in a predictable way.

## 10. Tests

Add focused tests.

### Draft-state tests

1. Coons draft starts with next role `bottom`.
2. Picking first path stores `bottom` and advances to `right`.
3. Picking second path stores `right` and advances to `top`.
4. Picking third path stores `top` and advances to `left`.
5. Picking fourth path stores `left` and enables create.
6. Reset clears all Coons picks.
7. Duplicate path pick rejected without clearing previous picks.

8. Ruled draft starts with `boundary0`.
9. Picking first path stores `boundary0` and advances to `boundary1`.
10. Picking second path stores `boundary1` and enables create.
11. Reset clears ruled picks.

### Click-handling tests

12. In Select mode, clicking a path selects it normally.
13. In Add sheet > Coons mode, clicking a path adds it as next boundary instead of requiring Select mode.
14. In Add sheet > Ruled mode, clicking a path adds it as next boundary.
15. Invalid clicked object does not clear draft.
16. Switching away from Add sheet clears or validates draft according to policy.

### Creation tests

17. Coons surface can be created after four sequential path clicks.
18. Ruled surface can be created after two sequential path clicks.
19. Created surface uses copied boundary snapshots.
20. Source paths unchanged.
21. Created surface selected.
22. Undo/redo creation if testable.

### Validation tests

23. Coons corner mismatch after four picks prevents creation but keeps draft.
24. Ruled incompatible boundaries rejected at finish.
25. Unsupported curve kind rejected.

### Regression tests

26. Polygon sheet creation still works.
27. Existing path selection still works.
28. Point picking for work plane still works.
29. Coordinate source picking still works.
30. SVG/TikZ export for existing ruled/Coons surfaces unchanged.

If full UI pointer tests are difficult, extract pure draft reducer/helper functions and test them. Still wire the actual App/SvgDiagram click path to those helpers.

## 11. Documentation

Update docs or inline UI help:

- Coons patch boundaries are picked in order:
  - bottom;
  - right;
  - top;
  - left.
- Ruled surface boundaries are picked sequentially.
- Boundary picks are copy-on-create.
- No need to switch to Select mode.

## 12. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify Coons:

1. Create four compatible boundary paths.
2. Enter Add sheet mode.
3. Select Coons patch mode.
4. Click bottom path.
5. Confirm UI says next is right.
6. Click right path.
7. Confirm UI says next is top.
8. Click top path.
9. Confirm UI says next is left.
10. Click left path.
11. Confirm Create is enabled.
12. Create Coons patch.
13. Confirm surface appears and is selected.
14. Confirm source paths remain.
15. Undo/redo.

Verify Ruled:

16. Enter Add sheet mode.
17. Select Ruled surface mode.
18. Click first boundary path.
19. Click second boundary path.
20. Create ruled surface.
21. Confirm it appears and is selected.

Regression:

22. Switch to Select mode.
23. Click a path.
24. Confirm it selects normally.
25. Create polygon sheet as before.
26. Confirm no regression.

## 13. Preserve existing behavior

Do not regress:

- existing ruled surface data/sampling;
- existing Coons patch data/sampling;
- polygon sheet creation;
- path selection in Select mode;
- source path copy-on-create;
- SVG preview;
- TikZ export;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior;
- inline/standalone export formatting.

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
- root cause of the one-path-only workflow;
- new ruled surface boundary draft behavior;
- new Coons patch boundary draft behavior;
- click-handling changes in Add sheet mode;
- validation behavior;
- highlight/status behavior;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
