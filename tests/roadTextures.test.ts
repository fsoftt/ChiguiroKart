import { describe, expect, it } from 'vitest'
import { mixColors, parseHex } from '../src/render/environment/proceduralTextures'

// The textures themselves draw on a canvas, which the node test environment lacks: the pure
// color helpers that tint them are covered here and the pixels are checked in the browser.
describe('road texture color helpers', () => {
  it('parses long and short hex colors', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0])
    expect(parseHex('#f80')).toEqual([255, 136, 0])
  })

  it('falls back to gray on garbage', () => {
    expect(parseHex('nope')).toEqual([128, 128, 128])
  })

  it('mixes colors and applies alpha', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)')
    expect(mixColors('#ff0000', '#0000ff', 0, 0.5)).toBe('rgba(255,0,0,0.5)')
  })
})
