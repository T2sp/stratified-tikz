# Phase 32B Targeted Fix Prompt: Isolate live capture and finish bounded transfer

## Scope and preserved checkout

Work on `phase/32b-color-opacity-outline`. Read `AGENTS.md`, the paired 32B
implement/review prompts, the current implementation report,
`docs/PHASE_32B_LIVE_PAINT_ACCEPTANCE.md`, and its itemized
`docs/PHASE_32B_CORE_INVENTORY.json`.

The user has asked to consider less demanding verification. The concrete
`stz-32b-core-v1` proposal is already prepared, **not adopted**. Keep that proposal
and its finite boundary; do not rebuild the inventory or start another arbitrary
polygon/engine sweep. Independently justified capture/oracle corrections can
proceed without treating consideration as permission to waive a real defect.
The current strict policy remains active until an explicit scope decision.

Preserve all 17 already modified tracked files and four untracked files: the
acceptance document, inventory, connected-live PNG helper and bounded transfer
script. Starting HEAD is `8953e01c9c6b11731c44ea86b08564766f684d3c`. The latest
handoff, parent run and pre-prompt checkout match this tracked/untracked/binary
fingerprint:

```text
08d330566f72277ca21d9e6400002dbdb3a0e896517427e7a29a1768eea9cc8d
```

The preceding endpoint fixes/fixtures are now recorded in HEAD; do not reset or
restart them. Recompute final identity after changes. Use Node >=22.12.0 with
`/opt/homebrew/bin` first in PATH. Keep strict TypeScript, existing dependencies,
completed 31F/32A behavior and the separation of model, rendering and harness.
Keep 32C/32D deferred. This prompt update itself changes no implementation or
verification policy.

## Latest matching parent evidence

Read and preserve:

```text
/private/tmp/stz-phase32b-oracle-followup/HANDOFF.md
/private/tmp/stz-phase32b-oracle-followup/independent-review.md
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-ct50eB/response.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-gHadrw/verification.json
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-gHadrw/05-check-free-labels/command.log
/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32b-before-review-gHadrw/05-check-free-labels/artifacts/free-labels-evidence.json
```

The followup implemented the connected-live interaction oracle, authenticated
pixel replay, the separate four-shape transfer harness and the dormant itemized
scope proposal. It did not change production dash geometry. Its final child
checks passed 4,388 tests/build/diff/strict checks but both browser commands
stopped at localhost EPERM. Its independent `needs_changes` review predates the
following real parent results. Do not describe the latest parent as startup-blocked.

The parent `gHadrw` used Node v26.9.0 and Chrome 154.0.8037.57 with matching
before/after identities:

| Command | Parent result |
| --- | --- |
| `npm test` | 4,388 passed, zero failed/skipped/cancelled |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `npm run check:label-assets` | Passed |
| `npm run check:free-labels` | Failed in `point-paint-dash-caps` |

There are 14/16 completed groups, no page errors, an incomplete paint/import
group and an unexecuted final `settled-SVG-export-standalone` group. All 22 App
entries were attempted: **18 passed, four failed**. All 21 supplemental mechanisms
were attempted: **20 passed, one failed**. The latter is native progress from
18/21 in `pF6DA7`; zero-off and before-corner now pass their connected-live
mechanism checks. Do not credit the four App rows as passed or omit the remaining
full-closed failure because the terminal error describes capture instead.

## 1. Immediate blocker: unrelated tooltip paint contaminates the App mask

The first error is `square-zero-off`, scale `.5`, while inspecting the initial
responsive screenshot in `observeLivePaint` (`checkPointDashCaps.mjs:156`, called
at line 334):

```text
AssertionError: Live paint mask has an exterior margin
scripts/connectedLivePaintOracle.mjs:72
```

The same error occurs for `square-zero-off` and `square-positive-before-corner`
at both `.5` and `1.5`. Inspect `point-paint-dash-caps.json`, their per-case JSON,
`*-live.screen.png`, source/raster/control records and the current isolation CSS.
Each failed row has only its first `zoom:false` capture, status `captured` rather
than `inspected`; no magnified capture or corrected pointer probes ran. Framing
restoration and model/history preservation are recorded true. This is not a new
native candidate mismatch or evidence of an enlarged point border.

The retained screenshots visibly contain a dark selected-point tooltip over the
point, extending across the measured region's right boundary. At scale `.5`, the
CTM is `{a:.5,d:.5,e:225,f:175,b:0,c:0}`; the default local region `[-34,34]`
maps to screen x `[208,242]`, y `[158,192]`. The tooltip's dark pixels enter that
region and cross its edge: retained pixel `(242,174)` is RGBA `[44,51,64,255]`,
the dark tooltip background. Scale `1.5` uses
`{a:1.5,d:1.5,e:675,f:525,b:0,c:0}`. The black-pixel helper correctly rejects an
observation without exterior margin.
`selection:null` and zero export-excluded overlays under the point do not prove
all scene decorations are absent.

