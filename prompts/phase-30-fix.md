# Phase 30 Targeted Fix Prompt: Reject rounded-away Coons translation and cover H1 serialization

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
  src/model/translation.ts \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

git diff --check
```

If another production file changes, include it in a targeted lint probe and
report the exact command and result. Repository-wide pre-existing lint debt is
not a Phase 30 gate. Do not perform broad lint cleanup.

Do not add dependencies.

## Latest review findings

The latest Phase 30 review found no Critical issue and no Low-priority issue.
It found exactly two Medium issues.

### Medium 1: a finite non-zero Translate can succeed without moving geometry

`translateCoonsPatch` accepts a normalized finite non-zero vector and can
return success even when IEEE-754 addition rounds every requested movement
away. Numeric translation currently rejects non-finite results, but it does
not reject a finite addition whose result is the same representable number as
its input.

The review reproduced the defect with a valid static constant-point Coons
patch whose four boundary points all have `x = 1e16`:

```text
translation = (1, 0, 0)
helper result = success
editor action result = success
materialized x coordinates = unchanged
diagram JSON = unchanged
success status = shown
history entries added = 0
```

The history layer correctly suppresses a JSON-equal candidate. The defect is
that the Coons Translate operation reports success even though it produced no
representable geometric translation and therefore no required history entry.

### Medium 2: actual H1 Duplicate states are not serialized

Focused tests cover the static, healthy-linked, and stale-linked Duplicate
state matrix, but every existing Phase 30 save/load assertion serializes an H2
state after Translate. There is no save/load test for the actual untranslated
H1 state immediately after Duplicate.

No production persistence defect was observed. This is a verified high-risk
coverage gap for Phase 29 link metadata and frozen fallback data at the Phase
30 H1 boundary.

## What the review confirmed correct

Preserve the following behavior and coverage. Do not reimplement it unless a
new regression exposes a concrete defect:

- Inspector exposes independent `Duplicate` and `Translate` actions;
- the Phase 30 review gate describes that split contract;
- the focused regression traverses the real production callback chain from
  the Inspector controls through `App`;
- `Duplicate` reuses Phase 29 patch-only duplication, deep cloning,
  deterministic global ID allocation, and linked/frozen snapshot semantics;
- `Translate` replaces the selected patch at the same ID and index and removes
  `boundarySources` before central synchronization;
- stale symbolic translation uses stored frozen previews plus the delta and
  does not re-evaluate changed variables;
- source paths, source points, coordinate anchors, and unrelated strata remain
  unchanged;
- static, healthy-linked, and stale-linked operation matrices are covered;
- eligibility, hidden/locked/filter behavior, selection, deterministic IDs,
  atomic failure, and two-step Undo/Redo are covered;
- H0 -> H1 -> H2 production behavior is covered;
- save/load and synchronization remain snapshot-based;
- generic Phase 29 duplication semantics remain unchanged;
- Preview and rendered SVG assertions use actual translated coordinates;
- standalone and inline-math TikZ assertions use actual translated
  coordinates;
- documentation, automation prompt resolution, and the Phase 30 slug are
  correct;
- no schema change or dependency was introduced;
- the previously reported unused imports and callback-chain coverage gap are
  resolved.

All existing regressions must remain passing. They are preservation
requirements, not invitations to broaden this fix.

## Goal

Make only these two targeted changes:

1. Make Coons Translate reject atomically when a requested non-zero movement
   cannot be represented for required translated geometry, so `ok: true`
   always corresponds to real geometric movement and one normal history
   commit.
2. Add genuine pre-Translate H1 save/load and post-load synchronization tests
   for static, healthy-linked, and stale-linked Duplicate results.

Do not change the successful Duplicate/Translate product semantics described
above.

## Required reading before fixing

Read at least:

- `AGENTS.md`;
- this prompt in full;
- `prompts/phase-30-implement.md` as historical context;
- `prompts/phase-30-review.md`, whose reconciled split contract remains the
  release gate;
- the latest Phase 30 review report if it is available in the execution
  context; otherwise use this prompt's `Latest review findings` section as the
  authoritative summary;
- `src/ui/coonsPatchDuplicateTranslation.ts`, especially
  `translateCoonsPatch` and the editor-state action that commits its result;
- `src/model/translation.ts`, especially numeric coordinate addition, Coons
  boundary traversal, stored-preview handling, and frame translation;
- `src/ui/undo.ts`, especially equality suppression in
  `commitDiagramChange`;
- the Coons validation, sampling, link-status, synchronization, and
  serialization/parsing code used by Phase 29 and Phase 30;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`, including the
  Duplicate state matrix, H0 -> H1 -> H2 callback-chain test, history tests,
  save/load tests, synchronization tests, and SVG/TikZ coordinate assertions;
