# Phase 29 Targeted Fix Prompt 9: Non-sampling link inspection, frozen-symbolic import, and stable stale-geometry caching

## Environment

Work on the current Phase 29 branch and preserve its committed and unstaged performance work.

Do not switch to or modify `main`.

The review covered:

```text
1faa43f..36776a6
```

plus the current unstaged Phase 29 performance changes.

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

You are fixing the remaining Phase 29 correctness and performance gaps in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 29 adds optional live-linked Coons boundaries while retaining materialized snapshots for:

- sampling;
- SVG Preview;
- SVG export;
- TikZ export;
- stale fallback;
- save/load;
- detach;
- Undo/Redo.

The current branch also contains an unstaged Preview-performance optimization. Preserve that work unless a targeted adjustment is required by this prompt.

All earlier Phase 29 fixes must remain intact, including:

- exact symbolic/provenance preservation in stale snapshots;
- equal-valued symbolic-expression synchronization;
- malformed metadata rejection;
- replacement-document load isolation;
- dangling source-ID reservation;
- source-aware duplication remapping;
- atomic four-boundary refresh;
- linked-by-default creation;
- static and legacy Coons behavior;
- snapshot-based rendering/export;
- stale recovery;
- one-step Undo/Redo.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- all prior Phase 29 fix prompts present in the repository;
- `src/model/coonsPatchLinks.ts`;
- `src/geometry/curvedSheets.ts`;
- `src/model/symbolicCoordinates.ts`;
- `src/model/serialization.ts`;
- `src/model/variables.ts`;
- `src/ui/undo.ts`;
- `src/ui/inspector/CurvedSheetGeometryEditor.tsx`;
- `src/rendering/svgSurfaceScene.ts`;
- `src/rendering/curvedSheetMesh.ts`;
- the current Preview cache/preparation code;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- `tests/rendering/phase29CoonsPreviewPerformance.test.ts`;
- symbolic import tests;
- curved-sheet validation tests;
- `docs/SYMBOLIC_INPUT_AND_GRIDS.md`;
- `package.json`, including the explicit test list.

Search for every call to:

- `inspectLinkedCoonsPatch`;
- `coonsPatchBoundaryLinkStatus`;
- `synchronizeLinkedCoonsPatches`;
- `validateCurvedSheetPrimitive`;
- `sampleCurvedSheetPrimitive`;
- symbolic-expression collection helpers;
- `parseSavedDiagramJsonForImport`;
- `resolvePendingSymbolicDiagramImport`;
- frozen fallback clone/materialization helpers;
- the curved-sheet world-space mesh cache.

## Verified review findings

### Medium 1: unchanged-source synchronization and Inspector status still sample the full mesh

The current synchronization path:

1. fully inspects the next linked patch;
2. then determines whether the linked sources changed;
3. fully inspects the previous linked patch as well.

Full inspection invokes curved-sheet primitive validation, and that validation samples the complete Coons mesh.

Consequences:

- an unrelated committed edit samples each valid linked patch twice;
- selected-patch Inspector status samples the mesh again on render;
- the current unrelated-edit regression checks diagram identity, not sampling calls;
- the Preview cache work does not cover synchronization or status sampling.

The explicit Phase 29 requirement is:

> Link status and unchanged-source synchronization must not perform full Coons mesh sampling.

### Medium 2: frozen fallback snapshots create irrelevant symbolic-variable requirements in the real UI import path

Symbolic preview refresh correctly skips linked/frozen Coons snapshots.

However, symbolic-expression collection still traverses the four materialized snapshots.

Verified sequence:

1. A linked snapshot contains symbolic expression `R`.
2. Its source is deleted, so the patch becomes stale/frozen.
3. Variable `R` is then deleted because it is no longer used by any active source.
4. The diagram is saved.
5. The direct parser accepts the saved frozen fallback.
6. The UI import parser collects `R` from the frozen snapshot and creates a blank required-variable draft.
7. The user cannot complete import without inventing a semantically irrelevant value.

Frozen linked snapshots are materialized fallback data. They must not create active variable-import requirements.

