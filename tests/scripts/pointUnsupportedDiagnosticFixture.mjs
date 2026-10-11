import { fixedDiagnosticCandidates, resolveDiagnosticCandidates } from '../../scripts/pointUnsupportedDiagnosticContract.mjs'

// Synthetic raw policy/ownership records only; this fixture supplies no native
// acceptance and cannot replace browser observations or trusted real input.
export function syntheticDiagnosticMeasurement({ ambientDimension = 2, shape = 'ellipse', selection = null,
  token = 'synthetic-canvas', ring = null,
  nodeMatrix = { a: 1, b: 0, c: 0, d: 1, e: 404, f: 36 },
  canvasMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  canvasClient = { left: 0, top: 0, right: 520, bottom: 360, width: 520, height: 360 } } = {}) {
  const id = 'app-point', epoch = 397, source = 'WWWW diagnostic', anchor = 'not a PGF anchor'
  const point = { id, geometricKind: 'point', codim: ambientDimension, text: source, name: 'Point', layer: 0,
    position: { x: 3, y: 3, z: 0 }, style: { kind: 'pointStyle', shape, size: 8, opacity: 1, layout: { anchor, minimumWidth: 1000, minimumHeight: 1000 } } }
  const diagram = { version: 1, ambientDimension, strata: [point], labels: [], layers: [{ value: 0, name: 'Layer 0' }],
    camera: ambientDimension === 2 ? { mode: '2d', scale: 1, origin: { x: 0, y: 0 } }
      : { mode: '3d', kind: 'orthographic', thetaDeg: 60, phiDeg: 30, zoom: 1, pan: { x: 0, y: 0 } } }
  const stateSnapshot = { json: JSON.stringify({ format: 'stratified-tikz-diagram', version: 2, diagram }),
    runtimeDiagramJson: JSON.stringify(diagram), history: JSON.stringify({ past: [], present: diagram, future: [] }),
    labelDocumentRevision: epoch, selection, uiSettings: '{}', requests: 1 }
  const identity = { id, ambientDimension, shape, epoch, source, anchor, canvasToken: token,
    pointRequest: 'synthetic-current-request', bodyRequest: 'synthetic-current-request', ownerToken: JSON.stringify(['point-node', epoch, id]) }
  const background = { tag: 'rect', id: '', canvasToken: token, canvasRoot: false, canvas: true, background: true, pointId: null,
    body: false, bodyTarget: false, exportExcluded: false, pointGroup: false, pointNode: false,
    warning: false, ring: false, handle: false, overlay: false, connected: true, ownerToken: null, pointerEvents: 'auto',
    elementToken: `${token}:background`, pointNodeToken: null, pointGroupToken: null,
    pointRequest: null, bodyRequest: null, source: null, labelOwner: null }
  const root = { ...background, elementToken: `${token}:root`, tag: 'svg', background: false, canvasRoot: true }
  const bodyBounds = { minX: -48.706, minY: -7, maxX: 48.706, maxY: 7 }
  const warningBounds = { minX: -58.706, minY: -10, maxX: -52.706, maxY: 2 }
  const currentPoint = { ...background, background: false, pointId: id, ownerToken: identity.ownerToken,
    pointRequest: identity.pointRequest, bodyRequest: identity.bodyRequest, source, labelOwner: identity.ownerToken,
    pointNodeToken: `${token}:point-node`, pointGroupToken: `${token}:point-group` }
  const ownerNode = { ...currentPoint, tag: 'g', elementToken: currentPoint.pointNodeToken, pointNode: true }
  const ownerGroup = { ...currentPoint, tag: 'g', elementToken: currentPoint.pointGroupToken, pointGroup: true }
  const label = { ...currentPoint, tag: 'g', elementToken: `${token}:label`, body: true }
  const bodyDescriptor = { ...currentPoint, elementToken: `${token}:body-target`, bodyTarget: true, exportExcluded: true }
  const warningDescriptor = { ...currentPoint, tag: 'path', elementToken: `${token}:warning`, warning: true }
  const attributes = { x: bodyBounds.minX, y: bodyBounds.minY, width: bodyBounds.maxX - bodyBounds.minX,
    height: bodyBounds.maxY - bodyBounds.minY, fill: 'transparent', transform: null }
  const targetBox = Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Math.fround(attributes[key])]))
  const bodyTarget = { descriptor: bodyDescriptor, ownerNode, ownerGroup, label, parentIsPointNode: true, attributes,
    nativeBounds: targetBox, bounds: { minX: targetBox.x, minY: targetBox.y,
      maxX: targetBox.x + targetBox.width, maxY: targetBox.y + targetBox.height }, screenMatrix: nodeMatrix }
  const project = (local) => {
    const screen = { x: nodeMatrix.a * local.x + nodeMatrix.c * local.y + nodeMatrix.e,
      y: nodeMatrix.b * local.x + nodeMatrix.d * local.y + nodeMatrix.f }
    const det = canvasMatrix.a * canvasMatrix.d - canvasMatrix.b * canvasMatrix.c
    const x = screen.x - canvasMatrix.e, y = screen.y - canvasMatrix.f
    const rootPoint = { x: (canvasMatrix.d * x - canvasMatrix.c * y) / det, y: (-canvasMatrix.b * x + canvasMatrix.a * y) / det }
    const inside = screen.x >= canvasClient.left && screen.x < canvasClient.right && screen.y >= canvasClient.top && screen.y < canvasClient.bottom
    return { local, screen, root: rootPoint, hit: { target: inside ? background : null, stack: inside ? [background, root] : [] } }
  }
  const bodyClick = project({ x: -45, y: 0 }), warningClick = project({ x: -55.706, y: -7 })
  bodyClick.hit = { target: bodyDescriptor, stack: [bodyDescriptor, root] }
  warningClick.hit = { target: warningDescriptor, stack: [warningDescriptor, root] }
  const measurement = { identity, stateSnapshot, connected: { canvasCount: 1, nodeCount: 1, bodyCount: 1, warningCount: 1,
    bodyTargetCount: 1, bodyTarget: true, canvas: true, node: true, body: true, warning: true },
    ui: { inspector: { open: false, openerExpanded: 'false' }, toolbar: { collapsed: false, overlayCount: 1, floatingCount: 1, expandCount: 0, collapseCount: 1 },
      selectPressed: 'true', workPlaneControls: [], workPlaneStatus: ['xy-plane at z=0'] },
    source, anchor, layout: { anchor, minimumWidth: 1000, minimumHeight: 1000 }, state: 'ready', diagnostic: 'Anchor unsupported', contourCount: 0,
    bodyBounds, warningBounds, bodyTarget, shapeBounds: { minX: -600, minY: -600, maxX: 600, maxY: 600 }, anchorBounds: { minX: -600, minY: -600, maxX: 600, maxY: 600 },
    paintedBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, modelBodyBounds: bodyBounds,
    nativeBounds: { body: { x: bodyBounds.minX, y: bodyBounds.minY, width: bodyBounds.maxX - bodyBounds.minX, height: bodyBounds.maxY - bodyBounds.minY },
      warning: { x: warningBounds.minX, y: warningBounds.minY, width: warningBounds.maxX - warningBounds.minX, height: warningBounds.maxY - warningBounds.minY } },
    nodeMatrix, canvasMatrix, matrices: { node: nodeMatrix, canvas: canvasMatrix, bodyScreen: nodeMatrix, warningScreen: nodeMatrix },
    viewBox: { x: 0, y: 0, width: 520, height: 360 }, canvasClient, viewport: { width: 1700, height: 1300, scrollX: 0, scrollY: 0 },
    preserveAspectRatio: { attribute: null, align: 6, meetOrSlice: 1 }, clipAncestors: [], ring,
    bodyClick, warningClick,
    candidates: fixedDiagnosticCandidates(bodyBounds, warningBounds).map(({ name, local }) => ({ name, ...project(local) })), errors: [] }
  return { ...measurement, ...resolveDiagnosticCandidates(measurement) }
}

