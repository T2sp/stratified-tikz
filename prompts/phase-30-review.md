# Phase 30 Review Prompt: Inspector duplicate-and-translate for Coons patches

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

PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

If the focused Phase 30 test has a different implemented filename, run that
exact file instead and report the command. If no focused file exists, identify
the equivalent tests, run them directly, and assess whether their coverage is
sufficient rather than silently skipping focused verification.

Run lint only if the repository is already established as repository-wide
lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat unrelated pre-existing repository-wide lint debt as a required
Phase 30 gate.

## Project context

You are reviewing Phase 30 in the current StratifiedTikZ repository:

```text
https://github.com/T2sp/stratified-tikz
```

Read before reviewing:

- `AGENTS.md`;
- `prompts/phase-30-implement.md`;
- `prompts/phase-30-fix.md`;
- `prompts/phase-29-implement.md`;
- `prompts/phase-29-fix.md`;
- `docs/ROADMAP.md`;
- `docs/RULED_SURFACES.md`;
- `docs/DATA_MODEL.md`;
- `docs/EDITING.md`;
- the model, translation, linked-Coons, Inspector, App/editor-state,
  undo/redo, serialization, rendering, SVG, TikZ, and test files changed by
  Phase 30;
- `scripts/automation/run-phase.mjs`;
- `package.json`, including the explicit `npm test` file list.

Search for every Phase 30 helper and every changed exhaustive `coonsPatch`
branch. Do not assume the obvious files are the only relevant change sites.

Phase 30 should add one compact Inspector action for exactly one selected Coons
patch:

```text
Duplicate & translate
  dx
  dy
  dz
  [Duplicate & translate]
```

One valid action must:

1. leave the original patch unchanged;
2. leave all original boundary source paths, points, and coordinate anchors
   unchanged;
3. create one deep-cloned Coons patch with a globally unused top-level ID;
4. remove active boundary links from the copy;
5. translate all four materialized boundaries exactly once by one global 3D
   vector;
6. preserve the original metadata required by the implementation prompt;
7. append one static copy;
8. select the copy;
9. commit exactly one undoable diagram edit.

The required state matrix is:

| Original before action | Original after action | Translated copy |
| --- | --- | --- |
| Static | Static and unchanged | Static |
| Linked — up to date | Linked, up to date, and unchanged | Static |
| Linked — stale | Linked, stale, and unchanged | Static frozen fallback |

The translated copy must never retain active `boundarySources`.

This is intentionally different from the existing generic Phase 29
patch-only duplicate operation. An ordinary untransformed duplicate may keep
links to original sources. Phase 30 independently translates only the copied
materialized geometry, so keeping those active links would allow later
synchronization or load to replace the translation or mark the copy stale.

Phase 30 must preserve the snapshot-based architecture:

- `bottom`, `right`, `top`, and `left` snapshots remain the geometry used by
  sampling, Preview, SVG export, and TikZ export;
- no render-time source lookup is added;
- no persistent linked-patch transform offset is added;
- no source-tree duplication is added;
- generic Phase 29 duplication and link-remapping semantics remain unchanged.

Preserve existing behavior unless Phase 30 explicitly changes it, including:

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
relying on the implementation report, test counts, button labels, or source-text
matching.

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

Prioritize geometry correctness, model integrity, original/copy independence,
persistence, and history semantics over style preferences.

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
- Exact commands and results, including `git diff --check` and lint status.

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
- `suggested_fix_prompt` must be targeted to verified findings when fixes are
  needed;
- do not mark Phase 30 complete merely because tests pass;
- do not fail Phase 30 solely for unrelated pre-existing lint debt;
- do not put Markdown fences around the final JSON markers and object.

## Severity guidance

### Critical

Examples include:

- the operation mutates, deletes, or corrupts the original patch;
- the operation mutates or moves original boundary source paths, source points,
  or coordinate anchors;
- invalid, partial, non-finite, or corner-inconsistent Coons geometry is
  committed;
- shallow aliasing causes an ordinary edit to the copy to mutate the original;
- an ID collision overwrites, aliases, or makes existing diagram data
  ambiguous;
- the result cannot be saved, loaded, rendered, sampled, or exported;
- Undo/Redo corrupts the diagram, loses the original, loops, or progressively
  drifts geometry;
