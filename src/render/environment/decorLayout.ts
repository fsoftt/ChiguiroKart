import type { PropKind, PropPlacement } from '../../config/tracks/environment'
import type { Vec2 } from '../../sim/math'
import type { Track } from '../../sim/track'
import { slopeAt } from './vegetationLayout'
import {
  edgeDistance,
  PAD_FADE,
  WALL_BAND,
  type TerrainField,
  type TerrainPad,
} from './terrainField'

/** Samples either side of a point used to measure how sharply the road turns (~36 m). */
const CURVE_WINDOW = 5
/** Turn (rad) over the window above which a curve gets chevron signs. */
const SHARP_TURN = 0.5
/** Distance from the road edge to the chevron signs (m): clear of the fence band. */
export const SIGN_EDGE = 2.4

export interface Placed {
  x: number
  z: number
  /** Turn around y (rad) such that a model facing +z looks along the sign normal. */
  yaw: number
}

/** A chevron sign beside a sharp curve: faces the road and points the way the road turns. */
export interface ChevronSign extends Placed {
  /** Unit direction the arrow points to (the way the road turns). */
  arrow: Vec2
}

/** Unit vector to the +offset side of the road at centerline sample `i`. */
export function sideOf(track: Track, i: number): Vec2 {
  const before = track.point(i - 1)
  const after = track.point(i + 1)
  const length = Math.hypot(after.x - before.x, after.z - before.z) || 1
  return { x: (after.z - before.z) / length, z: -(after.x - before.x) / length }
}

/** Signed turn (rad) of the road around sample `i`: positive turns toward the + side. */
export function turnAt(track: Track, i: number): number {
  const a = track.point(i - CURVE_WINDOW)
  const b = track.point(i)
  const c = track.point(i + CURVE_WINDOW)
  const v1 = { x: b.x - a.x, z: b.z - a.z }
  const v2 = { x: c.x - b.x, z: c.z - b.z }
  const side = sideOf(track, i)
  const angle = Math.atan2(v1.x * v2.z - v1.z * v2.x, v1.x * v2.x + v1.z * v2.z)
  // v2 - v1 points at the center of the curve: positive when that is the + side
  const toward = (v2.x - v1.x) * side.x + (v2.z - v1.z) * side.z
  return toward >= 0 ? Math.abs(angle) : -Math.abs(angle)
}

/** Chevron signs on the outside of every sharp curve (three per curve). */
export function chevronSigns(track: Track): ChevronSign[] {
  const count = track.centerline.length
  const signs: ChevronSign[] = []
  let i = 0
  while (i < count) {
    if (Math.abs(turnAt(track, i)) < SHARP_TURN) {
      i++
      continue
    }
    const start = i
    const turn = Math.sign(turnAt(track, i))
    while (
      i < count &&
      Math.sign(turnAt(track, i)) === turn &&
      Math.abs(turnAt(track, i)) >= SHARP_TURN * 0.8
    )
      i++
    const length = i - start
    if (length < 3) continue
    for (const fraction of [0.2, 0.5, 0.8]) {
      const index = start + Math.round((length - 1) * fraction)
      const side = sideOf(track, index)
      const center = track.point(index)
      // Outside of the curve: opposite to the way the road turns
      const x = center.x - side.x * turn * (track.halfWidth + SIGN_EDGE)
      const z = center.z - side.z * turn * (track.halfWidth + SIGN_EDGE)
      // The board faces the road: its normal points back toward the centerline
      const nx = center.x - x
      const nz = center.z - z
      signs.push({
        x,
        z,
        yaw: Math.atan2(nx, nz),
        arrow: { x: side.x * turn, z: side.z * turn },
      })
    }
  }
  return signs
}

/**
 * Centerline samples where a string of pennants can cross a straight stretch: far from the
 * start arch, on plain asphalt and clear of side roads. Evenly spread, at most `count`.
 */
export function pennantSpots(track: Track, count: number): number[] {
  const total = track.centerline.length
  const candidates: number[] = []
  for (let i = 0; i < total; i++) {
    const fromStart = Math.min(i, total - i)
    if (fromStart < 10) continue
    if (Math.abs(turnAt(track, i)) > 0.12) continue
    const p = track.point(i)
    if (track.surfaceAt(p.x, p.z) !== 'asphalt') continue
    const side = sideOf(track, i)
    const reach = track.halfWidth + 2.5
    let clear = true
    for (const s of [-1, 1, 0]) {
      const x = p.x + side.x * s * reach
      const z = p.z + side.z * s * reach
      if (s === 0 ? track.project(x, z).branch >= 0 : edgeDistance(track, x, z) < 1.2) clear = false
    }
    if (clear) candidates.push(i)
  }
  const spots: number[] = []
  const spacing = Math.max(8, Math.floor(total / Math.max(count, 1) / 1.2))
  for (const i of candidates) {
    if (spots.length >= count) break
    if (spots.every((s) => Math.abs(s - i) >= spacing)) spots.push(i)
  }
  return spots
}

/** A prop with its spot resolved on the land. */
export interface PropSpot extends Placed {
  kind: PropKind
  /** Terrain height under it. */
  y: number
}

/** Footprint radius (m) of each prop; its platform is this size. */
export const PROP_RADIUS: Record<PropKind, number> = {
  finca: 8.5,
  yipao: 3.2,
  cart: 3,
  sacks: 1.8,
  grandstand: 9,
  colonialHouse: 7,
  chiva: 4,
  boat: 3.5,
  mountainHut: 6,
  saltCross: 4,
  cannon: 2,
  beachHut: 4.5,
  stoneTerrace: 8,
  carnivalStage: 8,
  maloca: 8,
  corral: 7,
  observatory: 7,
}

/**
 * Places the props beside the road and returns the platforms to level under them. A prop is
 * pushed away from the road until its platform (with the fade) is clear of every road piece,
 * so leveling the land never reaches the shoulder.
 */
export function layoutProps(
  track: Track,
  field: TerrainField,
  placements: readonly PropPlacement[],
  shoulder: number,
): { spots: PropSpot[]; pads: TerrainPad[] } {
  const spots: PropSpot[] = []
  const pads: TerrainPad[] = []
  const total = track.centerline.length
  for (const placement of placements) {
    const index = Math.round(placement.at * total) % total
    const center = track.point(index)
    const side = sideOf(track, index)
    const radius = PROP_RADIUS[placement.kind]
    const minEdge = radius + PAD_FADE + WALL_BAND + shoulder + 1
    let edge = Math.max(placement.edge, minEdge)
    let x = center.x
    let z = center.z
    for (let attempt = 0; attempt < 30; attempt++) {
      x = center.x + side.x * placement.side * (track.halfWidth + edge)
      z = center.z + side.z * placement.side * (track.halfWidth + edge)
      const clear = edgeDistance(track, x, z) >= minEdge
      const crowded = spots.some((s) => Math.hypot(s.x - x, s.z - z) < radius + PROP_RADIUS[s.kind])
      if (clear && !crowded && slopeAt(field, x, z) < 0.7) break
      edge += 2.5
    }
    const y = field.heightAt(x, z)
    spots.push({
      kind: placement.kind,
      x,
      z,
      y,
      yaw: Math.atan2(center.x - x, center.z - z) + (placement.turn ?? 0),
    })
    pads.push({ x, z, radius, y })
  }
  return { spots, pads }
}
