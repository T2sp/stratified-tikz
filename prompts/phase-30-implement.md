# Phase 30 Implementation Prompt: Inspector duplicate-and-translate for Coons patches

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run lint only if the repository is already established as repository-wide
lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add new dependencies unless they are clearly necessary and justified.

## Project context

You are working on the StratifiedTikZ project:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 29 is complete.

The editor already supports:

- 2D and 3D diagrams;
- SVG/PGF Preview-centered editing;
- cursor and direct creation;
- points, labels, paths, polygon sheets, filled regions/sheets, curved sheets,
  ruled surfaces, and Coons patches;
- coordinate anchors and coordinate references;
- symbolic variables and symbolic coordinates;
- global and work-plane-local coordinates;
- multi-selection and bulk duplicate/translation;
- layer duplicate/translation;
- static and live-linked Coons patches;
- last-valid frozen snapshots for stale linked Coons patches;
- save/load, Undo/Redo, SVG export, and TikZ export.

Important project conventions:

- An `n`-stratum means codimension `n`, not geometric dimension.
- A Coons patch is a 3D codimension-1 sheet stratum.
- All model coordinates are `Vec3`.
- Keep model, geometry, rendering, TikZ generation, and UI concerns separate.
- Use strict TypeScript and avoid `any`.
- Prefer small, pure, testable helpers.
- UI-only form drafts, status text, and selection must not be stored in
  `Diagram`.
- Generated TikZ must remain human-readable.
- TikZ indentation remains 4 spaces.
- Inline-math TikZ output contains no blank lines.

## Current behavior

The single-selection Inspector already exposes a selected Coons patch's:

- name and layer;
- style;
- materialized `bottom`, `right`, `top`, and `left` boundary summaries;
- `uSegments` and `vSegments`;
- static / linked / stale boundary-source status;
- `Detach boundary links` action for a linked patch.

The generic bulk-editing helpers already provide deep duplication and symbolic-
aware translation for selected diagram elements. The shared translation engine
already knows how to translate Coons boundary snapshots, constant-point
boundaries, path segments, and stored frame origins.

However, the Inspector does not provide a one-step operation that duplicates one
selected Coons patch and places the copy at a translated position.

## Goal

Add a compact Inspector operation:

```text
Duplicate & translate
  dx
  dy
  dz
  [Duplicate & translate]
```

When exactly one Coons patch is selected, the user can enter one global 3D
translation vector and create one independently positioned copy.

One successful action must:

1. leave the original patch unchanged;
2. create one deep-cloned Coons patch with a fresh top-level ID;
3. translate all four materialized boundary snapshots by the same vector;
4. make the translated copy static;
5. preserve the original patch's name, layer, style, sampling, and boundary
   orientation in the copy;
6. select the new copy;
7. commit duplication and translation as exactly one undoable diagram edit.

The translated copy must be static even when the original patch is linked. This
is a required Phase 30 semantic decision, not an optional implementation detail.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-fix.md`;
- `docs/ROADMAP.md`;
- `docs/RULED_SURFACES.md`;
- `docs/DATA_MODEL.md`;
- `docs/EDITING.md`;
- `src/model/types.ts`;
- `src/model/coonsPatchLinks.ts`;
- `src/model/translation.ts`;
- `src/model/diagramIds.ts`;
- `src/model/coordinateReferences.ts`;
- `src/ui/bulkEditing.ts`;
- `src/ui/undo.ts`;
- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/inspector/StratumInspector.tsx`;
- `src/ui/inspector/CurvedSheetGeometryEditor.tsx`;
- the App-level Inspector callbacks and central diagram commit path;
- Phase 24 translation/duplication tests;
- Phase 26 global-ID reservation tests;
- Phase 27 sampled Coons coordinate-reference tests;
- Phase 29 linked/stale Coons tests and Preview performance tests;
- `package.json`, including the explicit `npm test` file list.

Search for all code paths that:

- clone or duplicate a `curvedSheet` stratum;
- allocate top-level IDs;
- translate a `CoonsPatchPrimitive`;
- detach Coons boundary links;
- preserve `boundarySnapshotState`;
- synchronize linked Coons patches before history insertion;
- update selection after duplicate operations.

