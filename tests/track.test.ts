import { describe, expect, it } from 'vitest'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { testTrack } from '../src/config/tracks/testTrack'
import { createKartState } from '../src/sim/kart/kartState'
import { resolveTrackCollision } from '../src/sim/kart/trackCollision'
import { forwardOf } from '../src/sim/math'
import { Track } from '../src/sim/track'

/** Square loop 100 m a side, centered on the origin, driven counter-clockwise. */
const square = new Track({
  name: 'square',
  centerline: [
    { x: -50, z: -50 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
    { x: -50, z: 50 },
  ],
  halfWidth: 5,
})
const config = defaultKartPhysics
const DT = 1 / 60

describe('Track', () => {
  it('rejects loops with fewer than 3 points', () => {
    expect(() => new Track({ name: 'bad', centerline: [{ x: 0, z: 0 }], halfWidth: 5 })).toThrow()
  })

  it('wraps point indexes in both directions', () => {
    expect(square.point(4)).toEqual(square.point(0))
    expect(square.point(-1)).toEqual(square.point(3))
  })

  it('projects onto the closest segment, including the closing one', () => {
    const projection = square.project(-53, 0)
    expect(projection.closest).toEqual({ x: -50, z: 0 })
    expect(projection.distance).toBeCloseTo(3)
    expect(projection.normal).toEqual({ x: -1, z: 0 })
  })

  it('starts on the first point facing the second', () => {
    const { position, heading } = square.startPose()
    expect(position).toEqual({ x: -50, y: 0, z: -50 })
    const forward = forwardOf(heading)
    expect(forward.x).toBeCloseTo(1)
    expect(forward.z).toBeCloseTo(0)
  })

  it('builds the test track as a valid loop', () => {
    const track = new Track(testTrack)
    expect(track.centerline.length).toBeGreaterThan(100)
    expect(track.project(track.point(0).x, track.point(0).z).distance).toBe(0)
  })
})

describe('resolveTrackCollision', () => {
  it('leaves a kart inside the road alone', () => {
    const kart = createKartState({ x: 0, y: 0, z: -50 }, 0)
    expect(resolveTrackCollision(kart, square, config, DT)).toBe(false)
  })

  it('pushes a kart back inside and bounces it off the wall', () => {
    const kart = createKartState({ x: 0, y: 0, z: -60 }, 0)
    kart.velocity = { x: 10, y: 0, z: -20 }

    expect(resolveTrackCollision(kart, square, config, DT)).toBe(true)
    expect(kart.position.z).toBeCloseTo(-50 - (square.halfWidth - config.radius))
    // Into-wall speed reversed and reduced, along-wall speed scrubbed by the impact
    expect(kart.velocity.z).toBeCloseTo(20 * config.wallBounce)
    expect(kart.velocity.x).toBeCloseTo(Math.max(0, 10 - config.wallFriction * 20))
  })

  it('keeps most of the speed when scraping along a wall', () => {
    const kart = createKartState({ x: 0, y: 0, z: -60 }, 0)
    kart.velocity = { x: 20, y: 0, z: -0.5 }
    for (let i = 0; i < 60; i++) resolveTrackCollision(kart, square, config, DT)
    expect(kart.velocity.x).toBeGreaterThan(19)
  })

  it('turns a kart that scrapes the wall to run along it', () => {
    // Bottom edge runs along +x; the kart points mostly +x and a bit toward the wall (-z)
    const kart = createKartState({ x: 0, y: 0, z: -60 }, Math.PI / 2 + 0.4)
    for (let i = 0; i < 60; i++) {
      kart.position.z = -60
      resolveTrackCollision(kart, square, config, DT)
    }
    expect(kart.heading).toBeCloseTo(Math.PI / 2, 2)
  })

  it('does not align on a head-on hit', () => {
    const kart = createKartState({ x: 0, y: 0, z: -60 }, Math.PI)
    resolveTrackCollision(kart, square, config, DT)
    expect(kart.heading).toBe(Math.PI)
  })

  it('does not bounce a kart already moving away from the wall', () => {
    const kart = createKartState({ x: 0, y: 0, z: -60 }, 0)
    kart.velocity = { x: 0, y: 0, z: 5 }
    resolveTrackCollision(kart, square, config, DT)
    expect(kart.velocity.z).toBe(5)
  })
})

describe('Track branches', () => {
  /** Square loop with a straight shortcut through the middle, from (50,0) to (-50,0). */
  const withBranch = new Track({
    name: 'square with shortcut',
    centerline: [
      { x: -50, z: -50 },
      { x: 50, z: -50 },
      { x: 50, z: 50 },
      { x: -50, z: 50 },
    ],
    halfWidth: 5,
    branches: [
      {
        name: 'cut',
        points: [
          { x: 50, z: 0 },
          { x: 0, z: 0 },
          { x: -50, z: 0 },
        ],
        halfWidth: 3,
        surface: 'mud',
      },
    ],
  })

  it('has no branches by default', () => {
    expect(square.branches).toEqual([])
    expect(square.project(0, -50).branch).toBe(-1)
  })

  it('projects onto the branch when it is the piece the point is most inside of', () => {
    const projection = withBranch.project(0, 2)
    expect(projection.branch).toBe(0)
    expect(projection.halfWidth).toBe(3)
    expect(projection.distance).toBeCloseTo(2)
    expect(projection.closest).toEqual({ x: 0, z: 0 })
    expect(projection.normal).toEqual({ x: 0, z: 1 })
    expect(withBranch.project(0, -48).branch).toBe(-1)
  })

  it('treats the union of main and branch corridors as drivable', () => {
    const drivable = (x: number, z: number) => {
      const p = withBranch.project(x, z)
      return p.distance <= p.halfWidth
    }
    expect(drivable(0, 2.5)).toBe(true) // inside branch only
    expect(drivable(0, -48)).toBe(true) // inside main only
    expect(drivable(0, 4)).toBe(false) // outside both
    expect(withBranch.mainProjection(0, 2.5).distance).toBeGreaterThan(withBranch.halfWidth)
  })

  it('does not close the branch back from its last point to its first', () => {
    const open = new Track({
      name: 'open',
      centerline: [
        { x: -50, z: -50 },
        { x: 50, z: -50 },
        { x: 50, z: 50 },
        { x: -50, z: 50 },
      ],
      halfWidth: 5,
      branches: [
        {
          name: 'l',
          points: [
            { x: 0, z: 0 },
            { x: 20, z: 0 },
            { x: 20, z: 20 },
          ],
          halfWidth: 3,
          surface: 'dirt',
        },
      ],
    })
    // Midpoint of the would-be closing segment (20,20)-(0,0) is not on the branch
    expect(open.surfaceAt(10, 10)).toBe('grass')
  })

  it('reports the branch surface by default and asphalt on the main road', () => {
    expect(withBranch.surfaceAt(0, 1)).toBe('mud')
    expect(withBranch.surfaceAt(0, -50)).toBe('asphalt')
    expect(withBranch.surfaceAt(0, 20)).toBe('grass')
  })

  it('collides with the branch walls using the branch half-width', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.position.z = 10
    // Position (0, 10) is outside both corridors; the nearest piece is the branch
    const hit = resolveTrackCollision(kart, withBranch, config, DT)
    expect(hit).toBe(true)
    expect(kart.position.z).toBeCloseTo(3 - config.radius)
  })

  it('lets a kart drive through the branch mouth in the main wall', () => {
    const kart = createKartState({ x: 40, y: 0, z: 0 }, 0)
    expect(resolveTrackCollision(kart, withBranch, config, DT)).toBe(false)
    expect(kart.position.x).toBe(40)
  })
})
