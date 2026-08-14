# Phase 30 Review Prompt: Split Inspector Duplicate and Translate actions for Coons patches

## Environment

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

PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

If this Phase 30 fix changes another production file, run a separate targeted
lint probe for every such file and report the exact result. Do not broaden the
review into repository-wide lint cleanup. In particular,
`src/ui/inspector/EditableInspector.tsx` has an unrelated pre-existing
`react-hooks/set-state-in-effect` issue; report that exact limitation if the
file must be linted, but do not make the existing debt a Phase 30 requirement.

Do not add dependencies.

## Project context

You are reviewing Phase 30 in the current StratifiedTikZ repository:

```text
https://github.com/T2sp/stratified-tikz
```

Read before reviewing:

- `AGENTS.md`;
- `prompts/phase-30-implement.md` as historical context only;
- `prompts/phase-30-fix.md`;
- all of this reconciled review prompt;
- the latest Phase 30 review report, when available;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-fix.md`;
- `docs/ROADMAP.md`;
- `docs/RULED_SURFACES.md`;
- `docs/DATA_MODEL.md`;
- `docs/EDITING.md`;
- `src/App.tsx`, including both current Coons action handlers and the
  `EditableInspector` props;
- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/inspector/StratumInspector.tsx`;
- `src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx`;
- `src/ui/coonsPatchDuplicateTranslation.ts`;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`;
- all model, translation, linked-Coons, editor-state, undo/redo,
  serialization, rendering, SVG, TikZ, and other test files changed by Phase
  30;
- `scripts/automation/run-phase.mjs`, including prompt resolution and
  `REVIEW_JSON` parsing;
- `package.json`, including the explicit `npm test` file list.

The split action contract in `prompts/phase-30-fix.md` and this review prompt
supersedes the combined-action wording in `prompts/phase-30-implement.md`.
Treat the implement prompt as history, do not use its combined operation as an
acceptance condition, and do not rewrite it during this review.

Search for every Phase 30 helper, every App/editor-state action path, and every
changed exhaustive `coonsPatch` branch. Do not assume the obvious files are the
only relevant change sites.

Phase 30 exposes two independent controls for exactly one selected editable
Coons patch:

```text
Duplicate
  [Duplicate]

Translate
  dx
  dy
  dz
  [Translate]
