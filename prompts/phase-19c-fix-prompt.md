# Phase 19C Fix Prompt

Repository: <https://github.com/T2sp/stratified-tikz>

Phase: 19C

Review status: `needs_changes`

Critical issues: none

Medium issues: 3

## Codex Prompt

```text
You are working in the Stratified TikZ repository.

Fix the Phase 19C review issues.

Repository:
https://github.com/T2sp/stratified-tikz

Phase:
19C

Review status:
needs_changes

Critical issues:
None.

Medium issues:
1. Numeric coordinate behavior regressed: direct/global coordinate parsing now routes through the scalar-expression parser, which does not accept scientific notation such as `1e-3`. This used to work via `Number(...)`. Repro from review:
   addPointStratumFromDirectInput(..., { x: '1e-3', y: '0', z: '0' }).ok === false

   Relevant files from review:
   - src/ui/diagramUpdates.ts around direct/global coordinate parsing
   - src/model/scalarExpressions.ts around scalar-expression parsing

2. Some accepted symbolic coordinate inputs still export preview-derived numbers instead of preserving the symbolic expression. A 2D direct arc accepts symbolic center input, but createArcPathSegmentFromAngles computes numeric start/end previews, and TikZ export emits those numeric coordinates plus arc[...] rather than the symbolic center expression. Similarly, the 3D template inspector allows symbolic centers, while 3D template export formats local numeric preview coordinates.

   Relevant files from review:
   - src/ui/diagramUpdates.ts around 2D arc input handling
   - src/model/paths.ts around createArcPathSegmentFromAngles
   - src/tikz/generateTikz.ts around path/template export
   - src/ui/inspector/CurveGeometryEditor.tsx around symbolic center/template input

3. Malformed saved symbolic coordinate metadata can throw during load instead of returning a clean parse error. parseSavedDiagramJson refreshes symbolic previews before validation, and symbolicVec3ComponentsFromPoint dereferences missing component fields.

   Relevant files from review:
   - src/model/serialization.ts around parseSavedDiagramJson
   - src/model/symbolicCoordinates.ts around symbolicVec3ComponentsFromPoint

Goal:
Fix Phase 19C regressions while preserving the intended symbolic-coordinate model:
- ordinary symbolic point/path inputs store expressions plus finite numeric previews;
- ordinary numeric coordinate behavior remains backward-compatible;
- accepted symbolic inputs must either export symbolic TikZ expressions correctly or be rejected up front for fields that are currently numeric-preview-only;
- malformed saved symbolic metadata must produce clean validation/parse failures, not runtime exceptions.

Tasks:

1. Inspect current Phase 19C symbolic coordinate implementation.

   Review at least:
   - src/model/scalarExpressions.ts
   - src/model/symbolicCoordinates.ts
   - src/model/serialization.ts
   - src/ui/diagramUpdates.ts
   - src/model/paths.ts
   - src/tikz/generateTikz.ts
   - src/ui/inspector/CurveGeometryEditor.tsx
   - tests covering symbolic coordinates, variable preview recomputation, save/load, direct coordinate input, arcs, templates, and TikZ export

2. Restore scientific-notation numeric coordinate support.

   Direct/global coordinate parsing must accept numeric literals that previously worked through Number(...), including at least:
   - 1e-3
   - 1E-3
   - 2e+4
   - -3.5e2
   - +4.2E-1
   - .5e2, if the existing numeric input path accepted `.5`
   - 5., if the existing numeric input path accepted `5.`

   Choose the smallest safe implementation consistent with the existing scalar-expression parser:
   - Either extend scalar numeric literal parsing to support scientific notation, or
   - keep a compatibility numeric-literal path for direct/global coordinate fields before falling back to symbolic expression parsing.

   Requirements:
   - Finite numeric values only.
   - Do not accept Infinity, -Infinity, NaN, or non-finite expressions.
   - Do not reintroduce eval, new Function, or raw JavaScript evaluation.
   - Preserve rejection of dangerous raw TeX / raw syntax such as backslash, braces, semicolons, and newlines.
   - Preserve PGFMath degree trig semantics and existing symbolic expression behavior.

3. Decide and enforce policy for derived/numeric-only symbolic fields.

   The review found accepted symbolic inputs that later export preview-derived numbers. That is not acceptable because accepted symbolic data should not silently lose symbolic semantics in TikZ output.

   For each affected field, choose one of these policies:

   Policy A — preserve symbolic output:
   Implement correct TikZ export that keeps the symbolic expression, not the numeric preview. Only choose this if it can be done correctly and with focused changes.

   Policy B — reject symbolic input up front:
   If the field is derived/numeric-only today and export cannot preserve symbolic expressions correctly, reject symbolic expressions in that UI/model path with a clear validation error. Numeric input must remain accepted.

   Apply this policy to at least:
   - 2D direct arc center input that goes through createArcPathSegmentFromAngles and exports numeric start/end previews plus arc[...]
   - 3D template inspector center/local-plane/template fields that currently allow symbolic input but export local numeric preview coordinates

   The safer targeted fix is Policy B unless preserving symbolic TikZ output is already supported by the architecture.

   Requirements:
   - Do not silently convert symbolic expressions to preview numbers in generated TikZ.
   - Do not accept symbolic fields whose export path is known to be numeric-preview-only.
   - Error messages should be understandable and consistent with existing validation messages.
   - Ordinary symbolic point coordinates and ordinary symbolic path coordinates that already round-trip and export symbolically must keep working.
   - Existing numeric arc/template behavior must keep working.

4. Make saved Vec3.symbolic metadata validation robust before preview refresh.

   The review found malformed saved symbolic coordinate metadata can throw during load because parseSavedDiagramJson refreshes symbolic previews before validation, and symbolicVec3ComponentsFromPoint dereferences missing component fields.

   Fix this so malformed saved symbolic metadata returns a clean parse/validation error according to the project’s existing parseSavedDiagramJson conventions.

   Requirements:
   - Do not throw uncaught TypeError/undefined-property runtime errors for malformed symbolic metadata.
   - Validate symbolic Vec3 shape before any preview refresh dereferences component fields.
   - Missing symbolic component fields must be reported as invalid saved diagram data.
   - Invalid component expression strings must be reported cleanly.
   - Non-finite preview/evaluation results must be reported cleanly.
   - Valid saved symbolic expressions must continue to load and refresh previews.
   - Old diagrams without symbolic metadata must still load.

   Prefer one clear validation/resolution path:
   - validate saved data shape first;
   - then refresh symbolic previews;
   - then return parsed diagram or clean error.

5. Add focused regression tests.

   Required tests for scientific notation:
   - direct/global point coordinate input accepts x: "1e-3", y: "0", z: "0"
   - uppercase exponent accepts "1E-3"
   - signed exponent accepts "2e+4"
   - negative scientific notation accepts "-3.5e2"
   - accepted scientific notation stores/evaluates finite numeric preview correctly
   - invalid non-finite values remain rejected, including "Infinity", "NaN", and any expression producing non-finite output

   Required tests for symbolic export policy:
   - 2D direct arc symbolic center input is either exported with symbolic expressions preserved or rejected up front; the chosen behavior must be asserted explicitly
   - export must not silently replace an accepted symbolic arc center with numeric preview-derived start/end coordinates
   - 3D template/center/local-plane symbolic input is either exported with symbolic expressions preserved or rejected up front; the chosen behavior must be asserted explicitly
   - export must not silently replace accepted symbolic 3D template/local coordinates with numeric preview-only output
   - ordinary symbolic point/path coordinate export still emits symbolic macro/expression output as before
   - ordinary numeric arc/template input still works and exports as before

   Required tests for malformed saved data:
   - parseSavedDiagramJson with Vec3.symbolic missing component metadata returns a clean error, not an uncaught throw
   - parseSavedDiagramJson with malformed symbolic component shape returns a clean error
   - parseSavedDiagramJson with invalid symbolic expression returns a clean error
   - parseSavedDiagramJson with non-finite symbolic preview/evaluation returns a clean error
   - parseSavedDiagramJson still round-trips valid symbolic Vec3 metadata
   - parseSavedDiagramJson still loads old diagrams without symbolic metadata

   Use existing test conventions and file locations. Avoid brittle snapshots unless the project already uses them for this area.

6. Keep existing correct behavior unchanged.

   Preserve all behavior that the review marked as correct:
   - symbolic point/path inputs store expressions plus finite numeric previews
   - unknown variables and non-finite previews are rejected on the main creation path
   - 2D z is normalized to numeric 0
   - variable updates recompute stored symbolic coordinate preview values for ordinary coordinates
   - save/load round-trips valid symbolic expressions
   - inline symbolic TikZ output has no blank lines
   - numeric coordinate behavior that existed before Phase 19C remains backward-compatible

7. Do not make broad unrelated changes.

   Do not rewrite the expression parser unless needed for scientific notation.
   Do not change Phase 19A/19B TeX macro safety policy except as needed to keep tests passing.
   Do not change TikZ option ordering.
   Do not change unrelated path export behavior.
   Do not silently rename variables or symbolic expressions.
   Do not introduce eval/new Function.

8. Verification commands.

   Run:

     PATH=/opt/homebrew/bin:$PATH npm test
     PATH=/opt/homebrew/bin:$PATH git diff --check
     PATH=/opt/homebrew/bin:$PATH npm run build

   If lint is available and not already covered, also run:

     PATH=/opt/homebrew/bin:$PATH npm run lint

9. Completion report.

   In the completion message, include:
   - files changed
   - how scientific notation support was restored
   - which policy was chosen for symbolic arc/template/local-plane fields: preserve-symbolic export or reject-symbolic input
   - how malformed saved symbolic metadata is validated before preview refresh
   - tests added
   - test results
   - build result
   - whether Phase 19C is ready for re-review

Completion criteria:
- Scientific notation such as 1e-3 works again for direct/global numeric coordinates.
- Non-finite numeric inputs remain rejected.
- Accepted symbolic coordinate inputs no longer export preview-derived numeric values silently.
- Numeric-only/derived fields reject symbolic input unless their export preserves symbolic expressions correctly.
- Malformed saved Vec3.symbolic metadata returns clean parse errors, not uncaught exceptions.
- Valid symbolic save/load still round-trips.
- Old diagrams without symbolic metadata still load.
- npm test passes.
- git diff --check passes.
- npm run build passes.
- No Critical or Medium issues remain for Phase 19C.
```

