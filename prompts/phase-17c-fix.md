# Phase 17C Fix Prompt: Preserve absolute TikZ key paths in imported style references

## Environment

The default shell may use Node v16.17.0 at `/usr/local/bin/node`.

This project requires Node >=22.12.0.

Use:

```bash
PATH=/opt/homebrew/bin:$PATH
```

Verification:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Also run if available:

```bash
git diff --check
```

## Context

You are working on the StratifiedTikZ project.

Phase 17C implemented a limited `\tikzset` parser for style import.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Absolute TikZ paths are normalized into relative-looking keys.

This breaks common imports such as:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

and:

```tex
\tikzset{/tikz/wire/.style={draw=red}}
```

Current behavior:

- The parser strips the leading slash in `src/model/importedTikzStyles.ts`.
- Generated TikZ later emits `reference.key` literally in `src/tikz/generateTikz.ts`.
- For:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

the imported key becomes:

```text
tikz/wire
```

But in a TikZ option list, this is not equivalent to the original absolute `/tikz` key path.

Correct emitted option key should be one of:

```text
wire
```

or:

```text
/tikz/wire
```

depending on the chosen policy.

It should not be emitted as:

```text
tikz/wire
```

because that is a different relative key path.

## Goal

Fix the limited `\tikzset` parser so absolute TikZ key paths are preserved or mapped correctly for emitted option keys.

Generated/imported keys must be usable directly as TikZ command options.

Add regression tests for:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

and:

```tex
\tikzset{/tikz/wire/.style={draw=red}}
```

ensuring imported/emitted keys are usable and are not emitted as `tikz/wire`.

## Scope

This is a targeted Phase 17C fix.

Implement:

- correct absolute TikZ key path handling in the parser;
- correct emitted option key behavior;
- tests for `/tikz/.cd` and `/tikz/name/.style`;
- preservation of existing relative key behavior.

Do not implement:

- full TeX parser;
- macro expansion;
- `\input` resolution;
- `\foreach`;
- symbolic TikZ expressions;
- inlining imported `\tikzset`;
- active `\input` output;
- broad Style Manager UI redesign;
- new dependencies.

Do not change:

- external load comment policy;
- Phase 17A local `tikzpicture` option style policy;
- user preset behavior;
- imported style storage beyond what is needed for key correctness;
- SVG preview behavior except where imported key display needs correction.

## Required design decision

Choose one clear policy for imported absolute `/tikz` key paths.

Preferred policy:

### Policy A: Preserve absolute keys

- `/tikz/wire/.style={...}` imports as key:

```text
/tikz/wire
```

- `/tikz/.cd, wire/.style={...}` imports as key:

```text
/tikz/wire
```

- Generated TikZ command option uses:

```tex
\draw[/tikz/wire] ...
```

This is explicit and robust.

Alternative acceptable policy:

### Policy B: Collapse `/tikz` root to normal TikZ option key

- `/tikz/wire/.style={...}` imports as emitted option key:

```text
wire
```

- `/tikz/.cd, wire/.style={...}` imports as emitted option key:

```text
wire
```

- Generated TikZ command option uses:

```tex
\draw[wire] ...
```

This matches common TikZ usage because `/tikz` is the default path in TikZ option lists.

If choosing Policy B, preserve the original absolute key separately for display/debugging if useful.

Do not choose a policy that emits:

```text
tikz/wire
```

for an absolute `/tikz` style.

## Recommended implementation model

It may be useful to distinguish:

```ts
type ImportedTikzStyle = {
  key: string;              // emitted option key, e.g. "/tikz/wire" or "wire"
  originalKey?: string;     // original parsed full key, e.g. "/tikz/wire"
  options: string;
  sourceName: string;
};
```

or:

```ts
type ImportedTikzStyle = {
  emittedOptionKey: string;
  originalTikzKey: string;
  options: string;
  sourceName: string;
};
```

Exact shape can differ.

Requirements:

- emitted option key is safe to place directly in `\draw[...]`, `\filldraw[...]`, or `\node[...]`;
- original absolute key information is not accidentally lost if needed;
- display labels remain clear.

## Parser behavior requirements

### `/tikz/.cd`

For:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

Expected result under Policy A:

```text
original key: /tikz/wire
emitted key: /tikz/wire
```

Expected result under Policy B:

```text
original key: /tikz/wire
emitted key: wire
```

Never:

```text
tikz/wire
```

### `/tikz/wire/.style`

For:

```tex
\tikzset{/tikz/wire/.style={draw=red}}
```

Expected result under Policy A:

```text
original key: /tikz/wire
emitted key: /tikz/wire
```

Expected result under Policy B:

```text
original key: /tikz/wire
emitted key: wire
```

Never:

```text
tikz/wire
```

### Non-`/tikz` absolute paths

For other absolute paths, such as:

```tex
\tikzset{/3cat/.cd, phys/1strata/color/x/.style={red!60}}
```

or:

```tex
\tikzset{/3cat/phys/1strata/color/x/.style={red!60}}
```

Preserve absolute path behavior correctly.

Recommended:

- keep emitted key as `/3cat/phys/1strata/color/x`;
- do not strip leading slash;
- do not emit `3cat/phys/...` if that would change TikZ path semantics.

However, if the existing project intentionally uses relative `3cat/phys/...` keys and tests depend on that, be careful. The key requirement is that absolute paths should not be silently converted into a different relative path.

### Relative `.cd`

For existing relative style files such as:

```tex
\tikzset{
  3cat/.cd,
    phys/1strata/color/x/.style={red!60, opacity=.4}
}
```

Preserve existing behavior unless it is clearly wrong.

If previous behavior imported this as:

```text
3cat/phys/1strata/color/x
```

that may remain acceptable because the `.cd` path was relative, not absolute.

## Generated TikZ behavior

Generated TikZ should continue to:

- include external load comments;
- not inline full `\tikzset`;
- not emit active `\input` by default.

When an imported style is applied, generated command options should use the corrected emitted key.

Examples under Policy A:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before the picture:
% - mygeometry.sty
\begin{tikzpicture}
  \draw[/tikz/wire] ...
\end{tikzpicture}
```

Examples under Policy B:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before the picture:
% - mygeometry.sty
\begin{tikzpicture}
  \draw[wire] ...
\end{tikzpicture}
```

Either is acceptable for `/tikz` as long as it is consistent and tested.

Do not emit:

```tex
\draw[tikz/wire] ...
```

for styles defined under `/tikz`.

## UI/display behavior

Imported style labels should remain understandable.

If preserving absolute keys:

```text
/tikz/wire
```

is acceptable.

If collapsing `/tikz` to `wire`, consider displaying:

```text
wire  (from /tikz/wire)
```

or similar if easy.

Do not let display labels become misleading.

## Tests

Add focused tests.

Required parser tests:

1. Parse:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

Assert:

- extracted style exists;
- original key represents `/tikz/wire`;
- emitted option key is either `wire` or `/tikz/wire`;
- emitted option key is not `tikz/wire`.

2. Parse:

```tex
\tikzset{/tikz/wire/.style={draw=red}}
```

Assert same expectations.

3. Parse a relative `.cd` example:

```tex
\tikzset{3cat/.cd, phys/1strata/color/x/.style={red!60}}
```

Assert existing expected behavior is preserved.

4. Parse a non-`/tikz` absolute path if supported:

```tex
\tikzset{/3cat/.cd, phys/1strata/color/x/.style={red!60}}
```

Assert the leading slash is preserved or mapped intentionally, not silently converted into a wrong relative key.

Required export tests:

5. Apply imported `/tikz/.cd, wire/.style={...}` style to a curve.

Assert generated TikZ command uses:

```text
wire
```

or:

```text
/tikz/wire
```

and not:

```text
tikz/wire
```

6. Apply imported `/tikz/wire/.style={...}` style to a curve.

Assert same.

7. Generated TikZ still includes external load comments.

8. Generated TikZ still does not inline full `\tikzset`.

9. Generated TikZ still does not emit active `\input` by default.

Regression tests:

10. Existing parser tests still pass:
    - simple `key/.style`;
    - multiple blocks;
    - multiline bodies;
    - nested braces;
    - comments;
    - duplicate keys;
    - unsupported entries with warnings.

11. Phase 17A local user presets still export inside `\begin{tikzpicture}[...]`.

12. Phase 17B imported style references still save/load.

## Avoid over-normalization

Do not use a blanket rule such as:

```ts
key.replace(/^\\//, "")
```

or equivalent if it changes TikZ semantics.

Instead, normalize with awareness of:

- absolute path;
- relative path;
- `.cd` context;
- `/tikz` default path;
- emitted option key.

## Documentation/comments

Update comments near the parser to document:

- absolute TikZ paths preserve their leading slash unless specifically mapped to a known safe emitted key;
- `/tikz` root has special behavior in TikZ option lists;
- `tikz/wire` is not equivalent to `/tikz/wire`.

Update docs only if user-visible import behavior changed.

## Preserve existing behavior

Do not regress:

- import UI;
- parser support for simple styles;
- external source metadata;
- imported style references;
- external load comments;
- no inline `\tikzset`;
- no active `\input`;
- color/style auto-detection if already implemented;
- SVG preview;
- TikZ export for existing imported styles;
- save/load.

## Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

Import a style file containing:

```tex
\tikzset{/tikz/.cd, wire/.style={draw=red}}
```

Then verify:

1. Style imports successfully.
2. Style is shown with a sensible key/label.
3. Apply it to a curve.
4. Generated TikZ uses `wire` or `/tikz/wire`.
5. Generated TikZ does not use `tikz/wire`.
6. Generated TikZ includes external load comment.
7. Generated TikZ does not inline `\tikzset`.

Repeat with:

```tex
\tikzset{/tikz/wire/.style={draw=red}}
```

Also verify an existing relative `.cd` import still behaves as before.

## Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## Report after implementation

Please report:

- files modified;
- chosen absolute key policy;
- how `/tikz/.cd` is handled;
- how `/tikz/name/.style` is handled;
- how non-`/tikz` absolute paths are handled;
- how emitted option keys are stored/generated;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
