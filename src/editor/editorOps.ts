import type { Vec2 } from '../sim/math'
import type { SurfaceType } from '../sim/race/surface'
import { Track } from '../sim/track'
import {
  MIN_CONTROL_POINTS,
  buildTrackDefinition,
  type ItemBoxRowData,
  type TrackData,
  type UchuvaLineData,
} from '../sim/trackData'

/** What the user has selected: a main loop control point or a branch point. */
export type Selection =
  { kind: 'point'; index: number } | { kind: 'branch'; branch: number; index: number } | null

const MIN_BRANCH_POINTS = 2
/** How far past the road edge (m) a click still counts as "on the road". */
const ROAD_CLICK_MARGIN = 1
const SHORTCUT_START = 0.25
const SHORTCUT_END = 0.4
const SHORTCUT_HALF_WIDTH = 6

export function sameSelection(a: Selection, b: Selection): boolean {
  if (!a || !b) return a === b
  if (a.kind === 'point') return b.kind === 'point' && a.index === b.index
  return b.kind === 'branch' && a.branch === b.branch && a.index === b.index
}

/** Selected handle within `radius` meters of (x, z); the closest wins, null if none. */
export function hitHandle(data: TrackData, x: number, z: number, radius: number): Selection {
  let best: Selection = null
  let bestDistance = radius
  data.points.forEach((p, index) => {
    const d = Math.hypot(p.x - x, p.z - z)
    if (d <= bestDistance) {
      bestDistance = d
      best = { kind: 'point', index }
    }
  })
  data.branches.forEach((branch, b) => {
    branch.points.forEach((p, index) => {
      const d = Math.hypot(p.x - x, p.z - z)
      if (d <= bestDistance) {
        bestDistance = d
        best = { kind: 'branch', branch: b, index }
      }
    })
  })
  return best
}

/** Position of the selected handle, if it still exists. */
export function selectedPosition(data: TrackData, selection: Selection): Vec2 | null {
  if (!selection) return null
  if (selection.kind === 'point') return data.points[selection.index] ?? null
  return data.branches[selection.branch]?.points[selection.index] ?? null
}

/** Moves the selected handle to (x, z). */
export function moveSelected(data: TrackData, selection: Selection, x: number, z: number): void {
  const target = selectedPosition(data, selection)
  if (target) {
    target.x = x
    target.z = z
  }
}

/**
 * Inserts a point where the user clicked on the road: into the branch under the click, or into
 * the main loop between the two control points around the nearest sample. Returns the new
 * selection, or null if the click was not on any road.
 */
export function insertPointAt(data: TrackData, x: number, z: number): Selection {
  if (data.points.length < MIN_CONTROL_POINTS) return null
  const definition = buildTrackDefinition(data)
  const track = new Track(definition)
  const projection = track.project(x, z)
  if (projection.distance > projection.halfWidth + ROAD_CLICK_MARGIN) return null

  if (projection.branch >= 0) {
    const branch = data.branches[projection.branch]
    if (!branch) return null
    const after = nearestSegment(branch.points, x, z)
    branch.points.splice(after + 1, 0, { x, z })
    return { kind: 'branch', branch: projection.branch, index: after + 1 }
  }

  let nearest = 0
  let nearestDistance = Infinity
  definition.centerline.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < nearestDistance) {
      nearestDistance = d
      nearest = i
    }
  })
  const segment = Math.floor(nearest / data.samplesPerSegment)
  const before = data.points[segment]
  const next = data.points[(segment + 1) % data.points.length]
  if (!before || !next) return null
  data.points.splice(segment + 1, 0, { x, z, y: (before.y + next.y) / 2 })
  return { kind: 'point', index: segment + 1 }
}

/** Index of the polyline point that starts the segment closest to (x, z). */
function nearestSegment(points: readonly Vec2[], x: number, z: number): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    const abx = b.x - a.x
    const abz = b.z - a.z
    const lengthSq = abx * abx + abz * abz || 1
    const t = Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0), 1)
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t))
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return best
}

