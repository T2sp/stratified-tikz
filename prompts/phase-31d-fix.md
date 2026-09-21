# Phase 31D Targeted Fix Prompt: Diagnose 3D overlap Alt cycling and finish browser acceptance

## Environment

Work on the current `phase/31d-tex-path-inline-labels` checkout. Preserve the
Phase 31D implementation, fixtures, tests, documentation and all user changes,
including untracked files. Inspect current status first; do not reset the
branch, restore a historical base, or rerun implementation from scratch.

The latest failed parent verification used
`14875dbbf61a2a61e031a40261ab14037e63a43c` plus five modified files:
`docs/PREVIEW_UI.md`, `docs/ROADMAP.md`, `scripts/checkFreeLabelGeometry.mjs`,
`scripts/checkInlineLabels.mjs`, and
`scripts/fixtures/inlineLabelBrowserOracle.ts`. There were no untracked files.
Preserve this added 3D interaction/recovery coverage and its diagnostics, along
with the corrected halo oracle, `scripts/fixtures/inlineLabelComposite.ts`,
and `tests/scripts/inlineLabelComposite.test.ts`. Inspect current status rather
than assuming the working tree still matches the recorded snapshot.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax and the shared parser/adapter/cache/runtime architecture. Limit work
to the failing 3D Alt-cycle assertion and remaining acceptance checks below. Phase
31E settled-export waiting and 31F's combined audit remain deferred.

## Latest execution findings

The supplied report is a **parent verification failure before the next review**.
The preceding independent review did run and found two missing browser cases;
the follow-up has now implemented those cases. Do not describe them as still
absent, reuse the preceding review as approval of the changed harness, or
invent a new `REVIEW_JSON` result for this failed verification attempt.

### Current failure: two Alt clicks select the same curve owner

Parent evidence directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-2KaWQt
```

Read `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json`;
- `checkout.diff` and `checkout-untracked.json`;
- `inline-3d-interaction-initial-camera.png` and `failure.png`.

The checkout was unchanged during verification. Its fingerprint was
`49077e86deb20d3f7fd111e2de41533f54848ae78481cdc2f9d79c7f3ac24a47`, and
tracked diff SHA-256 was
`2f1d06c077ab8ff8fd908682260f1b18f43921c17138a23e2b7b4c36e7011c66`.
The run used Node v26.9.0 and Chrome `153.0.8010.52` with the Vite fixture at
`http://127.0.0.1:5174`. Browser startup succeeded; this is not the historical
child `EPERM` restriction.

`check:free-labels` exited 1 at
`inline-node-production-rendering-and-path-lifecycle`, at the assertion near
`scripts/checkInlineLabels.mjs:390`:

```text
3D overlap cycles both curve owners with reused local IDs
actual:   Set(1) { 'pick3dB' }
expected: Set(2) { 'pick3dA', 'pick3dB' }
```

The last checkpoint is
`inline-3d-interaction-initial-camera/overlap-alt-1`. This failed in the initial
camera, before the changed-camera iteration. Saved observations establish:

| Observation | Recorded result |
| --- | --- |
| Local overlap node ID | `overlap`, reused on `pick3dA` and `pick3dB` |
| Both marker/client centers | `(450, 307.5735778808594)` |
| First Alt click | `pick3dB`, exactly one replace-selection callback |
| Second Alt click | `pick3dB`, exactly one replace-selection callback |
| Selection highlight after first click | B marker highlighted |
| Runtime owner identities | Distinct path owners under document revision 50 |

The initial camera's independent ordinary/Alt marker probes for each owner,
selected highlights, overlap-normal click and blank reset reached their
assertions successfully. The full new 3D scenario did not complete. The
saved observations lack the actual ordered hit-candidate list and cycle
index/count/reset trace. Repeated owner IDs alone do not establish whether
cycling was correct, reset, or stuck.

### What passed, and what remains unexecuted

