import type { es } from './es'

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** Same nested shape as `es`, with plain strings at the leaves. */
type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
export type Dictionary = Widen<typeof es>

/** Dotted paths of every string in the dictionary, e.g. `"menu.go"`. */
type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type TranslationKey = Paths<Dictionary>

/** Bases of the plural pairs (`base.one` / `base.other`). */
export type PluralKey = TranslationKey extends infer K
  ? K extends `${infer Base}.one`
    ? Base
    : never
  : never

export type Params = Readonly<Record<string, string | number>>
