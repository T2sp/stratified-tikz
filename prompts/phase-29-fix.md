# Phase 29 Targeted Fix Prompt 7: Pre-synchronization validation of `boundarySnapshotState`

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

You are applying one narrowly targeted persistence-validation fix for Phase 29 in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Inspect the actual current working tree before editing. Review line numbers may have moved.

Read at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- all earlier Phase 29 fix prompts present in the repository;
- `src/model/serialization.ts`;
- `src/model/coonsPatchLinks.ts`;
- `src/model/validation.ts`;
- `src/model/types.ts`;
- `src/model/symbolicCoordinates.ts`;
- the normal saved-diagram parsing path;
- the symbolic/pending-import parsing and resolution paths;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- existing serialization and malformed-JSON tests.

Search for every read, write, normalization, deletion, or overwrite of:

```text
boundarySnapshotState
```

Also inspect all callers of:

- `synchronizeLinkedCoonsPatches`;
- `parseSavedDiagramJson`;
- `parseSavedDiagramJsonForImport`;
- `resolvePendingSymbolicDiagramImport`;
- final diagram validation helpers.

## Verified review finding

Malformed linked `boundarySnapshotState` values can bypass JSON validation.

The valid runtime domain is:

```ts
undefined | 'frozen'
```

However, parsing currently performs linked-Coons synchronization before final validation.

For a linked patch with valid sources, synchronization removes a non-`undefined` state after successful refresh.

For a linked patch with stale or missing sources, synchronization overwrites the state with `'frozen'`.

Therefore malformed input such as:

```json
{
  "boundarySnapshotState": "thawed"
}
```

is erased or repaired before the validator sees it.

Verified outcomes:

- linked patch with valid sources and `"thawed"` loads successfully;
- linked patch with missing/stale sources and `"thawed"` also loads successfully;
- the existing malformed-state regression covers only a static patch because it removes `boundarySources`.

Untrusted JSON must be rejected, not repaired by synchronization.

## Goal

Validate `boundarySnapshotState` before any linked-Coons synchronization or symbolic refresh step can erase or overwrite it.

After the fix:

- only an absent value or the exact string `"frozen"` is accepted;
- `"thawed"`, `null`, booleans, numbers, arrays, objects, empty strings, and every other value are rejected;
- malformed linked metadata returns the repository’s normal parse/import failure result;
- malformed input does not throw;
- synchronization does not silently normalize an invalid state when called directly;
- valid linked, stale, symbolic, static, and legacy diagrams keep their current behavior;
- no rendering, history, sampling, export, or Coons geometry behavior changes.

## Required implementation

### 1. Add or reuse one canonical runtime validator

Use one pure helper for the field’s runtime domain.

Conceptually:

```ts
export function isValidCoonsBoundarySnapshotState(
  value: unknown,
): value is undefined | 'frozen' {
  return value === undefined || value === 'frozen'
}
```

The exact name and module should follow repository conventions.

Requirements:

- accept only `undefined` or exactly `'frozen'`;
- do not coerce values;
- do not treat `null` as absent;
- do not trim or normalize strings;
- reuse this helper in pre-synchronization parsing checks and defensive synchronization checks;
- avoid duplicated string comparisons spread across serialization and synchronization code.

If an equivalent validator already exists, reuse or extract it rather than adding a second implementation.

### 2. Perform a narrow pre-synchronization validation pass

Validate every Coons primitive’s `boundarySnapshotState` immediately after decoding untrusted JSON and before any operation that can:

- synchronize linked Coons patches;
- delete `boundarySnapshotState`;
- overwrite it with `'frozen'`;
- refresh symbolic previews in a way that rebuilds the primitive;
- otherwise normalize away the malformed value.

Apply this to the normal save/load path and every symbolic import path.

At minimum, cover:

- `parseSavedDiagramJson`;
- `parseSavedDiagramJsonForImport`;
- `resolvePendingSymbolicDiagramImport`, where the pending object can reach synchronization or finalization.

The preflight should inspect all strata and reject an invalid field whether the Coons patch is:

- linked with valid sources;
- linked with stale or missing sources;
- static;
- legacy except for the newly supplied malformed field.

A suitable API is:

```ts
type CoonsSnapshotStatePreflightResult =
  | { ok: true }
  | {
      ok: false
      error: string
      stratumId?: string
    }

function validateCoonsBoundarySnapshotStatesBeforeSynchronization(
  diagramLike: unknown,
): CoonsSnapshotStatePreflightResult
```

Adapt to the existing parsed-diagram types and error conventions.

### 3. Keep this preflight narrow

Do not simply move full `validateDiagram` ahead of synchronization.

Legitimate linked stale diagrams may require the existing load sequence to:

- preserve saved frozen snapshots;
- refresh source symbolic previews;
- attempt atomic synchronization;
- retain fallback snapshots when synchronization fails;
- then pass final validation.

The new early pass should validate only data that synchronization itself can erase or overwrite before final validation, especially `boundarySnapshotState`.

Do not weaken or bypass final diagram validation.

The normal sequence should remain conceptually:

```text
JSON decode
-> narrow structural preflight for boundarySnapshotState
-> existing symbolic/source preparation
-> linked Coons synchronization
-> existing final full validation
-> success/failure result
```

If current parsing has an earlier structural metadata preflight for `boundarySources`, extend that mechanism coherently rather than creating a disconnected path.

### 4. Make synchronization defensive

Even though parser preflight should reject malformed JSON, `synchronizeLinkedCoonsPatches` must not erase or overwrite an invalid runtime value when called directly on an untrusted or manually constructed object.

Before either:

- clearing the state after a successful refresh; or
- assigning `'frozen'` after a failed refresh;

check the current value with the canonical validator.

For an invalid value:

- do not throw;
- do not delete it;
- do not overwrite it;
- do not claim a successful repair;
- preserve the input patch unchanged;
- return an explicit synchronization issue or other existing safe failure signal.

A suitable issue shape is conceptually:

```ts
{
  kind: 'invalidBoundarySnapshotState',
  patchId,
  value
}
```

Do not persist arbitrary malformed values into a newly created valid model state.

If the synchronizer’s current result type cannot expose this cleanly, make the smallest typed extension needed.

The parser must still reject the diagram before relying on this defensive branch.

### 5. Preserve valid state transitions

Keep the intended valid behavior:

- `undefined` on an up-to-date linked patch is valid;
- `'frozen'` on a stale linked patch is valid;
- successful atomic synchronization may clear `'frozen'` according to the current Phase 29 policy;
- failed synchronization may set `'frozen'` when the incoming state is valid;
- static and legacy patches keep their existing semantics;
- detach keeps the current exact materialized snapshots and removes only link metadata according to the existing implementation.

Do not change the stale fallback model introduced by prior Phase 29 fixes.

### 6. Error handling

Use the existing serialization/import error-result conventions.

Requirements:

- normal JSON parsing returns `{ ok: false, ... }` or the repository-equivalent failure result;
- symbolic import parsing returns its normal failure form rather than a pending/success result;
- pending symbolic resolution returns its normal failure form;
- no `TypeError`, assertion failure, or uncaught exception;
- error text should identify `boundarySnapshotState` and the allowed value;
- include the stratum/primitive location where current validation errors normally do so.

Do not expose a repaired diagram for malformed input.

## Regression tests

Extend `tests/integration/phase29LinkedCoonsPatches.test.ts` and any focused serialization test file that matches repository conventions.

Use the exact malformed value:

```json
"boundarySnapshotState": "thawed"
```

### 1. Linked patch with valid sources

Create valid linked Coons JSON with all four sources resolvable and valid.

Inject:

```json
"boundarySnapshotState": "thawed"
```

Assert:

- `parseSavedDiagramJson` returns failure;
- the failure mentions `boundarySnapshotState`;
- no exception is thrown;
- synchronization does not get a chance to erase the value and produce success.

This specifically covers the successful-refresh branch that previously deleted the malformed state.

### 2. Linked patch with stale or missing source

Create valid loadable linked Coons JSON with one dangling/missing source and valid saved fallback snapshots.

Inject `"thawed"`.

Assert:

- `parseSavedDiagramJson` returns failure;
- no exception is thrown;
- the malformed value is not overwritten with `'frozen'`;
- the parser does not return a stale-but-successful diagram.

This specifically covers the stale branch that previously replaced the malformed value.

### 3. Pending symbolic import

Create JSON that follows the pending symbolic import path, with linked Coons metadata and:

```json
"boundarySnapshotState": "thawed"
```

