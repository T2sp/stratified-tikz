# Phase 29 Review Prompt: Live-linked Coons patch boundary synchronization

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
git diff --check
```

Optional, only if the repository is already lint-clean:

```bash
PATH=/opt/homebrew/bin:$PATH npm run lint
```

Do not treat lint as a required gate while repository-wide pre-existing lint debt remains.

## Project context

You are reviewing Phase 29 in the current StratifiedTikZ repository:

```text
https://github.com/T2sp/stratified-tikz
```

Read before reviewing:

- `AGENTS.md`;
- `prompts/phase-29-implement.md`;
- `docs/ROADMAP.md`;
- `docs/RULED_SURFACES.md`;
- `docs/DATA_MODEL.md`, where applicable;
- the model, geometry, UI, undo/redo, serialization, duplication, SVG, TikZ, and test files changed by Phase 29.

Search for every exhaustive `coonsPatch` branch. Do not assume the obvious files are the only relevant change sites.

Phase 29 should add optional live-linked source boundaries to Coons patches while preserving the current materialized-snapshot architecture:

```ts
type CoonsPatchPrimitive = {
  kind: 'coonsPatch'
  bottom: CoonsBoundarySnapshot
  right: CoonsBoundarySnapshot
  top: CoonsBoundarySnapshot
  left: CoonsBoundarySnapshot
  boundarySources?: CoonsPatchBoundarySources
  sampling: SurfaceSampling
}
```

Names may follow repository conventions, but the semantics are required:

- the four snapshots remain the geometry used by sampling, Preview, SVG export, and TikZ export;
- optional source metadata identifies each `bottom` / `right` / `top` / `left` path or point source;
- path source metadata retains the role-specific `reversed` flag;
- missing metadata means a static, snapshot-only Coons patch;
- legacy patches must not be auto-linked from snapshot IDs;
- ruled surfaces remain snapshot-only in Phase 29.

Preserve existing behavior unless Phase 29 explicitly changes it, including:

- the current Coons formula and sampling limits;
- coordinate anchors, coordinate references, and symbolic coordinates;
- work-plane-local coordinates;
- path templates and concatenated paths;
- layers and bulk operations;
- save/load and undo/redo;
- SVG Preview and SVG export;
- standalone and inline-math TikZ export;
- 4-space TikZ indentation;
- inline-math output containing no blank lines.

## Review instructions

Review Phase 29 only.

Do not modify files.

Review the actual implementation and tests rather than relying on the implementation report.

Inspect staged, unstaged, and committed Phase 29 changes as applicable:

```bash
git status --short
git diff --stat
git diff
git diff --cached --stat
git diff --cached
git log --oneline --decorate -8
```

If the working tree is clean, identify and review the Phase 29 commit range against its base.

For every issue:

- cite the relevant file and line or symbol;
- explain the concrete failure mode;
- distinguish verified behavior from speculation;
- mention the relevant test coverage or missing test;
- do not report unrelated pre-existing issues unless Phase 29 worsens them.

Prioritize correctness, model integrity, persistence, and history semantics over style preferences.

At the end, output both:

1. a human-readable review;
2. a machine-readable JSON block between `REVIEW_JSON_START` and `REVIEW_JSON_END`.

If there are any Critical or Medium issues, set `"ready_to_commit": false`.

If only Low-priority issues remain, set `"ready_to_commit": true`.

Use this human-readable structure:

```markdown
**Summary:** pass / needs changes

**Critical Issues**
- ...

**Medium Issues**
- ...

**Low-Priority Issues**
- ...

**What Looks Correct**
- ...

**Test Results**
- Exact commands and results.

**Build Results**
- Exact commands and results, including `git diff --check` and lint status.

**Ready To Call Phase 29 Complete**
Yes/No, with a short reason.

