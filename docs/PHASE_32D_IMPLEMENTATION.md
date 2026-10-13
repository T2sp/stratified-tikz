# Phase 32D spacing, minima, anchors, and combined audit

## Cylinder construction, scanned dimensions, and verifier progress (2026-10-13)

This fix starts at clean HEAD `afe1bd642f8bf5a97671c0ade2b3a2c5565ffcbf`,
fingerprint `e830af22f561da5256d21788d907ca2e954213286c348f5d2da4bb093f22a4c7`.
That prompt commit includes the thirteen previously modified files and all 116
previously untracked files. The accepted predecessor is `dTPBzJ`, not the
historical restricted child `T6o1A2`. New identities include actual changed
tracked and untracked bytes; the supplied pre-prompt fingerprint is historical.

The latest independent review is **needs_changes**, Critical 0 / Medium 3 /
Low 0, `ready_to_commit:false`. It establishes three current findings:

- A valid empty cylinder with `inner xsep=-30pt`, `inner ysep=5pt`, minima
  `1pt`, outer separation `0`, line width `.4pt`, and anchor `bottom` loses its
  construction roles when anchors are reconstructed from painted bounds. PGF
  places bottom at `(4.6,0)pt`; the reviewed implementation gives `(.6,0)pt`.
  Positive radii do not prevent folded end/base ordering. Shape center,
  compass, text-side and numeric anchors also fail; a bottom-only correction
  cannot close the finding.
- An empty cylinder with `inner ysep=.000001pt`, `inner xsep=0`, minimum
  width `0`, minimum height `80pt`, and line width `.4pt` retains nonzero
  JavaScript padding but has a zero TeX transverse dimension. Actual generated
  and correctly wrapped TikZ fails PGF division. The reviewed preview paints
  an approximately 96-unit cylinder without a warning.
- The queued freezing regression times out its first deliberately held writer
  after a real 1,000ms, charging fixture preparation to a machine-dependent
  budget. Reviewer verification later cancels the verifier file with an
  unresolved promise. The log does not establish that freezing caused that
  cancellation. The 8,555,226ms missing-title subtest completed before later
  controls, so its duration is a localization clue, not proof of the unresolved
  operation.

The complete reviewer log is `/private/tmp/stz-32d-review-1791812464902/npm-test.log`
(SHA256 `baba12cc62b59f5d8c0a01c8cc7565e2b95cd84572bb0c8e23679768ce6fd4c5`).
It observed 7,055 tests: 7,053 passed, one failed, one cancelled, zero skipped;
the interrupted run is **incomplete**. Its isolated freezing/closed-title
retries each passed 1/1. The focused geometry/rendering 538/538 and
model/layout/TikZ/export 74/74 checks passed. Those diagnostics do not replace
complete registered-suite acceptance.

The matching historical parent passed 7,094/7,094 tests and all five checks.
Its authenticated browser documents were resolved again using
`readEvidenceDocumentSync` with the recorded historical checkout: all eighteen
groups and ten layout scenarios, 203 records / 4,625 diagnostics, no page errors
or incomplete/unexecuted groups. This supports preservation of existing
contracts, but cannot override the review or verify new bytes. The 110 retained
raw-zero cylinder evidence files match their recorded hashes byte for byte.

Implementation results and fresh verification for this invocation are recorded
below after the scoped work completes. Phase 32 remains **incomplete** until
complete fresh strict verification and matching independent read-only review
pass. Browser startup restrictions leave native/file acceptance pending for the
browser-capable parent; no review, commit or push is implied by focused tests.

### Scoped corrections and additive acceptance

Cylinder construction now retains runtime-only `cylinderFitting`: signed `rx`
and `ry`, actual declared end/base centers, side role points, signed half-length
and body extension. These coordinates are unrotated PGF Y-up coordinates relative
to the upright body-box center. The anchor resolver transforms that metadata
once into its rotated SVG Y-down frame. Paint contours, the seam and custom
body/end regions retain their independent construction and ordered bounds.
Anchors no longer recover signs or roles from paint envelopes. End-arc clearance
still uses the signed `max(outerXSep,outerYSep)`; side points use `outerYSep`.
Declared branch order, infinite-line intersections and bounded arc bisection
remain unchanged. No model/history/clipboard/export schema fields were added.

`cylinderDomain.ts` evaluates the relevant dimensional register stages in TeX
scaled points using `unitScale ?? 1`. It separately scans inner separation,
body width/height/depth, each dimensional half-product and advance, rotation's
axis/inner-separation exchange or incircle fitting, and scanned minimum width
followed by its dimensional halving. It classifies the final transverse divisor
before the existing division/RangeError route. Scalar division/reciprocal
arithmetic remains distinct. Signed scanner ties apply the sign after magnitude
rounding; dimensional half-products truncate towards zero.

Dimension scanning uses the effective source that the existing exporter emits.
Local/direct and overridden fields emit six-decimal resolved `pt` literals;
unchanged inherited fields may be replaced by raw named-style options later in
the option sequence. The runtime resolver reads the current associated imported
reference and its resolution context, including valid legacy layouts without an
intent snapshot. It applies the existing override-field and matching-preset
rules. A historical baseline alone cannot replace current reference text.
Scanning a tiny inherited `em`/`ex` coefficient before multiplying its unit can
differ from scanning the local resolved point literal. Authored numbers, units,
source/context, raw text and exporter output remain unchanged. This runtime input
is frozen separately in click capture and bound into cylinder layout reuse;
a same-valued native edit can change the effective source and invalidate the old
commit without changing the text request. Current inherited rotation/incircle
flags are carried only for those classifier stages; a changed current named
reference can change the divisor even when saved fitting snapshots are stale.
Actual generated PGF controls authenticate that case. Paint still uses the
preserved model parameters. Quantization is limited to cylinder
domain classification, leaving paint and other shape calculations unchanged.
The existing warning-only layout/picking/export route suppresses requested
contours, seam, regions and hidden selection areas.

Separate evidence lives under
`tests/fixtures/point-node-anchors/cylinder-fitting-scanning/`. It authenticates
the retained folded case with all 23 supported named anchors and 14 numeric
spellings, compact signed/minimum/rotation/incircle/outer-separation neighbors,
and scanner ties, half-product cancellation, one-/two-scaled-point minima and
physical/contextual units. The bundle distinguishes zero-divisor failures,
genuine compiler successes and nonzero-divisor cases that fail later with
PGF's reciprocal `Dimension too large` error. A surviving first scaled point
is not described as a successful whole-node compilation. Original raw inputs,
compiler/generated reviewer bytes and their hashes are copied additively;
oracle generation imports no production solver. Tests retain one PGF Y
conversion, .025pt anchor / .03pt contour tolerances and the existing finite
work/precision limits. All 654 preceding shape/anchor reference files, including
the 110 raw-zero cylinder artifacts, match HEAD and recorded historical hashes.

The additive bundle contains 173 files: thirteen authenticated zero-divisor
failures, thirteen actual compiler-success controls with 254 recorded anchors,
and twelve distinct nonzero-register reciprocal-overflow controls. Regeneration
uses `node tests/fixtures/point-node-anchors/cylinder-fitting-scanning/generate.mjs`
with the recorded TeX Live 2026 / PGF 3.1.11a engine and source hashes. Compiler
logs are explicitly included in checkout identity by the scoped `.gitignore`.

Shared tests cover the two reproductions in 2D/3D pending/live/settled placement,
paint/seam/custom regions, picking/far misses, exact authored padding and units,
JSON/history/reload, current owners/requests/revisions, same-owner
folded→subsp→folded recovery, and standalone/inline TikZ. Runtime metadata is
absent from saved documents. Independent contour checks remain separate from
placement checks.

The cumulative eighteen-group workflow retains all ten predecessor scenarios
and registers two additional mandatory scenarios:
`point-layout-cylinder-folded-anchors` and
`point-layout-cylinder-subsp-diagnostic`. Folded coverage uses ordinary load,
Inspector/native anchor inputs and fresh current owner/projection/CTM observations
for the complete anchor bundle, contour picking and actual complete-root SVG/PNG/
TikZ downloads and reopening. Subsp uses the strict existing dedicated cylinder
diagnostic context, with exact raw/model/source/domain/owner/request/revision,
warning/body absence-of-requested-paint and real file/PNG replay. Neither new
file route is eligible by filename or through the seven-owner signed empty-body
route. Publication/ref/association/root/CTM and legacy body gates remain required.
Synthetic corruption fixtures prove policy rejection; they do not establish
native browser acceptance.

The freezing regression prepares its expensive independent fixture and expected
value before holding an actual asynchronous ordinary writer. A per-publisher
scheduler seam controls only that test's owner deadlines; production still uses
5,000ms and intentional timeout controls remain. The queued root is frozen
before exact field mutations while the first writer stays held, then actual
bytes are written/resolved and compared losslessly. Shared entry waits race
immediately owned publication outcomes, propagating an early primary rejection
instead of leaving an entry promise pending. Finally blocks release/settle gates
and drain outcomes/late writes.

The real verifier's contextual corruption, publication authority and diagnostic
replay paths now record stages before awaited subtests/publications, assert
exact mutation restoration and complete subtest/stage counts, and drain owned
publication outcomes. Deterministic injected early writer failure and a selected
held-writer deadline exercise the complete cumulative fixture's actual native/
standalone publications, exact primary Error propagation, terminal failure
authority, late writer settlement and cleanup. Instrumentation does not claim
to identify the unique cause of the interrupted reviewer run. Complete fresh
affected-file/full-suite outcomes remain the acceptance evidence.

### Completed focused checks and browser disposition

Homebrew-first Node 26.9.0 completed the final cylinder/reference/shared sweep
114/114 and expanded preserved geometry/reference/render/model/TikZ sweep
720/720, zero failures/cancellations/skips. The initial oracle assumed a
one-scaled-point reciprocal would compile; authenticating its later overflow
corrected that assumption without discarding the failure artifacts. Initial
test API/export precision assertions were corrected to the existing public APIs
and six-digit export convention; production/exporter behavior was not changed
to satisfy those assertions. Exact initial outcomes remain in the scoped handoff.

Native/artifact policy checkpoints completed 74/74 initially, 25/25 after final
folded provenance strengthening, and the entire affected 32D policy file
741/741 on its first full run, zero failures/cancellations/skips. These are
synthetic/helper checks, distinct from required real browser acceptance.

Both affected publication/verifier files completed their first combined run
679/679, zero failures/cancellations/skips. Immediate raw stdout exposed entry
and restoration stages while the file was running; `t.diagnostic` alone is
buffered. Real contextual/authority/diagnostic replay counts are 48/48, 12/12
and 21/21, with exact restored bytes and zero pending outcomes. The pre-edit
full verifier also completed 639/639 during diagnosis; this does not identify
the cause of the historical cancellation.

The first complete registered `npm test` run passes **7,195/7,195**, exit 0,
zero failures/cancellations/skips/todos in 1,037,436.429417ms, using normal
project settings. It adds 101 tests to the preceding 7,094-test suite, with no
predecessor removed. That run began before the lint-only unused-import removal
and final documentation updates. An intermediate strict runner then completed
7,195/7,195, zero failures/cancellations/skips/todos, on unchanged matching bytes
(`284d204ff3aabe15960899673d30c4d1efc73b55617a667110dddd436f561a17`).
Build and diff passed; label-assets failed at server `listen EPERM`, and the runner
stopped before free-labels. Report:
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-manual-q0YyPN/verification.json`
(SHA256 `f3a6cc4ff17e81a0d21384e7fc4e9f90e101719d32f2f2148f6c122382f4b164`).
This intermediate run is superseded by subsequent substantive source-domain and
placed-DOM test corrections, not reused as final-tree acceptance.

The final source audit authenticated a local `.0000074em` input whose actual
export resolves to `.000074pt` and compiles, while its inherited raw named-style
form scans to zero and fails division. A same-valued local override compiles;
the initial classifier warned on both local forms. Valid legacy imported-layout
and changed-current-reference controls expose why style snapshots alone are
insufficient. The first new export-domain test file observed 22 passed / one
failed out of 23: a stale same-owner commit survived a changed effective source.
That is a retained failing regression, not a retry accepted as final verification.
Additive model/actual-generated/inline-and-standalone compiler evidence is under
`tests/fixtures/point-node-anchors/cylinder-export-domain/`, separate from the
unchanged first 173-file bundle. The second bundle contains 389 files and 33
validated models / 66 actual compiler runs across both export modes: fifteen
compiler-success model controls, sixteen zero-divisor controls and two distinct
nonzero-divisor later-failure controls. It also authenticates the actual 3D
occluded preset-only case: dimming breaks named-preset matching, so emitted local
`pt` literals govern classification. Selection receives the same existing
occlusion-derived dim state only for source resolution; visibility policy is
unchanged. The five final cylinder files complete 154/154 with zero failures,
cancellations/skips. The extended preserved geometry/reference/render/picking/
capture/model/TikZ sweep completes 909/909 with the same zero-failure disposition.
The first final-source file run observed 39/40: its JSON
comparison mixed parser-normalized key order with original fixture key order.
The correction compares serialization before/after the same loaded model;
original artifact bytes/hashes and decoded model/generated-source checks remain.
Exact initial/final logs, inventory and fresh complete final-tree runner are
recorded in the external handoff. All 562 new independent files are additive.

Read-only native audit also corrected the folded artifact contract to distinguish
placed DOM body origin/baseline from the unplaced solver frame. The final focused
contract run completes 27/27, with controls rejecting the mistaken zero body
origin at bottom and zero baseline at mid. The final frozen-tree runner captures
all actual tracked/untracked bytes before/after and runs the full registered
suite again. Prior passes and isolated diagnostics cannot substitute for it.

Build, strict application/new-test TypeScript, changed TypeScript lint (seven
files), script syntax (seventeen files) and diff checks passed. Changed-script
lint found one newly unused test import, removed without changing assertions;
the corrected scoped seventeen-file check passes. The verifier's unchanged
`_role` unused argument is excluded only in that scoped new-code check.
Read-only HEAD lint separately reproduces four inherited errors: `_role`, two
geometric caller unsafe-finally statements and the layers test unused import.
The first baseline command omitted browser globals and reported extra no-undef
findings; its corrected configuration reproduces exactly those four errors.
The final changed-source/new-test TypeScript check covers sixteen files; it
passes with only the separately reproduced `react-hooks/refs` rule excluded for
`SvgDiagram`. Full-file lint of that newly touched propagation caller reports
one inherited refs finding at line 979; read-only HEAD reproduces the same
unchanged callback at line 978. This additional finding is separate from the
four previously scoped inherited findings. Eighteen final scripts pass syntax
and recommended scoped lint, excluding only the unchanged exact `_role`
argument in the verifier. Final strict application/all three new-test TypeScript
and diff checks pass. Repository-wide lint was not run; inherited debt remains.

Bare required browser commands first failed to import the uninstalled project
Playwright package. Using the existing cached Playwright and installed Chrome
without adding dependencies, both configured commands fail at fresh server
`listen EPERM 127.0.0.1`, before Chrome starts. Static label asset graph validation
passes (four entries / 43 worker chunks / 85 references / 40 font modules).
Strict free-labels records failed startup, zero completed/started groups and all
eighteen unexecuted. No new native, SVG/PNG download or browser pass is claimed.
Logs are under `/private/tmp/stz-32d-fitting-progress-fix-20261013/`; configured
free-label failure artifacts are `/private/tmp/stz-free-labels-1791874348867/`.

The complete registered suite and final frozen-tree strict-runner disposition
are recorded in this invocation's external handoff. Required browser-capable
parent verification must still run all eighteen groups/twelve layout scenarios,
both dimensions, all predecessor/native/pending/standalone/file/reference gates
on the final actual bytes before fresh independent read-only completion review.
An incomplete/cancelled run or `needs_changes` continues to block completion.

## Singular-cylinder domain and deterministic writer follow-up (2026-10-12)

The actual invocation entry is clean HEAD
`f4dbfd7c7930515f6cd1d57db17ad32a96fc4d47`, fingerprint
`21796531870c52a3af2508226f45a92b96667a45fad4c777a75d486a18e11444`.
The prompt commit already tracks the preceding seven modified files and three
shared fixtures. Their accepted empty-body/publication/native/capture behavior
is preserved. Historical fingerprints do not identify this changed tree.

The newest supplied independent read-only completion review is **needs_changes**,
Critical 0 / Medium 2 / Low 0, `ready_to_commit:false`. Its full-suite log
`/private/tmp/stz-32d-review-npm-test.log` reports 6,974 passed / one failed out
of 6,975, zero skips. The first error in the final 2D writer regression was
`Timed out after 20ms during Zero-axis live PNG file identity`, before the
selected manifest writer entered. The isolated 1/1 rerun and focused 79/79 pass
are historical checks; they do not resolve that ordering defect.

The matching HoyCdl parent passed all five required checks on its exact earlier
checkout. Its authenticated report was resolved with `readEvidenceDocumentSync`
and the recorded checkout: passed/complete, all eighteen cumulative groups,
all nine existing 32D scenarios, 202 records / 4,547 diagnostics, no page errors
or incomplete/unexecuted groups. Its exact fingerprint is
`4da475401c30e0562982de816fc85ad81381876a3a525bef16dfb18b8f3c718f`.
That historical acceptance remains intact; the review rejection still blocks
completion, and HoyCdl cannot verify later edits. Older HMy8AM/Zm4oWG records
are not this review's identity.

Cylinder now raises the existing geometry `RangeError` when its **computed**
transverse radius `ry === 0` (including signed zero), after rotation/incircle
fitting and the transverse `minimumWidth` maximum. The check precedes division,
contours, seam and custom regions. It does not substitute sine zero, epsilon or
another shape. The existing asin-domain diagnostic remains. Axial minima,
outer separation and line width cannot rescue that earlier division; positive
minimum width, valid `rx === 0` / `ry > 0`, supported signed nonzero radii and
rotation/incircle axis exchanges retain their own independent controls. Basic
and ellipse zero-axis geometry remain supported.

The shared live/pending/settled layout displays the existing warning and upright
body without requested cylinder paint, seam, regions, internal border, hidden
hit region or inflated selection bounds. Authored model/layout/units/context,
raw source, coordinates, history and saved version 2 remain authoritative.
Both TikZ modes preserve the authored cylinder intent, including intentionally
unsupported input; compilation success is not claimed for it.

New independent references are registered separately under
`tests/fixtures/point-node-anchors/cylinder-domain/`. Complete fixed-box inputs,
partial raw observations, nonzero compiler exits/logs, actual generated source
and the correct document wrapper authenticate PGF 3.1.11a's zero-divisor failure.
The wrapperless undefined-control-sequence result is a document-context failure,
not cylinder-domain evidence. Engine/source/input/artifact/generator hashes and
`-no-shell-escape` commands accompany the additive cases. Oracle generation
imports no production solver. The additive inventory has eleven expected
failures, twelve valid controls and 93 independently recorded control anchors
in 110 files, including a scoped exception that keeps compiler logs in Git
identity. The deeply signed control authenticates unchanged contours and compact
body/text/west anchors; it makes no general radial-anchor claim. Original 172 boxes / 4,925 anchors / eleven
failure references, signed-basic/polygonal/zero-axis evidence and tolerances are
preserved byte for byte.

The cumulative 32D workflow additionally requires native singular-cylinder
coverage in both ambient dimensions through normal load/Inspector controls,
current warning/model/source/owner/request/revision observations, trusted warning
picking and far clearing, and actual downloaded/reopened warning-only empty-body
SVG/PNG plus raw TikZ intent. Its parent diagnostic-artifact context is separate
from the seven-owner signed empty-body route. Only full model/native/click/file
replay authenticates the exact new file. Warning structure, complete empty
body/ink/content shell, placement, exact SVG/PNG bytes and normal forbidden,
external and background checks are mandatory. No filename-only allowance or
dummy paint supplies eligibility.

The live-writer fixture no longer gives the entire workflow a 20ms timeout.
Normal writer/publisher, I/O, measurement, image and cleanup keep production
5,000ms limits. A per-call scheduler seam controls only the selected evidence
boundary, and its countdown starts at that writer's actual `entered` signal.
The actual writer → publisher → retain → observe/report path, exact primary
Error and failed-after-restoration authority remain required. Scoped PNG gates
survive a former-budget signal before writer entry; no global timer mock,
concurrency reduction, sleeps, retry or machine-speed threshold is used.
All eight final dimension/toolbar/late-result combinations and both pre-restoration
stalls retain one image/strict pixels, native restoration, exact state/history/
source/owner/CTMs, owned cleanup and late-authority rejection. Asynchronous
rejection is owned immediately while waiting for a gate. The older deterministic
stalled-report controls remain unchanged.

Executed focused checkpoints pass 48/48 new cylinder controls, 825/825 preserved
geometry/runtime/model/TikZ controls, 17/17 writer controls and the 797/797
publication/diagnostic sweep. The first parent diagnostic checkpoint passes
26/26. Final focused helper checks pass 41/41, the targeted parent sweep passes
28/28 and all five isolated runner controls pass, including both new damaged
cylinder gates stopping before review/commit. Exact coordinate/capture/cleanup
and final-transition causal binding are enforced before the full run. These overlapping checkpoints are not additive
acceptance counts. All 544 existing shape/anchor reference files match HEAD
byte for byte. Application strict TypeScript, cylinder TypeScript lint and the
build pass. An initial changed-script lint check found an unused new observer
argument, corrected before final checks. A misspelled baseline command failed
before lint; its corrected invocation reproduces the three inherited script
findings separately. The initial parallel writer check could not load the new
contract before it existed; that failure is transcribed explicitly, distinct
from an original retained command log.

Configured direct label-assets and free-labels attempts both fail at localhost
`listen EPERM 127.0.0.1` before Chrome. Static label assets alone pass (four
entries, 43 worker chunks, 85 references, 40 fonts); no native/browser pass is
claimed. The final frozen-tree strict runner records its actual full-suite,
build/diff/browser disposition and matching before/after checkout externally.

Current commands, additive inventories, focused/full results, exact tracked and
untracked bytes, strict-parent disposition and preservation audit are retained
under `/private/tmp/stz-32d-cylinder-timeout-fix-20261012/HANDOFF.json`.
Changed-code checks are separate from inherited lint debt (two geometric caller
`no-unsafe-finally`, verifier `_role`, layers `defaultCurveStyle`); the older
repo-wide 79 errors / seven warnings remain historical baseline evidence, not
a repository-wide lint pass. No unrelated cleanup or dependency is added.

Phase 32 remains **incomplete**. Fresh exact-tree strict parent verification must
pass all eighteen cumulative groups, nine predecessor scenarios plus mandatory
singular-cylinder evidence, both native/live/standalone dimensions, both pending
workflows and full artifact/reference replay before independent read-only
completion review with `prompts/phase-32d-review.md`. Failed or incomplete
verification stops before review/commit; `needs_changes` blocks completion even
with a passing parent. Retain the post-review matching-tree guard. Restricted
child browser startup leaves that result pending for the browser-capable parent.
No completion review, commit or push is claimed; commit/push remain with the parent.
Earlier entries below preserve their historical results.

## Authenticated empty-body parent SVG gate follow-up (2026-10-12)

The actual invocation entry is clean HEAD
`470866616c46216c4459f3b7ff84b8cd3efbb981`, fingerprint
`0a6486310c1f6210a6224b23a67c7479154e413b69fe72570aaed0a501080cfc`.
The preceding lossless-publication changes, their seventy-two controls and both
formerly untracked publication files are tracked here and preserved. The supplied
prompt changed the entry identity from historical `ef06105a` / `a9e886bad`; a fresh
final tracked/untracked identity is required for acceptance of this follow-up.

The newest browser-capable parent `zyBzG8` passes tests/build/diff/label-assets.
Its strict report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-zyBzG8/verification.json`.
The `check:free-labels` subprocess exits 0. Resolving its authenticated
`stz-evidence-document-v1` report with `readEvidenceDocumentSync` and that exact
historical checkout yields `passed` / `complete`: eighteen groups started and
completed, all nine named 32D scenarios terminal-passed, 202 evidence records,
4,547 diagnostics and no page errors, incomplete groups or unexecuted groups.
Node is 26.9.0 and Chrome is 154.0.8037.98. All twelve polygonal placements, both
zero-axis native/live lifecycles, both seven-node transparent standalone SVG/PNG/
reopening/TikZ workflows, both fifteen-entry pending transparent/white workflows
and final cumulative standalone completed. This supersedes the older unexecuted
coverage, association-order failure and final-publication timeout as the current
browser disposition, while preserving their evidence below.

