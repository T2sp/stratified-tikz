# Phase 31F Implementation Prompt: Combined TeX-label regression coverage and completion audit

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.
This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Required verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run repository-wide lint only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Report existing lint debt separately; do not turn this subphase into unrelated
cleanup. Run any additional focused checks required below. Never report an
unavailable check as passed.

## Project context

You are working on StratifiedTikZ:

```text
https://github.com/T2sp/stratified-tikz
```

This prompt series was prepared from public `main` at commit
`1a49d02a7ade18ecf08c4b4f1e22414e740970bb`, following Phase 30.
Inspect the current checkout before making changes; named files are starting
points, not an exhaustive change list. Preserve later compatible work.

Phase 31 consists of these ordered subphases:

| Subphase | Responsibility |
| --- | --- |
| 31A | Label input grammar and exact-source fallback contract |
| 31B | MathJax-to-SVG adapter, metrics, isolated conversion, and cache |
| 31C | Free-label rendering, asynchronous lifecycle, placement, and picking |
| 31D | Path inline-node labels through the shared renderer |
| 31E | Settled-label SVG export and standalone SVG fidelity |
| 31F | Combined regression coverage, documentation, and completion audit |

Implement or review only the subphase named in this file. Later subphases are
not acceptance requirements for earlier ones. Every subphase must leave the
existing application usable and its own verification passing.

Preserve these project conventions and existing behaviors:

- strict TypeScript; avoid `any`;
- an n-stratum means codimension n, not geometric dimension;
- separate model, geometry, rendering, TikZ generation, and UI;
- small, testable helpers and behavior-level tests;
- the SVG Preview editing canvas, 2D/3D projection, pan, zoom, and work planes;
- layer filtering, visibility, locking, selection, and existing edit gestures;
- coordinate anchors/references and symbolic coordinates;
- save/load, existing history semantics, and Undo/Redo;
- human-readable TikZ, 4-space indentation, and blank-line-free inline-math output;
- transparent/white SVG export and removal of editor-only overlays.

## Phase 31 shared contract

Only user-authored visible diagram labels are typeset: free `TextLabel.text`
and path inline-node `text`. Coordinate names, axes, handles, toolbar copy,
and saved-path `pathLabel` identifiers are not TeX labels for this feature.
Do not add new visual uses of previously undisplayed stratum label metadata.

Keep the original input authoritative in the model and editor. Do not add
math delimiters, trim the saved string, change the JSON schema, or rewrite
TikZ source. Existing TikZ export-mode formatting remains unchanged. Generated
SVG, parsed runs, errors, metrics, caches, and pending requests are derived
runtime state and must never enter `Diagram` or undo history.

The bounded preview language supports ordinary Unicode text mixed with
`$...$`, `\(...\)`, `$$...$$`, and `\[...\]` math runs. The exact scanner and
escaped-literal rules are defined in Phase 31A. MathJax is a math typesetter,
not a full LaTeX engine. Arbitrary packages, document preambles, external
style-file macros, and unsupported text-mode commands are outside this phase;
an unsupported label falls back to its complete original source.

For an invalid delimiter, unsupported construct, undefined math command,
TeX parse error, output error, resource failure, or bounded-work failure:

```text
failed label -> latest original input, displayed literally in full
```

Never show an error SVG, a replacement message, a partly typeset label, or a
previous successful formula in place of a failed current label. Preserve
delimiters, backslashes, leading/trailing/repeated spaces, tabs, and physical
newlines in literal fallback. Insert original input as text, never HTML.
The failure of one label must not suppress other labels or diagram geometry.
Pending labels also show their latest source until their own result is ready.

Successful output uses SVG geometry plus ordinary SVG text for text runs;
avoid `foreignObject` and rasterized formulas. Keep geometry self-contained,
colors explicit, and dimensions finite. MathJax-generated markup is not a
license to insert arbitrary user HTML or SVG.

Each label's rendering, bounds, and picking must describe the same input
revision. No stale completion may resurrect a deleted label or overwrite a
newer input, document, selection, or style state. Moving the camera or label
must not recompile unchanged TeX.

## Goal

