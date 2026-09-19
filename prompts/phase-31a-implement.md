# Phase 31A Implementation Prompt: Label input grammar and exact-source fallback contract

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

## Prerequisites and scope

This is the first Phase 31 subphase. Read the existing Phase 30 fix/review
contract when necessary to preserve current behavior, but do not reopen Phase
30 implementation work.

Deliver the pure input parser, typed result contracts, focused tests, and the
Phase 31 roadmap. This subphase must not add MathJax, alter production label
appearance, or implement later rendering/export work.

## Goal

Define one explicit, testable interpretation of a user-authored label while
retaining the exact original string for every failure path.

The existing model stores labels as raw text, and the editor does not
automatically add math delimiters. Preserve that contract. A renderer must
never decide that every label, or every string containing a backslash, is a
single math expression.

## Required reading before implementation

Inspect at least:

- `AGENTS.md`;
- `docs/SPEC.md`, especially Free text labels;
- `docs/DATA_MODEL.md`, especially `TextLabel` and path inline nodes;
- `docs/PREVIEW_UI.md`;
- `docs/TIKZ_OUTPUT.md`, especially label content escaping;
- `docs/ROADMAP.md`;
- `src/model/types.ts`;
- `src/model/pathInlineNodes.ts`;
- `src/rendering/SvgDiagram.tsx`;
- `src/rendering/svgPathInlineNodes.ts`;
- `src/tikz/generateTikz.ts`;
- existing label examples and serialization/TikZ tests;
- `package.json`, including its explicit test-file list.

The current free-label and path inline-node drawing paths are distinct. Both
will use this contract, but coordinate/axis/handle captions and `pathLabel`
saved-path names are not part of it.

## Pure parser and result contract

Add a small module such as `src/rendering/labelText.ts`. Suggested concepts:

```ts
type LabelRun =
    | { kind: 'text'; sourceStart: number; sourceEnd: number; text: string }
    | {
          kind: 'math'; sourceStart: number; sourceEnd: number;
          tex: string; display: boolean
      }

type ParsedLabel =
    | { kind: 'parsed'; source: string; runs: readonly LabelRun[] }
    | {
          kind: 'fallback'; source: string;
          reason: 'invalid-delimiter' | 'unsupported-text' | 'limit'
      }
```

These are conceptual types, not mandatory names or formatting. Keep strict
typing, readonly results, and a discriminated success/fallback result.
Document offsets as JavaScript string offsets so slices reproduce source
exactly, including Unicode. Do not reconstruct fallback from parsed/cooked
runs. The original `source` is always the fallback authority.

The parser must not depend on React, the DOM, MathJax, saved diagram state, or
a mutable global configuration. Full TeX validity belongs to Phase 31B.

## Supported input grammar

Use the following initial, bounded preview contract:

1. Ordinary Unicode text, including Japanese, stays ordinary SVG text.
2. `$...$` and `\(...\)` create inline math runs.
3. `$$...$$` and `\[...\]` create display-style math runs. Display style changes
   math layout; it does not implicitly create a new label or paragraph.
4. Actual newlines in ordinary text separate visual label lines. Inside a math
   run, preserve newlines in the TeX body and let MathJax interpret them; do not
   split a formula or matrix at each physical source newline. In literal
   fallback every source newline is a visual line break. CRLF may be one visual
   line break without rewriting the authoritative `source`.
5. Outside math, recognize only these TeX literal escapes as supported text:
   `\$`, `\%`, `\&`, `\_`, `\#`, `\{`, and `\}`. A successful text run displays
   the corresponding literal character. Keep original slices for fallback.
6. Other text-mode TeX commands, including `\textbf{...}`, document commands,
   and TeX `\\` line-break commands outside math, produce whole-label
   `unsupported-text` fallback. They are not sent to HTML or wrapped in math.
7. Inside math, retain the body exactly, excluding only the outer delimiters.
   Standard `\text{...}` within math is a Phase 31B MathJax concern.