- the relevant Phase 29 linked-Coons regression tests;
- `package.json`, including the explicit `npm test` registration.

Inspect the actual production code and assertions. Do not infer coverage from
test names or passing counts.

## State terminology

Use these names consistently in tests and the implementation report:

- **H0**: the selected original Coons patch before Duplicate;
- **H1**: the untranslated duplicate immediately after Duplicate and before
  any Translate call;
- **H2**: the same selected duplicate after a successful Translate.

H1 is not interchangeable with an H2 patch translated by a zero vector or a
detached H2 fixture. The new persistence tests must serialize real production
H1 results.

## 1. Reject representationally rounded-away translation

### Success postcondition

A finite normalized vector with at least one non-zero component is necessary,
but it is not sufficient for Coons Translate success.

For every non-zero translation axis, every materialized spatial coordinate or
stored spatial preview that the Coons translation contract requires to move
must have a different representable value after applying that component. If a
required addition is swallowed by IEEE-754 rounding, reject the complete
operation.

For example:

```text
1e16 + 1 === 1e16
```

Therefore a patch containing a required world-space coordinate at `1e16`
cannot be translated successfully by `dx = 1`, even if another smaller
coordinate in the same patch would change.

Do not define success using only one of these weak checks:

- the input vector is finite and non-zero;
- the whole primitive is structurally different;
- the whole diagram JSON is different;
- `boundarySources` or coordinate-reference metadata was removed;
- a symbolic expression string changed;
- at least one point or one axis changed;
- the history helper happened to accept a candidate.

Those checks can allow a partial, non-uniform, or metadata-only result to be
reported as a successful translation.

### Geometry that must be checked

Apply the representability postcondition to the same world-space data that the
existing Coons translation traversal is required to translate exactly once,
including, as applicable:

- `bottom`, `right`, `top`, and `left` materialized boundary snapshots;
- constant-point boundary coordinates;
- line endpoints;
- cubic endpoints and control points;
- arc and other absolute path points;
- concatenated or sampled-template path geometry stored in snapshots;
- numeric previews carried by symbolic coordinate components;
- frozen stored previews when `preserveStored` is required;
- translated frame origins;
- the materialized/sampled Coons geometry used by Preview and export.

Do not require intentionally invariant data to change:

- frame basis vectors `u`, `v`, and `normal`;
- work-plane-local `a` and `b` coordinates when translation is represented by
  moving the frame origin;
- topology, sampling counts, role ordering, orientation, reversal, style, or
  other non-spatial metadata;
- axes whose normalized delta component is zero.

Use exact representable `Number` equality for the swallowed-addition check. A
required movement is rounded away when its post-addition value is equal to its
pre-addition value with `after === before`; treat `-0` and `0` as the same
geometric value. Do not use an epsilon or an approximate model-comparison
helper for this check, because that could reject a small but representable
movement. Also do not require `(after - before) === delta`, because the
subtraction itself may round.

If sampling is derived rather than stored, establish with focused assertions
or an equivalent invariant from the checked primitive that the resulting mesh
moves. The production fix need not add a second broad sampling traversal when
the materialized-coordinate check already proves the same postcondition.
`ok: true` must not produce a Preview/export mesh that stayed fixed on a
requested non-zero axis.

### Safe comparison boundary

