import * as THREE from 'three'
import type { Vec2 } from '../sim/math'
import type { BoostPad, Track } from '../sim/track'

const BASE_COLOR = '#14304d'
const EDGE_COLOR = '#35e0ff'
const ARROW_COLOR = '#ffd23f'
/** Past 1 so the arrows pass the bloom threshold, mildly. */
const ARROW_BOOST = 1.8
const EDGE_BOOST = 1.4
const LIFT = 0.05
/** Distance between two arrows along the strip (m). */
const ARROW_SPACING = 3.2
const BASE_ROW = 2.5
const EDGE_WIDTH = 0.25

/** A point of a strip in the pad's own frame: `u` across (right), `v` along its heading. */
type Corner = readonly [number, number]

/**
 * Corners of the chevrons of a pad, each a quad given as four (u, v) corners. Arrows point
 * along +v and are spread over the strip's length.
 */
export function chevronQuads(length: number, width: number): Corner[][] {
  const count = Math.max(1, Math.round(length / ARROW_SPACING))
  const spacing = length / count
  const wing = width * 0.36
  const depth = Math.min(spacing * 0.34, 1.4)
  const thick = depth * 0.55
  const quads: Corner[][] = []
  for (let i = 0; i < count; i++) {
    const v = -length / 2 + spacing * (i + 0.5) + depth / 2
    for (const side of [-1, 1]) {
      quads.push([
        [0, v],
        [side * wing, v - depth],
        [side * wing, v - depth - thick],
        [0, v - thick],
      ])
    }
  }
  return quads
}

/** All the boost pads of a track as one glowing mesh (one draw call). */
export function createBoostPads(track: Track): THREE.Mesh {
  const positions: number[] = []
  const colors: number[] = []
  const base = new THREE.Color(BASE_COLOR)
  const arrow = new THREE.Color(ARROW_COLOR).multiplyScalar(ARROW_BOOST)
  const edge = new THREE.Color(EDGE_COLOR).multiplyScalar(EDGE_BOOST)

  for (const pad of track.boostPads) {
    const world = padToWorld(track, pad)
    const quad = (corners: readonly Corner[], color: THREE.Color, lift: number): void => {
      const [a, b, c, d] = corners.map((corner) => world(corner[0], corner[1], lift))
      if (!a || !b || !c || !d) return
      for (const point of [a, b, c, a, c, d]) {
        positions.push(point.x, point.y, point.z)
        colors.push(color.r, color.g, color.b)
      }
    }

    // Dark base in rows so it follows slopes, then the glowing edges and arrows on top
    const rows = Math.max(1, Math.ceil(pad.length / BASE_ROW))
    const hw = pad.width / 2
    for (let r = 0; r < rows; r++) {
      const v0 = -pad.length / 2 + (pad.length / rows) * r
      const v1 = -pad.length / 2 + (pad.length / rows) * (r + 1)
      quad(
        [
          [-hw, v0],
          [hw, v0],
          [hw, v1],
          [-hw, v1],
        ],
        base,
        LIFT,
      )
      for (const side of [-1, 1]) {
        quad(
          [
            [side * hw, v0],
            [side * (hw - EDGE_WIDTH), v0],
            [side * (hw - EDGE_WIDTH), v1],
            [side * hw, v1],
          ],
          edge,
          LIFT * 1.5,
        )
      }
    }
    for (const corners of chevronQuads(pad.length, pad.width)) quad(corners, arrow, LIFT * 2)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'boostPads'
  return mesh
}

/** Maps a pad's (u across, v along) to a world point on the ground. */
function padToWorld(
  track: Track,
  pad: BoostPad,
): (u: number, v: number, lift: number) => THREE.Vector3 {
  const forward: Vec2 = { x: Math.sin(pad.heading), z: Math.cos(pad.heading) }
  const right: Vec2 = { x: forward.z, z: -forward.x }
  return (u, v, lift) => {
    const x = pad.position.x + right.x * u + forward.x * v
    const z = pad.position.z + right.z * u + forward.z * v
    return new THREE.Vector3(x, track.groundHeight(x, z) + lift, z)
  }
}
