# Phase 32D Fix for PGF diamond aspect arithmetic and signed ellipse traversal

## Objective and scope

The App wait follow-up fixed two reproduced helper defects: browser frames could
be accepted after the inner deadline, and cancellation could miss late wait
registration. Precise stage/probe timing, immutable entry evidence and bounded
original-document cleanup are implemented. Authenticated pending-selection
publication and absolute deadline ownership are also implemented. Preserve these
fixes; neither historical native timeout's exclusive cause is established.

The latest matching browser-capable parent now passes all required checks,
including all 18 cumulative groups, all 12 layout scenarios and both actual
pending downloaded/reopened exports. Independent completion review then returned
`needs_changes`: Critical 0 / Medium 2 / Low 0, `ready_to_commit: false`.
The two production conformance defects are the active blockers:

1. Diamond fitting uses ordinary division instead of PGF's scanned aspect inverse,
   changing contour height and north-anchored placement for supported small aspects.
2. Mixed-sign ellipse radii reverse SVG traversal, changing direction-sensitive
   dashed paint relative to PGF and the sampled contour.

Fix these two reproduced defects in small shared pure geometry helpers, plus
meaningful independent references, rendering/export regressions, necessary runner
copies and Phase 32 status documentation. Do not repeat the completed App wait,
publication, freezing, signed-axis or cylinder fixes. No model/saved schema,
parameter-range, authored-option, UI/input, style, dependency or broad capture/
TikZ-generation rewrite is justified. Keep the existing aspect range 0.01–100.

Read `AGENTS.md`, the paired implementation/review prompts and both Phase 32 docs.
Authenticate the latest handoff, review manifest and source/artifact hashes.
Resolve published parent evidence with `readEvidenceDocumentSync` and its complete
exact checkout; do not treat a pointer as the raw observation.
Phase 32 remains incomplete because of `needs_changes`, despite complete parent
browser acceptance. All checks and independent review must be fresh after source
edits, followed by a matching-tree guard. No commit or push.

## Latest handoff, accepted parent and rejected review

Latest App implementation handoff:
`/private/tmp/stz-32d-app-wait-fix-20261014/HANDOFF.json`.
Bytes: 33,191. SHA256:
`a525e18e9cbeb5058d7b4369a5e02705af2da08db9e00be1dc3421556cfde378`.
Its native-pending status predates the subsequent complete parent execution;
retain that immutable handoff and record the newer result separately.