**Suggested Targeted Follow-Up Prompt**
If needed, provide a concise fix prompt limited to the verified findings.
```

Then output exactly:

```text
REVIEW_JSON_START
{
  "summary": "pass or needs_changes",
  "critical_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "ready_to_commit": true,
  "suggested_fix_prompt": ""
}
REVIEW_JSON_END
```

Rules:

- counts must be numbers;
- `summary` must be `"pass"` or `"needs_changes"`;
- `ready_to_commit` must be `false` if any Critical or Medium issue exists;
- `suggested_fix_prompt` must be targeted if fixes are needed;
- do not mark the phase complete merely because tests pass;
- do not fail the phase solely for unrelated pre-existing lint debt.

## Severity guidance

### Critical

Examples include:

- linked save/load loses source metadata or last-valid geometry;
- a stale/missing source makes the diagram unloadable, unrenderable, or unexportable;
- synchronization commits invalid or partially updated Coons geometry;
- source editing corrupts undo/redo history;
- synchronization loops make the editor unusable;
- static or legacy Coons patches are silently changed or damaged.

### Medium

Examples include:

- required source edits do not refresh the patch;
- reversed orientation or constant-point linking is wrong;
- invalid links overwrite the last valid snapshots;
- repaired links do not recover automatically;
- source edit and patch refresh require separate Undo steps;
- unrelated edits rematerialize patches or create history entries;
- JSON, duplication, or ID remapping is incomplete;
- rendering or export resolves source strata at runtime instead of using snapshots;
- required creation, status, detach, or regression-test behavior is missing.

### Low priority

Examples include minor UI wording/layout issues, small documentation omissions that do not misstate semantics, or harmless avoidable work after correctness is established.

## Goal under review

Phase 29 is complete only when newly created linked Coons patches follow valid edits to their boundary paths and constant points, retain correct orientation, remain safe under invalid or missing sources, round-trip through JSON, and participate atomically in undo/redo while static and legacy patches keep their existing behavior.

## Review checklist

### 1. Architecture and scope

Check that:

- materialized snapshots remain authoritative for sampling, rendering, and export;
- source metadata is optional persistent model data;
- `sampleCoonsPatch` does not accept or look up the whole `Diagram`;
- no general dependency graph or broad reactive-object system was introduced;
- ruled surfaces remain snapshot-only;
- no unrelated curved-sheet/UI rewrite or unjustified dependency was added.

Medium issues include render-time source lookup or a broad architecture change that bypasses the required snapshot model.

### 2. Model and backward compatibility

Check that:

- all four boundary roles are represented explicitly;
- path links retain source ID and `reversed`;
- point links retain source ID;
- role/source types live at an appropriate model level rather than making model code depend on UI types;
- old JSON without source metadata loads as static;
- links are not inferred from existing snapshot IDs;
- dangling source IDs may load because saved snapshots remain usable;
- stale/up-to-date status and warning text are derived rather than persisted.

Inspect all helpers that may drop or mishandle the new field:

- clone and equality;
- validation and normalization;
- serialization/deserialization;
- coordinate-reference processing;
- translation;
- ID collection/remapping;
- layer and bulk duplication.

Medium issues include lost links on clone/save/load, rejection of dangling links at file validation, or unintended auto-linking of legacy patches.

### 3. Creation workflow

Check that Add sheet > Coons:

- exposes `Keep linked to boundary sources` or equivalent;
- defaults to linked;
- keeps that checkbox as draft UI state before creation;
- stores normalized source metadata only when checked;
- can still create a static patch when unchecked;
- preserves every role’s path/point kind and path `reversed` value;
- does not mutate or reverse the original path;
- still performs initial source validation, coordinate-reference detachment, and full Coons validation;
- fails safely without a partial sheet when initial boundaries are invalid.

Medium issues include missing reverse metadata, no static option, or bypassed initial validation.

### 4. Source-change detection

Verify synchronization for resolved geometry changes caused by:

- polyline vertices;
- cubic-Bezier points and controls;
- concatenated path segments;
- path-template parameters;
- source path direction reversal;
- constant-point movement;
- coordinate-anchor movement;
- coordinate-reference edits;
- symbolic-variable edits;
- layer or bulk translation of linked sources;
- source deletion or invalidation.

Check that:

- detection does not rely only on source-object identity;
- unrelated edits and patch-only style/name/layer/sampling changes do not unnecessarily replace snapshots;
- no-op synchronization does not create history;
- full synchronization is available for JSON load/initialization.

Medium issues include handling only direct path edits, missing indirect anchor/symbolic changes, or rematerializing every patch on unrelated edits in a behaviorally visible way.

### 5. Resolution, reversal, and atomic validation

For each linked patch, check that synchronization:

1. resolves all four sources from the same next Diagram state;
2. reuses or extracts the existing Coons source validation/resolution logic;
3. applies the stored role-specific `reversed` flag exactly once;
4. produces the same point-boundary form as initial creation;
5. detaches coordinate references according to the existing snapshot policy;
6. builds one complete candidate primitive;
7. validates every boundary and all corner equations;
8. commits all four snapshots together only when valid.

Verify that ID, name, layer, style, sampling, and source metadata remain unchanged.

Critical or Medium issues include partial refresh, double reversal, divergent creation/refresh validation, or invalid geometry reaching the committed diagram.

### 6. Stale links and recovery

For a missing source, invalid source, unresolved coordinate, or corner mismatch, check that:

- the source edit itself is accepted;
- the Coons patch is not deleted;
- source metadata is retained;
- all last-valid snapshots remain unchanged;
- Preview and export continue using the last-valid geometry;
- derived status becomes stale with a useful role/reason;
- invalid candidate geometry is never committed;
- repairing the sources causes the patch to catch up automatically;
- status returns to up to date after recovery.

Test temporary endpoint mismatch specifically.

Critical issues include losing fallback geometry or making the file unusable. Medium issues include dropping links, silent stale state, or failure to recover.

### 7. Undo, redo, and transient editing

Check that:

- synchronization occurs before final diagram comparison/history insertion;
- one source edit plus dependent patch updates is one undo transaction;
- one Undo and one Redo restore both source and snapshots;
- repeated Undo/Redo does not drift geometry;
- no-op synchronization creates no extra entry;
- detach is one undoable edit;
- source deletion/restore has coherent status through Undo/Redo;
- synchronization is not a second React `useEffect` state update;
- handle dragging updates transient Preview where the existing editing architecture supports it, while pointer-up still creates one final history entry.

Critical or Medium issues include two-step Undo, history loops, drift, or extra drag-history entries.

### 8. Inspector and detach

Check that a selected Coons patch clearly shows:

- `Static`;
- `Linked — up to date`; or
- `Linked — stale` with a concise reason and last-valid-geometry explanation.

For linked patches, verify role/source summaries and reversed indication where practical.

Check that `Detach boundary links`:

- removes only source metadata;
- preserves current snapshots, ID, name, layer, style, and sampling;
- is undoable;
- prevents later source edits from affecting the detached patch.

Medium issues include detach changing geometry or status disagreeing with actual source validity.

### 9. Deletion, transforms, and duplication

Check that:

- deleting a source leaves the patch and fallback snapshots intact;
- Undo restores the source and up-to-date state;
- operations transforming both sources and patch do not double-translate snapshots;
- no unsupported independent linked-patch offset model was added;
- duplicating patch and sources together remaps each role to the correct duplicate source;
- role and `reversed` metadata survive remapping;
- duplicating only the patch intentionally keeps links to original sources;
- duplicated snapshots are independent clones;
- no link points to an unrelated generated ID.

Medium issues include double translation, source deletion stripping metadata, or wrong duplication links.

### 10. Save/load lifecycle

Check that:

- linked metadata and materialized fallback snapshots both round-trip;
- legacy static patches stay static;
- a linked file with a missing source still loads;
- full refresh occurs after required symbolic/coordinate resolution and before initial undo history;
- successful load refresh uses current sources;
- failed refresh retains saved snapshots and reports stale status;
- no unnecessary serialization-version bump was introduced;
- any required migration is backward-compatible.

Critical issues include unloadable linked files or lost fallback geometry. Medium issues include links disappearing or inconsistent initial history.

### 11. Sampling, SVG, and TikZ

Check that:

- the Coons formula, mesh topology, and sampling limits are unchanged;
- successful source refresh changes SVG Preview and SVG export geometry;
- TikZ export uses refreshed snapshots;
- stale patches export last-valid geometry safely;
- style, opacity, layer order, and visibility remain unchanged;
- TikZ indentation remains 4 spaces;
- inline-math output still has no blank lines.

Medium issues include stale export after successful refresh, runtime Diagram lookup, or formatting regressions.

### 12. Tests

Inspect assertions, not only test counts. Require meaningful coverage for:

1. linked and static creation metadata;
2. ordinary path edit and sampled-mesh change;
3. representative polyline/cubic plus concatenated/template sources;
4. reversed boundary refresh;
5. constant-point refresh;
6. indirect anchor/reference/symbolic changes;
7. atomic all-four refresh;
8. temporary corner mismatch and last-valid fallback;
9. automatic recovery;
10. missing source and Undo restoration;
11. unrelated edits and no-op synchronization;
12. one-step Undo/Redo without drift;
13. detach and Undo of detach;
14. linked JSON round-trip and legacy static JSON;
15. missing-source load with saved fallback snapshots;
16. duplication with and without duplicated sources;
17. SVG/TikZ geometry and formatting;
18. no regression to static Coons patches and ruled surfaces.

Check that every new test file is actually included by `npm test`.

Missing coverage for a high-risk acceptance branch may be Medium.

### 13. Documentation

Check that:

- `docs/ROADMAP.md` contains the implemented Phase 29 scope;
- `docs/RULED_SURFACES.md` distinguishes linked and static Coons patches;
- materialized snapshots, stale fallback, recovery, reverse preservation, source deletion, and detach are documented accurately;
- ruled surfaces are explicitly still snapshot-only;
- legacy JSON behavior is documented;
- `docs/DATA_MODEL.md` or equivalent documents the optional source metadata;
- in-app Help text no longer contradicts Phase 29 behavior.

Documentation must describe implemented behavior, not aspirational behavior.

## Verification and reporting

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

Run focused Phase 29 tests separately when the repository provides a supported command, and report the exact command and result.

If browser/manual verification is available, verify:

1. linked Coons creation;
2. live update while editing a boundary;
3. reversed-role preservation;
4. temporary stale fallback and automatic recovery;
5. one-step Undo/Redo;
6. JSON save/load;
7. detach behavior;
8. SVG and TikZ export.

If manual verification is unavailable, say so explicitly. Do not claim it was performed.

Phase 29 is ready to commit only when tests, build, and `git diff --check` pass and no Critical or Medium issue remains.
