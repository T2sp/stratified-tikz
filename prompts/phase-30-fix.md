# Phase 30 Targeted Fix Prompt: Close Inspector submission and export-coordinate coverage gaps

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

If the fix touches another Phase 30 production file, include that file in the
targeted ESLint command and report the exact command.

Repository-wide lint currently has unrelated pre-existing debt. Do not use that
debt as a Phase 30 failure and do not broaden this fix into repository-wide lint
cleanup. Do not add dependencies.

## Project context

You are applying a targeted follow-up to Phase 30 of StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

Phase 30 adds the Inspector action `Duplicate & translate` for one selected
Coons patch. The reviewed production implementation appears correct:

- the operation deep-clones the materialized patch geometry;
- it allocates a globally safe ID;
- it removes `boundarySources` from the copy before commit;
- it translates all four snapshots;
- it preserves frozen last-valid preview authority;
- it selects the copy and commits one undoable edit;
- the form and App callback appear correctly connected by source inspection.

The review found no Critical issue and no demonstrated production runtime
defect. It found two Medium test-coverage gaps and one Low lint issue:

1. The test named `production Inspector renders the compact section only for
   one Coons patch` server-renders markup, but its callback is explicitly not
   invoked. The separate state-transition test directly calls submission and
   editor-state helpers. No behavioral test proves that the real form forwards
   the selected patch ID and parsed vector through the production callback.
2. The Preview mesh test checks translated vertices, but final TikZ assertions
   check only comments, counts, and formatting, while rendered SVG assertions
   check only element counts. Neither final output is tested for translated
   numeric coordinates.
3. The focused test has four unused type imports:
   `CoonsPatchPrimitive`, `CurvedSheetStratum`, `PathSegment`, and
   `PointStratum`.

Treat those verified findings as the complete fix scope. Do not reimplement
already-correct Phase 30 behavior unless a new behavioral assertion exposes a
real defect.

## Required reading before fixing

Read at least:

- `AGENTS.md`;
- `prompts/phase-30-implement.md`;
- `prompts/phase-30-review.md`;
- the current Phase 30 implementation diff;
- `tests/integration/phase30CoonsDuplicateTranslate.test.ts`, especially:
  - `production state transition selects the copy and commits exactly one
    undoable edit`;
  - `save/load, Preview, SVG data, and TikZ use both static translated meshes`;
  - `production Inspector renders the compact section only for one Coons
    patch`;
  - the `renderInspector` helper;
- `src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx`, including the real
  form `submit` handler;
- `src/ui/inspector/EditableInspector.tsx`;
- `src/ui/inspector/StratumInspector.tsx`;
- the App-level `duplicateAndTranslateCurrentCoonsPatch` callback in
  `src/App.tsx`;
- `src/ui/coonsPatchDuplicateTranslation.ts`, including
  `submitCoonsPatchDuplicateTranslation` and
  `applyDuplicateAndTranslateCoonsPatchToEditorState`;
- the production SVG scene, curved-sheet mesh, `SvgDiagram`, SVG export, and
  projection helpers used by the focused test;
- `src/tikz/generateTikz.ts` and the coordinate formatter used by sampled Coons
  meshes;
- `package.json`, including the explicit `npm test` list.

Inspect actual assertions and event/callback flow. Do not infer behavioral
coverage from test names or line coverage.

## Goal

Close only the three review findings:

1. Add a behavioral regression that submits the real production Inspector form
   and reaches the production callback/editor-state transition.
2. Assert translated numeric geometry in rendered/exported SVG and in both
   standalone and inline-math TikZ.
3. Remove the four unused Phase 30 test imports and make targeted lint pass.

Production behavior should remain unchanged unless one of the new tests
demonstrates a defect. Any necessary production change must be the smallest
typed change that fixes the demonstrated failure and keeps all existing Phase
30 semantics.

## 1. Exercise the real Inspector submission path

### Verified coverage gap

The existing SSR test proves that the section is gated and rendered. Its
`onDuplicateAndTranslateCoonsPatch` callback returns `not invoked during SSR`.
It therefore cannot detect regressions where the real form:

