# Phase 11 — Implementation Instructions

You are implementing **Phase 11** of the 3D Stratified Diagram GUI project.

This phase is expected to be comparatively mechanical. Keep the changes small, local, and faithful to the existing architecture. Do not introduce a redesign unless the current implementation makes the requested Phase 11 behavior impossible.

## Goals

1. Implement the Phase 11 requirements described in the repository's phase specification, roadmap, TODO list, or automation metadata.
2. Preserve all behavior already completed in Phases 1–10D.
3. Keep the implementation monotone with respect to the established ordering conventions:
   - preserve codimension ordering where the project already relies on it;
   - do not introduce ad hoc same-layer reordering unless explicitly required by the Phase 11 specification;
   - avoid changing rendering semantics that were intentionally left unchanged in Phase 9B/9C.
4. Add or update tests that exercise the Phase 11 behavior.
5. Keep exported output deterministic.

## Required Process

Before editing code:

1. Inspect the repository structure.
2. Identify the authoritative Phase 11 specification.
3. Identify the files most likely affected by Phase 11.
4. Summarize the intended implementation plan briefly in the implementation log or final response.

During implementation:

1. Make the smallest coherent change that satisfies Phase 11.
2. Reuse existing abstractions rather than introducing parallel logic.
3. Prefer pure functions for ordering, normalization, export, and serialization logic.
4. Keep UI state, domain model state, and export logic separated where the existing project already separates them.
5. Do not silently change existing public APIs unless necessary; if necessary, update all call sites and tests.
6. Preserve TypeScript strictness and avoid `any` unless an existing pattern requires it.

## Rendering / Export Constraints

If Phase 11 touches TikZ or PGF layer output:

1. Declare generated PGF layers before the first `tikzpicture` that uses them.
2. Ensure every layer used by `pgfonlayer` is included in `\pgfsetlayers`.
3. Include `main` in the layer list.
4. Keep layer names deterministic and TeX-safe.
5. Avoid creating unnecessary layers when a sorted drawing order is sufficient.
6. Do not assume a hard PGF layer-count limit, but avoid generating excessive layers from accidental duplication.

If Phase 11 touches geometric or stratification ordering:

1. Preserve the existing codimension-first or depth-first convention used by the project.
2. Do not reorder elements merely because they are of different element kinds unless the specification requires it.
3. Add regression tests for ordering-sensitive cases.

## Testing

Run the relevant checks available in the repository. Prefer the existing commands in `package.json`.

At minimum, try:

```bash
npm install
npm run typecheck
npm test
npm run build
```

If the repository does not define one of these scripts, note that explicitly and run the closest available alternative.

Also run the phase automation command if available:

```bash
PATH=/opt/homebrew/bin:$PATH node scripts/automation/run-phase.mjs 11
```

## Acceptance Criteria

Phase 11 is complete only if:

1. The Phase 11 behavior is implemented according to the repository specification.
2. Existing Phase 1–10D behavior is preserved.
3. Relevant tests pass.
4. The project builds without new TypeScript or lint errors.
5. Generated or exported output remains deterministic.
6. The final response clearly lists:
   - files changed;
   - tests run;
   - any tests not run and why;
   - any known limitations.

## Non-goals

Do not:

1. rewrite unrelated rendering or export systems;
2. change codimension ordering policy merely for aesthetic same-layer ordering;
3. introduce broad refactors unrelated to Phase 11;
4. add new dependencies unless the Phase 11 specification clearly requires them;
5. modify generated artifacts unless they are part of the expected Phase 11 output.
