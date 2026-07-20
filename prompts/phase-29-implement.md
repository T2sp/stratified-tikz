# Phase 29 Implementation Prompt: Live-linked Coons patch boundary synchronization

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
git diff --check
```

Also run, if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add new dependencies unless they are clearly necessary and justified.

## Project context

You are working on the StratifiedTikZ project.

Current public repository:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 28 is complete.

The editor already supports:

- 2D and 3D diagrams;
- SVG/PGF Preview-centered editing;
- cursor and direct creation;
- points, labels, paths, polygon sheets, filled regions/sheets, curved sheets, ruled surfaces, and Coons patches;
- polylines, cubic Beziers, concatenated paths, and path templates;
- constant-point Coons boundaries;
- per-boundary Coons direction reversal during creation;
- coordinate anchors and coordinate references;
- symbolic variables and symbolic coordinates;
- work-plane-local coordinates;
- multi-selection and bulk editing;
- layers and layer operations;
- JSON save/load;
- undo/redo;
- SVG and TikZ export.

Important project conventions:

- An `n`-stratum means codimension `n`, not geometric dimension.
- All model coordinates are `Vec3`.
- Coons patches are 3D codimension-1 sheet strata.
- Keep model, geometry, rendering, TikZ generation, and UI concerns separated.
- Use strict TypeScript and avoid `any`.
- Prefer small, pure, testable helpers.
- UI-only state must not be stored in `Diagram`.
- Persistent boundary-link metadata is diagram data and must round-trip through JSON.
- Exported TikZ must keep the existing readable formatting, including 4-space indentation.
- Inline-math TikZ output must continue to contain no blank lines.

## Current Coons patch behavior

The current Coons patch implementation stores materialized copies of its four boundaries:

```ts
type CoonsPatchPrimitive = {
  kind: 'coonsPatch'
  bottom: CoonsBoundarySnapshot
  right: CoonsBoundarySnapshot
  top: CoonsBoundarySnapshot
  left: CoonsBoundarySnapshot
  sampling: SurfaceSampling
}
```

During creation, the editor already knows, for each role:

- the source path or point ID;
- whether a path boundary is reversed.

However, that source-selection metadata is not currently retained in the committed primitive.

`sampleCoonsPatch` samples the stored `bottom`, `right`, `top`, and `left` snapshots directly. Therefore, the existing sampling, SVG rendering, and TikZ export pipeline should continue to consume materialized snapshots.

The current documentation explicitly describes Coons boundaries as copied geometry and says later source-path edits do not update the patch.

## Goal

Implement optional live-linked boundary sources for Coons patches.

When a linked source boundary path or constant-point source is edited after Coons patch creation:

- the existing Coons patch should refresh its stored boundary snapshots;
- SVG Preview should update;
- TikZ and SVG export should use the refreshed geometry;
- the patch ID, name, layer, style, sampling settings, and boundary roles must remain unchanged;
- the original per-role `reversed` setting must remain effective;
- the source edit and dependent patch refresh must be one undoable diagram edit.

Keep the current snapshot-based rendering/export architecture.

Do not turn Coons sampling or rendering into a runtime lookup of arbitrary source strata.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `docs/ROADMAP.md`;
- `docs/RULED_SURFACES.md`;
- `docs/DATA_MODEL.md`, if it documents curved-sheet primitives;
- `src/model/types.ts`;
- `src/ui/ruledSurface.ts`;
- `src/geometry/curvedSheets.ts`;
- `src/ui/undo.ts`;
- the central diagram-update and geometry-handle update paths;
- curved-sheet clone, translation, duplication, coordinate-reference-detach, and serialization helpers;
- the existing Coons patch, undo, serialization, SVG, and TikZ tests.

Do not assume the filenames listed below are the only required change sites. Search for all exhaustive `coonsPatch` switches and primitive cloning/normalization code.

## Required architecture

Use a hybrid representation:

1. Keep the four materialized boundary snapshots in `CoonsPatchPrimitive`.
2. Add optional persistent metadata identifying the linked source for each role.
3. Refresh the materialized snapshots after a relevant source change.
4. Continue rendering, sampling, and exporting from the materialized snapshots.

A suitable conceptual model is:

```ts
export type CoonsPatchBoundaryRole =
  | 'bottom'
  | 'right'
  | 'top'
  | 'left'

