import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { Route } from '../src/ai/route'
import { botDifficulties, defaultRubberBand } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { amazonasData, amazonasTheme } from '../src/config/tracks/amazonasTrack'
import { canoCristalesData, canoCristalesTheme } from '../src/config/tracks/canoCristalesTrack'
import { llanosData, llanosTheme } from '../src/config/tracks/llanosTrack'
import { tatacoaData, tatacoaTheme } from '../src/config/tracks/tatacoaTrack'
import type { TrackTheme } from '../src/config/tracks/theme'
import { BotManager } from '../src/sim/botManager'
import type { Racer } from '../src/sim/racer'
import { gridPose } from '../src/sim/racer'
import { Track } from '../src/sim/track'
import { branchLength } from '../src/sim/trackSpline'
import {
  buildTrackDefinition,
  loopSelfIntersects,
  validateTrackData,
  type TrackData,
} from '../src/sim/trackData'
import { RaceWorld } from '../src/sim/world'
import { themeLandmarks } from './helpers/themeLandmarks'

const DT = 1 / 60
const LAPS = 2
const MAX_SECONDS = 240
const SAMPLE_EVERY = 4

interface SoloReport {
  finished: boolean
  lapTimes: number[]
  respawns: number
  /** Largest distance from the road minus its half-width (m); <= 0 when always inside. */
  maxOutside: number
  /** Samples (one every few steps) spent inside a branch corridor. */
  branchSteps: number
}

/** One normal-difficulty bot alone on the track, no rubber band. */
function runSolo(data: TrackData, shortcutChance: number): SoloReport {
  const world = new RaceWorld(buildTrackDefinition(data), defaultKartPhysics, defaultDrift, {
    totalLaps: LAPS,
    countdownSeconds: 0.5,
  })
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
    rubberBand: { ...defaultRubberBand, enabled: false },
  })
  const skill = { ...botDifficulties.normal, shortcutChance, wanderAmplitude: 0 }
  manager.addBot(new RacingBot({ skill, seed: 1 }))
  const racer = manager.getBotRacers()[0] as Racer
  const result: SoloReport = {
    finished: false,
    lapTimes: [],
    respawns: 0,
    maxOutside: -Infinity,
    branchSteps: 0,
  }
  let previous = { ...racer.kart.position }
  for (let step = 0; step < Math.ceil(MAX_SECONDS / DT); step++) {
    manager.update(DT)
    const position = racer.kart.position
    // The position is sampled every few steps: it is enough to see where the bot drives
    if (step % SAMPLE_EVERY === 0) {
      const projection = world.track.project(position.x, position.z)
      result.maxOutside = Math.max(result.maxOutside, projection.distance - projection.halfWidth)
      if (projection.branch >= 0 && projection.distance <= projection.halfWidth) {
        result.branchSteps++
      }
    }
    if (Math.hypot(position.x - previous.x, position.z - previous.z) > 3) result.respawns++
    previous = { ...position }
    if (racer.race.state.phase === 'finished') {
      result.finished = true
      break
    }
  }
  result.lapTimes = [...racer.race.state.lapTimes]
  return result
}

const runs = new Map<string, SoloReport>()

/** Solo runs are deterministic, so tests that ask for the same run share it. */
function cachedRun(key: string, data: TrackData, shortcutChance: number): SoloReport {
  let result = runs.get(key)
  if (!result) {
    result = runSolo(data, shortcutChance)
    runs.set(key, result)
  }
  return result
}

function totalTime(result: SoloReport): number {
  return result.lapTimes.reduce((sum, lap) => sum + lap, 0)
}

/** The same track with only branch `index`, to check each shortcut on its own. */
function onlyBranch(data: TrackData, index: number): TrackData {
  const branch = data.branches[index]
  if (!branch) throw new Error(`Missing branch ${index}`)
  return { ...data, branches: [branch] }
}

interface TrackCase {
  id: string
  data: TrackData
  theme: TrackTheme
  /** Fastest allowed ratio of branch length to the main stretch it skips. */
  maxBranchRatio: number
}

