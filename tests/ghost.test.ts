import { beforeEach, describe, expect, it } from 'vitest'
import { createKartState } from '../src/sim/kart/kartState'
import {
  deserializeGhost,
  ghostDuration,
  ghostPoseAt,
  ghostStorageKey,
  GHOST_SAMPLE_INTERVAL,
  GHOST_SAMPLE_STEPS,
  GhostRecorder,
  isBetterGhost,
  lapDelta,
  loadGhost,
  saveGhostIfBetter,
  serializeGhost,
  type Ghost,
} from '../src/sim/race/ghost'
import { createRaceState } from '../src/sim/race/raceState'
import type { StorageLike } from '../src/sim/race/records'
import { runSolo } from './helpers/botSim'

function racing(totalTime = 0) {
  const state = createRaceState(3)
  state.phase = 'racing'
  state.totalRaceTime = totalTime
  return state
}

function makeGhost(totalTime: number, samples = 5): Ghost {
  return {
    track: 'Valle de Cocora',
    totalTime,
    lapTimes: [totalTime / 3, totalTime / 3, totalTime / 3],
    samples: Array.from({ length: samples }, (_, i) => ({
      x: i * 1.5,
      y: 2 + i * 0.01,
      z: -i * 2.25,
      heading: 0.1 * i,
      onGround: i % 2 === 0,
      drift: (i % 3) - 1 === 1 ? 1 : i % 3 === 0 ? 0 : -1,
    })),
  }
}

function memoryStorage(): { storage: StorageLike; map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
  }
}

describe('GhostRecorder', () => {
  it('samples every GHOST_SAMPLE_STEPS steps, starting with the first racing step', () => {
    const recorder = new GhostRecorder()
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    for (let step = 0; step < 10; step++) {
      kart.position.x = step
      recorder.record(kart, racing())
    }
    expect(GHOST_SAMPLE_STEPS).toBe(3)
    // Steps 0, 3, 6 and 9
    expect(recorder.sampleCount).toBe(4)
    const ghost = recorder.finish('t', racing(1))
    expect(ghost?.samples.map((s) => s.x)).toEqual([0, 3, 6, 9])
  })

  it('ignores the countdown and the finished phase', () => {
    const recorder = new GhostRecorder()
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const state = createRaceState(3)
    recorder.record(kart, state)
    state.phase = 'finished'
    recorder.record(kart, state)
    expect(recorder.sampleCount).toBe(0)
    expect(recorder.finish('t', state)).toBeNull()
  })

  it('quantizes to centimeters and milliradians and can be reset', () => {
    const recorder = new GhostRecorder()
    const kart = createKartState({ x: 1.23456, y: 0.004, z: -7.8912 }, 0.123456)
    recorder.record(kart, racing())
    const sample = recorder.finish('t', racing(2))?.samples[0]
    expect(sample).toMatchObject({ x: 1.23, y: 0, z: -7.89, heading: 0.123 })
    recorder.reset()
    expect(recorder.sampleCount).toBe(0)
  })
})

describe('ghost serialization', () => {
  it('roundtrips a ghost exactly', () => {
    const ghost = makeGhost(91.234)
    const back = deserializeGhost(serializeGhost(ghost), ghost.track)
    expect(back?.totalTime).toBeCloseTo(ghost.totalTime, 3)
    expect(back?.lapTimes[0]).toBeCloseTo(ghost.lapTimes[0] ?? 0, 3)
    expect(back?.samples.length).toBe(ghost.samples.length)
    ghost.samples.forEach((sample, i) => {
      expect(back?.samples[i]?.x).toBeCloseTo(sample.x, 2)
      expect(back?.samples[i]?.z).toBeCloseTo(sample.z, 2)
      expect(back?.samples[i]?.heading).toBeCloseTo(sample.heading, 3)
      expect(back?.samples[i]?.onGround).toBe(sample.onGround)
      expect(back?.samples[i]?.drift).toBe(sample.drift)
    })
    // A second pass changes nothing
    expect(serializeGhost(back as Ghost)).toBe(serializeGhost(ghost))
  })

  it('roundtrips samples produced by the recorder (quantized values are stable)', () => {
    const recorder = new GhostRecorder()
    const kart = createKartState({ x: 12.3456, y: 3.14159, z: -98.7654 }, -2.71828)
    kart.onGround = false
    kart.drift.direction = -1
    recorder.record(kart, racing())
    const ghost = recorder.finish('Valle de Cocora', racing(10.5)) as Ghost
    expect(deserializeGhost(serializeGhost(ghost))).toEqual(ghost)
  })

  it.each([
    ['not json', '{{{'],
    ['null', 'null'],
    ['wrong version', JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), v: 0 })],
    [
      'missing samples',
      JSON.stringify({ v: 1, track: 'Valle de Cocora', t: 1000, l: [], dt: 0.05 }),
    ],
    [
      'misaligned samples',
      JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), s: [1, 2, 3] }),
    ],
    [
      'non-integer values',
      JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), s: [1, 2, 3, 4, 0.5] }),
    ],
    [
      'invalid flags',
      JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), s: [0, 0, 0, 0, 99] }),
    ],
    [
      'bad sample interval',
      JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), dt: 0.5 }),
    ],
    ['bad total time', JSON.stringify({ ...JSON.parse(serializeGhost(makeGhost(60))), t: -5 })],
  ])('rejects corrupted data: %s', (_name, raw) => {
    expect(deserializeGhost(raw)).toBeNull()
  })

  it('rejects a ghost from another track', () => {
    expect(deserializeGhost(serializeGhost(makeGhost(60)), 'Otra pista')).toBeNull()
  })
})

