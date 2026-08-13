# Phase 30 Fix Prompt: Split Coons Inspector Duplicate and Translate actions

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

PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

git diff --check
```

The production files may be renamed as part of splitting the feature. If so,
run targeted ESLint on the actual changed Phase 30 files and update the focused
test command or explicit `npm test` list only where necessary. Report the exact
commands.

Repository-wide lint currently has unrelated pre-existing debt. Do not use that
debt as a Phase 30 failure and do not broaden this fix into repository-wide lint
cleanup.

Do not add dependencies.

## Project context

You are changing Phase 30 of StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

The initial Phase 30 implementation exposed one combined Inspector operation:

```text
Duplicate & translate
```

That product contract is superseded by this fix prompt. Replace it with two
independent actions:

```text
Duplicate
  [Duplicate]

Translate
  dx
  dy
  dz
  [Translate]
```

The ordinary workflow is:

1. select one Coons patch;
2. click `Duplicate`;
3. the new copy becomes selected;
4. optionally enter a vector and click `Translate` to move that selected copy.

The user may also invoke `Translate` directly on any eligible selected Coons
patch without duplicating it first.

These are separate production interactions, separate typed operations, and
separate history transactions. Do not keep a combined production button or
make either action secretly perform both operations.

## Superseding prior Phase 30 wording

Where this prompt conflicts with the combined-action wording in
`phase-30-implement.md`, `phase-30-review.md`, the initial implementation, or
the previous review, this split-action prompt is normative.

In particular, replace these prior assumptions:

- one button both duplicates and translates;
- one vector submission appends a translated copy;
- every duplicate made by Phase 30 is immediately static;
- deep clone, detach, translate, append, and select happen in one transaction;
- one Undo removes the translated copy;
- invalid translation means no copy was created.

with these contracts:

- `Duplicate` alone appends an untranslated copy using existing Phase 29
  patch-only duplication semantics;
- `Translate` alone changes the selected patch at the same ID;
- only `Translate` detaches a linked selected patch before moving it;
- each successful action creates exactly one history entry;
- `Duplicate` followed by `Translate` creates exactly two history entries;
- a failed `Translate` does not undo an earlier successful `Duplicate`.

Do not edit the Phase 30 prompt files as part of implementing this fix. This
file is the override consumed by fix mode.

## Review findings that must also be closed

The previous review found no Critical runtime defect. It found two Medium
coverage gaps and one Low lint issue:

1. The production Inspector test server-rendered markup but did not invoke the
   actual form callback. The state test called submission and editor-state
   helpers directly, so incorrect production UI forwarding could pass.
2. Preview vertices were checked, but rendered SVG used only element-count
   assertions and TikZ used only comments/counts/formatting assertions. Final
   translated coordinates were not tested.
3. The focused test reported unused imports for `CoonsPatchPrimitive`,
   `CurvedSheetStratum`, `PathSegment`, and `PointStratum`.

Adapt those fixes to the two new action paths. Splitting the UI does not waive
the production-interaction or final-output regression requirements.

## Required reading before implementation

Read at least:

- `AGENTS.md`;
- `prompts/phase-30-implement.md` for the original geometry requirements;
- `prompts/phase-30-review.md` for the previous review methodology, while
  applying this prompt's superseding behavior;
- `prompts/phase-29-implement.md` and `prompts/phase-29-fix.md` for generic
  Coons patch duplication and link synchronization;
- the complete current Phase 30 diff;
- `src/ui/coonsPatchDuplicateTranslation.ts`;
- `src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx`;
- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/inspector/StratumInspector.tsx`;
- the App callbacks for bulk duplicate, bulk translate, and the current combined
  Coons operation;
