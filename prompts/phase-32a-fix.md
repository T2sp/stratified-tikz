# Phase 32A Targeted Fix Prompt: Validate positioned literal whitespace correctly

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect current status first and preserve the
implementation, fixtures, tests, documentation, and all user changes, including
untracked files. Do not reset to an earlier revision or restart implementation.

The reported parent checked revision
`860d185e4f578d0310d98b293c7b74339d90ff3c` plus working-tree changes, with
fingerprint `ed89aff6d04ef27d5e3df4f32db18cbafa59f6c18ee342c3e1dd29d5a51dff9b`.
That fingerprint matched the inspected checkout before this fix prompt was
added. The prompt itself changes checkout identity; obtain fresh evidence for
the eventual corrected tree rather than reusing the historical report as a pass.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated point-node whitespace-oracle mismatch, its other
call sites, focused regressions, useful failure diagnostics, and any further
demonstrated 32A acceptance failures. Preserve strict TypeScript, the shared
MathJax/runtime/layout/export design, and all existing acceptance gates. No new
dependency, schema, paint model, shape feature, or unrelated lint cleanup is
needed. Keep 32B-32D deferred.

## Latest execution findings

The user's heading says 31A, but the implementation, paths, report, and stack
are **Phase 32A**. This is a parent browser assertion failure before independent
review. It is not the implementation child's earlier localhost `EPERM`.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-VOwz7Y
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and the latter
check's `artifacts/free-labels-evidence.json`, `failure.png`, `checkout.diff`,
and `checkout-untracked.json`. Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-iPhLtB/response.json
```

| Observation | Actual parent result |
| --- | --- |
| Node / browser | Node v26.9.0 / Chrome 153.0.8010.53 |
| Fixture | Vite development fixture using production components, port 5174 |
| Checkout before/after | Same fingerprint |
| `npm test` | Exit 0; 2,471 passed, none failed/skipped |
| Build / diff check | Exit 0; existing build chunk warning |
| `check:label-assets` | Exit 0; parent accepted |
| `check:free-labels` | Exit 1 at `checkPointNodes.mjs:79` |
| Completed groups / passing records | 10 of 15 / 109 |
| Point scenario artifacts | None saved before this first matrix assertion failed |
| Page errors | Empty in the recorded report |
| Independent review | Not reached |

Five groups remain incomplete: `real-App-input-JSON-history-reused-ID-load`,
`settled-SVG-export-standalone`, `point-node-body-layout-lifecycle`,
`point-node-picking-visibility`, and `point-node-settled-export`.
The reported stage is `real-App-workflows` because the caller sets that stage
and starts the App group before invoking the point renderer checks. The actual
failure occurs in the point fixture; the later `runAppChecks()` was not reached.
Do not interpret the stage label as proof of an App editing defect or execution.

## Confirmed immediate cause

The failing fixture source is this JavaScript string:

```js
const source = '  $\\unknownPointMacro$\t\\slash\n tail  '
```

`inspectPoint()` currently computes `literal` by selecting only
`[data-label-literal]` elements and joining their `textContent` with `''`.
The language matrix then requires this joined string to equal the original
source, including its literal tab and newline.

That does not match the established renderer representation:

1. `composeLabelLayout()` in `src/rendering/labels/labelMetrics.ts` keeps
   separate text, tab, and newline placements. Tabs advance the next fragment's
   x position; newlines advance its baseline. Their original text is retained
   in layout records.
2. `SvgTexLabelView` in `src/rendering/svgLabelView.ts` renders text and math
   placements; tab/newline placements have no literal glyph element. Their
   effect is represented by coordinates of the subsequent fragments.
3. For the failing source, the visible text elements contain:

```js
['  $\\unknownPointMacro$', '\\slash', ' tail  ']
```

Joining these produces exactly the reported actual value, without tab/newline
characters. It cannot reconstruct the source's structural whitespace.

The preceding live `point.source === text` assertion already passed. A local
Node/React server-rendering reproduction using `literalSvgLabelLayout()` and
`SvgPointNodeView` also reproduces the reported joined value while retaining
the exact source and text/tab/text/newline/text placements. This identifies an
incorrect test oracle; it does not establish that every native point layout,
font, picking, or export case is correct.

Diagnostic reproduction and exact command are retained in
`/private/tmp/stz-32a-whitespace-diagnosis-KXYWFo/` as `reproduce.mjs`,
`result.json`, and `README.md`. This uses deterministic synthetic measurement
with the current production layout/view; it executes neither MathJax nor a
browser and cannot substitute for native acceptance. The parent's `failure.png`
also visibly shows `tail` on a separate line, but does not measure exact tab width.

The same assumption occurs at these baseline call sites:

- `scripts/checkPointNodes.mjs:25`: lossy collection in `inspectPoint()`;
- `scripts/checkPointNodes.mjs:79`: current language-matrix failure;
- `scripts/checkPointNodes.mjs:91`: same-owner invalid-input recovery;
- `scripts/checkPointNodesApp.mjs:78`: native Inspector invalid input;
- `scripts/checkPointNodesApp.mjs:217-220`: fallback standalone XML text joining
  followed by comparison with source containing tab/newline.

Audit pending/resource comparisons and other consumers of `point.literal` too.
Some currently pass only because their inputs contain no tabs/newlines.

The existing Node point tests concatenate all non-math layout placements,
including tab/newline records. Those tests correctly preserve raw source but do
not exercise the lossy DOM extraction used by the new browser assertions. That
explains why the full Node suite passed while this browser assertion failed.

## Goal

Make the point acceptance oracle verify both exact source preservation and the
actual visual effect of whitespace, consistently across live rendering, native
editing, and standalone SVG. Prove the correction with meaningful regressions,
then obtain complete fresh parent browser verification and independent review.

## Required reading

- `AGENTS.md`, this prompt, `prompts/phase-32a-implement.md`, and
  `prompts/phase-32a-review.md`;
- the parent evidence above and `docs/PHASE_32A_IMPLEMENTATION.md`;
- `scripts/checkPointNodes.mjs`, `scripts/checkPointNodesApp.mjs`, and the
  point integration in `scripts/checkFreeLabels.mjs`;
- existing free-label whitespace assertions in `scripts/checkFreeLabels.mjs`,
  inline fallback assertions, and `scripts/fixtures/labelBrowserOracle.ts`;
- `src/rendering/svgLabelView.ts`, `labels/labelMetrics.ts`,
  `labels/svgLabelLayout.ts`, `SvgPointNode.tsx`, `svgPointNodeLayout.ts`,
  `svgPointNodeView.ts`, and `src/ui/svgSettledExport.ts`;
- `tests/rendering/svgPointNodeRuntime.test.ts`, applicable script/oracle tests,
  `scripts/automation/phase-verification.mjs`, runner tests, and `package.json`.

## 1. Use separate source and visible-layout assertions

Replace raw-source equality against concatenated visible text with a reusable,
explicit observation/assertion path suitable for point bodies and exported nodes.
Keep the following checks independent:

- Exact source: model/editor/JSON and live source/request identity must retain
  the original value, including edge/repeated spaces, tabs, LF, CRLF, and CR.
  For serialized SVG, use the existing JSON-escaped request identity to verify
  exact source; account for XML line-ending/attribute normalization when checking
  title or attributes, as the production extractor already does. Do not demand
  impossible raw control-character equality from XML-normalized attributes.
- Visible content: collect ordered foreground text fragments, their actual
  text, x/y/baseline, transforms, font/whitespace properties, and native bounds.
  Compare fragment content/order with the source's independently tokenized text
  segments, preserving spaces and punctuation. Exclude title, metadata, halos,
  and measurement clones from visible-content observations.
- Tab layout: verify the subsequent fragment advances to the appropriate stop
  using the currently displayed font. Reuse/generalize the native SVG whitespace
  oracle and complete-space-prefix measurement from `labelBrowserOracle.ts`.
  Do not regress to an empty/invalid computed-font shorthand on a Canvas oracle
  or an unverified fixed character width.
- Line layout: verify same-line fragments share a baseline, physical line breaks
  advance baselines, and CRLF counts as one break. Cover empty lines and tabs at
  line boundaries through appropriate line/bounds checks, not nonexistent glyphs.
- Geometry/state: body and contour request identities, finite layout, containment,
  picking/highlight, and zero compiled math for failed current input remain valid.

Keep expectations independent from the production layout helper being tested.
Metadata equality alone cannot establish visible preservation: the test must
fail if metadata is correct but text is missing or positioned incorrectly.

Do not strip whitespace from both values, change the expected source, remove
the failing fixtures, concatenate every group descendant including title, add
hidden tab/newline text merely to satisfy concatenation, or remove assertions.
Do not alter correct production rendering to accommodate an invalid oracle.
If independent native observations demonstrate a production error, fix that
specific error and retain a regression; distinguish it from this confirmed cause.

## 2. Apply the correction to every affected point workflow

Use the corrected observation/assertion contract in the language matrix,
same-owner valid-invalid-valid sequence, pending/resource fallback checks,
actual Inspector editing/history, and whole-node fallback export boundary.
Do not fix only line 79 and leave predictable later failures unchanged.

Verify both transparent and white downloads and standalone reopened point bodies
through actual visible fragments/positions, while preserving source identity,
contour validation, inherited dimming, and no nested capture. Retain the existing
deliberately corrupted-contour rejection. Keep native editor/JSON/TikZ round-trip
and lifecycle assertions unchanged in strength.

Reuse existing free/inline whitespace infrastructure where possible, making its
selector/root handling explicit for points. Do not make a point oracle depend on
a free-label-only ID, the live App stylesheet, or an unrelated owner's text.

## 3. Add regressions that exercise the actual observation boundary

Add focused registered tests that reproduce the old false failure using rendered
point output/collected DOM observations, not only concatenated layout records.
Keep real production layout/view integration and native acceptance coverage.

Cover representative cases of the exact reported source, pending and failed
input, same-owner recovery, consecutive tabs, LF/CRLF/CR, empty lines, leading/
trailing whitespace, and the exported fallback fixture. A full Cartesian product
is unnecessary; explain which cases establish each behavior.

Include negative controls that retain correct source metadata but drop a visible
fragment, change edge spaces, collapse a tab advance, collapse a line's baseline,
or show stale content. The corrected checker must reject those cases. Preserve
the existing source/history/export corruption and contour controls.

## 4. Save useful failure observations before asserting

The failed matrix wrote no point scenario artifact because its aggregate save
occurs only after the entire matrix. Record the current case before vulnerable
assertions: group/scenario, shape, ambient dimension, source/request/status,
visible fragments and native font/coordinates/bounds, and current contour.
Keep diagnostics distinct from passing records; mark a scenario passed only
after all its assertions succeed.

Report a point-specific stage when running point checks instead of inheriting
`real-App-workflows` and prematurely starting the later App group. Preserve
required group identities and honest incomplete/unexecuted accounting. Add a
focused failure-path regression if changing diagnostic/group bookkeeping.
Save observations before optional bounded screenshots and preserve primary
errors through screenshot and cleanup failures.

## Verification and completion

Register any new tests in `package.json`. Run focused tests, script syntax,
fixture TypeScript and targeted lint, then:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

The browser-capable parent/Terminal must run fresh verification on the final
corrected checkout, including untracked files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

This runs the two browser commands as well as the required Node/build/diff checks.
Keep all fifteen groups and eleven named point scenarios, required artifacts,
checkout checks, fresh verifier process, and pre-review/commit failure gates.
Do not lower counts, skip point groups, remove scenario/artifact requirements,
weaken sandboxing, or rewrite the historical failed report to obtain a pass.

If child browser startup is restricted, run all available checks and provide an
exact handoff; parent verification remains required. A standalone `verify` run
does not perform independent review. After accepted complete verification,
review the exact matching checkout against `prompts/phase-32a-review.md`.
Do not recursively launch an implementation/fix run from the fix child.

Update `docs/PHASE_32A_IMPLEMENTATION.md` and relevant completion documentation
with the observed oracle cause, corrected coverage, exact command results, and
actual remaining gates. Do not claim that all production point behavior passed
based on the SSR diagnosis or this historical partial browser run.

## Report after fixing

Report every corrected oracle call site, preservation/visual assertions added,
negative controls, failure-artifact improvements, files changed, focused/full
test results, browser scenario/artifact results, and matching checkout identity.
Separate the historical child `EPERM`, this parent assertion failure, subsequent
native verification, and independent review. Keep 32A pending until its gates
pass and leave 32B-32D outside this fix.
