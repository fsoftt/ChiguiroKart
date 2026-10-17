import type { TerrainSettings } from '../../config/tracks/environment'
import type { Vec2 } from '../../sim/math'
import type { Track } from '../../sim/track'
import { branchPointAt, loopArcs } from '../../sim/trackSpline'
import { fbm, smoothstep } from './noise'

/** Thickness of the fence/wall band just outside the corridor (m). */
export const WALL_BAND = 0.5
/** The terrain under the road and shoulder sits this far below the sim ground (m). */
export const TERRAIN_SINK = 0.3
/** Distance over which the sim ground height eases into the smooth hill base (m). */
const BLEND = 12
/** Margin of the terrain around the road's bounding box (m). */
const MARGIN = 190
/** Distance over which a prop platform fades into the land (m). */
export const PAD_FADE = 6
/** Grid cell (m). */
export const TERRAIN_CELL = 4

/** Default depth of a gap ravine below the road (m). */
export const DEFAULT_GAP_DEPTH = 14
/** The ravine stops this far inside each lip, so the road before and after keeps ground (m). */
const GAP_LIP_INSET = 0.5
/** The ravine runs this far sideways beyond the road and shoulder, fading out (m). */
const GAP_SIDE_REACH = 40
/** Spacing of the points that follow a gap span (m). */
const GAP_SAMPLE = 1

/** A flat platform for a prop: the land is leveled to `y` within `radius`, then fades out. */
export interface TerrainPad {
  x: number
  z: number
  radius: number
  y: number
}

/** A sampled heightfield of the land around a track, triangulated the same way as its mesh. */
export interface TerrainField {
  minX: number
  minZ: number
  cell: number
  /** Vertices along x and z. */
  nx: number
  nz: number
  /** Height at each vertex, row by row (index = j * nx + i). */
  heights: Float32Array
  /** Distance from each vertex to the nearest road edge (m); negative inside the corridor. */
  edges: Float32Array
  /** Height of the terrain surface at (x, z), exactly as the mesh draws it. */
  heightAt: (x: number, z: number) => number
}

/** Distance (m) from (x, z) to the edge of the nearest road piece; <= 0 inside a corridor. */
export function edgeDistance(track: Track, x: number, z: number): number {
  const p = track.project(x, z)
  return p.distance - p.halfWidth
}

/** Height along the main loop, interpolated between centerline samples (continuous). */
function createLoopHeight(track: Track): (x: number, z: number) => number {
  const points = track.centerline
  const heights = points.map((p) => track.roadHeight(p.x, p.z))
  const count = points.length
  return (x, z) => {
    let best = Infinity
    let bestHeight = 0
    for (let i = 0; i < count; i++) {
      const a = points[i] as Vec2
      const b = points[(i + 1) % count] as Vec2
      const abx = b.x - a.x
      const abz = b.z - a.z
      const lengthSq = abx * abx + abz * abz || 1
      const t = Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0), 1)
      const dx = x - (a.x + abx * t)
      const dz = z - (a.z + abz * t)
      const d = dx * dx + dz * dz
      if (d < best) {
        best = d
        const h0 = heights[i] as number
        const h1 = heights[(i + 1) % count] as number
        bestHeight = h0 + (h1 - h0) * t
      }
    }
    return bestHeight
  }
}

/**
 * Builds the heightfield. Within `WALL_BAND + shoulder` of any road edge the land is the sim
 * road height minus `TERRAIN_SINK`, so it never rises above what the kart drives on; farther
 * out it eases into the smooth ground level and then climbs into rolling hills and steep valley
 * walls, shaped by seeded noise.
 */
