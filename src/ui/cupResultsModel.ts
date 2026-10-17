import { characters } from '../config/characters'
import { cupPlaceOf, cupStandings, isCupFinished, type CupState } from '../game/cup'

/** Podium size of the final cup screen. */
const PODIUM_SIZE = 3

export interface CupRowView {
  /** Position in the cup table (1-based). */
  rank: number
  name: string
  isPlayer: boolean
  /** Position in the race just run, e.g. "2.º". */
  racePlace: string
  /** Points earned in the race just run, e.g. "+12". */
  gained: string
  total: number
}

/** What the cup results modal draws after a race; plain data, no DOM. */
export interface CupResultsView {
  /** True after the last race: the final podium screen. */
  final: boolean
  title: string
  /** Final screen: the win message or the player's place; otherwise the race progress. */
  headline: string
  rows: CupRowView[]
  /** Top 3 of the cup, only on the final screen. */
  podium: CupRowView[]
  /** Label of the main button (Enter). */
  primaryLabel: string
  /** Text under the buttons. */
  hint: string
}

/** Spanish ordinal of a position, e.g. "2.º". */
function placeText(rank: number): string {
  return `${rank}.º`
}

/**
 * Builds the modal that follows a cup race. `cup` already includes that race's results.
 * `cupName` is the display name of the cup (e.g. "Copa Andina").
 */
export function buildCupResultsView(
  cup: CupState,
  cupName: string,
  playerSlot = 0,
): CupResultsView {
  const final = isCupFinished(cup)
  const rows: CupRowView[] = cupStandings(cup).map((entry, index) => ({
    rank: index + 1,
    name: characters[entry.character].name,
    isPlayer: entry.slot === playerSlot,
    racePlace: placeText(entry.lastPlace),
    gained: `+${entry.lastGain}`,
    total: entry.points,
  }))
  const raceNumber = Math.min(cup.raceIndex + 1, cup.raceCount)
  if (!final) {
    return {
      final,
      title: `${cupName} · Carrera ${raceNumber}/${cup.raceCount}`,
      headline: 'Tabla de la copa',
      rows,
      podium: [],
      primaryLabel: 'Siguiente carrera',
      hint: 'Enter: siguiente carrera',
    }
  }
  const place = cupPlaceOf(cup, playerSlot)
  return {
    final,
    title: '¡Copa terminada!',
    headline:
      place === 1 ? `¡Ganaste la ${cupName}!` : `Quedaste ${placeText(place)} en la ${cupName}`,
    rows,
    podium: rows.slice(0, PODIUM_SIZE),
    primaryLabel: 'Repetir copa',
    hint: 'Enter: repetir copa',
  }
}

/** Badge shown during a cup race, e.g. "Carrera 2/4 · Copa Andina". */
export function cupBadgeText(cup: CupState, cupName: string): string {
  return `Carrera ${Math.min(cup.raceIndex + 1, cup.raceCount)}/${cup.raceCount} · ${cupName}`
}
