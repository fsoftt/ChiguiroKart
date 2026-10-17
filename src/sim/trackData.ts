import { lineAlong, rowAcross, spotAt } from '../config/tracks/pickupLayout'
import { headingOf, type Vec2 } from './math'
import type { Checkpoint } from './race/checkpoint'
import type { SurfaceType } from './race/surface'
import {
  Track,
  type BoostPad,
  type HazardDefinition,
  type TideRule,
  type TrackBranch,
  type TrackDefinition,
} from './track'
import { buildCenterline, createGroundHeight, nearestIndex, type ControlPoint } from './trackSpline'

/** localStorage key where the editor leaves the track for `?pista=custom`. */
export const CUSTOM_TRACK_KEY = 'chiguirokart.customTrack.v1'

export const TRACK_DATA_VERSION = 1
export const SURFACES: readonly SurfaceType[] = [
  'asphalt',
  'dirt',
  'grass',
  'mud',
  'wood',
  'ice',
  'sand',
  'water',
]

export const MIN_CONTROL_POINTS = 4
const MAX_CONTROL_POINTS = 200
const MAX_COORDINATE = 100000
const MIN_HALF_WIDTH = 2
const MAX_HALF_WIDTH = 40
const MIN_SAMPLES = 2
const MAX_SAMPLES = 40
const MAX_CHECKPOINTS = 64
const MAX_PICKUP_GROUPS = 64
const MAX_PICKUPS_PER_GROUP = 12
/** Item box rows spread across this fraction of the half width on each side. */
const BOX_SPREAD = 2 / 3
/** Checkpoint gates are slightly wider than the road. */
const CHECKPOINT_MARGIN = 6

export interface TrackPointData {
  x: number
  z: number
  /** Ground height at this control point (m). */
  y: number
  /** Surface of the road around this point; asphalt if omitted. */
  surface?: SurfaceType
}

export interface TrackBranchData {
  name: string
  /** Polyline in driving order; first and last points should lie on the main road. */
  points: Vec2[]
  halfWidth: number
  surface: SurfaceType
  /** Optional tide rule (see `TideRule`); `surface` is ignored while it is set. */
  tide?: TideRule
}

/** Turbo strip `at` (0..1 along the loop), `offset` m right of the centerline, along the road. */
export interface BoostPadData {
  at: number
  offset: number
  /** Defaults: 6 m long, 4 m wide. */
  length?: number
  width?: number
}

export interface TrackCheckpointsData {
  /** Number of gates, evenly spaced along the loop; the first one is the start line. */
  count: number
  /** Gates (0-based) that are NOT mandatory, e.g. the one a shortcut legally skips. */
  optional: number[]
}

/** A row of `count` power boxes across the road at `at` (0..1 along the loop). */
export interface ItemBoxRowData {
  at: number
  count: number
}

/** `count` uchuvas one sample apart from `at` (0..1 along the loop), `offset` m to the right. */
export interface UchuvaLineData {
  at: number
  count: number
  offset: number
}

/** JSON-serializable description of a track, as made by the editor. */
export interface TrackData {
  version: 1
  name: string
  halfWidth: number
  samplesPerSegment: number
  /** Closed loop of control points in driving order; point 0 is the start line. */
  points: TrackPointData[]
  branches: TrackBranchData[]
  checkpoints: TrackCheckpointsData
  itemBoxRows: ItemBoxRowData[]
  uchuvaLines: UchuvaLineData[]
  /** Optional turbo strips on the main loop. */
  boostPads?: BoostPadData[]
  /** Optional obstacles, in world coordinates (see `HazardDefinition`). */
  hazards?: HazardDefinition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, min = -MAX_COORDINATE, max = MAX_COORDINATE): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null
}

function int(value: unknown, min: number, max: number): number | null {
  const n = num(value, min, max)
  return n !== null && Number.isInteger(n) ? n : null
}

function surfaceOf(value: unknown): SurfaceType | null {
  return SURFACES.find((surface) => surface === value) ?? null
}

function parsePoint(value: unknown): TrackPointData | null {
  if (!isRecord(value)) return null
  const x = num(value.x)
  const z = num(value.z)
  const y = num(value.y)
  if (x === null || z === null || y === null) return null
  if (value.surface === undefined) return { x, z, y }
  const surface = surfaceOf(value.surface)
  return surface ? { x, z, y, surface } : null
}

function parseBranch(value: unknown): TrackBranchData | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.points))
    return null
  const halfWidth = num(value.halfWidth, MIN_HALF_WIDTH, MAX_HALF_WIDTH)
  const surface = surfaceOf(value.surface)
  if (halfWidth === null || !surface || value.points.length < 2) return null
  const points: Vec2[] = []
  for (const raw of value.points) {
    if (!isRecord(raw)) return null
    const x = num(raw.x)
    const z = num(raw.z)
    if (x === null || z === null) return null
    points.push({ x, z })
  }
  return { name: value.name, points, halfWidth, surface }
}

