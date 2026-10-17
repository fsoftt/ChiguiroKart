import { describe, expect, it } from 'vitest'
import { cocoraEnvironment } from '../src/config/tracks/cocoraTheme'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
import { qualityProfiles, resolveQuality } from '../src/config/quality'
import { chevronSigns, layoutProps, pennantSpots } from '../src/render/environment/decorLayout'
import { fbm } from '../src/render/environment/noise'
import {
  buildTerrainField,
  edgeDistance,
  levelPads,
  TERRAIN_SINK,
  WALL_BAND,
} from '../src/render/environment/terrainField'
import {
  layoutVegetation,
  MIN_EDGE,
  VEGETATION_LAYERS,
} from '../src/render/environment/vegetationLayout'
import { Track } from '../src/sim/track'

const track = new Track(cocoraTrack)
const { terrain, seed } = cocoraEnvironment
const field = buildTerrainField(track, terrain, seed)

describe('terrain field', () => {
  it('is deterministic for the same seed and differs for another', () => {
    const again = buildTerrainField(track, terrain, seed)
    expect(Array.from(again.heights.slice(0, 500))).toEqual(Array.from(field.heights.slice(0, 500)))
    expect(again.heightAt(40, 20)).toBe(field.heightAt(40, 20))
    const other = buildTerrainField(track, terrain, seed + 1)
    expect(other.heightAt(300, 300)).not.toBe(field.heightAt(300, 300))
  })

  it('noise is deterministic and in range', () => {
    expect(fbm(3.3, 7.1, 5)).toBe(fbm(3.3, 7.1, 5))
    for (let i = 0; i < 50; i++) {
      const n = fbm(i * 1.7, i * 0.3, 9)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
    }
  })

  it('never rises above the sim ground across the road and shoulder', () => {
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
        if (edgeDistance(track, x, z) > reach) continue
        expect(field.heightAt(x, z)).toBeLessThanOrEqual(track.roadHeight(x, z) - TERRAIN_SINK / 3)
      }
    }
  })

  it('rises into hills and valley walls far from the road', () => {
    let highest = -Infinity
    for (let k = 0; k < field.heights.length; k += 7) {
      if ((field.edges[k] as number) > 120) highest = Math.max(highest, field.heights[k] as number)
    }
    expect(highest).toBeGreaterThan(20)
  })

  it('keeps leveled platforms away from the road', () => {
    const copy = buildTerrainField(track, terrain, seed)
    const props = layoutProps(track, copy, cocoraEnvironment.decor.props, terrain.shoulder)
    levelPads(copy, props.pads)
    for (const pad of props.pads) {
      const edge = edgeDistance(track, pad.x, pad.z)
      expect(edge).toBeGreaterThan(pad.radius + WALL_BAND + terrain.shoulder)
      expect(Math.abs(copy.heightAt(pad.x, pad.z) - pad.y)).toBeLessThan(0.3)
    }
  })
})

describe('vegetation layout', () => {
  const layout = layoutVegetation(track, field, cocoraEnvironment.vegetation, seed, 1)

  it('is deterministic', () => {
    const again = layoutVegetation(track, field, cocoraEnvironment.vegetation, seed, 1)
    expect(again.palms).toEqual(layout.palms)
    expect(again.grass.slice(0, 50)).toEqual(layout.grass.slice(0, 50))
  })

  it.each(VEGETATION_LAYERS)('keeps %s off the road and on the terrain', (layer) => {
    expect(layout[layer].length).toBeGreaterThan(0)
    for (const plant of layout[layer]) {
      expect(edgeDistance(track, plant.x, plant.z)).toBeGreaterThanOrEqual(MIN_EDGE[layer] - 1e-6)
      expect(plant.y).toBeCloseTo(field.heightAt(plant.x, plant.z), 5)
    }
  })

  it('keeps plants and props out of the water', () => {
    const heights = layout.trees.map((t) => t.y).sort((a, b) => a - b)
    const level = heights[Math.floor(heights.length * 0.3)] as number
    const dry = layoutVegetation(track, field, cocoraEnvironment.vegetation, seed, 1, [], level)
    expect(dry.trees.length).toBeGreaterThan(0)
    for (const layer of VEGETATION_LAYERS)
      for (const plant of dry[layer]) expect(plant.y).toBeGreaterThanOrEqual(level + 0.15)
    const placements = cocoraEnvironment.decor.props.filter((p) => p.kind !== 'boat')
    const { spots } = layoutProps(track, field, placements, terrain.shoulder, level)
    for (const spot of spots) expect(spot.y).toBeGreaterThanOrEqual(level)
  })

  it('scales with the density of the quality table', () => {
    const count = (density: number): number => {
      const l = layoutVegetation(track, field, cocoraEnvironment.vegetation, seed, density)
      return l.grass.length + l.flowers.length + l.palms.length + l.trees.length
    }
    const high = count(qualityProfiles.high.vegetationDensity)
    const medium = count(qualityProfiles.medium.vegetationDensity)
    const low = count(qualityProfiles.low.vegetationDensity)
    expect(medium / high).toBeGreaterThan(0.45)
    expect(medium / high).toBeLessThan(0.75)
    expect(low / high).toBeGreaterThan(0.2)
    expect(low / high).toBeLessThan(0.4)
  })
})

describe('quality table', () => {
  it('thins the vegetation: 100 %, 60 %, 30 %', () => {
    expect(qualityProfiles.high.vegetationDensity).toBe(1)
    expect(qualityProfiles.medium.vegetationDensity).toBe(0.6)
    expect(qualityProfiles.low.vegetationDensity).toBe(0.3)
    expect(resolveQuality('low', 1).vegetationDensity).toBe(0.3)
  })
})

describe('decoration layout', () => {
  it('puts chevron signs outside the corridor', () => {
    const signs = chevronSigns(track)
    expect(signs.length).toBeGreaterThan(0)
    for (const sign of signs) {
      expect(edgeDistance(track, sign.x, sign.z)).toBeGreaterThan(WALL_BAND)
    }
  })

  it('hangs pennants only over plain straights', () => {
    const spots = pennantSpots(track, 5)
    expect(spots.length).toBeGreaterThan(0)
    for (const i of spots) {
      const p = track.point(i)
      expect(track.surfaceAt(p.x, p.z)).toBe('asphalt')
    }
  })
})