- Phase 30 silently damages existing static, linked, or stale Coons patches.

### Medium

Examples include:

- the translated copy retains active `boundarySources`;
- links are removed only after the central synchronizer sees the copy;
- a source edit, source deletion, source repair, full synchronization, or JSON
  load snaps the copy back or relinks it;
- stale/frozen snapshots are refreshed from broken sources or current variables
  instead of copying the exact last-valid materialized model;
- `boundarySnapshotState: 'frozen'` is lost when it is required for stable
  save/load behavior;
- one or more boundary roles, constant points, controls, absolute points, or
  frame origins are missed or translated twice;
- frame basis vectors or work-plane-local `a`/`b` values are translated
  incorrectly;
- the copy is not independently deep-cloned as required;
- top-level ID allocation omits labels, coordinate anchors, or reserved dangling
  linked-source IDs;
- style, layer, sampling, orientation, or other required metadata is lost;
- the Inspector action appears for ineligible selections or is unavailable for
  an eligible editable Coons patch;
- the UI is not wired to the production operation/editor-state path;
- hidden, locked, or filtered editability policy is bypassed;
- invalid, incomplete, non-finite, unknown-variable, or zero input mutates
  diagram, selection, or history;
- duplication and translation require more than one Undo step;
- success does not select the copy as required;
- JSON, Preview, SVG, or TikZ uses inconsistent geometry;
- rendering or export resolves source strata at runtime;
- generic Phase 29 duplication/link-remapping behavior regresses;
- required high-risk behavioral regression coverage is missing or source-text
  matching is the only UI proof.

### Low priority

Examples include minor wording, layout, accessibility, or status-copy issues
that do not obscure the action or change semantics; small accurate documentation
omissions; or harmless avoidable work after correctness is established.

Do not downgrade a functional, persistence, independence, or history failure to
Low priority merely because it affects an edge-case boundary kind.

## Goal under review

Phase 30 is complete only when one selected Coons patch can be duplicated and
globally translated through the production Inspector as one atomic operation,
with the original and sources untouched, a static independent copy, correct
last-valid frozen behavior, globally safe IDs, exact geometry translation,
one-step Undo/Redo, stable save/load, and consistent SVG/TikZ output.

## Review checklist

### 1. Architecture and scope

Check that:

- one typed pure operation helper performs the model-level duplicate and
  translation work;
- production code and tests reuse that helper rather than duplicating behavior;
- the helper does not depend on React state;
- sampling, rendering, and export continue consuming materialized snapshots;
- `sampleCoonsPatch` does not accept or look up the whole `Diagram`;
- no general dependency graph, linked transform model, or persistent offset was
  introduced;
- no source-tree duplication or source movement was introduced;
- no JSON version/schema change was introduced;
- no unjustified dependency or broad Inspector/history/bulk-editing rewrite was
  added;
- generic Phase 29 patch-only and patch-plus-source duplicate behavior remains
  unchanged outside the new action.

Medium issues include render-time source lookup, persistent offset metadata,
duplicated source ecosystems, or a broad architecture change outside Phase 30.

### 2. Inspector eligibility and production wiring

Verify that the new section is shown only when selection resolves to exactly one
stratum satisfying:

```ts
geometricKind === 'sheet'
kind === 'curvedSheet'
primitive.kind === 'coonsPatch'
```

Check its absence for:

- no selection;
- multi-selection;
- coordinate selections;
- free text labels;
- points and curves;
- polygon and work-plane-filled sheets;
- ruled surfaces;
- hemispheres and saddles.

Check that:

- `dx`, `dy`, and `dz` are global 3D translation inputs;
- direct Inspector input does not use cursor snap;
- accessible labels and a descriptive action name/title exist;
- draft strings are UI-only and accept temporary states such as ``, `.`, `.5`,
  `-`, and `1e`;
- invalid drafts show a useful warning without mutation;
- status is reset or re-keyed when the selected patch changes;
- the form calls the production App/editor-state callback and the same operation
  helper tested by the suite;
- the feature is not “tested” only by reading component source text.

Medium issues include incorrect gating, no production wiring, or stale UI state
that applies the operation to the wrong selected patch.

### 3. Operation ordering and static-copy policy

Inspect the candidate diagram immediately before the central history commit.

Required order:

```text
locate and validate source patch
-> validate translation
-> allocate globally unused ID
-> deep-clone source patch
-> assign copy ID
-> remove copy.boundarySources
-> detach/validate unsupported coordinate references as required
-> translate all four materialized boundaries
-> validate complete primitive and diagram
-> append copy
-> one central commit
```

Check that:

- the copy has no active `boundarySources` before
  `commitDiagramChange`/linked synchronization;
- the original retains its exact link metadata and materialized geometry;
- original source paths, points, and coordinate anchors are neither duplicated
  nor moved;
- optional snapshot `id`, `sourceId`, and `name` provenance is retained where
  valid but is never treated as an active link;
- links are not inferred from snapshot provenance;
- a static original yields a static copy;
- a healthy linked original remains linked and yields a static copy;
- a stale linked original remains stale and yields a static frozen copy.

After creation, verify the copy remains static and translated after:

- an original source edit;
- an original source deletion;
- repair of the original stale link;
- changed-source synchronization;
- full synchronization;
- save/load;
- Undo/Redo.

Retained active links, detach-after-commit ordering, or any snap-back/relink is at
least Medium.

### 4. Last-valid frozen snapshot semantics

For a linked stale original, check that Phase 30:

- deep-copies the exact saved/displayed `bottom`, `right`, `top`, and `left`
  last-valid snapshots;
- does not require broken or missing sources to resolve;
- does not partially rebuild roles whose sources still resolve;
- does not replace snapshots with invalid current source geometry;
- preserves `boundarySnapshotState: 'frozen'` on the static copy;
- preserves stored numeric previews, symbolic expressions, and coordinate
  provenance according to the frozen model;
- does not independently refresh frozen snapshots on JSON load.

Review a regression where current diagram variables differ from the values
captured in frozen snapshots.

For an evaluated translation delta `d`, require:

```text
translated preview = stored frozen preview + d
```

and reject:

```text
translated preview = reevaluate(old expression, current variables) + d
```

Check that expression addition uses typed parser/formatter helpers rather than
raw unvalidated string concatenation.

Frozen preview drift, loss of required frozen state, or dependence on broken
sources is Medium; committed invalid geometry may be Critical.

### 5. Exact translation semantics

The operation must apply one global finite non-zero vector:

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
- all duplicated occurrences of shared Coons corners receive the same original
  vector, not a cumulative vector;
- frame `u`, `v`, and `normal` are unchanged;
- work-plane-local `a` and `b` remain unchanged when their frame origin moves;
- symbolic intent is preserved with finite preview values;
- coordinate references follow the existing sampled-curved-sheet detach policy;
- all four Coons corner equations still hold;
- sampling values and mesh topology are unchanged;
- the complete sampled mesh is finite.

For numeric geometry, require an assertion for every sampled vertex within the
existing tolerance:

```text
copyMesh[i] = sourceMaterializedMesh[i] + translation
```

Partial translation, double translation, incorrect frame behavior, or changed
sampling is at least Medium.

### 6. Deep clone, IDs, and preserved metadata

#### Deep-clone independence

Check value equality and object identity for:

- source/copy stratum objects;
- style objects and imported/local style metadata;
- primitives;
- sampling objects;
- all four boundary snapshots;
- segment arrays;
- segment objects;
- endpoints and controls;
- constant-point coordinates;
- retained symbolic and source metadata.

Edit the copy through a normal operation after creation and verify the original
does not change.

Shallow sharing that can mutate the original is Critical. Missing required
independent clone coverage is Medium.

#### Global ID allocation

Check that the operation reuses the established deterministic global allocator
and reserves all current top-level namespaces, including:

- strata;
- free text labels;
- coordinate anchors;
- dangling linked-Coons path/point source IDs reserved by Phase 29;
- IDs already allocated by repeated Phase 30 operations.

Check collision chains such as:

```text
patch
patch-copy       (label)
patch-copy-1     (coordinate anchor)
patch-copy-2     (reserved dangling source ID)
```

Repeated successful actions must allocate distinct deterministic IDs. Undo/Redo
must restore the same saved duplicate ID rather than regenerate it.

Optional boundary snapshot provenance IDs must not be regenerated as top-level
diagram IDs.

An actual collision/data ambiguity is Critical. An incomplete allocator or
missing collision coverage is Medium.

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
- `boundarySnapshotState` under the frozen policy.

