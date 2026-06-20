# Phase 20C Fix Prompt: Coons patch boundary direction display and per-boundary reverse controls

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

Phase 20C implemented Coons patch creation from four boundary paths.

Recent fixes attempted to infer/reinterpret boundary orientation automatically. However, the actual desired behavior is different:

- During **Coons patch path selection only**, the UI should show the direction of each selected boundary path.
- The user should be able to manually reverse the direction of each selected boundary path inside the Coons patch creation draft.
- This reversal should affect only the copied boundary snapshot used for creating the Coons patch.
- The original source path must not be mutated.
- The user should not need to leave Add sheet > Coons mode to fix path directions.

Current user-facing problem:

- Four paths can form a geometrically closed boundary.
- But if one or more paths are oriented opposite to the canonical Coons convention, creation fails with an error like:

```text
Coons patch corners must match: bottom start = left start, bottom end = right start, top start = left end, and top end = right end.
```

Desired fix:

- In Add sheet > Coons mode, after selecting boundary paths, show each path's current effective direction.
- Provide a Reverse button/toggle per boundary role:
  - bottom;
  - right;
  - top;
  - left.
- The user can flip any role's effective direction and immediately revalidate the Coons corner conditions.

## Goal

Implement user-controlled boundary direction reversal for Coons patch creation.

Specifically:

1. Coons boundary picking still uses the explicit role order:

```text
bottom -> right -> top -> left
```

2. Each picked boundary stores an orientation override in the Coons creation draft.

3. The UI displays the effective direction of each picked path.

4. The UI provides a per-boundary reverse control.

5. Coons patch creation uses the effective oriented snapshots.

6. Source paths remain unchanged.

7. This direction UI is only for Coons patch boundary picking. Do not add broad direction controls for all path selection modes.

## Scope

This is a targeted Phase 20C fix.

Implement:

- Coons boundary draft orientation flags;
- per-role reverse controls in Add sheet > Coons mode;
- effective boundary snapshot generation based on orientation flag;
- direction/status display for picked boundaries;
- optional SVG direction indicators while picking Coons boundaries;
- validation using oriented snapshots;
- tests.

Do not implement:

- general path direction editing UI;
- broad multi-selection;
- new surface types;
- snapping;
- live linked boundaries;
- automatic role inference from unordered paths;
- mutating source path direction;
- new dependencies.

Do not change:

- Coons patch formula;
- Coons boundary role order;
- source path geometry;
- saved source paths;
- copy-on-create policy;
- SVG/TikZ export semantics for already-created valid Coons patches;
- ruled surface behavior unless a shared pure helper is safely reused;
- save/load format for completed Coons patches unless absolutely necessary.

## 1. Add Coons boundary orientation state to the creation draft

Extend the Coons creation draft state.

Suggested shape:

```ts
type CoonsBoundaryRole = "bottom" | "right" | "top" | "left";

type PickedCoonsBoundary = {
  sourcePathId: string;
  reversed: boolean;
};

type CoonsPatchBoundaryDraft = {
  kind: "coonsPatch";
  bottom?: PickedCoonsBoundary;
  right?: PickedCoonsBoundary;
  top?: PickedCoonsBoundary;
  left?: PickedCoonsBoundary;
  nextRole: CoonsBoundaryRole;
  status?: string;
};
```

Exact shape can differ.

Requirements:

- `reversed` defaults to `false` when a path is picked.
- Toggling reverse flips only the draft's `reversed` value.
- Source path data is not modified.
- Draft state is UI/editor state only.
- Draft state is not saved in `Diagram`.
- Draft state is cleared on Finish/Create, Cancel, Reset, or intentional tool switch according to existing creation-draft policy.

## 2. Add pure boundary reversal helper if not already robust

Add or reuse:

```ts
reverseBoundaryPathSnapshot(boundary: BoundaryPathSnapshot): BoundaryPathSnapshot
```

Requirements:

- does not mutate input;
- reverses segment order;
- reverses each segment;
- line segment:
  - start/end swapped;
- cubic Bézier segment:
  - start = old end;
  - control1 = old control2;
  - control2 = old control1;
  - end = old start;
- arc segment, if supported:
  - start/end swapped;
  - direction flipped;
  - start/end angles swapped or adjusted consistently;
  - center/radius/frame preserved;
- preserves symbolic coordinate metadata;
- preserves any boundary metadata that should survive copying.

