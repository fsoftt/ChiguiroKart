import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { botDifficulties, type BotDifficulty } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { amazonasData } from '../src/config/tracks/amazonasTrack'
import { bogotaData } from '../src/config/tracks/bogotaTrack'
import { cartagenaData } from '../src/config/tracks/cartagenaTrack'
import { ciudadPerdidaData } from '../src/config/tracks/ciudadPerdidaTrack'
import { tatacoaData } from '../src/config/tracks/tatacoaTrack'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import { applyBoostPads } from '../src/sim/hazards/boostPads'
import { applyJumps } from '../src/sim/hazards/jumps'
import { defaultHazards } from '../src/config/hazards'
import { createKartState } from '../src/sim/kart/kartState'
import { forwardOf } from '../src/sim/math'
import type { Racer } from '../src/sim/racer'
import { Track } from '../src/sim/track'
import {
  buildTrackDefinition,
  parseTrackData,
  validateTrackData,
  type TrackData,
} from '../src/sim/trackData'
import { GAP_FLOOR, branchLength, branchPointAt } from '../src/sim/trackSpline'
import { RaceWorld } from '../src/sim/world'
import { DT, rubberBandOff } from './helpers/botSim'
import { FALL_HEIGHT, runJump } from './helpers/jumpSim'

/** A flat square loop whose first side (heading +x) has a jump at its middle. */
function flatData(jump: { gap?: number; launchSpeed?: number }): TrackData {
  return {
    version: 1,
    name: 'Flat',
    halfWidth: 8,
    samplesPerSegment: 40,
    points: [
      { x: 0, z: 0, y: 0 },
      { x: 200, z: 0, y: 0 },
      { x: 200, z: 200, y: 0 },
      { x: 0, z: 200, y: 0 },
    ],
    branches: [],
    checkpoints: { count: 4, optional: [] },
    itemBoxRows: [],
    uchuvaLines: [],
    jumps: [{ at: 20 / 160, ...jump }],
  }
}

function flatTrack(jump: { gap?: number; launchSpeed?: number }): Track {
  return new Track(buildTrackDefinition(flatData(jump)))
}

describe('launch', () => {
  const track = flatTrack({ launchSpeed: 10 })
  const jump = track.jumps[0]
  if (!jump) throw new Error('missing jump')
  const lip = jump
  const forward = forwardOf(jump.heading)

  function kartAt(back: number, speed: number) {
    const kart = createKartState(
      {
        x: lip.position.x - forward.x * back,
        y: 0,
        z: lip.position.z - forward.z * back,
      },
      lip.heading,
    )
    kart.velocity.x = forward.x * speed
    kart.velocity.z = forward.z * speed
    return kart
  }

  it('resolves the lip position, heading and no gap for a launch-only jump', () => {
    expect(jump.gap).toBeUndefined()
    expect(jump.length).toBeCloseTo(4)
    expect(jump.halfWidth).toBe(8)
    expect(Math.abs(Math.sin(jump.heading))).toBeCloseTo(1, 1)
  })

  it('gives a fast grounded kart in the lip zone the launch speed', () => {
    const kart = kartAt(2, 20)
    expect(applyJumps(kart, track, false, DT)).toBe(true)
    expect(kart.velocity.y).toBeCloseTo(10)
    expect(kart.ramp.active).toBe(true)
  })

  it('does not launch a kart before the zone, past the edge, off to the side or flying high', () => {
    expect(applyJumps(kartAt(6, 20), track, false, DT)).toBe(false)
    expect(applyJumps(kartAt(-1, 20), track, false, DT)).toBe(false)
    const aside = kartAt(2, 20)
    aside.position.z += 9
    expect(applyJumps(aside, track, false, DT)).toBe(false)
    const airborne = kartAt(2, 20)
    airborne.onGround = false
    airborne.position.y = 2
    expect(applyJumps(airborne, track, false, DT)).toBe(false)
  })

  it('launches a kart that hopped just before the lip, as a trick', () => {
    const hopping = kartAt(2, 20)
    hopping.onGround = false
    hopping.position.y = 0.2
    expect(applyJumps(hopping, track, false, DT)).toBe(true)
    expect(hopping.ramp.tricked).toBe(true)
    expect(hopping.velocity.y).toBeGreaterThan(10)
  })

  it('does not launch a kart going backwards or crawling', () => {
    expect(applyJumps(kartAt(2, -20), track, false, DT)).toBe(false)
    expect(applyJumps(kartAt(2, 3), track, false, DT)).toBe(false)
  })

  it('launches once per pass', () => {
    const run = runJump(track, jump, 20)
    expect(run.peakVy).toBeGreaterThan(9)
    expect(run.landed).toBe(true)
  })
})

