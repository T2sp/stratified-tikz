# Phase 29 Targeted Fix Prompt 5: Symbolic provenance synchronization and regression hardening

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
git diff main --check
```

Run lint only if the repository is already established as repository-wide lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not add dependencies.

## Project context

You are applying one final, narrowly targeted Phase 29 correctness fix and strengthening two insufficient regressions in StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Review the actual current working tree and commit range before editing. The review covered `main@1faa43f` through `0416bda`, including unstaged Phase 29 fixes, but line numbers may have moved.

Read at least:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-review.md`;
- all prior Phase 29 fix prompts present in the repository;
- `src/model/coonsPatchLinks.ts`;
- `src/model/symbolicCoordinates.ts`;
- `src/model/variables.ts`;
- `src/model/serialization.ts`;
- `src/model/validation.ts`;
- `src/model/types.ts`;
- `src/model/sheets.ts`;
- `src/model/duplication.ts` and any layer/bulk duplication helpers;
- `src/ui/undo.ts`;
- the linked-Coons creation and update paths;
- the TikZ generator and its curved-sheet/Coons helpers;
- `tests/integration/phase29LinkedCoonsPatches.test.ts`;
- existing symbolic-coordinate, serialization, duplication, undo/redo, and TikZ tests.

Search for all helpers used to:

- fingerprint or compare linked boundary sources;
- compare materialized Coons boundary snapshots;
- decide whether synchronization is required;
- decide whether a synchronized candidate replaces the stored primitive;
- derive `linkedUpToDate` versus `linkedStale`;
- clone or remap `boundarySources`;
- generate Coons TikZ output.

## Verified review findings

### Critical: equal-valued symbolic expression changes are missed

Verified sequence:

1. A linked source boundary and the corresponding materialized snapshot use symbolic expression `R`, with `R = 0.1`.
2. The source expression is changed to `S`, with `S = 0.1`.
3. The source correctly stores `S`.
4. Because the resolved coordinates are unchanged, linked-source detection and snapshot equality treat the source and snapshot as equivalent.
5. The materialized snapshot incorrectly retains expression `R`.
6. Link status incorrectly reports `linkedUpToDate`.
7. The now-unused variable `R` is changed to `0.7`.
8. The snapshot still stores `R` with an obsolete preview value.
9. `validateDiagram` fails, and serialized JSON cannot be loaded.

The observed load error is equivalent to:

```text
primitive.bottom...symbolic.z.previewValue
Symbolic coordinate preview value must match the evaluated expression.
```

Ordinary symbolic refresh intentionally skips linked Coons snapshots so that stale last-valid fallback geometry is not destroyed. Therefore, linked synchronization itself must copy symbolic expression/provenance changes even when the evaluated coordinates remain equal.

### Medium: TikZ regression is not patch-specific

The current TikZ refresh test compares the entire diagram before and after editing a visible source curve.

That output changes even when the Coons patch block remains stale, so the assertion does not prove that refreshed Coons geometry reached TikZ export.

The tests also need focused coverage for:

- stale last-valid Coons fallback coordinates in TikZ;
- linked Coons inline-math formatting.

### Medium: duplication regression omits one role and reversal

The current duplication test does not assert the `top` source remap and does not verify preservation of a `reversed` flag.

The generic implementation appears correct, but the current test would not catch a role-specific omission or lost reversal metadata.

## Goal

Fix linked-Coons synchronization so that geometry-bearing symbolic expression/provenance changes are synchronized even when their resolved coordinates are numerically equal.

After the fix:

- changing a linked source expression from `R` to equal-valued `S` updates the corresponding materialized snapshot from `R` to `S`;
- the patch remains valid and reports `linkedUpToDate`;
- later changes to unused `R` cannot invalidate the patch;
- JSON round-trip remains valid;
- Undo/Redo restores both source and snapshot expression metadata coherently;
- unrelated edits do not cause unnecessary Coons rematerialization;
- TikZ tests inspect the Coons patch block itself;
- duplication tests verify all four roles and reversal metadata;
- rendering, sampling, stale fallback, load behavior, and all previous Phase 29 fixes remain intact.

## Required design principle

Phase 29 needs two distinct notions of equality:

1. **Resolved geometric equality**
   - Used where only current numeric geometry matters.
   - Equal coordinates may be geometrically equivalent.

