import { describe, expect, it } from 'vitest'
import { PauseState, canPause, risingEdge } from '../src/game/pause'
import { ParticleRing } from '../src/render/effects/particleRing'
import { FixedStep } from '../src/sim/fixedStep'

const RACING = { racing: true, finished: false, locked: false }

describe('canPause', () => {
  it('only allows pausing during a live race', () => {
    expect(canPause(RACING)).toBe(true)
    expect(canPause({ ...RACING, racing: false })).toBe(false)
    expect(canPause({ ...RACING, finished: true })).toBe(false)
    expect(canPause({ ...RACING, locked: true })).toBe(false)
  })
})

describe('PauseState', () => {
  it('ignores a pause request outside a race', () => {
    const pause = new PauseState()
    expect(pause.pause({ ...RACING, racing: false })).toBe(false)
    expect(pause.isPaused).toBe(false)
  })

  it('gives no time while paused and full time after resuming', () => {
    const pause = new PauseState()
    expect(pause.frameSeconds(0.016)).toBe(0.016)
    pause.pause(RACING)
    expect(pause.frameSeconds(0.016)).toBe(0)
    pause.resume()
    expect(pause.frameSeconds(0.016)).toBe(0.016)
  })

  it('does not advance the fixed-step sim during a long pause or catch up after it', () => {
    const pause = new PauseState()
    const fixed = new FixedStep(1 / 60)
    let steps = 0
    const frame = (dt: number): void => {
      // Same shape as the game loop: a paused frame never reaches the fixed step
      if (!pause.isPaused) fixed.advance(pause.frameSeconds(dt), () => steps++)
    }
    for (let i = 0; i < 60; i++) frame(1 / 60)
    expect(steps).toBe(60)
    pause.pause(RACING)
    for (let i = 0; i < 600; i++) frame(1 / 60)
    expect(steps).toBe(60)
    pause.resume()
    frame(1 / 60)
    expect(steps).toBe(61)
  })
})

describe('risingEdge', () => {
  it('fires once per press', () => {
    expect(risingEdge(false, true)).toBe(true)
    expect(risingEdge(true, true)).toBe(false)
    expect(risingEdge(true, false)).toBe(false)
  })
})

describe('ParticleRing.setShare', () => {
  const color = { r: 1, g: 1, b: 1 }
  const spawn = (ring: ParticleRing): void => {
    ring.spawn({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10, 1, 1, color, 1)
  }

  it('limits how many particles can be alive', () => {
    const ring = new ParticleRing(100, 0)
    ring.setShare(0.5)
    for (let i = 0; i < 100; i++) spawn(ring)
    expect(ring.aliveCount).toBe(50)
  })

  it('kills the slots it gives up and can grow back', () => {
    const ring = new ParticleRing(100, 0)
    for (let i = 0; i < 100; i++) spawn(ring)
    ring.setShare(0.25)
    expect(ring.aliveCount).toBe(25)
    ring.setShare(1)
    for (let i = 0; i < 100; i++) spawn(ring)
    expect(ring.aliveCount).toBe(100)
  })
})
