import type { Camera3D, Camera3DProjectionBasis } from './types.ts'

export const INITIAL_CAMERA_3D_PROJECTION_BASIS: Camera3DProjectionBasis = {
  xVector: [1, 0],
  yVector: [0.45, 0.25],
  zVector: [0, 1],
}

export const INITIAL_CAMERA_3D: Camera3D = {
  mode: '3d',
  kind: 'orthographic',
  thetaDeg: 13,
  phiDeg: -23,
  zoom: 1,
  pan: { x: 0, y: 0 },
  projectionBasis: INITIAL_CAMERA_3D_PROJECTION_BASIS,
}

export function createInitialCamera3D(): Camera3D {
  return cloneCamera3D(INITIAL_CAMERA_3D)
}

export function resetCameraToInitial(): Camera3D {
  return createInitialCamera3D()
}

export function cloneCamera3D(camera: Camera3D): Camera3D {
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