describe('ghostPoseAt', () => {
  const ghost: Ghost = {
    track: 't',
    totalTime: 1,
    lapTimes: [1],
    samples: [
      { x: 0, y: 0, z: 0, heading: 0, onGround: true, drift: 0 },
      { x: 2, y: 1, z: 4, heading: 1, onGround: false, drift: 1 },
      { x: 4, y: 1, z: 8, heading: 3.1, onGround: false, drift: 1 },
    ],
  }

  it('returns the samples exactly at their times', () => {
    expect(ghostPoseAt(ghost, 0)).toMatchObject({ x: 0, z: 0, onGround: true })
    expect(ghostPoseAt(ghost, GHOST_SAMPLE_INTERVAL)).toMatchObject({ x: 2, y: 1, z: 4 })
    expect(ghostPoseAt(ghost, ghostDuration(ghost))).toMatchObject({ x: 4, z: 8 })
  })

  it('interpolates linearly between samples', () => {
    const pose = ghostPoseAt(ghost, GHOST_SAMPLE_INTERVAL / 2)
    expect(pose?.x).toBeCloseTo(1)
    expect(pose?.y).toBeCloseTo(0.5)
    expect(pose?.z).toBeCloseTo(2)
    expect(pose?.heading).toBeCloseTo(0.5)
    expect(pose?.speed).toBeCloseTo(Math.hypot(2, 4) / GHOST_SAMPLE_INTERVAL)
  })

  it('interpolates the heading along the shortest arc', () => {
    const wrap: Ghost = {
      ...ghost,
      samples: [
        { x: 0, y: 0, z: 0, heading: 3.0, onGround: true, drift: 0 },
        { x: 0, y: 0, z: 0, heading: -3.0, onGround: true, drift: 0 },
      ],
    }
    const heading = ghostPoseAt(wrap, GHOST_SAMPLE_INTERVAL / 2)?.heading ?? 0
    expect(Math.abs(Math.abs(heading) - Math.PI)).toBeLessThan(0.01)
  })

  it('clamps negative times and ends after the last sample', () => {
    expect(ghostPoseAt(ghost, -1)).toMatchObject({ x: 0 })
    expect(ghostPoseAt(ghost, ghostDuration(ghost) + 0.01)).toBeNull()
    expect(ghostPoseAt({ ...ghost, samples: [] }, 0)).toBeNull()
  })
})

describe('lapDelta', () => {
  const ghost = { ...makeGhost(90), lapTimes: [30, 31, 29] }

  it('compares cumulative times at the end of each lap', () => {
    expect(lapDelta(ghost, 0, [29.5])).toBeCloseTo(-0.5)
    expect(lapDelta(ghost, 1, [29.5, 32])).toBeCloseTo(0.5)
  })

  it('is null when either side lacks that lap', () => {
    expect(lapDelta(ghost, 3, [30, 30, 30, 30])).toBeNull()
    expect(lapDelta(ghost, 1, [30])).toBeNull()
  })
})

describe('saving the best ghost', () => {
  let store: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    store = memoryStorage()
  })

  it('isBetterGhost needs no ghost or a slower one', () => {
    expect(isBetterGhost(null, 100)).toBe(true)
    expect(isBetterGhost(makeGhost(100), 99.9)).toBe(true)
    expect(isBetterGhost(makeGhost(100), 100)).toBe(false)
    expect(isBetterGhost(makeGhost(100), 101)).toBe(false)
    expect(isBetterGhost(null, Number.NaN)).toBe(false)
  })

  it('saves the first run and only replaces it with a faster one', () => {
    const key = ghostStorageKey('Valle de Cocora')
    expect(key).toBe('chiguirokart.ghost.v1.valle_de_cocora')

    expect(saveGhostIfBetter(makeGhost(100), store.storage)).toEqual({
      isNewBest: true,
      saved: true,
    })
    const first = store.map.get(key)

    expect(saveGhostIfBetter(makeGhost(105), store.storage)).toEqual({
      isNewBest: false,
      saved: false,
    })
    expect(store.map.get(key)).toBe(first)

    expect(saveGhostIfBetter(makeGhost(95), store.storage).isNewBest).toBe(true)
    expect(loadGhost('Valle de Cocora', store.storage)?.totalTime).toBeCloseTo(95)
  })

  it('treats corrupted stored data as no ghost and overwrites it', () => {
    store.map.set(ghostStorageKey('Valle de Cocora'), 'garbage')
    expect(loadGhost('Valle de Cocora', store.storage)).toBeNull()
    expect(saveGhostIfBetter(makeGhost(120), store.storage).saved).toBe(true)
    expect(loadGhost('Valle de Cocora', store.storage)?.totalTime).toBeCloseTo(120)
  })

  it('survives a storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadGhost('Valle de Cocora', broken)).toBeNull()
    expect(saveGhostIfBetter(makeGhost(100), broken)).toEqual({ isNewBest: true, saved: false })
  })
})

describe('ghost size', () => {
  it('a full 3-lap Cocora run stays small', () => {
    const recorder = new GhostRecorder()
    const run = runSolo({
      laps: 3,
      onStep: (_step, racer) => recorder.record(racer.kart, racer.race.state),
    })
    expect(run.finished).toBe(true)
    const ghost = recorder.finish('Valle de Cocora', {
      ...createRaceState(3),
      totalRaceTime: run.totalTime,
      lapTimes: run.lapTimes,
    }) as Ghost
    const bytes = serializeGhost(ghost).length
    console.log(
      `ghost: ${ghost.samples.length} samples, ${bytes} bytes, ${run.totalTime.toFixed(1)} s`,
    )
    expect(bytes).toBeLessThan(50_000)
    const back = deserializeGhost(serializeGhost(ghost)) as Ghost
    expect(back.samples).toEqual(ghost.samples)
  })
})
