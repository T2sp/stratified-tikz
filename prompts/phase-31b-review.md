# Phase 31B Review Prompt: MathJax SVG conversion, isolated state, metrics, and cache

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

## Review goal and prerequisite

Read `prompts/phase-31b-implement.md` and the completed Phase 31A contract.

Review the Phase 31B adapter after Phase 31A. It must deliver isolated,
bounded, portable SVG/text results with metrics or the exact original label.
The existing canvas may still show source text; Phase 31C introduces the
production renderer. Do not request that deferred integration as a fix here.

## Review checklist

### 1. Dependencies and real deployment

Check pinned MathJax/font package versions and lockfile consistency. Confirm
the dependency rationale, lazy shared initialization, documented package APIs,
and deterministic development/build asset handling. Inspect actual built
resource URLs at the configured `/stratified-tikz/` base, including additional
font data, with no implicit external fallback. A build that silently depends
on a CDN or loses required dynamic resources is Medium.

### 2. Complete-label result and error detection

Follow the public adapter with real installed MathJax. Check parser failures,
unknown commands, malformed TeX, error hooks, resolved `merror` output, invalid
metrics, and load/output failures. Disable error-masking extensions. Any run
failure must return the exact entire original source with all whitespace and
delimiters, with no successful earlier run, error SVG, or rewritten text.
Wrong fallback or ignored compile/output failure is Medium.

### 3. Isolation and lifecycle

Convert labels in both orders and concurrently. Verify macro, numbering,
reference, and error state do not cross requests. Inspect full transaction
isolation, not only counter resets. Test initialization rejection, timeout,
controlled retry, and completion after generation replacement. A permanently
poisoned service, hanging future requests, or cross-label state leak is Medium;
unbounded expansion that makes the application unusable may be Critical.

### 4. Metrics and immutability

Check explicit units, baseline, finite width/ascent/descent, negative viewBox
origins, display flags, fraction/radical/matrix extents, and single application
of scaling. Text measurement must preserve 31A whitespace and identify font
inputs/readiness. Results must be reusable immutable values rather than shared
live DOM. Wrong dimensions, clipped geometry, or hidden whitespace loss is
Medium. Defer actual free-label hit testing and anchoring to Phase 31C.

### 5. Portable and constrained SVG

Inspect generated geometry without the application stylesheet or class/data
attributes. Require internal glyph references, resolved paint/stroke effects,
safe repeated insertion, and an explicit narrow output allowlist. Check text
escaping and rejection of scripts, event handlers, foreignObject, arbitrary
HTML, URL-bearing commands, external href/paint references, and unapproved
extensions. Executable injected content is Critical; lost glyphs/styles or
cross-label ID collisions are Medium. Full export waiting is deferred to 31E.

### 6. Cache and limits

Check exact-source/configuration/font identities, request coalescing, bounded
pending/completed storage, eviction, immutable reuse, and transient failure
retry policy. Distinguish geometry, layout, and paint invalidation. Position,
camera, selection, and pan/zoom must not force TeX conversion. Incorrect cache
reuse, unbounded growth, permanent transient-failure caching, or render-loop
retry behavior is Medium.

### 7. Tests and scope

Require behavior tests through the production adapter using actual MathJax,
with controlled fakes only where needed for resource/timing errors. Check the
implementation prompt's fixtures and explicit `npm test` registration. A mock
renderer that always returns success cannot establish the fallback contract.
Missing core real-engine error, isolation, metrics, or asset-path coverage is
Medium. Confirm no model schema/history changes and no premature renderer or
export lifecycle rewrite. Persistent derived data is Medium or Critical if it
corrupts save/load.

## Focused verification and completion gate

Run the adapter's focused tests, the Environment checks, and applicable
targeted lint. Reproduce at least one real valid conversion and one complete
mixed-label fallback. Check deployed assets under the configured base and
record observed requests or equivalent deterministic deployment evidence.
Report limitations explicitly; do not describe inspection as a browser test.

Read updated documentation for supported extensions, package/asset decisions,
baseline/units, limits, cache keys, and retry. It must say production canvas
integration remains deferred. A minor documentation omission may be Low;
incorrect grammar/fallback or deployment guidance is Medium.

Use the shared review reporting format. This subphase is complete only when
its adapter contract and required checks pass and no Critical or Medium issue
remains. Do not require Phase 31C-31F acceptance criteria prematurely.
