# Phase 29 Fix Prompt: Preserve last-valid Coons snapshots and harden linked metadata parsing

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies.
Do not discard, reset, or rewrite the current unstaged Phase 29 implementation.
Make targeted fixes on top of the current working tree.
Do not commit unless the outer workflow explicitly requests it.

## Project context

You are fixing the current Phase 29 implementation in StratifiedTikZ.

Phase 29 adds optional live-linked source boundaries to Coons patches while retaining materialized `bottom`, `right`, `top`, and `left` snapshots as the geometry used by sampling, SVG Preview, SVG export, and TikZ export.

Read before editing:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- the current unstaged Phase 29 diff against `1faa43f`;
- `src/model/coonsPatchLinks.ts`;
- `src/model/serialization.ts`;
- `src/model/translation.ts`;
- the Coons primitive validation and clone helpers;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- `docs/DATA_MODEL.md`.

Inspect the working tree first:

```bash
git status --short
git diff --stat
git diff -- src/model/coonsPatchLinks.ts
git diff -- src/model/serialization.ts
git diff -- src/model/translation.ts
git diff -- tests/integration/phase29LinkedCoonsPatches.test.ts
git diff -- docs/DATA_MODEL.md
```

## Review result

The Phase 29 review reported:

- no Critical issues;
- two Medium correctness issues;
- one Low-priority documentation issue;
- focused Phase 29 tests passed `15/15`;
- the full suite passed `1976/1976`;
- build passed;
- `git diff --check` passed.

Do not broaden the phase. Fix only the verified issues below and add focused regression coverage.

## Goal

Complete Phase 29 by fixing these three findings:

1. A failed source-driven refresh must preserve the **previous last-valid four boundary snapshots**, even when the next diagram has already transformed the linked patch snapshots as part of the same operation.
2. Malformed `boundarySources` metadata must never escape the JSON APIs as an uncaught exception.
3. `docs/DATA_MODEL.md` must no longer contradict the implemented live-linked Coons behavior.

After the fix:

- a source edit or transform is still accepted even when it temporarily invalidates a linked Coons patch;
- Preview and export continue to use the actual last-valid patch geometry;
- malformed saved metadata returns `{ ok: false }` with a validation error instead of throwing;
- valid dangling source IDs continue to load as stale linked patches with saved fallback snapshots;
- all existing Phase 29 behavior remains intact.

## 1. Preserve the previous last-valid snapshots after a failed refresh

### Verified failure

`synchronizeLinkedCoonsPatches` currently preserves snapshots from the **next** diagram when source refresh fails.

This is incorrect when an operation has already transformed both:

- one or more linked sources; and
- the linked Coons patch’s stored snapshots.

`src/model/translation.ts` already translates Coons patch snapshots during layer translation.

Concrete reproduced case:

1. Put a linked Coons patch and its `bottom` source on layer `0`.
2. Put the other three sources on layer `1`.
3. Translate layer `0` by `+1` in `x`.
4. The `bottom` source moves and no longer matches the other source corners.
5. The linked patch becomes stale, as expected.
6. However, its fallback snapshots also move from `x = 0` to `x = 1` because synchronization keeps the already-translated snapshots from the next diagram.
7. Preview and export therefore use geometry that is not the previous last-valid Coons patch.

### Required behavior

When a source-driven refresh is attempted and the complete candidate Coons primitive is invalid or cannot be resolved:

- keep the source edit or transform in `nextDiagram`;
- keep the linked patch stratum from `nextDiagram` for all non-boundary data;
- keep the current `boundarySources` metadata from `nextDiagram`;
- replace only the materialized `bottom`, `right`, `top`, and `left` snapshots with the matching patch’s snapshots from `previousDiagram`;
- keep the patch stale status derived from the current sources in `nextDiagram`;
- do not roll back, modify, or repair any source stratum;
- do not commit any subset of the invalid candidate boundaries.

The fallback must preserve the next patch’s:

- ID;
- name;
- layer;
- style;
- sampling settings;
- source-link metadata;
- any other non-boundary primitive or stratum fields.

Only the four materialized boundary snapshots come from the previous matching Coons patch.

Conceptually:

```ts
const fallbackPatch = {
  ...nextPatch,
  primitive: {
    ...nextPatch.primitive,
    bottom: cloneBoundary(previousPatch.primitive.bottom),
    right: cloneBoundary(previousPatch.primitive.right),
    top: cloneBoundary(previousPatch.primitive.top),
    left: cloneBoundary(previousPatch.primitive.left),
  },
}
```

Adapt this to the existing repository helpers and types.
Use existing deep-clone helpers where available so the previous and next diagrams do not accidentally share mutable nested arrays.

### Matching policy

Find the previous fallback patch by stable stratum ID, not array index.

Use previous snapshots only when the previous diagram contains the same stratum ID and both the previous and next strata are compatible Coons patch strata.

If no usable previous patch exists, for example:

- `previousDiagram` is `null` during initial load;
- the patch is newly created;
- the matching previous stratum is missing or not a Coons patch;

then retain the snapshots already stored in `nextDiagram` as the only available fallback.
This preserves the saved materialized geometry during load.

### Repeated stale edits and recovery

The behavior must remain stable across repeated edits:

- the first invalid edit keeps the previous valid snapshots;
- another invalid edit keeps those same last-valid snapshots;
- repairing the sources allows normal atomic refresh to succeed and replace all four snapshots;
- Undo/Redo continues to restore source and snapshot states together without drift.

### Do not use a narrow workaround

Do not solve this only by disabling translation of linked Coons snapshots in `translation.ts`.

The synchronization helper itself must correctly restore previous last-valid snapshots after **any** combined operation that mutates next snapshots before a source-driven refresh fails.

Do not copy the entire previous patch stratum, because that would incorrectly roll back valid next-state fields such as style, layer, sampling, or link metadata.

Do not change the successful-refresh path: when all four sources resolve and validate, materialize the complete candidate from the next diagram exactly as Phase 29 already does.

## 2. Make malformed `boundarySources` safe in all JSON paths

### Verified failure

`parseSavedDiagramJson` currently reaches linked-Coons synchronization before the relevant validation `try` protects the operation.

`inspectLinkedCoonsPatch` assumes all four source records are structurally present and valid.

A Coons primitive containing:

```json
{
  "boundarySources": {}
}
```

can therefore throw an exception similar to:

```text
TypeError: Cannot read properties of undefined (reading 'kind')
```

instead of returning:

```ts
{ ok: false, error: "..." }
```

The symbolic-import resolution path has the same ordering risk.

### Required behavior

All public saved-diagram APIs must reject malformed source-link metadata safely and consistently:

- `parseSavedDiagramJson`;
- `parseSavedDiagramJsonForImport`;
- `resolvePendingSymbolicDiagramImport`, where applicable;
- any shared normalization/load helper used by those APIs.

Malformed metadata must produce an ordinary validation failure.
It must not throw an uncaught `TypeError` or another implementation exception.

### Structural validation

When `boundarySources` is absent, the Coons patch remains a valid static patch.

When `boundarySources` is present, structurally validate all four roles:

- `bottom`;
- `right`;
- `top`;
- `left`.

Each role must contain a supported source record.

For a path source, require the existing Phase 29 shape, including:

- `kind: 'path'`;
- a valid source path ID string;
- a boolean `reversed` value.

For a point source, require the existing Phase 29 shape, including:

- `kind: 'point'`;
- a valid source point ID string.

Reject safely, according to existing validation conventions:

- `{}`;
- missing roles;
- `null` role values;
- arrays instead of objects;
- unknown `kind` values;
- missing or non-string source IDs;
- missing or non-boolean `reversed` values for path sources.

Do not confuse structural validity with referential validity.
A structurally valid source record whose ID is absent from the diagram is still an allowed dangling link:

- loading succeeds;
- the saved materialized snapshots remain available;
- link status is stale and reports the missing source.

