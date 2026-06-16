import type {
  Camera3D,
  Camera3DProjectionBasis,
  OrthographicCamera3D,
  PerspectiveCamera3D,
} from './types.ts'

export const INITIAL_CAMERA_3D: OrthographicCamera3D = {
  mode: '3d',
  kind: 'orthographic',
  // 3D camera orientation is defined by tikz-3dplot theta/phi angles.
  thetaDeg: 13,
  phiDeg: -23,
  zoom: 1,
  pan: { x: 0, y: 0 },
}

export function createInitialCamera3D(): OrthographicCamera3D {
  return cloneCamera3D(INITIAL_CAMERA_3D)
}

export function resetCameraToInitial(): OrthographicCamera3D {
  return createInitialCamera3D()
}

export function isOrthographicCamera3D(
  camera: Camera3D,
): camera is OrthographicCamera3D {
  return camera.kind === 'orthographic'
}

export function isPerspectiveCamera3D(
  camera: Camera3D,
): camera is PerspectiveCamera3D {
  return camera.kind === 'perspective'
}

export function isSupportedCamera3D(
  camera: Camera3D,
): camera is OrthographicCamera3D {
  return isOrthographicCamera3D(camera)
}

export function cloneCamera3D(
  camera: OrthographicCamera3D,
): OrthographicCamera3D
export function cloneCamera3D(
  camera: PerspectiveCamera3D,
): PerspectiveCamera3D
export function cloneCamera3D(camera: Camera3D): Camera3D
export function cloneCamera3D(camera: Camera3D): Camera3D {
  if (isPerspectiveCamera3D(camera)) {
    return {
      mode: camera.mode,
      kind: camera.kind,
      thetaDeg: camera.thetaDeg,
      phiDeg: camera.phiDeg,
      zoom: camera.zoom,
      pan: { ...camera.pan },
      target: { ...camera.target },
      distance: camera.distance,
      fieldOfViewDeg: camera.fieldOfViewDeg,
    }
  }

  return {
    mode: camera.mode,
    kind: camera.kind,
    thetaDeg: camera.thetaDeg,
    phiDeg: camera.phiDeg,
    zoom: camera.zoom,
    pan: { ...camera.pan },
    ...(camera.projectionBasis === undefined
      ? {}
      : { projectionBasis: cloneCamera3DProjectionBasis(camera.projectionBasis) }),
  }
}

export function cloneCamera3DProjectionBasis(
  basis: Camera3DProjectionBasis,
): Camera3DProjectionBasis {
  return {
    xVector: [basis.xVector[0], basis.xVector[1]],
    yVector: [basis.yVector[0], basis.yVector[1]],
    zVector: [basis.zVector[0], basis.zVector[1]],
  }
}
