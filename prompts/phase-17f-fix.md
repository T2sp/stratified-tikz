# Phase 17F Fix Prompt: Collapse imported style list and avoid duplicate TikZ options for imported presets

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

Phase 17F is complete, but manual UI/source review found two issues after importing a `.sty` file.

## Issue 1: Imported style list stays fully expanded and makes the toolbar unusable

After importing a `.sty` file, the UI shows every imported style key in the toolbar/control area.

Example manual behavior:

```text
Imported 49 styles.
Source: mygeometry.sty
49 imported; 0 skipped.
  - 1cat/glob/0cell/arrow
  - 1cat/glob/1cell/arrow
  - ...
```

This long list remains visible and forces the toolbar/control panel to scroll. It is too noisy for normal editing.

Desired behavior:

- show a compact import summary by default;
- do not keep a long list of imported style keys fully expanded in the toolbar;
- either auto-collapse the list after a short delay, or make it collapsed/folded by default;
- details should still be inspectable when the user wants them.

## Issue 2: Imported custom styles are expanded redundantly in generated TikZ

When a custom/imported style is selected, the editor correctly updates the Inspector style fields based on parsed style information such as:

- color;
- fill color;
- stroke color;
- opacity;
- fill opacity;
- draw opacity;
- line width;
- line style.

However, if the generated TikZ then includes both:

1. the imported style key, and
2. duplicated generated options corresponding to the same parsed properties,

the source becomes unnecessarily verbose and less readable.

Example bad output:

```tex
\draw[3cat/phys/1strata/color/x, draw=stratifiedColorA, opacity=.4] ...
```

if `3cat/phys/1strata/color/x` already expands externally to something like:

```tex
red!60, opacity=.4
```

Desired behavior:

- applying an imported custom style should update the Inspector and SVG preview using parsed/approximated values;
- generated TikZ should reference the imported style key;
- generated TikZ should not redundantly emit structured options that are already provided by the imported style;
- generated TikZ should not define colors via `\definecolor` solely because they were parsed from an imported style for preview approximation;
- if the user later manually overrides a style field after applying the imported style, that explicit override may be emitted after the imported style key.

This is a source-readability fix.

## Goal

Fix Phase 17F so that:

1. Imported style lists are compact/collapsible and do not bloat the toolbar.
2. Imported style presets update Inspector/SVG preview without causing duplicate TikZ options.
3. Imported external styles continue to be referenced externally:
   - no inline `\tikzset`;
   - no active `\input`;
   - external load comments only.
4. User-created local structured presets from Phase 17A remain unaffected.

## Scope

This is a targeted Phase 17F fix.

Implement:

- compact/collapsible imported style import summary UI;
- suppression of duplicate TikZ options derived from imported style preview parsing;
- a clear model/policy for imported-style-provided fields versus explicit user overrides;
- tests for UI state/helpers and TikZ output behavior.

Do not implement:

- full TeX parser;
- macro expansion;
- `\foreach`;
- symbolic TikZ expressions;
- active external file loading in generated TikZ;
- inline `\tikzset` emission for imported external styles;
- broad UI redesign;
- new dependencies.

Do not change:

- imported `\tikzset` parser behavior except as needed for metadata;
- external-load comment policy;
- Phase 17A user preset local-style behavior;
- SVG rendering semantics except preview style approximation;
- diagram geometry;
- layer/camera/work-plane behavior;
- save/load format unless a small metadata extension is required.

## 1. Collapse imported style list in the UI

Inspect the import UI and Style Manager / toolbar UI.

Current bad behavior:

- after import, every imported style key is displayed immediately and persistently in the main toolbar/control area.

Required behavior:

- default view should be compact;
- show summary such as:

```text
Imported 49 styles from mygeometry.sty.
49 imported; 0 skipped.
[Show imported styles]
```

or:

```text
Imported styles: mygeometry.sty (49)
[Details]
```

- imported style key list should be hidden/collapsed by default;
- user can expand details manually;
- expanded list should be scrollable and bounded;
- imported list must not force the whole toolbar to scroll excessively;
- if auto-collapse is implemented, use a short delay and preserve manual reopen.

Acceptable policies:

### Option A: Collapsed by default

After import, show only summary. User clicks to expand.

Preferred.

### Option B: Temporarily expanded then auto-collapse