```

There is no combined production action. `Duplicate` is a button independent of
the translation form. `Translate` is the only form submit action. Invalid,
incomplete, non-finite, unknown-variable, or zero translation drafts must not
disable, alter, or otherwise affect Duplicate.

### Duplicate contract

Duplicate takes only the selected patch ID. It must:

1. leave the original patch unchanged;
2. leave all boundary source paths, source points, and coordinate anchors
   unchanged;
3. append one untranslated deep-cloned patch with a globally unused top-level
   ID;
4. preserve the ordinary Phase 29 patch-only link and frozen-snapshot policy;
5. select the new ID as the single selection;
6. commit exactly one diagram edit.

The required Duplicate state matrix is:

| Before Duplicate | Original after Duplicate | New selected patch |
| --- | --- | --- |
| Static | Static and unchanged | Static and untranslated |
| Linked — up to date | Linked and unchanged | Linked to the same sources and untranslated |
| Linked — stale | Linked and stale, unchanged | Linked and stale with exact frozen snapshots |

Duplicate does not accept a translation vector. It does not move, detach,
duplicate, or relink boundary sources. A linked duplicate retains active
`boundarySources` pointing to the same source IDs. This is the existing Phase
29 patch-only duplicate policy, not an exception or an error.

### Translate contract

Translate takes the selected patch ID and one finite, non-zero global
`TranslationVector`. It must:

1. leave all other strata, source paths, source points, and coordinate anchors
   unchanged;
2. remove active `boundarySources` from the target before central linked-Coons
   synchronization;
3. translate all four materialized boundary snapshots exactly once;
4. replace the target at the same array position and with the same top-level
   ID;
5. append nothing and allocate no ID;
6. keep that ID selected;
7. commit exactly one diagram edit.

The required Translate state matrix is:

| Before Translate | Same-ID selected patch after Translate |
| --- | --- |
| Static | Static with every materialized snapshot translated once |
| Linked — up to date | Static; links removed; current materialized snapshots translated once |
| Linked — stale | Static frozen fallback; links removed; stored frozen previews translated once |

For stale symbolic data, require:

```text
translated preview = stored frozen preview + delta
```

Do not accept re-evaluation of the old expression against current variables as
the source of the frozen preview.

Invalid, incomplete, non-finite, unknown-variable, unsupported, missing-ID, or
zero Translate input changes no diagram, selection, links, IDs, or history.

### History contract

Each action is independently atomic. The two-action workflow intentionally
creates two history entries:

```text
H0: original selected patch
H1: after Duplicate, an untranslated patch exists and its new ID is selected
H2: after Translate, that same selected ID is translated and static
```

The first Undo from H2 restores H1, including the duplicated patch's exact
pre-Translate static/link/frozen state. The second Undo removes the duplicated
patch and restores H0. Redo twice restores H1 and H2 without allocating a new
ID or drifting geometry. Do not require a combined transaction for the two user
actions.

Phase 30 must preserve the snapshot-based architecture:

- `bottom`, `right`, `top`, and `left` snapshots remain the geometry used by
  sampling, Preview, SVG export, and TikZ export;
- no render-time source lookup is added;
- no persistent linked-patch transform offset is added;
- no source-tree duplication is added;
- generic Phase 29 duplication and link-remapping semantics remain unchanged.

Preserve existing behavior unless the split Phase 30 contract explicitly
changes it, including:

- the Coons formula, corner equations, sampling limits, and mesh topology;
- linked/static Coons creation and per-role reversal;
- stale fallback, recovery, detach, and source deletion behavior;
- coordinate anchors, coordinate references, and symbolic coordinates;
- work-plane-local coordinates;
- layer operations and generic bulk editing;
- selection, layer filters, visibility, and locking;
- save/load and Undo/Redo;
- SVG Preview and SVG export;
- standalone and inline-math TikZ export;
- 4-space TikZ indentation;
- inline-math output containing no blank lines;
- ruled surfaces and other curved sheets.

## Review instructions

Review Phase 30 only.

Do not modify files.

Review the actual production implementation and test assertions rather than
relying on the implementation report, test counts, button labels, prop names,
or source-text matching.

Inspect staged, unstaged, and committed Phase 30 changes as applicable:

```bash
git status --short
git diff --stat
git diff
git diff --cached --stat
git diff --cached
git log --oneline --decorate -8
```

If the working tree is clean, identify and review the Phase 30 commit range
against its base. State the range reviewed.

For every issue:

- cite the relevant file and line or symbol;
- explain the concrete failure mode;
- distinguish verified behavior from speculation;
- mention the relevant test coverage or missing test;
- state whether the behavior violates the Phase 30 contract or is only a polish
  concern;
- do not report unrelated pre-existing issues unless Phase 30 worsens them.

Prioritize geometry correctness, model integrity, source immutability, link
state, callback wiring, persistence, and history semantics over style
preferences.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and
   `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.

If only Low-priority issues remain, set `"ready_to_commit": true`.

Use this human-readable structure:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
- Exact commands and results.

**Build Results**
- Exact commands and results, including targeted lint and `git diff --check`.

