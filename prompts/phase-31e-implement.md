# Phase 31E Implementation Prompt: Settled-label SVG export and standalone SVG fidelity

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

Export one consistent snapshot of the current diagram with settled TeX labels.
Every successful label must appear typeset in the downloaded SVG; every failed
label must contain its complete captured source as literal text.

## Prerequisites and scope

- Complete and review Phase 31A through Phase 31D first.
- Read `prompts/phase-31a-implement.md` through
  `prompts/phase-31d-implement.md` and their paired review findings.
- Reuse their parser, adapter, finite-work policy, renderer, and measured layout.
- Implement export preparation, snapshot consistency, serialization, and download.
- Preserve the current export action, filename policy, MIME type, background
  choices, and editor-only exclusion rules.
- Leave the final combined acceptance audit and complete documentation to 31F;
  add this subphase's focused tests and export documentation now.

## Inspect first

Start with:

```text
src/App.tsx: exportSvgPreview and Export SVG controls
src/ui/svgPreviewExport.ts
src/ui/fileTransfer.ts
src/rendering/SvgDiagram.tsx
Phase 31A-31D label conversion, rendering, and request state
tests/ui/svgPreviewExport.test.ts
package.json
docs/PREVIEW_UI.md
```

The existing application synchronously clones the live SVG. Its sanitizer
removes classes and `aria-*`, `data-*`, and event attributes. Merely awaiting
conversion promises before cloning that SVG can still capture pending source
text, because the corresponding React update may not have committed.

## Snapshot policy

Use this explicit policy for every export click:

1. Capture the current diagram, camera/view, viewport, layer visibility/filter,
   export background choice, and render revision into a stable export request.
2. Identify exactly the user-authored labels represented in that captured view.
3. Settle conversion for all of those labels using their captured source and
   relevant style/configuration revision.
4. Produce a detached SVG snapshot with those results and literal fallbacks.
5. Sanitize and serialize that completed snapshot, then start the download.

Capture before the first asynchronous suspension. Keep the captured data stable;
do not retain mutable references whose contents can change during conversion.
Reuse the existing projection, visibility, ordering, and rendering semantics.

Later text edits, style changes, camera moves, layer toggles, document loads,
Undo/Redo, or deletions must not mix new geometry with old label results in the
pending export. The requested file represents the captured click-time view.
A subsequent export captures a new view.

Never freeze editing, mutate the live preview, temporarily replace its labels,
or change its current selection to prepare a file. A detached render must use
the same shared label layout and visual styling as the preview.

## Settling and failure handling

- Include both free labels and visible path inline-node text.
- Do not wait for labels removed by the captured visibility/occlusion policy,
  undisplayed metadata, or editor-only overlays that export will exclude.
- A settled result is either validated typeset output or complete literal source.
- Pending conversion is not a third state in the serialized file.
- Reuse valid results from the 31B cache; settle remaining work under its limits.
- Every export request must finish or fail in finite time. Apply bounded waiting
  to resource loading and outstanding conversion, respecting the adapter's
  bounded-work design rather than relying solely on a UI timer.
- Undefined commands, parse/output errors, unsupported input, exhausted work
  limits, and unavailable resources produce that label's full captured source.
- A transient resource failure must not poison future successful exports.
- One failed label must not cancel other labels or suppress geometry.
- An infrastructure failure that prevents creation of a valid SVG returns a
  clear export failure, with no malformed download and no live-view mutation.

Do not inspect only rejected promises: use the adapter's explicit success or
failure contract. Never export MathJax diagnostic SVG or a partial formula.

## Render readiness and lifecycle

Build the snapshot directly from the settled results, or use an explicit
detached-render completion signal before serialization. Promise resolution alone
is insufficient evidence that a React tree represents those results.

Use request identity/revision checks for completion, status updates, and cleanup.
An obsolete callback must not download a second file, overwrite another request's
status, or update an unmounted component. Dispose temporary roots, nodes, and
download object URLs according to their lifecycle.

