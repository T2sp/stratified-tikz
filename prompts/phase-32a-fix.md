# Phase 32A Targeted Fix Prompt: Locate the native 3D coordinate-mode control correctly

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect status first and preserve the implementation,
previous oracle and persistence fixes, verifier correction, fixtures, tests,
documentation, and all user changes, including untracked files. Do not reset or
restart implementation.

The latest parent checked revision `a0eefe53c396884dc0193600902104248ee423e2`
plus working-tree changes. Its before/after fingerprint was
`26469eb29c4ebfd0699ae7c3675ea62d00922ce6dd39c4ddc1805b96981a46b8`.
This matched the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated native 3D coordinate-mode locator mismatch,
focused interaction regressions and diagnostics, and further demonstrated 32A
acceptance failures. Keep strict TypeScript and avoid new dependencies, schema
changes, unrelated lint cleanup, or new rendering features. Preserve the shared
MathJax/runtime/layout/export design and leave 32B-32D deferred.

## Latest execution findings

The latest parent reached the 3D native direct-input iteration and timed out
while locating its coordinate-mode select. This is a new browser-harness failure.
The previous 2D JSON persistence comparison now passes in both export modes.
Do not describe the current failure as child localhost `EPERM`, the historical
line-metric mismatch, or a recurrence of missing view-metadata expectations.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-aRv0pQ
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and the checkout snapshots;
- `point-native-2d.json` and `point-native-2d-standalone.json`;
- `point-observation-0139.json` through `point-observation-0148.json`, including
  both modes' download and reload observations, and preceding rendering evidence.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-bHe6qE/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,534 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointNodesApp.mjs:71` |
| Failure stage | `point-node-native-input` |
| Failure | 30-second `locator.selectOption` timeout |
| Completed groups / passing records | 11 of 15 / 116 |
| Completed point scenarios | 7 of 11 |
| Page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The seven completed point scenarios remain:
`point-language-shapes-2d-3d`, `point-valid-invalid-valid-exact-source`,
`point-A-B-C-delete-duplicate-history-load`, `point-resource-retry-font-readiness`,
`point-contour-boundaries-cycling`, `point-camera-pan-zoom-drag`, and
`point-hidden-filtered-locked-dimmed-siblings`.

Within the incomplete native scenario, the 2D direct/Inspector/cursor workflow
and both JSON save/reload modes completed before the 3D iteration. Download and
reload observations 0141/0143 and 0146/0148 also pass a read-only replay through
the current persistence assertions. This is corroborating saved evidence, not a
new browser run or a completed aggregate scenario.

Native 3D point creation has not reached coordinate entry or Create. Its later
Inspector, work-plane cursor, and persistence assertions remain unexecuted.
Point settled exports and the later general App/settled-export groups were not
executed. Four groups remain incomplete: `point-node-body-layout-lifecycle`,
`point-node-settled-export`, `real-App-input-JSON-history-reused-ID-load`, and
`settled-SVG-export-standalone`. The child's reported 0/15 execution is separate
from this parent's partial run.

## Confirmed selector mismatch

The failing interaction is:

```js
const form = page.locator('.direct-input-drawer-form')
if (ambientDimension === 3) {
  await form.getByLabel('Coordinate mode', { exact: true }).selectOption('global')
}
```

The production form in `src/App.tsx:6879-6910` has a wrapping label containing
both the heading and the select, without a separate `aria-label` or
`aria-labelledby` on that select. Its relevant structure is:

```html
<label class="direct-create-field direct-coordinate-mode-field">
  <span>Coordinate mode</span>
  <select>
    <option value="global">Global 3D coordinates</option>
    <option value="workPlaneLocal">Active work-plane local coordinates</option>
  </select>
</label>
```

The installed Playwright label engine obtains associated label text through
`getElementLabels()` and recursively collects it with `elementText()`. That text
includes the option descendants, so exact matching against only `Coordinate mode`
cannot locate this select. These functions were inspected in the installed
`playwright-core/lib/coreBundle.js` under the configured external Node runtime.
Do not conflate this text-matching rule with an unverified claim about the
browser's accessible-name calculation for role locators.

The `global` option value is correct. `directCoordinateModesForAmbientDimension()`
in `src/ui/directInputDrawer.ts` returns `global` and `workPlaneLocal` in 3D.
The production conditional includes 3D `createPoint`, and the control belongs
inside the scoped direct-creation form. Increasing the wait cannot correct the
exact-text mismatch.

The failed native form's DOM was not retained in the existing point observations.
Confirm its live state in the corrected native workflow and distinguish a missing
form/control from a naming mismatch if the observed UI differs. No production
rendering, persistence, or coordinate-model defect is demonstrated by this timeout.

## Goal and required reading

Make native 3D direct point creation select the intended global-coordinate control
reliably, prove the resulting coordinates, and finish the remaining acceptance
workflow while retaining all previous assertions.

Read `AGENTS.md`, `prompts/phase-32a-implement.md`,
`prompts/phase-32a-review.md`, `docs/PHASE_32A_IMPLEMENTATION.md`, and:

- `scripts/checkPointNodesApp.mjs`, `scripts/checkPointNodes.mjs`,
  `scripts/checkFreeLabels.mjs`, and point diagnostic helpers;
- the direct-creation form, tool/drawer transitions, and relevant work-plane and
  camera controls in `src/App.tsx`;
- `src/ui/directInputDrawer.ts`, applicable direct-creation tests, and fixture
  setup in `scripts/fixtures/freeLabelsApp.tsx`;
- `scripts/appJsonPersistence.mjs`, the persistence expectation/tests, and
  `scripts/automation/phase-verification.mjs`.

## 1. Correct the locator while keeping the native interaction

Use a unique locator scoped to the active direct-creation form that matches the
actual production control. Candidates include a verified role/name locator,
`form.getByLabel(/^Coordinate mode/)`, or the existing
`.direct-coordinate-mode-field select` inside that form. Verify the chosen
locator against the real rendered App; do not assume changing to another exact
name automatically solves the problem.

Assert that the loaded document is 3D and the intended point-creation form is
active. Require one visible, enabled select with the expected option values;
select `global` and verify the selected value before filling coordinates.
Then require x/y/z fields and retain exact created model position
`{ x: .4, y: .7, z: .2 }`, point kind, and `codim: 3` assertions. Preserve the
2D x/y input and z=0 behavior without requiring a 3D-only select there.

Do not use `.first()` to hide ambiguity, silently skip a missing control, rely
on its default selection, extend the timeout alone, select an unrelated global
control, or mutate the model/React state through fixture shortcuts. Do not rename
production controls or add test-only accessibility labels solely to accommodate
the stale locator. A production accessibility change needs separate evidence.

Audit adjacent 3D-only locators before proceeding, but change only demonstrated
mismatches. Source inspection already shows explicit labels for Work-plane preset,
Fixed x/y/z coordinate, and camera numeric fields; the checkbox controls do not
have the same nested-option text issue. The TikZ mode locator already uses a
prefix regular expression. Preserve these interactions and verify them natively.

## 2. Add focused coverage and useful setup diagnostics

Add a focused regression that exercises the actual wrapped-label/select boundary
and the corrected target selection. A mock that merely returns an element for
any locator string cannot catch this failure. Retain the native App workflow as
the acceptance proof for both dimensions.

Check uniqueness, valid option selection, and resulting global coordinate entry.
If a reusable selection helper is introduced, test that absent/ambiguous controls
or an invalid option fail rather than being treated as success. Keep this bounded;
no general UI-selector framework or unrelated test rewrite is needed.

Record the native setup before the vulnerable selection, and preserve useful
failure observations before closing that page: dimension/document revision,
active form/tool information where observable, matching control counts,
labels/select DOM, option values, current value, visibility, and enabled state.
Capture actual failing-page diagnostics with a bounded operation; preserve the
original selection error if capture or cleanup also fails. Maintain existing
point stages and honest observation-versus-pass accounting.

## 3. Preserve completed fixes and finish the remaining workflow

Retain exact-source/visible-fragment separation, independent line/ink metrics,
native SVG whitespace/containment checks, existing tolerances, corruption
controls, and font/viewport/CTM diagnostics.

Preserve the successful 2D persistence correction: exact non-view content and
expected UI view metadata, model-only `state().json`, separate read-only UI
settings, download model/history invariance, strict reload payload equality,
and restored controls. Complete the 3D camera/axes/visibility and both export-mode
save/reload assertions; their presence in source is not a native pass.

Finish native 3D direct creation, Inspector recovery/history, xy/xz/yz cursor
placement, persistence, all three point settled-export scenarios, and subsequent
general App/settled-export groups. Keep the sanitized-SVG verifier correction,
structural checks, required artifacts, and all Phase 31 regressions. Diagnose
any further demonstrated 32A failure from fresh evidence without relaxing gates.

## Verification and completion

Run focused regressions, applicable script syntax, strict fixture TypeScript,
and targeted lint, then:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

The browser-capable parent/Terminal must obtain fresh verification on the final
corrected checkout, including untracked files:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32A verify
```

Keep all fifteen groups, eleven named point scenarios, required artifacts,
checkout matching, fresh verifier process, and pre-review/commit failure gates.
Do not lower counts, skip checks, weaken sandboxing, or rewrite historical failure
evidence. If child browser startup is restricted, run available checks and provide
an exact handoff; parent browser acceptance remains required.

A standalone `verify` run does not perform independent review. After accepted
complete verification, review the exact matching checkout against
`prompts/phase-32a-review.md`. Do not recursively launch implementation/fix from
the fix child. Update `docs/PHASE_32A_IMPLEMENTATION.md` and relevant completion
documentation with actual native results and remaining gates.

## Report after fixing

Report the observed control/label structure, chosen locator and state assertions,
focused regressions, setup/failure diagnostics, changed files, actual check
results, and fresh parent scenario/artifact results with checkout identity.
Separate previous oracle/persistence fixes, child `EPERM`, this parent locator
timeout, subsequent verification, and independent review. Keep 32A pending until
its gates pass and leave 32B-32D outside this fix.
