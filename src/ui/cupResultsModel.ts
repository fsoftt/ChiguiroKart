import { ordinal, t } from '../i18n'
import { characterName } from '../i18n/names'
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

/**
 * Builds the modal that follows a cup race. `cup` already includes that race's results.
 * `cupName` is the display name of the cup in the current language (e.g. "Copa Andina").
 */
export function buildCupResultsView(
  cup: CupState,
  cupName: string,
  playerSlot = 0,
): CupResultsView {
  const final = isCupFinished(cup)
  const rows: CupRowView[] = cupStandings(cup).map((entry, index) => ({
    rank: index + 1,
    name: characterName(entry.character),
    isPlayer: entry.slot === playerSlot,
    racePlace: ordinal(entry.lastPlace),
    gained: `+${entry.lastGain}`,
    total: entry.points,
  }))
  const raceNumber = Math.min(cup.raceIndex + 1, cup.raceCount)
  if (!final) {
    return {
      final,
      title: t('cup.raceTitle', { cup: cupName, n: raceNumber, total: cup.raceCount }),
      headline: t('cup.table'),
      rows,
      podium: [],
      primaryLabel: t('cup.nextRace'),
      hint: t('cup.nextRaceHint'),
    }
  }
  const place = cupPlaceOf(cup, playerSlot)
  return {
    final,
    title: t('cup.finished'),
    headline:
      place === 1
        ? t('cup.won', { cup: cupName })
        : t('cup.placed', { place: ordinal(place), cup: cupName }),
    rows,
    podium: rows.slice(0, PODIUM_SIZE),
    primaryLabel: t('cup.repeat'),
    hint: t('cup.repeatHint'),
  }
}

/** Badge shown during a cup race, e.g. "Carrera 2/4 · Copa Andina" or "Race 2/4 · Andean Cup". */
export function cupBadgeText(cup: CupState, cupName: string): string {
  return t('cup.badge', {
    n: Math.min(cup.raceIndex + 1, cup.raceCount),
    total: cup.raceCount,
    cup: cupName,
  })
}
