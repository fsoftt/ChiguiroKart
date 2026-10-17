import { afterEach, describe, expect, it, vi } from 'vitest'
import { characterIds, characters } from '../src/config/characters'
import { POWER_NAMES } from '../src/config/items'
import { cups, tracks, trackIds } from '../src/config/tracks/catalog'
import { defaultSettings, parseSettings } from '../src/game/settings'
import {
  DICTIONARIES,
  detectLanguage,
  getLanguage,
  interpolate,
  onLanguageChange,
  ordinal,
  setLanguage,
  t,
  tn,
} from '../src/i18n'
import { characterName, cupName, powerName, trackName } from '../src/i18n/names'

/** Dotted paths and values of every string leaf. */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  if (typeof node === 'string') {
    result.set(prefix, node)
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, text] of leaves(value, prefix ? `${prefix}.${key}` : key)) {
        result.set(path, text)
      }
    }
  }
  return result
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()
}

afterEach(() => setLanguage('es'))

describe('dictionaries', () => {
  const es = leaves(DICTIONARIES.es)
  const en = leaves(DICTIONARIES.en)

  it('have exactly the same keys', () => {
    expect([...en.keys()].sort()).toEqual([...es.keys()].sort())
  })

  it('have no empty texts and the same {parameters} in both languages', () => {
    for (const [key, text] of es) {
      expect(text, key).not.toBe('')
      expect(en.get(key), key).not.toBe('')
      expect(placeholders(en.get(key) ?? ''), key).toEqual(placeholders(text))
    }
  })

  it('keep the Spanish names of the config data', () => {
    for (const id of characterIds) {
      expect(DICTIONARIES.es.characters[id].name).toBe(characters[id].name)
      expect(DICTIONARIES.es.characters[id].perkName).toBe(characters[id].perk.name)
      expect(DICTIONARIES.es.characters[id].perkDescription).toBe(characters[id].perk.description)
    }
    for (const id of trackIds) expect(DICTIONARIES.es.tracks[id]).toBe(tracks[id].name)
    for (const cup of cups) expect(DICTIONARIES.es.cups[cup.id]).toBe(cup.name)
    for (const [id, name] of Object.entries(POWER_NAMES)) {
      expect(DICTIONARIES.es.powers[id as keyof typeof POWER_NAMES]).toBe(name)
    }
  })
})

describe('t', () => {
  it('translates and interpolates', () => {
    expect(t('menu.go')).toBe('¡A correr!')
    expect(t('hud.lap', { lap: 2, total: 3 })).toBe('VUELTA 2/3')
    setLanguage('en')
    expect(t('menu.go')).toBe("Let's race!")
    expect(t('hud.lap', { lap: 2, total: 3 })).toBe('LAP 2/3')
  })

  it('leaves unknown parameters untouched', () => {
    expect(interpolate('Hola {name} {other}', { name: 'Ana' })).toBe('Hola Ana {other}')
    expect(interpolate('Sin parámetros')).toBe('Sin parámetros')
  })

  it('picks the plural form', () => {
    expect(tn('uchuva', 1)).toBe('uchuva')
    expect(tn('uchuva', 3)).toBe('uchuvas')
    expect(tn('uchuva', 0)).toBe('uchuvas')
  })

  it('names characters, tracks, cups and powers per language', () => {
    expect(trackName('cocora')).toBe('Valle de Cocora')
    expect(cupName('andina')).toBe('Copa Andina')
    setLanguage('en')
    expect(trackName('cocora')).toBe('Cocora Valley')
    expect(cupName('andina')).toBe('Andean Cup')
    expect(characterName('chiguiro')).toBe('Chigüiro')
    expect(powerName('coco')).toBe('Coconut bomb')
  })
})

describe('ordinal', () => {
  it('uses the Spanish masculine marker', () => {
    expect(ordinal(1, 'es')).toBe('1.º')
    expect(ordinal(12, 'es')).toBe('12.º')
  })

  it('uses English suffixes, including the teens', () => {
    const forms = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => ordinal(n, 'en'))
    expect(forms).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ])
  })

  it('follows the current language by default', () => {
    expect(ordinal(2)).toBe('2.º')
    setLanguage('en')
    expect(ordinal(2)).toBe('2nd')
  })
})

describe('language state', () => {
  it('notifies only real changes', () => {
    const listener = vi.fn()
    const off = onLanguageChange(listener)
    setLanguage('es')
    expect(listener).not.toHaveBeenCalled()
    setLanguage('en')
    expect(listener).toHaveBeenCalledWith('en')
    expect(getLanguage()).toBe('en')
    off()
    setLanguage('es')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('detects the browser language', () => {
    expect(detectLanguage('es-CO')).toBe('es')
    expect(detectLanguage('ES')).toBe('es')
    expect(detectLanguage('en-US')).toBe('en')
    expect(detectLanguage('pt-BR')).toBe('en')
    expect(detectLanguage('')).toBe('es')
  })
})

describe('language setting', () => {
  it('defaults to the detected language', () => {
    expect(defaultSettings(false, 'en').language).toBe('en')
    expect(defaultSettings(false, 'es').language).toBe('es')
  })

  it('reads a valid language and ignores an invalid one', () => {
    const defaults = defaultSettings(false, 'es')
    expect(parseSettings(JSON.stringify({ language: 'en' }), defaults).language).toBe('en')
    expect(parseSettings(JSON.stringify({ language: 'fr' }), defaults).language).toBe('es')
    expect(parseSettings(JSON.stringify({ language: 7 }), defaults).language).toBe('es')
  })
})

describe('UI modules', () => {
  const sources = {
    ...import.meta.glob<string>('../src/ui/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob<string>('../src/input/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  }
  const files = Object.keys(sources).filter((path) => !path.endsWith('debugPanel.ts'))
  const forbidden = [
    'Volver',
    'Siguiente',
    'Opciones',
    '¡A correr!',
    'Continuar',
    'Reiniciar',
    'Velocidad',
    'VUELTA',
    'Revancha',
    'Acelerar',
    'Piloto',
    'Pausa',
  ]

  it('do not hardcode common Spanish UI words in string literals', () => {
    expect(files.length).toBeGreaterThan(5)
    for (const path of files) {
      const source = sources[path] ?? ''
      for (const word of forbidden) {
        const literal = new RegExp(`['"\`][^'"\`\\n]*${word}[^'"\`\\n]*['"\`]`)
        expect(literal.test(source), `${path} contains "${word}"`).toBe(false)
      }
    }
  })
})
