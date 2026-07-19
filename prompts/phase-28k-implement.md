# Phase 28K Implementation Prompt: Selectable transparent/white SVG export background

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

Do not treat lint as a required gate while the existing repository-wide lint debt remains.
## Project context

You are working on the current `main` branch of:

```text
https://github.com/T2sp/stratified-tikz
```

The current repository contains the relevant implementation areas:

- `src/ui/svgPreviewExport.ts` for SVG Preview export;
- `src/model/grids.ts` for compact grid/lattice geometry and validation;
- `src/rendering/SvgDiagram.tsx` and related rendering helpers for SVG Preview;
- `src/tikz/generateTikz.ts` for generated TikZ source;
- tests under `tests/`.

Preserve all current behavior unless this prompt explicitly changes it:

- SVG Preview remains the primary editing canvas;
- Export SVG remains a Preview edge action;
- 2D/3D camera, zoom, and pan behavior;
- layer visibility/filtering;
- coordinate anchors and coordinate refs;
- symbolic and work-plane-local coordinates;
- rectangular and honeycomb grids;
- standalone and inline-math TikZ export;
- inline-math output contains no blank lines;
- TikZ indentation remains 4 spaces;
- save/load and undo/redo.


## Goal

Change SVG Preview export so the user can choose either:

```text
Transparent background
White background
```

The browser Preview may keep its current gray workspace background. The exported SVG must no longer inherit that gray editor background.

## Current problem

The SVG downloaded from the current Preview export looks gray, matching the browser Preview workspace.

That editor canvas color is useful on screen, but it should not be forced into the exported asset.

## Required UX

Add a compact background selector adjacent to, or inside a popover attached to, the existing `Export SVG` edge action.

Suggested UI:

```text
Export SVG ▾
  Transparent background
  White background
```

or:

```text
Background: Transparent / White
[Export SVG]
```

Requirements:

- both modes are explicitly selectable before export;
- default mode: `transparent`;
- remember the most recently selected mode for the current browser session/component lifetime;
- this setting is UI-only:
  - do not store it in `Diagram`;
  - do not change JSON save/load;
  - do not change TikZ output;
- preserve the current right-bottom-below sticky placement of the SVG export action.

## Model/API

Add an explicit export option, for example:

```ts
export type SvgPreviewBackgroundMode = "transparent" | "white";

export type SvgPreviewExportOptions = {
  backgroundMode: SvgPreviewBackgroundMode;
};
```

Pass this option through the existing SVG Preview export path.

Do not infer the desired background from browser computed styles.

## Export implementation

Inspect:

```text
src/ui/svgPreviewExport.ts
src/App.tsx
src/rendering/SvgDiagram.tsx
src/App.css
tests for SVG Preview export
```

The export function must operate on a clone/serialized copy and must never mutate the live Preview SVG.

### Transparent mode

For transparent export:

- remove or override editor-only SVG root background declarations;
- remove cloned inline `background` / `background-color` values that produce gray;
- ensure exported SVG root does not carry a gray workspace background class/style;
- do not add a background rectangle;
- preserve inherited geometry `fill` attributes—do not broadly remove `fill` from the SVG root or children;
- preserve `viewBox`, dimensions, transforms, `<defs>`, markers, clip paths, styles, and image content.

The resulting file should display transparently in software that supports SVG alpha.

### White mode

For white export:

- normalize/remove the gray editor background as above;
- insert an explicit white `<rect>` behind all visible diagram content;
- the rectangle should cover the exported `viewBox`, not merely a hard-coded pixel size;
- use:

```xml
fill="#ffffff"
```

- add a stable marker attribute for tests, for example:

```xml
data-stratified-tikz-export-background="white"
```

- place it behind all rendered geometry while preserving `<defs>` behavior.

If the SVG has no usable `viewBox`, derive a safe rectangle from the exported width/height or return a clear export error instead of emitting malformed dimensions.

## Editor-only content

Keep the existing export policy:

- exclude toolbar and edge buttons;
- exclude selection handles;
- exclude hover/cycling highlights;
- exclude drag handles and editor-only warnings;
- preserve the actual rendered diagram and current view/projection.

The new background rectangle is export-only and must not appear in the live Preview DOM.

## Download/status behavior

- use the existing SVG download filename policy;
- status should identify the chosen mode, e.g.:

```text
SVG exported with transparent background.
SVG exported with white background.
```

- failure must leave the Preview unchanged.

## Tests

Add focused tests.

1. Default export background mode is transparent.
2. Transparent export contains no gray background style/attribute.
3. Transparent export contains no export background `<rect>`.
4. Transparent export preserves path/sheet/label/arrow SVG content.
5. White export contains exactly one explicit white background rectangle.
6. White rectangle matches the SVG `viewBox`.
7. White rectangle is behind rendered geometry.
8. Export does not mutate the live SVG node.
9. Browser Preview can remain gray while exported transparent SVG is transparent.
10. Browser Preview can remain gray while exported white SVG is white.
11. Switching modes changes only exported SVG content.
12. Export background mode is not serialized into diagram JSON.
13. TikZ output is identical for transparent and white SVG export settings.
14. SVG with 2D pan/zoom exports in both modes.
15. SVG with 3D projection/surfaces/arrows exports in both modes.
16. Existing editor-only-node filtering tests still pass.

## Documentation

Update `docs/PREVIEW_UI.md` or the current SVG-export help section:

- Preview workspace may be gray;
- SVG export offers transparent or white background;
- background choice is export-only.

## Report after implementation

Please report:

- files modified;
- selector UI placement;
- default/session-state behavior;
- transparent normalization strategy;
- white rectangle/viewBox strategy;
- tests added/updated;
- test results;
- build results;
- remaining limitations.
