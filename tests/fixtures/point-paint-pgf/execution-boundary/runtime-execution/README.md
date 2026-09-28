# Runtime execution paint certainty comparison

This fixture retains the independently demonstrated invocation-time failure:

```tex
\tikzset{myPoint/.style={/utils/exec={\definecolor{red}{HTML}{0000FF}},text=red}}
```

`before/` preserves all 12 files from
`/private/tmp/stz-review-runtime-exec`, byte for byte. The only filename change
is `probe.log` to `probe.log.txt`. The original source, reproduction script,
commands, generated standalone and inline-math fragments, compiler output,
PDF, observations and actual PDF operators are included. `before-sha256.json`
records original hashes and byte lengths;
`original-evidence-verification.json` verifies the originals and retained
copies remain unchanged. Earlier execution-boundary and handler-execution
fixtures have not been rewritten.

The original external `PGF` text is blue (`0 0 1 rg`). Both original `APP`
texts are red (`1 0 0 rg`): each fragment puts
`text=stzPointpText2`, defined as `FF0000`, after the actual `myPoint` key.
The original compiler log identifies PGF 3.1.11a. The original PDF was rendered
and visually inspected before this correction.

The corrected `runtime.sty` is byte-identical to the independent source.
`generate.mjs` uses real import, preset application, resolution, explicit UI
style edits, JSON serialization/reload and TikZ generation. It asserts that
color channels remain unresolved and diagnostics remain present. It inspects
the options after the exact external key in each emitted node, allowing only
the specific recorded local edit. Untouched cases have no trailing options.
The preview fallback is deliberately not the expected external paint.

`runtime-stale.json` recreates an old red snapshot through a supported literal
import and preset application before restoring the exact runtime source. The
fixture reloads it, then separately reapplies its existing preset and reloads
again. No stale snapshot becomes evidence for an intentional user override.
Explicit edits use the UI update function's field-intent argument, including
black text and black fill equal to the visible fallback. Those edits survive
JSON reload. `production-observations.json` records retained source,
diagnostics, unresolved channels, explicit fields and post-key options.

Each corrected PDF contains an external reference followed by eight
application cases. The standalone and inline-math modes were compiled
separately against the identical source; both compiler exit codes were zero.
The actual observations are:

| Case | Text operator | Fill operator |
| --- | --- | --- |
| External reference | `0 0 1 rg` (blue) | No filled point |
| Untouched import/application | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Saved and reloaded | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Stale red snapshot reloaded | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Existing preset reapplied | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Intentional red text | `1 0 0 rg` (red) | `0 0 0 rg` (black) |
| Intentional fallback-equal text | `0 0 0 rg` (black) | `0 0 0 rg` (black) |
| Intentional yellow fill | `0 0 1 rg` (blue) | `1 1 0 rg` (yellow) |
| Intentional fallback-equal fill | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |

`commands.txt` records the actual commands and temporary compiler directory.
`versions.json` retains Node v26.9.0 and pdfTeX
3.141592653-2.6-1.40.29 (TeX Live 2026). Both `*-compilation.txt` and
`runtime-*.log.txt` retain compiler output, including PGF 3.1.11a and loaded
generated fragment filenames. `runtime-standalone.pdf` and
`runtime-inlineMath.pdf` are actual compiler PDFs, rendered and visually
inspected after generation. The black text on black fill in the intentional
black-text case is the requested explicit edit, confirmed by operators.

`extract-operators.mjs` copies the actual uncompressed page streams into
`standalone-pdf-operators.txt` and `inlineMath-pdf-operators.txt`, then asserts
the text operator at every `PGF`/`APP` glyph body and the fill operator at each
application shape. `independent-pgf-observations.json` records the 18 node
observations. Expected blue comes from the preserved independent external PGF
node. Neither this expectation nor the operator extractor uses the application
resolver. This evidence confirms a color-binding side effect; arbitrary
handler mutation is separately covered by parser regressions, not claimed as
an observation of these PDFs. TeX execution occurs only in this offline
verification fixture, never in application import or preview.

To reproduce from this directory, run `node generate.mjs`, compile each
`runtime-{standalone,inlineMath}.tex` with the commands in `commands.txt`, retain
the resulting PDFs and logs, then run `node extract-operators.mjs`. Use Node
22.12 or newer with `/opt/homebrew/bin` first in `PATH`.
