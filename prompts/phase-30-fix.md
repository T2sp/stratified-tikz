# Phase 30 Targeted Fix Prompt: Reconcile the split-action review gate and test the full production callback chain

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

If this fix changes another production file, include it in a targeted lint
probe and report the result. `EditableInspector.tsx` currently has an unrelated
pre-existing `react-hooks/set-state-in-effect` issue; do not turn that existing
debt into a Phase 30 requirement or perform broad lint cleanup.

Do not add dependencies.

## Latest review findings

The latest Phase 30 review found no Critical issue and no Low-priority issue. It
found exactly two Medium issues.

### Medium 1: contradictory release contracts

`prompts/phase-30-fix.md` superseded the original combined action with separate
Inspector actions:

```text
Duplicate
Translate
```

Production and tests implement that split contract. However,
`prompts/phase-30-review.md` still treats this as normative:

```text
Duplicate & translate
```

and still requires one atomic operation that appends an already translated
static copy. Under the current fix prompt the production implementation is
correct; under the literal review gate the required feature is absent. A note
that the fix prompt supersedes the review prompt is not sufficient: the review
prompt itself is executed by automation and must be reconciled.

### Medium 2: full production callback chain is not behaviorally tested

The focused test behaviorally exercises the leaf
`CoonsPatchActionsControls` component by manually injecting callbacks that call
editor-state helpers. Separate SSR coverage checks full `EditableInspector`
markup and eligibility, but does not invoke its callbacks.

Consequently, the tests do not execute this complete production path:

```text
actual Duplicate button / actual Translate form
-> CoonsPatchActionsEditor
-> StratumInspector
-> EditableInspector
-> production App callback
-> App-used editor-state transition
```

A dropped or swapped callback at any forwarding boundary could pass. The
current forwarding appears correct by inspection; this is a verified coverage
gap, not a reproduced runtime defect.

## What the review confirmed correct

The latest review confirmed the following behavior and coverage. Preserve it;
do not reimplement it unless the new full-chain regression exposes a concrete
defect:

- the production Inspector exposes separate `Duplicate` and `Translate`
  controls;
- `Duplicate` reuses Phase 29 deep-clone, global-ID, and patch-only link
  semantics;
- `Translate` performs a same-ID replacement and removes active links before
  translation and central synchronization;
- stale/frozen previews use stored values plus the delta and do not drift after
  variable changes;
- original source paths, source points, coordinate anchors, and unrelated
  strata remain unchanged;
- static, healthy-linked, and stale-linked state matrices are correct;
- eligibility, hidden/locked/filter behavior, selection, deterministic IDs,
  two-step Undo/Redo, and atomic failure are covered;
- save/load and synchronization remain snapshot-based;
- generic Phase 29 duplication behavior remains unchanged;
- rendered SVG tests assert actual translated coordinates;
- standalone and inline-math TikZ tests assert actual translated coordinates;
- the previously reported unused imports are resolved;
- focused tests, the full suite, build, targeted Phase 30 lint, and
  `git diff --check` pass.

Passing these existing regressions remains required, but they are not new fix
work.

## Goal

Make only these two targeted changes:

1. Rewrite `prompts/phase-30-review.md` so the automated Phase 30 release gate
   reviews the implemented split `Duplicate` and `Translate` contract.
2. Add a behavioral regression that invokes both actions through the complete
   production Inspector-to-App callback chain and verifies exact diagram,
   selection, and history transitions.

Do not change production Duplicate/Translate behavior unless the new regression
demonstrates an actual production defect. If it does, make the smallest typed
fix and add a root-cause assertion.

## Required reading before fixing

Read at least:

- `AGENTS.md`;
- this prompt in full;
- `prompts/phase-30-implement.md` as historical context only;
- all of `prompts/phase-30-review.md`;
- the latest Phase 30 review report if it is available in the execution
  context; otherwise use this prompt's `Latest review findings` section as the
  authoritative summary;
- `src/App.tsx`, including `duplicateCurrentCoonsPatch`,
  `translateCurrentCoonsPatch`, and the `EditableInspector` props;
- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/inspector/StratumInspector.tsx`;
- `src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx`;
- `src/ui/coonsPatchDuplicateTranslation.ts`;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`, especially:
  - the `CoonsPatchActionsControls` harness;
  - the production controls interaction test;
  - the full `EditableInspector` SSR/gating test;
  - exact history and selection tests;
- `scripts/automation/run-phase.mjs`, especially review prompt resolution and
  `REVIEW_JSON` parsing;
- `package.json`.

Trace callback identity and arguments at every production forwarding boundary.
Inspect assertions, not only test names or counts.

## Normative split contract