export type CoonsPatchBoundarySource =
  | {
      kind: 'path'
      sourcePathId: string
      reversed: boolean
    }
  | {
      kind: 'point'
      sourcePointId: string
    }

export type CoonsPatchBoundarySources = Record<
  CoonsPatchBoundaryRole,
  CoonsPatchBoundarySource
>

export type CoonsPatchPrimitive = {
  kind: 'coonsPatch'
  bottom: CoonsBoundarySnapshot
  right: CoonsBoundarySnapshot
  top: CoonsBoundarySnapshot
  left: CoonsBoundarySnapshot

  /**
   * Missing means a static, snapshot-only Coons patch.
   */
  boundarySources?: CoonsPatchBoundarySources

  sampling: SurfaceSampling
}
```

Names may be adapted to existing repository conventions, but the semantics above are required.

Move or expose `CoonsPatchBoundaryRole` at model level if necessary. The model layer must not import a role type from the UI layer.

Do not use `BoundaryPathSnapshot.id` or `CoonsConstantPointBoundarySnapshot.sourceId` as the sole indication that a patch is live-linked.

Those fields are insufficient because:

- they are optional;
- they do not reliably encode the per-role reverse state;
- old snapshot-only JSON files may contain source-looking IDs without intending a live link;
- point and path boundaries have different source fields.

Existing Coons patches without `boundarySources` must remain static.

Do not automatically infer links for old patches from snapshot IDs.

## Coons patch creation

Update the Add sheet > Coons workflow so that newly created patches may retain their boundary sources.

Add a compact creation option:

```text
☑ Keep linked to boundary sources
```

Requirements:

- checked by default;
- UI draft state only until the patch is created;
- not stored separately in `Diagram`;
- when checked, store normalized `boundarySources`;
- when unchecked, omit `boundarySources` and preserve the current snapshot-only behavior;
- retain the path/point distinction;
- retain each path role’s current `reversed` value;
- do not modify or reverse the original source path itself.

Continue resolving, detaching coordinate references from, and validating the initial materialized snapshots exactly as required by the existing creation flow.

Creating a linked patch must still fail safely when the initial four boundaries are invalid.

## Boundary synchronization helper

Add a pure synchronization helper in an appropriate model or geometry module.

A possible API is:

```ts
type SynchronizeLinkedCoonsPatchesOptions = {
  mode?: 'changedSources' | 'full'
}

type SynchronizeLinkedCoonsPatchesResult = {
  diagram: Diagram
  updatedPatchIds: string[]
  issues: CoonsPatchBoundaryLinkIssue[]
}