### Ordering

Ensure no synchronization or linked-Coons inspection dereferences untrusted `boundarySources` before structural validation has succeeded.

Preferred lifecycle:

1. Parse and perform existing basic normalization.
2. Structurally validate the diagram, including `boundarySources`.
3. Resolve required variables/coordinate metadata as appropriate for that load path.
4. Synchronize linked Coons patches.
5. Validate the final synchronized diagram as required by existing conventions.
6. Return a safe `ok` result.

Adapt the exact ordering to the repository’s normal and symbolic import architecture, but the invariant is mandatory:

> Untrusted `boundarySources` must be structurally validated before any code assumes that all four roles exist.

### Defensive model helpers

Also harden `inspectLinkedCoonsPatch`, `synchronizeLinkedCoonsPatches`, or their shared source-access helper so they do not blindly read `.kind` from an absent role.

Use a pure type guard or validation helper shared with the model validation path where practical.

If malformed metadata somehow reaches these helpers despite validation, return a structured issue or preserve the current snapshots rather than throwing.

Do not use a broad `try/catch` as the only fix while leaving unsafe role dereferences in place.
Public parse functions may retain their existing defensive catch behavior, but the underlying linked-Coons logic must also be safe.

### Symbolic import

Preserve Phase 29’s required load behavior:

- valid linked files are synchronized after symbolic values and coordinate previews are resolved;
- failed valid-source refresh retains saved snapshots;
- malformed link metadata is rejected before or during safe structural validation;
- no malformed pending import can later crash `resolvePendingSymbolicDiagramImport`.

## 3. Correct the contradictory data-model documentation

`docs/DATA_MODEL.md` currently still states that Coons patch creation “does not create live links.”

Update the relevant paragraph so it accurately distinguishes:

- linked Coons patches created with optional persistent `boundarySources`;
- static/legacy Coons patches without `boundarySources`;
- materialized snapshots as the authoritative sampling/render/export geometry;
- valid source edits refreshing those snapshots;
- invalid or missing sources retaining the last valid snapshots;
- ruled surfaces remaining snapshot-only.

Keep the documentation edit small and local.
Search the nearby Coons section for any other directly contradictory sentence, but do not rewrite unrelated documentation.

## 4. Required regression tests

Update `tests/integration/phase29LinkedCoonsPatches.test.ts` with focused tests for the exact review findings.

### A. Partial layer translation preserves the actual last-valid snapshots

Use the real layer-translation/update path rather than manually editing only a source.

Set up:

- a valid linked Coons patch;
- the patch and `bottom` source on layer `0`;
- the other three sources on layer `1`;
- known boundary geometry whose original coordinates are easy to assert.

Translate layer `0` by a nonzero vector, for example `{ x: 1, y: 0, z: 0 }`.

Assert:

- the `bottom` source edit/translation remains applied;
- the source-derived Coons candidate is invalid because the corners no longer match;
- status is linked/stale;
- the materialized `bottom`, `right`, `top`, and `left` snapshots equal the previous patch’s four last-valid snapshots;
- they do not equal the already-translated next snapshots;
- the sampled Coons mesh remains equal to the previous last-valid mesh;
- the patch’s link metadata and non-boundary fields remain from the next state.

Where existing helpers make it straightforward, also assert that SVG/TikZ export consumes the retained last-valid geometry rather than the translated invalid fallback.
Do not make the test brittle solely around long full-string output if geometry/sampling assertions already prove the behavior.

### B. Repeated stale edit and recovery

Extend the test above or add a focused case showing:

- a second invalid change does not drift the fallback snapshots;
- repairing the source corners causes the patch to catch up normally.

Existing recovery coverage may be reused if it already proves this path after the new fallback semantics.

### C. Malformed linked JSON returns `ok: false`

Add at least the reviewer’s exact regression:

```json
"boundarySources": {}
```

Assert:

- `parseSavedDiagramJson` does not throw;
- it returns `ok: false`;
- the error is a normal malformed/invalid saved-diagram error.