The strict parent nevertheless fails `check:free-labels` during its generic SVG
artifact loop: `Invalid whole-point SVG artifact:
point-layout-signed-polygonal-zero-axis-2d.svg`. Its legacy `hasWholePointSvg`
predicate requires a sibling contour, titled body group and descendant body paint.
Both exact new downloads correctly contain seven empty sources and no body glyphs:
2D is 4,301 bytes, 3D is 4,495 bytes; each has one root, 36 groups, seven sibling
contour paths and seven empty titles, with no runtime data attributes. The native
body retains its body/ink/content groups. The contour is a sibling rather than
glyph paint. `<title/>` was already parsed correctly; absence of `text` / `path` /
`rect` / `use` inside the genuinely empty body caused this classification mismatch.
The parent failed before targeted standalone/association/file replay for the new
scenario or later policy checks, so browser-local success did not establish
complete strict acceptance.

The scoped parent route recognizes only `point-layout-signed-polygonal-zero-axis`
in `point-node-layout-anchors-combined`. Before classifying either exact 2D/3D
standalone SVG, it executes both mandatory `assertSignedPolygonalStandaloneEvidence`
replays. Those replays authenticate the current resolved scenario, all seven empty
model/saved/click/source/owner/revision records, unique association and canonical
source-proven DOM order, then exact file-local structure and raw SVG/PNG/TikZ bytes.
Only successful replay classifies those exact files as intentional empty bodies.
An empty title, filename, copied flag or terminal success alone cannot grant it.
All other artifacts retain the legacy painted-body envelope, including rejection
of nonempty titles without ink and the existing mechanism/input classification.

The small file-local structural guard requires the complete native body, ink and
content shell within each authenticated owner. It binds its attributes to immutable
text paint and requires actually empty element text. Both `<title/>` and equivalent
`<title></title>` are valid; missing title/ink/content, naked titled groups, extra or
wrongly nested/owned nodes, changed shell paint and stray text fail. Balanced XML,
single-root/namespace, contour/body/outer transforms, root/CTMs, owner-bound reopened
zero-axis CTM, source/order association, forbidden/external/background checks,
complete PNG bytes and strict pixels, native/live records, saved/click records and
both TikZ modes remain mandatory at their exact existing assertions/tolerances.
Raw pointers/packs continue to resolve with `readEvidenceDocumentSync` and the
checkout; direct pointer JSON is never treated as the browser report.

The retained files have been replayed diagnostically with the scoped gate. Both
dimensions' targeted replays and the real complete parent dispatch pass on the
unchanged historical downloads. The complete historical offline dispatch takes
22.18s, with exact file and policy hashes retained in
`/private/tmp/stz-32d-empty-body-evidence-audit-20261012/historical-offline-policy-replay.json`.
That diagnostic establishes no fresh browser/native acceptance for the changed
tree; the historical parent remains failed and no downstream blocker was observed
in the offline replay. Faithful complete-dispatch/runner fixtures now exercise
blank titles and complete native shells without a mocked strong validator. The
67 added Node tests comprise two cumulative positives, 48 contextual corruptions,
12 publication-authority corruptions, three isolated runner cases and two containing
tests. All 64 parent-dispatch and three runner tests pass. The runner copies only
the shared fixtures' literal dependency closure: twelve fixture modules, twenty-two
pure source modules, twenty-four existing policy/automation modules and one retained
PNG. Shared predecessor and signed fixtures avoid duplicate heavyweight builders;
their empty shell paint follows the immutable model's actual normalized text paint.

The preserved publication/native/live/pending/standalone/stalled-report sweep passes
935/935 and geometry/reference/model/rendering/TikZ passes 591/591. These focused
sweeps overlap the registered full suite; their counts are not additive. Final full
suite/build/diff and strict parent outcomes, exact tracked/untracked identity and
logs are retained in `/private/tmp/stz-32d-empty-body-20261012/HANDOFF.json`.
Strict TypeScript and changed-script recommended lint pass (the verifier's exact
inherited `_role` finding is reproduced separately and excluded for its changed-code
check). Changed-script syntax/diff and the 1,306-file protected byte audit pass.
Both direct browser commands using supported Playwright/Chrome fail at localhost
`listen EPERM` before Chrome. Earlier attempts without the explicit Playwright
path failed at module import; those failed attempts are retained, not passes.

No production/reference/export/sanitizer, geometry/camera/model/picking, raw empty
text, complete-root/live capture, native preparation or lossless-publication bytes
change. No dependency, fake body glyph, capture retry or tolerance relaxation is
added. All earlier 72 publication, 61 correspondence, 65 live-capture and 55
background controls remain registered, as do the deterministic ordinary-write/
20ms stalled-report/late-rejection/primary-Error controls. The frozen publication
handoff's final offline retain/live/native/report boundary is 232.86ms with 215,233
additional bytes; unchanged repeat is 21.19ms with 12,044 bytes, inside the unchanged
5,000ms deadline. These are offline replay measurements, distinct from the complete
historical browser run. Earlier measurements below retain their original identity.
The scoped four inherited lint errors remain separate failed baseline checks.
A broader `npm run lint` also reproduces 79 errors/seven warnings in unchanged
TypeScript files; no unrelated lint cleanup is included.

Phase 32 remains **incomplete**. Fresh accepted browser-capable strict parent
`32D verify` on the actual final tracked/untracked tree remains pending. All eighteen
cumulative groups and all nine scenarios, both new transparent SVG/PNG/TikZ records,
native history/JSON persistence, both pending workflows, final standalone and exact
immutable-reference replay remain required. Failed or incomplete verification stops
before independent read-only completion review using `prompts/phase-32d-review.md`;
only a matching passing review opens the post-review identity guard. No completion
review, commit or push is claimed. Commit/push remain with the parent. Earlier
entries preserve their historical results and bytes.

## Bounded lossless evidence publication follow-up (2026-10-12)

The actual invocation entry is clean HEAD
`ef06105a0d1659cc2e9e34abfabaedb157fdb6cd`, fingerprint
`d6c6ecaf1c4dfa7c6600db467b7f617e14814252ec2ca9964ff6cff4159dffad`.
The 1,983-file actual inventory matches the prior correspondence handoff's frozen
inventory except the newly supplied fix prompt. The six preceding changed files
and `signedPointStandaloneAssociation.mjs` are now tracked and preserved. Entry
bytes, exact retained-artifact identities, measured payload structure and the
read-only preservation audit are under
`/private/tmp/stz-32d-evidence-audit-20261012/`. Historical fingerprints are not
acceptance identities for this tree.

The latest browser-capable parent is `tBkjSj`, whose strict report is
`/var/folders/vk/7kf940pd4bx8f6cg3rzlmtc80000gn/T/stz-phase32d-before-review-tBkjSj/verification.json`.
It passed tests/build/diff/label-assets, completed sixteen of eighteen cumulative
groups, started seventeen and terminal-passed six predecessor 32D scenarios.
Its first failure is `Timed out after 5000ms during Zero-axis live
restored-after-image-attempt evidence`. All five 2D trusted native zero-axis
actions, one image, internal strict pixel assertion, native toolbar restoration
and resource observation completed. The final capture lifecycle assertion and
normal return did not execute, so the complete live lifecycle is not accepted.
The caller's native-before-assertion checkpoint and new correspondence workflow
were not reached; both new standalone workflows, 3D work, both pending scenarios
and final cumulative standalone remain unexecuted in that run. Page errors are
empty. This actual persistence failure is distinct from child localhost EPERM
and the historical BjrAYN association-order mismatch.

The retained 2D image remains exactly 36,882 bytes, 1700×1300, SHA256
`fab81d376069bb3ab3ee08b17a5e89b8db34ea2589ffeeee3b3e13d81cfa26b3`,
with 632 magenta pixels and local y bounds -34.02419354838708..33.71774193548388.
The exact file hash is retained in the artifact audit. Native Collapse/Expand each
occur once; protected state/geometry and inherited expanded toolbar are restored,
registries are cleared and listener count is zero. Historical raw live bytes lack
the later timeout primary; outer failure records contain it. Those historical
observations are not retrofitted.

The actual path was `retainLive → observe → save`: each boundary rewrote full
live, full native containing live and the accumulated report. Their retained
sizes are 74,465,740, 130,844,920 and 255,833,911 bytes: 461,144,571 bytes across
three full-document writes, plus serialization, inside one existing 5s wrapper.
The cumulative report retains 4,223 diagnostics and 189 evidence entries. No
individual serialization/write durations were recorded in that parent, so no
measured throughput or attribution to one file is claimed. Large repeated work
is the supported likely cause. Source permits a timed-out late running write to
race with failed publication; retained bytes do not establish that such a race
actually overwrote failure state.

Payload inspection found ten full snapshot occurrences, each retaining all 640
stroke samples. Their complete snapshots preserve distinct fresh timestamps;
only two sample arrays are byte-equal (four expanded occurrences, six collapsed).
The hit stacks contain 77,068 descriptor occurrences with 29,779,186 compact JSON
bytes, but only fifteen exact descriptor values totaling 5,860 compact bytes.
This supports exact subvalue sharing while retaining boundary identity, order,
timestamps and changed observations. Large direct 32D diagnostic entries also
repeat native interactions and body-overflow records; scoped externalization must
retain their original values and leave unrelated 31F/32A behavior intact.

The scoped `evidencePublication.mjs` publisher now stores exact data values in
immutable authenticated packs (`stz-evidence-pack-v1`). Document pointers and
compact boundary manifests carry schema, artifact path, exact byte length/SHA256,
current checkout, publisher owner, sequence, name, stage and disposition. Exact
repeated object/state/descriptor values are shared; arrays longer than 64 entries
use fixed lossless chunks, so appending checkpoints does not rewrite thousands of
unchanged records. Fresh snapshots retain distinct timestamps and all 640 samples,
hit-stack order, native events, owner/source/request/revision, state/history,
camera/UI/viewport/scroll/CTMs, image/frame/pixels and restoration/cleanup values.
No measured field or sample is removed. Explicit tagged values also retain
undefined, nonfinite numbers and negative zero without changing plain-data values.

Only encoded immutable bytes reach the asynchronous ordinary writer. Raw packs
and manifests are read back as regular files and authenticated by exact bytes,
length and hash before their boundary is committed or native work continues.
Ordered publication owns every boundary; synchronous small atomic document/index
commits follow the owner/generation checks. Timeout invalidates the pending owner
and preserves the original Error. Late fulfillment/rejection remains handled;
orphan bytes cannot replace current pointers, move a failed index to running,
publish acceptance or overwrite the primary error. Failed publication bypasses a
stalled predecessor without deadlocking native cleanup. The index retains every
committed manifest's sequence/name/stage/disposition/artifact and all current
document pointers; it carries aggregate operation/byte/duration measurements and
only the last 128 small operation rows.

The actual `retainLive → observe → save` path shares this publisher across live,
native, standalone, selection/preparation/view, owned-App lifecycle/failure and
scoped cumulative evidence. Reporter queue tokens own each direct 32D diagnostic
and terminal observation before later mutations. Scope activates when the
combined layout group starts; earlier 31F/32A report behavior stays intact. Required
final/restored publication still precedes lifecycle validation and normal return.
After a final publication timeout a separate `failed-after-restoration` boundary
retains the successful image/UI/resource measurements together with the new error;
older frozen boundaries remain historical. Native restoration and resource
observation are still attempted after evidence failure, with bounded secondary
errors and no extra screenshot. Production publication/native/image limits remain
5,000ms; test-only gates use their explicit 20ms deadlines.

Parent loading strictly resolves these documents before the existing lifecycle,
native, file-local association, PNG, placement and pending-view assertions. Replay
authenticates the exact current tree, owner, paths, bytes/hash/length, stages,
ordered complete history, current pointers and graph references. Missing,
truncated, corrupt, conflicting, stale or unauthenticated data fails. Cumulative
acceptance requires the current terminal report and terminal index; failed
publication cannot establish acceptance. Ordered before/immediate-input/after
post-click view prefixes, exactly one accepted actual view record and last/terminal
equality remain required after resolution. Isolated runner copies include the
new dependency; no raw proof or historical case is made optional.