| Check | Latest parent result |
| --- | --- |
| `npm test` | Exit 0; 2,356 passed, none failed or skipped |
| `npm run build` | Exit 0; existing nonblocking chunk-size warning |
| `git diff --check` | Exit 0 |
| `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at the initial-camera overlap assertion |
| Next independent review | Not reached in this run |

Seven of ten groups completed, with 82 passing scenario records and no
`pageErrors`. The inline rendering/placement/halo/picking group started but
remains incomplete. These groups were not started:

- `inline-node-lifecycle-path-operations-export`;
- `real-App-input-JSON-history-reused-ID-load`.

The new glyph-only probes after the failed assertion, moved-camera interaction,
and same-owner valid–invalid–valid recovery did not execute. Recovery is now
implemented in the working tree, including A-ready/B-fallback/C-pending/C-ready,
DOM continuity, raw-source/history invariants and late obsolete-failure checks;
its presence is not browser acceptance. Preserve it and run it after correcting
this blocker. Later adapter-failure/cap/path-operation/export checks must also
remain in the full run.

Both halo zoom matrices, six independent negative controls, transparent math,
2D/3D supported-path projection and existing 2D marker/Alt behavior passed in
this run. Keep the repaired halo oracle, tolerances and diagnostics; the former
`maxCompositeError=5.082352941176467` failure is historical and resolved.
The earlier complete browser run in `stz-phase31d-before-review-Fiv3uY` did not
contain these new assertions and cannot replace current acceptance.

Preserve phase-aware parent validation: 31D–31F require all ten groups; 31C
accepts its complete eight- or ten-group reports. Missing/malformed/incomplete
reports, browser errors, nonzero exits and checkout changes must still fail.
Existing App/SvgDiagram lint debt is separate (10 errors / 4 warnings at the
previous review). Do not change automation, sandbox settings or unrelated lint.

## Goal

Explain and minimally fix the failing overlap assertion using the actual
candidate-cycling contract. Preserve real 3D interaction and same-owner recovery
coverage, obtain complete fresh parent verification, then reach independent
review. Verification alone is not review approval.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31d-implement.md`, and
  `prompts/phase-31d-review.md`;
- the failed parent evidence above and preceding review log/summary in
  `logs/codex/`, keeping their different checkout/execution status explicit;
- `scripts/checkInlineLabels.mjs`, `scripts/checkFreeLabelGeometry.mjs`,
  `scripts/checkFreeLabels.mjs`, and `scripts/fixtures/freeLabels.tsx`;
- `scripts/fixtures/inlineLabelBrowserOracle.ts`,
  `scripts/fixtures/inlineLabelComposite.ts`, and fixture TypeScript settings;
- `src/rendering/svgHitTesting.ts`, its candidate collection, ordering and
  `nextSvgPreviewSelectionCycle`, `tests/rendering/svgHelpers.test.ts`, and
  `SvgDiagram` capture/bubbling selection handlers;
- `src/rendering/SvgTexLabel.tsx`, `src/rendering/svgPathInlineNodes.ts`,
  and the shared label runtime;
- inline-node runtime/semantics tests, editor history handling, `package.json`,
  and Phase 31D preview/roadmap documentation;
- the existing parent evidence contract in
  `scripts/automation/phase-verification.mjs` and `run-phase.mjs`.

## 1. Diagnose candidate cycling before changing the assertion or product

Inspect the saved two-click trace and compare the new 3D crossing scene with
its passing 2D counterpart. The harness currently assumes that two Alt clicks
must produce two distinct owning-curve IDs. Production cycling operates on
hit candidates, which can include both an inline marker and its curve body:

- inline candidate stable ID: `pathInlineNode:<pathId>:<nodeId>`;
- curve candidate stable ID: `curve:<pathId>`;
- both may select the same `{ kind: 'stratum', id: <pathId> }`.

`compareSvgPreviewSelectionCandidates` orders candidates by hit-kind priority,
exact distance, then stable ID. `nextSvgPreviewSelectionCycle` continues when
the point and ordered candidate keys are stable; a new cycle starts at index 1
when multiple candidates exist. Thus distinct successive candidates can
legitimately select B twice. Crossing 3D curves can also differ in projected
hit distances from the coincident 2D fixture. This is a source-supported
hypothesis for the failing expectation, not a measured diagnosis of this run.