- never invokes the callback;
- forwards the wrong patch ID;
- drops or swaps `dx`, `dy`, or `dz`;
- passes draft strings instead of the parsed `TranslationVector`;
- invokes the callback more than once;
- fails to apply the returned result to editor state.

The existing state-transition test is useful but calls
`submitCoonsPatchDuplicateTranslation` and
`applyDuplicateAndTranslateCoonsPatchToEditorState` directly. Calling those two
helpers separately does not prove the form-to-App wiring.

### Required behavioral regression

Add a test that uses the actual Phase 30 Inspector form submission handler and
routes its callback through the same production editor-state transition used by
the App.

For a valid non-zero input, the test must:

1. render or instantiate the production Coons Inspector form through an
   interaction-capable production seam;
2. enter distinct `dx`, `dy`, and `dz` values through the production input/change
   path so component ordering mistakes are observable;
3. submit the actual `<form>` once;
4. verify `preventDefault` behavior where the harness exposes it;
5. verify the production callback is invoked exactly once;
6. verify it receives the selected patch ID exactly;
7. verify it receives the correctly parsed finite `TranslationVector`, with no
   component swapped or omitted;
8. route that callback through
   `applyDuplicateAndTranslateCoonsPatchToEditorState`, or through a minimal
   App-level production transition shared with the real callback;
9. verify exactly one translated copy is appended;
10. verify the copy becomes the single selected stratum;
11. verify history gains exactly one entry.

Use three distinct values whose signs and magnitudes make accidental component
swaps visible, for example `(1.25, -2.5, 3.75)`.

Also exercise at least:

- one syntactically invalid draft; and
- the zero vector.

Through that same form path, verify both cases:

- do not invoke the mutation callback;
- leave diagram data unchanged;
- leave selection unchanged;
- leave history unchanged;
- do not allocate or append a copy.

Existing helper-level tests for incomplete, non-finite, and unknown-expression
input must remain passing.

### Harness constraints

Prefer an existing interaction/component harness. Do not add React testing,
DOM, browser, or other dependencies solely for this fix.

If the current environment cannot drive hook state directly, extract only the
smallest hook-free typed production form/controller seam needed to expose the
real handler. Both the actual `<form onSubmit>` and the production App path must
use that seam. The test must invoke the handler actually attached by production
code, not a parallel test-only reimplementation.

The following are insufficient by themselves:

- server-rendering markup;
- checking a button label;
- source-text or regular-expression matching;
- invoking only `submitCoonsPatchDuplicateTranslation`;
- invoking only `applyDuplicateAndTranslateCoonsPatchToEditorState`;
- invoking both helpers independently without the form handler between them;
- a callback marked as not expected to run;
- a test-only fake that duplicates production control flow.

Keep the existing selection-gating SSR assertions as supplemental coverage if
they remain useful.

## 2. Assert final SVG coordinates

Extend the focused save/load/Preview/export regression, or add a tightly scoped
test next to it.

The existing `prepareSvgSurfaceGeometry` assertion establishes that the model
and prepared Preview vertices are translated. It does not prove that the final
SVG renderer/exporter consumes the copy's translated geometry.

Use an asymmetric fixture and a non-zero translation that visibly changes the
fixed camera projection. Then:

1. derive the expected copied mesh from the materialized source mesh plus the
   requested delta;
2. render through the production `SvgDiagram` path used by the app;
3. pass the rendered SVG through the production export preparation path when
   that path is available in the existing test environment;
4. identify the copy's emitted curved-sheet face geometry deterministically;
5. parse numeric SVG polygon `points` or path `d` data;
6. compare the emitted copy coordinates with the projected translated mesh
   using the repository's formatting/tolerance policy;
7. prove the asserted copy coordinates differ from the corresponding source
   coordinates.

Assert enough face/vertex coordinates to fail if the copy is rendered at the
source position. Prefer checking all emitted copy face coordinates when a
stable helper already maps mesh faces to SVG points. A carefully chosen set of
distinctive vertices is acceptable only when it unambiguously identifies the
copy and exercises the production coordinate formatter.