The final offline replay checkpoint uses publisher source SHA256
`58b033ca969e6417f9625972468768b07550ee99802eeb4956a649acda0b3e71`.
All three exact retained historical JSON values round-trip by deep equality:
74,465,740-byte live, 130,844,920-byte native and 255,833,911-byte cumulative.
Across three initial publications and three unchanged republishings, retained
immutable pack/boundary bytes total 11,440,357, with three pack writes, six boundary
writes, six document-pointer commits and seven index commits (including the
historical failed primary). Each unchanged value adds zero data nodes/packs;
its boundary adds only 1,556/1,767/1,957 bytes. First publication durations are
141.5/157.3/272.5ms. Ordinary-write, authentication-read, pointer and index durations
are separately recorded; these observed durations are not test thresholds.

The separate ordinary-filesystem exercise invokes the actual
`createLiveEvidenceRetainer → observe → createEvidenceReportStorage.save` path with
those exact full-sample/native/history payloads. Initial cumulative retention takes
270.8ms; one final restored boundary completes all three required publications
inside the unchanged 5,000ms wrapper in 209.3ms. It adds 214,856 immutable bytes,
three packs, three boundaries, three pointer commits, three index commits and six
authentication reads. Repeating the unchanged measured values takes 20.9ms and
adds 11,792 immutable bytes: only six new small report/chunk nodes, one pack,
three compact boundaries, three pointer/index commits each and four authenticated
reads. The final index is 13,991 bytes. Every live/native/report value resolves
exactly. This exercise changes only the historical report's disposition to running
to exercise that sink; it establishes neither a returned native lifecycle nor
browser acceptance. Exact source/tree identities, all operations and replay
artifacts are retained in `retained-publication-benchmark.json` and
`retained-live-path-benchmark.json` under the external audit directory. An interim
history-resolver own-property mismatch is retained separately and corrected before
these successful final replays.

New meaningful controls exercise the real publisher/observe/reporter path with
faithful complete samples, frozen boundaries, immutable sharing, compact chunks,
regular-file/hash/length authentication, current-tree/owner/stage/order/coverage
faults, mutation after queue, ordinary writer errors, deterministic stalls, late
fulfillment/rejection, failed publication competing with a late running writer,
terminal authority and cleanup/primary-error ownership. Both ambient dimensions,
expanded/collapsed toolbar cases, one image and complete final native/lifecycle
replay remain. An earlier complete focused policy/workflow sweep passed 738/738,
including the first fourteen added workflow controls. The final focused sweeps
pass 38/38 publisher controls, 16/16 actual workflow controls and 18/18 new
parent/isolated-runner controls: seventy-two new controls in total. Final full-tree
required checks are recorded in the frozen-tree handoff; focused counts overlap
the full suite.

The preservation audit compares the actual clean 1,983-file entry inventory.
All 212 production files, 1,073 fixture files and 544 authenticated reference files
remain byte-identical, including all original/signed-basic/polygonal/zero-axis
inventories and the former 494-entry handoff. The association module, both
complete-root capture modules, full live observation/assertions, native
`zeroAxisInput`, strict pixel oracle and the previous 61 association/65 live/55
background control source blocks remain exact. The deterministic stalled-report
suite is byte-identical, retaining its ordinary recorder, 20ms deadline, exact
primary Error/nativeChecks, two failure writes, late rejection and complete
resource cleanup. Only authorized evidence persistence changes the standalone
caller wrapper and live workflow; geometry, selection, correspondence and native
preparation/input behavior are preserved. No dependency or acceptance waiver is
added. The four inherited lint errors remain separate baseline failures; final
reproductions and passing changed-file checks belong to the handoff.

Phase 32 remains **incomplete**. The final frozen-tree handoff records actual
required-command results and fresh strict verifier disposition without editing
these documents after verification starts. All eighteen cumulative groups/nine
named 32D scenarios, both successful native/live lifecycles, twelve polygonal
cases, both authenticated seven-node transparent standalone workflows, both
fifteen-entry pending workflows and final standalone acceptance remain mandatory.
Child localhost EPERM leaves native work pending for the browser-capable parent;
it supplies no pass. Complete fresh verification precedes independent read-only
completion review and the post-review matching-tree guard. Failed/incomplete
verification or `needs_changes` blocks completion/commit. No independent completion
review, child commit or push is claimed. Commit/push remain with the parent.
Earlier entries below retain their historical results and identities.

## Authenticated standalone point correspondence follow-up (2026-10-12)

This scoped follow-up starts from clean HEAD
`ff72e61c43ebc2da3f09513b023e89543719aa3c`, fingerprint
`cb929c9a5ae2c113fb9a059ad24665ffc7c521575d48e809432bd85b43eb2e11`.
The preceding live-capture correction, including both capture modules, is now
tracked. Actual current tracked/untracked bytes, immutable HEAD inventory,
before-image inspection, preservation spans and final verification disposition
are retained under `/private/tmp/stz-32d-standalone-correspondence-20261012/`.
The final `HANDOFF.json` records the frozen tree and actual reports; historical
fingerprints cannot establish acceptance for this tree.

The newest browser-capable parent `BjrAYN` passed tests/build/diff/label-assets,
completed sixteen of eighteen cumulative groups, started seventeen, and passed
the six predecessor 32D scenarios. It completed the six 2D polygonal observations,
all five trusted zero-axis actions and the separate unobstructed live lifecycle.
The actual live PNG is 1700×1300, 36,882 bytes, SHA256
`fab81d376069bb3ab3ee08b17a5e89b8db34ea2589ffeeee3b3e13d81cfa26b3`:
632 magenta pixels, local y extrema -34.02419354838708 and 33.71774193548388,
screenCTM a=d=3.1, b=c=0, e=1296.4, f=268.975. One measured native toolbar
collapse, one PNG, stable state/geometry, exact inherited restoration, empty
secondary errors and cleared owned registries remain complete predecessor proof.

The first downloaded SVG is 4,301 bytes, SHA256
`11f80c8a6de9dc39dc2ae81f34f0ba014b41abcc4b4f702aeaa324c4c771296e`.
Its XML matches the retained raw XML. The seven sanitized native titles are blank
and no point IDs survive metadata removal. Actual DOM order is dart, isosceles
triangle, regular polygon, square, star, triangle, zero-axis; expected model/click
indices are respectively 5, 4, 0, 1, 3, 2, 6. Their distinct outer translates
authenticate placement correspondence independently of the contour under test.
Every file-local contour/body/outer transform equals its proper expected owner.
The earlier raw `shape` fields were copied expectations, not observed identity.
The parent failed the index-paired first-contour assertion before standalone
capture: that before-image has seven raw nodes and its primary error, but no
standalone capture record, PNG or pixel proof. It is neither child startup EPERM
nor a failed live pixel oracle.

`signedPointStandaloneAssociation.mjs` retains native pre-export IDs/document
order and sanitized reopened document ordinals/structural paths independently
from unchanged immutable model/click/expected order. Separate derived candidates
record unique owner/expected-index ↔ actual-ordinal/projected-placement bindings
and rejection reasons before assertions/image work. Authentication checks current
model/source/request/owner/revision, immutable saved/click inputs and the preserved
production layer/ID ordering source. Matching uses outer projected placements;
it never uses contour paths, paint or fitted body/anchor translations.

Both the caller and parent reconstruct this association before exact geometry
comparisons. Parent replay parses the exact downloaded XML into bounded local
element paths and checks direct node/body/contour ownership and each attribute
within its own group. Presence of all attribute strings elsewhere in XML supplies
no ownership proof. The unique authenticated `signed-zero-axis` binding supplies
its fresh file-local finite invertible screenCTM for both PNG replays, with native
root/group propagation checked; the last array entry supplies no identity.

A retained independent synthetic file replay exposed an additional scoped root
gap: inserting a root SVG transform while retaining the old native matrices and
PNG was accepted. Its before/after files, raw records and result are retained in
`root-transform-fixture/manifest.json` under this handoff directory. The preliminary
strict run on fingerprint `9da969287ff31d9a275761ebbeb4068ef28e67b444a802491632471271a0c758`
was interrupted with exit 130 before any required check completed; it supplies
no acceptance. The final observer retains full native root attributes, and replay
requires exact native/file attributes for the actual fixed seven-point root.
Root SVG/CSS transforms and opacity corruptions now fail. The reopened CTM frame
also matches the capture's first URL/root/viewport/scroll measurement, preserving
one later viewport expansion. Missing or changed root proof is retained as a
pre-image association rejection reason. Capture helpers remain unchanged.

Faithful synthetic regressions preserve model/click order and blank stripped-file
titles while using production DOM order and distinct real projected placements.
They exercise correspondence, file-local geometry ownership and pixel CTM
corruption, including swapped geometry with the same unordered attribute set.
These are policy regressions, not native acceptance. New proof is required in
existing standalone raw artifacts, and isolated runner copies load the helper
and exact ordering source. Missing proof fails closed; historical records remain
unchanged.

No production, geometry, metadata sanitization, rendering/export sorting, paint,
picking, coordinates/camera, authored text/units, saved version 2, reference bytes
or tolerances changed. All 212 production files, 1,073 fixture files, 544
authenticated reference files and the former 494-entry handoff inventory remain
byte-identical. Native input, both live-capture modules, complete-root capture
helpers and strict pixel oracle spans also remain byte-identical. The 65 live
capture and 55 background controls remain registered. No dependency was added.

The final helper's 61 new focused controls pass 61/61 with zero failures/skips.
The final complete policy/runner sweep passes 761/761 on the same helper bytes.
Preserved native,
pending, standalone and deterministic controls pass 332/332, and geometry,
reference, model and TikZ controls pass 566/566. Strict application TypeScript,
preliminary build, five changed-script lint/syntax checks and diff pass. Focused
sweeps overlap the full registered suite; full final-tree required verification
results belong to the external handoff. Four inherited
lint failures were reproduced from immutable HEAD: two geometric-caller
`no-unsafe-finally`, verifier unused `_role`, and layers-test unused
`defaultCurveStyle`; these remain failed baseline checks. Changed-file checks
are reported separately. The full required strict verifier must run on the final
tracked/untracked tree, without a commit or browser waiver.

All eighteen cumulative groups, nine named 32D scenarios, twelve polygonal
selected-anchor cases, both native/live sequences, both new transparent seven-node
SVG downloads/reopening/complete PNG/TikZ, both existing fifteen-entry pending
transparent/white workflows and final standalone acceptance remain mandatory.
The new scenario still has no terminal parent pass. Its first standalone image,
all remaining 3D/new-download work, both pending scenarios and final standalone
did not execute in `BjrAYN`. Only fresh complete verification can open independent
read-only completion review using the exact matching tree, followed by the
post-review identity guard. Failed/incomplete verification or `needs_changes`
blocks completion and commit. Phase 32 remains **incomplete**; commit/push remain
with the parent. Earlier entries below retain historical results.

## Unobstructed native zero-axis live capture follow-up (2026-10-12)

The actual starting checkout is clean at
`ae8cea9b8c2a7c6535e7d1a611415272cd9dbe76`, fingerprint
`70d53968dde5d7a4029316bb7c2625d0e45eea22d545201a35fa3e493d769490`.
The prompt commit already retains the six-file background observation correction
and its 55 regression controls; the entry untracked count is zero. The
historical `09cd6a7`/`d8bebf0` parent identity is retained as history, not reused
for this invocation's acceptance. All 1,980 tracked file hashes, including 212
production files and 1,073 fixture files, were captured before edits under
`/private/tmp/stz-32d-live-capture-preservation-dc4_bzs6/`. All 494 entries in the
polygonal/zero-axis handoff still match byte for byte; the former inventory count
is distinct from this invocation's actual tracked/untracked inventory.

The actual `qsihsK` PNG and matching native/raw failure records were inspected
before implementation. That browser-capable parent passed tests/build/diff and
label-assets, completed sixteen of eighteen cumulative groups and started
seventeen. All six predecessor 32D scenarios and six 2D polygonal selected-anchor
observations passed. All five zero-axis actions completed with three trusted
events each, zero dropped events and selection
null → zero-overlap → zero-overlap → app-point → null. Outside pointerdown
reached the authenticated background rect; captured pointerup/click reached the
current SVG root. Interaction Inspector/toolbar restoration and Alt/observer
cleanup completed before the distinct live image attempt.

The live pre/post records both retain the restored expanded floating toolbar,
closed Inspector, owner `["point-node",437,"zero-overlap"]`, empty ready source,
matching current point/body requests and unchanged geometry. The native path is
`M 0 0 L 0 -33.941125496954 L 0 0 L 0 33.941125496954 L 0 0 Z`, with length
135.76449584960938. Its screenCTM has a=d=3.1, b=c=0, e=1296.4 and f=268.975;
independent full-stroke extrema project to y=163.75751095944256 and
374.19248904055735. The actual 1700×1300 PNG is 56,406 bytes, SHA256
`0564067bd15143ff9ea591bb12f2fa62b0c380b21e29e88df5a2313e7daee10e`.
It contains 582 magenta pixels with local y bounds -28.54032258064515 to
33.71774193548388. The image visibly shows the expanded toolbar covering the
upper stroke; the strict oracle correctly rejects its missing upper extremum.
This is retained capture-obstruction evidence, not proof of a new production
paint defect. Historical raw records and pixels remain unchanged.

The live caller now uses `zeroAxisLiveCaptureWorkflow.mjs` and the separate
observation/pure contract in `zeroAxisLiveCapture.mjs` after completed interaction
restoration: inherited capture state/geometry and complete stroke visibility →
optional measured native toolbar collapse → freshly prepared pre-image frame →
one actual PNG and post-image frame → owned capture restoration.
The required region derives from the independently known extrema, real native
traversal and stroke width, including both endpoints. A clear `.23` input point
cannot prove whole-stroke visibility. Current root/background, both coincident
contours, source/request/owner/revision, finite invertible canvas/point/contour
CTMs, viewport/visual viewport/scroll, overlay/control bounds and actual hit-stack
ownership are freshly observed before preparation and around the image. Each
`${stem}-live-capture.json` record is required and bound exactly to the existing
native JSON/live PNG; parent file replay cannot accept a detached summary.
Progress diagnostics link the exact complete native/live records instead of
repeating their large lifecycle snapshots in the global report. Required raw
files retain every full observation. The isolated runner copy list includes the
new transitive capture contract.

Only a measured toolbar obstruction permits one unique normal native Collapse
preview toolbar action. An inherited-collapsed or already-clear case records
no action. Capture preparation neither repeats Select nor changes selected owner,
model, history, coordinates, camera, zoom, authored units or UI settings. Fresh
post-transition measurements require the entire stroke inside the actual
viewport/canvas and clear of all UI; unsupported frames, stale geometry or remaining
occlusion fail with retained evidence. ScreenCTM already includes retained page
scroll; scrollY is not subtracted a second time. The screenshot remains one bounded
non-full-page CSS-pixel image with normal fonts and the current magenta stroke.
Its actual file/path/bytes/hash/dimensions precede replay and strict extrema/width
assertions. No retry, CSS/DOM hiding, crop, reconstructed image or export-only
substitute establishes live acceptance.

Capture restoration owns only this capture's changes and runs after image,
evidence-persistence or oracle failure. Primary error identity survives bounded
secondary/restoration failures, with no extra failure image or leaked owned
observer/listener/Alt resources. The existing complete-root standalone capture
helper and strict pixel oracle remain unchanged. The retained
`preserved-native-input-and-pixel-oracle.json` audit binds the native input
function and shared pixel replay/oracle to exact entry-HEAD bytes.
Faithful restored-expanded and
inherited-clear fixtures retain the earlier native input proof separately.
Parent raw/native-file policy rejects absent or corrupt lifecycle/frame/file
proof, fabricated actions and incomplete restoration in both ambient dimensions.
`checkFreeLabels.mjs` and the owned layout failure path recognize the capture
error identity, so later diagnostics cannot take a second failure screenshot.

Registered synthetic controls model the restored expanded toolbar covering the
upper extremum after the earlier valid collapsed-input workflow, plus inherited
collapsed and clear expanded no-action success. They use separate fresh timestamps
and both ambient dimensions with complete raw/native/file replay. Meaningful
failures cover missing/wrong/duplicate controls, stale or foreign canvas/owner/
request/revision/CTM, off-viewport/canvas endpoints, a clear `.23` point with a
covered extremum, remaining toolbar/history/quick-style/selection obstruction,
changed model/history/selection/UI settings, fabricated or repeated actions,
frame/origin/scroll mismatch, altered raw/file identity, truncated/blank/short
PNG, absent/failed restoration and owned-resource leaks. Workflow controls retain
exact primary screenshot/evidence/oracle Error identity when restoration also
fails and require actual native restoration despite cleanup measurement or
persistence failure. These are regressions, not fresh native acceptance.

Executed focused checks use Homebrew-first Node v26.9.0. The final 65 new
capture controls pass 65/65, zero failures/skips
(`/private/tmp/stz-zero-live-final-65-controls.log`). The full 32D policy suite
checkpoint passed 662/662 before the final additional control; its current
registered count is 663. Preserved runner/native/pending/standalone/deterministic
controls pass 888/888 and geometry/reference/model/TikZ controls pass 424/424,
with zero failures/skips. These focused sweeps overlap the registered full suite;
65 new controls do not supply a separate cumulative acceptance count. The initial
large synthetic fixture allocation exhausted the normal Node heap; that failure
is retained. Structural sharing of immutable synthetic records and small owned
cleanup closures fix the test fixture allocation without heap flags, waived
controls or altered evidence semantics. The final focused runs use the normal heap and pass.

All seven changed/new script files pass recommended-rule lint and syntax; diff
checks pass. Strict `tsconfig.app` TypeScript, preserved production TypeScript
lint and application build pass. The four inherited lint errors were reproduced
separately in the retained baseline logs: the geometric caller's two
`no-unsafe-finally` errors, verifier unused `_role` and layer-test unused
`defaultCurveStyle`. Those baseline checks remain failed; no unrelated cleanup or
repository-wide lint pass is claimed.

Both direct required browser commands use supported cached Playwright and
configured Chrome, but fail at fresh owned-server `listen EPERM 127.0.0.1`
before Chrome. Label-assets passes only its static graph (four main entries,
43 worker chunks, 85 references and 40 approved font modules); its browser check
fails. Strict free-labels retains development-server-listen failure with
browserVersion null, zero completed groups and all eighteen unexecuted. These
startup failures are distinct from the inspected Chrome-launched `qsihsK` parent
obstruction and establish no fresh native/live/download acceptance. Command logs
and raw startup artifacts are under
`/private/tmp/stz-32d-live-capture-fix-20261012/`.

