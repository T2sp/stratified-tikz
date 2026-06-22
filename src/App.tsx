import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SetStateAction,
} from 'react'
import './App.css'
import {
  emptyThreeDimensionalDiagram,
  emptyTwoDimensionalDiagram,
  evenOddFilledBoundaryExample,
  symbolicCirclePointExample,
  symbolicPathExample,
  threeDimensionalExample,
  threeDimensionalWorkPlaneGridExample,
  translucentFilledStrataExample,
  twoDimensionalGridExample,
  twoDimensionalExample,
} from './examples'
import { normalizePointForAmbientDimension } from './geometry'
import {
  parseSavedDiagramJsonForImport,
  resolvePendingSymbolicDiagramImport,
  serializeDiagram,
} from './model/serialization.ts'
import { importTikzStyleFile } from './model/importedTikzStyles.ts'
import {
  elementsOnLayer,
  isLayerLocked,
  isLayerVisible,
  renameLayer,
  setLayerLock,
  setLayerVisibility,
} from './model/layers.ts'
import { defaultCurveStyle, isHexColor } from './model/styles.ts'
import { hasSymbolicVec3Coordinates } from './model/symbolicCoordinates.ts'
import { pathEndpoints } from './model/paths.ts'
import type {
  AmbientDimension,
  ArcDirection,
  AxisAlignedWorkPlaneName,
  BoundaryPathSnapshot,
  Camera,
  CoonsConstantPointBoundarySnapshot,
  CoordinateInputMode,
  CurveStyle,
  Diagram,
  FillRule,
  HexColor,
  HiddenCurveLineStyle,
  LabelVisibilityPolicy,
  LatticePattern,
  LineStyle,
  OrthographicCamera3D,
  PointVisibilityPolicy,
  Stratum,
  TikzExportMode,
  Vec2,
  Vec3,
  VisibilityOptions,
  VisibilitySortMode,
  WorkPlane,
} from './model/types'
import type {
  PendingSymbolicDiagramImport,
} from './model/serialization.ts'
import {
  hiddenCurveLineStyles,
  labelVisibilityPolicies,
  latticePatterns,
  lineStyles,
  pointVisibilityPolicies,
} from './model/types'
import {
  cloneVisibilityOptions,
  defaultHiddenCurveStyle,
  defaultMaxCurveSamples,
  defaultMaxSurfaceFacesForSorting,
  defaultVisibilityOptions,
  hardMaxCurveSamples,
  hardMaxSurfaceFacesForSorting,
  normalizeVisibilityMaxCurveSamples,
  normalizeVisibilityMaxSurfaceFacesForSorting,
} from './model/visibility.ts'
import {
  SvgDiagram,
  svgPointToModelOnWorkPlane,
  type BoundaryPathHighlight,
} from './rendering'
import {
  addConcatenatedPathStratumWithResult,
  addArcPathFromDirectInput,
  addCirclePathFromDirectInput,
  addConcatenatedPathFromDirectInput,
  addCubicBezierCurveFromDirectInput,
  addCubicBezierCurveStratumWithResult,
  addEllipsePathFromDirectInput,
  addCurvedSheetStratumWithResult,
  addGridStratumFromDirectInput,
  addPolygonSheetFromDirectInput,
  addPolygonSheetStratumWithResult,
  addPolylineCurveFromDirectInput,
  addPolylineCurveStratumWithResult,
  addPointStratumWithResult,
  addPointStratumFromDirectInput,
  addTextLabelWithResult,
  addTextLabelFromDirectInput,
  applyDirectCreationCommitToEditorState,
  applyDeleteLayerToEditorState,
  applyDuplicateLayerToEditorState,
  applySwapLayersToEditorState,
  applyTranslateLayerToEditorState,
  appendConcatenatedPathDraftPoint,
  appendSheetPolygonDraftPoint,
  areCamera3DEqual,
  areFinitePoints,
  arePointsOnWorkPlane,
  allLayersFilter,
  applyCameraOrbitDrag,
  applyCameraNumericInput,
  applyCameraPanDrag,
  clearSelectionIfMissing,
  clearSelectionForLayerFilter,
  cloneDiagram,
  commitDiagramChange,
  commitDirectCreationResult,
  cameraControlStateFromDiagramView,
  cameraControlFieldValue,
  cameraOrientationForPreview,
  cameraPresetIdForCamera,
  cameraPresetOptions,
  cameraSummaryLabel,
  cameraViewAdjustmentFromControls,
  createCameraPresetCamera,
  createInitialCameraControlState,
  createExistingCoordinateSourceOptions,
  createSerializeDiagramOptionsForUi,
  boundarySurfaceBoundaryPathSourceErrorMessage,
  boundarySurfaceDraftPickErrorMessage,
  boundarySurfacePathClickWorkflow,
  coonsPatchBoundaryDraftCanCreate,
  coonsPatchBoundaryDraftPickedBoundaryForRole,
  coonsPatchBoundaryDraftPickedSourceIds,
  coonsPatchBoundaryRoles,
  coonsPatchBoundaryDraftStatusMessage,
  coonsPatchBoundarySelectionsFromDraft,
  coonsPatchBoundaryPathSourceErrorMessage,
  coonsPatchBoundaryPointSourceErrorMessage,
  coonsPatchCornerMismatchMessage,
  createDirectCoordinateSourceHighlights,
  createFillFromClosedPaths,
  createFillFromClosedPathsErrorMessage,
  createCoonsPatchBoundaryDraft,
  createCoonsPatchFromBoundaryPaths,
  createCoonsPatchFromBoundaryPathsErrorMessage,
  createRuledSurfaceBoundaryDraft,
  createRuledSurfaceFromBoundaryPaths,
  createRuledSurfaceFromBoundaryPathsErrorMessage,
  createWorkPlanePointPickingHighlights,
  createCustomWorkPlanePreview,
  createConcatenatedPathDraft,
  createDiagramHistory,
  createSheetPolygonDraft,
  defaultCoonsPatchSampling,
  closeDirectInputDrawerInputMode,
  defaultHemisphereCreationParameters,
  defaultRuledSurfaceSamplingSegments,
  defaultSaddleCreationParameters,
  directInputDrawerStateForInputMode,
  defaultCustomOriginNormalWorkPlaneInput,
  defaultCustomThreePointWorkPlaneInput,
  defaultJsonDownloadFilename,
  defaultTikzExportMode,
  EditableInspector,
  existingCoordinateSourceKey,
  findSelectedElement,
  formatExistingCoordinateSourceLabel,
  fitCameraControlState,
  isLayerSelectableByLayerFilter,
  LayerManager,
  maxCurvedSheetSamplingSegments,
  normalizeLayerFilterForDiagram,
  normalizeJsonDownloadFilename,
  normalizeActiveWorkPlaneForDiagram,
  normalizeActiveWorkPlaneForAmbientDimension,
  parseDirectCoordinateInput,
  parseDirectCoordinateRows,
  parseFiniteNumber,
  parseOpacity,
  parsePositiveFiniteNumber,
  orientedCoonsBoundarySnapshot,
  pickCoonsPatchBoundaryDraftPath,
  pickCoonsPatchBoundaryDraftPoint,
  pickRuledSurfaceBoundaryDraftPath,
  parseDirectLayerInput,
  redoLastDiagramChange,
  removeSelectedElementWithLayerFilter,
  resetCameraControlState,
  resetCoonsPatchBoundaryDraft,
  toggleCoonsPatchBoundaryDraftReverse,
  validateCoonsPatchBoundarySelections,
  setConcatenatedPathDraftSegmentKind,
  resetRuledSurfaceBoundaryDraft,
  ruledSurfaceBoundaryDraftCanCreate,
  ruledSurfaceBoundaryDraftPickedPathIds,
  ruledSurfaceBoundaryDraftStatusMessage,
  ruledSurfaceBoundaryPathIdsFromDraft,
  sheetDraftBlocksWorkPlaneChange,
  shouldShowCameraControls,
  shouldShowWorkPlaneControls,
  undoLastDiagramChange,
  updateDiagramGeometryHandle,
  VariableManager,
  applyCustomOriginNormalWorkPlaneInput,
  applyCustomThreePointWorkPlaneInput,
  applyPickedPointWorkPlane,
  cancelConcatenatedPathDraft,
  cancelWorkPlanePointPicking,
  concatenatedPathDraftBlocksWorkPlaneChange,
  concatenatedPathDraftCanFinish,
  concatenatedPathDraftNextPointLabel,
  inactiveWorkPlanePointPickingState,
  closeInspectorDrawerState,
  defaultInspectorDrawerState,
  isInspectorDrawerOpen,
  nextInspectorDisclosureStateForSelection,
  openInspectorDrawerState,
  pickWorkPlanePointStratum,
  resetWorkPlanePointPicking,
  resolvePointStratumCoordinateForCursorCreation,
  shouldBlockCreationForWorkPlanePointPicking,
  shouldShowWorkPlaneDetails,
  startWorkPlanePointPicking,
  selectedElementDisclosureKey,
  setInspectorDisclosureExpanded,
  inlineMathTikzExportHelp,
  tikzDownloadFilenameForMode,
  tikzExportModeFromSelectValue,
  tikzExportModeOptions,
  undoCoonsPatchBoundaryDraftPick,
  validateWorkPlanePointPickingState,
  undoRuledSurfaceBoundaryDraftPick,
  validateCoonsPatchBoundaryPathSource,
  validateCoonsPatchBoundaryPointSource,
  validateRuledSurfaceBoundaryPathSource,
  workPlanePointPickingStatus,
  workPlaneDisplayName,
  workPlaneSelectValue,
  workPlaneSummaryLabel,
  addPathMenuItems,
  defaultPreviewCoordinateInputMode,
  generateTikzForUi,
  isAddPathTool,
  previewToolbarTopTools,
  runPreviewOverlayAction,
  shouldHandlePreviewCanvasCreationClick,
  shouldShowDirectInputDrawer,
  shouldShowFillPathsForTool,
  stopPreviewOverlayEvent,
  togglePreviewToolbarState,
  type CustomOriginNormalWorkPlaneInput,
  type CustomThreePointWorkPlaneInput,
  type DirectConcatenatedPathManualSegmentInput,
  type DirectCoordinateInput,
  type DirectCoordinateMode,
  type DirectCubicBezierControlMode,
  type DirectGridCreationError,
  type DirectGridInput,
  type DirectInputDrawerState,
  type DirectPathCreationError,
  type DiagramHistory,
  type ExistingCoordinateSource,
  type ExistingCoordinateSourceOption,
  type CameraControlField,
  type CameraDragMode,
  type CameraPresetId,
  type ConcatenatedPathDraft,
  type ConcatenatedPathSegmentKind,
  type ConcatenatedPathWorkPlaneMode,
  type CoonsPatchBoundaryDraft,
  type CoonsPatchBoundaryRole,
  type CoordinateSourceHighlight,
  type CurvedSheetCreationKind,
  type CurvedSheetCreationParameters,
  type GeometryHandleTarget,
  type InspectorDisclosureState,
  type InspectorDrawerState,
  type LayerFilter,
  type PreviewPathMenuItem,
  type PreviewToolbarState,
  type SelectedElement,
  type RuledSurfaceBoundaryDraft,
  type SheetPolygonDraft,
  type WorkPlanePointPickingState,
  type WorkPlaneSelectValue,
  type WorkPlanePreviewTool,
} from './ui'

type ExampleId =
  | 'empty2d'
  | 'empty3d'
  | '2d'
  | '3d'
  | 'referenceFilled'
  | 'evenOddBoundary'
  | 'symbolicCirclePoint'
  | 'symbolicPath'
  | 'grid2d'
  | 'workPlaneGrid3d'
type CopyStatus = 'idle' | 'copied' | 'downloaded' | 'failed'
type SaveLoadStatus = 'idle' | 'saved' | 'loaded' | 'failed'
type StyleImportStatus = 'idle' | 'imported' | 'failed'
type SymbolicImportVariableDraft = {
  name: string
  expression: string
}
type CreationTool = WorkPlanePreviewTool
type DirectCreationTool =
  | 'createPoint'
  | 'createLabel'
  | 'createPolyline'
  | 'createCubicBezier'
  | 'createPath'
  | 'createSheet'
  | 'createGrid'
type DirectCoordinateAxis = 'x' | 'y' | 'z'
type SheetCreationKind =
  | 'polygon'
  | CurvedSheetCreationKind
  | 'ruledSurface'
  | 'coonsPatch'
type DirectPathInputMode = 'manual' | 'circle' | 'ellipse' | 'arc'
type DirectPathManualCoordinateRole = 'center' | 'control1' | 'control2' | 'end'
type DirectPathManualSegmentDraft = {
  kind: ConcatenatedPathSegmentKind
  center: DirectCoordinateInput
  control1: DirectCoordinateInput
  control2: DirectCoordinateInput
  end: DirectCoordinateInput
  radius: string
  endAngleDeg: string
  direction: ArcDirection
}
type DirectPathCoordinateSourceTarget =
  | { kind: 'manualStart' }
  | {
      kind: 'manualSegment'
      segmentIndex: number
      role: DirectPathManualCoordinateRole
    }
  | { kind: 'templateCenter' }
type DirectGridField =
  | 'uMin'
  | 'uMax'
  | 'uStep'
  | 'vMin'
  | 'vMax'
  | 'vStep'
  | 'clipUMin'
  | 'clipUMax'
  | 'clipVMin'
  | 'clipVMax'
type PolylineDraft = {
  points: Vec3[]
} | null
type CubicBezierDraft = {
  points: Vec3[]
} | null
type StyleImportReport = {
  status: StyleImportStatus
  sourceName: string
  importedCount: number
  skippedCount: number
  keys: string[]
  warnings: string[]
  message: string
}

type EditableEditorState = {
  editableDiagram: Diagram
  selectedElement: SelectedElement
  layerFilter: LayerFilter
  polylineDraft: PolylineDraft
  cubicBezierDraft: CubicBezierDraft
  pathDraft: ConcatenatedPathDraft | null
  sheetPolygonDraft: SheetPolygonDraft | null
  layerOperationStatus: string
  history: DiagramHistory
}

type ExampleOption = {
  id: ExampleId
  name: string
  summary: string
  diagram: Diagram
}

const exampleOptions: ExampleOption[] = [
  {
    id: '2d',
    name: '2D example',
    summary: 'codim 1 curves, codim 2 points',
    diagram: twoDimensionalExample,
  },
  {
    id: '3d',
    name: '3D example',
    summary: 'codim 1 sheets, codim 2 curves, codim 3 points',
    diagram: threeDimensionalExample,
  },
  {
    id: 'referenceFilled',
    name: 'Reference fills',
    summary: 'translucent filled regions with solid and dotted curves',
    diagram: translucentFilledStrataExample,
  },
  {
    id: 'evenOddBoundary',
    name: 'Even-odd boundary',
    summary: 'compound filled boundary using the even-odd rule',
    diagram: evenOddFilledBoundaryExample,
  },
  {
    id: 'symbolicCirclePoint',
    name: 'Symbolic point',
    summary: 'point at R*cos(q), R*sin(q)',
    diagram: symbolicCirclePointExample,
  },
  {
    id: 'symbolicPath',
    name: 'Symbolic path',
    summary: 'path vertices driven by variables',
    diagram: symbolicPathExample,
  },
  {
    id: 'grid2d',
    name: '2D grid',
    summary: 'foreach grid with rectangular clip',
    diagram: twoDimensionalGridExample,
  },
  {
    id: 'workPlaneGrid3d',
    name: '3D work-plane grid',
    summary: 'foreach grid in a local work-plane frame',
    diagram: threeDimensionalWorkPlaneGridExample,
  },
  {
    id: 'empty2d',
    name: 'Empty 2D',
    summary: 'blank 2D canvas',
    diagram: emptyTwoDimensionalDiagram,
  },
  {
    id: 'empty3d',
    name: 'Empty 3D',
    summary: 'blank 3D canvas',
    diagram: emptyThreeDimensionalDiagram,
  },
]

const directCoordinateModes: DirectCoordinateMode[] = ['global', 'workPlaneLocal']
const defaultDirectCoordinates: DirectCoordinateInput = {
  x: '0',
  y: '0',
  z: '0',
}
const defaultDirectGridInput: DirectGridInput = {
  uRange: {
    min: '-2',
    max: '2',
    step: '1',
  },
  vRange: {
    min: '-2',
    max: '2',
    step: '1',
  },
  clip: {
    uMin: '-2',
    uMax: '2',
    vMin: '-2',
    vMax: '2',
  },
}
const sheetCreationKinds: Array<{ id: SheetCreationKind; label: string }> = [
  { id: 'polygon', label: 'Polygon' },
  { id: 'hemisphere', label: 'Hemisphere' },
  { id: 'saddle', label: 'Saddle' },
  { id: 'ruledSurface', label: 'Ruled' },
  { id: 'coonsPatch', label: 'Coons' },
]
const concatenatedPathSegmentKinds: Array<{
  id: ConcatenatedPathSegmentKind
  label: string
}> = [
  { id: 'line', label: 'Line' },
  { id: 'cubicBezier', label: 'Cubic Bezier' },
  { id: 'arc', label: 'Arc' },
]
const concatenatedPathWorkPlaneModes: Array<{
  id: ConcatenatedPathWorkPlaneMode
  label: string
}> = [
  { id: 'sameWorkPlane', label: 'Constrain path to one work plane' },
  { id: 'crossWorkPlane', label: 'Allow cross-work-plane path' },
]
const workPlaneKinds: AxisAlignedWorkPlaneName[] = ['xy', 'xz', 'yz']
const workPlaneVectorAxes: Array<keyof CustomOriginNormalWorkPlaneInput['origin']> =
  ['x', 'y', 'z']