For linked or coordinate-referenced patches, link removal and reference
detachment are preparation steps, not geometric movement. Prefer this logical
ordering on a cloned candidate:

1. locate and validate the selected editable Coons patch;
2. normalize and validate the requested vector;
3. clone the selected patch/diagram candidate;
4. remove only the candidate patch's active `boundarySources` as required by
   the existing Translate contract;
5. apply the existing coordinate-reference detachment policy;
6. capture the candidate's materialized geometric baseline;
7. translate through the shared symbolic/frozen-aware machinery;
8. verify every required non-zero-axis movement against that baseline;
9. validate the translated primitive and complete diagram;
10. return success for one normal commit.

This ordering prevents link removal, reference detachment, or expression
metadata from being mistaken for translation. It also keeps the original
diagram and its links available for an atomic failure return.

The exact internal helper shape may differ, but preserve the same observable
ordering and atomicity.

### Atomic failure behavior

When any required movement is not representable:

- return a typed failure, not `ok: true`;
- return or retain the original diagram without committing the candidate;
- do not append, replace, detach, or partially translate a stratum;
- preserve stratum count, order, and every ID;
- preserve the selected patch and selection ID;
- preserve healthy or stale `boundarySources` and
  `boundarySnapshotState` exactly;
- preserve frozen snapshots and stored previews exactly;
- preserve all source strata and coordinate anchors;
- preserve `history.present`, `history.past`, and `history.future` exactly;
- do not allocate an ID;
- do not show the previous translation-success status;
- return a useful precision/representability error in `result.message`.

Under the current helper convention,
`applyTranslateCoonsPatchToEditorState` must return `ok: false` and its exact
input `state` while carrying the precision error in `result.message`. The
`App`/Inspector may display that message as transient UI status outside the
failed editor-state transition, but it must never display the translated
success message. Diagram, selection, link, and history state must not change.

An appropriate user-facing explanation is equivalent to:

```text
Translation is too small to change this Coons patch at its current coordinate scale.
```

Use existing typed result and status conventions; do not add a new persistence
field for the error.

### Forbidden workarounds

Do not fix this issue by:

- forcing a history entry for a JSON-equal diagram;
- weakening `commitDiagramChange` equality suppression;
- returning success because links or metadata changed;
- rounding, clamping, or silently changing the requested vector;
- applying an arbitrary epsilon;
- moving a coordinate to a neighboring float with `nextUp`/`nextDown` instead
  of applying the requested delta;
- introducing arbitrary-precision arithmetic or a new numeric model;
- accepting partial movement when another required coordinate rounded away;
- treating all large coordinates or all small deltas as invalid;
- special-casing only the literal values `1e16` and `1`;
- committing detachment first and translation in a second transaction.

The operation must either represent the requested uniform translation under
the existing numeric model or fail atomically.

### Implementation locality

Prefer a small typed Coons-operation preflight or postcondition near
`translateCoonsPatch`. Change shared `src/model/translation.ts` only if that is
the smallest correct design and all affected translation consumers are
regressed.

Do not turn this targeted fix into a repository-wide floating-point policy
rewrite. Existing ordinary-scale, symbolic, frozen, 2D, work-plane, and all-role
translation behavior must continue to pass.

## 2. Add actual H1 serialization coverage

Use the production Duplicate operation to create each H1 fixture. Serialize
and parse that diagram immediately, before calling Translate.

For all three cases below, assert at least:

- parsing succeeds through the production save/load path;
- the loaded diagram validates;
- ambient dimension and diagram-level data are preserved;
- top-level stratum count, order, and IDs are exact;
- the original patch remains present and unchanged;
- the duplicate retains its exact new ID;
- the duplicate is still untranslated;
- all four materialized boundary snapshots are semantically exact;
- style, opacity, name policy, layer, sampling, `codim`, `geometricKind`, and
  Coons primitive kind are preserved;
- no source stratum or coordinate anchor was duplicated or moved;
- a normal full synchronization after load preserves the expected H1 state.

Diagram persistence does not include Inspector drafts, selection, or undo
history. Do not add them to the schema or assert that they round-trip.

