# Phase 31D Targeted Fix Prompt: Complete 3D inline-node interaction and same-node recovery coverage

## Environment

Work on the current `phase/31d-tex-path-inline-labels` checkout. Preserve the
Phase 31D implementation, fixtures, tests, documentation and all user changes,
including untracked files. Inspect current status first; do not reset the
branch, restore a historical base, or rerun implementation from scratch.

The reviewed checkout was `2622458c5e652febdfb1b065be1d1b33d84bdd5e` plus
working-tree changes. Preserve the corrected halo oracle and its
`scripts/fixtures/inlineLabelComposite.ts` helper and
`tests/scripts/inlineLabelComposite.test.ts` regression tests. These files were
untracked in the matching parent evidence; they may since have been committed.

The default shell may select Node v16.17.0 at `/usr/local/bin/node`, whereas
this project requires Node >=22.12.0. Use:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Keep strict TypeScript, avoid `any`, and add no dependencies. Preserve pinned
MathJax and the shared parser/adapter/cache/runtime architecture. Limit work
to the two browser-coverage gaps below and failures they demonstrate. Phase
31E settled-export waiting and 31F's combined audit remain deferred.

## Latest review findings

The latest review **ran** and reported `needs_changes`: no Critical issues,
one Medium issue, and no Low-priority issues. No production defect was found
and no source files were modified by review. The Medium issue is incomplete
coverage of two explicitly required production browser scenarios.

### M1. 3D marker interaction and same-node recovery remain unverified

- In `scripts/checkInlineLabels.mjs`, the 3D checks around line 202 verify
  projection and conversion reuse after camera movement, but do not click
  markers. The pointer/Alt-click section around line 244 mounts a fresh fixture
  without `ambientDimension: 3`; `scripts/fixtures/freeLabels.tsx` defaults to
  2D around line 149. Passing 2D picking and 3D projection checks does not
  establish owning-curve selection before and after 3D camera movement.
- Inline editing around line 324 reaches invalid-source fallback, then mounts
  another document. It never edits that same document/path/node back to valid
  text. A fresh mount resets document identity and history, so it cannot prove
  same-node valid–invalid–valid recovery.

Line numbers identify the reviewed version; locate the current equivalent
sections. These are acceptance gaps, not observed rendering defects.
Strengthen the harness first; change product code only if the added checks
demonstrate a defect.

### Passing evidence and resolved work to preserve

