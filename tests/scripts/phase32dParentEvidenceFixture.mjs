import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allPointNodeScenarios, pointNodeScenarioArtifacts } from '../../scripts/automation/phase-verification.mjs'
import { readEvidenceDocumentSync } from '../../scripts/evidencePublication.mjs'
import { layoutAnchorGroup, signedPolygonalScenario } from '../../scripts/pointLayoutAnchorsContract.mjs'
import { geometricShapeGroup, geometricShapeManifest, geometricBodyVariants } from '../../scripts/pointGeometricShapesContract.mjs'
import { syntheticPointNativeDragEvidence } from './pointNativeDragFixture.mjs'
import { syntheticGeometricSelectionEvidence } from './pointGeometricSelectionFixture.mjs'
import { syntheticGeometricVisibilityEvidence } from './pointGeometricVisibilityFixture.mjs'
import { syntheticStandalonePointDownload } from './standalonePointDownloadFixture.mjs'
import { evidence as syntheticLayoutEvidence, syntheticSignedStandalone } from './signedPointStandaloneFixture.mjs'
import { cylinderDiagnosticScenarios } from '../../scripts/singularCylinderDiagnosticContract.mjs'
import { syntheticSingularCylinderStandalone } from './singularCylinderFixture.mjs'
import { foldedCylinderScenario } from '../../scripts/foldedCylinderContract.mjs'
import { syntheticFoldedCylinderStandalone } from './foldedCylinderFixture.mjs'
import { populateSyntheticConformance } from './pointConformanceFixture.mjs'

// Controlled full cumulative dispatch evidence uses the existing strong fixtures.
// It supplies complete retained PNGs and native shells for policy tests only.
function shapeEvidence(spec) {
  return { scenario: `point-geometric-${spec.slug}`, group: geometricShapeGroup, result: 'passed', pageErrors: [], shape: spec.shape,
    parameters: spec.parameters, nativeShapeControl: true, nativeStyle: { shape: spec.shape, shapeParameters: spec.parameters },
    nativeColorInputs: spec.shape === 'cylinder' ? [
      ['cylinderEndFill', 'Cylinder end fill hex'], ['cylinderBodyFill', 'Cylinder body fill hex'],
    ].map(([parameter, caption]) => ({ parameter, caption, expectedValue: spec.parameters[parameter],
      inputType: 'text', beforeValue: '#FFFFFF', finalInputType: 'text', finalValue: spec.parameters[parameter],
      finalModelValue: spec.parameters[parameter], events: [{ type: 'input', trusted: true, value: spec.parameters[parameter] }] })) : [],
    cases: ['default', 'configured'].flatMap((mode) => geometricBodyVariants.map(({ key, source }) => ({ mode, body: key, source, modelUnchanged: true,
      rendered: { shape: spec.shape, parameters: mode === 'configured' ? spec.parameters : {}, source, state: 'ready', contourLength: 20,
        bounds: { x: -10, y: -10, width: 20, height: 20 }, math: ['math', 'mixed'].includes(key) ? 1 : 0, bodyUpright: true,
        bodyCorners: source ? Array.from({ length: 4 }, () => ({ x: 0, y: 0, inside: true })) : [] } }))) }
}

// Policy controls are fabricated records, separate from cumulative native App
// acceptance. A success flag cannot supply missing handle delivery/history.
function geometricInteractionEvidence() {
  const scenario = 'point-geometric-native-contours-2d-3d'
  return { scenario, group: geometricShapeGroup, result: 'passed', pageErrors: [],
    cases: [2, 3].flatMap((ambientDimension) => ['diamond', 'star', 'semicircle', 'dart'].map((shape) => {
      const nativeDrag = syntheticPointNativeDragEvidence({ scenario, ambientDimension, shape,
        id: 'app-point', displacement: { x: 28, y: -16 }, steps: 4 })
      const nativeSelection = syntheticGeometricSelectionEvidence({ scenario, ambientDimension, shape, id: 'app-point',
        state: nativeDrag.stateBefore })
      return { ambientDimension, shape, codim: ambientDimension, nativeDrag,
        observed: { shape, boundary: nativeSelection.requestedClick, nativeSelection }, before: JSON.parse(nativeDrag.stateBefore.runtimeDiagramJson).strata[0],
        after: JSON.parse(nativeDrag.afterAction.state.runtimeDiagramJson).strata[0],
        events: nativeDrag.afterAction.observation.events.filter(({ phase }) => phase === 'drag'),
        selected: true, trustedDown: true, trustedMove: true, dragged: true, undoRestored: true, redoRestored: true }
    })) }
}