Do not require user-facing names to become unique unless the existing generic
duplicate policy already does so.

### 7. Input validation and atomic failure

Check reuse of the existing `TranslationVector` and shared translation parser.

Verify behavior for:

- valid numeric deltas;
- supported scalar-expression deltas;
- incomplete drafts;
- syntactically invalid expressions;
- unknown variables;
- `NaN` and `Infinity`;
- expressions evaluating to non-finite values;
- the zero vector.

Phase 30 requires a non-zero vector. Zero input should produce the documented
warning without creating an overlapping copy.

For every failure, verify:

- the original diagram data is unchanged;
- no copy is appended;
- no partially translated object is exposed;
- the original patch and sources are unchanged;
- selection is unchanged;
- history `past`, `present`, and `future` are unchanged;
- no persistent ID reservation or success status is created.

The helper should return the original diagram object or an equivalent unchanged
diagram after failure.

Committed partial/non-finite geometry may be Critical. Other mutation on invalid
input is Medium.

### 8. Selection, layer filters, visibility, and locking

On success, check that:

- the newest duplicate becomes a single stratum selection;
- inherited layer is preserved;
- current layer filter is preserved when compatible;
- normal selection/filter cleanup runs when the copy is not editable under the
  current state;
- hidden/locked-layer policy is not bypassed;
- stale creation/geometry drafts are cleared only according to the existing
  duplicate-operation policy;
- selection and form/status state are not serialized in `Diagram`.

On failure, selection and editor state must remain coherent and unchanged except
for transient local validation copy.

Do not require Phase 30 to persist selection in diagram history. After Redo,
selection need only follow existing history policy and refer to existing data.

Wrong copy selection, editability bypass, or corrupted selection/filter state is
Medium.

### 9. Undo/Redo and linked synchronization

One button action must create one complete final candidate and use one central
commit.

Reject implementations equivalent to:

```text
commit duplicate
commit detach
commit translate
```

or:

```text
commit duplicate
React effect detaches/translates later
```

Check that:

- one success adds exactly one history entry;
- linked synchronization runs inside the same commit boundary without a second
  history update;
- one Undo removes the complete translated copy and leaves the original intact;
- Undo clears a selection that points to the removed copy through existing
  cleanup;
- one Redo restores the same duplicate ID and exact geometry;
- repeated Undo/Redo creates no drift, regenerated IDs, extra copies, or extra
  history entries;
- failed/zero submissions create no history entry;
- appending the static copy does not rematerialize the unchanged linked
  original.

Multiple Undo steps, a synchronization-only entry, or geometry drift is Medium;
history/data corruption is Critical.

### 10. Save/load and model lifecycle

Check that:

- Phase 30 adds no new persistent model field or file-version bump;
- the result serializes as an ordinary static Coons patch with no
  `boundarySources`;
- static translated geometry round-trips exactly;
- frozen static copies retain `boundarySnapshotState: 'frozen'` and authoritative
  translated previews;
- full linked-Coons synchronization before/after load ignores the static copy;
- load never infers links from snapshot provenance;
- UI drafts, validation status, and selection are absent from JSON;
- the complete loaded diagram validates and remains editable.

An unloadable or corrupt file is Critical. Recreated links, geometry drift, or
lost required state is Medium.

### 11. Sampling, Preview, SVG, and TikZ

Check that:

- source and copy render together in SVG Preview;
- isolated copy mesh geometry is translated by the requested vector;
- SVG export uses the translated materialized snapshots;
- TikZ export uses the same translated snapshots;
- stale/frozen copies export their authoritative translated fallback;
- style, fill/stroke opacity, layer order, visibility, and sampling are
  preserved;
- the Coons formula, mesh topology, and sampling limits are unchanged;
- no source resolution moved into sampling/rendering/export;
- standalone output remains human-readable;
- TikZ indentation remains 4 spaces;
- inline-math output contains no blank lines.

Inconsistent Preview/export geometry, source lookup during rendering, or a
formatting regression is Medium. Unrenderable/unexportable output may be
Critical.

### 12. Tests

Inspect assertions, not only test names or counts.

Require meaningful coverage for:

1. pure helper eligibility and ineligible IDs/kinds;
2. real production Inspector gating and callback/state transition;
3. static numeric duplicate;
4. complete four-role mesh translation;
5. constant-point boundaries;
6. representative line, cubic, arc/frame, concatenated, and sampled-template
   boundary geometry;
7. frame origin versus basis/local-coordinate policy;
8. deep-clone identity and later copy editing;
9. healthy linked original to static translated copy;
10. source edit/delete plus changed-source and full synchronization without
    snap-back;
11. stale linked original to static frozen translated copy;
12. frozen symbolic preview with variables diverged from saved preview values;
13. symbolic translation expressions and finite previews;
14. top-level ID collisions across strata, labels, anchors, and reserved linked
    source IDs;
15. repeated action ID allocation;
16. metadata, layer, style, opacity, sampling, and orientation preservation;
17. invalid/incomplete/non-finite/unknown/zero atomic failure;
18. success/failure selection behavior and filter/lock gating;
19. exactly one Undo/Redo transaction without drift;
20. JSON round-trip and full synchronization;
21. SVG and TikZ translated geometry and formatting;
22. generic Phase 29 duplicate/link-remapping regression;
23. layer/bulk operations, ruled surfaces, and other curved sheets unaffected.

The production-behavior regression must not be replaced by:

- source-text matching alone;
- only calling `translateStratum`;
- only calling generic `duplicateSelectedElements`;
- a hand-built final diagram;
- a test-only fake implementation;
- checking only that a label or button exists.

Check that every new test file is actually listed in `npm test` when the script
enumerates files explicitly.

Missing coverage for the static-link ordering, frozen preview authority,
global-ID collision, production UI path, or one-step history branch may be a
Medium issue even when lower-level tests pass.

### 13. Documentation, automation, and regressions

Check that:

- `docs/ROADMAP.md` contains the implemented Phase 30 scope;
- `docs/EDITING.md` explains the single-selection Inspector action and global
  unsnapped translation;
- `docs/RULED_SURFACES.md` explains that the copy is always static and original
  sources are neither duplicated nor moved;
- stale/frozen last-valid copy behavior is documented accurately;
- one-step Undo/Redo is documented;
- rotation, scale, drag placement, source-tree duplication, and linked transform
  offsets are documented as out of scope where relevant;
- `docs/DATA_MODEL.md`, if changed, states accurately that no new saved Phase 30
  field is required;
- docs do not claim the generic Phase 29 patch-only duplicate is now always
  static;
- `scripts/automation/run-phase.mjs` registers
  `"30": "coons-patch-duplicate-translate"`;
- Phase 30 implement, fix, and review prompt paths resolve through the existing
  automation convention.

Documentation must describe implemented behavior, not aspirational behavior.

Also verify no regressions to:

- linked/static Coons creation;
- stale fallback/recovery and detach;
- generic bulk and layer duplicate/translation;
- coordinate-reference detachment;
- symbolic import;
- layer filtering/locking;
- Preview performance and mesh caching;
- ruled surfaces and other curved sheets.

An automation or minor accurate-doc omission may be Low. Documentation that
misstates static/link/frozen semantics or leads users to expect unsafe linked
translation is Medium.

## Verification and reporting

Run the focused Phase 30 tests separately, using the exact implemented filename:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run lint only when the repository is already lint-clean and report whether it
was run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report exact commands, exit status, test counts, and relevant failures. Do not
hide pre-existing failures; distinguish them from Phase 30 regressions with
evidence.

If browser/manual verification is available, verify:

1. static Coons duplicate-and-translate through the real Inspector;
2. linked original remains linked while the translated copy reports `Static`;
3. original source edit does not move the copy;
4. full synchronization does not snap the copy back;
5. stale/missing-source original copies its displayed last-valid geometry;
6. frozen symbolic preview does not drift after a variable change;
7. incomplete, invalid, non-finite, unknown-variable, and zero input creates no
   copy;
8. hidden/locked/filter behavior remains coherent;
9. one-step Undo and Redo;
10. repeated action creates distinct copies;
11. JSON save/load;
12. SVG export;
13. standalone TikZ export;
14. inline-math TikZ export.

If manual verification is unavailable, say so explicitly. Do not claim it was
performed.

Phase 30 is ready to commit only when focused tests, the complete test suite,
build, and `git diff --check` pass and no Critical or Medium issue remains.