- `src/ui/bulkEditing.ts`, including patch-only duplication and translation;
- `src/model/coonsPatchLinks.ts`;
- `src/model/translation.ts`;
- `src/model/diagramIds.ts`;
- `src/model/coordinateReferences.ts`;
- `src/ui/undo.ts`;
- the rendering/SVG/TikZ paths used by Coons patches;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`;
- `package.json`;
- `docs/EDITING.md`, `docs/RULED_SURFACES.md`, `docs/DATA_MODEL.md`, and
  `docs/ROADMAP.md`.

Inspect actual callbacks, handler references, commit boundaries, and test
assertions. Search for every surviving `Duplicate & translate`, combined
callback/helper name, and combined one-step history claim.

## Goal

Implement two independent Inspector actions for exactly one selected editable
Coons patch:

1. `Duplicate` creates an untranslated copy using generic patch-only link
   semantics, selects the copy, and commits one edit.
2. `Translate` moves the selected patch at the same ID. If it is linked, it is
   atomically detached before translation so synchronization cannot snap it
   back. It commits one edit.

Also close the previous review gaps with real production interaction tests,
actual SVG/TikZ coordinate assertions, and targeted lint cleanup.

## 1. Inspector layout and eligibility

Show the two controls only when selection resolves to exactly one editable
stratum satisfying:

```ts
geometricKind === 'sheet'
kind === 'curvedSheet'
primitive.kind === 'coonsPatch'
```

Do not show or enable them for:

- no selection;
- stale/missing selection IDs;
- multi-selection;
- coordinate selections;
- free text labels;
- points or curves;
- polygon or work-plane-filled sheets;
- ruled surfaces;
- hemispheres or saddles;
- a selection excluded by the existing hidden/locked/layer-filter editability
  policy.

Use either two compact sections or one clearly separated `Coons patch actions`
section. The controls must remain distinct:

- `Duplicate` is a `type="button"` action and is not the submit control of the
  translation form;
- `Translate` is the only submit button in the `dx`/`dy`/`dz` form;
- pressing Enter in a translation field must never trigger `Duplicate`;
- clicking `Duplicate` must not submit or validate the translation draft.

Use accessible, distinct labels and titles. The UI must explain concisely that
translating a linked patch detaches that patch and makes it static. Do not imply
that ordinary duplication always detaches links.

Keep `dx`, `dy`, `dz`, and status strings in local UI state. Reset or re-key
status when the selected patch changes so a message for the original does not
bleed onto a copy or another patch. No action drafts or selection state belong
in `Diagram` or saved JSON.

## 2. Duplicate operation

### Public behavior

`Duplicate` targets the currently selected Coons patch and takes no translation
vector.

It must:

1. verify the selected ID still resolves to an eligible editable Coons patch;
2. use the established deterministic global ID allocator;
3. deep-clone the complete patch and mutable nested data;
4. preserve its current materialized snapshots exactly, without translation;
5. apply the existing Phase 29 patch-only duplication policy to active links;
6. preserve required metadata;
7. validate the candidate diagram;
8. append exactly one copy;
9. select the new copy as a single stratum selection;
10. commit exactly one history entry.

Duplicate must never:

- inspect, parse, or reject the `dx`/`dy`/`dz` drafts;
- translate any point;
- detach links merely because a later Translate might occur;
- duplicate or move boundary source paths, source points, or coordinate
  anchors;
- allocate more than one top-level copy ID;
- invoke the Translate callback;
- modify the selected original.

An invalid or zero translation draft must not disable or alter `Duplicate`.

### Duplicate state matrix

This table is normative:

| Selected patch before Duplicate | Original after Duplicate | New selected copy |
| --- | --- | --- |
| Static | Static and unchanged | Static with equal untranslated snapshots |
| Linked — up to date | Linked and unchanged | Linked to the same source IDs, with independent current snapshots |
| Linked — stale | Linked and stale, unchanged | Linked and stale, with exact independently cloned frozen last-valid snapshots |

For a stale linked duplicate, preserve its active `boundarySources` and
`boundarySnapshotState: 'frozen'`. Do not repair, partially refresh, or detach it
during Duplicate.

For a healthy linked duplicate, a later source edit is expected to synchronize
both original and duplicate until either is independently translated/detached.
This is existing Phase 29 behavior, not snap-back.

### Duplicate clone and metadata requirements

Do not share mutable nested references between original and copy, including:

- stratum and style objects;
- primitive and sampling objects;
- all four boundary snapshots;
- segment arrays and segment objects;
- endpoints and controls;
- constant-point coordinates;
- work-plane frames;
- symbolic/source provenance;
- active `boundarySources` metadata when retained.

Preserve:

- name according to the existing ordinary duplicate policy;
- `codim: 1`;
- `geometricKind: 'sheet'`;
- `kind: 'curvedSheet'`;
- `primitive.kind: 'coonsPatch'`;
- layer;
- style, opacity, preset/import metadata, and attached label metadata;
- sampling;
- boundary role order and reversal/orientation;
- frozen snapshot state where applicable.

Reserve every top-level namespace already covered by the global policy:

- strata;
- labels;
- coordinate anchors;
- dangling linked-Coons path/point source IDs;
- IDs allocated by repeated Duplicate actions.

Do not reinterpret optional snapshot provenance IDs as top-level IDs.

### Duplicate failure and repetition

On failure, preserve diagram, selection, and history exactly. Do not leave a
persistent ID reservation or partial copy.

Repeated Duplicate clicks must create one fresh copy per click and select the
newest copy. Each click adds one history entry. No Duplicate may move any prior
copy.

## 3. Translate operation

### Public behavior

`Translate` targets the Coons patch selected at submission time. It performs an
immutable same-ID replacement; it does not append or allocate anything.

It must:

1. verify the selected ID still resolves to an eligible editable Coons patch;
2. parse `dx`, `dy`, and `dz` through the shared translation parser;
3. require one finite non-zero global 3D vector;
4. clone the selected patch for a local candidate;
5. if linked, remove the candidate's active `boundarySources` before the central
   commit/synchronizer sees it;
6. apply coordinate-reference detachment/rejection according to the existing
   curved-sheet translation policy;
7. translate all four materialized snapshots exactly once;
8. validate the complete primitive and candidate diagram;
9. replace the selected stratum at the same array position and same ID;
10. retain the same selection;
11. commit exactly one history entry.

Translate must never:

- create a copy;
- allocate or change an ID;
- change stratum count or order;
- translate source paths, source points, or coordinate anchors;
- translate any other selected or unselected object;
- preserve active links on an independently moved patch;
- implement translation as duplicate-then-delete;
- invoke the Duplicate callback.

Direct Inspector translation uses the global vector and never cursor snap.

### Translate state matrix

This table is normative:

| Selected patch before Translate | Same-ID selected patch after Translate |
| --- | --- |
| Static | Static with materialized snapshots translated by `d` |
| Linked — up to date | Static, links removed before commit, current materialized snapshots translated by `d` |
| Linked — stale | Static frozen fallback, links removed before commit, exact stored frozen previews translated by `d` |

Only the selected patch changes. Its former boundary source strata and
coordinate anchors remain byte-for-byte or semantically unchanged.

For a linked patch, detach-before-translate is required. Do not leave
`boundarySources` active and rely on a later effect to detach them: Phase 29
synchronization may otherwise restore source geometry and cancel the move.

Do not reuse generic bulk translation blindly if it preserves active Coons
links until `commitDiagramChange`. Use or extract a narrow typed same-ID Coons
translation operation that completes detach, translation, validation, and
replacement before the one commit.

### Frozen and symbolic translation

For a stale linked patch, use its exact stored/displayed last-valid snapshots.
Do not resolve broken sources, partially rebuild valid roles, or refresh against
current diagram variables.

Preserve:

```ts
boundarySnapshotState: 'frozen'
```

For an evaluated delta `d`, require:

```text
translated preview = stored frozen preview + d
```

and reject:

```text
translated preview = reevaluate(old expression, current variables) + d
```

Use existing typed symbolic addition/parser/formatter helpers. Do not build raw
expression strings. Preserve valid provenance and finite stored previews.

### Complete translation coverage

Translate exactly once in all four roles:

- `bottom`;
- `right`;
- `top`;
- `left`.

Cover:

- constant-point boundaries;
- line endpoints;
- cubic endpoints and controls;
- arc absolute points and stored frame origins;
- concatenated path segments;
- sampled-template segments;
- global and symbolic coordinates;
- work-plane-local stored frame origins.

Do not translate:

- frame `u`, `v`, or `normal`;
- local work-plane `a` or `b` when the frame origin moves;
- sampling counts or mesh topology.

All corner equations and validations must still hold. For every numeric sampled
vertex within existing tolerance:

```text
meshAfter[i] = meshBefore[i] + d
```

The comparison is against the selected patch immediately before Translate, not
necessarily against the original patch from an earlier Duplicate.

### Translate validation and failure

Allow temporary draft states such as:

```text
empty string
.
.5
-
1e
```

Reject without invoking the mutation callback:

- incomplete or invalid expressions;
- unknown variables;
- `NaN` or `Infinity`;
- expressions with non-finite previews;
- the zero vector.

Use the status:

```text
Enter a non-zero translation.
```

On every Translate failure:

- diagram data is unchanged;
- active links are not detached;
- stratum count and IDs are unchanged;
- selection is unchanged;
- history `past`, `present`, and `future` are unchanged;
- no success status is shown.

If a Duplicate succeeded earlier, a failed Translate leaves that untranslated
copy intact. Do not roll back the independent Duplicate transaction.

Repeated successful Translate submissions apply one delta per submission to the
same ID and create one history entry each. They must not regenerate IDs, append
copies, or introduce numerical/Undo drift beyond the defined repeated
translation.

## 4. Typed production APIs and cleanup

Expose distinct typed production paths, conceptually:

```ts
onDuplicateCoonsPatch(patchId: string): DuplicateCoonsPatchActionResult

