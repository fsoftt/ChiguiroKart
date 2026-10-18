import { describe, expect, it } from 'vitest'
import {
  DynamicResolution,
  FAST_SECONDS,
  MIN_PIXEL_RATIO,
  SETTLE_SECONDS,
  SLOW_SECONDS,
} from '../src/render/dynamicResolution'

/** Feeds frames of `ms` for `seconds`; returns the last ratio change, if any. */
function run(controller: DynamicResolution, ms: number, seconds: number): number | null {
  let change: number | null = null
  for (let t = 0; t < seconds; t += ms / 1000) {
    change = controller.update(ms / 1000) ?? change
  }
  return change
}

/** Skips the settle period that follows a change or a reset. */
function settle(controller: DynamicResolution): void {
  run(controller, 16, SETTLE_SECONDS + 0.1)
}

describe('DynamicResolution', () => {
  it('starts at the preset ratio and does nothing while frames are fine', () => {
    const controller = new DynamicResolution(1.5)
    expect(controller.pixelRatio).toBe(1.5)
    expect(run(controller, 25, 20)).toBeNull()
    expect(controller.pixelRatio).toBe(1.5)
  })

  it('lowers the ratio stepwise when frames stay over 33 ms for a few seconds', () => {
    const controller = new DynamicResolution(1.5)
    settle(controller)
    expect(run(controller, 40, SLOW_SECONDS - 0.5)).toBeNull()
    expect(run(controller, 40, 1.5)).toBe(1.25)
    settle(controller)
    expect(run(controller, 40, SLOW_SECONDS + 0.5)).toBe(1)
  })

  it('never goes below 0.75', () => {
    const controller = new DynamicResolution(1)
    for (let i = 0; i < 10; i++) {
      settle(controller)
      run(controller, 50, SLOW_SECONDS + 1)
    }
    expect(controller.pixelRatio).toBe(MIN_PIXEL_RATIO)
    expect(MIN_PIXEL_RATIO).toBe(0.75)
  })

  it('ignores a short spike and pauses', () => {
    const controller = new DynamicResolution(1.5)
    settle(controller)
    run(controller, 16, 2)
    run(controller, 100, 0.4)
    expect(run(controller, 16, 5)).toBeNull()
    // A paused game (dt 0) and a hidden tab (long frame) are not slow frames
    for (let i = 0; i < 500; i++) controller.update(0)
    for (let i = 0; i < 20; i++) controller.update(2)
    expect(controller.pixelRatio).toBe(1.5)
  })

  it('raises the ratio back with headroom but never above the preset', () => {
    const controller = new DynamicResolution(1.5)
    settle(controller)
    run(controller, 45, SLOW_SECONDS + 1)
    expect(controller.pixelRatio).toBe(1.25)
    settle(controller)
    expect(run(controller, 14, FAST_SECONDS - 1)).toBeNull()
    expect(run(controller, 14, 2)).toBe(1.5)
    settle(controller)
    expect(run(controller, 14, 30)).toBeNull()
    expect(controller.pixelRatio).toBe(1.5)
  })

  it('waits longer to sharpen again after a raise that did not hold', () => {
    const controller = new DynamicResolution(1.25)
    settle(controller)
    run(controller, 45, SLOW_SECONDS + 1)
    expect(controller.pixelRatio).toBe(1)
    settle(controller)
    run(controller, 14, FAST_SECONDS + 1)
    expect(controller.pixelRatio).toBe(1.25)
    // Too heavy again: back down, and the next raise needs twice the headroom
    settle(controller)
    run(controller, 45, SLOW_SECONDS + 1)
    expect(controller.pixelRatio).toBe(1)
    settle(controller)
    expect(run(controller, 14, FAST_SECONDS + 1)).toBeNull()
    expect(run(controller, 14, FAST_SECONDS + 1)).toBe(1.25)
  })

  it('starts again from the new ceiling when the quality changes', () => {
    const controller = new DynamicResolution(1.5)
    settle(controller)
    run(controller, 45, SLOW_SECONDS + 1)
    controller.setCeiling(1)
    expect(controller.pixelRatio).toBe(1)
    expect(controller.ceiling).toBe(1)
    controller.setCeiling(0.5)
    expect(controller.pixelRatio).toBe(MIN_PIXEL_RATIO)
  })
})