### Static H1

Create a static H0 patch and invoke Duplicate only.

Before and after save/load, assert:

- the original and duplicate are static;
- the duplicate has no `boundarySources`;
- the duplicate's snapshots equal the untranslated H0 materialized snapshots;
- the duplicate's snapshots are independent model data, not aliased mutable
  objects before serialization;
- derived status is exactly `static`;
- full synchronization leaves the loaded duplicate unchanged.

### Healthy-linked H1

Create a healthy linked H0 patch and invoke Duplicate only.

Before and after save/load, assert:

- original and duplicate retain the exact active `boundarySources` role map
  and source IDs;
- both have derived status `linkedUpToDate`;
- the duplicate retains the current untranslated materialized snapshots;
- no source object was duplicated;
- editing a real linked boundary source after load and running the normal
  changed-source synchronization updates both original and duplicate;
- both patches remain linked to the same expected sources after that update.

This is the existing Phase 29 patch-only Duplicate policy. Do not make a
Duplicate-only linked H1 static merely to simplify the test.

### Stale-linked H1

Create a genuinely stale H0 patch by removing one referenced source after
establishing last-valid snapshots, then invoke Duplicate only. Use this exact
missing-source path so the expected derived status is unambiguously
`linkedStale`.

Before and after save/load, assert:

- original and duplicate retain their exact dangling/missing-source
  `boundarySources` metadata;
- the duplicate retains `boundarySnapshotState: "frozen"`;
- all four last-valid materialized snapshots and stored numeric previews are
  exact;
- the sampled frozen mesh remains exact;
- both patches have derived status `linkedStale`;
- missing-source/full synchronization does not clear, partially refresh, or
  drift the frozen fallback;
- reinserting the removed source after load and running the normal Phase 29
  synchronization recovers original and duplicate consistently;
- the recovered patches retain the expected links and return to derived status
  `linkedUpToDate` under the existing Phase 29 recovery policy.

Do not rebuild the stale H1 from currently resolvable source geometry during
parse or synchronization. The serialized frozen fallback is authoritative
while the source problem remains.

### No H1 substitutes

The following do not satisfy this coverage requirement:

- serializing only H2 after Translate;
- translating by zero and calling the result H1;
- manually deleting `boundarySources` from an H2 fixture;
- constructing a duplicate-shaped object without invoking production
  Duplicate;
- checking raw JSON text without parsing it;
- asserting only object counts, statuses, or schema version;
- testing only static H1;
- omitting post-load source synchronization and stale recovery.

No schema or version change is expected. If a production persistence defect is
actually exposed, make the smallest compatible fix and report it explicitly.

## Required focused regressions

Add or extend behavioral tests in
`tests/integration/phase30CoonsDuplicateTranslate.test.ts`.

### Rounded-away Translate matrix

1. **All-role static failure**

   Use a valid static constant-point Coons patch whose `bottom`, `right`,
   `top`, and `left` materialized points all have `x = 1e16`. Translate by
   `(1, 0, 0)` and assert:

   - `translateCoonsPatch` returns `ok: false`;
   - the returned/input diagram is unchanged, preferably retaining the
     original diagram reference under the existing result convention;
   - every boundary and sampled coordinate remains exactly the original;
   - no partial candidate escapes.

2. **Editor-state atomic failure**

   Submit the same valid vector through the production-used editor-state
   action and assert:

   - the action returns failure;
   - seed the fixture with non-empty `history.past` and `history.future` so
     accidental Undo/Redo-stack clearing cannot pass vacuously;
   - diagram, selection, stratum order/IDs, and all persistent data are exact;
   - `history.present`, `history.past`, and `history.future` are exact;
   - no translation-success status is emitted;
   - `result.message` explains numeric scale/representability;
   - the returned `state` is the exact input state under the existing helper
     convention.

3. **Mixed-scale partial-rounding failure**

   Use a valid patch where at least one required coordinate would change by
   `1`, while another required `x = 1e16` coordinate would not. Translate by
   `(1, 0, 0)` and assert the entire operation fails atomically.

   This regression is required so a whole-diagram inequality or
   “at-least-one-point-moved” guard cannot pass.

