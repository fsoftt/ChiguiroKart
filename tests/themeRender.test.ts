import { describe, expect, it } from 'vitest'
import type { DecorationKind } from '../src/config/tracks/theme'
import { DEFAULT_THEME } from '../src/config/tracks/theme'
import { chevronQuads } from '../src/render/boostPads'
import { HazardView } from '../src/render/hazardView'
import { SCATTER_RULES, scatterDecorations } from '../src/render/scenery/scatter'
import { sceneryModel } from '../src/render/scenery/sceneryModels'
import { undergroundLook } from '../src/render/sky'
import { tideSurface } from '../src/render/tideLogic'
import type { HazardObstacle } from '../src/sim/hazards/hazardTypes'
import { Track } from '../src/sim/track'

const ring = Array.from({ length: 24 }, (_, i) => ({
  x: Math.cos((i / 24) * Math.PI * 2) * 100,
  z: Math.sin((i / 24) * Math.PI * 2) * 100,
}))
const track = new Track({
  name: 'ring',
  centerline: ring,
  halfWidth: 9,
  branches: [
    {
      name: 'cut',
      points: [
        { x: 100, z: 0 },
        { x: 0, z: 0 },
        { x: -100, z: 0 },
      ],
      halfWidth: 6,
      surface: 'dirt',
    },
  ],
  hazards: [
    { kind: 'herd', path: [{ x: 0, z: 0 }], motion: 'loop', speed: 4, count: 3, radius: 1.2 },
    { kind: 'iceWall', path: [{ x: 5, z: 5 }], motion: 'pingPong', speed: 0, count: 1, radius: 5 },
  ],
})

const kinds = Object.keys(SCATTER_RULES) as DecorationKind[]

describe('scatterDecorations', () => {
  it('is deterministic', () => {
    expect(scatterDecorations(track, 'tree', 40)).toEqual(scatterDecorations(track, 'tree', 40))
  })

  it('gives different spots to different kinds and sets', () => {
    const trees = scatterDecorations(track, 'tree', 10)
    expect(scatterDecorations(track, 'pine', 10)).not.toEqual(trees)
    expect(scatterDecorations(track, 'tree', 10, { setIndex: 1 })).not.toEqual(trees)
  })

  it.each(kinds)('keeps %s off every road, branches included', (kind) => {
    const items = scatterDecorations(track, kind, 30)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      const nearest = track.project(item.x, item.z)
      expect(nearest.distance - nearest.halfWidth).toBeGreaterThanOrEqual(
        SCATTER_RULES[kind].minGap,
      )
    }
  })

  it('keeps same-kind pieces apart', () => {
    const items = scatterDecorations(track, 'colonialHouse', 30)
    for (const [i, a] of items.entries()) {
      for (const b of items.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(
          SCATTER_RULES.colonialHouse.spacing,
        )
      }
    }
  })

  it('skips spots at or under the water level', () => {
    expect(scatterDecorations(track, 'tree', 20, { waterLevel: 0 })).toEqual([])
    expect(scatterDecorations(track, 'tree', 20, { waterLevel: -1 }).length).toBeGreaterThan(0)
  })

  it('turns houses toward the road and cannons away from it', () => {
    const [house] = scatterDecorations(track, 'colonialHouse', 1)
    const [cannon] = scatterDecorations(track, 'cannon', 1)
    if (!house || !cannon) throw new Error('nothing placed')
    for (const [item, sign] of [
      [house, -1],
      [cannon, 1],
    ] as const) {
      const normal = track.project(item.x, item.z).normal
      const dot = Math.sin(item.yaw) * normal.x + Math.cos(item.yaw) * normal.z
      expect(dot * sign).toBeCloseTo(1, 5)
    }
  })
})

describe('sceneryModel', () => {
  it.each(kinds)('builds %s with colored, lit geometry', (kind) => {
    const model = sceneryModel(kind)
    expect(model.parts.length).toBeGreaterThan(0)
    for (const part of model.parts) {
      expect(part.geometry.getAttribute('position').count).toBeGreaterThan(0)
      expect(part.geometry.getAttribute('color').count).toBe(
        part.geometry.getAttribute('position').count,
      )
      expect(part.geometry.getAttribute('normal')).toBeDefined()
    }
  })

  it('tints crystals and rocks per instance', () => {
    expect(sceneryModel('saltColumn').tints?.length).toBeGreaterThan(1)
    expect(sceneryModel('rock').tints?.length).toBeGreaterThan(1)
  })
})

describe('tideSurface', () => {
  const rule = { lowLaps: [2], lowSurface: 'sand', highSurface: 'water' } as const

  it('shows the sandbank at low tide and water at high tide', () => {
    expect(tideSurface(rule, true)).toBe('sand')
    expect(tideSurface(rule, false)).toBe('water')
  })
})

describe('chevronQuads', () => {
  it('spreads arrows along the strip, pointing forward', () => {
    const quads = chevronQuads(12, 8)
    expect(quads.length).toBe(8)
    for (const quad of quads) {
      const [tip, outer] = quad
      expect(tip?.[1]).toBeGreaterThan(outer?.[1] ?? 0)
      for (const [u, v] of quad) {
        expect(Math.abs(u)).toBeLessThanOrEqual(4)
        expect(Math.abs(v)).toBeLessThanOrEqual(7)
      }
    }
  })
})

describe('undergroundLook', () => {
  it('is dark, close and dim compared with the theme', () => {
    const look = undergroundLook(DEFAULT_THEME)
    expect(look.fogFar).toBeLessThan(DEFAULT_THEME.fogFar)
    expect(look.sunIntensity).toBeLessThan(DEFAULT_THEME.sunIntensity)
    expect(look.sky).not.toBe(DEFAULT_THEME.sky)
    const channels = look.horizon
      .slice(1)
      .match(/../g)
      ?.map((c) => parseInt(c, 16))
    expect(Math.max(...(channels ?? [255]))).toBeLessThan(75)
  })
})

describe('HazardView', () => {
  const base = { hazard: 0, radius: 1.2, heading: 0.5, active: true, moving: true }
  const at = { x: 3, y: 0, z: 4 }
  const obstacles = (wallActive: boolean): HazardObstacle[] => [
    { ...base, kind: 'herd', position: at },
    { ...base, kind: 'herd', position: { ...at, x: 6 } },
    { ...base, hazard: 1, kind: 'iceWall', position: at, radius: 5, active: wallActive },
  ]

  it('draws only the obstacles that exist and are active', () => {
    const view = new HazardView(track)
    view.update(obstacles(true), 0)
    const counts = (): number[] => view.object.children.map((m) => (m as { count: number }).count)
    expect(Math.max(...counts())).toBe(2)
    expect(counts()).toContain(1)
    view.update(obstacles(false), 0.016)
    expect(counts()).not.toContain(1)
  })

  it('makes shards when an ice wall breaks, then lets them fade', () => {
    const view = new HazardView(track)
    const shards = (): number =>
      Math.max(...view.object.children.map((m) => (m as { count: number }).count))
    view.update(obstacles(true), 0)
    view.update(obstacles(false), 0.016)
    expect(shards()).toBeGreaterThan(2)
    for (let t = 0.1; t < 2; t += 0.1) view.update(obstacles(false), t)
    expect(shards()).toBe(2)
  })
})
