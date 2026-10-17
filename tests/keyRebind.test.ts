import { describe, expect, it } from 'vitest'
import { defaultKeyBindings } from '../src/config/controls'
import { defaultBindings, isBindableCode, keyLabel, rebindKey } from '../src/game/keyRebind'

describe('rebindKey', () => {
  it('replaces the key of a slot without touching the input', () => {
    const base = defaultBindings()
    const next = rebindKey(base, 'jump', 0, 'KeyJ')
    expect(next.jump).toEqual(['KeyJ'])
    expect(base).toEqual(defaultKeyBindings)
  })

  it('adds a secondary key', () => {
    expect(rebindKey(defaultBindings(), 'jump', 1, 'KeyJ').jump).toEqual(['Space', 'KeyJ'])
  })

  it('moves a key used by another action', () => {
    const next = rebindKey(defaultBindings(), 'boost', 0, 'KeyW')
    expect(next.boost).toEqual(['KeyW', 'ShiftRight'])
    expect(next.throttle).toEqual(['ArrowUp'])
  })

  it('swaps when the other action would be left without keys', () => {
    // Space is the only jump key: giving it to boost's primary slot hands jump the old key
    const next = rebindKey(defaultBindings(), 'boost', 0, 'Space')
    expect(next.boost).toEqual(['Space', 'ShiftRight'])
    expect(next.jump).toEqual(['ShiftLeft'])
  })

  it('keeps one copy when the key was the other slot of the same action', () => {
    const next = rebindKey(defaultBindings(), 'throttle', 0, 'ArrowUp')
    expect(next.throttle).toEqual(['ArrowUp'])
  })

  it('never leaves a code on two actions', () => {
    let bindings = defaultBindings()
    bindings = rebindKey(bindings, 'left', 0, 'KeyD')
    bindings = rebindKey(bindings, 'useItem', 0, 'KeyD')
    const all = Object.values(bindings).flat()
    expect(new Set(all).size).toBe(all.length)
    for (const keys of Object.values(bindings)) expect(keys.length).toBeGreaterThan(0)
  })

  it('refuses reserved codes', () => {
    const base = defaultBindings()
    expect(rebindKey(base, 'jump', 0, 'Escape')).toBe(base)
    expect(isBindableCode('KeyP')).toBe(false)
    expect(isBindableCode('KeyJ')).toBe(true)
  })
})

describe('keyLabel', () => {
  it('shortens common codes', () => {
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('Space')).toBe('Espacio')
    expect(keyLabel('F5')).toBe('F5')
  })
})