4. **Linked atomic failure**

   Exercise a healthy-linked patch with a swallowed required movement and
   assert failure preserves its exact `boundarySources`, linked status,
   materialized snapshots, source strata, and history. Link detachment must not
   be mistaken for movement.

5. **Representable control success**

   Use the same large coordinate scale with a representable delta, for example
   `x = 1e16` and `dx = 2`, and assert:

   - the helper and editor action succeed;
   - actual geometry changes;
   - all required points/mesh coordinates obey the normal translation
     contract;
   - stratum count, ID, and array position remain unchanged;
   - a linked target, if used, is detached according to the existing contract;
   - exactly one normal history entry is added.

   Do not blanket-reject large coordinates or all deltas near their precision
   limit.

### H1 persistence matrix

6. Round-trip the production static H1 and verify its unchanged static state
   and full-sync stability.
7. Round-trip the production healthy-linked H1 and verify exact links plus
   post-load source-edit synchronization of original and duplicate.
8. Round-trip the production stale-linked H1 and verify exact frozen fallback,
   missing-source stability, and post-load repair/recovery.

Keep the new tests deterministic. Use semantic model assertions and numeric
coordinates, not source-text matching or comments as proof.

## Scope

### Implement

- a typed, operation-local representability failure for Coons Translate;
- atomic propagation of that failure through the existing editor-state path;
- the rounded-away, mixed-scale, linked-atomicity, and representable-control
  regressions;
- actual static, healthy-linked, and stale-linked H1 save/load/sync tests;
- a minimal persistence fix only if those new H1 tests reproduce a real defect.

Expected implementation files are primarily:

- `src/ui/coonsPatchDuplicateTranslation.ts`;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`.

Touch `src/model/translation.ts` or shared serialization/link code only if
necessary for the smallest correct fix, and explain why.

### Do not implement

- a return to the combined `Duplicate & translate` action;
- changes to the reconciled split-action review contract without a newly
  demonstrated inconsistency;
- a generic numeric-precision framework;
- arbitrary-precision coordinates;
- epsilon-based or neighboring-float movement;
- rotation, scaling, shear, affine transforms, or persistent patch offsets;
- source-tree duplication or source movement during Translate;
- a rewrite of generic Phase 29 Duplicate semantics;
- a rewrite of global history equality behavior;
- a new saved schema or version bump;
- new dependencies;
- broad Inspector, rendering, export, synchronization, or lint refactors;
- unrelated documentation, roadmap, automation, or style cleanup.

## Preserve existing behavior

The complete Phase 30 suite must continue to establish:

- separate production `Duplicate` and `Translate` controls and callbacks;
- real `EditableInspector` -> `StratumInspector` -> action editor -> `App`
  callback wiring;
- Duplicate creates one untranslated H1, selects its globally unique ID, and
  adds exactly one history entry;
- static Duplicate stays static;
- healthy-linked Duplicate retains active links;
- stale-linked Duplicate retains active links and exact frozen snapshots;
- Translate keeps the selected ID and array position and appends no stratum;
- successful linked Translate removes active links before central sync;
- successful stale Translate uses stored frozen preview plus delta;
- ordinary successful Translate adds exactly one history entry;
- invalid, incomplete, non-finite, unknown, and zero vectors remain atomic
  failures;
- Undo/Redo restores H0, H1, and H2 in the existing two-step order without ID
  regeneration or geometric drift;
- full and changed-source synchronization never snap a translated static H2
  back to old sources;
- JSON H2 round trips remain static and snapshot-authoritative;
- Preview, SVG, standalone TikZ, and inline-math TikZ retain their exact
  coordinate and formatting regressions;
- generic Phase 29 duplicate/remap behavior and unrelated strata are
  unchanged;
- TikZ remains readable, uses 4-space indentation, and adds no blank lines in
  inline-math mode.

## Manual verification checklist

If a browser/dev server is available:

1. Select a static Coons patch at ordinary coordinates and confirm Translate
   still succeeds, moves it, and Undo/Redo is one step.
2. Select a healthy-linked patch and confirm a successful Translate detaches
   only that patch and does not move its sources.
3. Duplicate static, healthy-linked, and stale-linked patches; save and reload
   each H1 before translating and inspect its status and geometry.
4. After loading a healthy-linked H1, edit a source and confirm original and
   duplicate both update.
5. After loading a stale-linked H1, confirm its frozen shape remains visible;
   repair the source and confirm normal recovery.
6. If the UI can enter the scale directly, try `x = 1e16`, `dx = 1` and confirm
   a precision error is shown with no movement or history entry.
7. Try the representable control `x = 1e16`, `dx = 2` and confirm success.

If manual verification is unavailable, state that explicitly and do not claim
it was performed. Automated coverage of both review findings remains required.

## Documentation

No documentation, roadmap, slug, or automation change is expected for this
targeted fix. Existing split-action documentation remains normative.

If implementation reveals a direct user-visible contract inconsistency, make
only the necessary correction and explain why it was required. Do not edit
documentation merely to restate test details.

## Verification

Run the focused test first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Then run all required gates:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build

PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/model/translation.ts \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

git diff --check
```

