import { describe, expect, it } from 'vitest'
import {
  MAX_STAGGER_INDEX,
  resolveReduceMotion,
  staggerIndex,
  stepDirection,
} from '../src/ui/motionModel'

describe('stepDirection', () => {
  it('goes forward down the flow and back up it', () => {
    expect(stepDirection('mode', 'track')).toBe('forward')
    expect(stepDirection('track', 'character')).toBe('forward')
    expect(stepDirection('character', 'race')).toBe('forward')
    expect(stepDirection('race', 'character')).toBe('back')
    expect(stepDirection('track', 'mode')).toBe('back')
  })

  it('treats a jump of several steps by its sign', () => {
    expect(stepDirection('mode', 'race')).toBe('forward')
    expect(stepDirection('race', 'mode')).toBe('back')
  })

  it('pops in when the menu opens or the step does not change', () => {
    expect(stepDirection(null, 'mode')).toBe('enter')
    expect(stepDirection('track', 'track')).toBe('enter')
  })
})

describe('resolveReduceMotion', () => {
  it('uses the saved choice over the system preference', () => {
    expect(resolveReduceMotion(true, false)).toBe(true)
    expect(resolveReduceMotion(false, true)).toBe(false)
  })

  it('follows the system preference when nothing valid is saved', () => {
    expect(resolveReduceMotion(undefined, true)).toBe(true)
    expect(resolveReduceMotion('yes', false)).toBe(false)
    expect(resolveReduceMotion(null, true)).toBe(true)
  })
})

describe('staggerIndex', () => {
  it('caps long lists and ignores bad values', () => {
    expect(staggerIndex(3)).toBe(3)
    expect(staggerIndex(40)).toBe(MAX_STAGGER_INDEX)
    expect(staggerIndex(-2)).toBe(0)
    expect(staggerIndex(Number.NaN)).toBe(0)
  })
})
