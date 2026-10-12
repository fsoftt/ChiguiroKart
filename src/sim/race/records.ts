export interface TrackRecord {
  bestRaceTime: number
  bestLapTime: number
  date: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getStorageKey(trackName: string): string {
  const sanitized = trackName.toLowerCase().replace(/[^a-z0-9]/g, '_')
  return `chiguiro_record_${sanitized}`
}

function resolveStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

/** Loads stored personal best for the given track, or null if none. */
export function loadTrackRecord(trackName: string, storage?: StorageLike): TrackRecord | null {
  const store = resolveStorage(storage)
  if (!store) return null

  try {
    const raw = store.getItem(getStorageKey(trackName))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TrackRecord>
    if (typeof parsed.bestRaceTime === 'number' && typeof parsed.bestLapTime === 'number') {
      return {
        bestRaceTime: parsed.bestRaceTime,
        bestLapTime: parsed.bestLapTime,
        date: parsed.date ?? '',
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null
}

/**
 * Saves a new track record if times are faster or no record exists yet.
 * Returns true if a new overall race record was set.
 */
export function saveTrackRecord(
  trackName: string,
  raceTime: number,
  bestLapTime: number,
  storage?: StorageLike,
): { isNewRaceRecord: boolean; isNewLapRecord: boolean } {
  const store = resolveStorage(storage)
  if (!store) {
    return { isNewRaceRecord: false, isNewLapRecord: false }
  }

  const existing = loadTrackRecord(trackName, store)
  const isNewRaceRecord = !existing || raceTime < existing.bestRaceTime
  const isNewLapRecord = !existing || bestLapTime < existing.bestLapTime

  const bestRaceTime = existing ? Math.min(existing.bestRaceTime, raceTime) : raceTime
  const bestLap = existing ? Math.min(existing.bestLapTime, bestLapTime) : bestLapTime

  try {
    const record: TrackRecord = {
      bestRaceTime,
      bestLapTime: bestLap,
      date: new Date().toISOString(),
    }
    store.setItem(getStorageKey(trackName), JSON.stringify(record))
  } catch {
    // Ignore storage write errors (e.g. quota limit)
  }

  return { isNewRaceRecord, isNewLapRecord }
}