8. A missing, mismatched, or stray math delimiter produces whole-label fallback.
9. Ordinary `<`, `>`, `&`, quotes, braces, and percent characters are text;
   this parser is not an HTML parser or a full text-mode TeX validator.
10. Empty input is a valid empty label; never manufacture an error placeholder.

Implement a small scanner with explicit state, not a split-on-dollar regex.
Respect escaped delimiters and brace nesting inside math. A delimiter-looking
sequence inside an escaped token or nested text argument must not prematurely
end the outer math run. Malformed nesting may safely lead to whole-label
fallback; do not repair the user's TeX or silently render only a prefix.

Document the deterministic precedence of display and inline dollar delimiters
when entering math. Cover adjacent runs and escaped-backslash cases. Establish
finite source-length/run-count limits as named constants with documented
values; exceeding them returns the complete source rather than truncating it.
Use linear scanning and do not evaluate or expand macros here.

## Error and preservation semantics

The following examples are acceptance cases:

| Input | Parser result |
| --- | --- |
| `Region A` | One ordinary text run |
| `$F^{(1)}L$` | One inline math run with body `F^{(1)}L` |
| `Map $\alpha \colon f \Rightarrow g$` | Text plus one math run |
| `\(x_i\)` | Inline math |
| `\[\frac{1}{2}\]` | Display-style math |
| `Cost \$5` | Text displaying `Cost $5` |
| `prefix $x` | Entire original string as fallback |
| `prefix \textbf{A} $x$` | Entire original string as fallback |
| `$\unknowncommand{x}$` | Parsed math; Phase 31B determines TeX failure |

Whitespace, delimiters, and backslashes must survive fallback even when an
earlier run was successfully parsed. Do not trim before validation and do not
mutate `label.text`, inline-node `text`, Inspector drafts, or serialization.

No success/failure field is added to `Diagram` or the saved file version.
Do not change the existing TikZ label formatter, including its established
inline-math newline formatting.

## Tests

Add a focused file such as `tests/rendering/labelText.test.ts` and register it
in the explicit `npm test` script. Test behavior, not source-code substrings.

At minimum cover:

1. Plain ASCII, Japanese, emoji, empty input, and whitespace-only input.
2. Every supported delimiter and the correct `display` value.
3. Text before, between, and after multiple math runs; adjacent runs.
4. All supported text escapes, escaped delimiters, and backslash parity cases.
5. Braced math and `\text{...}` containing delimiter-looking characters;
   physical newlines inside math are retained in the same math run.
6. Unclosed/mismatched delimiters, stray closers, and malformed brace nesting.
7. Unsupported text-mode commands return the complete original string.
8. Unknown math commands are retained for the adapter to validate.
9. Leading/trailing/repeated spaces, tabs, LF, and CRLF survive fallback exactly.
10. `<script>`, `<svg onload=...>`, ampersands, and quotes remain text data.
11. Source slices and Unicode offsets are internally consistent.
12. Named input/run limits return untruncated fallback in bounded work.
13. Parsing does not mutate input diagram fixtures or alter JSON/TikZ output.

## Documentation

Add a planned Phase 31 entry to `docs/ROADMAP.md` with 31A through 31F in order.
Mark only completed work as implemented. Document the supported grammar,
literal escape policy, whole-label fallback, and the separation between raw
storage and preview-only interpretation in `docs/PREVIEW_UI.md` or an
appropriately linked label-preview specification.

Any runner `phaseSlugs` registration is optional orchestration metadata: inspect
the current runner before editing it, keep its existing schema, and do not
start automated runs as part of implementing this subphase.

## Report after implementation

Report files modified, parser contract, delimiter/escape decisions, configured
limits, preservation evidence, test registration, focused/full test results,
build/diff-check results, and what remains for 31B. Do not claim that labels
are typeset in the production UI yet.