Retain a focused native-browser reproduction with the same curves, camera,
local IDs and marker-centered click point. Add bounded read-only diagnostics:

- actual event `altKey`, client coordinates and mapped SVG point, including
  any fractional-coordinate rounding; current camera and document identity;
- the ordered candidates' stable IDs, kinds, distances and owning selections
  at that exact point, using the actual fixture model/filter/visibility state;
- cycle index/count and visible selection-cycle feedback, selected owner and
  callback count for each click; enough trace to distinguish normal advance,
  candidate-list changes, reset and remount;
- marker/owner geometry before and after the sequence, keeping observations
  available if a later assertion fails.

Use the existing production collector for diagnostics if helpful, but do not
replace native clicks or expected fixture-owner membership with calls to the
cycle helper. Retain independent marker/glyph geometry and actual callbacks
as browser acceptance. Avoid exposing mutable runtime state just for tests.

Determine the cause and apply the smallest correction:

- If each click advances through stable distinct candidates that share an
  owner, correct the harness's two-click/unique-owner assumption. Exercise one
  bounded complete candidate cycle (and wrap where needed), assert advancement
  and stable membership, and require both expected owning curves to be reached.
  Tie the bound to the verified candidate count, with a small explicit upper
  bound for this fixture. Do not merely increase `2`, retry until success, or
  loop until both IDs happen to appear.
- If candidate membership/order unexpectedly changes, trace real event point,
  rounding, geometry, visibility, selection redraw and document continuity.
  If the cycle actually resets or stops advancing under stable valid input,
  fix the demonstrated production or fixture defect and add a focused
  regression. Do not assume this is a production failure from B/B alone.

Do not deduplicate production candidates by owner, alter priority/tolerance or
initial-cycle semantics, force selected IDs, weaken the expected owner set, or
use an artificial click point that no longer tests overlapping markers merely
to make this test green. Candidate-level cycling is existing behavior that
must remain compatible. Add meaningful helper tests only for changed logic;
full browser evidence is still required.

## 2. Complete the implemented 3D and same-owner recovery scenarios

Preserve the new continuously mounted 3D fixture. At both initial and moved
cameras, retain ordinary and Alt marker selection for both owners, dot/non-dot
highlights, exactly one selection callback per click, complete overlap cycling,
and glyph-only ordinary/Alt nonselection outside all marker/curve tolerances.
Use current client/SVG transforms after camera movement; retain nonzero z,
projection-change assertions, reused local IDs and distinct runtime owners.

Reset independent probes by actual blank-canvas clicks, but do not reset or
remount within a cycle. Preserve the same document/runtime across camera
changes, with unchanged raw data/history and conversion count. Retain native
filled-glyph probes rather than bounding-box or arbitrary blank-space probes,
all supported-path projection checks, and the existing 2D interaction checks.
Save identifiable passing records and screenshots for both 3D camera states.

Execute and preserve the already-added `identityA` recovery lifecycle before
the operations fixture is mounted. It was not reached in this parent run.
Keep the same document revision, path ID, local node ID and runtime owner tuple:

```text
valid A (ready) -> invalid B (whole-source fallback)
                -> different valid C (pending, then ready)
```

Use the normal `mutateInlineNode` editing path. Do not recover by mounting a
new fixture, changing the service, remounting the component, loading a new
document, or round-tripping serialization. Keep the sibling owner with the
same local node ID present to catch cross-owner contamination.

Assert the following at each relevant transition:

- Initial valid A is compiled and ready. Invalid B immediately removes
  obsolete math and settles to complete current-source literal fallback, with
  zero compiled math and no leftover A glyphs.
- Verify the entire invalid raw source in literal output, not just a status,
  substring, text length or source attribute. Preserve whitespace and any
  ordinary/invalid math fragments in the chosen source without trimming,
  partial compilation, injected markup or automatic math wrapping.
