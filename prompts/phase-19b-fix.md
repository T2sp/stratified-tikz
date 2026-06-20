You are working in the Stratified TikZ repository.

Fix the Phase 19B review issue.

Repository:
https://github.com/T2sp/stratified-tikz

Phase:
19B

Review status:
needs_changes

Critical issues:
None.

Medium issue:
Variable macro names can collide with TikZ/PGF/LaTeX commands and generate broken TikZ.

The review found that src/model/variables.ts allows letter-only scalar-safe variable names such as "draw", and src/tikz/generateTikz.ts maps the variable macro name directly to \${macroName}. This can emit output such as:

  \pgfmathsetmacro{\draw}{2}

That can redefine or break later TikZ commands. Similar problematic names include "node", "coordinate", "path", "filldraw", and other commands used by TikZ/PGF/LaTeX or by this project’s generated output.

Goal:
Tighten Phase 19B variable macro validation so user-defined variables cannot emit TeX control sequences that collide with TikZ/PGF/LaTeX commands or commands used by generated output.

Tasks:

1. Inspect the current variable model and validation flow.

   Start with:
   - src/model/variables.ts
   - src/tikz/generateTikz.ts
   - any scalar expression / formatter validation helpers introduced in Phase 19A
   - save/load or diagram parsing code for persisted variables
   - UI code that adds/edits variables and displays validation errors
   - tests related to variables, save/load, and TikZ generation

2. Add or extend a shared macro-name safety helper.

   Prefer one central helper rather than duplicating denylist logic.

   The helper should answer whether a candidate variable macro name is safe for use in generated TeX as:

     \pgfmathsetmacro{\<macroName>}{...}

   It must reject dangerous/reserved TeX names and TikZ/PGF/LaTeX command collisions.

   If Phase 19A already introduced a dangerous TeX command validator, reuse or extend it. Do not create two inconsistent validators.

3. Reject at least the following macro names.

   TikZ/PGF/LaTeX/generated-output collisions:

   - draw
   - fill
   - filldraw
   - node
   - coordinate
   - path
   - clip
   - foreach
   - begin
   - end
   - pgfmathsetmacro
   - pgfmathparse
   - pgfmathresult
   - tikzset
   - tikzpicture

   Also ensure the Phase 19A dangerous TeX names remain rejected, including at least:

   - def
   - let
   - newcommand
   - renewcommand
   - providecommand
   - include
   - includeonly
   - input
   - usepackage
   - shipout
   - special
   - immediate
   - openin
   - closein
   - openout
   - closeout
   - write
   - write18
   - read
   - catcode

   It is acceptable to include a broader conservative reserved-name set if the tests document the intended policy.

4. Apply the same validation to both implicit and explicit macro names.

   The validation must cover:

   - variable.name when macroName is omitted and the export macro is derived from name
   - variable.macroName when macroName is explicitly provided
   - duplicate macro-name validation
   - UI add/edit validation
   - persisted diagram variable validation during load/import
   - TikZ export generation as a defensive final guard

   Use the same normalization rules already used by duplicate macro-name checks. If existing variable names are case-sensitive, preserve that behavior, but still reject exact lowercase collisions such as "draw". If the project already normalizes names case-insensitively, apply the reserved-name check after the same normalization.

5. Keep valid variable behavior unchanged.

   Do not break ordinary variables such as:

   - r
   - theta
   - scale
   - height
   - radius
   - alpha
   - beta
   - myVar
   - xOne

   unless one of these is already intentionally reserved by the existing project rules.

   Existing supported behavior should remain intact:

   - variables are persisted on Diagram as export-affecting data
   - variables save/load round-trip
   - old diagrams without variables still load
   - duplicate variable names are rejected
   - duplicate macro names are rejected
   - invalid expressions are rejected
   - dependency cycles are rejected
   - non-finite preview values are rejected
   - raw backslashes/braces/semicolons/newlines in expression input are rejected
   - standalone export emits \pgfmathsetmacro before \begin{tikzpicture}
   - inline export emits variables inside tikzpicture before coordinates
   - no-blank-lines invariant remains preserved

6. Add regression tests.

   Add or update tests proving that reserved names are rejected at the model/validation level.

   Required model validation cases:

   - name: "draw" is rejected
   - name: "node" is rejected
   - name: "coordinate" is rejected
   - name: "path" is rejected
   - name: "filldraw" is rejected
   - name: "clip" is rejected
   - name: "foreach" is rejected
   - name: "pgfmathsetmacro" is rejected
   - name: "tikzset" is rejected
   - name: "begin" is rejected
   - name: "end" is rejected

   Required explicit macroName cases:

   - variable name is otherwise valid, but macroName: "draw" is rejected
   - variable name is otherwise valid, but macroName: "node" is rejected
   - variable name is otherwise valid, but macroName: "pgfmathsetmacro" is rejected

   Required save/load cases:

   - a persisted diagram containing a variable whose implicit macro name is "draw" is rejected or marked invalid according to the project’s existing load-validation conventions
   - a persisted diagram containing a variable with explicit macroName "draw" is rejected or marked invalid according to the project’s existing load-validation conventions
   - old diagrams without variables still load

   Required TikZ export cases:

   - exporting a diagram must not produce \pgfmathsetmacro{\draw}{...}
   - exporting a diagram must not produce \pgfmathsetmacro{\node}{...}
   - a valid variable still exports correctly, for example \pgfmathsetmacro{\radius}{2}

   Required UI validation cases, if the repository has suitable UI tests:

   - attempting to add or edit a variable named "draw" displays a validation error
   - attempting to set explicit macroName "draw" displays a validation error
   - the error message is understandable and consistent with existing validation messages

7. Keep export generation fail-closed.

   Even though invalid names should be caught earlier, src/tikz/generateTikz.ts should not silently emit an unsafe macro if invalid data reaches it.

   Use the project’s existing error-handling style:
   - throw a clear error,
   - return a validation failure,
   - or otherwise block export consistently with existing invalid diagram behavior.

   Do not silently rename variables during export, because that could change diagram semantics and make saved data misleading.

8. Do not change unrelated behavior.

   Do not rewrite the variable manager.
   Do not change expression parsing semantics.
   Do not change numeric coordinate behavior.
   Do not change TikZ option ordering.
   Do not introduce new variable syntax.
   Do not introduce automatic macro prefixing unless the existing architecture already supports it and tests are updated intentionally.

9. Run verification commands.

   Run:

     PATH=/opt/homebrew/bin:$PATH npm test
     git diff --check
     PATH=/opt/homebrew/bin:$PATH npm run build

   If lint is available and not already included, also run:

     PATH=/opt/homebrew/bin:$PATH npm run lint

10. Report results.

   In the completion message, include:

   - files changed
   - validators/helpers added or modified
   - reserved-name policy implemented
   - tests added
   - test command results
   - build result
   - whether Phase 19B is ready for re-review

Completion criteria:

- Variable name "draw" is no longer accepted as an implicit export macro.
- Explicit macroName "draw" is no longer accepted.
- TikZ/PGF/LaTeX command collisions listed above are rejected.
- Phase 19A dangerous TeX command names remain rejected.
- Existing valid variables still work.
- Existing save/load behavior for old diagrams without variables still works.
- Export cannot emit \pgfmathsetmacro{\draw}{...}, \pgfmathsetmacro{\node}{...}, or similar reserved command macros.
- npm test passes.
- git diff --check passes.
- npm run build passes.
- No Critical or Medium issues remain for Phase 19B.