Do not assume the filenames above are the only required change sites.

## Required linked-copy policy

### Why a translated copy must be static

Phase 29 permits a generic patch-only duplicate to keep links to the original
boundary sources. That policy is correct for an untransformed duplicate, whose
materialized geometry still agrees with those sources.

It is not correct for this operation.

If Phase 30 copied `boundarySources` and translated only the duplicate's stored
snapshots, the active links would still refer to untranslated original sources.
A later linked-source synchronization, full JSON-load synchronization, or source
edit could then:

- replace the translated snapshots with source-derived geometry at the original
  location;
- mark the translated copy stale;
- make Preview and export disagree with the user's intended independent copy.

Phase 30 must therefore use this policy:

```text
selected Coons patch
  -> deep-copy current materialized snapshots
  -> remove active boundarySources from the copy
  -> translate the copy
  -> commit one static translated patch
```

Requirements:

- omit `boundarySources` from the duplicate before the diagram reaches the
  central linked-Coons synchronizer;
- do not remove or modify `boundarySources` on the original;
- do not duplicate, translate, relink, or otherwise modify source paths or
  source points;
- preserve optional snapshot provenance such as boundary snapshot `id`,
  `sourceId`, or `name`; these fields are not active links;
- do not infer links from snapshot provenance;
- do not add persistent translation-offset metadata;
- do not add an independent linked-patch transform model.

After the operation:

- a static original produces a static translated copy;
- a linked up-to-date original remains linked and up to date, while its copy is
  static;
- a linked stale original remains stale, while its copy is static and uses the
  translated last-valid materialized geometry.

Editing the original sources later must never move, reset, or stale the
translated static copy.

## Frozen stale snapshots

A stale linked Coons patch can carry:

```ts
boundarySnapshotState: 'frozen'
```

That field means the complete saved materialized snapshot model is the exact
last-valid fallback. Its stored numeric previews, symbolic expressions, and
coordinate provenance remain authoritative until a successful linked refresh.

For a stale linked original:

- duplicate the exact frozen `bottom`, `right`, `top`, and `left` snapshots;
- do not refresh them from current variables or broken sources before copying;
- translate the stored last-valid numeric preview geometry by the requested
  translation preview;
- preserve symbolic expressions by adding the translation expression using the
  existing typed expression builders where possible;
- calculate translated frozen preview values from the stored frozen preview
  values, not by reevaluating the old expressions against variables that may
  have diverged;
- preserve `boundarySnapshotState: 'frozen'` on the static copy so JSON import
  does not independently refresh those snapshots later.

If the existing translation helper always reevaluates symbolic coordinates
against current variables, extend it with the smallest explicit translation
policy needed for frozen snapshots. Do not special-case this by raw string
concatenation or by silently discarding symbolic metadata.

## Pure duplicate-and-translate helper

Add one typed, pure operation helper in an appropriate UI/model operation
module. A suitable conceptual API is:

```ts
export type DuplicateAndTranslateCoonsPatchResult =
  | {
      ok: true
      diagram: Diagram
      sourcePatchId: string
      duplicatedPatchId: string
    }
  | {
      ok: false
      diagram: Diagram
      error: string
    }

export function duplicateAndTranslateCoonsPatch(
  diagram: Diagram,
  patchId: string,
  translation: TranslationVector,
): DuplicateAndTranslateCoonsPatchResult
```

Names may follow repository conventions, but the helper must be independently
testable and must not depend on React state.

Prefer composing or extracting existing duplication, ID-allocation,
coordinate-reference-detachment, and translation helpers. Do not create a
second subtly different Coons translation implementation.

The operation must be atomic. A suitable order is:

1. Find the source by ID.
2. Require a `geometricKind: 'sheet'`, `kind: 'curvedSheet'`,
   `primitive.kind: 'coonsPatch'` stratum.
3. Validate and normalize the translation.
4. Allocate a globally unused top-level ID.
5. Deep-clone the complete source stratum.
6. Assign the copy's new ID.
7. Remove only the copy's active `boundarySources`.
8. Detach any unsupported coordinate references according to the existing
   sampled-curved-sheet policy, or fail safely if the input is malformed.
