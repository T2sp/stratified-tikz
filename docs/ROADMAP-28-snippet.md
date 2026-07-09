# ROADMAP update snippet for Phase 28

Add or replace the Phase 28 section with the following.

## Phase 28: Preview-first UI, style shortcuts, SVG export, work-plane UX, and arrow preview

Recommended `phaseSlugs` entries:

```js
"28A": "preview-first-layout",
"28B": "svg-export-edge-actions",
"28C": "translucent-toolbar-zindex",
"28D": "context-style-shortcuts",
"28E": "toolbar-eyedropper-imported-style",
"28F": "workplane-overlay-polar-input",
"28G": "workplane-setup-ux",
"28H": "coons-direction-lifecycle",
"28I": "tikz-faithful-arrow-preview",
"28J": "phase-28-polish-hardening",
```

### Phase 28A: Preview-first layout and compact Examples dropdown

- SVG Preview around 90dvh.
- Examples collapse to compact dropdown after editing starts.
- Preview safe-area layout.

### Phase 28B: SVG Preview export button and sticky edge actions

- Export current Preview SVG.
- Right-bottom below, sticky, protruding outside frame.
- Coordinate with Layer button.

### Phase 28C: Translucent toolbar/buttons, z-index tokens, and topmost variable modal

- Toolbar and buttons translucent using rgba backgrounds.
- Text remains opaque.
- Variable import modal topmost.

### Phase 28D: Context quick style bar with 0.1-step sliders and custom numeric input

- Fast style shortcuts by geometric kind.
- Stroke width/point radius sliders step 0.1.
- Custom numeric input with invalid draft warnings.

### Phase 28E: Toolbar eyedropper and imported TikZ style shortcut dropdown

- Eyedropper shortcut.
- Imported TikZ style searchable dropdown.
- Avoid duplicate generated options unless overridden.

### Phase 28F: Work-plane overlay editor and work-plane-local polar coordinate input

- Work-plane panel near Preview left-bottom.
- Add point/coordinate active work-plane local polar input.
- Show work-plane origin near input.

### Phase 28G: Work-plane setup UX overhaul with origin + normal vector

- Method order: Pick 3 existing points > Origin + normal vector > Custom 3 points.
- Normal theta/phi with mini preview.

### Phase 28H: Coons direction lifecycle and overlay panel cleanup

- Coons direction window closes when leaving Coons workflow.

### Phase 28I: TikZ-faithful SVG arrow preview

- SVG arrowheads approximate generated TikZ arrows.

### Phase 28J: Phase 28 docs, tutorial hooks, and regression hardening

- Docs/help.
- Combined tests.
- Accessibility and responsive hardening.
