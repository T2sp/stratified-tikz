# Phase 32B Targeted Fix Prompt: Resolve Inspector paint fields independently of option and warning text

## Environment

Work on the current Phase 32B checkout (reported branch:
`phase/32b-color-opacity-outline`). Inspect status first and preserve the current
implementation, all previous 32A corrections, selection-oracle correction,
fixtures, tests, documentation and user changes, including untracked files.
Do not reset or restart implementation.

The latest parent checked revision `a2f2ba66faa9afe299dc5471ccc18bb43b043f42`
plus working-tree changes. Its before/after fingerprint was
`6475b6191b76ea9ba28d891839ff309d40c97f8407c0ebe782f41e708447c03e`.
This matches the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated Inspector field-locator failure, its adjacent
validation-message case, focused regressions/diagnostics, and further demonstrated
32B acceptance failures. Preserve strict TypeScript and avoid new dependencies,
additional schema changes or unrelated lint cleanup. Keep 32C geometric shapes
and 32D spacing, minimum dimensions and anchors deferred.

## Latest execution findings

The previous border half-width fix is now exercised successfully by the parent.
All eleven cumulative 32A point scenarios passed, including resource/font
readiness, pointer selection, native Inspector/persistence, transparent/white
standalone point exports and whole-node fallback. Preserve that correction.

The child reported localhost startup `EPERM`, but the latest parent launched
its browser and reached the first new 32B paint scenario. Its current failure
is a 30-second wait for an exact label locator, not a server-startup failure.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-yLwzPX
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and matching checkout snapshots;
- `point-paint-observation-0001.json` and `point-paint-observation-0002.json`;
- `point-paint-legacy.json`;
- completed cumulative point scenario records, especially
  `point-resource-retry-font-readiness.json` and native export artifacts.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-TDvlPq/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,695 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointNodePaint.mjs:101` |
| Failure stage | `point-node-paint-import-persistence` |
| Current scenario | `point-paint-native-inspector-history` |
| Completed groups / evidence records | 14 of 16 / 145 |
| Completed point scenarios | All 11 from 32A; 0 of 5 new 32B scenarios |
| Browser page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The paint group started but did not complete its first scenario. The later
`settled-SVG-export-standalone` group was not reached. Its absence does not negate
the completed `point-node-settled-export` group; these are distinct requirements.

The failure observation retains selection `{ kind: 'stratum', id: 'app-point' }`.
The seven preceding native field edits reached the model: text red/0.6, fill
blue/0.35, border green/0.7 and width 2pt. The line style/cap/join remain
`solid`/`butt`/`miter`. Request count remains 3. This places the failure at the
first select lookup, after successful loading, selection and basic paint edits;
it does not establish that the entire mixed-paint scenario passed.

## Cause: exact associated-label text includes nested descendants

The harness currently uses one locator for every field:

```js
const inspector = page.locator('#preview-inspector-drawer')
const field = (name) => inspector.getByLabel(name, { exact: true })
```

`PointPaintFields` renders `Border line style`, `Border cap` and `Border join`
through `EditableSelectField` in `src/ui/inspector/InspectorField.tsx`. This shared
component wraps its caption and native select/options in one HTML label, with
no separate `aria-label` or `aria-labelledby` on the select:

```html
<label class="inspector-field">
  <span class="inspector-field-label">Border line style</span>
  <select class="inspector-input">...option descendants...</select>
