# Phase 32A Targeted Fix Prompt: Remove the injected font before comparing point export geometry

## Environment

Work on the current Phase 32A checkout (reported branch:
`phase/32a-tex-labeled-node`). Inspect status first and preserve the implementation,
previous source/metric/persistence/locator/XML-Canvas fixes, verifier correction,
fixtures, tests, documentation, and all user changes, including untracked files.
Do not reset or restart implementation.

The latest parent checked revision `1876a0aa8bb92db605f66f8c7eb0911d1756633c`
plus working-tree changes. Its before/after fingerprint was
`768bdd23b2f9b1dc705ba07b9ad83bcbe1eaf2b871df8f62255d29e142296fa2`.
This matched the inspected checkout before this prompt update. The prompt changes
checkout identity; obtain fresh evidence for the final corrected tree.

Use Node >=22.12.0 with the supported installation first in PATH:

```bash
export PATH=/opt/homebrew/bin:$PATH
```

Limit work to the demonstrated leaked test FontFace and contaminated geometry
reference, focused lifecycle regressions and diagnostics, and further demonstrated
32A acceptance failures. Keep strict TypeScript and avoid new dependencies,
schema changes, unrelated lint cleanup, or new rendering features. Preserve
shared MathJax/runtime/layout/export behavior and leave 32B-32D deferred.

## Latest execution findings

The attachment contains two runs. Use the final `cCLyYw` parent run as the latest
evidence; the earlier `iP6w9K` Canvas exception is historical. The namespace fix
now allows standalone Canvas collection to run. The current failure is a radius
comparison against a renderer fixture whose test font was not removed.