Matching parent evidence is retained at:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase31d-before-review-Fiv3uY
```

Read `verification.json`, both browser command logs/artifacts, and
`05-check-free-labels/artifacts/free-labels-evidence.json`. Its checkout
fingerprint is:

```text
b08ec90799f1b9d2edbf63946db7edba81a928a67b2730f70e9bff3e5db29f00
```

The parent used Node v26.9.0 and Chrome `153.0.8010.52`. Both browser commands
passed, all ten groups completed, and no page errors were recorded. Review
confirmed the checkout still matched and inspected screenshots/raster evidence;
it did not repeat browser execution. Group completion establishes the existing
assertions passed, not that the two absent scenarios were tested.

| Check | Latest review / matching parent result |
| --- | --- |
| Review `npm test` | Exit 0; 2,356 passed, none failed or skipped |
| Review `npm run build` | Exit 0; nonblocking chunk-size warning |
| Strict fixture TypeScript, targeted lint, five browser-script syntax checks | Passed |
| `git diff --check` | Passed |
| Parent `check:label-assets` and `check:free-labels` | Passed; complete matching browser evidence |
| Independent review | Executed; two missing scenarios under one Medium issue |

These are prior results, not verification of this next change. Existing
App/SvgDiagram lint debt remains 10 errors / 4 warnings; repository-wide lint
was not run. Keep unrelated lint cleanup out of scope.

The former halo-compositing assertion has been resolved. Review accepted
glyph-local halos and formula detail at both tested zoom levels. Preserve the
independent raster oracle, compositing helper, quantitative comparisons, six
negative controls, and diagnostics retained before assertions. Do not reopen
the earlier `maxCompositeError=5.082352941176467` failure as the current issue
or weaken thresholds to add coverage.

Preserve phase-aware parent validation: 31D–31F require all ten groups; 31C
accepts its complete eight- or ten-group reports. Missing/malformed/incomplete
reports, browser errors, nonzero exits and checkout changes must still fail.
There is no demonstrated need to change automation or sandbox settings.

## Goal

Add real browser evidence for owning-curve selection in 3D before and after
camera movement and valid–invalid–valid editing of one continuously mounted
inline node. Obtain fresh matching parent verification, then leave the result
for independent review. Verification alone is not review approval.

## Required reading before fixing

Read at least:

- `AGENTS.md`, this prompt, `prompts/phase-31d-implement.md`, and
  `prompts/phase-31d-review.md`;
- the latest review log/summary in `logs/codex/` and matching parent evidence
  above, including checkout identity and pending files;
- `scripts/checkInlineLabels.mjs`, `scripts/checkFreeLabelGeometry.mjs`,
  `scripts/checkFreeLabels.mjs`, and `scripts/fixtures/freeLabels.tsx`;
- `scripts/fixtures/inlineLabelBrowserOracle.ts`,
  `scripts/fixtures/inlineLabelComposite.ts`, and fixture TypeScript settings;
- `src/rendering/SvgTexLabel.tsx`, `src/rendering/svgPathInlineNodes.ts`,
  relevant `SvgDiagram` pointer/picking code and shared label runtime;
- inline-node runtime/semantics tests, editor history handling, `package.json`,
  and Phase 31D preview/roadmap documentation;
- the existing parent evidence contract in
  `scripts/automation/phase-verification.mjs` and `run-phase.mjs`.

## 1. Exercise actual 3D selection before and after camera movement

Extend the existing production fixture and pointer helpers. Mount an explicitly
3D scene with nontrivial z coordinates and at least two curve owners that reuse
the same local inline-node ID, with distinguishable source text. Keep dot/non-dot
and selected-marker behavior covered.

Test both the initial camera and a changed 3D camera on the same mounted
document/runtime. Change rotation and pan/zoom through the existing camera
props path. Assert the projection actually moves, while document revision,
owner identities, raw data/history and conversion count remain unchanged.
Do not return to 2D, mount another document, or recreate the renderer between
the two camera states.

At each camera state:

- Read current marker geometry and transform coordinates to browser client
  coordinates using the current SVG screen transform. Remeasure after camera
  changes; do not click cached pre-movement positions.
- Use real browser mouse events for ordinary marker selection and Alt-click
  owning-curve selection. Cover each intended owner and an overlapping-marker
  case in which consecutive Alt-clicks cycle through both curve owners despite
  their reused local node ID. Assert `stratum`/curve selection, correct owner
  IDs, and exactly one selection callback per click.
- Reset independent probes through an actual blank-canvas click. Do not reset
  between consecutive clicks intended to test Alt cycling. Do not substitute
  fixture `select()` calls or direct callback invocation for pointer behavior.
- Click a visible glyph location outside every marker's selection tolerance
  (currently 10 SVG units) and outside underlying curve hit geometry. Prove
  both ordinary and Alt-click leave the selection empty. Choose a scene where
  the glyph-only point intersects rendered text and cannot legitimately select
  a nearby curve. Keep text `pointer-events: none` and no label hit rectangle;
  do not satisfy nonselection by clicking arbitrary blank space.
- Check the selected marker highlight and preserve marker-centered picking;
  measured text bounds must not become inline-node selection targets.

Retain the supported-path projection matrix and 2D pointer tests. The new
interaction scenario can use a focused 3D scene; it need not duplicate the
entire path-kind matrix. Record camera parameters, owner tuples, marker/probe
coordinates, observed selections/callback counts, and screenshots for both
camera states so evidence distinguishes them from the old 2D tests.

## 2. Recover the same inline node from valid through invalid back to valid

Extend the current `identityA` editing lifecycle through recovery before the
subsequent operations fixture is mounted. Keep the same document revision,
path ID, local node ID and runtime owner tuple throughout:

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

Add identifiable records for 3D interaction before/after camera movement and
same-owner recovery. Save useful observations before assertions so failure
retains current source, geometry, camera, event and owner context. Do not
rename old passing records or mark groups complete without running new checks.

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

Obtain new matching parent evidence after adding the scenarios. The prior
passing evidence cannot establish assertions it never contained. Review may
use a fresh successful matching parent run without repeating browser commands
inside a restricted child sandbox. Failed, partial or stale evidence still
blocks acceptance; isolated diagnostics cannot replace the complete run.

## Documentation and acceptance criteria

Update only relevant Phase 31D portions of `docs/PREVIEW_UI.md` and
`docs/ROADMAP.md`. Record actual new coverage, commands, versions, exit statuses,
checkout identity and evidence paths. Correct any current-status claim that
review has never run or that the resolved halo assertion still blocks progress.
Preserve earlier attempts as historical records and keep 31E/31F deferred.

The normal runner performs fix -> parent verification -> independent review.
The latest run reached review and stopped because review found the two coverage
gaps. Keep this order and the existing commit gate. A passing standalone
`verify` does not itself run review or establish review approval.

31D is ready for re-review only when:

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

Report changed files; exact added 3D click/camera and same-owner recovery
assertions; demonstrated product/oracle/fixture failures and minimal fixes;
preserved halo and regression results; how intentional history edits were
distinguished from render-side mutation; commands, versions, exit statuses
and focused/full counts; fresh evidence paths and checkout identity;
documentation status; and unavailable or failing checks. State separately
whether parent verification passed and whether independent review has run and
approved the result. If running as a child, identify pending parent/review
steps without claiming they already passed.