const directCubicBezierControlModes: DirectCubicBezierControlMode[] = [
  'absolute',
  'relativeCartesian',
  'relativePolar',
]
const directPathInputModes: Array<{ id: DirectPathInputMode; label: string }> = [
  { id: 'manual', label: 'Manual segments' },
  { id: 'circle', label: 'Circle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'arc', label: 'Arc' },
]
const fillRuleOptions: FillRule[] = ['nonzero', 'evenOdd']
const cameraNumericFields: Array<{ field: CameraControlField; label: string }> = [
  { field: 'thetaDeg', label: 'theta' },
  { field: 'phiDeg', label: 'phi' },
  { field: 'zoom', label: 'zoom' },
  { field: 'panX', label: 'pan x' },
  { field: 'panY', label: 'pan y' },
]
const visibilitySortModeOptions: Array<{
  mode: VisibilitySortMode
  label: string
}> = [
  { mode: 'layerThenDepth', label: 'Layer then depth' },
  { mode: 'depthThenLayer', label: 'Depth then layer' },
]
const hiddenCurveLineStyleOptions: Array<{
  style: HiddenCurveLineStyle
  label: string
}> = [
  { style: 'denselyDotted', label: 'Densely dotted' },
  { style: 'dotted', label: 'Dotted' },
  { style: 'dashed', label: 'Dashed' },
]
const pointVisibilityPolicyOptions: Array<{
  policy: PointVisibilityPolicy
  label: string
}> = [
  { policy: 'dimHidden', label: 'Dim hidden' },
  { policy: 'hideHidden', label: 'Hide hidden' },
]
const labelVisibilityPolicyOptions: Array<{
  policy: LabelVisibilityPolicy
  label: string
}> = [
  { policy: 'alwaysForeground', label: 'Always foreground' },
  { policy: 'autoDim', label: 'Auto dim' },
  { policy: 'autoHide', label: 'Auto hide' },
]
const emptyStyleImportReport: StyleImportReport = {
  status: 'idle',
  sourceName: '',
  importedCount: 0,
  skippedCount: 0,
  keys: [],
  warnings: [],
  message: '',
}

function hiddenCurveLineStyleFromSelectValue(
  value: string,
): HiddenCurveLineStyle {
  return hiddenCurveLineStyles.includes(value as HiddenCurveLineStyle)
    ? (value as HiddenCurveLineStyle)
    : defaultHiddenCurveStyle.lineStyle
}

function pointVisibilityPolicyFromSelectValue(
  value: string,
): PointVisibilityPolicy {
  return pointVisibilityPolicies.includes(value as PointVisibilityPolicy)
    ? (value as PointVisibilityPolicy)
    : defaultVisibilityOptions.pointVisibility
}

function labelVisibilityPolicyFromSelectValue(
  value: string,
): LabelVisibilityPolicy {
  return labelVisibilityPolicies.includes(value as LabelVisibilityPolicy)
    ? (value as LabelVisibilityPolicy)
    : defaultVisibilityOptions.labelVisibility
}

function App() {
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleId>('2d')
  const [coordinateInputMode, setCoordinateInputMode] =
    useState<CoordinateInputMode>(defaultPreviewCoordinateInputMode)
  const [directInputDrawerState, setDirectInputDrawerState] =
    useState<DirectInputDrawerState>(() =>
      directInputDrawerStateForInputMode(defaultPreviewCoordinateInputMode()),
    )
  const [creationTool, setCreationTool] = useState<CreationTool>('select')
  const [previewToolbarState, setPreviewToolbarState] =
    useState<PreviewToolbarState>('expanded')
  const [polylineStatus, setPolylineStatus] = useState<string>('')
  const [cubicBezierStatus, setCubicBezierStatus] = useState<string>('')
  const [pathStatus, setPathStatus] = useState<string>('')
  const [pathSegmentKind, setPathSegmentKind] =
    useState<ConcatenatedPathSegmentKind>('line')
  const [pathWorkPlaneMode, setPathWorkPlaneMode] =
    useState<ConcatenatedPathWorkPlaneMode>('sameWorkPlane')
  const [sheetStatus, setSheetStatus] = useState<string>('')
  const [sheetCreationKind, setSheetCreationKind] =
    useState<SheetCreationKind>('polygon')
  const [hemisphereRadiusInput, setHemisphereRadiusInput] = useState<string>(
    String(defaultHemisphereCreationParameters.radius),
  )
  const [hemisphereSide, setHemisphereSide] = useState(
    defaultHemisphereCreationParameters.hemisphereSide,
  )
  const [hemisphereUSegmentsInput, setHemisphereUSegmentsInput] =
    useState<string>(String(defaultHemisphereCreationParameters.sampling.uSegments))
  const [hemisphereVSegmentsInput, setHemisphereVSegmentsInput] =
    useState<string>(String(defaultHemisphereCreationParameters.sampling.vSegments))
  const [saddleWidthInput, setSaddleWidthInput] = useState<string>(
    String(defaultSaddleCreationParameters.width),
  )
  const [saddleDepthInput, setSaddleDepthInput] = useState<string>(
    String(defaultSaddleCreationParameters.depth),
  )
  const [saddleHeightInput, setSaddleHeightInput] = useState<string>(
    String(defaultSaddleCreationParameters.height),
  )
  const [saddleUSegmentsInput, setSaddleUSegmentsInput] = useState<string>(
    String(defaultSaddleCreationParameters.sampling.uSegments),
  )
  const [saddleVSegmentsInput, setSaddleVSegmentsInput] = useState<string>(
    String(defaultSaddleCreationParameters.sampling.vSegments),
  )
  const [ruledSurfaceSegmentsInput, setRuledSurfaceSegmentsInput] =
    useState<string>(String(defaultRuledSurfaceSamplingSegments))
  const [ruledSurfaceBoundaryDraft, setRuledSurfaceBoundaryDraft] =
    useState<RuledSurfaceBoundaryDraft>(createRuledSurfaceBoundaryDraft)
  const [coonsPatchUSegmentsInput, setCoonsPatchUSegmentsInput] =
    useState<string>(String(defaultCoonsPatchSampling.uSegments))
  const [coonsPatchVSegmentsInput, setCoonsPatchVSegmentsInput] =
    useState<string>(String(defaultCoonsPatchSampling.vSegments))
  const [coonsPatchBoundaryDraft, setCoonsPatchBoundaryDraft] =
    useState<CoonsPatchBoundaryDraft>(createCoonsPatchBoundaryDraft)
  const [directCreationStatus, setDirectCreationStatus] = useState<string>('')
  const [fillBoundaryPathIds, setFillBoundaryPathIds] = useState<string[]>([])
  const [fillRule, setFillRule] = useState<FillRule>('nonzero')
  const [fillStatus, setFillStatus] = useState<string>('')
  const [directCoordinates, setDirectCoordinates] = useState<DirectCoordinateInput>(
    defaultDirectCoordinates,
  )
  const [directCoordinateMode, setDirectCoordinateMode] =
    useState<DirectCoordinateMode>('global')
  const [directLabelText, setDirectLabelText] = useState<string>('Label')
  const [directLayerInput, setDirectLayerInput] = useState<string>('0')
  const [directPolylineRows, setDirectPolylineRows] = useState<string>(
    defaultDirectPolylineRows(2),
  )
  const [directCubicBezierRows, setDirectCubicBezierRows] = useState<string>(
    defaultDirectCubicBezierRows(2),
  )
  const [directCubicBezierControlMode, setDirectCubicBezierControlMode] =
    useState<DirectCubicBezierControlMode>('absolute')
  const [directPathInputMode, setDirectPathInputMode] =
    useState<DirectPathInputMode>('manual')
  const [directPathName, setDirectPathName] = useState<string>('Path')
  const [directPathLabel, setDirectPathLabel] = useState<string>('')
  const [directPathStrokeColor, setDirectPathStrokeColor] = useState<string>(
    defaultCurveStyle.strokeColor,
  )
  const [directPathStrokeOpacity, setDirectPathStrokeOpacity] = useState<string>(
    String(defaultCurveStyle.strokeOpacity),
  )
  const [directPathLineWidth, setDirectPathLineWidth] = useState<string>(
    String(defaultCurveStyle.lineWidth),
  )
  const [directPathLineStyle, setDirectPathLineStyle] = useState<LineStyle>(
    defaultCurveStyle.lineStyle,
  )
  const [directGridName, setDirectGridName] = useState<string>('Grid')
  const [directGridPattern, setDirectGridPattern] =
    useState<LatticePattern>('rectangular')
  const [directGridInput, setDirectGridInput] =
    useState<DirectGridInput>(defaultDirectGridInput)
  const [directGridStrokeColor, setDirectGridStrokeColor] = useState<string>(
    defaultCurveStyle.strokeColor,
  )
  const [directGridStrokeOpacity, setDirectGridStrokeOpacity] = useState<string>(
    String(defaultCurveStyle.strokeOpacity),
  )
  const [directGridLineWidth, setDirectGridLineWidth] = useState<string>(
    String(defaultCurveStyle.lineWidth),
  )
  const [directGridLineStyle, setDirectGridLineStyle] = useState<LineStyle>(
    defaultCurveStyle.lineStyle,
  )
  const [directPathStart, setDirectPathStart] = useState<DirectCoordinateInput>(
    defaultDirectCoordinates,
  )
  const [directPathSegments, setDirectPathSegments] = useState<
    DirectPathManualSegmentDraft[]
  >([defaultDirectPathLineSegment()])
  const [directPathTemplateCenter, setDirectPathTemplateCenter] =
    useState<DirectCoordinateInput>(defaultDirectCoordinates)
  const [directPathCircleRadius, setDirectPathCircleRadius] =
    useState<string>('1')
  const [directPathEllipseRadiusX, setDirectPathEllipseRadiusX] =
    useState<string>('1.5')
  const [directPathEllipseRadiusY, setDirectPathEllipseRadiusY] =
    useState<string>('0.75')
  const [directPathEllipseRotationDeg, setDirectPathEllipseRotationDeg] =
    useState<string>('0')
  const [directPathArcRadius, setDirectPathArcRadius] = useState<string>('1')
  const [directPathArcStartAngleDeg, setDirectPathArcStartAngleDeg] =
    useState<string>('0')
  const [directPathArcEndAngleDeg, setDirectPathArcEndAngleDeg] =
    useState<string>('90')
  const [directPathSourceTargetKey, setDirectPathSourceTargetKey] =
    useState<string>('manual-start')
  const [directSheetRows, setDirectSheetRows] = useState<string>(
    defaultDirectSheetRows(),
  )
  const [directPolylineSources, setDirectPolylineSources] = useState<
    Array<ExistingCoordinateSource | null>
  >([])
  const [directCubicBezierSources, setDirectCubicBezierSources] = useState<
    Array<ExistingCoordinateSource | null>
  >([])
  const [directSheetSources, setDirectSheetSources] = useState<
    Array<ExistingCoordinateSource | null>
  >([])
  const [directSourceTargetRow, setDirectSourceTargetRow] = useState<string>('1')
  const [directSourceKey, setDirectSourceKey] = useState<string>('')
  const [saveLoadStatus, setSaveLoadStatus] = useState<SaveLoadStatus>('idle')
  const [saveLoadMessage, setSaveLoadMessage] = useState<string>('')
  const [pendingSymbolicImport, setPendingSymbolicImport] =
    useState<PendingSymbolicDiagramImport | null>(null)
  const [symbolicImportDrafts, setSymbolicImportDrafts] = useState<
    SymbolicImportVariableDraft[]
  >([])
  const [symbolicImportStatus, setSymbolicImportStatus] = useState<string>('')
  const [styleImportReport, setStyleImportReport] = useState<StyleImportReport>(
    emptyStyleImportReport,
  )
  const [jsonDownloadFilename, setJsonDownloadFilename] = useState<string>(
    defaultJsonDownloadFilename,
  )
  const [includeCoordinateAxesInTikz, setIncludeCoordinateAxesInTikz] =
    useState<boolean>(false)
  const [tikzExportMode, setTikzExportMode] =
    useState<TikzExportMode>(defaultTikzExportMode)
  const [visibilityOptions, setVisibilityOptions] =
    useState<VisibilityOptions>(() =>
      cloneVisibilityOptions(defaultVisibilityOptions),
    )
  const loadFileInputRef = useRef<HTMLInputElement | null>(null)
  const styleImportFileInputRef = useRef<HTMLInputElement | null>(null)
  const geometryDragUndoDiagramRef = useRef<Diagram | null>(null)
  const [activeWorkPlane, setActiveWorkPlane] = useState<WorkPlane>({
    kind: 'xy',
    z: 0,
  })
  const [isWorkPlaneDetailsExpanded, setIsWorkPlaneDetailsExpanded] =
    useState<boolean>(false)
  const [customWorkPlaneInput, setCustomWorkPlaneInput] =
    useState<CustomOriginNormalWorkPlaneInput>(
      defaultCustomOriginNormalWorkPlaneInput,
    )
  const [customThreePointWorkPlaneInput, setCustomThreePointWorkPlaneInput] =
    useState<CustomThreePointWorkPlaneInput>(
      defaultCustomThreePointWorkPlaneInput,
    )
  const [workPlanePointPickingState, setWorkPlanePointPickingState] =
    useState<WorkPlanePointPickingState>(inactiveWorkPlanePointPickingState)
  const [workPlaneStatus, setWorkPlaneStatus] = useState<string>('')
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [cameraControl, setCameraControl] = useState<OrthographicCamera3D>(() =>
    createInitialCameraControlState(),
  )
  const [savedCameraControl, setSavedCameraControl] =
    useState<OrthographicCamera3D>(() => createInitialCameraControlState())
  const [isCameraDetailsExpanded, setIsCameraDetailsExpanded] =
    useState<boolean>(false)
  const [isCameraPanelAside, setIsCameraPanelAside] = useState<boolean>(false)
  const [cameraStatus, setCameraStatus] = useState<string>('')
  const [editorState, setEditorState] = useState<EditableEditorState>(() => {
    const initialDiagram = cloneDiagram(exampleOptions[0].diagram)

    return {
      editableDiagram: initialDiagram,
      selectedElement: null,
      layerFilter: allLayersFilter,
      polylineDraft: null,
      cubicBezierDraft: null,
      pathDraft: null,
      sheetPolygonDraft: null,
      layerOperationStatus: '',
      history: createDiagramHistory(initialDiagram),
    }
  })
  const {
    editableDiagram,
    selectedElement,
    layerFilter,
    polylineDraft,
    cubicBezierDraft,
    pathDraft,
    sheetPolygonDraft,
    layerOperationStatus,
    history,
  } = editorState

  function setLayerOperationStatus(message: string): void {
    setEditorState((current) => ({
      ...current,
      layerOperationStatus: message,
    }))
  }

  const [inspectorDisclosure, setInspectorDisclosure] =
    useState<InspectorDisclosureState>({
      selectionKey: selectedElementDisclosureKey(null),
      expanded: false,
    })
  const [inspectorDrawerState, setInspectorDrawerState] =
    useState<InspectorDrawerState>(() => defaultInspectorDrawerState())
  const [isLayerManagerExpanded, setIsLayerManagerExpanded] = useState(false)
  const selectedInspectorKey = selectedElementDisclosureKey(selectedElement)
  const isInspectorExpanded =
    inspectorDisclosure.selectionKey === selectedInspectorKey &&
    inspectorDisclosure.expanded
  const inspectorDrawerOpen = isInspectorDrawerOpen(inspectorDrawerState)
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const previewCursorCreationClicksEnabled =
    shouldHandlePreviewCanvasCreationClick(creationTool, coordinateInputMode)
  const directInputDrawerVisible = shouldShowDirectInputDrawer(
    creationTool,
    coordinateInputMode,
    directInputDrawerState,
  )
  const boundaryPathClickWorkflow = boundarySurfacePathClickWorkflow({
    tool:
      creationTool === 'select'
        ? 'select'
        : creationTool === 'createSheet'
          ? 'createSheet'
          : 'other',
    sheetCreationKind:
      sheetCreationKind === 'ruledSurface' || sheetCreationKind === 'coonsPatch'
        ? sheetCreationKind
        : 'other',
    workPlanePointPickingActive: workPlanePointPickingState.active,
  })
  const boundaryPathHighlights = createBoundaryPathHighlightsForSheetDraft(
    creationTool,
    sheetCreationKind,
    ruledSurfaceBoundaryDraft,
    coonsPatchBoundaryDraft,
  )
  const directCreateDisabled =
    creationTool === 'createSheet' &&
    ((sheetCreationKind === 'ruledSurface' &&
      !ruledSurfaceBoundaryDraftCanCreate(ruledSurfaceBoundaryDraft)) ||
      (sheetCreationKind === 'coonsPatch' &&
        !coonsPatchBoundaryDraftCanCreateWithCurrentDirections(
          editableDiagram,
          coonsPatchBoundaryDraft,
        )))
  const selectedExample =
    exampleOptions.find((example) => example.id === selectedExampleId) ??
    exampleOptions[0]
  const tikzSource = useMemo(
    () =>
      generateTikzForUi(editableDiagram, {
        exportMode: tikzExportMode,
        includeCoordinateAxesInTikz,
        camera3d:
          editableDiagram.ambientDimension === 3 ? cameraControl : undefined,
        visibility: visibilityOptions,
      }),
    [
      cameraControl,
      editableDiagram,
      includeCoordinateAxesInTikz,
      tikzExportMode,
      visibilityOptions,
    ],
  )
  const existingCoordinateSourceOptions = useMemo(
    () => createExistingCoordinateSourceOptions(editableDiagram),
    [editableDiagram],
  )
  const previewWorkPlane =
    pathDraft?.workPlaneMode === 'sameWorkPlane'
      ? pathDraft.workPlane
      : sheetPolygonDraft?.workPlane ?? activeWorkPlane
  const workPlanePreview = useMemo(() => {
    return createCustomWorkPlanePreview(
      editableDiagram.ambientDimension,
      creationTool,
      previewWorkPlane,
      {
        label:
          pathDraft !== null
            ? `path draft ${workPlaneDisplayName(previewWorkPlane)}`
            : sheetPolygonDraft === null
              ? 'custom work plane'
              : `sheet draft ${workPlaneDisplayName(previewWorkPlane)}`,
      },
    )
  }, [
    creationTool,
    editableDiagram.ambientDimension,
    previewWorkPlane,
    pathDraft,
    sheetPolygonDraft,
  ])
  const directCoordinateSourceHighlights = useMemo(() => {
    if (
      coordinateInputMode !== 'direct' ||
      !isDirectCreationTool(creationTool)
    ) {
      return []
    }

    if (creationTool === 'createPath') {
      const selectedSource = existingCoordinateSourceOptions.find(
        (option) => option.key === directSourceKey,
      )?.source

      return createDirectCoordinateSourceHighlights(editableDiagram, [
        ...directPathCoordinateSourceRequests(),
        ...(selectedSource === undefined
          ? []
          : [
              {
                source: selectedSource,
                label: 'selected',
              },
            ]),
      ])
    }

    if (!usesDirectCoordinateRows(creationTool, sheetCreationKind)) {
      return []
    }

    const activeSources =
      creationTool === 'createPolyline'
        ? directPolylineSources
        : creationTool === 'createCubicBezier'
          ? directCubicBezierSources
          : directSheetSources
    const sourceRequests = activeSources.flatMap((source, index) =>
      source === null
        ? []
        : [
            {
              source,
              label: `row ${index + 1}`,
            },
          ],
    )
    const selectedSource = existingCoordinateSourceOptions.find(
      (option) => option.key === directSourceKey,
    )?.source

    return createDirectCoordinateSourceHighlights(editableDiagram, [
      ...sourceRequests,
      ...(selectedSource === undefined
        ? []
        : [
            {
              source: selectedSource,
              label: 'selected',
            },
          ]),
    ])
  }, [
    coordinateInputMode,
    creationTool,
    directCubicBezierSources,
    directPolylineSources,
    directPathInputMode,
    directPathSegments,
    directPathStart,
    directPathTemplateCenter,
    directSheetSources,
    directSourceKey,
    editableDiagram,
    existingCoordinateSourceOptions,
    sheetCreationKind,
  ])
  const workPlaneCoordinateSourceHighlights = useMemo(
    () =>
      createWorkPlanePointPickingHighlights(
        editableDiagram,
        workPlanePointPickingState,
      ),
    [editableDiagram, workPlanePointPickingState],
  )
  const coordinateSourceHighlights = useMemo<CoordinateSourceHighlight[]>(
    () => [
      ...directCoordinateSourceHighlights,
      ...workPlaneCoordinateSourceHighlights,
    ],
    [directCoordinateSourceHighlights, workPlaneCoordinateSourceHighlights],
  )
  const showWorkPlaneDetails = shouldShowWorkPlaneDetails(
    editableDiagram.ambientDimension,
    isWorkPlaneDetailsExpanded,
  )
  const showCameraControls = shouldShowCameraControls(
    editableDiagram.ambientDimension,
  )
  const showCameraDetails = showCameraControls && isCameraDetailsExpanded
  const activeCameraPresetId = cameraPresetIdForCamera(cameraControl)
  const canResetCameraToSaved =
    showCameraControls && !areCamera3DEqual(cameraControl, savedCameraControl)
  const previewCameraOverride = showCameraControls
    ? cameraOrientationForPreview(cameraControl)
    : undefined
  const previewCameraAdjustment = showCameraControls
    ? cameraViewAdjustmentFromControls(cameraControl)
    : undefined
  const fillBoundaryStatus = `${pickedPathCountLabel(fillBoundaryPathIds.length)}${
    fillStatus.length === 0 ? '' : ` - ${fillStatus}`
  }`
  const showFillPathControls = shouldShowFillPathsForTool(creationTool)

  async function copyTikz(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable.')
      }

      await navigator.clipboard.writeText(tikzSource)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function downloadTikz(): void {
    try {
      const blob = new Blob([tikzSource], { type: 'text/x-tex;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = tikzDownloadFilenameForMode(tikzExportMode)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setCopyStatus('downloaded')
    } catch {
      setCopyStatus('failed')
    }
  }

  function updateCoordinateAxesTikzExport(includeAxes: boolean): void {
    setIncludeCoordinateAxesInTikz(includeAxes)
    setCopyStatus('idle')
  }

  function updateTikzExportMode(mode: TikzExportMode): void {
    setTikzExportMode(mode)
    setCopyStatus('idle')
  }

  function updateAutoVisibility(enabled: boolean): void {
    setVisibilityOptions((current) => ({
      ...current,
      enabled,
    }))
    setCopyStatus('idle')
  }

  function updateSurfaceDepthSort(surfaceDepthSort: boolean): void {
    setVisibilityOptions((current) => ({
      ...current,
      surfaceDepthSort,
    }))
    setCopyStatus('idle')
  }

  function updateCurveOcclusion(curveOcclusion: boolean): void {
    setVisibilityOptions((current) => ({
      ...current,
      curveOcclusion,
    }))
    setCopyStatus('idle')
  }

  function updatePointVisibility(pointVisibility: PointVisibilityPolicy): void {
    setVisibilityOptions((current) => ({
      ...current,
      pointVisibility,
    }))
    setCopyStatus('idle')
  }

  function updateLabelVisibility(labelVisibility: LabelVisibilityPolicy): void {
    setVisibilityOptions((current) => ({
      ...current,
      labelVisibility,
    }))
    setCopyStatus('idle')
  }

  function updateVisibilitySortMode(sortMode: VisibilitySortMode): void {
    setVisibilityOptions((current) => ({
      ...current,
      sortMode,
    }))
    setCopyStatus('idle')
  }

  function updateHiddenCurveLineStyle(lineStyle: HiddenCurveLineStyle): void {
    setVisibilityOptions((current) => ({
      ...current,
      hiddenCurveStyle: {
        ...(current.hiddenCurveStyle ?? defaultHiddenCurveStyle),
        lineStyle,
      },
    }))
    setCopyStatus('idle')
  }

  function updateHiddenCurveOpacity(rawValue: string): void {
    const opacity = Number(rawValue)

    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      return
    }

    setVisibilityOptions((current) => ({
      ...current,
      hiddenCurveStyle: {
        ...(current.hiddenCurveStyle ?? defaultHiddenCurveStyle),
        opacity,
      },
    }))
    setCopyStatus('idle')
  }

  function updateMaxSurfaceFacesForSorting(rawValue: string): void {
    const value = Number(rawValue)

    if (!Number.isFinite(value) || value < 1) {
      return
    }

    setVisibilityOptions((current) => ({
      ...current,
      maxSurfaceFacesForSorting:
        normalizeVisibilityMaxSurfaceFacesForSorting(value),
    }))
    setCopyStatus('idle')
  }

  function updateMaxCurveSamples(rawValue: string): void {
    const value = Number(rawValue)

    if (!Number.isFinite(value) || value < 1) {
      return
    }

    setVisibilityOptions((current) => ({
      ...current,
      maxCurveSamples: normalizeVisibilityMaxCurveSamples(value),
    }))
    setCopyStatus('idle')
  }

  function updateCameraNumericField(
    field: CameraControlField,
    rawValue: string,
  ): void {
    const result = applyCameraNumericInput(cameraControl, field, rawValue)

    if (!result.ok) {
      setCameraStatus(result.message)
      return
    }

    setCameraControl(result.camera)
    setCameraStatus('')
    setCopyStatus('idle')
  }

  function resetCameraViewToInitial(): void {
    setCameraControl(resetCameraControlState())
    setCameraStatus('Camera reset to initial.')
    setCopyStatus('idle')
  }

  function resetCameraViewToSaved(): void {
    setCameraControl(savedCameraControl)
    setCameraStatus('Camera reset to saved.')
    setCopyStatus('idle')
  }

  function fitCameraView(): void {
    setCameraControl((current) => fitCameraControlState(current))
    setCameraStatus('Camera fit to view.')
    setCopyStatus('idle')
  }

  function updateCameraPreset(presetId: CameraPresetId | 'custom'): void {
    if (presetId === 'custom') {
      return
    }

    setCameraControl(createCameraPresetCamera(presetId))
    setCameraStatus('')
    setCopyStatus('idle')
  }

  function toggleCameraPanelAside(): void {
    setIsCameraPanelAside((isAside) => !isAside)
  }

  function handleCameraDrag(delta: Vec2, mode: CameraDragMode): void {
    setCameraControl((current) =>
      mode === 'pan'
        ? applyCameraPanDrag(current, delta)
        : applyCameraOrbitDrag(current, delta),
    )
    setCameraStatus('')
    setCopyStatus('idle')
  }

  function selectExample(exampleId: ExampleId): void {
    const nextExample =
      exampleOptions.find((example) => example.id === exampleId) ?? exampleOptions[0]
    const nextDiagram = cloneDiagram(nextExample.diagram)

    setSelectedExampleId(exampleId)
    updatePreviewCoordinateInputMode(defaultPreviewCoordinateInputMode())
    setVisibilityOptions(
      cloneVisibilityOptions(nextDiagram.view?.visibility ?? defaultVisibilityOptions),
    )
    if (nextDiagram.ambientDimension === 2 && creationTool === 'createSheet') {
      setCreationTool('select')
    }
    setEditorState((current) =>
      commitDiagramChange(current, {
        ...current,
        editableDiagram: nextDiagram,
        selectedElement: clearSelectionIfMissing(
          nextDiagram,
          current.selectedElement,
        ),
        layerFilter: allLayersFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        pathDraft: null,
        sheetPolygonDraft: null,
      }),
    )
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setStyleImportReport(emptyStyleImportReport)
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setLayerOperationStatus('')
    setFillBoundaryPathIds([])
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setFillRule('nonzero')
    setFillStatus('')
    setDirectLayerInput('0')
    setDirectCoordinateMode('global')
    setDirectPolylineRows(defaultDirectPolylineRows(nextDiagram.ambientDimension))
    setDirectCubicBezierControlMode('absolute')
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(nextDiagram.ambientDimension))
    resetDirectPathInput()
    setDirectSheetRows(defaultDirectSheetRows())
    resetDirectCoordinateSources()
    setActiveWorkPlane(
      normalizeActiveWorkPlaneForAmbientDimension(nextDiagram.ambientDimension, {
        kind: 'xy',
        z: 0,
      }),
    )
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setWorkPlaneStatus('')
    const nextCamera = cameraControlStateFromDiagramView(nextDiagram)

    setCameraControl(nextCamera)
    setSavedCameraControl(nextCamera)
    setIsCameraDetailsExpanded(false)
    setCameraStatus('')
  }

  function updateEditableDiagram(update: SetStateAction<Diagram>): void {
    setEditorState((current) => {
      const nextDiagram =
        typeof update === 'function' ? update(current.editableDiagram) : update
      const nextLayerFilter = normalizeLayerFilterForDiagram(
        nextDiagram,
        current.layerFilter,
      )
      const nextSelection = clearSelectionForLayerFilter(
        nextDiagram,
        current.selectedElement,
        nextLayerFilter,
      )

      return commitDiagramChange(current, {
        ...current,
        editableDiagram: nextDiagram,
        selectedElement: nextSelection,
        layerFilter: nextLayerFilter,
      })
    })
    setCopyStatus('idle')
  }

  function setDiagramLayerVisibility(
    layerValue: number,
    visible: boolean,
  ): void {
    updateEditableDiagram((diagram) =>
      setLayerVisibility(diagram, layerValue, visible),
    )
    setLayerOperationStatus(
      `Layer ${formatLayerValue(layerValue)} ${visible ? 'shown' : 'hidden'}.`,
    )
  }

  function setDiagramLayerLock(layerValue: number, locked: boolean): void {
    updateEditableDiagram((diagram) => setLayerLock(diagram, layerValue, locked))
    setLayerOperationStatus(
      `Layer ${formatLayerValue(layerValue)} ${
        locked ? 'locked' : 'unlocked'
      }.`,
    )
  }

  function renameDiagramLayer(layerValue: number, name: string): void {
    updateEditableDiagram((diagram) => renameLayer(diagram, layerValue, name))
    setLayerOperationStatus(`Layer ${formatLayerValue(layerValue)} renamed.`)
  }

  function duplicateDiagramLayer(
    sourceLayerValue: number,
    targetLayerValue?: number,
  ): void {
    setEditorState((current) =>
      applyDuplicateLayerToEditorState(
        current,
        sourceLayerValue,
        targetLayerValue,
      )
    )
    setCopyStatus('idle')
  }

  function swapDiagramLayers(
    leftLayerValue: number,
    rightLayerValue: number,
  ): void {
    setEditorState((current) =>
      applySwapLayersToEditorState(current, leftLayerValue, rightLayerValue),
    )
    setCopyStatus('idle')
  }

  function translateDiagramLayer(layerValue: number, translation: Vec3): void {
    setEditorState((current) =>
      applyTranslateLayerToEditorState(current, layerValue, translation),
    )
    setCopyStatus('idle')
  }

  function deleteDiagramLayer(layerValue: number): void {
    const layerLabel = formatLayerValue(layerValue)
    const elementCount = elementsOnLayer(editableDiagram, layerValue).length
    const elementLabel = elementCount === 1 ? 'element' : 'elements'

    if (
      !window.confirm(
        `Delete layer ${layerLabel} and ${elementCount} ${elementLabel}? This can be undone.`,
      )
    ) {
      setLayerOperationStatus('Delete canceled.')
      return
    }

    setEditorState((current) =>
      applyDeleteLayerToEditorState(current, layerValue),
    )
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setFillBoundaryPathIds([])
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setFillStatus('')
    resetDirectPathInput()
    resetDirectCoordinateSources()
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setWorkPlaneStatus('')
    setCopyStatus('idle')
  }

  const undoLastChange = useCallback(function undoLastChange(): void {
    if (!canUndo) {
      return
    }

    const previousDiagram = history.past[history.past.length - 1]

    setSelectedExampleId(previousDiagram.ambientDimension === 2 ? '2d' : '3d')
    geometryDragUndoDiagramRef.current = null
    setEditorState((current) => undoLastDiagramChange(current))
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setStyleImportReport(emptyStyleImportReport)
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setLayerOperationStatus('')
    setFillBoundaryPathIds([])
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setFillStatus('')
    setWorkPlaneStatus('')
  }, [canUndo, history.past])

  const redoLastChange = useCallback(function redoLastChange(): void {
    if (!canRedo) {
      return
    }

    const nextDiagram = history.future[0]

    setSelectedExampleId(nextDiagram.ambientDimension === 2 ? '2d' : '3d')
    geometryDragUndoDiagramRef.current = null
    setEditorState((current) => redoLastDiagramChange(current))
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setCopyStatus('idle')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('')
    setStyleImportReport(emptyStyleImportReport)
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setLayerOperationStatus('')
    setFillBoundaryPathIds([])
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setFillStatus('')
    setWorkPlaneStatus('')
  }, [canRedo, history.future])

  function downloadJson(): void {
    try {
      const serialized = serializeDiagram(
        editableDiagram,
        createSerializeDiagramOptionsForUi(editableDiagram, {
          exportMode: tikzExportMode,
          includeCoordinateAxesInTikz,
          camera3d: showCameraControls ? cameraControl : undefined,
          visibility: visibilityOptions,
        }),
      )
      const blob = new Blob([serialized], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = normalizeJsonDownloadFilename(jsonDownloadFilename)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      if (showCameraControls) {
        setSavedCameraControl(cameraControl)
      }
      setSaveLoadStatus('saved')
      setSaveLoadMessage('JSON downloaded.')
    } catch {
      setSaveLoadStatus('failed')
      setSaveLoadMessage('Save failed.')
    }
  }

  function openLoadJsonPicker(): void {
    loadFileInputRef.current?.click()
  }

  function openStyleImportPicker(): void {
    styleImportFileInputRef.current?.click()
  }

  async function importTikzStyleFileFromPicker(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (file === undefined) {
      return
    }

    if (!/\.(sty|tex)$/i.test(file.name)) {
      setStyleImportReport({
        ...emptyStyleImportReport,
        status: 'failed',
        sourceName: file.name,
        message: 'Style import failed: choose a .sty or .tex file.',
      })
      return
    }

    let text: string

    try {
      text = await file.text()
    } catch {
      setStyleImportReport({
        ...emptyStyleImportReport,
        status: 'failed',
        sourceName: file.name,
        message: 'Style import failed: could not read the file.',
      })
      return
    }

    const result = importTikzStyleFile(editableDiagram, file.name, text)
    const importedCount = result.references.length
    const skippedCount = result.parseResult.skipped
    const warnings = [
      ...result.parseResult.warnings.map((warning) => warning.message),
      ...(importedCount > 0
        ? [
            'External style files are not embedded; load them in LaTeX before compiling.',
            'SVG preview is approximate for imported TikZ styles.',
          ]
        : []),
    ]

    if (importedCount > 0) {
      updateEditableDiagram(result.diagram)
    }

    setStyleImportReport({
      status: importedCount > 0 ? 'imported' : 'failed',
      sourceName: file.name,
      importedCount,
      skippedCount,
      keys: result.references.map((reference) => reference.key),
      warnings,
      message:
        importedCount > 0
          ? `Imported ${importedCount} style${importedCount === 1 ? '' : 's'}.`
          : 'Style import failed: no supported \\tikzset style entries found.',
    })
  }

  function commitLoadedJsonDiagram(
    diagram: Diagram,
    warnings: readonly string[],
  ): void {
    setPendingSymbolicImport(null)
    setSymbolicImportDrafts([])
    setSymbolicImportStatus('')
    setSelectedExampleId(diagram.ambientDimension === 2 ? '2d' : '3d')
    setCreationTool('select')
    updatePreviewCoordinateInputMode(defaultPreviewCoordinateInputMode())
    setEditorState((current) =>
      commitDiagramChange(current, {
        ...current,
        editableDiagram: diagram,
        selectedElement: null,
        layerFilter: allLayersFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        pathDraft: null,
        sheetPolygonDraft: null,
      }),
    )
    setCopyStatus('idle')
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setDirectCreationStatus('')
    setLayerOperationStatus('')
    setStyleImportReport(emptyStyleImportReport)
    setFillBoundaryPathIds([])
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setFillRule('nonzero')
    setFillStatus('')
    setDirectLayerInput('0')
    setDirectCoordinateMode('global')
    setDirectPolylineRows(defaultDirectPolylineRows(diagram.ambientDimension))
    setDirectCubicBezierControlMode('absolute')
    setDirectCubicBezierRows(defaultDirectCubicBezierRows(diagram.ambientDimension))
    setDirectSheetRows(defaultDirectSheetRows())
    resetDirectCoordinateSources()
    setActiveWorkPlane({ kind: 'xy', z: 0 })
    setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    setWorkPlaneStatus('')
    const loadedCamera = cameraControlStateFromDiagramView(diagram)

    setCameraControl(loadedCamera)
    setSavedCameraControl(loadedCamera)
    setIsCameraDetailsExpanded(false)
    setCameraStatus('')
    setIncludeCoordinateAxesInTikz(
      diagram.ambientDimension === 3
        ? diagram.view?.showCoordinateAxesInTikz ?? false
        : false,
    )
    setTikzExportMode(diagram.view?.exportMode ?? defaultTikzExportMode)
    setVisibilityOptions(
      cloneVisibilityOptions(
        diagram.view?.visibility ?? defaultVisibilityOptions,
      ),
    )
    setSaveLoadStatus('loaded')
    setSaveLoadMessage(
      warnings.length === 0
        ? 'JSON loaded.'
        : `JSON loaded. ${warnings.join(' ')}`,
    )
  }

  async function loadJsonFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (file === undefined) {
      return
    }

    let text: string

    try {
      text = await file.text()
    } catch {
      setSaveLoadStatus('failed')
      setSaveLoadMessage('Could not read JSON file.')
      return
    }

    const result = parseSavedDiagramJsonForImport(text)

    if (!result.ok) {
      setPendingSymbolicImport(null)
      setSymbolicImportDrafts([])
      setSymbolicImportStatus('')
      setSaveLoadStatus('failed')
      setSaveLoadMessage(result.error)
      return
    }

    if (result.kind === 'needsVariableResolution') {
      setPendingSymbolicImport(result.pendingImport)
      setSymbolicImportDrafts(
        result.pendingImport.variables.map((variable) => ({
          name: variable.name,
          expression: variable.expression,
        })),
      )
      setSymbolicImportStatus('')
      setSaveLoadStatus('idle')
      setSaveLoadMessage(
        `This diagram uses symbolic variables. Please assign values to: ${result.pendingImport.variables
          .map((variable) => variable.name)
          .join(', ')}.`,
      )
      return
    }

    commitLoadedJsonDiagram(result.diagram, result.warnings)
  }

  function updateSymbolicImportDraft(name: string, expression: string): void {
    setSymbolicImportDrafts((current) =>
      current.map((draft) =>
        draft.name === name ? { ...draft, expression } : draft,
      ),
    )
    setSymbolicImportStatus('')
  }

  function cancelSymbolicImport(): void {
    setPendingSymbolicImport(null)
    setSymbolicImportDrafts([])
    setSymbolicImportStatus('')
    setSaveLoadStatus('idle')
    setSaveLoadMessage('JSON load canceled.')
  }

  function confirmSymbolicImport(): void {
    if (pendingSymbolicImport === null) {
      return
    }

    const result = resolvePendingSymbolicDiagramImport(
      pendingSymbolicImport,
      symbolicImportDrafts,
    )

    if (!result.ok) {
      setSymbolicImportStatus(result.error)
      setSaveLoadStatus('failed')
      setSaveLoadMessage(result.error)
      return
    }

    commitLoadedJsonDiagram(result.diagram, result.warnings)
  }

  function updateSelectedElement(selection: SelectedElement): void {
    setEditorState((current) => ({
      ...current,
      selectedElement: clearSelectionForLayerFilter(
        current.editableDiagram,
        selection,
        current.layerFilter,
      ),
    }))
  }

  function updateInspectorExpanded(expanded: boolean): void {
    setInspectorDisclosure((current) =>
      setInspectorDisclosureExpanded(current, selectedElement, expanded),
    )
  }

  function openInspectorDrawer(): void {
    setInspectorDrawerState(openInspectorDrawerState())
  }

  function closeInspectorDrawer(): void {
    setInspectorDrawerState(closeInspectorDrawerState())
  }

  const removeCurrentSelection = useCallback(function removeCurrentSelection(): void {
    if (selectedElement === null) {
      return
    }

    setEditorState((current) => {
      const result = removeSelectedElementWithLayerFilter(
        current.editableDiagram,
        current.selectedElement,
        current.layerFilter,
      )

      if (
        !result.removed &&
        current.selectedElement === result.selectedElement &&
        current.layerFilter === result.layerFilter &&
        current.polylineDraft === null &&
        current.cubicBezierDraft === null &&
        current.pathDraft === null &&
        current.sheetPolygonDraft === null
      ) {
        return current
      }

      return commitDiagramChange(current, {
        ...current,
        editableDiagram: result.diagram,
        selectedElement: result.selectedElement,
        layerFilter: result.layerFilter,
        polylineDraft: null,
        cubicBezierDraft: null,
        pathDraft: null,
        sheetPolygonDraft: null,
      })
    })
    setPolylineStatus('')
    setCubicBezierStatus('')
    setPathStatus('')
    setSheetStatus('')
    setCopyStatus('idle')
  }, [selectedElement])

  function pickSelectedFillBoundaryPath(): void {
    const selected = findSelectedElement(editableDiagram, selectedElement)

    if (
      selected === null ||
      selected.kind !== 'stratum' ||
      selected.element.geometricKind !== 'curve' ||
      selected.element.kind !== 'concatenatedPath'
    ) {
      setFillStatus('Select a concatenated path first.')
      return
    }

    const pathId = selected.element.id

    if (fillBoundaryPathIds.includes(pathId)) {
      setFillStatus('Path already picked.')
      return
    }

    setFillBoundaryPathIds((current) => [...current, pathId])
    setFillStatus(`Picked ${selected.element.name}.`)
  }

  function resetFillBoundaryPathPicking(): void {
    setFillBoundaryPathIds([])
    setFillStatus('Picked paths reset.')
  }

  function cancelFillBoundaryPathPicking(): void {
    setFillBoundaryPathIds([])
    setFillStatus('Fill creation canceled.')
  }

  function createFillFromPickedPaths(): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setFillStatus('Finish or cancel point picking first.')
      return
    }

    const creationLayer = parseNewElementLayer(setFillStatus)

    if (creationLayer === null) {
      return
    }

    const result = createFillFromClosedPaths(
      editableDiagram,
      fillBoundaryPathIds,
      {
        fillRule,
        activeWorkPlane,
        layer: creationLayer,
      },
    )

    if (!result.ok) {
      setFillStatus(createFillFromClosedPathsErrorMessage(result.error))
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      creationLayer,
    )
    setFillBoundaryPathIds([])
    setCreationTool('select')
    setFillStatus(
      `${result.kind === 'filledRegion' ? 'Filled region' : 'Filled sheet'} created.`,
    )
    setCopyStatus('idle')
  }

  function pickRuledSurfaceBoundaryPath(pathId: string): void {
    const draftResult = pickRuledSurfaceBoundaryDraftPath(
      ruledSurfaceBoundaryDraft,
      pathId,
    )

    if (!draftResult.ok) {
      setSheetStatus(boundarySurfaceDraftPickErrorMessage(draftResult.error))
      return
    }

    const sourceResult = validateRuledSurfaceBoundaryPathSource(
      editableDiagram,
      pathId,
    )

    if (!sourceResult.ok) {
      setSheetStatus(
        boundarySurfaceBoundaryPathSourceErrorMessage(sourceResult.error),
      )
      return
    }

    setRuledSurfaceBoundaryDraft(draftResult.draft)
    setSheetStatus(ruledSurfaceBoundaryDraftStatusMessage(draftResult.draft))
  }

  function resetRuledSurfaceBoundaryPicking(): void {
    const draft = resetRuledSurfaceBoundaryDraft()

    setRuledSurfaceBoundaryDraft(draft)
    setSheetStatus('Ruled surface boundary picks reset. Pick first boundary path.')
  }

  function undoRuledSurfaceBoundaryPicking(): void {
    const draft = undoRuledSurfaceBoundaryDraftPick(ruledSurfaceBoundaryDraft)

    setRuledSurfaceBoundaryDraft(draft)
    setSheetStatus(ruledSurfaceBoundaryDraftStatusMessage(draft))
  }

  function createRuledSurfaceFromPickedPaths(
    creationLayer: number,
    setStatus: (message: string) => void,
  ): boolean {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setStatus('Finish or cancel point picking first.')
      return false
    }

    const samplingSegments = parseSamplingInput(
      ruledSurfaceSegmentsInput,
      'Ruled surface sampling segments',
      setStatus,
    )

    if (samplingSegments === null) {
      return false
    }

    const result = createRuledSurfaceFromBoundaryPaths(
      editableDiagram,
      ruledSurfaceBoundaryPathIdsFromDraft(ruledSurfaceBoundaryDraft),
      {
        layer: creationLayer,
        samplingSegments,
      },
    )

    if (!result.ok) {
      setStatus(createRuledSurfaceFromBoundaryPathsErrorMessage(result.error))
      return false
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      creationLayer,
    )
    setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    setSheetStatus('Ruled surface created.')
    setDirectCreationStatus('Ruled surface created.')
    setCopyStatus('idle')
    return true
  }

  function pickCoonsPatchBoundaryPath(pathId: string): void {
    const draftResult = pickCoonsPatchBoundaryDraftPath(
      coonsPatchBoundaryDraft,
      pathId,
    )

    if (!draftResult.ok) {
      setSheetStatus(boundarySurfaceDraftPickErrorMessage(draftResult.error))
      return
    }

    const sourceResult = validateCoonsPatchBoundaryPathSource(
      editableDiagram,
      pathId,
    )

    if (!sourceResult.ok) {
      setSheetStatus(coonsPatchBoundaryPathSourceErrorMessage(sourceResult.error))
      return
    }

    setCoonsPatchBoundaryDraft(draftResult.draft)
    setSheetStatus(
      coonsPatchBoundaryDraftStatusForUi(editableDiagram, draftResult.draft),
    )
  }

  function pickCoonsPatchBoundaryPoint(pointId: string): void {
    const draftResult = pickCoonsPatchBoundaryDraftPoint(
      coonsPatchBoundaryDraft,
      pointId,
    )

    if (!draftResult.ok) {
      setSheetStatus(boundarySurfaceDraftPickErrorMessage(draftResult.error))
      return
    }

    const sourceResult = validateCoonsPatchBoundaryPointSource(
      editableDiagram,
      pointId,
    )

    if (!sourceResult.ok) {
      setSheetStatus(coonsPatchBoundaryPointSourceErrorMessage(sourceResult.error))
      return
    }

    setCoonsPatchBoundaryDraft(draftResult.draft)
    setSheetStatus(
      coonsPatchBoundaryDraftStatusForUi(editableDiagram, draftResult.draft),
    )
  }

  function resetCoonsPatchBoundaryPicking(): void {
    const draft = resetCoonsPatchBoundaryDraft()

    setCoonsPatchBoundaryDraft(draft)
    setSheetStatus(
      'Coons patch boundary picks reset. Pick bottom boundary path or point.',
    )
  }

  function undoCoonsPatchBoundaryPicking(): void {
    const draft = undoCoonsPatchBoundaryDraftPick(coonsPatchBoundaryDraft)

    setCoonsPatchBoundaryDraft(draft)
    setSheetStatus(coonsPatchBoundaryDraftStatusForUi(editableDiagram, draft))
  }

  function toggleCoonsPatchBoundaryDirection(
    role: CoonsPatchBoundaryRole,
  ): void {
    const draft = toggleCoonsPatchBoundaryDraftReverse(
      coonsPatchBoundaryDraft,
      role,
    )

    setCoonsPatchBoundaryDraft(draft)
    setSheetStatus(coonsPatchBoundaryDraftStatusForUi(editableDiagram, draft))
    setDirectCreationStatus('')
  }

  function handleBoundarySurfaceCurveClick(pathId: string): void {
    if (boundaryPathClickWorkflow === 'ruledSurface') {
      pickRuledSurfaceBoundaryPath(pathId)
      return
    }

    if (boundaryPathClickWorkflow === 'coonsPatch') {
      pickCoonsPatchBoundaryPath(pathId)
    }
  }

  function handleCoonsPatchBoundaryPointClick(pointId: string): boolean {
    if (boundaryPathClickWorkflow !== 'coonsPatch') {
      return false
    }

    pickCoonsPatchBoundaryPoint(pointId)
    return true
  }

  function createCoonsPatchFromPickedPaths(
    creationLayer: number,
    setStatus: (message: string) => void,
  ): boolean {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setStatus('Finish or cancel point picking first.')
      return false
    }

    const uSegments = parseSamplingInput(
      coonsPatchUSegmentsInput,
      'Coons patch u segments',
      setStatus,
    )
    const vSegments = parseSamplingInput(
      coonsPatchVSegmentsInput,
      'Coons patch v segments',
      setStatus,
    )

    if (uSegments === null || vSegments === null) {
      return false
    }

    const result = createCoonsPatchFromBoundaryPaths(
      editableDiagram,
      coonsPatchBoundarySelectionsFromDraft(coonsPatchBoundaryDraft),
      {
        layer: creationLayer,
        sampling: { uSegments, vSegments },
      },
    )

    if (!result.ok) {
      const mismatchMessage =
        result.error === 'invalidBoundary'
          ? coonsPatchCornerMismatchMessage(
              editableDiagram,
              coonsPatchBoundarySelectionsFromDraft(coonsPatchBoundaryDraft),
            )
          : null

      setStatus(
        mismatchMessage ??
          createCoonsPatchFromBoundaryPathsErrorMessage(result.error, result.role),
      )
      return false
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      creationLayer,
    )
    setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    setSheetStatus('Coons patch created.')
    setDirectCreationStatus('Coons patch created.')
    setCopyStatus('idle')
    return true
  }

  useEffect(() => {
    setInspectorDisclosure((current) =>
      nextInspectorDisclosureStateForSelection(current, selectedElement),
    )
  }, [selectedElement])

  useEffect(() => {
    if (layerFilter.kind === 'layer') {
      setDirectLayerInput(String(layerFilter.layer))
    }
  }, [layerFilter])

  useEffect(() => {
    setActiveWorkPlane((current) =>
      normalizeActiveWorkPlaneForDiagram(editableDiagram, current),
    )
  }, [editableDiagram])

  useEffect(() => {
    if (editableDiagram.ambientDimension === 2) {
      setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
      setIsWorkPlaneDetailsExpanded(false)
      setWorkPlaneStatus('')
      setIsCameraDetailsExpanded(false)
      setCameraStatus('')
    }
  }, [editableDiagram.ambientDimension])

  useEffect(() => {
    setWorkPlanePointPickingState((current) => {
      const validation = validateWorkPlanePointPickingState(
        editableDiagram,
        current,
      )

      if (validation.removedStalePointIds.length > 0) {
        setWorkPlaneStatus(
          `${workPlanePointPickingStatus(validation.state)} Removed unavailable points.`,
        )
      }

      return validation.state
    })
  }, [editableDiagram])

  useEffect(() => {
    setFillBoundaryPathIds((current) => {
      const next = current.filter((pathId) =>
        editableDiagram.strata.some(
          (stratum) =>
            stratum.id === pathId &&
            stratum.geometricKind === 'curve' &&
            stratum.kind === 'concatenatedPath',
        ),
      )

      if (next.length === current.length) {
        return current
      }

      setFillStatus('Removed unavailable picked paths.')

      return next
    })
  }, [editableDiagram])

  useEffect(() => {
    function handleRemoveShortcut(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        (event.key !== 'Delete' && event.key !== 'Backspace') ||
        isEditableKeyboardTarget(event.target) ||
        selectedElement === null
      ) {
        return
      }

      event.preventDefault()
      removeCurrentSelection()
    }

    window.addEventListener('keydown', handleRemoveShortcut)

    return () => {
      window.removeEventListener('keydown', handleRemoveShortcut)
    }
  }, [removeCurrentSelection, selectedElement])

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || isEditableKeyboardTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const usesCommandModifier = event.metaKey || event.ctrlKey
      const shouldUndo = key === 'z' && usesCommandModifier && !event.shiftKey
      const shouldRedo =
        (key === 'z' && usesCommandModifier && event.shiftKey) ||
        (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey)

      if (shouldUndo && canUndo) {
        event.preventDefault()
        undoLastChange()
        return
      }

      if (shouldRedo && canRedo) {
        event.preventDefault()
        redoLastChange()
      }
    }

    window.addEventListener('keydown', handleHistoryShortcut)

    return () => {
      window.removeEventListener('keydown', handleHistoryShortcut)
    }
  }, [canRedo, canUndo, redoLastChange, undoLastChange])

  function updateLayerFilter(nextFilter: LayerFilter): void {
    setEditorState((current) => {
      const normalizedFilter = normalizeLayerFilterForDiagram(
        current.editableDiagram,
        nextFilter,
      )

      return {
        ...current,
        layerFilter: normalizedFilter,
        selectedElement: clearSelectionForLayerFilter(
          current.editableDiagram,
          current.selectedElement,
          normalizedFilter,
        ),
      }
    })
  }

  function updatePreviewCoordinateInputMode(mode: CoordinateInputMode): void {
    setCoordinateInputMode(mode)
    setDirectInputDrawerState(directInputDrawerStateForInputMode(mode))
  }

  function closeDirectInputDrawer(): void {
    updatePreviewCoordinateInputMode(closeDirectInputDrawerInputMode())
    setDirectCreationStatus('')
  }

  function updateCreationTool(tool: CreationTool): void {
    if (
      tool === 'createSheet' &&
      editorState.editableDiagram.ambientDimension !== 3
    ) {
      return
    }

    setCreationTool(tool)
    setDirectCreationStatus('')

    if (
      tool !== 'createPolyline' &&
      tool !== 'createCubicBezier' &&
      tool !== 'createPath' &&
      tool !== 'createSheet'
    ) {
      setEditorState((current) =>
        current.polylineDraft === null &&
        current.cubicBezierDraft === null &&
        current.pathDraft === null &&
        current.sheetPolygonDraft === null
          ? current
          : {
              ...current,
              polylineDraft: null,
              cubicBezierDraft: null,
              pathDraft: null,
              sheetPolygonDraft: null,
            },
      )
      setPolylineStatus('')
      setCubicBezierStatus('')
      setPathStatus('')
      setSheetStatus('')
      setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
      setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
      return
    }

    setEditorState((current) => ({
      ...current,
      polylineDraft: tool === 'createPolyline' ? current.polylineDraft : null,
      cubicBezierDraft:
        tool === 'createCubicBezier' ? current.cubicBezierDraft : null,
      pathDraft: tool === 'createPath' ? current.pathDraft : null,
      sheetPolygonDraft:
        tool === 'createSheet' ? current.sheetPolygonDraft : null,
    }))
    setPolylineStatus(
      tool === 'createPolyline' ? 'Click the preview to add vertices.' : '',
    )
    setCubicBezierStatus(
      tool === 'createCubicBezier'
        ? 'Click Start, Control 1, Control 2, then End.'
        : '',
    )
    setPathStatus(
      tool === 'createPath'
        ? `Click the preview to place the path ${concatenatedPathDraftNextPointLabel(
            pathDraft,
          )}.`
        : '',
    )
    setSheetStatus(
      tool === 'createSheet' ? sheetCreationStatusPrompt(sheetCreationKind) : '',
    )
  }

  function activateCursorCreationTool(tool: CreationTool): void {
    updatePreviewCoordinateInputMode(defaultPreviewCoordinateInputMode())
    updateCreationTool(tool)
  }

  function activateDirectCreationTool(tool: DirectCreationTool): void {
    updatePreviewCoordinateInputMode('direct')
    updateCreationTool(tool)
  }

  function activatePathMenuItem(item: PreviewPathMenuItem): void {
    updatePreviewCoordinateInputMode(item.inputMode)

    if (item.directPathInputMode !== undefined) {
      setDirectPathInputMode(item.directPathInputMode)
      setDirectPathSourceTargetKey(
        item.directPathInputMode === 'manual' ? 'manual-start' : 'template-center',
      )
      setDirectCreationStatus('')
    }

    updateCreationTool(item.tool)

    if (item.tool === 'createPath' && item.segmentKind !== undefined) {
      updatePathSegmentKind(item.segmentKind)
    }
  }

  function activateSheetCreationKind(kind: SheetCreationKind): void {
    updatePreviewCoordinateInputMode(defaultPreviewCoordinateInputMode())
    updateSheetCreationKind(kind)
    updateCreationTool('createSheet')
  }

  function togglePreviewToolbar(): void {
    setPreviewToolbarState((current) => togglePreviewToolbarState(current))
  }

  function updateSheetCreationKind(kind: SheetCreationKind): void {
    if (kind === sheetCreationKind) {
      setDirectCreationStatus('')
      setSheetStatus(currentBoundarySurfaceDraftStatus())
      return
    }

    setSheetCreationKind(kind)
    setDirectCreationStatus('')
    if (kind !== 'ruledSurface') {
      setRuledSurfaceBoundaryDraft(resetRuledSurfaceBoundaryDraft())
    }
    if (kind !== 'coonsPatch') {
      setCoonsPatchBoundaryDraft(resetCoonsPatchBoundaryDraft())
    }
    if (kind !== 'polygon') {
      setDirectSheetSources([])
      setDirectSourceTargetRow('1')
      setDirectSourceKey('')
    }
    setEditorState((current) =>
      kind === 'polygon' || current.sheetPolygonDraft === null
        ? current
        : {
            ...current,
            sheetPolygonDraft: null,
          },
    )
    setSheetStatus(sheetCreationStatusPrompt(kind))
  }

  function currentBoundarySurfaceDraftStatus(): string {
    if (sheetCreationKind === 'ruledSurface') {
      return ruledSurfaceBoundaryDraftStatusMessage(ruledSurfaceBoundaryDraft)
    }

    if (sheetCreationKind === 'coonsPatch') {
      return coonsPatchBoundaryDraftStatusMessage(coonsPatchBoundaryDraft)
    }

    return sheetCreationStatusPrompt(sheetCreationKind)
  }

  function handlePreviewCreationClick(
    svgPoint: Vec2,
    viewportHeight: number,
    previewCamera: Camera,
  ): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      return
    }

    if (creationTool === 'select') {
      return
    }

    if (
      !shouldHandlePreviewCanvasCreationClick(
        creationTool,
        coordinateInputMode,
      )
    ) {
      return
    }

    if (
      creationTool === 'createSheet' &&
      isBoundarySurfaceSheetCreationKind(sheetCreationKind)
    ) {
      setSheetStatus(currentBoundarySurfaceDraftStatus())
      return
    }

    const placementWorkPlane =
      creationTool === 'createPath' &&
      pathDraft !== null &&
      pathDraft.workPlaneMode === 'sameWorkPlane'
        ? pathDraft.workPlane
        : creationTool === 'createSheet' && sheetPolygonDraft !== null
          ? sheetPolygonDraft.workPlane
          : activeWorkPlane
    let modelPoint: Vec3

    try {
      modelPoint = normalizePointForAmbientDimension(
        editableDiagram.ambientDimension,
        svgPointToModelOnWorkPlane(
          previewCamera,
          svgPoint,
          viewportHeight,
          placementWorkPlane,
        ),
      )
    } catch {
      setCursorCreationSourceStatus('Click did not intersect the active work plane.')
      return
    }

    applyCursorCreationPoint(modelPoint)
  }

  function handleExistingPointSourceCreationClick(pointId: string): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      return
    }

    if (creationTool === 'select') {
      return
    }

    if (handleCoonsPatchBoundaryPointClick(pointId)) {
      return
    }

    if (
      !shouldHandlePreviewCanvasCreationClick(
        creationTool,
        coordinateInputMode,
      )
    ) {
      return
    }

    if (
      creationTool === 'createSheet' &&
      isBoundarySurfaceSheetCreationKind(sheetCreationKind)
    ) {
      setSheetStatus(currentBoundarySurfaceDraftStatus())
      return
    }

    const placementWorkPlane =
      creationTool === 'createPath' &&
      pathDraft !== null &&
      pathDraft.workPlaneMode === 'sameWorkPlane'
        ? pathDraft.workPlane
        : creationTool === 'createSheet' && sheetPolygonDraft !== null
          ? sheetPolygonDraft.workPlane
          : activeWorkPlane
    const sourceResult = resolvePointStratumCoordinateForCursorCreation(
      editableDiagram,
      pointId,
      {
        workPlane: placementWorkPlane,
        requireWorkPlaneMembership:
          creationTool === 'createPath' &&
          (pathDraft?.workPlaneMode ?? pathWorkPlaneMode) === 'crossWorkPlane'
            ? false
            : true,
      },
    )

    if (!sourceResult.ok) {
      setCursorCreationSourceStatus(
        sourceResult.reason === 'missingSource'
          ? 'Existing point source is unavailable.'
          : 'Existing point source is off the active work plane.',
      )
      return
    }

    applyCursorCreationPoint(sourceResult.point)
    setCursorCreationSourceStatus(
      `Copied ${formatExistingCoordinateSourceLabel(
        editableDiagram,
        sourceResult.source,
        editableDiagram.ambientDimension,
      )}.`,
    )
  }

  function applyCursorCreationPoint(modelPoint: Vec3): void {
    const activeCreationTool = creationTool

    switch (activeCreationTool) {
      case 'select':
        return
      case 'createGrid':
        setDirectCreationStatus('Use the direct input panel to create a grid.')
        return
      case 'createPath': {
        const result =
          pathDraft === null
            ? createConcatenatedPathDraft(
                modelPoint,
                activeWorkPlane,
                pathSegmentKind,
                editableDiagram.ambientDimension,
                pathWorkPlaneMode,
              )
            : appendConcatenatedPathDraftPoint(
                pathDraft,
                modelPoint,
                editableDiagram.ambientDimension,
              )

        if (!result.ok) {
          setPathStatus(concatenatedPathDraftPointErrorMessage(result.reason))
          return
        }

        setEditorState((current) => ({
          ...current,
          polylineDraft: null,
          cubicBezierDraft: null,
          pathDraft: result.draft,
          sheetPolygonDraft: null,
        }))
        setPathStatus(concatenatedPathDraftStatusMessage(result.draft))
        return
      }
      case 'createPolyline':
      case 'createCubicBezier':
      case 'createSheet':
      case 'createPoint':
      case 'createLabel':
        break
    }

    const nextCubicBezierPointCount =
      activeCreationTool === 'createCubicBezier'
        ? (cubicBezierDraft?.points.length ?? 0) + 1
        : 0
    const shouldCommitOnClick =
      activeCreationTool === 'createPoint' ||
      activeCreationTool === 'createLabel' ||
      (activeCreationTool === 'createCubicBezier' &&
        nextCubicBezierPointCount >= 4) ||
      (activeCreationTool === 'createSheet' &&
        isAnchorCurvedSheetCreationKind(sheetCreationKind))
    const cursorCreationLayer = shouldCommitOnClick
      ? parseNewElementLayer(
          activeCreationTool === 'createCubicBezier'
            ? setCubicBezierStatus
            : activeCreationTool === 'createSheet'
              ? setSheetStatus
              : setDirectCreationStatus,
        )
      : null

    if (shouldCommitOnClick && cursorCreationLayer === null) {
      return
    }

    const curvedSheetParameters =
      activeCreationTool === 'createSheet' &&
      isAnchorCurvedSheetCreationKind(sheetCreationKind)
        ? parseCurvedSheetCreationParameters(setSheetStatus)
        : null

    if (
      activeCreationTool === 'createSheet' &&
      isAnchorCurvedSheetCreationKind(sheetCreationKind) &&
      curvedSheetParameters === null
    ) {
      return
    }

    if (activeCreationTool === 'createPolyline') {
      setPolylineStatus(
        `${(polylineDraft?.points.length ?? 0) + 1} vertices in draft.`,
      )
    }

    if (activeCreationTool === 'createCubicBezier') {
      setCubicBezierStatus(
        nextCubicBezierPointCount >= 4
          ? 'Cubic Bezier created.'
          : `${nextCubicBezierPointCount}/4 Bezier points placed.`,
      )
    }

    if (activeCreationTool === 'createSheet') {
      setSheetStatus(
        sheetCreationKind === 'polygon'
          ? `${(sheetPolygonDraft?.points.length ?? 0) + 1} sheet vertices in draft.`
          : `${sheetCreationKindLabel(sheetCreationKind)} created.`,
      )
    }

    setEditorState((current) => {
      if (activeCreationTool === 'createPolyline') {
        const draftPoints = current.polylineDraft?.points ?? []

        return {
          ...current,
          polylineDraft: {
            points: [...draftPoints, modelPoint],
          },
          cubicBezierDraft: null,
          pathDraft: null,
          sheetPolygonDraft: null,
        }
      }

      if (activeCreationTool === 'createCubicBezier') {
        const draftPoints = current.cubicBezierDraft?.points ?? []
        const nextPoints = [...draftPoints, modelPoint]

        if (nextPoints.length < 4) {
          return {
            ...current,
            polylineDraft: null,
            cubicBezierDraft: {
              points: nextPoints,
            },
            pathDraft: null,
            sheetPolygonDraft: null,
          }
        }

        const result = addCubicBezierCurveStratumWithResult(
          current.editableDiagram,
          nextPoints,
          { layer: cursorCreationLayer ?? undefined },
        )

        if (result.id === null) {
          return {
            ...current,
            cubicBezierDraft: null,
            pathDraft: null,
            sheetPolygonDraft: null,
          }
        }

        return commitDiagramChange(
          current,
          applyCreatedElementToEditorState(
            current,
            result.diagram,
            { kind: 'stratum', id: result.id },
            cursorCreationLayer ?? 0,
          ),
        )
      }

      if (activeCreationTool === 'createSheet') {
        if (current.editableDiagram.ambientDimension !== 3) {
          return current
        }

        if (isBoundarySurfaceSheetCreationKind(sheetCreationKind)) {
          return current
        }

        if (curvedSheetParameters !== null) {
          const result = addCurvedSheetStratumWithResult(
            current.editableDiagram,
            modelPoint,
            activeWorkPlane,
            curvedSheetParameters,
            { layer: cursorCreationLayer ?? undefined },
          )

          if (result.id === null) {
            return current
          }

          return commitDiagramChange(
            current,
            applyCreatedElementToEditorState(
              current,
              result.diagram,
              { kind: 'stratum', id: result.id },
              cursorCreationLayer ?? 0,
            ),
          )
        }

        return {
          ...current,
          polylineDraft: null,
          cubicBezierDraft: null,
          pathDraft: null,
          sheetPolygonDraft:
            current.sheetPolygonDraft === null
              ? createSheetPolygonDraft(modelPoint, activeWorkPlane)
              : appendSheetPolygonDraftPoint(
                  current.sheetPolygonDraft,
                  modelPoint,
                ),
        }
      }

      if (activeCreationTool === 'createPoint') {
        const result = addPointStratumWithResult(
          current.editableDiagram,
          modelPoint,
          { layer: cursorCreationLayer ?? undefined },
        )

        return commitDiagramChange(
          current,
          applyCreatedElementToEditorState(
            current,
            result.diagram,
            { kind: 'stratum', id: result.id },
            cursorCreationLayer ?? 0,
          ),
        )
      }

      if (activeCreationTool === 'createLabel') {
        const result = addTextLabelWithResult(
          current.editableDiagram,
          modelPoint,
          { layer: cursorCreationLayer ?? undefined },
        )

        return commitDiagramChange(
          current,
          applyCreatedElementToEditorState(
            current,
            result.diagram,
            { kind: 'label', id: result.id },
            cursorCreationLayer ?? 0,
          ),
        )
      }

      return current
    })

    if (activeCreationTool !== 'createPolyline') {
      setCopyStatus('idle')
    }
  }

  function setCursorCreationSourceStatus(message: string): void {
    switch (creationTool) {
      case 'createPolyline':
        setPolylineStatus(message)
        break
      case 'createCubicBezier':
        setCubicBezierStatus(message)
        break
      case 'createPath':
        setPathStatus(message)
        break
      case 'createSheet':
        setSheetStatus(message)
        break
      case 'createPoint':
      case 'createLabel':
      case 'createGrid':
      case 'select':
        setDirectCreationStatus(message)
        break
    }
  }

  function handleGeometryHandleDrag(
    target: GeometryHandleTarget,
    svgPoint: Vec2,
    viewportHeight: number,
    previewCamera: Camera,
  ): void {
    if (creationTool !== 'select') {
      return
    }

    setEditorState((current) => {
      if (!geometryHandleTargetsSelection(target, current.selectedElement)) {
        return current
      }

      const selected = findSelectedElement(
        current.editableDiagram,
        current.selectedElement,
      )

      if (selected === null) {
        return {
          ...current,
          selectedElement: null,
        }
      }

      if (
        !isLayerSelectableByLayerFilter(
          current.editableDiagram,
          current.layerFilter,
          selected.element.layer,
        )
      ) {
        return current
      }

      let modelPoint: Vec3
      const handleWorkPlane =
        selected.element.geometricKind === 'label'
          ? activeWorkPlane
          : geometryHandleWorkPlaneForTarget(target, selected.element) ??
            activeWorkPlane

      try {
        modelPoint = normalizePointForAmbientDimension(
          current.editableDiagram.ambientDimension,
          svgPointToModelOnWorkPlane(
            previewCamera,
            svgPoint,
            viewportHeight,
            handleWorkPlane,
          ),
        )
      } catch {
        return current
      }

      const nextDiagram = updateDiagramGeometryHandle(
        current.editableDiagram,
        target,
        modelPoint,
      )

      if (nextDiagram === current.editableDiagram) {
        return current
      }

      return commitDiagramChange(
        current,
        {
          ...current,
          editableDiagram: nextDiagram,
          selectedElement: clearSelectionForLayerFilter(
            nextDiagram,
            current.selectedElement,
            current.layerFilter,
          ),
          layerFilter: normalizeLayerFilterForDiagram(
            nextDiagram,
            current.layerFilter,
          ),
          polylineDraft: null,
          cubicBezierDraft: null,
          pathDraft: null,
          sheetPolygonDraft: null,
        },
        {
          undoSourceDiagram:
            geometryDragUndoDiagramRef.current ?? current.editableDiagram,
        },
      )
    })
    setCopyStatus('idle')
  }

  function handleGeometryHandleDragStart(): void {
    geometryDragUndoDiagramRef.current = cloneDiagram(editableDiagram)
  }

  function handleGeometryHandleDragEnd(): void {
    geometryDragUndoDiagramRef.current = null
  }

  function updateDirectCoordinate(axis: DirectCoordinateAxis, value: string): void {
    setDirectCoordinates((current) => ({
      ...current,
      [axis]: value,
    }))
    setDirectCreationStatus('')
  }

  function updateDirectPathStartCoordinate(
    axis: DirectCoordinateAxis,
    value: string,
  ): void {
    setDirectPathStart((current) => ({
      ...current,
      [axis]: value,
    }))
    setDirectCreationStatus('')
  }

  function updateDirectPathTemplateCenterCoordinate(
    axis: DirectCoordinateAxis,
    value: string,
  ): void {
    setDirectPathTemplateCenter((current) => ({
      ...current,
      [axis]: value,
    }))
    setDirectCreationStatus('')
  }

  function updateDirectPathSegmentKind(
    segmentIndex: number,
    kind: ConcatenatedPathSegmentKind,
  ): void {
    setDirectPathSegments((current) =>
      current.map((segment, index) =>
        index === segmentIndex ? { ...segment, kind } : segment,
      ),
    )
    setDirectCreationStatus('')
  }

  function updateDirectPathSegmentCoordinate(
    segmentIndex: number,
    role: DirectPathManualCoordinateRole,
    axis: DirectCoordinateAxis,
    value: string,
  ): void {
    setDirectPathSegments((current) =>
      current.map((segment, index) =>
        index === segmentIndex
          ? {
              ...segment,
              [role]: {
                ...segment[role],
                [axis]: value,
              },
            }
          : segment,
      ),
    )
    setDirectCreationStatus('')
  }

  function updateDirectPathSegmentText(
    segmentIndex: number,
    field: 'radius' | 'endAngleDeg',
    value: string,
  ): void {
    setDirectPathSegments((current) =>
      current.map((segment, index) =>
        index === segmentIndex
          ? {
              ...segment,
              [field]: value,
            }
          : segment,
      ),
    )
    setDirectCreationStatus('')
  }

  function updateDirectPathSegmentDirection(
    segmentIndex: number,
    direction: ArcDirection,
  ): void {
    setDirectPathSegments((current) =>
      current.map((segment, index) =>
        index === segmentIndex
          ? {
              ...segment,
              direction,
            }
          : segment,
      ),
    )
    setDirectCreationStatus('')
  }

  function applyExistingSourceToDirectPathCoordinate(): void {
    const sourceOption = existingCoordinateSourceOptions.find(
      (option) => option.key === directSourceKey,
    )
    const target = directPathCoordinateSourceTargetFromKey(
      directPathSourceTargetKey,
    )

    if (sourceOption === undefined || target === null) {
      setDirectCreationStatus('Choose a valid existing coordinate source.')
      return
    }

    updateDirectPathCoordinateSource(target, sourceOption.source)
    setDirectCreationStatus(
      `${directPathCoordinateSourceTargetLabel(target)} uses ${sourceOption.label}.`,
    )
  }

  function clearExistingSourceFromDirectPathCoordinate(): void {
    const target = directPathCoordinateSourceTargetFromKey(
      directPathSourceTargetKey,
    )

    if (target === null) {
      return
    }

    updateDirectPathCoordinateSource(target, null)
    setDirectCreationStatus('')
  }

  function updateDirectPathCoordinateSource(
    target: DirectPathCoordinateSourceTarget,
    source: ExistingCoordinateSource | null,
  ): void {
    switch (target.kind) {
      case 'manualStart':
        setDirectPathStart((current) => directCoordinateInputWithSource(current, source))
        return
      case 'templateCenter':
        setDirectPathTemplateCenter((current) =>
          directCoordinateInputWithSource(current, source),
        )
        return
      case 'manualSegment':
        setDirectPathSegments((current) =>
          current.map((segment, index) =>
            index === target.segmentIndex
              ? {
                  ...segment,
                  [target.role]: directCoordinateInputWithSource(
                    segment[target.role],
                    source,
                  ),
                }
              : segment,
          ),
        )
        return
    }
  }

  function addDirectPathSegment(kind: ConcatenatedPathSegmentKind): void {
    setDirectPathSegments((current) => [
      ...current,
      kind === 'line'
        ? defaultDirectPathLineSegment()
        : kind === 'cubicBezier'
          ? defaultDirectPathCubicSegment()
          : defaultDirectPathArcSegment(),
    ])
    setDirectCreationStatus('')
  }

  function removeLastDirectPathSegment(): void {
    setDirectPathSegments((current) =>
      current.length <= 1 ? current : current.slice(0, -1),
    )
    setDirectCreationStatus('')
  }

  function resetDirectPathInput(): void {
    setDirectPathInputMode('manual')
    setDirectPathName('Path')
    setDirectPathLabel('')
    setDirectPathStrokeColor(defaultCurveStyle.strokeColor)
    setDirectPathStrokeOpacity(String(defaultCurveStyle.strokeOpacity))
    setDirectPathLineWidth(String(defaultCurveStyle.lineWidth))
    setDirectPathLineStyle(defaultCurveStyle.lineStyle)
    setDirectPathStart(defaultDirectCoordinates)
    setDirectPathSegments([defaultDirectPathLineSegment()])
    setDirectPathTemplateCenter(defaultDirectCoordinates)
    setDirectPathCircleRadius('1')
    setDirectPathEllipseRadiusX('1.5')
    setDirectPathEllipseRadiusY('0.75')
    setDirectPathEllipseRotationDeg('0')
    setDirectPathArcRadius('1')
    setDirectPathArcStartAngleDeg('0')
    setDirectPathArcEndAngleDeg('90')
    setDirectPathSourceTargetKey('manual-start')
  }

  function updateDirectGridField(field: DirectGridField, value: string): void {
    setDirectGridInput((current) => {
      switch (field) {
        case 'uMin':
          return { ...current, uRange: { ...current.uRange, min: value } }
        case 'uMax':
          return { ...current, uRange: { ...current.uRange, max: value } }
        case 'uStep':
          return {
            ...current,
            uRange: { ...current.uRange, step: value },
            vRange:
              directGridPattern === 'rectangular'
                ? current.vRange
                : { ...current.vRange, step: value },
          }
        case 'vMin':
          return { ...current, vRange: { ...current.vRange, min: value } }
        case 'vMax':
          return { ...current, vRange: { ...current.vRange, max: value } }
        case 'vStep':
          return { ...current, vRange: { ...current.vRange, step: value } }
        case 'clipUMin':
          return { ...current, clip: { ...current.clip, uMin: value } }
        case 'clipUMax':
          return { ...current, clip: { ...current.clip, uMax: value } }
        case 'clipVMin':
          return { ...current, clip: { ...current.clip, vMin: value } }
        case 'clipVMax':
          return { ...current, clip: { ...current.clip, vMax: value } }
      }
    })
    setDirectCreationStatus('')
  }

  function updateDirectRowsForCreationTool(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
    value: string,
  ): void {
    switch (tool) {
      case 'createPolyline':
        setDirectPolylineRows(value)
        break
      case 'createCubicBezier':
        setDirectCubicBezierRows(value)
        break
      case 'createSheet':
        setDirectSheetRows(value)
        break
    }
    setDirectCreationStatus('')
  }

  function resetDirectCoordinateSources(): void {
    setDirectPolylineSources([])
    setDirectCubicBezierSources([])
    setDirectSheetSources([])
    setDirectSourceTargetRow('1')
    setDirectSourceKey('')
  }

  function updateDirectCubicBezierControlMode(
    mode: DirectCubicBezierControlMode,
  ): void {
    const coordinateMode = effectiveDirectCoordinateMode(
      editableDiagram.ambientDimension,
      directCoordinateMode,
    )
    const nextMode =
      isDirectCubicBezierControlModeAvailable(
        editableDiagram.ambientDimension,
        coordinateMode,
        mode,
      )
        ? mode
        : 'absolute'

    setDirectCubicBezierControlMode(nextMode)
    setDirectCubicBezierRows(
      defaultDirectCubicBezierRows(
        editableDiagram.ambientDimension,
        nextMode,
        coordinateMode,
      ),
    )
    setDirectCubicBezierSources([])
    setDirectCreationStatus('')
  }

  function updateDirectCoordinateMode(mode: DirectCoordinateMode): void {
    const nextMode = effectiveDirectCoordinateMode(
      editableDiagram.ambientDimension,
      mode,
    )
    const nextCubicBezierControlMode =
      isDirectCubicBezierControlModeAvailable(
        editableDiagram.ambientDimension,
        nextMode,
        directCubicBezierControlMode,
      )
        ? directCubicBezierControlMode
        : 'absolute'

    setDirectCoordinateMode(nextMode)
    setDirectCubicBezierControlMode(nextCubicBezierControlMode)
    setDirectPolylineRows(
      defaultDirectPolylineRows(editableDiagram.ambientDimension, nextMode),
    )
    setDirectCubicBezierRows(
      defaultDirectCubicBezierRows(
        editableDiagram.ambientDimension,
        nextCubicBezierControlMode,
        nextMode,
      ),
    )
    setDirectSheetRows(defaultDirectSheetRows(nextMode))
    resetDirectCoordinateSources()
    setDirectCreationStatus('')
  }

  function updateNewElementLayerInput(value: string): void {
    setDirectLayerInput(value)
    setDirectCreationStatus('')
  }

  function parseNewElementLayer(
    setStatus: (message: string) => void,
  ): number | null {
    const layer = parseDirectLayerInput(directLayerInput)

    if (layer === null) {
      setStatus('Layer must be a finite number.')
      return null
    }

    if (isLayerLocked(editableDiagram, layer)) {
      setStatus('Layer is locked. Unlock it before creating on this layer.')
      return null
    }

    return layer
  }

  function parseCurvedSheetCreationParameters(
    setStatus: (message: string) => void,
  ): CurvedSheetCreationParameters | null {
    if (!isAnchorCurvedSheetCreationKind(sheetCreationKind)) {
      return null
    }

    if (sheetCreationKind === 'hemisphere') {
      const radius = parsePositiveInput(
        hemisphereRadiusInput,
        'Hemisphere radius',
        setStatus,
      )
      const uSegments = parseSamplingInput(
        hemisphereUSegmentsInput,
        'Hemisphere u segments',
        setStatus,
      )
      const vSegments = parseSamplingInput(
        hemisphereVSegmentsInput,
        'Hemisphere v segments',
        setStatus,
      )

      return radius === null || uSegments === null || vSegments === null
        ? null
        : {
            kind: 'hemisphere',
            radius,
            hemisphereSide,
            sampling: { uSegments, vSegments },
          }
    }

    const width = parsePositiveInput(saddleWidthInput, 'Saddle width', setStatus)
    const depth = parsePositiveInput(saddleDepthInput, 'Saddle depth', setStatus)
    const height = parseFiniteInput(saddleHeightInput, 'Saddle height', setStatus)
    const uSegments = parseSamplingInput(
      saddleUSegmentsInput,
      'Saddle u segments',
      setStatus,
    )
    const vSegments = parseSamplingInput(
      saddleVSegmentsInput,
      'Saddle v segments',
      setStatus,
    )

    return width === null ||
      depth === null ||
      height === null ||
      uSegments === null ||
      vSegments === null
      ? null
      : {
          kind: 'saddle',
          width,
          depth,
          height,
          sampling: { uSegments, vSegments },
        }
  }

  function createDirectElement(): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setDirectCreationStatus('Finish or cancel point picking first.')
      return
    }

    if (!isDirectCreationTool(creationTool)) {
      return
    }

    const directLayer = parseNewElementLayer(setDirectCreationStatus)

    if (directLayer === null) {
      return
    }

    if (creationTool === 'createPoint') {
      const result = addPointStratumFromDirectInput(
        editableDiagram,
        directCoordinates,
        directCreationCoordinateOptions({ layer: directLayer }),
      )

      if (!result.ok) {
        setDirectCreationStatus('Coordinates must be valid finite expressions.')
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'stratum', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Point created.')
      setCopyStatus('idle')
      return
    }

    if (creationTool === 'createLabel') {
      const result = addTextLabelFromDirectInput(
        editableDiagram,
        directCoordinates,
        directLabelText,
        directCreationCoordinateOptions({ layer: directLayer }),
      )

      if (!result.ok) {
        setDirectCreationStatus('Coordinates must be valid finite expressions.')
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'label', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Label created.')
      setCopyStatus('idle')
      return
    }

    if (creationTool === 'createPath') {
      createDirectPath(directLayer)
      return
    }

    if (creationTool === 'createSheet') {
      createDirectSheet(directLayer)
      return
    }

    if (creationTool === 'createGrid') {
      createDirectGrid(directLayer)
      return
    }

    const coordinateRows = parseDirectCoordinateRows(
      directRowsForCreationTool(creationTool),
      editableDiagram.ambientDimension,
      {
        coordinateMode: effectiveDirectCoordinateMode(
          editableDiagram.ambientDimension,
          directCoordinateMode,
        ),
      },
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be valid coordinate rows.')
      return
    }

    if (creationTool === 'createPolyline') {
      const sourcedRows = applyDirectCoordinateSources(
        coordinateRows,
        directPolylineSources,
      )
      const result = addPolylineCurveFromDirectInput(
        editableDiagram,
        sourcedRows,
        directCreationCoordinateOptions({ layer: directLayer }),
      )

      if (!result.ok) {
        setDirectCreationStatus(directCreationErrorMessage(result.error, 'polyline'))
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'stratum', id: result.id },
        directLayer,
      )
      setDirectCreationStatus('Polyline created.')
      setCopyStatus('idle')
      return
    }

    const result = addCubicBezierCurveFromDirectInput(
      editableDiagram,
      applyDirectCoordinateSources(coordinateRows, directCubicBezierSources),
      directCreationCoordinateOptions({
        layer: directLayer,
        directControlMode: directCubicBezierControlMode,
      }),
    )

    if (!result.ok) {
      setDirectCreationStatus(
        directCreationErrorMessage(result.error, 'cubicBezier'),
      )
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Cubic Bezier created.')
    setCopyStatus('idle')
  }

  function createDirectPath(directLayer: number): void {
    const style = parseDirectPathStyle()

    if (style === null) {
      return
    }

    const options = directCreationCoordinateOptions({
      layer: directLayer,
      name: directPathName,
      pathLabel: directPathLabel,
      style,
    })
    const result =
      directPathInputMode === 'manual'
        ? addConcatenatedPathFromDirectInput(
            editableDiagram,
            {
              start: directPathStart,
              segments: directPathSegments.map(directPathSegmentInputFromDraft),
            },
            options,
          )
        : directPathInputMode === 'circle'
          ? addCirclePathFromDirectInput(
              editableDiagram,
              {
                center: directPathTemplateCenter,
                radius: directPathCircleRadius,
              },
              options,
            )
          : directPathInputMode === 'ellipse'
            ? addEllipsePathFromDirectInput(
                editableDiagram,
                {
                  center: directPathTemplateCenter,
                  radiusX: directPathEllipseRadiusX,
                  radiusY: directPathEllipseRadiusY,
                  rotationDeg: directPathEllipseRotationDeg,
                },
                options,
              )
            : addArcPathFromDirectInput(
                editableDiagram,
                {
                  center: directPathTemplateCenter,
                  radius: directPathArcRadius,
                  startAngleDeg: directPathArcStartAngleDeg,
                  endAngleDeg: directPathArcEndAngleDeg,
                },
                options,
              )

    if (!result.ok) {
      setDirectCreationStatus(directCreationErrorMessage(result.error, 'path'))
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Path created.')
    setPathStatus('')
    setCopyStatus('idle')
  }

  function parseDirectPathStyle(): CurveStyle | null {
    if (!isHexColor(directPathStrokeColor)) {
      setDirectCreationStatus('Path stroke color must be a #RRGGBB hex color.')
      return null
    }

    const strokeOpacity = parseOpacity(directPathStrokeOpacity)

    if (strokeOpacity === null) {
      setDirectCreationStatus('Path stroke opacity must be between 0 and 1.')
      return null
    }

    const lineWidth = parsePositiveFiniteNumber(directPathLineWidth)

    if (lineWidth === null) {
      setDirectCreationStatus('Path line width must be positive.')
      return null
    }

    return {
      kind: 'curveStyle',
      strokeColor: directPathStrokeColor as HexColor,
      strokeOpacity,
      lineWidth,
      lineStyle: directPathLineStyle,
    }
  }

  function createDirectGrid(directLayer: number): void {
    const style = parseDirectGridStyle()

    if (style === null) {
      return
    }

    const result = addGridStratumFromDirectInput(
      editableDiagram,
      directGridInput,
      activeWorkPlane,
      {
        diagram: editableDiagram,
        layer: directLayer,
        name: directGridName,
        latticePattern: directGridPattern,
        style,
      },
    )

    if (!result.ok) {
      setDirectCreationStatus(
        directGridCreationErrorMessage(result.error, result.message),
      )
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Grid created.')
    setCopyStatus('idle')
  }

  function parseDirectGridStyle(): CurveStyle | null {
    if (!isHexColor(directGridStrokeColor)) {
      setDirectCreationStatus('Grid stroke color must be a #RRGGBB hex color.')
      return null
    }

    const strokeOpacity = parseOpacity(directGridStrokeOpacity)

    if (strokeOpacity === null) {
      setDirectCreationStatus('Grid stroke opacity must be between 0 and 1.')
      return null
    }

    const lineWidth = parsePositiveFiniteNumber(directGridLineWidth)

    if (lineWidth === null) {
      setDirectCreationStatus('Grid line width must be positive.')
      return null
    }

    return {
      kind: 'curveStyle',
      strokeColor: directGridStrokeColor as HexColor,
      strokeOpacity,
      lineWidth,
      lineStyle: directGridLineStyle,
    }
  }

  function createDirectSheet(directLayer: number): void {
    if (sheetCreationKind === 'ruledSurface') {
      createRuledSurfaceFromPickedPaths(directLayer, setDirectCreationStatus)
      return
    }

    if (sheetCreationKind === 'coonsPatch') {
      createCoonsPatchFromPickedPaths(directLayer, setDirectCreationStatus)
      return
    }

    if (isAnchorCurvedSheetCreationKind(sheetCreationKind)) {
      const anchorPoint = parseDirectCoordinateInput(
        directCoordinates,
        editableDiagram.ambientDimension,
        directCreationCoordinateOptions({}),
      )
      const parameters = parseCurvedSheetCreationParameters(setDirectCreationStatus)

      if (anchorPoint === null) {
        setDirectCreationStatus('Coordinates must be valid finite expressions.')
        return
      }

      if (hasSymbolicVec3Coordinates(anchorPoint)) {
        setDirectCreationStatus(
          'Curved sheet anchor coordinates must be numeric in this phase.',
        )
        return
      }

      if (parameters === null) {
        return
      }

      const result = addCurvedSheetStratumWithResult(
        editableDiagram,
        anchorPoint,
        activeWorkPlane,
        parameters,
        { layer: directLayer },
      )

      if (result.id === null) {
        setDirectCreationStatus('Curved sheet parameters must be valid.')
        return
      }

      commitCreatedElement(
        result.diagram,
        { kind: 'stratum', id: result.id },
        directLayer,
      )
      setDirectCreationStatus(`${sheetCreationKindLabel(sheetCreationKind)} created.`)
      setCopyStatus('idle')
      return
    }

    const coordinateRows = parseDirectCoordinateRows(
      directSheetRows,
      editableDiagram.ambientDimension,
      {
        coordinateMode: effectiveDirectCoordinateMode(
          editableDiagram.ambientDimension,
          directCoordinateMode,
        ),
      },
    )

    if (coordinateRows === null) {
      setDirectCreationStatus('Coordinates must be valid coordinate rows.')
      return
    }

    const result = addPolygonSheetFromDirectInput(
      editableDiagram,
      applyDirectCoordinateSources(coordinateRows, directSheetSources),
      directCreationCoordinateOptions({ layer: directLayer }),
    )

    if (!result.ok) {
      setDirectCreationStatus(directCreationErrorMessage(result.error, 'sheet'))
      return
    }

    commitCreatedElement(
      result.diagram,
      { kind: 'stratum', id: result.id },
      directLayer,
    )
    setDirectCreationStatus('Sheet created.')
    setCopyStatus('idle')
  }

  function commitCreatedElement(
    diagram: Diagram,
    selection: Exclude<SelectedElement, null>,
    layer: number,
  ): void {
    setEditorState((current) =>
      commitDiagramChange(
        current,
        applyCreatedElementToEditorState(current, diagram, selection, layer),
      ),
    )
  }

  function applyCreatedElementToEditorState(
    current: EditableEditorState,
    diagram: Diagram,
    selection: Exclude<SelectedElement, null>,
    layer: number,
  ): EditableEditorState {
    const visibleDiagram = isLayerVisible(diagram, layer)
      ? diagram
      : setLayerVisibility(diagram, layer, true)
    const commit = commitDirectCreationResult(
      visibleDiagram,
      selection,
      layer,
      current.layerFilter,
    )

    return {
      ...applyDirectCreationCommitToEditorState(current, commit),
      polylineDraft: null,
      cubicBezierDraft: null,
      pathDraft: null,
      sheetPolygonDraft: null,
    }
  }

  function directRowsForCreationTool(tool: 'createPolyline' | 'createCubicBezier'): string {
    return tool === 'createPolyline' ? directPolylineRows : directCubicBezierRows
  }

  function directCreationCoordinateOptions<T extends object>(options: T): T & {
    coordinateMode: DirectCoordinateMode
    workPlane: WorkPlane
  } {
    return {
      ...options,
      coordinateMode: effectiveDirectCoordinateMode(
        editableDiagram.ambientDimension,
        directCoordinateMode,
      ),
      workPlane: activeWorkPlane,
    }
  }

  function applyExistingSourceToDirectRow(): void {
    if (
      !isDirectCreationTool(creationTool) ||
      !usesDirectCoordinateRows(creationTool, sheetCreationKind)
    ) {
      return
    }

    const sourceOption = existingCoordinateSourceOptions.find(
      (option) => option.key === directSourceKey,
    )
    const targetRow = Number(directSourceTargetRow)

    if (sourceOption === undefined || !Number.isInteger(targetRow) || targetRow < 1) {
      setDirectCreationStatus('Choose a valid existing coordinate source.')
      return
    }

    updateDirectSourceForTool(creationTool, targetRow - 1, sourceOption.source)
    setDirectCreationStatus(`Row ${targetRow} uses ${sourceOption.label}.`)
  }

  function clearExistingSourceFromDirectRow(): void {
    if (
      !isDirectCreationTool(creationTool) ||
      !usesDirectCoordinateRows(creationTool, sheetCreationKind)
    ) {
      return
    }

    const targetRow = Number(directSourceTargetRow)

    if (!Number.isInteger(targetRow) || targetRow < 1) {
      return
    }

    updateDirectSourceForTool(creationTool, targetRow - 1, null)
    setDirectCreationStatus('')
  }

  function updateDirectSourceForTool(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
    rowIndex: number,
    source: ExistingCoordinateSource | null,
  ): void {
    const updateSources = (
      sources: Array<ExistingCoordinateSource | null>,
    ): Array<ExistingCoordinateSource | null> => {
      const nextSources = [...sources]
      nextSources[rowIndex] = source
      return nextSources
    }

    switch (tool) {
      case 'createPolyline':
        setDirectPolylineSources(updateSources)
        break
      case 'createCubicBezier':
        setDirectCubicBezierSources(updateSources)
        break
      case 'createSheet':
        setDirectSheetSources(updateSources)
        break
    }
  }

  function directRowsForCreationToolValue(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
  ): string {
    switch (tool) {
      case 'createPolyline':
        return directPolylineRows
      case 'createCubicBezier':
        return directCubicBezierRows
      case 'createSheet':
        return directSheetRows
    }
  }

  function directSourcesForCreationToolValue(
    tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
  ): Array<ExistingCoordinateSource | null> {
    switch (tool) {
      case 'createPolyline':
        return directPolylineSources
      case 'createCubicBezier':
        return directCubicBezierSources
      case 'createSheet':
        return directSheetSources
    }
  }

  function renderDirectGridControls() {
    return (
      <div className="direct-grid-form">
        <label className="direct-create-field direct-path-name-field">
          <span>Grid name</span>
          <input
            type="text"
            value={directGridName}
            onChange={(event) => {
              setDirectGridName(event.currentTarget.value)
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="direct-create-field">
          <span>Grid pattern</span>
          <select
            value={directGridPattern}
            onChange={(event) => {
              const nextPattern = event.currentTarget.value as LatticePattern

              setDirectGridPattern(nextPattern)
              if (nextPattern !== 'rectangular') {
                setDirectGridInput((current) => ({
                  ...current,
                  vRange: {
                    ...current.vRange,
                    step: current.uRange.step,
                  },
                }))
              }
              setDirectCreationStatus('')
            }}
          >
            {latticePatterns.map((pattern) => (
              <option key={pattern} value={pattern}>
                {latticePatternLabel(pattern)}
              </option>
            ))}
          </select>
        </label>
        <div
          className="direct-path-style-grid"
          role="group"
          aria-label="Grid style"
        >
          <label className="direct-create-field">
            <span>Stroke</span>
            <input
              type="text"
              value={directGridStrokeColor}
              onChange={(event) => {
                setDirectGridStrokeColor(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Opacity</span>
            <input
              type="number"
              step="any"
              min="0"
              max="1"
              value={directGridStrokeOpacity}
              onChange={(event) => {
                setDirectGridStrokeOpacity(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Width</span>
            <input
              type="number"
              step="any"
              min="0"
              value={directGridLineWidth}
              onChange={(event) => {
                setDirectGridLineWidth(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Line style</span>
            <select
              value={directGridLineStyle}
              onChange={(event) => {
                setDirectGridLineStyle(event.currentTarget.value as LineStyle)
                setDirectCreationStatus('')
              }}
            >
              {lineStyles.map((lineStyle) => (
                <option key={lineStyle} value={lineStyle}>
                  {lineStyle}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="direct-grid-range-grid">
          {directGridFieldGroups().map((group) => (
            <fieldset
              key={group.legend}
              className="direct-grid-field-group"
              aria-label={group.legend}
            >
              <legend>{group.legend}</legend>
              {group.fields.map((field) => (
                <label key={field.id} className="direct-create-field">
                  <span>{field.label}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    spellCheck={false}
                    value={field.value}
                    onChange={(event) =>
                      updateDirectGridField(field.id, event.currentTarget.value)
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <span className="direct-source-summary">
          {editableDiagram.ambientDimension === 2
            ? 'Frame: xy plane at z = 0'
            : `Frame: active work plane (${workPlaneDisplayName(activeWorkPlane)})`}
        </span>
      </div>
    )
  }

  function directGridFieldGroups(): Array<{
    legend: string
    fields: Array<{
      id: DirectGridField
      label: string
      value: string
    }>
  }> {
    if (directGridPattern !== 'rectangular') {
      return [
        {
          legend: directGridPattern === 'triangular' ? 'spacing' : 'cell',
          fields: [
            {
              id: 'uStep',
              label:
                directGridPattern === 'triangular'
                  ? 'spacing'
                  : 'edge length',
              value: directGridInput.uRange.step,
            },
          ],
        },
        {
          legend: 'range',
          fields: [
            { id: 'uMin', label: 'u min', value: directGridInput.uRange.min },
            { id: 'uMax', label: 'u max', value: directGridInput.uRange.max },
            { id: 'vMin', label: 'v min', value: directGridInput.vRange.min },
            { id: 'vMax', label: 'v max', value: directGridInput.vRange.max },
          ],
        },
        {
          legend: 'clip',
          fields: [
            { id: 'clipUMin', label: 'u min', value: directGridInput.clip.uMin },
            { id: 'clipUMax', label: 'u max', value: directGridInput.clip.uMax },
            { id: 'clipVMin', label: 'v min', value: directGridInput.clip.vMin },
            { id: 'clipVMax', label: 'v max', value: directGridInput.clip.vMax },
          ],
        },
      ]
    }

    return [
      {
        legend: 'u lines',
        fields: [
          { id: 'uMin', label: 'min', value: directGridInput.uRange.min },
          { id: 'uMax', label: 'max', value: directGridInput.uRange.max },
          { id: 'uStep', label: 'step', value: directGridInput.uRange.step },
        ],
      },
      {
        legend: 'v lines',
        fields: [
          { id: 'vMin', label: 'min', value: directGridInput.vRange.min },
          { id: 'vMax', label: 'max', value: directGridInput.vRange.max },
          { id: 'vStep', label: 'step', value: directGridInput.vRange.step },
        ],
      },
      {
        legend: 'clip',
        fields: [
          { id: 'clipUMin', label: 'u min', value: directGridInput.clip.uMin },
          { id: 'clipUMax', label: 'u max', value: directGridInput.clip.uMax },
          { id: 'clipVMin', label: 'v min', value: directGridInput.clip.vMin },
          { id: 'clipVMax', label: 'v max', value: directGridInput.clip.vMax },
        ],
      },
    ]
  }

  function latticePatternLabel(pattern: LatticePattern): string {
    switch (pattern) {
      case 'rectangular':
        return 'Rectangular'
      case 'triangular':
        return 'Triangular'
      case 'honeycomb':
        return 'Honeycomb'
    }
  }

  function renderDirectPathControls() {
    const axes = directCoordinateAxes(
      editableDiagram.ambientDimension,
      effectiveDirectCoordinateMode(
        editableDiagram.ambientDimension,
        directCoordinateMode,
      ),
    )

    return (
      <div className="direct-path-form">
        <label className="direct-create-field direct-path-name-field">
          <span>Path name</span>
          <input
            type="text"
            value={directPathName}
            onChange={(event) => {
              setDirectPathName(event.currentTarget.value)
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="direct-create-field direct-path-name-field">
          <span>Saved path label</span>
          <input
            type="text"
            value={directPathLabel}
            placeholder="optional"
            onChange={(event) => {
              setDirectPathLabel(event.currentTarget.value)
              setDirectCreationStatus('')
            }}
          />
        </label>
        <div className="direct-path-style-grid" role="group" aria-label="Path style">
          <label className="direct-create-field">
            <span>Stroke</span>
            <input
              type="text"
              value={directPathStrokeColor}
              onChange={(event) => {
                setDirectPathStrokeColor(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Opacity</span>
            <input
              type="number"
              step="any"
              min="0"
              max="1"
              value={directPathStrokeOpacity}
              onChange={(event) => {
                setDirectPathStrokeOpacity(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Width</span>
            <input
              type="number"
              step="any"
              min="0"
              value={directPathLineWidth}
              onChange={(event) => {
                setDirectPathLineWidth(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>Line style</span>
            <select
              value={directPathLineStyle}
              onChange={(event) => {
                setDirectPathLineStyle(event.currentTarget.value as LineStyle)
                setDirectCreationStatus('')
              }}
            >
              {lineStyles.map((lineStyle) => (
                <option key={lineStyle} value={lineStyle}>
                  {lineStyle}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="segmented-control direct-path-mode-control" role="group">
          {directPathInputModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={directPathInputMode === mode.id ? 'is-selected' : undefined}
              aria-pressed={directPathInputMode === mode.id}
              onClick={() => {
                setDirectPathInputMode(mode.id)
                setDirectPathSourceTargetKey(
                  mode.id === 'manual' ? 'manual-start' : 'template-center',
                )
                setDirectCreationStatus('')
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {directPathInputMode === 'manual'
          ? renderDirectManualPathControls(axes)
          : renderDirectPathTemplateControls(axes)}
        {renderDirectPathSourceControl()}
      </div>
    )
  }

  function renderDirectPathSourceControl() {
    const targetOptions = directPathCoordinateSourceTargetOptions()

    return (
      <div
        className="direct-coordinate-source-control"
        role="group"
        aria-label="Copy direct path coordinates from existing element"
      >
        <span className="control-label">Copy from existing element</span>
        <label className="direct-create-field direct-path-source-target-field">
          <span>Coordinate</span>
          <select
            value={directPathSourceTargetKey}
            onChange={(event) => {
              setDirectPathSourceTargetKey(event.currentTarget.value)
              setDirectCreationStatus('')
            }}
          >
            {targetOptions.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
        <label className="direct-create-field direct-coordinate-source-field">
          <span>Use coordinates from</span>
          <select
            value={directSourceKey}
            onChange={(event) => {
              setDirectSourceKey(event.currentTarget.value)
              setDirectCreationStatus('')
            }}
          >
            <option value="">Choose source</option>
            {existingCoordinateSourceOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="toolbar-button"
          disabled={existingCoordinateSourceOptions.length === 0}
          onClick={applyExistingSourceToDirectPathCoordinate}
        >
          Use selected coordinates
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={clearExistingSourceFromDirectPathCoordinate}
        >
          Clear coordinate
        </button>
        <span className="direct-source-summary">
          {directPathSourceSummary()}
        </span>
      </div>
    )
  }

  function renderDirectManualPathControls(axes: DirectCoordinateAxis[]) {
    return (
      <div className="direct-path-manual-form">
        {renderDirectPathCoordinateGroup(
          'Start',
          directPathStart,
          updateDirectPathStartCoordinate,
          axes,
        )}
        <div className="direct-path-segment-list">
          {directPathSegments.map((segment, segmentIndex) => (
            <fieldset key={segmentIndex} className="direct-path-segment-card">
              <legend>Segment {segmentIndex + 1}</legend>
              <label className="direct-create-field">
                <span>Type</span>
                <select
                  value={segment.kind}
                  onChange={(event) =>
                    updateDirectPathSegmentKind(
                      segmentIndex,
                      event.currentTarget.value as ConcatenatedPathSegmentKind,
                    )
                  }
                >
                  {concatenatedPathSegmentKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>
              {segment.kind === 'cubicBezier' && (
                <>
                  {renderDirectPathCoordinateGroup(
                    'Control point 1',
                    segment.control1,
                    (axis, value) =>
                      updateDirectPathSegmentCoordinate(
                        segmentIndex,
                        'control1',
                        axis,
                        value,
                      ),
                    axes,
                  )}
                  {renderDirectPathCoordinateGroup(
                    'Control point 2',
                    segment.control2,
                    (axis, value) =>
                      updateDirectPathSegmentCoordinate(
                        segmentIndex,
                        'control2',
                        axis,
                        value,
                      ),
                    axes,
                  )}
                </>
              )}
              {segment.kind === 'arc' && (
                <>
                  {renderDirectPathCoordinateGroup(
                    'Center',
                    segment.center,
                    (axis, value) =>
                      updateDirectPathSegmentCoordinate(
                        segmentIndex,
                        'center',
                        axis,
                        value,
                      ),
                    axes,
                  )}
                  <label className="direct-create-field">
                    <span>Radius</span>
                    <input
                      type="number"
                      step="any"
                      value={segment.radius}
                      onChange={(event) =>
                        updateDirectPathSegmentText(
                          segmentIndex,
                          'radius',
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                  <label className="direct-create-field">
                    <span>End angle</span>
                    <input
                      type="number"
                      step="any"
                      value={segment.endAngleDeg}
                      onChange={(event) =>
                        updateDirectPathSegmentText(
                          segmentIndex,
                          'endAngleDeg',
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                  <label className="direct-create-field">
                    <span>Direction</span>
                    <select
                      value={segment.direction}
                      onChange={(event) =>
                        updateDirectPathSegmentDirection(
                          segmentIndex,
                          event.currentTarget.value as ArcDirection,
                        )
                      }
                    >
                      <option value="counterclockwise">Counterclockwise</option>
                      <option value="clockwise">Clockwise</option>
                    </select>
                  </label>
                </>
              )}
              {segment.kind !== 'arc' &&
                renderDirectPathCoordinateGroup(
                  'End',
                  segment.end,
                  (axis, value) =>
                    updateDirectPathSegmentCoordinate(
                      segmentIndex,
                      'end',
                      axis,
                      value,
                    ),
                  axes,
                )}
            </fieldset>
          ))}
        </div>
        <div className="direct-path-segment-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => addDirectPathSegment('line')}
          >
            Add line segment
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => addDirectPathSegment('cubicBezier')}
          >
            Add cubic Bezier segment
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => addDirectPathSegment('arc')}
          >
            Add arc segment
          </button>
          <button
            type="button"
            className="toolbar-button"
            disabled={directPathSegments.length <= 1}
            onClick={removeLastDirectPathSegment}
          >
            Remove last segment
          </button>
        </div>
      </div>
    )
  }

  function renderDirectPathTemplateControls(axes: DirectCoordinateAxis[]) {
    return (
      <div className="direct-path-template-form">
        {renderDirectPathCoordinateGroup(
          'Center',
          directPathTemplateCenter,
          updateDirectPathTemplateCenterCoordinate,
          axes,
        )}
        {directPathInputMode === 'circle' && (
          <label className="direct-create-field">
            <span>Radius</span>
            <input
              type="number"
              step="any"
              value={directPathCircleRadius}
              onChange={(event) => {
                setDirectPathCircleRadius(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
        )}
        {directPathInputMode === 'ellipse' && (
          <>
            <label className="direct-create-field">
              <span>Radius x</span>
              <input
                type="number"
                step="any"
                value={directPathEllipseRadiusX}
                onChange={(event) => {
                  setDirectPathEllipseRadiusX(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <label className="direct-create-field">
              <span>Radius y</span>
              <input
                type="number"
                step="any"
                value={directPathEllipseRadiusY}
                onChange={(event) => {
                  setDirectPathEllipseRadiusY(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <label className="direct-create-field">
              <span>Rotation</span>
              <input
                type="number"
                step="any"
                value={directPathEllipseRotationDeg}
                onChange={(event) => {
                  setDirectPathEllipseRotationDeg(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
          </>
        )}
        {directPathInputMode === 'arc' && (
          <>
            <label className="direct-create-field">
              <span>Radius</span>
              <input
                type="number"
                step="any"
                value={directPathArcRadius}
                onChange={(event) => {
                  setDirectPathArcRadius(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <label className="direct-create-field">
              <span>Start angle</span>
              <input
                type="number"
                step="any"
                value={directPathArcStartAngleDeg}
                onChange={(event) => {
                  setDirectPathArcStartAngleDeg(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <label className="direct-create-field">
              <span>End angle</span>
              <input
                type="number"
                step="any"
                value={directPathArcEndAngleDeg}
                onChange={(event) => {
                  setDirectPathArcEndAngleDeg(event.currentTarget.value)
                  setDirectCreationStatus('')
                }}
              />
            </label>
          </>
        )}
        {editableDiagram.ambientDimension === 3 && (
          <span className="toolbar-note">
            Templates use the active work-plane orientation.
          </span>
        )}
      </div>
    )
  }

  function renderDirectPathCoordinateGroup(
    label: string,
    coordinates: DirectCoordinateInput,
    onCoordinateChange: (axis: DirectCoordinateAxis, value: string) => void,
    axes: DirectCoordinateAxis[],
  ) {
    return (
      <fieldset className="direct-path-coordinate-group">
        <legend>{label}</legend>
        {axes.map((axis) => (
          <label key={axis} className="direct-create-field">
            <span>
              {directCoordinateAxisLabel(
                axis,
                editableDiagram.ambientDimension,
                directCoordinateMode,
              )}
            </span>
            <input
              type="text"
              inputMode="decimal"
              spellCheck={false}
              value={coordinates[axis]}
              onChange={(event) =>
                onCoordinateChange(axis, event.currentTarget.value)
              }
            />
          </label>
        ))}
      </fieldset>
    )
  }

  function directPathCoordinateSourceTargetOptions(): Array<{
    key: string
    label: string
  }> {
    if (directPathInputMode !== 'manual') {
      return [{ key: 'template-center', label: 'Center' }]
    }

    return [
      { key: 'manual-start', label: 'Start' },
      ...directPathSegments.flatMap((segment, segmentIndex) => [
        ...(segment.kind === 'arc'
          ? [
              {
                key: directPathSegmentSourceTargetKey(segmentIndex, 'center'),
                label: `Segment ${segmentIndex + 1} center`,
              },
            ]
          : []),
        ...(segment.kind === 'cubicBezier'
          ? [
              {
                key: directPathSegmentSourceTargetKey(
                  segmentIndex,
                  'control1',
                ),
                label: `Segment ${segmentIndex + 1} control point 1`,
              },
              {
                key: directPathSegmentSourceTargetKey(
                  segmentIndex,
                  'control2',
                ),
                label: `Segment ${segmentIndex + 1} control point 2`,
              },
            ]
          : []),
        ...(segment.kind === 'arc'
          ? []
          : [
              {
                key: directPathSegmentSourceTargetKey(segmentIndex, 'end'),
                label: `Segment ${segmentIndex + 1} end`,
              },
            ]),
      ]),
    ]
  }

  function directPathCoordinateSourceRequests(): Array<{
    source: ExistingCoordinateSource
    label: string
  }> {
    if (directPathInputMode !== 'manual') {
      return directPathTemplateCenter.source === undefined
        ? []
        : [{ source: directPathTemplateCenter.source, label: 'center' }]
    }

    return [
      ...(directPathStart.source === undefined
        ? []
        : [{ source: directPathStart.source, label: 'start' }]),
      ...directPathSegments.flatMap((segment, segmentIndex) =>
        directPathSegmentSourceRequests(segment, segmentIndex),
      ),
    ]
  }

  function directPathSourceSummary(): string {
    const labels = directPathCoordinateSourceRequests().map((request) => {
      const key = existingCoordinateSourceKey(request.source)
      const option = existingCoordinateSourceOptions.find(
        (candidate) => candidate.key === key,
      )

      return `${request.label}: ${option?.label ?? 'Unavailable source'}`
    })

    return labels.length === 0 ? 'No copied path coordinates.' : labels.join('; ')
  }

  function finishPolylineDraft(): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setPolylineStatus('Finish or cancel point picking first.')
      return
    }

    if (polylineDraft === null || polylineDraft.points.length < 2) {
      setPolylineStatus('A polyline needs at least 2 vertices.')
      return
    }

    const creationLayer = parseNewElementLayer(setPolylineStatus)

    if (creationLayer === null) {
      return
    }

    setEditorState((current) => {
      const draft = current.polylineDraft

      if (draft === null || draft.points.length < 2) {
        return current
      }

      const result = addPolylineCurveStratumWithResult(
        current.editableDiagram,
        draft.points,
        { layer: creationLayer },
      )

      if (result.id === null) {
        return current
      }

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'stratum', id: result.id },
          creationLayer,
        ),
      )
    })
    setPolylineStatus('Polyline created.')
    setCopyStatus('idle')
  }

  function cancelPolylineDraft(): void {
    setEditorState((current) =>
      current.polylineDraft === null
        ? current
        : {
            ...current,
            polylineDraft: null,
          },
    )
    setPolylineStatus('Polyline canceled.')
  }

  function cancelCubicBezierDraft(): void {
    setEditorState((current) =>
      current.cubicBezierDraft === null
        ? current
        : {
            ...current,
            cubicBezierDraft: null,
          },
    )
    setCubicBezierStatus('Cubic Bezier canceled.')
  }

  function updatePathSegmentKind(kind: ConcatenatedPathSegmentKind): void {
    if (pathDraft === null) {
      setPathSegmentKind(kind)
      setPathStatus(
        `Click the preview to place the path ${concatenatedPathDraftNextPointLabel(
          null,
        )}.`,
      )
      return
    }

    const result = setConcatenatedPathDraftSegmentKind(pathDraft, kind)

    if (!result.ok) {
      setPathStatus('Finish the current cubic segment before changing type.')
      return
    }

    setPathSegmentKind(kind)
    setEditorState((current) => ({
      ...current,
      pathDraft: result.draft,
    }))
    setPathStatus(concatenatedPathDraftStatusMessage(result.draft))
  }

  function updatePathWorkPlaneMode(mode: ConcatenatedPathWorkPlaneMode): void {
    if (pathDraft !== null) {
      setPathStatus('Finish or cancel the path before changing path constraint.')
      return
    }

    setPathWorkPlaneMode(mode)
    setPathStatus(
      `Click the preview to place the path ${concatenatedPathDraftNextPointLabel(
        null,
      )}.`,
    )
  }

  function finishPathDraft(): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setPathStatus('Finish or cancel point picking first.')
      return
    }

    if (!concatenatedPathDraftCanFinish(pathDraft)) {
      setPathStatus('A path needs at least one complete segment.')
      return
    }

    const creationLayer = parseNewElementLayer(setPathStatus)

    if (creationLayer === null) {
      return
    }

    setEditorState((current) => {
      const draft = current.pathDraft

      if (draft === null || !concatenatedPathDraftCanFinish(draft)) {
        return current
      }

      const result = addConcatenatedPathStratumWithResult(
        current.editableDiagram,
        draft.segments,
        { layer: creationLayer },
      )

      if (result.id === null) {
        return current
      }

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'stratum', id: result.id },
          creationLayer,
        ),
      )
    })
    setPathStatus('Path created.')
    setCopyStatus('idle')
  }

  function cancelPathDraft(): void {
    setEditorState((current) =>
      current.pathDraft === null
        ? current
        : {
            ...current,
            pathDraft: cancelConcatenatedPathDraft(),
          },
    )
    setPathStatus('Path canceled.')
  }

  function finishSheetDraft(): void {
    if (shouldBlockCreationForWorkPlanePointPicking(workPlanePointPickingState)) {
      setSheetStatus('Finish or cancel point picking first.')
      return
    }

    if (sheetPolygonDraft === null || sheetPolygonDraft.points.length < 3) {
      setSheetStatus('A sheet needs at least 3 vertices.')
      return
    }

    if (!areFinitePoints(sheetPolygonDraft.points)) {
      setSheetStatus('Sheet vertices must be finite numbers.')
      return
    }

    if (!arePointsOnWorkPlane(sheetPolygonDraft.points, sheetPolygonDraft.workPlane)) {
      setSheetStatus('Sheet vertices must stay on the draft work plane.')
      return
    }

    const creationLayer = parseNewElementLayer(setSheetStatus)

    if (creationLayer === null) {
      return
    }

    setEditorState((current) => {
      const draft = current.sheetPolygonDraft

      if (
        draft === null ||
        draft.points.length < 3 ||
        !areFinitePoints(draft.points) ||
        !arePointsOnWorkPlane(draft.points, draft.workPlane)
      ) {
        return current
      }

      const result = addPolygonSheetStratumWithResult(
        current.editableDiagram,
        draft.points,
        { layer: creationLayer },
      )

      if (result.id === null) {
        return current
      }

      return commitDiagramChange(
        current,
        applyCreatedElementToEditorState(
          current,
          result.diagram,
          { kind: 'stratum', id: result.id },
          creationLayer,
        ),
      )
    })
    setSheetStatus('Sheet created.')
    setCopyStatus('idle')
  }

  function cancelSheetDraft(): void {
    setEditorState((current) =>
      current.sheetPolygonDraft === null
        ? current
        : {
            ...current,
            sheetPolygonDraft: null,
          },
    )
    setSheetStatus('Sheet canceled.')
  }

  function blockWorkPlaneChangeForDraft(): boolean {
    if (concatenatedPathDraftBlocksWorkPlaneChange(pathDraft)) {
      const message = 'Finish or cancel the path before changing work plane.'

      setPathStatus(message)
      setWorkPlaneStatus(message)
      return true
    }

    if (sheetDraftBlocksWorkPlaneChange(sheetPolygonDraft)) {
      const message = 'Finish or cancel the sheet before changing work plane.'

      setSheetStatus(message)
      setWorkPlaneStatus(message)
      return true
    }

    return false
  }

  function updateWorkPlaneKind(kind: AxisAlignedWorkPlaneName): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    setWorkPlaneStatus('')
    setActiveWorkPlane((current) => {
      const fixedValue = workPlaneFixedValue(current)

      switch (kind) {
        case 'xy':
          return { kind, z: fixedValue }
        case 'xz':
          return { kind, y: fixedValue }
        case 'yz':
          return { kind, x: fixedValue }
      }
    })
  }

  function updateWorkPlaneFixedValue(rawValue: string): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    const fixedValue = Number(rawValue)

    if (!Number.isFinite(fixedValue)) {
      setWorkPlaneStatus('Fixed coordinate must be finite.')
      return
    }

    setWorkPlaneStatus('')
    setActiveWorkPlane((current) => {
      switch (current.kind) {
        case 'xy':
          return { ...current, z: fixedValue }
        case 'xz':
          return { ...current, y: fixedValue }
        case 'yz':
          return { ...current, x: fixedValue }
        case 'axisAligned':
          return { ...current, offset: fixedValue }
        case 'custom':
          return current
      }
    })
  }

  function updateCustomWorkPlaneVectorInput(
    vector: keyof CustomOriginNormalWorkPlaneInput,
    axis: keyof CustomOriginNormalWorkPlaneInput['origin'],
    value: string,
  ): void {
    setCustomWorkPlaneInput((current) => ({
      ...current,
      [vector]: {
        ...current[vector],
        [axis]: value,
      },
    }))
    setWorkPlaneStatus('')
  }

  function updateCustomThreePointWorkPlaneVectorInput(
    point: keyof CustomThreePointWorkPlaneInput,
    axis: keyof CustomThreePointWorkPlaneInput['p0'],
    value: string,
  ): void {
    setCustomThreePointWorkPlaneInput((current) => ({
      ...current,
      [point]: {
        ...current[point],
        [axis]: value,
      },
    }))
    setWorkPlaneStatus('')
  }

  function applyCustomOriginNormalWorkPlane(): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    const result = applyCustomOriginNormalWorkPlaneInput(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      customWorkPlaneInput,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
    }
  }

  function applyCustomThreePointWorkPlane(): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    const result = applyCustomThreePointWorkPlaneInput(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      customThreePointWorkPlaneInput,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
    }
  }

  function startExistingPointWorkPlanePicking(): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    const result = startWorkPlanePointPicking(editableDiagram.ambientDimension)

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function pickExistingPointForWorkPlane(pointId: string): void {
    setWorkPlanePointPickingState((current) => {
      const result = pickWorkPlanePointStratum(current, pointId)

      setWorkPlaneStatus(result.status)
      return result.state
    })
  }

  function resetExistingPointWorkPlanePicking(): void {
    const result = resetWorkPlanePointPicking()

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function cancelExistingPointWorkPlanePicking(): void {
    const result = cancelWorkPlanePointPicking()

    setWorkPlanePointPickingState(result.state)
    setWorkPlaneStatus(result.status)
  }

  function applyExistingPointWorkPlane(): void {
    if (blockWorkPlaneChangeForDraft()) {
      return
    }

    const result = applyPickedPointWorkPlane(
      activeWorkPlane,
      editableDiagram.ambientDimension,
      editableDiagram,
      workPlanePointPickingState,
    )

    setWorkPlaneStatus(result.status)

    if (result.ok) {
      setActiveWorkPlane(result.workPlane)
      setWorkPlanePointPickingState(inactiveWorkPlanePointPickingState)
    }
  }

  function renderDirectInputDrawer() {
    if (!directInputDrawerVisible || !isDirectCreationTool(creationTool)) {
      return null
    }

    return (
      <section
        className="direct-input-drawer"
        aria-labelledby="direct-input-drawer-heading"
        onClick={stopPreviewOverlayEvent}
        onPointerDown={stopPreviewOverlayEvent}
      >
        <div className="direct-input-drawer-heading-row">
          <div className="direct-input-drawer-title">
            <span className="control-label">Direct input</span>
            <h3 id="direct-input-drawer-heading">
              {directCreationTitle(creationTool)}
            </h3>
          </div>
          <button
            type="button"
            className="preview-overlay-button direct-input-drawer-close"
            onClick={(event) =>
              runPreviewOverlayAction(event, closeDirectInputDrawer)
            }
            onPointerDown={stopPreviewOverlayEvent}
          >
            Close
          </button>
        </div>
        {renderDirectCreationForm()}
      </section>
    )
  }

  function renderInspectorDrawer() {
    if (!inspectorDrawerOpen) {
      return (
        <button
          type="button"
          className="preview-overlay-button inspector-drawer-open-button"
          aria-controls="preview-inspector-drawer"
          aria-expanded={false}
          onClick={(event) =>
            runPreviewOverlayAction(event, openInspectorDrawer)
          }
          onPointerDown={stopPreviewOverlayEvent}
        >
          Inspector
        </button>
      )
    }

    return (
      <aside
        id="preview-inspector-drawer"
        className="inspector-drawer"
        aria-labelledby="preview-inspector-drawer-heading"
        onClick={stopPreviewOverlayEvent}
        onPointerDown={stopPreviewOverlayEvent}
      >
        <div className="inspector-drawer-heading-row">
          <div>
            <h2 id="preview-inspector-drawer-heading">Inspector</h2>
            <span>basic fields and coordinates</span>
          </div>
          <button
            type="button"
            className="preview-overlay-button inspector-drawer-close-button"
            aria-controls="preview-inspector-drawer"
            aria-expanded={true}
            onClick={(event) =>
              runPreviewOverlayAction(event, closeInspectorDrawer)
            }
            onPointerDown={stopPreviewOverlayEvent}
          >
            Close
          </button>
        </div>
        <div className="inspector-drawer-scroll">
          <EditableInspector
            diagram={editableDiagram}
            selectedElement={selectedElement}
            onDiagramChange={updateEditableDiagram}
            expanded={isInspectorExpanded}
            onExpandedChange={updateInspectorExpanded}
          />
        </div>
      </aside>
    )
  }

  function renderLayerManagerOverlay() {
    return (
      <LayerManager
        diagram={editableDiagram}
        layerFilter={layerFilter}
        creationLayerInput={directLayerInput}
        statusMessage={layerOperationStatus}
        expanded={isLayerManagerExpanded}
        stackedWithCamera={showCameraControls && isCameraPanelAside}
        onExpandedChange={setIsLayerManagerExpanded}
        onCreationLayerChange={updateNewElementLayerInput}
        onLayerFilterChange={updateLayerFilter}
        onRenameLayer={renameDiagramLayer}
        onSwapLayers={swapDiagramLayers}
        onDuplicateLayer={duplicateDiagramLayer}
        onTranslateLayer={translateDiagramLayer}
        onSetLayerVisibility={setDiagramLayerVisibility}
        onSetLayerLock={setDiagramLayerLock}
        onDeleteLayer={deleteDiagramLayer}
        onStatusMessage={setLayerOperationStatus}
      />
    )
  }

  function renderDirectCreationForm() {
    if (coordinateInputMode !== 'direct' || !isDirectCreationTool(creationTool)) {
      return null
    }

    return (
      <form
        className="direct-input-drawer-form"
        aria-label="Direct creation"
        onSubmit={(event) => {
          event.preventDefault()
          createDirectElement()
        }}
      >
        {editableDiagram.ambientDimension === 3 &&
          creationTool !== 'createGrid' &&
          (creationTool !== 'createSheet' ||
            !isBoundarySurfaceSheetCreationKind(sheetCreationKind)) && (
            <label className="direct-create-field direct-coordinate-mode-field">
              <span>Coordinate mode</span>
              <select
                value={directCoordinateMode}
                onChange={(event) =>
                  updateDirectCoordinateMode(
                    event.currentTarget.value as DirectCoordinateMode,
                  )
                }
              >
                {directCoordinateModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {directCoordinateModeLabel(mode)}
                  </option>
                ))}
              </select>
            </label>
          )}
        {creationTool === 'createLabel' && (
          <label className="direct-create-field direct-create-text">
            <span>Text</span>
            <input
              className="toolbar-text-input"
              type="text"
              value={directLabelText}
              onChange={(event) => {
                setDirectLabelText(event.currentTarget.value)
                setDirectCreationStatus('')
              }}
            />
          </label>
        )}
        {(creationTool === 'createPoint' ||
          creationTool === 'createLabel' ||
          (creationTool === 'createSheet' &&
            isAnchorCurvedSheetCreationKind(sheetCreationKind))) &&
          directCoordinateAxes(
            editableDiagram.ambientDimension,
            effectiveDirectCoordinateMode(
              editableDiagram.ambientDimension,
              directCoordinateMode,
            ),
          ).map((axis) => (
            <label key={axis} className="direct-create-field">
              <span>
                {directCoordinateAxisLabel(
                  axis,
                  editableDiagram.ambientDimension,
                  directCoordinateMode,
                )}{' '}
                {creationTool === 'createSheet' &&
                  isAnchorCurvedSheetCreationKind(sheetCreationKind) &&
                  axis === 'x' &&
                  `(${curvedSheetAnchorLabel(sheetCreationKind)})`}
              </span>
              <input
                type="text"
                inputMode="decimal"
                spellCheck={false}
                value={directCoordinates[axis]}
                onChange={(event) =>
                  updateDirectCoordinate(axis, event.currentTarget.value)
                }
              />
            </label>
          ))}
        {creationTool === 'createSheet' &&
          isAnchorCurvedSheetCreationKind(sheetCreationKind) && (
            <div
              className="direct-sheet-parameter-control"
              role="group"
              aria-label={`${sheetCreationKindLabel(sheetCreationKind)} parameters`}
            >
              {renderCurvedSheetParameterControls()}
            </div>
          )}
        {creationTool === 'createSheet' &&
          isBoundarySurfaceSheetCreationKind(sheetCreationKind) &&
          renderBoundarySurfaceDirectControls()}
        {creationTool === 'createPath' && renderDirectPathControls()}
        {creationTool === 'createGrid' && renderDirectGridControls()}
        {isDirectPathCreationTool(creationTool) &&
          (creationTool !== 'createSheet' ||
            sheetCreationKind === 'polygon') && (
            <>
              {creationTool === 'createCubicBezier' && (
                <label className="direct-create-field">
                  <span>Controls</span>
                  <select
                    value={directCubicBezierControlMode}
                    onChange={(event) =>
                      updateDirectCubicBezierControlMode(
                        event.currentTarget.value as DirectCubicBezierControlMode,
                      )
                    }
                  >
                    {directCubicBezierControlModeOptions(
                      editableDiagram.ambientDimension,
                      effectiveDirectCoordinateMode(
                        editableDiagram.ambientDimension,
                        directCoordinateMode,
                      ),
                    ).map((mode) => (
                      <option key={mode} value={mode}>
                        {directCubicBezierControlModeLabel(mode)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="direct-create-field direct-coordinate-list">
                <span>
                  {directRowsLabel(creationTool, directCubicBezierControlMode)}
                </span>
                <textarea
                  value={directRowsForCreationToolValue(creationTool)}
                  rows={directCoordinateRowsTextAreaRows(creationTool)}
                  spellCheck={false}
                  placeholder={directCoordinateRowsPlaceholder(
                    editableDiagram.ambientDimension,
                    creationTool === 'createCubicBezier'
                      ? directCubicBezierControlMode
                      : 'absolute',
                    effectiveDirectCoordinateMode(
                      editableDiagram.ambientDimension,
                      directCoordinateMode,
                    ),
                  )}
                  onChange={(event) =>
                    updateDirectRowsForCreationTool(
                      creationTool,
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
              <div
                className="direct-coordinate-source-control"
                role="group"
                aria-label="Copy coordinates from existing element"
              >
                <span className="control-label">Copy from existing element</span>
                <label className="direct-create-field">
                  <span>Row</span>
                  <select
                    value={directSourceTargetRow}
                    onChange={(event) => {
                      setDirectSourceTargetRow(event.currentTarget.value)
                      setDirectCreationStatus('')
                    }}
                  >
                    {directSourceTargetRows(
                      directRowsForCreationToolValue(creationTool),
                      creationTool,
                    ).map((row) => (
                      <option key={row} value={String(row)}>
                        {row}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="direct-create-field direct-coordinate-source-field">
                  <span>Use coordinates from</span>
                  <select
                    value={directSourceKey}
                    onChange={(event) => {
                      setDirectSourceKey(event.currentTarget.value)
                      setDirectCreationStatus('')
                    }}
                  >
                    <option value="">Choose source</option>
                    {existingCoordinateSourceOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="toolbar-button"
                  disabled={existingCoordinateSourceOptions.length === 0}
                  onClick={applyExistingSourceToDirectRow}
                >
                  Use selected coordinates
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={clearExistingSourceFromDirectRow}
                >
                  Clear row
                </button>
                <span className="direct-source-summary">
                  {directSourceSummary(
                    directSourcesForCreationToolValue(creationTool),
                    existingCoordinateSourceOptions,
                  )}
                </span>
              </div>
            </>
          )}
        <button
          type="submit"
          className="toolbar-button direct-input-create-button"
          disabled={directCreateDisabled}
        >
          Create
        </button>
        <span className="toolbar-status" role="status">
          {directCreationStatus}
        </span>
      </form>
    )
  }

  function renderBoundarySurfaceDirectControls() {
    if (sheetCreationKind === 'ruledSurface') {
      return (
        <div
          className="direct-boundary-surface-controls"
          role="group"
          aria-label="Ruled surface direct controls"
        >
          <span className="direct-source-summary">
            {ruledSurfaceBoundaryDraftStatusMessage(ruledSurfaceBoundaryDraft)}
          </span>
          <label className="direct-create-field">
            <span>Segments</span>
            <input
              type="number"
              min="1"
              max={maxCurvedSheetSamplingSegments}
              step="1"
              value={ruledSurfaceSegmentsInput}
              onChange={(event) => {
                setRuledSurfaceSegmentsInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
          <div className="direct-boundary-action-row">
            <button
              type="button"
              className="toolbar-button"
              disabled={
                ruledSurfaceBoundaryDraftPickedPathIds(ruledSurfaceBoundaryDraft)
                  .length === 0
              }
              onClick={undoRuledSurfaceBoundaryPicking}
            >
              Back
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={
                ruledSurfaceBoundaryDraftPickedPathIds(ruledSurfaceBoundaryDraft)
                  .length === 0
              }
              onClick={resetRuledSurfaceBoundaryPicking}
            >
              Reset
            </button>
          </div>
        </div>
      )
    }

    if (sheetCreationKind === 'coonsPatch') {
      return (
        <div
          className="direct-boundary-surface-controls"
          role="group"
          aria-label="Coons patch direct controls"
        >
          <span className="direct-source-summary">
            {coonsPatchBoundaryDraftStatusForUi(
              editableDiagram,
              coonsPatchBoundaryDraft,
            )}
          </span>
          <label className="direct-create-field">
            <span>U segments</span>
            <input
              type="number"
              min="1"
              max={maxCurvedSheetSamplingSegments}
              step="1"
              value={coonsPatchUSegmentsInput}
              onChange={(event) => {
                setCoonsPatchUSegmentsInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="direct-create-field">
            <span>V segments</span>
            <input
              type="number"
              min="1"
              max={maxCurvedSheetSamplingSegments}
              step="1"
              value={coonsPatchVSegmentsInput}
              onChange={(event) => {
                setCoonsPatchVSegmentsInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
          <div className="direct-boundary-action-row">
            <button
              type="button"
              className="toolbar-button"
              disabled={
                coonsPatchBoundaryDraftPickedSourceIds(coonsPatchBoundaryDraft)
                  .length === 0
              }
              onClick={undoCoonsPatchBoundaryPicking}
            >
              Back
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={
                coonsPatchBoundaryDraftPickedSourceIds(coonsPatchBoundaryDraft)
                  .length === 0
              }
              onClick={resetCoonsPatchBoundaryPicking}
            >
              Reset
            </button>
          </div>
          <details className="direct-boundary-directions">
            <summary>Boundary directions</summary>
            <div className="direct-boundary-direction-list">
              {coonsPatchBoundaryRoles.map((role) => {
                const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(
                  coonsPatchBoundaryDraft,
                  role,
                )

                return (
                  <div key={role} className="preview-coons-direction-row">
                    <span>{coonsPatchBoundaryRoleLabel(role)}</span>
                    <span>
                      {formatCoonsPatchBoundaryDirectionSummary(
                        editableDiagram,
                        coonsPatchBoundaryDraft,
                        role,
                      )}
                    </span>
                    <button
                      type="button"
                      className="toolbar-button"
                      disabled={picked === null || picked.kind === 'point'}
                      aria-pressed={
                        picked !== null && picked.kind !== 'point'
                          ? picked.reversed
                          : false
                      }
                      onClick={() => toggleCoonsPatchBoundaryDirection(role)}
                    >
                      Reverse
                    </button>
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )
    }

    return null
  }

  function renderPreviewToolbarOverlay() {
    const isCollapsed = previewToolbarState === 'collapsed'

    return (
      <div
        className={`preview-toolbar-overlay-stack ${
          isCollapsed ? 'is-collapsed' : ''
        }`}
        aria-label="Preview toolbar overlay"
      >
        {isCollapsed ? (
          <button
            type="button"
            className="preview-overlay-button preview-toolbar-expand-button"
            aria-label="Expand preview toolbar"
            title="Expand toolbar"
            onClick={(event) =>
              runPreviewOverlayAction(event, togglePreviewToolbar)
            }
            onPointerDown={stopPreviewOverlayEvent}
          >
            ↓
          </button>
        ) : (
          <section
            className="preview-floating-toolbar"
            aria-label="Creation toolbar"
            onClick={stopPreviewOverlayEvent}
            onPointerDown={stopPreviewOverlayEvent}
          >
            <button
              type="button"
              className="preview-overlay-button preview-toolbar-collapse-button"
              aria-label="Collapse preview toolbar"
              title="Collapse toolbar"
              onClick={togglePreviewToolbar}
            >
              ↑
            </button>

            <div className="preview-toolbar-primary-tools" role="group">
              {previewToolbarTopTools(editableDiagram.ambientDimension).map(
                (tool) => renderPreviewToolbarTool(tool),
              )}
            </div>

            {renderActiveCreationControls()}

            {showFillPathControls && renderFillPathToolbarControls()}

            <button
              type="button"
              className="preview-overlay-button preview-trash-button"
              disabled={selectedElement === null}
              aria-label="Remove selected"
              title="Remove selected"
              onClick={(event) =>
                runPreviewOverlayAction(event, removeCurrentSelection)
              }
              onPointerDown={stopPreviewOverlayEvent}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z" />
                <path d="M6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z" />
              </svg>
            </button>
          </section>
        )}

        <div
          className="preview-history-overlay"
          role="group"
          aria-label="History"
          onClick={stopPreviewOverlayEvent}
          onPointerDown={stopPreviewOverlayEvent}
        >
          <button
            type="button"
            className="preview-overlay-button"
            disabled={!canUndo}
            onClick={(event) => runPreviewOverlayAction(event, undoLastChange)}
            title="Undo last diagram change"
          >
            Undo
          </button>
          <button
            type="button"
            className="preview-overlay-button"
            disabled={!canRedo}
            onClick={(event) => runPreviewOverlayAction(event, redoLastChange)}
            title="Redo the last undone diagram change"
          >
            Redo
          </button>
        </div>
      </div>
    )
  }

  function renderPreviewToolbarTool(
    tool: ReturnType<typeof previewToolbarTopTools>[number],
  ) {
    if (tool.menu === 'direct') {
      const directTool =
        tool.id === 'createPoint' ||
        tool.id === 'createLabel' ||
        tool.id === 'createGrid'
          ? tool.id
          : null

      if (directTool === null) {
        return null
      }

      return (
        <details
          key={tool.id}
          className={`preview-toolbar-menu ${
            creationTool === tool.id ? 'is-selected' : ''
          }`}
        >
          <summary>{tool.label} ▾</summary>
          <div className="preview-toolbar-menu-popover">
            {directTool !== 'createGrid' && (
              <button
                type="button"
                className={
                  creationTool === directTool && coordinateInputMode === 'cursor'
                    ? 'is-selected'
                    : undefined
                }
                aria-pressed={
                  creationTool === directTool && coordinateInputMode === 'cursor'
                }
                onClick={(event) => {
                  stopPreviewOverlayEvent(event)
                  activateCursorCreationTool(directTool)
                }}
              >
                Cursor placement
              </button>
            )}
            <button
              type="button"
              className={
                creationTool === directTool && coordinateInputMode === 'direct'
                  ? 'is-selected'
                  : undefined
              }
              aria-pressed={
                creationTool === directTool && coordinateInputMode === 'direct'
              }
              onClick={(event) => {
                stopPreviewOverlayEvent(event)
                activateDirectCreationTool(directTool)
              }}
            >
              Direct input
            </button>
          </div>
        </details>
      )
    }

    if (tool.menu === 'path') {
      return (
        <details
          key={tool.id}
          className={`preview-toolbar-menu ${
            isAddPathTool(creationTool) ? 'is-selected' : ''
          }`}
        >
          <summary>{tool.label} ▾</summary>
          <div className="preview-toolbar-menu-popover">
            {addPathMenuItems().map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  isPathMenuItemSelected(item) ? 'is-selected' : undefined
                }
                aria-pressed={isPathMenuItemSelected(item)}
                onClick={(event) => {
                  stopPreviewOverlayEvent(event)
                  activatePathMenuItem(item)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </details>
      )
    }

    if (tool.menu === 'sheet') {
      return (
        <details
          key={tool.id}
          className={`preview-toolbar-menu ${
            creationTool === 'createSheet' ? 'is-selected' : ''
          }`}
        >
          <summary>{tool.label} ▾</summary>
          <div className="preview-toolbar-menu-popover">
            {sheetCreationKinds.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className={
                  creationTool === 'createSheet' && sheetCreationKind === kind.id
                    ? 'is-selected'
                    : undefined
                }
                aria-pressed={
                  creationTool === 'createSheet' && sheetCreationKind === kind.id
                }
                onClick={(event) => {
                  stopPreviewOverlayEvent(event)
                  activateSheetCreationKind(kind.id)
                }}
              >
                {kind.label}
              </button>
            ))}
            <button
              type="button"
              className={
                creationTool === 'createSheet' && coordinateInputMode === 'direct'
                  ? 'is-selected'
                  : undefined
              }
              aria-pressed={
                creationTool === 'createSheet' && coordinateInputMode === 'direct'
              }
              onClick={(event) => {
                stopPreviewOverlayEvent(event)
                activateDirectCreationTool('createSheet')
              }}
            >
              Direct input
            </button>
          </div>
        </details>
      )
    }

    return (
      <button
        key={tool.id}
        type="button"
        className={creationTool === tool.id ? 'is-selected' : undefined}
        aria-pressed={creationTool === tool.id}
        onClick={(event) => {
          stopPreviewOverlayEvent(event)
          activateCursorCreationTool(tool.id)
        }}
      >
        {tool.label}
      </button>
    )
  }

  function isPathMenuItemSelected(item: PreviewPathMenuItem): boolean {
    if (creationTool !== item.tool || coordinateInputMode !== item.inputMode) {
      return false
    }

    if (item.tool === 'createPath' && item.segmentKind !== undefined) {
      return pathSegmentKind === item.segmentKind
    }

    if (item.directPathInputMode !== undefined) {
      return directPathInputMode === item.directPathInputMode
    }

    return true
  }

  function renderActiveCreationControls() {
    if (coordinateInputMode === 'direct') {
      return null
    }

    if (creationTool === 'createPolyline') {
      return (
        <div className="preview-toolbar-detail" role="group" aria-label="Polyline">
          <span className="preview-toolbar-label">Polyline</span>
          <button type="button" onClick={finishPolylineDraft}>
            Finish
          </button>
          <button type="button" onClick={cancelPolylineDraft}>
            Cancel
          </button>
          <span className="preview-toolbar-status" role="status">
            {polylineStatus}
          </span>
        </div>
      )
    }

    if (creationTool === 'createCubicBezier') {
      return (
        <div
          className="preview-toolbar-detail"
          role="group"
          aria-label="Cubic Bezier"
        >
          <span className="preview-toolbar-label">Cubic</span>
          <button type="button" onClick={cancelCubicBezierDraft}>
            Cancel
          </button>
          <span className="preview-toolbar-status" role="status">
            {cubicBezierStatus}
          </span>
        </div>
      )
    }

    if (creationTool === 'createPath') {
      return (
        <div className="preview-toolbar-detail" role="group" aria-label="Path">
          <span className="preview-toolbar-label">Path</span>
          <div className="preview-mini-segmented" role="group">
            {concatenatedPathWorkPlaneModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={pathWorkPlaneMode === mode.id ? 'is-selected' : undefined}
                aria-pressed={pathWorkPlaneMode === mode.id}
                disabled={pathDraft !== null}
                title={mode.label}
                onClick={() => updatePathWorkPlaneMode(mode.id)}
              >
                {mode.id === 'sameWorkPlane' ? 'Same plane' : 'Cross plane'}
              </button>
            ))}
          </div>
          <div className="preview-mini-segmented" role="group">
            {concatenatedPathSegmentKinds.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className={pathSegmentKind === kind.id ? 'is-selected' : undefined}
                aria-pressed={pathSegmentKind === kind.id}
                disabled={(pathDraft?.pendingPoints.length ?? 0) > 0}
                onClick={() => updatePathSegmentKind(kind.id)}
              >
                {kind.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={finishPathDraft}>
            Finish
          </button>
          <button type="button" onClick={cancelPathDraft}>
            Cancel
          </button>
          <span className="preview-toolbar-status" role="status">
            {pathStatus}
          </span>
        </div>
      )
    }

    if (creationTool === 'createSheet' && editableDiagram.ambientDimension === 3) {
      return renderSheetToolbarControls()
    }

    if (
      directCreationStatus !== '' &&
      (creationTool === 'createPoint' || creationTool === 'createLabel')
    ) {
      return (
        <div
          className="preview-toolbar-detail"
          role="status"
          aria-label="Creation status"
        >
          <span className="preview-toolbar-status">
            {directCreationStatus}
          </span>
        </div>
      )
    }

    return null
  }

  function renderSheetToolbarControls() {
    return (
      <div className="preview-toolbar-detail" role="group" aria-label="Sheet">
        <span className="preview-toolbar-label">
          {sheetCreationKindLabel(sheetCreationKind)}
        </span>
        {sheetCreationKind === 'polygon' ? (
          <>
            <button type="button" onClick={finishSheetDraft}>
              Finish
            </button>
            <button type="button" onClick={cancelSheetDraft}>
              Cancel
            </button>
          </>
        ) : sheetCreationKind === 'ruledSurface' ? (
          <>
            <label className="preview-toolbar-field">
              <span>Segments</span>
              <input
                type="number"
                min="1"
                max={maxCurvedSheetSamplingSegments}
                step="1"
                value={ruledSurfaceSegmentsInput}
                onChange={(event) => {
                  setRuledSurfaceSegmentsInput(event.currentTarget.value)
                  setSheetStatus('')
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <button
              type="button"
              disabled={
                ruledSurfaceBoundaryDraftPickedPathIds(ruledSurfaceBoundaryDraft)
                  .length === 0
              }
              onClick={undoRuledSurfaceBoundaryPicking}
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                ruledSurfaceBoundaryDraftPickedPathIds(ruledSurfaceBoundaryDraft)
                  .length === 0
              }
              onClick={resetRuledSurfaceBoundaryPicking}
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!ruledSurfaceBoundaryDraftCanCreate(ruledSurfaceBoundaryDraft)}
              onClick={() => {
                const creationLayer = parseNewElementLayer(setSheetStatus)

                if (creationLayer !== null) {
                  createRuledSurfaceFromPickedPaths(creationLayer, setSheetStatus)
                }
              }}
            >
              Create
            </button>
          </>
        ) : sheetCreationKind === 'coonsPatch' ? (
          <>
            <label className="preview-toolbar-field">
              <span>U</span>
              <input
                type="number"
                min="1"
                max={maxCurvedSheetSamplingSegments}
                step="1"
                value={coonsPatchUSegmentsInput}
                onChange={(event) => {
                  setCoonsPatchUSegmentsInput(event.currentTarget.value)
                  setSheetStatus('')
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <label className="preview-toolbar-field">
              <span>V</span>
              <input
                type="number"
                min="1"
                max={maxCurvedSheetSamplingSegments}
                step="1"
                value={coonsPatchVSegmentsInput}
                onChange={(event) => {
                  setCoonsPatchVSegmentsInput(event.currentTarget.value)
                  setSheetStatus('')
                  setDirectCreationStatus('')
                }}
              />
            </label>
            <button
              type="button"
              disabled={
                coonsPatchBoundaryDraftPickedSourceIds(coonsPatchBoundaryDraft)
                  .length === 0
              }
              onClick={undoCoonsPatchBoundaryPicking}
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                coonsPatchBoundaryDraftPickedSourceIds(coonsPatchBoundaryDraft)
                  .length === 0
              }
              onClick={resetCoonsPatchBoundaryPicking}
            >
              Reset
            </button>
            <button
              type="button"
              disabled={
                !coonsPatchBoundaryDraftCanCreateWithCurrentDirections(
                  editableDiagram,
                  coonsPatchBoundaryDraft,
                )
              }
              onClick={() => {
                const creationLayer = parseNewElementLayer(setSheetStatus)

                if (creationLayer !== null) {
                  createCoonsPatchFromPickedPaths(creationLayer, setSheetStatus)
                }
              }}
            >
              Create
            </button>
            <details className="preview-toolbar-menu preview-toolbar-inline-menu">
              <summary>Directions</summary>
              <div className="preview-toolbar-menu-popover preview-toolbar-wide-popover">
                {coonsPatchBoundaryRoles.map((role) => {
                  const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(
                    coonsPatchBoundaryDraft,
                    role,
                  )

                  return (
                    <div key={role} className="preview-coons-direction-row">
                      <span>{coonsPatchBoundaryRoleLabel(role)}</span>
                      <span>
                        {formatCoonsPatchBoundaryDirectionSummary(
                          editableDiagram,
                          coonsPatchBoundaryDraft,
                          role,
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={picked === null || picked.kind === 'point'}
                        aria-pressed={
                          picked !== null && picked.kind !== 'point'
                            ? picked.reversed
                            : false
                        }
                        onClick={() => toggleCoonsPatchBoundaryDirection(role)}
                      >
                        Reverse
                      </button>
                    </div>
                  )
                })}
              </div>
            </details>
          </>
        ) : (
          renderCurvedSheetParameterControls()
        )}
        <span className="preview-toolbar-status" role="status">
          {sheetStatus}
        </span>
      </div>
    )
  }

  function renderCurvedSheetParameterControls() {
    if (sheetCreationKind === 'hemisphere') {
      return (
        <>
          <label className="preview-toolbar-field">
            <span>Radius</span>
            <input
              type="number"
              min="0"
              step="any"
              value={hemisphereRadiusInput}
              onChange={(event) => {
                setHemisphereRadiusInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="preview-toolbar-field">
            <span>Side</span>
            <select
              value={hemisphereSide}
              onChange={(event) => {
                setHemisphereSide(event.currentTarget.value as typeof hemisphereSide)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            >
              <option value="positive">positive</option>
              <option value="negative">negative</option>
            </select>
          </label>
          <label className="preview-toolbar-field">
            <span>U</span>
            <input
              type="number"
              min="1"
              max={maxCurvedSheetSamplingSegments}
              step="1"
              value={hemisphereUSegmentsInput}
              onChange={(event) => {
                setHemisphereUSegmentsInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
          <label className="preview-toolbar-field">
            <span>V</span>
            <input
              type="number"
              min="1"
              max={maxCurvedSheetSamplingSegments}
              step="1"
              value={hemisphereVSegmentsInput}
              onChange={(event) => {
                setHemisphereVSegmentsInput(event.currentTarget.value)
                setSheetStatus('')
                setDirectCreationStatus('')
              }}
            />
          </label>
        </>
      )
    }

    return (
      <>
        <label className="preview-toolbar-field">
          <span>Width</span>
          <input
            type="number"
            min="0"
            step="any"
            value={saddleWidthInput}
            onChange={(event) => {
              setSaddleWidthInput(event.currentTarget.value)
              setSheetStatus('')
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="preview-toolbar-field">
          <span>Depth</span>
          <input
            type="number"
            min="0"
            step="any"
            value={saddleDepthInput}
            onChange={(event) => {
              setSaddleDepthInput(event.currentTarget.value)
              setSheetStatus('')
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="preview-toolbar-field">
          <span>Height</span>
          <input
            type="number"
            step="any"
            value={saddleHeightInput}
            onChange={(event) => {
              setSaddleHeightInput(event.currentTarget.value)
              setSheetStatus('')
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="preview-toolbar-field">
          <span>U</span>
          <input
            type="number"
            min="1"
            max={maxCurvedSheetSamplingSegments}
            step="1"
            value={saddleUSegmentsInput}
            onChange={(event) => {
              setSaddleUSegmentsInput(event.currentTarget.value)
              setSheetStatus('')
              setDirectCreationStatus('')
            }}
          />
        </label>
        <label className="preview-toolbar-field">
          <span>V</span>
          <input
            type="number"
            min="1"
            max={maxCurvedSheetSamplingSegments}
            step="1"
            value={saddleVSegmentsInput}
            onChange={(event) => {
              setSaddleVSegmentsInput(event.currentTarget.value)
              setSheetStatus('')
              setDirectCreationStatus('')
            }}
          />
        </label>
      </>
    )
  }

  function renderFillPathToolbarControls() {
    return (
      <div
        className="preview-toolbar-detail preview-fill-path-control"
        role="group"
        aria-label="Fill paths"
      >
        <span className="preview-toolbar-label">Fill paths</span>
        <div className="preview-mini-segmented" role="group">
          {fillRuleOptions.map((rule) => (
            <button
              key={rule}
              type="button"
              className={fillRule === rule ? 'is-selected' : undefined}
              aria-pressed={fillRule === rule}
              onClick={() => {
                setFillRule(rule)
                setFillStatus('')
              }}
            >
              {fillRuleLabel(rule)}
            </button>
          ))}
        </div>
        <button type="button" onClick={pickSelectedFillBoundaryPath}>
          Pick
        </button>
        <button
          type="button"
          disabled={fillBoundaryPathIds.length === 0}
          onClick={resetFillBoundaryPathPicking}
        >
          Reset
        </button>
        <button
          type="button"
          disabled={fillBoundaryPathIds.length === 0}
          onClick={cancelFillBoundaryPathPicking}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={fillBoundaryPathIds.length === 0}
          onClick={createFillFromPickedPaths}
        >
          Create
        </button>
        <span className="preview-toolbar-status" role="status">
          {fillBoundaryStatus}
        </span>
      </div>
    )
  }

  const symbolicImportCanConfirm =
    pendingSymbolicImport !== null &&
    symbolicImportDrafts.every((draft) => draft.expression.trim().length > 0)

  return (
    <main className="app-shell">
      <div className="top-control-area">
        <header className="app-header">
          <div>
            <h1>StratifiedTikZ</h1>
            <p>Preview-centered TikZ diagram editor.</p>
          </div>
          <div className="status-strip" aria-label="Current diagram summary">
            <span>{selectedExample.name}</span>
            <span>{editableDiagram.ambientDimension}D</span>
            <span>{coordinateInputMode}</span>
            <span>{creationTool}</span>
            <span>{layerFilterStatusLabel(layerFilter)}</span>
            <span>{selectedElement === null ? 'no selection' : selectedElement.id}</span>
          </div>
        </header>

        <section className="toolbar" aria-label="Diagram controls">
        <div className="control-stack example-control-stack">
          <div className="control-group example-control-group">
            <span className="control-label">Example</span>
            <div className="segmented-control example-segmented-control">
              {exampleOptions.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={
                    selectedExampleId === example.id ? 'is-selected' : undefined
                  }
                  aria-pressed={selectedExampleId === example.id}
                  onClick={() => selectExample(example.id)}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
          <p className="toolbar-note">
            Edits are temporary in this phase and reset when switching examples.
          </p>
        </div>

        <VariableManager
          diagram={editableDiagram}
          onDiagramChange={updateEditableDiagram}
        />

        <div className="control-group file-control">
          <span className="control-label">File</span>
          <div className="file-action-strip">
            <label className="filename-field">
              <span className="control-label">Name</span>
              <input
                className="toolbar-text-input"
                type="text"
                value={jsonDownloadFilename}
                onChange={(event) =>
                  setJsonDownloadFilename(event.currentTarget.value)
                }
              />
            </label>
            <button type="button" className="toolbar-button" onClick={downloadJson}>
              Download JSON
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={openLoadJsonPicker}
            >
              Load JSON
            </button>
            <input
              ref={loadFileInputRef}
              className="file-input"
              type="file"
              accept="application/json,.json"
              onChange={loadJsonFile}
            />
          </div>
          <div className="tikz-style-import">
            <span className="control-label">Import TikZ style file</span>
            <button
              type="button"
              className="toolbar-button"
              onClick={openStyleImportPicker}
            >
              Choose .sty/.tex
            </button>
            <input
              ref={styleImportFileInputRef}
              className="file-input"
              type="file"
              accept=".sty,.tex,text/x-tex,text/plain"
              onChange={importTikzStyleFileFromPicker}
            />
            {styleImportReport.status !== 'idle' && (
              <div
                className={`tikz-style-import-report tikz-style-import-report-${styleImportReport.status}`}
                role="status"
              >
                <span>{styleImportReport.message}</span>
                <span>Source: {styleImportReport.sourceName}</span>
                <span>
                  {styleImportReport.importedCount} imported;{' '}
                  {styleImportReport.skippedCount} skipped.
                </span>
                {styleImportReport.keys.length > 0 && (
                  <ul className="tikz-style-import-keys">
                    {styleImportReport.keys.map((key) => (
                      <li key={key}>{key}</li>
                    ))}
                  </ul>
                )}
                {styleImportReport.warnings.length > 0 && (
                  <details className="tikz-style-import-warnings">
                    <summary>{styleImportReport.warnings.length} warning(s)</summary>
                    <ul>
                      {styleImportReport.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <span
            className={`toolbar-status file-status file-status-${saveLoadStatus}`}
            role="status"
          >
            {saveLoadMessage}
          </span>
        </div>

        {shouldShowWorkPlaneControls(editableDiagram.ambientDimension) && (
          <section className="work-plane-control" aria-labelledby="work-plane-heading">
            <div className="work-plane-summary-row">
              <button
                type="button"
                className="work-plane-summary-toggle"
                aria-expanded={showWorkPlaneDetails}
                aria-controls="work-plane-details"
                onClick={() =>
                  setIsWorkPlaneDetailsExpanded((expanded) => !expanded)
                }
              >
                <span className="work-plane-disclosure" aria-hidden="true">
                  {showWorkPlaneDetails ? 'v' : '>'}
                </span>
                <span id="work-plane-heading" className="control-label">
                  Work plane
                </span>
                <span className="work-plane-summary">
                  {workPlaneSummaryLabel(activeWorkPlane)}
                </span>
              </button>
              {workPlaneStatus !== '' && (
                <span className="toolbar-status work-plane-status" role="status">
                  {workPlaneStatus}
                </span>
              )}
            </div>

            {showWorkPlaneDetails && (
              <div id="work-plane-details" className="work-plane-details">
                <div
                  className="work-plane-panel work-plane-preset-panel"
                  role="group"
                  aria-label="Preset work plane"
                >
                  <div className="work-plane-section-heading">
                    <h3>Preset</h3>
                  </div>
                  <div className="work-plane-preset-row">
                    <label className="work-plane-preset-field">
                      <span>Plane</span>
                      <select
                        className="toolbar-select"
                        value={workPlaneSelectValue(activeWorkPlane)}
                        onChange={(event) => {
                          const value = event.currentTarget
                            .value as WorkPlaneSelectValue

                          if (value !== 'custom') {
                            updateWorkPlaneKind(value)
                          }
                        }}
                      >
                        {activeWorkPlane.kind === 'custom' && (
                          <option value="custom">{activeWorkPlane.name}</option>
                        )}
                        {workPlaneKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {workPlaneLabel(kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {activeWorkPlane.kind !== 'custom' && (
                      <label className="work-plane-fixed">
                        <span>{workPlaneFixedAxis(activeWorkPlane)}</span>
                        <input
                          type="number"
                          step="any"
                          value={String(workPlaneFixedValue(activeWorkPlane))}
                          onChange={(event) =>
                            updateWorkPlaneFixedValue(event.currentTarget.value)
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>

                <form
                  className="work-plane-panel custom-work-plane-form"
                  aria-label="Custom plane by origin and normal"
                  onSubmit={(event) => {
                    event.preventDefault()
                    applyCustomOriginNormalWorkPlane()
                  }}
                >
                  <div className="work-plane-section-heading">
                    <h3>Custom by origin + normal</h3>
                  </div>
                  <div className="work-plane-vector-stack">
                    {(['origin', 'normal'] as const).map((vector) => {
                      const label = vector === 'origin' ? 'Origin' : 'Normal'

                      return (
                        <div
                          key={vector}
                          className="work-plane-vector-row"
                          role="group"
                          aria-label={label}
                        >
                          <span className="work-plane-vector-label">{label}</span>
                          {workPlaneVectorAxes.map((axis) => (
                            <label key={axis} className="custom-work-plane-field">
                              <span>{axis}</span>
                              <input
                                type="number"
                                step="any"
                                value={customWorkPlaneInput[vector][axis]}
                                onChange={(event) =>
                                  updateCustomWorkPlaneVectorInput(
                                    vector,
                                    axis,
                                    event.currentTarget.value,
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  <div className="work-plane-action-row">
                    <button type="submit" className="toolbar-button">
                      Apply
                    </button>
                  </div>
                </form>

                <form
                  className="work-plane-panel custom-work-plane-form"
                  aria-label="Custom plane by three points"
                  onSubmit={(event) => {
                    event.preventDefault()
                    applyCustomThreePointWorkPlane()
                  }}
                >
                  <div className="work-plane-section-heading">
                    <h3>Custom by 3 points</h3>
                  </div>
                  <div className="work-plane-vector-stack">
                    {(['p0', 'p1', 'p2'] as const).map((point) => (
                      <div
                        key={point}
                        className="work-plane-vector-row"
                        role="group"
                        aria-label={point.toUpperCase()}
                      >
                        <span className="work-plane-vector-label">
                          {point.toUpperCase()}
                        </span>
                        {workPlaneVectorAxes.map((axis) => (
                          <label key={axis} className="custom-work-plane-field">
                            <span>{axis}</span>
                            <input
                              type="number"
                              step="any"
                              value={customThreePointWorkPlaneInput[point][axis]}
                              onChange={(event) =>
                                updateCustomThreePointWorkPlaneVectorInput(
                                  point,
                                  axis,
                                  event.currentTarget.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="work-plane-action-row">
                    <button type="submit" className="toolbar-button">
                      Apply
                    </button>
                  </div>
                </form>

                <div
                  className="work-plane-panel work-plane-point-picker"
                  role="group"
                  aria-label="Custom plane from existing point strata"
                >
                  <div className="work-plane-section-heading">
                    <h3>Pick 3 existing points</h3>
                    <span className="work-plane-picked-count" role="status">
                      {workPlanePointPickingStatus(workPlanePointPickingState)}
                    </span>
                  </div>
                  <div className="work-plane-action-row">
                    <button
                      type="button"
                      className="toolbar-button"
                      disabled={workPlanePointPickingState.active}
                      onClick={startExistingPointWorkPlanePicking}
                    >
                      Pick points
                    </button>
                    <button
                      type="button"
                      className="toolbar-button"
                      disabled={!workPlanePointPickingState.active}
                      onClick={resetExistingPointWorkPlanePicking}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="toolbar-button"
                      disabled={!workPlanePointPickingState.active}
                      onClick={cancelExistingPointWorkPlanePicking}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="toolbar-button"
                      disabled={
                        !workPlanePointPickingState.active ||
                        workPlanePointPickingState.pickedPointIds.length !== 3
                      }
                      onClick={applyExistingPointWorkPlane}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
        </section>
      </div>

      {pendingSymbolicImport !== null && (
        <div className="symbolic-import-backdrop">
          <section
            className="symbolic-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="symbolic-import-heading"
          >
            <div className="symbolic-import-heading-row">
              <div>
                <h2 id="symbolic-import-heading">Resolve symbolic variables</h2>
                <p>
                  This diagram uses symbolic variables. Enter numeric preview
                  values or expressions.
                </p>
              </div>
            </div>
            <div className="symbolic-import-variable-list">
              {pendingSymbolicImport.variables.map((variable) => {
                const draft =
                  symbolicImportDrafts.find(
                    (candidate) => candidate.name === variable.name,
                  ) ?? {
                    name: variable.name,
                    expression: variable.expression,
                  }

                return (
                  <label
                    key={variable.name}
                    className="symbolic-import-variable-row"
                  >
                    <span>{variable.name}</span>
                    <input
                      type="text"
                      value={draft.expression}
                      spellCheck={false}
                      placeholder={variable.defined ? undefined : 'required'}
                      onChange={(event) =>
                        updateSymbolicImportDraft(
                          variable.name,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </label>
                )
              })}
            </div>
            {symbolicImportStatus !== '' && (
              <div className="symbolic-import-error" role="status">
                {symbolicImportStatus}
              </div>
            )}
            <div className="symbolic-import-actions">
              <button
                type="button"
                className="toolbar-button"
                onClick={cancelSymbolicImport}
              >
                Cancel
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!symbolicImportCanConfirm}
                onClick={confirmSymbolicImport}
              >
                Load diagram
              </button>
            </div>
          </section>
        </div>
      )}

      <section
        className="workspace"
        aria-label="Preview, inspector, and TikZ source"
      >
        <div className="preview-inspector-row preview-shell">
          <article className="workspace-panel preview-panel">
          <div className="panel-heading">
            <div>
              <h2>SVG Preview</h2>
              <span>{selectedExample.summary}</span>
            </div>
          </div>
          <div className="preview-stage">
            {renderPreviewToolbarOverlay()}
            {renderDirectInputDrawer()}
            {renderInspectorDrawer()}
            {renderLayerManagerOverlay()}
            <SvgDiagram
              diagram={editableDiagram}
              fitToView
              cameraOverride={previewCameraOverride}
              cameraViewAdjustment={previewCameraAdjustment}
              selectedElement={selectedElement}
              polylineDraft={polylineDraft?.points}
              cubicBezierDraft={cubicBezierDraft?.points}
              pathDraft={pathDraft ?? undefined}
              sheetDraft={sheetPolygonDraft?.points}
              workPlanePreview={workPlanePreview}
              coordinateSourceHighlights={coordinateSourceHighlights}
              boundaryPathHighlights={boundaryPathHighlights}
              layerFilter={layerFilter}
              visibilityOptions={visibilityOptions}
              showGeometryHandles={
                creationTool === 'select' && !workPlanePointPickingState.active
              }
              onSelectionChange={
                boundaryPathClickWorkflow === 'select'
                  ? updateSelectedElement
                  : undefined
              }
              onCurveStratumClick={
                boundaryPathClickWorkflow === 'ruledSurface' ||
                boundaryPathClickWorkflow === 'coonsPatch'
                  ? handleBoundarySurfaceCurveClick
                  : undefined
              }
              onCanvasClick={
                !previewCursorCreationClicksEnabled ||
                workPlanePointPickingState.active
                  ? undefined
                  : handlePreviewCreationClick
              }
              onPointStratumClick={
                workPlanePointPickingState.active
                  ? pickExistingPointForWorkPlane
                  : !previewCursorCreationClicksEnabled
                    ? undefined
                    : handleExistingPointSourceCreationClick
              }
              onGeometryHandleDrag={
                creationTool === 'select' && !workPlanePointPickingState.active
                  ? handleGeometryHandleDrag
                  : undefined
              }
              onGeometryHandleDragStart={
                creationTool === 'select' && !workPlanePointPickingState.active
                  ? handleGeometryHandleDragStart
                  : undefined
              }
              onGeometryHandleDragEnd={
                creationTool === 'select' && !workPlanePointPickingState.active
                  ? handleGeometryHandleDragEnd
                  : undefined
              }
              onCameraDrag={
                showCameraControls &&
                creationTool === 'select' &&
                !workPlanePointPickingState.active
                  ? handleCameraDrag
                  : undefined
              }
            />

            {showCameraControls && (
              <section
                className={
                  isCameraPanelAside
                    ? 'camera-control camera-control-aside'
                    : 'camera-control'
                }
                aria-labelledby="camera-heading"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="camera-summary-row">
                  <button
                    type="button"
                    className="camera-summary-toggle"
                    aria-expanded={showCameraDetails}
                    aria-controls="camera-details"
                    onClick={() =>
                      setIsCameraDetailsExpanded((expanded) => !expanded)
                    }
                  >
                    <span className="camera-disclosure" aria-hidden="true">
                      {showCameraDetails ? 'v' : '>'}
                    </span>
                    <span id="camera-heading" className="control-label">
                      Camera
                    </span>
                    <span className="camera-summary">
                      {cameraSummaryLabel(cameraControl)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={resetCameraViewToInitial}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={!canResetCameraToSaved}
                    onClick={resetCameraViewToSaved}
                  >
                    Saved
                  </button>
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={fitCameraView}
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    className="toolbar-button camera-aside-button"
                    onClick={toggleCameraPanelAside}
                  >
                    {isCameraPanelAside ? 'Restore' : 'Aside'}
                  </button>
                </div>

                {showCameraDetails && (
                  <div id="camera-details" className="camera-details">
                    <div className="camera-field-grid">
                      {cameraNumericFields.map((field) => (
                        <label key={field.field} className="camera-field">
                          <span>{field.label}</span>
                          <input
                            type="number"
                            step="any"
                            value={cameraControlFieldValue(
                              cameraControl,
                              field.field,
                            )}
                            onChange={(event) =>
                              updateCameraNumericField(
                                field.field,
                                event.currentTarget.value,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="camera-preset-field">
                      <span>Preset</span>
                      <select
                        className="toolbar-select"
                        value={activeCameraPresetId ?? 'custom'}
                        onChange={(event) =>
                          updateCameraPreset(
                            event.currentTarget.value as CameraPresetId | 'custom',
                          )
                        }
                      >
                        <option value="custom">custom</option>
                        {cameraPresetOptions.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <p className="camera-help">
                  Drag background to orbit. Shift-drag or middle-drag to pan.
                  Zoom is manual.
                </p>
                {cameraStatus !== '' && (
                  <span className="toolbar-status camera-status" role="status">
                    {cameraStatus}
                  </span>
                )}
              </section>
            )}
          </div>
          </article>
        </div>

        <article className="workspace-panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Generated TikZ</h2>
              <span>read-only source</span>
            </div>
            <div className="copy-controls">
              <label className="tikz-export-mode-control">
                <span>TikZ export mode:</span>
                <select
                  className="toolbar-select"
                  value={tikzExportMode}
                  aria-describedby="tikz-export-mode-help"
                  onChange={(event) =>
                    updateTikzExportMode(
                      tikzExportModeFromSelectValue(event.currentTarget.value),
                    )
                  }
                >
                  {tikzExportModeOptions.map((option) => (
                    <option key={option.mode} value={option.mode}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p id="tikz-export-mode-help" className="tikz-export-help">
                {inlineMathTikzExportHelp}
              </p>
              <label className="tikz-export-checkbox">
                <input
                  type="checkbox"
                  checked={
                    editableDiagram.ambientDimension === 3 &&
                    includeCoordinateAxesInTikz
                  }
                  disabled={editableDiagram.ambientDimension !== 3}
                  onChange={(event) =>
                    updateCoordinateAxesTikzExport(event.currentTarget.checked)
                  }
                />
                <span>Show xyz axes in TikZ output</span>
              </label>
              <div className="tikz-export-control-heading">3D Visibility</div>
              <label className="tikz-export-checkbox">
                <input
                  type="checkbox"
                  checked={
                    editableDiagram.ambientDimension === 3 &&
                    visibilityOptions.enabled
                  }
                  disabled={editableDiagram.ambientDimension !== 3}
                  onChange={(event) =>
                    updateAutoVisibility(event.currentTarget.checked)
                  }
                />
                <span>Enable approximate 3D visibility</span>
              </label>
              <label className="tikz-export-checkbox">
                <input
                  type="checkbox"
                  checked={
                    editableDiagram.ambientDimension === 3 &&
                    visibilityOptions.surfaceDepthSort
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updateSurfaceDepthSort(event.currentTarget.checked)
                  }
                />
                <span>Auto depth-sort surfaces</span>
              </label>
              <label className="tikz-export-checkbox">
                <input
                  type="checkbox"
                  checked={
                    editableDiagram.ambientDimension === 3 &&
                    visibilityOptions.curveOcclusion
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updateCurveOcclusion(event.currentTarget.checked)
                  }
                />
                <span>Auto hide/dot curves behind sheets</span>
              </label>
              <label className="tikz-export-mode-control">
                <span>Sort mode:</span>
                <select
                  className="toolbar-select"
                  value={visibilityOptions.sortMode}
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updateVisibilitySortMode(
                      event.currentTarget.value as VisibilitySortMode,
                    )
                  }
                >
                  {visibilitySortModeOptions.map((option) => (
                    <option key={option.mode} value={option.mode}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tikz-export-mode-control">
                <span>Surface face cap:</span>
                <input
                  className="toolbar-select"
                  type="number"
                  min="1"
                  max={hardMaxSurfaceFacesForSorting}
                  step="1"
                  value={
                    visibilityOptions.maxSurfaceFacesForSorting ??
                    defaultMaxSurfaceFacesForSorting
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updateMaxSurfaceFacesForSorting(
                      event.currentTarget.value,
                    )
                  }
                />
              </label>
              <label className="tikz-export-mode-control">
                <span>Curve sample cap:</span>
                <input
                  className="toolbar-select"
                  type="number"
                  min="1"
                  max={hardMaxCurveSamples}
                  step="1"
                  value={
                    visibilityOptions.maxCurveSamples ?? defaultMaxCurveSamples
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled ||
                    !visibilityOptions.curveOcclusion
                  }
                  onChange={(event) =>
                    updateMaxCurveSamples(event.currentTarget.value)
                  }
                />
              </label>
              <label className="tikz-export-mode-control">
                <span>Hidden curves:</span>
                <select
                  className="toolbar-select"
                  value={
                    visibilityOptions.hiddenCurveStyle?.lineStyle ??
                    defaultHiddenCurveStyle.lineStyle
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled ||
                    !visibilityOptions.curveOcclusion
                  }
                  onChange={(event) =>
                    updateHiddenCurveLineStyle(
                      hiddenCurveLineStyleFromSelectValue(
                        event.currentTarget.value,
                      ),
                    )
                  }
                >
                  {hiddenCurveLineStyleOptions.map((option) => (
                    <option key={option.style} value={option.style}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tikz-export-mode-control">
                <span>Hidden opacity:</span>
                <input
                  className="toolbar-select"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={
                    visibilityOptions.hiddenCurveStyle?.opacity ??
                    defaultHiddenCurveStyle.opacity
                  }
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled ||
                    !visibilityOptions.curveOcclusion
                  }
                  onChange={(event) =>
                    updateHiddenCurveOpacity(event.currentTarget.value)
                  }
                />
              </label>
              <label className="tikz-export-mode-control">
                <span>Hidden points:</span>
                <select
                  className="toolbar-select"
                  value={visibilityOptions.pointVisibility}
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updatePointVisibility(
                      pointVisibilityPolicyFromSelectValue(
                        event.currentTarget.value,
                      ),
                    )
                  }
                >
                  {pointVisibilityPolicyOptions.map((option) => (
                    <option key={option.policy} value={option.policy}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tikz-export-mode-control">
                <span>Label visibility:</span>
                <select
                  className="toolbar-select"
                  value={visibilityOptions.labelVisibility}
                  disabled={
                    editableDiagram.ambientDimension !== 3 ||
                    !visibilityOptions.enabled
                  }
                  onChange={(event) =>
                    updateLabelVisibility(
                      labelVisibilityPolicyFromSelectValue(
                        event.currentTarget.value,
                      ),
                    )
                  }
                >
                  {labelVisibilityPolicyOptions.map((option) => (
                    <option key={option.policy} value={option.policy}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tikz-export-actions">
                <button type="button" className="copy-button" onClick={copyTikz}>
                  Copy TikZ
                </button>
                <button
                  type="button"
                  className="copy-button"
                  onClick={downloadTikz}
                  title={`Download ${tikzDownloadFilenameForMode(tikzExportMode)}`}
                >
                  Download TikZ
                </button>
              </div>
              <span className="copy-status" role="status">
                {copyStatus === 'copied' && 'Copied'}
                {copyStatus === 'downloaded' && 'Downloaded'}
                {copyStatus === 'failed' && 'Copy/download failed'}
              </span>
            </div>
          </div>
          <textarea
            className="tikz-source"
            value={tikzSource}
            readOnly
            spellCheck={false}
            aria-label="Generated TikZ source"
          />
        </article>
      </section>
    </main>
  )
}

function workPlaneLabel(kind: AxisAlignedWorkPlaneName): string {
  switch (kind) {
    case 'xy':
      return 'xy plane'
    case 'xz':
      return 'xz plane'
    case 'yz':
      return 'yz plane'
  }
}

function geometryHandleTargetsSelection(
  target: GeometryHandleTarget,
  selectedElement: SelectedElement,
): boolean {
  if (selectedElement === null) {
    return false
  }

  switch (target.kind) {
    case 'pointPosition':
    case 'curvePoint':
    case 'pathSegmentPoint':
    case 'circleTemplateRadius':
    case 'ellipseTemplateRadiusX':
    case 'ellipseTemplateRadiusY':
    case 'sheetVertex':
      return (
        selectedElement.kind === 'stratum' &&
        selectedElement.id === target.stratumId
      )
    case 'labelPosition':
      return (
        selectedElement.kind === 'label' &&
        selectedElement.id === target.labelId
      )
  }
}

function geometryHandleWorkPlaneForTarget(
  target: GeometryHandleTarget,
  stratum: Stratum,
): WorkPlane | null {
  if (
    target.kind !== 'circleTemplateRadius' &&
    target.kind !== 'ellipseTemplateRadiusX' &&
    target.kind !== 'ellipseTemplateRadiusY'
  ) {
    return null
  }

  if (
    stratum.geometricKind !== 'curve' ||
    stratum.kind !== 'templatePath' ||
    stratum.template.frame === undefined
  ) {
    return null
  }

  return {
    kind: 'custom',
    id: `${stratum.id}-template-plane`,
    name: `${stratum.name} template plane`,
    origin: stratum.template.frame.origin,
    u: stratum.template.frame.u,
    v: stratum.template.frame.v,
    normal: stratum.template.frame.normal,
    source: { kind: 'originNormal' },
  }
}

function isDirectCreationTool(tool: CreationTool): tool is DirectCreationTool {
  return (
    tool === 'createPoint' ||
    tool === 'createLabel' ||
    tool === 'createPolyline' ||
    tool === 'createCubicBezier' ||
    tool === 'createPath' ||
    tool === 'createSheet' ||
    tool === 'createGrid'
  )
}

function isDirectPathCreationTool(
  tool: DirectCreationTool,
): tool is 'createPolyline' | 'createCubicBezier' | 'createSheet' {
  return (
    tool === 'createPolyline' ||
    tool === 'createCubicBezier' ||
    tool === 'createSheet'
  )
}

function usesDirectCoordinateRows(
  tool: DirectCreationTool,
  sheetCreationKind: SheetCreationKind,
): tool is 'createPolyline' | 'createCubicBezier' | 'createSheet' {
  return (
    isDirectPathCreationTool(tool) &&
    (tool !== 'createSheet' || sheetCreationKind === 'polygon')
  )
}

function directCreationTitle(tool: DirectCreationTool): string {
  switch (tool) {
    case 'createPoint':
      return 'Point'
    case 'createLabel':
      return 'Label'
    case 'createPolyline':
      return 'Polyline'
    case 'createCubicBezier':
      return 'Cubic Bezier'
    case 'createPath':
      return 'Path'
    case 'createSheet':
      return 'Sheet'
    case 'createGrid':
      return 'Grid'
  }
}

function directCreationErrorMessage(
  error: DirectPathCreationError,
  kind: 'polyline' | 'cubicBezier' | 'path' | 'sheet',
): string {
  switch (error) {
    case 'invalidCoordinates':
      return 'Coordinates must be valid finite expressions.'
    case 'invalidRadius':
      return 'Radii must be positive finite numbers.'
    case 'invalidAngle':
      return 'Angles must be finite, and arc start and end angles must differ.'
    case 'invalidWorkPlane':
      return 'The active work plane must be valid, and 3D template centers must lie on it.'
    case 'tooFewPoints':
      return kind === 'path'
        ? 'A path needs at least one segment.'
        : kind === 'sheet'
        ? 'A sheet needs at least 3 vertices.'
        : 'A polyline needs at least 2 vertices.'
    case 'wrongPointCount':
      return 'A cubic Bezier needs exactly 4 points.'
    case 'unsupportedAmbientDimension':
      return kind === 'sheet'
        ? 'Sheets are available only in 3D.'
        : 'This cubic Bezier control mode requires 2D coordinates or 3D active work-plane local coordinates.'
  }
}

function directGridCreationErrorMessage(
  error: DirectGridCreationError,
  detail?: string,
): string {
  if (detail !== undefined && detail.trim().length > 0) {
    return detail
  }

  switch (error) {
    case 'invalidScalar':
      return 'Grid range and clip values must be valid finite scalar expressions.'
    case 'invalidWorkPlane':
      return 'The active work plane must be valid before creating a 3D grid.'
    case 'invalidGrid':
      return 'Grid ranges, clipping bounds, and line count must be valid.'
  }
}

function sheetCreationStatusPrompt(kind: SheetCreationKind): string {
  switch (kind) {
    case 'polygon':
      return 'Click the preview to add sheet vertices.'
    case 'hemisphere':
      return 'Click the preview to place the hemisphere center.'
    case 'saddle':
      return 'Click the preview to place the saddle origin.'
    case 'ruledSurface':
      return 'Pick first boundary path.'
    case 'coonsPatch':
      return 'Pick bottom boundary path.'
  }
}

function sheetCreationKindLabel(kind: SheetCreationKind): string {
  switch (kind) {
    case 'polygon':
      return 'Sheet'
    case 'hemisphere':
      return 'Hemisphere'
    case 'saddle':
      return 'Saddle'
    case 'ruledSurface':
      return 'Ruled surface'
    case 'coonsPatch':
      return 'Coons patch'
  }
}

function curvedSheetAnchorLabel(kind: CurvedSheetCreationKind): string {
  switch (kind) {
    case 'hemisphere':
      return 'center'
    case 'saddle':
      return 'origin'
  }
}

function isAnchorCurvedSheetCreationKind(
  kind: SheetCreationKind,
): kind is CurvedSheetCreationKind {
  return kind === 'hemisphere' || kind === 'saddle'
}

function isBoundarySurfaceSheetCreationKind(
  kind: SheetCreationKind,
): kind is 'ruledSurface' | 'coonsPatch' {
  return kind === 'ruledSurface' || kind === 'coonsPatch'
}

function createBoundaryPathHighlightsForSheetDraft(
  creationTool: CreationTool,
  sheetCreationKind: SheetCreationKind,
  ruledSurfaceDraft: RuledSurfaceBoundaryDraft,
  coonsPatchDraft: CoonsPatchBoundaryDraft,
): BoundaryPathHighlight[] {
  if (creationTool !== 'createSheet') {
    return []
  }

  if (sheetCreationKind === 'ruledSurface') {
    return ruledSurfaceBoundaryDraftPickedPathIds(ruledSurfaceDraft).map(
      (pathId, index) => ({
        id: pathId,
        label: `Boundary ${index + 1}`,
      }),
    )
  }

  if (sheetCreationKind === 'coonsPatch') {
    return coonsPatchBoundaryRoles.flatMap((role) => {
      const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(
        coonsPatchDraft,
        role,
      )

      if (picked === null || picked.kind === 'point') {
        return []
      }

      return [
        {
          id: picked.sourcePathId,
          label: coonsPatchBoundaryRoleLabel(role),
        },
      ]
    })
  }

  return []
}

function coonsPatchBoundaryRoleLabel(role: CoonsPatchBoundaryRole): string {
  switch (role) {
    case 'bottom':
      return 'bottom'
    case 'right':
      return 'right'
    case 'top':
      return 'top'
    case 'left':
      return 'left'
  }
}

function coonsPatchBoundaryDraftCanCreateWithCurrentDirections(
  diagram: Diagram,
  draft: CoonsPatchBoundaryDraft,
): boolean {
  return (
    coonsPatchBoundaryDraftCanCreate(draft) &&
    validateCoonsPatchBoundarySelections(
      diagram,
      coonsPatchBoundarySelectionsFromDraft(draft),
    ).ok
  )
}

function coonsPatchBoundaryDraftStatusForUi(
  diagram: Diagram,
  draft: CoonsPatchBoundaryDraft,
): string {
  if (!coonsPatchBoundaryDraftCanCreate(draft)) {
    return coonsPatchBoundaryDraftStatusMessage(draft)
  }

  const validation = validateCoonsPatchBoundarySelections(
    diagram,
    coonsPatchBoundarySelectionsFromDraft(draft),
  )

  if (validation.ok) {
    return 'Coons patch: picked 4/4. Boundary directions match. Create is enabled.'
  }

  return (
    (validation.error === 'invalidBoundary'
      ? coonsPatchCornerMismatchMessage(
          diagram,
          coonsPatchBoundarySelectionsFromDraft(draft),
        )
      : null) ??
    createCoonsPatchFromBoundaryPathsErrorMessage(
      validation.error,
      validation.role,
    )
  )
}

function formatCoonsPatchBoundaryDirectionSummary(
  diagram: Diagram,
  draft: CoonsPatchBoundaryDraft,
  role: CoonsPatchBoundaryRole,
): string {
  const picked = coonsPatchBoundaryDraftPickedBoundaryForRole(draft, role)

  if (picked === null) {
    return 'not picked'
  }

  const source = diagram.strata.find(
    (stratum) =>
      stratum.id ===
      (picked.kind === 'point' ? picked.sourcePointId : picked.sourcePathId),
  )
  const sourceLabel =
    source?.name !== undefined && source.name.trim().length > 0
      ? source.name
      : picked.kind === 'point'
        ? picked.sourcePointId
        : picked.sourcePathId

  if (picked.kind === 'point') {
    const sourceResult = validateCoonsPatchBoundaryPointSource(
      diagram,
      picked.sourcePointId,
    )

    if (!sourceResult.ok) {
      return `${sourceLabel} (constant; ${coonsPatchBoundaryPointSourceErrorMessage(
        sourceResult.error,
      )})`
    }

    return `${sourceLabel} (constant) ${formatCompactVec3(
      sourceResult.boundary.point,
    )} -> ${formatCompactVec3(sourceResult.boundary.point)}`
  }

  const sourceResult = validateCoonsPatchBoundaryPathSource(
    diagram,
    picked.sourcePathId,
  )
  const direction = picked.reversed ? 'reversed' : 'normal'

  if (!sourceResult.ok) {
    return `${sourceLabel} (${direction}; ${coonsPatchBoundaryPathSourceErrorMessage(
      sourceResult.error,
    )})`
  }

  const endpoints = pathEndpoints(
    orientedPathCoonsBoundarySnapshot(
      sourceResult.boundary,
      picked.reversed,
    ).segments,
  )

  return endpoints === null
    ? `${sourceLabel} (${direction})`
    : `${sourceLabel} (${direction}) ${formatCompactVec3(
        endpoints.start,
      )} -> ${formatCompactVec3(endpoints.end)}`
}

function orientedPathCoonsBoundarySnapshot(
  boundary: Parameters<typeof orientedCoonsBoundarySnapshot>[0],
  reversed: boolean,
): BoundaryPathSnapshot {
  const oriented = orientedCoonsBoundarySnapshot(boundary, reversed)

  if (isConstantCoonsBoundarySnapshot(oriented)) {
    throw new Error('Expected a path Coons boundary.')
  }

  return oriented
}

function isConstantCoonsBoundarySnapshot(
  boundary: Parameters<typeof orientedCoonsBoundarySnapshot>[0],
): boundary is CoonsConstantPointBoundarySnapshot {
  return 'kind' in boundary && boundary.kind === 'constantPoint'
}

function formatCompactVec3(point: Vec3): string {
  return `(${formatCompactNumber(point.x)}, ${formatCompactNumber(
    point.y,
  )}, ${formatCompactNumber(point.z)})`
}

function formatCompactNumber(value: number): string {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value

  if (Number.isInteger(normalized)) {
    return String(normalized)
  }

  return normalized.toFixed(3).replace(/\.?0+$/, '')
}

function parseFiniteInput(
  rawValue: string,
  label: string,
  setStatus: (message: string) => void,
): number | null {
  const value = parseFiniteNumber(rawValue)

  if (value === null) {
    setStatus(`${label} must be finite.`)
    return null
  }

  return value
}

function parsePositiveInput(
  rawValue: string,
  label: string,
  setStatus: (message: string) => void,
): number | null {
  const value = parseFiniteInput(rawValue, label, setStatus)

  if (value === null) {
    return null
  }

  if (value <= 0) {
    setStatus(`${label} must be positive.`)
    return null
  }

  return value
}

function parseSamplingInput(
  rawValue: string,
  label: string,
  setStatus: (message: string) => void,
): number | null {
  const value = parseFiniteInput(rawValue, label, setStatus)

  if (value === null) {
    return null
  }

  if (!Number.isInteger(value) || value <= 0) {
    setStatus(`${label} must be a positive integer.`)
    return null
  }

  if (value > maxCurvedSheetSamplingSegments) {
    setStatus(
      `${label} must be at most ${maxCurvedSheetSamplingSegments}.`,
    )
    return null
  }

  return value
}

function concatenatedPathDraftStatusMessage(
  draft: ConcatenatedPathDraft,
): string {
  const nextPoint = concatenatedPathDraftNextPointLabel(draft)
  const segmentCount = draft.segments.length
  const segmentWord = segmentCount === 1 ? 'segment' : 'segments'

  return `${segmentCount} complete ${segmentWord}. Next: ${nextPoint}.`
}

function concatenatedPathDraftPointErrorMessage(
  reason: 'nonFinitePoint' | 'pointOffWorkPlane',
): string {
  switch (reason) {
    case 'nonFinitePoint':
      return 'Path points must be finite numbers.'
    case 'pointOffWorkPlane':
      return 'Path points must stay on the draft work plane.'
  }
}

function directCoordinateRowsPlaceholder(
  ambientDimension: AmbientDimension,
  controlMode: DirectCubicBezierControlMode = 'absolute',
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (controlMode === 'relativePolar') {
    return '0 0\n1 0\n60 0.7\n120 0.7'
  }

  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n1 0'
  }

  return ambientDimension === 2 ? '0 0\n1 0' : '0 0 0\n1 0 0'
}

function directCoordinateRowsTextAreaRows(
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
): number {
  switch (tool) {
    case 'createPolyline':
      return 3
    case 'createCubicBezier':
      return 4
    case 'createSheet':
      return 4
  }
}

function applyDirectCoordinateSources(
  rows: DirectCoordinateInput[],
  sources: Array<ExistingCoordinateSource | null>,
): DirectCoordinateInput[] {
  return rows.map((row, index) => {
    const source = sources[index]

    return source === undefined || source === null ? row : { ...row, source }
  })
}

function directSourceTargetRows(
  rows: string,
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
): number[] {
  const rowCount = Math.max(countDirectCoordinateRows(rows), directMinimumRowCount(tool))

  return Array.from({ length: rowCount }, (_value, index) => index + 1)
}

function directSourceSummary(
  sources: Array<ExistingCoordinateSource | null>,
  options: ExistingCoordinateSourceOption[],
): string {
  const labels = sources.flatMap((source, index) => {
    if (source === null) {
      return []
    }

    const key = existingCoordinateSourceKey(source)
    const option = options.find((candidate) => candidate.key === key)
    return [`Row ${index + 1}: ${option?.label ?? 'Unavailable source'}`]
  })

  return labels.length === 0 ? 'No source rows.' : labels.join('; ')
}

function countDirectCoordinateRows(rows: string): number {
  const trimmedRows = rows.trim()

  if (trimmedRows.length === 0) {
    return 0
  }

  return trimmedRows.split(/\r?\n/u).filter((row) => row.trim().length > 0).length
}

function directMinimumRowCount(
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
): number {
  switch (tool) {
    case 'createPolyline':
      return 2
    case 'createCubicBezier':
      return 4
    case 'createSheet':
      return 3
  }
}

function defaultDirectPolylineRows(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n1 0'
  }

  return ambientDimension === 2 ? '0 0\n1 0' : '0 0 0\n1 0 0'
}

function defaultDirectCubicBezierRows(
  ambientDimension: AmbientDimension,
  controlMode: DirectCubicBezierControlMode = 'absolute',
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (controlMode === 'relativeCartesian') {
    if (
      ambientDimension === 3 &&
      coordinateMode === 'workPlaneLocal'
    ) {
      return '0 0\n1 0\n0.3 0.6\n-0.3 0.6'
    }

    return ambientDimension === 2
      ? '0 0\n1 0\n0.3 0.6\n-0.3 0.6'
      : '0 0 0\n1 0 0\n0.3 0.6 0\n-0.3 0.6 0'
  }

  if (controlMode === 'relativePolar') {
    return '0 0\n1 0\n60 0.7\n120 0.7'
  }

  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return '0 0\n0.3 0.6\n0.7 0.6\n1 0'
  }

  return ambientDimension === 2
    ? '0 0\n0.3 0.6\n0.7 0.6\n1 0'
    : '0 0 0\n0.3 0.6 0\n0.7 0.6 0\n1 0 0'
}

function defaultDirectPathLineSegment(): DirectPathManualSegmentDraft {
  return {
    kind: 'line',
    center: directCoordinateInput('0', '0', '0'),
    control1: directCoordinateInput('0.3', '0.6', '0'),
    control2: directCoordinateInput('0.7', '0.6', '0'),
    end: directCoordinateInput('1', '0', '0'),
    radius: '1',
    endAngleDeg: '90',
    direction: 'counterclockwise',
  }
}

function defaultDirectPathCubicSegment(): DirectPathManualSegmentDraft {
  return {
    kind: 'cubicBezier',
    center: directCoordinateInput('0', '0', '0'),
    control1: directCoordinateInput('0.3', '0.6', '0'),
    control2: directCoordinateInput('0.7', '0.6', '0'),
    end: directCoordinateInput('1', '0', '0'),
    radius: '1',
    endAngleDeg: '90',
    direction: 'counterclockwise',
  }
}

function defaultDirectPathArcSegment(): DirectPathManualSegmentDraft {
  return {
    kind: 'arc',
    center: directCoordinateInput('0', '0', '0'),
    control1: directCoordinateInput('0.3', '0.6', '0'),
    control2: directCoordinateInput('0.7', '0.6', '0'),
    end: directCoordinateInput('1', '0', '0'),
    radius: '1',
    endAngleDeg: '90',
    direction: 'counterclockwise',
  }
}

function directCoordinateInput(
  x: string,
  y: string,
  z: string,
): DirectCoordinateInput {
  return { x, y, z }
}

function directPathSegmentInputFromDraft(
  segment: DirectPathManualSegmentDraft,
): DirectConcatenatedPathManualSegmentInput {
  switch (segment.kind) {
    case 'line':
      return {
        kind: 'line',
        end: segment.end,
      }
    case 'cubicBezier':
      return {
        kind: 'cubicBezier',
        control1: segment.control1,
        control2: segment.control2,
        end: segment.end,
      }
    case 'arc':
      return {
        kind: 'arc',
        center: segment.center,
        radius: segment.radius,
        endAngleDeg: segment.endAngleDeg,
        direction: segment.direction,
      }
  }
}

function directCoordinateInputWithSource(
  coordinates: DirectCoordinateInput,
  source: ExistingCoordinateSource | null,
): DirectCoordinateInput {
  const nextCoordinates: DirectCoordinateInput = { ...coordinates }

  if (source === null) {
    delete nextCoordinates.source
    return nextCoordinates
  }

  return {
    ...nextCoordinates,
    source,
  }
}

function directPathSegmentSourceRequests(
  segment: DirectPathManualSegmentDraft,
  segmentIndex: number,
): Array<{ source: ExistingCoordinateSource; label: string }> {
  return [
    ...(segment.kind === 'arc'
      ? [
          directPathCoordinateSourceRequest(
            segment.center,
            `segment ${segmentIndex + 1} center`,
          ),
        ]
      : []),
    ...(segment.kind === 'cubicBezier'
      ? [
          directPathCoordinateSourceRequest(
            segment.control1,
            `segment ${segmentIndex + 1} control 1`,
          ),
          directPathCoordinateSourceRequest(
            segment.control2,
            `segment ${segmentIndex + 1} control 2`,
          ),
        ]
      : []),
    ...(segment.kind === 'arc'
      ? []
      : [
          directPathCoordinateSourceRequest(
            segment.end,
            `segment ${segmentIndex + 1} end`,
          ),
        ]),
  ].filter(
    (
      request,
    ): request is {
      source: ExistingCoordinateSource
      label: string
    } => request !== null,
  )
}

function directPathCoordinateSourceRequest(
  coordinates: DirectCoordinateInput,
  label: string,
): { source: ExistingCoordinateSource; label: string } | null {
  return coordinates.source === undefined
    ? null
    : {
        source: coordinates.source,
        label,
      }
}

function directPathCoordinateSourceTargetFromKey(
  key: string,
): DirectPathCoordinateSourceTarget | null {
  if (key === 'manual-start') {
    return { kind: 'manualStart' }
  }

  if (key === 'template-center') {
    return { kind: 'templateCenter' }
  }

  const match = /^manual-segment-(\d+)-(center|control1|control2|end)$/u.exec(key)

  if (match === null) {
    return null
  }

  const segmentIndex = Number(match[1])

  return Number.isInteger(segmentIndex) && segmentIndex >= 0
    ? {
        kind: 'manualSegment',
        segmentIndex,
        role: match[2] as DirectPathManualCoordinateRole,
      }
    : null
}

function directPathCoordinateSourceTargetLabel(
  target: DirectPathCoordinateSourceTarget,
): string {
  switch (target.kind) {
    case 'manualStart':
      return 'Start'
    case 'templateCenter':
      return 'Center'
    case 'manualSegment':
      return `Segment ${target.segmentIndex + 1} ${directPathCoordinateRoleLabel(
        target.role,
      )}`
  }
}

function directPathCoordinateRoleLabel(
  role: DirectPathManualCoordinateRole,
): string {
  switch (role) {
    case 'center':
      return 'center'
    case 'control1':
      return 'control point 1'
    case 'control2':
      return 'control point 2'
    case 'end':
      return 'end'
  }
}

function directPathSegmentSourceTargetKey(
  segmentIndex: number,
  role: DirectPathManualCoordinateRole,
): string {
  return `manual-segment-${segmentIndex}-${role}`
}

function directCubicBezierControlModeOptions(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
): DirectCubicBezierControlMode[] {
  return directCubicBezierControlModes.filter((mode) =>
    isDirectCubicBezierControlModeAvailable(
      ambientDimension,
      coordinateMode,
      mode,
    ),
  )
}

function isDirectCubicBezierControlModeAvailable(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
  controlMode: DirectCubicBezierControlMode,
): boolean {
  return (
    controlMode !== 'relativePolar' ||
    ambientDimension === 2 ||
    coordinateMode === 'workPlaneLocal'
  )
}

function directCubicBezierControlModeLabel(
  controlMode: DirectCubicBezierControlMode,
): string {
  switch (controlMode) {
    case 'absolute':
      return 'Absolute'
    case 'relativeCartesian':
      return 'Relative Cartesian'
    case 'relativePolar':
      return 'Relative polar'
  }
}

function directCoordinateModeLabel(mode: DirectCoordinateMode): string {
  switch (mode) {
    case 'global':
      return 'Global 3D coordinates'
    case 'workPlaneLocal':
      return 'Active work-plane local coordinates'
  }
}

function directRowsLabel(
  tool: 'createPolyline' | 'createCubicBezier' | 'createSheet',
  controlMode: DirectCubicBezierControlMode,
): string {
  if (tool !== 'createCubicBezier') {
    return 'Vertices'
  }

  switch (controlMode) {
    case 'absolute':
      return 'Points'
    case 'relativeCartesian':
      return 'Start, end, offsets'
    case 'relativePolar':
      return 'Start, end, polar'
  }
}

function defaultDirectSheetRows(
  coordinateMode: DirectCoordinateMode = 'global',
): string {
  if (coordinateMode === 'workPlaneLocal') {
    return '0 0\n1 0\n0 1'
  }

  return '0 0 0\n1 0 0\n0 1 0'
}

function workPlaneFixedAxis(workPlane: WorkPlane): string {
  const kind =
    workPlane.kind === 'axisAligned' ? workPlane.plane : workPlane.kind

  switch (kind) {
    case 'xy':
      return 'z'
    case 'xz':
      return 'y'
    case 'yz':
      return 'x'
    case 'custom':
      return 'offset'
  }
}

function workPlaneFixedValue(workPlane: WorkPlane): number {
  switch (workPlane.kind) {
    case 'xy':
      return workPlane.z
    case 'xz':
      return workPlane.y
    case 'yz':
      return workPlane.x
    case 'axisAligned':
      return workPlane.offset
    case 'custom':
      return 0
  }
}

function directCoordinateAxes(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode = 'global',
): DirectCoordinateAxis[] {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return ['x', 'y']
  }

  return ambientDimension === 2 ? ['x', 'y'] : ['x', 'y', 'z']
}

function directCoordinateAxisLabel(
  axis: DirectCoordinateAxis,
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
): string {
  if (
    ambientDimension === 3 &&
    coordinateMode === 'workPlaneLocal'
  ) {
    return axis === 'x' ? 'a' : 'b'
  }

  return axis
}

function effectiveDirectCoordinateMode(
  ambientDimension: AmbientDimension,
  coordinateMode: DirectCoordinateMode,
): DirectCoordinateMode {
  return ambientDimension === 3 ? coordinateMode : 'global'
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function layerFilterStatusLabel(layerFilter: LayerFilter): string {
  return layerFilter.kind === 'all'
    ? 'all layers'
    : `layer ${formatLayerValue(layerFilter.layer)}`
}

function pickedPathCountLabel(count: number): string {
  return `Picked ${count} ${count === 1 ? 'path' : 'paths'}`
}

function fillRuleLabel(fillRule: FillRule): string {
  switch (fillRule) {
    case 'nonzero':
      return 'Nonzero'
    case 'evenOdd':
      return 'Even-odd'
  }
}

function formatLayerValue(layer: number): string {
  return Number.isInteger(layer) ? String(layer) : String(layer)
}

export default App