Use this concise contract when rewriting the review gate and when evaluating the
new integration test.

### Inspector

For exactly one selected editable Coons patch, Inspector exposes two independent
controls:

```text
Duplicate
  [Duplicate]

Translate
  dx
  dy
  dz
  [Translate]
```

There is no combined production `Duplicate & translate` action.

`Duplicate` is a button independent of the translation form. `Translate` is the
only form submit action. Invalid or zero translation drafts do not affect
Duplicate.

### Duplicate

`Duplicate` takes only the selected patch ID. It appends one untranslated,
deep-cloned copy with a globally safe ID, selects that copy, and commits one
history entry.

| Before Duplicate | Original after Duplicate | New selected copy |
| --- | --- | --- |
| Static | Static and unchanged | Static, untranslated |
| Linked — up to date | Linked and unchanged | Linked to the same sources, untranslated |
| Linked — stale | Linked and stale, unchanged | Linked and stale with exact frozen snapshots |

This is the existing Phase 29 patch-only duplicate policy. Duplicate does not
move or duplicate boundary sources and does not detach links.

### Translate

`Translate` takes the selected patch ID and one finite non-zero global
`TranslationVector`. It replaces that patch at the same ID and array position,
keeps it selected, appends nothing, and commits one history entry.

| Before Translate | Same-ID selected patch after Translate |
| --- | --- |
| Static | Static with all materialized snapshots translated once |
| Linked — up to date | Static; links removed before commit; current snapshots translated once |
| Linked — stale | Static frozen fallback; links removed before commit; stored frozen previews translated once |

Translation never moves source strata or anchors. For stale symbolic data:

```text
translated preview = stored frozen preview + delta
```

not a re-evaluation against current variables.

Invalid, incomplete, non-finite, unknown, or zero translation input changes no
diagram, selection, link, ID, or history state.

### History

Each action is independently atomic:

```text
H0: original patch
H1: after Duplicate, untranslated copy exists and is selected
H2: after Translate, that same copy ID is translated and static
```

The first Undo restores H1, including the copy's exact pre-Translate link and
frozen state. The second Undo removes the copy and restores H0. Redo restores H1
and H2 without new IDs or geometry drift.

The two user actions intentionally create two history entries. Do not require a
single combined transaction.

## 1. Reconcile `phase-30-review.md`

Update the review prompt itself. Do not rely on another superseding note.

### Required contract changes

Rewrite every normative combined-action section, including:

- title and Project context;
- UI sketch and goal under review;
- architecture/helper expectations;
- Inspector eligibility and production wiring;
- operation ordering;
- static, healthy-linked, and stale-linked state matrices;
- deep clone, metadata, and ID expectations;
- translation and frozen-preview expectations;
- validation and atomic failure;
- selection and history;
- save/load, synchronization, SVG, and TikZ;
- required tests;
- manual verification;
- documentation checks;
- final readiness criteria.

The revised review prompt must assess Duplicate and Translate separately using
the normative split contract above.

Remove or rewrite requirements that say or imply:

- one form submission duplicates and translates;
- every Duplicate result is static;
- translation allocates or appends a copy;
- deep clone, detach, translate, append, and select form one transaction;
- one Undo removes a translated copy;
- invalid translation means no Duplicate occurred;
- retaining links on an ordinary linked Duplicate is an error;
- more than one Undo step for a Duplicate-then-Translate workflow is an error.

The review prompt may mention the former combined action only as rejected
historical context. It must not leave it as an acceptance condition, severity
example, test requirement, or manual step.

### Review production-wiring requirement

The reconciled review gate must explicitly inspect the complete path:

```text
CoonsPatchActionsControls
-> CoonsPatchActionsEditor
-> StratumInspector
-> EditableInspector
-> App Duplicate/Translate handlers
-> App-used editor-state transition
```

It must treat missing behavioral coverage of a callback forwarding boundary as
at least Medium. Leaf controls with manually supplied test callbacks plus SSR
markup do not prove the full chain.

### Preserve review automation format

Keep the existing human report sections and the exact machine-readable contract:

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

Preserve these rules:

- counts are numeric;
- `summary` is exactly `pass` or `needs_changes`;
- any Critical or Medium finding makes `ready_to_commit` false;
- only Low findings may leave it true;
- a needed fix prompt is limited to verified findings;
- focused tests, full tests, build, and `git diff --check` are required;
- repository-wide pre-existing lint debt alone does not fail Phase 30.

Retain severity distinctions and update examples to the split semantics. In
particular, wrong callback forwarding, wrong Duplicate link semantics, failure
to detach before Translate, wrong same-ID/append behavior, or incorrect
one-entry-per-action/two-step history is Medium unless it causes Critical data
corruption.

