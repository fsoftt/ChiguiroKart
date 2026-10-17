import type { VegetationSettings } from '../../config/tracks/environment'
import type { Vec2 } from '../../sim/math'
import type { Track } from '../../sim/track'
import { hashString, seededRandom } from '../scenery/random'
import { edgeDistance, type TerrainField } from './terrainField'

/** One plant: where it stands (on the terrain), how it is turned and sized. */
export interface Plant {
  x: number
  y: number
  z: number
  yaw: number
  scale: number
  /** Random 0..1 the renderer turns into a color variation. */
  shade: number
}

export interface VegetationLayout {
  grass: Plant[]
  flowers: Plant[]
  bushes: Plant[]
  ferns: Plant[]
  palms: Plant[]
  trees: Plant[]
  cypress: Plant[]
  distant: Plant[]
}

export type VegetationLayer = keyof VegetationLayout

export const VEGETATION_LAYERS: readonly VegetationLayer[] = [
  'grass',
  'flowers',
  'bushes',
  'ferns',
  'palms',
  'trees',
  'cypress',
  'distant',
]

/** A round area plants keep out of (a prop and its platform). */
export interface KeepClear {
  x: number
  z: number
  radius: number
}

/** Least distance from a road edge for each layer (m): nothing grows on the drivable area. */
export const MIN_EDGE: Record<VegetationLayer, number> = {
  grass: 0.9,
  flowers: 1.1,
  bushes: 2.5,
  ferns: 2,
  palms: 7,
  trees: 8,
  cypress: 14,
  distant: 40,
}

interface Anchor {
  x: number
  z: number
  /** Unit vector pointing to the right of the driving direction. */
  sx: number
  sz: number
  halfWidth: number
}

function roadAnchors(track: Track): Anchor[] {
  const anchors: Anchor[] = []
  const add = (a: Vec2, before: Vec2, after: Vec2, halfWidth: number): void => {
    const dx = after.x - before.x
    const dz = after.z - before.z
    const length = Math.hypot(dx, dz) || 1
    anchors.push({ x: a.x, z: a.z, sx: dz / length, sz: -dx / length, halfWidth })
  }
  const count = track.centerline.length
  for (let i = 0; i < count; i++)
    add(track.point(i), track.point(i - 1), track.point(i + 1), track.halfWidth)
  for (const branch of track.branches) {
    for (let i = 1; i + 1 < branch.points.length; i++) {
      const a = branch.points[i - 1] as Vec2
      const b = branch.points[i] as Vec2
      const c = branch.points[i + 1] as Vec2
      // Branch points are far apart: fill in between them
      const steps = Math.max(1, Math.round(Math.hypot(c.x - b.x, c.z - b.z) / 4))
      for (let s = 0; s < steps; s++) {
        const t = s / steps
        add({ x: b.x + (c.x - b.x) * t, z: b.z + (c.z - b.z) * t }, a, c, branch.halfWidth)
      }
    }
  }
  return anchors
}