Full registered `npm test` passes **6,775/6,775**, with zero failures,
cancellations, skips or todo, exit 0 and normal project concurrency
(`npm-test.log`, 789006.314375ms). This includes the current 663-test 32D policy
suite and all 65 new capture controls. The final frozen-tree strict verifier
remains pending; the stable external
`/private/tmp/stz-32d-live-capture-fix-20261012/HANDOFF.json` retains its actual
final disposition/report paths, full/strict results, exact tracked/untracked
identity, preservation audit and logs without changing frozen documentation
after verification.
Independent completion review has not begun. Production and every authenticated
reference byte, all signed/root/background corrections, tolerances, sampling/work
bounds, saved version 2, raw text and both TikZ modes are preserved.

Phase 32 remains **incomplete**. Fresh strict verification of the exact final
tracked/untracked tree must accept all eighteen groups, all nine named 32D
scenarios, twelve polygonal cases, both zero-axis native/live cases and new
transparent downloads, both fifteen-entry pending workflows/reopening/complete
PNG/TikZ and final standalone acceptance. Failed/incomplete verification stops
before independent read-only completion review using `prompts/phase-32d-review.md`;
a passing review must match that exact tree and retain the post-review identity
guard. Commit/push remain with the parent after all gates pass. Earlier entries
below retain their historical identities/results.

## Authenticated zero-axis outside-input observation follow-up (2026-10-11)

The actual starting checkout is clean at
`09cd6a7e8a7e2226acb4c04634b36dbd166f0858`, fingerprint
`ab87d2e864a94b4f7ad4ae38767165b71869a401699f7cc0d0a581c203c29a53`.
The prompt commit already tracks the preceding fourteen modified files and all
494 formerly untracked files, including all 490 additive reference/evidence
artifacts. Their bytes were captured before this fix. All 494 hashes in the
polygonal/zero-axis handoff match this checkout. The historical `be2aabe` tree
fingerprint is retained as history, not used as this invocation's identity.

The newest browser-capable parent `Ab9guh` actually launched Chrome. Tests,
build, diff and label-assets passed; sixteen cumulative groups and the first
six named 32D scenarios completed with no page errors. Six 2D polygonal
selected-anchor observations were retained. The first zero-axis `outside-clear`
action stopped at `assertFreshZeroAxisAction`, before mouse input: local(12,20)
projected through the connected current contour to
(1333.6000000000001,330.97499999999997); the first hit was an SVG rect and the
next was the current `svg.svg-diagram` root. The obsolete assertion required
the target itself to be the root. The historical descriptor does **not** record
the background marker; no marker or missing after/event success has been added
to that evidence. This is a harness contract mismatch, not evidence of a
production outside-selection or paint failure. The new scenario's 3D cases,
zero-axis gestures/live paint/downloads, both pending scenarios and final
standalone acceptance remained incomplete or unexecuted.

This correction changes native observation, assertions and faithful policy
fixtures only. Every descriptor freshly retains connection, exact raw
`data-svg-background` attribute, unique-current-canvas membership, root/direct-
child relationship and the background predicate. Before/after hit stacks and
trusted event composed paths retain the same unique connected root/background
context. Outside input accepts the actual root with its observed null/false
marker or the unique connected direct-child SVG rect with exact marker `true`.
It rejects arbitrary descendants, wrong/stale canvases, point/handle ownership
and UI overlays. Hit-stack and composed-path heads stay bound to their targets;
all paths must contain the observed current root. Production camera capture
explains faithful rect pointerdown versus root pointerup/click. Capture is read
from the real browser, never fabricated by the runner.

Both current coincident point contours are independently measured before and
after every gesture: source/body request/owner/revision, resolved preview layout
including effective font context, shape parameters, path/paint, BBox/arclength/
ordered extrema and finite invertible contour/point/canvas matrices. The fixed
local(12,20) input must exceed both measured contours plus unchanged half-stroke
and six-unit picking clearance. Local(0,20), the five-action order and selection
sequence null → zero-overlap → zero-overlap → app-point → null stay fixed.
One trusted down/up/click sequence must preserve exact binary32 pointer and
integer click coordinates, button/buttons/pointer identity/Alt, model/history/UI
and current boundary continuity. After evidence is persisted, this same native
action assertion runs immediately before subsequent actions or image work.
Alt/listener cleanup now also retains its actual completion/registry observation;
primary failures and incomplete pre-input records remain failures.

The policy fixture retains genuine-root success separately from marked-background
success, including actual absent root markers and capture target differences.
The focused suite passes **598/598**, zero failures/skips: 543 predecessor checks
and 55 added tests. Both branches exercise direct fresh/native assertions and
complete parent raw validation; compact coherent corruption controls cover
marker/current-root/path/ownership, coincident geometry/request/CTM/projection,
events/capture, selection/cycle order, state invariance and cleanup. Synthetic
records are schema tests, not native acceptance. Shared contract enforcement
already reaches cumulative/raw/artifact policy and the existing isolated runner
copies; no policy dependency or registered group/scenario was removed.

The preserved geometry/model/TikZ/reference sweep passes 368/368; these focused
sweeps overlap the full registered suite and are not extra cumulative cases.
Focused strict TypeScript for the retained five geometry modules/four new suites
and recommended changed-script ESLint pass. The four inherited lint errors were
reproduced separately: two geometric-caller `no-unsafe-finally`, verifier unused
`_role`, and layer-test unused `defaultCurveStyle`. Repository-wide lint was not
run. No dependency, production geometry/path/picking/camera/unit/saved-version-2
change or oracle regeneration is part of this fix.

All reference inventories remain byte-preserved: original 172 boxes/4,925
anchors/11 controls, signed-basic eight boxes/192 anchors, 54 polygonal boxes/
1,386 anchors, twelve arithmetic controls, four dart fitting traces, one singular
control, eleven zero-axis PGF paths and 37 independent rendering records, plus
prior 32C references. The .025pt/.03pt tolerances, .005-unit sampling precision
and 2048-work budget stay unchanged. The accepted diamond exception and every
signed fitted-axis/polygonal/reciprocal/traversal correction remain intact.

Homebrew-first Node v26.9.0 is used. Initial unconfigured browser attempts retain
missing-Playwright diagnostics; configured attempts use the existing external
Playwright and Chrome and fail at fresh owned-server `listen EPERM 127.0.0.1`
before Chrome. Label-assets passes its static graph only. No current native
acceptance is claimed. Exact bytes, precursor coordinate evidence, focused logs,
configured startup failures and final strict-verification disposition/identity
are retained under `/private/tmp/stz-32d-background-fix-20261011/`, with final
results in `HANDOFF.json`. Required verification of the frozen final tree must
still be checked independently by the browser-capable parent: all eighteen
groups, all nine named 32D scenarios, twelve polygonal cases/both zero-axis
sequences/live PNG and both new downloads, both retained fifteen-entry pending
workflows, external reopening/complete PNG/TikZ and final standalone acceptance.

Phase 32 remains **incomplete**. Failed/incomplete verification stops before
independent completion review; no review is substituted by this implementation
audit or historical parent evidence. The fresh required verification and exact
matching-tree/post-review guards remain in force. Commit/push remain with the
parent after every gate passes. Earlier entries below are retained history.

## Signed polygonal clearance and zero-axis ellipse follow-up (2026-10-11)

The actual starting checkout is clean at
`be2aabe55e578d036672960f3ba741af4008564f`, fingerprint
`e9f127caf56c8fc58ed78b5ac0fa00e8d7d956cbd9a310c223535ee1d7957495`.
This prompt commit already tracks the preceding fifteen-file signed-axis/report
correction and thirteen signed-axis fixture files. Their accepted behavior and
reference bytes are preserved. Initial tracked bytes, all predecessor fixture
hashes and a complete immutable copy/hash inventory of the new independent
geometry review were captured before edits under
`/private/tmp/stz-32d-polygon-zero-fix-20261011/`.

The matching browser-capable parent `HMy8AM` passed all five required commands,
all eighteen cumulative groups and all eight original 32D scenarios, including
90 sizing cases, 305 anchors, both pending transparent/white downloads, both
TikZ modes, external reopening/complete PNG and final standalone acceptance.
It retained the two signed-anchor and two signed-picking native cases with no
page errors. Its exact-tree fingerprint was
`8f0ffe266755d990a3a0abd284f012c714623a3399c75a8fa37cbc05c0033478`.
The newest matching read-only review freshly passed **6,425/6,425** tests with
zero failures/skips, build, focused strict TypeScript, changed-file lint,
syntax and diff. The stalled-report race is resolved, not current test debt.
Nevertheless, independently compiled PGF/librsvg probes found two Medium
production defects: signed polygonal fitting/clearance and omitted zero-axis
ellipse SVG paint. That review returned `needs_changes`,
`ready_to_commit:false`; no commit followed it. Neither historical pass verifies
this follow-up tree.

The scoped production correction keeps signed fitting quantities independently
of ordered paint envelopes. Regular polygon and legacy square/triangle retain
the fitted radius and add PGF's declared signed miter length, preserving start
angle/index/order and separate numeric border behavior. Star retains both
signed radii and PGF's separate angular/cosecant adjustments, including height/
ratio fitting and mixed signs. Isosceles triangle carries the original and
effective half-angles; stretch uses divide then atan rather than a reconstructed
atan2 quadrant, and its original apex cosecant stays distinct from effective
corner angles. Dart keeps parameter-defined tip/tail miter vectors and fitted
lengths, separation and offset. Its sequential scanned/truncated dimensional
minimum products now follow PGF, including the reciprocal macro's signed integer
branch before absolute value. The public radius remains a paint magnitude;
clearance never becomes a hit region. These construction fields are runtime
only; version 2, authored units/raw text, model coordinates and camera contracts
are unchanged.

The collapsed ellipse path retains the full signed angular traversal with every
intervening quarter/turning extremum. For zero x and positive y it emits
center → upper SVG extremum → center → lower extremum → center, then closes.
Zero y, both-zero, negative surviving axes and signed/reversed/rotated partial
sweeps use the same ordered traversal. Zero-area fill remains zero-area; no
epsilon radius or substitute marker is introduced. Nondegenerate SVG arcs and
magnitude-based sampling retain their 0.005-unit precision/2048 budget.

Additive evidence lives separately under
`tests/fixtures/point-node-anchors/signed-polygonal/` and `zero-axis/`.
The polygonal bundle retains all eighteen empty and eighteen fixed-body review
cases, their complete TeX inputs/raw geometry/compiler/PDF/failing production
results and independent reproduction scripts. Every artifact is hashed, including
previously unhashed inputs/raw/compiler/parsed observations. The complete additive inventory has 54 boxes/1,386 anchors (36 retained and
18 purposeful), twelve direct math controls, four dart fitting traces and one
authenticated singular boundary. New boxes cover sign transitions, body/minimum
dominance, rotation/incircle/stretch, star height/ratio and mixed inner/outer
radii; direct signed reciprocal controls are compiled independently. Oracle input/parsing imports no production
solver, math or support tables. Retained production results are failing evidence,
never oracle inputs. Original 32C, 172-box/4,925-anchor/11-failure and eight-box/
192-anchor signed-basic references remain unchanged, with .025pt/.03pt tolerances
and existing independent controls. Scoped log exceptions include only the retained
review compiler artifacts in the tracked/untracked identity.

The zero-axis bundle retains the original independently observed blank
production raster/visible PGF paint, saved 2D/3D models and producer/picking/TikZ
probes distinctly from native evidence. Eleven new authenticated PGF paths
(five full ellipse nodes and six signed/reversed/rotated partial sweeps) and
thirty-seven independent renderer records exercise emitted paths, stroke extents,
closure/cap/join/dash phase and zero-area fill. The twenty-five full-node paint/
control raster masks and extents match independently compiled PGF. A retained
librsvg solid coincident-endpoint partial-cubic anomaly is explicitly recorded;
raw paths remain intact and any derivative split is separately identified as an
independent geometry-preserving renderer normalization.

Registered fixed-metric geometry/rendering regressions inspect actual emitted
paths and raster evidence, signed placement in current/pending/settled output,
validation/version-2 reload, exact units/source, both TikZ modes, unchanged
coordinates, active 3D work-plane projection and current owner/font/source/layout/
filter/lock guards. These are pure/fixed-metric and independent-renderer results;
they do not establish trusted native input or current standalone downloads.

The existing cumulative workflow additionally requires the ninth named scenario
`point-layout-signed-polygonal-zero-axis`, with selected-anchor placement for all
six polygonal branches in both ambient dimensions (including the lower isosceles
corner), native zero-axis visible-stroke raster evidence, ordinary local(0,20)
click, Alt owner cycling and genuinely outside exclusion. Raw current model,
source/request/owner/revision, controls, contour/root CTMs, input and selection
observations are persisted before validation. Actual downloaded/reopened SVG and
complete-root PNG in both dimensions must retain the corrected placement/stroke,
background and file identity. The original eight scenarios, all eighteen groups,
all fifteen pending-click entries, both pending downloads and unchanged capture/
preparation/view/diagnostic/cleanup contracts stay mandatory. New raw artifacts
and imported dependencies are included in parent policy and isolated fixtures;
synthetic corruption controls are labelled as policy checks, never native passes.

Homebrew-first Node v26.9.0 is used. The focused new authenticated/runtime
sweep passed 118 checks; the geometry/model/TikZ/previous-axis sweep passed 493;
the preserved view/preparation/pending/capture/ownership sweep passed 261. These
are separate overlapping sweeps, not additional cumulative case counts. Focused
strict TypeScript and configured changed-TypeScript lint passed. All 54 previous
fixture files retain their initial hashes, and all 490 additive evidence files
are included in the checkout inventory. Final required command results, baseline
failures, actual browser startup/report artifacts and final tracked/untracked
identity belong to the external handoff.
The four inherited lint errors are separate failed baseline checks: two geometric
caller `no-unsafe-finally`, verifier unused `_role`, and layer test unused
`defaultCurveStyle`. Repository-wide lint is not run. No unrelated cleanup,
production dependency, tolerance relaxation or deferred profile is added.

Phase 32 remains **incomplete**. A fresh owned cumulative `32D verify` on the
final tree must pass before independent read-only completion review using
`prompts/phase-32d-review.md`, followed by the matching-tree guard. If child server
startup is restricted, retain the failure and pending native work for the
browser-capable parent. Failed/incomplete verification stops before review or
commit; the earlier needs-changes review is not a current pass. Commit/push remain
with the parent after verification and review. Entries below retain history.

## Signed axes, arc picking and deterministic report follow-up (2026-10-11)

The actual starting tree is clean at
`f9893fad1fa0586260d614e832ffb99b00ce513f`, fingerprint
`1ea95cbae3ee30bf7ca5f1ed5d8d807ac705e8052854cc5f30880c427730abeb`.
The resolved-preview/native `110` provenance correction and its six files are
already tracked here. They are preserved. The retained browser-capable parent
`kpMSxP` accepted all five required commands and all eighteen cumulative groups
on its earlier exact tree, including both transparent/white pending layout SVG
downloads, both TikZ modes, external reopening, complete PNG and final standalone
exports. Those are authentic historical results, superseding the startup-only
child disposition below. The subsequent independent review found three Medium
issues and returned `needs_changes`, `ready_to_commit:false`: signed basic-shape
anchors, negative-radius contour density, and the stalled-report fixture's
ordinary filesystem-write race. Its full suite failed 6,360/6,361; its build
passed. Review rejection is the completion blocker for that earlier tree.
The diamond outer-separation exception was independently authenticated and
accepted by that review; older open-diamond wording below is historical.

This follow-up preserves the signed fitted axes computed by ellipse/rectangle
construction across the pure anchor boundary. Each outer axis separation is
added to its own signed fitted axis. Ordered painted envelopes do not encode
PGF saved-axis signs. Named compass/text anchors and numeric border branches
retain their separate PGF semantics, including zero axes and parser/range/
rounding behavior. No authored dimension is clamped, rejected or made positive.
Only arc sampling density uses radius magnitudes; signed path coordinates,
endpoints, sweep, rotation and extrema remain unchanged, with the same 0.005-unit
sagitta precision and 2048-sample work guard.

The stalled-report fixture records ordinary writes immediately in memory and
stalls only failed-report writes. Production diagnostics remain unchanged. Its
20ms deadlines, exact native Error identity, single nativeChecks invocation,
two failed writes, owned late rejections after completion, drained listeners and
page/browser/server cleanup order remain required.

Additive evidence under `tests/fixtures/point-node-anchors/signed-axes/` retains
the authenticated review bundle byte for byte and eight newly compiled PGF boxes
with 192 anchors. The generator checks the pdfTeX engine, all seven source
hashes, compiler-emitted PGF 3.1.11a and input/raw/compiler/generator hashes; it
imports no production solver/support table. Cases cover empty strong negatives,
the nonempty 20/8/3pt small-minimum reproduction, mixed signs and per-axis outer
separation crossing signs. Raw Y-up TeX pt is reversed once to Y-down SVG units,
then scaled by 1.2. Original 32C and 172-box/4,925-anchor/11-failure references
and .025pt/.03pt tolerances remain byte-preserved. A single exact `.gitignore`
exception includes the retained review production-command log in the tree
fingerprint and future repository checkout.

Registered geometry/rendering tests cover wrong-sign/absolute-axis controls,
analytic .005-unit contour precision, zero axes/work rejection, pending/current/
settled placement, validation/version-2/source/unit provenance and both TikZ
modes. Production picking covers the recorded `(67.2,-67.2)` oblique point,
empty-body center, mixed/dominant-negative axes, outside exclusion, both ambient
dimensions/active work planes and current owner/font/source/layout/filter/lock
guards. Isolated old-production controls fail for both signs and picking.
These are pure/fixed-metric results, not native browser observations.

The existing interaction scenario additionally requires two empty signed east
placement cases and two signed ellipse native selection/Alt-cycle cases (2D
nonempty and 3D empty). Raw actual .23 contour points, native path/BBox, local
placement CTM, separately framed screen bounds, current hit stack/owner/epoch,
trusted events and exact runtime/saved/history coordinates are mandatory.
The oblique point must exceed the old four-cardinal contour's six-unit clearance;
flags cannot substitute for actual native cycle success. Registered synthetic
policy controls reject missing/corrupt/frame-confused records. All eight original
scenarios, all eighteen cumulative groups, pending downloads and capture/raw
contracts remain required. Existing suites are already in the explicit npm-test
list and the existing isolated runner copy list includes every imported helper;
no dependency or skipped case is added.

