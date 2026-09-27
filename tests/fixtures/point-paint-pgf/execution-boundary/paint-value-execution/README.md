# Recognized paint-value execution comparison

The external source is the exact independent width reproduction, including its
leading `+1pt` and every control sequence:

```tex
\tikzset{myPoint/.style={line width={+1pt\relax\globalcolorstrue\definecolor{red}{HTML}{0000FF}},text=red}}
```

`before/` retains all 19 artifacts from
`/private/tmp/stz-review-paint-value-exec` with unchanged bytes. The only filename
changes append `.txt` to the two `.log` files so they remain tracked.
`before-sha256.json` records original filenames, retained filenames, byte lengths
and SHA256 hashes. `original-evidence-verification.json` confirms that both the
originals and retained copies match. The original `sha256.json`, reproduction,
source, resolver, generated fragments, commands, compiler output, PDFs and PDF
operators remain available; no earlier fixture was rewritten.

The independently compiled original `PGF` node has blue text (`0 0 1 rg`), while
both original application nodes are red (`1 0 0 rg`). The old resolver reported
`textColor: "#FF0000"`, only `lineWidth` unresolved, and no execution uncertainty.
Its width warning did not prevent a stale red override after `myPoint`.

The corrected `runtime.sty` is byte-identical to that independent source.
`model.ts` constructs examples through real production import, preset application,
recorded text/fill editing, source refresh, Undo/Redo and JSON serialization/reload.
`generate.mjs` then uses actual production resolution and both TikZ modes. Every
case retains execution uncertainty, unresolved paint, diagnostics and source
dependencies. It checks options after the actual external key and allows only
recorded local edits there. It does not execute or interpret the opaque value.

`runtime-stale.json` is an old resolved-red snapshot produced by importing a
supported literal style and applying its preset, then replacing its retained
raw source with the exact independent source. Reload and preset reapplication
must reconstruct uncertainty without inventing a local red edit. A retained
saved diagnostic survives alongside the reconstructed diagnostic. The fixture
also refreshes unedited and explicitly edited points by importing the identical
source again, preserving source order and the original reference spelling.

The separately compiled standalone and inline-math PDFs each contain an external
reference and twelve application cases. Both compiler exit codes are zero.
The actual operators agree in both modes:

| Case | Text | Fill |
| --- | --- | --- |
| External reference | `0 0 1 rg` (blue) | No filled point |
| Untouched, reloaded, stale-reloaded, preset-reapplied, refreshed, Undo | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Explicit red text | `1 0 0 rg` (red) | `0 0 0 rg` (black) |
| Explicit fallback-equal text | `0 0 0 rg` (black) | `0 0 0 rg` (black) |
| Explicit yellow fill | `0 0 1 rg` (blue) | `1 1 0 rg` (yellow) |
| Explicit fallback-equal fill | `0 0 1 rg` (blue) | `0 0 0 rg` (black) |
| Both edits after refresh or Redo | `1 0 0 rg` (red) | `1 1 0 rg` (yellow) |

Black text on black fill is the explicit fallback-equal text request. Its
precedence is confirmed by the actual operators, independently of visibility.
Untouched fill remains the effective application baseline before the external
key; it does not become a post-key local override.

`extract-operators.mjs` reads the actual uncompressed PDF page streams and checks
the color before each `PGF`/`APP` glyph body and each application fill operator.
Expected blue comes from the original independent external observation, never
from the application resolver. `independent-pgf-observations.json` records all
26 node observations. These compilations confirm only the exact width payload;
other recognized-value families are conservative parser regressions, not
independently compiled PGF behavior claims.

`commands.txt` records commands and the external compiler output directory;
`compiler-results.json` records the separate exit results. `versions.json`
retains Node v26.9.0 and pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026). The logs
record PGF 3.1.11a and every loaded fragment. `production-observations.json`
records diagnostic, unresolved-field, local-intent and post-key option evidence.
The registered `tests/tikz/importedPointPaintValueExecutionPgf.test.ts` checks
archive hashes, the original failure, byte equality between current production
output and compiled fragments, and actual operators in both PDFs.

To reproduce, use Node 22.12 or newer with `/opt/homebrew/bin` first in `PATH`,
run `node generate.mjs`, compile `runtime-standalone.tex` and
`runtime-inlineMath.tex` using the recorded commands, retain their PDFs and logs,
then run `node extract-operators.mjs`. TeX runs only in this offline fixture
workflow; the application importer, preview and registered Node tests never run it.