export function populatePhase32dParentEvidence(artifactDir, checkout, earlierArtifacts, earlierGroups) {
  const records = Object.entries(allPointNodeScenarios).flatMap(([group, names]) => names.map(name =>
    ({ group, name, result: 'passed', artifacts: pointNodeScenarioArtifacts(name) })))
  const legacySvg = '<svg><g><circle r="20"/><g><title>fixture</title><g><g><text x="0" y="0">fixture</text></g></g></g></g></svg>'
  for (const record of records) for (const artifact of record.artifacts) {
    const value = earlierArtifacts[artifact]
    const content = artifact.endsWith('.svg') ? typeof value === 'string' ? value : artifact.endsWith('.input.svg') ? '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,0 0,1" fill="none" stroke="black"></polygon></svg>' : legacySvg
      : artifact.endsWith('.png') ? value?.syntheticPngBase64 ? Buffer.from(value.syntheticPngBase64, 'base64')
        : Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1])
        : artifact.endsWith('.json') ? JSON.stringify(value ?? {}) : 'fixture\n'
    writeFileSync(join(artifactDir, artifact), content)
  }
  const save = (name, value) => writeFileSync(join(artifactDir, name), JSON.stringify(value))
  for (const spec of geometricShapeManifest) save(`point-geometric-${spec.slug}.json`, shapeEvidence(spec))
  save('point-geometric-native-contours-2d-3d.json', geometricInteractionEvidence())
  save('point-geometric-visibility.json', syntheticGeometricVisibilityEvidence())
  const diagnostics = []
  for (const name of ['point-geometric-download-transparent', 'point-geometric-download-white',
    'point-layout-pending-transparent-edit', 'point-layout-pending-white-load']) {
    const { evidence, raw } = syntheticStandalonePointDownload(artifactDir, name)
    save(`${name}.json`, evidence); save(`${name}-standalone.json`, raw)
    if (evidence.postClickView) {
      const common = { name: `${name}-post-click-view`, group: layoutAnchorGroup, result: 'observed' }
      diagnostics.push(...[0, 1, 2, 3].map(count => ({ ...common, postClickView: { ...structuredClone(evidence.postClickView),
        result: 'observed', stages: structuredClone(evidence.postClickView.stages.slice(0, count)) } })),
        { ...common, postClickView: evidence.postClickView })
    }
  }
  for (const name of allPointNodeScenarios[layoutAnchorGroup]) {
    if (name === signedPolygonalScenario || name === foldedCylinderScenario || cylinderDiagnosticScenarios.includes(name) || name.startsWith('point-layout-pending-')) continue
    save(`${name}.json`, syntheticLayoutEvidence(name))
  }
  const signed = [2, 3].map(dimension => syntheticSignedStandalone(artifactDir, dimension))
  const evidence = signed[0].evidence
  evidence.downloads[1] = signed[1].download
  evidence.zeroAxisCases[1] = signed[1].evidence.zeroAxisCases[1]
  evidence.geometryConformance = populateSyntheticConformance(artifactDir).geometryConformance
  for (const fixture of signed) save(`${fixture.download.scenario}-standalone.json`, fixture.raw)
  save(`${signedPolygonalScenario}.json`, evidence)
  const singular = []
  for (const scenario of cylinderDiagnosticScenarios) {
  const pair = [2, 3].map(dimension => syntheticSingularCylinderStandalone(artifactDir, dimension, scenario))
  singular.push(...pair)
  const singularEvidence = pair[0].evidence
  singularEvidence.cases[1] = pair[1].evidence.cases[1]
  singularEvidence.downloads[1] = pair[1].download
  for (const fixture of pair) save(`${fixture.download.scenario}-standalone.json`, fixture.raw)
  save(`${scenario}.json`, singularEvidence)
  }
  const folded = [2, 3].map(dimension => syntheticFoldedCylinderStandalone(artifactDir, dimension))
  const foldedEvidence = folded[0].evidence
  foldedEvidence.cases[1] = folded[1].evidence.cases[1]; foldedEvidence.downloads[1] = folded[1].download
  for (const fixture of folded) save(`${fixture.download.scenario}-standalone.json`, fixture.raw)
  save(`${foldedCylinderScenario}.json`, foldedEvidence)
  const groups = [...earlierGroups, ...Object.keys(allPointNodeScenarios)]
  const report = { result: 'passed', stage: 'complete', environment: { browserVersion: 'controlled cumulative parent fixture' },
    checkout, started: groups, completed: groups, incompleteGroups: [], unexecuted: [], pageErrors: [], evidence: records, diagnostics }
  save('free-labels-evidence.json', report)
  return { artifactDir, checkout, report, signed, singular, folded, readJson: name => readEvidenceDocumentSync(artifactDir, name, { checkout }), save }
}