9. Translate all four materialized boundaries exactly once.
10. Validate the complete translated primitive and candidate diagram.
11. Append the copy only after every step succeeds.
12. Return the new ID for selection and status UI.

On any error:

- return the original diagram object or an equivalent unchanged diagram;
- do not append an untranslated or partially translated copy;
- do not modify the original;
- do not reserve an ID in persistent state;
- do not alter selection or history.

## ID, clone, and metadata semantics

### Top-level ID

Use the repository's existing global top-level ID reservation policy.

The allocator must reserve IDs used by:

- strata;
- free text labels;
- coordinate anchors;
- dangling linked-Coons source IDs where current policy reserves them;
- every other top-level namespace already collected by
  `collectTopLevelDiagramIds` or its current replacement.

Use the established deterministic suffix policy, such as:

```text
patch-copy
patch-copy-1
patch-copy-2
```

Do not hand-roll an allocator that checks only `diagram.strata`.

### Deep clone

The copy must not share mutable nested geometry with the original.

Deep-clone at least:

- the stratum object;
- style data;
- the primitive;
- all four boundary snapshots;
- segment arrays;
- segment endpoint/control/frame objects;
- constant-point boundary points;
- sampling data;
- any symbolic/source metadata retained by the static snapshot.

Tests must use identity assertions as well as value assertions.

### Preserved fields

Preserve the source values for:

- `name`;
- `codim`;
- `geometricKind`;
- `kind`;
- `layer`;
- style, including opacity and imported-style metadata;
- attached label metadata, if present;
- sampling values;
- boundary role ordering;
- path orientation represented by the materialized snapshots;
- `boundarySnapshotState`, according to the frozen policy above.

User-facing names are not required to be unique. Follow the existing ordinary
element-duplication name policy rather than inventing a Phase 30-only rename
rule.

Do not regenerate optional boundary snapshot provenance IDs as though they were
top-level diagram objects.

## Translation semantics

The Inspector operation uses a global 3D translation vector:

```text
P' = P + (dx, dy, dz)
```

Requirements:

- reuse `TranslationVector` and the existing translation input parser;
- accept the same numeric/scalar-expression grammar already supported by the
  shared Inspector translation controls;
- do not add a new expression grammar;
- require finite preview values;
- require a non-zero translation vector;
- direct Inspector translation does not use cursor snap;
- translate every stored absolute coordinate in every boundary role;
- translate constant-point boundaries;
- translate line, cubic-Bezier, arc, concatenated, and sampled-template snapshot
  coordinates already supported by the shared engine;
- translate stored frame origins;
- do not change frame `u`, `v`, or `normal` basis vectors;
- do not change work-plane-local `a` or `b` values merely because the frame
  origin moves;
- preserve symbolic intent using typed expression helpers;
- never create `NaN` or `Infinity`;
- reject an unsupported/malformed input without partial mutation.

The same vector must be applied to all duplicated occurrences of shared corner
coordinates. Do not translate one boundary role and then derive an adjacent role
from the already translated value.

The translated primitive must still satisfy every Coons corner equation.

For finite numeric geometry, the sampled meshes should satisfy, within the
existing numeric tolerance:

```text
sample(copy)[i] = sample(source)[i] + translation
```

Do not change:

- the Coons formula;
- surface sampling counts;
- mesh topology;
- surface visibility policy;
- sheet styles;
- layer ordering.

## Inspector UI

Add a compact section to the detailed Inspector for exactly one selected Coons
patch.

Suggested copy:

```text
Duplicate & translate
  dx: [0]
  dy: [0]
  dz: [0]
  [Duplicate & translate]
```

Requirements:

- show the section only for a single selected Coons patch;
- do not show it for polygon sheets, work-plane-filled sheets, ruled surfaces,
  hemispheres, saddles, curves, points, labels, coordinates, or multi-selection;
- use controlled local draft strings so users can temporarily type values such
  as ``, `.`, `.5`, `-`, and `1e`;
- invalid or incomplete drafts show a concise warning and do not mutate the
  diagram;