function synchronizeLinkedCoonsPatches(
  previousDiagram: Diagram | null,
  nextDiagram: Diagram,
  options?: SynchronizeLinkedCoonsPatchesOptions,
): SynchronizeLinkedCoonsPatchesResult
```

The exact API may follow current conventions, but the helper must remain pure and independently testable.

### Reuse existing boundary logic

Reuse or extract the current pure behavior used by:

- `resolveCoonsPatchBoundarySnapshots`;
- `validateCoonsPatchBoundaryPathSource`;
- `validateCoonsPatchBoundaryPointSource`;
- `boundaryPathSnapshotFromCurveStratum`;
- `orientedCoonsBoundarySnapshot`;
- coordinate-reference detachment;
- `validateCurvedSheetPrimitive`;
- existing corner validation.

Do not duplicate a second, subtly different implementation of Coons boundary validation.

If these helpers currently live in `src/ui/ruledSurface.ts`, move the reusable model/geometry logic to an appropriate non-React module while keeping UI-specific draft and message logic in the UI layer.

### Source-change detection

Do not blindly rebuild every linked Coons patch after every unrelated diagram edit.

A refresh must be triggered when the resolved geometry of one of its linked sources changes, including changes caused by:

- polyline or cubic-Bezier point editing;
- concatenated path segment editing;
- path-template editing;
- path direction reversal;
- point-source movement;
- coordinate-anchor movement;
- coordinate-reference changes;
- symbolic-variable changes that alter resolved preview geometry;
- layer or bulk translation that changes a linked source;
- deletion or invalidation of a linked source.

A robust approach is to resolve linked source boundaries against both the previous and next diagrams and compare the resulting source-derived geometry.

This is preferable to checking only whether the source stratum object changed, because a coordinate anchor or symbolic variable may change the resolved path geometry without replacing the source path stratum itself.

For JSON load, initialization, or another context without a previous diagram, support a full synchronization attempt.

### Atomic refresh

For a patch whose source geometry changed:

1. Resolve all four boundary sources from the same `nextDiagram`.
2. Apply each stored path `reversed` flag.
3. Detach coordinate references using the existing snapshot policy.
4. Construct one complete candidate `CoonsPatchPrimitive`.
5. Validate the complete candidate, including all corner equations.
6. Commit all four new snapshots together only when the candidate is valid.
7. Preserve:
   - patch ID;
   - name;
   - layer;
   - style;
   - sampling settings;
   - `boundarySources`.

Never update only one or two roles and leave the patch in a partially refreshed state.

Do not change the Coons formula or sampling counts during synchronization.

### Invalid or missing sources

A source edit itself must not be rejected merely because it temporarily makes a linked Coons patch invalid.

If any linked source is:

- missing;
- no longer a supported boundary path or point;
- wrong-codimension;
- closed when an open Coons boundary is required;
- non-finite;
- otherwise invalid;
- incompatible with the other three corners;

then:

- accept the source edit;
- do not corrupt or delete the Coons patch;
- retain the patch’s last valid materialized boundary snapshots;
- retain its `boundarySources`;
- report a derived stale/broken-link status;
- continue rendering and exporting the last valid patch geometry.

If the user later repairs the sources so that all four boundaries are valid again, the patch must automatically catch up on the next synchronization.

Do not automatically move adjacent endpoints or otherwise repair corners in Phase 29.

## Link status

Add a pure helper that inspects a linked Coons patch against the current diagram.

A suitable conceptual result is:

```ts
type CoonsPatchBoundaryLinkStatus =
  | {
      kind: 'static'
    }
  | {
      kind: 'linkedUpToDate'
    }
  | {
      kind: 'linkedStale'
      issues: CoonsPatchBoundaryLinkIssue[]
    }