export function buildTerrainField(
  track: Track,
  settings: TerrainSettings,
  seed: number,
): TerrainField {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of track.centerline) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  const cell = TERRAIN_CELL
  const x0 = Math.floor((minX - MARGIN) / cell) * cell
  const z0 = Math.floor((minZ - MARGIN) / cell) * cell
  const nx = Math.ceil((maxX + MARGIN - x0) / cell) + 1
  const nz = Math.ceil((maxZ + MARGIN - z0) / cell) + 1
  const heights = new Float32Array(nx * nz)
  const edges = new Float32Array(nx * nz)
  const loopHeight = createLoopHeight(track)
  const flatEnd = WALL_BAND + settings.shoulder

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell
      const z = z0 + j * cell
      const edge = edgeDistance(track, x, z)
      edges[j * nx + i] = edge
      heights[j * nx + i] = rawHeight(track, settings, seed, loopHeight, x, z, edge, flatEnd)
    }
  }

  for (const ravine of gapRavines(track))
    carveRavine(heights, nx, nz, x0, z0, cell, ravine, settings)

  const heightAt = (x: number, z: number): number => {
    const gx = Math.min(Math.max((x - x0) / cell, 0), nx - 1.0001)
    const gz = Math.min(Math.max((z - z0) / cell, 0), nz - 1.0001)
    const i = Math.floor(gx)
    const j = Math.floor(gz)
    const fx = gx - i
    const fz = gz - j
    const a = heights[j * nx + i] as number
    const b = heights[j * nx + i + 1] as number
    const c = heights[(j + 1) * nx + i] as number
    const d = heights[(j + 1) * nx + i + 1] as number
    // Same split as the mesh: triangles (a, c, b) and (b, c, d)
    return fx + fz <= 1
      ? a + (b - a) * fx + (c - a) * fz
      : d + (c - d) * (1 - fx) + (b - d) * (1 - fz)
  }
  return { minX: x0, minZ: z0, cell, nx, nz, heights, edges, heightAt }
}

function rawHeight(
  track: Track,
  settings: TerrainSettings,
  seed: number,
  loopHeight: (x: number, z: number) => number,
  x: number,
  z: number,
  edge: number,
  flatEnd: number,
): number {
  if (edge <= flatEnd) return lowRoadHeight(track, x, z) - TERRAIN_SINK
  const away = edge - flatEnd
  const t = smoothstep(0, BLEND, away)
  const smoothBase = loopHeight(x, z)
  const base =
    t >= 1
      ? smoothBase
      : lowRoadHeight(track, x, z) * (1 - t) + smoothBase * t - TERRAIN_SINK * (1 - t)
  // Hills: broad swells that grow with distance, plus a steeper climb far out (valley walls)
  const swell = fbm(x / 70, z / 70, seed, 3)
  const ridges = fbm(x / 34 + 11, z / 34 - 7, seed + 5, 3)
  const near = smoothstep(2, 46, away) * settings.hillHeight * (0.25 + 1.5 * swell)
  const far = Math.max(0, away - 46) * settings.valleySlope * (0.55 + 0.9 * ridges)
  const roll = (fbm(x / 13, z / 13, seed + 9, 2) - 0.5) * 1.6 * smoothstep(4, 22, away)
  const land = base + near + far + roll
  // A falling coast or river plain bottoms out at the floor (but is never lifted above its base)
  return settings.floor === undefined ? land : Math.max(land, Math.min(settings.floor, base))
}

/** Points along the span of one jump gap, each with the road height there. */
interface Ravine {
  xs: number[]
  zs: number[]
  ys: number[]
  halfWidth: number
}

/** The spans of the track's jump gaps in world space (lip insets already applied). */
function gapRavines(track: Track): Ravine[] {
  const ravines: Ravine[] = []
  const arcs = loopArcs(track.centerline)
  const count = track.centerline.length
  const loopPoint = (arc: number): Vec2 => {
    let i = 0
    while (i + 1 < count && (arcs[i + 1] as number) <= arc) i++
    const a = track.centerline[i] as Vec2
    const b = track.centerline[(i + 1) % count] as Vec2
    const a0 = arcs[i] as number
    const a1 = i + 1 < count ? (arcs[i + 1] as number) : track.loopLength
    const t = a1 > a0 ? Math.min(Math.max((arc - a0) / (a1 - a0), 0), 1) : 0
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
  }
  for (const jump of track.jumps) {
    const gap = jump.gap
    if (!gap) continue
    const branch = gap.branch >= 0 ? track.branches[gap.branch] : undefined
    if (gap.branch >= 0 && !branch) continue
    const from = gap.from + GAP_LIP_INSET
    const to = gap.to - GAP_LIP_INSET
    if (to <= from) continue
    const steps = Math.max(2, Math.ceil((to - from) / GAP_SAMPLE))
    const ravine: Ravine = {
      xs: [],
      zs: [],
      ys: [],
      halfWidth: branch ? branch.halfWidth : track.halfWidth,
    }
    for (let k = 0; k <= steps; k++) {
      const arc = from + ((to - from) * k) / steps
      const p = branch ? branchPointAt(branch, arc).point : loopPoint(arc)
      ravine.xs.push(p.x)
      ravine.zs.push(p.z)
      ravine.ys.push(track.roadHeight(p.x, p.z))
    }
    ravines.push(ravine)
  }
  return ravines
}