Executed child checks used Homebrew-first Node v26.9.0. Fresh full `npm test`
passed **6,425/6,425**, zero failures/cancellations/skips/todo, with normal project
concurrency (`npm-test.log`, 826,669.455416ms). The focused geometry/model/TikZ/
stalled-runner sweep passed 489/489; preserved view/preparation/pending/capture/
ownership checks passed 347/347; cumulative policy/ownership passed 1,308/1,308;
isolated runner/process/evidence checks passed 51/51. Build, focused strict
TypeScript, configured TypeScript lint, recommended changed-script lint, all
five changed/new script syntax checks and `git diff --check` passed. Existing
geometric caller `no-unsafe-finally` (two), verifier unused `_role`, layer unused
`defaultCurveStyle` and eleven focused layer TypeScript diagnostics were
reproduced separately from unchanged HEAD bytes. Those checks remain failed;
application build is a separate pass.

Both configured direct required browser commands failed at fresh owned-server
`listen EPERM 127.0.0.1` before Chrome. Label-assets passed its static graph only
(four entries, 43 chunks, 85 references, 40 font modules). Strict free-labels
retains browserVersion null, no completed groups, all eighteen unexecuted and
pageErrors empty. The new signed native placement/Alt cases, both pending layout
downloads/reopening/PNG/TikZ and final standalone acceptance remain unexecuted
for this changed tree. These diagnostic attempts precede this final results
documentation update. A fresh `node scripts/automation/run-phase.mjs 32D verify`
is required on the final frozen tree; its actual command/report/checkout results
belong to the external handoff. Completion review does not start after failed
or incomplete verification. The retained earlier `needs_changes` review has
not been replaced by a current passing review. No commit or push occurred.

Current commands, additive independent references, preservation hashes, final
tracked/untracked identity and native acceptance disposition are recorded under
`/private/tmp/stz-32d-signed-fix-20261011/`. Fresh cumulative verification of this
changed tree must precede independent read-only completion review and the
parent's exact-tree post-review guard. No earlier browser report verifies these
negative cases or the changed tree. Phase 32 remains **incomplete**. Failed or
incomplete verification stops before completion review, commit and push.

Status (2026-10-11): implementation and focused Node verification are present.
Phase 32 is **not complete**. Fresh accepted required commands, strict native
browser/download evidence and independent review remain required. 32A and main's
later 32B have historical accepted evidence. The plan still records unaccepted
fresh strict native/review gates for the merged 32C checkout; implementation
presence does not close that prerequisite or the final gate.

## Resolved preview and exact native-edit provenance correction (2026-10-11)

The actual starting checkout is clean at
`8067dea1c9e43a1387a7b6083ff2d1805e4c9752`, fingerprint
`832a100ce9dff7908961f6c3cbd5f2db9967f37f72590142249d06bcc463e58b`.
The previous eleven modified files and three new view/helper fixture files are
already tracked and preserved. Current identities, diff, preservation hashes,
commands and final results are retained under
`/private/tmp/stz-32d-resolved-provenance-20261011/`. Earlier sections below are
historical; their identities/results never establish changed-tree acceptance.

The latest browser-capable parent `E5qxLx` passed 6,347 tests, build, diff and
full label-assets and completed sixteen of eighteen groups. Complete geometric
transparent/white native downloads with reopening/PNG acceptance and the first
six layout scenarios passed. Native transparent pending selection and the SVG
click while held passed. Its next first failure is the before-stage view layout
comparison: resolved DOM correctly omits authored `units`, while the harness
incorrectly spread the whole authored layout into its expectation. The record
contains only `before`, fillCount 0, zoom/slider 1, pan 0/0, no control events or
observation errors. No zoom input or geometry change occurred. The circle is
ready for its new source, while the original captured source remains held with
started 2/completed 0/unreleased. The immutable click retains all fifteen original
points, revision 427, old source/base/minimumWidth 35 and started 1/completed 0.
Successful observer/disclosure restoration and later failure-cleanup release
do not establish intended release or downloaded-file acceptance. Page errors
and secondary errors are empty; both pending layout downloads and final
standalone acceptance remain incomplete/unexecuted. This parent failure followed
Chrome launch and is distinct from child server-startup restrictions.

`pointLayoutPendingView.mjs` now explicitly expects all six finite resolved
dimension fields, anchor and effective default/merged font context, then compares
the entire parsed DOM object exactly. Missing, incorrect, malformed or extra
resolved fields fail, including authored units incorrectly added to the DOM.
This complete fixture explicitly authors every dimension; no generic fallback
normalization or production resolution change is introduced.

The native-edit expectation starts from immutable click-time runtime and saved
inputs and applies only source `later $changed$`, anchor `north`, minimumWidth
110 and `{source:'110',unit:'pt',texPoints:110}` provenance. Other-axis sources
and per-axis/global contexts remain exact, without invented pt-axis context.
Runtime, the full saved envelope and history present must match these expected
authored forms. Saved runtime-camera/default omissions remain intact. Exact
saved/runtime/history/selection/revision/uiSettings invariants during the view
action and all control, projection, owner, request, hold and cleanup checks remain.
The corrected stage and independently constructed native-edit expectations pass
against unchanged retained parent before-only records as a diagnostic; that
does not establish fresh view/download acceptance.

The synthetic fixture independently writes native provenance into saved/runtime/
history present and emits only resolved preview fields. It preserves honest
intermediate source/anchor histories and the old immutable click. Registered
view regressions cover direct before-stage and full control/projection success,
missing/changed source/unit/texPoints, other-axis/context preservation, invented
pt context, saved/history-only and view-only corruption, and complete resolved
schema failures. Two parent standalone controls also reject authored metadata
corruption in actual required raw-view/artifact records while numeric width
remains 110. Existing runner dependency copying and test registration suffice;
no new dependency or file is required.

Focused layout/provenance/view/preparation/inline/capture/policy/ownership checks
passed 1,334/1,334; the view suite includes 97 synthetic checks. Changed-script
recommended lint passed. Reproduced baseline checks remain failed: two geometric
`no-unsafe-finally` errors, verifier unused `_role`, unchanged layers unused
`defaultCurveStyle` and eleven isolated strict-TypeScript diagnostics. Browser
fixture strict TypeScript/configured lint passed; application build is separate.
Final full/runner/required browser/strict verification results and matching frozen
tree identity belong to the external handoff.

Production model/rendering/Inspector/serialization/camera/geometry/TikZ and PGF
references/tolerances remain unchanged. Deterministic fifteen-point pending
fixtures, native `.23` preparation, unique export-path inline binding, click/hold/
intended-release sequence, SVG/TikZ/reopening/complete-PNG contracts and cumulative
strict predecessors remain mandatory. Fresh accepted verification must precede
independent read-only review of the exact matching tree and the post-review
identity guard. The diamond PGF review gate remains open. Phase 32 is **not
complete**; failed/incomplete verification stops before review/commit/push.

## Current pending 2D view observation and inline binding correction (2026-10-11)

The actual clean starting checkout is
`63a6afc6ae212458d17d0fe11849bf2957ecb2f7`, fingerprint
`fd1568c469bc6af3a11e9a361f64358de682fad918fe6a2cec26ac8759b08580`.
All nine modified files and four new files from the earlier pending-fixture
handoff are now tracked here and preserved. Current command results, preservation
hashes, raw evidence and final tracked/untracked identity are retained externally
under `/private/tmp/stz-32d-view-fix-20261011/`; an earlier fingerprint is never
used as acceptance for this changed tree. Earlier sections below retain their
historical evidence and original dispositions.

The retained browser-capable parent `bmgK6V` passed 6,212 tests, build, diff and
full label-assets, then completed sixteen of eighteen cumulative groups. It
accepted the complete geometric group, including both actual transparent/white
SVG downloads, reopening and PNG capture, and the first six layout scenarios:
90 sizing cases, 305 supported anchors, all six unsupported body → far → warning
cases, native controls/persistence, six import/order/unit cases, eleven async
transitions, four 2D/3D native interactions and both body-overflow/Alt cycles.
Transparent pending preparation also passed sequence 39 at document epoch 427:
one ordinary trusted `.23` gesture selected `layout-circle` without interception.
The actual SVG click captured all fifteen points, selected circle and transparent
background while the original full source remained pending. Its click-time hold
was started 1/completed 0/unreleased; the later held observation was started
2/completed 0/unreleased. These distinct observations remain intact.

After the intended source edit, native anchor `north` and minimum width `110`
inputs were recorded with trusted input and matching model values. The camera
disclosure caption still read zoom 1/pan x 0/pan y 0 before the awaited fill of
`1.4`. The next assertion incorrectly demanded changed serialized `uiSettings`.
App intentionally omits 2D zoom/pan there and omits runtime camera from saved
JSON; preview camera adjustment changes the projected positions independently.
No actual post-fill control or placement observation was retained because the
planned post-click record followed that assertion. The bounded failure DOM ends
before camera inputs, so it proves neither applied zoom `1.4` nor a native matrix
change. Page errors are empty. Cleanup released two held requests and removed
the export listener with no errors; that is not the intended captured release
or terminal download acceptance. Neither pending layout download nor the final
standalone group was accepted. This is a real parent oracle failure, distinct
from prior sibling interception and child server-startup restrictions.

`pointLayoutPendingView.mjs` now scopes the transparent pending view action to
the real owned Preview view panel. It resolves exactly one numeric `zoom value`
control, its associated `zoom slider` and the disclosure for `camera-details`,
retaining actual accessible names, counts, values, connection/object identity,
supported finite ranges, step values and pan controls. It expands only when
needed and takes the baseline after expansion/scroll and the already intended
source/anchor/minimum edits. Already-equal zoom is a failed precondition. One
ordinary native numeric fill targets `1.4`; actual input/change provenance,
ordered values and owners are recorded without synthetic events or value retries.
Before, immediate-input and bounded committed-after observations are persisted
before validation, including partial or failed observations.

Each stage measures the current connected outer point-node origins for circle
`(7,6.5,0)`, rectangle `(19,13,0)` and cylinder `(23,1,0)`, with exact model data,
source/request/document ownership and native node/root matrices. Finite invertible
screen matrices normalize those origins into the actual SVG root frame; viewBox,
client/viewport and scroll/disclosure conditions remain raw evidence. The stable
rectangle/cylinder separation establishes the measured scale on both axes and
must change by the actual zoom ratio. Their measured origin also checks absolute
placement of all three nodes with fixed pan. Child text/contour dimensions and
selected-anchor offsets cannot supply that proof, nor can CSS/scroll-only movement
or root screenCTM inequality. Native half-ulp binary32 translation allowances are
propagated through subtraction and scale/origin inference without changing PGF
tolerances or using the production camera solver as the acceptance oracle.

The view-only action preserves exact saved/runtime diagram, history, selection,
document revision, source/layout and unrelated UI settings; 2D `uiSettings` may
correctly remain identical. Current async completion is retained under the same
source/request owner and cannot stand in for camera movement. The old export-click
snapshot remains exact, the original full source stays unreleased until its
intended later release, and owned listener/disclosure cleanup preserves the first
error. No extra click/export/retry, camera reset or failure screenshot is added.

The mandatory `point-layout-pending-transparent-edit-post-click-view.json`
artifact binds the same observations and immutable old click into terminal,
standalone and fresh browser-report records. Parent validation rejects missing,
stale, failed or unrelated records and a declared view-change flag without actual
control and root-relative projection proof. Focused synthetic controls cover the
unchanged-uiSettings success contract, no-op/unapplied input, numeric-only or
CSS-only movement, incorrect controls/owners/requests/epochs, invalid matrices,
changed model/history/pan, missing stages/events, overwritten click snapshots,
early release and diagnostic/cleanup errors. These controls are separate from
native acceptance; their current execution results remain pending verification.

The pending standalone callback now resolves its own declared fixture's unique
`export-path`, requiring `geometricKind: "curve"`, `kind: "polyline"` and both
exact inline-node records, including source, order and placement/options. It no
longer indexes the distinct earlier async-isolation object named `siblings`.
Missing/duplicate/wrong-kind paths and omitted/changed inline content fail the
binding regression. The successful earlier async snapshot, both free-label XML
checks, existing inline XML text checks and all-fifteen point/source/layout/
placement comparisons remain unchanged.

Production model/persistence/uiSettings, geometry/rendering/camera semantics,
completed native/pending preparation, shared standalone SVG capture and all PGF
references/tolerances are preserved. No dependency is added. Required commands
and focused checks on this tree are currently pending; reproduced baseline
geometric/verifier/layer lint and isolated strict-TypeScript debt remain failed
checks, separate from application build. The browser-capable parent must load
the updated callers/helpers/contracts/policy in a fresh owned process and run
strict cumulative `32D verify` on the exact preserved dirty tree. All eighteen
groups, both pending layout SVG/TikZ downloads, actual reopening/complete PNGs,
final standalone exports and the diamond PGF review gate remain required.
Only complete accepted verification can precede matching independent read-only
review and the exact-tree post-review identity gate. Phase 32 is **not complete**;
failed or incomplete verification stops before review/commit/push.

## Pending combined-export fixture preparation correction (2026-10-11)

The actual starting checkout is clean at
`dab98a52983920f68da09982dedacb9342c959ab`, fingerprint
`5a863f505aca7c1201dd6826367e024c2eb71980769182b2ea923d12e3bdccde`.
The prompt update and earlier ordinary-body/native/capture corrections are
tracked here. Initial/final inventories, diff, preservation hashes, commands
and exact current-tree handoff are retained under
`/private/tmp/stz-32d-pending-fix-20261011/`.

The latest browser-capable parent `DvEwwg` passed 6,158 tests, build, diff and
full label-assets, then completed sixteen of eighteen cumulative groups. Full
geometric transparent/white download/reopening/PNG acceptance passed. Layout
sizing (90 cases), supported anchors (305), all six unsupported ordinary
body → far → warning cases, controls/persistence/imports/async isolation and
four native interactions plus both negative-padding overflow/Alt cases passed.
Its first pending transparent setup failed before canvas input: the current
`.23` circle contour point hit the sibling trapezium body rectangle, followed
by trapezium/isosceles-triangle paint and then the intended circle. Records
0493–0499 retain the native circle CTM/hit stack, closed Inspector, expanded
toolbar, unchanged null selection and empty page errors. Historical sibling
dimensions are not measured there. No pending layout download or final
standalone export was accepted; there is no pending failure screenshot.

Only these two pending fixtures now use a deterministic initial position
declaration: circle `(7,6.5,0)` and the fourteen other shapes in the right-hand
grid, with incircle triangle/semicircle farther right and compact dart nearer
the circle. The complete fifteen-shape id/source/style/layout/parameter/list
order, both free labels and inline path are preserved. A pure builder clones
the declared document before normal JSON load; picking never changes loaded
coordinates. Both expected placement and TikZ comparisons use those same
positions. Production projection controls with the retained actual circle box
and explicit emergency sibling estimates expose the old overlap and check the
new target clearance. They establish neither native acceptance nor complete
visibility/nonoverlap of every sibling footprint; current bounds are measured
independently in the fresh browser.

The scoped pending preparation wrapper retains the unchanged shared `.23`
selection route. Fresh observations include all current sibling body targets
and painted contours, native bounds/matrices, owner/request/source/state,
declared and rendered order, canvas/viewport/scroll/clipping and top hit/stack.
Immediately before one ordinary click it persists and validates those raw
observations and the unreleased pending hold. The shared intended-first-hit,
binary32 allowance, toolbar/Inspector preparation/restoration and trusted
owner/path assertions remain unchanged. A bounded scoped listener additionally
requires no modifiers and actual selected circle ownership; unavailable, stale
or intercepted targets fail without input. No body route, trial click, forced
selection, sort/layer/visibility change, camera reset or renderer change is used.

The actual export-click fixture snapshot additionally records authoritative
selection/runtime/UI state, the native background select and held conversion
state. Both pending terminal policies require matching raw preparation,
unreleased current request at click, exact fifteen captured entries/positions,
and the intended post-click captured release. The standalone record binds the
same preparation artifact and continues to require actual immutable SVG/TikZ,
settled contour inequality, reopening and complete PNG byte validation. Failure
cleanup records hold release and owns export/modifier listeners while preserving
the first error; no extra failure image is added. New focused controls are
registered and imported runner dependencies are copied. No dependency is added.

Production/model/serialization/geometry/TikZ files, completed native/body/
visibility helpers, shared capture contracts and independent PGF files remain
byte-preserved. Reproduced baseline lint/type debt remains failed, separate
from application build and changed-file checks. Final executed command results
and strict fresh-process verifier identity belong to the external handoff.
Complete accepted current-tree verification and matching read-only independent
review remain required, including both pending layout downloads and the final
standalone group. The diamond PGF review gate remains open. Phase 32 is
**not complete**; failed/incomplete verification stops before review/commit/push.

## Ordinary visible-body selection correction (2026-10-11)

The actual clean starting checkout is
`cf6a9d34feb64b8ba512371e272a1b8ff32c8b7d`, fingerprint
`9132034f073fc8c63bc97c587c064de2465e3cb181902f32e9508be808a9541d`.
The earlier seven-file/five-new-file diagnostic correction and prompt update
are already tracked. Current inventory, retained parent file identities, final
command logs and exact tracked/untracked handoff identity are recorded under
`/private/tmp/stz-32d-body-fix-20261011/`.

The latest browser-capable parent `pOKk4r` passed 6,144 tests, build, diff and
full label-assets, then completed sixteen of eighteen cumulative groups.
Complete geometric coverage includes both actual transparent/white SVG downloads,
reopening and complete PNG capture. Layout sizing passed ninety cases across
fifteen shapes. Its first unsupported case (2D ellipse, owner epoch 397) then
failed `body selects the owned point`: actual selection stayed null, with no ring.
Records 0007–0009 retain the measured first-character body point, actual trusted
background pointerdown and captured-root pointerup/click, and unchanged state.
This background capture occurred in 2D. No overlay intercepted input; page and
secondary errors are empty. Far and warning input, the other five unsupported
cases, later layout scenarios/downloads and final standalone export did not run.
This native failure is distinct from child startup restrictions.