### Low 1: repeated stale edits churn identical fallback primitives and defeat the rendering cache

Repeated invalid source edits clone an unchanged frozen fallback each time.

The current world-space surface cache keys by primitive identity, so each clone causes the same last-valid Coons geometry to be sampled again.

Verified probe:

```text
initial render
+ invalid stale edit 1
+ invalid stale edit 2
= three samples
```

The meshes were equal, but primitive and boundary identities differed.

### Low 2: symbolic-import documentation is stale

`docs/SYMBOLIC_INPUT_AND_GRIDS.md` still implies ruled-surface and Coons snapshots are always refreshed and always contribute symbolic import requirements.

It must document the Phase 29 linked/frozen exception.

## Goal

Fix only the verified gaps.

After the fix:

- unchanged-source synchronization performs zero full-mesh samples;
- Inspector link status performs zero full-mesh samples;
- changed linked candidates retain strict validation and are fully sampled no more than once where full sampling is still required;
- indirect source changes remain detectable;
- linked/frozen fallback snapshots do not create active symbolic variable import requirements;
- static Coons and ruled-surface snapshots keep their existing symbolic import behavior;
- repeated stale edits with unchanged materialized geometry do not trigger repeated world-space Coons sampling;
- source recovery and real geometry/sampling changes still invalidate the cache immediately;
- documentation matches the implemented symbolic import lifecycle.

## Fix 1: separate lightweight link inspection from full candidate validation

### Required architecture

Split the current all-in-one linked-Coons inspection into distinct pure responsibilities.

A suitable conceptual separation is:

```ts
type LinkedCoonsSourceState = {
  fingerprints: Record<CoonsPatchBoundaryRole, LinkedBoundarySourceFingerprint>
  sourceIssues: CoonsPatchBoundaryLinkIssue[]
}

function inspectLinkedCoonsSourceState(
  diagram: Diagram,
  patch: CurvedSheetStratum,
  context?: LinkedCoonsLookupContext,
): LinkedCoonsSourceState
```

```ts
function resolveLinkedCoonsCandidate(
  diagram: Diagram,
  patch: CurvedSheetStratum,
  context?: LinkedCoonsLookupContext,
): LinkedCoonsCandidateResult
```

```ts
function inspectLinkedCoonsStatusWithoutSampling(
  diagram: Diagram,
  patch: CurvedSheetStratum,
  context?: LinkedCoonsLookupContext,
): CoonsPatchBoundaryLinkStatus
```

Names may follow repository conventions.

The important requirement is that:

- source change detection;
- ordinary status derivation;
- full changed-candidate validation;

are not the same operation.

### Lightweight source-state inspection

The lightweight source state must detect geometry-relevant and persistence-relevant source changes without sampling the Coons surface mesh.

It must continue to detect:

- path vertex/control-point edits;
- concatenated path changes;
- path-template changes;
- path reversal;
- point movement;
- coordinate-anchor movement;
- coordinate-reference changes;
- symbolic expression and preview changes;
- equal-valued expression/provenance changes;
- variable changes used by a source;
- layer/bulk transformations;
- source deletion;
- source-kind invalidation;
- closed/non-finite source changes;
- role-specific `reversed` metadata.

It must ignore unrelated changes such as:

- style;
- selection;
- unrelated labels;
- unrelated variables;
- unrelated strata;
- patch name changes;
- source display-name changes unless current persisted snapshot semantics intentionally depend on them.

Reuse the semantic fingerprinting introduced by earlier Phase 29 fixes.

Do not use full-diagram `JSON.stringify`.

Do not call:

- `validateCurvedSheetPrimitive`;
- `sampleCurvedSheetPrimitive`;
- `sampleCoonsPatch`;

from the lightweight source-state helper.

### Unchanged-source fast path

In `synchronizeLinkedCoonsPatches`:

1. perform malformed metadata/state guards;
2. compute previous and next lightweight source states;
3. compare their semantic fingerprints;
4. if they are unchanged:
   - do not resolve a full candidate;
   - do not detach candidate coordinate references;
   - do not call full curved-sheet validation;
   - do not sample the mesh;
   - preserve the existing materialized primitive;
   - preserve link status/frozen state according to current semantics;
   - return a no-op patch update unless unrelated patch metadata genuinely changed.