2. **Persisted linked-boundary semantic equality**
   - Used to decide whether a linked source-derived snapshot is current.
   - Must include geometry-bearing symbolic expression/provenance in addition to resolved geometry.

Do not continue using resolved coordinates alone for every synchronization decision.

Do not replace the comparison with a deep comparison of an entire source stratum, because cosmetic or unrelated changes such as style, name, selection, or layer metadata must not rematerialize the patch.

## Fix 1: symbolic/provenance-sensitive source fingerprinting

### Source-change detection

Update linked-source change detection so it recognizes changes that can affect the persisted materialized boundary representation, even when preview coordinates are equal.

The normalized source fingerprint/equality must include, where applicable:

- boundary source kind: path or point;
- source ID and boundary role;
- path `reversed` state;
- path primitive/segment structure relevant to the boundary;
- every geometry-bearing coordinate;
- resolved numeric preview values;
- symbolic expression text or equivalent canonical expression representation;
- symbolic-coordinate metadata required for valid serialization and later reevaluation;
- coordinate-reference identity/provenance where it remains relevant before snapshot detachment;
- template or concatenated-path parameters that determine the persisted boundary snapshot.

It must exclude unrelated fields such as:

- style;
- layer number by itself;
- display name, unless the existing snapshot format intentionally treats it as persisted boundary identity;
- selection state;
- Inspector/UI state;
- unrelated diagram variables not referenced by the source;
- unrelated strata.

Prefer a small, pure, explicitly named helper, for example:

```ts
function linkedCoonsBoundarySourceFingerprint(
  diagram: Diagram,
  source: CoonsPatchBoundarySource,
  role: CoonsPatchBoundaryRole,
): LinkedCoonsBoundaryFingerprintResult
```

or:

```ts
function areLinkedBoundarySourceStatesEquivalent(
  previous: ResolvedLinkedBoundaryState,
  next: ResolvedLinkedBoundaryState,
): boolean
```

Follow existing naming conventions.

Do not use raw `JSON.stringify` over an entire stratum or the entire diagram.

If the repository already has a structural equality or canonicalization helper for symbolic coordinates, reuse it.

### Required equal-valued behavior

This transition must count as a source change:

```text
previous expression: R
previous preview:    0.1

next expression:     S
next preview:        0.1
```

This transition must not be ignored merely because both resolve to the same `Vec3`.

Conversely, changing a wholly unrelated variable must not count as a linked source change when neither the source geometry nor its symbolic/provenance representation changes.

## Fix 2: symbolic/provenance-sensitive candidate equality

Even after source change is detected and a complete candidate is built, the replacement decision must not compare materialized boundaries by resolved geometry alone.

Update the candidate-versus-current comparison so a candidate with expression `S` replaces a stored snapshot with expression `R`, even when both preview values are `0.1`.

Compare normalized materialized boundary data after applying the same existing policies for:

- boundary orientation;
- coordinate-reference detachment;
- symbolic snapshot materialization;
- validation.

Include all persisted geometry-bearing fields required for:

- `validateDiagram`;
- JSON serialization and parsing;
- future symbolic reevaluation;
- SVG and TikZ export.

Exclude non-geometry patch metadata that is intentionally preserved from the next diagram, such as:

- patch ID;
- name;
- layer;
- style;
- sampling settings;
- selection/UI state.

A successful candidate replacement must still update all four boundaries atomically.

Do not partially update one role.

Do not weaken the last-valid fallback rule for invalid or missing sources.

## Fix 3: status correctness

`inspectLinkedCoonsPatch` or its underlying comparison must use the same semantic notion of “current” as synchronization.

A linked patch must not report `linkedUpToDate` when:

- current linked source expression is `S`;
- stored materialized snapshot expression is still `R`;
- both happen to resolve to the same current coordinate.

After successful synchronization, status should report `linkedUpToDate`.

If a candidate cannot be validated, status should remain `linkedStale` while the previous last-valid snapshots remain authoritative.

Avoid divergent equality logic between:

- change detection;
- candidate replacement;
- status inspection.

Prefer one normalized comparison/fingerprint helper reused by all three, or a small set of helpers with clearly documented responsibilities.

## Preserve symbolic stale fallback semantics

Do not undo the earlier Phase 29 fix that prevents ordinary symbolic refresh from rewriting linked Coons fallback snapshots.

The ownership rule remains:

