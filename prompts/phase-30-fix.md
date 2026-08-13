# Phase 30 Fix Prompt: Harden Coons duplicate-and-translate atomicity and independence

## Environment

Work on the current Phase 30 branch.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

If the focused file has a different implemented name, use that exact file in
the focused command and report it.

Run lint only if the repository is already established as repository-wide
lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies.

## Project context

You are hardening Phase 30 of StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 30 adds one Inspector action for a singly selected Coons patch:

```text
Duplicate & translate
```

The intended operation is narrow:

- deep-copy the selected patch's current materialized geometry;
- remove active links from the copy;
- translate all four copied boundaries by one global 3D vector;
- append one static patch;
- select that copy;
- commit exactly one history transaction.

This fix prompt is for auditing and correcting the initial Phase 30
implementation. Verify each failure mode against production code and tests
before changing behavior. Do not perform a broad rewrite when the existing code
already satisfies a requirement.

## Required reading before fixing

Inspect at least:

- `AGENTS.md`;
- `prompts/phase-30-implement.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-fix.md`;
- the Phase 30 implementation diff;
- any Phase 30 review findings available on the branch;
- `src/model/types.ts`;
- `src/model/coonsPatchLinks.ts`;
- `src/model/translation.ts`;
- `src/model/diagramIds.ts`;
- `src/model/coordinateReferences.ts`;
- `src/ui/bulkEditing.ts`;
- the implemented Phase 30 operation helper;
- `src/ui/undo.ts`;
- the Inspector component containing the new form;
- the App-level production callback used by that form;
- Phase 24 duplicate/translation tests;
- Phase 26 ID reservation tests;
- Phase 27 sampled Coons coordinate-reference tests;
- Phase 29 linked/stale/synchronization/duplication tests;
- Phase 30 tests;
- `package.json`.

Search for:

- every call to the Phase 30 operation helper;
- every `boundarySources` mutation in the new path;
- every diagram commit made by one button click;
- every translation of `bottom`, `right`, `top`, and `left`;
- `boundarySnapshotState` handling;
- ID allocation and copy selection;
- any UI test that only reads source code instead of exercising behavior.

## Required Phase 30 contract

The final behavior must be:

```text
original patch: unchanged
original boundary sources: unchanged
translated copy: deep-cloned, static, and independent
history: one entry
```

For all original states:

| Original patch | Original after action | Translated copy |
| --- | --- | --- |
| Static | Static, unchanged | Static |
| Linked — up to date | Linked, unchanged | Static |
| Linked — stale | Linked and stale, unchanged | Static frozen fallback |

The table above is normative.

Do not preserve active `boundarySources` on the translated copy.

Do not solve the link/translation conflict by:

- duplicating source paths or points;
- moving original sources;
- adding a persistent offset;
- teaching the synchronizer to apply transforms;
- bypassing synchronization in rendering;
- changing generic Phase 29 patch-only duplication semantics.

## Goal

Audit and fix Phase 30 so that:

1. The real Inspector action is correctly gated and wired.
2. Linked and stale copies are static before the central synchronizer sees the
   candidate diagram.
3. All copied geometry is deep-cloned and translated exactly once.
4. Frozen stale symbolic previews do not drift.
5. IDs are globally unique.
6. Invalid input is atomic.
7. One click creates one history entry.
8. Preview, JSON, SVG, and TikZ remain consistent.
9. Regression coverage exercises production behavior rather than implementation
   text.

## 1. Verify production Inspector wiring

The new section must be shown only when the current selection resolves to one
stratum with:

```ts
geometricKind === 'sheet'
kind === 'curvedSheet'
primitive.kind === 'coonsPatch'
```

Check that the section is absent for:

- no selection;
- multi-selection;
- coordinate selections;
- free text labels;
- points and curves;
- polygon/work-plane-filled sheets;
- ruled surfaces;
- hemispheres and saddles.

The form must call the production App/editor-state path. It is not enough for a
button to render or for a source-text regex to find its label.

Verify:

- `dx`, `dy`, and `dz` draft state is local UI state;
- the fields allow temporary incomplete strings;
- changing selection does not show stale success/error text for the next patch;
- the action respects existing hidden/locked/filter editability;
- success selects the returned duplicate ID;
- no Phase 30 draft or status is serialized.

If the callback currently updates only `Diagram` and cannot select the copy,
introduce the smallest typed App/editor callback needed. Do not redesign all
Inspector state.

## 2. Fix linked-copy snap-back

