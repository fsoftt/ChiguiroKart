import { describe, expect, it } from 'vitest'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import {
  shouldShowTouchControls,
  steerFromPadX,
  touchToInput,
  TouchSource,
  type TouchButton,
  type TouchDetection,
} from '../src/input/touch'

const desktop: TouchDetection = {
  coarsePointer: false,
  finePointer: true,
  maxTouchPoints: 0,
  touchStarted: false,
}

describe('shouldShowTouchControls', () => {
  it('hides them on a desktop with a mouse', () => {
    expect(shouldShowTouchControls(desktop)).toBe(false)
  })

  it('hides them on a laptop with a touch screen and a trackpad', () => {
    expect(shouldShowTouchControls({ ...desktop, maxTouchPoints: 10 })).toBe(false)
  })

  it('shows them when the primary pointer is a finger', () => {
    expect(shouldShowTouchControls({ ...desktop, coarsePointer: true, finePointer: false })).toBe(
      true,
    )
  })

  it('shows them when touch points exist and there is no fine pointer', () => {
    expect(shouldShowTouchControls({ ...desktop, finePointer: false, maxTouchPoints: 5 })).toBe(
      true,
    )
  })

  it('shows them after the first touchstart even if detection said no', () => {
    expect(shouldShowTouchControls({ ...desktop, touchStarted: true })).toBe(true)
  })
})

describe('steerFromPadX', () => {
  // A pad from x=100 to x=300, center 200
  const steer = (x: number): number => steerFromPadX(x, 100, 200)

  it('is zero in the dead zone around the center', () => {
    expect(steer(200)).toBe(0)
    expect(steer(205)).toBe(0)
    expect(steer(195)).toBe(0)
  })

  it('steers left and right with the sign of the offset', () => {
    expect(steer(150)).toBeLessThan(0)
    expect(steer(250)).toBeGreaterThan(0)
  })

  it('grows with distance and saturates before the edge', () => {
    expect(steer(240)).toBeLessThan(steer(270))
    expect(steer(290)).toBe(1)
    expect(steer(100)).toBe(-1)
    expect(steer(-500)).toBe(-1)
    expect(steer(900)).toBe(1)
  })

  it('is zero for a pad without width', () => {
    expect(steerFromPadX(10, 0, 0)).toBe(0)
  })
})

describe('touchToInput', () => {
  it('is neutral with nothing pressed', () => {
    expect(touchToInput(new Set(), 0)).toEqual(NEUTRAL_INPUT)
  })

  it('maps each button to its KartInput field', () => {
    const pressed = new Set<TouchButton>(['throttle', 'jump', 'boost', 'useItem', 'lookBack'])
    expect(touchToInput(pressed, 0.5)).toEqual({
      throttle: 1,
      brake: 0,
      steer: 0.5,
      jump: true,
      boost: true,
      useItem: true,
      lookBack: true,
    })
    expect(touchToInput(new Set<TouchButton>(['brake']), -1)).toMatchObject({
      throttle: 0,
      brake: 1,
      steer: -1,
    })
  })

  it('clamps the steering', () => {
    expect(touchToInput(new Set(), 3).steer).toBe(1)
  })
})

describe('TouchSource', () => {
  it('tracks several fingers at once', () => {
    const source = new TouchSource()
    source.steer(1, -0.7)
    source.press(2, 'throttle')
    source.press(3, 'jump')
    expect(source.read()).toMatchObject({ throttle: 1, jump: true, steer: -0.7 })
    source.release(3)
    expect(source.read()).toMatchObject({ throttle: 1, jump: false, steer: -0.7 })
    source.release(1)
    source.release(2)
    expect(source.read()).toEqual(NEUTRAL_INPUT)
  })

  it('keeps a button down while another finger holds the same one', () => {
    const source = new TouchSource()
    source.press(1, 'throttle')
    source.press(2, 'throttle')
    source.release(1)
    expect(source.read().throttle).toBe(1)
  })

  it('ignores and forgets fingers while the controls are hidden', () => {
    let active = true
    const source = new TouchSource(() => active)
    source.press(1, 'throttle')
    active = false
    expect(source.read()).toEqual(NEUTRAL_INPUT)
    active = true
    expect(source.read()).toEqual(NEUTRAL_INPUT)
  })
})
