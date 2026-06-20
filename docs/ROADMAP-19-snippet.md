# ROADMAP update snippet for Phase 19

Add or replace the Phase 19 section with the following.

## Phase 19: Symbolic input and grid generation

Phase 19 adds PGFMath-style symbolic variables, symbolic coordinate expressions, and compact grid generation using `\foreach` and `\clip`.

Recommended `phaseSlugs` entries:

```js
"19A": "symbolic-expression-model",
"19B": "variable-manager-pgfmathsetmacro",
"19C": "symbolic-coordinate-input",
"19D": "symbolic-tikz-export-integration",
"19E": "grid-generation-model-preview",
"19F": "grid-foreach-clip-export",
"19G": "symbolic-grid-polish",
```

### Phase 19A: Symbolic scalar expression model and evaluator

- Add limited PGFMath-like expression grammar.
- Support variables, arithmetic, elementary functions, and degree-based trig.
- Provide numeric preview evaluation and TikZ expression formatting.
- Reject unsafe/raw TeX input.

### Phase 19B: Variable Manager and `\pgfmathsetmacro` export

- Add toolbar Variable Manager.
- Variables export as `\pgfmathsetmacro`.
- Validate macro names, expressions, duplicates, and cycles.
- Support save/load.

### Phase 19C: Symbolic coordinate input

- Allow coordinate fields to accept expressions such as `R*cos(q)`.
- SVG uses numeric preview values.
- TikZ exports symbolic components such as `{\R * cos(\q)}`.
- Integrate with Inspector and direct creation.

### Phase 19D: Symbolic TikZ export integration

- Harden export across element kinds.
- Ensure variables are emitted before use.
- Preserve standalone/inline export modes.

### Phase 19E: Grid generation data model and SVG preview

- Add grid objects with range/step/clip controls.
- Support 2D grids and 3D work-plane-local grids.
- Render preview with line count limits.

### Phase 19F: Grid TikZ export using `\foreach` and `\clip`

- Export grids compactly using `\foreach`.
- Use rectangular clip ranges.
- Use `canvas is plane` for 3D work-plane-local grids.

### Phase 19G: Symbolic input and grid polish

- Add docs, examples, error messages, and combined regression tests.
