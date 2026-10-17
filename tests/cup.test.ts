import { describe, expect, it } from 'vitest'
import { CUP_POINTS } from '../src/config/cups'
import { characterIds } from '../src/config/characters'
import {
  advanceCup,
  createCup,
  cupPlaceOf,
  cupStandings,
  isCupFinished,
  isRaceRecorded,
  pointsForPlace,
  recordRace,
  type CupState,
} from '../src/game/cup'
import { buildCupResultsView, cupBadgeText } from '../src/ui/cupResultsModel'
import { moveTrackSelection, trackGroups, cupCards } from '../src/ui/trackSelectModel'
import { trackIds } from '../src/config/tracks/catalog'

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7]

function newCup(): CupState {
  return createCup('andina', characterIds)
}

/** Runs the whole cup with the same finishing order in every race. */
function finishedCup(order: number[]): CupState {
  let cup = newCup()
  for (let i = 0; i < 4; i++) {
    cup = recordRace(cup, order)
    if (i < 3) cup = advanceCup(cup)
  }
  return cup
}

describe('points', () => {
  it('gives 15, 12, 10, 8, 6, 4, 2, 1 by position and nothing after', () => {
    expect(CUP_POINTS).toEqual([15, 12, 10, 8, 6, 4, 2, 1])
    expect(SLOTS.map((slot) => pointsForPlace(slot + 1))).toEqual([15, 12, 10, 8, 6, 4, 2, 1])
    expect(pointsForPlace(9)).toBe(0)
    expect(pointsForPlace(0)).toBe(0)
  })
})

describe('cup flow', () => {
  it('starts with no points, in grid order, at the first race', () => {
    const cup = newCup()
    expect(cup.raceIndex).toBe(0)
    expect(cup.racesDone).toBe(0)
    expect(cup.entries).toHaveLength(8)
    expect(cup.entries.every((entry) => entry.points === 0)).toBe(true)
    expect(cupStandings(cup).map((entry) => entry.slot)).toEqual(SLOTS)
    expect(isCupFinished(cup)).toBe(false)
  })

  it('awards points by finishing order', () => {
    const cup = recordRace(newCup(), [3, 0, 1, 2, 4, 5, 6, 7])
    expect(cup.entries[3]).toMatchObject({ points: 15, lastPlace: 1, lastGain: 15 })
    expect(cup.entries[0]).toMatchObject({ points: 12, lastPlace: 2 })
    expect(cup.entries[7]).toMatchObject({ points: 1, lastPlace: 8 })
    expect(cupStandings(cup)[0]?.slot).toBe(3)
  })

  it('does not record the same race twice', () => {
    const once = recordRace(newCup(), SLOTS)
    expect(isRaceRecorded(once)).toBe(true)
    expect(recordRace(once, [7, 6, 5, 4, 3, 2, 1, 0])).toBe(once)
  })

  it('only advances after the race is recorded', () => {
    const cup = newCup()
    expect(advanceCup(cup)).toBe(cup)
    const next = advanceCup(recordRace(cup, SLOTS))
    expect(next.raceIndex).toBe(1)
    expect(isRaceRecorded(next)).toBe(false)
  })

  it('accumulates over four races and then finishes', () => {
    const cup = finishedCup(SLOTS)
    expect(isCupFinished(cup)).toBe(true)
    expect(cup.entries[0]?.points).toBe(60)
    expect(cup.entries[7]?.points).toBe(4)
    expect(advanceCup(cup)).toBe(cup)
    expect(recordRace(cup, SLOTS)).toBe(cup)
    expect(cup.raceIndex).toBe(3)
  })

  it('places racers missing from the order after the listed ones', () => {
    const cup = recordRace(newCup(), [5, 2])
    expect(cup.entries[5]?.lastPlace).toBe(1)
    expect(cup.entries[2]?.lastPlace).toBe(2)
    expect(cup.entries[0]?.lastPlace).toBe(3)
    expect(cup.entries[7]?.lastPlace).toBe(8)
  })

  it('ignores unknown and repeated slots in the order', () => {
    const cup = recordRace(newCup(), [4, 4, 99, 1])
    expect(cup.entries[4]?.lastPlace).toBe(1)
    expect(cup.entries[1]?.lastPlace).toBe(2)
  })
})