Do not inspect the complete next candidate before this comparison.

Do not inspect the complete previous candidate merely to determine source equality.

### Changed-source path

When source state changed:

1. resolve all four current boundaries exactly once;
2. apply role-specific reversal;
3. detach coordinate references using the existing policy;
4. construct one complete candidate;
5. run lightweight structural/finite/corner validation;
6. run full sampling validation at most once if it remains necessary at this correctness boundary;
7. atomically commit all four boundaries only when valid;
8. otherwise retain the exact previous fallback snapshots.

Do not run full validation for both previous and next candidates.

The previous committed primitive is already the last accepted model state.

### Validation split

If necessary, split curved-sheet validation into:

```text
structural / finite / sampling-count / boundary / corner validation
```

and:

```text
full mesh sampling verification
```

A conceptual API is:

```ts
validateCurvedSheetPrimitiveStructure(primitive)
validateCurvedSheetPrimitiveBySampling(primitive)
```

Requirements:

- JSON load, initial creation, and committed changed candidates remain strictly validated;
- no invalid candidate enters the diagram;
- status and unchanged-source checks never perform full mesh sampling;
- existing error messages remain stable where practical;
- do not globally weaken `validateCurvedSheetPrimitive`.

### Inspector status

`coonsPatchBoundaryLinkStatus` must use the non-sampling status path.

It may resolve boundary sources and construct boundary snapshots when needed, but it must not sample the `uSegments × vSegments` surface mesh.

Status must still distinguish:

- static;
- linked and up to date;
- linked and stale;
- malformed state;
- missing source;
- invalid source;
- corner mismatch;
- semantically obsolete materialized snapshots.

Use the same semantic equality rules as synchronization.

Do not report `linkedUpToDate` merely because numeric geometry matches while symbolic/provenance data differs.

Memoize the Inspector result with stable dependencies if useful, but memoization alone is not sufficient. The status computation itself must be non-sampling.

## Fix 2: exclude linked/frozen materialized snapshots from active symbolic import requirements

### Dependency ownership rule

For symbolic import and missing-variable collection:

- a static Coons patch without `boundarySources` owns its materialized snapshot expressions;
- ruled-surface snapshots retain their existing behavior;
- a linked Coons patch’s active symbolic dependencies are owned by its linked source paths/points;
- a frozen linked fallback snapshot is materialized last-valid data and does not create an active variable requirement;
- the numeric preview values stored in a frozen snapshot remain authoritative until successful source recovery.

Therefore, expression collection for required-variable import must skip the four Coons materialized boundaries when:

```ts
primitive.kind === 'coonsPatch' &&
(
  primitive.boundarySources !== undefined ||
  primitive.boundarySnapshotState === 'frozen'
)
```

Adapt the exact condition to current valid model invariants.

If every valid frozen state is necessarily linked, keep the implementation minimal while retaining defensive behavior for parsed data.

### Do not globally hide symbolic expressions

This exception applies to active symbolic-variable requirement collection and linked/frozen refresh semantics.

Do not remove snapshot expressions from:

- serialization;
- debugging;
- model inspection;
- detach;
- stale fallback persistence;
- semantic equality;
- successful recovery logic.

Do not strip or rewrite the symbolic fields.

### UI import path

Apply the rule to the production UI import lifecycle, including:

- `parseSavedDiagramJsonForImport`;
- required-variable draft construction;
- `resolvePendingSymbolicDiagramImport`;
- the `App.tsx` load path.

The UI import should not request a value that is used only by a linked/frozen fallback snapshot.

### Required behavior

For a stale frozen patch whose old snapshot contains `R`, when:

- its source is missing;
- no active source uses `R`;
- variable `R` has been deleted;

then:

- direct parse succeeds;
- UI import parse succeeds or creates a pending import that does not require `R`;
- completing import with no value for `R` succeeds;
- the frozen fallback snapshots remain unchanged;
- the patch remains stale;
- Preview, SVG, and TikZ use the fallback geometry;
- repairing/relinking the original source through existing Phase 29 mechanisms still works when applicable.