## Compressed Prompt

```text
Fix Phase 19C in the Stratified TikZ repository.

The review found 3 Medium issues:

1. Numeric coordinate regression: direct/global coordinate parsing now goes through the scalar-expression parser and no longer accepts scientific notation like `1e-3`, which used to work through `Number(...)`.
2. Some symbolic coordinate inputs are accepted but export preview-derived numbers. A 2D direct arc accepts symbolic center input, then createArcPathSegmentFromAngles computes numeric start/end previews and TikZ export emits those numeric coordinates plus arc[...]. Similar issue for 3D template inspector symbolic centers/local coordinates.
3. Malformed saved `Vec3.symbolic` metadata can throw during load because parseSavedDiagramJson refreshes symbolic previews before validating shape, and symbolicVec3ComponentsFromPoint dereferences missing component fields.

Tasks:
- Restore scientific-notation support for direct/global numeric coordinates: `1e-3`, `1E-3`, `2e+4`, `-3.5e2`, etc. Keep Infinity/NaN/non-finite values rejected. Do not use eval/new Function.
- For derived/numeric-only fields such as 2D direct arc centers and 3D template/local-plane fields, either preserve symbolic expressions correctly in TikZ export or reject symbolic input up front with a clear validation error. Do not silently export numeric previews for accepted symbolic input.
- Validate saved symbolic Vec3 metadata before preview refresh so malformed data returns clean parse errors instead of uncaught runtime exceptions.
- Preserve ordinary symbolic point/path behavior, valid symbolic save/load round-trips, variable preview recomputation, 2D z normalization, and no-blank-lines symbolic TikZ output.

Add tests for:
- scientific notation in direct/global coordinate input;
- non-finite numeric rejection;
- chosen symbolic arc/template policy, proving no accepted symbolic input exports preview-derived numbers silently;
- malformed saved Vec3.symbolic data returning clean errors;
- valid symbolic metadata round-trip;
- old diagrams without symbolic metadata loading successfully.

Run:
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH git diff --check
PATH=/opt/homebrew/bin:$PATH npm run build

Report files changed, policy choices, tests added, command results, and whether Phase 19C is ready for re-review.
```
