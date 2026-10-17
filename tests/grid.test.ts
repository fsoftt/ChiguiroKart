import { describe, expect, it } from 'vitest'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
import { defaultGrid } from '../src/config/grid'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { forwardOf } from '../src/sim/math'
import { createRacer, gridPose, resetRacer } from '../src/sim/racer'
import { Track, type TrackDefinition } from '../src/sim/track'

const definition: TrackDefinition = {
  name: 'long start straight',
  centerline: [
    { x: 0, z: 0 },
    { x: 200, z: 0 },
    { x: 200, z: 200 },
    { x: -200, z: 200 },
    { x: -200, z: -0.001 },
  ],
  halfWidth: 9,
  checkpoints: [],
}
const track = new Track(definition)

describe('starting grid', () => {
  it('gives every slot a distinct pose that does not overlap the others', () => {
    const poses = Array.from({ length: 8 }, (_, slot) => gridPose(track, slot))
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const a = poses[i]?.position ?? { x: 0, z: 0 }
        const b = poses[j]?.position ?? { x: 0, z: 0 }
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(defaultKartPhysics.kartRadius * 2)
      }
    }
  })

  it('keeps every slot on the track, behind or on the start line, facing the start heading', () => {
    const start = track.startPose()
    const forward = forwardOf(start.heading)
    for (let slot = 0; slot < 8; slot++) {
      const pose = gridPose(track, slot)
      const along =
        (pose.position.x - start.position.x) * forward.x +
        (pose.position.z - start.position.z) * forward.z
      expect(along).toBeLessThanOrEqual(1e-9)
      expect(pose.heading).toBe(start.heading)
      expect(track.project(pose.position.x, pose.position.z).distance).toBeLessThan(
        track.halfWidth - defaultKartPhysics.radius,
      )
    }
  })

  it('places two karts per row and rows further back', () => {
    const start = track.startPose()
    const forward = forwardOf(start.heading)
    const back = (slot: number): number => {
      const p = gridPose(track, slot).position
      return -((p.x - start.position.x) * forward.x + (p.z - start.position.z) * forward.z)
    }
    expect(back(0)).toBeCloseTo(0)
    expect(back(2)).toBeCloseTo(defaultGrid.rowSpacing)
    expect(back(4)).toBeGreaterThan(back(2))
    expect(back(1)).toBeCloseTo(defaultGrid.stagger)
  })

  it('stores the slot in the racer and reset returns to it', () => {
    const racer = createRacer(track, undefined, 3)
    const pose = gridPose(track, 3)
    expect(racer.slot).toBe(3)
    expect(racer.kart.position).toEqual(pose.position)

    racer.kart.position.x += 20
    racer.kart.velocity.z = 5
    resetRacer(racer, track)
    expect(racer.kart.position).toEqual(pose.position)
    expect(racer.kart.velocity).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('fits an 8-kart grid on the Cocora track', () => {
    const cocora = new Track(cocoraTrack)
    for (let slot = 0; slot < 8; slot++) {
      const { position } = gridPose(cocora, slot)
      expect(cocora.project(position.x, position.z).distance).toBeLessThan(
        cocora.halfWidth - defaultKartPhysics.radius,
      )
    }
  })

  it('defaults the racer to slot 0', () => {
    expect(createRacer(track).slot).toBe(0)
  })
})
