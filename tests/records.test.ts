import { beforeEach, describe, expect, it } from 'vitest'
import { loadTrackRecord, saveTrackRecord, type StorageLike } from '../src/sim/race/records'

describe('Track Records Persistence', () => {
  let map: Map<string, string>
  let storage: StorageLike

  beforeEach(() => {
    map = new Map<string, string>()
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    }
  })

  it('returns null when no record has been stored', () => {
    expect(loadTrackRecord('Valle de Cocora', storage)).toBeNull()
  })

  it('saves and loads track records correctly', () => {
    const res = saveTrackRecord('Valle de Cocora', 120.5, 38.2, storage)
    expect(res.isNewRaceRecord).toBe(true)
    expect(res.isNewLapRecord).toBe(true)

    const loaded = loadTrackRecord('Valle de Cocora', storage)
    expect(loaded).not.toBeNull()
    expect(loaded?.bestRaceTime).toBeCloseTo(120.5)
    expect(loaded?.bestLapTime).toBeCloseTo(38.2)
  })

  it('detects when a subsequent race beats the record', () => {
    saveTrackRecord('Valle de Cocora', 120.0, 40.0, storage)

    // Slower race
    const slower = saveTrackRecord('Valle de Cocora', 125.0, 41.0, storage)
    expect(slower.isNewRaceRecord).toBe(false)
    expect(slower.isNewLapRecord).toBe(false)

    // Faster race
    const faster = saveTrackRecord('Valle de Cocora', 115.0, 37.0, storage)
    expect(faster.isNewRaceRecord).toBe(true)
    expect(faster.isNewLapRecord).toBe(true)

    const loaded = loadTrackRecord('Valle de Cocora', storage)
    expect(loaded?.bestRaceTime).toBeCloseTo(115.0)
    expect(loaded?.bestLapTime).toBeCloseTo(37.0)
  })
})
