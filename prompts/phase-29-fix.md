# Phase 29 Targeted Fix Prompt 4: Variable ID allocation and linked-Coons documentation

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts tests/model/diagramIds.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
```

Run lint only if the repository is already established as repository-wide lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies.

## Project context

You are applying one narrowly targeted Phase 29 correctness fix in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Review the actual current working tree before editing. Line numbers from the review may have moved.

Read at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- prior Phase 29 fix prompts present in the repository;
- `src/ui/VariableManager.tsx`;
- `src/model/diagramIds.ts`;
- `src/model/variables.ts`;
- the Coons boundary-source types in `src/model/types.ts`;
- the JSON parsing/loading helpers;
- `tests/model/diagramIds.test.ts`;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- any existing Variable Manager or symbolic-variable tests;
- `docs/DATA_MODEL.md`.

Search for all variable-ID allocation paths and all callers of:

- `collectTopLevelDiagramIds`;
- `nextVariableId`;
- `addSymbolicVariableToDiagram`;
- `makeUniqueId`.

## Verified review finding

Phase 29 now reserves dangling Coons boundary-source IDs through the shared top-level diagram ID collector.

However, the in-app Variable Manager still has its own ID allocator. Its `nextVariableId()` builds a set from current variables, strata, and labels instead of using the shared reserved-ID collector.

Verified failure:

1. A linked Coons patch retains a dangling boundary source ID `variable-1`.
2. No symbolic variable currently uses `variable-1`.
3. The user clicks `Add variable`.
4. Variable Manager allocates `variable-1`.
5. The variable insertion accepts that ID.

This violates the Phase 29 identity-reservation rule. A source ID retained by `boundarySources` must remain reserved even while its source stratum is missing.

There is also one contradictory sentence in `docs/DATA_MODEL.md` that still describes both ruled surfaces and Coons patches as non-live copied snapshots.

## Goal

Fix only the remaining ID-allocation gap and documentation contradiction.

After the fix:

- Variable Manager uses the same shared reserved top-level ID set as other element-creation paths;
- `Add variable` cannot reuse any dangling `sourcePathId` or `sourcePointId` retained by a linked Coons patch;
- loaded diagrams receive the same protection before any new variable is added;
- ordinary variable allocation remains deterministic;
- existing linked-Coons synchronization, fallback, history, rendering, export, and serialization behavior is unchanged;
- the data-model documentation accurately distinguishes ruled surfaces from optionally linked Coons patches.

## Required implementation

### 1. Use the shared reserved ID collector

Update Variable Manager’s variable-ID allocation to use the existing shared collector from `src/model/diagramIds.ts`.

Conceptually:

```ts
import { collectTopLevelDiagramIds } from '../model/diagramIds.ts'