The tooltip comes from `renderSelectionCycleFeedback` in `SvgDiagram.tsx`:
`.svg-selection-cycle-feedback` is a root-level sibling of point groups, without
`data-svg-export-exclude`. The current owned CSS hides `body *`, makes every SVG
descendant visible, then hides export-excluded decorations; this feedback remains
visible. Clearing fixture selection does not itself clear the component's
selection-cycle feedback state. Check root-level decoration ownership and actual
computed visibility; the point-local overlay count is insufficient.
Fix the capture's presentation isolation so only the intended connected point
paint and calibrated background contribute. Keep the contour connected and its
source, stroke attributes, geometry, style, transforms and model/history intact.
Prefer a narrowly owned harness correction; do not change product picking or
normal tooltip behavior to repair test screenshots.

Keep the margin and positive/background calibration checks. Do not simply remove
the assertion, enlarge the region until the tooltip fits, accept clipped paint,
erase screenshot pixels, or use production candidates to decide which pixels
count. A region crop is valid only with independently justified complete point
paint and exterior margin. Inspect both responsive and magnified states; one
clean retained image does not verify the live capture procedure.

Preserve raw PNG/hash/dimensions/source/CTM/capture-region metadata before pixel
inspection can throw. Make failures identify the offending boundary/pixel and
capture state so another failure does not require a new broad investigation.
Verify owned isolation/restoration, including error paths, without changing
pointer-event semantics to force hits. Keep actual ordinary/Alt candidate checks,
cleared selection, overlapping-control checks, model/history identity and fresh
action transforms. Restore any temporary framing/styles and retain the primary
failure through bounded cleanup.

Add focused registered regressions for this demonstrated contamination and the
clean capture/restoration path, using actual selector/DOM behavior or retained
PNG evidence as appropriate. Existing synthetic clean-image tests alone missed
the obstruction. Keep genuine boundary-touching paint invalid and clean point
positive/exterior controls effective. Reuse the existing four case/scale captures;
do not add another mandatory matrix or expand the 856-artifact policy for this fix.

## 2. Separate remaining geometry issue and existing bounded transfer

The latest native supplemental matrix passes 20 entries, including
`zero-off-continuous` and `positive-before-corner`. Its sole failure remains
`positive-full-closed-control`: literal triangle `0,0 24,0 12,16`, width 12,
square caps, bevel joins, pattern `[100,100]`, phase 1. It retains 24 definite
connected-live omissions. The first is `(0,-14)`: independently visible paint
is about `5.7732207757` local units away but production distance is 8, omitting
it from the six-unit picking region. The queried pixel being background does
not make the omission correct.

That exact arbitrary triangle is not an existing regular point contour. The
prepared transfer checks exactly triangle, square, star and circle at one size
and uninterrupted closed-dash setting. Their static model reachability is known;
normal-workflow impact still requires native evidence. **The phase verifier does
not run this separate script.** No transfer result is supplied by `gHadrw`;
the retained attempted transfer remains four `not_run` rows after server EPERM.
Do not mistake this parent browser run for completed transfer evidence.

Review the shared capture helper's transfer caller before execution. It uses a
1536-square capture and local region `[-48,48]` with its own decoration isolation.
Apply a demonstrated common capture correction where needed, but do not claim the
transfer has already exhibited the same margin failure. Retain capture metadata
before inspection errors there too. An invalid or clipped observation is not
proof that no supported defect exists.

