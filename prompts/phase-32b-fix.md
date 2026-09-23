# Phase 32B Targeted Fix Prompt: Include border half-width in point selection assertions

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve all current
implementation, fixtures, tests, documentation, previous 32A corrections, and user
changes, including untracked PGF reference files. Do not reset or restart work.

The latest parent checked revision `595139daea7b8b4142edc74551b031aae099fc62`
plus working-tree changes. Its before/after fingerprint was
`8556ca895ef531add08c6a0d54164e18206c6eb1657bba22575530af5119eb02`.
This matched the inspected checkout before adding this prompt. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated stale selection-highlight expectation, focused
regressions and diagnostics, and further demonstrated 32B acceptance failures.
Preserve strict TypeScript and avoid new dependencies, unrelated lint cleanup,
or additional schema changes. Keep 32C geometric shapes and 32D spacing,
minimum-dimension and anchor work deferred.

## Latest execution findings

The child implementation reported browser startup `EPERM`. The latest parent
successfully launched its browser and reached a native selection assertion.
Its failure is not a permissions problem or a missing browser run.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-mGKjaz
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and the checkout snapshots;
- `point-observation-0113.json` through `point-observation-0120.json`, especially
  `0114`/`0115` for injected-font geometry and `0117`/`0119` for restoration;