### Preserve ordinary import behavior

Verify that:

- a static Coons snapshot using missing variable `R` still requires `R`;
- a ruled-surface snapshot using missing variable `R` still follows its existing import requirement;
- an up-to-date linked Coons source that actively uses missing `R` still requires `R` through the source path/point;
- unrelated source expressions are unaffected.

Prefer adding an explicit expression-collection mode or helper name such as:

```ts
collectActiveSymbolicExpressions(...)
```

rather than embedding undocumented one-off conditionals in the parser.

## Fix 3: preserve stable fallback geometry identity and cache semantics

### Synchronization object reuse

On failed synchronization, preserve exact previous snapshots as already required.

In addition, avoid cloning an unchanged frozen fallback on every repeated invalid edit.

When:

- the patch is already frozen/stale;
- the last-valid `bottom`, `right`, `top`, and `left` snapshots are unchanged;
- sampling settings are unchanged;
- link metadata is unchanged;
- no patch-local non-boundary field requires replacement;

reuse the existing patch primitive or stratum object.

At minimum, reuse the exact boundary snapshot references.

Prefer returning the previous primitive identity when the desired stored primitive is unchanged.

Do not mutate the previous diagram.

### Preserve next patch metadata when required

If a combined operation changes legitimate patch-local metadata while the source remains invalid:

- keep the next metadata;
- reuse the previous materialized boundary references;
- create a new primitive only when a stored field actually differs.

Examples:

- sampling changes must create a new sampling input and invalidate the mesh;
- a style change stored outside the primitive must not force a new geometry primitive;
- `boundarySnapshotState` should not be rewritten from `'frozen'` to the same value on every edit;
- unchanged `boundarySources` should retain their existing reference where safe.

### Geometry-aware rendering cache

The current world-space mesh cache must not treat link-only metadata churn as a geometry change.

Cache identity/equality for Coons world-space sampling must depend on actual sampling inputs:

- primitive kind;
- materialized `bottom`;
- materialized `right`;
- materialized `top`;
- materialized `left`;
- `uSegments`;
- `vSegments`;
- any other field actually read by `sampleCoonsPatch`.

It must not invalidate solely because of:

- `boundarySources`;
- `boundarySnapshotState`;
- stale issue text;
- selection;
- Inspector state;
- style stored outside sampling inputs.

Prefer fast reference equality of the exact materialized boundaries preserved by synchronization.

If a fallback semantic comparison is needed, use a small sampling-input equality helper.

Do not compute a large JSON fingerprint on every render.

### Required invalidation

The cache must invalidate immediately when:

- any materialized boundary changes after successful recovery;
- sampling counts change;
- primitive kind or actual sampled geometry changes;
- a static/detached patch is edited;
- load replaces the diagram with different materialized snapshots.

Camera-only changes should continue to reuse the world-space mesh and reproject it.

## Documentation

Update `docs/SYMBOLIC_INPUT_AND_GRIDS.md`.

Correct statements that currently imply all ruled-surface and Coons snapshots are always refreshed or always contribute required variables.

Document clearly:

- ruled-surface snapshots keep their existing symbolic import behavior;
- static Coons snapshots keep their existing symbolic import behavior;
- linked Coons patches use source strata as active symbolic dependencies;
- linked/frozen materialized snapshots are preserved as last-valid fallback data;
- missing variables referenced only by a frozen fallback are not requested during UI import;
- successful source recovery atomically replaces the fallback snapshots;
- symbolic expressions/provenance remain stored in the snapshots even when they are not active import requirements.

Do not overstate the behavior of static patches.

## Regression tests

Extend:

```text
tests/integration/phase29LinkedCoonsPatches.test.ts
tests/rendering/phase29CoonsPreviewPerformance.test.ts
```

Add another focused symbolic import test file only if that better matches repository conventions.

If `npm test` enumerates files explicitly, update it.

### A. Unchanged-source synchronization performs zero mesh sampling

