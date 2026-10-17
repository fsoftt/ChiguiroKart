import type { DecorationKind } from '../../config/tracks/theme'
import { headingOf } from '../../sim/math'
import type { Track } from '../../sim/track'
import { hashString, seededRandom } from './random'

/** Where and how big one piece of scenery stands. */
export interface ScatterItem {
  x: number
  y: number
  z: number
  /** Rotation around y (rad). */
  yaw: number
  scale: number
}

interface ScatterRule {
  /** Least distance from the edge of any road (main loop or branch) (m). */
  minGap: number
  /** Pieces are tried within this distance of a random road point (m). */
  spread: number
  scale: readonly [number, number]
  /** Least distance between two pieces of the same kind (m). */
  spacing: number
  /** Which way the front (+z) of the piece looks. */
  facing: 'random' | 'road' | 'away'
}

export const SCATTER_RULES: Record<DecorationKind, ScatterRule> = {
  tree: { minGap: 6, spread: 70, scale: [0.8, 1.6], spacing: 3, facing: 'random' },
  waxPalm: { minGap: 6, spread: 70, scale: [0.9, 1.6], spacing: 4, facing: 'random' },
  pine: { minGap: 6, spread: 70, scale: [0.8, 1.5], spacing: 3, facing: 'random' },
  snowPine: { minGap: 6, spread: 70, scale: [0.8, 1.5], spacing: 3, facing: 'random' },
  fumarole: { minGap: 8, spread: 60, scale: [0.8, 1.5], spacing: 8, facing: 'random' },
  saltColumn: { minGap: 3.5, spread: 40, scale: [0.8, 1.6], spacing: 3, facing: 'random' },
  colonialHouse: { minGap: 10, spread: 60, scale: [1, 1.4], spacing: 14, facing: 'road' },
  palm: { minGap: 5, spread: 60, scale: [0.9, 1.5], spacing: 3.5, facing: 'random' },
  cannon: { minGap: 3.5, spread: 40, scale: [0.9, 1.1], spacing: 10, facing: 'away' },
  stoneTerrace: { minGap: 8, spread: 70, scale: [1, 1.8], spacing: 8, facing: 'random' },
  jungleTree: { minGap: 5, spread: 60, scale: [0.9, 1.6], spacing: 3, facing: 'random' },
  ceiba: { minGap: 12, spread: 80, scale: [1, 1.5], spacing: 18, facing: 'random' },
  moriche: { minGap: 5, spread: 60, scale: [0.9, 1.4], spacing: 3, facing: 'random' },
  cow: { minGap: 5, spread: 60, scale: [0.9, 1.2], spacing: 4, facing: 'random' },
  redPlant: { minGap: 3, spread: 40, scale: [1, 2.2], spacing: 2, facing: 'random' },
  cactus: { minGap: 4, spread: 60, scale: [0.8, 1.6], spacing: 5, facing: 'random' },
  rock: { minGap: 3.5, spread: 60, scale: [0.6, 2.2], spacing: 3, facing: 'random' },
  confetti: { minGap: 3, spread: 40, scale: [1, 1.4], spacing: 6, facing: 'random' },
}

/** Pieces are never placed farther than this from the origin (the ground plane's reach). */
const MAP_LIMIT = 380
const ATTEMPTS_PER_ITEM = 24

export interface ScatterOptions {
  /** Index of the decoration set; sets of the same kind get different spots. */
  setIndex?: number
  /** If the track has water, pieces are not placed at or under this height. */
  waterLevel?: number
}

/**
 * Picks `count` spots off the road for a kind of scenery. Deterministic: the same track and
 * arguments always give the same spots. It may return fewer than `count` if the map is tight.
 */
export function scatterDecorations(
  track: Track,
  kind: DecorationKind,
  count: number,
  options: ScatterOptions = {},
): ScatterItem[] {
  const rule = SCATTER_RULES[kind]
  const random = seededRandom(42 + (options.setIndex ?? 0) * 7919 + hashString(kind))
  const cell = Math.max(rule.spacing, 0.5)
  const grid = new Map<string, ScatterItem[]>()
  const items: ScatterItem[] = []

  for (let attempt = 0; items.length < count && attempt < count * ATTEMPTS_PER_ITEM; attempt++) {
    const anchor = track.point(Math.floor(random() * track.centerline.length))
    const x = anchor.x + (random() - 0.5) * rule.spread * 2
    const z = anchor.z + (random() - 0.5) * rule.spread * 2
    const yawRandom = random() * Math.PI * 2
    const scale = rule.scale[0] + random() * (rule.scale[1] - rule.scale[0])
    if (Math.abs(x) > MAP_LIMIT || Math.abs(z) > MAP_LIMIT) continue

    // Keep clear of every corridor, branches included
    const nearest = track.project(x, z)
    if (nearest.distance - nearest.halfWidth < rule.minGap) continue

    const y = track.roadHeight(x, z)
    if (options.waterLevel !== undefined && y <= options.waterLevel + 0.05) continue

    const cx = Math.floor(x / cell)
    const cz = Math.floor(z / cell)
    if (crowded(grid, cx, cz, x, z, rule.spacing)) continue

    const yaw =
      rule.facing === 'random'
        ? yawRandom
        : rule.facing === 'road'
          ? headingOf(-nearest.normal.x, -nearest.normal.z)
          : headingOf(nearest.normal.x, nearest.normal.z)
    const item = { x, y, z, yaw, scale }
    items.push(item)
    const key = `${cx},${cz}`
    const bucket = grid.get(key)
    if (bucket) bucket.push(item)
    else grid.set(key, [item])
  }
  return items
}

function crowded(
  grid: ReadonlyMap<string, readonly ScatterItem[]>,
  cx: number,
  cz: number,
  x: number,
  z: number,
  spacing: number,
): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const other of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
        if (Math.hypot(other.x - x, other.z - z) < spacing) return true
      }
    }
  }
  return false
}
