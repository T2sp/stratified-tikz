# Phase 29 Targeted Fix Prompt 10: Behavioral UI/drag coverage and documentation corrections

## Environment

Work on the current Phase 29 branch.

Do not merge into or modify `main`.

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase29LinkedCoonsPatches.test.ts \
  tests/rendering/phase29CoonsPreviewPerformance.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

git diff --check
git diff --cached --check
git diff 1faa43f --check
```

Run lint only if the repository is already established as repository-wide lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies.

## Project context

You are closing the remaining Phase 29 verification gap in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

No runtime correctness defect was reproduced by the latest review.

The remaining Medium issue is a behavioral coverage gap:

- the Coons creation checkbox is only verified by source-text matching;
- the test suite does not exercise linked/static creation through the production UI wiring;
- the test suite does not exercise a linked boundary through multiple transient geometry-handle drag updates;
- existing model-level Undo/Redo coverage does not prove that the production drag transaction updates the patch live and commits exactly one history entry.

The current implementation appears correctly wired. The task is to add meaningful behavioral regression coverage and correct two documentation statements.

Do not change synchronization semantics unless a minimal, behavior-preserving test seam is necessary.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- all prior Phase 29 fix prompts present in the repository;
- `src/App.tsx`, especially:
  - Coons creation draft state;
  - `Keep linked to boundary sources`;
  - the Add sheet > Coons create action;
  - geometry-handle pointer-down, pointer-move, pointer-up, and cancel paths;
  - transient diagram updates;
  - drag commit and history coalescing;
- `src/ui/geometryHandles.ts`;
- `src/ui/undo.ts`;
- `src/ui/ruledSurface.ts`;
- linked-Coons synchronization helpers;
- SVG Preview preparation/rendering helpers used during transient drag;
- existing generic geometry-handle drag tests;
- existing Add sheet / Coons UI tests;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- `tests/rendering/phase29CoonsPreviewPerformance.test.ts`;
- any existing App, component, UI-controller, pointer-event, or interaction test harness;
- `docs/RULED_SURFACES.md`;
- `docs/SPEC.md`;
- `package.json`, including the explicit `npm test` file list.

Search for:

- the linked-by-default checkbox state;
- the checkbox `onChange` handler;
- `createCoonsPatchFromBoundaryPaths`;
- `keepLinked`, `boundarySources`, or equivalent names;
- geometry-handle drag session state;
- transient preview diagram state;
- `undoSourceDiagram`;
- drag coalescing/commit helpers;
- pointer capture and release;
- `commitDiagramChange`;
- preview mesh extraction during drag.

## Verified review finding

### Medium: linked creation and transient drag lack behavioral regression coverage

The current Phase 29 UI test matches source text but does not interact with the application.

It would still pass if, for example:

- the checkbox default changed from checked to unchecked;
- the checkbox stopped controlling creation;
- linked creation always produced a static patch;
- clearing the checkbox had no effect;
- transient drag stopped synchronizing the linked Coons patch;
- the patch updated only on pointer-up rather than on pointer-move;
- each pointer-move created a separate Undo entry;
- Undo restored the source but not the patch;
- Redo restored the patch but not the source.

These behaviors must be exercised through the same production handlers/state transitions used by the editor.

## Goal

Add focused behavioral coverage proving that:

1. Add sheet > Coons defaults to linked creation.
2. Clearing the checkbox creates a static snapshot-only Coons patch.
3. A linked boundary edited through multiple transient geometry-handle drag updates refreshes the Coons patch during the drag.
4. The complete drag is committed as exactly one Undo/Redo transaction.
5. Undo and Redo restore both the source geometry and dependent Coons snapshots coherently.
6. Existing Phase 29 performance and correctness behavior remains unchanged.

Also correct the Coons boundary/reversal description in `docs/RULED_SURFACES.md` and the linked/frozen symbolic-refresh description in `docs/SPEC.md`.

## Test strategy

### Use production behavior, not source-text assertions

The new regression must invoke the production creation and drag behavior.

Preferred order:

1. Use an existing React/component/UI interaction test harness if one already exists.
2. Otherwise, exercise an existing App controller/reducer/state-machine abstraction used by `App.tsx`.
3. If production interaction logic is currently trapped inside the component, extract the smallest pure, typed helper needed to drive the same state transitions in tests.

A helper extraction is acceptable only when:

- `App.tsx` calls the extracted helper in production;
- the test calls the same helper;
- no behavior is duplicated in a test-only implementation;
- the extraction does not redesign editor state or Phase 29 synchronization.

Do not satisfy this task by:

- reading source code as text;
- invoking only `createCoonsPatchFromBoundaryPaths` directly;
- invoking only a completed model update with no transient drag state;
- manually constructing the final history entry;
- asserting only that a label exists;
- adding a fake UI implementation used only by tests.

Do not add a new browser or testing dependency.

A small stable test identifier or accessible label improvement is acceptable if needed for an existing interaction harness and if it does not alter behavior.

## Behavioral regression 1: checkbox defaults to linked

Exercise the production Add sheet > Coons workflow.

Set up four compatible boundaries using supported production state.

Open or select the Add sheet > Coons creation controls.

Assert behaviorally:

- the `Keep linked to boundary sources` checkbox is checked by default;
- the associated draft value is true;
- creating the patch through the production create action succeeds;
- the resulting Coons primitive contains all four `boundarySources`;
- each role has the expected source kind and source ID;
- any selected path reversal is retained;
- the materialized snapshots are valid;
- the new patch is linked/up to date;
- the patch ID, layer, sampling, and style follow existing creation behavior.

Do not rely only on the checkbox DOM property. Verify the created model.

If the test starts from a fresh Coons creation session, verify the actual default rather than explicitly setting the value to true.

## Behavioral regression 2: clearing the checkbox creates a static patch

Start another production Coons creation session.

Interact with the real checkbox to clear it.

Assert:

- the checkbox/draft state becomes false;
- creating through the same production action succeeds;
- the resulting Coons primitive omits `boundarySources`;
- the materialized `bottom`, `right`, `top`, and `left` snapshots are still present and valid;
- link status is static;
- subsequent edits to former source paths do not update the static patch;
- existing source paths are not modified;
- role orientation used for initial snapshot creation remains correct.

Where the production workflow resets the option after creation or cancellation, test the intended existing reset behavior without inventing a new requirement.

## Behavioral regression 3: transient linked-source geometry-handle drag

Create a valid linked Coons patch through the production creation behavior or through a fixture whose subsequent drag enters the production App drag path.

Choose a linked path boundary with a draggable geometry handle.

Use the same pointer/geometry-handle workflow as the editor:

```text
pointer down / begin drag
pointer move 1
pointer move 2
pointer move 3
pointer up / commit drag
```

Use at least three distinct move positions.

### Assertions after drag start

Assert:

- one drag session is active;
- the source diagram used for Undo is captured once;
- no committed history entry is added merely by pointer-down;
- the linked patch still has the same ID and `boundarySources`.

### Assertions after every pointer move

After each individual pointer update, before pointer-up, assert:

- the source boundary geometry reflects that move;
- the corresponding materialized Coons boundary snapshot reflects the same current source geometry;
- the patch is not one move behind;
- role-specific `reversed` orientation remains correct;
- all four boundaries still form a valid candidate;
- the sampled Coons mesh or isolated Preview surface geometry changes consistently with the current move;
- the transient Preview uses the current materialized patch snapshots;
- no render-time source lookup is introduced;
- the patch remains linked/up to date;
- no separate Undo entry is committed for that move.

Do not assert only the final pointer position.

Compare actual boundary/surface geometry at each step.

A suitable check is to inspect:

- the moved source control/vertex;
- the refreshed role snapshot;
- one or more sampled mesh vertices affected by the move;
- or the isolated prepared SVG surface scene for the patch.

Avoid whole-diagram SVG comparisons where unrelated cursor/selection output could satisfy the assertion.

### Assertions on pointer-up

After completing the drag, assert:

- the final source geometry equals the last transient position;
- the final materialized Coons snapshot equals the last transient synchronized geometry;
- the Preview geometry does not jump backward or forward on commit;
- the drag produces exactly one committed history transaction;
- no extra history entry is created solely by Coons synchronization;
- the drag session is cleared;
- any pointer capture/session cleanup follows existing behavior.

## Undo/Redo regression for the drag

Immediately after the committed drag:

### Undo once

Assert one Undo restores:

- the source boundary geometry from before pointer-down;
- all four Coons materialized snapshots from before pointer-down;
- sampled/Preview Coons geometry from before pointer-down;
- link metadata and reversal;
- linked/up-to-date status.

It must not require one Undo for the source and a second Undo for the patch.

### Redo once

Assert one Redo restores:

- the final source geometry;
- the final Coons snapshots;
- final sampled/Preview geometry;
- link metadata and reversal;
- linked/up-to-date status.

Repeated Undo/Redo must not drift geometry, snapshot provenance, or history length.

## Optional but valuable drag cases

Add these only if they fit naturally into the existing harness without broadening the task excessively:

- drag cancellation restores both source and patch without adding history;
- a reversed boundary follows live drag with the reversed snapshot direction;
- a constant-point source drag updates its linked constant-point boundary live;
- a temporarily invalid pointer position preserves the last-valid fallback during that move, followed by recovery on a later valid move in the same drag.

The required test is the valid multi-move path-boundary drag.

## Performance-preservation assertions

The latest Phase 29 branch includes Preview-performance work.

The new behavioral test must not force a regression in that architecture.

Where the existing deterministic instrumentation supports it, assert during the multi-move drag:

- each changed materialized Coons primitive is sampled no more than once per required Preview preparation state;
- unchanged curved sheets are not resampled;
- Inspector status does not perform full mesh sampling;
- synchronization does not sample both previous and next candidates redundantly;
- selection-only state does not invalidate world-space surface geometry.

Do not introduce fragile timing thresholds.

Do not weaken or delete `phase29CoonsPreviewPerformance` tests.

## Production changes

This task is primarily tests and documentation.

Do not change production behavior unless necessary to expose a small testable interaction seam.

Any production extraction must:

- preserve current checkbox defaults;
- preserve current creation behavior;
- preserve the same drag ordering;
- preserve transient live synchronization;
- preserve one-step Undo/Redo;
- preserve pointer-session cleanup;
- preserve rendering and caching;
- remain typed and pure where practical;
- avoid a broad App-state refactor.

If the behavioral test reveals an actual failure, fix only that verified failure and document it in the implementation report.

Do not proactively rewrite synchronization.

## Documentation: `docs/RULED_SURFACES.md`

Correct the Coons creation and reversal wording.

The revised text must state that:

- Coons patches use four boundary roles:
  - `bottom`;
  - `right`;
  - `top`;
  - `left`;
- supported role sources include open boundary paths and supported constant-point boundaries;
- all four selected boundaries must satisfy the existing Coons corner equations;
- path boundaries may be reversed per role;
- reversal does not mutate the original source path;
- for a static patch, reversal determines the initial copied snapshot orientation;
- for a linked patch, the stored `reversed` flag is reapplied on every successful source refresh;
- constant-point boundaries do not need path reversal;
- linked patches retain materialized snapshots and stale fallback semantics.

Do not imply that every role must always be a path.

Do not imply reversal is applied only once for linked patches.

Keep ruled surfaces themselves snapshot-only.

## Documentation: `docs/SPEC.md`

Correct the statement that symbolic refresh covers all Coons snapshots.

The revised text must distinguish:

- ruled-surface snapshots, which retain their existing symbolic refresh/import behavior;
- static Coons snapshots, which retain their existing snapshot behavior;
- linked Coons source paths/points, which are active symbolic dependencies;
- linked/frozen materialized Coons snapshots, which are not independently refreshed;
- successful linked synchronization, which atomically replaces materialized snapshots from the refreshed sources;
- failed synchronization, which preserves exact last-valid frozen snapshots;
- frozen-only symbolic expressions, which do not create UI import variable requirements under the Phase 29 rule.

Keep the wording consistent with:

```text
docs/SYMBOLIC_INPUT_AND_GRIDS.md
docs/DATA_MODEL.md
docs/RULED_SURFACES.md
```

Do not duplicate large sections unnecessarily.

## Required tests

At minimum, add or update tests covering:

1. Production Coons checkbox default is linked.
2. Production checkbox toggle to static affects the created model.
3. Linked creation contains all four source roles.
4. Static creation omits source metadata.
5. Multiple transient linked-source drag updates refresh the patch after every move.
6. Preview/sampled geometry follows every move.
7. Pointer-up commits exactly one history transaction.
8. One Undo restores source and patch.
9. One Redo restores source and patch.
10. Repeated Undo/Redo does not drift.
11. Existing performance call-count tests remain passing.
12. Documentation no longer contains the contradicted statements.

Prefer placing the behavioral coverage in:

```text
tests/integration/phase29LinkedCoonsPatches.test.ts
```

or a new focused file such as:

```text
tests/integration/phase29LinkedCoonsUiBehavior.test.ts
```

Use a new file if it keeps the interaction harness and setup clearer.

If `npm test` enumerates test files explicitly, add the file to the script.

## Preserve existing behavior

Do not regress:

- linked-by-default creation;
- explicit static creation;
- path and point boundary sources;
- per-role reversal;
- exact stale snapshots;
- stale recovery;
- detach;
- malformed metadata rejection;
- symbolic/provenance behavior;
- frozen symbolic UI import;
- source-ID reservation;
- duplication remapping;
- linked status;
- non-sampling status and unchanged-source fast paths;
- Preview caching and surface preparation;
- SVG and TikZ export;
- inline-math formatting;
- 4-space TikZ indentation;
- legacy static Coons patches;
- ruled surfaces.

## Scope constraints

Do not:

- redesign Phase 29;
- change synchronization semantics without a reproduced test failure;
- merge Phase 29 into `main`;
- add a browser/testing dependency;
- replace behavioral tests with source-text checks;
- test only direct model creation;
- test only the final drag result;
- create one history entry per pointer move;
- delay linked refresh until pointer-up;
- move source resolution into rendering;
- change the Coons formula or sampling;
- lower Preview quality;
- weaken validation;
- alter JSON schema/version;
- perform unrelated UI cleanup;
- add dependencies.

Keep the diff focused on:

- behavioral UI/interaction coverage;
- a minimal test seam if required;
- two documentation corrections;
- any actual failure exposed by the new regression.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase29LinkedCoonsPatches.test.ts \
  tests/rendering/phase29CoonsPreviewPerformance.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

git diff --check
git diff --cached --check
git diff 1faa43f --check
```

