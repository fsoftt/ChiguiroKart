import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { createKartState, type KartState } from '../src/sim/kart/kartState'
import { buildHudModel, chargeColor } from '../src/ui/hudModel'

function kart(): KartState {
  return createKartState({ x: 0, y: 0, z: 0 }, 0)
}

function model(state: KartState) {
  return buildHudModel(state, defaultKartPhysics, defaultDrift)
}

describe('hud model', () => {
  it('converts forward speed to whole km/h and never goes negative', () => {
    const state = kart()
    // Heading 0 faces +z in this sim; speed along the forward axis is what counts.
    state.velocity.z = 10
    const forward = model(state)
    expect(forward.speedKmh).toBe(36)
    state.velocity.z = -5
    expect(model(state).speedKmh).toBe(0)
    expect(forward.speedRatio).toBeCloseTo(10 / defaultKartPhysics.maxSpeed)
  })

  it('hides the drift bar when not drifting and shows it otherwise', () => {
    const state = kart()
    expect(model(state).barVisible).toBe(false)
    state.drift.direction = -1
    expect(model(state).barVisible).toBe(true)
  })

  it('colors the bar along the smoke gradient and red inside the red zone', () => {
    const colors = defaultDrift.smokeColors
    expect(chargeColor(0, false, defaultDrift)).toBe(colors[0])
    expect(chargeColor(defaultDrift.redZoneStart, false, defaultDrift)).toBe(colors.at(-1))
    expect(chargeColor(1, false, defaultDrift)).toBe(colors.at(-1))
    const mid = chargeColor(defaultDrift.redZoneStart / 6, false, defaultDrift)
    expect(mid).toBe('#ddc77d')
  })

  it('uses the broken color when the chain is broken', () => {
    const state = kart()
    state.drift.direction = 1
    state.drift.charge = 0.5
    state.drift.chainBroken = true
    const hud = model(state)
    expect(hud.barColor).toBe(defaultDrift.brokenSmokeColor)
    expect(hud.chainBroken).toBe(true)
  })

  it('exposes fill clamped to 0..1 and the red zone start', () => {
    const state = kart()
    state.drift.charge = 1.4
    const hud = model(state)
    expect(hud.fill).toBe(1)
    expect(hud.redZoneStart).toBe(defaultDrift.redZoneStart)
  })

  it('fills pips by nitros in chain with their level colors', () => {
    const state = kart()
    expect(model(state).pips.map((pip) => pip.filled)).toEqual([false, false, false])
    state.drift.nitrosInChain = 2
    const pips = model(state).pips
    expect(pips.map((pip) => pip.filled)).toEqual([true, true, false])
    expect(pips[0].color).toBe(defaultDrift.levels[0].color)
    expect(pips[1].color).toBe(defaultDrift.levels[1].color)
    expect(pips[2].color).toBe('')
    state.drift.nitrosInChain = 3
    expect(model(state).pips[2].color).toBe(defaultDrift.levels[2].color)
  })

  it('labels the active nitro with its color and time fraction', () => {
    const state = kart()
    expect(model(state).nitroLabel).toBe('')
    state.boost.level = 2
    state.boost.timeLeft = defaultDrift.maxReserve / 2
    const hud = model(state)
    expect(hud.nitroLabel).toBe('NITRO 2')
    expect(hud.nitroColor).toBe(defaultDrift.levels[1].color)
    expect(hud.nitroTimeFraction).toBeCloseTo(0.5)
    state.boost.timeLeft = defaultDrift.maxReserve * 2
    expect(model(state).nitroTimeFraction).toBe(1)
  })

  it('flags perfect only while a nitro is active', () => {
    const state = kart()
    state.boost.perfect = true
    expect(model(state).perfect).toBe(false)
    state.boost.level = 1
    expect(model(state).perfect).toBe(true)
  })
})