Latest parent verifier response:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase-verifier-DOqrfo/response.json`.
SHA256: `af5bed781225c8536725e3aca302236db1a1e8d948d4d843721d411866bee881`.
Latest parent verification report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-KZ5KP9/verification.json`.
SHA256: `8369c139f29dd306724dda5e37f1303d2768ecb8cdedd6a59cc26262e8c46bf1`.
Parent free-labels artifact directory:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-KZ5KP9/05-check-free-labels/artifacts/`.

Latest independent review summary: `logs/codex/32D-review-summary.json`.
SHA256: `a29a114135cfc4b2ec8d6302db2e7d1fceb4e25497275c6f9413f57c26faf212`.
Full review: `logs/codex/32D-review.log`.
SHA256: `1def5ecd9293e6d8df0b11956ea3b359b1e396a2e415666a76dd3721bb5f2731`.
Independent reproduction manifest:
`/private/tmp/stz-32d-review-pgf/manifest.json`.
Bytes: 4,985. SHA256:
`8cd2592e5084d3d38f71fd568659951575ea19d08eab1dd7550401f267151a48`.
All 18 declared artifact/source hashes match current bytes. Retain the original
PGF input/log/raw geometry, solver observations, SVGs/PNGs, renderer probes,
commands, engine/version and hashes unchanged as pre-fix evidence.
Before source edits, retain authenticated copies of the reviewed source bytes,
with original-path to retained-path/byte/hash associations. Keep new source and
reference identities separate from that immutable reproduction manifest.

Branch: `phase/32d-margin-minsize-anchor`.
HEAD: `129bccd8119f313b6902fa9ae948f3b216aa4dda`.
Before this prompt edit, handoff, parent before/after and review manifest all match:

~~~text
8443f980f600cd365fd8f93b8af2946542012f486a201fae67bd83adae362396
~~~

Tracked-diff SHA256:
`f21606a0fabebfba237d6f1df3143ce4d44db27954a9fd4eeb62e95854d6ca6c`.
The handoff's nine-file source inventory has six modified tracked files and three
untracked files, inventory SHA256:
`50dd2b247566b81fa7599f8a94e0fe00bf973344d28a6b1cd92bf5c7e2f9b0e2`.
Retain its exact path/byte/hash entries as the authenticated baseline. Preserve
the inherited implementation; record necessary documentation/test-registration
updates and new source identities separately. Untracked identities are:

~~~text
tests/scripts/appGeometryAppCaller.test.mjs
  215e5c36298a47a033865ad8e54200b8e7207dcb943452ffca50e569c0c58300
tests/scripts/appGeometryWaitFixture.mjs
  865ef3662b38519fccf496aa88157d0d894713e4359ef2a42609305dc9bf7414
tests/scripts/appGeometryWaitOwnership.test.mjs
  acdc2482eb3d436e20d13b25cb7589e33484327ab647d22378f182a55e95ba99
~~~

All nine handoff files match before this prompt edit. The earlier 16-file
publication inventory is inherited at HEAD; those are not current untracked
files. All 571 inherited associations, 562 additive evidence files and 654
original references remain preserved. Do not reset/stash/drop inherited work.
Prompt/source edits change identity: every new gate must capture actual tracked
and untracked bytes, not reuse the preceding fingerprint.

| Evidence | Actual result on the preceding tree |
| --- | --- |
| Frozen implementation | 7,344/7,344 tests; build, strict TypeScript, scoped lint, syntax and diff passed. Focused App 102/102, publication/policy/runner 1,550/1,550 and preservation 868/868; counts overlap. |
| Child browsers | Both configured commands hit localhost `listen EPERM` before Chrome. Child startup did not establish native acceptance. |
| Matching parent KZ5KP9 | npm test 7,344/7,344, build, diff, label-assets and free-labels all passed; exact checkout unchanged. |
| Authenticated parent browser replay | 18/18 groups started and completed, 205 evidence records, 4,907 diagnostics, zero page errors. All 12 named layout scenarios and final standalone passed. Both pending exports retain 15-entry immutable envelopes, actual downloads and clean external reopening. |
| Independent review | `needs_changes`, Critical 0 / Medium 2 / Low 0. Reviewer full tests 7,344/7,344; focused geometry 401/401 and diagnostics 72/72; build/strict TypeScript/scoped lint/syntax/diff passed. Matching parent artifacts were inspected and accepted. No checkout files changed. |
| Lint debt/status | Five inherited findings reproduced separately; repository-wide lint was not run. The two production findings still block completion/commit. No commit or push. |

Historical `yWdc9n`/`P19JEq` failed in App stability, and older `u4oMpK`/`QBA9vY`
failed during pending selection evidence. Preserve their partial outcomes and
unresolved causes as history, not current missing-browser gates. The complete
App evidence is in the raw cumulative report; `app-workflows.json` is absent even
in the successful parent and its absence is not an acceptance gap by itself.
KZ5KP9's complete prior-tree acceptance cannot accept upcoming geometry changes.

## Diamond: reproduce PGF's scanned aspect inverse

The independent PGF 3.1.11a reproduction uses fixed body width/height/depth
20/8/3pt, inner x/y separation 1.5pt, outer separation 0, minima 1pt and supported
`aspect=0.01`, anchor `north`. PGF north distance is 1170.06155pt; production gives
1157pt, a 13.06155pt error. The manifest and raw files also retain neighboring
aspects. Inspect the actual source rather than fitting a constant to this case.

Current duplicate formulas are in `src/geometry/pointNodeShapes/solve.ts:92–93`
and `anchors.ts:458–459`. The north axis uses `x / aspect` in both paths.
PGF's `\pgfsetshapeaspect` in `pgflibraryshapes.geometric.code.tex` instead scans
`aspect pt`, performs the `.125` dimensional multiplication, converts scaled
points to an integer count, divides `8192pt` by that count and prints the saved
inverse. Subsequent dimensional products/additions have their own TeX scanning
and truncation order. Plain JavaScript reciprocal/division and the existing
`pgfReciprocal` helper are different algorithms; do not substitute one without
independent stage equivalence.

Implement one narrowly shared pure diamond-fitting helper used by paint and
anchor construction. Reproduce the supported PGF sequence, scalar/dimensional
quantization and `unitScale` behavior. Preserve independently applied width and
height minima after aspect fitting. Keep outer-clearance anchor axes separate
from the documented diamond background subtraction of `1.414213 * outerSep`.
The accepted outer-separation exception is not this aspect defect; do not remove
it, apply it to other shapes or recover signed axes from sorted paint bounds.
Keep currently supported named/numeric anchors and text/base/mid placement
consistent with the same fitted geometry, including attached/free/inline labels,
both ambient dimensions and settled SVG. Preserve unsupported text-side anchor
diagnostics; do not expand the support map as part of this arithmetic fix.
TikZ must retain the user's authored aspect/options instead of compensating for
preview arithmetic in generated source.

Add additive authenticated independent PGF stage/path/anchor references for
small and neighboring aspects, including .01, .03, .1, .2, .6, 1.1 and 100.
Cover independent minima, asymmetric/signed separation, zero/empty bodies and
scaled units with exact inputs, PGF source/engine/command/units and artifact hashes.
The reference generator must not import the production solver or use production
values as its oracle. Verify both fitted axes/paint and every supported anchor
category/placement. A control restoring the old analytic division must fail.
Use the existing 0.025pt anchor and 0.03pt contour tolerances; no widening or
rewriting inherited expected data to hide the mismatch.

## Ellipse: retain signed traversal when encoding SVG arcs

The independent reviewed `ellipse-mixed-axes` case has body 20/8/3pt, inner
separation -30/+2pt, minima -2/-5pt and outer separation 0. Its signed fitted
axes are (-1, 10.6066017). With stroke width .4pt, dash array `2 5`, SVG dash offset
-2.7, 800×800 rendering of viewBox `-40 -40 80 80` and dark threshold 128,
production and PGF each have 480 dark pixels but differ at 298 positions.
Changing only the two SVG sweep flags gives zero mismatches; corrected PNG bytes
have exactly the independent PGF PNG hash. Preserve those original/control files.

`ShapeContourBuilder.arc` in `src/geometry/pointNodeShapes/contours.ts:91–92`
currently chooses sweep from parameter direction alone. One negative radius
reverses orientation; account for axis signs and forward/reverse parameter
traversal under the existing PGF-to-SVG coordinate transform and border rotation.
Retain signed analytic axes, start point/endpoints, ordered vertices, bounds,
anchors and sampled picking contours. Absolute magnitudes, if used, belong only
in SVG arc radius operands. Do not globally abs axes, reverse sampled vertices,
change the start angle, dash pattern/offset, source style or anchor placement.

Test all four nonzero radius sign combinations, positive/reversed partial sweeps,
full split arcs, rotation/translated centers, multiple dash phases and appropriate
caps/joins/solid/fill controls. Compare ordered quarter endpoints/tangents or
cumulative traversal, plus actual independent PGF-token SVG/PNG paint.
Equal bounds, orderless contour distance and dark-pixel counts miss this defect.
Keep an explicit old-sweep negative control and a global-abs-axis control.
The existing mixed-sign test's blanket sweep-zero invariant must be replaced
with independently justified direction cases, not wholesale expected-path edits.

Exercise the shared contour.path through actual live and detached settled SVG
rendering/export in 2D and 3D, with authored styles/dashes and unchanged model,
history, coordinates, projection and TikZ. Preserve zero-axis ordered retracing,
quarter extrema, stroke length/closure/no-fill behavior, signed rectangle/ellipse
anchors and picking, magnitude-only sample density, 0.005 precision and the
2048 finite-work budget. Check folded/signed cylinder arcs, seams/end/body order
and custom fill because they share the path builder. No broad shape rewrite.

## Preserve completed wait and publication fixes

Retain three exactly equal App comparison snapshots, original generation/URL/API,
source/request/bounds/node/CTM/layout/scroll/camera/viewBox/viewport invariants,
absolute browser deadline checks and exact-token cancellation fences for late
registration. Keep immediate initial/late evaluation ownership, immutable entry/
terminal stage/probe evidence, bounded original-document drain and first Error
retention through failure/cancellation/cleanup. Preserve scoped entered/release
regressions and all original native controls. No sleeps, retries, force actions,
observer restart, global clock mock or relaxed readiness may mask a regression.

Keep browser 2,000ms / host 2,100ms / cancellation 250ms, ordinary diagnostics
2,000ms / publication 5,000ms and normal App action/page/I/O/image/cleanup limits.
Retain v2 complete-checkout authentication, immutable ordered pack references,
strict declared-v1 replay, raw/history/pointer/index agreement, queued freezing,
absolute producer/authority guards and independent bounded failed publication.
Late outcomes cannot produce pass checkpoints or rewrite failed authority.
All five ordered selection/report/preparation publications and complete retention
before success return remain required. The offline 851,936-byte / 59.331917ms
composition is preserved helper evidence, not exclusive historical-cause proof.

## Preserve completed cylinder fixes and independent references

Keep runtime signed cylinder fitting metadata, actual end/base role ordering,
full named/text-side/numeric anchor construction and shared placement.
Preserve folded valid geometry, ordered paint bounds, seam/custom regions,
PGF clearance/branch order, rotation/frame conversion and valid signed neighbors.
Keep staged TeX dimension scanning/fitting and source-aware domain resolution,
raw authored options/units/context, warning-only zero-domain live/settled/picking/
export behavior, valid zero-axis shapes and same-owner state transitions.

Retain all562 new evidence files unchanged:
173 under `cylinder-fitting-scanning/` and389 under `cylinder-export-domain/`.
Keep authenticated folded37-anchor coverage,254 recorded scanning/control anchors,
13 zero failures/13 compiler successes and12 later reciprocal-failure controls.
Keep33 model/66 actual-generated compiler runs in the export-domain bundle,
including16 zero-divisor,15 success and two nonzero later-failure model cases.
Use the handoff/reference manifests for exact input/source/engine/command/
compiler/hash counts rather than counting files as geometry cases.
No PGF data or tolerance widening can hide conformance.

Retain original172 boxes/4,925 anchors/11 original failures, signed-basic8/
192,54 polygonal/1,386,12 arithmetic controls/four dart traces/one singular control,
eleven zero-axis paths/37 render records/490 additive files and original110
raw-zero cylinder-domain artifacts with11 failure controls/12 controls/93 anchors.
Keep0.025pt anchor/0.03pt contour tolerances,0.005 precision/2048 finite-work budget.
Keep singular/subsp warning-only downloads under their dedicated strict diagnostic
context; no broad empty-body/filename exemption. Preserve seven-owner empty-body
acceptance and full native/association/SVG/PNG/TikZ provenance independently.

Retain earlier67 empty-body,72 publication,61 correspondence,65 live-capture and
55 background controls plus completed cylinder/domain/freezing/progress suites.
Preserve actual DOM order/derived owner association, file-local contour/body/root/
placement/paint proof, owner-bound CTM, full-stroke pixels, exact model/click/
history and SVG/PNG/TikZ/file identities, owned capture and UI restoration.
No production dependency or saved-schema change is needed. New independent
references for the two conformance defects must be additive; preserve all
inherited reference bytes and their original meaning.

## Preserve completed corrections and contracts

Retain signed rectangle/ellipse `signedFittedAxes` and exact anchors/placement,
magnitude-only radius density, oblique negative-ellipse picking and existing
both-dimension signedAnchorCases/signedPickingCases/raw policies.
Retain deterministic stalled-report injected ordinary-write recorder,20ms
deadline, exact primary Error/nativeChecks count, two stalled failure writes,
late rejection ownership and complete listener/page/browser/server cleanup.
The earlier stalled-report race was resolved; preserve that targeted control.
The global20ms live-writer race was corrected with scoped scheduler control;
preserve that fix. Deterministic freezing and owned verifier progress are now
implemented and the first affected/full suites completed. The historical reviewer
cancellation was not uniquely established or reproduced; do not claim a proved
historical cause. The App wait fixes and complete matching parent native
acceptance are retained; the two current conformance findings block completion.

Keep explicit resolved preview schema (six dimensions, anchor, effective font
context) separate from exact authored units/source/context.
Keep immutable-click-derived native source/anchor/`110` expectations for full
runtime/saved envelope/history present, faithful fixtures and parent corruption
controls. Do not restore raw layout spreads or globally strip metadata.

Keep real unique zoom numeric/associated slider/disclosure, one native1.4 fill,
ordered before/immediate/after observations, native input/change provenance,
connected circle/rectangle/cylinder root-relative matrices, measured both-axis
scale/fixed-origin proof and precise binary32 propagation.
Keep exact state/history/selection/revision/uiSettings/pan/held-source invariants,
owned cleanup, mandatory post-click artifact and terminal/standalone/raw-policy
binding. Root screenCTM equality and persisted2D camera omission remain valid.

Keep deterministic pre-load fifteen-point fixture/ids/order/sources/styles/layout/
parameters, selected circle(7,6.5,0), two free labels and unique export-path
curve/polyline with both exact inline nodes/content/options.
Keep fixed.23 native preparation, current hit stack/owner/request/held source,
one ordinary trusted gesture, selected owner proof, Inspector/UI restoration and
all missing/duplicate/wrong-content inline/preparation regressions.

Keep immutable pending sequence: hold → normal load → native selection →
actual background/armed snapshots → SVG click while held → post-click edit/view
or replacement load → intended release → actual download → original reload/
settled expectations/both TikZ modes → external reopening → complete-root PNG.
Keep all15 click-time entries, original source/layout/placement, pending/settled
contour distinction and release-boundary evidence. Cleanup release is not
acceptance. Preserve transparent/white content and background assertions.

Keep Clear/imported paint/shape/layout detachment and exact persistence/history;
native Select/Inspector/toolbar preparation/restoration; trusted handle/capture/
release movement, one history commit and exact Undo/Redo under the same valid
document revision; fresh JSON-load/reused-ID/cache/request isolation;
canonical layers, exact Hidden points controls, dim/hide/dim provenance,
camera theta90/phi0 and owner/filter/lock/occluder checks.
Keep ordinary unsupported body → far → warning, fixed diagnostic candidates,
six-unit clearance, bounded warnings, overflow bodies and native owner cycles.

Keep saved version2/additive layout, legacy Size/2, ordered spacing/shorthand/
per-axis em/ex contexts, text/baseline/depth, real preview/export projection,
raw free/attached/inline text and existing typography/TeX limitations.
The documented diamond outer-separation exception was authenticated and judged
correct by the preceding independent review; preserve it without applying
that exception to other shapes. Preserve completed signed-axis and cylinder fixes.

Keep both callers using unchanged `captureStandaloneSvg`, normal fonts,
bounded settling, one actual image/no retry, complete-root coverage, at most
one viewport expansion, stable coordinates and exact SVG/PNG file identity.
Keep pre-image reopening records, owned cleanup, primary errors and no extra
failure screenshot. Preserve actual PNG CRC/chunks/inflated scanline/dimensions/
byte validation, artifact inventories, raw-policy checks and runner copies.

## Fresh verification, review and handoff

Use strict TypeScript without `any`, small separated helpers and no new dependency
without explaining why. Register new tests in the explicit `package.json` list.
Retain first completed outcomes, complete counts and any initial failures rather
than replacing them with isolated retries. Do not add tests that only echo the
new implementation; use independent PGF values and direction-sensitive paint.

Update both Phase 32 docs for the latest complete KZ5KP9 parent, rejected review,
two reproduced conformance defects, scoped fixes and actual new results.
Keep child EPERM, historical timeout causes, implementation helper controls,
complete prior native acceptance and new matching acceptance distinct.
Do not claim either historical timeout's exclusive cause is established.

Run focused diamond arithmetic/reference/anchor/placement and signed-ellipse
contour/dashed-paint/live/settled-export tests, plus preserved signed/zero-axis/
cylinder/scanning/domain, App ownership, publication/reader/authority,
pending/standalone/native/capture/association and strict parent/runner controls.
Use Homebrew Node >=22.12.0 and normal project settings:

~~~bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
~~~

Run strict TypeScript, changed-code lint and script syntax/diff. Keep four
original inherited lint findings plus the separately reproduced `SvgDiagram`
finding distinct from new-code checks. Do not fix unrelated debt or claim
unperformed repository-wide checks. Preserve all original reference hashes and
add a separate exact inventory for new independent artifacts.

Run fresh browser-capable strict parent verification on actual changed bytes:

~~~bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 32D verify
~~~

Require all 18 cumulative groups and all 12 named layout scenarios, both ambient
dimensions/native/live/standalone, folded/subsp/singular cylinder and signed/
zero-axis cases; both transparent/white pending workflows with full 15-entry
immutable click envelopes, actual downloads, external reopening, complete-root
SVG/PNG/TikZ/source/reference/authority replay and no page errors.
Real-App-workflows and its native geometry controls must return before group
completion; final standalone must execute and pass. Include meaningful native/
export coverage for the corrected diamond placement and dashed signed ellipse.
Enforce added native evidence in parent policy or an existing required scenario's
terminal inventory, with missing/mismatched controls; an exit-zero incomplete
report must not accept the new conformance coverage.
KZ5KP9 is complete preceding-tree evidence and must not be reused after edits.

Preserve clean-tree rules; do not reset/stash/discard inherited work or commit.
If child browser startup hits EPERM, record the exact failure/tree and retain a
handoff for the browser-capable parent without relaxing coverage. After all
required checks pass completely, obtain fresh independent read-only completion
review using `prompts/phase-32d-review.md` on matching tracked/untracked bytes and
actual resolved reports/artifacts. The old `needs_changes` review is not a pass.
Missing/incomplete/cancelled checks or review and new `needs_changes` block
completion/commit. Keep the post-review complete matching-tree guard.

Report each reproduced cause, shared arithmetic/traversal correction, meaningful
negative controls, independently authenticated references and actual renderer/
native/file results. Include exact changed-file/artifact inventories, first
focused/full/browser outcomes, baseline lint debt, preserved identities and
new tree/report/review hashes. Phase 32 remains incomplete until all gates pass.
Do not commit or push; leave that decision to the parent after verification and review.