**Ready To Call Phase 30 Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt limited to the verified findings.
```

Then output exactly:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Rules:

- counts must be numbers;
- `summary` must be exactly `"pass"` or `"needs_changes"`;
- `ready_to_commit` must be `false` if any Critical or Medium issue exists;
- only Low-priority findings may leave `ready_to_commit` as `true`;
- `suggested_fix_prompt` must be limited to verified findings when fixes are
  needed;
- do not mark Phase 30 complete merely because tests pass;
- focused tests, the complete test suite, build, and `git diff --check` are
  required;
- do not fail Phase 30 solely for unrelated pre-existing lint debt;
- do not put Markdown fences around the final JSON markers and object.

## Severity guidance

### Critical

Examples include:

- either action mutates, deletes, or corrupts the original source patch in
  place;
- either action mutates or moves boundary source paths, source points, or
  coordinate anchors;
- invalid, partial, non-finite, or corner-inconsistent Coons geometry is
  committed;
- shallow aliasing lets an ordinary edit to a duplicated patch mutate the
  original or an earlier history snapshot;
- an ID collision overwrites, aliases, or makes existing diagram data
  ambiguous;
- a result cannot be saved, loaded, rendered, sampled, or exported;
- Undo/Redo corrupts the diagram, loses data, loops, or progressively drifts
  geometry;
- the split actions silently damage existing static, linked, or stale Coons
  patches.

### Medium

Examples include:

- Duplicate translates geometry, accepts or depends on a translation vector,
  or is blocked by an invalid Translate draft;
- Duplicate removes ordinary patch-only links, changes frozen snapshots, moves
  sources, or produces the wrong static/linked/stale state;
- Duplicate does not deep-clone the patch or does not allocate a globally safe
  deterministic ID;
- Translate appends a new patch, allocates or changes an ID, moves the wrong
  array item, or changes stratum count;
- Translate retains active `boundarySources`, or removes them only after the
  central synchronizer sees the candidate;
- Translate re-evaluates stale frozen previews from current variables or broken
  sources instead of adding the delta to stored previews;
- a source edit, source deletion, source repair, synchronization, or JSON load
  resets or relinks an H2 static result;
- `boundarySnapshotState: 'frozen'` is lost when required for stable fallback
  behavior;
- one or more boundary roles, constant points, controls, absolute points, or
  frame origins are missed or translated twice;
- frame basis vectors or work-plane-local `a`/`b` values are translated
  incorrectly;
- style, layer, sampling, orientation, label metadata, link state, or other
  required metadata is lost;
- either control appears for an ineligible selection or is unavailable for an
  eligible editable Coons patch;
- a callback is dropped or swapped at any production forwarding boundary;
- Duplicate calls Translate, Translate calls Duplicate, a patch ID changes in
  transit, or `dx`, `dy`, or `dz` is omitted or swapped;
- the App handler does not apply the result to the App-used editor state;
- hidden, locked, or filtered editability policy is bypassed;
- invalid Translate input mutates diagram, selection, links, IDs, or history;
- either individual action creates other than one history entry;
- the Duplicate-then-Translate workflow does not produce exactly H0 -> H1 ->
  H2 with two independent history entries;
- the first Undo does not restore exact H1 link/frozen state, or the second Undo
  does not remove the duplicated patch;
- success selects the wrong ID or Translate fails to retain the same selected
  ID;
- JSON, Preview, SVG, or TikZ uses inconsistent geometry;
- rendering or export resolves source strata at runtime;
- generic Phase 29 duplication/link-remapping behavior regresses;
- behavioral coverage is missing for any boundary in the complete production
  callback chain;
- leaf controls with manually supplied operation callbacks plus SSR markup are
  the only production UI proof.

### Low priority

Examples include minor wording, layout, accessibility, or status-copy issues
that do not obscure either control or change semantics; small accurate
documentation omissions; or harmless avoidable work after correctness is
established.

Do not downgrade a functional, persistence, independence, wiring, link-state,
or history failure to Low priority merely because it affects an edge-case
boundary kind.

## Goal under review

Phase 30 is complete only when one selected editable Coons patch exposes
independent Duplicate and Translate controls through the production Inspector.
Duplicate must append and select one untranslated Phase 29-compatible deep
clone. Translate must detach and replace the selected target at the same ID
with geometry shifted by one global vector. The actions must preserve sources,
frozen preview authority, safe IDs, exact geometry, snapshot-based save/load and
export, and the two-entry H0 -> H1 -> H2 history contract.

## Review checklist

### 1. Architecture and scope

Check that:

- typed, hook-free production helpers or editor-state transitions implement
  Duplicate and Translate as distinct operations;
- Duplicate reuses the established Phase 29 patch-only cloning, global ID, and
  link semantics rather than introducing a divergent clone implementation;
- Translate reuses the shared Coons translation machinery and performs an
  immutable same-ID replacement;
- App uses the exact operation/controller seam exercised by full-chain tests;
- production behavior is not recreated in test-only callback composition;
- sampling, rendering, and export continue consuming materialized snapshots;
- `sampleCoonsPatch` does not accept or look up the whole `Diagram`;
- no general dependency graph, linked transform model, persistent offset, or
  source-tree duplication was introduced;
- no JSON version/schema change was introduced;
- no unjustified dependency or broad Inspector/history/bulk-editing rewrite was
  added;
- generic Phase 29 patch-only and patch-plus-source behavior remains unchanged.

Medium issues include a second divergent clone/translation implementation,
render-time source lookup, persistent offset metadata, duplicated source
ecosystems, test-only wiring, or a broad architecture change outside Phase 30.

### 2. Inspector eligibility and complete production wiring

Verify that the two controls are shown only when selection resolves to exactly
one editable stratum satisfying:

```ts
geometricKind === 'sheet'
kind === 'curvedSheet'
primitive.kind === 'coonsPatch'
```

Check their absence for:

- no selection;
- multi-selection;
- coordinate selections;
- free text labels;
- points and curves;
- polygon and work-plane-filled sheets;
- ruled surfaces;
- hemispheres and saddles;
- hidden, locked, or filtered-out selections under the established policy.

Check that:

- Duplicate is a standalone button, not a translation form submit action;
- Duplicate receives only the selected patch ID;
- Translate is the only form submit action;
- `dx`, `dy`, and `dz` are global 3D translation inputs;
- direct Inspector input does not use cursor snap;
- accessible labels and descriptive action names/titles exist;
- controlled draft strings accept temporary states such as ``, `.`, `.5`, `-`,
  and `1e`;
- invalid drafts show a useful warning without affecting Duplicate or editor
  state;
- local status is reset or re-keyed when the selected patch changes.

Trace callback identity and arguments through the complete production path:

```text
CoonsPatchActionsControls
-> CoonsPatchActionsEditor
-> StratumInspector
-> EditableInspector
-> App Duplicate/Translate handlers
-> App-used editor-state transition
```

Require a behavioral test beginning at the actual Duplicate click and actual
Translate form submission. The test must reach the App-used state transition
through every forwarding prop above and observe resulting diagram, selection,
and history state. Deleting, dropping, or swapping either callback at any layer
must make the test fail.

Leaf `CoonsPatchActionsControls` tests with manually injected callbacks remain
useful supplemental coverage. Full `EditableInspector` SSR markup and gating
tests also remain useful. Neither, alone or together, proves the complete
production chain. Missing behavioral proof for any forwarding boundary is at
least Medium.

### 3. Separate operation ordering and state policy

Inspect each candidate diagram immediately before its central history commit.

Required Duplicate order:

```text
locate and validate source patch ID
-> allocate a globally unused top-level ID
-> deep-clone through the Phase 29 patch-only path
-> preserve the exact static/link/stale/frozen state
-> append the untranslated patch
-> select its new ID
-> commit once
```

Required Translate order:

```text
locate and validate target patch ID
-> validate and normalize the finite non-zero vector
-> remove target boundarySources
-> translate all four stored materialized boundaries exactly once
-> validate the complete primitive and candidate diagram
-> replace the target at its original array position and ID
-> keep the same ID selected
-> commit once
```

For Duplicate, check that:

- the original retains exact link metadata and materialized geometry;
- the new patch is untranslated;
- healthy and stale linked inputs retain active links to the same source IDs;
- exact frozen snapshots remain frozen without refresh or translation;
- source strata and coordinate anchors are neither duplicated nor moved.

For Translate, check that:

- no active `boundarySources` reach central linked-Coons synchronization on the
  target;
- no stratum is appended and no top-level ID is allocated;
- the original array order and target ID remain exact;
- source strata, coordinate anchors, and unrelated strata remain unchanged;
- optional snapshot `id`, `sourceId`, and `name` provenance remains valid but is
  never inferred as an active link.

After H2, verify source edit, source deletion, repair, changed-source
synchronization, full synchronization, save/load, and Undo/Redo cannot reset or
relink the static translated result.

Wrong Duplicate link semantics, wrong same-ID/append behavior, or detach after
the synchronizer sees the target is at least Medium.

### 4. Healthy and stale linked snapshot semantics

For a healthy linked Duplicate, check that:

- the original and new patch remain linked to the same sources;
- both materialized snapshots are initially equal and untranslated;
- later normal synchronization follows the established Phase 29 policy;
- no source path, source point, or anchor is cloned or moved.

For a stale linked Duplicate, check that:

- the exact saved/displayed `bottom`, `right`, `top`, and `left` snapshots are
  deep-cloned without refresh;
- the new patch remains linked and stale;
- exact stored numeric previews, symbolic expressions, provenance, and
  `boundarySnapshotState: 'frozen'` are preserved.

For Translate of a healthy linked target, check that active links are removed
before commit and the current materialized snapshots are shifted once.

For Translate of a stale linked target, check that Phase 30:

- does not require broken or missing sources to resolve;
- does not partially rebuild roles whose sources still resolve;
- does not replace snapshots with invalid current source geometry;
- removes active links before commit;
- retains `boundarySnapshotState: 'frozen'` for authoritative fallback
  lifecycle behavior;
- preserves symbolic expressions and coordinate provenance using typed
  expression builders;
- does not independently refresh frozen snapshots on JSON load.

Review a regression where current diagram variables differ from values captured
in frozen snapshots. For evaluated delta `d`, require stored preview plus `d`
and reject reevaluation of the old expression against current variables plus
`d`. Raw unvalidated expression-string concatenation is not sufficient.

Frozen preview drift, wrong Duplicate link/frozen state, loss of required
frozen state, or dependence on broken sources is Medium; committed invalid
geometry may be Critical.

### 5. Exact Translate geometry semantics

Translate applies one global finite non-zero vector:

```text
P' = P + (dx, dy, dz)
```

Check every boundary role:

- `bottom`;
- `right`;
- `top`;
- `left`.

Check representative nested geometry:

- constant-point boundaries;
- line endpoints;
- cubic-Bezier endpoints and control points;
- arc endpoints, absolute points, and stored frame origins;
- concatenated boundary path segments;
- sampled template boundary segments;
- work-plane-local stored frame origins;
- symbolic coordinate components.

Verify that:

- every absolute coordinate is translated exactly once;
- duplicated occurrences of shared Coons corners receive the same original
  vector, not a cumulative vector;
- frame `u`, `v`, and `normal` remain unchanged;
- work-plane-local `a` and `b` remain unchanged when their frame origin moves;
- symbolic intent and finite preview values are preserved;
- coordinate references follow the existing sampled-curved-sheet policy;
- all four Coons corner equations still hold;
- sampling values and mesh topology remain unchanged;
- the complete sampled mesh remains finite;
- the target's top-level ID and array position remain unchanged.

For numeric geometry, require an assertion for every sampled vertex within the
existing tolerance:

```text
meshAfterTranslate[i] = meshBeforeTranslate[i] + translation
```

Partial or double translation, a swapped vector component, incorrect frame
behavior, changed sampling, ID replacement, or append behavior is at least
Medium.

### 6. Duplicate deep clone, IDs, and preserved metadata

#### Deep-clone independence

For Duplicate, check value equality and object independence for:

- original/new stratum objects;
- style objects and imported/local style metadata;
- primitives;
- sampling objects;
- all four boundary snapshots;
- segment arrays;
- segment objects;
- endpoints and controls;
- constant-point coordinates;
- retained link, symbolic, provenance, and source metadata.

Edit the new patch through a normal operation and verify the original does not
change. Translate must also create an immutable same-ID replacement so earlier
history snapshots cannot be mutated.

Shallow sharing that can mutate the original or history is Critical. Missing
required identity coverage is Medium.

#### Global ID allocation

Check that Duplicate reuses the established deterministic global allocator and
reserves every current top-level namespace, including:

- strata;
- free text labels;
- coordinate anchors;
- dangling linked-Coons path/point source IDs reserved by Phase 29;
- IDs already allocated by repeated Duplicate actions.

Check collision chains such as:

```text
patch
patch-copy       (label)
patch-copy-1     (coordinate anchor)
patch-copy-2     (reserved dangling source ID)
```

Repeated successful Duplicate actions allocate distinct deterministic IDs.
Undo/Redo restores saved IDs rather than regenerating them. Translate allocates
no ID and preserves the selected ID exactly.

Optional boundary snapshot provenance IDs must not be regenerated as top-level
diagram IDs.

An actual collision/data ambiguity is Critical. An incomplete allocator,
Translate ID change, or missing collision coverage is Medium.

#### Metadata

Verify preservation of:

- name under the existing ordinary element duplicate policy;
- `codim: 1`;
- `geometricKind: 'sheet'`;
- `kind: 'curvedSheet'`;
- layer;
- style, opacity, and imported/local style metadata;
- attached label metadata, if present;
- sampling;
- boundary role order and materialized orientation;
- `boundarySnapshotState` under the action-specific frozen policy.

Duplicate preserves active links when present. Translate intentionally removes
only active `boundarySources` and changes only translated materialized geometry;
all other required metadata remains stable. Do not require user-facing names to
be unique unless the existing generic duplicate policy already does so.

### 7. Input validation and independently atomic failure

Check that Duplicate accepts only the selected patch ID and does not read,
parse, validate, or receive the Translate draft/vector.

Check that Translate reuses the existing `TranslationVector` and shared parser.
Verify behavior for:

- valid numeric deltas;
- supported scalar-expression deltas;
- incomplete drafts;
- syntactically invalid expressions;
- unknown variables;
- `NaN` and `Infinity`;
- expressions evaluating to non-finite values;
- the zero vector;
- missing or ineligible target IDs.

Translate requires at least one non-zero component. For every Translate
failure, verify:

- diagram data and object values are unchanged;
- no target replacement or append occurs;
- no partially translated object is exposed;
- sources and anchors are unchanged;
- selection is unchanged;
- history `past`, `present`, and `future` are unchanged;
- no ID is allocated or persistently reserved;
- no success status is produced.

Also verify an actual Duplicate click still succeeds while Translate drafts are
invalid or zero. A successful new edit must follow normal history-`future`
clearing policy; failure must leave `future` untouched.

Committed partial/non-finite geometry may be Critical. Other mutation on
invalid input, or any coupling between Duplicate and translation validation, is
Medium.

### 8. Selection, layer filters, visibility, and locking

After Duplicate, check that:

- the new ID becomes the single stratum selection;
- inherited layer is preserved;
- current layer filter is preserved when compatible;
- normal selection/filter cleanup runs under existing policy.

After Translate, check that:

- the same target ID remains the single selection;
- no selection points to an appended or newly allocated object;
- hidden/locked/filter rules remain enforced.

For both actions, check that stale creation/geometry drafts are cleared only
according to existing editor-operation policy and that selection/form/status
state is not serialized in `Diagram`.

On failure, selection and persistent editor state remain unchanged except for
transient local validation status. Tests must observe exact production
selection transitions through H0, H1, H2, Undo, and Redo. Do not require Phase
30 to add selection-history persistence; existing missing-selection cleanup
must remain coherent.

Wrong selection, an editability bypass, or corrupted selection/filter state is
Medium.

### 9. Two-entry Undo/Redo and linked synchronization

Duplicate and Translate each create one complete final candidate and each use
one central history commit. Reject implementations that split either action
across multiple commits or defer model changes to a React effect.

Require this exact diagram history:

```text
H0 -> Duplicate -> H1 -> Translate -> H2
```

Check that:

- Duplicate increments history `past` by exactly one;
- Translate increments `past` by exactly one more;
- each successful action follows the normal new-edit `future` policy;
- H1 contains the untranslated patch at its saved new ID and exact
  static/link/stale/frozen state;
- H2 has the same IDs and stratum count as H1, with the selected patch replaced
  by translated static geometry;
- Undo once restores exact H1, including active links and frozen snapshots;
- Undo twice removes the duplicated patch and restores H0;
- Redo once restores exact H1 without regenerating an ID;
- Redo twice restores exact H2 without geometry drift;
- repeated Undo/Redo adds no copies, commits, IDs, or drift;
- failed actions add no history entry;
- central synchronization creates no separate history entry;
- H1 ordinary linked behavior and H2 detached static behavior are preserved.

One history entry for the entire two-action workflow, more than one entry for
either individual action, wrong H1 restoration, synchronization-only entries,
or geometry drift is Medium; history/data corruption is Critical.

### 10. Save/load and model lifecycle

Check that:

- Phase 30 adds no new persistent model field or file-version bump;
- H1 serializes according to its actual Duplicate state: static remains static,
  healthy linked remains linked, and stale linked retains exact frozen state;
- H2 serializes as the same top-level ID with static translated geometry and no
  active `boundarySources`;
- H1 and H2 round-trip exactly;
- frozen previews remain authoritative through load;
- normal full synchronization may update an H1 linked duplicate according to
  Phase 29, but ignores the detached H2 target;
- load never infers links from snapshot provenance;
- UI drafts, validation status, and selection are absent from JSON;
- the complete loaded diagram validates and remains editable.

An unloadable or corrupt file is Critical. Wrong H1 link state, recreated H2
links, geometry drift, or lost required frozen state is Medium.

### 11. Sampling, Preview, SVG, and TikZ

Check that:

- H1 contains original and untranslated duplicate geometry, even when they
  overlap visually;
- H2 contains the original plus the same duplicated ID at translated geometry;
- rendered SVG Preview asserts actual translated coordinates after H2;
- SVG export uses the translated materialized snapshots;
- standalone and inline-math TikZ assert actual translated coordinates;
- stale/frozen H2 output uses authoritative translated fallback values;
- style, fill/stroke opacity, layer order, visibility, and sampling remain
  preserved;
- the Coons formula, mesh topology, and sampling limits remain unchanged;
- no source resolution moves into sampling/rendering/export;
- standalone output remains human-readable;
- TikZ indentation remains 4 spaces;
- inline-math output contains no blank lines.

Inconsistent Preview/export geometry, source lookup during rendering, or a
formatting regression is Medium. Unrenderable/unexportable output may be
Critical.

### 12. Tests

Inspect assertions, not only test names or counts. Keep existing focused
regressions and require meaningful coverage for:

1. separate Duplicate and Translate helper/editor-state eligibility;
2. split production Inspector labels, layout, and gating;
3. leaf event parsing, including invalid/zero drafts not affecting Duplicate;
4. static, healthy-linked, and stale-linked Duplicate matrices;
5. static, healthy-linked, and stale-linked Translate matrices;
6. Duplicate deep-clone identity and later independent editing;
7. globally safe deterministic IDs across strata, labels, anchors, and
   reserved source IDs;
8. Translate same-ID/same-index/no-append behavior;
9. complete four-role translation including constant points, line, cubic,
   arc/frame, concatenated, and sampled-template geometry;
10. frame-origin versus basis/local-coordinate policy;
11. source path, source point, coordinate anchor, and unrelated-stratum
    immutability;
12. frozen symbolic preview with variables diverged from stored preview values;
13. symbolic translation expressions and finite previews;
14. invalid/incomplete/non-finite/unknown/zero atomic failure;
15. hidden, locked, filter, and selection behavior;
16. exact H0 -> H1 -> H2 history and two-action Undo/Redo without drift;
17. JSON round-trip and synchronization at H1 and H2;
18. actual translated SVG coordinates;
19. actual translated standalone and inline-math TikZ coordinates and
    formatting;
20. generic Phase 29 patch-only and patch-plus-source regression behavior;
21. layer/bulk operations, ruled surfaces, and other curved sheets unaffected.

In addition, require a focused behavioral regression using a linked input that
starts from the actual production events and traverses the complete callback
chain.

For the actual Duplicate click, require assertions that:

- the App Duplicate handler is reached exactly once;
- the exact selected source patch ID reaches it;
- no translation vector is passed;
- the App Translate handler is not called;
- one untranslated linked patch is appended;
- the original and all sources remain unchanged;
- the new ID is the single selection;
- history `past` increases by exactly one;
- history `future` follows normal new-edit policy.

After rerendering/rebinding production composition to H1 and its selected new
ID, submit the actual Translate form with distinct values such as:

```text
dx = 1.25
dy = -2.5
dz = 3.75
```

Require assertions that:

- the App Translate handler is reached exactly once;
- the exact selected H1 ID reaches it;
- vector components arrive with no omission or swap;
- the Duplicate handler is not called again;
- stratum count, IDs, and ordering do not change from H1;
- the same ID becomes translated static geometry with links removed;
- that ID remains selected;
- history `past` increases by exactly one more;
- resulting history is exactly H0 -> H1 -> H2;
- Undo once restores untranslated linked H1;
- Undo twice removes the duplicated patch;
- Redo twice restores the same ID and translated geometry without drift.

The full-chain requirement is not satisfied by any combination of only:

- direct calls to `CoonsPatchActionsControls` with test-owned callbacks;
- a leaf harness lambda that directly calls an editor-state helper;
- direct helper/editor-state-helper tests;
- `EditableInspector` SSR markup or eligibility assertions;
- callback prop-name or source-text checks;
- callback identity inspection at one layer without invoking the event;
- separately testing an App controller and leaf component without connecting
  the intervening production forwarding layers;
- a test-only parallel callback composition.

If a small production test seam was required, verify that App itself uses the
exact seam, the test obtains callbacks from the App-owned render/composition
path, the real leaf handlers traverse every production component, and the test
observes the same resulting state. Constructing `EditableInspector` directly
with imported helper callbacks is insufficient because it would not fail if
App stopped supplying or swapped its real props.

Check that the focused file remains explicitly listed in `npm test`. Missing
coverage for any production forwarding boundary, Duplicate link semantics,
Translate detach ordering, frozen preview authority, global-ID collisions, or
H0/H1/H2 history is Medium even when lower-level tests pass.

### 13. Documentation, automation, and regressions

Check that implemented documentation accurately describes:

- separate single-selection Inspector Duplicate and Translate controls;
- Duplicate as untranslated Phase 29 patch-only behavior;
- healthy and stale linked Duplicate results retaining exact links/snapshots;
- global unsnapped `dx`, `dy`, and `dz` Translate input;
- Translate as same-ID replacement with links removed before movement;
- sources and anchors remaining unchanged;
- stored frozen preview plus delta behavior;
- one history entry per action and the H0 -> H1 -> H2 workflow;
- unsupported rotation, scale, drag placement, source-tree duplication, and
  linked transform offsets where relevant;
- no new saved Phase 30 model field.

Documentation must not claim that every Duplicate result is static, that
Translate appends or allocates a patch, or that the two-action workflow is one
transaction.

Also check that:

- `prompts/phase-30-implement.md` remains unchanged historical context and its
  combined wording is explicitly superseded by the split fix/review contract;
- `scripts/automation/run-phase.mjs` still registers
  `"30": "coons-patch-duplicate-translate"`;
- Phase 30 implement, fix, and review paths resolve through the existing
  automation convention;
- the human report sections and exact machine-readable JSON markers/schema in
  this prompt remain intact.

Verify no regressions to:

- linked/static Coons creation;
- stale fallback/recovery and detach;
- generic bulk and layer duplicate/translation;
- coordinate-reference detachment;
- symbolic import;
- layer filtering/locking;
- Preview performance and mesh caching;
- ruled surfaces and other curved sheets.

An automation or minor accurate-doc omission may be Low. Documentation that
misstates Duplicate links, Translate detachment/same-ID semantics, frozen
previews, or two-entry history is Medium.

## Verification and reporting

Run the focused Phase 30 tests first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Run the minimum targeted lint gate:

```bash
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Lint any other changed production file separately and report the exact result,
including any identified pre-existing rule failure.

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Report exact commands, exit status, test counts, and relevant failures. Do not
hide pre-existing failures; distinguish them from Phase 30 regressions with
evidence.