Source tracing establishes the missing ordinary route: `SvgPointNode` supplies
`boundsTarget:false`, the glyph group ignores pointer events, and the pure body
collector runs only in the Alt capture branch. An ordinary background click
clears selection. The earlier synthetic background-body success premise did
not establish production selection and is superseded here.

The live `SvgPointNode` now enables one preview-only `data-point-body-target`
rectangle in `SvgPointNodeView`. It uses only finite positive current
`layout.body.bounds`, including the current anchor placement, and the point
node's actual transform. Empty/whitespace-only bodies emit no target. The
transparent rectangle precedes the noninteractive glyph group and bubbles to
the existing owned point handler. It inherits normal draw order, filtering,
locking and pointer modes; no ordinary all-strata collector is added. Contour,
warning, body overflow, Alt cycling, background capture and selected handles
keep their existing routes. The shared view defaults the target off for settled
export, and the live element also carries the exact export-exclusion marker.
Visual source, paint, placement, TikZ and model/history semantics are unchanged.

The measured right/left/below/above resolver, rejection reasons and first eligible
adoption remain unchanged. The six-case native helper still performs exactly one
body → far → warning gesture per case with immediate before/after observations.
Raw body evidence now includes connected DOM object identities, exact rectangle
attributes, native binary32 BBox, local bounds, screen CTM, current sibling label,
point node and owner group. Native body input must reach that exact current target
and traverse its real owner path without modifiers. Background body delivery,
stale/wrong/absent/oversized targets, missing paths, null selection or absent ring
cannot pass. Only the genuine far background route may retain observed capture
continuation. Existing six-unit picking and PGF tolerances are unchanged.

The registered `svgPointBodyInteraction.test.ts` executes real live production
components and capture/owner/background callbacks with explicitly controlled
Node hooks and event propagation. It detects the disconnected ordinary route,
checks both ambient dimensions, body/far/warning selection and bounded rings,
model/history invariance, lifecycle/current ownership, hidden/locked/filtered/
empty bodies, negative-padding overflow, contour/Alt behavior and detached visual
equality. It is not native acceptance. Diagnostic/policy controls reject the
former synthetic background success assumption. Existing runner imports already
copy the strengthened transitive contract; no dependency is added.

Completed native helpers, capture contracts and retained real geometric SVG/PNG
files are preserved. All PGF references remain unchanged (172 boxes, 4,925 anchors,
eleven failures); the diamond outer-separation review gate remains open. Final
required/focused check results and the frozen identity belong to the adjacent
handoff. Reproduced baseline lint and isolated layer TypeScript checks remain
failed, separate from application build. Complete fresh strict parent verification
must accept all eighteen groups, all six unsupported cases, remaining layout and
both pending layout downloads/final standalone capture before matching independent
review. Failed/incomplete verification stops before review/commit/push. Phase 32
remains incomplete.

## Measured unsupported-anchor diagnostic input correction (2026-10-10)

The actual starting checkout is clean at
`d37c63f4e98c671f3a5f1ab359995ec04f0c2924`, fingerprint
`9fa91def69c7a13a33dbb52d921f29f8db3f97e5a9916fa88e13740b8866ea94`.
Earlier corrections, including the former thirteen modified files and four new
standalone-capture files, are tracked in this tree. Production, completed native
helpers, model/serialization, geometry, PGF references and capture contracts are
preserved. Initial inventory and final command/identity records are retained
under `/private/tmp/stz-32d-diagnostic-fix-20261010/`.

The latest browser-capable parent `stz-phase32d-before-review-tIPiXu` passed
6,119 tests, build, diff and full label-assets with Chrome 154.0.8037.98. It
completed 16/18 cumulative groups. Complete paint/import and geometric coverage,
including eleven shapes, eight contours, visibility and both transparent/white
geometric SVG downloads, reopening and PNG capture, passed. Their raw standalone
records remain observed candidates with saved capture, followed by separate
terminal passed scenario records. Both measured one complete 520×360 SVG root,
`bodyExists=false` and stable coordinates; actual PNGs are 1700×1300 and
31,278/31,548 bytes. Those accepted files and their identity contracts remain.

Layout sizing passed 90 cases across fifteen shapes. The anchor scenario's last
checkpoint names supported cylinder/bottom, but the scenario is not terminal
passed: preparation of its first unsupported native case, 2D ellipse at owner
epoch 397, failed `Far diagnostic click reaches the native SVG canvas` before
any body/far/warning click. Failure DOM retains viewBox `0 0 520 360`, node
`translate(404 36)`, body metadata approximately `[-48.706,-7,48.706,7]`, the
exact source `WWWW diagnostic`, unsupported anchor and minima 1000. The fixed
rightward probe therefore appears to map beyond the SVG's right edge. Native
getBBox/CTM/screen point/hit stack were not saved historically, so this remains
a source/DOM-supported inference; Inspector or toolbar interception is not
proven. Page errors are empty. Later layout controls/persistence, lifecycle,
picking/owner cycle, imports, both pending layout downloads and final standalone
export did not execute. This is distinct from child server-startup restrictions
and the resolved standalone screenshot failure.

`pointUnsupportedDiagnostic.mjs` provides narrowly scoped native observation,
preparation, input and restoration without weakening the completed painted-
contour selection helper. Its companion pure contract preserves the original
rightward probe as the first observation, then considers left/below/above in a
fixed bounded order with the same 100-unit declared clearance. Each measured
candidate retains local, SVG-root and screen coordinates, native node/root CTMs,
viewBox, preserveAspectRatio, client/viewport/scroll/clip observations, actual
targets/hit stacks and eligibility/rejection reasons. Acceptance requires the
connected unique production canvas, current owner/request/source/anchor, finite
invertible matrices, intentional zero contour/paint, an interior requested-shape
point beyond visible body/warning picking bounds and any current selection ring,
and an unobstructed route into the actual drawing area. No eligible candidate
fails with observations and no click; source, minima, placement and camera do
not change to obtain a probe.

The exact body → far → warning sequence uses one intended native mouse click
per action and fresh measurements before every input, including after body
selection creates its bounded visible ring. Partial preparation and action
records are persisted as observed before assertions. Owned bounded listeners
retain trusted pointerdown/up/click, target/composed path, pointer/button/order,
document epoch, owner/request/source and exact canvas identity, plus before/after
saved/runtime/history/UI/work-plane state and final selection. This historical
fixture permitted background-body delivery with declared selection; the newer
ordinary-route correction above removes that unsupported success premise.
Actual camera background capture may deliver pointerup/click through the owned
SVG root; that continuation requires the measured background down target, matching
pointer, observed capture at pointerup and release before click. Far background
delivery must leave `app-point` unselected; body and warning must select it. Only intended selection and explicitly owned UI preparation may vary.

Scoped native Select access precedes conditional toolbar collapse, and an owned
Inspector is closed only when measured obstruction requires preparation. Each UI
change triggers remeasurement and exact authoritative-state checks. Restoration
owns only its temporary UI changes, preserves terminal selection and retains
the first action/assertion error through diagnostic/artifact/listener/cleanup
failures. Only complete validated raw records publish a terminal passed case.
The layout contract and strict 32D parent policy require all six native cases
with these coordinates, candidates, input and state records. Registered pure,
integration and policy controls exercise the off-canvas right probe, alternative
candidates, nontrivial CTMs/aspect-ratio framing, clipping/overlays, all-invalid
sets, visible-region/ring/request bounds, stale measurements and misdelivered
events. These synthetic controls do not establish native acceptance. The explicit
test list and isolated runner dependency copying include the new files; no
dependency is added.

Application build passed. Focused diagnostic/policy checks passed 346/346,
including twelve pure contract and eleven integration controls; isolated runner
checks passed 37/37. A broader geometry/native-helper/policy/capture checkpoint
passed 1,356 checks. Immediate input measurements also bind current CTM/hit/state
after observer activation; captured background continuation has positive and
negative controls. Final full/strict command results and the exact tracked/
untracked identity are retained in the external handoff. Baseline checks reproduce the geometric caller's two
`no-unsafe-finally` errors and verifier unused `_role`, plus the unchanged layer
test's unused `defaultCurveStyle` and eleven focused strict-TypeScript diagnostics.
These checks remain failed, separate from application TypeScript/build. Both
configured direct child browser commands failed at fresh owned-server
`listen EPERM 127.0.0.1` before Chrome launch. Label-assets passed only its static
graph (four entries, 43 worker chunks, 85 references and 40 fonts); strict
free-labels retained startup/checkout evidence with no native pass. Logs are
`direct-label-assets.log` and `direct-free-labels.log` in the external handoff,
with raw startup evidence under `direct-free-labels/`. These restrictions are
separate from the parent's unsupported-anchor assertion. Fresh
strict parent verification must complete all eighteen groups, the full layout
matrix and pending transparent/white layout downloads with real SVG/PNG evidence
before matching read-only independent review. The 172-box / 4,925-anchor /
11-failure reference inventory and diamond outer-separation review gate remain.
Phase 32 stays incomplete; failed verification stops before review/commit/push.

## Standalone SVG capture integration (2026-10-10)

The actual clean starting tree is `2f9cba7d0bb3a555c13d2e70d4ec673a44237768`
on `phase/32d-margin-minsize-anchor`, fingerprint
`ed5c6e2beff67c52e1596012f9d32f9eccef19fe46a78421e78b0a916bbf607d`.
The prior ten-file canonical-layer correction and updated prompt are tracked.
Production, completed native helpers, model/serialization semantics and all
PGF reference inputs/artifacts/tolerances are preserved.

The latest browser-capable parent `stz-phase32d-before-review-1V3I0G` passed
6,072 tests/build/diff/full label-assets, then completed 15/18 cumulative groups
with Chrome 154.0.8037.98. Full paint/import, eleven shapes, eight contour
interactions and the terminal geometric visibility artifact passed. Its next
failure is `point-geometric-download-transparent`: the actual 29,281-byte SVG
was downloaded and reopened, then `fullPage` screenshot timed out after fonts
loaded. Transparent PNG, standalone JSON and terminal download pass are absent;
white geometric download, layout/anchor group and final standalone export did
not execute. Empty App page errors/lifecycle do not supply standalone bounds.

The configured Playwright source prepares fonts before `_fullPageSize`, whose
utility callback returns null without `document.body`. SVG XML has an SVG root
and no HTML body. This supports a full-page sizing mismatch; the failed file
page's body/bounds were not directly retained, so no measured historical body
claim is made. The saved XML has root width 520 / height 360, viewBox
`0 0 520 360`, eleven source titles and outlined paths, with no href references
or parsererror/foreignObject/image/script. This offline inspection is diagnostic
only and cannot establish complete native download/image acceptance.

Both geometric and layout pending-export callers now reuse unchanged
`standaloneSvgCapture.mjs`. Bounded persistence retains actual reopened nodes,
root/XML observations, requests/errors, settled expected geometry, click-time
source/parameters and background/file identity before assertions or image work.
Layout also retains pending contour, node/body transforms and both TikZ outputs.
The same raw artifact stays `result: observed` while capture records progress
through pending/saved/failed. One CSS viewport screenshot, bounded settling,
measured complete-root coverage and before/after stability remain mandatory;
there is no retry, font bypass, scaling or export geometry change.

Standalone page/listener cleanup precedes terminal download save. The first
assertion/capture error survives secondary persistence/cleanup failures; cleanup
failure alone still fails the workflow. An optional owned-App diagnostic argument
suppresses an additional failure image for these standalone failures while
preserving its API-independent App snapshot/lifecycle and default native behavior.

The cumulative parent verifier validates raw reopening/expected/click agreement
and all existing source/paint/placement/background comparisons independently of
image status. A shared evidence contract reuses capture coverage/stability
functions and binds the saved record to exact SVG URL and PNG path, real complete
PNG bytes/chunks/scanlines/dimensions/byte length, finite fixed-root coverage and
stable coordinates. Pending/failed/missing/cropped/malformed/unrelated evidence,
mock PNG headers and summary success flags cannot establish acceptance. Both
parent policy suites add faithful synthetic controls, distinct from native
acceptance; isolated runner fixtures include the new transitive dependencies.
The two caller integration suites are explicitly registered. No dependency was added.

Focused results and the final full checks, binary tracked/untracked identity,
logs, retained parent observations and preservation inventory are recorded under
`/private/tmp/stz-32d-svg-capture-fix-20261010/`. Configured direct browser commands
in this child stop before Chrome at fresh-server `listen EPERM 127.0.0.1`;
label-assets passes its static graph only. These startup failures are separate
from the parent's post-font screenshot failure and provide no new native pass.
Homebrew Node v26.9.0 is used. Read-only HEAD reproduces three geometric caller
`no-unsafe-finally` errors and verifier unused `_role`; extraction removes the
standalone finally error, leaving two caller errors and `_role`. Overall scoped
lint including that debt remains failed. The unchanged layer test still reports
unused `defaultCurveStyle` and eleven inherited focused strict-TypeScript errors;
these are separate failed checks, not application-build results.

Fresh strict `32D verify` must accept the exact preserved dirty tree with all
18 cumulative groups, transparent/white geometric and layout downloads, actual
standalone file measurements/complete PNGs, native history/JSON and both TikZ
modes before matching independent read-only review. The 172-box / 4,925-anchor /
11-failure inventory and diamond outer-separation review gate remain. Failed or
partial verification stops before review/commit/push. Phase 32 stays incomplete;
final child command/report/identity results belong to the external handoff.

## Canonical layer visibility evidence correction (2026-10-10)

The actual starting checkout is clean at
`1bcfcd5f06c1c12e92b744e0cb542c6dd8cb4a1d`, fingerprint
`ab8f4425318cba5b7adc25dcefaca340389f29e898392fc2be687cadb68dc97c`.
The previous source-panel and camera corrections are now tracked, including
their helpers, fixtures, registrations and isolated-runner dependencies.

The latest browser-capable parent `stz-phase32d-before-review-IocgXz` passed
5,987/5,987 tests, build, diff and full label-assets with Chrome 154.0.8037.98.
It completed 15/18 cumulative groups, all eleven shapes and all eight native
contour interactions. Native camera preparation and all three dim/hide/dim
actions completed at epoch 110, retaining actual input/change events with
`trusted: false`. Dimmed fill and cumulative opacity are .28; hide removes the
render. Its first failure is the visibility validator's raw `visible === true`
assertion. Production normalizes the visible default by omitting that field.
This is separate from the resolved locator/camera/toolbar/drag failures and the
child's server-startup restriction. These observations have no terminal visibility
pass; both geometric downloads, layout/owner-cycle matrix and final standalone
export did not execute. Page errors are empty.

The scoped contract requires explicit layer metadata, exactly one valid matching
owned record, the configured point layer and name, and `locked === true`. Only
the visibility assertion interprets omitted/boolean true as visible. False and
malformed present values fail. Saved/runtime/current-history point and layer
records must agree exactly; the validator preserves their raw representation.
The hidden record retains explicit false, exact point data, absent rendering and
the native load's exact +1 epoch. Synthetic policy fixtures now omit visible
defaults, with production load/save normalization covered in the registered
layer suite. Both parent suites distinguish valid explicit true input from
canonical output and reject corrupt or unowned metadata and raw disagreement.

Bounded observed diagnostics retain locked before/after state and rendering
before hidden load, hidden state/render before occlusion load, and the complete
raw candidate before its terminal assertions. Observed records cannot count as
passed scenarios. Stage/candidate ordering and rejection regressions retain the
first action/assertion failure through secondary capture, artifact and cleanup
failures. Other scenario saving and all completed native helpers remain intact.

Production, geometry, saved format, coordinates, references and tolerances are
unchanged. The 172-box / 4,925-anchor / 11-failure inventory remains; the diamond
outer-separation exception still requires independent PGF review. Fresh strict
verification of the exact final tree must precede matching read-only review.
Current results, preservation hashes, identities and handoff are retained under
`/private/tmp/stz-32d-canonical-layer-fix-20261010/`. Phase 32 remains incomplete;
no review, commit or push follows failed or incomplete verification.

Executed local checks use Homebrew Node v26.9.0. Normalization and both parent
policy suites passed 680/680; the diagnostics suite passed 18/18. Build and seven
changed-script syntax checks passed. No new lint errors were introduced: HEAD
has four geometric caller `no-unsafe-finally` errors and verifier unused `_role`;
current primary-error cleanup leaves three of those caller errors. The existing
layers suite also reproduces its unused `defaultCurveStyle` and eleven standalone
strict TypeScript diagnostics, identical to HEAD after path/line shifts. These
focused lint/type checks remain failed; application TypeScript/build passed.
Both direct browser commands stopped before Chrome at fresh-server
`listen EPERM 127.0.0.1`. Label-assets passed only its static graph; strict
free-labels completed zero groups with all eighteen unexecuted. Final full/focused
commands, fresh `32D verify` response/report and matching tree identity belong to
the external handoff. Startup diagnostics do not establish native acceptance.

## Earlier source-panel and camera correction

The earlier browser-capable parent, retained as `stz-phase32d-before-review-yYQ7Zh`,
passed 5,830 tests, build, diff and full label-assets with Chrome 154.0.8037.98.
It completed 15 of 18 cumulative groups: full paint/import, all eleven named
shapes and all eight 2D/3D contour interactions passed, including trusted native
selection/drag, one bounded history commit, exact saved/runtime Undo/Redo and
unchanged document epochs 100 through 107. The next active scenario is
`point-geometric-visibility`, which stopped at the caption-only exact
`getByLabel('Hidden points:')` lookup. The source-panel wrapping label also
contains its option text. Page errors are empty. Visibility and both geometric
downloads, the full layout/anchor matrix and final standalone-export group
remain unaccepted. This is separate from the resolved toolbar/drag/revision
assertions and the child's startup restriction.

The current scoped correction starts from the actual clean tracked checkout
`0c622432757e67d5a37c50a8aa84da969d67d670`, fingerprint
`d0dfa54a1754b33aa96ceb46a3c339e9634251086876c1aaa4cd000db92f3bf2`.
All prior corrections, including the former twelve modified files and selection
fixture, are tracked here. The final identity is captured from the actual tree,
including new untracked helpers/fixtures, rather than an older parent report.

