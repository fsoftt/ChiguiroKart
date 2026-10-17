import { describe, expect, it } from 'vitest'
import { qualityProfiles, resolveQuality } from '../src/config/quality'
import { tracks } from '../src/config/tracks/catalog'
import { DEFAULT_SUN_DIRECTION, resolveLighting } from '../src/config/tracks/lighting'
import { DEFAULT_THEME, type TrackTheme } from '../src/config/tracks/theme'
import { lightAxes, snapFocusToTexelGrid, snapToGrid } from '../src/render/shadowMath'

type V3 = [number, number, number]

function unit(v: V3): V3 {
  const length = Math.hypot(...v)
  return [v[0] / length, v[1] / length, v[2] / length]
}

function dot(a: readonly number[], b: readonly number[]): number {
  return (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0)
}

describe('quality table: shadows and draw distance', () => {
  it('uses a 2048 map on high, 1024 on medium and no map on low', () => {
    expect(qualityProfiles.high.shadowMapSize).toBe(2048)
    expect(qualityProfiles.medium.shadowMapSize).toBe(1024)
    expect(qualityProfiles.low.shadowMapSize).toBe(0)
  })

  it('draws blob shadows only where the shadow map is off', () => {
    expect(qualityProfiles.low.blobShadows).toBe(true)
    expect(qualityProfiles.medium.blobShadows).toBe(false)
    expect(qualityProfiles.high.blobShadows).toBe(false)
  })

  it('shortens the fog and draw distance as quality drops', () => {
    expect(qualityProfiles.high.fogScale).toBe(1)
    expect(qualityProfiles.medium.fogScale).toBeLessThan(qualityProfiles.high.fogScale)
    expect(qualityProfiles.low.fogScale).toBeLessThan(qualityProfiles.medium.fogScale)
  })

  it('passes the new fields through resolveQuality', () => {
    const resolved = resolveQuality('medium', 1)
    expect(resolved.shadowMapSize).toBe(1024)
    expect(resolved.blobShadows).toBe(false)
    expect(resolved.fogScale).toBe(qualityProfiles.medium.fogScale)
  })
})

describe('theme lighting', () => {
  it('fills every default for a theme without the optional fields', () => {
    const bare: TrackTheme = { ...DEFAULT_THEME }
    delete bare.sunDirection
    delete bare.exposure
    delete bare.mountains
    delete bare.clouds
    const light = resolveLighting(bare)
    expect(light.exposure).toBe(1.2)
    expect(light.clouds).toBeGreaterThan(0)
    expect(light.mountains).not.toBeNull()
    expect(light.sunDirection[1]).toBeCloseTo(unit([...DEFAULT_SUN_DIRECTION] as V3)[1])
  })

  it.each(Object.values(tracks))('resolves a sane light for $id', (info) => {
    const light = resolveLighting(info.theme)
    const [x, y, z] = light.sunDirection
    expect(Math.hypot(x, y, z)).toBeCloseTo(1)
    // The sun is above the horizon on every track
    expect(y).toBeGreaterThan(0.2)
    expect(light.exposure).toBeGreaterThan(0.5)
    expect(light.exposure).toBeLessThan(2)
    expect(light.clouds).toBeGreaterThanOrEqual(0)
    expect(light.clouds).toBeLessThanOrEqual(1)
    if (info.theme.underground) {
      expect(light.mountains).toBeNull()
      expect(light.clouds).toBe(0)
    }
  })

  it('gives each track its own sun, not just the default', () => {
    const directions = new Set(
      Object.values(tracks).map((info) => resolveLighting(info.theme).sunDirection.join(',')),
    )
    expect(directions.size).toBeGreaterThan(6)
  })

  it('hides the horizon ring when the height is zero', () => {
    const flat = { ...DEFAULT_THEME, mountains: { color: '#fff', height: 0 } }
    expect(resolveLighting(flat).mountains).toBeNull()
  })
})

describe('shadow camera texel snapping', () => {
  it('snaps a value to the nearest cell', () => {
    expect(snapToGrid(0.26, 0.1)).toBeCloseTo(0.3)
    expect(snapToGrid(-0.26, 0.1)).toBeCloseTo(-0.3)
    expect(snapToGrid(5, 0)).toBe(5)
  })

  it('builds orthonormal light axes', () => {
    const dir = unit([0.3, 0.8, 0.5])
    const { right, up } = lightAxes(dir)
    expect(dot(right, right)).toBeCloseTo(1)
    expect(dot(up, up)).toBeCloseTo(1)
    expect(dot(right, up)).toBeCloseTo(0)
    expect(dot(right, dir)).toBeCloseTo(0)
    expect(dot(up, dir)).toBeCloseTo(0)
  })

  it('lands on texel multiples in light space and moves less than a texel', () => {
    const toSun = unit([0.5, 0.75, 0.4])
    const texel = 100 / 2048
    const focus: V3 = [12.345, 3.2, -48.77]
    const snapped = snapFocusToTexelGrid(focus, toSun, texel)
    const { right, up } = lightAxes(toSun)
    expect(dot(snapped, right) / texel).toBeCloseTo(Math.round(dot(snapped, right) / texel))
    expect(dot(snapped, up) / texel).toBeCloseTo(Math.round(dot(snapped, up) / texel))
    expect(Math.hypot(...snapped.map((v, i) => v - (focus[i] ?? 0)))).toBeLessThan(texel)
    // The offset along the light direction is untouched
    expect(dot(snapped, toSun)).toBeCloseTo(dot(focus, toSun))
  })

  it('keeps the same snapped point while the focus moves inside one texel', () => {
    const a = snapFocusToTexelGrid([10.1, 0, 20.1], [0, 1, 0], 0.5)
    const b = snapFocusToTexelGrid([10.2, 0, 20.2], [0, 1, 0], 0.5)
    expect(b[0]).toBeCloseTo(a[0])
    expect(b[2]).toBeCloseTo(a[2])
  })
})
