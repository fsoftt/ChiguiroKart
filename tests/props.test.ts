import { describe, expect, it } from 'vitest'
import type { PropKind } from '../src/config/tracks/environment'
import { DecorBuilder } from '../src/render/environment/decorBuilder'
import { PROP_RADIUS, type PropSpot } from '../src/render/environment/decorLayout'
import { addProps } from '../src/render/environment/decorView'

const kinds = Object.keys(PROP_RADIUS) as PropKind[]
/** Triangle budget of each prop (the grandstand carries a crowd). */
const BUDGET: Partial<Record<PropKind, number>> = { grandstand: 3200, carnivalStage: 1600 }

function build(kind: PropKind) {
  const b = new DecorBuilder()
  const spot: PropSpot = { kind, x: 0, z: 0, y: 0, yaw: 0 }
  addProps(b, [spot])
  return b.build()
}

describe('props', () => {
  it.each(kinds)('%s adds geometry inside its footprint', (kind) => {
    const geometry = build(kind)
    expect(geometry).not.toBeNull()
    if (!geometry) return
    const position = geometry.getAttribute('position')
    const radius = PROP_RADIUS[kind]
    let reach = 0
    let low = Infinity
    for (let i = 0; i < position.count; i++) {
      reach = Math.max(reach, Math.hypot(position.getX(i), position.getZ(i)))
      low = Math.min(low, position.getY(i))
    }
    expect(reach).toBeLessThanOrEqual(radius * 1.05 + 0.3)
    expect(low).toBeGreaterThanOrEqual(-1)
    expect(position.count / 3).toBeLessThanOrEqual(BUDGET[kind] ?? 1500)
  })
})
