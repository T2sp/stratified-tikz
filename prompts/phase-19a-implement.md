# Phase 19A Implementation Prompt: Symbolic scalar expression model and evaluator

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
## Project context

You are working on the StratifiedTikZ project.

Phase 18 is complete.

The editor now supports:

- 2D and 3D diagrams;
- points, labels, curves, paths, path templates, sheets, filled regions/sheets, curved surfaces;
- custom work planes;
- camera controls;
- layer manager;
- style manager and external TikZ style references;
- standalone and inline math TikZ export modes;
- save/load;
- undo/redo;
- SVG preview;
- layer-aware TikZ output.

Phase 19 adds symbolic input and grid generation.

Core requirements:

1. Users can define variables in the toolbar.
   - TikZ output corresponds to `\pgfmathsetmacro`.
   - Invalid/dangerous inputs should be rejected before they can generate broken TikZ.

2. Coordinate inputs can accept expressions using variables and elementary functions.
   - Example:
     - variables: `R`, `q`
     - coordinate input: `(R*cos(q), R*sin(q))`
     - generated TikZ coordinate: `({\R * cos(\q)}, {\R * sin(\q)})`
   - SVG preview still needs numeric values, so expressions must be evaluated using variable preview values.

3. Add a grid-generation mode.
   - The grid should be represented compactly in TikZ using `\foreach`.
   - Range/clip controls should make grid boundaries concise.
   - In 3D, grids should be generated in a work-plane-local 2D frame when applicable.

Important conventions:

- An `n`-stratum means codimension `n`, not dimension.
- Internally all numeric preview coordinates are `Vec3`.
- In 2D, `z` is hidden/locked/ignored and should stay `0`.
- Symbolic data that affects generated TikZ should be persisted in diagram/export data, not only UI state.
- UI-only draft state should not be stored in `Diagram`.
- TikZ export must remain readable and must respect standalone vs inline math export mode.
- Inline math export must still contain no blank lines.
- Preserve Phase 9A coordinate naming and Phase 9B layer-aware output.
- Preserve camera, work-plane, layer manager, style manager, save/load, undo/redo, SVG preview, and all existing geometry behavior.


## Goal

Introduce a safe symbolic scalar expression model for coordinates and variable definitions.

This subphase should provide:

- expression data model;
- parser/validator for a limited PGFMath-like expression grammar;
- numeric evaluator for SVG preview;
- TikZ expression formatter;
- tests.

Do not add broad UI yet. Later phases will integrate variables and coordinate inputs.

## Scope

Implement:

- symbolic scalar model;
- expression parser/validator;
- expression evaluator using variable preview values;
- conversion to TikZ/PGFMath expression string;
- safe rejection of invalid/dangerous input.

Do not implement yet:

- variable toolbar UI;
- coordinate input UI changes;
- grid generation;
- full TeX parser;
- `\foreach`;
- arbitrary raw TikZ code;
- macro expansion;
- new dependencies unless strongly justified.

## Expression grammar

Support a limited expression grammar sufficient for coordinate input.

Required:

- numbers:
  - integers;
  - decimals;
  - optional signs;
- variables:
  - names such as `R`, `q`, `theta`;
- binary operators:
  - `+`;
  - `-`;
  - `*`;
  - `/`;
  - `^`;
- parentheses;
- unary plus/minus;
- elementary functions:
  - `sin`;
  - `cos`;
  - `tan`;
  - `asin`;
  - `acos`;
  - `atan`;
  - `sqrt`;
  - `abs`;
  - `exp`;
  - `ln`;
  - `log`;
  - `min`;
  - `max`;
- constants:
  - `pi`;
  - `e`.

MVP may restrict `min`/`max` if parser complexity grows, but document limitations.

Important trigonometry convention:

- PGFMath trig functions use degrees by default.
- The preview evaluator should match PGFMath/TikZ behavior for `sin`, `cos`, `tan`.
- Therefore, `cos(q)` should treat `q` as degrees, matching PGF output.

## Security / safety validation

Reject expressions containing raw TeX or dangerous commands.

Reject at least:

- backslash commands in expressions;
- `\input`;
- `\write`;
- `\read`;
- `\openout`;
- `\catcode`;
- `\csname`;
- braces `{` / `}` unless the parser intentionally supports them;
- semicolons;
- newlines;
- unmatched parentheses;
- unknown identifiers unless they are declared variables;
- invalid tokens.

Do not execute TeX.

Do not eval JavaScript.

Implement a parser or safe tokenizer/evaluator.

## Data model

Suggested:

```ts
type NumericScalar = {
  kind: "numeric";
  value: number;
};

type SymbolicScalar = {
  kind: "symbolic";
  expression: string;
  previewValue: number;
};

type ScalarInputValue = NumericScalar | SymbolicScalar;
```

Alternatively, store:

```ts
type ParsedExpression = {
  source: string;
  ast: ExpressionAst;
};
```

The exact model can differ, but it must allow:

- numeric preview evaluation;
- original expression preservation;
- TikZ expression output.

## TikZ expression output

Given variables mapped to macros:

```text
R -> \R
q -> \q
```

expression:

```text
R*cos(q)
```

should export as something like:

```tex
\R * cos(\q)
```

Coordinate export should wrap symbolic components in braces where needed:

```tex
({\R * cos(\q)}, {\R * sin(\q)})
```

Do not include braces inside the expression model itself unless the generator needs them.

## Tests

Add focused tests:

1. Numeric literal parses/evaluates.
2. `R*cos(q)` parses and evaluates with variables.
3. `R*sin(q)` evaluates with degree trig semantics.
4. Parentheses and operator precedence work.
5. Unary minus works.
6. `sqrt`, `abs`, `exp`, `ln`, `log` work if supported.
7. Unknown variable rejected.
8. Unknown function rejected.
9. Dangerous TeX command rejected.
10. Backslash rejected.
11. Newline rejected.
12. Unmatched parentheses rejected.
13. Division by zero rejected or returns invalid safely.
14. Non-finite evaluation rejected.
15. TikZ formatter maps variables to macro names.
16. TikZ formatter preserves elementary functions.

## Documentation

Document the supported expression grammar and degree-trig convention.

## Preserve existing behavior

Do not regress:

- numeric coordinate parsing;
- existing coordinate editing;
- SVG preview;
- TikZ export for numeric diagrams;
- save/load old diagrams.

## Report after implementation

Please report:

- files modified;
- expression grammar;
- parser/evaluator approach;
- degree-trig behavior;
- TikZ formatter behavior;
- safety rejection policy;
- tests added/updated;
- test results;
- build results;
- limitations.
