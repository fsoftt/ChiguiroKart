import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { headingOf } from '../../sim/math'
import type { Track } from '../../sim/track'
import { overGap, pathPoint, segmentCount, sideAt, type Path } from '../trackPath'
import type { DecorBuilder } from './decorBuilder'
import { bannerCell, MAX_BANNERS, RAIL_TILE } from './proceduralTextures'
import { buildRibbon, type ProfilePoint } from './ribbon'

/** Same footprint as the plain wall it replaces: the band from the corridor edge outward (m). */
const WALL_THICKNESS = 0.5
const RAIL_INSET = 0.14
const RAIL_WIDTH = 0.24
const RAILS: readonly (readonly [number, number])[] = [
  [0.28, 0.46],
  [0.64, 0.82],
]
const POST_HEIGHT = 1.0
const POST_SIZE = 0.3
/** Longest banner (m) and the lift of its bottom edge. */
const BANNER_WIDTH = 3.0
const BANNER_LIFT = 0.16

/** What a fence adds to the scene: rail geometry, post placements and banners (in the decor). */
export interface Fence {
  rails: THREE.BufferGeometry | null
  posts: THREE.Matrix4[]
}

/** Integer hash to a number in 0..1, so banners land the same way every time. */
function pick(a: number, b: number, c: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b + 17, 668265263) ^ Math.imul(c + 91, 1274126177)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

/**
 * Wooden fence along both edges of a path: two rails (swept boxes), posts, and sponsor banners
 * on the road side. It stands in the same band as the plain wall, so nothing the kart drives on
 * or bumps into changes. Gaps are left at junctions.
 */
export function buildFence(
  track: Track,
  path: Path,
  pathIndex: number,
  decor: DecorBuilder,
  bannersPer100m: number,
): Fence {
  const rails: THREE.BufferGeometry[] = []
  const posts: THREE.Matrix4[] = []
  const hw = path.halfWidth
  const segments = segmentCount(path)

  for (const s of [-1, 1]) {
    const near = s * (hw + RAIL_INSET)
    const far = s * (hw + RAIL_INSET + RAIL_WIDTH)
    const lo = Math.min(near, far)
    const hi = Math.max(near, far)
    for (const [y0, y1] of RAILS) {
      const faces: ProfilePoint[][] = [
        [
          { offset: lo, lift: y1, u: 0 },
          { offset: hi, lift: y1, u: 1 },
        ],
        [
          { offset: lo, lift: y0, u: 0 },
          { offset: lo, lift: y1, u: 1 },
        ],
        [
          { offset: hi, lift: y0, u: 0 },
          { offset: hi, lift: y1, u: 1 },
        ],
      ]
      for (const face of faces) {
        const geometry = buildRibbon(track, path, face, {
          tile: RAIL_TILE,
          skipOpenings: true,
        })
        if (geometry) rails.push(geometry)
      }
    }

    const postOffset = s * (hw + WALL_THICKNESS / 2)
    for (let n = 0; n < segments; n++) {
      if (overGap(track, path, n)) continue
      const center = pathPoint(path, n)
      const side = sideAt(path, n)
      const x = center.x + side.x * postOffset
      const z = center.z + side.z * postOffset
      if (path.openAt({ x, z })) continue
      const next = pathPoint(path, n + 1)
      const yaw = headingOf(next.x - center.x, next.z - center.z)
      const y = track.roadHeight(x, z)
      posts.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
          new THREE.Vector3(1, 0.9 + pick(n, s, pathIndex) * 0.25, 1),
        ),
      )
    }

    // Banners on the road side, facing the road
    for (let n = 0; n < segments; n++) {
      const a = pathPoint(path, n)
      const b = pathPoint(path, n + 1)
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length < BANNER_WIDTH * 0.8 || overGap(track, path, n)) continue
      if (pick(n, s, pathIndex + 5) > (bannersPer100m * length) / 100) continue
      const sideA = sideAt(path, n)
      const sideB = sideAt(path, n + 1)
      const lateral = s * (hw + RAIL_INSET - 0.03)
      const m = Math.min(0.4, (1 - BANNER_WIDTH / length) / 2)
      const lerp = (t: number): { x: number; z: number } => ({
        x: a.x + (b.x - a.x) * t + (sideA.x + (sideB.x - sideA.x) * t) * lateral,
        z: a.z + (b.z - a.z) * t + (sideA.z + (sideB.z - sideA.z) * t) * lateral,
      })
      if (path.openAt(lerp(0.5))) continue
      const p0 = lerp(m)
      const p1 = lerp(1 - m)
      const cell = bannerCell(Math.floor(pick(n, s, pathIndex + 9) * MAX_BANNERS))
      const width = Math.hypot(p1.x - p0.x, p1.z - p0.z)
      const height = Math.min(width / 4, 0.75)
      const y0 = track.roadHeight(p0.x, p0.z) + BANNER_LIFT
      const y1 = track.roadHeight(p1.x, p1.z) + BANNER_LIFT
      // The quad faces -side for s = +1; reverse the run for the other side
      const [start, end, ys, ye] = s > 0 ? [p0, p1, y0, y1] : [p1, p0, y1, y0]
      decor.textured(
        cell,
        [start.x, ys, start.z],
        [end.x, ye, end.z],
        [end.x, ye + height, end.z],
        [start.x, ys + height, start.z],
      )
    }
  }

  return { rails: rails.length > 0 ? mergeGeometries(rails, false) : null, posts }
}

/** Geometry of one fence post: a square pillar with a slightly wider cap. */
export function postGeometry(): THREE.BufferGeometry {
  const pillar = new THREE.BoxGeometry(POST_SIZE, POST_HEIGHT, POST_SIZE)
  pillar.translate(0, POST_HEIGHT / 2, 0)
  const cap = new THREE.BoxGeometry(POST_SIZE * 1.25, 0.08, POST_SIZE * 1.25)
  cap.translate(0, POST_HEIGHT + 0.04, 0)
  const merged = mergeGeometries([pillar, cap], false)
  pillar.dispose()
  cap.dispose()
  return merged
}