Read this parent directory:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32a-before-review-cCLyYw
```

Inspect `verification.json`, `05-check-free-labels/command.log`, and these files
inside `05-check-free-labels/artifacts/`:

- `free-labels-evidence.json` and the checkout snapshots;
- `point-resource-retry-font-readiness.json`, including before/after injected-font
  observations;
- `point-native-direct-cursor-workplanes-inspector-persistence.json` and the four
  native 2D/3D JSON downloads;
- `point-native-pending-transparent-edit.svg`;
- `point-observation-0186.json` through `point-observation-0193.json`, especially
  `0191`, which contains the output and both contaminated reference observations.

Verifier handoff:

```text
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-PqPABV/response.json
```

| Observation | Actual parent result |
| --- | --- |
| `npm test` | Exit 0; 2,579 passed |
| Build / diff / `check:label-assets` | Exit 0 |
| `check:free-labels` | Exit 1 at `checkPointNodesApp.mjs:293` |
| Failure stage | `point-node-settled-export` |
| Completed groups / passing records | 11 of 15 / 117 |
| Completed point scenarios | 8 of 11 |
| Page / standalone page errors | Empty |
| Checkout before/after | Same fingerprint |
| Independent review | Not reached |

The eight completed point scenarios include native direct/cursor/work-plane/
Inspector/persistence checks in both dimensions. The first transparent export
was downloaded and reopened, and its XML Canvas diagnostics now show a detached
XHTML `HTMLCanvasElement`, matching owner document, and a usable 2D context.
The exact-source metric probe and its font-property checks passed before the
radius comparison failed. Preserve this progress without claiming the complete
transparent export scenario passed.

The remaining white export and whole-node fallback scenarios were not reached,
nor were the later general App/settled-export groups. Four groups remain
incomplete in the report: `point-node-body-layout-lifecycle`,
`point-node-settled-export`, `real-App-input-JSON-history-reused-ID-load`, and
`settled-SVG-export-standalone`. No completed transparent standalone JSON/PNG
acceptance is established. The child's startup `EPERM` is a separate result.

## Confirmed cause: quoted FontFace family defeats name-based cleanup

The font-readiness scenario deliberately installs an alternative native font:

```js
const font = new FontFace('Times New Roman', 'local("Courier New")')
document.fonts.add(font)
await font.load()
```

After testing remeasurement, `scripts/checkPointNodes.mjs:191` attempts cleanup:

```js
for (const font of document.fonts) {
  if (font.family === 'Times New Roman') document.fonts.delete(font)
}
```

Chrome serializes the added face's `family` with quotation marks. The saved
observation contains:

```json
{ "family": "\"Times New Roman\"", "style": "normal", "weight": "normal", "status": "loaded" }
```

Therefore the unquoted equality check is false. Cleanup leaves the injected
Courier New face registered under Times New Roman in the reused renderer page.
A font event/generation increment does not remove the face. Subsequent `mount()`
replaces diagram content but retains the document's FontFaceSet and runtime.

The real App and reopened SVG have no added FontFaces. The renderer references
still have the quoted Times New Roman face. Their declared font strings and size
match, but they resolve to different actual fonts. In `point-observation-0191.json`:

| Measurement | App / downloaded SVG | Renderer reference |
| --- | --- | --- |
| Added FontFaces | 0 | 1, the injected Times New Roman alias |
| Font size | 12 | 12 |
| Canvas font-box ascent/descent | 11 / 3 | 10 / 4 |
| Compiled point radius | 38.717011003498015 | 51.16800759663269 |
| Fallback point radius | 42.20426518730068 | 56.04634566087673 |
| Fallback logical width | 48 | 86.4140625 |

The failing formula uses the contaminated reference bounds:

```js
const [x0, y0, x1, y1] = reference.bounds
assert.ok(Math.abs(output.radius - Math.hypot(
  (x1 - x0) / 2 + 1.8,
  (y1 - y0) / 2 + 1.8,
)) < 1e-8)
```

Those bounds yield 51.16800759663269, about 12.451 above the actual export radius.
The reference is internally consistent with its different font. The following
strict comparisons to `reference.radius` and `fallbackReference.radius` would
also fail if only this tolerance were relaxed.

The padding 1.8 is correct for size 3 and the established scale 1.2. This evidence
identifies contaminated test state, not a demonstrated production circle-radius
or export-layout defect. Do not change production geometry to fit that reference.

## Goal and required reading

Give the injected FontFace an explicit lifetime, restore the renderer's actual
font environment after the readiness scenario, and compare export geometry only
against a compatible, settled reference. Retain font-change coverage and all
existing export assertions.

Read `AGENTS.md`, `prompts/phase-32a-implement.md`,
`prompts/phase-32a-review.md`, `docs/PHASE_32A_IMPLEMENTATION.md`, and:

- `scripts/checkPointNodes.mjs`, `scripts/checkPointNodesApp.mjs`,
  `scripts/fixtures/freeLabels.tsx`, and `scripts/fixtures/freeLabelsApp.tsx`;
- `scripts/fixtures/labelBrowserOracle.ts`, `scripts/pointLiteralOracle.mjs`,
  existing point diagnostics and cleanup helpers;
- font-readiness handling in `src/rendering/labels/svgLabelRuntime.ts`,
  `useSvgLabelState.ts`, and `labelMetrics.ts`;
- `src/rendering/svgPointNodeGeometry.ts`, point layout/view, applicable tests,
  and `scripts/automation/phase-verification.mjs`.

## 1. Own and remove exactly the injected FontFace

Retain the actual added FontFace object or an explicit browser-side handle to it.
Delete that same object from its owner document's FontFaceSet instead of selecting
faces by serialized family text. Put acquisition/use/cleanup under `try/finally`
so cleanup runs when loading, measurement, assertions, or evidence writing fail.
Release any retained browser handles as well.

Verify that the owned face is absent afterward, while pre-existing/unrelated faces
remain. Do not use `document.fonts.clear()`, remove every face sharing a family,
or fix this by stripping quotes and continuing broad family-based deletion.
Do not merely reload the reference page or remove the font-change test to conceal
the broken cleanup.

After removal, trigger the existing supported font-change/revalidation path,
wait for font readiness and current runtime/layout settlement, and verify that
representative native widths, line metrics, and contour geometry return to their
pre-injection values. Keep the source and model/history unchanged through this
measurement lifecycle. A dispatched event, a counter change, or no pending DOM
nodes alone is insufficient evidence that the original font is restored.

Preserve the original test error if cleanup or diagnostic capture also fails;
report cleanup failure when there is no earlier error. Never record the font
scenario as complete before its required restoration checks succeed.

## 2. Validate the export reference before using its bounds

Before radius comparisons, record and check that the App snapshot captured at
export click, saved SVG, and renderer reference use compatible source, relevant
point style, declared font configuration, and actual measurement environment.
The live App is deliberately edited to `$laterPoint$` or replaced with another
document during the race; do not require its later source to match the download
or reset it to construct the reference. Retain FontFaceSet observations and sample
native Canvas/font metrics; matching family strings alone missed this failure.

Require current settled reference results after font restoration. Runtime font
generation and owner IDs are local to each page; do not require those numbers
or complete request IDs to equal across independent documents. Instead establish
that each result is current for its own runtime and uses the intended font.

A fresh reference page may help isolate diagnosis, but the reused renderer must
also prove that the font test cleans up correctly. Keep references independent
from exported radii: do not copy `output.radius` into expected values, derive
expected bounds from the exported contour, or import production geometry merely
to make the comparison circular.

Preserve the radius formula, existing tolerance, both strict radius comparisons,
body containment, pending-versus-settled size change, raw source, and standalone
fallback checks. If corrected native observations reveal a separate production
error, document and fix that specific issue with a regression.

## 3. Add lifecycle regressions and persist restoration evidence

Add focused tests that catch the actual serialized-family trap and ownership
boundary: quoted family, an existing different FontFace with the same family,
successful removal, failure during the injected-font test, and cleanup failure
without replacing the primary error. Avoid mocks that normalize away the quotes
or accept any deletion target.

In the native browser, retain before/add/after-removal observations for the same
source, document, and runtime. Assert the injected font really changes measurement,
then that removal restores the original metrics and leaves no owned face behind.
Exercise later reference creation in the same page so an order-dependent leak
cannot be hidden by isolated unit tests. Register meaningful tests in `package.json`.

Save restoration observations before assertions and geometry-comparison operands
before radius checks: sources, font faces and configuration, line/width metrics,
current request/generation, relevant style, reference bounds, computed expected
radius, actual radius, and difference. Preserve useful failure evidence without
marking partial work as passed.

## 4. Preserve prior fixes and finish native acceptance

Keep the detached same-owner-document XHTML Canvas creation, document-context
diagnostics, capability checks, and standalone document-immutability tests.
Retain independent line metrics, source/visible-fragment separation, native SVG
whitespace/containment checks, and all existing corruption controls.

Preserve corrected 3D coordinate selection, native 2D/3D interactions and both
JSON modes, model/history isolation, strict persistence metadata/restoration,
and the sanitized-SVG verifier correction. Complete all three point export
scenarios and subsequent general App/settled-export groups with fresh evidence.

The leaked font affects later checks even where their assertions happened to
pass. Rerun the full required sequence after fixing cleanup; do not reuse partial
historical passes as acceptance of the corrected tree or weaken gates to avoid
another demonstrated 32A failure.

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

Report the quoted-family evidence, owned FontFace lifecycle/restoration fix,
reference compatibility checks, affected assertions, regressions/negative
controls, diagnostics, changed files, actual command results, and fresh parent
scenario/artifact results with checkout identity. Separate historical fixes,
child `EPERM`, this parent contaminated-reference failure, subsequent native
acceptance, and independent review. Keep 32A pending until its gates pass and
leave 32B-32D outside this fix.
