import { en } from './en'
import { es } from './es'
import {
  LANGUAGES,
  type Dictionary,
  type Language,
  type Params,
  type PluralKey,
  type TranslationKey,
} from './types'

export { LANGUAGES, type Language, type TranslationKey } from './types'

export const DICTIONARIES: Record<Language, Dictionary> = { es, en }

export const DEFAULT_LANGUAGE: Language = 'es'

type Listener = (language: Language) => void

let current: Language = DEFAULT_LANGUAGE
const listeners = new Set<Listener>()

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value)
}

/** 'es' when the browser language starts with "es" (or is unknown), 'en' otherwise. */
export function detectLanguage(browserLanguage?: string): Language {
  const raw = browserLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : undefined)
  if (!raw) return 'es'
  return raw.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function getLanguage(): Language {
  return current
}

/** Switches the language, sets `<html lang>` and tells the subscribers if it changed. */
export function setLanguage(language: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language
  if (language === current) return
  current = language
  for (const listener of [...listeners]) listener(language)
}

/** Calls `listener` whenever the language changes (not on subscribe). Returns the unsubscribe. */
export function onLanguageChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function lookup(dictionary: Dictionary, key: string): string {
  let node: unknown = dictionary
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : key
}

/** Replaces every `{name}` of `template` with `params.name`; unknown names stay as they are. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/** Text of `key` in the current language, with `{name}` parameters filled in. */
export function t(key: TranslationKey, params?: Params): string {
  return interpolate(lookup(DICTIONARIES[current], key), params)
}

/** Plural form: picks `base.one` when `count` is 1 and `base.other` otherwise. */
export function tn(base: PluralKey, count: number, params?: Params): string {
  const key: TranslationKey = count === 1 ? `${base}.one` : `${base}.other`
  return t(key, { count, ...params })
}

/** Ordinal of a position: "3.º" in Spanish, "3rd" in English. */
export function ordinal(n: number, language: Language = current): string {
  if (language === 'es') return `${n}.º`
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}