</label>
```

Playwright's associated-label text lookup includes those option descendants.
Consequently, exact `getByLabel('Border line style')` does not identify this
control. The same markup/query mismatch was already reproduced natively for
32A's Coordinate mode control; inspect `scripts/pointNativeCoordinateMode.mjs`.
Do not conflate this label-text query with a role locator's accessible-name
computation or assume that every HTML label lookup behaves identically.

The same select usage occurs for all three controls in `setMixedPaint()` and
for cap/join after imported-preset application. Fix all five select call sites,
including repeated calls to `setMixedPaint()`, rather than advancing the timeout
from line style to cap or join.

There is also a directly adjacent problem visible by source inspection: after
`field('Border width').fill('NaN')`, `EditableParsedNumberField` renders
`Border width must be a finite number greater than 0.` inside the same label.
The following exact lookup for `aria-invalid`, and the later corrective fill,
can fail for the same reason. This is a predicted later failure, not one executed
by the latest parent. Exercise it explicitly in the corrected harness.

The two retained paint observations contain model/runtime state but no Inspector
DOM or locator counts at the failing boundary. Capture and reproduce those
counts in the next native run; do not claim new native label measurements from
source inspection alone. No production paint/rendering defect is demonstrated
by the reported timeout.

## Required reading

Read `AGENTS.md`, `prompts/phase-32b-implement.md`,
`prompts/phase-32b-review.md`, `docs/PHASE_32B_IMPLEMENTATION.md`, and relevant
acceptance contracts in `docs/PREVIEW_UI.md` and `docs/LABEL_ADAPTER.md`.

Trace the failure and existing patterns through:

- `scripts/checkPointNodePaint.mjs`, `scripts/pointCheckDiagnostics.mjs`,
  `scripts/pointPaintOracle.mjs`, and `scripts/fixtures/freeLabelsApp.tsx`;
- `src/ui/inspector/PointPaintFields.tsx`, `InspectorField.tsx`,
  `PointStyleEditor.tsx`, `UserStylePresetControls.tsx`, and `numericInput.ts`;
- `scripts/pointNativeCoordinateMode.mjs`, its registered tests, and
  `scripts/pointNativeSetupDiagnostics.mjs`;
- the preserved `scripts/pointSelectionOracle.mjs` and its registered tests;
- `scripts/automation/phase-verification.mjs` and the existing parent verifier
  workflow in `scripts/automation/run-phase.mjs`.

Line numbers identify the inspected failure; locate the equivalent current code
if subsequent changes have shifted them.

## Required correction

### 1. Resolve the intended native control in the active Inspector

Replace the fragile paint-field lookup with a small, consistently used harness
resolver scoped to the active `#preview-inspector-drawer`. Identify the exact
caption in `.inspector-field-label`, then its enclosing `.inspector-field` and
intended native control. Match the caption itself, independently of select
option text and inline validation messages. Use the expected native control type
where relevant and ensure there is exactly one intended wrapper/control.

Check the Inspector and control are present, visible and enabled before actions.
For selects, verify available option values, perform bounded native
`selectOption`, and verify the returned selection, actual value and resulting
model property. Ensure line style becomes dashed, cap round and join bevel in
both the initial mixed-paint edit and applicable imported local overrides.

Preserve proper scope when the saved-preset editor is also present: its fields
have a `Preset ` prefix and must not be confused with live point fields. Reject
missing or ambiguous controls rather than choosing `.first()`/an index. Avoid
page-wide selects, loose substring matching or a fallback that silently picks
a different field. Do not simply remove `exact: true` from every locator.

Use the same stable caption/control contract when an invalid numeric draft adds
warning text. Keep the real Border width `NaN` edit, `aria-invalid` assertion,
unchanged model/history checks and recovery to 2. Retain the production warning
and `aria-describedby`; do not remove validation UI to make the test pass.

A test-side correction is sufficient for the demonstrated mismatch. Preserve
production input behavior, layout and paint semantics. Do not preseed the desired
paint through fixture APIs, directly patch App/model state, force actions or
skip the real Inspector edits. Keep the existing color-input event path and
all native model/history/rendering assertions.

### 2. Exercise the actual wrapped-field boundary

Add focused registered checks for the resolver and a native regression using
actual production Inspector field markup. The existing coordinate-mode test
provides a bounded clone-page pattern; a clone can isolate lookup negative
controls, while the real App scenario must still invoke production handlers
and verify resulting paint/history. Handcrafted markup or locator mocks alone
do not establish that the production structure is handled.