- Hold delivery for a distinct valid C using the existing production-service
  delivery hook, edit the same node to C, and observe pending whole-current-
  source literal output with no A/B compiled remnants. Then release delivery
  and assert ready-state recovery with expected current math, current
  source/font/request identity and current measured layout.
- Verify the runtime owner remains the same, request identity follows the new
  source/current font, and bounds/placement match the current node. Preserve
  position, placement/options, marker identity and owning-curve identity.
- Assert sibling text, status and ownership remain unaffected. Preserve the
  existing inverted completion and obsolete-failure checks; neither stale
  output nor stale layout may replace the recovered current source.

Distinguish intentional editing from asynchronous rendering. The fixture uses
`commitDiagramChange`; each text edit should make its normal model/history
change. **Do not assert history is unchanged across user edits.** Capture a
snapshot immediately after each deliberate edit, then compare it against
settlement/release using the existing raw-data invariant checks. Conversion,
measurement and late callbacks must not modify serialized model data, history,
selection or TikZ. Across intentional edits, only the intended text and normal
edit history should change; raw text/options/positions and both TikZ modes
must remain faithful to the current model. Keep existing Undo/Redo coverage.

Retain observations for A-ready, B-fallback, C-pending and C-ready, including
exact current text, owner/request identity and invariant results. A final
screenshot or ready status on a newly mounted node is not recovery evidence.

## 3. Preserve complete acceptance and retain fresh scenario evidence

Keep the new cases in the existing two inline-node groups. Preserve all ten
required groups and their actual assertions:

```text
existing-renderer-regressions
independent-oracle-negative-controls
boundary-anchor-camera-matrix
inverted-success-and-failure-races
pending-lock-and-autohide
deletion-and-unmount
real-App-input-JSON-history-reused-ID-load
current-SVG-cloning
inline-node-rendering-placement-halo-picking
inline-node-lifecycle-path-operations-export
```

Retain identifiable records for 3D interaction before/after camera movement
and same-owner recovery. Extend the existing pre-assertion diagnostics with
candidate/cycle details. Save current source, geometry, camera, event and owner
context on failure. Do not mark groups complete without running every check.

Preserve shared conversion/cache/fallback/stale-result protection, the preview
cap, empty-text behavior, font size 12, 14-unit placement offsets, supported
paths, delayed path operations, raw serialization/history/TikZ semantics,
existing App workflows and current SVG cloning/export checks. Keep 31E export
waiting deferred. Diagnose newly demonstrated failures as product, oracle or
fixture setup before applying a minimal correction.

Expected edits are primarily `scripts/checkInlineLabels.mjs`, with small
fixture/oracle observation changes only where needed, focused regressions for
new helper logic if applicable, and current Phase 31D documentation. Do not
redesign rendering/picking or change model schemas, dependencies, sandbox
permissions, review gates, or unrelated lint.

## Verification and permitted execution

Run focused checks with the required Node PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test \
  tests/rendering/svgHelpers.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/integration/phase31dInlineNodeSemantics.test.ts \
  tests/scripts/inlineLabelComposite.test.ts \
  tests/ui/svgPreviewExport.test.ts \
  tests/scripts/runPhaseVerification.test.mjs \
  tests/scripts/runPhaseRunner.test.mjs
node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.json --noEmit
node --check scripts/checkInlineLabels.mjs
node --check scripts/checkFreeLabels.mjs
node --check scripts/checkFreeLabelGeometry.mjs
node --check scripts/checkFreeLabelRaces.mjs
node --check scripts/checkFreeLabelsApp.mjs
node node_modules/eslint/bin/eslint.js \
  scripts/checkInlineLabels.mjs scripts/checkFreeLabels.mjs \
  scripts/checkFreeLabelGeometry.mjs \
  scripts/fixtures/inlineLabelBrowserOracle.ts \
  scripts/fixtures/inlineLabelComposite.ts scripts/fixtures/freeLabels.tsx \
  tests/scripts/inlineLabelComposite.test.ts \
  tests/rendering/svgInlineLabelRuntime.test.ts \
  tests/integration/phase31dInlineNodeSemantics.test.ts
