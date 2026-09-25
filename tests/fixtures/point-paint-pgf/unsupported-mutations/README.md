# Unsupported-mutation PGF comparison

The `before/` files are byte-for-byte copies of the independent review's failing
reference in `/private/tmp/stz-32b-review-append-o16tsp`: source, generated output,
PDF, compiler log, page operators and importer observations. They are retained,
not regenerated. Its source defines red fill/text then appends blue fill/text.
The external `PGF` node is blue; the old generated `APP` node incorrectly resets
both to red. The original compiler log includes PGF 3.1.11a and successful PDF
output. The original shell stdout was not supplied; no replacement is invented.

The corrected reference uses that same literal definition/append input in
`append.sty`, followed by actual current output from each TikZ mode. The fixture
generator only imports the source and generates TikZ; it does not execute TeX.
This focused, offline compilation is independent PGF evidence and is never
called by the importer or preview.

Executed from this directory, with Node v26.9.0, pdfTeX 1.40.29 / PGF 3.1.11a:

```sh
PATH=/opt/homebrew/bin:$PATH node generate.mjs
mkdir -p /private/tmp/stz-32b-detach-mutation-handoff/pgf
PATH=/opt/homebrew/bin:$PATH pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp/stz-32b-detach-mutation-handoff/pgf reference.tex > compilation.txt 2>&1
```

Compilation exited **0**. `reference.pdf` and `reference.log.txt` are the actual
compiler output. `pdf-operators.txt` is the uncompressed page stream extracted
from that PDF. `observations.json` records manually inspected effective operators:
the external node and both generated nodes now have **blue fill and blue text**,
`0 0 1 rg`, with no later red reset. The fallback red values appear before the
external key and do not override it. Both `APP` nodes retain the application's
circle and black border defaults. All three node texts are blue on blue, so the
operator evidence is necessary to confirm text color; visual inspection alone
cannot distinguish it.

`reference.png` is a Poppler rendering inspected alongside those operators.
Existing opacity, namespace and import-order references are unchanged. The
preview intentionally retains diagnosed last-known red as an approximation;
these files do not claim that the application evaluates `.append style`.