```

Issues should identify, where practical:

- patch ID;
- boundary role;
- source ID;
- missing source;
- invalid source;
- coordinate-reference resolution failure;
- failed corner equations.

Link status is derived state.

Do not persist `upToDate`, `stale`, warning strings, or validation results in `Diagram`.

## UI behavior

For a selected Coons patch, add a compact Inspector section showing one of:

```text
Boundary sources: Static
```

```text
Boundary sources: Linked — up to date
```

```text
Boundary sources: Linked — stale
The last valid patch geometry is being displayed.
```

For linked patches, show a compact role summary where practical:

```text
bottom: Path A
right: Path B — reversed
top: Path C
left: Point D
```

For stale patches, display a concise reason, such as:

```text
right: source path is missing
```

or:

```text
Corner mismatch: bottom end = right start
```

Add an undoable action:

```text
Detach boundary links
```

Detaching must:

- remove `boundarySources`;
- preserve the current materialized snapshots;
- preserve style, layer, sampling, ID, and name;
- make subsequent source changes stop affecting the patch.

Do not add a broad relink/replacement editor in this phase.

Keep this Inspector UI compact and consistent with the current Preview-centered interface.

## Diagram-update and undo/redo integration

Integrate synchronization at the narrowest central diagram-mutation boundary shared by committed geometry edits.

The source edit and dependent Coons refresh must be committed as one diagram state:

```text
edit source boundary
+ refresh linked Coons patch snapshots
= one undo step
```

One Undo must restore both:

- the previous source geometry;
- the previous Coons patch materialized snapshots.

One Redo must restore both again.

Requirements:

- synchronize before final diagram comparison/history insertion;
- account for the existing `undoSourceDiagram` or drag-session behavior;
- do not create an extra history entry solely for synchronization;
- no-op synchronization must not create history;
- undo/redo must not progressively drift snapshots;
- detaching links must be one undoable edit.

Do not implement synchronization with a React `useEffect` that performs a second state update after the source edit. That would risk:

- two undo steps;
- transient inconsistent rendering;
- state-update loops;
- stale export between updates.

If drag editing uses transient states before pointer-up, apply the same pure synchronization to transient preview geometry so that the Coons patch visibly follows the source during the drag, while still recording one final undo step.

## Unrelated patch edits and transforms

Synchronization must be source-driven.

Do not rematerialize a linked patch merely because the patch’s own:

- style;
- name;
- layer;
- sampling values;
- selection state;

changed.

Do not introduce independent offset/transform metadata for linked Coons patches in this phase.

Do not expose new direct boundary-snapshot editing for a linked patch.

When an existing bulk or layer operation transforms both linked sources and the patch, the final snapshots must be resolved from the transformed sources exactly once. Avoid double translation.

When an existing operation changes only the patch’s materialized geometry, do not treat that patch-only change as a source change. Document that users should detach boundary links before intentionally maintaining geometry independent of the sources.

## Save/load and backward compatibility

Update all relevant:

- cloning;
- validation;
- normalization;
- serialization;
- deserialization;
- coordinate-reference processing;
- equality;
- ID collection;
- duplication;
- layer duplication;
- bulk duplication;

code paths so that `boundarySources` is preserved correctly.

Requirements:

- linked patches round-trip through JSON;
- old JSON without `boundarySources` continues to load;
- old patches remain static;
- dangling source IDs are allowed to load because the last valid snapshots remain usable;
- missing sources must produce stale status rather than invalidating the whole file;
- do not infer live links from old snapshot IDs;
- loading a linked patch should perform a full refresh after required variable/coordinate resolution and before creating the initial undo history;
- if refresh on load fails, retain the saved materialized snapshots and mark the links stale;
- avoid a serialization-version bump unless existing repository policy requires it;
- if a version change is required, provide a backward-compatible migration.

### Duplication ID semantics

When a patch and one or more of its source strata are duplicated in the same operation:

- remap each boundary source ID to the duplicated source ID;
- preserve each role and `reversed` flag.

When only the patch is duplicated:

- the duplicate may continue to reference the original sources;
- its materialized snapshots must be independently cloned.

Never leave a duplicated patch pointing accidentally to an unrelated newly generated ID.

## Source deletion behavior

Deleting a linked source must not automatically delete the Coons patch.

After source deletion:

- the patch keeps its last valid materialized geometry;
- its link status becomes stale;
- the missing source role is reported;
- save/load still works;
- Undo restores the source and returns the patch to an up-to-date linked state.

Do not silently remove the broken role from `boundarySources`.

## Rendering, sampling, and export

Keep `sampleCoonsPatch` snapshot-based.

Do not change it to accept the entire `Diagram` or resolve source IDs during sampling.

Do not add source lookup responsibilities to:

- the Coons sampler;
- SVG rendering;
- TikZ generation;
- projected primitive generation.

After synchronization, the existing consumers should naturally use the refreshed snapshots.

Preserve:

- the current Coons blending formula;
- mesh topology;
- sampling limits;
- approximate visibility behavior;
- sheet styles and opacity;
- layer ordering;
- current SVG structure where not affected by geometry;
- readable TikZ output;
- inline-math formatting;
- 4-space indentation.

## Scope

Implement:

- persistent optional Coons boundary-source metadata;
- linked Coons creation, checked by default;
- path and constant-point source synchronization;
- reverse-direction preservation;
- atomic all-boundary refresh;
- last-valid-snapshot fallback;
- stale/up-to-date/static status derivation;
- compact Inspector status;
- Detach boundary links action;
- undo/redo integration;
- transient drag-preview integration where required;
- JSON compatibility;
- clone and duplication support;
- tests;
- documentation and Roadmap update.

Do not implement:

- live-linked ruled surfaces;
- a general-purpose dependency graph;
- a general reactive object system;
- automatic corner repair;
- endpoint propagation into adjacent source paths;
- per-role relink/replacement UI;
- exact hidden-surface removal;
- new Coons formulas;
- new sampling algorithms;
- independent linked-patch transform offsets;
- broad curved-sheet architecture rewrites.

## Tests

Add focused unit and integration coverage.

A dedicated file such as:

```text
tests/integration/phase29LinkedCoonsPatches.test.ts
```

is appropriate.

Because the current `npm test` script enumerates test files explicitly, add the new file to the script if necessary.

At minimum, test:

1. **Creation metadata**
   - A linked Coons patch stores all four source roles.
   - Path IDs, point IDs, and `reversed` values are correct.
   - An unchecked creation option creates a static patch without links.

2. **Ordinary path edit**
   - Create a Coons patch from four valid path sources.
   - Edit an interior point/control point of one source.
   - Verify the corresponding materialized boundary changes.
   - Verify the sampled mesh changes.

3. **Supported path kinds**
   - Cover representative polyline/cubic and concatenated/template source edits.
   - Existing source validation rules remain unchanged.

4. **Reversed boundary**
   - Create a patch with at least one role reversed.
   - Edit that source.
   - Verify the refreshed materialized boundary remains reversed relative to the source.

5. **Constant-point boundary**
   - Create a valid patch using an existing supported point boundary.
   - Move the point.
   - Verify the linked constant-point snapshot and mesh update.

6. **Coordinate-anchor or indirect source change**
   - Move a coordinate anchor, change a coordinate reference, or change a symbolic value used by a source.
   - Verify the linked patch detects the resolved geometry change.

7. **Atomic refresh**
   - Verify all four roles are rebuilt from one diagram state.
   - Verify no partially refreshed primitive is committed.

8. **Temporary corner mismatch**
   - Edit a source endpoint so corner validation fails.
   - Verify the source edit succeeds.
   - Verify the patch retains its last valid snapshots.
   - Verify status becomes stale and reports the failed corner equation.

9. **Automatic recovery**
   - Repair the adjacent source/corner.
   - Verify the patch automatically refreshes to the latest four sources.
   - Verify status returns to up to date.

10. **Missing source**
    - Delete a linked boundary source.
    - Verify the patch remains renderable from the last valid snapshots.
    - Verify stale status identifies the missing role.
    - Undo deletion and verify the link becomes up to date.

11. **Unrelated edits**
    - Change an unrelated element or the patch’s style/sampling.
    - Verify this does not unnecessarily replace boundary snapshots.
    - Verify no extra history entry is created.

12. **Undo/redo**
    - Edit a linked source.
    - Verify one Undo restores both source and patch.
    - Verify one Redo reapplies both.
    - Verify repeated Undo/Redo does not drift geometry.

13. **Detach**
    - Detach a linked patch.
    - Edit its former source.
    - Verify the patch remains unchanged.
    - Verify Undo restores the link.

14. **JSON compatibility**
    - Linked patch round-trip preserves source IDs and reverse flags.
    - Old snapshot-only Coons JSON still loads as static.
    - Linked JSON with a missing source loads using the saved fallback snapshots.

15. **Duplication**
    - Duplicating sources and patch together remaps links.
    - Duplicating only the patch preserves intentional links to original sources.

16. **SVG and TikZ**
    - Source edit changes the rendered/sampled geometry.
    - TikZ output reflects the refreshed snapshots.
    - Existing formatting and export modes remain unchanged.

17. **No-op synchronization**
    - Synchronization with unchanged sources returns the original diagram or an equivalent no-op result.
    - It does not create undo history.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manually verify:

1. Open or create a 3D diagram.
2. Create four compatible boundary paths.
3. Choose Add sheet > Coons.
4. Leave `Keep linked to boundary sources` checked.
5. Reverse one role if needed and create the patch.
6. Drag an interior vertex or Bezier control on a source path.
7. Confirm the patch follows immediately in SVG Preview.
8. Confirm the boundary direction remains correct.
9. Move one endpoint so a corner no longer matches.
10. Confirm the source moves while the patch displays its last valid geometry and stale status.
11. Repair the corner and confirm the patch catches up.
12. Undo and redo the source edit.
13. Save and reload JSON.
14. Detach links and confirm later source edits no longer affect the patch.
15. Confirm TikZ and SVG export use the currently materialized patch geometry.

## Documentation

Update `docs/ROADMAP.md` with:

```markdown
## Phase 29: Live-linked Coons patch boundary synchronization