onTranslateCoonsPatch(
  patchId: string,
  translation: TranslationVector,
): TranslateCoonsPatchActionResult
```

Names may follow repository conventions, but the contracts and distinct
callbacks are required.

Separate:

- pure/model-level Duplicate logic;
- Duplicate editor-state application;
- pure/model-level same-ID Translate logic;
- Translate editor-state application;
- Inspector Duplicate click handling;
- Inspector Translate form submission;
- App callbacks passed through `EditableInspector` and `StratumInspector`.

Low-level clone, ID, translation, validation, and commit helpers may be reused.
Do not duplicate geometry traversal merely to obtain separate buttons.

Remove the combined production UI entry point and combined App/Inspector
callback. Do not leave a dead `Duplicate & translate` button, hidden form, or
public state-transition path that can accidentally be wired later. A private
low-level helper may be retained only if it has a clear single responsibility
and is actually reused by one of the separate operations; do not retain a
public combined operation merely for backward compatibility.

There is no saved schema/API compatibility requirement for UI callback names.
Do not bump the diagram version.

The existing source/test filenames may remain if renaming them would add noise,
but exported type/function/component names and visible labels must accurately
describe the separate behavior. If files are renamed, update imports and the
explicit test script atomically.

## 5. Selection and history semantics

Each action is independently atomic.

### Duplicate alone

```text
before: H0, original selected
Duplicate: H1, new untranslated copy selected
Undo: H0, copy removed; stale missing-copy selection cleaned
Redo: H1, exact same copy ID and geometry restored
```

Redo selection follows the existing non-persistent selection policy; do not add
selection to diagram history solely for this feature.

### Translate alone

```text
before: H0, patch P selected
Translate: H1, same ID P translated and selected
Undo: H0, exact pre-translation geometry and link state restored
Redo: H1, exact translated static state restored
```

Directly translating a linked original must be undoable back to the exact
linked state, including source IDs, reversal flags, materialized snapshots, and
frozen state.

### Duplicate followed by Translate

```text
H0: original only
H1: untranslated copy exists with its Duplicate-time static/linked/stale state
H2: same copy ID is translated and static
```

Required Undo order:

1. first Undo restores H1: the unshifted copy remains and its exact pre-Translate
   link/static/frozen state is restored;
2. second Undo restores H0: the copy is removed and missing selection is
   cleaned.

Required Redo order:

1. first Redo restores the exact same unshifted copy ID;
2. second Redo restores the exact same translated static geometry.

Repeated cycles must not drift geometry, regenerate IDs, duplicate history
entries, append extra patches, or alter source strata.

Do not collapse the sequence into one history entry. Two user actions are
intentionally two transactions.

## 6. Production interaction regressions

The previous review's UI coverage finding must be fixed for both actions.

### Duplicate button regression

Exercise the actual production `Duplicate` button handler, not only a helper or
server-rendered label.

The test must verify:

- one click invokes the production Duplicate callback exactly once;
- it forwards the exact selected patch ID and no translation vector;
- it routes through the same editor-state transition used by the App;
- exactly one untranslated copy is appended;
- the returned copy ID becomes selected;
- history gains exactly one entry;
- invalid or zero translation drafts do not disable, alter, or get submitted by
  Duplicate;
- the Translate callback is not invoked.

### Translate form regression

Exercise the actual production Translate form handler.

Use three distinct components, for example:

```text
dx = 1.25
dy = -2.5
dz = 3.75
```

Verify:

- one submit invokes the production Translate callback exactly once;
- it forwards the exact selected patch ID;
- it forwards the parsed finite vector with no missing or swapped component;
- the App/editor-state transition replaces the same ID and does not append;
- linked input is static before central synchronization sees the candidate;
- selection stays on that same ID;
- history gains exactly one entry;
- the Duplicate callback is not invoked.

Through that same form path, invalid and zero submissions must invoke the
mutation callback zero times and preserve diagram, selection, and history.

### Interaction harness constraints

Prefer an existing interaction/component harness. Do not add a React testing,
DOM, browser, or other dependency for this fix.

If hook state cannot be driven directly, extract the smallest hook-free typed
production handler/controller seam. The real button/form and App path must use
that seam. Do not build a parallel test-only implementation.

These are insufficient by themselves:

- SSR markup;
- source-text or regular-expression matching;
- label or button counts;
- calling only pure duplicate/translate helpers;
- calling editor-state helpers directly without the actual production click or
  form handler;
- callbacks explicitly marked as not invoked;
- test-only fake control flow.

Keep SSR eligibility assertions only as supplemental coverage.

## 7. SVG and TikZ coordinate regressions

The final-output review finding remains required after the split.

Use an asymmetric patch, a fixed camera, and a non-zero vector that changes the
projection. The regression may perform Duplicate and then Translate, but it
must distinguish these states:

```text
after Duplicate: copy mesh equals source mesh
after Translate: copy mesh equals pre-Translate copy mesh + d
```

### SVG

Render through the production `SvgDiagram` path and the SVG export preparation
path where available.

The test must:

1. identify the selected copy's emitted curved-sheet face geometry
   deterministically;
2. parse numeric polygon `points` or boundary `d` coordinates;
3. derive expected projected coordinates from the translated mesh using the
   production camera/projection convention;
4. compare actual and expected values with the repository tolerance/formatting
   policy;
5. prove the asserted copy geometry differs from the source geometry.

Prefer all copy-face coordinates when a stable helper already exposes their
mapping. A smaller distinctive set is acceptable only if it unambiguously
identifies the copy and would fail if the copy were rendered at source
coordinates.

Element counts, data attributes, or Preview/world-space vertices alone are not
sufficient.

### Standalone and inline-math TikZ

For both:

```ts
generateTikz(diagram)
generateTikz(diagram, { exportMode: 'inlineMath' })
```

the test must:

1. isolate the translated patch/copy export block and coordinate definitions;
2. associate its coordinate names with its sampled mesh vertices;
3. compare emitted numeric coordinates with pre-Translate vertices plus `d`;
4. prove the values are not the source/untranslated values;
5. perform the coordinate assertion separately for both export modes.

Use stable structural parsing around the unique ID/comment and coordinate
definitions. A number occurring elsewhere in the document must not satisfy the
assertion accidentally.

Retain existing checks for:

- readable standalone output;
- 4-space indentation;
- no blank lines in inline-math output;
- style, opacity, layer visibility, and sampling preservation.

Do not change SVG/TikZ production output merely to make assertions convenient.
Add a narrow stable semantic hook only if no existing deterministic association
is possible, and explain why.

## 8. Required model and integration tests

At minimum, add or update meaningful assertions for:

1. separate visible `Duplicate` and `Translate` controls;
2. absence of the combined `Duplicate & translate` action;
3. exact eligibility and hidden/locked/filter behavior for both controls;
4. production Duplicate button callback, patch ID, selection, and one history
   entry;
5. production Translate form callback, patch ID, distinct vector components,
   same-ID selection, and one history entry;
6. invalid/zero Translate callback count zero and atomic state;
7. Duplicate works independently of invalid/zero translation drafts;
8. static Duplicate produces an equal untranslated independent copy;
9. healthy linked Duplicate preserves links to the same sources;
10. stale linked Duplicate preserves links and exact frozen snapshots;
11. a source edit synchronizes both healthy linked patches before either is
    translated;
12. static Translate changes the same ID and appends nothing;
13. healthy linked Translate removes links before commit and becomes static;
14. stale linked Translate uses stored frozen preview plus delta and preserves
    frozen state;
15. source edits, deletion, repair, changed-source sync, full sync, and JSON load
    cannot move or relink a translated static patch;
16. all four boundary roles, constant/line/cubic/arc/template geometry, and
    frame-origin policy;
17. Duplicate deep-clone identity and metadata preservation;
18. Duplicate global ID collisions across strata, labels, anchors, and dangling
    source IDs;
19. repeated Duplicate uses distinct IDs and never translates;
20. repeated Translate retains one ID, applies one delta per action, and never
    appends;
21. Duplicate-only Undo/Redo;
22. direct Translate Undo restoring exact previous static/linked/stale state;
23. two-step Duplicate-then-Translate Undo/Redo ordering;
24. intermediate untranslated output and final translated Preview mesh;
25. actual translated SVG coordinates;
26. actual translated standalone TikZ coordinates;
27. actual translated inline-math TikZ coordinates;
28. generic Phase 29 patch-only and patch-plus-source duplication remain
    unchanged outside these Inspector actions;
29. ruled surfaces and other curved sheets remain unaffected;
30. save/load contains no UI draft or selection state.

Inspect assertions, not only test names/counts. Ensure the focused test remains
part of `npm test` if the script enumerates files explicitly.

Remove the four reported unused type imports from the focused test unless a new
assertion genuinely uses the type:

- `CoonsPatchPrimitive`;
- `CurvedSheetStratum`;
- `PathSegment`;
- `PointStratum`.

Targeted ESLint must finish with no Phase 30 error. Do not perform unrelated lint
cleanup.

## 9. Documentation

Update implemented documentation to describe two independent actions:

- `Duplicate` creates an untranslated copy and selects it;
- ordinary linked/stale Duplicate retains Phase 29 patch-only link semantics;
- `Translate` moves the selected same-ID patch;
- translating a linked/stale patch detaches only that patch before moving it;
- source paths, source points, and coordinate anchors are not moved;
- stale Translate uses stored frozen last-valid previews;
- each action is one transaction;
- Duplicate followed by Translate is two Undo steps;
- direct Inspector translation is global and unsnapped;
- no rotation, scale, persistent offset, or source-tree duplication exists.

At minimum, correct combined-action/one-step wording in:

- `docs/EDITING.md`;
- `docs/RULED_SURFACES.md`;
- `docs/ROADMAP.md`.

Update `docs/DATA_MODEL.md` only if its current Phase 30 wording becomes false.
Do not add a schema or version field. The existing phase slug
`coons-patch-duplicate-translate` may remain; no `run-phase.mjs` change is
required solely because the controls are separated.

Documentation must describe implemented behavior, not aspirational behavior.

## Preserve existing behavior

Do not regress:

- static and linked Coons creation;
- Phase 29 materialized-snapshot architecture;
- link synchronization and per-role reversal;
- stale fallback, recovery, detach, and source deletion;
- generic patch-only duplicate link preservation;
- patch-plus-source ID remapping;
- deterministic global ID reservation;
- coordinate-reference detachment/rejection policy;
- symbolic and frozen-preview translation;
- frame-origin versus basis/local-coordinate translation;
- layer filters, visibility, locking, and selection cleanup;
- generic bulk/layer duplicate and translation outside the new Coons controls;
- Undo/Redo and save/load;
- Preview performance and mesh caching;
- SVG and TikZ rendering from materialized snapshots;
- inline-math no-blank-lines and 4-space indentation;
- ruled surfaces and other curved-sheet kinds.

Do not resolve source strata from rendering or export. Do not introduce a
persistent linked-patch offset.

## Scope

### Implement

- separate Coons Inspector `Duplicate` and `Translate` controls;
- separate typed callbacks, production handlers, and editor-state operations;
- Phase 29-compatible untranslated Duplicate semantics;
- same-ID Translate with detach-before-translate for linked/stale patches;
- independent selection, validation, and history behavior;
- production interaction tests for both controls;
- final SVG and both TikZ coordinate regressions;
- documentation updates required by the split;
- the reported focused-test lint cleanup.

### Do not implement

- any combined production `Duplicate & translate` action;
- a new dependency or test framework;
- linked transformed patches or persistent offsets;
- duplicated source ecosystems;
- movement of source paths, points, or anchors;
- rotation, scale, shear, drag placement, or general affine transforms;
- work-plane-local Phase 30 UI;
- a general dependency graph;
- a rendering/sampling/TikZ architecture rewrite;
- a history model rewrite or selection-history persistence;
- a JSON schema/version change;
- unrelated lint or UI cleanup.

## Manual verification

If the environment permits running the app, verify:

1. select a static Coons patch;
2. click `Duplicate` with zero or invalid translation drafts present;
3. confirm one untranslated copy appears and becomes selected;
4. enter distinct non-zero `dx`, `dy`, and `dz` values;
5. click `Translate` and confirm the same selected copy moves without another
   copy appearing;
6. Undo once and confirm the unshifted copy remains;
7. Undo again and confirm the copy is removed;
8. Redo twice and confirm the exact same copy ID and translated geometry return;
9. repeat Duplicate on a healthy linked patch and confirm the copy is initially
   linked to the same sources;
10. Translate the linked copy and confirm only that copy becomes static;
11. edit a source and run synchronization; confirm the translated copy stays
    fixed while still-linked patches update;
12. repeat with a stale/missing-source patch and verify frozen last-valid
    behavior;
13. directly Translate a linked original, then Undo and confirm its links return;
14. try invalid, non-finite, unknown, and zero Translate values;
15. confirm non-Coons and non-editable selections expose neither action;
16. save/reload JSON;
17. inspect Preview, exported SVG, standalone TikZ, and inline-math TikZ.

If the local server cannot run, report the exact limitation. Do not claim manual
verification that was not performed.

## Verification

Run the focused Phase 30 test first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

If the file was renamed, use the actual focused filename and ensure `npm test`
includes it.

Run targeted lint on every Phase 30 file changed by the fix. For unchanged
legacy filenames, at minimum:

```bash
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Report exact commands, exit codes, test counts, and failures. If repository-wide
lint is run, report unrelated pre-existing debt separately; it is not a required
Phase 30 gate.

