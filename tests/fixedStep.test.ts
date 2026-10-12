import { describe, expect, it } from 'vitest'
import { FixedStep } from '../src/sim/fixedStep'

const STEP = 1 / 60

function countSteps(fixedStep: FixedStep, frames: number[]): number {
  let steps = 0
  for (const frame of frames) fixedStep.advance(frame, () => steps++)
  return steps
}

describe('FixedStep', () => {
  it('runs one step per step-length of elapsed time', () => {
    expect(countSteps(new FixedStep(STEP), [STEP, STEP, STEP])).toBe(3)
  })

  it('carries leftover time to later frames', () => {
    expect(countSteps(new FixedStep(STEP), [STEP / 2, STEP / 2])).toBe(1)
  })

  it('returns how far into the next step the leftover is', () => {
    const alpha = new FixedStep(STEP).advance(STEP * 1.25, () => undefined)
    expect(alpha).toBeCloseTo(0.25)
  })

  it('clamps long frames to avoid a spiral of death', () => {
    expect(countSteps(new FixedStep(STEP, 0.1), [5])).toBe(6)
  })

  it('ignores negative frame times', () => {
    expect(countSteps(new FixedStep(STEP), [-1])).toBe(0)
  })

  it('passes the fixed step length to the callback', () => {
    const seen: number[] = []
    new FixedStep(STEP).advance(STEP * 2, (dt) => seen.push(dt))
    expect(seen).toEqual([STEP, STEP])
  })
})