Show details briefly after import, then collapse after a delay such as 3-5 seconds.

If implemented, avoid surprising the user while they are interacting with the details.

### Option C: Bounded scroll area

Show details in a small scrollable area with max height.

This is acceptable only if the toolbar remains usable.

Preferred final UI may combine A and C:

- collapsed by default;
- when expanded, show a bounded scrollable list.

## 2. Keep imported style details accessible

Do not remove the information completely.

When expanded, details may show:

- source file name;
- imported count;
- skipped count;
- imported keys;
- warnings/skipped entries;
- maybe a search/filter if already easy.

Requirements:

- details expansion is UI state only;
- not stored in `Diagram`;
- save/load unaffected;
- import metadata still saved where appropriate.

## 3. Separate preview-derived style fields from TikZ export overrides

The core export issue is that imported style options are parsed for preview, but those parsed values should not automatically become generated TikZ options.

Add or clarify a model distinction:

```text
Imported style key:
  used for TikZ export.

Preview style approximation:
  used for SVG preview and Inspector display.

Explicit user override:
  generated as TikZ option after imported style key.
```

This may require metadata such as:

```ts
type StyleFieldOrigin =
  | "structured"
  | "importedPresetPreview"
  | "userOverride";
```

or a simpler mechanism:

```ts
importedTikzStyleKey: string
previewStyleFromImportedKey: Partial<...>
explicitStyleOverrides: Partial<...>
```

Exact model can differ.

Requirements:

- applying an imported style key may update structured fields shown in Inspector;
- parsed fields from imported style should be treated as preview/inherited values;
- parsed fields should not by themselves cause duplicate TikZ options;
- if the user manually edits a field after applying the imported style, that field becomes an explicit override and may be emitted;
- clearing the imported style should restore normal structured style output behavior or preserve explicit fields according to a documented policy.

## 4. TikZ output policy for imported styles

When an element uses an imported external style key:

### Without user overrides

Output should be minimal.

Example:

```tex
\draw[3cat/phys/1strata/color/x] ...
```

Do not also emit parsed duplicate options such as:

```tex
draw=...
opacity=...
line width=...
```

if those came only from the imported style parser.

Do not emit `\definecolor` for colors parsed from the external imported style.

Reason:

- the external style file is expected to define the appearance;
- the editor's parsed color/opacity is only an approximation for preview/Inspector.

### With user overrides

If the user applies imported style and then changes a style field in the Inspector:

Example:

- imported key provides `opacity=.4`;
- user changes opacity to `.8`.

Then output may be:

```tex
\draw[3cat/phys/1strata/color/x, opacity=.8] ...
```

This is acceptable because it is an explicit override.

Choose deterministic ordering:

1. imported external style key;
2. explicit user overrides;
3. element-specific required options.

Do not emit duplicate options for fields that were not explicitly overridden.

## 5. Apply policy to all relevant commands

Ensure duplicate suppression works for:

- `\draw` commands:
  - ordinary curves;
  - concatenated paths;
  - arc/circle/ellipse path templates;
  - segment-level style overrides where applicable;

- `\filldraw` or fill commands:
  - polygon sheets;
  - filled regions;
  - work-plane-filled sheets;
  - curved sheet primitives;

- `\node` commands:
  - points;
  - labels.

Imported node shape styles may include:

```tex
circle, draw=black, thick, fill=white, inner sep=1.5pt
```

If these are imported, do not redundantly emit parsed `draw`, `fill`, `inner sep`, etc. unless explicitly overridden.

## 6. Preserve Inspector behavior

The Inspector should still show useful values after applying imported style.

Example:

- imported style contains `red!60, opacity=.4`;
- Inspector can show approximate stroke/fill color and opacity;
- SVG preview can approximate those values.

But the Inspector should not imply that every shown value will be emitted as a duplicate structured option.

If helpful, add a small UI hint:

```text
Preview values inferred from imported TikZ style.
```

or:

```text
Imported style controls TikZ output; shown values are preview approximations.
```

Keep it compact.

## 7. Preserve external style load comment policy

Generated TikZ should still:

- include external load comments when imported style keys are used;
- not inline full `\tikzset`;
- not emit active `\input` by default.

Example:

```tex
% External TikZ styles referenced below.
% Load these files in your LaTeX preamble or before the picture:
% - mygeometry.sty
```

Do not change this policy.