Also run the new focused UI/drag test file directly if one is added.

If an existing component test command differs from `node --test`, run and report it.

## Manual verification

When a browser is available, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Verify:

1. Open a 3D diagram.
2. Choose Add sheet > Coons.
3. Confirm `Keep linked to boundary sources` is checked.
4. Create a linked patch.
5. Drag a linked boundary handle through several visible positions.
6. Confirm the patch follows continuously, not only after release.
7. Undo once and Redo once.
8. Create another patch with the checkbox cleared.
9. Edit its former source and confirm the static patch does not follow.

If the sandbox cannot bind a local server, report the exact `listen EPERM` limitation and do not claim manual verification.

The automated behavioral tests are still required.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- the test suite behaviorally proves linked-by-default creation;
- clearing the production checkbox behaviorally creates a static patch;
- tests invoke the same creation state/handler used by `App.tsx`;
- a linked boundary is driven through at least three transient pointer updates;
- the Coons snapshots and Preview geometry follow every update;
- pointer-up creates exactly one history transaction;
- one Undo and one Redo restore both source and patch;
- no source-text-only assertion is used as the primary proof;
- no synchronization or rendering regression is introduced;
- `docs/RULED_SURFACES.md` documents path and constant-point boundaries plus persistent linked reversal;
- `docs/SPEC.md` documents the linked/frozen symbolic-refresh exception;
- focused tests, full tests, build, and all diff checks pass.

## Report after implementation

Report:

- files modified;
- interaction test harness used;
- whether a production test seam was extracted;
- how the test invokes the real checkbox state and create action;
- linked-default creation result;
- static-toggle creation result;
- drag event/state sequence exercised;
- number of transient pointer updates;
- geometry assertions made after each update;
- Preview/sampling assertions made;
- history length before, during, and after drag;
- Undo/Redo behavior;
- any runtime defect exposed and fixed;
- performance tests preserved;
- documentation changes;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- `git diff 1faa43f --check` result;
- manual browser verification performed or the exact reason it was unavailable;
- remaining known limitations.