Do not satisfy this requirement with:

- element or polygon counts alone;
- `data-curved-sheet-primitive` alone;
- Preview/world-space vertices alone;
- a substring that could belong to the original patch;
- an expected SVG created by the same unverified final-output string.

Keep existing style, element-count, and export-sanitization checks as
supplemental assertions.

## 3. Assert standalone and inline TikZ coordinates

For both:

```ts
generateTikz(diagram)
generateTikz(diagram, { exportMode: 'inlineMath' })
```

verify actual coordinate data emitted for the translated copy.

The test must:

1. isolate the copied Coons patch's sampled-mesh coordinate definitions or the
   coordinate names referenced by its uniquely identified export block;
2. derive expected mesh vertices from the source materialized mesh plus the
   exact delta;
3. parse or compare the emitted numeric coordinates using existing TikZ
   formatting rules and tolerances;
4. assert that translated copy coordinates, not source coordinates, are used;
5. perform the coordinate assertion separately for standalone and inline-math
   output.

Prefer stable structural parsing around the copy's ID/comment and coordinate
names over a whole-file snapshot. Ensure a matching number elsewhere in the
document cannot make the assertion pass accidentally.

Comments such as `Primitive: coonsPatch`, mesh counts, indentation, and the
absence of blank lines remain useful, but they are not proof of geometry.
Retain the existing requirements that:

- standalone output is readable;
- indentation uses multiples of 4 spaces;
- inline-math output has no blank lines.

Do not change TikZ or SVG production code merely to make assertions convenient.
Add a stable semantic attribute or extract a small shared formatter only if
there is no existing deterministic way to associate emitted geometry with the
copy, and explain why that production change is necessary.

## 4. Remove the verified lint errors

Remove these unused type imports from
`tests/integration/phase30CoonsDuplicateTranslate.test.ts`:

- `CoonsPatchPrimitive`;
- `CurvedSheetStratum`;
- `PathSegment`;
- `PointStratum`.

If a new regression genuinely uses one of these types, keeping that now-used
import is acceptable. The targeted ESLint command must finish with no Phase 30
error.

Do not perform unrelated lint cleanup.

## Preserve verified Phase 30 behavior

The review found the following behavior correct and already covered. Keep it
passing; do not redesign it:

- original Coons patch and boundary sources remain unchanged;
- translated copies are deeply cloned, static, and independent;
- `boundarySources` is absent before central synchronization sees the copy;
- static, healthy-linked, and stale-linked originals follow the required state
  matrix;
- stale copies use stored frozen last-valid previews rather than current
  variable re-evaluation;
- all four roles and nested constant/line/cubic/arc/frame geometry translate
  exactly once;
- frame bases and work-plane-local values remain unchanged;
- global ID allocation reserves strata, labels, coordinate anchors, and
  dangling linked-source IDs;
- invalid input is atomic;
- one success creates one Undo/Redo transaction;
- save/load and later linked synchronization cannot snap the copy back;
- generic Phase 29 duplicate and link-remapping semantics remain unchanged;
- no source tree is duplicated or moved;
- sampling, rendering, SVG, and TikZ remain snapshot-based.

If a new behavioral test fails, determine whether the test expectation or
production code conflicts with this contract before editing production code.
Fix a demonstrated production defect narrowly and add a regression for its
exact root cause.

## Scope

### Implement

- one real Inspector form-submission behavioral regression;
- valid callback argument, selection, diagram, and one-entry history
  assertions;
- invalid and zero no-op assertions through that same UI path;
- final rendered/exported SVG translated-coordinate assertions;
- final standalone TikZ translated-coordinate assertions;
- final inline-math TikZ translated-coordinate assertions;
- removal or legitimate use of the four unused test imports;
- the smallest production test seam or bug fix only if required by those tests.

### Do not implement

- a new testing dependency;
- a new browser or DOM framework;
- source-tree duplication;
- linked translated copies or persistent transform offsets;
- rotation, scale, drag placement, or general affine transforms;
- a new rendering, projection, or TikZ architecture;
- a history or Inspector redesign;
- a JSON schema/version change;
- broad documentation changes;
- repository-wide lint cleanup;
- unrelated Phase 30 hardening already shown correct by the review.