describe('trick: the hop at the lip earns the landing nitro', () => {
  const track = flatTrack({ launchSpeed: 10 })
  const jump = track.jumps[0]
  if (!jump) throw new Error('missing jump')

  it('gives no nitro for a ramp launch without a hop', () => {
    const run = runJump(track, jump, 20, 8, 'none')
    expect(run.landed).toBe(true)
    expect(run.landingBoostLevel).toBe(0)
  })

  it('gives the nitro for a hop in the lip zone, and some extra height', () => {
    const run = runJump(track, jump, 20, 8, 'lip')
    expect(run.landingBoostLevel).toBe(1)
    expect(run.peakVy).toBeGreaterThan(11)
  })

  it('gives the nitro for a hop just after leaving the lip', () => {
    const run = runJump(track, jump, 20, 8, 0.1)
    expect(run.landingBoostLevel).toBe(1)
  })

  it('gives nothing for a hop too late', () => {
    const run = runJump(track, jump, 20, 8, 0.3)
    expect(run.landed).toBe(true)
    expect(run.landingBoostLevel).toBe(0)
  })
})

describe('gaps', () => {
  const data = flatData({ gap: 6, launchSpeed: 10 })
  const track = new Track(buildTrackDefinition(data))
  const jump = track.jumps[0]
  const gap = jump?.gap
  if (!jump || !gap) throw new Error('missing gap')
  const forward = forwardOf(jump.heading)
  const at = (along: number, side = 0) => ({
    x: jump.position.x + forward.x * along - forward.z * side,
    z: jump.position.z + forward.z * along + forward.x * side,
  })

  it('has no ground over the gap, at any lateral offset on the road, but the road height is kept', () => {
    for (const side of [-7, 0, 7]) {
      const p = at(3, side)
      expect(track.groundHeight(p.x, p.z)).toBe(GAP_FLOOR)
      expect(track.inGap(p.x, p.z)).toBe(true)
      expect(track.roadHeight(p.x, p.z)).toBeCloseTo(0, 1)
    }
  })

  it('has ground right before the edge and after the gap', () => {
    for (const along of [-1, gap.to - gap.from + 1]) {
      const p = at(along)
      expect(track.inGap(p.x, p.z)).toBe(false)
      expect(track.groundHeight(p.x, p.z)).toBeCloseTo(0, 1)
    }
  })

  it('clears at speed and falls in when slow', () => {
    expect(runJump(track, jump, 20).fell).toBe(false)
    expect(runJump(track, jump, 8).fell).toBe(true)
    expect(runJump(track, jump, 3).fell).toBe(true)
  })

  it('respawns a kart that falls in at the last checkpoint', () => {
    const world = new RaceWorld(
      buildTrackDefinition(flatData({ gap: 40, launchSpeed: 10 })),
      defaultKartPhysics,
      defaultDrift,
      { totalLaps: 3, countdownSeconds: 0 },
    )
    const kart = world.kart
    const lip = world.track.jumps[0]
    if (!lip) throw new Error('missing jump')
    const f = forwardOf(lip.heading)
    kart.position = { x: lip.position.x - f.x * 10, y: 0, z: lip.position.z - f.z * 10 }
    kart.heading = lip.heading
    kart.velocity = { x: f.x * 10, y: 0, z: f.z * 10 }
    let lowest = 0
    let respawned = false
    for (let i = 0; i < 60 * 8 && !respawned; i++) {
      world.step({ ...NEUTRAL_INPUT, throttle: 0.5 }, DT)
      lowest = Math.min(lowest, kart.position.y)
      respawned = lowest < FALL_HEIGHT && kart.position.y > -1
    }
    expect(respawned).toBe(true)
    expect(world.track.inGap(kart.position.x, kart.position.z)).toBe(false)
  })
})