Inspect the candidate diagram immediately before `commitDiagramChange`.

The duplicate must already omit:

```ts
primitive.boundarySources
```

If links are removed only after the commit, the central Phase 29 synchronizer
can rematerialize the copy from untranslated original sources. That ordering is
incorrect.

Correct ordering:

```text
clone
-> assign fresh ID
-> remove active boundarySources on clone
-> translate clone
-> validate
-> append
-> one commit
```

After the fix, test all of these events against the translated copy:

- edit an original linked source;
- delete an original linked source;
- repair a stale original;
- invoke changed-source synchronization;
- invoke full synchronization;
- save and reload JSON;
- Undo and Redo.

None may move the static copy or recreate its active links.

Keep optional snapshot `id`, `sourceId`, and `name` provenance unless current
validation requires a documented normalization. These are not active links.

## 3. Fix stale/frozen copy semantics

For a linked stale original, use the exact displayed last-valid snapshots.

Do not:

- require missing/broken sources to resolve before copying;
- partially rebuild valid roles;
- refresh frozen symbolic previews against current diagram variables;
- clear `boundarySnapshotState: 'frozen'` merely because links were detached;
- replace stale snapshots with invalid current source geometry.

The static translated copy must preserve:

```ts
boundarySnapshotState: 'frozen'
```

and translate the stored authoritative preview geometry.

### Frozen symbolic regression

Create a linked patch whose last-valid snapshot contains a symbolic expression,
then make the patch stale and change the variable so the expression's current
evaluation differs from the frozen preview.

For numeric delta `d`, require:

```text
translated frozen preview = stored frozen preview + d
```

not:

```text
translated frozen preview = reevaluate(expression, current variables) + d
```

Preserve a valid symbolic addition expression and provenance where the shared
model supports it. If the standard translation engine cannot distinguish frozen
preview authority, add a narrow explicit translation policy and test it. Do not
use raw unvalidated expression strings.

## 4. Fix complete geometry translation

Audit the operation for partial or double translation.

Every copy must translate exactly once:

- all `bottom` geometry;
- all `right` geometry;
- all `top` geometry;
- all `left` geometry;
- constant-point boundary points;
- line endpoints;
- cubic endpoints and control points;
- arc/frame origins and absolute points;
- concatenated/sampled-template snapshot segments;
- work-plane-local stored frame origins.

Do not translate:

- frame `u`;
- frame `v`;
- frame `normal`;
- local `a`/`b` values when translating their frame origin;
- source paths, source points, or coordinate anchors;
- the original patch.

Use the shared translation engine. If the Phase 30 helper manually walks only
some boundary kinds, replace that duplication with the existing typed helper or
extract one shared helper.

Validate the full candidate after translation:

- all coordinates finite;
- all path snapshots valid/composable;
- every Coons corner equation holds;
- sampling remains valid;
- sampled mesh finite;
- candidate diagram valid.

For numeric data, assert:

```text
copyMesh[i] = originalMaterializedMesh[i] + delta
```

for every sampled vertex within the existing tolerance.

## 5. Fix shallow copies and metadata loss

Check identity as well as deep equality.

The original and copy must not share mutable nested objects for:

- stratum;
- style;
- primitive;
- sampling;
- each boundary snapshot;
- segment arrays;
- segments;
- endpoints and controls;
- constant-point coordinates;
- retained symbolic/source metadata.

Preserve:

- name under the existing ordinary duplicate policy;
- codimension 1;
- `geometricKind: 'sheet'`;
- `kind: 'curvedSheet'`;
- layer;
- style and opacity;
- imported/local style metadata;
- attached label metadata;
- sampling;
- role ordering and orientation;
- frozen snapshot state where required.

After creating the copy, mutate it through a normal editor operation and prove
the original remains byte-for-byte or semantically unchanged.

## 6. Fix global ID allocation

Do not allocate by checking only `diagram.strata` or by always appending one
literal suffix.

Reuse the established global allocator and reserve all IDs covered by current
policy, including:

- strata;
- labels;
- coordinate anchors;
- dangling linked-Coons path/point source IDs;
- IDs allocated earlier in the same operation.

Add collision tests such as:

```text
patch
patch-copy       (label)
patch-copy-1     (coordinate anchor)
patch-copy-2     (dangling linked source ID)
```

and verify the next deterministic unused ID is chosen.

Repeated clicks and Undo/Redo must never cause duplicate top-level IDs.

Do not regenerate optional boundary snapshot provenance IDs as top-level IDs.