## 8. Phase 17A user presets remain unchanged

This fix is about imported external style keys.

Do not break Phase 17A user-created structured presets.

User-created structured presets should continue to be defined according to the current export mode policy:

- standalone or existing mode as implemented;
- inline math mode later may use inside-picture `\tikzset`.

Imported external style definitions are different:

- they are external;
- not inlined;
- not converted into local definitions.

## 9. Tests

Add focused tests.

### UI / display tests or helper tests

1. Import summary is compact by default.
2. Imported key list is collapsed by default.
3. Expanded imported key list is bounded/scrollable if testable.
4. Import summary shows source name and counts.
5. Imported style details can be expanded/collapsed.

If component tests are too heavy, test pure UI state helpers and manually verify layout.

### TikZ duplicate suppression tests

6. Imported curve style with color/opacity emits only imported key, not duplicate color/opacity options.

Input style example:

```tex
\tikzset{wire/.style={draw=red, opacity=.4}}
```

Expected command contains:

```tex
\draw[wire]
```

and does not contain duplicate:

```tex
draw=red
opacity=.4
```

unless they are explicit user overrides.

7. Imported sheet/filldraw style with fill opacity emits only imported key, not duplicate fill opacity.

8. Imported node style with `circle, draw=black, fill=white, inner sep=...` emits only imported key for node unless explicitly overridden.

9. No `\definecolor` is emitted solely for imported style preview colors.

10. External load comment still appears.

11. Full `\tikzset` is not inlined.

12. Active `\input` is not emitted.

### Explicit override tests

13. Apply imported style, then explicitly override opacity.

Expected:

```tex
\draw[wire, opacity=.8]
```

or equivalent.

14. Apply imported style, then explicitly override line width.

Expected output includes imported key plus explicit line width override.

15. Clearing imported style restores normal structured style export or follows documented policy.

### Regression tests

16. Phase 17A user preset still exports correctly.
17. Built-in presets still work.
18. SVG preview still approximates imported style.
19. Save/load preserves imported style references.
20. Existing imported style parser tests still pass.

## 10. Documentation

Update docs:

- imported style list is collapsed/compact in UI;
- imported TikZ styles are external references;
- Inspector values inferred from imported styles are preview approximations;
- generated TikZ avoids duplicating options already supplied by imported style keys;
- explicit user overrides are emitted after imported style key;
- no inlined `\tikzset`;
- no active `\input` by default.

## 11. Manual verification checklist

After implementation, run:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

UI:

1. Import `mygeometry.sty`.
2. Confirm toolbar does not show all imported style keys permanently.
3. Confirm summary is compact.
4. Expand details manually.
5. Confirm imported style list is scrollable/bounded.
6. Collapse details.

Export behavior:

7. Apply an imported color style to a curve.
8. Confirm Inspector/SVG preview update.
9. Confirm generated TikZ uses imported key.
10. Confirm generated TikZ does not duplicate parsed color/opacity options.
11. Confirm no `\definecolor` is generated solely for imported preview color.
12. Confirm external load comment appears.
13. Confirm full `\tikzset` is not inlined.
14. Confirm active `\input` is not emitted.

Overrides:

15. After applying imported style, manually change opacity.
16. Confirm generated TikZ includes imported key plus explicit opacity override.
17. Manually change line width.
18. Confirm generated TikZ includes explicit line width override.

Regression:

19. Apply a user-created structured preset.
20. Confirm its export behavior is unchanged.
21. Save/load and confirm imported style reference remains.

## 12. Preserve existing behavior

Do not regress:

- imported style parser;
- external load comments;
- Phase 17A user presets;
- SVG preview;
- Inspector style editing;
- TikZ export for existing diagrams;
- layer-aware output;
- camera/work-plane output;
- save/load;
- undo/redo;
- geometry rendering.

## 13. Verification

Run:

```bash
PATH=/opt/homebrew/bin:$PATH npm test
PATH=/opt/homebrew/bin:$PATH npm run build
git diff --check
```

## 14. Report after implementation

Please report:

- files modified;
- UI behavior for imported style summary/details;
- whether details auto-collapse or are collapsed by default;
- how duplicate TikZ options are suppressed;
- how imported preview-derived fields are distinguished from explicit user overrides;
- export option ordering;
- how `\definecolor` duplication is avoided;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
