import * as THREE from 'three'

/** Triangles and draw calls one group of meshes costs in the camera's view. */
export interface BreakdownRow {
  name: string
  drawCalls: number
  triangles: number
}

const frustum = new THREE.Frustum()
const matrix = new THREE.Matrix4()
const sphere = new THREE.Sphere()

/** Name a mesh is reported under: its own, without the number of a split cell. */
function groupName(mesh: THREE.Mesh): string {
  return (mesh.name || mesh.type).replace(/:\d+$/, '')
}

function triangleCount(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry
  const base = geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0)
  const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1
  return (base / 3) * instances
}

/**
 * Dev tool for the perf report: what the meshes inside the camera frustum cost, grouped by
 * mesh name (the main pass only; the shadow pass repeats the casters).
 */
export function frameBreakdown(scene: THREE.Scene, camera: THREE.Camera): BreakdownRow[] {
  camera.updateMatrixWorld()
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(matrix)
  const rows = new Map<string, BreakdownRow>()
  scene.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (object.frustumCulled) {
      const geometry = object.geometry
      if (object instanceof THREE.InstancedMesh) {
        if (!object.boundingSphere) object.computeBoundingSphere()
        if (!object.boundingSphere) return
        sphere.copy(object.boundingSphere).applyMatrix4(object.matrixWorld)
      } else {
        if (!geometry.boundingSphere) geometry.computeBoundingSphere()
        if (!geometry.boundingSphere) return
        sphere.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld)
      }
      if (!frustum.intersectsSphere(sphere)) return
    }
    const name = groupName(object)
    const row = rows.get(name) ?? { name, drawCalls: 0, triangles: 0 }
    row.drawCalls += 1
    row.triangles += triangleCount(object)
    rows.set(name, row)
  })
  return [...rows.values()].sort((a, b) => b.triangles - a.triangles)
}