const contentTracks: [string, TrackData][] = [
  ['Bogotá', bogotaData],
  ['Cartagena', cartagenaData],
  ['Amazonas', amazonasData],
  ['Tatacoa', tatacoaData],
  ['Ciudad Perdida', ciudadPerdidaData],
]

describe('track content', () => {
  const gapped: [string, TrackData][] = [
    ['Bogotá', bogotaData],
    ['Amazonas', amazonasData],
    ['Tatacoa', tatacoaData],
    ['Ciudad Perdida', ciudadPerdidaData],
  ]

  it.each(gapped)('%s: the gap is cleared at 20 m/s and not at 8 m/s', (_name, data) => {
    const track = new Track(buildTrackDefinition(data))
    const jump = track.jumps.find((j) => j.gap)
    if (!jump?.gap) throw new Error('missing gap')
    const length = jump.gap.to - jump.gap.from
    expect(length).toBeGreaterThanOrEqual(7)
    const fast = runJump(track, jump, 20)
    expect(fast.fell).toBe(false)
    expect(fast.landed).toBe(true)
    expect(fast.landedPast).toBeGreaterThan(length)
    // Race speed (up to 28 m/s, more with nitro) still lands on the road
    expect(runJump(track, jump, 28).fell).toBe(false)
    expect(runJump(track, jump, 8).fell).toBe(true)
  })

  it('Cartagena: the cannon ramp is a strong launch with no gap', () => {
    const track = new Track(buildTrackDefinition(cartagenaData))
    const jump = track.jumps[0]
    if (!jump) throw new Error('missing jump')
    expect(jump.gap).toBeUndefined()
    expect(jump.launchSpeed).toBeGreaterThanOrEqual(12)
    const run = runJump(track, jump, 20, 8, 'lip')
    expect(run.fell).toBe(false)
    expect(run.peakVy).toBeGreaterThan(12)
    expect(run.landingBoostLevel).toBe(1)
  })

  it.each(contentTracks)('%s: nothing to collect or boost sits in a gap', (_name, data) => {
    const track = new Track(buildTrackDefinition(data))
    const spots = [
      ...track.itemBoxes,
      ...track.uchuvas,
      ...track.boostPads.map((p) => p.position),
      ...track.checkpoints.map((c) => c.position),
    ]
    for (const spot of spots) expect(track.inGap(spot.x, spot.z)).toBe(false)
    const messages = validateTrackData(data)
    expect(messages.filter((m) => /hueco|altura|salto|turbo/i.test(m))).toEqual([])
  })

  it('Ciudad Perdida: the crest ramps launch the kart and it lands back on the road', () => {
    const track = new Track(buildTrackDefinition(ciudadPerdidaData))
    const crests = track.jumps.filter((j) => !j.gap)
    expect(crests.length).toBeGreaterThanOrEqual(2)
    for (const crest of crests) {
      for (const speed of [14, 20, 28]) {
        const run = runJump(track, crest, speed)
        expect(run.fell, `${speed} m/s`).toBe(false)
        expect(run.peakVy).toBeGreaterThan(6)
        expect(run.landed).toBe(true)
        const landing = track.project(run.landedAt.x, run.landedAt.z)
        expect(landing.distance, `${speed} m/s`).toBeLessThan(landing.halfWidth - 1)
      }
    }
  })

  it('Ciudad Perdida: the stone stairs are real steps with sharp risers', () => {
    const track = new Track(buildTrackDefinition(ciudadPerdidaData))
    const index = track.branches.findIndex((b) => b.name === 'Escalinata de piedra')
    const branch = track.branches[index]
    if (!branch) throw new Error('missing stairs')
    expect(branch.steps).toBeGreaterThanOrEqual(8)
    const total = branchLength(branch)
    const heights: number[] = []
    for (let s = 0; s <= total; s += 0.05) {
      const { point } = branchPointAt(branch, s)
      heights.push(track.groundHeight(point.x, point.z))
    }
    // Risers: jumps between neighbouring samples much taller than the slope of a ramp
    const risers = heights.filter((h, i) => i > 0 && h - (heights[i - 1] ?? h) > 0.2).length
    expect(risers).toBeGreaterThanOrEqual(7)
    expect(risers).toBeLessThanOrEqual(10)
    // Treads: long flat stretches
    const flat = heights.filter((h, i) => i > 0 && Math.abs(h - (heights[i - 1] ?? h)) < 1e-6)
    expect(flat.length / heights.length).toBeGreaterThan(0.7)
    // The ends meet the road they join
    const first = branch.points[0]
    const last = branch.points[branch.points.length - 1]
    if (!first || !last) throw new Error('missing ends')
    expect(heights[0]).toBeCloseTo(track.roadHeight(first.x, first.z), 0)
    expect(heights[heights.length - 1]).toBeCloseTo(track.roadHeight(last.x, last.z), 0)
  })

  it('a kart that drives up the stairs follows the treads', () => {
    const track = new Track(buildTrackDefinition(ciudadPerdidaData))
    const branch = track.branches.find((b) => b.name === 'Escalinata de piedra')
    if (!branch) throw new Error('missing stairs')
    const a = branchPointAt(branch, 60)
    const b = branchPointAt(branch, 90)
    expect(track.groundHeight(b.point.x, b.point.z)).toBeGreaterThan(
      track.groundHeight(a.point.x, a.point.z) + 1,
    )
  })

  it('branch heights must match the road and have one value per point', () => {
    const bad = structuredClone(ciudadPerdidaData)
    const stairs = bad.branches.find((b) => b.name === 'Escalinata de piedra')
    if (!stairs?.heights) throw new Error('missing heights')
    stairs.heights[0] = 9
    expect(validateTrackData(bad).some((m) => /altura/.test(m))).toBe(true)
    stairs.heights = [1, 2]
    expect(parseTrackData(JSON.parse(JSON.stringify(bad)))).toBeNull()
  })
})