## Acceptance criteria

The Phase 30 fix is complete when:

- the production Inspector visibly exposes separate `Duplicate` and `Translate`
  actions and no combined action;
- each control is behaviorally tested through its actual production handler;
- Duplicate takes only the patch ID, ignores translation drafts, appends one
  untranslated deep copy, and selects it;
- Duplicate follows the static/healthy-linked/stale-linked state matrix;
- Translate takes patch ID plus vector, appends nothing, preserves the ID and
  selection, and translates every materialized boundary exactly once;
- Translate detaches linked/stale input before central synchronization;
- stale Translate uses exact stored frozen previews plus the delta;
- boundary sources and anchors never move;
- each action creates exactly one history entry;
- Duplicate followed by Translate has the required two-step Undo/Redo order;
- invalid/zero Translate is atomic and never rolls back a completed Duplicate;
- repeated Duplicate and repeated Translate follow their distinct ID/geometry
  policies;
- rendered/exported SVG assertions fail if the translated target uses source
  coordinates;
- standalone and inline-math TikZ assertions fail if the translated target uses
  source coordinates;
- the reported unused-import errors are gone;
- documentation describes the split accurately;
- generic Phase 29 duplication and all listed preserved behavior remain intact;
- the focused test, targeted lint, complete test suite, build, and
  `git diff --check` pass.

## Report after implementation

Please report:

- files modified or renamed;
- separate Duplicate and Translate UI locations and accessible labels;
- old combined entry points removed;
- Duplicate helper/callback/state-transition API;
- Translate helper/callback/state-transition API;
- Duplicate static/healthy-linked/stale-linked behavior;
- Translate static/healthy-linked/stale-linked behavior;
- detach-before-commit implementation;
- frozen symbolic preview handling;
- deep-clone and global ID evidence for Duplicate;
- same-ID and no-append evidence for Translate;
- distinct callback invocation and argument assertions;
- invalid/zero Translate and invalid-draft-independent Duplicate assertions;
- one-entry-per-action and two-step sequence Undo/Redo evidence;
- actual SVG coordinate assertion method;
- actual standalone and inline-math TikZ coordinate assertion method;
- whether the new tests exposed any additional production defect;
- unused imports removed or legitimately used;
- documentation updated;
- exact focused-test command/result;
- exact targeted ESLint command/result;
- exact `npm test` result;
- exact `npm run build` result;
- exact `git diff --check` result;
- manual verification performed or its exact limitation;
- remaining limitations.