- require at least one non-zero component;
- use all three fields because Coons patches exist only in 3D;
- use accessible labels and a descriptive button title;
- do not expose snap controls for this direct operation;
- keep draft and status state UI-only;
- reset or re-key local status when the selected patch changes;
- keep the Inspector compact and consistent with existing translation forms.

Suggested success status:

```text
Duplicated and translated Coons patch by (1, 0, 2).
```

Suggested validation status:

```text
Enter a non-zero translation.
```

The production Inspector must call the same operation helper exercised by
tests. Do not satisfy the feature with source-text-only UI assertions.

## Selection, locking, and layer filters

On success:

- select the new patch as a single stratum selection;
- keep the inherited layer;
- keep the current layer filter when the new copy is editable under it;
- normalize or clear selection using existing filter/lock policy if necessary;
- clear stale creation/geometry drafts only where current duplicate operations
  already do so;
- do not persist selection in `Diagram`.

Do not let the new Inspector action bypass existing hidden/locked-layer
editability rules.

Repeated successful clicks must create distinct IDs and select the newest copy.

## Undo/Redo and central synchronization

Duplicate plus translation is one diagram edit:

```text
deep-copy patch
+ detach links on the copy
+ translate copy
+ append copy
= one commitDiagramChange call
```

Requirements:

- do not commit an unshifted copy and then commit a second translation;
- do not implement the operation through a React `useEffect`;
- ensure the duplicate is already static before the central linked-Coons
  synchronizer sees the candidate diagram;
- no synchronization-only history entry;
- one Undo removes the complete translated copy and leaves the original intact;
- Undo clears the selection when it points to the removed copy, following
  existing missing-selection cleanup;
- one Redo restores the same duplicated ID and exact translated geometry;
- Redo selection follows the existing editor-history policy and must at least
  remain valid; Phase 30 does not add selection-history persistence;
- repeated Undo/Redo does not regenerate IDs, add copies, or drift geometry;
- failed or zero-vector submissions create no history entry.

The original linked patch must not be rematerialized merely because a static
copy was appended.

## Save/load, rendering, and export

Do not add a new persistent model field or bump the save-file version.

The translated duplicate is an ordinary static Coons patch and must naturally
round-trip through existing JSON serialization.

Requirements:

- source and translated copy render together in SVG Preview;
- SVG export uses the translated materialized snapshots;
- TikZ export emits the translated sampled mesh;
- a later full linked-Coons synchronization does not move the static copy;
- save/load does not restore removed `boundarySources` on the copy;
- a frozen static copy preserves its authoritative last-valid translated
  previews through save/load;
- no render-time or export-time source lookup is added;
- TikZ indentation remains 4 spaces;
- inline-math output contains no blank lines.

## Scope

Implement:

- a pure Coons duplicate-and-translate operation;
- global `dx`, `dy`, `dz` Inspector controls for one selected Coons patch;
- deep cloning and global ID allocation;
- required static-copy behavior for linked and stale linked originals;
- complete snapshot translation;
- frozen-snapshot-safe translation;
- validation and atomic failure;
- selection and one-step Undo/Redo integration;
- JSON, SVG, TikZ, and regression tests;
- documentation and Roadmap updates.

Do not implement:

- duplication/translation of boundary source paths or points;
- a translated linked copy;
- persistent linked-patch transform offsets;
- a general dependency graph;
- per-role relinking/replacement UI;
- a standalone direct boundary-snapshot editor;
- rotation, scaling, shear, or general affine transforms;
- work-plane-local translation UI for this action;
- cursor-drag placement of the duplicate;
- live-linked ruled surfaces;
- automatic Coons corner repair;
- new Coons formulas or sampling algorithms;
- a broad Inspector or bulk-editing redesign;
- new dependencies.

## Tests

Add focused unit, integration, and behavioral UI coverage.

A dedicated file such as:

```text
tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

is appropriate.

Because `npm test` enumerates test files explicitly, add every new test file to
the script.

At minimum, test:

1. **Eligibility**
   - The operation accepts exactly a Coons curved-sheet stratum.
   - It rejects missing IDs and non-Coons strata without mutation.
   - The production Inspector section is available only for one selected Coons
     patch.

2. **Static numeric duplicate**
   - Duplicate a static patch by a non-zero `(dx, dy, dz)`.
   - Verify a fresh ID, preserved metadata, and static status.
   - Verify the original diagram object and original patch geometry are
     unchanged.

3. **Complete boundary translation**
   - Cover `bottom`, `right`, `top`, and `left`.
   - Cover path and constant-point boundaries.
   - Cover representative line, cubic, and arc/frame snapshot data.
   - Verify every frame origin moves and every basis vector stays unchanged.

4. **Coons geometry**
   - Verify corner equations remain valid.
   - Verify each sampled duplicate vertex equals the original vertex plus the
     translation.
   - Verify mesh topology and sampling counts are unchanged.

5. **Deep-clone independence**
   - Assert equal values but distinct primitive, snapshot, segment-array,
     segment, point/control, style, and sampling object identities.
   - Edit the copy afterward and verify the original does not change.

6. **Linked original**
   - Start with a linked up-to-date patch.
   - Verify the original retains all links.
   - Verify the translated copy has no `boundarySources` and reports static.
   - Edit an original source and run synchronization.
   - Verify the original refreshes and the translated copy does not move.

7. **Stale linked original**
   - Break or remove one source.
   - Duplicate and translate the stale patch successfully.
   - Verify the exact last-valid frozen snapshots are the source of the copy.
   - Verify the static copy preserves `boundarySnapshotState: 'frozen'`.
   - Repair the original sources and verify only the original catches up.

8. **Frozen symbolic preview**
   - Diverge a variable from the value captured in frozen snapshots.
   - Translate the stale patch.
   - Verify stored translated preview geometry equals frozen preview plus delta,
     not reevaluated-current-variable geometry.
   - Verify expressions/provenance remain valid and save/load does not drift.

9. **Symbolic translation**
   - Reuse existing scalar-expression delta support.
   - Verify expression addition is valid and preview geometry is finite.
   - Verify unknown variables and non-finite results fail atomically.

10. **ID reservation and repeated use**
    - Force collisions with stratum, label, coordinate-anchor, and reserved
      linked-source IDs.
    - Verify deterministic globally unique allocation.
    - Repeat the action and verify distinct IDs.

11. **Metadata**
    - Preserve name, layer, codim, geometric kind, style, opacity, sampling,
      attached label metadata, role orientation, and frozen-state policy.
    - Do not duplicate or move source paths/points/coordinate anchors.

12. **Invalid and zero input**
    - Exercise temporary invalid Inspector drafts.
    - Reject `NaN`, `Infinity`, unknown expressions, and a zero vector.
    - Verify no copy, no partial mutation, no selection change, and no history.

13. **Production Inspector behavior**
    - Drive the actual production callback/state transition, not source-text
      matching alone.
    - Enter `dx`, `dy`, and `dz`, click the real action, and verify the created
      model.
    - Verify success selects the copy and shows useful status.

14. **Undo/Redo**
    - One click adds exactly one history entry.
    - One Undo removes the copy and clears missing selection coherently.
    - One Redo restores the same ID and geometry.
    - Repeated Undo/Redo does not drift or add copies.

15. **Save/load and synchronization**
    - Round-trip the static translated copy.
    - Run full synchronization before and after load.
    - Verify the copy remains static and translated.

16. **SVG and TikZ**
    - Verify isolated sampled/Preview geometry is translated.
    - Verify SVG and TikZ contain source and copy geometry.
    - Preserve inline no-blank-lines and 4-space indentation.

17. **Regression**
    - Generic bulk duplicate keeps existing Phase 29 patch-only link semantics.
    - Duplicating patch plus sources still remaps links.
    - Layer translation and duplication retain their current behavior.
    - Static Coons patches, ruled surfaces, and other curved sheets are
      unaffected.

## Manual verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Manually verify:

1. Open a 3D diagram containing a static Coons patch.
2. Select the patch and expand Inspector.
3. Enter non-zero `dx`, `dy`, and `dz` values.
4. Click `Duplicate & translate`.
5. Confirm one translated copy appears and is selected.
6. Confirm the original does not move.
7. Undo once and confirm the copy disappears.
8. Redo once and confirm the same copy returns at the same position.
9. Repeat with a linked up-to-date patch.
10. Confirm the original remains linked and the copy reports `Static`.
11. Edit an original boundary source and confirm the copy does not move.
12. Repeat with a stale linked patch and confirm the last-valid displayed
    geometry is copied and translated.
13. Save/reload JSON and confirm the copy remains static and translated.
14. Check SVG export and both standalone and inline-math TikZ export.
15. Try incomplete, invalid, non-finite, and zero input and confirm no copy is
    created.

If browser/manual verification is unavailable, say so explicitly in the final
implementation report. Do not claim it was performed.

## Documentation

Update `docs/ROADMAP.md` with an implemented Phase 30 entry such as:

```markdown
## Phase 30: Inspector duplicate-and-translate for Coons patches