Do not change `docs/ROADMAP.md`, `scripts/automation/run-phase.mjs`, or Phase 30
documentation unless a newly demonstrated production fix makes an existing
statement false. Test-only changes are expected unless the new regressions
expose an actual defect.

## Required tests

At minimum, the focused Phase 30 suite must now prove:

1. the real form submits once through the production callback path;
2. exact selected patch ID forwarding;
3. exact parsed `dx`, `dy`, and `dz` forwarding;
4. one appended copy, copy selection, and one history entry;
5. invalid form input invokes no mutation and preserves state;
6. zero-vector form input invokes no mutation and preserves state;
7. rendered/exported SVG contains identifiable translated copy coordinates;
8. standalone TikZ contains identifiable translated copy coordinates;
9. inline-math TikZ contains identifiable translated copy coordinates;
10. source and copy output coordinates cannot be confused;
11. existing Preview, save/load, formatting, and Phase 29 regression assertions
    remain passing.

Tests must exercise production behavior and inspect final numeric output. Do not
replace these assertions with source-text matching, counts, comments, or helper
tests alone.

Ensure `tests/integration/phase30CoonsDuplicateTranslate.test.ts` remains listed
in the explicit `npm test` command.

## Manual verification

If the environment permits running the app, verify:

1. select one Coons patch;
2. enter three distinct non-zero components;
3. submit once and confirm one selected translated copy;
4. try invalid and zero input and confirm no copy;
5. compare Preview with exported SVG;
6. inspect standalone and inline TikZ coordinates for the translated copy;
7. Undo and Redo once.

The review environment could not bind its local development server. If manual
verification remains unavailable, report the exact limitation and do not claim
manual verification was performed. Automated behavioral coverage is still
required.

## Verification

Run the focused test first:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Run targeted lint for every Phase 30 file changed by this fix. At minimum:

```bash
PATH=/opt/homebrew/bin:$PATH npx eslint \
  src/ui/coonsPatchDuplicateTranslation.ts \
  src/ui/inspector/CoonsPatchDuplicateTranslateEditor.tsx \
  tests/integration/phase30CoonsDuplicateTranslate.test.ts
```

Then run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Report exact commands, exit codes, test counts, and failures. If repository-wide
lint is also run, report its pre-existing debt separately; it is not a required
Phase 30 gate.

## Acceptance criteria

The targeted Phase 30 fix is complete when:

- a regression fails if the real Inspector form stops invoking its production
  callback;
- a regression fails if the form forwards the wrong patch ID or any wrong
  translation component;
- valid submission reaches the real editor-state transition once, selects the
  copy, and adds one history entry;
- invalid and zero submissions remain no-ops through that UI path;
- SVG assertions fail if the copy is rendered/exported at source coordinates;
- standalone TikZ assertions fail if the copy uses source coordinates;
- inline-math TikZ assertions fail if the copy uses source coordinates;
- the four reported unused-import errors are gone;
- no production semantics change unless a new test exposes and documents a
  real defect;
- the focused Phase 30 test passes;
- targeted Phase 30 lint passes;
- the complete test suite passes;
- the production build passes;
- `git diff --check` passes.

## Report after implementation

Please report:

- files modified;
- whether either coverage gap exposed a production defect;
- how the real form submission was exercised without a test-only parallel
  implementation;
- the exact patch ID/vector/callback-count assertions;
- invalid and zero UI-path assertions;
- how final SVG geometry was identified and compared;
- how standalone TikZ copy coordinates were identified and compared;
- how inline-math TikZ copy coordinates were identified and compared;
- whether any production test seam or behavior changed, and why;
- unused imports removed or newly used;
- exact focused-test command and result;
- exact targeted ESLint command and result;
- exact `npm test` result;
- exact `npm run build` result;
- exact `git diff --check` result;
- manual verification performed or the reason it was unavailable;
- remaining limitations.
