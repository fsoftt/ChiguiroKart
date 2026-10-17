import { cups, tracks, type CupId, type TrackId } from '../config/tracks/catalog'

/** Columns of the track grid: one row per cup, four tracks each. */
export const TRACK_GRID_COLUMNS = 4

export type GridDirection = 'left' | 'right' | 'up' | 'down'

/** One row of the track picker. */
export interface TrackGroupView {
  cup: CupId
  cupName: string
  tracks: { id: TrackId; name: string }[]
}

/** The 12 tracks grouped by cup, in menu order. */
export function trackGroups(): TrackGroupView[] {
  return cups.map((cup) => ({
    cup: cup.id,
    cupName: cup.name,
    tracks: cup.tracks.map((id) => ({ id, name: tracks[id].name })),
  }))
}

function wrap(value: number, count: number): number {
  return ((value % count) + count) % count
}

/**
 * Moves the selection in the cups × tracks grid. Left and right walk the tracks cup by cup and
 * wrap at the ends; up and down jump a whole cup and wrap too, keeping the column.
 */
export function moveTrackSelection(current: TrackId, direction: GridDirection): TrackId {
  const flat = cups.flatMap((cup) => cup.tracks)
  const index = flat.indexOf(current)
  if (index < 0) return flat[0] ?? current
  const step = {
    left: -1,
    right: 1,
    up: -TRACK_GRID_COLUMNS,
    down: TRACK_GRID_COLUMNS,
  }[direction]
  return flat[wrap(index + step, flat.length)] ?? current
}

/** The cup (name and four track names) shown as a card when picking in the cup mode. */
export function cupCards(): { id: CupId; name: string; trackNames: string[] }[] {
  return cups.map((cup) => ({
    id: cup.id,
    name: cup.name,
    trackNames: cup.tracks.map((id) => tracks[id].name),
  }))
}