Prefer a small table of additional malformed shapes if concise, such as:

- one missing role;
- a path source without `reversed`;
- a role with `null`;
- an unknown source `kind`.

Do not overfit the test to an exact full error string unless repository tests normally require it.

### D. Symbolic-import malformed metadata is also safe

Construct a saved diagram that exercises the symbolic-import path and contains malformed `boundarySources`.

Assert that the public import API returns `ok: false` rather than throwing or producing a pending import that later crashes.

If a crafted `PendingSymbolicDiagramImport` can still reach `resolvePendingSymbolicDiagramImport`, add a direct defensive regression for that exported function as well.

### E. Preserve valid dangling-link behavior

Keep the existing test that structurally valid but missing source IDs still load successfully with stale status and saved fallback snapshots.

This distinction is important:

```text
malformed metadata -> load error
valid metadata with dangling ID -> successful stale load
```

## 5. Preserve existing Phase 29 behavior

Do not regress:

- optional `boundarySources` model metadata;
- linked creation checked by default;
- explicit static creation;
- path and constant-point links;
- per-role reversal;
- successful atomic four-boundary refresh;
- stale status and automatic recovery;
- Detach boundary links;
- one-step Undo/Redo;
- source deletion fallback;
- valid linked JSON round-trip;
- legacy static JSON;
- valid dangling source IDs;
- clone and duplication ID remapping;
- snapshot-based Coons sampling;
- SVG Preview and SVG export;
- TikZ export;
- static Coons patches;
- snapshot-only ruled surfaces;
- coordinate anchors, coordinate references, and symbolic coordinates;
- layer and bulk operations;
- current Coons formula, mesh topology, and sampling limits;
- inline-math TikZ formatting and 4-space indentation.

Do not introduce:

- a general dependency graph;
- render-time source lookup;
- automatic corner repair;
- live-linked ruled surfaces;
- new UI beyond what is needed for an existing error/status path;
- a serialization-version bump unless the existing validation architecture absolutely requires it;
- unrelated refactors.

## 6. Verification

Run the focused regression first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts
```

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

If browser/manual verification is available, verify:

1. Create a linked Coons patch.
2. Put the patch and one boundary source on one layer and the other sources on another layer.
3. Translate only the first layer so the source corners become incompatible.
4. Confirm the source moves but the patch remains at its previous valid geometry and reports stale status.
5. Repair the sources and confirm the patch catches up.
6. Load malformed linked JSON and confirm the UI reports a normal load error rather than crashing.

If the sandbox prevents starting the dev server, report that limitation explicitly and do not claim manual verification.

## 7. Report after implementation

Please report:

- files modified;
- the root cause of the last-valid fallback bug;
- how the previous patch is matched;
- how only the four previous snapshots are restored while next-state fields are preserved;
- behavior when `previousDiagram` or a previous matching patch is unavailable;
- how repeated stale edits avoid drift;
- validation and type-guard changes for `boundarySources`;
- normal-load and symbolic-import ordering changes;
- how malformed metadata differs from valid dangling IDs;
- documentation corrected;
- tests added or updated;
- focused Phase 29 test result;
- full `npm test` result;
- build result;
- lint result, if run;
- `git diff --check` result;
- manual verification performed or why it was unavailable;
- remaining limitations.

## Acceptance criteria

This fix is complete when:

- partial layer translation cannot replace a linked Coons patch’s last-valid fallback snapshots after refresh failure;
- the source edit remains committed while only the previous four snapshots are retained;
- successful refresh and automatic recovery still work;
- malformed `boundarySources` never causes an uncaught exception in normal or symbolic JSON import;
- malformed metadata returns `ok: false`;
- valid dangling IDs still load as stale linked patches;
- `docs/DATA_MODEL.md` accurately describes Phase 29 behavior;
- focused tests, the full test suite, build, and `git diff --check` pass;
- no Critical or Medium Phase 29 review issue remains.