- Store optional source links alongside materialized Coons boundary snapshots.
- Refresh valid linked patches after source path/point edits.
- Preserve reverse direction and undo/redo atomicity.
- Retain last valid snapshots when links are temporarily invalid.
- Support static legacy patches and explicit detach.
```

A suitable phase slug is:

```text
"29": "live-linked-coons-boundaries"
```

Update `docs/RULED_SURFACES.md` so it no longer states unconditionally that later source-path edits never move a Coons patch.

Document clearly:

- ruled surfaces remain snapshot-only in Phase 29;
- Coons patches may be static or linked;
- linked patches still store materialized snapshots;
- valid source edits refresh those snapshots;
- reverse settings are preserved;
- invalid or missing sources leave the last valid geometry visible;
- repaired links automatically catch up;
- old JSON patches remain static;
- users can detach links before independent patch geometry changes.

Update `docs/DATA_MODEL.md` or other relevant model documentation with the optional source-link metadata.

Update any in-app Help text that still describes all Coons patches as permanently detached copies.

## Preserve existing behavior

Do not regress:

- static Coons patches;
- ruled surfaces;
- Coons creation direction controls;
- path and point editing;
- path direction reversal;
- coordinate anchors and references;
- symbolic coordinates and variable import;
- work-plane behavior;
- style and sampling editing;
- selection and multi-selection;
- layer operations;
- save/load;
- undo/redo;
- SVG Preview;
- SVG export;
- TikZ export;
- automatic visibility;
- inline-math output;
- 4-space TikZ indentation.

## Acceptance criteria

Phase 29 is complete when:

- a newly created linked Coons patch follows valid edits to any linked path or point source;
- reversed roles retain their intended orientation;
- source edits and dependent refreshes form one undo/redo transaction;
- invalid or missing sources never corrupt or delete the patch;
- stale patches retain their last valid geometry and recover automatically;
- static and legacy patches remain unchanged;
- JSON round-trip preserves links;
- Detach boundary links works and is undoable;
- SVG and TikZ use refreshed snapshots without changing the Coons sampler architecture;
- tests, build, and `git diff --check` pass.

## Report after implementation

Please report:

- files modified;
- model fields and types added;
- source-change detection strategy;
- synchronization call sites;
- atomic refresh and stale fallback behavior;
- reverse-direction handling;
- coordinate-reference and symbolic-source handling;
- Inspector and detach behavior;
- undo/redo integration;
- save/load and legacy compatibility;
- duplication ID-remapping behavior;
- tests added or updated;
- manual verification performed;
- `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- known limitations and deferred work.

## Phase 29: Live-linked Coons patch boundary synchronization

Phase 29 lets a Coons patch optionally retain links to the path and point
strata used as its four boundaries while keeping materialized boundary
snapshots for stable sampling, rendering, export, and backward-compatible
save/load.

- Store optional `bottom` / `right` / `top` / `left` source metadata, including path direction reversal.
- Keep newly created Coons patches linked by default, with an explicit static creation option and an undoable `Detach boundary links` action.
- Refresh all four materialized boundary snapshots atomically when the resolved geometry of a linked path or point source changes.
- Preserve current Coons sampling, SVG rendering, and TikZ export by continuing to consume the materialized snapshots instead of resolving source strata at render time.
- Commit each source edit and dependent snapshot refresh as one undo/redo transaction, including transient drag preview where required.
- If a source is missing or the refreshed boundaries are invalid, retain the last valid snapshots, expose a derived stale status, and automatically catch up after the sources become valid again.
- Preserve links across JSON round trips, cloning, and duplication, remapping source IDs when sources and the patch are duplicated together.
- Keep legacy Coons patches without source metadata static; do not infer links from existing snapshot IDs.
- Ruled surfaces remain snapshot-only in Phase 29.
- Add focused regression tests and update Coons, data-model, and Help documentation.