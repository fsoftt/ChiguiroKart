import { describe, expect, it } from 'vitest'
import { defaultKeyBindings } from '../src/config/controls'
import { applyDeadzone, gamepadToInput, type GamepadLike } from '../src/input/gamepad'
import { combineInputs, NEUTRAL_INPUT } from '../src/input/kartInput'
import { keysToInput } from '../src/input/keyboard'

function pad(axes: number[], pressed: Record<number, number> = {}): GamepadLike {
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => {
      const value = pressed[i] ?? 0
      return { pressed: value > 0.5, value }
    }),
  }
}

describe('keysToInput', () => {
  it('maps WASD and arrows', () => {
    const input = keysToInput(new Set(['KeyW', 'ArrowRight']), defaultKeyBindings)
    expect(input).toMatchObject({ throttle: 1, brake: 0, steer: 1 })
  })

  it('cancels opposite directions', () => {
    const input = keysToInput(new Set(['KeyA', 'KeyD']), defaultKeyBindings)
    expect(input.steer).toBe(0)
  })

  it('maps action buttons', () => {
    const input = keysToInput(new Set(['Space', 'ShiftLeft', 'KeyE', 'KeyQ']), defaultKeyBindings)
    expect(input).toMatchObject({ jump: true, boost: true, useItem: true, lookBack: true })
  })
})

describe('gamepadToInput', () => {
  it('uses the triggers as analog pedals', () => {
    const input = gamepadToInput(pad([0], { 7: 0.6, 6: 0.2 }))
    expect(input.throttle).toBeCloseTo(0.6)
    expect(input.brake).toBeCloseTo(0.2)
  })

  it('treats A as full throttle and the bumpers as jump and boost', () => {
    const input = gamepadToInput(pad([0], { 0: 1, 4: 1, 5: 1 }))
    expect(input).toMatchObject({ throttle: 1, boost: true, jump: true })
  })

  it('applies the stick deadzone', () => {
    expect(gamepadToInput(pad([0.1])).steer).toBe(0)
    expect(gamepadToInput(pad([-1])).steer).toBe(-1)
  })

  it('tolerates pads with missing axes or buttons', () => {
    expect(gamepadToInput({ axes: [], buttons: [] })).toEqual(NEUTRAL_INPUT)
  })
})

describe('applyDeadzone', () => {
  it('rescales the live range to start at zero', () => {
    expect(applyDeadzone(0.2, 0.2)).toBe(0)
    expect(applyDeadzone(0.6, 0.2)).toBeCloseTo(0.5)
    expect(applyDeadzone(-1, 0.2)).toBeCloseTo(-1)
  })
})

describe('combineInputs', () => {
  it('keeps the strongest analog values and ORs the buttons', () => {
    const combined = combineInputs([
      { ...NEUTRAL_INPUT, throttle: 0.4, steer: -0.3, jump: true },
      { ...NEUTRAL_INPUT, throttle: 1, steer: 0.8 },
    ])
    expect(combined).toMatchObject({ throttle: 1, steer: 0.8, jump: true, boost: false })
  })

  it('returns neutral input with no sources', () => {
    expect(combineInputs([])).toEqual(NEUTRAL_INPUT)
  })
})