`pointSourceVisibility.mjs` scopes its exact caption span to `.source-panel`,
requires the direct production label and unique associated native select,
checks connected/visible/enabled state and exact `dimHidden`/`hideHidden`
options, then scrolls the real field into the internal source header before a
bounded native `selectOption`. Raw before/prepared/after records retain caption/
label text, old/corrected locator counts, options/value, bounds/scroll ancestors,
authoritative visibility settings, model/history/epoch/selection/camera/work
plane and actual owned input/change events. The first dim selection may be a
same-value observation; real hide then dim actions retain their resulting states
and rendering. Pointer delivery or invented trusted flags do not establish a
select action. Diagnostic/listener cleanup cannot replace the first failure.

The retained failure DOM also shows an actual setup mismatch: camera theta 13,
phi -23, zoom 1, with the point classified visible and fill opacity 1. Saved
`view.camera3d` takes precedence over the overwritten `diagram.camera`.
The intended theta 90 / phi 0 occlusion orientation now uses the real numeric
camera controls, with exact before/after UI-only invariance and render records.
The checkbox still runs natively. The dimmed fill-opacity assertion remains,
with a retained cumulative opacity chain in addition. No production camera,
visibility, geometry, model, revision, cache or saved-coordinate behavior changes.

Both parent policies require raw visibility/control/setup/render evidence;
summary success booleans cannot substitute. Registered synthetic controls test
the scoped resolver, no-op/transition values, stale/ambiguous/disabled states,
internal scrolling, exact return/final settings and primary-error ownership.
Runner fixtures copy the new transitive helper dependency. Native visibility,
downloads and standalone acceptance still require a fresh complete strict 32D
parent process followed by independent review of the matching tree. Final child
commands, preservation hashes, tracked/untracked diff and exact handoff are
retained under `/private/tmp/stz-32d-visibility-fix-20261010/`. Failed browser
startup is pending parent work, never accepted evidence. Phase 32 stays incomplete.

Earlier toolbar-fix parent `stz-phase32d-before-review-gn1o0M` passed 5,621
tests/build/diff/label-assets and all eleven shapes, then stopped at expanded
Creation controls covering the configured 2D semicircle's fixed .23 boundary.
Its 2D diamond/star epochs 100/101 were complete; the newer parent above
supersedes that native failure while preserving its diagnostic history.

The earlier toolbar correction starts from the actual clean tracked checkout
`c2ddd167d5f0a6c99dc392368b02bc9d477ff629`, fingerprint
`cee0ec21f6db9226c985ea5ae32ef1a81a595cd351cd9e3c81323af52978a696`.
The prior seven-file revision fix and updated prompt are already tracked there.
All prior implementation, regressions and reference files are preserved.
Shared native preparation records toolbar/drawer state and exact authoritative
data/history/epoch/selection/UI settings, camera and work plane. Native Select
runs while visible; an inherited collapsed toolbar expands through its unique
real control. Only a fresh Creation/owned quick-style hit causes one collapse.
Bounded detachment/collapsed/expand-control checks precede final scrolling and
remeasurement of the connected contour's same `.23` point and own screen CTM.
The intended first SVG hit is required before one native click. History or other
remaining obstructions stop with their actual hit stack. No geometry, viewport,
overlay event behavior or fixture model coordinates are changed.

Canvas observation excludes toolbar actions; raw after-input events/state are
retained before assertions. Owned toolbar changes restore natively after observer
cleanup, with exact local before/after state comparisons preserving the expected
selected owner rather than comparing it to initial null selection. Restoration
uses unique real controls even if a secondary diagnostic read fails, and cannot
mask the first native/action/assertion failure. Inspector controls still reopen
through the existing callers. Layout selection and owner cycling share the scoped
input preparation. Native drag expands for Select when necessary and restores
inherited toolbar state without changing its handle/capture/movement/history or
same-document revision contract. The next selection and drag retain native
Select access. Both parent policies require complete raw selection/toolbar
records, CTM-derived input, owner/request/source identity, trusted delivery and
restoration; counters or summary booleans cannot establish success. Runner
fixtures include the added transitive selection helper import.

Synthetic toolbar/selection, drag, ownership and both parent policy controls are
registered in existing suites; the new selection fixture is an imported helper.
They cover native action ordering, covered semicircle, collapsed/unobstructed
paths, ambiguous/missing controls, failed transitions/restoration, stale geometry,
remaining obstructions, exact UI-action invariance and primary-error ownership.
They do not establish native acceptance. Current child check results and exact
final handoff are retained under `/private/tmp/stz-32d-toolbar-fix-20261010/`.
Fresh complete strict parent verification must precede independent review;
Phase 32 remains incomplete and no commit or push is authorized by a partial run.

The earlier browser-capable parent's retained `stz-phase32d-before-review-5waNKq`
report passed 5,507 tests, build, diff and label-assets, then failed the harness's
revision assertion after 15 of 18 groups. The full paint/import group, corrected
Clear provenance and all eleven named geometric-shape cases passed. The first
2D diamond contour drag delivered trusted handle input with captured canvas
continuation/release, changed only its selected model position, and made exactly
one bounded history commit. Both authoritative and observed document revisions
remain 100. The revised harness requires that same document epoch across drag
and Undo/Redo; production advances it only on document replacement. Drag Undo/Redo
and the remaining contours, later geometric cases, layout/anchors and final
standalone export did not execute in that failed parent run. Complete current-tree
native/download acceptance and independent review remain required. The completed
Clear/selection/preparation corrections and exact layout/unit/context comparisons
remain. Earlier failure/fix records are retained below.

## Model, grammar, and compatibility

`PointStyle.layout` is an additive explicit option object in saved envelope
version 2. Optional numeric `innerXSep`, `innerYSep`, `outerXSep`, `outerYSep`,
`minimumWidth` and `minimumHeight` are TeX pt; optional `anchor` is a literal name
or decimal border angle. Per-axis `units` records original text, unit, resolved
TeX points and optional conversion `fontContext`. That per-axis context overrides
the legacy shared `layout.fontContext`; merges preserve each inherited axis's
context before applying a local override. `importedLayout` records
imported baselines and deliberate local overrides, separately from paint/shape.

Dimensions accept signed finite decimal literals with optional pt/mm/cm/in/bp/
em/ex; a bare number means TeX pt. Exponents, macros, PGF programs and arbitrary
unit expressions are unsupported. The finite preview domain is ±10000pt. Zero
and negative separation remain explicit; undefined constructions are diagnosed.
Cylinder's content fitting rejects its recorded singular negative inner-y branch;
a valid negative-x branch is tested. Zero-axis diamond numeric anchors and two
strong-negative sector directions (`45`, `south west`) have authenticated PGF
failure references and receive individual diagnostics. The other 23 sector
anchors remain usable. Counts/angles retain separate scalar domains.

An inch is 72.27 TeX pt, while bp uses 72 per inch. Preview's 1.2 local SVG units
per TeX pt is separate from CSS pixels, PDF bp and viewport scaling. Unit context
defaults to 10pt em and 4.30554pt ex. A custom context resolves dimensions to
numeric pt; it does not change preview/export typography, text baseline or mid
anchor x-height. No LaTeX font execution or exact TeX/MathJax ink match is claimed.

Omitted inner axes retain legacy Size / 2; an explicit axis overrides that axis
only. Editing Size clears both explicit inner axes. Omitted outer axes use half
the effective line width, omitted minima use 1pt and omitted anchor means center.
Historical empty-node, white hollow, black text and 0.4pt border semantics remain.
Explicit values and source metadata survive presets, clipboard, JSON, history and
immutable export capture. Measurements, contours, requests and SVG are not saved.

Import expands `inner sep`, `outer sep` and `minimum size` into both axes at their
position in the option stream; later axis values replace only their axis. Bounded
style references/local override intent remain in force. Unsupported programs
retain raw external source and diagnostics. `text height`, `text depth`, `text
width` and paragraph `align` are explicitly unsupported. Imported node transforms
(`rotate`, `transform shape`) remain unsupported with diagnostics and preserved
external source; they never become `shape border rotate` or rotate the body in
preview. Border rotation has its separate supported anchor rules below.

Both TikZ modes emit readable axes/minima/anchor options and named xcolor custom
paint. Imported references keep external-source semantics. Standalone node bodies
preserve raw source; inline math retains the existing physical-line folding in
emitted code, while saved source stays exact. Neither adds math delimiters.

## Anchor support

Every identity supports `center`, `text`, `base`, `mid`, eight compass anchors and
finite signed decimal numeric border directions within PGF's scaled-point parse
range. Magnitudes at 16,384 degrees or more are diagnosed, with source retained.
Unsigned and leading-plus literals require an integer prefix and are truncated
before the range check (`0.5` is valid; `.5` and `+.5` are diagnosed). Negative
literals use PGF's dimensional parser, which rounds before truncation and can
also overflow by rounding near that boundary.
Coordinates outside PGF's TeX dimension range also produce a diagnostic
for the selected anchor. PGF truncates decimal directions
toward zero (`13.7` becomes `13`, `-30.8` becomes `-30`) before the radial query;
ellipse compass diagonals use eccentric angle. The recorded PGF 3.1.11a
table is not inferred from screen rectangles. “Text sides” means `base east`,
`base west`, `mid east`, and `mid west`.

| Shape | Text sides | Shape-specific anchors |
| --- | --- | --- |
| circle / rectangle / ellipse | yes | none |
| diamond | no | none |
| square / triangle | no | `corner N`, `side N`, for 4 / 3 sides |
| regular polygon | no | `corner N`, `side N`, for configured sides |
| star | no | `outer point N`, `inner point N`, for configured points |
| trapezium | yes | top/bottom left/right corner; top/bottom/left/right side |
| isosceles triangle | yes | apex; left/right corner; left/right/lower side |
| kite | yes | upper/lower/left/right vertex; upper/lower left/right side |
| dart | yes | tip; left/right tail; tail center; left/right side |
| semicircle | yes | apex; arc start/end; chord center |
| circular sector | no | arc start/end; sector center; arc center |
| cylinder | yes | shape center; before/after top/bottom; top; bottom |

Indices are one-based and bounded by configured count. Unsupported names/indices
remain saved and produce a visible diagnostic. Dart `tail`, sector `apex`/`chord
center`, and unsupported text sides are not fabricated aliases.
When a construction or selected anchor is unsupported, its hidden requested
contour contributes no painted bounds, hits or selection radius. The exact body
and a small SVG warning beside it remain visible and pickable; the ring encloses
those visible bounds only. Requested shape and anchor-clearance metadata remain
distinct for diagnosis. Six native large-minimum cases exercise body/warning
hits and a far miss inside the requested ellipse/circle/cylinder in 2D and 3D.

Actual baseline/depth, text origin, body/text center, shape center and placement
reference are distinct. Body and contour translate by the negative selected
anchor offset, leaving the anchor at the stored coordinate after async metrics
changes. Text remains upright under border-only rotation; specific/compass
anchors follow PGF incircle and restricted-rotation rules. Picking inverse-
translates by the current offset. Drag and coordinate-reference semantics remain.
Valid negative inner padding can place visible text outside the painted contour.
Picking unions the actual body ink with the contour/stroke region; the selection
ring encloses both. Painted bounds remain contour/stroke-only, body bounds remain
separate, and outer anchor clearance enters neither that hit union nor the ring.

Outer separation supplies shape-specific anchor clearance without inflating
picking to that clearance. PGF's diamond has a recorded exception: painted axis
radius is `fitted radius + (1 - 1.414213) * outer axis separation`, while anchor
radius is fitted radius plus outer separation. Positive separation shrinks paint;
negative separation enlarges it. The native matrix measures the exact delta,
rather than waiving its comparison. This differs from the prompt's unconditional
paint-invariance wording; independent review must assess the documented PGF
behavior. Other supported shapes retain painted contour/bounds invariance.

## Independent PGF references

The generator imports no application solver. It invokes pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026), PGF 3.1.11a, identical fixed width/height/
depth, normalized TeX-point options and recorded font context. Artifacts under
`tests/fixtures/point-node-anchors/` retain exact TeX, raw soft paths, coordinates,
compilation logs, command and hashes. Recorded source hashes:

- geometric library: `bbd6abe9df51153e2f4f61cca3ad669de34a6648cf37795df44da931402b69ee`.
- core shapes module: `01dd81e3f2c56a8db7864916ada1a5036964aff2e8176aafd4773244e236bb27`.

The manifest also authenticates core-point, trigonometric and math-calculation
sources, including cylinder's bounded line/arc angular bisection.

Regenerate in the recorded TeX environment:

```sh
PATH=/opt/homebrew/bin:$PATH node scripts/generatePointShapeReferences.mjs
PATH=/opt/homebrew/bin:$PATH node scripts/generatePointAnchorReferences.mjs
```

The latter uses `/Library/TeX/texbin/pdflatex -no-shell-escape
-interaction=nonstopmode -halt-on-error fixed-box.tex` in a fresh temporary
directory. No TeX runtime/dependency is added to the App; 32C LPPL attribution
remains. The final focused geometry run verified 172 fixed boxes, 4,925 successful
anchors and eleven separately retained expected PGF failures; 406/406 geometry tests
passed (165 earlier-stage tests plus 241 new tests). Every shape has a strong
negative outer-separation profile (-30pt), including inverted clearance, signed
named directions, ordered infinite-edge intersections and cylinder bisection.
The generator/reference tests pin exact current inventory counts.
Anchor tolerance is .025pt. Additional large-radius contour cases use .03pt,
accounting for PGF cubic-circle deviation plus bounded .005pt sampling; original
32C .025pt cases remain. Controls reject wrong circle diameter, independent
triangle stretching, body offset and ignored outer sep. Actual fonts/MathJax
remain separate native checks.

## Combined acceptance audit

This mapping distinguishes paths/registered tests from actual results. Pending
evidence is neither a pass nor a waiver. Final current-tree commands/fingerprint
belong to the parent's retained verification report.

| Requirement | Production path / registered Node tests | Native scenario / reference | Current result |
| --- | --- | --- | --- |
| 32A Unicode/math, exact full-source fallback and bounds | label service/runtime; svgPointNodeText/Runtime | language shapes; valid-invalid-valid | Earlier accepted; current native rerun pending |
| 32A stale owners/history/fonts | runtime/lifecycle; svgPointNodeAnchors | A-B-C/load; resource/font; combined async | Node paths covered; current native pending |
| 32A contour/picking/visibility/projection | SvgDiagram/svgHitTesting/point geometry | boundaries/cycling, camera/drag, hidden/locked/dim | Current native pending |
| 32A settled whole-node click-time export | svgSettledExport/point view | existing pending downloads plus both layout downloads | Download/reopen pending |
| 32B paint defaults/import/external references/persistence | importedTikzPaint/Styles, pointPaint suites | full paint-import-persistence group retained | Main historical acceptance; current rerun pending |
| 32B paint cache reuse/stroke picking/responsive lifecycle | paint/dash-cap/polygon suites | all prior strict dash/endpoint/responsive scenarios retained | No profile waiver; current native pending |
| 32C eleven shapes/parameters/intrinsic default fit | shape solver; pointShapeParameters/geometric TikZ | original fixed-box fixtures; complete geometric group | References retained; native/review prerequisite unaccepted |
| 32D signed axes/order/units/default precedence | pointNodeLayout model/TikZ; PointLayoutFields | import-order-units; seven native fields | Node paths covered; native pending |
| 32D per-shape aspect/angles/coupling/stretch/minima | pointNodeLayoutAnchors/AnchorReferences | fixed-box inventory; 90 native sizing cases | Focused PGF/layout passed; native pending |
| 32D standard/numeric/specific anchors and baseline/depth | anchors; anchor references; point rendering tests | all PGF anchors; 305 native anchor cases; six unsupported-anchor body/warning/far-click cases | Focused references passed; native pending |
| 32D rotated/incircle/restricted anchors and outer bounds | shared solver/view; reference controls | anchor matrix; diamond exception exact delta | Reference path verified; native pending |
| 32D wide/tall/failure/recovery/fonts/stale load+undo/siblings | runtime/view; svgPointNodeAnchors | eleven combined transitions and real font width/removal | Node paths covered; native pending |
| 32D boundary/drag/reference/Alt/pan/zoom/camera/locks | SvgDiagram/picking/model references | four native 2D/3D rectangle/sector cases plus two outside-contour text clicks/Alt cycles and ink-enclosing rings | Native pending |
| 32D preset/clipboard/JSON/history/both TikZ modes | serialization/provenance/style cloning/layout suites | native controls, actual JSON download/reload, .tex files | Node paths covered; native pending |
| 32D immutable pending transparent-edit/white-load export | capture registry/settled view | fifteen shapes plus free/inline labels per actual SVG | Download/reopen pending |
| Complete cumulative evidence and independent review | verifier/worker/runner; phase32dVerification | eighteen terminal groups, identities/artifacts/fingerprint | Focused policy passed; parent/review pending |

The new group has eight exact scenarios, 90 spacing/minimum cases, 305 applicable
anchor cases plus six unsupported-anchor hit cases, four interactions plus two body-overflow selection cases, eleven lifecycle transitions and two actual
pending downloads. Its minimum 25 named artifacts include saved JSON, .sty,
both TikZ modes, downloaded SVG/PNG and standalone observations. Additional
selection diagnostics and captured source/style/position/camera/anchor inputs
are retained. Standalone observations precede bounded screenshots; primary
failures survive diagnostics/cleanup and owned event actions are drained.

Strict 32D requires all twelve 31F groups, three 32A groups, the complete 32B
paint group, the 32C shape group and `point-node-layout-anchors-combined`. It
rejects old reports, counts without named terminal scenarios, missing/invalid
artifacts, page errors and tracked/untracked checkout mismatch. The fresh-process
worker remains; a live runner regression proves updated policy loads before
review/commit. Historical scoped 32C remains 32C-only and cannot close strict 32D.

Changed surfaces include the explicit layout model/import/provenance/serialization
and Inspector controls; per-shape sizing/anchors and recorded PGF fixtures;
the shared point layout/view, hit testing, immutable export capture and both TikZ
modes. New registered suites cover model layout, geometric layout/anchors,
independent anchor references, rendered placement and TikZ layout. Existing
paint/provenance/picking tests retain compatible expectations.

The new browser harness is `scripts/checkPointLayoutAnchors.mjs`, with its exact
matrix and evidence validation in `scripts/pointLayoutAnchorsContract.mjs`.
`checkFreeLabels.mjs`, the native App fixture, cumulative verifier, runner tests,
failure-evidence tests and explicit package test list include the new group.
`PREVIEW_UI.md`, `SPEC.md`, `ROADMAP.md`, `PHASE_32_PLAN.md`, `LABEL_ADAPTER.md`
and the shape/reference READMEs document the observed contract and remaining
acceptance gates.

