import { describe, expect, it } from 'vitest'
import { PORTRAIT, portraitFraming } from '../src/render/portraitFraming'

describe('portraitFraming', () => {
  it('stands in front of the head at the portrait distance, a bit above it', () => {
    const head = { x: 0.1, y: 1.4, z: -0.3 }
    const { position, target, fov } = portraitFraming(head)
    expect(Math.hypot(position.x - head.x, position.z - head.z)).toBeCloseTo(PORTRAIT.distance)
    expect(position.z).toBeGreaterThan(head.z)
    expect(position.x).toBeGreaterThan(head.x)
    expect(position.y).toBeGreaterThan(head.y)
    expect(target.y).toBeLessThan(head.y)
    expect(fov).toBe(PORTRAIT.fov)
  })

  it('rotates with the heading', () => {
    const a = portraitFraming({ x: 0, y: 1, z: 0 }, 0)
    const b = portraitFraming({ x: 0, y: 1, z: 0 }, Math.PI)
    expect(b.position.z).toBeLessThan(0)
    expect(a.position.z).toBeGreaterThan(0)
  })
})
