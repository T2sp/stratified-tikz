# Phase 31E Review Prompt: Settled-label SVG export and standalone SVG fidelity

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

## Review instructions

Review this subphase only, against its paired implementation prompt and the
shared contract above. Check the actual production paths and the tests that
exercise them. Do not require deferred subphases to be implemented early.

Do not modify files.

Run the required verification in Environment and the focused checks below.
Report actual command results and distinguish observed behavior from code
inspection. If a browser check is unavailable, state that explicitly.

At the end, output:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and
   `REVIEW_JSON_END`.

Use:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
...

**Build Results**
...

**Ready To Call This Subphase Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
...
```

Then emit one valid JSON object using the existing keys:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Replace the summary placeholder with exactly `pass` or `needs_changes`.
Set `ready_to_commit` to `false` if any Critical or Medium issue remains.
Do not claim readiness when required verification is unavailable or fails
without a demonstrated unrelated baseline explanation. Explain that limitation
and include it in the targeted follow-up.

For every finding, provide a concrete trigger, observed or code-supported
consequence, and file/line reference. Keep speculative improvements separate
from acceptance failures. Do not repeat the implementation report as evidence.

## Scope and prerequisites

Review Phase 31E against `prompts/phase-31e-implement.md`, assuming 31A-31D are
complete. Read their contracts where needed; do not demand the final 31F audit
or unrelated feature additions in this subphase.

Inspect the actual export button handler, request preparation, detached rendering,
serializer/sanitizer, download path, and focused tests. Establish which objects
are captured at the click and which asynchronous callbacks can still run later.

## Snapshot and settlement checklist

- Capture occurs before asynchronous work and includes diagram, view, viewport,
  visibility/filter state, background choice, style/configuration, and revision.
- Captured data cannot mutate through later live-state references.
- The file's geometry and labels belong to that same captured revision.
- Free labels and path inline-node text both settle before serialization.
- Only labels represented in the captured exported view are awaited.
- Success and full-source fallback are the only serialized label states.
- Actual represented output is ready; waiting for promises followed by a clone
  of an uncommitted live React tree is not accepted.
- Export uses a detached snapshot and leaves editing, selection, and the live
  SVG untouched throughout preparation.
- One failing label does not remove other labels or diagram geometry.
- Resource failures and bounded-work failures settle finitely and allow retry.
- Invalid SVG preparation/serialization produces a clear failure, not a broken
  download or a false success status.
- Duplicate-click behavior is explicit, accessible, and implemented consistently.
- Stale/unmounted callbacks cannot update status or trigger duplicate downloads.
- Temporary roots, nodes, and object URLs are disposed correctly.

## Standalone SVG checklist

- Typeset formulas remain self-contained SVG geometry.
- No outside MathJax cache, page CSS, script, remote font, or stylesheet is needed
  to display formula geometry.
- Local reference targets exist and identifiers do not collide across labels.
- Required paths, clipping, transforms, dimensions, and draw order remain valid.
- `currentColor`, essential styles, opacity, and white outlines survive removal
  of classes and metadata.
- Raw failure source remains literal and complete after XML parsing, including
  delimiters, backslashes, markup-like text, spaces, tabs, and physical newlines.
- Transparent and white background semantics remain unchanged.
- Handles, guides, selection, hover/cycling feedback, and other editor overlays
  remain excluded without accidentally removing genuine label geometry.
- JSON, history, and TikZ output remain unaffected by export preparation.

## Required evidence

Run the required test/build/diff checks and focused export tests. Confirm that
new test files are present in `package.json`'s actual test invocation.

Require runtime evidence for:

1. Pending labels at click time, including delayed React commit.
2. Edits/view changes/document replacement during preparation.
3. Mixed successes, parse failures, and resource failures in one export.
4. Timeout/retry, duplicate clicks, and unmount/stale-completion behavior.
5. Both backgrounds, sanitization, and live-DOM non-mutation.

Check the real-browser download and standalone reopen results for free/path
labels, Unicode text, multiline raw fallback, outlines, color, and a 3D view.
An in-app screenshot or inspection of serialized substrings alone cannot prove
standalone fidelity. Distinguish those checks in the review report.

## Issue classification

Critical issues include unsafe interpretation of user source as executable
markup or export preparation corrupting authoritative diagram/history data.

Medium issues include mixed snapshot revisions, pending/raw successful formulas
caused by early cloning, lost fallback characters, external glyph dependencies,
missing outlines/colors, unbounded pending exports, duplicate downloads,
live-view mutation, broken background/exclusion behavior, or unregistered tests.

A required browser/runtime check that is unavailable remains an unresolved
acceptance gate; report it and give a targeted verification follow-up. Do not
silently mark this subphase complete on source inspection alone.

Low-priority issues are cosmetic or documentation polish that does not change
the defined export result. Keep unrelated pre-existing failures separate and
support any claimed baseline explanation with evidence.