describe('cup standings tie-breaks', () => {
  it('breaks a tie with the better result in the last race', () => {
    // Slot 1: 1st then 2nd (15+12). Slot 2: 2nd then 1st (12+15). Same points.
    let cup = recordRace(newCup(), [1, 2, 0, 3, 4, 5, 6, 7])
    cup = recordRace(advanceCup(cup), [2, 1, 0, 3, 4, 5, 6, 7])
    expect(cup.entries[1]?.points).toBe(cup.entries[2]?.points)
    expect(cupStandings(cup).map((entry) => entry.slot)).toEqual([2, 1, 0, 3, 4, 5, 6, 7])
    expect(cupPlaceOf(cup, 2)).toBe(1)
    expect(cupPlaceOf(cup, 1)).toBe(2)
  })

  it('breaks the remaining ties by grid slot', () => {
    const cup = newCup()
    const tied: CupState = {
      ...cup,
      entries: cup.entries.map((entry) => ({ ...entry, points: 10, lastPlace: 3 })),
    }
    expect(cupStandings(tied).map((entry) => entry.slot)).toEqual(SLOTS)
  })

  it('sorts by points first', () => {
    const cup = recordRace(newCup(), [7, 6, 5, 4, 3, 2, 1, 0])
    expect(cupStandings(cup).map((entry) => entry.slot)).toEqual([7, 6, 5, 4, 3, 2, 1, 0])
  })

  it('returns 0 for a slot outside the cup', () => {
    expect(cupPlaceOf(newCup(), 42)).toBe(0)
  })
})

describe('cup results view', () => {
  it('shows the race standings and a next-race button between races', () => {
    const cup = recordRace(newCup(), [3, 0, 1, 2, 4, 5, 6, 7])
    const view = buildCupResultsView(cup, 'Copa Andina')
    expect(view.final).toBe(false)
    expect(view.title).toBe('Copa Andina · Carrera 1/4')
    expect(view.primaryLabel).toBe('Siguiente carrera')
    expect(view.rows).toHaveLength(8)
    expect(view.rows[0]).toMatchObject({ rank: 1, gained: '+15', total: 15, racePlace: '1.º' })
    expect(view.rows.filter((row) => row.isPlayer)).toHaveLength(1)
    expect(view.rows[1]).toMatchObject({ isPlayer: true, gained: '+12' })
    expect(view.podium).toEqual([])
  })

  it('shows the podium and the win message after the last race', () => {
    const view = buildCupResultsView(finishedCup(SLOTS), 'Copa Andina')
    expect(view.final).toBe(true)
    expect(view.headline).toBe('¡Ganaste la Copa Andina!')
    expect(view.primaryLabel).toBe('Repetir copa')
    expect(view.podium).toHaveLength(3)
    expect(view.podium[0]?.isPlayer).toBe(true)
  })

  it('tells the player their place when they did not win', () => {
    const view = buildCupResultsView(finishedCup([1, 2, 0, 3, 4, 5, 6, 7]), 'Copa Caribe')
    expect(view.headline).toBe('Quedaste 3.º en la Copa Caribe')
  })

  it('writes the race badge', () => {
    const cup = advanceCup(recordRace(newCup(), SLOTS))
    expect(cupBadgeText(cup, 'Copa Andina')).toBe('Carrera 2/4 · Copa Andina')
    expect(cupBadgeText(newCup(), 'Copa Andina')).toBe('Carrera 1/4 · Copa Andina')
  })
})

describe('track picker model', () => {
  it('groups the 12 tracks by cup', () => {
    const groups = trackGroups()
    expect(groups.map((group) => group.cup)).toEqual(['andina', 'caribe', 'selva'])
    expect(groups.every((group) => group.tracks.length === 4)).toBe(true)
    expect(groups.flatMap((group) => group.tracks.map((t) => t.id))).toEqual([...trackIds])
    expect(groups[0]?.tracks[0]?.name).toBe('Valle de Cocora')
  })

  it('moves left and right through the tracks, wrapping', () => {
    expect(moveTrackSelection('cocora', 'right')).toBe('nevado')
    expect(moveTrackSelection('bogota', 'right')).toBe('cartagena')
    expect(moveTrackSelection('cocora', 'left')).toBe('tatacoa')
  })

  it('moves up and down between cups keeping the column, wrapping', () => {
    expect(moveTrackSelection('nevado', 'down')).toBe('ciudadPerdida')
    expect(moveTrackSelection('ciudadPerdida', 'down')).toBe('llanos')
    expect(moveTrackSelection('llanos', 'down')).toBe('nevado')
    expect(moveTrackSelection('cocora', 'up')).toBe('canoCristales')
  })

  it('lists the three cups with their four track names', () => {
    const cards = cupCards()
    expect(cards).toHaveLength(3)
    expect(cards[0]).toMatchObject({ id: 'andina', name: 'Copa Andina' })
    expect(cards.every((card) => card.trackNames.length === 4)).toBe(true)
  })
})