git diff --check
```

Include additional changed files in applicable checks. If production
App/SvgDiagram code must change, compare lint against the existing baseline
and introduce no new errors. Keep focused counts within the full-suite total;
do not clean up unrelated lint debt.

The authorized parent/Terminal command for complete verification is:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31D verify
```

This accepts the dirty checkout and runs `npm test`, `npm run build`,
`git diff --check`, `check:label-assets` and `check:free-labels`, retaining fresh
logs/artifacts and checking checkout identity, including untracked fixtures
and tests. It does not implement, review, commit or push. Do not recursively
invoke `31D fix` or `31D implement` to perform verification.

If acting as the automated fix child, run available focused/full Node checks
and build, then let the outer runner perform browser verification after the
handoff. Report child restrictions accurately and leave browser acceptance
pending for that authorized parent; do not change sandbox settings or weaken
checks. In a standalone run, use supported permission escalation when necessary
and available, or hand off to the authorized Terminal.

Obtain new matching parent evidence after correcting this failure. Neither
prior passing evidence nor this incomplete run establishes the remaining cases. Review may
use a fresh successful matching parent run without repeating browser commands
inside a restricted child sandbox. Failed, partial or stale evidence still
blocks acceptance; isolated diagnostics cannot replace the complete run.

## Documentation and acceptance criteria

Update only relevant Phase 31D portions of `docs/PREVIEW_UI.md` and
`docs/ROADMAP.md`. Record actual new coverage, commands, versions, exit statuses,
checkout identity and evidence paths. Distinguish the preceding completed
review, the child's historical startup restriction, this executed parent
assertion and the new result. Replace stale statements that new parent browser
verification has not yet run with its actual failed/partial status until a
fresh complete run succeeds. Preserve history and keep 31E/31F deferred.

The normal runner performs fix -> parent verification -> independent review.
The preceding run reached review; this latest follow-up stopped in parent
`before-review` verification and did not run another review. Existing review
logs do not change that fact. Keep this order and the commit gate. A passing
standalone `verify` does not run review or establish review approval.

31D is ready for re-review only when:

- the saved B/B failure has an evidence-supported explanation and minimal
  correction, with a bounded native candidate-cycle trace reaching both owners;
- real ordinary/Alt interactions select correct curve owners in 3D before and
  after camera movement, with reused local IDs and glyph-only nonselection;
- one continuously mounted owner completes valid–invalid–valid recovery with
  exact current-source fallback, successful current rendering, no stale glyphs,
  sibling isolation, and no asynchronous model/history mutation;
- fresh browser evidence has `result: "passed"`, `stage: "complete"`, an
  identified browser, all ten groups complete, empty `incompleteGroups`,
  `unexecuted` and `pageErrors`, and explicit observations for the new cases;
- the parent accepts that evidence for the current tracked/untracked checkout,
  and all required tests, build, static checks and diff checks pass;
- existing halo, free-label, path/lifecycle/App/export coverage remains intact
  and documentation distinguishes verification from review status accurately.

No environment block, helper-only pass, remount-based recovery or unchanged
historical browser report closes these gaps. Do not mark 31D complete before
required verification and subsequent independent review succeed.

## Report after implementation

Report changed files; the observed candidate order, cycle indices and owner
sequence explaining B/B; whether the defect was the test expectation, fixture
or production behavior; the minimal fix and focused regression; completed 3D
camera/glyph and same-owner recovery scenarios;
preserved halo and regression results; how intentional history edits were
distinguished from render-side mutation; commands, versions, exit statuses
and focused/full counts; fresh evidence paths and checkout identity;
documentation status; and unavailable or failing checks. State separately
whether parent verification passed and whether independent review has run and
approved the result. If running as a child, identify pending parent/review
steps without claiming they already passed.
