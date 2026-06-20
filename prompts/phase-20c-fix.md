# Phase 20C Fix Prompt: Reject closed Coons boundary paths in helper and saved-data validation

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

## Context

You are working on the StratifiedTikZ project.

Phase 20C implemented Coons patch creation, preview, and TikZ export.

Review result:

- Tests pass.
- Build passes.
- No Critical issues.
- One Medium issue remains.

## Medium issue

Closed Coons boundary paths are rejected only in the UI click/pick workflow, but not in lower-level creation helpers or saved primitive validation.

Current behavior:

- `src/ui/ruledSurface.ts` rejects closed paths during clicking.
- But `createCoonsPatchFromBoundaryPaths(...)` can load/copy snapshots directly.
- `validateCoonsPatchPrimitive(...)` only validates corner equality.
- A persisted `coonsPatch` with a closed bottom boundary and matching degenerate corners can validate as `true`.
- This leaves an ambiguous boundary-order path into creation/save-load outside the click workflow.

Review's targeted requirement:

> Fix Phase 20C Coons patch validation so all four Coons boundary snapshots must be open paths in `validateCoonsPatchPrimitive` and `createCoonsPatchFromBoundaryPaths`, add tests for direct creation and save/load rejection of closed Coons boundaries, and keep existing pick-time behavior unchanged.

## Goal

Make Coons patch closed-boundary rejection robust at all entry points.

A Coons patch requires four open boundary paths:

```text
bottom
right
top
left
```

All four boundary snapshots must be open paths.

Closed paths must be rejected:

- during UI picking, as already implemented;
- during helper-level creation;
- during primitive validation;
- during saved JSON load/validation.

## Scope

This is a targeted Phase 20C fix.

Implement:

- open-boundary validation for all four Coons boundary snapshots;
- rejection in `createCoonsPatchFromBoundaryPaths(...)`;
- rejection in `validateCoonsPatchPrimitive(...)`;
- save/load rejection tests;
- direct helper creation rejection tests.

Do not implement:

- new surface types;
- automatic role inference from closed paths;
- accepting closed paths as Coons boundaries;
- Coons boundary splitting;
- new UI workflows;
- new geometry formulas;
- visibility/depth sorting;
- new dependencies.

Do not change:

- valid open-boundary Coons creation;
- Coons patch formula;
- Coons corner compatibility rules;
- source path copy-on-create semantics;
- ruled surface behavior unless shared helpers require safe refactoring;
- SVG/TikZ export semantics for valid Coons patches;
- save/load format for valid diagrams.

## 1. Define and centralize "open boundary" check

Add or reuse a helper to determine whether a boundary path snapshot is closed.

Suggested helpers:

```ts
isBoundaryPathClosed(boundary: BoundaryPathSnapshot, epsilon: number): boolean
isBoundaryPathOpen(boundary: BoundaryPathSnapshot, epsilon: number): boolean
```

or equivalent.

Definition:

- boundary is closed if its start endpoint and end endpoint are approximately equal within the existing geometric tolerance.
- boundary is open if start and end are both finite and not approximately equal.

Requirements:

- handles malformed boundaries safely;
- does not throw raw `TypeError`;
- works with symbolic preview coordinates;
- uses existing endpoint helpers if available;
- respects existing tolerance conventions.

If malformed endpoint data is encountered, return validation failure rather than treating it as open.

## 2. Enforce open boundaries in `validateCoonsPatchPrimitive`

Update `validateCoonsPatchPrimitive(...)` or equivalent validation logic.

Before or during corner validation, require:

```text
bottom is open
right is open
top is open
left is open
```

If any boundary is closed, validation must fail.

Error should identify the offending role when possible:

```text
Coons patch bottom boundary must be an open path.
```

or:

```text
Coons patch boundaries must be open paths; closed boundary found at bottom.
```

Requirements:
