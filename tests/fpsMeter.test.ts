import { describe, expect, it } from 'vitest'
import { FpsMeter } from '../src/ui/fpsMeter'

describe('FpsMeter', () => {
  it('reports 0 before any frame', () => {
    expect(new FpsMeter().fps).toBe(0)
  })

  it('averages the recorded frames', () => {
    const meter = new FpsMeter()
    meter.addFrame(1 / 60)
    meter.addFrame(1 / 30)
    expect(meter.fps).toBeCloseTo(40)
  })

  it('keeps only the last windowSize frames', () => {
    const meter = new FpsMeter(2)
    meter.addFrame(1)
    meter.addFrame(1 / 60)
    meter.addFrame(1 / 60)
    expect(meter.fps).toBeCloseTo(60)
  })

  it('ignores non-positive deltas', () => {
    const meter = new FpsMeter()
    meter.addFrame(0)
    meter.addFrame(-1)
    expect(meter.fps).toBe(0)
  })

  it('rejects an empty window', () => {
    expect(() => new FpsMeter(0)).toThrow(RangeError)
  })
})