Verify the complete Phase 31 user workflow, document its supported preview
language and fallback behavior, and determine whether the phase is complete.

This is regression hardening and documentation. Do not introduce a new TeX
engine, syntax extension, preference panel, data migration, or rendering feature.
Fix defects discovered in the accepted 31A-31E contract with focused changes.

## Prerequisites and scope

- Complete and review Phase 31A through Phase 31E first.
- Read each pair from `prompts/phase-31a-implement.md` /
  `prompts/phase-31a-review.md` through `prompts/phase-31e-implement.md` /
  `prompts/phase-31e-review.md`, plus recorded review findings.
- Confirm the integrated application uses the shared production parser,
  MathJax adapter, renderer, bounds/picking, and settled export path.
- Close contract-level gaps, add missing combined tests, and update docs.
- Preserve existing layout, editing gestures, model/TikZ semantics, and the
  unsupported-feature boundary stated in the shared contract.

## Inspect first

```text
src/App.tsx
src/rendering/SvgDiagram.tsx
src/rendering/svgHitTesting.ts
src/ui/svgPreviewExport.ts
Phase 31A-31E helpers and focused tests
tests/integration/
tests/rendering/
tests/ui/
tests/model/serialization.test.ts
tests/tikz/generateTikz.test.ts
package.json
docs/PREVIEW_UI.md
docs/SPEC.md
docs/ROADMAP.md
```

Reuse focused tests that already establish an invariant. Add combined coverage
where independently passing components could still disagree in the application.
Do not duplicate every unit test or rely on brittle implementation snapshots.

## Combined acceptance matrix

Create small, readable fixtures spanning both free and path inline-node labels.
Use the exact Phase 31A grammar and escaping rules. Cover these cases:

| Area | Representative acceptance cases |
| --- | --- |
| Plain input | Empty text, spaces only, ordinary text, Japanese/Unicode |
| Supported math | Each supported delimiter form, fractions, scripts, roots |
| Mixed input | Several text/math runs with a shared baseline; text newlines form label lines, math-source newlines stay inside their math run |
| Invalid input | Missing/mismatched delimiter, malformed TeX, undefined command |
| Unsupported input | Text-mode commands, arbitrary packages/macros outside scope |
| Literal fallback | Complete original input, repeated spaces, tabs, newlines, markup-like text |
| Resource failure | Initialization/font/resource failure, finite fallback, later retry |
| Editing races | Rapid A→B→C edits, success→failure→success, out-of-order completion |
| Lifecycle | Delete, load another diagram, unmount, Undo/Redo during pending work |
| Cache | Duplicate labels, shared conversion, cache isolation, eviction/retry |
| Work bounds | Long/deep/expensive or disallowed input reaches bounded fallback |
| Placement | Nine free-label anchors; five path placements; multiline bounds |
| Interaction | Free-label picking; path text pass-through; Alt-click node marker |
| View | 2D/3D, pan, zoom, camera changes, occlusion and visible dimming |
| Visibility | Hidden/locked/filtered layers and excluded editor labels |
| Styling | Scale, color/`currentColor`, opacity, path white outline |
| Export | Settled click-time snapshot, both backgrounds, standalone reopen |
| Persistence | Unchanged JSON/schema, history behavior, and generated TikZ |

Do not treat this as a mandatory Cartesian product. Select combinations that
exercise interactions and record which fixture establishes each acceptance row.

## End-to-end editing scenarios

Add combined runtime tests for at least these workflows:

1. Create mixed free/path labels, typeset them, change style and placement, then
   select/drag using the actual rendered bounds or existing marker gestures.
2. Edit a valid formula into invalid input, verify the whole latest source is
   visible, and repair it. Assert both the visual result and picking bounds
   track the same revision throughout.
3. Resolve controlled conversion requests out of order while editing, deleting,
   loading a new diagram, and using Undo/Redo. No obsolete result may reappear.
4. Pan/zoom/change the 3D camera with unchanged input. Placement changes correctly
   without recompiling the same TeX or invalidating unrelated label state.
5. Show repeated formulas in multiple labels, change one, and remove another.
   Shared cache work must not leak per-label color, placement, or lifecycle state.
