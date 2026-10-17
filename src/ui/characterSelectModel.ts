import { t, type TranslationKey } from '../i18n'
import { characterName } from '../i18n/names'
import { characters, type CharacterId, type CharacterStats } from '../config/characters'

/** Number of segments of every stat bar. */
export const STAT_SEGMENTS = 5

/** Stats in display order; the label is the `stats.<key>` translation. */
export const STAT_ROWS: readonly { key: keyof CharacterStats; label: TranslationKey }[] = [
  { key: 'speed', label: 'stats.speed' },
  { key: 'acceleration', label: 'stats.acceleration' },
  { key: 'handling', label: 'stats.handling' },
  { key: 'weight', label: 'stats.weight' },
]

/** Accent color of every character (menu dot and highlights). */
export const CHARACTER_COLORS: Record<CharacterId, string> = {
  chiguiro: '#c98a4b',
  oso: '#3b3b46',
  titi: '#f0a030',
  condor: '#8aa0b8',
  jaguar: '#f2b23a',
  guacamaya: '#e8503c',
  delfin: '#f58fb4',
  perezoso: '#8fbf6a',
}

/** Which segments of a bar are filled for a stat value; the value is clamped to the bar size. */
export function statSegments(value: number, total: number = STAT_SEGMENTS): boolean[] {
  const filled = Math.min(Math.max(Math.round(value), 0), total)
  return Array.from({ length: total }, (_, index) => index < filled)
}

/** The rows of the stat panel of one character: label, value and bar segments. */
export function statRows(id: CharacterId): { label: string; value: number; segments: boolean[] }[] {
  const { stats } = characters[id]
  return STAT_ROWS.map(({ key, label }) => ({
    label: t(label),
    value: stats[key],
    segments: statSegments(stats[key]),
  }))
}

/** First letter of the character name, shown inside the menu button. */
export function characterInitial(id: CharacterId): string {
  return characterName(id).charAt(0).toUpperCase()
}