/** Deletes the selected point if the track keeps enough points. Returns whether it did. */
export function deleteSelected(data: TrackData, selection: Selection): boolean {
  if (!selection) return false
  if (selection.kind === 'point') {
    if (data.points.length <= MIN_CONTROL_POINTS) return false
    return data.points.splice(selection.index, 1).length === 1
  }
  const branch = data.branches[selection.branch]
  if (!branch || branch.points.length <= MIN_BRANCH_POINTS) return false
  return branch.points.splice(selection.index, 1).length === 1
}

/** Adds a mud shortcut that leaves and rejoins the road between 25% and 40% of the lap. */
export function addShortcut(data: TrackData): Selection {
  const centerline = buildTrackDefinition(data).centerline
  const count = centerline.length
  const from = centerline[Math.floor(count * SHORTCUT_START)]
  const to = centerline[Math.floor(count * SHORTCUT_END)]
  const middle = centerline[Math.floor((count * (SHORTCUT_START + SHORTCUT_END)) / 2)]
  if (!from || !to || !middle) return null
  // Push the middle point towards the inside of the loop so the shortcut is a chord
  let cx = 0
  let cz = 0
  for (const p of data.points) {
    cx += p.x / data.points.length
    cz += p.z / data.points.length
  }
  const pull = 0.35
  data.branches.push({
    name: `Atajo ${data.branches.length + 1}`,
    points: [
      { x: from.x, z: from.z },
      { x: middle.x + (cx - middle.x) * pull, z: middle.z + (cz - middle.z) * pull },
      { x: to.x, z: to.z },
    ],
    halfWidth: SHORTCUT_HALF_WIDTH,
    surface: 'mud',
  })
  return { kind: 'branch', branch: data.branches.length - 1, index: 1 }
}

function numbersOf(line: string): number[] {
  return line
    .split(/[\s,;]+/)
    .filter((part) => part !== '')
    .map(Number)
}

/** Text lines `at count` (one row of boxes per line). Invalid lines are skipped. */
export function parseBoxRows(text: string): ItemBoxRowData[] {
  const rows: ItemBoxRowData[] = []
  for (const line of text.split('\n')) {
    const [at, count] = numbersOf(line)
    if (at === undefined || count === undefined) continue
    if (at >= 0 && at <= 1 && Number.isInteger(count) && count >= 1 && count <= 12) {
      rows.push({ at, count })
    }
  }
  return rows
}

/** Text lines `at count offset` (one line of uchuvas per line). Invalid lines are skipped. */
export function parseUchuvaLines(text: string): UchuvaLineData[] {
  const lines: UchuvaLineData[] = []
  for (const line of text.split('\n')) {
    const [at, count, offset = 0] = numbersOf(line)
    if (at === undefined || count === undefined) continue
    if (
      at >= 0 &&
      at <= 1 &&
      Number.isInteger(count) &&
      count >= 1 &&
      count <= 12 &&
      Number.isFinite(offset)
    ) {
      lines.push({ at, count, offset })
    }
  }
  return lines
}

export function formatBoxRows(rows: readonly ItemBoxRowData[]): string {
  return rows.map((r) => `${r.at} ${r.count}`).join('\n')
}

export function formatUchuvaLines(lines: readonly UchuvaLineData[]): string {
  return lines.map((l) => `${l.at} ${l.count} ${l.offset}`).join('\n')
}

/** Comma separated 1-based gate numbers → 0-based indices below `count` (gate 1 is the start). */
export function parseOptionalGates(text: string, count: number): number[] {
  const gates = numbersOf(text)
    .filter((n) => Number.isInteger(n) && n >= 2 && n <= count)
    .map((n) => n - 1)
  return [...new Set(gates)].sort((a, b) => a - b)
}

export function surfaceLabel(surface: SurfaceType): string {
  const labels: Record<SurfaceType, string> = {
    asphalt: 'Asfalto',
    dirt: 'Tierra',
    grass: 'Pasto',
    mud: 'Barro',
    wood: 'Madera',
  }
  return labels[surface]
}
