# Phase 29 Targeted Fix Prompt 6: Exact stale snapshots and source-aware duplication remapping

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts tests/model/diagramIds.test.ts
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

Do not add dependencies.

## Project context

You are applying two narrowly targeted Phase 29 model-integrity fixes in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

The review covered `1faa43f..7fa9032` plus current unstaged changes. Inspect the actual working tree before editing because line numbers may have moved.

Read at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- every prior Phase 29 fix prompt present in the repository;
- `src/model/coonsPatchLinks.ts`;
- `src/model/symbolicCoordinates.ts`;
- `src/model/serialization.ts`;
- `src/model/validation.ts`;
- `src/model/types.ts`;
- `src/model/sheets.ts`;
- `src/model/layers.ts`;
- `src/ui/bulkEditing.ts`;
- all clone, layer-duplication, bulk-duplication, and ID-remapping helpers;
- the detach-boundary-links implementation;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- relevant symbolic-coordinate, serialization, duplication, and layer tests.

Search for every caller of:

- `materializeLinkedCoonsPatchFallback`;
- `numericVec3`;
- `synchronizeLinkedCoonsPatches`;
- `remapCoonsPatchBoundarySources`;
- layer and bulk ID-map builders;
- Coons primitive clone/detach helpers.

## Verified review findings

### Medium 1: failed synchronization mutates the last-valid snapshots

When linked synchronization fails, the stale branch currently runs all four previous boundaries through a fallback materializer. That helper converts persisted symbolic coordinates to numeric `Vec3` values and strips symbolic expressions and other coordinate provenance.

Verified behavior:

1. A valid linked Coons snapshot contains symbolic expression `R`.
2. A linked source is deleted, or the four boundaries become temporarily invalid.
3. Visible fallback geometry remains in place.
4. The stored snapshot no longer contains expression `R`; it has been reduced to plain numeric coordinates.
5. Saving or detaching therefore permanently loses valid snapshot model data.

Phase 29 requires the previous four last-valid materialized snapshots to remain intact. “Last-valid geometry” means the complete persisted snapshot model, not only numerically equal preview coordinates.

### Medium 2: duplication remaps links from unrelated ID-map entries

Layer and bulk duplication currently pass broad old-ID-to-new-ID maps containing patches, labels, sheets, and unrelated strata. The Coons remapper applies a matching entry without proving that the old ID belongs to an actual duplicated source of the required path/point kind.

Verified behavior:

1. A valid loadable stale Coons patch has dangling point-source IDs equal to the patch’s own ID.
2. Only the patch is duplicated.
3. The broad duplication map contains `patch -> patch-copy`.
4. The duplicate’s dangling `sourcePointId` is incorrectly rewritten from `patch` to `patch-copy`.
5. The copied link now points at the copied sheet rather than retaining the original dangling identity.

A link may be remapped only when its actual corresponding boundary source was duplicated.

## Goal

Fix only these two verified issues.

After the fix:

- failed linked synchronization preserves all four previous snapshots exactly, including symbolic expressions and persisted coordinate provenance;
- the source edit and next patch’s non-boundary fields are still retained;
- stale diagrams remain safe to save, load, render, export, detach, undo, redo, and recover;
- layer and bulk duplication remap a boundary source ID only when a real source stratum of the matching source kind was duplicated;
- patch-only, dangling, missing, or incompatible links retain their original IDs;
- valid duplicated path and point sources still remap correctly;
- all roles and path `reversed` flags remain unchanged;
- sampling, Preview, SVG, TikZ, synchronization, and history architecture remain unchanged.

## Fix 1: preserve the exact previous snapshots on synchronization failure

### Required invariant

For a linked Coons patch whose refresh candidate cannot be committed, the next patch must use an exact structural clone of the previous patch’s four last-valid snapshots:

```text
bottom
right
top
left
```

Preserve every persisted field, including where present:

- numeric coordinates;
- symbolic expression text;
- symbolic preview values;
- symbolic/provenance metadata;
- path IDs and names stored in snapshots;
- segment kinds and control points;
- coordinate-reference provenance that is legitimately part of the already committed snapshot;
- constant-point boundary metadata;
- boundary ordering and orientation.

Do not recreate these boundaries from numeric samples.

Do not pass them through `numericVec3`.

Do not silently normalize away symbolic fields.

Do not rebuild them from the invalid next sources.

### Stale-branch behavior

When source-derived synchronization fails:

1. Accept the source edit in `nextDiagram`.
2. Preserve the next diagram’s source state.
3. Preserve the next patch’s non-boundary fields where the existing Phase 29 policy requires it, including:
   - patch ID;
   - name;
   - layer;
   - style;
   - sampling settings;
   - `boundarySources`;
   - other unrelated patch metadata.