export function syntheticUnsupportedDiagnosticEvidence({ ambientDimension = 2, shape = 'ellipse' } = {}) {
  const rendered = syntheticDiagnosticMeasurement({ ambientDimension, shape })
  const selected = { kind: 'stratum', id: 'app-point' }, ring = { cx: 0, cy: 0, radius: 70 }
  const clicks = ['body', 'far', 'warning'].map((kind) => {
    const measurement = syntheticDiagnosticMeasurement({ ambientDimension, shape, selection: kind === 'far' ? selected : null, ring: kind === 'far' ? ring : null })
    const click = measurement[`${kind}Click`]
    const stateAfter = { ...measurement.stateSnapshot, selection: kind === 'far' ? null : selected }
    const root = click.hit.stack.find((target) => target.canvasRoot)
    const events = ['pointerdown', 'pointerup', 'click'].map((type, index) => ({ type, trusted: true,
      x: click.screen.x, y: click.screen.y, order: index, pointerId: 1, button: 0, buttons: index === 0 ? 1 : 0,
      altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, canvasHasPointerCapture: false,
      epoch: measurement.identity.epoch, identity: measurement.identity, target: click.hit.target,
      path: [click.hit.target, ...(kind === 'far' ? [] : [measurement.bodyTarget.ownerNode, measurement.bodyTarget.ownerGroup]), root] }))
    const afterMeasurement = syntheticDiagnosticMeasurement({ ambientDimension, shape, selection: stateAfter.selection, ring: stateAfter.selection ? ring : null })
    return { kind, measurement, inputMeasurement: structuredClone(measurement), click, before: measurement.stateSnapshot, after: stateAfter,
      afterMeasurement, events, droppedEvents: 0, errors: [], canvasCaptureAfterInput: false, selectedId: stateAfter.selection?.id ?? null }
  })
  return structuredClone({ result: 'passed', ambientDimension, shape, rendered,
    preparation: { before: rendered.stateSnapshot, after: rendered.stateSnapshot, actions: [], uiBefore: rendered.ui, uiAfter: rendered.ui },
    restoration: { before: clicks.at(-1).after, after: clicks.at(-1).after, actions: [], uiBefore: rendered.ui, uiAfter: rendered.ui },
    ring, clicks, diagramUnchanged: true, secondaryErrors: [] })
}
