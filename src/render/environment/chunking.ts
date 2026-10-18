import * as THREE from 'three'

/** Meshes with fewer triangles than this are not worth splitting (a draw call costs more). */
export const MIN_SPLIT_TRIANGLES = 4000

/** Key of the square cell of side `size` that contains the point. */
export function cellKey(x: number, z: number, size: number): string {
  return `${Math.floor(x / size)},${Math.floor(z / size)}`
}

/** Groups items by the cell of side `size` their position falls in; keeps the input order. */
export function groupByCell<T>(
  items: readonly T[],
  size: number,
  position: (item: T) => { x: number; z: number },
): Map<string, T[]> {
  const cells = new Map<string, T[]>()
  for (const item of items) {
    const { x, z } = position(item)
    const key = cellKey(x, z, size)
    const list = cells.get(key)
    if (list) list.push(item)
    else cells.set(key, [item])
  }
  return cells
}

/**
 * Splits the triangles of a geometry into one geometry per square cell of side `size` (by the
 * triangle's center on the ground plane). The pieces share the vertex attributes of the source
 * and only get their own index buffer and bounding sphere, so memory barely grows, and a piece
 * outside the camera is skipped by frustum culling. Returns null when the geometry is small or
 * falls in a single cell (no gain from splitting).
 */
export function splitGeometryByCell(
  geometry: THREE.BufferGeometry,
  size: number,
  minTriangles = MIN_SPLIT_TRIANGLES,
): THREE.BufferGeometry[] | null {
  const position = geometry.getAttribute('position')
  if (!position) return null
  const index = geometry.getIndex()
  const triangleCount = index ? index.count / 3 : position.count / 3
  if (triangleCount < minTriangles) return null

  const vertexAt = (t: number, corner: number): number =>
    index ? index.getX(t * 3 + corner) : t * 3 + corner
  const cells = new Map<string, number[]>()
  for (let t = 0; t < triangleCount; t++) {
    const a = vertexAt(t, 0)
    const b = vertexAt(t, 1)
    const c = vertexAt(t, 2)
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3
    const key = cellKey(x, z, size)
    const list = cells.get(key)
    if (list) list.push(a, b, c)
    else cells.set(key, [a, b, c])
  }
  if (cells.size < 2) return null

  const IndexArray = position.count > 65535 ? Uint32Array : Uint16Array
  const pieces: THREE.BufferGeometry[] = []
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  for (const indices of cells.values()) {
    const piece = new THREE.BufferGeometry()
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      piece.setAttribute(name, attribute)
    }
    piece.setIndex(new THREE.BufferAttribute(IndexArray.from(indices), 1))
    box.makeEmpty()
    for (const v of indices)
      box.expandByPoint(point.set(position.getX(v), position.getY(v), position.getZ(v)))
    piece.boundingBox = box.clone()
    piece.boundingSphere = box.getBoundingSphere(new THREE.Sphere())
    pieces.push(piece)
  }
  return pieces
}

/**
 * Replaces a big static mesh by a group of per-cell meshes that share its material and shadow
 * flags, so the parts off screen are culled. Returns the mesh itself when it is not worth
 * splitting. The group takes the mesh's name.
 */
export function chunkMesh(mesh: THREE.Mesh, size: number): THREE.Object3D {
  const pieces = splitGeometryByCell(mesh.geometry, size)
  if (!pieces) return mesh
  const group = new THREE.Group()
  group.name = mesh.name
  pieces.forEach((geometry, i) => {
    const part = new THREE.Mesh(geometry, mesh.material)
    part.name = `${mesh.name}:${i}`
    part.castShadow = mesh.castShadow
    part.receiveShadow = mesh.receiveShadow
    group.add(part)
  })
  return group
}

/** True when a chunk (center, radius) is at most `maxDistance` from the focus on the ground. */
export function withinDrawDistance(
  chunk: { x: number; z: number; radius: number },
  focus: { x: number; z: number },
  maxDistance: number,
): boolean {
  if (!Number.isFinite(maxDistance)) return true
  return Math.hypot(chunk.x - focus.x, chunk.z - focus.z) - chunk.radius <= maxDistance
}

interface DistanceEntry {
  object: THREE.Object3D
  x: number
  z: number
  radius: number
  /** Draw distance (m) at a quality scale of 1. */
  distance: number
}

/**
 * Meshes that are only drawn near the player: each has a draw distance, multiplied by the
 * quality's scale. A scale of Infinity shows everything. Needs the bounding sphere of each
 * (`InstancedMesh.computeBoundingSphere` or a geometry's) to be known when added.
 */
export class DrawDistanceSet {
  private readonly entries: DistanceEntry[] = []

  get size(): number {
    return this.entries.length
  }

  add(mesh: THREE.InstancedMesh | THREE.Mesh, distance: number): void {
    const sphere =
      mesh instanceof THREE.InstancedMesh ? mesh.boundingSphere : mesh.geometry.boundingSphere
    this.entries.push({
      object: mesh,
      x: sphere?.center.x ?? 0,
      z: sphere?.center.z ?? 0,
      radius: sphere?.radius ?? 0,
      distance,
    })
  }

  /** Shows the meshes within draw distance of `focus` (ground position), hides the rest. */
  setFocus(focus: { x: number; z: number }, scale: number): void {
    for (const entry of this.entries) {
      entry.object.visible = withinDrawDistance(entry, focus, entry.distance * scale)
    }
  }
}