## 7. Fix input validation and atomic failure

Reuse the existing translation parser and scalar-expression rules.

Required behavior:

- incomplete drafts such as ``, `.`, `-`, and `1e` remain editable;
- invalid drafts show warnings;
- `NaN` and `Infinity` are rejected;
- unknown variables are rejected;
- non-finite evaluated expressions are rejected;
- zero translation is rejected with `Enter a non-zero translation.`;
- direct Inspector input does not use cursor snap;
- invalid input never calls the diagram mutation path.

For every failure, assert:

- same diagram data;
- no appended copy;
- original untouched;
- selection unchanged;
- history lengths unchanged;
- no success status.

If translation fails after cloning, discard the local candidate and return the
original diagram. Never expose a partially translated copy.

## 8. Fix history and selection atomicity

One button click must call the central commit path once with the complete final
diagram.

Disallowed sequences:

```text
commit duplicate
commit detach
commit translate
```

or:

```text
commit duplicate
React effect translates it later
```

Required history behavior:

- successful action adds exactly one `past` entry;
- one Undo removes the copy and preserves the original;
- missing-copy selection is cleaned on Undo;
- one Redo restores the exact same duplicate ID and geometry;
- selection after Redo follows current history policy and is valid;
- repeated Undo/Redo does not drift geometry, regenerate IDs, or append copies;
- no separate linked-synchronization history entry exists.

Do not broaden Phase 30 into general selection-history persistence.

## 9. Fix rendering, export, and save/load regressions

Sampling, rendering, and export must continue consuming materialized snapshots.

Do not pass the whole `Diagram` into `sampleCoonsPatch` and do not add source
lookup to:

- SVG scene preparation;
- curved-sheet mesh rendering;
- SVG export;
- TikZ generation.

Verify:

- original and copy are both present in Preview;
- the copy's isolated world-space mesh is translated;
- SVG export contains translated copy geometry;
- TikZ uses translated snapshots;
- layer/style/opacity/sampling remain unchanged;
- JSON round-trip retains a static copy;
- frozen static copy previews do not refresh or drift on load;
- standalone TikZ remains readable;
- inline-math output contains no blank lines;
- TikZ indentation remains 4 spaces.

Do not change the Coons formula, mesh topology, or visibility algorithm.

## Behavioral regression strategy

Tests must exercise production behavior.

Preferred order:

1. Use an existing component/interaction harness if available.
2. Otherwise exercise the production App controller/editor-state helper used by
   the real Inspector callback.
3. If behavior is trapped inside React, extract the smallest pure typed helper
   and make both production and tests call it.

Do not satisfy behavioral coverage by:

- source-text matching alone;
- calling only `translateStratum`;
- calling only generic `duplicateSelectedElements`;
- manually constructing the expected final diagram;
- using a test-only fake operation;
- asserting only that the button label exists.

The behavioral regression should:

1. select one real Coons patch;
2. enter valid `dx`, `dy`, and `dz` values in the production form/state path;
3. invoke the production action once;
4. inspect the created diagram model and selection;
5. Undo once;
6. Redo once;
7. edit an original source and synchronize;
8. verify the static copy stays translated.

No new browser/testing dependency is allowed.

## Required tests

At minimum, add or correct tests for:

1. Real Inspector eligibility and production callback wiring.
2. Static numeric duplicate and complete mesh translation.
3. Linked original remains linked; copy is static before commit.
4. Later changed-source and full synchronization cannot snap the copy back.
5. Stale linked original produces a static frozen translated copy.
6. Frozen symbolic preview uses stored preview plus delta.
7. Constant-point and representative path/frame boundaries.
8. Deep-clone identity at every important nesting level.
9. Original patch and sources remain unchanged.
10. Global ID collisions across strata, labels, anchors, and reserved source IDs.
11. Repeated duplicate-and-translate actions allocate distinct IDs.
12. Invalid, non-finite, unknown, incomplete, and zero input is atomic.
13. Success selects the copy; failure preserves selection.
14. Exactly one Undo entry, one-step Undo/Redo, and no drift.
15. Save/load preserves the static translated copy.
16. SVG/TikZ geometry and formatting invariants.
17. Generic Phase 29 duplicate/link-remapping behavior remains unchanged.
18. Ruled surfaces and other curved-sheet kinds are unaffected.

Inspect assertions, not only test counts. Ensure every new test file is included
by `npm test`.

## Production changes

Keep production changes focused on verified Phase 30 gaps.

Acceptable changes include:

