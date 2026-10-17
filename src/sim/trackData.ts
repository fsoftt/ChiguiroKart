import { lineAlong, rowAcross, spotAt } from '../config/tracks/pickupLayout'
import { headingOf, rightOf, type Vec2 } from './math'
import type { Checkpoint } from './race/checkpoint'
import type { SurfaceType } from './race/surface'
import {
  Track,
  type BoostPad,
  type HazardDefinition,
  type HazardKind,
  type Jump,
  type GapZone,
  type TideRule,
  type TrackBranch,
  type TrackDefinition,
} from './track'
import {
  branchLength,
  branchPointAt,
  buildCenterline,
  createGapTest,
  createTerrain,
  loopArcs,
  nearestIndex,
  type ControlPoint,
} from './trackSpline'

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

const HAZARD_KINDS: readonly HazardKind[] = ['herd', 'float', 'iceWall', 'rock']
const MAX_LAPS = 20
const MIN_PAD_SIZE = 1
const MAX_PAD_SIZE = 40
const MAX_HAZARDS = 32
const MAX_HAZARD_PATH_POINTS = 64
const MAX_HAZARD_SPEED = 60
const MAX_HAZARD_COUNT = 16
const MIN_HAZARD_RADIUS = 0.3
const MAX_HAZARD_RADIUS = 20
const MAX_HAZARD_PAUSE = 30
const MAX_BRANCH_STEPS = 64
const MAX_LAUNCH_SPEED = 40
const MAX_GAP = 60
const MAX_NAME_LENGTH = 100
/** Length of the lip zone behind a jump edge (m). */
export const JUMP_LIP_LENGTH = 4
export const DEFAULT_LAUNCH_SPEED = 10

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
  /**
   * Ground height at each of `points` (m, same length), piecewise linear by arc length. The ends
   * should match the road heights where the branch joins the main road.
   */
  heights?: number[]
  /** Quantizes the height profile into this many flat treads with sharp risers (stairs). */
  steps?: number
}

/**
 * Turbo strip `at` (0..1 along the loop), `offset` m right of the centerline, along the road.
 * With `branch` (a branch name) `at` runs along that branch by arc length instead.
 */