## Executed checks and parent handoff

Focused implementation results used Node v26.9.0 with Homebrew first on PATH:

- `node --test tests/scripts/phase32dVerification.test.mjs`: 68/68 passed, including seven body-overflow and nine unsupported-anchor evidence negative controls.
- `node --test --test-name-pattern '32D' tests/scripts/runPhaseVerification.test.mjs tests/scripts/runPhaseRunner.test.mjs`: 5/5 controlled process/policy tests passed; these do not launch a native browser.
- `node --test tests/geometry/pointNodeShapes.test.ts tests/geometry/pointNodeShapeReferences.test.ts tests/geometry/pointNodeLayoutAnchors.test.ts tests/geometry/pointNodeAnchorReferences.test.ts`: 406/406 passed, including 241 new tests and the final reference inventory above.
- Seven changed .mjs files passed syntax checks. Recommended-rule ESLint with Node/browser globals passed new harness/contracts/tests and changed checkFreeLabels/runner files. Configured focused ESLint passed `freeLabelsApp.tsx`.
- Recommended-rule lint of the existing verifier reports unused `_role`, reproduced from read-only `git show HEAD` baseline. This is baseline debt, not a new production failure or an unrelated cleanup.
- `git diff --check` passed at the focused checkpoint; final current-tree rerun remains required after all changes finish.

The first broad implementation run reported 5,264 tests: 5,260 passed and four
failed. All four failures were inherited 17-group count expectations in
`freeLabelsFailureEvidence.test.mjs`; updating them to the cumulative 18-group
contract passed that focused file 4/4. This broad run predates the final expanded
PGF inventory and body-overflow policy additions, so a fresh final full run is
required and this result is not a full-suite pass.

Child configured browser attempts retained `listen EPERM 127.0.0.1` before
Chrome launch. Intermediate logs are `/private/tmp/stz-32d-label-assets-configured.log`
and `/private/tmp/stz-32d-free-labels-configured.log`; failure evidence is under
`/private/tmp/stz-free-labels-1791463136842`. They do not establish final-tree
browser acceptance, native scenarios, downloaded/reopened SVG or review.

The browser-capable parent must retain final command logs, Node/launched browser
versions, geometry/source/history observations, SVG/PNG and exact checkout identity:

```sh
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
PATH=/opt/homebrew/bin:$PATH npm run check:label-assets
PATH=/opt/homebrew/bin:$PATH npm run check:free-labels
```

Independent read-only review must inspect the matching complete strict report
and artifacts. Missing evidence/failed review keeps Phase 32 incomplete. No new
dependency, sandbox change, profile waiver, commit or publication is included.

## 2026-10-09 bounded Clear provenance correction

The native observer and independent parent validator now detach imported layout
provenance in their expected clones, alongside paint/shape provenance and style
associations. Their full point equality, native contour/body/shape/leaves checks,
unselected controls, preset/source/reference definitions, validity and exact undo
requirements remain. JSON persistence comparisons retain all non-view fields.
No production model, geometry, PGF reference input or tolerance changed.

The existing registered Clear UI suite adds a nonempty imported baseline with a
deliberate local `em` axis override and independently inherited `ex` context.
It checks exact axes, minima, anchor and source/context metadata through Clear,
undo/redo and save/load, deep clone isolation and frozen prior snapshots,
detached reimport stability, and standalone/inline TikZ axis precedence.
Synthetic policy fixtures now carry nonempty layout/provenance on selected
points and an unselected control. Their negative controls cover retained layout
provenance after Clear/redo/reload, changed or dropped layout, altered units or
contexts, changed control layout/provenance, and lost undo provenance. Duplicate
point/diagram/state JSON records stay consistent so the intended semantic checks
reject the faults. Existing bounded-history controls remain required.

Focused checks passed: 9/9 UI tests and 122/122 synthetic policy tests, without
failures or skips; strict focused TypeScript, configured TS lint, changed script
syntax, build and diff checks passed. Recommended script lint retains one
unchanged unused `_role` error, reproduced from this checkout's HEAD.
The required full suite is recorded separately in the fix handoff.

Both configured child browser commands failed at `listen EPERM 127.0.0.1`
before Chrome launch. Label-assets passed its static graph check only;
free-labels retained strict mode with zero completed and all eighteen unexecuted
groups. No fresh native scenarios, downloads or standalone reopen were obtained.
These startup failures are separate from the earlier parent's real Clear
assertion. Fresh complete strict parent evidence must precede independent review.
Logs, diagnostic observations, final tracked/untracked identity and handoff are
under `/private/tmp/stz-32d-provenance-fix-20261009/`. No commit or push was made.

## 2026-10-09 bounded Inspector selection preparation

The inspected checkout is `375cd56b33f5f03357562d359be85c501da15b3f` on
`phase/32d-margin-minsize-anchor`, with a clean starting tree. It already tracks
the six Clear corrections and the updated fix prompt; none was restored or
reimplemented. The actual starting identity is retained with this fix's handoff.

`pointGeometricSelection.mjs` observes the inherited Inspector and authoritative
state, then uses the unique real Close button once if the drawer exists. It
requires bounded detachment and the closed Open control before Select/scroll
and fresh point/body/contour measurements and screen CTMs. Closed drawers
receive no close action. The layout caller's duplicate preparation close is
removed. Both callers retain native Open/Expand after successful selection and
record exact JSON/runtime/history/revision equality across those UI actions.

Before/after click observations still precede the native selection assertion.
One actual canvas click must select its intended point and deliver trusted,
ordered pointerdown/up/click through the recorded intended SVG target/path.
Initial setup must be unselected; preexisting selection and overlay-only events
cannot establish success. Existing selected-point handles are accepted only
through their actual handle path and intended selection. Captured continuation
to the owning SVG requires matching pointer identity and observed capture;
native MouseEvent clicks additionally require matching coordinates. Measured
boundary requests remain boundary requests. Bounded diagnostics, observer
cleanup and primary-error precedence remain.

The registered `phase32cVerification.test.mjs` contains 46 explicitly synthetic
selection/preparation controls (38 added), preserving its other controls. They
cover the reused ellipse/open/JSON-load/diamond sequence, one close, closed
no-op, failed/false detachment and control uniqueness, unchanged coordinates/
raw text/styles/history, stale coordinates, remaining obstruction, intended
targets/paths/capture, and primary errors surviving diagnostics/cleanup. These
controls cannot establish native acceptance. The eleven-shape reused-page loop,
all cumulative groups, layout/anchor matrix and actual download/reopen gates
remain required. No geometry, reference, persistence, overlay or dependency
change is included.

Executed child checks used Homebrew-first Node v26.9.0. The registered selection
suite passed 93/93; selection plus existing event/page/diagnostic ownership
regressions passed 133/133; full `npm test` passed 5,411/5,411 without failures
or skips. Build (strict TypeScript) and diff checks passed; all four changed
JavaScript files passed syntax checks. There are no changed TypeScript files.
Recommended script lint found no new errors: helper/layout caller/tests are
clean, while the geometric caller's four `no-unsafe-finally` errors reproduce
exactly from HEAD. The unchanged verifier separately retains its reproduced
unused `_role` error. These failing baseline lint checks are not lint passes.

The focused native attempt and both required configured browser commands failed
at fresh owned-server `listen EPERM 127.0.0.1` before Chrome launch. Label-assets
passed its static graph only. Free-labels kept strict mode with zero complete
groups and all eighteen unexecuted. Fresh intended-target delivery, native
history/JSON persistence, actual pending transparent/white downloads and
standalone reopening remain unobserved here. These startup failures are distinct
from the latest parent's confirmed native Inspector interception. Independent
acceptance review did not start because complete fresh verification is missing.

Logs, raw startup failures, retained-parent diagnosis, the complete six-file
diff, inventory preservation and final tracked/untracked identity are under
`/private/tmp/stz-32d-inspector-fix-20261009/`. Failed browser snapshots precede
this final documentation update and are diagnostic only. The handoff identifies
the exact final tree for fresh parent verification via `32D verify`, then
matching read-only review. Phase 32 remains incomplete; no commit/push occurred.

## Native handle drag preparation and evidence correction (2026-10-09)

The actual clean starting checkout is `5021a1d8af30f55fa48b67744f6af77de0f2047d`
on `phase/32d-margin-minsize-anchor`, fingerprint
`aede7a853e745cf873b97a6d8ff3fd035c5786c55ae28c9f50906e342a9c2bcb`.
It already tracks the previous six-file Inspector handoff and completed Clear
correction. The actual initial/final identities are retained externally; no old
fingerprint is used as an acceptance constant.

The latest retained browser-capable parent `tfTYBh` passed 5,411 tests,
build/diff/label-assets, the full paint/import group and all eleven named shape
cases. It completed 15/18 cumulative groups and failed the first contour drag:
2D diamond, codim 2, aspect 1.8, exact source `drag $x_i$`, owner/revision 100.
Selection observations 0056–0060 show trusted intended contour selection and
exact state preservation across Inspector reopening. The handle center near
`(1296.4,268.975)` is covered by the reopened drawer in the failure PNG. The old
drag collector mixes selection/setup events, retains only type/trust, and is
read/removed after the movement assertion. Actual drag target/path/capture is
unproven. This diagnoses a harness preparation gap, not a demonstrated production
pointer-controller defect or failure of every 2D/3D drag.

`scripts/pointNativeDrag.mjs` owns a bounded observer before preparation. It uses
one unique real Inspector Close control if open, verifies detachment and the
closed opener, preserves exact saved/runtime JSON, selection, history, revision
and UI settings, then performs native Select/scroll. It measures connected
selected point-position handle bounds/local center/screen CTM and current hit
stack afterwards. The handle is outside `data-point-id`; selected owner, its
actual handle group/path and model name establish ownership. Pointerdown retains
its current CTM/local bounds/center/hit target. Preparation retains viewport,
scroll, camera and active work-plane controls/status.

The geometric and layout callers keep their original `(+28,-16)` and `(+22,-14)`
four-step native drags. Scoped phases distinguish setup, drag, Undo/Redo and
cleanup. Raw targets/composed paths, trust, pointer IDs/buttons/client positions,
capture transitions and post-handler capture states precede movement assertions.
Capture-phase down need not show capture before the handler. Matching captured
move/up on the owned SVG root is valid; unrelated targets/owners/pointers,
cancellation, untrusted input and unchanged coordinates fail. Event coordinates
permit only .05 CSS px browser quantization; requested coordinates and CTM-derived
geometry remain exact. This does not change PGF reference tolerances.

Both independently loaded contracts validate the raw delivery, actual selected
position delta, unchanged other data/camera, exact one bounded history commit,
and native Undo/Redo JSON/history restoration. Summary booleans cannot supply
missing records. Observations/artifact/cleanup failures remain secondary to the
first action/assertion failure; every owned observer is removed on exit, and
duplicate installation cannot remove another owner's observer.

Layout contour/body owner cycling now closes/prepares before fresh measurements
and retains actual owner events/selection/data/history. Production sorts identical
equal-distance point candidates by stable ID; a null cycle starts at index 1.
The explicitly planned first Alt action therefore asserts the overlap owner,
then the continuation asserts `app-point`, freshly measuring each action and
aborting on the first failure. The pure production ordering regression and raw
owner-cycle rejection controls document this correction; no blind retry or
production selection change is included. Shape/parameter Inspector reopening
remains native. Locked clicks also measure after Select/scroll.

The registered 64-case helper suite and extended 32C/32D policy suites are
explicitly synthetic. Existing 46 selection controls are preserved. Controls
cover inherited reopening/one close/closed no-op, stale/missing/detached/wrong
geometry and obstructions, trusted handle plus captured root continuation,
contaminated selection/fabricated flags, pointer/owner/capture/cancellation errors,
unchanged/camera-only/other-point changes, history capacity and exact Undo/Redo,
and primary-error precedence. The isolated runner fixture copies the new
transitive validator dependency; its initial missing-module failure is retained.

No model, solver, rendering, overlay behavior, saved schema, PGF input/artifact,
TikZ generation, dependency or verification profile changes. The independent
172-box / 4,925-anchor / 11-failure inventory is preserved. The diamond
outer-separation exception still needs independent PGF review. Final checks and
complete diff/inventory are retained under
`/private/tmp/stz-32d-native-drag-fix-20261009/`.

Final child checks used Homebrew-first Node v26.9.0: full `npm test` passed
5,507/5,507 with no failures/skips, combined drag/selection/ownership controls
passed 297/297 and isolated runner controls passed 37/37. The first full run's
37 missing-module fixture failures remain in `npm-test-initial.log`; the
corrected fixture copy list passed the complete rerun. Build and diff checks
passed. Ten changed scripts passed syntax; recommended script lint has no new
errors. The geometric caller's four `no-unsafe-finally` errors and unchanged
verifier's unused `_role` error reproduce from HEAD. Overall lint attempts
including that baseline debt remain failed, not lint passes.

Both required child browser commands failed at fresh owned-server `listen EPERM`
before Chrome; label-assets passed its static graph only. Free-labels retained
strict mode and zero completed groups. These startup failures are distinct from
the parent's real first diamond drag failure. Fresh handle/capture/history
observations, all eight contour interactions, full layout/anchor matrix, native
JSON/TikZ persistence, actual pending transparent/white downloads and standalone
reopening remain required in the browser-capable parent. No independent
acceptance review began. Use a fresh `32D verify` process on the exact final
dirty tree, then matching read-only review only after complete accepted evidence.
Phase 32 remains incomplete; commit/push remain with the parent workflow.

## Same-document native drag revision contract (2026-10-10)

The actual clean starting checkout is `8d0a3dab4bea1fd3baf7889ffcfdb16c4478bd20`
on `phase/32d-margin-minsize-anchor`, fingerprint
`708282ded8a7079f0add86d8f60bf67158216601e80614ece73121d19cc1c1fc`.
It already tracks the thirteen-file native-drag handoff and the updated prompt.
The actual inventory, diff and final tracked/untracked identity are captured under
`/private/tmp/stz-32d-revision-fix-20261010/`; older fingerprints are diagnostic
history, never acceptance constants.

The retained `5waNKq` parent records the first 2D diamond, codim 2, aspect 1.8,
source `drag $x_i$`, selected owner `app-point`, document epoch 100. Records
0001–0005 retain one native Inspector close, fresh handle start approximately
`(1296.4,268.975)`, original `(+28,-16)` displacement and four movement steps.
Trusted pointerdown reaches the intended selected-position handle; pointer ID 1
captures the owned canvas, receives all four moves and pointerup, then releases
capture with lostpointercapture retained. Position changes from `(3,3,0)` to
`(3.191563400173898,3.1286778583820283,0)`. Exact saved/runtime comparisons show
only that selected position changed. History equals the prior history plus one
effective bounded commit, with redo cleared; both past lengths are 100 because
capacity is full. Authoritative and observed before/after revisions are 100,
with no secondary diagnostics or page errors. Record 0004 precedes assertion;
0005 preserves the same evidence, final observation and primary revision failure.
No native Undo/Redo records exist for that failed first case.

`App.tsx` initializes this runtime document ownership epoch outside Diagram/history
and advances it only in `selectExample` and `commitLoadedJsonDiagram`. Geometry
drag sessions and Undo/Redo edit/restore the current diagram under the same epoch.
`SvgDiagram` keys its label-bound and point-commit maps by that document ownership;
source/font/request/placement changes have their existing mechanisms. No production
revision setter, schema, model, rendering, geometry or persistence behavior changed.

`pointNativeDrag.mjs` now validates nonnegative integer revisions and exact
same-document equality across preparation, movement, native Undo and native Redo.
Observed revisions still match their authoritative states; scoped native drag
events must retain the before-state epoch. Real selected-point movement, unchanged
camera/work plane/source/style/other data, exact bounded history and native delivery
checks remain. The synthetic fixture retains epoch 100 throughout instead of
fabricating 100→104→105→106. Its genuine position/history transitions and trusted
event/capture records remain explicitly synthetic, never native acceptance.

The registered helper and both parent-imported policy suites add 114 revision
regressions. They accept unchanged epochs 0/100, reject increased/decreased/missing/
null/negative/fractional/string/nonfinite revisions at each action, reject invalid
preparation epochs and observed/authoritative disagreements, and retain earlier
movement, owner, camera, multiple-commit, history, contamination, capture and
cleanup/primary-error controls. Redundant snapshots/successor states are updated
consistently so faults reach the epoch rule. Native JSON load still requires exactly
one ownership increment and reused-ID completion cannot restore an obsolete owner.
Both geometric/layout contracts, callers, runner dependency-copying/clean-tree
guards and strict cumulative policy are preserved byte-for-byte.

Focused drag/selection/ownership/policy/runner verification passed 524/524 with no
failures/skips, including all 37 runner controls. The two policy suites separately
passed 261/261. Homebrew-first Node v26.9.0 was used. Full `npm test` passed
5,621/5,621 with zero failures/skips, exit 0 (`npm-test.log`). Build (strict TypeScript), diff and eleven script syntax
checks passed; no TypeScript source changed. Recommended JavaScript lint found
zero new errors. Four geometric caller `no-unsafe-finally` errors and the verifier
unused `_role` error reproduce identically from read-only HEAD and live files;
overall lint including those baseline files remains failed.

Both required configured browser attempts failed at fresh owned-server `listen
EPERM 127.0.0.1` before Chrome launch. Label-assets passed its static graph only;
strict free-labels completed zero groups, leaving all eighteen unexecuted. These
startup artifacts identify their attempted tree before this final documentation
update and provide no native acceptance. This child restriction is separate from
the latest parent's real revision assertion. Native first-diamond Undo/Redo, all
eight original 2D/3D contour interactions, later visibility/export, complete
layout/anchor matrix, actual pending transparent/white downloads and standalone
reopening remain required from a fresh browser-capable parent verifier.

All original production files and PGF shape/anchor/paint references are preserved,
including the 172-box / 4,925-anchor / eleven-failure inventory, raw artifacts and
tolerances. The documented diamond outer-separation exception still requires
independent PGF review. No dependency, scoped/deferred 32D profile, sandbox change
or acceptance waiver was added. Fresh `32D verify` on the exact final dirty tree
must pass all five required commands and complete cumulative raw evidence before
read-only independent review of the matching checkout. No acceptance review,
commit or push occurred. Phase 32 remains incomplete.
