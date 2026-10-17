import { describe, expect, it } from 'vitest'
import {
  bobOffset,
  cycleHue,
  explosionRadius,
  fadeOut,
  hitPoseInto,
  lifeProgress,
  orbitOffset,
} from '../src/render/items/itemViewLogic'

describe('item view logic', () => {
  it('maps the hit kind to yaw or pitch', () => {
    const out = { yaw: 9, pitch: 9 }
    expect(hitPoseInto({ hit: null, spinAngle: 2 }, out)).toEqual({ yaw: 0, pitch: 0 })
    expect(hitPoseInto({ hit: 'spin', spinAngle: 2 }, out)).toEqual({ yaw: 2, pitch: 0 })
    expect(hitPoseInto({ hit: 'flip', spinAngle: 2 }, out)).toEqual({ yaw: 0, pitch: 2 })
  })

  it('clamps life progress and fades from 1 to 0', () => {
    expect(lifeProgress(-1, 2)).toBe(0)
    expect(lifeProgress(1, 2)).toBe(0.5)
    expect(lifeProgress(5, 2)).toBe(1)
    expect(fadeOut(0)).toBe(1)
    expect(fadeOut(1)).toBe(0)
  })

  it('grows the explosion up to its radius', () => {
    expect(explosionRadius(0, 4)).toBeLessThan(0.1)
    expect(explosionRadius(1, 4)).toBeCloseTo(4)
    expect(explosionRadius(0.5, 4)).toBeGreaterThan(2)
  })

  it('keeps the hue in 0..1 and bobbing within its amplitude', () => {
    for (const time of [-3, 0, 0.4, 7.9]) {
      const hue = cycleHue(time, 0.35)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(1)
      expect(Math.abs(bobOffset(time, 1, 0.2, 2))).toBeLessThanOrEqual(0.2)
    }
  })

  it('orbits swarm dots at the given radius', () => {
    const out = { x: 0, y: 0, z: 0 }
    orbitOffset(2, 8, 1.3, 1.5, out)
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1.5)
  })
})
