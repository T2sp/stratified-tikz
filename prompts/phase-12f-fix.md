# Phase 12F Fix

## Goal

Fix the remaining Phase 12F issues around save/load sanitization and stale active custom work-plane validation.

The review found no Critical issues, but Phase 12F is **not ready to commit** because there are two Medium issues.

## Required Fixes

### 1. Sanitize saved diagram JSON during load

`parseSavedDiagramJson` currently accepts diagram-like objects and returns the original loaded object unchanged. As a result, editor-only fields that are already present in JSON can persist after loading and be saved back out.

Relevant locations:

- `src/model/serialization.ts:23`
- `src/model/serialization.ts:74`
- `src/model/serialization.ts:105`

Problematic behavior:

- `isDiagramLike` only checks required fields.
- `parseSavedDiagramJson` returns the original object.
- A JSON file containing an editor-only field such as `diagram.activeWorkPlane` parses successfully.
- Calling `serializeDiagram(parsed.diagram)` then includes `activeWorkPlane`.
- This violates the save/load separation requirement.

Fix this by either:

- sanitizing loaded diagram objects so only valid persistent `Diagram` fields are retained, or
- rejecting saved diagram JSON that contains editor-only fields such as `activeWorkPlane`.

Prefer the approach that best matches the existing serialization design. In either case, ensure editor-only UI state cannot round-trip through saved diagram JSON.

### 2. Revalidate applied active custom work planes when source points change

Applied active custom work planes derived from `existingPointStrata` are currently only normalized when `editableDiagram.ambientDimension` changes.

Relevant locations:

- `src/App.tsx:553`
- `src/App.tsx:567`
- `src/ui/workPlaneControls.ts:423`

Problematic behavior:

- The helper correctly detects stale point IDs.
- The point-picking draft is revalidated on every diagram change.
- However, an already-applied active custom work plane is not revalidated when its source point strata are deleted, undone, or redone within the same ambient dimension.
- This can leave the active work plane referencing stale point IDs.

Fix this so that applied active custom work planes with:

```ts
source.kind === "existingPointStrata"
```

are revalidated on every relevant diagram change, including:

- deletion of source point strata,
- undo of source point creation,
- redo operations that affect source points,
- any other diagram update that can invalidate the referenced source point IDs.

When the active work plane becomes invalid, normalize/reset it consistently with the existing work-plane behavior.

## Regression Tests

Add regression tests for both issues.

### Serialization test

Add a test proving that editor-only fields such as `activeWorkPlane` cannot round-trip through saved diagram JSON.

The test should cover a JSON input that includes:

```ts
diagram.activeWorkPlane
```

and assert that after parsing and serializing, the editor-only field is not present, or that the JSON is rejected if that is the chosen design.

### Active work-plane validation test

Add a test proving that an applied custom work plane derived from `existingPointStrata` is revalidated when its source points are removed or restored through undo/redo.

The test should confirm that a stale active plane does not remain active after the referenced source point IDs are no longer present in the editable diagram.

## Preserve Existing Correct Behavior

Do not regress the following Phase 12F behavior:

- Work planes remain represented as model-space geometry with `origin`, `u`, `v`, and `normal`.
- Work planes do not encode camera/projection assumptions.
- Projection logic remains separated in `src/geometry/projection.ts`.
- `projectModelToScreen` continues to take model points and camera state explicitly.
- Future screen-ray/plane-intersection work remains feasible because custom planes expose a normal and model-space basis.
- TikZ export consumes `Diagram` data only and does not export work-plane previews or active UI state.
- Undo history remains diagram-only.
- Active work-plane changes must not create history entries.
- Geometry created on a custom plane remains ordinary undoable diagram data.
- Existing axis-aligned `xy`, `xz`, and `yz` behavior is preserved.

## Verification Commands

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
```

and:

```bash
PATH=/opt/homebrew/bin:$PATH npm run build
```

Both commands must pass before considering Phase 12F fixed.

## Completion Criteria

Phase 12F can be considered complete only when:

- editor-only fields such as `activeWorkPlane` cannot persist through save/load,
- applied custom work planes sourced from existing point strata are revalidated after relevant diagram changes,
- regression tests cover both fixes,
- all tests pass,
- the production build passes.