Inspect this reconciled prompt with targeted searches for old combined-action
and single-transaction language. Every match must be removed or explicitly
identified as rejected historical context; identifiers such as the existing
test filename and automation slug do not define product semantics.

If browser/manual verification is available, verify through the real Inspector:

1. select a healthy linked Coons patch;
2. click `Duplicate` and confirm one untranslated linked patch with a new ID is
   selected while the original and sources remain unchanged;
3. enter distinct `dx`, `dy`, and `dz` values;
4. click `Translate` and confirm the same selected ID moves and becomes static;
5. Undo once and confirm the unshifted linked H1 state returns;
6. Undo again and confirm the duplicated patch is removed;
7. Redo twice and confirm the same H1 then H2 IDs and geometry return;
8. repeat the state checks with static and stale-linked inputs;
9. verify a stale Translate uses stored frozen previews plus the delta after a
   variable change;
10. verify invalid and zero Translate drafts leave state unchanged and do not
    prevent Duplicate;
11. verify hidden/locked/filter behavior;
12. verify JSON save/load and full synchronization at H1 and H2;
13. verify SVG export;
14. verify standalone and inline-math TikZ export.

If manual verification is unavailable, report the exact limitation. Do not
claim it was performed. An environment-level inability to bind the development
server does not waive the automated full-chain regression.

Phase 30 is ready to commit only when focused tests, targeted lint, the complete
test suite, build, and `git diff --check` pass; the complete production callback
chain is behaviorally covered; and no Critical or Medium issue remains.
