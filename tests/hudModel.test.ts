import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { createKartState, type KartState } from '../src/sim/kart/kartState'
import { defaultItems, POWER_NAMES } from '../src/config/items'
import { createRacerItems } from '../src/sim/items/itemTypes'
import {
  buildHudModel,
  buildItemHudModel,
  chargeColor,
  eventPopupText,
  POWER_ICONS,
} from '../src/ui/hudModel'

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

describe('item hud model', () => {
  it('shows the empty slot and 0 uchuvas without items', () => {
    const items = buildItemHudModel()
    expect(items.hasPower).toBe(false)
    expect(items.uchuvaText).toBe(`0/${defaultItems.uchuvas.max}`)
    expect(items.blind).toBe(0)
  })

  it('shows the held power with its uses and the charged tag', () => {
    const racer = createRacerItems()
    racer.slot.power = 'mango'
    racer.slot.uses = 3
    racer.slot.charged = true
    const items = buildItemHudModel(racer)
    expect(items.name).toBe(POWER_NAMES.mango)
    expect(items.icon).toBe(POWER_ICONS.mango)
    expect(items.usesText).toBe('×3')
    expect(items.charged).toBe(true)
    racer.slot.uses = 1
    expect(buildItemHudModel(racer).usesText).toBe('')
  })

  it('cycles the roulette display and hides uses and charge while it spins', () => {
    const racer = createRacerItems()
    racer.slot.rouletteTime = 1
    racer.slot.rouletteShowing = 'coco'
    racer.slot.power = 'tejo'
    racer.slot.charged = true
    const items = buildItemHudModel(racer)
    expect(items.rolling).toBe(true)
    expect(items.name).toBe(POWER_NAMES.coco)
    expect(items.charged).toBe(false)
  })

  it('flags Bien Cargado at the uchuva maximum', () => {
    const racer = createRacerItems()
    racer.uchuvas = defaultItems.uchuvas.max - 1
    expect(buildItemHudModel(racer).uchuvaFull).toBe(false)
    racer.uchuvas = defaultItems.uchuvas.max
    const full = buildItemHudModel(racer)
    expect(full.uchuvaFull).toBe(true)
    expect(full.uchuvaText).toBe(`${defaultItems.uchuvas.max}/${defaultItems.uchuvas.max}`)
  })

  it('fades the mosquito overlay in with blind time', () => {
    const racer = createRacerItems()
    expect(buildItemHudModel(racer).blind).toBe(0)
    racer.status.blindTime = 0.1
    expect(buildItemHudModel(racer).blind).toBeCloseTo(0.2)
    racer.status.blindTime = 3
    expect(buildItemHudModel(racer).blind).toBe(1)
  })

  it('is part of the full hud model', () => {
    const racer = createRacerItems()
    racer.uchuvas = 4
    const full = buildHudModel(
      kart(),
      defaultKartPhysics,
      defaultDrift,
      undefined,
      undefined,
      racer,
    )
    expect(full.items.uchuvaText).toBe(`4/${defaultItems.uchuvas.max}`)
  })
})

describe('event popups', () => {
  const position = { x: 0, y: 0, z: 0 }

  it('only reports events about the player', () => {
    expect(eventPopupText({ type: 'hit', slot: 0, kind: 'spin', position }, 0)).toBe('¡Golpeado!')
    expect(eventPopupText({ type: 'hit', slot: 3, kind: 'spin', position }, 0)).toBeNull()
    expect(eventPopupText({ type: 'blocked', slot: 0, position }, 0)).toContain('escudo')
    expect(eventPopupText({ type: 'explosion', position, radius: 4 }, 0)).toBeNull()
  })

  it('reports stolen uchuvas for the victim and the thief', () => {
    expect(eventPopupText({ type: 'uchuvasStolen', from: 0, to: 2, amount: 3 }, 0)).toBe(
      '¡Te robaron 3 uchuvas!',
    )
    expect(eventPopupText({ type: 'uchuvasStolen', from: 2, to: 0, amount: 1 }, 0)).toBe(
      '¡Robaste 1 uchuva!',
    )
    expect(eventPopupText({ type: 'uchuvasStolen', from: 2, to: 3, amount: 3 }, 0)).toBeNull()
  })
})
