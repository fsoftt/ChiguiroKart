import { describe, expect, it } from 'vitest'
import { tracks, type TrackId } from '../src/config/tracks/catalog'
import { cocoraEnvironment } from '../src/config/tracks/cocoraTheme'
import type { TerrainSettings } from '../src/config/tracks/environment'
import {
  buildTerrainField,
  edgeDistance,
  TERRAIN_SINK,
  WALL_BAND,
} from '../src/render/environment/terrainField'
import { scatterDecorations } from '../src/render/scenery/scatter'
import type { Vec2 } from '../src/sim/math'
import { Track } from '../src/sim/track'
import { branchPointAt, loopArcs } from '../src/sim/trackSpline'

const seed = cocoraEnvironment.seed
const terrain: TerrainSettings = cocoraEnvironment.terrain

/** World position of the middle of a jump gap. */
function gapMiddle(track: Track, jumpIndex: number): Vec2 {
  const gap = track.jumps[jumpIndex]?.gap
  if (!gap) throw new Error('No gap')
  const arc = (gap.from + gap.to) / 2
  const branch = track.branches[gap.branch]
  if (gap.branch >= 0 && branch) return branchPointAt(branch, arc).point
  const arcs = loopArcs(track.centerline)
  let i = 0
  while (i + 1 < arcs.length && (arcs[i + 1] as number) <= arc) i++
  const a = track.centerline[i] as Vec2
  const b = track.centerline[(i + 1) % track.centerline.length] as Vec2
  const span = (arcs[i + 1] ?? track.loopLength) - (arcs[i] as number)
  const t = span > 0 ? (arc - (arcs[i] as number)) / span : 0
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
}

const gapTracks: TrackId[] = ['bogota', 'amazonas', 'tatacoa']

describe.each(gapTracks)('gap ravines on %s', (id) => {
  const track = new Track(tracks[id].build())
  const field = buildTerrainField(track, terrain, seed)

  it('carves the land well below the road in the middle of each gap', () => {
    let gaps = 0
    track.jumps.forEach((jump, i) => {
      if (!jump.gap) return
      gaps++
      const m = gapMiddle(track, i)
      expect(field.heightAt(m.x, m.z)).toBeLessThanOrEqual(track.roadHeight(m.x, m.z) - 8)
    })
    expect(gaps).toBeGreaterThan(0)
  })

  it('never rises above the sim ground across the road and shoulder outside gaps', () => {
    const reach = WALL_BAND + terrain.shoulder
    for (let i = 0; i < track.centerline.length; i++) {
      const p = track.point(i)
      const before = track.point(i - 1)
      const after = track.point(i + 1)
      const length = Math.hypot(after.x - before.x, after.z - before.z) || 1
      const sx = (after.z - before.z) / length
      const sz = -(after.x - before.x) / length
      const half = track.halfWidth + reach
      for (let offset = -half; offset <= half; offset += 1.5) {
        const x = p.x + sx * offset
        const z = p.z + sz * offset
        if (edgeDistance(track, x, z) > reach || track.inGap(x, z)) continue
        expect(field.heightAt(x, z)).toBeLessThanOrEqual(track.roadHeight(x, z) - TERRAIN_SINK / 3)
      }
    }
  })
})

describe('falling land', () => {
  const track = new Track(tracks.bogota.build())
  const falling: TerrainSettings = { ...terrain, valleySlope: -0.2, floor: -3 }
  const field = buildTerrainField(track, falling, seed)
  const gapSpots = track.jumps.map((_, i) => gapMiddle(track, i))

  it('reaches the floor far from the road and never goes below it', () => {
    let lowest = Infinity
    for (let j = 0; j < field.nz; j++) {
      for (let i = 0; i < field.nx; i++) {
        const k = j * field.nx + i
        const edge = field.edges[k] as number
        const h = field.heights[k] as number
        if (edge > 120) lowest = Math.min(lowest, h)
        if (edge <= WALL_BAND + falling.shoulder) continue
        const x = field.minX + i * field.cell
        const z = field.minZ + j * field.cell
        // Only the gap ravines may dig below the floor
        if (gapSpots.some((g) => Math.hypot(g.x - x, g.z - z) < 90)) continue
        expect(h).toBeGreaterThanOrEqual(-3 - 1e-4)
      }
    }
    expect(lowest).toBeCloseTo(-3, 3)
  })
})

describe('scatter on the terrain', () => {
  const track = new Track(tracks.cocora.build())
  const field = buildTerrainField(track, terrain, seed)

  it('puts pieces on the terrain and clear of the given circles', () => {
    const keepClear = [{ x: 0, z: 0, radius: 60 }]
    const items = scatterDecorations(track, 'tree', 80, { heightAt: field.heightAt, keepClear })
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.y).toBe(field.heightAt(item.x, item.z))
      expect(Math.hypot(item.x, item.z)).toBeGreaterThanOrEqual(60)
    }
  })
})
