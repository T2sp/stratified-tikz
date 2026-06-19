# ROADMAP update snippet for Phase 17

Add or replace the Phase 17 section with the following.

## Phase 17: Style Manager and TikZ style import

Phase 17 makes Inspector Style presets user-editable and adds support for referencing external TikZ styles.

Important export policy:

- User-created structured presets inside StratifiedTikZ are emitted as local style definitions in `\begin{tikzpicture}` options.
- Imported external `\tikzset` definitions are **not** inlined into generated TikZ.
- Generated TikZ only includes comments instructing the user to load the external style file.
- Imported style keys may be used in `\draw`, `\filldraw`, and `\node` options.

Recommended `phaseSlugs` entries:

```js
"17A": "user-editable-style-presets",
"17B": "external-tikz-style-references",
"17C": "tikzset-style-import-parser",
"17D": "imported-style-autodetect-preview",
"17E": "custom-tikz-style-export",
"17F": "style-manager-polish",
```

### Phase 17A: User-editable structured style presets

- Add user-created presets for curves, sheets, points, labels, and regions.
- Built-in presets remain available.
- User presets can be created, renamed, edited, deleted, and applied.
- In TikZ output, these user preset styles are defined inside `\begin{tikzpicture}[...]`.

### Phase 17B: Imported TikZ style references and external load comments

- Add model for external style files and imported style keys.
- Commands can reference imported keys.
- Generated TikZ adds comments telling the user which external style file to load.
- Do not inline `\tikzset`.
- Do not emit active `\input` by default.

### Phase 17C: Limited `\tikzset` parser for style import

- Parse simple `.sty` / `.tex` files containing `\tikzset`.
- Support `.cd` prefixes and `key/.style={...}`.
- Skip unsupported TeX constructs safely.
- Store extracted style keys/options as imported style references.

### Phase 17D: Auto-detect color/style presets and SVG preview approximation

- Detect likely color and shape presets from imported style keys/options.
- Add detected presets to Inspector Style preset lists.
- Approximate simple color/opacity/line-style options in SVG preview.
- Preserve imported TikZ keys for export.

### Phase 17E: Apply custom/imported styles to `draw`, `filldraw`, and `node` output

- Apply local user presets and imported style keys to relevant TikZ commands.
- Support curves, sheets, regions, points, labels, paths, and surfaces where applicable.
- Preserve layer-aware output and coordinate naming.

### Phase 17F: Style Manager polish, docs, and regression hardening

- Polish UI for built-in/user/imported preset groups.
- Add error/status messages.
- Add combined workflow tests.
- Document import/export limitations.
- Keep imported preset lists scrollable/filterable, show imported source/load
  hints, allow target tag edits, and warn that SVG preview is approximate.