Run the existing bounded check in the authorized browser-capable parent:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/checkPointClosedDashTransfer.mjs
```

Retain exactly the four shapes and one setting, live and independent continuous
paint, genuine exterior `(-40,-40)`, trusted ordinary/Alt candidates, source/model/
history restoration and final checkout identity. Preserve raw converted dash
attributes `100.00000000000001`; do not round saved inputs or emitted source to
nominal `100`. Keep `1e-9` only for coordinate-inversion arithmetic, not picking.
Fixture serialized-SVG reopening is useful transfer evidence; actual App
immutable downloads and standalone reopening remain separately required.

If supported workflows reproduce a miss, fix that demonstrated mechanism narrowly
or obtain a concrete further scope decision. If successful native transfer does
not demonstrate a supported workflow defect, present the existing conditional
limitation proposal with that evidence. Do not automatically waive the remaining
literal triangle or restart a sweep of arbitrary polygons, resolutions or engines.

Do not restore the rejected generic initial/terminal seam cap. It inflated the
triangle dash-phase radius from about 28.42645 to 30.4021 against raster 28.39994
and created phantom hits at `(-6,-34)` and `(0,-32)`. Preserve these negatives.

## 3. Reuse the finite scope proposal; do not silently adopt it

`docs/PHASE_32B_CORE_INVENTORY.json` already itemizes all 856 baseline paths:
**646 proposed required, 206 advisory, four superseded clone-oracle roles**.
All five commands, 16 groups, 29 scenarios and 22 App dash identities stay core
in the proposal. Its four corrected case/scale replacements reuse existing files.
These counts describe evidence roles, not reduction targets. Keep the existing
inventory and update only justified dispositions/evidence, not its breadth.

The recommended boundary remains:

- Mandatory: native independent paint/opacity/style, ordinary selection/drag/
  cycling, corroborated solid/dashed controls, 2D/3D/work planes, data/history/
  presets/clipboard, exact source and serialization, bounded import uncertainty
  and local intent, both TikZ modes and independent PGF references, immutable
  downloads and actual standalone reopening.
- Separately owned diagnostics: exhaustive cross-rendering-path dash-seam
  equivalence, duplicate dense captures and research beyond current supported
  workflows. The exact full-closed limitation is conditionally deferrable only
  after successful reviewed transfer and an explicit scope decision.

The current capture failure blocks reliable core observation, even under the
proposed profile; treating it as advisory would not satisfy the proposal.
Correcting it is distinct from relaxing verification. Do not silently turn
failed rows into passed ones or use the proposed lower required count as a waiver.

If the user adopts the profile, align runner/contracts/artifact ownership,
registered policy tests, docs and review criteria together. Bind the accepted
profile and exact limitations to the checkout/report. Preserve raw failed,
not_run and blocked outcomes separately from acceptance disposition. Unexpected
core failures, stale/missing/malformed evidence, page errors and unexecuted
required groups must fail. Prevent advisory diagnostics from starving required
work, especially the final settled-SVG group. Negative policy tests must reject
unrelated failures disguised as known limitations.

Until adoption the existing strict 16/29/856 gate remains active. Neither a
capture correction nor a successful transfer adopts the profile automatically.
An adopted outcome may say core acceptance passed with named limitations, not
complete dash conformity. Freeze the finite inventory after adoption and do
not expand it for hypothetical completeness.

## Preservation and final verification

Keep the independently justified connected-live oracle and authenticated replay;
clone raster, containment, live pixels and production geometry stay separate.
Retain six-unit picking, `.14` uncertainty, separate selection decoration,
contour interiors and continuous-stroke selection through gaps. Preserve full
isolated square/disk dots, outgoing positive tangents, terminal-only zero-dot
exclusion, separately capped zero-off intervals, raw precision, bounded arithmetic,
effective-style matching, solid joins and the 256-edge circle contour.

Keep all completed paint/import/PGF, legacy normalization, cloning/history,
raw JSON/CRLF, labels, pending/settled immutable exports, native visibility and
App continuity work. Preserve trusted-input/restoration diagnostics, monitor-drain
fix, owned cleanup, failed evidence and fresh-process policy loading. Retain the
runner's 60-second fixture deadline. No retry-until-green, global deadline/
concurrency change, new dependency, unrelated cleanup or 32C/32D work.

Preserve historical evidence byte-identically, including original `epviae`,
`pF6DA7`, `gHadrw` and the oracle-followup handoff. Historical child EPERM,
unfinished `vaZYVU`, rejected generic-cap explorations and the unproven `UThawr`
timeout remain distinct; later progress does not establish an old failure cause.

Run focused registered regressions, applicable strict TypeScript, script syntax,
targeted lint and diff checks. Separate the two established guarded-cleanup lint
findings and existing bundle warning from new failures; do not claim repository
lint is clean. Run `npm test` and `npm run build` sequentially. Finalize checkout
files and record final identity/evidence externally, then obtain fresh matching
parent verification:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32B verify
```

Inspect both complete browser reports, all 22 App/21 supplemental outcomes and
required actions, the separate four-shape transfer, and the final settled-SVG
group that the latest run did not reach. Child execution restrictions are not
passes; use authorized parent execution without bypassing permissions. An earlier
failed run cannot become a new-policy pass. Later checkout edits require matching
verification again.

Obtain fresh independent read-only review under the paired review prompt and any
explicitly adopted amendment. Completion requires passing required evidence on
the final identity and an accepted disposition of remaining limitations under
that same scope. If strict full-closed conformance remains the only blocker,
report the concrete existing scope decision rather than automatically expanding
the investigation. No commit/push without successful required verification and
review. 32B currently remains incomplete; 32C/32D remain deferred.