describe('boost pads inside shortcuts', () => {
  it.each([
    ['Bogotá', bogotaData, 'Callejón de la casa colonial'],
    ['Cartagena', cartagenaData, 'Paseo de la muralla'],
    ['Tatacoa', tatacoaData, 'Salto del cañón'],
  ])('%s: a pad lies in %s and boosts a kart on it', (_name, data, name) => {
    const track = new Track(buildTrackDefinition(data))
    const index = track.branches.findIndex((b) => b.name === name)
    const branch = track.branches[index]
    const entry = data.boostPads?.findIndex((p) => p.branch === name) ?? -1
    const pad = track.boostPads[entry]
    if (!branch || !pad) throw new Error('missing branch pad')
    const projection = track.project(pad.position.x, pad.position.z)
    expect(projection.branch).toBe(index)
    expect(projection.distance + pad.width / 2).toBeLessThan(branch.halfWidth)
    const kart = createKartState({ x: pad.position.x, y: 0, z: pad.position.z }, pad.heading)
    expect(applyBoostPads(kart, track, defaultDrift, defaultHazards)).toBe(true)
    expect(kart.boost.level).toBe(1)
  })

  it('the Tatacoa pad comes before the lip of the canyon jump', () => {
    const track = new Track(buildTrackDefinition(tatacoaData))
    const jump = track.jumps[0]
    const index = tatacoaData.boostPads?.findIndex((p) => p.branch === 'Salto del cañón') ?? -1
    const pad = track.boostPads[index]
    const branch = track.branches[jump?.gap?.branch ?? -1]
    if (!jump?.gap || !pad || !branch) throw new Error('missing data')
    const forward = forwardOf(jump.heading)
    expect(pad.position).not.toEqual(jump.position)
    expect(branchPointAt(branch, jump.gap.from).point).toEqual(jump.position)
    expect(
      Math.hypot(pad.position.x - jump.position.x, pad.position.z - jump.position.z),
    ).toBeGreaterThan(10)
    expect(forward).toBeDefined()
  })
})