export interface BoostPadData {
  at: number
  offset: number
  branch?: string
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

/**
 * Launch ramp: the lip edge is at `at` (0..1 along the loop by samples, or along `branch` by arc
 * length). A grounded kart in the 4 m before it, moving forward faster than a jog, is thrown up
 * at `launchSpeed`; the ground can be missing for `gap` metres past the edge.
 */
export interface JumpData {
  at: number
  /** Branch name; the jump is on the main loop if omitted. */
  branch?: string
  /** Vertical speed given at the lip (m/s). Default 10: enough airtime for the landing boost. */
  launchSpeed?: number
  /** Metres of missing ground right after the lip. Default 0 (launch only). */
  gap?: number
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
  /** Optional turbo strips. */
  boostPads?: BoostPadData[]
  /** Optional launch ramps and gaps. */
  jumps?: JumpData[]
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
  const branch: TrackBranchData = { name: value.name, points, halfWidth, surface }
  if (value.tide !== undefined) {
    const tide = parseTide(value.tide)
    if (!tide) return null
    branch.tide = tide
  }
  if (value.heights !== undefined) {
    const heights = parseList(value.heights, (v) => num(v), points.length)
    if (!Array.isArray(value.heights) || !heights || heights.length !== points.length) return null
    branch.heights = heights
  }
  if (value.steps !== undefined) {
    const steps = int(value.steps, 1, MAX_BRANCH_STEPS)
    if (steps === null) return null
    branch.steps = steps
  }
  return branch
}

function parseTide(value: unknown): TideRule | null {
  if (!isRecord(value)) return null
  const lowLaps = parseList(value.lowLaps, (v) => int(v, 1, MAX_LAPS), MAX_LAPS)
  const lowSurface = surfaceOf(value.lowSurface)
  const highSurface = surfaceOf(value.highSurface)
  if (!Array.isArray(value.lowLaps) || !lowLaps || !lowSurface || !highSurface) return null
  return { lowLaps, lowSurface, highSurface }
}

function parseBoostPad(value: unknown): BoostPadData | null {
  if (!isRecord(value)) return null
  const at = num(value.at, 0, 1)
  const offset = num(value.offset, -MAX_HALF_WIDTH, MAX_HALF_WIDTH)
  if (at === null || offset === null) return null
  const pad: BoostPadData = { at, offset }
  if (value.branch !== undefined) {
    if (typeof value.branch !== 'string' || value.branch.length > MAX_NAME_LENGTH) return null
    pad.branch = value.branch
  }
  if (value.length !== undefined) {
    const length = num(value.length, MIN_PAD_SIZE, MAX_PAD_SIZE)
    if (length === null) return null
    pad.length = length
  }
  if (value.width !== undefined) {
    const width = num(value.width, MIN_PAD_SIZE, MAX_PAD_SIZE)
    if (width === null) return null
    pad.width = width
  }
  return pad
}

function parseJump(value: unknown): JumpData | null {
  if (!isRecord(value)) return null
  const at = num(value.at, 0, 1)
  if (at === null) return null
  const jump: JumpData = { at }
  if (value.branch !== undefined) {
    if (typeof value.branch !== 'string' || value.branch.length > MAX_NAME_LENGTH) return null
    jump.branch = value.branch
  }
  if (value.launchSpeed !== undefined) {
    const launchSpeed = num(value.launchSpeed, 1, MAX_LAUNCH_SPEED)
    if (launchSpeed === null) return null
    jump.launchSpeed = launchSpeed
  }
  if (value.gap !== undefined) {
    const gap = num(value.gap, 0, MAX_GAP)
    if (gap === null) return null
    jump.gap = gap
  }
  return jump
}

function parseVec2(value: unknown): Vec2 | null {
  if (!isRecord(value)) return null
  const x = num(value.x)
  const z = num(value.z)
  return x === null || z === null ? null : { x, z }
}

function parseHazard(value: unknown): HazardDefinition | null {
  if (!isRecord(value)) return null
  const kind = HAZARD_KINDS.find((k) => k === value.kind)
  const motion = value.motion === 'loop' || value.motion === 'pingPong' ? value.motion : null
  const path = parseList(value.path, parseVec2, MAX_HAZARD_PATH_POINTS)
  const speed = num(value.speed, 0, MAX_HAZARD_SPEED)
  const count = int(value.count, 1, MAX_HAZARD_COUNT)
  const radius = num(value.radius, MIN_HAZARD_RADIUS, MAX_HAZARD_RADIUS)
  if (!kind || !motion || !Array.isArray(value.path) || !path || path.length < 1) return null
  if (speed === null || count === null || radius === null) return null
  const hazard: HazardDefinition = { kind, path, motion, speed, count, radius }
  if (value.pause !== undefined) {
    const pause = num(value.pause, 0, MAX_HAZARD_PAUSE)
    if (pause === null) return null
    hazard.pause = pause
  }
  return hazard
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

  const data: TrackData = {
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
  if (json.boostPads !== undefined) {
    const boostPads = parseList(json.boostPads, parseBoostPad, MAX_PICKUP_GROUPS)
    if (!Array.isArray(json.boostPads) || !boostPads) return null
    data.boostPads = boostPads
  }
  if (json.jumps !== undefined) {
    const jumps = parseList(json.jumps, parseJump, MAX_PICKUP_GROUPS)
    if (!Array.isArray(json.jumps) || !jumps) return null
    data.jumps = jumps
  }
  if (json.hazards !== undefined) {
    const hazards = parseList(json.hazards, parseHazard, MAX_HAZARDS)
    if (!Array.isArray(json.hazards) || !hazards) return null
    data.hazards = hazards
  }
  return data
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
    if (b.heights) branch.heights = [...b.heights]
    if (b.steps !== undefined) branch.steps = b.steps
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

  const jumps = (data.jumps ?? []).flatMap((jump) => {
    const resolved = buildJump(centerline, shape, data, jump)
    return resolved ? [resolved] : []
  })
  const gaps = jumps.flatMap((jump) => (jump.gap ? [jump.gap] : []))
  const gapAt = createGapTest(shape, centerline, gaps)
  const terrain = createTerrain(shape, centerline, heights, gapAt)

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
    groundHeight: terrain.groundHeight,
    roadHeight: terrain.roadHeight,
    ...(gapAt ? { gapAt } : {}),
    surfaceAt,
    checkpoints: buildCheckpoints(data, centerline, data.halfWidth),
    itemBoxes,
    uchuvas,
    boostPads: (data.boostPads ?? []).flatMap((pad) => {
      const built = buildBoostPad(centerline, shape, pad)
      return built ? [built] : []
    }),
    jumps,
    hazards: (data.hazards ?? []).map((hazard) => ({
      ...hazard,
      path: hazard.path.map((p) => ({ x: p.x, z: p.z })),
    })),
  }
}

const DEFAULT_PAD_LENGTH = 6
const DEFAULT_PAD_WIDTH = 4

function buildBoostPad(
  centerline: readonly Vec2[],
  shape: Track,
  pad: BoostPadData,
): BoostPad | null {
  const length = pad.length ?? DEFAULT_PAD_LENGTH
  const width = pad.width ?? DEFAULT_PAD_WIDTH
  if (pad.branch !== undefined) {
    const branch = shape.branches.find((b) => b.name === pad.branch)
    if (!branch) return null
    const { point, heading } = branchPointAt(branch, pad.at * branchLength(branch))
    const right = rightOf(heading)
    return {
      position: { x: point.x + right.x * pad.offset, z: point.z + right.z * pad.offset },
      heading,
      length,
      width,
    }
  }
  const index = sampleIndexAt(pad.at, centerline.length)
  const a = centerline[index]
  const b = centerline[(index + 1) % centerline.length]
  return {
    position: spotAt(centerline, index, pad.offset),
    heading: a && b ? headingOf(b.x - a.x, b.z - a.z) : 0,
    length,
    width,
  }
}

/** Resolves a jump to its lip position, heading and gap range; null for an unknown branch. */
function buildJump(
  centerline: readonly Vec2[],
  shape: Track,
  data: TrackData,
  jump: JumpData,
): Jump | null {
  const launchSpeed = jump.launchSpeed ?? DEFAULT_LAUNCH_SPEED
  const gapLength = jump.gap ?? 0
  if (jump.branch !== undefined) {
    const branchIndex = shape.branches.findIndex((b) => b.name === jump.branch)
    const branch = shape.branches[branchIndex]
    if (!branch) return null
    const total = branchLength(branch)
    const from = jump.at * total
    const { point, heading } = branchPointAt(branch, from)
    const resolved: Jump = {
      position: point,
      heading,
      halfWidth: branch.halfWidth,
      length: JUMP_LIP_LENGTH,
      launchSpeed,
    }
    if (gapLength > 0) {
      resolved.gap = { branch: branchIndex, from, to: Math.min(from + gapLength, total) }
    }
    return resolved
  }
  const count = centerline.length
  const index = sampleIndexAt(jump.at, count)
  const lip = centerline[index]
  const before = centerline[wrapIndex(index - 1, count)]
  const after = centerline[wrapIndex(index + 1, count)]
  if (!lip || !before || !after) return null
  const resolved: Jump = {
    position: { x: lip.x, z: lip.z },
    heading: headingOf(after.x - before.x, after.z - before.z),
    halfWidth: data.halfWidth,
    length: JUMP_LIP_LENGTH,
    launchSpeed,
  }
  if (gapLength > 0) resolved.gap = mainGap(centerline, index, gapLength)
  return resolved
}

/** Gap on the main loop from sample `index`, snapped to samples so the drawn road ends cleanly. */
function mainGap(centerline: readonly Vec2[], index: number, gapLength: number): GapZone {
  const arcs = loopArcs(centerline)
  const from = arcs[index] ?? 0
  let end = index + 1
  for (let i = index + 1; i < arcs.length; i++) {
    const arc = arcs[i] ?? 0
    const best = arcs[end] ?? 0
    if (Math.abs(arc - from - gapLength) < Math.abs(best - from - gapLength)) end = i
  }
  return { branch: -1, from, to: arcs[end] ?? from }
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
  messages.push(...validateJumps(data, track))
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

/** Largest difference (m) allowed between a branch end height and the road it joins. */
const MAX_END_HEIGHT_MISMATCH = 0.75

function validateJumps(data: TrackData, track: Track): string[] {
  const messages: string[] = []
  const known = (name: string): boolean => data.branches.some((b) => b.name === name)
  for (const jump of data.jumps ?? []) {
    if (jump.branch !== undefined && !known(jump.branch)) {
      messages.push(`Un salto usa el atajo "${jump.branch}", que no existe.`)
    }
  }
  for (const pad of data.boostPads ?? []) {
    if (pad.branch !== undefined && !known(pad.branch)) {
      messages.push(`Un turbo usa el atajo "${pad.branch}", que no existe.`)
    }
  }
  for (const gap of track.jumps.flatMap((jump) => (jump.gap ? [jump.gap] : []))) {
    const branch = track.branches[gap.branch]
    if (branch && gap.to - gap.from < 0.5) {
      messages.push(`Un hueco del atajo "${branch.name}" se sale del atajo.`)
    }
  }
  const spots = [...track.itemBoxes, ...track.uchuvas, ...track.boostPads.map((p) => p.position)]
  if (spots.some((spot) => track.inGap(spot.x, spot.z))) {
    messages.push('Hay cajas, uchuvas o turbos dentro de un hueco de salto.')
  }
  data.branches.forEach((branch, index) => {
    if (!branch.heights) return
    if (branch.heights.length !== branch.points.length) {
      messages.push(`El atajo "${branch.name}" necesita una altura por punto.`)
      return
    }
    const built = track.branches[index]
    const first = branch.points[0]
    const last = branch.points[branch.points.length - 1]
    if (!built || !first || !last) return
    const ends: [Vec2, number | undefined][] = [
      [first, branch.heights[0]],
      [last, branch.heights[branch.heights.length - 1]],
    ]
    for (const [end, height] of ends) {
      const road = track.roadHeight(end.x, end.z)
      if (height !== undefined && Math.abs(height - road) > MAX_END_HEIGHT_MISMATCH) {
        messages.push(
          `Un extremo del atajo "${branch.name}" no coincide con la altura de la carretera.`,
        )
        break
      }
    }
  })
  return messages
}