- linked source paths/points receive normal symbolic preview refresh;
- linked Coons materialized snapshots are replaced only by successful atomic linked synchronization;
- failed synchronization preserves the previous last-valid snapshots;
- saved stale linked diagrams remain loadable;
- repaired sources recover automatically.

The present fix is specifically about making successful synchronization copy equal-valued expression/provenance changes.

Do not globally refresh linked snapshots through `refreshDiagramSymbolicCoordinatePreviews`.

Do not globally bake all symbolic coordinates to numeric literals.

## Undo/Redo requirements

The expression edit and dependent snapshot update must remain one diagram history entry.

For this sequence:

```text
R = 0.1
S = 0.1
source expression R -> S
unused R value 0.1 -> 0.7
```

verify:

- after `R -> S`, both source and linked snapshot store `S`;
- one Undo restores both source and snapshot to `R`;
- one Redo restores both to `S`;
- changing unused `R` is a separate normal history entry;
- Undo/Redo of the unused variable edit does not modify the linked snapshot;
- every intermediate state passes validation;
- repeated Undo/Redo does not drift expression metadata or preview values.

Do not add a separate history entry for synchronization.

## Regression tests: symbolic expression/provenance

Extend `tests/integration/phase29LinkedCoonsPatches.test.ts`.

### Required full reproduction

Create a valid linked Coons patch with a symbolic source boundary.

Use two variables:

```text
R = 0.1
S = 0.1
```

Then:

1. Confirm the source and its materialized linked snapshot initially store expression `R`.
2. Change only the source expression from `R` to `S` through the normal editor/model update path.
3. Confirm:
   - resolved geometry remains numerically equal;
   - source expression is `S`;
   - the corresponding materialized Coons snapshot expression is also `S`;
   - the complete patch remains valid;
   - link status is `linkedUpToDate`;
   - exactly one history entry represents the source edit plus synchronization.
4. Change the now-unused variable `R` to `0.7`.
5. Confirm:
   - source remains based on `S`;
   - snapshot remains based on `S`;
   - snapshot preview values remain consistent;
   - `validateDiagram` succeeds;
   - link status remains `linkedUpToDate`;
   - sampled patch geometry does not change merely because unused `R` changed.
6. Serialize the diagram.
7. Parse it with the normal saved-diagram JSON parser.
8. Confirm:
   - parsing succeeds;
   - the loaded source and snapshot both store `S`;
   - the loaded diagram validates;
   - linked status is `linkedUpToDate`.
9. Exercise Undo/Redo across both edits and assert source expression, snapshot expression, variable values, status, and validation at every step.

Assert the actual symbolic expression/provenance fields, not only preview coordinates.

### Unrelated edit/no-op regression

Add a focused assertion that changing an unrelated style/name or an unrelated variable:

- does not replace materialized Coons boundaries;
- does not create an extra synchronization history entry;
- leaves source and snapshot semantic fingerprints unchanged.

Use value/deep equality or an existing stable primitive-equality helper; do not rely solely on object identity if the architecture clones diagrams.

### Preserve value-changing symbolic coverage

Keep the existing tests for:

- valid symbolic value changes that refresh geometry;
- symbolic changes that create a stale corner mismatch;
- stale save/load fallback;
- repair and recovery.

The new equality logic must not regress those cases.

## Regression tests: TikZ output

Strengthen the existing TikZ tests so they prove the Coons patch geometry itself changed or remained stable.

### Isolate the Coons block

Use a uniquely named or uniquely identified Coons patch and extract only its TikZ block using the repository’s actual stable output structure.

Prefer:

- an existing helper that emits one stratum;
- a stable comment/name marker already present in generated TikZ;
- or a small test-only extraction helper bounded by known stratum markers.

Do not pass by comparing the whole diagram output while visible source curves also change.

Do not change production TikZ formatting merely to simplify the test.

### Valid refresh assertion

For a valid linked source edit:

- capture the Coons patch block before;
- perform the source edit and synchronization;
- capture the Coons patch block after;
- assert the block changed;
- assert a coordinate or control value unique to the refreshed Coons snapshot appears;
- assert the obsolete patch coordinate does not remain in the relevant location.

The visible source curve’s own TikZ output must not be capable of satisfying this assertion.

### Stale fallback assertion

For an invalid linked source edit:

- capture the last-valid Coons patch block;
- make the linked patch stale;
- assert the source’s own block changes where appropriate;
- assert the isolated Coons patch block retains the last-valid fallback coordinates;
- assert export does not use the invalid candidate.