Create a valid linked Coons patch.

Instrument the full curved-sheet sampling boundary using the existing Phase 29 performance-test mechanism or a small testable dependency seam.

Perform an unrelated committed edit.

Assert:

- source fingerprints are checked;
- no linked candidate is fully resolved/validated by sampling;
- `sampleCurvedSheetPrimitive` / `sampleCoonsPatch` call count for synchronization is zero;
- patch primitive and materialized snapshots remain unchanged;
- one normal history entry is created only for the unrelated edit.

Do not rely only on object identity.

### B. Inspector status performs zero mesh sampling

Call the production status helper repeatedly for:

- linked up-to-date patch;
- linked stale patch;
- missing source;
- corner mismatch;
- static patch.

Assert:

- correct status;
- zero full surface-mesh samples;
- no mutation;
- symbolic/provenance-sensitive comparison remains correct.

If a component test is available, rerender the selected-patch Inspector with unchanged diagram and assert the same.

The pure helper call-count test is required even if React Strict Mode makes component counts nondeterministic.

### C. Changed candidate samples at most once

Edit a linked source so the candidate remains valid.

Assert:

- source change is detected;
- four boundaries are resolved once per role;
- complete candidate is committed atomically;
- full surface sampling occurs no more than once for synchronization;
- Preview rendering may sample through its separate world-space cache, but synchronization itself must not sample previous and next candidates redundantly.

### D. Indirect changes remain detectable

Keep focused coverage for at least:

- symbolic expression/provenance change;
- coordinate anchor or coordinate reference change;
- path-template or concatenated-path change;
- layer/bulk transform.

The fast path must not skip these.

### E. Frozen fallback variable deleted before UI import

Test the real lifecycle:

1. Create a linked Coons patch whose saved snapshot contains symbolic expression `R`.
2. Make it stale/frozen by deleting or invalidating its source.
3. Delete variable `R` after confirming no active source uses it.
4. Serialize the diagram.
5. Verify direct saved-diagram parse succeeds.
6. Call `parseSavedDiagramJsonForImport`.
7. Assert `R` is not in the required-variable draft set.
8. Complete `resolvePendingSymbolicDiagramImport` without supplying `R`.
9. Assert import succeeds.
10. Assert:
    - the patch remains stale/frozen;
    - exact materialized snapshots, including expression/provenance fields, are preserved;
    - validation succeeds;
    - Preview sampling, SVG export, and TikZ export succeed.

Exercise the same APIs used by `App.tsx`.

### F. Static Coons still requires its variable

Create a static Coons patch with a materialized snapshot that actively uses missing variable `R`.

Assert UI import still requires `R`.

### G. Ruled surface behavior is unchanged

Create an equivalent ruled-surface snapshot using missing variable `R`.

Assert its current import requirement remains unchanged.

### H. Linked active source still requires its variable

Create an up-to-date linked patch whose actual source path uses missing variable `R`.

Assert `R` is still required through the source, even though the linked materialized snapshots are skipped by requirement collection.

### I. Repeated stale edits do not resample unchanged fallback geometry

Create and render a linked Coons patch.

Then perform at least three invalid source edits while the patch remains stale and its materialized fallback geometry is unchanged.

Assert:

- all edits are accepted;
- status remains stale;
- exact snapshot values and symbolic/provenance fields remain unchanged;
- after the first stale transition, subsequent invalid edits do not replace the stored primitive when no patch-local field changed;
- world-space mesh sampling count does not increase for unchanged fallback geometry;
- camera reprojection may run as required, but sampling does not.

A strong target is:

```text
initial valid render: one sample
first stale transition with same materialized geometry: zero additional samples
subsequent stale edits: zero additional samples
```

If the existing cache architecture necessarily performs one sample on the first valid-to-frozen metadata transition, document and justify it, but subsequent unchanged stale edits must perform zero additional samples.

Prefer making the cache geometry-aware so even the first state-only transition reuses the mesh.

### J. Recovery invalidates the cache

Repair the source.

Assert:

- successful atomic synchronization changes materialized geometry;
- world-space mesh is resampled once;
- the recovered Preview updates immediately;
- status becomes up to date.