4. Replace only `bottom`, `right`, `top`, and `left` with exact deep clones of the corresponding previous last-valid snapshots.
5. Report the derived stale issue/status.
6. Do not mutate either `previousDiagram` or its snapshot objects.
7. Do not create a second undo entry.

Conceptually:

```ts
const stalePrimitive: CoonsPatchPrimitive = {
  ...nextPrimitive,
  bottom: cloneCoonsBoundarySnapshot(previousPrimitive.bottom),
  right: cloneCoonsBoundarySnapshot(previousPrimitive.right),
  top: cloneCoonsBoundarySnapshot(previousPrimitive.top),
  left: cloneCoonsBoundarySnapshot(previousPrimitive.left),
}
```

Use the repository’s existing deep-clone helpers rather than introducing shallow aliases.

The exact code must follow current types and conventions.

### Remove or narrow numeric fallback materialization

Do not call `materializeLinkedCoonsPatchFallback` from the ordinary failed-synchronization branch if it strips persisted fields.

Then inspect whether that helper is still needed anywhere.

Acceptable outcomes:

- remove it if it has no valid remaining use; or
- rename/narrow it to a clearly explicit migration/export-only operation if a real call site still requires numeric materialization.

Do not leave dead or misleading fallback code.

### Preserve earlier symbolic persistence fixes

Earlier Phase 29 fixes addressed stale symbolic save/load and equal-valued symbolic-expression changes. Do not regress them.

The ownership rule remains:

- source paths and points receive normal symbolic refresh;
- linked Coons snapshots are updated only by successful atomic linked synchronization;
- failed synchronization preserves the previous snapshots;
- equal-valued source expression/provenance changes still count as a successful refresh when the candidate is valid;
- stale saved diagrams remain loadable;
- repaired sources recover automatically.

If exact snapshot preservation exposes a conflict with current symbolic validation or load normalization, fix that conflict narrowly. Do not solve it by stripping expressions again.

Prefer existing “materialized/frozen snapshot” semantics if the model already has them.

If the current model cannot represent an exact last-valid symbolic snapshot safely after current diagram variables diverge, introduce the smallest explicit, backward-compatible representation needed to distinguish frozen materialized snapshot values from live source evaluation. In that case:

- preserve the original symbolic/provenance fields;
- keep the saved numeric preview used by the last-valid geometry;
- scope any validation exception to the explicit materialized/frozen snapshot representation;
- do not weaken symbolic validation globally;
- keep legacy JSON backward-compatible;
- keep detach and JSON round-trip valid;
- document the new optional field in model docs only if the persisted schema actually changes.

Do not add such metadata unless inspection and focused tests prove it is necessary.

### Detach semantics

`Detach boundary links` must remove source links without changing any of the four materialized snapshots.

For a stale patch containing symbolic/provenance fields:

- before detach and after detach, the four snapshots must be structurally equal;
- only `boundarySources` and derived link status may change;
- detached geometry must remain valid, renderable, exportable, and serializable;
- Undo of detach must restore the links without changing snapshots.

Do not use detach as an opportunity to convert snapshots to numeric coordinates.

### Save/load semantics

For a stale linked patch:

- serialization must retain the complete last-valid snapshots;
- parsing must succeed;
- loaded snapshots must be structurally equivalent to the saved snapshots after normal backward-compatible normalization;
- missing or invalid sources must still produce stale status;
- Preview, SVG, and TikZ must still use those saved snapshots;
- repairing the sources must replace them through the normal successful atomic synchronization path.

The loaded file’s own fallback remains authoritative. Do not use snapshots from a previously open document.

## Fix 2: remap only actual duplicated boundary sources

### Required invariant

A Coons boundary-source link may be remapped from `oldId` to `newId` only if all of the following are true:

1. the original diagram contains a stratum with `oldId`;
2. that stratum is of the source kind required by the link:
   - a path-like curve stratum for `kind: 'path'`;
   - a point stratum for `kind: 'point'`;
3. that exact source stratum participates in the current duplication operation;
4. the duplication operation created `newId` for that source.

Otherwise, preserve `oldId`.

### Kind compatibility, not current geometric validity

Use structural source-kind compatibility rather than full current Coons-boundary validity.

Examples:

- an existing path source that is temporarily closed or otherwise stale is still the actual path source and should remap when that path itself is duplicated;
- a missing/dangling ID must not remap;
- an ID belonging to a sheet, label, patch, or other incompatible stratum must not remap;
- a valid source that was not duplicated must not remap;
- duplicating only the patch must keep links to the original sources;
- duplicating the patch and real sources together must remap those sources.

Reuse the same path/point structural predicates used by Coons source resolution where possible, without requiring the source to be currently valid enough to refresh the patch.