### Inline-math assertion

Add focused linked-Coons coverage for inline-math TikZ mode.

Assert on the isolated patch output that:

- refreshed or fallback Coons coordinates are present as expected;
- output remains valid inline-math form;
- no blank lines are introduced;
- existing 4-space indentation rules are preserved where applicable;
- linked metadata itself does not leak into TikZ.

Avoid brittle full-file snapshots unless that is already the repository convention.

## Regression tests: duplication remapping

Strengthen the duplication test to verify every boundary role explicitly:

```text
bottom
right
top
left
```

Requirements:

- duplicate the Coons patch and all source strata in the same operation;
- assign distinguishable source IDs to all four roles;
- set at least one path role to `reversed: true`;
- preferably set another path role to `reversed: false`;
- if a point role is used, verify its `kind: 'point'` and remapped `sourcePointId`;
- assert each duplicated role points to the corresponding duplicated source;
- explicitly assert the `top` role;
- assert each path role preserves its original `reversed` value;
- assert the original patch links remain unchanged;
- assert materialized snapshots are independently cloned;
- assert the duplicated patch remains valid and linked up to date.

Do not satisfy the test with only a generic loop that could silently omit a role from the fixture. It is acceptable to use a loop after first asserting the expected four-role key set exactly.

Keep any existing patch-only duplication semantics unchanged.

## Scope constraints

Do not:

- redesign Phase 29;
- introduce a general dependency graph;
- change the Coons formula or sampling;
- resolve source strata during rendering, SVG export, or TikZ export;
- weaken validation;
- change JSON schema/version unless absolutely required;
- change creation defaults;
- change stale fallback semantics;
- remove symbolic expressions from linked snapshots;
- globally deep-compare entire diagrams or strata;
- rematerialize patches for style/name/selection-only edits;
- alter ruled surfaces;
- perform unrelated UI or documentation cleanup;
- add dependencies.

Keep the production diff focused on equality/fingerprinting and any minimal helper extraction required for correctness. Test-only extraction helpers are acceptable.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH node --test tests/integration/phase29LinkedCoonsPatches.test.ts tests/model/diagramIds.test.ts
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
git diff --cached --check
git diff main --check
```

Also run any focused symbolic-coordinate, serialization, duplication, undo, and TikZ test files modified by the fix.

Perform a read-only reproduction of:

```text
R=0.1 -> source expression S=0.1 -> unused R=0.7
```

and report:

- source expression;
- snapshot expression;
- link status;
- `validateDiagram` result;
- serialized reload result.

If the local dev server cannot bind because the sandbox denies `listen`, report that limitation accurately. Do not claim browser verification was performed.

## Acceptance criteria

This targeted Phase 29 fix is complete only when:

- equal-valued source expression changes trigger linked snapshot synchronization;
- source and snapshot both store `S` after `R=0.1 -> S=0.1`;
- changing unused `R` afterward cannot invalidate the diagram;
- status does not incorrectly report up to date for semantically obsolete snapshots;
- JSON round-trip succeeds;
- Undo/Redo keeps source and snapshot expressions coherent in one transaction;
- unrelated edits do not cause unnecessary rematerialization;
- TikZ regressions isolate and verify the Coons patch block;
- stale fallback TikZ coordinates are tested;
- linked inline-math formatting is tested;
- duplication tests cover bottom, right, top, left, and at least one preserved `reversed: true`;
- all prior Phase 29 tests continue to pass;
- focused tests, the full suite, build, and all diff checks pass.

## Report after implementation

Report:

- files modified;
- root cause of the equal-valued symbolic-expression defect;
- the distinction introduced between geometric equality and persisted semantic equality;
- fields included and excluded from the new fingerprint/comparison;
- synchronization call sites affected;
- how status now determines up-to-date versus stale;
- how unnecessary rematerialization is avoided;
- Undo/Redo behavior verified;
- JSON round-trip behavior verified;
- TikZ block extraction/assertions added;
- stale fallback and inline-math TikZ coverage added;
- duplication role/reversal assertions added;
- focused test results;
- full `npm test` result;
- `npm run build` result;
- lint result, if run;
- `git diff --check` result;
- `git diff --cached --check` result;
- `git diff main --check` result;
- read-only reproduction result;
- manual browser verification performed or the exact reason it was unavailable;
- remaining known limitations.
