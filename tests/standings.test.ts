import { describe, expect, it } from 'vitest'
import type { Checkpoint } from '../src/sim/race/checkpoint'
import { computeStandings, racePosition, raceProgress } from '../src/sim/race/standings'
import { createRacer, type Racer } from '../src/sim/racer'
import { Track, type TrackDefinition } from '../src/sim/track'
import { buildHudModel, formatOrdinal } from '../src/ui/hudModel'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'

const gate = (index: number, x: number, z: number, fx: number, fz: number): Checkpoint => ({
  index,
  position: { x, z },
  forward: { x: fx, z: fz },
  width: 10,
  mandatory: true,
})
/** Square loop 100 m a side, driven +x first; gates sit mid-side facing the travel direction. */
const definition: TrackDefinition = {
  name: 'square',
  centerline: [
    { x: 0, z: -50 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
    { x: -50, z: 50 },
    { x: -50, z: -50 },
  ],
  halfWidth: 5,
  checkpoints: [
    gate(0, 0, -50, 1, 0),
    gate(1, 50, 0, 0, 1),
    gate(2, 0, 50, -1, 0),
    gate(3, -50, 0, 0, -1),
  ],
}
const track = new Track(definition)

function racer(slot = 0): Racer {
  return createRacer(track, { countdownSeconds: 0 }, slot)
}

function place(r: Racer, x: number, z: number, checkpoint = 0, laps = 0): void {
  r.kart.position = { x, y: 0, z }
  r.race.state.lastPassedCheckpoint = checkpoint
  r.race.state.lapTimes = Array.from({ length: laps }, () => 60)
}

function finish(r: Racer, time: number): void {
  r.race.state.phase = 'finished'
  r.race.state.totalRaceTime = time
}

describe('raceProgress', () => {
  it('grows along the segment to the next checkpoint', () => {
    const r = racer()
    place(r, 0, -50)
    const start = raceProgress(r)
    place(r, 50, -50)
    expect(raceProgress(r)).toBeCloseTo(start + 0.5)
    place(r, 50, 0)
    expect(raceProgress(r)).toBeCloseTo(start + 1)
  })

  it('clamps the fraction at 1 past the next checkpoint', () => {
    const r = racer()
    place(r, 50, 20)
    expect(raceProgress(r)).toBeCloseTo(1)
  })

  it('goes below the checkpoint when the kart is behind it', () => {
    const r = racer()
    place(r, -20, -50)
    expect(raceProgress(r)).toBeLessThan(0)
  })

  it('lets completed laps dominate the checkpoint index', () => {
    const lapped = racer()
    const ahead = racer()
    place(lapped, 0, -50, 0, 1)
    place(ahead, 0, 50, 2, 0)
    expect(raceProgress(lapped)).toBeGreaterThan(raceProgress(ahead))
    expect(raceProgress(lapped)).toBeCloseTo(4)
  })

  it('ignores lateral offset on a straight', () => {
    const straight = new Track({
      name: 'straight',
      centerline: [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 30 },
        { x: 0, z: 30 },
      ],
      halfWidth: 5,
      checkpoints: [gate(0, 0, 0, 1, 0), gate(1, 100, 0, 1, 0)],
    })
    const left = createRacer(straight)
    const right = createRacer(straight)
    place(left, 40, -4)
    place(right, 40, 4)
    expect(raceProgress(left)).toBeCloseTo(raceProgress(right))
    expect(raceProgress(left)).toBeCloseTo(0.4)
  })

  it('returns 0 when the track has no checkpoints', () => {
    const empty = new Track({ ...definition, checkpoints: [] })
    expect(raceProgress(createRacer(empty))).toBe(0)
  })
})

describe('computeStandings', () => {
  it('ranks the starting grid with pole position first', () => {
    const racers = [3, 1, 0, 2].map((slot) => racer(slot))
    expect(computeStandings(racers).map((r) => r.slot)).toEqual([0, 1, 2, 3])
  })

  it('does not mutate the input array', () => {
    const racers = [racer(1), racer(0)]
    computeStandings(racers)
    expect(racers.map((r) => r.slot)).toEqual([1, 0])
  })

  it('puts finished racers first, ordered by total time', () => {
    const slow = racer(0)
    const fast = racer(1)
    const running = racer(2)
    place(running, 0, 50, 2, 2)
    finish(slow, 200)
    finish(fast, 150)
    expect(computeStandings([running, slow, fast])).toEqual([fast, slow, running])
  })

  it('breaks ties by slot', () => {
    const a = racer(2)
    const b = racer(1)
    place(a, 50, -50)
    place(b, 50, -50)
    expect(computeStandings([a, b])).toEqual([b, a])
  })

  it('drops a kart that reverses behind its last checkpoint', () => {
    const a = racer(0)
    const b = racer(1)
    place(a, 50, 0, 1)
    place(b, 40, -50, 0)
    expect(racePosition(a, [a, b])).toBe(1)
    place(a, 50, -30, 1)
    expect(racePosition(a, [a, b])).toBe(2)
  })
})

describe('racePosition', () => {
  it('is 1-based', () => {
    const a = racer(0)
    const b = racer(1)
    place(b, 50, -50)
    place(a, 0, -50)
    expect(racePosition(b, [a, b])).toBe(1)
    expect(racePosition(a, [a, b])).toBe(2)
  })
})

describe('hud position text', () => {
  it('formats Spanish ordinals', () => {
    expect(formatOrdinal(1)).toBe('1.º')
  })

  it('builds the badge and the final results line', () => {
    const r = racer()
    const position = { rank: 2, total: 4 }
    const running = buildHudModel(r.kart, defaultKartPhysics, defaultDrift, r.race.state, position)
    expect(running.positionText).toBe('2.º')
    expect(running.positionTotalText).toBe('/4')
    expect(running.finalPositionText).toBe('')

    finish(r, 100)
    const done = buildHudModel(r.kart, defaultKartPhysics, defaultDrift, r.race.state, position)
    expect(done.finalPositionText).toBe('Posición: 2.º de 4')
  })
})