6. Fail the conversion resource, reach literal fallback in finite time, and retry
   after recovery. Normal geometry and other labels remain usable.
7. Export while conversions are pending, then edit labels/geometry/view. The file
   consistently represents the click-time snapshot; the live preview stays usable.
8. Save/load and Undo/Redo after success, failure, and export. Derived markup,
   metrics, caches, requests, and errors never appear in persisted/history data.

Exercise real production entry points. Use deferred test adapters only where
needed to control timing; include real MathJax success/error tests as well.
Source-code grep, mocked success objects, or screenshots alone cannot establish
the conversion, revision, persistence, or export contracts.

## Layout and browser acceptance

Use a real browser to inspect fractions, tall scripts, multiple text/math runs,
Japanese text, blank/whitespace cases, and full literal fallback in 2D and 3D.

- Check all nine free-label anchors against their reference position.
- Check the five existing path placements and the unchanged white outline.
- Check click/selection bounds after pending→success and success→failure changes.
- Check path text retains `pointerEvents="none"` and Alt-click selects the
  existing inline-node marker, without introducing a new text hit target.
- Check layer filtering, hidden/dimmed geometry, style scale/opacity, pan/zoom,
  and camera movement with no visible stale result or clipping regression.
- Check accessible source/label naming follows the shared component behavior;
  do not add a duplicate screen-reader formula/text announcement.
- Download and reopen SVG files outside the application for both backgrounds,
  mixed success/failure labels, outlines, literal newlines, and local references.

Record representative fixtures, browser/version, and observed results. Keep
screenshots or saved SVG artifacts where useful to make findings reproducible.

## Persistence and TikZ invariants

Use representative existing and new diagrams to verify:

- label strings are identical before/after preview conversion and SVG export;
- save/load round-trips contain no new derived state or schema changes;
- undo history records user edits according to current project policy only;
- standalone and inline-math TikZ output is unchanged for identical diagrams;
- TikZ indentation remains four spaces and inline output contains no blank lines;
- coordinate identifiers, axes, guides, handles, and undisplayed metadata have
  not acquired formula rendering or altered export meaning.

Compare actual serialized/generated results, not only function names or imports.

## Documentation

Update the following existing documents without claiming full LaTeX support:

1. `docs/PREVIEW_UI.md`: entering mixed text/math, successful typeset display,
   exact-source fallback while pending/on failure, placement/picking behavior,
   and click-time settled SVG export with transparent/white backgrounds.
2. `docs/SPEC.md`: the bounded delimiter/escape grammar, Unicode/text behavior,
   supported MathJax configuration, resource/work limits, unsupported constructs,
   isolated label failures, revision consistency, and runtime-only derived state.
3. `docs/ROADMAP.md`: Phase 31A-31F responsibilities and accurate completion
   status, including any remaining verification blocker.

Include useful examples: ordinary text, a valid formula, mixed prose/formula,
and an invalid formula whose entire source is displayed. Preserve backslashes
in Markdown examples. Explain that external TikZ styles/preambles do not grant
the preview access to arbitrary macros or LaTeX packages.

Document the actual chosen limits and tested subset, rather than promising
unbounded input, every TeX command, exact TeX-engine typography, or offline
availability beyond what the packaged resources establish.

## Verification and completion gate

Register every new Node test file in the explicit `package.json` test list and
run the required test/build/diff checks plus focused runtime/browser checks.
Record test counts/results and distinguish new failures from proven baseline
issues. Do not count a skipped or unavailable check as a successful check.

Phase 31 is complete only when A-E contracts hold together, required regression
and browser/export checks have evidence, and the documentation matches observed
behavior. If required checks cannot run, retain their completion gate and give
a concrete follow-up to run them; do not silently waive them or mark the roadmap
complete. Keep unrelated feature requests outside this phase.

## Report after implementation

Report files changed; combined fixtures/tests added and registered; defects found
and corrected; acceptance-matrix coverage; real adapter/browser/export evidence;
JSON/TikZ invariants; documentation updates; required command results; known
limits; and any checks that still prevent calling Phase 31 complete.
