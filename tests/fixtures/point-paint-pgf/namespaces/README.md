# Independent PGF namespace and alias evidence

Compiled on 2026-09-24 using PGF **3.1.11a** (2025-08-29), pdfTeX
**3.141592653-2.6-1.40.29**, TeX Live 2026. These sources invoke PGF directly;
they do not call the application's import resolver. The earlier ten-row
`../ordered-paint` opacity/color-order evidence is unchanged.

Commands executed from the repository root:

```sh
mkdir -p /private/tmp/stz-point-paint-namespaces
PATH=/opt/homebrew/bin:$PATH pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp/stz-point-paint-namespaces tests/fixtures/point-paint-pgf/namespaces/reference.tex > tests/fixtures/point-paint-pgf/namespaces/compilation.txt
PATH=/opt/homebrew/bin:$PATH pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp/stz-point-paint-namespaces tests/fixtures/point-paint-pgf/namespaces/missing-root.tex > tests/fixtures/point-paint-pgf/namespaces/missing-root-compilation.txt
PATH=/opt/homebrew/bin:$PATH pdftoppm -singlefile -scale-to 1000 -png tests/fixtures/point-paint-pgf/namespaces/reference.pdf tests/fixtures/point-paint-pgf/namespaces/reference
```

`reference.tex` compilation exited **0**. `reference.pdf` is the actual generated
PDF, `reference.png` its rendered page, `reference.log.txt` the compiler's full
log, and `pdf-operators.txt` the uncompressed page content stream. PDF compression
is disabled in the source; the content stream was extracted directly from the
PDF bytes. `observations.json` records manually inspected RGB operators and the
matching colored letter bodies, independent of the resolver under test:

| Body | Text RGB | Contract |
| --- | --- | --- |
| A | red (`1 0 0 rg`) | `ns/outer` expands bare `base` from runtime `/tikz`, despite blue `ns/base` |
| B | green (`0 1 0 rg`) | Explicit `ns/inner` nested expansion still uses runtime `/tikz/base` |
| C | blue (`0 0 1 rg`) | Later `/tikz/base` replaces earlier `base` |
| D | green | Later `base` replaces earlier `/tikz/base` |
| E, F | green | `base(red), /tikz/base(blue), base(green)` agrees for both invocation aliases |
| G | green | Reverse repeated alias overwrite ends with `/tikz/base(green)` |
| H | red | Root `base` remains distinct from `/other/base` and relative `tikz/base` |
| I | blue | Explicit `/other/base` invokes its own definition |
| J | green | Relative `tikz/base` refers to `/tikz/tikz/base` |
| K | red | Nested explicit `/tikz/base` inside `/other/outer` retains its meaning |

`missing-root.tex` compilation exited **1**, intentionally. This is successful
negative evidence, not a failed positive fixture: the full actual diagnostic in
`missing-root-compilation.txt` and `missing-root.log.txt` says
`I do not know the key '/tikz/base'`. PGF does not fall back to the existing
`/tikz/ns/base`. With `-halt-on-error`, no missing-root PDF is expected.

The registered `pointPaintImport.test.ts` reads these observations, checks all
eleven imported results and the retained negative diagnostic, and separately
checks alias-aware recursion/work termination without compiling recursive PGF.
Runtime `.cd` in style bodies is explicitly unsupported by the preview and is
not claimed as a verified supported operation by this fixture.