/**
 * Lowers the land under a gap into a canyon: full depth within the span and across the road and
 * shoulder, then fading out sideways. It only ever lowers the land.
 */
function carveRavine(
  heights: Float32Array,
  nx: number,
  nz: number,
  x0: number,
  z0: number,
  cell: number,
  ravine: Ravine,
  settings: TerrainSettings,
): void {
  const depth = settings.gapDepth ?? DEFAULT_GAP_DEPTH
  const full = ravine.halfWidth + WALL_BAND + settings.shoulder + 1
  const reach = full + GAP_SIDE_REACH
  const { xs, zs, ys } = ravine
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let k = 0; k < xs.length; k++) {
    minX = Math.min(minX, xs[k] as number)
    maxX = Math.max(maxX, xs[k] as number)
    minZ = Math.min(minZ, zs[k] as number)
    maxZ = Math.max(maxZ, zs[k] as number)
  }
  const i0 = Math.max(0, Math.floor((minX - reach - x0) / cell))
  const i1 = Math.min(nx - 1, Math.ceil((maxX + reach - x0) / cell))
  const j0 = Math.max(0, Math.floor((minZ - reach - z0) / cell))
  const j1 = Math.min(nz - 1, Math.ceil((maxZ + reach - z0) / cell))
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = x0 + i * cell
      const z = z0 + j * cell
      let weight = 0
      let target = 0
      // Across the span: the strip between the two end lines of each segment, at any distance
      for (let k = 0; k + 1 < xs.length; k++) {
        const ax = xs[k] as number
        const az = zs[k] as number
        const dx = (xs[k + 1] as number) - ax
        const dz = (zs[k + 1] as number) - az
        const lengthSq = dx * dx + dz * dz || 1
        const t = ((x - ax) * dx + (z - az) * dz) / lengthSq
        if (t < 0 || t > 1) continue
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
        const w = 1 - smoothstep(full, reach, d)
        if (w > weight) {
          weight = w
          target = (ys[k] as number) + ((ys[k + 1] as number) - (ys[k] as number)) * t - depth
        }
      }
      if (weight <= 0) continue
      const index = j * nx + i
      const h = heights[index] as number
      heights[index] = Math.min(h, h * (1 - weight) + target * weight)
    }
  }
}

/**
 * Levels the land under each pad (a platform for a house, a cart), fading into the hillside.
 * Changes the field in place; `heightAt` sees it at once. Pads must sit well clear of the
 * roads, so the terrain near the road stays below the sim ground.
 */
export function levelPads(field: TerrainField, pads: readonly TerrainPad[]): void {
  for (const pad of pads) applyPad(field, pad)
}

function applyPad(field: TerrainField, pad: TerrainPad): void {
  const { heights, nx, nz, minX: x0, minZ: z0, cell } = field
  const reach = pad.radius + PAD_FADE
  const i0 = Math.max(0, Math.floor((pad.x - reach - x0) / cell))
  const i1 = Math.min(nx - 1, Math.ceil((pad.x + reach - x0) / cell))
  const j0 = Math.max(0, Math.floor((pad.z - reach - z0) / cell))
  const j1 = Math.min(nz - 1, Math.ceil((pad.z + reach - z0) / cell))
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(x0 + i * cell - pad.x, z0 + j * cell - pad.z)
      const w = 1 - smoothstep(pad.radius, reach, d)
      const k = j * nx + i
      heights[k] = (heights[k] as number) * (1 - w) + pad.y * w
    }
  }
}

/**
 * Lowest sim road height within a vertex-spacing step of (x, z): the grid samples the terrain
 * between vertices, so it must stay under the sim ground wherever the sim changes fast (branch
 * ramps, medial axes of tight curves).
 */
function lowRoadHeight(track: Track, x: number, z: number): number {
  const d = TERRAIN_CELL * 0.75
  return Math.min(
    track.roadHeight(x, z),
    track.roadHeight(x + d, z),
    track.roadHeight(x - d, z),
    track.roadHeight(x, z + d),
    track.roadHeight(x, z - d),
  )
}