class SpatialHash {
  private readonly cells = new Map<string, Vec2[]>()
  constructor(private readonly size: number) {}

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`
  }

  crowded(x: number, z: number, spacing: number): boolean {
    const cx = Math.floor(x / this.size)
    const cz = Math.floor(z / this.size)
    const reach = Math.ceil(spacing / this.size)
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        for (const other of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (Math.hypot(other.x - x, other.z - z) < spacing) return true
        }
      }
    }
    return false
  }

  add(x: number, z: number): void {
    const key = this.key(x, z)
    const bucket = this.cells.get(key)
    if (bucket) bucket.push({ x, z })
    else this.cells.set(key, [{ x, z }])
  }
}

/** Steepest rise per meter around (x, z). */
export function slopeAt(field: TerrainField, x: number, z: number): number {
  const d = 1.5
  const h = field.heightAt(x, z)
  return (
    Math.max(
      Math.abs(field.heightAt(x + d, z) - h),
      Math.abs(field.heightAt(x - d, z) - h),
      Math.abs(field.heightAt(x, z + d) - h),
      Math.abs(field.heightAt(x, z - d) - h),
    ) / d
  )
}

interface LayerRule {
  /** Scale range of the plants. */
  scale: readonly [number, number]
  /** Least distance between plants (m); 0 for none. */
  spacing: number
  /** Steepest ground they grow on (rise per meter). */
  maxSlope: number
}

const RULES: Record<VegetationLayer, LayerRule> = {
  grass: { scale: [1.0, 1.9], spacing: 0, maxSlope: 1.1 },
  flowers: { scale: [0.9, 1.5], spacing: 0.35, maxSlope: 0.9 },
  bushes: { scale: [0.8, 1.7], spacing: 2.4, maxSlope: 0.8 },
  ferns: { scale: [0.8, 1.6], spacing: 1.1, maxSlope: 0.9 },
  palms: { scale: [0.9, 1.7], spacing: 4.5, maxSlope: 0.6 },
  trees: { scale: [0.8, 1.6], spacing: 5, maxSlope: 0.7 },
  cypress: { scale: [0.8, 1.8], spacing: 4, maxSlope: 1.0 },
  distant: { scale: [0.9, 2.0], spacing: 7, maxSlope: 1.2 },
}

/**
 * Where the plants of an environment stand. Deterministic: the same track, field, settings,
 * seed and density always give the same layout. Every plant is off every road (see
 * `MIN_EDGE`), on the terrain surface, and clear of the `keepClear` areas. `density` (0..1)
 * scales the counts; it is how the quality levels thin out the vegetation.
 */
export function layoutVegetation(
  track: Track,
  field: TerrainField,
  settings: VegetationSettings,
  seed: number,
  density: number,
  keepClear: readonly KeepClear[] = [],
): VegetationLayout {
  const anchors = roadAnchors(track)
  const maxX = field.minX + (field.nx - 1) * field.cell
  const maxZ = field.minZ + (field.nz - 1) * field.cell

  const make = (layer: VegetationLayer): Plant[] => {
    const rule = RULES[layer]
    const total = Math.round(settings[layer === 'distant' ? 'distant' : layer] * density)
    const random = seededRandom(seed * 31 + hashString(layer))
    const hash = new SpatialHash(Math.max(rule.spacing, 1))
    const plants: Plant[] = []

    const accept = (x: number, z: number, shade: number): boolean => {
      if (x < field.minX + 8 || x > maxX - 8 || z < field.minZ + 8 || z > maxZ - 8) return false
      if (edgeDistance(track, x, z) < MIN_EDGE[layer]) return false
      for (const area of keepClear) {
        if (Math.hypot(x - area.x, z - area.z) < area.radius) return false
      }
      if (rule.spacing > 0 && hash.crowded(x, z, rule.spacing)) return false
      if (slopeAt(field, x, z) > rule.maxSlope) return false
      const scale = rule.scale[0] + random() * (rule.scale[1] - rule.scale[0])
      plants.push({ x, y: field.heightAt(x, z), z, yaw: random() * Math.PI * 2, scale, shade })
      hash.add(x, z)
      return true
    }

    // Beside the road: pick a road spot, a side and a distance from its edge
    const alongRoad = (maxEdge: number, power: number, minEdge: number): [number, number] => {
      const anchor = anchors[Math.floor(random() * anchors.length)] as Anchor
      const side = random() < 0.5 ? 1 : -1
      const edge = minEdge + (maxEdge - minEdge) * Math.pow(random(), power)
      const along = (random() - 0.5) * 3
      return [
        anchor.x + anchor.sx * side * (anchor.halfWidth + edge) - anchor.sz * side * along,
        anchor.z + anchor.sz * side * (anchor.halfWidth + edge) + anchor.sx * side * along,
      ]
    }
    const anywhere = (minEdge: number, maxEdge: number): [number, number] => {
      for (let k = 0; k < 40; k++) {
        const x = field.minX + random() * (maxX - field.minX)
        const z = field.minZ + random() * (maxZ - field.minZ)
        const edge = edgeDistance(track, x, z)
        if (edge >= minEdge && edge <= maxEdge) return [x, z]
      }
      return [field.minX, field.minZ]
    }
    const gaussian = (): number => (random() + random() + random() - 1.5) * 0.9

    /** Clusters: patches of one color (flowers) or groves (palms, trees). */
    const clustered = (
      centers: () => [number, number],
      clusterCount: number,
      perCluster: number,
      radius: number,
    ): void => {
      const budget = total * 40
      let attempts = 0
      for (let c = 0; c < clusterCount && plants.length < total; c++) {
        const [cx, cz] = centers()
        const clusterShade = random()
        const size = Math.max(1, Math.round(perCluster * (0.6 + random() * 0.8)))
        let placed = 0
        for (let n = 0; n < size * 8 && attempts < budget && plants.length < total; n++) {
          attempts++
          const jitter = clusterShade + (random() - 0.5) * 0.15
          const ok = accept(
            cx + gaussian() * radius,
            cz + gaussian() * radius,
            Math.min(1, Math.max(0, jitter)),
          )
          if (ok && ++placed >= size) break
        }
      }
    }

    switch (layer) {
      case 'grass': {
        for (let a = 0; plants.length < total && a < total * 30; a++) {
          const [x, z] = alongRoad(24, 2.4, MIN_EDGE.grass)
          accept(x, z, random())
        }
        break
      }
      case 'flowers': {
        clustered(() => alongRoad(16, 1.6, 2), Math.ceil(total / 14), 14, 2.2)
        break
      }
      case 'bushes': {
        for (let a = 0; plants.length < total && a < total * 30; a++) {
          const [x, z] = alongRoad(26, 1.4, MIN_EDGE.bushes)
          accept(x, z, random())
        }
        break
      }
      case 'ferns': {
        clustered(() => alongRoad(18, 1.3, 2.5), Math.ceil(total / 7), 7, 1.6)
        break
      }
      case 'palms': {
        // A fifth stand alone near the road, the rest in groves on the slopes
        const singles = Math.round(total * 0.3)
        for (let a = 0; plants.length < singles && a < singles * 30; a++) {
          const [x, z] = alongRoad(36, 1.0, MIN_EDGE.palms)
          accept(x, z, random())
        }
        clustered(() => anywhere(12, 120), 16, Math.ceil(total / 14), 16)
        break
      }
      case 'trees': {
        const singles = Math.round(total * 0.25)
        for (let a = 0; plants.length < singles && a < singles * 30; a++) {
          const [x, z] = alongRoad(34, 1.2, MIN_EDGE.trees)
          accept(x, z, random())
        }
        clustered(() => anywhere(10, 90), 14, Math.ceil(total / 12), 13)
        break
      }
      case 'cypress': {
        clustered(() => anywhere(22, 140), 12, Math.ceil(total / 10), 10)
        break
      }
      case 'distant': {
        for (let a = 0; plants.length < total && a < total * 40; a++) {
          const [x, z] = anywhere(MIN_EDGE.distant, 230)
          accept(x, z, random())
        }
        break
      }
    }
    return plants
  }

  return {
    grass: make('grass'),
    flowers: make('flowers'),
    bushes: make('bushes'),
    ferns: make('ferns'),
    palms: make('palms'),
    trees: make('trees'),
    cypress: make('cypress'),
    distant: make('distant'),
  }
}