const cases: TrackCase[] = [
  { id: 'canoCristales', data: canoCristalesData, theme: canoCristalesTheme, maxBranchRatio: 0.75 },
  { id: 'llanos', data: llanosData, theme: llanosTheme, maxBranchRatio: 0.75 },
  { id: 'amazonas', data: amazonasData, theme: amazonasTheme, maxBranchRatio: 0.85 },
  { id: 'tatacoa', data: tatacoaData, theme: tatacoaTheme, maxBranchRatio: 0.85 },
]

/** Centerline sample indices (0-based) a gate sits at. */
function gateSample(track: Track, gate: number, count: number): number {
  return Math.floor((gate * track.centerline.length) / count)
}

for (const { id, data, theme, maxBranchRatio } of cases) {
  describe(`${data.name} (${id})`, () => {
    const definition = buildTrackDefinition(data)
    const track = new Track(definition)
    const route = new Route(track)

    it('is a valid, well-proportioned circuit', () => {
      expect(validateTrackData(data)).toEqual([])
      expect(loopSelfIntersects(definition.centerline)).toBe(false)
      expect(track.loopLength).toBeGreaterThanOrEqual(700)
      expect(track.loopLength).toBeLessThanOrEqual(1100)
      expect(data.halfWidth).toBeGreaterThanOrEqual(8)
      expect(data.halfWidth).toBeLessThanOrEqual(10)
      for (const point of data.points) {
        expect(point.y).toBeGreaterThanOrEqual(-3)
      }
    })

    it('has smooth heights along the loop', () => {
      const line = track.centerline
      let travelled = 0
      let worst = 0
      for (let i = 0; i < line.length; i++) {
        const a = track.point(i)
        const b = track.point(i + 3)
        const rise = Math.abs(track.groundHeight(b.x, b.z) - track.groundHeight(a.x, a.z))
        const run = Math.hypot(b.x - a.x, b.z - a.z)
        worst = Math.max(worst, (rise / run) * 10)
        travelled += run
      }
      expect(travelled).toBeGreaterThan(0)
      expect(worst).toBeLessThan(1.5)
    })

    it('has no tight corners', () => {
      const line = track.centerline
      const step = 3
      for (let i = 0; i < line.length; i++) {
        const a = track.point(i - step)
        const b = track.point(i)
        const c = track.point(i + step)
        const ab = Math.hypot(b.x - a.x, b.z - a.z)
        const bc = Math.hypot(c.x - b.x, c.z - b.z)
        const ac = Math.hypot(c.x - a.x, c.z - a.z)
        const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x))
        const radius = area2 < 1e-9 ? Infinity : (ab * bc * ac) / (2 * area2)
        expect(radius).toBeGreaterThan(20)
      }
    })

    it('places the 8 grid slots on the road behind the start line', () => {
      for (let slot = 0; slot < 8; slot++) {
        const { position } = gridPose(track, slot)
        const projection = track.project(position.x, position.z)
        expect(projection.distance).toBeLessThan(projection.halfWidth - defaultKartPhysics.radius)
      }
    })

    it('has pickups, a boost pad and a complete theme', () => {
      expect(data.itemBoxRows.length).toBeGreaterThanOrEqual(3)
      expect(data.itemBoxRows.length).toBeLessThanOrEqual(5)
      for (const row of data.itemBoxRows) {
        expect(row.count).toBeGreaterThanOrEqual(3)
        expect(row.count).toBeLessThanOrEqual(4)
      }
      expect(data.uchuvaLines.length).toBeGreaterThanOrEqual(5)
      expect(data.uchuvaLines.length).toBeLessThanOrEqual(7)
      expect(definition.boostPads?.length ?? 0).toBeGreaterThanOrEqual(1)
      // Nothing is picked up on a boost pad
      for (const pad of definition.boostPads ?? []) {
        for (const spot of [...(definition.itemBoxes ?? []), ...(definition.uchuvas ?? [])]) {
          expect(Math.hypot(spot.x - pad.position.x, spot.z - pad.position.z)).toBeGreaterThan(6)
        }
      }
      expect(new Set(themeLandmarks(theme)).size).toBeGreaterThanOrEqual(4)
      for (const color of [theme.sky, theme.horizon, theme.fog, theme.ground, theme.road]) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      }
      expect(theme.fogFar).toBeGreaterThan(theme.fogNear)
    })

    it('has shortcuts shorter than the road they skip, and legal checkpoints', () => {
      expect(track.branches.length).toBeGreaterThanOrEqual(1)
      const skipped = new Set<number>()
      track.branches.forEach((branch, index) => {
        const junction = route.junctions[index]
        if (!junction) throw new Error('Missing junction')
        const main = route.mainDistanceAhead(junction.startIndex, junction.endIndex)
        expect(branchLength(branch)).toBeLessThan(main * maxBranchRatio)
        const span =
          (junction.endIndex - junction.startIndex + track.centerline.length) %
          track.centerline.length
        for (let gate = 0; gate < data.checkpoints.count; gate++) {
          const rel =
            (gateSample(track, gate, data.checkpoints.count) -
              junction.startIndex +
              track.centerline.length) %
            track.centerline.length
          if (rel > 0 && rel <= span) skipped.add(gate)
        }
      })
      // Exactly the gates a shortcut jumps over are optional, so nothing else can be cut
      expect([...skipped].sort((a, b) => a - b)).toEqual(
        [...data.checkpoints.optional].sort((a, b) => a - b),
      )
      expect(skipped.has(0)).toBe(false)
    })

    it('lets a normal bot drive 2 laps on the main road without leaving it', () => {
      const result = cachedRun(`${id}:main`, data, 0)
      expect(result.finished).toBe(true)
      expect(result.lapTimes).toHaveLength(LAPS)
      expect(result.respawns).toBe(0)
      expect(result.maxOutside).toBeLessThanOrEqual(0)
      expect(result.branchSteps).toBe(0)
    })

    data.branches.forEach((branch, index) => {
      it(`lets a bot drive 2 laps through "${branch.name}"`, () => {
        const result = cachedRun(`${id}:branch${index}`, onlyBranch(data, index), 1)
        expect(result.finished).toBe(true)
        expect(result.lapTimes).toHaveLength(LAPS)
        expect(result.respawns).toBe(0)
        expect(result.maxOutside).toBeLessThanOrEqual(0)
        expect(result.branchSteps).toBeGreaterThan(25)
        // A shortcut that is not faster would be a trap, not a shortcut
        expect(totalTime(result)).toBeLessThan(totalTime(cachedRun(`${id}:main`, data, 0)))
      })
    })

    it('keeps its hazards sensible', () => {
      for (const hazard of definition.hazards ?? []) {
        expect(hazard.path.length).toBeGreaterThanOrEqual(1)
        if (hazard.kind === 'rock') {
          // Boulders sit inside a shortcut and leave its middle line free for a kart
          const rock = hazard.path[0]
          if (!rock) throw new Error('Rock without position')
          const projection = track.project(rock.x, rock.z)
          expect(projection.branch).toBeGreaterThanOrEqual(0)
          expect(projection.distance).toBeGreaterThan(hazard.radius + defaultKartPhysics.radius)
          expect(projection.distance).toBeLessThan(projection.halfWidth)
        }
        if (hazard.kind === 'herd') {
          // The herd runs from well outside one side of the road to well outside the other
          const [from, to] = [hazard.path[0], hazard.path[hazard.path.length - 1]]
          if (!from || !to) throw new Error('Herd without path')
          for (const end of [from, to]) {
            const projection = track.mainProjection(end.x, end.z)
            expect(projection.distance).toBeGreaterThan(track.halfWidth + 10)
          }
          const crossing = track.mainProjection((from.x + to.x) / 2, (from.z + to.z) / 2)
          expect(crossing.distance).toBeLessThan(track.halfWidth + 40)
          expect(hazard.motion).toBe('pingPong')
          expect(hazard.count).toBeGreaterThanOrEqual(4)
          expect(hazard.count).toBeLessThanOrEqual(6)
        }
      }
    })
  })
}