### Use typed source remap data

Do not pass an unqualified global ID map directly into the boundary-source remapper.

Prefer an API that makes eligibility explicit, for example:

```ts
type CoonsBoundarySourceRemap = {
  pathSourceIds: ReadonlyMap<string, string>
  pointSourceIds: ReadonlyMap<string, string>
}

function remapCoonsPatchBoundarySources(
  sources: CoonsPatchBoundarySources,
  remap: CoonsBoundarySourceRemap,
): CoonsPatchBoundarySources
```

or an equivalent API that accepts:

- the original diagram;
- the exact duplicated source-ID set;
- the operation’s old-to-new ID map.

For a path role, consult only the path-source map.

For a point role, consult only the point-source map.

Do not infer eligibility merely because the broad ID map has a matching key.

### Centralize eligibility

Layer duplication and bulk duplication must use the same source-aware remapping rule.

A suitable approach is:

1. build the normal broad ID map for duplicated entities;
2. inspect only original strata actually selected by the duplication operation;
3. derive typed path/point source maps from those actual duplicated strata;
4. pass the typed source maps into Coons link remapping.

Avoid duplicating subtly different eligibility logic in `layers.ts` and `bulkEditing.ts`.

A small pure helper in `coonsPatchLinks.ts` or an appropriate model duplication module is preferred.

Avoid UI-to-model import cycles.

### Preserve all other link fields

When a source is remapped:

- preserve its role;
- preserve `kind`;
- preserve `reversed`;
- change only `sourcePathId` or `sourcePointId`.

When a source is not eligible:

- preserve the complete source record unchanged.

Do not alter materialized boundary snapshots as part of metadata remapping except through the repository’s existing independent clone behavior.

## Regression tests: exact stale snapshots

Extend `tests/integration/phase29LinkedCoonsPatches.test.ts`.

### 1. Missing symbolic source preserves complete snapshots

Create a valid linked Coons patch whose stored boundary snapshot contains a symbolic expression such as `R`.

Before deleting the source, deep-clone all four materialized snapshots.

Delete the linked source through the normal diagram-update/history path.

Assert:

- the patch is `linkedStale`;
- all four post-failure snapshots are deeply equal to the saved pre-failure snapshots;
- the symbolic expression `R` still exists;
- symbolic preview values and all other persisted coordinate metadata remain unchanged;
- no boundary has been reduced to plain numeric coordinates;
- source metadata is retained;
- the source deletion itself is accepted;
- the previous diagram object was not mutated.

Do not assert only sampled/numeric geometry.

### 2. Corner mismatch preserves complete snapshots

Create a temporary corner mismatch while all sources still exist.

Assert exact structural equality of all four snapshots before and after the failed synchronization, including symbolic/provenance fields.

Then repair the corner and verify normal successful recovery updates the snapshots.

### 3. Stale save/load preserves complete snapshots

For a stale patch from source deletion or corner mismatch:

1. serialize;
2. parse through the normal saved-diagram API;
3. assert parsing succeeds;
4. assert the loaded snapshots preserve symbolic/provenance fields and are structurally equivalent to the serialized fallback;
5. assert stale status and last-valid geometry;
6. assert `validateDiagram`, sampling, SVG export, and TikZ export succeed.

Keep the prior symbolic variable mismatch and equal-valued expression regressions passing.

### 4. Detach preserves complete snapshots

Detach the stale linked patch.

Assert:

- only link metadata is removed;
- all four snapshots remain deeply equal;
- symbolic/provenance fields remain;
- save/load still succeeds;
- later source changes no longer affect the detached patch;
- Undo restores links without changing snapshots.

### 5. Undo/Redo

Verify one-step Undo/Redo for the source failure:

- Undo restores the source and coherent up-to-date patch;
- Redo restores the stale state with the exact last-valid snapshots;
- repeated cycles do not strip fields or drift snapshots.

## Regression tests: source-aware bulk duplication

Add focused bulk-duplication coverage.

### 1. Patch-only duplicate with dangling self-colliding link

Construct a valid loadable stale linked patch whose point source ID equals the patch ID, for example:

```text
patch ID: patch
sourcePointId: patch
```

There must be no actual point source with that ID.

Duplicate only the patch through the normal bulk-duplication path.

Assert:

- the copied patch gets a new patch ID;
- every dangling source ID remains exactly `patch`;
- no source ID becomes the copied patch ID;
- the copied patch remains stale;
- `kind` and all `reversed` flags remain unchanged;
- the original patch remains unchanged;
- materialized snapshots are independent clones.

### 2. Incompatible duplicated entity does not remap

Create a stale path or point link whose source ID refers to an existing incompatible stratum kind where the loader/model permits it.

Duplicate both the patch and that incompatible entity.