Assert the earliest applicable API rejects it.

Cover the production path actually used by the application:

- `parseSavedDiagramJsonForImport`;
- and, if a pending object can be externally or manually constructed/mutated, `resolvePendingSymbolicDiagramImport`.

The test must prove malformed state cannot survive until synchronization and be erased there.

### 4. Defensive direct synchronization

Construct a diagram-like value containing a linked Coons primitive with `"thawed"` and call the synchronization helper directly, using the narrowest safe type escape required by the test.

Assert:

- synchronization does not throw;
- it reports an invalid-state issue or equivalent failure;
- it does not delete the field;
- it does not replace it with `'frozen'`;
- it does not otherwise rewrite that patch into a valid-looking model.

Do not weaken production types merely to make this test easy.

### 5. Accepted linked valid state

Verify a linked patch with:

```text
boundarySnapshotState absent
```

and valid sources still loads and synchronizes normally.

### 6. Accepted linked frozen state

Verify a linked stale patch with:

```json
"boundarySnapshotState": "frozen"
```

still loads, preserves its exact saved fallback snapshots, and reports stale status.

Where sources are repaired, verify successful synchronization and the current intended clearing of `'frozen'`.

### 7. Static malformed state

Keep the existing static-patch malformed-state regression.

It should continue to reject `"thawed"`.

### 8. Additional invalid values

Add a compact table-driven unit test for representative invalid values where practical:

```text
null
false
0
""
"THAWED"
[]
{}
```

The three linked-path regressions above must still use `"thawed"` explicitly.

### 9. Preserve previous Phase 29 regressions

Keep passing coverage for:

- exact symbolic/provenance preservation in stale snapshots;
- stale save/load;
- equal-valued symbolic expression synchronization;
- source deletion and corner mismatch;
- automatic recovery;
- same-ID replacement-document loading;
- malformed `boundarySources`;
- dangling source-ID reservation;
- Variable Manager allocation;
- source-aware layer and bulk duplication;
- detach;
- Undo/Redo;
- TikZ and SVG snapshot-based export;
- static and legacy patches.

## Scope constraints

Do not:

- redesign Phase 29;
- change the Coons formula or sampler;
- change sampling, Preview, SVG, or TikZ behavior;
- change history or drag coalescing;
- weaken final validation;
- silently coerce malformed JSON;
- normalize `"thawed"` to `'frozen'` or `undefined`;
- add a general schema-validation dependency;
- change JSON version;
- alter `boundarySources`;
- modify duplication, ID allocation, or symbolic fallback behavior unless a regression proves this narrow fix requires it;
- perform unrelated UI or documentation cleanup;
- add dependencies.

Keep the production diff focused on:

- one canonical state validator;
- pre-synchronization validation in normal and symbolic import paths;
- defensive synchronization behavior;
- targeted regressions.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
git diff main --check
```

Also run every focused serialization or symbolic-import test file modified by this fix.

Perform read-only probes for:

```text
linked valid sources + boundarySnapshotState="thawed"
linked missing source + boundarySnapshotState="thawed"
pending symbolic import + boundarySnapshotState="thawed"
```

Report the returned result and confirm that none throws.

If the local dev server cannot bind because the sandbox denies `listen`, report that limitation accurately. Do not claim browser verification was performed.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- `boundarySnapshotState` is validated before linked synchronization in normal loading;
- it is validated before linked synchronization in symbolic/pending import paths;
- only `undefined` and exactly `'frozen'` are accepted;
- valid-source linked JSON with `"thawed"` is rejected;
- stale-source linked JSON with `"thawed"` is rejected;
- pending symbolic import with `"thawed"` is rejected;
- synchronization cannot erase or overwrite malformed state into a valid-looking primitive;
- malformed input returns normal failure results without throwing;
- valid absent and `'frozen'` states preserve all existing Phase 29 behavior;
- final full model validation remains enabled;
- all prior Phase 29 regressions pass;
- focused tests, the full suite, build, and all diff checks pass.

## Report after implementation

Report:

- files modified;
- root cause of the validation bypass;
- canonical validator added or reused;
- exact pre-synchronization validation call sites;
- normal load ordering after the fix;
- symbolic/pending import ordering after the fix;
- defensive synchronization behavior;
- accepted and rejected values;
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