### Historical implement prompt

Do not rewrite `phase-30-implement.md` in this targeted fix. The updated review
prompt must state that this split fix contract supersedes the implement prompt's
combined-action wording.

After editing, search `phase-30-review.md` for all combined-action and one-step
phrases and inspect every match in context. Do not use a blind global replace.

## 2. Add a full production callback-chain regression

### Required end-to-end path

Add a focused behavioral regression that starts from the actual production
Duplicate button or Translate form event and reaches the actual App-used
editor-state transition through every production forwarding boundary.

The same test or tightly coupled tests must fail if any of these regressions is
introduced:

- App fails to pass either callback to `EditableInspector`;
- `EditableInspector` drops or swaps the callbacks when creating
  `StratumInspector`;
- `StratumInspector` drops or swaps them when creating
  `CoonsPatchActionsEditor`;
- `CoonsPatchActionsEditor` drops or swaps them when creating
  `CoonsPatchActionsControls`;
- the Duplicate event invokes Translate;
- the Translate event invokes Duplicate;
- the patch ID changes at any boundary;
- `dx`, `dy`, or `dz` is omitted or swapped;
- the App handler fails to apply the result to editor state.

### Duplicate assertions

Through that full production chain, one actual Duplicate click must verify:

- the App Duplicate handler is reached exactly once;
- the exact selected source patch ID reaches it;
- no translation vector is passed;
- the Translate handler is not called;
- one untranslated copy is appended;
- the original remains unchanged;
- the new copy ID becomes the single selection;
- history `past` increases by exactly one;
- history `future` follows the normal new-edit policy.

### Translate assertions

After rebinding/rerendering the production chain to the state and selection
created by Duplicate, submit the actual Translate form with distinct values,
for example:

```text
dx = 1.25
dy = -2.5
dz = 3.75
```

Verify:

- the App Translate handler is reached exactly once;
- the exact newly selected copy ID reaches it;
- the parsed vector components arrive with no omission or swap;
- the Duplicate handler is not called again;
- stratum count and IDs do not change;
- the same copy ID is replaced with translated static geometry;
- that same ID remains selected;
- history `past` increases by exactly one more entry;
- the resulting history is exactly H0 -> H1 -> H2;
- Undo once restores the untranslated copy and its pre-Translate link/static
  state;
- Undo twice removes the copy;
- Redo twice restores the same ID and translated geometry without drift.

Use a linked input for at least one full-chain sequence so a dropped/swap error
cannot be hidden by static-only behavior. Existing lower-level tests may retain
broader static/stale matrices.

### What is not sufficient

Do not close this finding with any combination of only:

- direct calls to `CoonsPatchActionsControls` with test-owned callbacks;
- a test lambda that directly calls `applyDuplicateCoonsPatchToEditorState` or
  `applyTranslateCoonsPatchToEditorState` from the leaf harness;
- direct helper or editor-state-helper tests;
- `EditableInspector` SSR markup/gating;
- checking callback prop names or source text;
- asserting callback identity at one layer without invoking the event;
- separately testing an App controller and leaf component without connecting
  them through the production forwarding chain;
- a test-only parallel callback composition.

Keep the existing leaf interaction and SSR eligibility tests as useful
supplemental coverage, but add the missing full-chain proof.

### Allowed test seam

Use an existing interaction harness if one can drive the complete path. Do not
add a DOM, browser, React-testing, or other dependency.

If the current App-local closures or React hook state make the full chain
inaccessible, extract the smallest typed production App action/controller seam
needed for testing. This is acceptable only when all of the following are true:

- `App` itself uses that exact seam for its real Duplicate and Translate
  handlers;
- the test obtains the callbacks supplied to `EditableInspector` from the
  actual App-owned render/composition path;
- if extraction is required, `App` renders a small production composition
  component whose real callback props are exercised by the test;
- the test starts from the actual leaf click/form handler;
- the test traverses the actual production callback props through
  `CoonsPatchActionsEditor`, `StratumInspector`, and `EditableInspector`;
- the event reaches that App-used seam without a test-owned operation callback
  replacing it;
- the same test observes the resulting diagram, selection, and history;
- deleting or swapping any production forwarding prop makes the test fail.

Constructing `EditableInspector` directly in the test with callbacks imported
from an App helper is insufficient. That arrangement would still pass if the
real App JSX stopped supplying or swapped those props.

Do not export large App internals or redesign global editor state. Prefer a
small hook-free adapter around the existing editor-state operations. Keep
production semantics unchanged unless the test exposes a defect.

## Scope

### Implement

- reconcile `prompts/phase-30-review.md` with the split contract;
- add full production callback-chain behavioral coverage for Duplicate and
  Translate;