/** Maps every element with `parse`; null if any element is invalid. */
function parseList<T>(value: unknown, parse: (item: unknown) => T | null, max: number): T[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) return null
  const out: T[] = []
  for (const item of value) {
    const parsed = parse(item)
    if (parsed === null) return null
    out.push(parsed)
  }
  return out
}

function parseCheckpoints(value: unknown): TrackCheckpointsData | null {
  if (!isRecord(value)) return null
  const count = int(value.count, 1, MAX_CHECKPOINTS)
  const optional = parseList(value.optional, (v) => int(v, 0, MAX_CHECKPOINTS - 1), MAX_CHECKPOINTS)
  return count === null || optional === null ? null : { count, optional }
}

function parseRow(value: unknown): ItemBoxRowData | null {
  if (!isRecord(value)) return null
  const at = num(value.at, 0, 1)
  const count = int(value.count, 1, MAX_PICKUPS_PER_GROUP)
  return at === null || count === null ? null : { at, count }
}

function parseLine(value: unknown): UchuvaLineData | null {
  if (!isRecord(value)) return null
  const at = num(value.at, 0, 1)
  const count = int(value.count, 1, MAX_PICKUPS_PER_GROUP)
  const offset = num(value.offset, -MAX_HALF_WIDTH, MAX_HALF_WIDTH)
  return at === null || count === null || offset === null ? null : { at, count, offset }
}

/** Validates untrusted JSON (a file, a paste, localStorage). Returns null if it is unusable. */
export function parseTrackData(json: unknown): TrackData | null {
  if (!isRecord(json) || json.version !== TRACK_DATA_VERSION) return null
  if (typeof json.name !== 'string' || json.name.trim() === '') return null
  const halfWidth = num(json.halfWidth, MIN_HALF_WIDTH, MAX_HALF_WIDTH)
  const samplesPerSegment = int(json.samplesPerSegment, MIN_SAMPLES, MAX_SAMPLES)
  if (halfWidth === null || samplesPerSegment === null) return null

  const points = parseList(json.points, parsePoint, MAX_CONTROL_POINTS)
  if (!points || points.length < MIN_CONTROL_POINTS) return null
  const branches = parseList(json.branches, parseBranch, MAX_PICKUP_GROUPS)
  const checkpoints = json.checkpoints === undefined ? null : parseCheckpoints(json.checkpoints)
  const itemBoxRows = parseList(json.itemBoxRows, parseRow, MAX_PICKUP_GROUPS)
  const uchuvaLines = parseList(json.uchuvaLines, parseLine, MAX_PICKUP_GROUPS)
  if (!branches || !checkpoints || !itemBoxRows || !uchuvaLines) return null

  return {
    version: TRACK_DATA_VERSION,
    name: json.name,
    halfWidth,
    samplesPerSegment,
    points,
    branches,
    checkpoints,
    itemBoxRows,
    uchuvaLines,
  }
}

/** Parses JSON text; null on syntax errors or invalid data. */
export function parseTrackDataText(text: string): TrackData | null {
  try {
    return parseTrackData(JSON.parse(text))
  } catch {
    return null
  }
}

/** Deep copy through JSON, so edits never touch presets or previous states. */
export function cloneTrackData(data: TrackData): TrackData {
  return JSON.parse(JSON.stringify(data)) as TrackData
}

/** Surface of the road at centerline sample `index`: that of the nearest control point. */
function sampleSurface(data: TrackData, index: number): SurfaceType {
  const n = data.points.length
  const segment = Math.floor(index / data.samplesPerSegment)
  const along = (index % data.samplesPerSegment) / data.samplesPerSegment
  const control = (segment + (along >= 0.5 ? 1 : 0)) % n
  return data.points[control]?.surface ?? 'asphalt'
}

function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count
}

function sampleIndexAt(at: number, sampleCount: number): number {
  return Math.min(Math.floor(at * sampleCount), sampleCount - 1)
}

function boxOffsets(count: number, halfWidth: number): number[] {
  if (count === 1) return [0]
  const reach = halfWidth * BOX_SPREAD
  return Array.from({ length: count }, (_, i) => -reach + (2 * reach * i) / (count - 1))
}

function buildCheckpoints(
  data: TrackData,
  centerline: readonly Vec2[],
  halfWidth: number,
): Checkpoint[] {
  const { count, optional } = data.checkpoints
  const checkpoints: Checkpoint[] = []
  for (let i = 0; i < count; i++) {
    const index = Math.floor((i * centerline.length) / count)
    const p = centerline[index]
    const next = centerline[(index + 1) % centerline.length]
    if (!p || !next) continue
    const len = Math.hypot(next.x - p.x, next.z - p.z) || 1
    checkpoints.push({
      index: i,
      position: { x: p.x, z: p.z },
      forward: { x: (next.x - p.x) / len, z: (next.z - p.z) / len },
      width: halfWidth * 2 + CHECKPOINT_MARGIN,
      // Gate 0 is the start/finish line and always counts
      mandatory: i === 0 || !optional.includes(i),
    })
  }
  return checkpoints
}

