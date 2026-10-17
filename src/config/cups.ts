/** Rules of the cup mode (docs/diseno.md §7), in one place so they are easy to tune. */

/** Points per finishing position, first place first. Positions beyond the list earn nothing. */
export const CUP_POINTS: readonly number[] = [15, 12, 10, 8, 6, 4, 2, 1]

/** Races in every cup. */
export const CUP_RACE_COUNT = 4
