import { characters, type CharacterId, type CharacterStats } from '../config/characters'

/** Number of segments of every stat bar. */
export const STAT_SEGMENTS = 5

/** Stats in display order, with their Spanish labels. */
export const STAT_ROWS: readonly { key: keyof CharacterStats; label: string }[] = [
  { key: 'speed', label: 'Velocidad' },
  { key: 'acceleration', label: 'Aceleración' },
  { key: 'handling', label: 'Manejo' },
  { key: 'weight', label: 'Peso' },
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
    label,
    value: stats[key],
    segments: statSegments(stats[key]),
  }))
}

/** First letter of the character name, shown inside the menu button. */
export function characterInitial(id: CharacterId): string {
  return characters[id].name.charAt(0).toUpperCase()
}