/** Builds the simulation track from data, with the same spline/height logic as Cocora. */
export function buildTrackDefinition(data: TrackData): TrackDefinition {
  const controls: ControlPoint[] = data.points.map((p) => {
    const control: ControlPoint = { x: p.x, z: p.z, y: p.y }
    if (p.surface) control.surface = p.surface
    return control
  })
  const { points: centerline, heights } = buildCenterline(controls, data.samplesPerSegment)
  const branches: TrackBranch[] = data.branches.map((b) => {
    const branch: TrackBranch = {
      name: b.name,
      points: b.points.map((p) => ({ x: p.x, z: p.z })),
      halfWidth: b.halfWidth,
      surface: b.surface,
    }
    if (b.tide) branch.tide = { ...b.tide, lowLaps: [...b.tide.lowLaps] }
    return branch
  })
  const shape = new Track({ name: data.name, centerline, halfWidth: data.halfWidth, branches })

  const surfaceAt = (x: number, z: number): SurfaceType => {
    const projection = shape.project(x, z)
    if (projection.distance > projection.halfWidth) return 'grass'
    const branch = branches[projection.branch]
    if (branch) return branch.surface
    return sampleSurface(data, nearestIndex(centerline, x, z))
  }

  const count = centerline.length
  const itemBoxes = data.itemBoxRows.flatMap((row) =>
    rowAcross(centerline, sampleIndexAt(row.at, count), boxOffsets(row.count, data.halfWidth)),
  )
  const uchuvas = data.uchuvaLines.flatMap((line) =>
    lineAlong(centerline, sampleIndexAt(line.at, count), line.count, line.offset),
  )

  return {
    name: data.name,
    centerline,
    halfWidth: data.halfWidth,
    branches,
    groundHeight: createGroundHeight(shape, centerline, heights),
    surfaceAt,
    checkpoints: buildCheckpoints(data, centerline, data.halfWidth),
    itemBoxes,
    uchuvas,
    boostPads: (data.boostPads ?? []).map((pad) => buildBoostPad(centerline, pad)),
    hazards: (data.hazards ?? []).map((hazard) => ({
      ...hazard,
      path: hazard.path.map((p) => ({ x: p.x, z: p.z })),
    })),
  }
}

const DEFAULT_PAD_LENGTH = 6
const DEFAULT_PAD_WIDTH = 4

function buildBoostPad(centerline: readonly Vec2[], pad: BoostPadData): BoostPad {
  const index = sampleIndexAt(pad.at, centerline.length)
  const a = centerline[index]
  const b = centerline[(index + 1) % centerline.length]
  return {
    position: spotAt(centerline, index, pad.offset),
    heading: a && b ? headingOf(b.x - a.x, b.z - a.z) : 0,
    length: pad.length ?? DEFAULT_PAD_LENGTH,
    width: pad.width ?? DEFAULT_PAD_WIDTH,
  }
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const side = (p: Vec2, q: Vec2, r: Vec2): number =>
    Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x))
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b)
}

/** True if the sampled centerline crosses itself (checked on a coarse polyline). */
export function loopSelfIntersects(centerline: readonly Vec2[]): boolean {
  const n = centerline.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const a = centerline[i]
      const b = centerline[(i + 1) % n]
      const c = centerline[j]
      const d = centerline[(j + 1) % n]
      if (a && b && c && d && segmentsCross(a, b, c, d)) return true
    }
  }
  return false
}

/** Human-readable (Spanish) problems and warnings about a track, for the editor. */
export function validateTrackData(data: TrackData): string[] {
  const messages: string[] = []
  if (data.points.length < MIN_CONTROL_POINTS) {
    messages.push(`Faltan puntos: se necesitan al menos ${MIN_CONTROL_POINTS}.`)
    return messages
  }
  const definition = buildTrackDefinition(data)
  if (loopSelfIntersects(definition.centerline)) {
    messages.push('El circuito se cruza consigo mismo.')
  }
  const track = new Track(definition)
  data.branches.forEach((branch) => {
    for (const end of [branch.points[0], branch.points[branch.points.length - 1]]) {
      if (end && track.mainProjection(end.x, end.z).distance > data.halfWidth) {
        messages.push(`Un extremo del atajo "${branch.name}" no toca la carretera principal.`)
        break
      }
    }
  })
  if (data.checkpoints.count < 3) messages.push('Pocos checkpoints: usa al menos 3.')
  const mandatory = definition.checkpoints?.filter((c) => c.mandatory).length ?? 0
  if (mandatory < 2) messages.push('Debe haber al menos 2 checkpoints obligatorios.')
  const tight = data.points.some((p, i) => {
    const q = data.points[wrapIndex(i + 1, data.points.length)]
    return q !== undefined && Math.hypot(q.x - p.x, q.z - p.z) < data.halfWidth
  })
  if (tight) messages.push('Hay puntos muy juntos (menos de un ancho de media carretera).')
  return messages
}
