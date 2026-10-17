import { CUP_POINTS, CUP_RACE_COUNT } from '../config/cups'
import type { CharacterId } from '../config/characters'
import type { CupId } from '../config/tracks/catalog'

/** One racer's cup record, identified by its starting grid slot (the player is slot 0). */
export interface CupEntry {
  slot: number
  character: CharacterId
  points: number
  /** Position (1-based) in the last race recorded; before any race, the grid slot + 1. */
  lastPlace: number
  /** Points earned in the last race recorded. */
  lastGain: number
}

/** A cup in progress. Immutable: every function returns a new state. */
export interface CupState {
  cupId: CupId
  raceCount: number
  /** 0-based index of the race being run (or just run). */
  raceIndex: number
  /** Races whose results are already in. */
  racesDone: number
  /** One per racer, in grid slot order. */
  entries: readonly CupEntry[]
}

/** Points for a 1-based finishing position. */
export function pointsForPlace(place: number): number {
  return CUP_POINTS[place - 1] ?? 0
}

/** Starts a cup. `characters[i]` drives the kart in grid slot i (player first). */
export function createCup(
  cupId: CupId,
  characters: readonly CharacterId[],
  raceCount: number = CUP_RACE_COUNT,
): CupState {
  return {
    cupId,
    raceCount,
    raceIndex: 0,
    racesDone: 0,
    entries: characters.map((character, slot) => ({
      slot,
      character,
      points: 0,
      lastPlace: slot + 1,
      lastGain: 0,
    })),
  }
}

/** True once every race of the cup has been recorded. */
export function isCupFinished(cup: CupState): boolean {
  return cup.racesDone >= cup.raceCount
}

/** True when the race being run has its results recorded already. */
export function isRaceRecorded(cup: CupState): boolean {
  return cup.racesDone > cup.raceIndex
}

/**
 * Records the results of the current race. `order` lists grid slots from first to last place;
 * racers missing from it place after the listed ones, in slot order. Recording twice, or after
 * the cup is over, changes nothing.
 */
export function recordRace(cup: CupState, order: readonly number[]): CupState {
  if (isCupFinished(cup) || isRaceRecorded(cup)) return cup
  const ranked = [...new Set(order)].filter((slot) => cup.entries.some((e) => e.slot === slot))
  const missing = cup.entries.map((e) => e.slot).filter((slot) => !ranked.includes(slot))
  const full = [...ranked, ...missing]
  return {
    ...cup,
    racesDone: cup.racesDone + 1,
    entries: cup.entries.map((entry) => {
      const place = full.indexOf(entry.slot) + 1
      const gain = pointsForPlace(place)
      return { ...entry, points: entry.points + gain, lastPlace: place, lastGain: gain }
    }),
  }
}

/** Moves on to the next race, once the current one is recorded; otherwise returns the same cup. */
export function advanceCup(cup: CupState): CupState {
  if (!isRaceRecorded(cup) || isCupFinished(cup)) return cup
  return { ...cup, raceIndex: cup.raceIndex + 1 }
}

/**
 * The cup table, leader first: more points, then the better position in the last race, then
 * the lower grid slot.
 */
export function cupStandings(cup: CupState): CupEntry[] {
  return [...cup.entries].sort(
    (a, b) => b.points - a.points || a.lastPlace - b.lastPlace || a.slot - b.slot,
  )
}

/** 1-based place of a grid slot in the cup table (0 if the slot is not in the cup). */
export function cupPlaceOf(cup: CupState, slot: number): number {
  return cupStandings(cup).findIndex((entry) => entry.slot === slot) + 1
}