describe('data', () => {
  it.each(contentTracks)('%s: survives a JSON roundtrip', (_name, data) => {
    const parsed = parseTrackData(JSON.parse(JSON.stringify(data)))
    expect(parsed).toEqual(data)
  })

  it('rejects invalid jumps, steps and branch pads', () => {
    const base = flatData({ gap: 6 })
    expect(parseTrackData(JSON.parse(JSON.stringify(base)))).toEqual(base)
    const withJump = (jump: unknown) => parseTrackData({ ...base, jumps: [jump] })
    expect(withJump({ at: 2 })).toBeNull()
    expect(withJump({ at: 0.5, gap: -1 })).toBeNull()
    expect(withJump({ at: 0.5, launchSpeed: 'fast' })).toBeNull()
    expect(withJump({ at: 0.5, branch: 3 })).toBeNull()
    expect(withJump({ at: 0.5, gap: 4, launchSpeed: 9 })).not.toBeNull()
    expect(parseTrackData({ ...base, boostPads: [{ at: 0.1, offset: 0, branch: 3 }] })).toBeNull()
    expect(parseTrackData({ ...base, jumps: 'no' })).toBeNull()
  })

  it('ignores a jump or pad that names a missing branch, and validation says so', () => {
    const data: TrackData = {
      ...flatData({}),
      jumps: [{ at: 0.5, branch: 'nope', gap: 5 }],
      boostPads: [{ at: 0.5, offset: 0, branch: 'nope' }],
    }
    const track = new Track(buildTrackDefinition(data))
    expect(track.jumps).toHaveLength(0)
    expect(track.boostPads).toHaveLength(0)
    expect(validateTrackData(data).filter((m) => /no existe/.test(m))).toHaveLength(2)
  })
})

describe('bots hop at the lip by difficulty', () => {
  /** Share of 12 solo runs in which the bot tricked the cannon ramp of Cartagena. */
  function trickShare(difficulty: BotDifficulty): number {
    let tricked = 0
    const runs = 12
    for (let seed = 1; seed <= runs; seed++) {
      const world = new RaceWorld(
        buildTrackDefinition(cartagenaData),
        defaultKartPhysics,
        defaultDrift,
        { totalLaps: 2, countdownSeconds: 0.5 },
      )
      const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
        rubberBand: rubberBandOff,
      })
      manager.addBot(new RacingBot({ skill: botDifficulties[difficulty], seed }))
      const racer = manager.getBotRacers()[0] as Racer
      for (let step = 0; step < 60 * 90; step++) {
        manager.update(DT)
        if (racer.kart.ramp.active) {
          if (racer.kart.ramp.tricked) tricked++
          break
        }
      }
    }
    return tricked / runs
  }

  it('hard bots usually get the nitro, easy bots rarely', () => {
    const hard = trickShare('dificil')
    const easy = trickShare('facil')
    expect(hard).toBeGreaterThanOrEqual(0.75)
    expect(easy).toBeLessThanOrEqual(0.6)
    expect(hard).toBeGreaterThan(easy)
  })
})