Assert the copied link retains the original source ID rather than following the incompatible entity’s new ID.

If the normal validator forbids constructing this case through JSON, test the pure source-remap helper directly with a structurally representative original diagram.

### 3. Existing but nonduplicated source remains original

Duplicate a patch without duplicating its actual valid source.

Assert the copied patch still links to the original source ID.

### 4. Actual duplicated path/point sources remap

Keep or strengthen the positive case:

- duplicate the patch and its actual sources together;
- verify `bottom`, `right`, `top`, and `left` independently;
- verify a real path source remaps;
- verify a real point source remaps where supported;
- verify at least one `reversed: true` flag is preserved;
- verify the copied patch is linked to the copied sources.

## Regression tests: source-aware layer duplication

Add equivalent layer-duplication coverage.

At minimum test:

1. **Patch layer duplicated, actual source outside layer**
   - copied patch keeps the original source ID.

2. **Patch and actual source duplicated together**
   - copied patch remaps to the copied source.

3. **Patch-only stale/dangling self-collision**
   - copied patch’s dangling source ID does not remap to the copied patch ID.

4. **Temporarily invalid but existing path source duplicated**
   - if the source stratum is structurally path-like and is duplicated, its link remaps even when the patch remains stale for a geometry reason.

Assert role, source kind, source ID, and reversal explicitly.

## Preserve existing behavior

Do not regress:

- successful atomic refresh;
- equal-valued symbolic expression/provenance synchronization;
- stale symbolic save/load;
- last-valid numeric geometry;
- automatic recovery;
- replacement-document load isolation;
- dangling source-ID reservation;
- Variable Manager ID allocation;
- malformed metadata handling;
- linked/static creation;
- role-specific reversal;
- constant-point boundaries;
- one-step Undo/Redo;
- Inspector status;
- detach;
- valid duplication/remapping;
- static and legacy Coons patches;
- ruled surfaces;
- SVG and TikZ export;
- inline-math formatting;
- 4-space TikZ indentation.

## Scope constraints

Do not:

- redesign Phase 29;
- introduce a general dependency graph;
- change the Coons formula or sampler;
- resolve source strata at render/export time;
- weaken model validation globally;
- strip symbolic data to make tests pass;
- add a general tombstone or identity registry;
- auto-repair or auto-relink stale sources;
- remap links by names or geometry;
- change JSON version unless a narrowly required backward-compatible field is proven necessary;
- perform unrelated UI or documentation cleanup;
- add dependencies.

Keep production changes focused on:

- stale fallback snapshot preservation;
- any narrowly required symbolic snapshot persistence support;
- source-aware duplication remapping;
- targeted tests.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts tests/model/diagramIds.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
git diff main --check
```

Also run any focused layer, bulk-editing, serialization, symbolic-coordinate, detach, or duplication test files modified by this fix.

Perform read-only probes for both verified failures and report the results:

### Probe A: stale symbolic fallback

```text
valid symbolic snapshots
-> delete source or create corner mismatch
-> inspect all four stored snapshots
-> save/load
-> detach
```

Report whether symbolic/provenance fields remain intact at every step.

### Probe B: patch-only stale duplication

```text
patch ID = patch
dangling sourcePointId = patch
-> duplicate only patch
```

Report the copied patch ID and copied `sourcePointId`.

If the local dev server cannot bind because the sandbox denies `listen`, report that limitation accurately. Do not claim browser verification was performed.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- failed synchronization preserves exact deep-cloned previous `bottom`, `right`, `top`, and `left` snapshots;
- symbolic expressions and persisted coordinate provenance are not stripped;
- stale save/load and recovery remain safe;
- detach preserves the complete snapshots;
- previous diagram objects are not mutated;
- broad duplication maps can no longer remap links from patch, label, sheet, or unrelated entries;
- dangling and incompatible source IDs retain their original values;
- actual duplicated path/point sources remap correctly;
- path roles retain `reversed`;
- bulk and layer duplication use one coherent source-aware rule;
- all targeted regressions pass;
- the full suite, build, and all diff checks pass;
- no Critical or Medium review issue remains.

## Report after implementation

Report:

- files modified;
- root cause of snapshot field loss;
- stale-branch logic changed;
- clone helper used for exact snapshot preservation;
- whether fallback materialization was removed or narrowed;
- how symbolic stale save/load remains valid without stripping provenance;
- detach behavior verified;
- root cause of incorrect duplication remapping;
- source-kind eligibility rule;
- shared remap helper/API introduced or changed;
- bulk duplication behavior;
- layer duplication behavior;
- tests added or updated;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- `git diff main --check` result;
- read-only probe results;
- manual browser verification performed or the exact reason it was unavailable;
- remaining known limitations.
