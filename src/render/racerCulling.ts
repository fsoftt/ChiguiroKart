import * as THREE from 'three'

const frustum = new THREE.Frustum()
const matrix = new THREE.Matrix4()
const sphere = new THREE.Sphere()

/** A racer is about 2 m across; the margin keeps its shadow and its wheels from popping. */
const RACER_RADIUS = 4

/**
 * Skinned racers cannot use three's own frustum culling (their bounding volume does not follow
 * the animation), so they are drawn from every angle. This hides the ones outside the camera's
 * view or beyond `maxDistance` (m); call it once per frame after the camera moved.
 */
export function cullRacers(
  camera: THREE.PerspectiveCamera,
  racers: readonly { readonly object: THREE.Object3D }[],
  maxDistance: number,
): void {
  camera.updateMatrixWorld()
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(matrix)
  for (const { object } of racers) {
    sphere.center.copy(object.position)
    sphere.radius = RACER_RADIUS
    object.visible =
      object.position.distanceTo(camera.position) <= maxDistance && frustum.intersectsSphere(sphere)
  }
}
