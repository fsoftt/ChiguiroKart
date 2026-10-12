import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { defaultEffects } from '../src/config/effects'
import {
  createSmokePalette,
  detectChainBreak,
  detectNitroStart,
  hexToRgb,
  smokeColorAt,
  speedLineTarget,
  type Rgb,
} from '../src/render/effects/effectsLogic'

const out: Rgb = { r: 0, g: 0, b: 0 }
const palette = createSmokePalette(defaultDrift)

/** Rounds to 3 decimals so the comparisons read as intent, not float noise. */
function round(rgb: Rgb): Rgb {
  return {
    r: Math.round(rgb.r * 1000) / 1000,
    g: Math.round(rgb.g * 1000) / 1000,
    b: Math.round(rgb.b * 1000) / 1000,
  }
}

describe('hexToRgb', () => {
  it('splits a hex color into 0..1 channels', () => {
    expect(round(hexToRgb('#ffffff'))).toEqual({ r: 1, g: 1, b: 1 })
    expect(round(hexToRgb('#000000'))).toEqual({ r: 0, g: 0, b: 0 })
    expect(round(hexToRgb('#ff0000'))).toEqual({ r: 1, g: 0, b: 0 })
  })

  it('reuses the output object so per-frame calls do not allocate', () => {
    const target: Rgb = { r: 0, g: 0, b: 0 }
    expect(hexToRgb('#ffffff', target)).toBe(target)
  })
})

describe('createSmokePalette', () => {
  it('keeps every gradient colour except the last, which becomes the red zone', () => {
    const colors = defaultDrift.smokeColors
    expect(palette.gradient).toHaveLength(colors.length - 1)
    expect(palette.redZone).toEqual(hexToRgb(colors.at(-1) ?? ''))
  })

  it('keeps the broken-chain colour', () => {
    expect(palette.broken).toEqual(hexToRgb(defaultDrift.brokenSmokeColor))
  })
})

describe('smokeColorAt', () => {
  it('is black when the chain is broken, whatever the charge', () => {
    smokeColorAt({ charge: 1, chainBroken: true }, defaultDrift.redZoneStart, palette, out)
    expect(out).toEqual(palette.broken)
  })

  it('is the last smoke colour inside the red zone', () => {
    smokeColorAt({ charge: 1, chainBroken: false }, defaultDrift.redZoneStart, palette, out)
    expect(out).toEqual(palette.redZone)
  })

  it('is the first colour on an empty bar', () => {
    smokeColorAt({ charge: 0, chainBroken: false }, defaultDrift.redZoneStart, palette, out)
    expect(out).toEqual(palette.gradient[0])
  })

  it('interpolates between neighbouring colours as the bar fills', () => {
    // A quarter of the bar is halfway through the first of two segments
    const quarter = defaultDrift.redZoneStart / 4
    smokeColorAt({ charge: quarter, chainBroken: false }, defaultDrift.redZoneStart, palette, out)
    const start = palette.gradient[0]
    const end = palette.gradient[1]
    if (!start || !end) return
    expect(out.r).toBeCloseTo((start.r + end.r) / 2, 2)
    expect(out.g).toBeCloseTo((start.g + end.g) / 2, 2)
  })

  it('lands exactly on a gradient colour at each segment boundary', () => {
    // Half the bar is the boundary between the two segments: colour 1 of the gradient
    const half = defaultDrift.redZoneStart / 2
    smokeColorAt({ charge: half, chainBroken: false }, defaultDrift.redZoneStart, palette, out)
    expect(out).toEqual(palette.gradient[1])
  })
})

describe('detectNitroStart', () => {
  it('reports a level when the boost level rises', () => {
    expect(detectNitroStart({ level: 0, timeLeft: 0 }, { level: 2, timeLeft: 1 })).toBe(2)
  })

  it('reports a start when the chain refreshes the boost time', () => {
    expect(detectNitroStart({ level: 1, timeLeft: 0.4 }, { level: 1, timeLeft: 1.2 })).toBe(1)
  })

  it('reports nothing while a boost simply counts down', () => {
    expect(detectNitroStart({ level: 1, timeLeft: 1.2 }, { level: 1, timeLeft: 1.1 })).toBe(0)
  })

  it('reports nothing when no boost is active', () => {
    expect(detectNitroStart({ level: 0, timeLeft: 0 }, { level: 0, timeLeft: 0 })).toBe(0)
  })
})

describe('detectChainBreak', () => {
  it('fires only on the frame the chain breaks', () => {
    const broken = { chainBroken: true }
    expect(detectChainBreak({ chainBroken: false }, broken)).toBe(true)
    expect(detectChainBreak(broken, broken)).toBe(false)
  })

  it('does not fire when the chain recovers', () => {
    expect(detectChainBreak({ chainBroken: true }, { chainBroken: false })).toBe(false)
  })
})

describe('speedLineTarget', () => {
  const config = defaultEffects.speedLines

  it('is zero below the start ratio', () => {
    expect(speedLineTarget(0, 0, config)).toBe(0)
    expect(speedLineTarget(config.startRatio, 0, config)).toBe(0)
  })

  it('grows with speed and stays within 0..1', () => {
    const slow = speedLineTarget(0.8, 0, config)
    const fast = speedLineTarget(1, 0, config)
    expect(fast).toBeGreaterThan(slow)
    expect(fast).toBeLessThanOrEqual(1)
  })

  it('adds intensity per nitro level', () => {
    const none = speedLineTarget(1, 0, config)
    const one = speedLineTarget(1, 1, config)
    const three = speedLineTarget(1, 3, config)
    expect(one).toBeGreaterThan(none)
    expect(three).toBeGreaterThan(one)
    expect(three).toBeLessThanOrEqual(1)
  })
})