- the completed point language, exact-source recovery and lifecycle observations.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-XephXb/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,679 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointNodes.mjs:217` |
| Failure stage | `point-node-body-layout-lifecycle` |
| Completed groups / passing records | 10 of 16 / 112 |
| Completed point scenarios | 3 of 11 cumulative 32A scenarios; 0 of 5 new 32B scenarios |
| Browser page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The completed point scenarios are `point-language-shapes-2d-3d`,
`point-valid-invalid-valid-exact-source`, and
`point-A-B-C-delete-duplicate-history-load`. The next scenario,
`point-resource-retry-font-readiness`, failed inside its owned-font callback.
Cleanup ran, but this does not make the scenario pass.

Six groups remain incomplete: `point-node-body-layout-lifecycle`,
`point-node-picking-visibility`, `point-node-settled-export`,
`point-node-paint-import-persistence`,
`real-App-input-JSON-history-reused-ID-load`, and
`settled-SVG-export-standalone`. The last five were not reached. Earlier passing
assertions and historical 32A acceptance cannot establish new 32B acceptance.

## Confirmed cause: the old circle oracle omits the border half-width

The failing assertion still expects:

```js
assert.equal(Number((await inspect()).highlight), afterFontFace.radius + 6)
```

32B intentionally separates shape geometry from painted bounds and expands
selection to include the border. In `src/rendering/svgPointNodeLayout.ts`, the
stroke width is the enabled model width in TeX points multiplied by the existing
1.2 SVG-unit conversion. For a circle, `selectionRadius` is the contour radius
plus half this width. `src/rendering/svgPointNodeView.ts` draws the selection
highlight at `layout.selectionRadius + 6`.

The saved native observation contains:

| Quantity | Value |
| --- | --- |
| Contour radius | `70.76046333097682` |
| Enabled legacy border width | `0.4` pt |
| Actual contour `stroke-width` | `0.48` SVG units |
| Border half-width | `0.24` SVG units |
| Observed highlight radius | `77.00046333097681` |
| Stale `radius + 6` expectation | `76.76046333097682` |

The missing term is exactly the border half-width, subject only to ordinary
binary arithmetic. This is not a rounding-tolerance problem. The earlier
resource-recovery assertion at `checkPointNodes.mjs:170` already includes the
same term as a hard-coded `.24`; the injected-font assertion was left unchanged.

The previous FontFace cleanup correction is working. The retained restoration
observations show `deleted: true`, `ownedFacePresent: false`, the same document
and FontFaceSet, and the original radius `70.7953467895476` restored both after
removal and in the later reference mount. Preserve ownership-based cleanup,
restoration checks and primary-error handling; do not reintroduce name-based
font deletion or change production font metrics to address this assertion.

## Required reading

Read `AGENTS.md`, `prompts/phase-32b-implement.md`,
`prompts/phase-32b-review.md`, `docs/PHASE_32B_IMPLEMENTATION.md`, and the relevant
paint/layout contracts in `docs/PREVIEW_UI.md`, `docs/LABEL_ADAPTER.md`, and
`docs/IMPORTED_POINT_PAINT.md` before editing.

Trace the failing path through:

- `scripts/checkPointNodes.mjs`, `scripts/pointCheckDiagnostics.mjs`,
  `scripts/pointLiteralOracle.mjs`, and `scripts/ownedFontFace.mjs`;
- `src/rendering/svgPointNodeLayout.ts`, `src/rendering/svgPointNodeView.ts`,
  `src/rendering/svgPointPaint.ts`, and `src/rendering/svgHitTesting.ts`;
- `tests/rendering/svgPointPaint.test.ts`, relevant oracle/font tests, and
  `scripts/checkPointNodePaint.mjs`;
- `scripts/automation/phase-verification.mjs` and the existing parent verifier
  path in `scripts/automation/run-phase.mjs`.

Line numbers identify the inspected failure; locate the current equivalent if
subsequent edits have shifted them.

## Required correction

### 1. Use one independent, paint-aware circle expectation

Correct both resource-recovery and injected-font selection checks, and audit
other point highlight assertions for the old `radius + 6` assumption. Derive
expected circle highlight radius from independently known quantities:

```text
expectedBorderWidth = borderEnabled ? declaredBorderWidthPt * 1.2 : 0
expectedHighlightRadius = observedContourRadius + expectedBorderWidth / 2 + 6
```

Use the fixture's declared paint state, including the explicit legacy 0.4pt
contract where applicable. Independently verify the rendered contour's stroke
presence/width against that state. Reject missing or nonfinite measurements;
do not silently coerce missing attributes to zero. A small test-side helper is
appropriate if it makes the two checks share a clear, exercised contract.

Do not import the production layout, paint resolver or selection-radius helper
to generate expected values. Do not obtain the expected radius from the actual
highlight or production `data-point-painted-bounds`. Native contour radius is
usable here because the existing independent body/contour layout checks remain
in place. Reading the actual border width alone is insufficient: a wrong
rendered width must not redefine the expected contract.

Do not merely add `.24` to every assertion. User widths vary, and disabled
borders contribute zero even when their stored width remains positive. Enabled
zero-opacity borders remain distinct from disabled borders under the current
geometry contract. The highlight's own 3-unit outline is not the node border.

Preserve the intended production selection expansion. Do not shrink the
highlight, remove border-aware picking, change font metrics, or increase a
tolerance to hide the 0.24 discrepancy. This circle formula must not replace
polygon miter-aware selection bounds or their existing hit-testing checks.

### 2. Add focused regressions that exercise the failed path

Cover the corrected test-side expectation and selected production point view,
using independent expected values. Existing wide-border bounds/picking and
triangle-miter tests do not cover this highlight assertion by themselves.

Include legacy 0.4pt paint, a different wider enabled border, a disabled border
with a positive stored width, and an enabled zero-opacity border. Keep enabled
zero-width PGF hairlines outside scope: 32B deliberately requires positive width
and diagnoses that unsupported import; disabled rendering is the zero-width
geometry case to exercise.

Prove the assertion rejects a missing half-width, a doubled half-width, and a
stale pre-font-change radius. Use the actual selected view and/or observations
consumed by the browser assertion, not only a test that repeats arithmetic or
searches source text. Register any new tests in the normal suite.

Retain the native owned-font sequence: verify current source/request/generation,
changed measured text and contour, outside/inside pointer selection, and model/
history invariance. Retain removal, same-page restored geometry and later-owner
reference checks in the existing finally-safe lifecycle. Where selection is
checked after restoration, use the restored contour and current declared paint.

### 3. Keep diagnostics and the cumulative acceptance contract intact

Before an assertion can abort the scenario, save the source/owner/request and
font generation, declared border enabled/width/opacity, native contour radius
and stroke attributes, expected highlight components, actual highlight, delta,
and model/history identity. Preserve restoration diagnostics and the primary
failure if cleanup also fails. Do not mark a partially executed scenario passed.

Keep all previous 32A source, metrics, persistence, locator, XML-Canvas and
FontFace corrections. Preserve 32B independent text/fill/border paint, opacity
application, saved-envelope v2 migration, preset/import ordering, TikZ overrides,
immutable pending export capture, native PGF reference artifacts, and the
binary-aware checkout identity handling. Do not regenerate PGF fixtures solely
to accommodate this harness correction.

Do not remove required scenarios/artifacts, relax verifier fingerprint checks,
skip review, or change commit/push gates. If later native execution exposes a
separate failure, retain its evidence and determine its cause before a bounded
32B correction; do not presume every remaining failure is another oracle issue.

## Verification and completion criteria

Run focused regressions, the registered full suite, build, applicable strict
TypeScript/fixture checks, changed-script syntax checks, targeted lint, and
`git diff --check` with the supported PATH. Preserve the documented unrelated
lint baseline; do not clean it up as part of this fix.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, including both browser checks. Inspect the
terminal result, all 16 required groups, all 16 named point scenarios (11 from
32A and 5 from 32B), page-error arrays, and actual required JSON/SVG/PNG artifacts.
The new paint group must include Inspector/history, imported presets/persistence,
lifecycle/dimming, pending transparent-edit and pending white-load acceptance.
Unexecuted scenarios, helper tests, or an earlier checkout's artifacts do not
satisfy these gates.

Evidence must match the final source, scripts, fixtures and documentation,
including untracked and binary files. If browser startup is unavailable in a
child, report that run separately and use the established browser-capable
parent path. Do not describe startup failure as the cause of this parent's
selection assertion or claim acceptance from static tests alone.

After fresh matching verification succeeds, independently review that checkout
against `prompts/phase-32b-review.md` through the existing runner workflow.
`32B verify` itself does not perform review. Phase 32B remains incomplete until
both verification and review pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant existing acceptance notes
with the corrected oracle contract, regressions, and actual verification state.
Report the observed 0.24 discrepancy and its border-width derivation, changed
files, exact commands/results, evidence paths and final checkout fingerprint.
Separate historical evidence, new child checks, parent native acceptance and
independent review. Explicitly list remaining unexecuted checks if any; do not
claim that production geometry was defective when only the test expectation
was shown to be stale.