Define duplicate-click behavior. One pending export at a time is acceptable:
disable or ignore repeated export clicks while keeping ordinary editing usable.
Expose pending status accessibly and restore the action on success or failure.
Do not report success before preparation and the download handoff have succeeded.

## Standalone SVG requirements

Preserve the existing sanitization boundary and editor-only exclusions.
Consume any internal label markers before the sanitizer removes metadata.

- Formulas must remain SVG geometry, with no `foreignObject` or bitmap output.
- Keep necessary paths, transforms, baseline placement, view boxes, and clipping.
- Preserve ordinary Unicode text and the multiline fallback layout from 31C/31D.
- Preserve explicit label colors, opacity, scale, and path-label white outlines.
- Resolve `currentColor` and essential styles within the exported SVG; do not
  depend on application classes, inherited page CSS, or outside DOM elements.
- Use self-contained formula paths and local definitions only. If local fragment
  references are used, every target must exist with collision-free identifiers.
- Do not refer to MathJax's page-global font cache, remote font files, scripts,
  external stylesheet resources, or runtime font loading for formula geometry.
- Escape raw `<`, `>`, `&`, quotes, and backslashes as text as appropriate to XML;
  reopening the SVG must recover the original visible characters, not markup.
- Retain whitespace-preserving text layout after metadata/class removal.
- Preserve the existing `viewBox`, dimensions, camera projection, and draw order.

Keep transparent mode free of the gray editor background and an added background
rectangle. White mode must contain exactly one white rectangle behind the diagram
covering the captured export view. Preserve current exclusion of handles, cursor
guides, selection/hover/cycling feedback, and other editor-only nodes.

## Focused tests

Add behavior-level tests and register every new Node test file in the explicit
`package.json` test list. Cover:

1. Export while several free/path labels are pending waits for settled output.
2. A conversion promise resolves before render commit; export still contains the
   represented typeset result, never the old live-DOM pending label.
3. A normal label, successful formula, malformed formula, and resource-failed
   formula coexist; only the two failures use their complete original source.
4. Change text, style, view, visibility, or load a document during preparation;
   the first file remains entirely from its captured revision.
5. A second completed export reflects those later changes.
6. Hidden/excluded labels are not awaited; dimmed labels that remain visible
   retain their captured opacity and are settled normally.
7. Duplicate clicks produce the documented result and never duplicate downloads.
8. Resource timeout, adapter failure, and serialization failure settle controls
   and status correctly; a later retry can succeed.
9. Unmount/cancellation ignores stale callbacks and releases temporary resources.
10. Formula geometry, Unicode text, failed literal markup, spaces, tabs, and
    multiline fallback survive sanitization and XML serialization.
11. Multiple repeated formulas do not create broken/colliding local references.
12. Colors, white outlines, anchors, and 2D/3D placement survive class removal.
13. Transparent and white exports preserve all existing exclusion/background
    assertions and never mutate the live SVG.
14. No conversion/cache/export state enters JSON, Undo/Redo, or generated TikZ.

Use controllable deferred conversions to exercise races deterministically, plus
real adapter coverage for successful formulas and actual compilation failures.
Do not substitute source-text pattern assertions for async/runtime behavior.

## Browser verification

In a real browser, export representative mixed free/path labels in both
background modes, download the files, and reopen them as standalone SVGs outside
the application. Verify formula geometry, colors, multiline literal fallback,
white outlines, backgrounds, and absence of editor overlays. Include one 3D view
and an edit made while export preparation is pending.

Record the browser and observed results. If this check cannot run, report it as
unavailable and leave the standalone-fidelity acceptance gate unresolved.

## Documentation and implementation report

Update the SVG-export section of `docs/PREVIEW_UI.md` for click-time snapshots,
pending status, typeset labels, literal fallback, and the duplicate-click policy.

Report files changed; the snapshot and render-readiness mechanism; finite waiting
and retry behavior; serialization/style/reference handling; focused tests added
and registered; required verification results; browser save/reopen results; and
any unresolved acceptance checks. Do not imply full LaTeX-engine compatibility.