- a narrow pure operation helper;
- reuse/extraction of a shared Coons snapshot translation helper;
- a frozen-preview translation policy;
- a typed Inspector/App callback needed for selection and one-step history;
- compact validation/status fixes;
- focused test seams used by production and tests.

Do not:

- redesign all bulk editing;
- redesign the history model;
- add source-tree duplication;
- add persistent transform metadata;
- change generic linked-Coons semantics;
- move source resolution into rendering;
- change JSON version/schema;
- add dependencies;
- perform unrelated UI cleanup.

## Manual verification checklist

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Select a static Coons patch.
2. Enter a non-zero 3D translation and click once.
3. Confirm exactly one selected copy appears at the translated position.
4. Undo once and Redo once.
5. Repeat with a healthy linked patch.
6. Confirm the original remains linked and the copy reports `Static`.
7. Move an original boundary source and confirm the copy stays fixed.
8. Repeat with a stale/missing-source patch.
9. Confirm its displayed last-valid geometry is copied and translated.
10. Change a variable involved in the stale snapshots and confirm no copy drift.
11. Save and reload JSON.
12. Check SVG, standalone TikZ, and inline-math TikZ export.
13. Try incomplete, invalid, non-finite, and zero inputs.
14. Confirm non-Coons selections do not expose the action.

If manual verification is unavailable, state that explicitly. Do not claim it
was performed.

## Documentation

Ensure the implemented docs state:

- the action is for one selected Coons patch;
- the vector is global `dx`, `dy`, `dz` and direct input is not snapped;
- the result is always a static independent copy;
- original sources are not duplicated or moved;
- linked/stale originals remain unchanged;
- stale copies use translated frozen last-valid snapshots;
- Undo/Redo is one transaction;
- no linked transform offset, rotation, scale, or source-tree duplication is
  implemented.

Fix contradictions only where they exist. Do not broadly rewrite documentation.

## Preserve existing behavior

Do not regress:

- static and linked Coons creation;
- live source synchronization;
- stale fallback/recovery;
- source deletion;
- detach;
- per-role reversal;
- source-ID reservation;
- generic patch-only duplication;
- patch-plus-source ID remapping;
- coordinate-reference detachment;
- symbolic import and frozen snapshots;
- bulk/layer duplicate and translation;
- layer filtering, visibility, and locking;
- selection and multi-selection;
- Undo/Redo;
- JSON save/load;
- Preview performance and mesh caching;
- SVG/TikZ export;
- inline no-blank-lines;
- 4-space indentation;
- ruled surfaces and other curved sheets.

## Scope constraints

This is a targeted Phase 30 fix.

Implement only fixes and coverage needed for:

- Inspector behavior;
- static-copy link policy;
- frozen snapshot correctness;
- complete/deep translation;
- ID safety;
- atomic validation/history;
- rendering/export/save-load stability.

Do not implement:

- translated live links;
- duplicated source ecosystems;
- persistent transforms;
- general affine transforms;
- drag placement;
- work-plane-local Phase 30 UI;
- general dependency graphs;
- new sampling or rendering architecture;
- unrelated features.

## Verification

Run the focused Phase 30 test first, then the complete suite:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report exact commands and results. Do not hide pre-existing failures; distinguish
them from Phase 30 regressions with evidence.

## Acceptance criteria

The Phase 30 fix is complete when:

- production Inspector behavior is exercised and correct;
- original patch and sources never change;
- every translated copy is deep-cloned and static before commit;
- healthy linked copies cannot snap back;
- stale copies preserve and translate exact frozen last-valid previews;
- all four boundary roles and supported nested geometry move exactly once;
- globally reserved IDs cannot collide;
- invalid/zero input has no diagram, selection, or history effect;
- one action is exactly one Undo/Redo transaction;
- save/load, SVG, and TikZ preserve translated output;
- existing Phase 29 duplication/synchronization behavior remains intact;
- focused tests, full tests, build, and `git diff --check` pass.

## Report after implementation

Please report:

- files modified;
- verified root causes or gaps;
- Inspector production wiring;
- helper and shared translation logic used;
- linked/static/stale-copy policy;
- frozen symbolic preview handling;
- deep-clone evidence;
- ID-allocation policy;
- input validation and zero-vector behavior;
- selection and one-step history behavior;
- synchronization/save-load behavior;
- SVG/TikZ verification;
- focused tests added or corrected;
- manual verification performed;
- exact focused-test result;
- exact `npm test` result;
- exact `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- remaining limitations.