- add the smallest shared App test seam only if required;
- fix a production callback defect only if the new regression reproduces it.

### Do not implement

- another redesign of Duplicate or Translate semantics;
- changes to the already-correct state matrices, geometry, frozen policy, ID
  allocation, synchronization, save/load, SVG, or TikZ behavior;
- new SVG/TikZ output formats or duplicate coordinate tests solely for count;
- changes to `phase-30-implement.md`;
- changes to `scripts/automation/run-phase.mjs` or the Phase 30 slug;
- broad product-documentation rewrites;
- a new dependency or test framework;
- unrelated source, test, lint, or formatting cleanup.

Expected changes are primarily `prompts/phase-30-review.md` and the focused
Phase 30 integration test. Production files should change only for a minimal
shared test seam or a defect demonstrated by the new regression.

## Tests and regression preservation

Keep the existing focused assertions for:

- split labels and eligibility;
- leaf event parsing and invalid/zero no-op behavior;
- static/healthy-linked/stale-linked Duplicate and Translate matrices;
- frozen symbolic previews;
- deep-clone and global-ID safety;
- source immutability and synchronization;
- exact two-step Undo/Redo;
- save/load;
- actual SVG coordinates;
- actual standalone and inline-math TikZ coordinates;
- generic Phase 29 duplication behavior.

Do not weaken or replace these tests when adding the full-chain regression.
Ensure the focused file remains in the explicit `npm test` command.

## Manual verification

If the environment permits running the app, verify through the real Inspector:

1. select a linked Coons patch;
2. click `Duplicate` and confirm one untranslated linked copy becomes selected;
3. enter distinct `dx`, `dy`, and `dz` values;
4. click `Translate` and confirm the same copy ID moves and becomes static;
5. Undo once and confirm the unshifted linked copy returns;
6. Undo again and confirm the copy is removed;
7. Redo twice and confirm the same translated copy returns.

The previous review environment could not bind the development server and
reported `listen EPERM`. If manual verification remains unavailable, report the
exact limitation and do not claim it was performed. This does not waive the
automated full-chain regression.

## Verification

Run the focused suite first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Run the established minimum targeted lint gate:

```bash
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

If a new App/controller or Inspector file is changed, lint it separately and
report any exact pre-existing rule failure instead of hiding it or broadening
the fix.

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Also inspect the reconciled review prompt with targeted searches such as:

```bash
rg -n 'Duplicate & translate|one atomic|one-step|translated copy|static copy' \
  prompts/phase-30-review.md
```

Every match must be either removed, updated to split semantics, or clearly
non-normative historical context.

Report exact commands, exit codes, test counts, and failures. Do not hide
pre-existing failures; distinguish them with evidence.

## Acceptance criteria

This targeted fix is complete when:

- `phase-30-review.md` no longer requires the former combined atomic action;
- its title, context, goal, checklists, severity examples, tests, manual steps,
  and readiness rule consistently review separate Duplicate and Translate
  actions;
- its Duplicate/Translate state matrices and two-entry history semantics match
  this prompt;
- it preserves the human report and machine-readable `REVIEW_JSON` contract;
- a behavioral test begins at the actual Duplicate and Translate UI events and
  reaches the App-used editor-state transitions through every production
  callback-forwarding boundary;
- that test fails for a dropped or swapped callback at any layer;
- the test verifies exact IDs/vector arguments and exact diagram, selection,
  and H0/H1/H2 history transitions;
- the full-chain linked sequence proves Duplicate preserves links and Translate
  detaches before moving;
- no production behavior changes unless the new test exposes and documents an
  actual defect;
- all previously correct Phase 30 regressions remain intact;
- focused tests, minimum targeted lint, the full suite, build, and
  `git diff --check` pass.

## Report after implementation

Please report:

- files modified;
- every `phase-30-review.md` section reconciled;
- how you confirmed no combined action remains normative in the review gate;
- how the review's `REVIEW_JSON` automation contract was preserved;
- the exact production callback path exercised by the new test;
- evidence that it is not the existing leaf-only harness;
- how each `CoonsPatchActionsEditor`, `StratumInspector`, `EditableInspector`,
  and App boundary is covered;
- exact Duplicate and Translate callback counts and arguments;
- exact diagram, selection, and H0/H1/H2 history assertions;
- whether the new regression exposed a production defect;
- any production seam introduced and why it was necessary;
- confirmation that existing SVG/TikZ numeric-coordinate regressions remain;
- exact focused-test command/result;
- exact targeted lint command/result;
- exact `npm test` result;
- exact `npm run build` result;
- exact `git diff --check` result;
- manual verification performed or its exact limitation;
- remaining limitations.