Report exact commands, exit status, and pass/fail counts. If a listed lint file
was not changed, it should still pass the targeted regression probe. If a
different production file changed, lint it too.

Do not treat pre-existing repository-wide lint debt or Vite's non-failing
large-chunk advisory as a Phase 30 failure. Do report them accurately if seen.

## Acceptance criteria

Phase 30 is ready for review only when all of the following are true:

- a finite non-zero vector cannot return Coons Translate success when any
  required movement on a non-zero axis is rounded back to its original
  representable value;
- the `x = 1e16`, `dx = 1` static reproduction returns typed failure and leaves
  diagram, selection, IDs, links, sources, and history unchanged;
- a mixed-scale partial-rounding candidate also fails atomically;
- a failed linked translation retains its active links and frozen/healthy
  state exactly;
- a representable large-scale control such as `x = 1e16`, `dx = 2` moves real
  geometry and creates exactly one history entry;
- success is not manufactured by metadata changes, forced history, epsilon,
  clamping, or an altered vector;
- real production H1 diagrams for static, healthy-linked, and stale-linked
  Duplicate results all round-trip;
- loaded healthy H1 links continue to synchronize both original and duplicate;
- loaded stale H1 frozen data remains stable while broken and recovers under
  the existing Phase 29 source-repair behavior;
- the previously corrected split review gate and full production callback
  regression remain intact;
- existing H0/H1/H2, Undo/Redo, save/load, synchronization, Preview, SVG, TikZ,
  and generic Phase 29 regressions remain passing;
- the focused test, full test suite, build, targeted lint, and
  `git diff --check` all pass;
- no schema change, dependency, or unrelated rewrite was introduced.

## Report after implementation

Report:

- files changed;
- the root cause of the rounded-away success;
- the exact representability rule and where it is enforced;
- which materialized coordinate/previews are checked and which intentionally
  invariant frame/local fields are excluded;
- how linked/reference preparation is kept distinct from actual movement;
- the typed failure and user-visible status behavior;
- evidence that failure preserves diagram, selection, active/frozen links,
  sources, and complete history;
- results for the all-role `1e16 + 1` failure, mixed-scale failure,
  linked-atomicity failure, and `1e16 + 2` success control;
- static, healthy-linked, and stale-linked H1 serialization assertions;
- post-load healthy synchronization and stale recovery results;
- whether shared translation or persistence code changed and why;
- preservation results for the full callback chain, two-step Undo/Redo,
  H0/H1/H2, SVG, standalone TikZ, and inline-math TikZ;
- focused test command and exact result;
- full `npm test` command and exact result;
- build command and exact result;
- targeted lint command and exact result;
- `git diff --check` result;
- manual verification performed, or an explicit statement that it was not
  available;
- any remaining limitations.
