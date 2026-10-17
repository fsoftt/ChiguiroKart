import { describe, expect, it } from 'vitest'
import {
  createSuspensionState,
  stepSuspension,
  suspensionConfig,
  type SuspensionInput,
  type SuspensionState,
} from '../src/render/kartSuspension'
import { WHEEL_RADIUS } from '../src/render/characters/rig'

const DT = 1 / 60

const rest: SuspensionInput = {
  onGround: true,
  verticalSpeed: 0,
  forwardSpeed: 0,
  steer: 0,
  driftDirection: 0,
  speedRatio: 0,
}

function run(state: SuspensionState, input: SuspensionInput, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepSuspension(state, input, DT)
}

function fall(state: SuspensionState, speed: number): void {
  stepSuspension(state, { ...rest, onGround: false, verticalSpeed: -speed }, DT)
  stepSuspension(state, rest, DT)
}

describe('stepSuspension', () => {
  it('stays still at rest', () => {
    const state = createSuspensionState()
    run(state, rest, 1)
    const { pose } = state
    expect(pose.offsetY).toBe(0)
    expect(pose.pitch).toBe(0)
    expect(pose.scaleY).toBe(1)
    expect(pose.scaleXZ).toBe(1)
  })

  it('compresses on landing, then settles back to rest', () => {
    const state = createSuspensionState()
    fall(state, 12)
    let lowest = 0
    for (let t = 0; t < 0.5; t += DT) {
      stepSuspension(state, rest, DT)
      lowest = Math.min(lowest, state.pose.offsetY)
    }
    expect(lowest).toBeLessThan(-0.03)
    expect(lowest).toBeGreaterThanOrEqual(-suspensionConfig.maxOffset)
    run(state, rest, 4)
    expect(Math.abs(state.pose.offsetY)).toBeLessThan(1e-3)
    expect(Math.abs(state.pose.pitch)).toBeLessThan(1e-3)
  })

  it('squashes the chassis when compressed and keeps its volume roughly', () => {
    const state = createSuspensionState()
    fall(state, 12)
    let minScaleY = 1
    let wideAtMin = 1
    for (let t = 0; t < 0.5; t += DT) {
      stepSuspension(state, rest, DT)
      if (state.pose.scaleY < minScaleY) {
        minScaleY = state.pose.scaleY
        wideAtMin = state.pose.scaleXZ
      }
    }
    expect(minScaleY).toBeLessThan(1)
    expect(wideAtMin).toBeGreaterThan(1)
    expect(minScaleY * wideAtMin * wideAtMin).toBeCloseTo(1)
  })

  it('lands harder from higher falls', () => {
    const lowest = (speed: number): number => {
      const state = createSuspensionState()
      fall(state, speed)
      let min = 0
      for (let t = 0; t < 0.5; t += DT) {
        stepSuspension(state, rest, DT)
        min = Math.min(min, state.pose.offsetY)
      }
      return min
    }
    expect(lowest(15)).toBeLessThan(lowest(5))
  })

  it('pitches the nose up when speeding up and down when braking', () => {
    const accelerating = createSuspensionState()
    let speed = 0
    for (let i = 0; i < 20; i++) {
      speed += 20 * DT
      stepSuspension(accelerating, { ...rest, forwardSpeed: speed }, DT)
    }
    expect(accelerating.pose.pitch).toBeLessThan(0)

    const braking = createSuspensionState()
    speed = 30
    for (let i = 0; i < 20; i++) {
      speed -= 25 * DT
      stepSuspension(braking, { ...rest, forwardSpeed: speed }, DT)
    }
    expect(braking.pose.pitch).toBeGreaterThan(0)
  })

  it('hops when speed drops suddenly against a wall', () => {
    const state = createSuspensionState()
    run(state, { ...rest, forwardSpeed: 30 }, 0.5)
    stepSuspension(state, { ...rest, forwardSpeed: 12 }, DT)
    let highest = 0
    for (let t = 0; t < 0.3; t += DT) {
      stepSuspension(state, { ...rest, forwardSpeed: 12 }, DT)
      highest = Math.max(highest, state.pose.offsetY)
    }
    expect(highest).toBeGreaterThan(0.02)
  })

  it('leans out of turns and into drifts', () => {
    const turning = createSuspensionState()
    run(turning, { ...rest, steer: 1, speedRatio: 1, forwardSpeed: 20 }, 1)
    expect(turning.pose.roll).toBeLessThan(0)
    const drifting = createSuspensionState()
    run(drifting, { ...rest, driftDirection: 1, speedRatio: 1, forwardSpeed: 20 }, 1)
    expect(drifting.pose.roll).toBeGreaterThan(0)
  })

  it('spins the wheels with the speed and turns the front ones with the steer', () => {
    const state = createSuspensionState()
    stepSuspension(state, { ...rest, forwardSpeed: WHEEL_RADIUS * 2, steer: 1 }, 0.1)
    expect(state.pose.wheelSpin).toBeCloseTo(0.2)
    run(state, { ...rest, steer: 1 }, 1)
    expect(state.pose.steerAngle).toBeCloseTo(-suspensionConfig.maxWheelSteer, 1)
  })

  it('never produces NaN, even with no time passing or a huge frame', () => {
    const state = createSuspensionState()
    const busy: SuspensionInput = { ...rest, forwardSpeed: 25, steer: 0.5, speedRatio: 0.8 }
    stepSuspension(state, busy, 0)
    stepSuspension(state, { ...busy, onGround: false, verticalSpeed: -9 }, 0)
    stepSuspension(state, busy, 0)
    stepSuspension(state, busy, 2)
    for (const value of Object.values(state.pose)) expect(Number.isFinite(value)).toBe(true)
    expect(Math.abs(state.pose.offsetY)).toBeLessThanOrEqual(suspensionConfig.maxOffset)
  })
})