Cover all three select captions, option selection and re-resolution after
rerender, the numeric field before/after warning text appears and after recovery,
`Preset `-prefixed fields, and an unrelated control outside the Inspector.
Reject absent, duplicated, hidden or disabled targets and unavailable options.
Preserve unrelated controls and ensure invalid drafts do not mutate the saved
model/history. Include an initial default value different from the desired
selection so a skipped action cannot satisfy the check.

Record the original exact-label match count alongside the corrected locator
count in native evidence. Prove the original select lookup's mismatch without
waiting another 30 seconds; then exercise the corrected selection. Do not assert
a historical exact count if production markup has legitimately changed: report
the current DOM and distinguish changed label semantics from regression results.

### 3. Retain useful evidence before the failing operation

Before the first select and the invalid-width boundary, save active selection,
Inspector visibility/expansion state, relevant wrapper/control markup, caption
text, label text/ARIA attributes, locator counts, native options/current values,
and the current point paint plus model/history/request identity. Save the
post-action values and field-validation state as well.

On failure, retain these diagnostics and the original Playwright call log;
diagnostic or cleanup errors must not replace the primary error. Keep existing
owned event/download cleanup and source/conversion lifecycle protection. Mark a
scenario passed only after all its assertions and required artifacts complete.

### 4. Preserve completed corrections and 32B contracts

Keep the independent border-half-width selection oracle, all 16 new selected-view
regressions, pre-assertion geometry diagnostics and ownership-based FontFace
cleanup. Do not restore the old `radius + 6` expectation or change production
selection/picking geometry to address this unrelated locator failure.

Preserve independent text/fill/border paint, opacity composition, saved-envelope
v2 migration, preset/import ordering, TikZ overrides, immutable pending SVG
capture, raw source/history, all earlier 31/32A fixes, retained PGF references,
and binary-aware checkout identity. Leave unrelated working-tree changes intact.

Do not weaken group/scenario/artifact requirements, fingerprint checks, review
or commit/push gates. If later native checks reveal another failure, retain its
evidence and diagnose it before a bounded 32B fix; do not assume it must also be
a locator problem.

## Verification and completion criteria

Run focused regressions, the registered full suite, build, applicable strict
TypeScript/fixture checks, changed-script syntax checks, targeted lint and
`git diff --check` using the supported PATH. Preserve the documented unrelated
lint baseline rather than expanding this fix into cleanup.

Obtain fresh browser-capable parent verification for the final checkout:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Require all five commands to pass, including both browser checks. Inspect the
terminal result, all 16 required groups, all 16 named point scenarios (11 from
32A and 5 from 32B), page-error arrays and actual required JSON/SVG/PNG artifacts.
The paint group must complete Inspector/history, imported presets/persistence,
lifecycle/dimming, pending transparent-edit and pending white-load acceptance.
The later standalone settled-export group must also execute and complete.

Evidence must match the final checkout, including untracked files and binary
fixtures. Historical passes, helper tests and partially executed scenarios do
not close the gate. If browser startup is unavailable in a child, report it
separately and use the established browser-capable parent path; do not confuse
that restriction with the latest parent's successful startup and locator failure.

After matching verification succeeds, independently review that checkout against
`prompts/phase-32b-review.md` through the existing workflow. `32B verify` itself
does not perform review. Phase 32B remains incomplete until verification and
review both pass; 32C/32D remain deferred.

## Report

Update `docs/PHASE_32B_IMPLEMENTATION.md` and relevant existing acceptance notes
with the field-locator cause, bounded correction, regressions and actual results.
Report changed files, exact commands, evidence paths and final checkout identity.
Separate the old selection issue now passed by the parent, the observed select
timeout, the predicted invalid-width lookup issue, newly executed verification
and independent review. List remaining unexecuted checks explicitly; do not
claim a production rendering defect from this harness timeout.
