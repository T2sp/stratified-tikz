# StratifiedTikZ

StratifiedTikZ is a browser editor for drawing stratified diagrams used in
graphical calculus for higher categories. It supports 2D and 3D diagrams,
layer-aware editing, style-aware TikZ export, symbolic coordinates, and compact
grid export.

## Development

This project currently requires a recent Node toolchain. On machines where the
default shell resolves Node 16, use Homebrew Node first:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
```

Useful commands:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
PATH=/opt/homebrew/bin:$PATH npm run generate:tikz-examples
git diff --check
```

## Phase automation

Run the phase runner from this repository in a normal Terminal or CI environment
that permits localhost servers and Chrome/Chromium:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31C fix
```

The runner checks out the phase branch, invokes Codex, and runs verification in
the **parent Node process** before review. Child Codex sessions keep their
`workspace-write` sandbox. The review receives the saved verification report,
logs, browser evidence, and checkout identity, so it can review actual browser
results without attempting the same commands inside its restricted sandbox.
Normal implement/fix runs require a clean working tree and commit/push only
after verification and review pass. If review changes the tested checkout,
the runner stops instead of committing a stale result.

Every phase runs `npm test`, `npm run build`, and `git diff --check`.
Required browser checks run after the build:

| Phase | Browser checks |
| --- | --- |
| 31B | `check:label-assets` (built assets, Worker recovery, SVG containment) |
| 31C–31F | `check:label-assets`, then `check:free-labels` (development fixtures using the production renderer and App) |

Use `verify` to check the current checkout, including pending changes, without
invoking Codex, switching branches, committing, or pushing:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31C verify
```

No browser dependencies are installed automatically. The runner uses explicit
`STZ_PLAYWRIGHT_MODULE` and `STZ_BROWSER_EXECUTABLE` settings when provided.
Otherwise it looks for local Playwright or the existing Codex runtime's
Playwright installation, and uses installed Google Chrome on macOS when
available (or Playwright's bundled Chromium). For another setup:

```bash
STZ_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
STZ_BROWSER_EXECUTABLE=/absolute/path/to/chromium \
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 31B verify
```

Each run prints a fresh temporary artifact directory containing
`verification.json`, command logs/exit statuses, checkout identity, and separate
browser artifacts. The runner supplies its own artifact directories and clears
`STZ_BROWSER_BASE_URL` so the free-label check starts a server for the tested
checkout. Keep the artifacts when sharing a failed run.

A missing browser tool, nonzero command exit (including the adapter smoke's
exit 2), missing/incomplete browser evidence, or a source change during
verification stops the run. Static asset success alone is insufficient.
Starting the runner inside an already restricted outer sandbox still inherits
that restriction; it must run in a permitted host environment. Genuine browser
assertion failures also remain failures and require their own targeted fix.

## Documentation

- [Specification](docs/SPEC.md)
- [Data model](docs/DATA_MODEL.md)
- [TikZ output](docs/TIKZ_OUTPUT.md)
- [Coordinate anchors](docs/COORDINATE_ANCHORS.md)
- [Ruled surfaces](docs/RULED_SURFACES.md)
- [Symbolic input and grids](docs/SYMBOLIC_INPUT_AND_GRIDS.md)
- [Editing fundamentals](docs/EDITING.md)
- [Layer manager](docs/LAYER_MANAGER.md)
- [Preview UI](docs/PREVIEW_UI.md)