function nextVariableId(diagram: Diagram): string {
  const usedIds = collectTopLevelDiagramIds(diagram)

  let index = (diagram.variables ?? []).length + 1
  while (usedIds.has(`variable-${index}`)) {
    index += 1
  }

  return `variable-${index}`
}
```

Adapt names and location to current repository conventions.

Requirements:

- do not maintain a second hand-written list of diagram entity IDs in `VariableManager.tsx`;
- use the collector that already includes:
  - ordinary top-level IDs;
  - variables;
  - coordinate anchors and other existing reserved top-level entities;
  - dangling linked Coons `sourcePathId` values;
  - dangling linked Coons `sourcePointId` values;
- preserve the current deterministic `variable-N` naming policy unless a minimal helper extraction naturally improves it;
- preserve global top-level ID uniqueness across entity kinds;
- keep malformed-link handling defensive through the shared collector;
- do not introduce a persistent tombstone registry;
- do not detach, rewrite, or automatically relink Coons boundary sources;
- do not alter `boundarySources` metadata.

If `nextVariableId` is difficult to test while private inside the React component, extract the allocation into a small pure helper in an appropriate existing utility/model module, or export a narrowly scoped helper.

Do not add a UI testing dependency solely for this fix.

### 2. Check for other variable allocator bypasses

Search the repository for any other code path that generates IDs for new symbolic variables.

All normal creation paths must use the shared reserved-ID semantics.

Do not perform a broad ID-system refactor. Change only real bypasses found during the search.

Do not change validation or synchronization code unless a focused test proves a necessary issue directly related to this allocator gap.

### 3. Correct `docs/DATA_MODEL.md`

Find the remaining paragraph that says ruled surfaces and Coons patches are both copied snapshots that are “not live references to source path strata.”

Replace it with wording that reflects the Phase 29 model accurately.

The revised text should clearly state:

- ruled surfaces remain snapshot-only;
- every Coons patch retains materialized boundary snapshots used by sampling, Preview, SVG export, and TikZ export;
- a Coons patch may additionally store optional `boundarySources`;
- linked Coons snapshots are refreshed atomically after valid source changes;
- static/legacy Coons patches without `boundarySources` do not follow source edits;
- stale or missing linked sources retain the last valid materialized snapshots.

A suitable wording is:

```markdown
Ruled surfaces remain snapshot-only and are not live references to source path
strata. Coons patches also retain materialized boundary snapshots, but Phase 29
allows them to store optional `boundarySources`. When those links are present,
valid source changes atomically refresh the materialized snapshots; missing or
invalid sources leave the last valid snapshots in place. Coons patches without
`boundarySources` remain static.
```

Adjust the paragraph to fit the surrounding prose and avoid duplicating a nearby explanation.

## Regression tests

Add focused coverage for the actual UI allocation path or its extracted pure helper.

### Required regression: loaded dangling `variable-1`

Construct or load a valid diagram containing:

- a linked Coons patch;
- structurally valid `boundarySources`;
- a missing path or point source whose retained source ID is exactly `variable-1`;
- no existing symbolic variable with ID `variable-1`;
- valid last-known materialized Coons snapshots.

Then exercise the same allocator used by Variable Manager’s `Add variable`.

Assert:

1. `collectTopLevelDiagramIds(diagram)` contains `variable-1`;
2. the next generated variable ID is not `variable-1`;
3. under the current deterministic policy, it is the expected next available `variable-N`;
4. adding the variable succeeds;
5. the linked Coons patch still retains its original dangling source ID;
6. the patch remains stale rather than being considered linked to the new variable;
7. the materialized fallback snapshots remain unchanged.

The regression should include the load/parse path, not only a manually assembled in-memory diagram, because the review specifically requires protection for loaded linked metadata.

### Ordinary allocation regression

Verify that an ordinary diagram with no collision or reserved dangling ID still allocates the expected first available `variable-N`.

### Cross-kind reservation regression

Where practical, verify that variable allocation respects a reserved Coons source ID even though the eventual new entity is a symbolic variable rather than a path or point.

This is intentional because top-level IDs are globally unique.

### Existing tests

Keep all prior Phase 29 and ID tests passing, including:

- dangling point/path source IDs collected by the shared helper;
- source deletion followed by normal point creation;
- loaded dangling IDs;
- symbolic stale save/load/recovery;
- malformed link metadata;
- same-ID replacement-document load;
- stale fallback protection during transforms;
- detach;
- duplication/remapping;
- one-step Undo/Redo;
- static and legacy Coons behavior.

If there is an existing Variable Manager test file, place the focused allocator regression there. Otherwise, add the smallest appropriately named model/UI utility test without introducing new dependencies.

## Scope constraints

Do not:

- change Coons synchronization;
- change stale fallback behavior;
- change rendering, SVG export, or TikZ export;
- change undo/redo behavior;
- change JSON schema or version;
- change linked-Coons creation defaults;
- change duplication/remapping;
- change ruled surfaces;
- add automatic source recovery or relinking;
- redesign all ID generation;
- add dependencies;
- perform unrelated UI cleanup.

Keep the diff small and targeted.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts tests/model/diagramIds.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
```

Also run the focused Variable Manager or variable-ID test file added or modified by this fix.

If the local development server cannot start because the sandbox denies `listen`, report that limitation accurately. Do not claim browser verification was performed.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- Variable Manager no longer builds its own incomplete used-ID set;
- its Add variable path uses the shared reserved diagram ID collector;
- a loaded dangling Coons source ID `variable-1` cannot be reused by a newly added variable;
- normal variable allocation remains deterministic;
- linked Coons metadata and stale fallback geometry remain unchanged by variable creation;
- `docs/DATA_MODEL.md` no longer implies that all Coons patches are permanently static;
- synchronization, history, save/load, Preview, SVG, and TikZ behavior are unchanged;
- focused tests, the full suite, build, `git diff --check`, and `git diff --cached --check` pass.

## Report after implementation

Report:

- files modified;
- root cause of the allocator bypass;
- whether `nextVariableId` was updated in place or extracted;
- how the shared reserved ID set is now used;
- other variable-ID generation paths inspected;
- regression tests added or updated;
- documentation wording changed;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- manual verification performed or the exact reason it was unavailable;
- remaining known limitations.