If this helper already exists, add tests if missing and use it consistently.

## 3. Effective boundary snapshots

Add a helper to resolve Coons draft boundaries into effective oriented snapshots.

Suggested:

```ts
resolveCoonsDraftBoundarySnapshot(
  diagram: Diagram,
  picked: PickedCoonsBoundary
): Result<BoundaryPathSnapshot, ValidationError>
```

or:

```ts
orientedCoonsBoundarySnapshot(sourceSnapshot, reversed): BoundaryPathSnapshot
```

Behavior:

- copy source path boundary snapshot;
- if `reversed === true`, reverse the copy;
- return oriented copy;
- never mutate source path.

Add helper:

```ts
resolveCoonsDraftBoundaries(draft, diagram): Result<{
  bottom: BoundaryPathSnapshot;
  right: BoundaryPathSnapshot;
  top: BoundaryPathSnapshot;
  left: BoundaryPathSnapshot;
}, ValidationError>
```

Requirements:

- fails if any role is missing;
- fails if source path no longer exists;
- fails if source path is unsupported;
- returns effective oriented boundaries for validation/creation.

## 4. Coons UI: show direction and reverse controls

In Add sheet > Coons mode, show the selected boundary roles and their direction.

Suggested UI:

```text
Coons patch boundaries
  Bottom: pathName [start -> end] [Reverse]
  Right:  pathName [start -> end] [Reverse]
  Top:    pathName [start -> end] [Reverse]
  Left:   pathName [start -> end] [Reverse]

Next: top
[Reset] [Create]
```

The exact layout can differ.

Direction display should be understandable.

Acceptable direction display options:

### Option A: Endpoint coordinates

```text
Bottom: boundaryA  (0,0,0) -> (1,0,0)
```

### Option B: Endpoint labels/names if available

```text
Bottom: boundaryA  start -> end
```

### Option C: Direction arrow in SVG plus textual reversed state

```text
Bottom: boundaryA  normal direction
Bottom: boundaryA  reversed
```

Preferred:

- show path name/id;
- show whether effective direction is normal or reversed;
- show start/end coordinates if compact.

Requirements:

- Reverse button/toggle exists for each picked role;
- Reverse is disabled/hidden for roles not picked yet;
- clicking Reverse updates status/validation immediately;
- Create button becomes enabled when oriented boundaries satisfy Coons validation;
- Create button remains disabled when they do not;
- validation error should update after reversal.

## 5. Optional SVG direction indicators while picking Coons paths

If feasible, add preview-only direction indicators for picked Coons boundaries.

Examples:

- small arrow marker along each selected boundary;
- label with role name;
- different highlight for reversed boundaries.

Requirements:

- only active during Add sheet > Coons mode;
- preview-only;
- not stored in `Diagram`;
- not exported to TikZ;
- does not intercept pointer events.

MVP without SVG arrows is acceptable if textual direction/reverse UI is clear.

Report limitation if SVG direction display is deferred.

## 6. Validation and Create behavior

When Create is clicked:

1. Resolve effective oriented boundary snapshots from draft.
2. Validate all four roles are present.
3. Validate boundary paths are open if that is current Coons policy.
4. Validate canonical Coons corner equations:

```text
bottom.start == left.start
bottom.end   == right.start
top.start    == left.end
top.end      == right.end
```

5. If valid:
   - create Coons patch from oriented copied snapshots;
   - select created surface;
   - clear draft;
   - push one undo history entry if undo/redo exists.
6. If invalid:
   - do not create anything;
   - keep draft boundaries and orientation flags;
   - show concise error.

Important:

- Do not auto-reverse behind the user's back in this fix.
- The user chooses reversal via UI.
- If an existing auto-orientation helper remains, either disable it for the Coons UI path or make sure the user's explicit reverse settings are respected.
- Avoid confusing behavior where the UI says one orientation but creation uses another.

## 7. Error messages

The current corner mismatch error is too opaque.

Keep the canonical requirement if needed, but add role/direction guidance.

Examples:

```text
Coons corners do not match with the current boundary directions. Try reversing top or left.
```

```text
Bottom end does not match right start. Reverse bottom or right, or choose a different path.
```

If detailed suggestions are hard, at least say:

```text
Coons corners do not match with the current boundary directions. Use Reverse controls to adjust boundary directions.
```

## 8. Interaction with sequential picking

Preserve sequential picking behavior:

```text
bottom -> right -> top -> left
```

When a path is picked:

- store it in the next role;
- set `reversed = false`;
- advance to next role;
- keep previous roles and reversal flags.

When the user toggles a previously picked role:

- do not change `nextRole`;
- do not clear other picks.

Reset:

- clears all picks and reversal flags.

Cancel/tool switch:

- follows existing draft clearing policy.

## 9. Do not mutate source paths

This is critical.

Tests should confirm:

- source path segment order remains unchanged;
- source path start/end remain unchanged;
- only the copied boundary snapshot in the Coons patch is oriented/reversed.

The created Coons patch may store a reversed copy.

## 10. Tests

Add focused tests.

### Draft state tests

1. Picking bottom stores `reversed: false`.
2. Picking right/top/left stores `reversed: false`.
3. Toggling bottom reverse flips only bottom.
4. Toggling top reverse does not clear bottom/right/left.
5. Reset clears all picked boundaries and reversal flags.
6. Missing role prevents Create.

### Boundary reversal tests

7. Reversing a line boundary swaps endpoints.
8. Reversing a cubic boundary swaps endpoints and control points.
9. Reversing a multi-segment boundary reverses segment order.
10. Reversal preserves symbolic coordinate metadata.
11. Reversal does not mutate source snapshot.

### Coons creation tests with explicit reversal

12. Cyclic boundary case:

```text
bottom: A -> B
right:  B -> C
top:    C -> D
left:   D -> A
```

With `top.reversed = true` and `left.reversed = true`, creation succeeds.

13. Same cyclic case without reversing top/left fails with a direction/corner message.

14. Canonical boundary case succeeds without reversals:

```text
bottom: A -> B
right:  B -> C
top:    D -> C
left:   A -> D
```

15. Reversing the wrong boundary still fails.

16. Created Coons patch stores oriented boundary snapshots.

17. Source paths are unchanged after creation.

### UI/helper tests

18. Reverse control is available for picked roles.
19. Reverse control is unavailable for unpicked roles.
20. Create button becomes enabled only when effective oriented boundaries validate, if UI state is testable.
21. Error message mentions using Reverse controls when directions mismatch.

### Regression tests

22. Sequential Coons picking still works.
23. Closed Coons boundary rejection still works.
24. Ruled surface creation still works.
25. SVG preview/TikZ export for created Coons patch still works.
26. Save/load of valid Coons patch still works.
27. Inline/standalone TikZ formatting unchanged.

If full UI tests are difficult, extract pure draft reducers and orientation helpers and test those. Still wire the actual UI to those helpers.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manual test:

1. Create four open paths forming a closed loop:
   - bottom: A -> B;
   - right: B -> C;
   - top: C -> D;
   - left: D -> A.
2. Enter Add sheet > Coons mode.
3. Pick paths in order:
   - bottom;
   - right;
   - top;
   - left.
4. Confirm the UI shows all four picked paths.
5. Confirm the UI shows direction or normal/reversed state.
6. Confirm Create is disabled or shows corner mismatch.
7. Reverse top.
8. Reverse left.
9. Confirm validation updates.
10. Confirm Create becomes enabled.
11. Create Coons patch.
12. Confirm surface appears and is selected.
13. Confirm source paths remain unchanged.
14. Undo/redo.

Failure test:

15. Reverse the wrong boundary.
16. Confirm creation remains blocked with useful error.

Canonical test:

17. Create four paths already in canonical orientation.
18. Pick them.
19. Confirm no reversal is needed.

## 12. Documentation / UI help

Update UI help or docs:

- Coons boundaries are picked by role:
  - bottom;
  - right;
  - top;
  - left.
- The direction of each picked path matters.
- Use Reverse to flip a boundary direction for the Coons patch.
- Source paths are not modified.
- Reversal only affects the copied boundary used by the new Coons patch.

## 13. Preserve existing behavior

Do not regress:

- Coons sequential boundary picking;
- Coons closed-boundary rejection;
- Coons corner validation;
- Coons SVG preview;
- Coons TikZ export;
- ruled surface creation;
- source path copy-on-create;
- save/load;
- undo/redo;
- layer/style/camera/work-plane behavior;
- inline/standalone TikZ formatting.

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
- Coons draft orientation state shape;
- UI direction display;
- Reverse control behavior;
- effective boundary snapshot resolution;
- how source paths remain unchanged;
- validation behavior before/after reversal;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
