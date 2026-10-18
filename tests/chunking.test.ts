import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { layerDrawDistance, LAYER_DRAW_DISTANCE } from '../src/render/environment/vegetationView'
import {
  cellKey,
  chunkMesh,
  DrawDistanceSet,
  groupByCell,
  splitGeometryByCell,
  withinDrawDistance,
} from '../src/render/environment/chunking'
import { cullRacers } from '../src/render/racerCulling'
import { gridOffset, PERF_STATIONS, stationPose } from '../src/game/perfProbe'

/** A flat strip of `quads` quads along x, 1 m each, as an indexed geometry. */
function strip(quads: number): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= quads; i++) positions.push(i, 0, 0, i, 0, 1)
  for (let i = 0; i < quads; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

describe('cells', () => {
  it('keys the cell a point is in, also for negative coordinates', () => {
    expect(cellKey(0, 0, 10)).toBe('0,0')
    expect(cellKey(9.9, 10, 10)).toBe('0,1')
    expect(cellKey(-0.1, -10.1, 10)).toBe('-1,-2')
  })

  it('groups items by cell and keeps their order', () => {
    const items = [
      { x: 1, z: 1 },
      { x: 25, z: 1 },
      { x: 2, z: 3 },
    ]
    const cells = groupByCell(items, 10, (item) => item)
    expect([...cells.keys()]).toEqual(['0,0', '2,0'])
    expect(cells.get('0,0')).toEqual([items[0], items[2]])
  })
})

describe('splitGeometryByCell', () => {
  it('splits a long strip into cells that together hold every triangle', () => {
    const source = strip(100)
    const pieces = splitGeometryByCell(source, 20, 10)
    expect(pieces).not.toBeNull()
    expect(pieces).toHaveLength(5)
    const triangles = (pieces ?? []).reduce((sum, p) => sum + (p.getIndex()?.count ?? 0) / 3, 0)
    expect(triangles).toBe(200)
  })

  it('shares the vertex data and bounds each piece by its own triangles', () => {
    const source = strip(100)
    const pieces = splitGeometryByCell(source, 20, 10) ?? []
    for (const piece of pieces) {
      expect(piece.getAttribute('position')).toBe(source.getAttribute('position'))
      expect(piece.boundingSphere?.radius).toBeLessThan(15)
    }
  })

  it('leaves small geometries and single-cell ones alone', () => {
    expect(splitGeometryByCell(strip(10), 20)).toBeNull()
    expect(splitGeometryByCell(strip(10), 100, 1)).toBeNull()
  })

  it('chunkMesh keeps material and shadow flags of the mesh', () => {
    const material = new THREE.MeshStandardMaterial()
    const mesh = new THREE.Mesh(strip(100), material)
    mesh.name = 'road'
    mesh.receiveShadow = true
    const result = chunkMesh(mesh, 1)
    expect(result).toBe(mesh)
    // Big enough meshes become a group of cells
    const big = new THREE.Mesh(strip(3000), material)
    big.name = 'road'
    big.receiveShadow = true
    const group = chunkMesh(big, 500)
    expect(group).toBeInstanceOf(THREE.Group)
    expect(group.name).toBe('road')
    for (const part of group.children) {
      expect(part).toBeInstanceOf(THREE.Mesh)
      expect((part as THREE.Mesh).material).toBe(material)
      expect((part as THREE.Mesh).receiveShadow).toBe(true)
    }
  })
})

describe('draw distance', () => {
  it('counts the distance to the near edge of a chunk', () => {
    const chunk = { x: 100, z: 0, radius: 30 }
    expect(withinDrawDistance(chunk, { x: 0, z: 0 }, 70)).toBe(true)
    expect(withinDrawDistance(chunk, { x: 0, z: 0 }, 69)).toBe(false)
    expect(withinDrawDistance(chunk, { x: 0, z: 0 }, Infinity)).toBe(true)
  })

  it('scales the layer distances and leaves distant silhouettes unlimited', () => {
    expect(layerDrawDistance('grass', 0.5)).toBe(LAYER_DRAW_DISTANCE.grass * 0.5)
    expect(layerDrawDistance('grass', Infinity)).toBe(Infinity)
    expect(layerDrawDistance('distant', 0.5)).toBe(Infinity)
    expect(LAYER_DRAW_DISTANCE.grass).toBeLessThan(LAYER_DRAW_DISTANCE.trees)
  })

  it('hides far meshes and shows them again when the scale or the focus allows', () => {
    const near = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1)
    const far = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1)
    far.setMatrixAt(0, new THREE.Matrix4().makeTranslation(300, 0, 0))
    near.computeBoundingSphere()
    far.computeBoundingSphere()
    const set = new DrawDistanceSet()
    set.add(near, 100)
    set.add(far, 100)
    set.setFocus({ x: 0, z: 0 }, 1)
    expect([near.visible, far.visible]).toEqual([true, false])
    set.setFocus({ x: 0, z: 0 }, Infinity)
    expect(far.visible).toBe(true)
    set.setFocus({ x: 300, z: 0 }, 1)
    expect([near.visible, far.visible]).toEqual([false, true])
  })
})

describe('cullRacers', () => {
  it('hides racers behind the camera or too far, shows those in view', () => {
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200)
    camera.position.set(0, 2, 0)
    camera.lookAt(0, 2, 10)
    const ahead = { object: new THREE.Group() }
    const behind = { object: new THREE.Group() }
    const far = { object: new THREE.Group() }
    ahead.object.position.set(0, 0, 20)
    behind.object.position.set(0, 0, -30)
    far.object.position.set(0, 0, 250)
    cullRacers(camera, [ahead, behind, far], camera.far)
    expect([ahead.object.visible, behind.object.visible, far.object.visible]).toEqual([
      true,
      false,
      false,
    ])
  })
})

describe('perf probe stations', () => {
  const loop = [
    { x: 0, z: 0 },
    { x: 0, z: 10 },
    { x: 10, z: 10 },
    { x: 10, z: 0 },
  ]

  it('looks at the start and three points of the loop', () => {
    expect(PERF_STATIONS).toHaveLength(4)
    expect(PERF_STATIONS[0]).toBe(0)
  })

  it('finds the position and heading along the centerline', () => {
    expect(stationPose(loop, 0)).toEqual({ x: 0, z: 0, heading: 0 })
    const quarter = stationPose(loop, 0.25)
    expect(quarter).toMatchObject({ x: 0, z: 10 })
    expect(quarter.heading).toBeCloseTo(Math.PI / 2)
  })

  it('lines the 7 other karts up in rows of two ahead', () => {
    const offsets = Array.from({ length: 7 }, (_, i) => gridOffset(i))
    expect(offsets[0]).toEqual({ forward: 4, side: -2 })
    expect(offsets[1]).toEqual({ forward: 4, side: 2 })
    expect(offsets[6]?.forward).toBeGreaterThan(offsets[0]?.forward ?? 0)
  })
})