### K. Sampling-setting change invalidates the cache

While stale or valid, change `uSegments` or `vSegments`.

Assert:

- world-space mesh is resampled;
- face count changes;
- stale snapshot geometry remains otherwise unchanged where applicable.

### L. Patch-local metadata does not invalidate geometry cache

Change a non-sampling field such as link state metadata or another patch-local field that does not affect `sampleCoonsPatch`.

Assert the world-space mesh is reused.

Do not use a field whose current model semantics actually affect geometry.

## Preserve existing behavior

Do not regress:

- exact stale fallback snapshots;
- equal-valued symbolic expression synchronization;
- malformed `boundarySnapshotState` rejection;
- malformed `boundarySources` rejection;
- replacement-diagram load protection;
- dangling ID reservation;
- Variable Manager ID allocation;
- source-aware duplication;
- linked/static creation;
- reverse-direction preservation;
- point boundaries;
- coordinate references;
- stale recovery;
- detach;
- one-step Undo/Redo;
- Preview surface sharing/cache work;
- SVG and TikZ output;
- inline-math formatting;
- 4-space TikZ indentation;
- legacy static patches;
- ruled surfaces.

## Scope constraints

Do not:

- redesign Phase 29;
- merge the branch into `main`;
- change the Coons formula;
- lower sampling quality;
- disable automatic visibility or depth sorting;
- defer synchronization until pointer-up;
- make linked patches visually lag;
- weaken final model validation;
- move source lookup into rendering or export;
- strip symbolic expressions from frozen snapshots;
- require dummy values for frozen-only variables;
- globally ignore symbolic expressions in snapshots;
- add a general dependency graph;
- add module-global mutable caches;
- use full-diagram `JSON.stringify` as a hot-path cache key;
- change JSON version;
- perform unrelated UI cleanup;
- add dependencies.

Keep the production diff focused on:

- non-sampling link inspection and unchanged-source fast paths;
- active symbolic dependency collection;
- stale primitive reuse and geometry-aware cache stability;
- documentation;
- targeted tests.

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

Also run every focused symbolic-import, curved-sheet validation, rendering-cache, and Inspector/status test file modified by this fix.

Perform deterministic probes for:

```text
unrelated edit with one valid linked patch
repeated Inspector status calls
valid linked source edit
frozen fallback with deleted variable through UI import
three repeated stale edits with unchanged fallback
source recovery
```

Report sampling and candidate-validation call counts.

If the local dev server cannot bind because the sandbox denies `listen`, report that limitation accurately.

Do not claim browser verification when it was unavailable.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- unchanged-source synchronization performs zero full Coons mesh samples;
- Inspector status performs zero full Coons mesh samples;
- a changed valid candidate is fully sampled no more than once during synchronization;
- indirect geometry/provenance changes are still detected;
- frozen-only symbolic expressions do not create UI import variable requirements;
- static Coons and ruled-surface symbolic import behavior is unchanged;
- active linked sources still provide their required variables;
- repeated stale edits reuse unchanged fallback geometry and do not repeatedly resample it;
- recovery and sampling-setting changes invalidate the correct cache immediately;
- all previous Phase 29 correctness and performance tests pass;
- documentation matches the final behavior;
- focused tests, full tests, build, and all diff checks pass.

## Report after implementation

Report:

- files modified;
- root cause of synchronization/status sampling;
- lightweight source-state API introduced;
- unchanged-source fast-path behavior;
- changed-candidate validation and maximum sampling count;
- Inspector status implementation;
- indirect-change detection retained;
- root cause of the frozen-only variable import requirement;
- symbolic dependency ownership rule implemented;
- normal and pending UI import behavior;
- static Coons and ruled-surface behavior verified;
- root cause of stale primitive/cache churn;
- object/reference reuse implemented;
- geometry-aware cache inputs and invalidation rules;
- documentation changes;
- tests added or updated;
- before/after call counts for all required probes;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- `git diff 1faa43f --check` result;
- manual browser verification performed or the exact reason it was unavailable;
- remaining known limitations.