- Duplicate one selected Coons patch and translate its materialized geometry in
  one Inspector action.
- Create an independent static copy while preserving the original patch and its
  source links.
- Support last-valid stale snapshots, symbolic-aware translation, and one-step
  Undo/Redo.
```

A suitable phase slug is:

```text
"30": "coons-patch-duplicate-translate"
```

Update `docs/EDITING.md` and `docs/RULED_SURFACES.md` to document:

- where the Inspector action appears;
- global `dx`, `dy`, `dz` semantics;
- direct input does not use cursor snap;
- the copy is always static;
- original boundary sources are neither duplicated nor moved;
- linked and stale originals remain unchanged;
- stale copies use translated last-valid frozen snapshots;
- one-step Undo/Redo and selection behavior;
- rotation/scale and linked transform offsets remain unsupported.

Update `docs/DATA_MODEL.md` only where needed to clarify that Phase 30 adds no
new saved field and that the translated result is an ordinary static Coons
patch.

Documentation must describe implemented behavior, not aspirational behavior.

## Preserve existing behavior

Do not regress:

- static Coons patches;
- linked creation and explicit static creation;
- linked-source synchronization;
- stale last-valid fallback and recovery;
- `Detach boundary links`;
- source deletion behavior;
- per-role reversal;
- patch-only and patch-plus-source generic duplication semantics;
- coordinate-reference detachment;
- symbolic variables and frozen snapshot import behavior;
- bulk and layer duplicate/translation;
- layer visibility, locking, and filtering;
- selection and multi-selection;
- Undo/Redo;
- JSON save/load;
- SVG Preview and SVG export;
- TikZ export;
- automatic visibility;
- inline-math output;
- 4-space TikZ indentation;
- ruled surfaces and other curved sheets.

## Acceptance criteria

Phase 30 is complete when:

- exactly one selected Coons patch exposes the compact Inspector operation;
- one valid non-zero vector produces exactly one fully translated deep copy;
- the original patch and all source strata remain unchanged;
- every translated copy is static, including copies of linked and stale linked
  originals;
- stale copies are based on exact last-valid frozen snapshots without symbolic
  preview drift;
- IDs are globally unique and deterministic;
- all four boundaries, constant points, path controls, and frame origins are
  translated exactly once;
- style, layer, sampling, orientation, and relevant metadata are preserved;
- invalid input fails atomically;
- success selects the copy and creates one Undo/Redo transaction;
- later synchronization and save/load never reset the copy;
- SVG and TikZ use translated materialized snapshots;
- tests, build, and `git diff --check` pass.

## Report after implementation

Please report:

- files modified;
- helper/API added or reused;
- Inspector placement and input behavior;
- global translation and zero-vector policy;
- deep-clone and ID-allocation strategy;
- linked, static, and stale/frozen copy semantics;
- symbolic and frame translation behavior;
- coordinate-reference handling;
- selection and layer-filter behavior;
- Undo/Redo transaction behavior;
- save/load and synchronization behavior;
- SVG/TikZ behavior;
- tests added or updated;
- manual verification performed;
- exact `npm test` result;
- exact `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- known limitations and deferred work.
