import { describe, expect, it, vi } from 'vitest'
import { defaultKeyBindings } from '../src/config/controls'
import {
  SETTINGS_KEY,
  SettingsStore,
  defaultSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  type StorageLike,
} from '../src/game/settings'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>
} {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

describe('defaultSettings', () => {
  it('uses medium quality on coarse pointers and high otherwise', () => {
    expect(defaultSettings(true).quality).toBe('medium')
    expect(defaultSettings(false).quality).toBe('high')
  })

  it('starts with accessibility off and the default keys', () => {
    const settings = defaultSettings(false)
    expect(settings.colorblind).toBe(false)
    expect(settings.reduceShake).toBe(false)
    expect(settings.keyBindings).toEqual(defaultKeyBindings)
  })
})

describe('reduceMotion', () => {
  it('defaults to the system prefers-reduced-motion preference', () => {
    expect(defaultSettings(false, 'es', true).reduceMotion).toBe(true)
    expect(defaultSettings(false, 'es', false).reduceMotion).toBe(false)
  })

  it('keeps a saved choice over the system preference and falls back for bad values', () => {
    const reduced = defaultSettings(false, 'es', true)
    expect(parseSettings(JSON.stringify({ reduceMotion: false }), reduced).reduceMotion).toBe(false)
    expect(parseSettings(JSON.stringify({}), reduced).reduceMotion).toBe(true)
    expect(parseSettings(JSON.stringify({ reduceMotion: 'x' }), reduced).reduceMotion).toBe(true)
  })
})

describe('parseSettings', () => {
  const defaults = defaultSettings(false)

  it('falls back to the defaults for missing or broken text', () => {
    expect(parseSettings(null, defaults)).toEqual(defaults)
    expect(parseSettings('{oops', defaults)).toEqual(defaults)
    expect(parseSettings('42', defaults)).toEqual(defaults)
    expect(parseSettings('null', defaults)).toEqual(defaults)
  })

  it('reads valid values', () => {
    const text = JSON.stringify({
      quality: 'low',
      masterVolume: 0.25,
      musicVolume: 0,
      sfxVolume: 1,
      colorblind: true,
      reduceShake: true,
    })
    expect(parseSettings(text, defaults)).toMatchObject({
      quality: 'low',
      masterVolume: 0.25,
      musicVolume: 0,
      sfxVolume: 1,
      colorblind: true,
      reduceShake: true,
    })
  })

  it('validates field by field', () => {
    const text = JSON.stringify({
      quality: 'ultra',
      masterVolume: 7,
      musicVolume: 'loud',
      sfxVolume: -3,
      colorblind: 'yes',
      reduceShake: true,
    })
    const parsed = parseSettings(text, defaults)
    expect(parsed.quality).toBe(defaults.quality)
    expect(parsed.masterVolume).toBe(1)
    expect(parsed.musicVolume).toBe(defaults.musicVolume)
    expect(parsed.sfxVolume).toBe(0)
    expect(parsed.colorblind).toBe(false)
    expect(parsed.reduceShake).toBe(true)
  })

  it('keeps valid key bindings and rejects damaged ones', () => {
    const parseKeys = (keyBindings: unknown) =>
      parseSettings(JSON.stringify({ keyBindings }), defaults).keyBindings
    const custom = { ...defaultKeyBindings, jump: ['KeyJ'], boost: ['KeyK'] }
    expect(parseKeys(custom)).toEqual(custom)
    expect(parseKeys({ ...defaultKeyBindings, jump: ['KeyW'] })).toEqual(defaultKeyBindings)
    expect(parseKeys({ ...defaultKeyBindings, jump: [] })).toEqual(defaultKeyBindings)
    expect(parseKeys({ ...defaultKeyBindings, jump: ['Escape'] })).toEqual(defaultKeyBindings)
  })
})

describe('load and save', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const settings = { ...defaultSettings(false), quality: 'low' as const, colorblind: true }
    saveSettings(settings, storage)
    expect(storage.data[SETTINGS_KEY]).toBeDefined()
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('survives storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => saveSettings(defaultSettings(false), broken)).not.toThrow()
    expect(loadSettings(broken).quality).toBeDefined()
  })
})

describe('SettingsStore', () => {
  it('merges updates, persists and notifies subscribers', () => {
    const persist = vi.fn()
    const store = new SettingsStore(defaultSettings(false), persist)
    const listener = vi.fn()
    store.subscribe(listener)
    store.update({ quality: 'low' })
    expect(store.get().quality).toBe('low')
    expect(store.get().reduceShake).toBe(false)
    expect(persist).toHaveBeenCalledWith(store.get())
    expect(listener).toHaveBeenCalledWith(store.get())
  })

  it('stops notifying after unsubscribe', () => {
    const store = new SettingsStore(defaultSettings(false), () => undefined)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.update({ colorblind: true })
    expect(listener).not.toHaveBeenCalled()
  })
})
